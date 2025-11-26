import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Modal, FlatList } from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '@/constants/theme';
import { textStyles, commonStyles } from '@/constants/styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useAlert } from '@/template';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getSupabaseClient } from '@/template';
import { useThemedColors } from '@/hooks/useThemedColors';

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  major: string | null;
  year: string | null;
  bio: string | null;
  university: string | null;
  profile_image_url: string | null;
}

interface ConnectionWithMutuals {
  id: string;
  full_name: string | null;
  email: string | null;
  major: string | null;
  year: string | null;
  bio: string | null;
  profile_image_url: string | null;
  mutual_connections: number;
  mutual_connection_names: string[];
}

export default function UserDetailsScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionsCount, setConnectionsCount] = useState(0);
  const [groupsCount, setGroupsCount] = useState(0);
  const [eventsCount, setEventsCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending' | 'accepted' | 'self'>('none');
  const [actionLoading, setActionLoading] = useState(false);
  const [showConnectionsModal, setShowConnectionsModal] = useState(false);
  const [connections, setConnections] = useState<ConnectionWithMutuals[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);

  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = params.userId as string;
  const supabase = getSupabaseClient();
  const themedColors = useThemedColors();

  useEffect(() => {
    if (userId) {
      // Check if viewing own profile
      if (user?.id === userId) {
        setConnectionStatus('self');
        router.replace('/profile');
        return;
      }

      fetchProfile();
      fetchStatistics();
      checkConnectionStatus();
    }
  }, [userId, user]);

  const fetchProfile = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (data) {
        setProfile(data);
      }
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to fetch user profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    if (!userId) return;

    try {
      // Fetch connections count (accepted connections only)
      const { count: connectionsCount, error: connectionsError } = await supabase
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'accepted')
        .or(`user_id.eq.${userId},connected_user_id.eq.${userId}`);

      if (connectionsError) throw connectionsError;
      setConnectionsCount(connectionsCount || 0);

      // Fetch groups count
      const { count: groupsCount, error: groupsError } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (groupsError) throw groupsError;
      setGroupsCount(groupsCount || 0);

      // Fetch events count (attending events only)
      const { count: eventsCount, error: eventsError } = await supabase
        .from('event_attendees')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'going');

      if (eventsError) throw eventsError;
      setEventsCount(eventsCount || 0);
    } catch (error: any) {
      console.error('Failed to fetch statistics:', error.message);
    }
  };

  const checkConnectionStatus = async () => {
    if (!user || !userId) return;

    try {
      const { data, error } = await supabase
        .from('connections')
        .select('status')
        .or(`and(user_id.eq.${user.id},connected_user_id.eq.${userId}),and(user_id.eq.${userId},connected_user_id.eq.${user.id})`)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConnectionStatus(data.status);
      } else {
        setConnectionStatus('none');
      }
    } catch (error: any) {
      console.error('Failed to check connection status:', error.message);
    }
  };

  const handleConnect = async () => {
    if (!user || !userId) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('connections')
        .insert({
          user_id: user.id,
          connected_user_id: userId,
          status: 'pending',
        });

      if (error) throw error;

      setConnectionStatus('pending');
      showAlert('Success', 'Connection request sent!');
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to send connection request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMessage = async () => {
    if (!user || !userId) return;

    try {
      // Check if conversation already exists
      const { data: existingConversation, error: checkError } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${userId}),and(participant1_id.eq.${userId},participant2_id.eq.${user.id})`)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') throw checkError;

      let conversationId = existingConversation?.id;

      // If no conversation exists, create one
      if (!conversationId) {
        const { data: newConversation, error: createError } = await supabase
          .from('conversations')
          .insert({
            participant1_id: user.id,
            participant2_id: userId,
          })
          .select('id')
          .single();

        if (createError) throw createError;
        conversationId = newConversation.id;
      }

      // Navigate to conversation
      router.push({
        pathname: '/dm-conversation',
        params: {
          conversationId,
          otherUserId: userId,
        },
      });
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to open conversation');
    }
  };

  const fetchConnections = async () => {
    if (!userId) return;

    try {
      setConnectionsLoading(true);

      // Fetch the user's connections
      const { data: userConnections, error } = await supabase
        .from('connections')
        .select('id, user_id, connected_user_id')
        .eq('status', 'accepted')
        .or(`user_id.eq.${userId},connected_user_id.eq.${userId}`);

      if (error) throw error;

      console.log('User ID being viewed:', userId);
      console.log('User connections found:', userConnections);

      if (!userConnections || userConnections.length === 0) {
        setConnections([]);
        setConnectionsLoading(false);
        return;
      }

      // Get the IDs of connected users (the other person in each connection)
      const connectedUserIds = userConnections.map((conn: any) => {
        return conn.user_id === userId ? conn.connected_user_id : conn.user_id;
      });

      console.log('Connected user IDs:', connectedUserIds);

      // Fetch the profiles of all connected users
      const { data: connectedProfiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, major, year, bio, profile_image_url')
        .in('id', connectedUserIds);

      if (profilesError) throw profilesError;

      if (!connectedProfiles || connectedProfiles.length === 0) {
        setConnections([]);
        setConnectionsLoading(false);
        return;
      }

      const connectedUsers = connectedProfiles;

      // For each connection, find mutual connections (friends of friends)
      const connectionsWithMutuals = await Promise.all(
        connectedUsers.map(async (connectedUser: any) => {
          if (!user) {
            return {
              ...connectedUser,
              mutual_connections: 0,
              mutual_connection_names: [],
            };
          }

          // Get mutual connections between the current user and this connected user
          // A mutual connection is someone who is connected to both the current user AND this connected user

          // First, get all connections of the current logged-in user
          const { data: currentUserConnections } = await supabase
            .from('connections')
            .select('user_id, connected_user_id')
            .eq('status', 'accepted')
            .or(`user_id.eq.${user.id},connected_user_id.eq.${user.id}`);

          // Get all connections of this connected user
          const { data: otherUserConnections } = await supabase
            .from('connections')
            .select('user_id, connected_user_id')
            .eq('status', 'accepted')
            .or(`user_id.eq.${connectedUser.id},connected_user_id.eq.${connectedUser.id}`);

          if (!currentUserConnections || !otherUserConnections) {
            return {
              ...connectedUser,
              mutual_connections: 0,
              mutual_connection_names: [],
            };
          }

          // Extract user IDs from current user's connections
          const currentUserConnectionIds = new Set<string>();
          currentUserConnections.forEach((conn: any) => {
            const otherId = conn.user_id === user.id ? conn.connected_user_id : conn.user_id;
            currentUserConnectionIds.add(otherId);
          });

          // Extract user IDs from connected user's connections
          const otherUserConnectionIds = new Set<string>();
          otherUserConnections.forEach((conn: any) => {
            const otherId = conn.user_id === connectedUser.id ? conn.connected_user_id : conn.user_id;
            otherUserConnectionIds.add(otherId);
          });

          // Find mutual connections (intersection of both sets)
          const mutualIds = Array.from(currentUserConnectionIds).filter(id =>
            otherUserConnectionIds.has(id) && id !== user.id && id !== connectedUser.id
          );

          // Fetch names of mutual connections
          let mutualNames: string[] = [];
          if (mutualIds.length > 0) {
            const { data: mutualProfiles } = await supabase
              .from('user_profiles')
              .select('full_name')
              .in('id', mutualIds);

            if (mutualProfiles) {
              mutualNames = mutualProfiles
                .map(p => p.full_name)
                .filter((name): name is string => name !== null);
            }
          }

          return {
            ...connectedUser,
            mutual_connections: mutualIds.length,
            mutual_connection_names: mutualNames,
          };
        })
      );

      setConnections(connectionsWithMutuals);
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to fetch connections');
    } finally {
      setConnectionsLoading(false);
    }
  };

  const handleOpenConnections = () => {
    setShowConnectionsModal(true);
    fetchConnections();
  };

  // Generate styles dynamically based on theme
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themedColors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      backgroundColor: themedColors.surface,
      borderBottomWidth: 1,
      borderBottomColor: themedColors.gray200,
    },
    backButton: {
      padding: spacing.xs,
    },
    headerTitle: {
      ...textStyles.h3,
      color: themedColors.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    headerSpacer: {
      width: 40,
    },
    content: {
      flex: 1,
    },
    profileHeader: {
      backgroundColor: themedColors.surface,
      paddingVertical: spacing.xl,
      alignItems: 'center',
      ...shadows.small,
    },
    avatarLarge: {
      width: 120,
      height: 120,
      borderRadius: borderRadius.full,
      backgroundColor: themedColors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    profileName: {
      ...textStyles.h2,
      color: themedColors.textPrimary,
      marginBottom: spacing.xs,
    },
    profileEmail: {
      ...textStyles.body2,
      color: themedColors.textSecondary,
      marginBottom: spacing.md,
    },
    badge: {
      backgroundColor: themedColors.gray100,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
    },
    badgeText: {
      ...textStyles.caption,
      color: themedColors.textPrimary,
      fontWeight: typography.fontWeightSemiBold,
    },
    section: {
      padding: spacing.md,
    },
    sectionTitle: {
      ...textStyles.h4,
      color: themedColors.textPrimary,
      marginBottom: spacing.md,
    },
    card: {
      backgroundColor: themedColors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      ...shadows.small,
    },
    bioText: {
      ...textStyles.body2,
      color: themedColors.textSecondary,
      lineHeight: typography.lineHeight24,
    },
    statsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    statCard: {
      flex: 1,
      backgroundColor: themedColors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      alignItems: 'center',
      ...shadows.small,
    },
    statValue: {
      ...textStyles.h3,
      color: themedColors.textPrimary,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    statLabel: {
      ...textStyles.caption,
      color: themedColors.textSecondary,
    },
    actionsContainer: {
      padding: spacing.md,
      gap: spacing.sm,
    },
    primaryButton: {
      backgroundColor: themedColors.primary,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
      ...shadows.small,
    },
    secondaryButton: {
      backgroundColor: themedColors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: themedColors.gray300,
      ...shadows.small,
    },
    disabledButton: {
      backgroundColor: themedColors.gray300,
    },
    buttonText: {
      ...textStyles.button,
      color: themedColors.white,
    },
    secondaryButtonText: {
      ...textStyles.button,
      color: themedColors.textPrimary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: themedColors.surface,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      maxHeight: '80%',
      paddingTop: spacing.md,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: themedColors.gray200,
    },
    modalTitle: {
      ...textStyles.h3,
      color: themedColors.textPrimary,
      flex: 1,
    },
    closeButton: {
      padding: spacing.xs,
    },
    connectionItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: themedColors.gray100,
    },
    connectionAvatar: {
      width: 56,
      height: 56,
      borderRadius: borderRadius.full,
      backgroundColor: themedColors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    connectionDetails: {
      flex: 1,
    },
    connectionName: {
      ...textStyles.body1,
      fontWeight: typography.fontWeightSemiBold,
      color: themedColors.textPrimary,
      marginBottom: spacing.xs,
    },
    connectionMajor: {
      ...textStyles.caption,
      color: themedColors.textSecondary,
      marginBottom: spacing.xs,
    },
    mutualConnectionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.xs,
      gap: spacing.xs,
    },
    mutualConnectionsText: {
      ...textStyles.caption,
      color: themedColors.primary,
      fontWeight: typography.fontWeightSemiBold,
    },
    mutualNames: {
      ...textStyles.caption,
      color: themedColors.textSecondary,
      fontStyle: 'italic',
      marginTop: 2,
    },
    emptyConnectionsContainer: {
      paddingVertical: spacing.xl * 2,
      alignItems: 'center',
    },
    emptyConnectionsText: {
      ...textStyles.body2,
      color: themedColors.textSecondary,
      marginTop: spacing.md,
    },
  });

  if (loading) {
    return (
      <View style={[commonStyles.container, commonStyles.centerContent]}>
        <ActivityIndicator size="large" color={themedColors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[commonStyles.container, commonStyles.centerContent]}>
        <Ionicons name="person-outline" size={64} color={themedColors.gray400} />
        <Text style={[textStyles.body1, { color: themedColors.textSecondary, marginTop: spacing.md }]}>
          User not found
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
          <Text style={[textStyles.button, { color: themedColors.primary }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={themedColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          {profile.profile_image_url ? (
            <Image
              source={{ uri: profile.profile_image_url }}
              style={styles.avatarLarge}
            />
          ) : (
            <View style={styles.avatarLarge}>
              <Ionicons name="person" size={64} color={themedColors.white} />
            </View>
          )}

          <Text style={styles.profileName}>
            {profile.full_name || 'Anonymous Student'}
          </Text>
          <Text style={styles.profileEmail}>{profile.email}</Text>

          {profile.major && profile.year && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {profile.major} • {profile.year}
              </Text>
            </View>
          )}
        </View>

        {profile.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.card}>
              <Text style={styles.bioText}>{profile.bio}</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistics</Text>
          <View style={styles.statsGrid}>
            <TouchableOpacity
              style={styles.statCard}
              onPress={handleOpenConnections}
              activeOpacity={0.7}
            >
              <Ionicons name="people" size={32} color={themedColors.primary} />
              <Text style={styles.statValue}>{connectionsCount}</Text>
              <Text style={styles.statLabel}>Connections</Text>
            </TouchableOpacity>

            <View style={styles.statCard}>
              <Ionicons name="grid" size={32} color={themedColors.accent} />
              <Text style={styles.statValue}>{groupsCount}</Text>
              <Text style={styles.statLabel}>Groups</Text>
            </View>

            <View style={styles.statCard}>
              <Ionicons name="calendar" size={32} color={themedColors.success} />
              <Text style={styles.statValue}>{eventsCount}</Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionsContainer}>
          {connectionStatus === 'accepted' && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleMessage}
            >
              <Ionicons name="chatbubble" size={20} color={themedColors.white} />
              <Text style={styles.buttonText}>Send Message</Text>
            </TouchableOpacity>
          )}

          {connectionStatus === 'none' && (
            <TouchableOpacity
              style={[styles.primaryButton, actionLoading && styles.disabledButton]}
              onPress={handleConnect}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color={themedColors.white} />
              ) : (
                <>
                  <Ionicons name="person-add" size={20} color={themedColors.white} />
                  <Text style={styles.buttonText}>Connect</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {connectionStatus === 'pending' && (
            <View style={[styles.secondaryButton, styles.disabledButton]}>
              <Ionicons name="time" size={20} color={themedColors.textSecondary} />
              <Text style={[styles.secondaryButtonText, { color: themedColors.textSecondary }]}>
                Request Pending
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Connections Modal */}
      <Modal
        visible={showConnectionsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConnectionsModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowConnectionsModal(false)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {profile?.full_name ? `${profile.full_name}'s Connections` : 'Connections'}
              </Text>
              <TouchableOpacity
                onPress={() => setShowConnectionsModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={themedColors.textPrimary} />
              </TouchableOpacity>
            </View>

            {connectionsLoading ? (
              <View style={{ paddingVertical: spacing.xl * 2 }}>
                <ActivityIndicator size="large" color={themedColors.primary} />
              </View>
            ) : connections.length === 0 ? (
              <View style={styles.emptyConnectionsContainer}>
                <Ionicons name="people-outline" size={64} color={themedColors.gray400} />
                <Text style={styles.emptyConnectionsText}>
                  No connections yet
                </Text>
              </View>
            ) : (
              <FlatList
                data={connections}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.connectionItem}
                    onPress={() => {
                      setShowConnectionsModal(false);
                      router.push({ pathname: '/user-details', params: { userId: item.id } });
                    }}
                    activeOpacity={0.7}
                  >
                    {item.profile_image_url ? (
                      <Image
                        source={{ uri: item.profile_image_url }}
                        style={styles.connectionAvatar}
                      />
                    ) : (
                      <View style={styles.connectionAvatar}>
                        <Ionicons name="person" size={32} color={themedColors.white} />
                      </View>
                    )}
                    <View style={styles.connectionDetails}>
                      <Text style={styles.connectionName}>
                        {item.full_name || 'Anonymous Student'}
                      </Text>
                      {item.major && item.year && (
                        <Text style={styles.connectionMajor}>
                          {item.major} • {item.year}
                        </Text>
                      )}
                      {item.mutual_connections > 0 && (
                        <View style={styles.mutualConnectionsContainer}>
                          <Ionicons name="people" size={14} color={themedColors.primary} />
                          <Text style={styles.mutualConnectionsText}>
                            {item.mutual_connections} mutual {item.mutual_connections === 1 ? 'connection' : 'connections'}
                          </Text>
                        </View>
                      )}
                      {item.mutual_connection_names.length > 0 && (
                        <Text style={styles.mutualNames} numberOfLines={1}>
                          {item.mutual_connection_names.slice(0, 3).join(', ')}
                          {item.mutual_connection_names.length > 3 ? ` +${item.mutual_connection_names.length - 3} more` : ''}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={themedColors.gray400} />
                  </TouchableOpacity>
                )}
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
