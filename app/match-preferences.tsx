import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { typography, spacing, borderRadius, shadows } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useThemedColors } from '@/hooks/useThemedColors';
import { useThemedStyles } from '@/hooks/useThemedStyles';

const MAJOR_OPTIONS = [
  'Computer Science',
  'Engineering',
  'Business',
  'Mathematics',
  'Physics',
  'Biology',
  'Chemistry',
  'Psychology',
  'Art & Design',
  'Music',
  'English',
  'History',
  'Political Science',
  'Economics',
];

const YEAR_OPTIONS = ['Freshman', 'Sophomore', 'Junior', 'Senior'];

interface MatchPreferences {
  id?: string;
  user_id: string;
  preferred_majors: string[] | null;
  preferred_years: string[] | null;
  preferred_study_habits: string | null;
  min_shared_interests: number;
  min_shared_courses: number;
  show_only_same_university: boolean;
}

export default function MatchPreferencesScreen() {
  const colors = useThemedColors();
  const { commonStyles, textStyles } = useThemedStyles();
  const [preferences, setPreferences] = useState<MatchPreferences | null>(null);
  const [preferredMajors, setPreferredMajors] = useState<string[]>([]);
  const [preferredYears, setPreferredYears] = useState<string[]>([]);
  const [preferredStudyHabits, setPreferredStudyHabits] = useState('');
  const [minSharedInterests, setMinSharedInterests] = useState(1);
  const [minSharedCourses, setMinSharedCourses] = useState(0);
  const [showOnlySameUniversity, setShowOnlySameUniversity] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  useEffect(() => {
    fetchPreferences();
  }, [user]);

  const fetchPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_match_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 means no rows returned, which is fine for first time
        throw error;
      }

      if (data) {
        setPreferences(data);
        setPreferredMajors(data.preferred_majors || []);
        setPreferredYears(data.preferred_years || []);
        setPreferredStudyHabits(data.preferred_study_habits || '');
        setMinSharedInterests(data.min_shared_interests ?? 1);
        setMinSharedCourses(data.min_shared_courses ?? 0);
        setShowOnlySameUniversity(data.show_only_same_university ?? true);
      }
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to fetch preferences');
    } finally {
      setLoading(false);
    }
  };

  const toggleMajor = (major: string) => {
    if (preferredMajors.includes(major)) {
      setPreferredMajors(preferredMajors.filter(m => m !== major));
    } else {
      setPreferredMajors([...preferredMajors, major]);
    }
  };

  const toggleYear = (year: string) => {
    if (preferredYears.includes(year)) {
      setPreferredYears(preferredYears.filter(y => y !== year));
    } else {
      setPreferredYears([...preferredYears, year]);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const preferencesData: Partial<MatchPreferences> = {
        user_id: user.id,
        preferred_majors: preferredMajors.length > 0 ? preferredMajors : null,
        preferred_years: preferredYears.length > 0 ? preferredYears : null,
        preferred_study_habits: preferredStudyHabits || null,
        min_shared_interests: minSharedInterests,
        min_shared_courses: minSharedCourses,
        show_only_same_university: showOnlySameUniversity,
      };

      if (preferences?.id) {
        // Update existing preferences
        const { error } = await supabase
          .from('user_match_preferences')
          .update({
            ...preferencesData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', preferences.id);

        if (error) throw error;
      } else {
        // Create new preferences
        const { error } = await supabase
          .from('user_match_preferences')
          .insert(preferencesData);

        if (error) throw error;
      }

      showAlert('Success', 'Match preferences updated successfully');
      router.back();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to update preferences');
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
      marginBottom: spacing.lg,
    },
    label: {
      ...textStyles.body2,
      color: colors.textPrimary,
      fontWeight: typography.fontWeightSemiBold,
      marginBottom: spacing.xs,
    },
    helperText: {
      ...textStyles.caption,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
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
      minHeight: 80,
      paddingTop: spacing.md,
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
    sliderContainer: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    numberButton: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.gray200,
      alignItems: 'center',
    },
    numberButtonSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    numberButtonText: {
      ...textStyles.body2,
      color: colors.textPrimary,
      fontWeight: typography.fontWeightSemiBold,
    },
    numberButtonTextSelected: {
      color: colors.white,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.gray200,
    },
    switchLeft: {
      flex: 1,
      marginRight: spacing.md,
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
        <Text style={styles.headerTitle}>Match Preferences</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Customize Your Matches</Text>
        <Text style={styles.description}>
          Set your preferences to find the best study partners and connections
        </Text>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Preferred Majors (Optional)</Text>
            <Text style={styles.helperText}>
              Select majors you'd like to match with. Leave empty for all majors.
            </Text>
            <View style={styles.chipContainer}>
              {MAJOR_OPTIONS.map((major) => (
                <TouchableOpacity
                  key={major}
                  style={[
                    styles.chip,
                    preferredMajors.includes(major) && styles.chipSelected,
                  ]}
                  onPress={() => toggleMajor(major)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      preferredMajors.includes(major) && styles.chipTextSelected,
                    ]}
                  >
                    {major}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Preferred Years (Optional)</Text>
            <Text style={styles.helperText}>
              Select academic years you'd like to match with. Leave empty for all years.
            </Text>
            <View style={styles.chipContainer}>
              {YEAR_OPTIONS.map((year) => (
                <TouchableOpacity
                  key={year}
                  style={[
                    styles.chip,
                    preferredYears.includes(year) && styles.chipSelected,
                  ]}
                  onPress={() => toggleYear(year)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      preferredYears.includes(year) && styles.chipTextSelected,
                    ]}
                  >
                    {year}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Preferred Study Habits (Optional)</Text>
            <Text style={styles.helperText}>
              Describe the study habits you're looking for in a study partner
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g., Prefers group study, early morning sessions, library studying..."
              value={preferredStudyHabits}
              onChangeText={setPreferredStudyHabits}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Minimum Shared Interests</Text>
            <Text style={styles.helperText}>
              Require at least this many interests in common (Current: {minSharedInterests})
            </Text>
            <View style={styles.sliderContainer}>
              {[0, 1, 2, 3, 4, 5].map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.numberButton,
                    minSharedInterests === num && styles.numberButtonSelected,
                  ]}
                  onPress={() => setMinSharedInterests(num)}
                >
                  <Text
                    style={[
                      styles.numberButtonText,
                      minSharedInterests === num && styles.numberButtonTextSelected,
                    ]}
                  >
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Minimum Shared Courses</Text>
            <Text style={styles.helperText}>
              Require at least this many courses in common (Current: {minSharedCourses})
            </Text>
            <View style={styles.sliderContainer}>
              {[0, 1, 2, 3, 4, 5].map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.numberButton,
                    minSharedCourses === num && styles.numberButtonSelected,
                  ]}
                  onPress={() => setMinSharedCourses(num)}
                >
                  <Text
                    style={[
                      styles.numberButtonText,
                      minSharedCourses === num && styles.numberButtonTextSelected,
                    ]}
                  >
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.switchRow}>
              <View style={styles.switchLeft}>
                <Text style={styles.label}>Same University Only</Text>
                <Text style={styles.helperText}>
                  Only show matches from your university
                </Text>
              </View>
              <Switch
                value={showOnlySameUniversity}
                onValueChange={setShowOnlySameUniversity}
                trackColor={{ false: colors.gray300, true: colors.primary }}
                thumbColor={colors.white}
              />
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
            <Text style={styles.primaryButtonText}>Save Preferences</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
