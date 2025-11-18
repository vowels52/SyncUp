import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { typography, spacing, borderRadius, shadows } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { pickImage } from '@/template/core/imageUpload';
import { updateProfileImage, removeProfileImage } from '@/template/core/profileImageService';
import { useThemedColors } from '@/hooks/useThemedColors';
import { useThemedStyles } from '@/hooks/useThemedStyles';

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

export default function EditProfileScreen() {
  const colors = useThemedColors();
  const { commonStyles, textStyles } = useThemedStyles();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [major, setMajor] = useState('');
  const [year, setYear] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfile(data);
        setFullName(data.full_name || '');
        setMajor(data.major || '');
        setYear(data.year || '');
        setBio(data.bio || '');
      }
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeProfileImage = async () => {
    if (!user || !profile) return;

    try {
      setUploadingImage(true);

      // Pick and crop image
      const image = await pickImage();
      if (!image) {
        setUploadingImage(false);
        return; // User cancelled
      }

      // Upload image and update profile
      const { imageUrl } = await updateProfileImage(
        user.id,
        image.uri,
        profile.profile_image_url
      );

      // Update local profile state
      setProfile({ ...profile, profile_image_url: imageUrl });

      showAlert('Success', 'Profile picture updated successfully');
    } catch (error: any) {
      console.error('Failed to upload profile image:', error);
      showAlert('Error', error.message || 'Failed to upload profile picture');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveProfileImage = async () => {
    if (!user || !profile || !profile.profile_image_url) return;

    showAlert('Remove Profile Picture', 'Are you sure you want to remove your profile picture?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setUploadingImage(true);

            await removeProfileImage(user.id, profile.profile_image_url!);

            // Update local profile state
            setProfile({ ...profile, profile_image_url: null });

            showAlert('Success', 'Profile picture removed');
          } catch (error: any) {
            console.error('Failed to remove profile image:', error);
            showAlert('Error', error.message || 'Failed to remove profile picture');
          } finally {
            setUploadingImage(false);
          }
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!user) return;

    if (!fullName || !major || !year) {
      showAlert('Missing Information', 'Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: fullName,
          major,
          year,
          bio,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      showAlert('Success', 'Profile updated successfully');
      router.back();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centerContent: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      backgroundColor: colors.surface,
      ...shadows.small,
    },
    backButton: {
      padding: spacing.xs,
    },
    headerTitle: {
      ...textStyles.h3,
      color: colors.textPrimary,
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.lg,
    },
    title: {
      ...textStyles.h2,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    description: {
      ...textStyles.body2,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
    },
    form: {
      gap: spacing.md,
    },
    inputGroup: {
      marginBottom: spacing.md,
    },
    label: {
      ...textStyles.body2,
      color: colors.textPrimary,
      fontWeight: typography.fontWeightSemiBold,
      marginBottom: spacing.xs,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      fontSize: typography.fontSize16,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.gray200,
    },
    textArea: {
      minHeight: 100,
      paddingTop: spacing.md,
    },
    yearContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    yearButton: {
      flex: 1,
      minWidth: '45%',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.gray200,
      alignItems: 'center',
    },
    yearButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    yearButtonText: {
      ...textStyles.body2,
      color: colors.textPrimary,
    },
    yearButtonTextActive: {
      color: colors.white,
      fontWeight: typography.fontWeightSemiBold,
    },
    footer: {
      padding: spacing.md,
      backgroundColor: colors.surface,
      ...shadows.medium,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
      height: 50,
      justifyContent: 'center',
      alignItems: 'center',
      ...shadows.small,
    },
    primaryButtonText: {
      ...textStyles.button,
      color: colors.white,
    },
    cancelButton: {
      marginTop: spacing.sm,
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    cancelButtonText: {
      ...textStyles.body2,
      color: colors.primary,
    },
    profileImageSection: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    profileImageContainer: {
      position: 'relative',
      width: 120,
      height: 120,
      marginBottom: spacing.sm,
    },
    profileImageTouchable: {
      width: 120,
      height: 120,
      borderRadius: borderRadius.full,
    },
    profileImage: {
      width: 120,
      height: 120,
      borderRadius: borderRadius.full,
    },
    profileImagePlaceholder: {
      width: 120,
      height: 120,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    profileImageOverlay: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 40,
      height: 40,
      borderRadius: borderRadius.full,
      backgroundColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: colors.background,
    },
    profileImageLabel: {
      ...textStyles.caption,
      color: colors.textSecondary,
    },
    removeProfileImageButton: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      backgroundColor: colors.error,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: colors.background,
    },
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Update your information</Text>
        <Text style={styles.description}>Keep your profile up to date so others can find you</Text>

        <View style={styles.profileImageSection}>
          <View style={styles.profileImageContainer}>
            <TouchableOpacity
              style={styles.profileImageTouchable}
              onPress={handleChangeProfileImage}
              disabled={uploadingImage}
            >
              {profile?.profile_image_url ? (
                <Image
                  source={{ uri: profile.profile_image_url }}
                  style={styles.profileImage}
                />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Ionicons name="person" size={48} color={colors.white} />
                </View>
              )}
              <View style={styles.profileImageOverlay}>
                {uploadingImage ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="camera" size={24} color={colors.white} />
                )}
              </View>
            </TouchableOpacity>
            {profile?.profile_image_url && !uploadingImage && (
              <TouchableOpacity
                style={styles.removeProfileImageButton}
                onPress={handleRemoveProfileImage}
              >
                <Ionicons name="close" size={20} color={colors.white} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.profileImageLabel}>Tap to change profile picture</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="John Doe"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Major *</Text>
            <TextInput
              style={styles.input}
              placeholder="Computer Science"
              value={major}
              onChangeText={setMajor}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Year *</Text>
            <View style={styles.yearContainer}>
              {['Freshman', 'Sophomore', 'Junior', 'Senior'].map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.yearButton, year === y && styles.yearButtonActive]}
                  onPress={() => setYear(y)}
                >
                  <Text style={[styles.yearButtonText, year === y && styles.yearButtonTextActive]}>
                    {y}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell us a bit about yourself..."
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}