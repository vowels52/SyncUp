import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';
import { useThemedColors } from '@/hooks/useThemedColors';
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
  const colors = useThemedColors();
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
      Alert.alert('Error', 'Failed to load connections');
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
      Alert.alert('Error', 'Please select at least 1 person for a group chat');
      return;
    }

    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
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
      Alert.alert('Error', 'Failed to create group chat');
    } finally {
      setCreating(false);
    }
  };

  const renderConnectionItem = ({ item }: { item: Connection }) => {
    const isSelected = selectedUsers.has(item.connected_user.id);

    return (
      <TouchableOpacity
        style={[
          styles.connectionItem,
          { backgroundColor: colors.card },
          isSelected && { backgroundColor: colors.primary + '20' },
        ]}
        onPress={() => toggleUserSelection(item.connected_user.id)}
      >
        <View style={styles.connectionInfo}>
          {item.connected_user.profile_image_url ? (
            <Image
              source={{ uri: item.connected_user.profile_image_url }}
              style={styles.avatar}
            />
          ) : (
            <View
              style={[
                styles.avatar,
                styles.avatarPlaceholder,
                { backgroundColor: colors.border },
              ]}
            >
              <Ionicons name="person" size={24} color={colors.text} />
            </View>
          )}
          <Text style={[styles.userName, { color: colors.text }]}>
            {item.connected_user.full_name || 'Unknown'}
          </Text>
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isButtonDisabled = selectedUsers.size < 1 || !groupName.trim() || creating;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Create Group Chat
        </Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.inputContainer}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="Group Name"
            placeholderTextColor={colors.text + '80'}
            value={groupName}
            onChangeText={setGroupName}
            maxLength={50}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Select Members ({selectedUsers.size} selected)
        </Text>

        <FlatList
          data={connections}
          renderItem={renderConnectionItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.text + '80' }]}>
              No connections available
            </Text>
          }
        />
      </View>

      <TouchableOpacity
        style={[
          styles.createButton,
          {
            backgroundColor:
              selectedUsers.size >= 1 && groupName.trim()
                ? colors.primary
                : colors.border,
          },
        ]}
        onPress={createGroupChat}
        disabled={isButtonDisabled}
      >
        {creating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.createButtonText}>
            Create Group Chat
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  listContainer: {
    paddingBottom: 100,
  },
  connectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  connectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 16,
  },
  createButton: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
