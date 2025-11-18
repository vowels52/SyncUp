import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { spacing, borderRadius, shadows, typography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useThemedColors } from '@/hooks/useThemedColors';
import { useThemedStyles } from '@/hooks/useThemedStyles';

interface Event {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string | null;
  creator_id: string;
  event_type: string | null;
  is_official_event: boolean;
}

export default function EventDetailScreen() {
  const colors = useThemedColors();
  const { commonStyles, textStyles } = useThemedStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAttending, setIsAttending] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchEventDetails();
    if (user) {
      checkAttendance();
    }
  }, [id, user]);

  const fetchEventDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setEvent(data);

      // Get attendee count
      const { count } = await supabase
        .from('event_attendees')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', id);

      setAttendeeCount(count || 0);
    } catch (error) {
      console.error('Error fetching event details:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkAttendance = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('event_attendees')
        .select('id')
        .eq('event_id', id)
        .eq('user_id', user.id)
        .single();

      setIsAttending(!!data);
    } catch (error) {
      setIsAttending(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // Events are only shown on home, so default to home tab
      router.replace('/(tabs)');
    }
  };

  const handleAttendEvent = async () => {
    if (!user || !event) return;

    setUpdating(true);
    try {
      if (isAttending) {
        // Cancel attendance
        const { error } = await supabase
          .from('event_attendees')
          .delete()
          .eq('event_id', event.id)
          .eq('user_id', user.id);

        if (error) throw error;
        setIsAttending(false);
        setAttendeeCount((prev) => Math.max(0, prev - 1));
        showAlert('Success', 'You are no longer attending this event');
      } else {
        // Attend event
        const { error } = await supabase
          .from('event_attendees')
          .insert({
            event_id: event.id,
            user_id: user.id,
            status: 'going',
          });

        if (error) throw error;
        setIsAttending(true);
        setAttendeeCount((prev) => prev + 1);
        showAlert('Success', 'You are now attending this event!');
      }
    } catch (error: any) {
      if (error.message?.includes('duplicate key')) {
        showAlert('Info', 'You are already attending this event');
      } else {
        showAlert('Error', error.message || 'Failed to update attendance');
      }
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getEventColor = (event: Event) => {
    if (!event.is_official_event) {
      return colors.gray400;
    }

    const eventType = event.event_type?.toLowerCase() || '';

    if (eventType.includes('academic')) return '#3B82F6';
    if (eventType.includes('social')) return '#EC4899';
    if (eventType.includes('career') || eventType.includes('application')) return '#8B5CF6';
    if (eventType.includes('meeting')) return '#10B981';
    if (eventType.includes('cultural')) return '#F59E0B';
    if (eventType.includes('sport') || eventType.includes('recreation') || eventType.includes('athletic')) return '#EF4444';
    if (eventType.includes('campus')) return '#14B8A6';

    return colors.primary;
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
    dateBanner: {
      width: '100%',
      paddingVertical: spacing.xl,
      alignItems: 'center',
    },
    dateMonth: {
      fontSize: typography.fontSize16,
      fontWeight: typography.fontWeightBold,
      color: colors.white,
      letterSpacing: 2,
    },
    dateDay: {
      fontSize: 64,
      fontWeight: typography.fontWeightBold,
      color: colors.white,
      lineHeight: 72,
    },
    dateYear: {
      fontSize: typography.fontSize16,
      color: colors.white,
      opacity: 0.9,
    },
    infoSection: {
      padding: spacing.lg,
    },
    eventTitle: {
      fontSize: typography.fontSize24,
      fontWeight: typography.fontWeightBold,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    officialBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    officialText: {
      fontSize: typography.fontSize14,
      color: colors.primary,
      fontWeight: typography.fontWeightSemiBold,
    },
    typeBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      marginBottom: spacing.lg,
    },
    typeText: {
      fontSize: typography.fontSize12,
      fontWeight: typography.fontWeightSemiBold,
    },
    detailsContainer: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      gap: spacing.md,
      ...shadows.small,
      marginBottom: spacing.lg,
    },
    detailItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    detailText: {
      fontSize: typography.fontSize14,
      color: colors.textPrimary,
      flex: 1,
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
    attendButton: {
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      marginTop: spacing.md,
    },
    cancelButton: {
      backgroundColor: colors.error,
    },
    buttonIcon: {
      marginRight: spacing.sm,
    },
    attendButtonText: {
      fontSize: typography.fontSize16,
      fontWeight: typography.fontWeightBold,
      color: colors.surface,
    },
    attendingStatusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      marginTop: spacing.md,
    },
    attendingStatusText: {
      fontSize: typography.fontSize14,
      color: colors.success,
      fontWeight: typography.fontWeightSemiBold,
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

  if (!event) {
    return (
      <View style={[commonStyles.container, commonStyles.centerContent]}>
        <Text style={styles.errorText}>Event not found</Text>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const eventColor = getEventColor(event);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event Details</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Date Banner */}
        <View style={[styles.dateBanner, { backgroundColor: eventColor }]}>
          <Text style={styles.dateMonth}>
            {new Date(event.start_time).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
          </Text>
          <Text style={styles.dateDay}>{new Date(event.start_time).getDate()}</Text>
          <Text style={styles.dateYear}>{new Date(event.start_time).getFullYear()}</Text>
        </View>

        {/* Event Info */}
        <View style={styles.infoSection}>
          <Text style={styles.eventTitle}>{event.title}</Text>

          {event.is_official_event && (
            <View style={styles.officialBadge}>
              <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
              <Text style={styles.officialText}>Official UWB Event</Text>
            </View>
          )}

          {event.event_type && (
            <View style={[styles.typeBadge, { backgroundColor: eventColor + '20' }]}>
              <Text style={[styles.typeText, { color: eventColor }]}>{event.event_type}</Text>
            </View>
          )}

          {/* Event Details */}
          <View style={styles.detailsContainer}>
            <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              <Text style={styles.detailText}>{formatDate(event.start_time)}</Text>
            </View>

            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={20} color={colors.primary} />
              <Text style={styles.detailText}>
                {formatTime(event.start_time)}
                {event.end_time && ` - ${formatTime(event.end_time)}`}
              </Text>
            </View>

            {event.location && (
              <View style={styles.detailItem}>
                <Ionicons name="location-outline" size={20} color={colors.primary} />
                <Text style={styles.detailText}>{event.location}</Text>
              </View>
            )}

            <View style={styles.detailItem}>
              <Ionicons name="people-outline" size={20} color={colors.primary} />
              <Text style={styles.detailText}>
                {attendeeCount} {attendeeCount === 1 ? 'person' : 'people'} attending
              </Text>
            </View>
          </View>

          {/* Description */}
          {event.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this Event</Text>
              <Text style={styles.description}>{event.description}</Text>
            </View>
          )}

          {/* Attend Button */}
          {user && (
            <TouchableOpacity
              style={[styles.attendButton, isAttending && styles.cancelButton]}
              onPress={handleAttendEvent}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <>
                  <Ionicons
                    name={isAttending ? 'close-circle' : 'checkmark-circle'}
                    size={24}
                    color={colors.surface}
                    style={styles.buttonIcon}
                  />
                  <Text style={styles.attendButtonText}>
                    {isAttending ? 'Cancel Attendance' : 'Attend Event'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {isAttending && (
            <View style={styles.attendingStatusBadge}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.attendingStatusText}>You are attending this event</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}