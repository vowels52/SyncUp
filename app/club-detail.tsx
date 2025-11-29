import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { spacing, borderRadius, shadows, typography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';
import { useThemedColors } from '@/hooks/useThemedColors';
import { useThemedStyles } from '@/hooks/useThemedStyles';

interface Club {
  id: string;
  name: string;
  description: string;
  club_type: string;
  category: string;
  image_url: string;
  external_url: string;
  is_official_club: boolean;
}

export default function ClubDetailScreen() {
  const colors = useThemedColors();
  const { commonStyles, textStyles } = useThemedStyles();
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const supabase = getSupabaseClient();

  const [club, setClub] = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [joining, setJoining] = useState(false);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  // Helper function to check if image URL is valid
  const isValidImageUrl = (url: string | null | undefined): boolean => {
    if (!url) return false;
    // Check if URL starts with http/https and doesn't contain suspicious patterns
    return url.startsWith('http') && url.length > 10;
  };

  useEffect(() => {
    fetchClubDetails();
    if (user) {
      checkMembership();
    }
  }, [id, user]);

  const fetchClubDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setClub(data);
      setImageLoadFailed(false); // Reset on new club load
    } catch (error) {
      console.error('Error fetching club details:', error);
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

      if (error) {
        console.error('Error checking membership:', error);
        setIsMember(false);
        return;
      }

      setIsMember(!!data);
    } catch (error) {
      // Not a member or error
      console.error('Unexpected error checking membership:', error);
      setIsMember(false);
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

  const handleJoinClub = async () => {
    if (!user || !club) return;

    setJoining(true);
    try {
      if (isMember) {
        // Leave the club
        const { error } = await supabase
          .from('group_members')
          .delete()
          .eq('group_id', club.id)
          .eq('user_id', user.id);

        if (error) throw error;
        setIsMember(false);
      } else {
        // Join the club
        const { error } = await supabase
          .from('group_members')
          .insert({
            group_id: club.id,
            user_id: user.id,
            role: 'member',
          });

        if (error) throw error;
        setIsMember(true);
      }
    } catch (error) {
      console.error('Error updating membership:', error);
    } finally {
      setJoining(false);
    }
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
    imageContainer: {
      width: '100%',
      height: 250,
      backgroundColor: colors.gray100,
      justifyContent: 'center',
      alignItems: 'center',
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
    infoSection: {
      padding: spacing.lg,
    },
    clubName: {
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
    officialBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.lg,
    },
    officialText: {
      fontSize: typography.fontSize14,
      color: colors.accent,  // Using accent orange for better visibility
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
      color: colors.white,  // Always use white for better contrast on colored buttons
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
  });

  if (loading) {
    return (
      <View style={[commonStyles.container, commonStyles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!club) {
    return (
      <View style={[commonStyles.container, commonStyles.centerContent]}>
        <Text style={styles.errorText}>Club not found</Text>
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
        <Text style={styles.headerTitle}>Club Details</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Club Image */}
        <View style={styles.imageContainer}>
          {isValidImageUrl(club.image_url) && !imageLoadFailed ? (
            <Image
              source={{ uri: club.image_url }}
              style={styles.clubImage}
              resizeMode="contain"
              onError={() => {
                console.log('Image failed to load for club:', club.name);
                setImageLoadFailed(true);
              }}
            />
          ) : (
            <View style={styles.defaultClubIcon}>
              <Ionicons name="school" size={80} color={colors.white} />
            </View>
          )}
        </View>

        {/* Club Info */}
        <View style={styles.infoSection}>
          <Text style={styles.clubName}>{club.name}</Text>

          {(() => {
            const hasValidClubType = club.club_type?.trim() && club.club_type.trim().length > 1 && club.club_type.trim() !== '.';
            const hasValidCategory = club.category?.trim() && club.category.trim().length > 1 && club.category.trim() !== '.';

            if (!hasValidClubType && !hasValidCategory) return null;

            return (
              <View style={styles.tagContainer}>
                {hasValidClubType && (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{club.club_type.trim()}</Text>
                  </View>
                )}
                {hasValidCategory && (
                  <View style={[styles.tag, styles.categoryTag]}>
                    <Text style={styles.tagText}>{club.category.trim()}</Text>
                  </View>
                )}
              </View>
            );
          })()}

          {club.is_official_club && (
            <View style={styles.officialBadge}>
              <Ionicons name="shield-checkmark" size={16} color={colors.accent} />
              <Text style={styles.officialText}>Official UWB Club</Text>
            </View>
          )}

          {/* Description */}
          {club.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.description}>{club.description}</Text>
            </View>
          )}

          {/* Join/Leave Button */}
          {user && (
            <TouchableOpacity
              style={[styles.joinButton, isMember && styles.leaveButton]}
              onPress={handleJoinClub}
              disabled={joining}
            >
              {joining ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons
                    name={isMember ? 'checkmark-circle' : 'add-circle'}
                    size={20}
                    color={colors.white}
                    style={styles.buttonIcon}
                  />
                  <Text style={styles.joinButtonText}>
                    {isMember ? 'Leave Club' : 'Join Club'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}