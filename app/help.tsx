import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, borderRadius, shadows } from '@/constants/theme';
import { textStyles } from '@/constants/styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAlert } from '@/template';

interface HelpItem {
  icon: string;
  title: string;
  description: string;
  action?: () => void;
}

interface FAQItem {
  question: string;
  answer: string;
}

export default function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const handleEmailSupport = () => {
    Linking.openURL('mailto:support@syncup.app?subject=SyncUp Support Request');
  };

  const handleReportBug = () => {
    Linking.openURL('mailto:support@syncup.app?subject=Bug Report');
  };

  const handleFeatureRequest = () => {
    Linking.openURL('mailto:support@syncup.app?subject=Feature Request');
  };

  const helpItems: HelpItem[] = [
    {
      icon: 'mail',
      title: 'Email Support',
      description: 'Get help from our support team',
      action: handleEmailSupport,
    },
    {
      icon: 'bug',
      title: 'Report a Bug',
      description: 'Let us know about any issues',
      action: handleReportBug,
    },
    {
      icon: 'bulb',
      title: 'Feature Request',
      description: 'Suggest new features or improvements',
      action: handleFeatureRequest,
    },
  ];

  const faqs: FAQItem[] = [
    {
      question: 'How do I connect with other students?',
      answer: 'Go to the Explore tab and browse student profiles. Tap the "Connect" button to send a connection request.',
    },
    {
      question: 'How do I join a group?',
      answer: 'Browse groups in the Groups tab. Tap on a group to view details and click "Join Group" to send a request.',
    },
    {
      question: 'How do I create an event?',
      answer: 'Navigate to the Events tab and tap the "+" button to create a new event. Fill in the details and invite your connections.',
    },
    {
      question: 'How do I update my profile?',
      answer: 'Go to the Profile tab and tap "Edit Profile" in the settings section. Update your information and tap "Save Changes".',
    },
    {
      question: 'How do I manage notifications?',
      answer: 'Go to Profile > Notifications to customize what notifications you receive and how you receive them.',
    },
    {
      question: 'How do I change privacy settings?',
      answer: 'Go to Profile > Privacy to control who can see your information and interact with you.',
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>How can we help?</Text>
        <Text style={styles.description}>
          Find answers to common questions or get in touch with our support team
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          {helpItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.helpItem}
              onPress={item.action}
            >
              <View style={styles.helpItemIcon}>
                <Ionicons name={item.icon as any} size={24} color={colors.primary} />
              </View>
              <View style={styles.helpItemContent}>
                <Text style={styles.helpItemTitle}>{item.title}</Text>
                <Text style={styles.helpItemDescription}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          {faqs.map((faq, index) => (
            <View key={index} style={styles.faqItem}>
              <View style={styles.faqQuestion}>
                <Ionicons name="help-circle" size={20} color={colors.primary} />
                <Text style={styles.faqQuestionText}>{faq.question}</Text>
              </View>
              <Text style={styles.faqAnswer}>{faq.answer}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Developer</Text>
              <Text style={styles.infoValue}>SyncUp Team</Text>
            </View>
          </View>
        </View>

        <View style={styles.footerInfo}>
          <Ionicons name="information-circle" size={24} color={colors.primary} />
          <Text style={styles.footerText}>
            We typically respond to support requests within 24 hours during business days.
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
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...textStyles.h4,
    marginBottom: spacing.md,
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  helpItemIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  helpItemContent: {
    flex: 1,
  },
  helpItemTitle: {
    ...textStyles.body1,
    fontWeight: typography.fontWeightSemiBold,
    marginBottom: spacing.xs,
  },
  helpItemDescription: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
  faqItem: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  faqQuestionText: {
    ...textStyles.body1,
    fontWeight: typography.fontWeightSemiBold,
    marginLeft: spacing.sm,
    flex: 1,
  },
  faqAnswer: {
    ...textStyles.body2,
    color: colors.textSecondary,
    lineHeight: typography.lineHeight20,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.small,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  infoLabel: {
    ...textStyles.body1,
    color: colors.textSecondary,
  },
  infoValue: {
    ...textStyles.body1,
    fontWeight: typography.fontWeightSemiBold,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray200,
    marginVertical: spacing.xs,
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  footerText: {
    ...textStyles.body2,
    color: colors.textSecondary,
    marginLeft: spacing.md,
    flex: 1,
  },
});
