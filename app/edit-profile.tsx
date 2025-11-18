import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, borderRadius, shadows } from '@/constants/theme';
import { textStyles } from '@/constants/styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { pickImage } from '@/template/core/imageUpload';
import { updateProfileImage, removeProfileImage } from '@/template/core/profileImageService';

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  major: string | null;
  year: string | null;
  bio: string | null;
  university: string | null;
  study_habits: string | null;
  skills: string | null;
  profile_image_url: string | null;
}

export default function EditProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [major, setMajor] = useState('');
  const [year, setYear] = useState('');
  const [bio, setBio] = useState('');
  const [university, setUniversity] = useState('');
  const [studyHabits, setStudyHabits] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [allInterests, setAllInterests] = useState<Array<{ id: string; name: string }>>([]);
  const [allCourses, setAllCourses] = useState<Array<{ id: string; code: string; name: string }>>([]);
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
      // Fetch user profile
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfile(data);
        setFullName(data.full_name || '');
        setEmail(data.email || '');
        setMajor(data.major || '');
        setYear(data.year || '');
        setBio(data.bio || '');
        setUniversity(data.university || '');
        setStudyHabits(data.study_habits || '');
        setSkillsText(data.skills ? data.skills.join(', ') : '');
      }

      // Fetch all interests
      const { data: interestsData, error: interestsError } = await supabase
        .from('interests')
        .select('id, name')
        .order('name');

      if (interestsError) throw interestsError;
      if (interestsData) setAllInterests(interestsData);

      // Fetch user's interests
      const { data: userInterestsData, error: userInterestsError } = await supabase
        .from('user_interests')
        .select('interests(id, name)')
        .eq('user_id', user.id);

      if (userInterestsError) throw userInterestsError;
      if (userInterestsData) {
        const interestNames = userInterestsData
          .map((ui: any) => ui.interests?.name)
          .filter((name): name is string => !!name);
        setSelectedInterests(interestNames);
      }

      // Fetch all courses
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('id, code, name')
        .order('code');

      if (coursesError) throw coursesError;
      if (coursesData) setAllCourses(coursesData);

      // Fetch user's courses
      const { data: userCoursesData, error: userCoursesError } = await supabase
        .from('user_courses')
        .select('courses(id, code, name)')
        .eq('user_id', user.id);

      if (userCoursesError) throw userCoursesError;
      if (userCoursesData) {
        const courseCodes = userCoursesData
          .map((uc: any) => uc.courses?.code)
          .filter((code): code is string => !!code);
        setSelectedCourses(courseCodes);
      }
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  const toggleInterest = (interestName: string) => {
    if (selectedInterests.includes(interestName)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interestName));
    } else {
      setSelectedInterests([...selectedInterests, interestName]);
    }
  };

  const toggleCourse = (courseCode: string) => {
    if (selectedCourses.includes(courseCode)) {
      setSelectedCourses(selectedCourses.filter(c => c !== courseCode));
    } else {
      setSelectedCourses([...selectedCourses, courseCode]);
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

    if (!fullName || !email || !major || !year) {
      showAlert('Missing Information', 'Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      // Convert skills text to array
      const skillsArray = skillsText
        .split(',')
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0);

      // Update user profile
      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: fullName,
          email,
          major,
          year,
          bio,
          university,
          study_habits: studyHabits,
          skills: skillsArray,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      // Update interests
      // First, delete all existing interests
      await supabase
        .from('user_interests')
        .delete()
        .eq('user_id', user.id);

      // Then insert new ones
      if (selectedInterests.length > 0) {
        const interestIds = allInterests
          .filter(interest => selectedInterests.includes(interest.name))
          .map(interest => interest.id);

        const userInterests = interestIds.map(interestId => ({
          user_id: user.id,
          interest_id: interestId,
        }));

        const { error: interestsError } = await supabase
          .from('user_interests')
          .insert(userInterests);

        if (interestsError) throw interestsError;
      }

      // Update courses
      // First, delete all existing courses
      await supabase
        .from('user_courses')
        .delete()
        .eq('user_id', user.id);

      // Then insert new ones
      if (selectedCourses.length > 0) {
        const courseIds = allCourses
          .filter(course => selectedCourses.includes(course.code))
          .map(course => course.id);

        const userCourses = courseIds.map(courseId => ({
          user_id: user.id,
          course_id: courseId,
        }));

        const { error: coursesError } = await supabase
          .from('user_courses')
          .insert(userCourses);

        if (coursesError) throw coursesError;
      }

      showAlert('Success', 'Profile updated successfully');
      router.back();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

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
            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.input}
              placeholder="john@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>University (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="University of Washington"
              value={university}
              onChangeText={setUniversity}
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

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Study Habits (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your study habits and preferences..."
              value={studyHabits}
              onChangeText={setStudyHabits}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Skills (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="List your skills separated by commas (e.g., Python, Java, React)"
              value={skillsText}
              onChangeText={setSkillsText}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Interests (Optional)</Text>
            <Text style={styles.helperText}>Select interests that match your academic and personal passions</Text>
            <View style={styles.chipContainer}>
              {allInterests.map((interest) => (
                <TouchableOpacity
                  key={interest.id}
                  style={[
                    styles.chip,
                    selectedInterests.includes(interest.name) && styles.chipSelected,
                  ]}
                  onPress={() => toggleInterest(interest.name)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedInterests.includes(interest.name) && styles.chipTextSelected,
                    ]}
                  >
                    {interest.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Courses (Optional)</Text>
            <Text style={styles.helperText}>Select courses you are currently taking or have taken</Text>
            <View style={styles.chipContainer}>
              {allCourses.map((course) => (
                <TouchableOpacity
                  key={course.id}
                  style={[
                    styles.chip,
                    selectedCourses.includes(course.code) && styles.chipSelected,
                  ]}
                  onPress={() => toggleCourse(course.code)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedCourses.includes(course.code) && styles.chipTextSelected,
                    ]}
                  >
                    {course.code}
                  </Text>
                  <Text
                    style={[
                      styles.chipSubtext,
                      selectedCourses.includes(course.code) && styles.chipTextSelected,
                    ]}
                  >
                    {course.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  title: {
    ...textStyles.h2,
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
  helperText: {
    ...textStyles.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...textStyles.body2,
    color: colors.textPrimary,
    fontWeight: typography.fontWeightMedium,
  },
  chipTextSelected: {
    color: colors.white,
  },
  chipSubtext: {
    ...textStyles.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
