import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, ScrollView, Image, Modal } from 'react-native';
import { spacing, borderRadius, shadows, typography } from '@/constants/theme';
import { useThemedColors } from '@/hooks/useThemedColors';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

interface UserMatch {
  id: string;
  full_name: string | null;
  major: string | null;
  year: string | null;
  bio: string | null;
  profile_image_url: string | null;
  courses_count?: number;
  groups_count?: number;
  interests_count?: number;
}

interface ConnectionRequest {
  id: string;
  user_id: string;
  created_at: string;
  user_profiles: {
    id: string;
    full_name: string | null;
    major: string | null;
    year: string | null;
    bio: string | null;
    profile_image_url: string | null;
  };
}

interface AcceptedConnection {
  id: string;
  connected_user: {
    id: string;
    full_name: string | null;
    major: string | null;
    year: string | null;
    bio: string | null;
    profile_image_url: string | null;
  };
  created_at: string;
  unread_count?: number;
}

interface GroupChat {
  id: string;
  name: string | null;
  created_by: string;
  last_message_at: string | null;
  created_at: string;
  member_count?: number;
  unread_count?: number;
}

export default function ConnectionsScreen() {
  const [matches, setMatches] = useState<UserMatch[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ConnectionRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<ConnectionRequest[]>([]);
  const [acceptedConnections, setAcceptedConnections] = useState<AcceptedConnection[]>([]);
  const [groupChats, setGroupChats] = useState<GroupChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'matches' | 'requests' | 'connections' | 'tutoring'>('matches');
  const [showAllIncoming, setShowAllIncoming] = useState(false);
  const [showAllOutgoing, setShowAllOutgoing] = useState(false);
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);

  const colors = useThemedColors();
  const { commonStyles, textStyles } = useThemedStyles();

  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  useEffect(() => {
    fetchMatches();
    fetchPendingRequests();
    fetchOutgoingRequests();
    fetchAcceptedConnections();
    fetchGroupChats();

    // Subscribe to new messages to update unread counts
    if (user) {
      const dmChannel = supabase
        .channel('dm-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'direct_messages',
            filter: `receiver_id=eq.${user.id}`,
          },
          (payload) => {
            // Refresh connections to update unread counts
            fetchAcceptedConnections();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'direct_messages',
            filter: `receiver_id=eq.${user.id}`,
          },
          (payload) => {
            // Refresh when messages are marked as read
            fetchAcceptedConnections();
          }
        )
        .subscribe();

      // Subscribe to group messages
      const groupMessagesChannel = supabase
        .channel('group-messages-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'group_messages',
          },
          (payload) => {
            // Refresh group chats to update unread counts
            fetchGroupChats();
          }
        )
        .subscribe();

      // Subscribe to group chat changes
      const groupChatsChannel = supabase
        .channel('group-chats-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'group_chat_members',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            // Refresh when added to a new group chat
            fetchGroupChats();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'group_chat_members',
          },
          (payload) => {
            // Check if the deleted member was the current user
            const deletedMember = payload.old as any;
            if (deletedMember?.user_id === user.id) {
              // Refresh when removed from a group chat
              fetchGroupChats();
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'group_conversations',
          },
          (payload) => {
            // Refresh when a group chat is deleted
            fetchGroupChats();
          }
        )
        .subscribe();

      // Subscribe to connection changes
      const connectionsChannel = supabase
        .channel('connections-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'connections',
            filter: `connected_user_id=eq.${user.id}`,
          },
          (payload) => {
            // New connection request received (incoming)
            fetchPendingRequests();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'connections',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            // New connection request sent (outgoing)
            fetchOutgoingRequests();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'connections',
          },
          (payload) => {
            const connection = payload.new as any;

            // Only refresh if this connection involves the current user
            if (connection && (connection.user_id === user.id || connection.connected_user_id === user.id)) {
              // If connection was accepted, refresh both requests and connections
              if (connection.status === 'accepted') {
                fetchPendingRequests();
                fetchOutgoingRequests();
                fetchAcceptedConnections();
              }

              // If connection was rejected, refresh requests
              if (connection.status === 'rejected') {
                fetchPendingRequests();
                fetchOutgoingRequests();
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'connections',
          },
          (payload) => {
            // Connection was deleted, only refresh if it involved current user
            const deletedConnection = payload.old as any;
            if (deletedConnection && (deletedConnection.user_id === user.id || deletedConnection.connected_user_id === user.id)) {
              fetchPendingRequests();
              fetchOutgoingRequests();
              fetchAcceptedConnections();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(dmChannel);
        supabase.removeChannel(groupMessagesChannel);
        supabase.removeChannel(groupChatsChannel);
        supabase.removeChannel(connectionsChannel);
      };
    }
  }, [user]);

  // Refresh connections when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Always refresh group chats when screen comes into focus
      fetchGroupChats();
      if (viewMode === 'connections') {
        fetchAcceptedConnections();
      }
    }, [viewMode])
  );

  const fetchMatches = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get user's match preferences
      const { data: userPreferences, error: preferencesError } = await supabase
        .from('user_match_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (preferencesError) {
        console.error('Error fetching preferences:', preferencesError);
      }

      // Get current user's interests and courses for shared filtering
      const { data: userInterests } = await supabase
        .from('user_interests')
        .select('interest_id')
        .eq('user_id', user.id);

      const { data: userCourses } = await supabase
        .from('user_courses')
        .select('course_id')
        .eq('user_id', user.id);

      const userInterestIds = new Set(userInterests?.map(i => i.interest_id) || []);
      const userCourseIds = new Set(userCourses?.map(c => c.course_id) || []);

      // Get all existing connections (sent or received)
      const { data: connections, error: connectionsError } = await supabase
        .from('connections')
        .select('user_id, connected_user_id')
        .or(`user_id.eq.${user.id},connected_user_id.eq.${user.id}`);

      if (connectionsError) throw connectionsError;

      // Get all match history (skipped users)
      const { data: matchHistory, error: historyError } = await supabase
        .from('match_history')
        .select('viewed_user_id')
        .eq('user_id', user.id);

      if (historyError) throw historyError;

      // Extract user IDs to exclude
      const excludedUserIds = new Set<string>();

      // Add users from connections
      connections?.forEach((conn) => {
        if (conn.user_id === user.id) {
          excludedUserIds.add(conn.connected_user_id);
        } else {
          excludedUserIds.add(conn.user_id);
        }
      });

      // Add users from match history (skipped users)
      matchHistory?.forEach((history) => {
        excludedUserIds.add(history.viewed_user_id);
      });

      // Build query for user profiles - fetch more broadly and filter client-side
      let query = supabase
        .from('user_profiles')
        .select('id, full_name, major, year, bio, profile_image_url')
        .neq('id', user.id)
        .not('full_name', 'is', null);

      // Apply year filter if preferences exist (exact match is fine for years)
      if (userPreferences?.preferred_years && userPreferences.preferred_years.length > 0) {
        query = query.in('year', userPreferences.preferred_years);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;

      if (data) {
        // Filter out users with existing connections or match history
        let filteredMatches = data.filter(
          (match) => !excludedUserIds.has(match.id)
        );

        // Apply major filter client-side with partial matching
        if (userPreferences?.preferred_majors && userPreferences.preferred_majors.length > 0) {
          filteredMatches = filteredMatches.filter((match) => {
            if (!match.major) return false;
            // Check if any preferred major is contained in the user's major
            return userPreferences.preferred_majors.some((preferredMajor) =>
              match.major.toLowerCase().includes(preferredMajor.toLowerCase())
            );
          });
        }

        // Fetch counts and calculate shared interests/courses for each user
        // Slice to 50 max before expensive queries to avoid performance issues
        const matchesWithCounts = await Promise.all(
          filteredMatches.slice(0, 50).map(async (match) => {
            // Get courses count
            const { count: coursesCount } = await supabase
              .from('user_courses')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', match.id);

            // Get groups count
            const { count: groupsCount } = await supabase
              .from('group_members')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', match.id);

            // Get interests count
            const { count: interestsCount } = await supabase
              .from('user_interests')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', match.id);

            // Get match's interests for shared calculation
            const { data: matchInterests } = await supabase
              .from('user_interests')
              .select('interest_id')
              .eq('user_id', match.id);

            // Get match's courses for shared calculation
            const { data: matchCourses } = await supabase
              .from('user_courses')
              .select('course_id')
              .eq('user_id', match.id);

            // Calculate shared interests
            const matchInterestIds = new Set(matchInterests?.map(i => i.interest_id) || []);
            const sharedInterests = Array.from(userInterestIds).filter(id => matchInterestIds.has(id)).length;

            // Calculate shared courses
            const matchCourseIds = new Set(matchCourses?.map(c => c.course_id) || []);
            const sharedCourses = Array.from(userCourseIds).filter(id => matchCourseIds.has(id)).length;

            return {
              ...match,
              courses_count: coursesCount || 0,
              groups_count: groupsCount || 0,
              interests_count: interestsCount || 0,
              shared_interests: sharedInterests,
              shared_courses: sharedCourses,
            };
          })
        );

        // Apply minimum shared interests/courses filters
        let finalMatches = matchesWithCounts;

        if (userPreferences?.min_shared_interests !== undefined && userPreferences.min_shared_interests > 0) {
          finalMatches = finalMatches.filter(
            match => match.shared_interests >= userPreferences.min_shared_interests
          );
        }

        if (userPreferences?.min_shared_courses !== undefined && userPreferences.min_shared_courses > 0) {
          finalMatches = finalMatches.filter(
            match => match.shared_courses >= userPreferences.min_shared_courses
          );
        }

        setMatches(finalMatches.slice(0, 10));
      }
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to fetch matches');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (matchedUserId: string) => {
    if (!user) return;

    try {
      // Insert connection request
      const { error: connectionError } = await supabase
        .from('connections')
        .insert({
          user_id: user.id,
          connected_user_id: matchedUserId,
          status: 'pending',
        });

      if (connectionError) throw connectionError;

      // Also record in match history
      const { error: historyError } = await supabase
        .from('match_history')
        .insert({
          user_id: user.id,
          viewed_user_id: matchedUserId,
          action: 'connect',
        });

      if (historyError) {
        // Log but don't fail if history insert fails
        console.error('Error recording match history:', historyError);
      }

      showAlert('Success', 'Connection request sent!');

      // Refresh outgoing requests to show the new request
      fetchOutgoingRequests();

      // Remove the current user from matches and move to next
      const updatedMatches = matches.filter(m => m.id !== matchedUserId);
      setMatches(updatedMatches);

      // If we're at the end or no more matches, reset
      if (currentIndex >= updatedMatches.length) {
        if (updatedMatches.length > 0) {
          setCurrentIndex(0);
        } else {
          // No more matches, fetch new ones
          fetchMatches();
          setCurrentIndex(0);
        }
      }
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to send connection request');
    }
  };

  const handleSkip = async () => {
    if (!user || !matches[currentIndex]) return;

    const matchedUserId = matches[currentIndex].id;

    try {
      // Record the skip in match_history
      const { error } = await supabase
        .from('match_history')
        .insert({
          user_id: user.id,
          viewed_user_id: matchedUserId,
          action: 'skip',
        });

      if (error) throw error;

      // Remove the current user from matches and move to next
      const updatedMatches = matches.filter(m => m.id !== matchedUserId);
      setMatches(updatedMatches);

      // If we're at the end or no more matches, reset
      if (currentIndex >= updatedMatches.length) {
        if (updatedMatches.length > 0) {
          setCurrentIndex(0);
        } else {
          // No more matches, fetch new ones
          fetchMatches();
          setCurrentIndex(0);
        }
      }
    } catch (error: any) {
      console.error('Error recording skip:', error);
      // Still move to next even if recording fails
      handleNext();
    }
  };

  const handleNext = () => {
    if (currentIndex < matches.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      showAlert('End of Matches', 'Check back later for more connections');
      fetchMatches();
      setCurrentIndex(0);
    }
  };

  const fetchPendingRequests = async () => {
    if (!user) return;

    try {
      // Fetch connection requests where the current user is the connected_user_id (incoming)
      const { data, error } = await supabase
        .from('connections')
        .select(`
          id,
          user_id,
          created_at,
          user_profiles:user_id (
            id,
            full_name,
            major,
            year,
            bio,
            profile_image_url
          )
        `)
        .eq('connected_user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setPendingRequests(data as unknown as ConnectionRequest[]);
      }
    } catch (error: any) {
      console.error('Error fetching pending requests:', error);
    }
  };

  const fetchOutgoingRequests = async () => {
    if (!user) return;

    try {
      // Fetch connection requests where the current user is the user_id (outgoing)
      const { data, error } = await supabase
        .from('connections')
        .select(`
          id,
          connected_user_id,
          created_at,
          user_profiles:connected_user_id (
            id,
            full_name,
            major,
            year,
            bio,
            profile_image_url
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // Map the data to match ConnectionRequest interface
        const mappedData = data.map(item => ({
          id: item.id,
          user_id: item.connected_user_id,
          created_at: item.created_at,
          user_profiles: item.user_profiles
        }));
        setOutgoingRequests(mappedData as unknown as ConnectionRequest[]);
      }
    } catch (error: any) {
      console.error('Error fetching outgoing requests:', error);
    }
  };

  const handleAcceptRequest = async (connectionId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('connections')
        .update({ status: 'accepted' })
        .eq('id', connectionId);

      if (error) throw error;

      showAlert('Success', 'Connection request accepted!');
      fetchPendingRequests();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to accept connection');
    }
  };

  const handleDeclineRequest = async (connectionId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('connections')
        .update({ status: 'rejected' })
        .eq('id', connectionId);

      if (error) throw error;

      showAlert('Success', 'Connection request declined');
      fetchPendingRequests();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to decline connection');
    }
  };

  const handleCancelRequest = async (connectionId: string) => {
    if (!user) return;

    try {
      // First, get the connection to find the connected_user_id
      const { data: connection, error: fetchError } = await supabase
        .from('connections')
        .select('connected_user_id')
        .eq('id', connectionId)
        .eq('user_id', user.id)
        .single();

      if (fetchError) throw fetchError;

      const connectedUserId = connection?.connected_user_id;

      if (!connectedUserId) {
        throw new Error('Could not find connected user');
      }

      // Delete the outgoing request
      const { error: deleteError } = await supabase
        .from('connections')
        .delete()
        .eq('id', connectionId)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // Also remove ALL entries from match history for this user so they can appear in discover again
      const { error: historyError } = await supabase
        .from('match_history')
        .delete()
        .eq('user_id', user.id)
        .eq('viewed_user_id', connectedUserId);

      if (historyError) {
        console.error('Error removing match history:', historyError);
        showAlert('Warning', 'Request cancelled but user may not reappear in discover immediately');
      }

      showAlert('Success', 'Connection request cancelled');

      // Refresh both lists
      await fetchOutgoingRequests();
      await fetchMatches();
    } catch (error: any) {
      console.error('Cancel request error:', error);
      showAlert('Error', error.message || 'Failed to cancel request');
    }
  };

  const fetchAcceptedConnections = async () => {
    if (!user) return;

    try {
      // Fetch accepted connections
      const { data, error } = await supabase
        .from('connections')
        .select(`
          id,
          created_at,
          user_id,
          connected_user_id,
          user_profiles!connections_user_id_fkey (
            id,
            full_name,
            major,
            year,
            bio,
            profile_image_url
          ),
          connected_profiles:user_profiles!connections_connected_user_id_fkey (
            id,
            full_name,
            major,
            year,
            bio,
            profile_image_url
          )
        `)
        .eq('status', 'accepted')
        .or(`user_id.eq.${user.id},connected_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // Map the data to get the connected user (not the current user)
        const mappedConnections: AcceptedConnection[] = await Promise.all(
          data.map(async (conn: any) => {
            const connectedUser = conn.user_id === user.id
              ? conn.connected_profiles
              : conn.user_profiles;

            // Fetch unread message count for this connection
            const { count } = await supabase
              .from('direct_messages')
              .select('*', { count: 'exact', head: true })
              .eq('receiver_id', user.id)
              .eq('sender_id', connectedUser.id)
              .eq('is_read', false);

            return {
              id: conn.id,
              created_at: conn.created_at,
              connected_user: connectedUser,
              unread_count: count || 0,
            };
          })
        );

        setAcceptedConnections(mappedConnections);
      }
    } catch (error: any) {
      console.error('Error fetching accepted connections:', error);
    }
  };

  const fetchGroupChats = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('group_chat_members')
        .select(`
          group_conversation_id,
          last_read_at,
          group_conversations!inner(
            id,
            name,
            created_by,
            last_message_at,
            created_at
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      if (data) {
        const groupChatsWithCounts = await Promise.all(
          data.map(async (item: any) => {
            const groupConv = item.group_conversations;

            // Get member count
            const { count: memberCount } = await supabase
              .from('group_chat_members')
              .select('*', { count: 'exact', head: true })
              .eq('group_conversation_id', groupConv.id);

            // Get unread count (messages after last_read_at)
            let unreadCount = 0;
            if (item.last_read_at) {
              const { count } = await supabase
                .from('group_messages')
                .select('*', { count: 'exact', head: true })
                .eq('group_conversation_id', groupConv.id)
                .gt('created_at', item.last_read_at)
                .neq('sender_id', user.id);
              unreadCount = count || 0;
            } else {
              // If never read, count all messages except own
              const { count } = await supabase
                .from('group_messages')
                .select('*', { count: 'exact', head: true })
                .eq('group_conversation_id', groupConv.id)
                .neq('sender_id', user.id);
              unreadCount = count || 0;
            }

            return {
              id: groupConv.id,
              name: groupConv.name,
              created_by: groupConv.created_by,
              last_message_at: groupConv.last_message_at,
              created_at: groupConv.created_at,
              member_count: memberCount || 0,
              unread_count: unreadCount,
            };
          })
        );

        setGroupChats(groupChatsWithCounts);
      }
    } catch (error: any) {
      console.error('Error fetching group chats:', error);
    }
  };

  const handleStartDM = async (connectedUserId: string) => {
    if (!user) return;

    try {
      // Check if conversation already exists
      const { data: existingConversation, error: fetchError } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${connectedUserId}),and(participant1_id.eq.${connectedUserId},participant2_id.eq.${user.id})`)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      let conversationId = existingConversation?.id;

      // If no conversation exists, create one
      if (!conversationId) {
        const { data: newConversation, error: createError } = await supabase
          .from('conversations')
          .insert({
            participant1_id: user.id,
            participant2_id: connectedUserId,
          })
          .select('id')
          .single();

        if (createError) throw createError;
        conversationId = newConversation.id;
      }

      // Navigate to the DM screen
      router.push({
        pathname: '/dm-conversation',
        params: {
          conversationId,
          otherUserId: connectedUserId,
        },
      });
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to start conversation');
    }
  };

  const handleOpenGroupChat = (groupConversationId: string) => {
    router.push({
      pathname: '/group-chat-conversation',
      params: {
        groupConversationId,
      },
    });
  };

  // Define styles inside component to use themed colors
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      ...shadows.small,
    },
    headerContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    penguinMascot: {
      width: 50,
      height: 50,
    },
    title: {
      ...textStyles.h3,
    },
    subtitle: {
      ...textStyles.body2,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.md,
      paddingTop: spacing.md,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      ...shadows.large,
    },
    profileSection: {
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    avatarLarge: {
      width: 120,
      height: 120,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    name: {
      ...textStyles.h2,
      marginBottom: spacing.xs,
    },
    info: {
      ...textStyles.body1,
      color: colors.textSecondary,
      marginBottom: spacing.md,
    },
    bio: {
      ...textStyles.body2,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: spacing.md,
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: spacing.lg,
      backgroundColor: colors.gray50,
      borderRadius: borderRadius.md,
    },
    statItem: {
      alignItems: 'center',
      flex: 1,
    },
    statLabel: {
      ...textStyles.caption,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    statValue: {
      ...textStyles.h4,
      color: colors.primary,
      marginTop: spacing.xs,
    },
    statDivider: {
      width: 1,
      backgroundColor: colors.gray200,
    },
    actionsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: spacing.lg,
      gap: spacing.xl,
    },
    actionButton: {
      width: 64,
      height: 64,
      borderRadius: borderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
      ...shadows.medium,
    },
    skipButton: {
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.error,
    },
    connectButton: {
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.success,
    },
    progressContainer: {
      alignItems: 'center',
    },
    progressText: {
      ...textStyles.body2,
      color: colors.textSecondary,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    emptyTitle: {
      ...textStyles.h3,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    emptySubtitle: {
      ...textStyles.body2,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    toggleContainer: {
      flexDirection: 'row',
      marginTop: spacing.md,
      backgroundColor: colors.gray100,
      borderRadius: borderRadius.md,
      padding: spacing.xs,
      gap: spacing.xs,
    },
    toggleButton: {
      flex: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      borderRadius: borderRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 36,
    },
    toggleButtonActive: {
      backgroundColor: colors.primary,
    },
    toggleText: {
      ...textStyles.body2,
      fontSize: 13,
      fontWeight: typography.fontWeightSemiBold,
      color: colors.textSecondary,
    },
    toggleTextActive: {
      color: colors.white,
    },
    requestsContainer: {
      flex: 1,
      padding: spacing.md,
    },
    requestsList: {
      paddingBottom: spacing.lg,
    },
    requestCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      ...shadows.small,
    },
    requestHeader: {
      flexDirection: 'row',
      marginBottom: spacing.md,
    },
    requestAvatar: {
      width: 56,
      height: 56,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    requestInfo: {
      flex: 1,
    },
    requestName: {
      ...textStyles.body1,
      fontWeight: typography.fontWeightSemiBold,
      marginBottom: spacing.xs,
    },
    requestDetails: {
      ...textStyles.caption,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    requestBio: {
      ...textStyles.caption,
      color: colors.textSecondary,
    },
    requestActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    requestButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.sm,
      gap: spacing.xs,
    },
    declineButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.error,
    },
    acceptButton: {
      backgroundColor: colors.success,
    },
    declineButtonText: {
      ...textStyles.body2,
      fontWeight: typography.fontWeightSemiBold,
      color: colors.error,
    },
    acceptButtonText: {
      ...textStyles.body2,
      fontWeight: typography.fontWeightSemiBold,
      color: colors.white,
    },
    connectionCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      ...shadows.small,
    },
    messageButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.primary,
      gap: spacing.xs,
    },
    messageButtonText: {
      ...textStyles.body2,
      fontWeight: typography.fontWeightSemiBold,
      color: colors.white,
    },
    avatarContainer: {
      position: 'relative',
    },
    unreadBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      backgroundColor: colors.error,
      borderRadius: borderRadius.full,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xs,
      borderWidth: 2,
      borderColor: colors.surface,
    },
    unreadBadgeText: {
      color: colors.white,
      fontSize: 11,
      fontWeight: typography.fontWeightBold,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: borderRadius.full,
      backgroundColor: colors.error,
    },
    createGroupButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.lg,
      ...shadows.small,
    },
    createGroupIcon: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    createGroupText: {
      flex: 1,
      ...textStyles.body1,
      fontWeight: typography.fontWeightSemiBold,
      color: colors.text,
    },
    sectionHeader: {
      ...textStyles.body2,
      fontWeight: typography.fontWeightSemiBold,
      color: colors.textSecondary,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    viewAllButton: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      backgroundColor: 'transparent',
      borderRadius: borderRadius.sm,
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    viewAllText: {
      ...textStyles.caption,
      color: colors.primary,
      fontWeight: typography.fontWeightBold,
    },
    logoContainer: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
      marginTop: spacing.lg,
    },
    logo: {
      width: 350,
      height: 175,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      alignItems: 'center',
      width: '100%',
      maxWidth: 320,
      ...shadows.large,
    },
    modalIconContainer: {
      width: 80,
      height: 80,
      borderRadius: borderRadius.full,
      backgroundColor: colors.gray100,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    modalTitle: {
      ...textStyles.h2,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    modalDescription: {
      ...textStyles.body2,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
      lineHeight: 22,
    },
    modalButton: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.md,
      width: '100%',
      alignItems: 'center',
    },
    modalButtonText: {
      ...textStyles.body1,
      fontWeight: typography.fontWeightBold,
      color: colors.white,
    },
    tutoringHeader: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    tutoringTitle: {
      ...textStyles.h2,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    tutoringSubtitle: {
      ...textStyles.body2,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: spacing.md,
      lineHeight: 22,
    },
    featurePreview: {
      gap: spacing.md,
    },
    featureItem: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.lg,
      alignItems: 'center',
      ...shadows.small,
    },
    featureIcon: {
      width: 56,
      height: 56,
      borderRadius: borderRadius.full,
      backgroundColor: colors.gray100,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    featureTitle: {
      ...textStyles.body1,
      fontWeight: typography.fontWeightSemiBold,
      marginBottom: spacing.xs,
    },
    featureDescription: {
      ...textStyles.caption,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

  if (loading) {
    return (
      <View style={[commonStyles.container, commonStyles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const currentMatch = matches[currentIndex];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.title}>Connect with Peers</Text>
            <Text style={styles.subtitle}>
              {viewMode === 'matches'
                ? 'Swipe to discover new connections'
                : viewMode === 'requests'
                ? 'Manage connection requests'
                : viewMode === 'connections'
                ? 'View your messages'
                : 'Give and receive academic help'}
            </Text>
          </View>
          <Image
            source={require('@/assets/images/Penguin2.png')}
            style={styles.penguinMascot}
            resizeMode="contain"
          />
        </View>

        {/* Toggle Buttons */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'matches' && styles.toggleButtonActive]}
            onPress={() => setViewMode('matches')}
          >
            <Text style={[styles.toggleText, viewMode === 'matches' && styles.toggleTextActive]}>
              Discover
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'requests' && styles.toggleButtonActive]}
            onPress={() => setViewMode('requests')}
          >
            <Text style={[styles.toggleText, viewMode === 'requests' && styles.toggleTextActive]}>
              Requests{(pendingRequests.length + outgoingRequests.length) > 0 ? ` (${pendingRequests.length + outgoingRequests.length})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'connections' && styles.toggleButtonActive]}
            onPress={() => setViewMode('connections')}
          >
            <Text style={[styles.toggleText, viewMode === 'connections' && styles.toggleTextActive]}>
              Messages
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'tutoring' && styles.toggleButtonActive]}
            onPress={() => {
              setViewMode('tutoring');
              setShowComingSoonModal(true);
            }}
          >
            <Text style={[styles.toggleText, viewMode === 'tutoring' && styles.toggleTextActive]}>
              Tutoring
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'matches' ? (
        matches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={80} color={colors.gray400} />
          <Text style={styles.emptyTitle}>No matches available</Text>
          <Text style={styles.emptySubtitle}>
            Complete your profile to get better matches
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
              <TouchableOpacity
                style={styles.profileSection}
                onPress={() => router.push({ pathname: '/user-details', params: { userId: currentMatch.id } })}
                activeOpacity={0.7}
              >
                {currentMatch.profile_image_url ? (
                  <Image
                    source={{ uri: currentMatch.profile_image_url }}
                    style={styles.avatarLarge}
                  />
                ) : (
                  <View style={styles.avatarLarge}>
                    <Ionicons name="person" size={80} color={colors.white} />
                  </View>
                )}

                <Text style={styles.name}>
                  {currentMatch.full_name || 'Anonymous Student'}
                </Text>

                {currentMatch.major && currentMatch.year ? (
                  <Text style={styles.info}>
                    {currentMatch.major} • {currentMatch.year}
                  </Text>
                ) : null}

                {currentMatch.bio ? (
                  <Text style={styles.bio}>{currentMatch.bio}</Text>
                ) : null}
              </TouchableOpacity>

              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Ionicons name="book-outline" size={24} color={colors.primary} />
                  <Text style={styles.statLabel}>Courses</Text>
                  <Text style={styles.statValue}>{currentMatch.courses_count || 0}</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statItem}>
                  <Ionicons name="people-outline" size={24} color={colors.primary} />
                  <Text style={styles.statLabel}>Groups</Text>
                  <Text style={styles.statValue}>{currentMatch.groups_count || 0}</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statItem}>
                  <Ionicons name="star-outline" size={24} color={colors.primary} />
                  <Text style={styles.statLabel}>Interests</Text>
                  <Text style={styles.statValue}>{currentMatch.interests_count || 0}</Text>
                </View>
              </View>
            </View>

          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.skipButton]} 
              onPress={handleSkip}
            >
              <Ionicons name="close" size={32} color={colors.error} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.connectButton]} 
              onPress={() => handleConnect(currentMatch.id)}
            >
              <Ionicons name="checkmark" size={32} color={colors.success} />
            </TouchableOpacity>
          </View>

          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {currentIndex + 1} / {matches.length}
            </Text>
          </View>

          {/* Logo at the bottom */}
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/images/SyncUp_Logo3.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </ScrollView>
      )
      ) : viewMode === 'requests' ? (
        /* Pending Requests View */
        <ScrollView style={styles.requestsContainer} showsVerticalScrollIndicator={false}>
          {pendingRequests.length === 0 && outgoingRequests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-outline" size={80} color={colors.gray400} />
              <Text style={styles.emptyTitle}>No pending requests</Text>
              <Text style={styles.emptySubtitle}>
                You'll see connection requests here when others want to connect with you
              </Text>
            </View>
          ) : (
            <View style={styles.requestsList}>
              {/* Incoming Requests Section */}
              {pendingRequests.length > 0 && (
                <>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeader}>Incoming Requests ({pendingRequests.length})</Text>
                    {pendingRequests.length > 1 && (
                      <TouchableOpacity
                        style={styles.viewAllButton}
                        onPress={() => setShowAllIncoming(!showAllIncoming)}
                      >
                        <Text style={styles.viewAllText}>
                          {showAllIncoming ? 'Show Less' : 'View All'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {(showAllIncoming ? pendingRequests : pendingRequests.slice(0, 1)).map((request) => (
                <View key={request.id} style={styles.requestCard}>
                  <TouchableOpacity
                    style={styles.requestHeader}
                    onPress={() => router.push({ pathname: '/user-details', params: { userId: request.user_profiles.id } })}
                    activeOpacity={0.7}
                  >
                    {request.user_profiles.profile_image_url ? (
                      <Image
                        source={{ uri: request.user_profiles.profile_image_url }}
                        style={styles.requestAvatar}
                      />
                    ) : (
                      <View style={styles.requestAvatar}>
                        <Ionicons name="person" size={32} color={colors.white} />
                      </View>
                    )}
                    <View style={styles.requestInfo}>
                      <Text style={styles.requestName}>
                        {request.user_profiles.full_name || 'Anonymous Student'}
                      </Text>
                      {request.user_profiles.major && request.user_profiles.year ? (
                        <Text style={styles.requestDetails}>
                          {request.user_profiles.major} • {request.user_profiles.year}
                        </Text>
                      ) : null}
                      {request.user_profiles.bio ? (
                        <Text style={styles.requestBio} numberOfLines={2}>
                          {request.user_profiles.bio}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>

                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={[styles.requestButton, styles.declineButton]}
                      onPress={() => handleDeclineRequest(request.id)}
                    >
                      <Ionicons name="close" size={20} color={colors.error} />
                      <Text style={styles.declineButtonText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.requestButton, styles.acceptButton]}
                      onPress={() => handleAcceptRequest(request.id)}
                    >
                      <Ionicons name="checkmark" size={20} color={colors.white} />
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
                </>
              )}

              {/* Outgoing Requests Section */}
              {outgoingRequests.length > 0 && (
                <>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeader}>Outgoing Requests ({outgoingRequests.length})</Text>
                    {outgoingRequests.length > 1 && (
                      <TouchableOpacity
                        style={styles.viewAllButton}
                        onPress={() => setShowAllOutgoing(!showAllOutgoing)}
                      >
                        <Text style={styles.viewAllText}>
                          {showAllOutgoing ? 'Show Less' : 'View All'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {(showAllOutgoing ? outgoingRequests : outgoingRequests.slice(0, 1)).map((request) => (
                    <View key={request.id} style={styles.requestCard}>
                      <TouchableOpacity
                        style={styles.requestHeader}
                        onPress={() => router.push({ pathname: '/user-details', params: { userId: request.user_profiles.id } })}
                        activeOpacity={0.7}
                      >
                        {request.user_profiles.profile_image_url ? (
                          <Image
                            source={{ uri: request.user_profiles.profile_image_url }}
                            style={styles.requestAvatar}
                          />
                        ) : (
                          <View style={styles.requestAvatar}>
                            <Ionicons name="person" size={32} color={colors.white} />
                          </View>
                        )}
                        <View style={styles.requestInfo}>
                          <Text style={styles.requestName}>
                            {request.user_profiles.full_name || 'Anonymous Student'}
                          </Text>
                          {request.user_profiles.major && request.user_profiles.year ? (
                            <Text style={styles.requestDetails}>
                              {request.user_profiles.major} • {request.user_profiles.year}
                            </Text>
                          ) : null}
                          {request.user_profiles.bio ? (
                            <Text style={styles.requestBio} numberOfLines={2}>
                              {request.user_profiles.bio}
                            </Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.requestButton, styles.declineButton, { flex: undefined, width: '100%' }]}
                        onPress={() => handleCancelRequest(request.id)}
                      >
                        <Ionicons name="close" size={20} color={colors.error} />
                        <Text style={styles.declineButtonText}>Cancel Request</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}
            </View>
          )}

          {/* Logo at the bottom */}
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/images/SyncUp_Logo3.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </ScrollView>
      ) : viewMode === 'connections' ? (
        /* My Connections View */
        <ScrollView style={styles.requestsContainer} showsVerticalScrollIndicator={false}>
          {acceptedConnections.length === 0 && groupChats.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={80} color={colors.gray400} />
              <Text style={styles.emptyTitle}>No connections yet</Text>
              <Text style={styles.emptySubtitle}>
                Connect with other students to start messaging
              </Text>
            </View>
          ) : (
            <View style={styles.requestsList}>
              {/* Create Group Chat Button */}
              {acceptedConnections.length >= 1 && (
                <TouchableOpacity
                  style={styles.createGroupButton}
                  onPress={() => router.push('/create-group-chat')}
                >
                  <View style={styles.createGroupIcon}>
                    <Ionicons name="people" size={24} color={colors.white} />
                  </View>
                  <Text style={styles.createGroupText}>Create Group Chat</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              )}

              {/* Group Chats Section */}
              {groupChats.length > 0 && (
                <>
                  <Text style={styles.sectionHeader}>Group Chats</Text>
                  {groupChats.map((groupChat) => (
                    <TouchableOpacity
                      key={groupChat.id}
                      style={styles.connectionCard}
                      onPress={() => handleOpenGroupChat(groupChat.id)}
                    >
                      <View style={styles.requestHeader}>
                        <View style={styles.avatarContainer}>
                          <View style={[styles.requestAvatar, { backgroundColor: colors.primary }]}>
                            <Ionicons name="people" size={32} color={colors.white} />
                          </View>
                          {(groupChat.unread_count ?? 0) > 0 && (
                            <View style={styles.unreadBadge}>
                              <Text style={styles.unreadBadgeText}>
                                {groupChat.unread_count! > 9 ? '9+' : String(groupChat.unread_count)}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.requestInfo}>
                          <View style={styles.nameRow}>
                            <Text style={styles.requestName}>
                              {groupChat.name || 'Group Chat'}
                            </Text>
                            {(groupChat.unread_count ?? 0) > 0 && (
                              <View style={styles.unreadDot} />
                            )}
                          </View>
                          <Text style={styles.requestDetails}>
                            {groupChat.member_count} members
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* Direct Messages Section */}
              {acceptedConnections.length > 0 && (
                <>
                  <Text style={styles.sectionHeader}>Direct Messages</Text>
                  {acceptedConnections.map((connection) => (
                <View key={connection.id} style={styles.connectionCard}>
                  <TouchableOpacity
                    style={styles.requestHeader}
                    onPress={() => router.push({ pathname: '/user-details', params: { userId: connection.connected_user.id } })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.avatarContainer}>
                      {connection.connected_user.profile_image_url ? (
                        <Image
                          source={{ uri: connection.connected_user.profile_image_url }}
                          style={styles.requestAvatar}
                        />
                      ) : (
                        <View style={styles.requestAvatar}>
                          <Ionicons name="person" size={32} color={colors.white} />
                        </View>
                      )}
                      {(connection.unread_count ?? 0) > 0 ? (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadBadgeText}>
                            {connection.unread_count! > 9 ? '9+' : String(connection.unread_count)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.requestInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.requestName}>
                          {connection.connected_user?.full_name || 'Anonymous Student'}
                        </Text>
                        {(connection.unread_count ?? 0) > 0 && (
                          <View style={styles.unreadDot} />
                        )}
                      </View>
                      {connection.connected_user?.major && connection.connected_user?.year ? (
                        <Text style={styles.requestDetails}>
                          {connection.connected_user.major} • {connection.connected_user.year}
                        </Text>
                      ) : null}
                      {connection.connected_user?.bio ? (
                        <Text style={styles.requestBio} numberOfLines={2}>
                          {connection.connected_user.bio}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.messageButton}
                    onPress={() => handleStartDM(connection.connected_user.id)}
                  >
                    <Ionicons name="chatbubble-outline" size={20} color={colors.white} />
                    <Text style={styles.messageButtonText}>Message</Text>
                  </TouchableOpacity>
                </View>
              ))}
                </>
              )}
            </View>
          )}

          {/* Logo at the bottom */}
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/images/SyncUp_Logo3.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </ScrollView>
      ) : (
        /* Tutoring View */
        <ScrollView style={styles.requestsContainer} showsVerticalScrollIndicator={false}>
          {/* Coming Soon Modal */}
          <Modal
            visible={showComingSoonModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowComingSoonModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalIconContainer}>
                  <Ionicons name="construct-outline" size={48} color={colors.primary} />
                </View>
                <Text style={styles.modalTitle}>Coming Soon</Text>
                <Text style={styles.modalDescription}>
                  We're working hard to bring you the Peer Tutoring Exchange. Stay tuned for updates!
                </Text>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => setShowComingSoonModal(false)}
                >
                  <Text style={styles.modalButtonText}>Got It</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Header Section */}
          <View style={styles.tutoringHeader}>
            <Text style={styles.tutoringTitle}>Peer Tutoring Exchange</Text>
            <Text style={styles.tutoringSubtitle}>
              Connect with fellow students to give and receive academic help. Earn credits by tutoring others and use them to get help in subjects you need.
            </Text>
          </View>

          {/* Feature Preview */}
          <View style={styles.featurePreview}>
            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Ionicons name="school-outline" size={28} color={colors.primary} />
              </View>
              <Text style={styles.featureTitle}>Offer Your Expertise</Text>
              <Text style={styles.featureDescription}>
                Help others in subjects you excel at
              </Text>
            </View>

            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Ionicons name="hand-left-outline" size={28} color={colors.primary} />
              </View>
              <Text style={styles.featureTitle}>Get Help</Text>
              <Text style={styles.featureDescription}>
                Request tutoring in subjects you need
              </Text>
            </View>

            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Ionicons name="star-outline" size={28} color={colors.primary} />
              </View>
              <Text style={styles.featureTitle}>Build Reputation</Text>
              <Text style={styles.featureDescription}>
                Earn credits and reviews from peers
              </Text>
            </View>
          </View>

          {/* Logo at the bottom */}
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/images/SyncUp_Logo3.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </ScrollView>
      )}
    </View>
  );
}
