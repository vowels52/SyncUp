import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '@/constants/theme';
import { textStyles, commonStyles } from '@/constants/styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';

interface UserMatch {
  id: string;
  full_name: string | null;
  major: string | null;
  year: string | null;
  bio: string | null;
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
  };
}

export default function ConnectionsScreen() {
  const [matches, setMatches] = useState<UserMatch[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ConnectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'matches' | 'requests'>('matches');

  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  useEffect(() => {
    fetchMatches();
    fetchPendingRequests();
  }, [user]);

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
        .select('id, full_name, major, year, bio')
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
            bio
          )
        `)
        .eq('connected_user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setPendingRequests(data as ConnectionRequest[]);
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
          {viewMode === 'matches' ? 'Swipe to connect with peers' : 'Manage connection requests'}
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
              <View style={styles.profileSection}>
                <View style={styles.avatarLarge}>
                  <Ionicons name="person" size={80} color={colors.white} />
                </View>

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
              </View>

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
      ) : (
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
                  <View style={styles.requestHeader}>
                    <View style={styles.requestAvatar}>
                      <Ionicons name="person" size={32} color={colors.white} />
                    </View>
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
                  </View>

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
      )}
    </View>
  );
}

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
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    ...textStyles.body2,
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
});
