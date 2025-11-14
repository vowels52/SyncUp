import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, borderRadius, shadows } from '@/constants/theme';
import { textStyles } from '@/constants/styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';

interface PrivacySettings {
  profile_visible: boolean;
  show_email: boolean;
  show_major: boolean;
  allow_connection_requests: boolean;
  allow_group_invites: boolean;
  allow_event_invites: boolean;
  search_visibility: boolean;
}

export default function PrivacyScreen() {
  const [settings, setSettings] = useState<PrivacySettings>({
    profile_visible: true,
    show_email: false,
    show_major: true,
    allow_connection_requests: true,
    allow_group_invites: true,
    allow_event_invites: true,
    search_visibility: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  useEffect(() => {
    fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('privacy_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings(data);
      }
    } catch (error: any) {
      console.error('Failed to fetch privacy settings:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: keyof PrivacySettings, value: boolean) => {
    if (!user) return;

    setSettings({ ...settings, [key]: value });
    setSaving(true);

    try {
      const { error } = await supabase
        .from('privacy_settings')
        .upsert({
          user_id: user.id,
          ...settings,
          [key]: value,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
    } catch (error: any) {
      showAlert('Error', 'Failed to update privacy settings');
      setSettings({ ...settings, [key]: !value });
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
        <Text style={styles.headerTitle}>Privacy</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Privacy Settings</Text>
        <Text style={styles.description}>
          Control who can see your information and interact with you
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Visibility</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="eye" size={24} color={colors.primary} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Profile Visible</Text>
                <Text style={styles.settingDescription}>
                  Make your profile visible to other students
                </Text>
              </View>
            </View>
            <Switch
              value={settings.profile_visible}
              onValueChange={(value) => updateSetting('profile_visible', value)}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
              disabled={saving}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="search" size={24} color={colors.primary} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Search Visibility</Text>
                <Text style={styles.settingDescription}>
                  Allow others to find you in search results
                </Text>
              </View>
            </View>
            <Switch
              value={settings.search_visibility}
              onValueChange={(value) => updateSetting('search_visibility', value)}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
              disabled={saving}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="mail" size={24} color={colors.primary} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Show Email</Text>
                <Text style={styles.settingDescription}>
                  Display your email on your public profile
                </Text>
              </View>
            </View>
            <Switch
              value={settings.show_email}
              onValueChange={(value) => updateSetting('show_email', value)}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
              disabled={saving}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="school" size={24} color={colors.primary} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Show Major</Text>
                <Text style={styles.settingDescription}>
                  Display your major on your public profile
                </Text>
              </View>
            </View>
            <Switch
              value={settings.show_major}
              onValueChange={(value) => updateSetting('show_major', value)}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
              disabled={saving}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interactions</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="person-add" size={24} color={colors.accent} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Connection Requests</Text>
                <Text style={styles.settingDescription}>
                  Allow others to send you connection requests
                </Text>
              </View>
            </View>
            <Switch
              value={settings.allow_connection_requests}
              onValueChange={(value) => updateSetting('allow_connection_requests', value)}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
              disabled={saving}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={settings.settingInfo}>
              <Ionicons name="people" size={24} color={colors.accent} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Group Invites</Text>
                <Text style={styles.settingDescription}>
                  Allow others to invite you to groups
                </Text>
              </View>
            </View>
            <Switch
              value={settings.allow_group_invites}
              onValueChange={(value) => updateSetting('allow_group_invites', value)}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
              disabled={saving}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="calendar" size={24} color={colors.accent} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Event Invites</Text>
                <Text style={styles.settingDescription}>
                  Allow others to invite you to events
                </Text>
              </View>
            </View>
            <Switch
              value={settings.allow_event_invites}
              onValueChange={(value) => updateSetting('allow_event_invites', value)}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
              disabled={saving}
            />
          </View>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
          <Text style={styles.infoText}>
            Your privacy is important to us. These settings help you control your experience on SyncUp.
          </Text>
        </View>
      </ScrollView>
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
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...textStyles.h4,
    marginBottom: spacing.md,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.md,
  },
  settingText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  settingLabel: {
    ...textStyles.body1,
    fontWeight: typography.fontWeightSemiBold,
    marginBottom: spacing.xs,
  },
  settingDescription: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight || colors.gray100,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  infoText: {
    ...textStyles.body2,
    color: colors.textSecondary,
    marginLeft: spacing.md,
    flex: 1,
  },
});
