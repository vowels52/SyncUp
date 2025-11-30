import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, BackHandler, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { typography, spacing, borderRadius, shadows } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useThemedColors } from '@/hooks/useThemedColors';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { pickImage } from '@/template/core/imageUpload';
import { updateProfileImage } from '@/template/core/profileImageService';

const INTERESTS = [
  'Computer Science', 'Engineering', 'Business', 'Mathematics', 'Physics',
  'Biology', 'Psychology', 'Art & Design', 'Music', 'Sports',
  'Entrepreneurship', 'Research', 'Photography', 'Writing', 'Public Speaking'
];

export default function OnboardingScreen() {
  const colors = useThemedColors();
  const { commonStyles, textStyles } = useThemedStyles();
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [major, setMajor] = useState('');
  const [year, setYear] = useState('');
  const [bio, setBio] = useState('');
  const [university, setUniversity] = useState('');
  const [studyHabits, setStudyHabits] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [allCourses, setAllCourses] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  // Prevent users from going back during onboarding
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Return true to prevent default back behavior
      return true;
    });

    return () => backHandler.remove();
  }, []);

  // Fetch available courses
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const { data, error } = await supabase
          .from('courses')
          .select('id, code, name')
          .order('code');

        if (error) throw error;
        if (data) setAllCourses(data);
      } catch (error: any) {
        console.error('Failed to fetch courses:', error);
      }
    };

    fetchCourses();
  }, []);

  const handleChangeProfileImage = async () => {
    if (!user) return;

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
        profileImageUrl
      );

      // Update local state
      setProfileImageUrl(imageUrl);
    } catch (error: any) {
      console.error('Failed to upload profile image:', error);
      showAlert('Error', error.message || 'Failed to upload profile picture');
    } finally {
      setUploadingImage(false);
    }
  };

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else {
      if (selectedInterests.length < 5) {
        setSelectedInterests([...selectedInterests, interest]);
      } else {
        showAlert('Limit Reached', 'You can select up to 5 interests');
      }
    }
  };

  const toggleCourse = (courseCode: string) => {
    if (selectedCourses.includes(courseCode)) {
      setSelectedCourses(selectedCourses.filter(c => c !== courseCode));
    } else {
      setSelectedCourses([...selectedCourses, courseCode]);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!fullName || !major || !year) {
        showAlert('Missing Information', 'Please fill in all required fields');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      // Step 2 fields are all optional, so we can just move to next step
      setStep(3);
    } else if (step === 3) {
      if (selectedInterests.length === 0) {
        showAlert('Select Interests', 'Please select at least one interest');
        return;
      }
      setStep(4);
    } else if (step === 4) {
      // Courses are optional, so we can complete even if none selected
      handleComplete();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleComplete = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const supabase = getSupabaseClient();

      // Convert skills text to array
      const skillsArray = skillsText
        .split(',')
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0);

      // Update user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          full_name: fullName,
          major,
          year,
          bio,
          university,
          study_habits: studyHabits,
          skills: skillsArray,
          profile_image_url: profileImageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Get interest IDs
      const { data: interests, error: interestsError } = await supabase
        .from('interests')
        .select('id, name')
        .in('name', selectedInterests);

      if (interestsError) throw interestsError;

      // Insert user interests
      if (interests && interests.length > 0) {
        const userInterests = interests.map(interest => ({
          user_id: user.id,
          interest_id: interest.id,
        }));

        const { error: insertError } = await supabase
          .from('user_interests')
          .insert(userInterests);

        if (insertError) throw insertError;
      }

      // Insert user courses
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

      router.replace('/(tabs)');
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      padding: spacing.md,
      backgroundColor: colors.surface,
      ...shadows.small,
    },
    progressContainer: {
      height: 4,
      backgroundColor: colors.gray200,
      borderRadius: borderRadius.xs,
      marginBottom: spacing.sm,
    },
    progressBar: {
      height: 4,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.xs,
    },
    stepText: {
      ...textStyles.caption,
      color: colors.textSecondary,
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
    interestsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    interestChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.gray200,
    },
    interestChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    interestChipText: {
      ...textStyles.body2,
      color: colors.textPrimary,
    },
    interestChipTextActive: {
      color: colors.white,
      fontWeight: typography.fontWeightSemiBold,
    },
    checkIcon: {
      marginLeft: spacing.xs,
    },
    selectedCount: {
      ...textStyles.caption,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.md,
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
    backButton: {
      marginTop: spacing.sm,
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    backButtonText: {
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
    chipContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    courseChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.gray200,
    },
    courseChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    courseChipText: {
      ...textStyles.body2,
      color: colors.textPrimary,
      fontWeight: typography.fontWeightMedium,
    },
    courseChipTextSelected: {
      color: colors.white,
    },
    courseChipSubtext: {
      ...textStyles.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${(step / 4) * 100}%` }]} />
        </View>
        <Text style={styles.stepText}>Step {step} of 4</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {step === 1 ? (
          <>
            <Text style={styles.title}>Tell us about yourself</Text>
            <Text style={styles.description}>Help other students find and connect with you</Text>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor={colors.textSecondary}
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Major *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Computer Science"
                  placeholderTextColor={colors.textSecondary}
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
            </View>
          </>
        ) : step === 2 ? (
          <>
            <Text style={styles.title}>Additional details</Text>
            <Text style={styles.description}>Help others learn more about you (all optional)</Text>

            <View style={styles.profileImageSection}>
              <View style={styles.profileImageContainer}>
                <TouchableOpacity
                  style={styles.profileImageTouchable}
                  onPress={handleChangeProfileImage}
                  disabled={uploadingImage}
                >
                  {profileImageUrl ? (
                    <Image
                      source={{ uri: profileImageUrl }}
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
              </View>
              <Text style={styles.profileImageLabel}>Tap to add profile picture</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Bio (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Tell us a bit about yourself..."
                  placeholderTextColor={colors.textSecondary}
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>University (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="University of Washington Bothell"
                  placeholderTextColor={colors.textSecondary}
                  value={university}
                  onChangeText={setUniversity}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Study Habits (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Describe your study habits and preferences..."
                  placeholderTextColor={colors.textSecondary}
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
                  placeholderTextColor={colors.textSecondary}
                  value={skillsText}
                  onChangeText={setSkillsText}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>
          </>
        ) : step === 3 ? (
          <>
            <Text style={styles.title}>Select your interests</Text>
            <Text style={styles.description}>Choose up to 5 interests to help us match you with peers</Text>

            <View style={styles.interestsContainer}>
              {INTERESTS.map((interest) => (
                <TouchableOpacity
                  key={interest}
                  style={[
                    styles.interestChip,
                    selectedInterests.includes(interest) && styles.interestChipActive,
                  ]}
                  onPress={() => toggleInterest(interest)}
                >
                  <Text
                    style={[
                      styles.interestChipText,
                      selectedInterests.includes(interest) && styles.interestChipTextActive,
                    ]}
                  >
                    {interest}
                  </Text>
                  {selectedInterests.includes(interest) && (
                    <Ionicons name="checkmark-circle" size={18} color={colors.white} style={styles.checkIcon} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.selectedCount}>
              {selectedInterests.length} of 5 selected
            </Text>
          </>
        ) : step === 4 ? (
          <>
            <Text style={styles.title}>Select your courses</Text>
            <Text style={styles.description}>Choose courses you are currently taking or have taken</Text>

            <View style={styles.chipContainer}>
              {allCourses.map((course) => (
                <TouchableOpacity
                  key={course.id}
                  style={[
                    styles.courseChip,
                    selectedCourses.includes(course.code) && styles.courseChipSelected,
                  ]}
                  onPress={() => toggleCourse(course.code)}
                >
                  <Text
                    style={[
                      styles.courseChipText,
                      selectedCourses.includes(course.code) && styles.courseChipTextSelected,
                    ]}
                  >
                    {course.code}
                  </Text>
                  <Text
                    style={[
                      styles.courseChipSubtext,
                      selectedCourses.includes(course.code) && styles.courseChipTextSelected,
                    ]}
                  >
                    {course.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.selectedCount}>
              {selectedCourses.length} selected
            </Text>
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleNext}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {step === 4 ? 'Complete Profile' : 'Continue'}
            </Text>
          )}
        </TouchableOpacity>

        {step > 1 && (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}