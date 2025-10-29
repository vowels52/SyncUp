import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, borderRadius, shadows } from '@/constants/theme';
import { textStyles } from '@/constants/styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';

const INTERESTS = [
  'Computer Science', 'Engineering', 'Business', 'Mathematics', 'Physics',
  'Biology', 'Psychology', 'Art & Design', 'Music', 'Sports',
  'Entrepreneurship', 'Research', 'Photography', 'Writing', 'Public Speaking'
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [major, setMajor] = useState('');
  const [year, setYear] = useState('');
  const [bio, setBio] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();

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

  const handleNext = () => {
    if (step === 1) {
      if (!fullName || !major || !year) {
        showAlert('Missing Information', 'Please fill in all fields');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (selectedInterests.length === 0) {
        showAlert('Select Interests', 'Please select at least one interest');
        return;
      }
      handleComplete();
    }
  };

  const handleComplete = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const supabase = getSupabaseClient();

      // Update user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          full_name: fullName,
          major,
          year,
          bio,
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

      router.replace('/(tabs)');
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: step === 1 ? '50%' : '100%' }]} />
        </View>
        <Text style={styles.stepText}>Step {step} of 2</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {step === 1 ? (
          <>
            <Text style={styles.title}>Tell us about yourself</Text>
            <Text style={styles.description}>Help other students find and connect with you</Text>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Major</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Computer Science"
                  value={major}
                  onChangeText={setMajor}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Year</Text>
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
          </>
        ) : (
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
        )}
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
              {step === 1 ? 'Continue' : 'Complete Profile'}
            </Text>
          )}
        </TouchableOpacity>

        {step === 2 && (
          <TouchableOpacity style={styles.backButton} onPress={() => setStep(1)}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

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
});
