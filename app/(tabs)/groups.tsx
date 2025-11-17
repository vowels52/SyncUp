import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, borderRadius, shadows, typography } from '@/constants/theme';
import { textStyles, commonStyles } from '@/constants/styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';

interface UserGroup {
  id: string;
  name: string;
  role: string;
  nextEvent: string;
  nextEventDate: string;
}

interface UWBClub {
  id: string;
  name: string;
  club_type: string;
  category: string;
  description: string;
  image_url: string;
  is_official_club: boolean;
}

interface StudyGroup {
  id: string;
  name: string;
  description: string;
  club_type: string;
  category: string;
  member_count: number;
}

export default function GroupsScreen() {
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [uwbClubs, setUwbClubs] = useState<UWBClub[]>([]);
  const [studyGroups, setStudyGroups] = useState<StudyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllClubs, setShowAllClubs] = useState(false);
  const [showAllStudyGroups, setShowAllStudyGroups] = useState(false);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchUserGroups(), loadUWBClubs(), loadStudyGroups()]);
    setLoading(false);
    setRefreshing(false);
  };

  const loadUWBClubs = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, description, club_type, category, image_url, is_official_club')
        .eq('is_official_club', true)
        .order('name', { ascending: true });

      if (error) throw error;
      if (data) {
        setUwbClubs(data);
      }
    } catch (error) {
      console.error('Error loading UWB clubs:', error);
    }
  };

  const loadStudyGroups = async () => {
    try {
      // Only get user-created study groups (not official clubs)
      // Filter out any groups that are official clubs OR have no is_official_club set
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, description, club_type, category, is_official_club')
        .eq('is_official_club', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // Filter to ensure we only get non-official clubs
        const nonOfficialGroups = data.filter((group: any) => group.is_official_club === false);

        // Get member counts for each study group
        const groupsWithCounts = await Promise.all(
          nonOfficialGroups.map(async (group: any) => {
            const { count } = await supabase
              .from('group_members')
              .select('*', { count: 'exact', head: true })
              .eq('group_id', group.id);

            return {
              ...group,
              member_count: count || 0,
            };
          })
        );

        setStudyGroups(groupsWithCounts);
      }
    } catch (error) {
      console.error('Error loading study groups:', error);
    }
  };

  const fetchUserGroups = async () => {
    if (!user) return;

    try {
      // Fetch user's groups with their roles
      const { data: memberData, error: memberError } = await supabase
        .from('group_members')
        .select('group_id, role, groups(id, name)')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      if (memberData && memberData.length > 0) {
        // Get next upcoming event (generic, not group-specific)
        const { data: nextEventData } = await supabase
          .from('events')
          .select('title, start_time')
          .gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(1)
          .single();

        const groupsWithEvents = memberData.map((member: any) => {
          let nextEvent = 'Next Event';
          let nextEventDate = '';

          if (nextEventData) {
            const date = new Date(nextEventData.start_time);
            nextEvent = nextEventData.title;
            nextEventDate = `${date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} @ ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} PST`;
          }

          return {
            id: member.groups.id,
            name: member.groups.name,
            role: member.role.charAt(0).toUpperCase() + member.role.slice(1),
            nextEvent,
            nextEventDate,
          };
        });

        setUserGroups(groupsWithEvents);
      }
    } catch (error: any) {
      console.error('Error fetching user groups:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const openClubDetail = (clubId: string) => {
    router.push(`/club-detail?id=${clubId}&from=groups`);
  };

  const openStudyGroupDetail = (groupId: string) => {
    router.push(`/study-group-detail?id=${groupId}&from=groups`);
  };

  if (loading) {
    return (
      <View style={[commonStyles.container, commonStyles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* Study Groups Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Study Groups</Text>
          {studyGroups.length > 5 && (
            <TouchableOpacity onPress={() => setShowAllStudyGroups(!showAllStudyGroups)}>
              <Text style={styles.toggleText}>
                {showAllStudyGroups ? 'Show Less' : `Show All (${studyGroups.length})`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.sectionContent}>
          {studyGroups.length === 0 ? (
            <Text style={styles.emptyText}>No study groups available</Text>
          ) : (
            (showAllStudyGroups ? studyGroups : studyGroups.slice(0, 5)).map((group) => (
              <TouchableOpacity
                key={group.id}
                style={styles.studyGroupCard}
                onPress={() => openStudyGroupDetail(group.id)}
              >
                <View style={styles.studyGroupIcon}>
                  <Ionicons name="people" size={24} color={colors.primary} />
                </View>
                <View style={styles.studyGroupInfo}>
                  <Text style={styles.studyGroupName} numberOfLines={1}>
                    {group.name}
                  </Text>
                  {(group.club_type || group.category) && (
                    <Text style={styles.studyGroupType} numberOfLines={1}>
                      {group.club_type}
                      {group.club_type && group.category ? ' - ' : ''}
                      {group.category}
                    </Text>
                  )}
                  <Text style={styles.studyGroupMembers}>
                    {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      {/* UWB Clubs Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Discover UWB Clubs</Text>
          <TouchableOpacity onPress={() => setShowAllClubs(!showAllClubs)}>
            <Text style={styles.toggleText}>
              {showAllClubs ? 'Show Less' : `Show All (${uwbClubs.length})`}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.sectionContent}>
          {uwbClubs.length === 0 ? (
            <Text style={styles.emptyText}>No clubs available</Text>
          ) : (
            (showAllClubs ? uwbClubs : uwbClubs.slice(0, 5)).map((club) => (
              <TouchableOpacity
                key={club.id}
                style={styles.clubCard}
                onPress={() => openClubDetail(club.id)}
              >
                <View style={styles.clubImageContainer}>
                  <Image
                    source={{ uri: club.image_url }}
                    style={styles.clubImage}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.clubInfo}>
                  <Text style={styles.clubName} numberOfLines={1}>
                    {club.name}
                  </Text>
                  <Text style={styles.clubType} numberOfLines={1}>
                    {club.club_type}
                    {club.category ? ` - ${club.category}` : ''}
                  </Text>
                  {club.description && (
                    <Text style={styles.clubDescription} numberOfLines={2}>
                      {club.description}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      {/* Logo at the bottom */}
      <View style={styles.logoContainer}>
        <Image
          source={require('@/assets/images/SyncUp_Logo_Idea_2_Black_Text.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.small,
  },
  sectionTitle: {
    fontSize: typography.fontSize20,
    fontWeight: typography.fontWeightBold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  sectionContent: {
    gap: spacing.xs,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  listIcon: {
    marginRight: spacing.md,
    marginTop: 2,
  },
  listItemText: {
    flex: 1,
    fontSize: typography.fontSize14,
    color: colors.textPrimary,
    lineHeight: typography.lineHeight24,
  },
  groupTextContainer: {
    flex: 1,
  },
  groupNameText: {
    fontSize: typography.fontSize14,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  nextEventText: {
    fontSize: typography.fontSize12,
    color: colors.textSecondary,
    lineHeight: typography.lineHeight20,
  },
  emptyText: {
    fontSize: typography.fontSize14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginTop: spacing.lg,
  },
  logo: {
    width: 200,
    height: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  toggleText: {
    fontSize: typography.fontSize14,
    color: colors.primary,
    fontWeight: typography.fontWeightSemiBold,
  },
  clubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    gap: spacing.md,
  },
  clubImageContainer: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.gray100,
  },
  clubImage: {
    width: '100%',
    height: '100%',
  },
  clubInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  clubName: {
    fontSize: typography.fontSize16,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.textPrimary,
  },
  clubType: {
    fontSize: typography.fontSize12,
    color: colors.textSecondary,
  },
  clubDescription: {
    fontSize: typography.fontSize12,
    color: colors.textSecondary,
    lineHeight: typography.lineHeight16,
  },
  studyGroupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    gap: spacing.md,
  },
  studyGroupIcon: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  studyGroupInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  studyGroupName: {
    fontSize: typography.fontSize16,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.textPrimary,
  },
  studyGroupType: {
    fontSize: typography.fontSize12,
    color: colors.textSecondary,
  },
  studyGroupMembers: {
    fontSize: typography.fontSize12,
    color: colors.primary,
    fontWeight: typography.fontWeightMedium,
  },
});
