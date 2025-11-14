import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, borderRadius, shadows } from '@/constants/theme';
import { textStyles } from '@/constants/styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';

interface NotificationSettings {
  push_enabled: boolean;
  email_enabled: boolean;
  connection_requests: boolean;
  group_invites: boolean;
  event_reminders: boolean;
  event_updates: boolean;
  messages: boolean;
}

export default function NotificationsScreen() {
  const [settings, setSettings] = useState<NotificationSettings>({
    push_enabled: true,
    email_enabled: true,
    connection_requests: true,
    group_invites: true,
    event_reminders: true,
    event_updates: true,
    messages: true,
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
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings(data);
      }
    } catch (error: any) {
      console.error('Failed to fetch notification settings:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: keyof NotificationSettings, value: boolean) => {
    if (!user) return;

    setSettings({ ...settings, [key]: value });
    setSaving(true);

    try {
      const { error } = await supabase
        .from('notification_settings')
        .upsert({
          user_id: user.id,
          ...settings,
          [key]: value,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
    } catch (error: any) {
      showAlert('Error', 'Failed to update notification settings');
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
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Notification Preferences</Text>
        <Text style={styles.description}>
          Customize how you receive notifications about your activity
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications" size={24} color={colors.primary} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.settingDescription}>
                  Receive push notifications on your device
                </Text>
              </View>
            </View>
            <Switch
              value={settings.push_enabled}
              onValueChange={(value) => updateSetting('push_enabled', value)}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
              disabled={saving}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="mail" size={24} color={colors.primary} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Email Notifications</Text>
                <Text style={styles.settingDescription}>
                  Receive notifications via email
                </Text>
              </View>
            </View>
            <Switch
              value={settings.email_enabled}
              onValueChange={(value) => updateSetting('email_enabled', value)}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
              disabled={saving}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="person-add" size={24} color={colors.accent} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Connection Requests</Text>
                <Text style={styles.settingDescription}>
                  When someone wants to connect with you
                </Text>
              </View>
            </View>
            <Switch
              value={settings.connection_requests}
              onValueChange={(value) => updateSetting('connection_requests', value)}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
              disabled={saving}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="people" size={24} color={colors.accent} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Group Invites</Text>
                <Text style={styles.settingDescription}>
                  When you're invited to join a group
                </Text>
              </View>
            </View>
            <Switch
              value={settings.group_invites}
              onValueChange={(value) => updateSetting('group_invites', value)}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
              disabled={saving}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="chatbubbles" size={24} color={colors.accent} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Messages</Text>
                <Text style={styles.settingDescription}>
                  When you receive a new message
                </Text>
              </View>
            </View>
            <Switch
              value={settings.messages}
              onValueChange={(value) => updateSetting('messages', value)}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
              disabled={saving}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Events</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="alarm" size={24} color={colors.success} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Event Reminders</Text>
                <Text style={styles.settingDescription}>
                  Reminders before events you're attending
                </Text>
              </View>
            </View>
            <Switch
              value={settings.event_reminders}
              onValueChange={(value) => updateSetting('event_reminders', value)}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
              disabled={saving}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Ionicons name="calendar" size={24} color={colors.success} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Event Updates</Text>
                <Text style={styles.settingDescription}>
                  When event details change
                </Text>
              </View>
            </View>
            <Switch
              value={settings.event_updates}
              onValueChange={(value) => updateSetting('event_updates', value)}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
              disabled={saving}
            />
          </View>
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
});
