import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, shadows, typography } from '@/constants/theme';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useThemedColors } from '@/hooks/useThemedColors';

interface GroupMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    id: string;
    full_name: string | null;
    profile_image_url: string | null;
  };
}

interface GroupConversation {
  id: string;
  name: string | null;
  created_by: string;
}

interface GroupMember {
  user_id: string;
  user_profiles: {
    id: string;
    full_name: string | null;
    profile_image_url: string | null;
  };
}

export default function GroupChatConversationScreen() {
  const colors = useThemedColors();
  const { groupConversationId } = useLocalSearchParams<{
    groupConversationId: string;
  }>();

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [groupInfo, setGroupInfo] = useState<GroupConversation | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  useEffect(() => {
    if (user && groupConversationId) {
      fetchGroupInfo();
      fetchMembers();
      fetchMessages();
      const messagesCleanup = subscribeToMessages();
      const deletionCleanup = subscribeToGroupDeletion();
      return () => {
        messagesCleanup();
        deletionCleanup();
      };
    }
  }, [groupConversationId, user]);

  const fetchGroupInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('group_conversations')
        .select('id, name, created_by')
        .eq('id', groupConversationId)
        .single();

      if (error) throw error;
      if (data) setGroupInfo(data);
    } catch (error: any) {
      console.error('Error fetching group info:', error);
    }
  };

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('group_chat_members')
        .select(`
          user_id,
          user_profiles(id, full_name, profile_image_url)
        `)
        .eq('group_conversation_id', groupConversationId);

      if (error) throw error;
      if (data) setMembers(data as any);
    } catch (error: any) {
      console.error('Error fetching members:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('group_messages')
        .select(`
          id,
          sender_id,
          content,
          created_at,
          sender:user_profiles!group_messages_sender_id_fkey(
            id,
            full_name,
            profile_image_url
          )
        `)
        .eq('group_conversation_id', groupConversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data) {
        setMessages(data as any);
        // Update last read timestamp
        setTimeout(() => {
          updateLastRead();
        }, 500);
      }
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  };

  const updateLastRead = async () => {
    try {
      await supabase
        .from('group_chat_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('group_conversation_id', groupConversationId)
        .eq('user_id', user?.id);
    } catch (error) {
      console.error('Error updating last read:', error);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`group-messages-${groupConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_conversation_id=eq.${groupConversationId}`,
        },
        async (payload) => {
          const newMsg = payload.new as GroupMessage;

          // Fetch sender info for the new message
          const { data: senderData } = await supabase
            .from('user_profiles')
            .select('id, full_name, profile_image_url')
            .eq('id', newMsg.sender_id)
            .single();

          const messageWithSender = {
            ...newMsg,
            sender: senderData,
          };

          setMessages((prev) => [...prev, messageWithSender]);

          // Auto-scroll to bottom
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);

          // Update last read if message is from someone else
          if (newMsg.sender_id !== user?.id) {
            updateLastRead();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const subscribeToGroupDeletion = () => {
    const channel = supabase
      .channel(`group-deletion-${groupConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'group_conversations',
          filter: `id=eq.${groupConversationId}`,
        },
        () => {
          // Group chat was deleted
          router.back();
          showAlert('Group Deleted', 'This group chat has been deleted');
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'group_chat_members',
          filter: `group_conversation_id=eq.${groupConversationId}`,
        },
        async (payload) => {
          // Check if the deleted member was the current user
          const deletedMember = payload.old as any;
          if (deletedMember.user_id === user?.id) {
            router.back();
            showAlert('Removed from Group', 'You have been removed from this group chat');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const { error } = await supabase.from('group_messages').insert({
        group_conversation_id: groupConversationId,
        sender_id: user?.id,
        content: messageContent,
      });

      if (error) throw error;
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to send message');
      setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteGroup = async () => {
    setShowMenu(false);

    // Use browser's confirm dialog on web, Alert.alert on mobile
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to delete this group chat? This action cannot be undone and all messages will be deleted.')
      : await new Promise((resolve) => {
          Alert.alert(
            'Delete Group Chat',
            'Are you sure you want to delete this group chat? This action cannot be undone and all messages will be deleted.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('group_conversations')
        .delete()
        .eq('id', groupConversationId);

      if (error) throw error;

      router.back();
      showAlert('Success', 'Group chat deleted successfully');
    } catch (error: any) {
      console.error('Error deleting group:', error);
      showAlert('Error', 'Failed to delete group chat: ' + error.message);
    }
  };

  const handleLeaveGroup = async () => {
    setShowMenu(false);

    // Use browser's confirm dialog on web, Alert.alert on mobile
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to leave this group chat? You will no longer receive messages from this group.')
      : await new Promise((resolve) => {
          Alert.alert(
            'Leave Group Chat',
            'Are you sure you want to leave this group chat? You will no longer receive messages from this group.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Leave', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('group_chat_members')
        .delete()
        .eq('group_conversation_id', groupConversationId)
        .eq('user_id', user?.id);

      if (error) throw error;

      // Navigate back first, then show alert so the list refreshes
      router.back();
      // Small delay to ensure navigation completes before showing alert
      setTimeout(() => {
        showAlert('Success', 'You have left the group chat');
      }, 100);
    } catch (error: any) {
      console.error('Error leaving group:', error);
      showAlert('Error', 'Failed to leave group chat: ' + error.message);
    }
  };

  const isCreator = groupInfo?.created_by === user?.id;


  const renderMessage = ({ item }: { item: GroupMessage }) => {
    const isMyMessage = item.sender_id === user?.id;

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer,
        ]}
      >
        {!isMyMessage && (
          <View style={styles.senderInfo}>
            {item.sender?.profile_image_url ? (
              <Image
                source={{ uri: item.sender.profile_image_url }}
                style={styles.senderAvatar}
              />
            ) : (
              <View
                style={[
                  styles.senderAvatar,
                  styles.avatarPlaceholder,
                  { backgroundColor: colors.border },
                ]}
              >
                <Ionicons name="person" size={16} color={colors.text} />
              </View>
            )}
          </View>
        )}
        <View style={{ flex: 1 }}>
          {!isMyMessage && (
            <Text style={[styles.senderName, { color: colors.text + 'CC' }]}>
              {item.sender?.full_name || 'Unknown'}
            </Text>
          )}
          <View
            style={[
              styles.messageBubble,
              isMyMessage
                ? { backgroundColor: colors.primary }
                : { backgroundColor: colors.gray200 },
            ]}
          >
            <Text
              style={[
                styles.messageText,
                { color: isMyMessage ? '#fff' : colors.text },
              ]}
            >
              {item.content}
            </Text>
            <Text
              style={[
                styles.timestamp,
                { color: isMyMessage ? '#fff9' : colors.text + '80' },
              ]}
            >
              {new Date(item.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray200,
      backgroundColor: colors.surface,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerInfo: {
      flex: 1,
    },
    headerTitle: {
      fontSize: typography.fontSize18,
      fontWeight: typography.fontWeightBold,
      color: colors.textPrimary,
    },
    headerSubtitle: {
      fontSize: typography.fontSize12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    moreButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    messagesList: {
      padding: spacing.md,
      backgroundColor: colors.background,
    },
    messageContainer: {
      flexDirection: 'row',
      marginBottom: spacing.md,
      width: '100%',
    },
    myMessageContainer: {
      alignSelf: 'flex-end',
      flexDirection: 'row-reverse',
    },
    otherMessageContainer: {
      alignSelf: 'flex-start',
    },
    senderInfo: {
      marginRight: spacing.xs,
    },
    senderAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.gray200,
    },
    avatarPlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    senderName: {
      fontSize: typography.fontSize14,
      marginBottom: spacing.xs,
      marginLeft: spacing.xs,
      fontWeight: typography.fontWeightSemiBold,
      color: colors.textPrimary,
    },
    messageBubble: {
      padding: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.gray200,
      maxWidth: '75%',
    },
    messageText: {
      fontSize: typography.fontSize14,
      lineHeight: typography.lineHeight20,
      color: colors.textPrimary,
    },
    timestamp: {
      fontSize: typography.fontSize12,
      marginTop: spacing.xs,
      color: colors.textSecondary,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxl,
    },
    emptyText: {
      fontSize: typography.fontSize14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.gray200,
    },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: 100,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: typography.fontSize14,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.gray200,
      color: colors.textPrimary,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    sendButtonDisabled: {
      backgroundColor: colors.gray400,
      opacity: 0.5,
    },
    menuModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
    },
    menuModalContent: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      ...shadows.medium,
      minWidth: 180,
      overflow: 'hidden',
    },
    menuOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    menuOptionText: {
      fontSize: typography.fontSize16,
      fontWeight: typography.fontWeightSemiBold,
    },
  });

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.sm },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>
            {groupInfo?.name || 'Group Chat'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </Text>
        </View>
        <TouchableOpacity style={styles.moreButton} onPress={() => setShowMenu(true)}>
          <Ionicons name="ellipsis-vertical" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Menu Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={[styles.menuModalOverlay, { paddingTop: insets.top + 50, paddingRight: spacing.md }]}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuModalContent}>
            {isCreator ? (
              <TouchableOpacity
                style={styles.menuOption}
                onPress={handleDeleteGroup}
              >
                <Ionicons name="trash-outline" size={24} color={colors.error} />
                <Text style={[styles.menuOptionText, { color: colors.error }]}>
                  Delete Group Chat
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.menuOption}
                onPress={handleLeaveGroup}
              >
                <Ionicons name="exit-outline" size={24} color={colors.error} />
                <Text style={[styles.menuOptionText, { color: colors.error }]}>
                  Leave Group Chat
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.text + '80' }]}>
              No messages yet. Start the conversation!
            </Text>
          </View>
        }
      />

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.card,
            paddingBottom: insets.bottom + 8,
            borderTopColor: colors.border,
          },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.background,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder="Type a message..."
          placeholderTextColor={colors.text + '80'}
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!newMessage.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
