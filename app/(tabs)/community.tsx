import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  FlatList,
  Modal,
  Image
} from 'react-native';
import { spacing, borderRadius, shadows, typography } from '@/constants/theme';
import { useThemedColors } from '@/hooks/useThemedColors';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';

interface ForumPost {
  id: string;
  title: string;
  content?: string;
  author: {
    id: string;
    name: string;
    avatar?: string | null;
  };
  tags: string[];
  created_at: string;
  likes: number;
  comments: number;
}

interface Comment {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar?: string | null;
  };
  created_at: string;
}

type FilterType = 'all' | 'courses' | 'study-tips' | 'professors';

export default function CommunityScreen() {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  // New post form state
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    category: 'courses' as FilterType,
  });

  const colors = useThemedColors();
  const { commonStyles, textStyles } = useThemedStyles();

  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  // Styles defined inside component to use themed colors
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray200,
    },
    headerTitle: {
      ...textStyles.h2,
    },
    searchContainer: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.gray100,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    searchInput: {
      flex: 1,
      ...textStyles.body1,
      color: colors.text,
      padding: 0,
    },
    clearButton: {
      padding: spacing.xs,
    },
    filterContainer: {
      backgroundColor: colors.surface,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray200,
    },
    filterContent: {
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
    },
    filterButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: colors.gray100,
      marginRight: spacing.sm,
    },
    filterButtonActive: {
      backgroundColor: colors.primary,
    },
    filterButtonText: {
      ...textStyles.body2,
      fontWeight: typography.fontWeightSemiBold,
      color: colors.textPrimary,
    },
    filterButtonTextActive: {
      color: colors.white,
    },
    listContent: {
      padding: spacing.md,
    },
    postCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      ...shadows.small,
    },
    postContent: {
      gap: spacing.sm,
    },
    postTitle: {
      ...textStyles.body1,
      fontWeight: typography.fontWeightSemiBold,
      color: colors.text,
      lineHeight: 22,
    },
    postTags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    tag: {
      backgroundColor: colors.gray100,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.xs,
    },
    tagText: {
      ...textStyles.caption,
      color: colors.textSecondary,
      fontSize: 11,
    },
    postFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    authorInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    avatar: {
      width: 24,
      height: 24,
      borderRadius: borderRadius.full,
      backgroundColor: colors.gray200,
      justifyContent: 'center',
      alignItems: 'center',
    },
    authorName: {
      ...textStyles.caption,
      color: colors.textSecondary,
      fontSize: 12,
    },
    postMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    metaText: {
      ...textStyles.caption,
      color: colors.gray500,
      fontSize: 11,
    },
    timeText: {
      ...textStyles.caption,
      color: colors.gray500,
      fontSize: 11,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxxl,
    },
    emptyStateText: {
      ...textStyles.body1,
      fontWeight: typography.fontWeightSemiBold,
      marginTop: spacing.md,
      color: colors.textSecondary,
    },
    emptyStateSubtext: {
      ...textStyles.caption,
      color: colors.gray500,
      textAlign: 'center',
      marginTop: spacing.xs,
      paddingHorizontal: spacing.xl,
    },
    clearSearchButton: {
      marginTop: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
    },
    clearSearchButtonText: {
      ...textStyles.body2,
      color: colors.white,
      fontWeight: typography.fontWeightSemiBold,
    },
    fab: {
      position: 'absolute',
      right: spacing.lg,
      width: 56,
      height: 56,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      ...shadows.large,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: borderRadius.lg,
      borderTopRightRadius: borderRadius.lg,
      maxHeight: '85%',
      ...shadows.large,
      flexDirection: 'column',
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
    modalHeaderActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    deleteButton: {
      padding: spacing.xs,
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
      borderWidth: 1,
      borderColor: colors.gray300,
      borderRadius: borderRadius.sm,
      padding: spacing.md,
      ...textStyles.body1,
    },
    textArea: {
      height: 120,
      textAlignVertical: 'top',
    },
    categoryButtons: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    categoryButton: {
      flex: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.gray100,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.gray200,
    },
    categoryButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryButtonText: {
      ...textStyles.body2,
      fontWeight: typography.fontWeightSemiBold,
      color: colors.text,
    },
    categoryButtonTextActive: {
      color: colors.white,
    },
    createButton: {
      backgroundColor: colors.primary,
      padding: spacing.md,
      borderRadius: borderRadius.sm,
      alignItems: 'center',
      marginTop: spacing.xl,
      marginBottom: spacing.lg,
    },
    createButtonText: {
      ...textStyles.body1,
      color: colors.white,
      fontWeight: typography.fontWeightBold,
    },
    detailContent: {
      flex: 1,
    },
    detailContentContainer: {
      flexGrow: 1,
    },
    detailPostHeader: {
      padding: spacing.lg,
      backgroundColor: colors.background,
    },
    detailAuthorInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    detailAuthorName: {
      ...textStyles.body1,
      fontWeight: typography.fontWeightSemiBold,
    },
    detailTimeText: {
      ...textStyles.caption,
      color: colors.gray500,
      marginTop: 2,
    },
    detailPostBody: {
      padding: spacing.lg,
      backgroundColor: colors.surface,
    },
    detailPostTitle: {
      ...textStyles.h3,
      marginBottom: spacing.md,
    },
    detailPostContent: {
      ...textStyles.body1,
      color: colors.textSecondary,
      lineHeight: 22,
      marginTop: spacing.md,
    },
    detailPostActions: {
      flexDirection: 'row',
      gap: spacing.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    likeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: borderRadius.md,
      backgroundColor: colors.background,
    },
    likeButtonText: {
      ...textStyles.body2,
      color: colors.textSecondary,
      fontWeight: typography.fontWeightSemiBold,
    },
    likeButtonTextActive: {
      color: colors.error,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    statText: {
      ...textStyles.body2,
      color: colors.textSecondary,
    },
    divider: {
      height: 8,
      backgroundColor: colors.background,
    },
    commentsSection: {
      padding: spacing.lg,
      backgroundColor: colors.surface,
    },
    commentsSectionTitle: {
      ...textStyles.h4,
      marginBottom: spacing.md,
    },
    commentsLoader: {
      marginVertical: spacing.lg,
    },
    emptyComments: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    emptyCommentsText: {
      ...textStyles.body1,
      color: colors.textSecondary,
      fontWeight: typography.fontWeightSemiBold,
    },
    emptyCommentsSubtext: {
      ...textStyles.caption,
      color: colors.gray500,
      marginTop: spacing.xs,
    },
    commentCard: {
      marginBottom: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.background,
      borderRadius: borderRadius.sm,
    },
    commentHeader: {
      marginBottom: spacing.sm,
    },
    commentAuthorInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    commentAvatar: {
      width: 20,
      height: 20,
      borderRadius: borderRadius.full,
      backgroundColor: colors.gray200,
      justifyContent: 'center',
      alignItems: 'center',
    },
    commentAuthorName: {
      ...textStyles.body2,
      fontWeight: typography.fontWeightSemiBold,
    },
    commentTime: {
      ...textStyles.caption,
      color: colors.gray500,
    },
    commentContent: {
      ...textStyles.body2,
      color: colors.text,
      lineHeight: 20,
    },
    commentInputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.gray200,
      gap: spacing.sm,
    },
    commentInput: {
      flex: 1,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.gray300,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      ...textStyles.body2,
      maxHeight: 100,
    },
    commentSubmitButton: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    commentSubmitButtonDisabled: {
      backgroundColor: colors.gray300,
    },
  });

  const fetchPosts = async () => {
    try {
      // First, fetch posts
      const { data: postsData, error: postsError } = await supabase
        .from('forum_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (postsError) {
        console.error('Error fetching posts:', postsError);
        throw postsError;
      }

      if (postsData && postsData.length > 0) {
        // Fetch author information separately
        const authorIds = [...new Set(postsData.map(p => p.author_id))];
        const { data: authorsData, error: authorsError } = await supabase
          .from('user_profiles')
          .select('id, full_name, profile_image_url')
          .in('id', authorIds);

        if (authorsError) {
          console.error('Error fetching authors:', authorsError);
        }

        // Create authors map
        const authorsMap: { [key: string]: { name: string; profile_image_url: string | null } } = {};
        authorsData?.forEach(author => {
          authorsMap[author.id] = {
            name: author.full_name || 'Anonymous',
            profile_image_url: author.profile_image_url || null,
          };
        });

        // Fetch tags for all posts
        const postIds = postsData.map(p => p.id);
        const { data: tagsData, error: tagsError } = await supabase
          .from('post_tags')
          .select('post_id, tag')
          .in('post_id', postIds);

        if (tagsError) {
          console.error('Error fetching tags:', tagsError);
        }

        // Fetch reaction counts for all posts
        const { data: reactionsData, error: reactionsError } = await supabase
          .from('post_reactions')
          .select('post_id')
          .in('post_id', postIds);

        if (reactionsError) {
          console.error('Error fetching reactions:', reactionsError);
        }

        // Fetch comment counts for all posts
        const { data: commentsData, error: commentsError } = await supabase
          .from('forum_comments')
          .select('post_id')
          .in('post_id', postIds);

        if (commentsError) {
          console.error('Error fetching comments:', commentsError);
        }

        // Build the tags map
        const tagsMap: { [key: string]: string[] } = {};
        tagsData?.forEach(tag => {
          if (!tagsMap[tag.post_id]) {
            tagsMap[tag.post_id] = [];
          }
          tagsMap[tag.post_id].push(tag.tag);
        });

        // Build reaction counts map
        const reactionsMap: { [key: string]: number } = {};
        reactionsData?.forEach(reaction => {
          reactionsMap[reaction.post_id] = (reactionsMap[reaction.post_id] || 0) + 1;
        });

        // Build comment counts map
        const commentsMap: { [key: string]: number } = {};
        commentsData?.forEach(comment => {
          commentsMap[comment.post_id] = (commentsMap[comment.post_id] || 0) + 1;
        });

        // Transform data to match ForumPost interface
        const transformedPosts: ForumPost[] = postsData.map(post => ({
          id: post.id,
          title: post.title,
          content: post.content,
          author: {
            id: post.author_id,
            name: authorsMap[post.author_id]?.name || 'Anonymous',
            avatar: authorsMap[post.author_id]?.profile_image_url,
          },
          tags: tagsMap[post.id] || [],
          created_at: post.created_at,
          likes: reactionsMap[post.id] || 0,
          comments: commentsMap[post.id] || 0,
        }));

        setPosts(transformedPosts);
        setFilteredPosts(transformedPosts);
      } else {
        setPosts([]);
        setFilteredPosts([]);
      }
    } catch (error) {
      console.error('Error in fetchPosts:', error);
      setPosts([]);
      setFilteredPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchComments = async (postId: string) => {
    setLoadingComments(true);
    try {
      const { data: commentsData, error: commentsError } = await supabase
        .from('forum_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      if (commentsData && commentsData.length > 0) {
        // Fetch author information for comments
        const authorIds = [...new Set(commentsData.map(c => c.author_id))];
        const { data: authorsData } = await supabase
          .from('user_profiles')
          .select('id, full_name, profile_image_url')
          .in('id', authorIds);

        const authorsMap: { [key: string]: { name: string; profile_image_url: string | null } } = {};
        authorsData?.forEach(author => {
          authorsMap[author.id] = {
            name: author.full_name || 'Anonymous',
            profile_image_url: author.profile_image_url || null,
          };
        });

        const transformedComments: Comment[] = commentsData.map(comment => ({
          id: comment.id,
          content: comment.content,
          author: {
            id: comment.author_id,
            name: authorsMap[comment.author_id]?.name || 'Anonymous',
            avatar: authorsMap[comment.author_id]?.profile_image_url,
          },
          created_at: comment.created_at,
        }));

        setComments(transformedComments);
      } else {
        setComments([]);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const checkUserLikeStatus = async (postId: string) => {
    if (!user) {
      setIsLiked(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('post_reactions')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('Error checking like status:', error);
      }

      setIsLiked(!!data);
    } catch (error) {
      console.error('Error in checkUserLikeStatus:', error);
      setIsLiked(false);
    }
  };

  const getLikeCount = async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('post_reactions')
        .select('id', { count: 'exact' })
        .eq('post_id', postId);

      if (error) throw error;

      setLikeCount(data?.length || 0);
    } catch (error) {
      console.error('Error getting like count:', error);
      setLikeCount(0);
    }
  };

  const handleToggleLike = async () => {
    if (!user) {
      showAlert('Error', 'You must be logged in to like posts');
      return;
    }

    if (!selectedPost) return;

    try {
      // First check current database state to avoid conflicts
      const { data: existingLike, error: checkError } = await supabase
        .from('post_reactions')
        .select('id')
        .eq('post_id', selectedPost.id)
        .eq('user_id', user.id)
        .eq('reaction_type', 'like')
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingLike) {
        // Like exists, so delete it
        const { error } = await supabase
          .from('post_reactions')
          .delete()
          .eq('post_id', selectedPost.id)
          .eq('user_id', user.id)
          .eq('reaction_type', 'like');

        if (error) throw error;
        // Real-time subscription will update the UI
      } else {
        // Like doesn't exist, so insert it
        const { error } = await supabase
          .from('post_reactions')
          .insert({
            post_id: selectedPost.id,
            user_id: user.id,
            reaction_type: 'like',
          });

        if (error) throw error;
        // Real-time subscription will update the UI
      }
    } catch (error: any) {
      console.error('Error toggling like:', error);
      showAlert('Error', error.message || 'Failed to update like');
    }
  };

  const handlePostPress = (post: ForumPost) => {
    setSelectedPost(post);
    setShowDetailModal(true);
    setLikeCount(post.likes);
    fetchComments(post.id);
    checkUserLikeStatus(post.id);
  };

  const handleSubmitComment = async () => {
    if (!user) {
      showAlert('Error', 'You must be logged in to comment');
      return;
    }

    if (!newComment.trim()) {
      showAlert('Error', 'Please enter a comment');
      return;
    }

    if (!selectedPost) return;

    try {
      const { error } = await supabase
        .from('forum_comments')
        .insert({
          post_id: selectedPost.id,
          author_id: user.id,
          content: newComment.trim(),
        });

      if (error) throw error;

      setNewComment('');
      fetchComments(selectedPost.id);

      // Update comment count in the post
      fetchPosts();
    } catch (error: any) {
      console.error('Error submitting comment:', error);
      showAlert('Error', error.message || 'Failed to submit comment');
    }
  };

  const handleDeletePost = async () => {
    if (!user || !selectedPost) return;

    if (selectedPost.author.id !== user.id) {
      showAlert('Error', 'You can only delete your own posts');
      return;
    }

    try {
      const { error } = await supabase
        .from('forum_posts')
        .delete()
        .eq('id', selectedPost.id)
        .eq('author_id', user.id);

      if (error) throw error;

      showAlert('Success', 'Post deleted successfully');
      closeDetailModal();
      fetchPosts();
    } catch (error: any) {
      console.error('Error deleting post:', error);
      showAlert('Error', error.message || 'Failed to delete post');
    }
  };

  const confirmDeletePost = () => {
    if (!selectedPost) return;

    showAlert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: handleDeletePost }
      ]
    );
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedPost(null);
    setComments([]);
    setNewComment('');
    setIsLiked(false);
    setLikeCount(0);
  };

  useEffect(() => {
    fetchPosts();

    // Set up real-time subscriptions
    const postsChannel = supabase
      .channel('forum-posts-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'forum_posts' },
        (payload) => {
          // When a new post is created, refetch all posts to get complete data
          fetchPosts();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'forum_posts' },
        (payload) => {
          // Remove the deleted post from state
          setPosts(prev => prev.filter(p => p.id !== payload.old.id));
        }
      )
      .subscribe();

    const commentsChannel = supabase
      .channel('forum-comments-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'forum_comments' },
        (payload) => {
          // Update comment count for the affected post
          const postId = (payload.new as any).post_id;
          setPosts(prev => prev.map(post =>
            post.id === postId
              ? { ...post, comments: post.comments + 1 }
              : post
          ));

          // If viewing this post's comments, add the new comment
          setSelectedPost(current => {
            if (current?.id === postId) {
              fetchComments(postId);
            }
            return current;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'forum_comments' },
        (payload) => {
          // Update comment count for the affected post
          const postId = (payload.old as any).post_id;
          setPosts(prev => prev.map(post =>
            post.id === postId
              ? { ...post, comments: Math.max(0, post.comments - 1) }
              : post
          ));

          // If viewing this post's comments, refetch them
          setSelectedPost(current => {
            if (current?.id === postId) {
              fetchComments(postId);
            }
            return current;
          });
        }
      )
      .subscribe();

    const reactionsChannel = supabase
      .channel('post-reactions-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'post_reactions' },
        (payload) => {
          // Update like count for the affected post
          const postId = (payload.new as any).post_id;
          const userId = (payload.new as any).user_id;
          const reactionType = (payload.new as any).reaction_type;

          // Only process 'like' reactions
          if (reactionType !== 'like') return;

          setPosts(prev => prev.map(post =>
            post.id === postId
              ? { ...post, likes: post.likes + 1 }
              : post
          ));

          // If viewing this post in detail, update isLiked status
          // Note: likeCount will be updated by the useEffect that watches posts array
          setSelectedPost(current => {
            if (current?.id === postId && user && userId === user.id) {
              setIsLiked(true);
            }
            return current;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'post_reactions' },
        (payload) => {
          // Since Supabase doesn't send old row data for DELETE,
          // we need to refetch posts to get accurate like counts
          fetchPosts();

          // If viewing a post in detail, refresh the like status
          if (selectedPost && user) {
            checkUserLikeStatus(selectedPost.id);
          }
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(commentsChannel);
      supabase.removeChannel(reactionsChannel);
    };
  }, []);

  useEffect(() => {
    filterPosts();
  }, [searchQuery, activeFilter, posts]);

  // Update selectedPost when posts array changes (for real-time updates)
  useEffect(() => {
    if (selectedPost) {
      const updatedPost = posts.find(p => p.id === selectedPost.id);
      if (updatedPost) {
        setSelectedPost(updatedPost);
        setLikeCount(updatedPost.likes);
      }
    }
  }, [posts]);

  const filterPosts = () => {
    let filtered = [...posts];

    // Apply category filter
    if (activeFilter !== 'all') {
      filtered = filtered.filter(post => {
        const tagString = post.tags.join(' ').toLowerCase();

        if (activeFilter === 'courses') {
          // Match course codes (CS 142) OR the courses category tag
          return /\d/.test(tagString) || tagString.includes('course');
        } else if (activeFilter === 'study-tips') {
          // Match study tips related keywords
          return tagString.includes('study') || tagString.includes('tips') || tagString.includes('writing');
        } else if (activeFilter === 'professors') {
          // Match professor related keywords
          return tagString.includes('professor') || tagString.includes('prof');
        }
        return true;
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(post => {
        // Search in title
        if (post.title.toLowerCase().includes(query)) return true;

        // Search in content
        if (post.content && post.content.toLowerCase().includes(query)) return true;

        // Search in tags
        if (post.tags.some(tag => tag.toLowerCase().includes(query))) return true;

        // Search in author name
        if (post.author.name.toLowerCase().includes(query)) return true;

        return false;
      });
    }

    setFilteredPosts(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts();
  };

  const formatTimeAgo = (dateString: string) => {
    const now = Date.now();
    const date = new Date(dateString).getTime();
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const formatCount = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  const handleCreatePost = async () => {
    if (!user) {
      showAlert('Error', 'You must be logged in to create posts');
      return;
    }

    if (!newPost.title.trim()) {
      showAlert('Error', 'Please enter a post title');
      return;
    }

    try {
      // Insert the post
      const { data: postData, error: postError } = await supabase
        .from('forum_posts')
        .insert({
          title: newPost.title,
          content: newPost.content || null,
          category: newPost.category,
          author_id: user.id,
        })
        .select()
        .single();

      if (postError) throw postError;

      // Auto-generate tags from the title (extract course codes and keywords)
      if (postData) {
        const tags: string[] = [];

        // Extract course codes (e.g., CS 142, Math 101)
        const courseCodeRegex = /\b([A-Z]{2,4})\s*(\d{3,4})\b/gi;
        const courseCodes = newPost.title.match(courseCodeRegex);
        if (courseCodes) {
          tags.push(...courseCodes);
        }

        // Add category as a tag
        if (newPost.category && newPost.category !== 'all') {
          const categoryTag = newPost.category.replace('-', ' ');
          // Capitalize each word (e.g., "study tips" -> "Study Tips")
          const capitalizedCategory = categoryTag
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          tags.push(capitalizedCategory);
        }

        // Extract common keywords
        const keywords = ['study', 'tips', 'exam', 'essay', 'professor', 'algorithm', 'writing'];
        keywords.forEach(keyword => {
          if (newPost.title.toLowerCase().includes(keyword)) {
            const capitalizedKeyword = keyword.charAt(0).toUpperCase() + keyword.slice(1);
            // Only add if not already in tags (avoid duplicates)
            if (!tags.some(tag => tag.toLowerCase() === capitalizedKeyword.toLowerCase())) {
              tags.push(capitalizedKeyword);
            }
          }
        });

        // Insert tags if any were found
        if (tags.length > 0) {
          const tagInserts = tags.map(tag => ({
            post_id: postData.id,
            tag: tag,
          }));

          await supabase.from('post_tags').insert(tagInserts);
        }
      }

      showAlert('Success', 'Post created successfully!');
      closeModal();
      fetchPosts();
    } catch (error: any) {
      console.error('Error creating post:', error);
      showAlert('Error', error.message || 'Failed to create post');
    }
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setNewPost({
      title: '',
      content: '',
      category: 'courses',
    });
  };

  const renderFilterButton = (filter: FilterType, label: string) => (
    <TouchableOpacity
      key={filter}
      style={[
        styles.filterButton,
        activeFilter === filter && styles.filterButtonActive
      ]}
      onPress={() => setActiveFilter(filter)}
    >
      <Text style={[
        styles.filterButtonText,
        activeFilter === filter && styles.filterButtonTextActive
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderPostCard = ({ item }: { item: ForumPost }) => (
    <TouchableOpacity style={styles.postCard} onPress={() => handlePostPress(item)}>
      <View style={styles.postContent}>
        <Text style={styles.postTitle} numberOfLines={2}>
          {item.title}
        </Text>

        <View style={styles.postTags}>
          {item.tags.map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        <View style={styles.postFooter}>
          <View style={styles.authorInfo}>
            {item.author.avatar ? (
              <Image
                source={{ uri: item.author.avatar }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatar}>
                <Ionicons name="person" size={16} color={colors.gray600} />
              </View>
            )}
            <Text style={styles.authorName}>{item.author.name}</Text>
          </View>

          <View style={styles.postMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="chatbubble-outline" size={14} color={colors.gray500} />
              <Text style={styles.metaText}>{item.comments}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="heart-outline" size={14} color={colors.gray500} />
              <Text style={styles.metaText}>{formatCount(item.likes)}</Text>
            </View>
            <Text style={styles.timeText}>{formatTimeAgo(item.created_at)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

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
        <Text style={styles.headerTitle}>Community</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={colors.gray500} />
          <TextInput
            style={styles.searchInput}
            placeholder="Find Forums"
            placeholderTextColor={colors.gray500}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={18} color={colors.gray500} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {renderFilterButton('all', 'All')}
          {renderFilterButton('courses', 'Courses')}
          {renderFilterButton('study-tips', 'Study Tips')}
          {renderFilterButton('professors', 'Professors')}
        </ScrollView>
      </View>

      {/* Posts List */}
      <FlatList
        data={filteredPosts}
        renderItem={renderPostCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name={searchQuery ? "search-outline" : "chatbubbles-outline"}
              size={64}
              color={colors.gray400}
            />
            <Text style={styles.emptyStateText}>
              {searchQuery ? 'No results found' : 'No posts found'}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              {searchQuery
                ? `No posts match "${searchQuery}"`
                : activeFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Be the first to start a discussion!'
              }
            </Text>
            {searchQuery && (
              <TouchableOpacity
                style={styles.clearSearchButton}
                onPress={() => setSearchQuery('')}
              >
                <Text style={styles.clearSearchButtonText}>Clear Search</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 80 }]}
        onPress={() => setShowCreateModal(true)}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* Create Post Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Post</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter post title"
                value={newPost.title}
                onChangeText={(text) => setNewPost({ ...newPost, title: text })}
              />

              <Text style={styles.inputLabel}>Content</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Share your thoughts or questions..."
                value={newPost.content}
                onChangeText={(text) => setNewPost({ ...newPost, content: text })}
                multiline
                numberOfLines={6}
              />

              <Text style={styles.inputLabel}>Category</Text>
              <View style={styles.categoryButtons}>
                <TouchableOpacity
                  style={[
                    styles.categoryButton,
                    newPost.category === 'courses' && styles.categoryButtonActive
                  ]}
                  onPress={() => setNewPost({ ...newPost, category: 'courses' })}
                >
                  <Text style={[
                    styles.categoryButtonText,
                    newPost.category === 'courses' && styles.categoryButtonTextActive
                  ]}>
                    Courses
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.categoryButton,
                    newPost.category === 'study-tips' && styles.categoryButtonActive
                  ]}
                  onPress={() => setNewPost({ ...newPost, category: 'study-tips' })}
                >
                  <Text style={[
                    styles.categoryButtonText,
                    newPost.category === 'study-tips' && styles.categoryButtonTextActive
                  ]}>
                    Study Tips
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.categoryButton,
                    newPost.category === 'professors' && styles.categoryButtonActive
                  ]}
                  onPress={() => setNewPost({ ...newPost, category: 'professors' })}
                >
                  <Text style={[
                    styles.categoryButtonText,
                    newPost.category === 'professors' && styles.categoryButtonTextActive
                  ]}>
                    Professors
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.createButton} onPress={handleCreatePost}>
                <Text style={styles.createButtonText}>Create Post</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Post Detail Modal with Comments */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeDetailModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Post Details</Text>
              <View style={styles.modalHeaderActions}>
                {selectedPost && user && selectedPost.author.id === user.id && (
                  <TouchableOpacity onPress={confirmDeletePost} style={styles.deleteButton}>
                    <Ionicons name="trash-outline" size={24} color={colors.error} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={closeDetailModal}>
                  <Ionicons name="close" size={28} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {selectedPost && (
              <ScrollView
                style={styles.detailContent}
                contentContainerStyle={styles.detailContentContainer}
                showsVerticalScrollIndicator={false}
              >
                {/* Post Header */}
                <View style={styles.detailPostHeader}>
                  <View style={styles.detailAuthorInfo}>
                    {selectedPost.author.avatar ? (
                      <Image
                        source={{ uri: selectedPost.author.avatar }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={styles.avatar}>
                        <Ionicons name="person" size={20} color={colors.gray600} />
                      </View>
                    )}
                    <View>
                      <Text style={styles.detailAuthorName}>{selectedPost.author.name}</Text>
                      <Text style={styles.detailTimeText}>
                        {formatTimeAgo(selectedPost.created_at)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Post Content */}
                <View style={styles.detailPostBody}>
                  <Text style={styles.detailPostTitle}>{selectedPost.title}</Text>

                  <View style={styles.postTags}>
                    {selectedPost.tags.map((tag, index) => (
                      <View key={index} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>

                  {selectedPost.content && (
                    <Text style={styles.detailPostContent}>{selectedPost.content}</Text>
                  )}
                </View>

                {/* Post Actions */}
                <View style={styles.detailPostActions}>
                  <TouchableOpacity
                    style={styles.likeButton}
                    onPress={handleToggleLike}
                  >
                    <Ionicons
                      name={isLiked ? "heart" : "heart-outline"}
                      size={24}
                      color={isLiked ? colors.error : colors.gray500}
                    />
                    <Text style={[
                      styles.likeButtonText,
                      isLiked && styles.likeButtonTextActive
                    ]}>
                      {formatCount(likeCount)} {likeCount === 1 ? 'like' : 'likes'}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.statItem}>
                    <Ionicons name="chatbubble-outline" size={20} color={colors.gray500} />
                    <Text style={styles.statText}>{selectedPost.comments} comments</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Comments Section */}
                <View style={styles.commentsSection}>
                  <Text style={styles.commentsSectionTitle}>
                    Comments ({comments.length})
                  </Text>

                  {loadingComments ? (
                    <ActivityIndicator size="small" color={colors.primary} style={styles.commentsLoader} />
                  ) : comments.length === 0 ? (
                    <View style={styles.emptyComments}>
                      <Text style={styles.emptyCommentsText}>No comments yet</Text>
                      <Text style={styles.emptyCommentsSubtext}>Be the first to comment!</Text>
                    </View>
                  ) : (
                    comments.map((comment) => (
                      <View key={comment.id} style={styles.commentCard}>
                        <View style={styles.commentHeader}>
                          <View style={styles.commentAuthorInfo}>
                            {comment.author.avatar ? (
                              <Image
                                source={{ uri: comment.author.avatar }}
                                style={styles.commentAvatar}
                              />
                            ) : (
                              <View style={styles.commentAvatar}>
                                <Ionicons name="person" size={14} color={colors.gray600} />
                              </View>
                            )}
                            <Text style={styles.commentAuthorName}>{comment.author.name}</Text>
                            <Text style={styles.commentTime}>
                              {formatTimeAgo(comment.created_at)}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.commentContent}>{comment.content}</Text>
                      </View>
                    ))
                  )}
                </View>
              </ScrollView>
            )}

            {/* Comment Input */}
            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
                placeholderTextColor={colors.gray500}
                value={newComment}
                onChangeText={setNewComment}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[
                  styles.commentSubmitButton,
                  !newComment.trim() && styles.commentSubmitButtonDisabled
                ]}
                onPress={handleSubmitComment}
                disabled={!newComment.trim()}
              >
                <Ionicons name="send" size={20} color={colors.white} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
