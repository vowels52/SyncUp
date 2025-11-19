import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, ScrollView, Image } from 'react-native';
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

export default function ConnectionsScreen() {
  const [matches, setMatches] = useState<UserMatch[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ConnectionRequest[]>([]);
  const [acceptedConnections, setAcceptedConnections] = useState<AcceptedConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'matches' | 'requests' | 'connections'>('matches');

  const colors = useThemedColors();
  const { commonStyles, textStyles } = useThemedStyles();

  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  useEffect(() => {
    fetchMatches();
    fetchPendingRequests();
    fetchAcceptedConnections();

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
            // New connection request received
            fetchPendingRequests();
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

            // If connection was accepted, refresh both requests and connections
            if (connection.status === 'accepted') {
              fetchPendingRequests();
              fetchAcceptedConnections();
            }

            // If connection was rejected, refresh requests
            if (connection.status === 'rejected') {
              fetchPendingRequests();
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
            // Connection was deleted, refresh both lists
            fetchPendingRequests();
            fetchAcceptedConnections();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(dmChannel);
        supabase.removeChannel(connectionsChannel);
      };
    }
  }, [user]);

  // Refresh connections when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (viewMode === 'connections') {
        fetchAcceptedConnections();
      }
    }, [viewMode])
  );

  const fetchMatches = async () => {
    if (!user) return;

    try {
      setLoading(true);

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

      // Fetch all users except current user and those with existing connections/history
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, major, year, bio, profile_image_url')
        .neq('id', user.id)
        .not('full_name', 'is', null)
        .limit(50);

      if (error) throw error;

      if (data) {
        // Filter out users with existing connections or match history
        const filteredMatches = data.filter(
          (match) => !excludedUserIds.has(match.id)
        );
        setMatches(filteredMatches.slice(0, 10));
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
      // Fetch connection requests where the current user is the connected_user_id
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
      padding: spacing.md,
    },
    cardContainer: {
      flex: 1,
      justifyContent: 'center',
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
        <Text style={styles.title}>Find Your Match</Text>
        <Text style={styles.subtitle}>
          {viewMode === 'matches'
            ? 'Swipe to connect with peers'
            : viewMode === 'requests'
            ? 'Manage connection requests'
            : 'Message your connections'}
        </Text>

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
              Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'connections' && styles.toggleButtonActive]}
            onPress={() => setViewMode('connections')}
          >
            <Text style={[styles.toggleText, viewMode === 'connections' && styles.toggleTextActive]}>
              Connections
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
        <View style={styles.content}>
          <View style={styles.cardContainer}>
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

                {currentMatch.major && currentMatch.year && (
                  <Text style={styles.info}>
                    {currentMatch.major} • {currentMatch.year}
                  </Text>
                )}

                {currentMatch.bio && (
                  <Text style={styles.bio}>{currentMatch.bio}</Text>
                )}
              </TouchableOpacity>

              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Ionicons name="book-outline" size={24} color={colors.primary} />
                  <Text style={styles.statLabel}>Courses</Text>
                  <Text style={styles.statValue}>5</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statItem}>
                  <Ionicons name="people-outline" size={24} color={colors.primary} />
                  <Text style={styles.statLabel}>Groups</Text>
                  <Text style={styles.statValue}>3</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statItem}>
                  <Ionicons name="star-outline" size={24} color={colors.primary} />
                  <Text style={styles.statLabel}>Interests</Text>
                  <Text style={styles.statValue}>8</Text>
                </View>
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
        </View>
      )
      ) : viewMode === 'requests' ? (
        /* Pending Requests View */
        <ScrollView style={styles.requestsContainer} showsVerticalScrollIndicator={false}>
          {pendingRequests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-outline" size={80} color={colors.gray400} />
              <Text style={styles.emptyTitle}>No pending requests</Text>
              <Text style={styles.emptySubtitle}>
                You'll see connection requests here when others want to connect with you
              </Text>
            </View>
          ) : (
            <View style={styles.requestsList}>
              {pendingRequests.map((request) => (
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
                      {request.user_profiles.major && request.user_profiles.year && (
                        <Text style={styles.requestDetails}>
                          {request.user_profiles.major} • {request.user_profiles.year}
                        </Text>
                      )}
                      {request.user_profiles.bio && (
                        <Text style={styles.requestBio} numberOfLines={2}>
                          {request.user_profiles.bio}
                        </Text>
                      )}
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
            </View>
          )}
        </ScrollView>
      ) : (
        /* My Connections View */
        <ScrollView style={styles.requestsContainer} showsVerticalScrollIndicator={false}>
          {acceptedConnections.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={80} color={colors.gray400} />
              <Text style={styles.emptyTitle}>No connections yet</Text>
              <Text style={styles.emptySubtitle}>
                Connect with other students to start messaging
              </Text>
            </View>
          ) : (
            <View style={styles.requestsList}>
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
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
