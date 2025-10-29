import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
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

export default function ConnectionsScreen() {
  const [matches, setMatches] = useState<UserMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  useEffect(() => {
    fetchMatches();
  }, [user]);

  const fetchMatches = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch all users except current user
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, major, year, bio')
        .neq('id', user.id)
        .not('full_name', 'is', null)
        .limit(10);

      if (error) throw error;

      if (data) {
        setMatches(data);
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
      const { error } = await supabase
        .from('connections')
        .insert({
          user_id: user.id,
          connected_user_id: matchedUserId,
          status: 'pending',
        });

      if (error) throw error;

      showAlert('Success', 'Connection request sent!');
      handleNext();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to send connection request');
    }
  };

  const handleSkip = () => {
    handleNext();
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
          Swipe to connect with peers
        </Text>
      </View>

      {matches.length === 0 ? (
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
});
