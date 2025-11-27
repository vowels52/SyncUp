import { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, shadows, typography } from '@/constants/theme';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useThemedColors } from '@/hooks/useThemedColors';
import { useThemedStyles } from '@/hooks/useThemedStyles';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

interface OtherUser {
  id: string;
  full_name: string | null;
}

export default function DMConversationScreen() {
  const colors = useThemedColors();
  const { commonStyles, textStyles } = useThemedStyles();
  const { conversationId, otherUserId } = useLocalSearchParams<{
    conversationId: string;
    otherUserId: string;
  }>();

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  useEffect(() => {
    if (user && conversationId && otherUserId) {
      fetchOtherUserInfo();
      fetchMessages();
      subscribeToMessages();
    }
  }, [conversationId, otherUserId, user]);

  const fetchOtherUserInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .eq('id', otherUserId)
        .single();

      if (error) throw error;
      if (data) setOtherUser(data);
    } catch (error: any) {
      console.error('Error fetching user info:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data) {
        setMessages(data);
        // Mark messages as read immediately when opening conversation
        setTimeout(() => {
          markMessagesAsRead();
        }, 500);
      }
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to fetch messages');
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('receiver_id', user.id)
        .eq('is_read', false)
        .select();

      if (error) throw error;
    } catch (error: any) {
      console.error('Error marking messages as read:', error);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);

          // Auto-scroll to bottom when new message arrives
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);

          // Mark as read if it's from the other user
          if (newMsg.sender_id === otherUserId) {
            setTimeout(() => {
              markMessagesAsRead();
            }, 500);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSendMessage = async () => {
    if (!user || !newMessage.trim() || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const { error } = await supabase
        .from('direct_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          receiver_id: otherUserId,
          content: messageContent,
        });

      if (error) throw error;

      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to send message');
      setNewMessage(messageContent); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.sender_id === user?.id;

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.theirMessageText,
            ]}
          >
            {item.content}
          </Text>
          <Text
            style={[
              styles.messageTime,
              isMyMessage ? styles.myMessageTime : styles.theirMessageTime,
            ]}
          >
            {new Date(item.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    headerAvatar: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.sm,
    },
    headerInfo: {
      flex: 1,
    },
    headerName: {
      fontSize: typography.fontSize18,
      fontWeight: typography.fontWeightBold,
      color: colors.textPrimary,
    },
    messagesList: {
      padding: spacing.md,
      flexGrow: 1,
      backgroundColor: colors.background,
    },
    messageContainer: {
      marginBottom: spacing.md,
      maxWidth: '75%',
    },
    myMessageContainer: {
      alignSelf: 'flex-end',
    },
    theirMessageContainer: {
      alignSelf: 'flex-start',
    },
    messageBubble: {
      padding: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.gray200,
    },
    myMessageBubble: {
      backgroundColor: colors.primary,
      borderBottomRightRadius: 4,
    },
    theirMessageBubble: {
      backgroundColor: colors.gray200,
      borderBottomLeftRadius: 4,
    },
    messageText: {
      fontSize: typography.fontSize14,
      lineHeight: typography.lineHeight20,
    },
    myMessageText: {
      color: colors.white,
    },
    theirMessageText: {
      color: colors.textPrimary,
    },
    messageTime: {
      fontSize: typography.fontSize12,
      marginTop: spacing.xs,
    },
    myMessageTime: {
      color: colors.white,
      opacity: 0.8,
    },
    theirMessageTime: {
      color: colors.textSecondary,
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
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: spacing.xxl,
    },
    emptyText: {
      ...textStyles.body1,
      fontWeight: typography.fontWeightSemiBold,
      marginTop: spacing.md,
      color: colors.textSecondary,
    },
    emptySubtext: {
      ...textStyles.body2,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
  });

  if (loading) {
    return (
      <View style={[commonStyles.container, commonStyles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerContent}
          onPress={() => router.push({ pathname: '/user-details', params: { userId: otherUserId } })}
        >
          <View style={styles.headerAvatar}>
            <Ionicons name="person" size={24} color={colors.white} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>
              {otherUser?.full_name || 'Anonymous Student'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={60} color={colors.gray400} />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Start the conversation!</Text>
          </View>
        }
      />

      {/* Message Input */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom || spacing.md }]}>
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          placeholderTextColor={colors.gray400}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!newMessage.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="send" size={20} color={colors.white} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}