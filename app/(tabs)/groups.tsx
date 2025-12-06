import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { spacing, borderRadius, shadows, typography } from '@/constants/theme';
import { useThemedColors } from '@/hooks/useThemedColors';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useFocusEffect } from '@react-navigation/native';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    club_type: '',
    category: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const colors = useThemedColors();
  const { commonStyles, textStyles } = useThemedStyles();

  const insets = useSafeAreaInsets();

  // Helper function to check if image URL is valid
  const isValidImageUrl = (url: string | null | undefined): boolean => {
    if (!url) return false;
    // Check if URL starts with http/https and doesn't contain suspicious patterns
    return url.startsWith('http') && url.length > 10;
  };
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  // Define callback functions before useEffect
  const loadUWBClubs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, description, club_type, category, image_url, is_official_club')
        .eq('is_official_club', true)
        .order('name', { ascending: true });

      if (error) throw error;
      if (data) {
        // Clean up problematic data - filter out single characters and empty values
        const cleanedData = data.map(club => ({
          ...club,
          club_type: club.club_type && club.club_type.trim() && club.club_type.trim().length > 1 ? club.club_type : null,
          category: club.category && club.category.trim() && club.category.trim().length > 1 ? club.category : null,
        }));
        setUwbClubs(cleanedData);
      }
    } catch (error) {
      console.error('Error loading UWB clubs:', error);
    }
  }, [supabase]);

  const loadStudyGroups = useCallback(async () => {
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
              club_type: group.club_type && group.club_type.trim() && group.club_type.trim().length > 1 ? group.club_type : null,
              category: group.category && group.category.trim() && group.category.trim().length > 1 ? group.category : null,
              member_count: count || 0,
            };
          })
        );

        setStudyGroups(groupsWithCounts);
      }
    } catch (error) {
      console.error('Error loading study groups:', error);
    }
  }, [supabase]);

  const fetchUserGroups = useCallback(async () => {
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
  }, [user, supabase]);

  const fetchData = useCallback(async () => {
    await Promise.all([fetchUserGroups(), loadUWBClubs(), loadStudyGroups()]);
    setLoading(false);
    setRefreshing(false);
  }, [fetchUserGroups, loadUWBClubs, loadStudyGroups]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch data when tab comes into focus (handles groups created from other pages)
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

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

  const handleCreateGroup = async () => {
    if (!user) {
      showAlert('Error', 'You must be logged in to create groups');
      return;
    }

    if (!newGroup.name.trim()) {
      showAlert('Error', 'Please enter a group name');
      return;
    }

    setSubmitting(true);
    try {
      // Insert the new group and get the created group's ID
      const { data: createdGroup, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: newGroup.name,
          description: newGroup.description || null,
          club_type: newGroup.club_type || null,
          category: newGroup.category || null,
          creator_id: user.id,
          is_official_club: false,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Automatically add the creator as a member of the group
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: createdGroup.id,
          user_id: user.id,
          role: 'admin',
        });

      if (memberError) throw memberError;

      showAlert('Success', 'Group created successfully!');
      setShowCreateGroupModal(false);
      setNewGroup({ name: '', description: '', club_type: '', category: '' });
      loadStudyGroups();
    } catch (error: any) {
      console.error('Error creating group:', error);
      showAlert('Error', error.message || 'Failed to create group');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter clubs and study groups based on search query
  const filteredUwbClubs = uwbClubs.filter(club =>
    club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    club.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    club.club_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    club.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredStudyGroups = studyGroups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.club_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    headerTitle: {
      ...textStyles.h3,
    },
    headerSubtitle: {
      ...textStyles.body2,
      color: colors.textSecondary,
      marginTop: spacing.xs,
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
      width: 350,
      height: 175,
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
    defaultClubIcon: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.accent,
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
      backgroundColor: colors.primaryLight,
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
      color: colors.textSecondary,
      fontWeight: typography.fontWeightMedium,
    },
    searchContainer: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xl,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...shadows.small,
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: colors.gray200,
    },
    searchIcon: {
      marginRight: spacing.sm,
    },
    searchInput: {
      flex: 1,
      fontSize: typography.fontSize14,
      color: colors.textPrimary,
      paddingVertical: spacing.xs,
    },
    clearButton: {
      padding: spacing.xs,
    },
    fab: {
      position: 'absolute',
      bottom: spacing.xl,
      right: spacing.lg,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      ...shadows.medium,
    },
    modalContainer: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: borderRadius.lg,
      borderTopRightRadius: borderRadius.lg,
      maxHeight: '80%',
      ...shadows.large,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray200,
    },
    modalTitle: {
      ...textStyles.h2,
    },
    modalForm: {
      padding: spacing.lg,
    },
    inputLabel: {
      ...textStyles.body1,
      fontWeight: typography.fontWeightSemiBold,
      marginBottom: spacing.sm,
      marginTop: spacing.md,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: borderRadius.sm,
      padding: spacing.md,
      fontSize: typography.fontSize16,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.gray300,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    submitButton: {
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
    modalFooter: {
      padding: spacing.lg,
      borderTopWidth: 0,
    },
    submitButtonDisabled: {
      backgroundColor: colors.gray400,
      opacity: 0.5,
    },
    submitButtonText: {
      ...textStyles.body1,
      fontWeight: typography.fontWeightSemiBold,
      color: colors.white,
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Groups</Text>
            <Text style={styles.headerSubtitle}>Join clubs and study groups</Text>
          </View>
          <Image
            source={require('@/assets/images/Penguin2.png')}
            style={styles.penguinMascot}
            resizeMode="contain"
          />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search clubs and study groups..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Study Groups Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Study Groups</Text>
          {filteredStudyGroups.length > 5 && (
            <TouchableOpacity onPress={() => setShowAllStudyGroups(!showAllStudyGroups)}>
              <Text style={styles.toggleText}>
                {showAllStudyGroups ? 'Show Less' : `Show All (${filteredStudyGroups.length})`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.sectionContent}>
          {filteredStudyGroups.length === 0 ? (
            <Text style={styles.emptyText}>
              {searchQuery ? 'No study groups found' : 'No study groups available'}
            </Text>
          ) : (
            (showAllStudyGroups ? filteredStudyGroups : filteredStudyGroups.slice(0, 5)).map((group) => (
              <TouchableOpacity
                key={group.id}
                style={styles.studyGroupCard}
                onPress={() => openStudyGroupDetail(group.id)}
              >
                <View style={styles.studyGroupIcon}>
                  <Ionicons name="people" size={24} color={colors.white} />
                </View>
                <View style={styles.studyGroupInfo}>
                  <Text style={styles.studyGroupName} numberOfLines={1}>
                    {group.name}
                  </Text>
                  {(() => {
                    const validTypes = [group.club_type, group.category]
                      .filter(val => val && typeof val === 'string' && val.trim() && val.trim().length > 1 && val.trim() !== '.');
                    const joinedText = validTypes.join(' - ').trim();
                    return joinedText.length > 0 ? (
                      <Text style={styles.studyGroupType} numberOfLines={1}>
                        {joinedText}
                      </Text>
                    ) : null;
                  })()}
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
              {showAllClubs ? 'Show Less' : `Show All (${filteredUwbClubs.length})`}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.sectionContent}>
          {filteredUwbClubs.length === 0 ? (
            <Text style={styles.emptyText}>
              {searchQuery ? 'No clubs found' : 'No clubs available'}
            </Text>
          ) : (
            (showAllClubs ? filteredUwbClubs : filteredUwbClubs.slice(0, 5)).map((club) => (
              <TouchableOpacity
                key={club.id}
                style={styles.clubCard}
                onPress={() => openClubDetail(club.id)}
              >
                <View style={styles.clubImageContainer}>
                  {isValidImageUrl(club.image_url) && !failedImages.has(club.id) ? (
                    <Image
                      source={{ uri: club.image_url }}
                      style={styles.clubImage}
                      resizeMode="cover"
                      onError={() => {
                        console.log('Image failed to load for club:', club.name);
                        setFailedImages(prev => new Set(prev).add(club.id));
                      }}
                    />
                  ) : (
                    <View style={styles.defaultClubIcon}>
                      <Ionicons name="school" size={32} color={colors.white} />
                    </View>
                  )}
                </View>
                <View style={styles.clubInfo}>
                  <Text style={styles.clubName} numberOfLines={1}>
                    {club.name}
                  </Text>
                  {(() => {
                    const validTypes = [club.club_type, club.category]
                      .filter(val => val && typeof val === 'string' && val.trim() && val.trim().length > 1 && val.trim() !== '.');
                    const joinedText = validTypes.join(' - ').trim();
                    return joinedText.length > 0 ? (
                      <Text style={styles.clubType} numberOfLines={1}>
                        {joinedText}
                      </Text>
                    ) : null;
                  })()}
                  {club.description && club.description.trim() && club.description.trim().length > 1 && (
                    <Text style={styles.clubDescription} numberOfLines={2}>
                      {club.description.trim()}
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
          source={require('@/assets/images/SyncUp_Logo3.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
    </ScrollView>

    {/* Floating Action Button for Creating Study Groups */}
    <TouchableOpacity
      style={styles.fab}
      onPress={() => setShowCreateGroupModal(true)}
    >
      <Ionicons name="add" size={28} color={colors.white} />
    </TouchableOpacity>

    {/* Create Group Modal */}
    <Modal
      visible={showCreateGroupModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowCreateGroupModal(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Study Group</Text>
            <TouchableOpacity onPress={() => setShowCreateGroupModal(false)}>
              <Ionicons name="close" size={28} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalForm}
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.inputLabel}>Group Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter group name"
              placeholderTextColor={colors.textSecondary}
              value={newGroup.name}
              onChangeText={(text) => setNewGroup({ ...newGroup, name: text })}
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter group description"
              placeholderTextColor={colors.textSecondary}
              value={newGroup.description}
              onChangeText={(text) => setNewGroup({ ...newGroup, description: text })}
              multiline
              numberOfLines={4}
            />

            <Text style={styles.inputLabel}>Club Type</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Academic, Social, Sports"
              placeholderTextColor={colors.textSecondary}
              value={newGroup.club_type}
              onChangeText={(text) => setNewGroup({ ...newGroup, club_type: text })}
            />

            <Text style={styles.inputLabel}>Category</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Computer Science, Business"
              placeholderTextColor={colors.textSecondary}
              value={newGroup.category}
              onChangeText={(text) => setNewGroup({ ...newGroup, category: text })}
            />
          </ScrollView>

          <TouchableOpacity
            style={[styles.submitButton, (!newGroup.name.trim() || submitting) && styles.submitButtonDisabled]}
            onPress={handleCreateGroup}
            disabled={!newGroup.name.trim() || submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.submitButtonText}>Create Group</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </View>
  );
}
