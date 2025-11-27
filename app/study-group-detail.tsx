import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { spacing, borderRadius, shadows, typography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useThemedColors } from '@/hooks/useThemedColors';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useFocusEffect } from '@react-navigation/native';

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

interface GroupPost {
  id: string;
  group_id: string;
  author_id: string;
  title: string;
  content: string | null;
  created_at: string;
  author: {
    id: string;
    name: string;
    avatar: string | null;
  };
  likes: number;
  comments: number;
  isLiked?: boolean;
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
  const [groupDeleted, setGroupDeleted] = useState(false);

  // Posts state
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [showAddPostModal, setShowAddPostModal] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '' });
  const [submitting, setSubmitting] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);

  useEffect(() => {
    fetchStudyGroupDetails();
    if (user) {
      checkMembership();
    }
  }, [id, user]);

  // Refresh posts when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user && isMember) {
        fetchPosts();
      }
    }, [user, isMember])
  );

  // Real-time subscription for group deletion
  useEffect(() => {
    if (!user) return;

    const groupChannel = supabase
      .channel('group-deletion')
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'groups' },
        (payload) => {
          const deletedGroupId = (payload.old as any).id;
          // If this group was deleted, mark it as deleted and show alert
          if (deletedGroupId === id) {
            setGroupDeleted(true);
            const destination = from === 'home' ? '/(tabs)' : '/(tabs)/groups';
            showAlert('Group Deleted', 'This group has been deleted.', [
              {
                text: 'OK',
                onPress: () => router.replace(destination),
              },
            ]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(groupChannel);
    };
  }, [user, id]);

  // Real-time subscriptions for posts
  useEffect(() => {
    if (!user || !isMember) return;

    // Subscribe to new posts
    const postsChannel = supabase
      .channel('group-posts-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_posts', filter: `group_id=eq.${id}` },
        (payload) => {
          // When a new post is created, refetch posts
          fetchPosts();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'group_posts' },
        (payload) => {
          // Remove the deleted post from state
          setPosts(prev => prev.filter(p => p.id !== payload.old.id));
        }
      )
      .subscribe();

    // Subscribe to comments changes
    const commentsChannel = supabase
      .channel('group-post-comments-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_post_comments' },
        (payload) => {
          // Update comment count for the affected post
          const postId = (payload.new as any).post_id;
          if (!postId) return;

          setPosts(prev => prev.map(post =>
            post.id === postId
              ? { ...post, comments: post.comments + 1 }
              : post
          ));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'group_post_comments' },
        (payload) => {
          // Since payload.old doesn't contain post_id, just refetch all posts
          // This ensures comment counts are accurate
          fetchPosts();
        }
      )
      .subscribe();

    // Subscribe to likes changes
    const likesChannel = supabase
      .channel('group-post-likes-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_post_likes' },
        async (payload) => {
          const postId = (payload.new as any).post_id;
          const userId = (payload.new as any).user_id;
          if (!postId) return;

          // Fetch accurate like count and status from database
          const { count: likesCount } = await supabase
            .from('group_post_likes')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', postId);

          const { data: userLike } = await supabase
            .from('group_post_likes')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', user.id)
            .maybeSingle();

          // Update the post if it exists in current state
          setPosts(prev => prev.map(post =>
            post.id === postId
              ? {
                  ...post,
                  likes: likesCount || 0,
                  isLiked: !!userLike
                }
              : post
          ));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'group_post_likes' },
        (payload) => {
          // REPLICA IDENTITY FULL doesn't work reliably - payload.old only contains id
          // So we refetch all posts to get accurate counts
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(commentsChannel);
      supabase.removeChannel(likesChannel);
    };
  }, [user, isMember, id]);

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
        .maybeSingle();

      setIsMember(!!data);

      // Fetch posts if user is a member
      if (data) {
        fetchPosts();
      }
    } catch (error) {
      setIsMember(false);
    }
  };

  const fetchPosts = async () => {
    if (!user) return;

    try {
      setPostsLoading(true);

      // Fetch posts with author info
      const { data: postsData, error: postsError } = await supabase
        .from('group_posts')
        .select(`
          id,
          group_id,
          author_id,
          title,
          content,
          created_at,
          author:user_profiles!group_posts_author_id_fkey(
            id,
            full_name,
            profile_image_url
          )
        `)
        .eq('group_id', id)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      // Fetch likes count and user's like status for each post
      const postsWithStats = await Promise.all(
        (postsData || []).map(async (post: any) => {
          // Get likes count
          const { count: likesCount } = await supabase
            .from('group_post_likes')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);

          // Check if current user liked this post
          const { data: userLike } = await supabase
            .from('group_post_likes')
            .select('id')
            .eq('post_id', post.id)
            .eq('user_id', user.id)
            .maybeSingle();

          // Get comments count
          const { count: commentsCount } = await supabase
            .from('group_post_comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);

          return {
            id: post.id,
            group_id: post.group_id,
            author_id: post.author_id,
            title: post.title,
            content: post.content,
            created_at: post.created_at,
            author: {
              id: post.author.id,
              name: post.author.full_name,
              avatar: post.author.profile_image_url,
            },
            likes: likesCount || 0,
            comments: commentsCount || 0,
            isLiked: !!userLike,
          };
        })
      );

      setPosts(postsWithStats);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setPostsLoading(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!user || !studyGroup) return;

    setJoining(true);
    try {
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
    } catch (error) {
      console.error('Error joining group:', error);
    } finally {
      setJoining(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!user || !studyGroup) return;

    showAlert(
      'Leave Group',
      `Are you sure you want to leave "${studyGroup.name}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('group_members')
                .delete()
                .eq('group_id', studyGroup.id)
                .eq('user_id', user.id);

              if (error) throw error;
              setIsMember(false);
              setMemberCount((prev) => Math.max(0, prev - 1));
              setShowMenuModal(false);
            } catch (error: any) {
              console.error('Error leaving group:', error);
              showAlert('Error', error.message || 'Failed to leave group');
            }
          },
        },
      ]
    );
  };

  const handleCreatePost = async () => {
    if (!user || !studyGroup || !newPost.title.trim() || groupDeleted) {
      if (groupDeleted) {
        showAlert('Error', 'This group has been deleted');
      } else {
        showAlert('Error', 'Please enter a title for your post');
      }
      return;
    }

    setSubmitting(true);
    try {
      // First check if the group still exists
      const { data: groupExists, error: groupCheckError } = await supabase
        .from('groups')
        .select('id')
        .eq('id', studyGroup.id)
        .maybeSingle();

      if (groupCheckError) throw groupCheckError;

      if (!groupExists) {
        // Group was deleted
        setGroupDeleted(true);
        setShowAddPostModal(false);
        showAlert('Group Deleted', 'This group has been deleted.', [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)/groups'),
          },
        ]);
        return;
      }

      const { error } = await supabase
        .from('group_posts')
        .insert({
          group_id: studyGroup.id,
          author_id: user.id,
          title: newPost.title.trim(),
          content: newPost.content.trim() || null,
        });

      if (error) throw error;

      showAlert('Success', 'Post created successfully');
      setShowAddPostModal(false);
      setNewPost({ title: '', content: '' });
      fetchPosts(); // Refresh posts
    } catch (error: any) {
      console.error('Error creating post:', error);
      // Check if it's a foreign key constraint error (group was deleted)
      if (error.code === '23503' || error.message?.includes('violates foreign key constraint') || error.message?.includes('violates row-level security policy')) {
        setGroupDeleted(true);
        setShowAddPostModal(false);
        showAlert('Group Deleted', 'This group has been deleted.', [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)/groups'),
          },
        ]);
      } else {
        showAlert('Error', error.message || 'Failed to create post');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLike = async (postId: string) => {
    if (!user || groupDeleted) return;

    try {
      // First check current database state to avoid conflicts
      const { data: existingLike, error: checkError } = await supabase
        .from('group_post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingLike) {
        // Like exists, so delete it
        const { error } = await supabase
          .from('group_post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (error) throw error;
        // Real-time subscription will update the state
      } else {
        // Like doesn't exist, so insert it
        const { error } = await supabase
          .from('group_post_likes')
          .insert({
            post_id: postId,
            user_id: user.id,
          });

        if (error) throw error;
        // Real-time subscription will update the state
      }
    } catch (error: any) {
      console.error('Error toggling like:', error);
      showAlert('Error', error.message || 'Failed to update like');
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

    setShowMenuModal(false);

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

              const destination = from === 'home' ? '/(tabs)' : '/(tabs)/groups';
              showAlert('Success', 'Group deleted successfully', [
                {
                  text: 'OK',
                  onPress: () => router.replace(destination),
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
      color: colors.white,  // Always use white for better contrast on colored backgrounds
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
    buttonIcon: {
      marginRight: spacing.xs,
    },
    joinButtonText: {
      fontSize: typography.fontSize16,
      fontWeight: typography.fontWeightBold,
      color: colors.white,  // Always use white for better contrast on colored buttons
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
    menuModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
      paddingTop: insets.top + 50, // Position below header
      paddingRight: spacing.md,
    },
    menuModalContent: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      ...shadows.medium,
      minWidth: 180,
      overflow: 'hidden',
    },
    menuOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    menuOptionText: {
      fontSize: typography.fontSize16,
      fontWeight: typography.fontWeightSemiBold,
    },
    postsSection: {
      marginTop: spacing.lg,
    },
    emptyPosts: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    emptyPostsText: {
      fontSize: typography.fontSize16,
      color: colors.textSecondary,
      marginTop: spacing.sm,
      fontWeight: typography.fontWeightSemiBold,
    },
    emptyPostsSubtext: {
      fontSize: typography.fontSize14,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    postCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginTop: spacing.md,
      ...shadows.small,
    },
    postHeader: {
      marginBottom: spacing.sm,
    },
    postAuthorInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    postAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    postAuthorName: {
      fontSize: typography.fontSize14,
      fontWeight: typography.fontWeightSemiBold,
      color: colors.textPrimary,
    },
    postTime: {
      fontSize: typography.fontSize12,
      color: colors.textSecondary,
    },
    postTitle: {
      fontSize: typography.fontSize16,
      fontWeight: typography.fontWeightBold,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    postContent: {
      fontSize: typography.fontSize14,
      color: colors.textSecondary,
      lineHeight: typography.lineHeight20,
      marginBottom: spacing.sm,
    },
    postActions: {
      flexDirection: 'row',
      gap: spacing.lg,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.gray200,
    },
    postActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    postActionText: {
      fontSize: typography.fontSize14,
      color: colors.textSecondary,
    },
    fab: {
      position: 'absolute',
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
      backgroundColor: colors.background,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      padding: spacing.lg,
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    modalTitle: {
      fontSize: typography.fontSize20,
      fontWeight: typography.fontWeightBold,
      color: colors.textPrimary,
    },
    titleInput: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      fontSize: typography.fontSize16,
      color: colors.textPrimary,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.gray200,
    },
    contentInput: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      fontSize: typography.fontSize14,
      color: colors.textPrimary,
      marginBottom: spacing.lg,
      minHeight: 120,
      borderWidth: 1,
      borderColor: colors.gray200,
    },
    submitButton: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitButtonText: {
      fontSize: typography.fontSize16,
      fontWeight: typography.fontWeightBold,
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
        {(isMember || isCreator) ? (
          <TouchableOpacity onPress={() => setShowMenuModal(true)} style={styles.headerButton}>
            <Ionicons name="ellipsis-vertical" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerButton} />
        )}
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

          {/* Join Button - Only for non-members */}
          {user && !isMember && !isCreator && (
            <TouchableOpacity
              style={styles.joinButton}
              onPress={handleJoinGroup}
              disabled={joining}
            >
              {joining ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons
                    name="add-circle"
                    size={20}
                    color={colors.white}
                    style={styles.buttonIcon}
                  />
                  <Text style={styles.joinButtonText}>Join Group</Text>
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

          {/* Posts Section - Only visible to members */}
          {isMember && (
            <View style={styles.postsSection}>
              <Text style={styles.sectionTitle}>Discussions</Text>

              {postsLoading ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.md }} />
              ) : posts.length === 0 ? (
                <View style={styles.emptyPosts}>
                  <Ionicons name="chatbubbles-outline" size={48} color={colors.gray400} />
                  <Text style={styles.emptyPostsText}>No discussions yet</Text>
                  <Text style={styles.emptyPostsSubtext}>Be the first to start a discussion!</Text>
                </View>
              ) : (
                posts.map((post) => (
                  <TouchableOpacity
                    key={post.id}
                    style={styles.postCard}
                    onPress={() => router.push(`/group-post-detail?id=${post.id}&groupId=${id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.postHeader}>
                      <View style={styles.postAuthorInfo}>
                        {post.author.avatar ? (
                          <Image source={{ uri: post.author.avatar }} style={styles.postAvatar} />
                        ) : (
                          <View style={[styles.postAvatar, { backgroundColor: colors.gray200 }]}>
                            <Ionicons name="person" size={16} color={colors.gray400} />
                          </View>
                        )}
                        <View>
                          <Text style={styles.postAuthorName}>{post.author.name}</Text>
                          <Text style={styles.postTime}>
                            {new Date(post.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Text style={styles.postTitle}>{post.title}</Text>
                    {post.content ? (
                      <Text style={styles.postContent} numberOfLines={3}>
                        {post.content}
                      </Text>
                    ) : null}

                    <View style={styles.postActions}>
                      <TouchableOpacity
                        style={styles.postActionButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleToggleLike(post.id);
                        }}
                      >
                        <Ionicons
                          name={post.isLiked ? 'heart' : 'heart-outline'}
                          size={20}
                          color={post.isLiked ? colors.error : colors.textSecondary}
                        />
                        <Text style={[styles.postActionText, post.isLiked && { color: colors.error }]}>
                          {post.likes}
                        </Text>
                      </TouchableOpacity>

                      <View style={styles.postActionButton}>
                        <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
                        <Text style={styles.postActionText}>{post.comments}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button for Adding Posts */}
      {isMember && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + spacing.lg }]}
          onPress={() => setShowAddPostModal(true)}
        >
          <Ionicons name="add" size={28} color={colors.white} />
        </TouchableOpacity>
      )}

      {/* Add Post Modal */}
      <Modal
        visible={showAddPostModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddPostModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Discussion</Text>
              <TouchableOpacity onPress={() => setShowAddPostModal(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.titleInput}
              placeholder="Title"
              placeholderTextColor={colors.textSecondary}
              value={newPost.title}
              onChangeText={(text) => setNewPost((prev) => ({ ...prev, title: text }))}
              maxLength={100}
            />

            <TextInput
              style={styles.contentInput}
              placeholder="What's on your mind? (optional)"
              placeholderTextColor={colors.textSecondary}
              value={newPost.content}
              onChangeText={(text) => setNewPost((prev) => ({ ...prev, content: text }))}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitButton, (!newPost.title.trim() || submitting) && styles.submitButtonDisabled]}
              onPress={handleCreatePost}
              disabled={!newPost.title.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.submitButtonText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Menu Modal */}
      <Modal
        visible={showMenuModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowMenuModal(false)}
      >
        <TouchableOpacity
          style={styles.menuModalOverlay}
          activeOpacity={1}
          onPress={() => setShowMenuModal(false)}
        >
          <View style={styles.menuModalContent}>
            {isCreator ? (
              <TouchableOpacity
                style={styles.menuOption}
                onPress={handleDeleteGroup}
              >
                <Ionicons name="trash-outline" size={24} color={colors.error} />
                <Text style={[styles.menuOptionText, { color: colors.error }]}>Delete Group</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.menuOption}
                onPress={handleLeaveGroup}
              >
                <Ionicons name="exit-outline" size={24} color={colors.error} />
                <Text style={[styles.menuOptionText, { color: colors.error }]}>Leave Group</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}