import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { spacing, borderRadius, shadows, typography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useThemedColors } from '@/hooks/useThemedColors';
import { useThemedStyles } from '@/hooks/useThemedStyles';

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

interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author: {
    id: string;
    name: string;
    avatar: string | null;
  };
}

export default function GroupPostDetailScreen() {
  const colors = useThemedColors();
  const { commonStyles, textStyles } = useThemedStyles();
  const { id, groupId } = useLocalSearchParams<{ id: string; groupId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  const [post, setPost] = useState<GroupPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isGroupCreator, setIsGroupCreator] = useState(false);
  const [isPostAuthor, setIsPostAuthor] = useState(false);
  const [postDeleted, setPostDeleted] = useState(false);

  useEffect(() => {
    fetchPostDetails();
    fetchComments();
    checkPermissions();
  }, [id]);

  const checkPermissions = async () => {
    if (!user || !groupId) return;

    try {
      // Check if user is the group creator
      const { data: groupData } = await supabase
        .from('groups')
        .select('creator_id')
        .eq('id', groupId)
        .single();

      if (groupData) {
        setIsGroupCreator(groupData.creator_id === user.id);
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  };

  // Real-time subscriptions
  useEffect(() => {
    if (!user) return;

    // Subscribe to post deletion
    const postChannel = supabase
      .channel('group-post-deletion')
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'group_posts' },
        (payload) => {
          const deletedPostId = (payload.old as any).id;
          // If this post was deleted, mark it as deleted and show alert
          if (deletedPostId === id) {
            setPostDeleted(true);
            showAlert('Post Deleted', 'This post has been deleted.', [
              {
                text: 'OK',
                onPress: () => router.back(),
              },
            ]);
          }
        }
      )
      .subscribe();

    // Subscribe to comments changes
    const commentsChannel = supabase
      .channel('group-post-detail-comments')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_post_comments', filter: `post_id=eq.${id}` },
        (payload) => {
          // Refetch comments to get the new comment with author info
          fetchComments();
          // Update comment count in post
          setPost(prev => prev ? { ...prev, comments: prev.comments + 1 } : null);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'group_post_comments' },
        (payload) => {
          const deletedCommentId = (payload.old as any).id;
          // Remove deleted comment from state
          setComments(prev => prev.filter(c => c.id !== deletedCommentId));
          // Update comment count in post
          setPost(prev => prev ? { ...prev, comments: Math.max(0, prev.comments - 1) } : null);
        }
      )
      .subscribe();

    // Subscribe to likes changes
    const likesChannel = supabase
      .channel('group-post-detail-likes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_post_likes', filter: `post_id=eq.${id}` },
        (payload) => {
          const userId = (payload.new as any).user_id;
          setPost(prev => prev ? {
            ...prev,
            likes: prev.likes + 1,
            isLiked: userId === user.id ? true : prev.isLiked
          } : null);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'group_post_likes' },
        (payload) => {
          const userId = (payload.old as any).user_id;
          setPost(prev => prev ? {
            ...prev,
            likes: Math.max(0, prev.likes - 1),
            isLiked: userId === user.id ? false : prev.isLiked
          } : null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(postChannel);
      supabase.removeChannel(commentsChannel);
      supabase.removeChannel(likesChannel);
    };
  }, [user, id]);

  const fetchPostDetails = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch post with author info
      const { data: postData, error: postError } = await supabase
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
        .eq('id', id)
        .single();

      if (postError) throw postError;

      // Get likes count
      const { count: likesCount } = await supabase
        .from('group_post_likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', id);

      // Check if current user liked this post
      const { data: userLike } = await supabase
        .from('group_post_likes')
        .select('id')
        .eq('post_id', id)
        .eq('user_id', user.id)
        .maybeSingle();

      // Get comments count
      const { count: commentsCount } = await supabase
        .from('group_post_comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', id);

      setPost({
        id: postData.id,
        group_id: postData.group_id,
        author_id: postData.author_id,
        title: postData.title,
        content: postData.content,
        created_at: postData.created_at,
        author: {
          id: postData.author.id,
          name: postData.author.full_name,
          avatar: postData.author.profile_image_url,
        },
        likes: likesCount || 0,
        comments: commentsCount || 0,
        isLiked: !!userLike,
      });

      // Check if current user is the post author
      setIsPostAuthor(postData.author_id === user.id);
    } catch (error) {
      console.error('Error fetching post:', error);
      showAlert('Error', 'Failed to load post');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const { data: commentsData, error } = await supabase
        .from('group_post_comments')
        .select(`
          id,
          post_id,
          author_id,
          content,
          created_at,
          author:user_profiles!group_post_comments_author_id_fkey(
            id,
            full_name,
            profile_image_url
          )
        `)
        .eq('post_id', id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setComments(
        commentsData.map((comment: any) => ({
          id: comment.id,
          post_id: comment.post_id,
          author_id: comment.author_id,
          content: comment.content,
          created_at: comment.created_at,
          author: {
            id: comment.author.id,
            name: comment.author.full_name,
            avatar: comment.author.profile_image_url,
          },
        }))
      );
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleToggleLike = async () => {
    if (!user || !post || postDeleted) return;

    try {
      // First check if the post still exists
      const { data: postExists, error: postCheckError } = await supabase
        .from('group_posts')
        .select('id')
        .eq('id', post.id)
        .maybeSingle();

      if (postCheckError) throw postCheckError;

      if (!postExists) {
        // Post was deleted
        setPostDeleted(true);
        showAlert('Post Deleted', 'This post has been deleted.', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
        return;
      }

      // First check current database state to avoid conflicts
      const { data: existingLike, error: checkError } = await supabase
        .from('group_post_likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingLike) {
        // Like exists, so delete it
        const { error } = await supabase
          .from('group_post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);

        if (error) throw error;
        // Real-time subscription will update the state
      } else {
        // Like doesn't exist, so insert it
        const { error } = await supabase
          .from('group_post_likes')
          .insert({
            post_id: post.id,
            user_id: user.id,
          });

        if (error) throw error;
        // Real-time subscription will update the state
      }
    } catch (error: any) {
      console.error('Error toggling like:', error);
      // Check if it's a foreign key constraint error (post was deleted)
      if (error.code === '23503' || error.message?.includes('violates foreign key constraint') || error.message?.includes('violates row-level security policy')) {
        setPostDeleted(true);
        showAlert('Post Deleted', 'This post has been deleted.', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
      } else {
        showAlert('Error', error.message || 'Failed to update like');
      }
    }
  };

  const handleAddComment = async () => {
    if (!user || !newComment.trim() || postDeleted) return;

    setSubmitting(true);
    try {
      // First check if the post still exists
      const { data: postExists, error: postCheckError } = await supabase
        .from('group_posts')
        .select('id')
        .eq('id', id)
        .maybeSingle();

      if (postCheckError) throw postCheckError;

      if (!postExists) {
        // Post was deleted
        setPostDeleted(true);
        showAlert('Post Deleted', 'This post has been deleted.', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
        return;
      }

      const { error } = await supabase
        .from('group_post_comments')
        .insert({
          post_id: id,
          author_id: user.id,
          content: newComment.trim(),
        });

      if (error) throw error;

      setNewComment('');
      // Real-time subscription will update the comments and count
    } catch (error: any) {
      console.error('Error adding comment:', error);
      // Check if it's a foreign key constraint error (post was deleted)
      if (error.code === '23503' || error.message?.includes('violates foreign key constraint') || error.message?.includes('violates row-level security policy')) {
        setPostDeleted(true);
        showAlert('Post Deleted', 'This post has been deleted.', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
      } else {
        showAlert('Error', error.message || 'Failed to add comment');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = async () => {
    if (!user || !post) return;

    showAlert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
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
                .from('group_posts')
                .delete()
                .eq('id', post.id);

              if (error) throw error;

              showAlert('Success', 'Post deleted successfully', [
                {
                  text: 'OK',
                  onPress: () => router.back(),
                },
              ]);
            } catch (error: any) {
              console.error('Error deleting post:', error);
              showAlert('Error', error.message || 'Failed to delete post');
            }
          },
        },
      ]
    );
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;

    showAlert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
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
                .from('group_post_comments')
                .delete()
                .eq('id', commentId);

              if (error) throw error;

              // Real-time subscription will update the UI
            } catch (error: any) {
              console.error('Error deleting comment:', error);
              showAlert('Error', error.message || 'Failed to delete comment');
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
    postSection: {
      backgroundColor: colors.surface,
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray200,
    },
    postHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    authorName: {
      fontSize: typography.fontSize16,
      fontWeight: typography.fontWeightSemiBold,
      color: colors.textPrimary,
    },
    postTime: {
      fontSize: typography.fontSize12,
      color: colors.textSecondary,
    },
    postTitle: {
      fontSize: typography.fontSize20,
      fontWeight: typography.fontWeightBold,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    postContent: {
      fontSize: typography.fontSize14,
      color: colors.textSecondary,
      lineHeight: typography.lineHeight24,
      marginBottom: spacing.md,
    },
    postActions: {
      flexDirection: 'row',
      gap: spacing.lg,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.gray200,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
    },
    actionText: {
      fontSize: typography.fontSize14,
      color: colors.textSecondary,
    },
    commentsSection: {
      padding: spacing.lg,
    },
    sectionTitle: {
      fontSize: typography.fontSize18,
      fontWeight: typography.fontWeightBold,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    emptyComments: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    emptyCommentsText: {
      fontSize: typography.fontSize14,
      color: colors.textSecondary,
      marginTop: spacing.sm,
    },
    commentCard: {
      marginBottom: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.background,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.gray200,
    },
    commentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    commentAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    commentAuthorName: {
      fontSize: typography.fontSize14,
      fontWeight: typography.fontWeightSemiBold,
      color: colors.textPrimary,
    },
    commentTime: {
      fontSize: typography.fontSize12,
      color: colors.textSecondary,
    },
    commentContent: {
      fontSize: typography.fontSize14,
      color: colors.textPrimary,
      lineHeight: typography.lineHeight20,
    },
    deleteCommentButton: {
      padding: spacing.xs,
      marginLeft: spacing.sm,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.gray200,
    },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: 100,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: typography.fontSize14,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.gray200,
      color: colors.textPrimary,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: colors.gray400,
      opacity: 0.5,
    },
  });

  if (loading) {
    return (
      <View style={[commonStyles.container, commonStyles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[commonStyles.container, commonStyles.centerContent]}>
        <Text style={{ color: colors.textSecondary }}>Post not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Discussion</Text>
        {(isPostAuthor || isGroupCreator) ? (
          <TouchableOpacity onPress={handleDeletePost} style={styles.headerButton}>
            <Ionicons name="trash-outline" size={24} color={colors.error} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerButton} />
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Post Section */}
          <View style={styles.postSection}>
            <View style={styles.postHeader}>
              {post.author.avatar ? (
                <Image source={{ uri: post.author.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.gray200 }]}>
                  <Ionicons name="person" size={20} color={colors.gray400} />
                </View>
              )}
              <View>
                <Text style={styles.authorName}>{post.author.name}</Text>
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

            <Text style={styles.postTitle}>{post.title}</Text>
            {post.content && <Text style={styles.postContent}>{post.content}</Text>}

            <View style={styles.postActions}>
              <TouchableOpacity style={styles.actionButton} onPress={handleToggleLike}>
                <Ionicons
                  name={post.isLiked ? 'heart' : 'heart-outline'}
                  size={24}
                  color={post.isLiked ? colors.error : colors.textSecondary}
                />
                <Text style={[styles.actionText, post.isLiked && { color: colors.error }]}>
                  {post.likes}
                </Text>
              </TouchableOpacity>

              <View style={styles.actionButton}>
                <Ionicons name="chatbubble-outline" size={24} color={colors.textSecondary} />
                <Text style={styles.actionText}>{post.comments}</Text>
              </View>
            </View>
          </View>

          {/* Comments Section */}
          <View style={styles.commentsSection}>
            <Text style={styles.sectionTitle}>
              Comments ({comments.length})
            </Text>

            {comments.length === 0 ? (
              <View style={styles.emptyComments}>
                <Ionicons name="chatbubbles-outline" size={48} color={colors.gray400} />
                <Text style={styles.emptyCommentsText}>No comments yet. Be the first!</Text>
              </View>
            ) : (
              comments.map((comment) => (
                <View key={comment.id} style={styles.commentCard}>
                  <View style={styles.commentHeader}>
                    {comment.author.avatar ? (
                      <Image source={{ uri: comment.author.avatar }} style={styles.commentAvatar} />
                    ) : (
                      <View style={[styles.commentAvatar, { backgroundColor: colors.gray200 }]}>
                        <Ionicons name="person" size={16} color={colors.gray400} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.commentAuthorName}>{comment.author.name}</Text>
                      <Text style={styles.commentTime}>
                        {new Date(comment.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    {(comment.author_id === user?.id || isGroupCreator) && (
                      <TouchableOpacity
                        onPress={() => handleDeleteComment(comment.id)}
                        style={styles.deleteCommentButton}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.commentContent}>{comment.content}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        {/* Comment Input */}
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom || spacing.md }]}>
          <TextInput
            style={styles.input}
            placeholder="Write a comment..."
            placeholderTextColor={colors.textSecondary}
            value={newComment}
            onChangeText={setNewComment}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!newComment.trim() || submitting) && styles.sendButtonDisabled]}
            onPress={handleAddComment}
            disabled={!newComment.trim() || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="send" size={20} color={colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
