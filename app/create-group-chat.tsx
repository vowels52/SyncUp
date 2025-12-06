import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useThemedColors } from '@/hooks/useThemedColors';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, borderRadius, shadows, typography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface Connection {
  id: string;
  connected_user: {
    id: string;
    full_name: string | null;
    profile_image_url: string | null;
  };
}

export default function CreateGroupChatScreen() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const colors = useThemedColors();
  const { textStyles } = useThemedStyles();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [groupName, setGroupName] = useState('');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('connections')
        .select(`
          id,
          user_id,
          connected_user_id,
          user_profiles!connections_user_id_fkey (
            id,
            full_name,
            profile_image_url
          ),
          connected_profiles:user_profiles!connections_connected_user_id_fkey (
            id,
            full_name,
            profile_image_url
          )
        `)
        .eq('status', 'accepted')
        .or(`user_id.eq.${user.id},connected_user_id.eq.${user.id}`);

      if (error) throw error;

      // Map the data to get the connected user (not the current user)
      const mappedConnections = data?.map((conn: any) => {
        const connectedUser = conn.user_id === user.id
          ? conn.connected_profiles
          : conn.user_profiles;

        return {
          id: conn.id,
          connected_user: connectedUser,
        };
      }) || [];

      setConnections(mappedConnections);
    } catch (error) {
      console.error('Error fetching connections:', error);
      showAlert('Error', 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const createGroupChat = async () => {
    if (selectedUsers.size < 1) {
      showAlert('Error', 'Please select at least 1 person for a group chat');
      return;
    }

    if (!groupName.trim()) {
      showAlert('Error', 'Please enter a group name');
      return;
    }

    setCreating(true);

    try {
      // Create group conversation
      const { data: groupConversation, error: groupError } = await supabase
        .from('group_conversations')
        .insert({
          name: groupName.trim(),
          created_by: user?.id,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add creator as member
      const members = [
        {
          group_conversation_id: groupConversation.id,
          user_id: user?.id,
        },
        // Add selected users as members
        ...Array.from(selectedUsers).map((userId) => ({
          group_conversation_id: groupConversation.id,
          user_id: userId,
        })),
      ];

      const { error: membersError } = await supabase
        .from('group_chat_members')
        .insert(members);

      if (membersError) throw membersError;

      // Navigate to the group chat
      router.replace({
        pathname: '/group-chat-conversation',
        params: {
          groupConversationId: groupConversation.id,
        },
      });
    } catch (error) {
      console.error('Error creating group chat:', error);
      showAlert('Error', 'Failed to create group chat');
    } finally {
      setCreating(false);
    }
  };

  // Define styles inside component to use themed colors
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      ...shadows.small,
    },
    backButton: {
      padding: spacing.xs,
    },
    headerTitle: {
      ...textStyles.h3,
    },
    placeholder: {
      width: 40,
    },
    content: {
      flex: 1,
      padding: spacing.md,
    },
    inputContainer: {
      marginBottom: spacing.lg,
    },
    inputLabel: {
      ...textStyles.body1,
      fontWeight: typography.fontWeightSemiBold,
      marginBottom: spacing.sm,
      color: colors.text,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      ...textStyles.body1,
      borderWidth: 1,
      borderColor: colors.gray200,
      ...shadows.small,
    },
    sectionTitle: {
      ...textStyles.body1,
      fontWeight: typography.fontWeightBold,
      color: colors.text,
      marginBottom: spacing.sm,
    },
    listContainer: {
      paddingBottom: 100,
    },
    connectionCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      ...shadows.small,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    connectionInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: borderRadius.full,
      marginRight: spacing.md,
    },
    avatarPlaceholder: {
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    userName: {
      ...textStyles.body1,
      fontWeight: typography.fontWeightSemiBold,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    emptyText: {
      ...textStyles.body2,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.md,
    },
    createButton: {
      position: 'absolute',
      bottom: 32,
      left: spacing.md,
      right: spacing.md,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      justifyContent: 'center',
      alignItems: 'center',
      ...shadows.medium,
    },
    createButtonDisabled: {
      backgroundColor: colors.gray400,
      opacity: 0.5,
    },
    createButtonText: {
      ...textStyles.body1,
      fontWeight: typography.fontWeightSemiBold,
      color: colors.white,
    },
  });

  const renderConnectionItem = ({ item }: { item: Connection }) => {
    const isSelected = selectedUsers.has(item.connected_user.id);

    return (
      <TouchableOpacity
        style={styles.connectionCard}
        onPress={() => toggleUserSelection(item.connected_user.id)}
      >
        <View style={styles.connectionInfo}>
          {item.connected_user.profile_image_url ? (
            <Image
              source={{ uri: item.connected_user.profile_image_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={32} color={colors.white} />
            </View>
          )}
          <Text style={styles.userName}>
            {item.connected_user.full_name || 'Unknown'}
          </Text>
        </View>
        {isSelected ? (
          <Ionicons name="checkmark-circle" size={28} color={colors.primary} />
        ) : (
          <Ionicons name="ellipse-outline" size={28} color={colors.gray400} />
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isButtonDisabled = selectedUsers.size < 1 || !groupName.trim() || creating;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Create Group Chat
        </Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Group Chat Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter group chat name"
            placeholderTextColor={colors.textSecondary}
            value={groupName}
            onChangeText={setGroupName}
            maxLength={50}
          />
        </View>

        <Text style={styles.sectionTitle}>
          Select Members * ({selectedUsers.size} selected)
        </Text>

        <FlatList
          data={connections}
          renderItem={renderConnectionItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={80} color={colors.gray400} />
              <Text style={styles.emptyText}>
                No connections available
              </Text>
            </View>
          }
        />
      </View>

      <TouchableOpacity
        style={[
          styles.createButton,
          isButtonDisabled && styles.createButtonDisabled,
        ]}
        onPress={createGroupChat}
        disabled={isButtonDisabled}
      >
        {creating ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.createButtonText}>
            Create Group Chat
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
