import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { spacing, borderRadius, shadows, typography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useThemedColors } from '@/hooks/useThemedColors';
import { useThemedStyles } from '@/hooks/useThemedStyles';

interface StudyGroup {
  id: string;
  name: string;
  description: string;
  club_type: string;
  category: string;
  image_url: string;
  creator_id: string;
  created_at: string;
}

export default function StudyGroupDetailScreen() {
  const colors = useThemedColors();
  const { commonStyles, textStyles } = useThemedStyles();
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  const [studyGroup, setStudyGroup] = useState<StudyGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [joining, setJoining] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [isCreator, setIsCreator] = useState(false);

  useEffect(() => {
    fetchStudyGroupDetails();
    if (user) {
      checkMembership();
    }
  }, [id, user]);

  const fetchStudyGroupDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', id)
        .eq('is_official_club', false)
        .single();

      if (error) {
        // Handle case where group doesn't exist or was deleted
        if (error.code === 'PGRST116') {
          // No rows returned - group doesn't exist
          setStudyGroup(null);
          return;
        }
        throw error;
      }

      setStudyGroup(data);
      setIsCreator(user?.id === data.creator_id);

      // Get member count
      const { count } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', id);

      setMemberCount(count || 0);
    } catch (error) {
      console.error('Error fetching study group details:', error);
      setStudyGroup(null);
    } finally {
      setLoading(false);
    }
  };

  const checkMembership = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', id)
        .eq('user_id', user.id)
        .single();

      setIsMember(!!data);
    } catch (error) {
      setIsMember(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!user || !studyGroup) return;

    setJoining(true);
    try {
      if (isMember) {
        // Leave the group
        const { error } = await supabase
          .from('group_members')
          .delete()
          .eq('group_id', studyGroup.id)
          .eq('user_id', user.id);

        if (error) throw error;
        setIsMember(false);
        setMemberCount((prev) => Math.max(0, prev - 1));
      } else {
        // Join the group
        const { error } = await supabase
          .from('group_members')
          .insert({
            group_id: studyGroup.id,
            user_id: user.id,
            role: 'member',
          });

        if (error) throw error;
        setIsMember(true);
        setMemberCount((prev) => prev + 1);
      }
    } catch (error) {
      console.error('Error updating membership:', error);
    } finally {
      setJoining(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // If no navigation history, use the 'from' parameter to determine where to go
      const destination = from === 'home' ? '/(tabs)' : '/(tabs)/groups';
      router.replace(destination);
    }
  };

  const handleDeleteGroup = async () => {
    if (!user || !studyGroup || !isCreator) return;

    showAlert(
      'Delete Group',
      `Are you sure you want to delete "${studyGroup.name}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('groups')
                .delete()
                .eq('id', studyGroup.id)
                .eq('creator_id', user.id);

              if (error) throw error;

              showAlert('Success', 'Group deleted successfully', [
                {
                  text: 'OK',
                  onPress: () => router.replace('/(tabs)/groups'),
                },
              ]);
            } catch (error: any) {
              console.error('Error deleting group:', error);
              showAlert('Error', error.message || 'Failed to delete group');
            }
          },
        },
      ]
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
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray200,
    },
    headerButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: typography.fontSize18,
      fontWeight: typography.fontWeightBold,
      color: colors.textPrimary,
    },
    content: {
      flex: 1,
    },
    iconContainer: {
      width: '100%',
      height: 200,
      backgroundColor: colors.gray100,
      justifyContent: 'center',
      alignItems: 'center',
    },
    infoSection: {
      padding: spacing.lg,
    },
    groupName: {
      fontSize: typography.fontSize24,
      fontWeight: typography.fontWeightBold,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    tagContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    tag: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
    },
    categoryTag: {
      backgroundColor: colors.accent,
    },
    tagText: {
      fontSize: typography.fontSize12,
      color: colors.surface,
      fontWeight: typography.fontWeightSemiBold,
    },
    memberInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    memberCount: {
      fontSize: typography.fontSize14,
      color: colors.textSecondary,
    },
    creatorBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.lg,
    },
    creatorText: {
      fontSize: typography.fontSize14,
      color: colors.warning,
      fontWeight: typography.fontWeightSemiBold,
    },
    section: {
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      fontSize: typography.fontSize18,
      fontWeight: typography.fontWeightBold,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    description: {
      fontSize: typography.fontSize14,
      color: colors.textSecondary,
      lineHeight: typography.lineHeight24,
    },
    joinButton: {
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      marginTop: spacing.md,
    },
    leaveButton: {
      backgroundColor: colors.error,
    },
    buttonIcon: {
      marginRight: spacing.xs,
    },
    joinButtonText: {
      fontSize: typography.fontSize16,
      fontWeight: typography.fontWeightBold,
      color: colors.surface,
    },
    memberStatusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      marginTop: spacing.md,
    },
    memberStatusText: {
      fontSize: typography.fontSize14,
      color: colors.success,
      fontWeight: typography.fontWeightSemiBold,
    },
    errorText: {
      fontSize: typography.fontSize16,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
    },
    backButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
    },
    backButtonText: {
      fontSize: typography.fontSize14,
      fontWeight: typography.fontWeightBold,
      color: colors.surface,
    },
    deleteButton: {
      backgroundColor: colors.error,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      marginTop: spacing.lg,
    },
    deleteButtonText: {
      fontSize: typography.fontSize16,
      fontWeight: typography.fontWeightBold,
      color: colors.surface,
    },
  });

  if (loading) {
    return (
      <View style={[commonStyles.container, commonStyles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!studyGroup) {
    return (
      <View style={[commonStyles.container, commonStyles.centerContent]}>
        <Text style={styles.errorText}>Study group not found</Text>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Study Group</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Group Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="people" size={80} color={colors.primary} />
        </View>

        {/* Group Info */}
        <View style={styles.infoSection}>
          <Text style={styles.groupName}>{studyGroup.name}</Text>

          {(studyGroup.club_type || studyGroup.category) && (
            <View style={styles.tagContainer}>
              {studyGroup.club_type && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{studyGroup.club_type}</Text>
                </View>
              )}
              {studyGroup.category && (
                <View style={[styles.tag, styles.categoryTag]}>
                  <Text style={styles.tagText}>{studyGroup.category}</Text>
                </View>
              )}
            </View>
          )}

          {/* Member Count */}
          <View style={styles.memberInfo}>
            <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.memberCount}>
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </Text>
          </View>

          {isCreator && (
            <View style={styles.creatorBadge}>
              <Ionicons name="star" size={16} color={colors.warning} />
              <Text style={styles.creatorText}>You created this group</Text>
            </View>
          )}

          {/* Description */}
          {studyGroup.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.description}>{studyGroup.description}</Text>
            </View>
          )}

          {/* Join/Leave Button */}
          {user && !isCreator && (
            <TouchableOpacity
              style={[styles.joinButton, isMember && styles.leaveButton]}
              onPress={handleJoinGroup}
              disabled={joining}
            >
              {joining ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <>
                  <Ionicons
                    name={isMember ? 'checkmark-circle' : 'add-circle'}
                    size={20}
                    color={colors.surface}
                    style={styles.buttonIcon}
                  />
                  <Text style={styles.joinButtonText}>
                    {isMember ? 'Leave Group' : 'Join Group'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {isMember && (
            <View style={styles.memberStatusBadge}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.memberStatusText}>You are a member</Text>
            </View>
          )}

          {/* Delete Button for Creators */}
          {isCreator && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDeleteGroup}
            >
              <Ionicons name="trash-outline" size={20} color={colors.surface} style={styles.buttonIcon} />
              <Text style={styles.deleteButtonText}>Delete Group</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}