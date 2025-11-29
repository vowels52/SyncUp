import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, ScrollView, Platform } from 'react-native';
import { spacing, borderRadius, shadows, typography } from '@/constants/theme';
import { useThemedColors } from '@/hooks/useThemedColors';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useAlert, useTheme } from '@/template';
import { getSupabaseClient } from '@/template';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';

interface Event {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string | null;
  creator_id: string;
  created_at: string;
  event_type: string | null;
  is_official_event: boolean;
}

export default function EventsScreen() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [attendingEventIds, setAttendingEventIds] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showDayEventsModal, setShowDayEventsModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    location: '',
    start_time: new Date(),
    end_time: new Date(),
  });

  // Android picker state (iOS uses compact mode, doesn't need state)
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const colors = useThemedColors();
  const { commonStyles, textStyles } = useThemedStyles();
  const { isDarkMode } = useTheme();

  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  // Refetch events when tab comes into focus (handles events created from home page)
  useFocusEffect(
    React.useCallback(() => {
      fetchEvents();
      fetchUserAttendance();
    }, [])
  );


  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;

      if (data) {
        setEvents(data);
      }
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to fetch events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUserAttendance = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('event_attendees')
        .select('event_id')
        .eq('user_id', user.id)
        .eq('status', 'going');

      if (error) throw error;

      if (data) {
        const eventIds = new Set(data.map(item => item.event_id));
        setAttendingEventIds(eventIds);
      }
    } catch (error: any) {
      console.error('Error fetching attendance:', error.message);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents();
    fetchUserAttendance();
  };

  const handleAttendEvent = async (eventId: string) => {
    if (!user) return;

    const isAttending = attendingEventIds.has(eventId);

    try {
      if (isAttending) {
        // Cancel attendance
        const { error } = await supabase
          .from('event_attendees')
          .delete()
          .eq('event_id', eventId)
          .eq('user_id', user.id);

        if (error) throw error;

        // Update local state
        const newAttendingIds = new Set(attendingEventIds);
        newAttendingIds.delete(eventId);
        setAttendingEventIds(newAttendingIds);

        showAlert('Success', 'Attendance cancelled');
      } else {
        // Add attendance
        const { error } = await supabase
          .from('event_attendees')
          .insert({
            event_id: eventId,
            user_id: user.id,
            status: 'going',
          });

        if (error) throw error;

        // Update local state
        const newAttendingIds = new Set(attendingEventIds);
        newAttendingIds.add(eventId);
        setAttendingEventIds(newAttendingIds);

        showAlert('Success', 'You are now attending this event!');
      }
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to update attendance');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)
        .eq('creator_id', user.id);

      if (error) throw error;

      showAlert('Success', 'Event deleted successfully');
      fetchEvents();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to delete event');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleCreateEvent = async () => {
    if (!user) {
      showAlert('Error', 'You must be logged in to create events');
      return;
    }

    if (!newEvent.title.trim()) {
      showAlert('Error', 'Please enter an event title');
      return;
    }

    try {
      const { error } = await supabase
        .from('events')
        .insert({
          title: newEvent.title,
          description: newEvent.description || null,
          location: newEvent.location || null,
          start_time: newEvent.start_time.toISOString(),
          end_time: newEvent.end_time.toISOString(),
          creator_id: user.id,
          is_official_event: false,
        });

      if (error) throw error;

      showAlert('Success', 'Event created successfully!');
      closeModal();
      fetchEvents();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to create event');
    }
  };

  const closeModal = () => {
    setShowAddModal(false);
    setNewEvent({
      title: '',
      description: '',
      location: '',
      start_time: new Date(),
      end_time: new Date(),
    });
    // Reset Android picker states
    setShowStartDatePicker(false);
    setShowStartTimePicker(false);
    setShowEndDatePicker(false);
    setShowEndTimePicker(false);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days in the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const getEventsForDate = (date: Date | null) => {
    if (!date) return [];

    return events.filter(event => {
      const eventDate = new Date(event.start_time);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const changeMonth = (direction: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentMonth(newDate);
  };

  const handleStartDateConfirm = (selectedDate: Date) => {
    // Preserve the time when changing date
    const newDate = new Date(selectedDate);
    newDate.setHours(newEvent.start_time.getHours());
    newDate.setMinutes(newEvent.start_time.getMinutes());
    setNewEvent({ ...newEvent, start_time: newDate });
  };

  const handleStartTimeConfirm = (selectedTime: Date) => {
    setNewEvent({ ...newEvent, start_time: selectedTime });
  };

  const handleEndDateConfirm = (selectedDate: Date) => {
    // Preserve the time when changing date
    const newDate = new Date(selectedDate);
    newDate.setHours(newEvent.end_time.getHours());
    newDate.setMinutes(newEvent.end_time.getMinutes());
    setNewEvent({ ...newEvent, end_time: newDate });
  };

  const handleEndTimeConfirm = (selectedTime: Date) => {
    setNewEvent({ ...newEvent, end_time: selectedTime });
  };

  // Web-specific handlers for HTML input elements
  const handleWebDateChange = (dateString: string, isStart: boolean) => {
    if (!dateString || dateString.trim() === '') return;

    const date = new Date(dateString + 'T00:00:00');
    if (isNaN(date.getTime())) return; // Invalid date

    if (isStart) {
      const currentTime = newEvent.start_time;
      date.setHours(currentTime.getHours());
      date.setMinutes(currentTime.getMinutes());
      setNewEvent({ ...newEvent, start_time: date });
    } else {
      const currentTime = newEvent.end_time;
      date.setHours(currentTime.getHours());
      date.setMinutes(currentTime.getMinutes());
      setNewEvent({ ...newEvent, end_time: date });
    }
  };

  const handleWebTimeChange = (timeString: string, isStart: boolean) => {
    if (!timeString || timeString.trim() === '') return;

    const [hours, minutes] = timeString.split(':');
    if (!hours || !minutes) return;

    if (isStart) {
      const newDate = new Date(newEvent.start_time);
      newDate.setHours(parseInt(hours, 10));
      newDate.setMinutes(parseInt(minutes, 10));
      setNewEvent({ ...newEvent, start_time: newDate });
    } else {
      const newDate = new Date(newEvent.end_time);
      newDate.setHours(parseInt(hours, 10));
      newDate.setMinutes(parseInt(minutes, 10));
      setNewEvent({ ...newEvent, end_time: newDate });
    }
  };

  const formatDateForInput = (date: Date) => {
    if (!date || isNaN(date.getTime())) {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTimeForInput = (date: Date) => {
    if (!date || isNaN(date.getTime())) {
      return '12:00';
    }
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const getEventCategory = (event: Event) => {
    if (!event.is_official_event) {
      return 'User';
    }

    const eventType = event.event_type?.toLowerCase() || '';

    if (eventType.includes('academic')) return 'Academic';
    if (eventType.includes('social')) return 'Social';
    if (eventType.includes('career') || eventType.includes('application')) return 'Career';
    if (eventType.includes('meeting')) return 'Meeting';
    if (eventType.includes('cultural')) return 'Cultural';
    if (eventType.includes('sport') || eventType.includes('recreation') || eventType.includes('athletic')) return 'Sports';
    if (eventType.includes('campus')) return 'Campus';

    return 'Campus'; // Default for official events
  };

  const getEventColor = (event: Event) => {
    if (!event.is_official_event) {
      return colors.gray400; // User events are gray
    }

    // Color code by event type
    const eventType = event.event_type?.toLowerCase() || '';

    // Academic events
    if (eventType.includes('academic')) {
      return '#3B82F6'; // Blue
    }
    // Social events
    if (eventType.includes('social')) {
      return '#EC4899'; // Pink
    }
    // Career/Application events
    if (eventType.includes('career') || eventType.includes('application')) {
      return '#8B5CF6'; // Purple
    }
    // Meetings
    if (eventType.includes('meeting')) {
      return '#10B981'; // Green
    }
    // Cultural events
    if (eventType.includes('cultural')) {
      return '#F59E0B'; // Orange
    }
    // Sports/Recreational/Athletic
    if (eventType.includes('sport') || eventType.includes('recreation') || eventType.includes('athletic')) {
      return '#EF4444'; // Red
    }
    // Campus Events (default for official events)
    if (eventType.includes('campus')) {
      return '#14B8A6'; // Teal
    }

    // Default fallback
    return colors.primary;
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Academic': return '#3B82F6';
      case 'Social': return '#EC4899';
      case 'Career': return '#8B5CF6';
      case 'Meeting': return '#10B981';
      case 'Cultural': return '#F59E0B';
      case 'Sports': return '#EF4444';
      case 'Campus': return '#14B8A6';
      case 'User': return colors.gray400;
      default: return colors.primary;
    }
  };

  const renderCalendarDay = (date: Date | null, index: number) => {
    if (!date) {
      return <View key={`empty-${index}`} style={styles.calendarDay} />;
    }

    const dayEvents = getEventsForDate(date);
    const isToday = date.toDateString() === new Date().toDateString();

    return (
      <TouchableOpacity
        key={date.toISOString()}
        style={styles.calendarDay}
        onPress={() => {
          setSelectedDate(date);
          setShowDayEventsModal(true);
        }}
      >
        <View style={[styles.dayNumber, isToday && styles.todayNumber]}>
          <Text style={[styles.dayText, isToday && styles.todayText]}>
            {date.getDate()}
          </Text>
        </View>
        <View style={styles.eventIndicators}>
          {dayEvents.slice(0, 3).map((event, idx) => (
            <View
              key={event.id}
              style={[
                styles.eventBox,
                { backgroundColor: getEventColor(event) }
              ]}
            />
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEventItem = ({ item }: { item: Event }) => {
    const isAttending = attendingEventIds.has(item.id);
    const isCreator = user && item.creator_id === user.id;

    return (
      <TouchableOpacity style={styles.eventCard}>
        <View style={[
          styles.eventDateContainer,
          { backgroundColor: getEventColor(item) }
        ]}>
          <Text style={styles.eventMonth}>
            {new Date(item.start_time).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
          </Text>
          <Text style={styles.eventDay}>
            {new Date(item.start_time).getDate()}
          </Text>
        </View>

        <View style={styles.eventContent}>
          <View style={styles.eventTitleRow}>
            <Text style={styles.eventTitle}>{item.title}</Text>
            {item.is_official_event && (
              <View style={styles.officialBadge}>
                <Ionicons name="shield-checkmark" size={14} color={colors.accent} />
                <Text style={styles.officialBadgeText}>Official</Text>
              </View>
            )}
          </View>

          {item.event_type && (
            <Text style={styles.eventType}>{item.event_type}</Text>
          )}

          {item.description && (
            <Text style={styles.eventDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          <View style={styles.eventDetails}>
            {item.location && (
              <View style={styles.eventDetailItem}>
                <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.eventDetailText}>{item.location}</Text>
              </View>
            )}

            <View style={styles.eventDetailItem}>
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.eventDetailText}>
                {formatTime(item.start_time)}
              </Text>
            </View>
          </View>

          <View style={styles.eventActions}>
            <TouchableOpacity
              style={[
                styles.attendButton,
                isAttending && styles.attendingButton
              ]}
              onPress={() => handleAttendEvent(item.id)}
            >
              <Ionicons
                name={isAttending ? "checkmark-circle" : "checkmark-circle-outline"}
                size={18}
                color={isAttending ? colors.primary : colors.white}
              />
              <Text style={[
                styles.attendButtonText,
                isAttending && styles.attendingButtonText
              ]}>
                {isAttending ? 'Attending' : 'Attend'}
              </Text>
            </TouchableOpacity>

            {isCreator && !item.is_official_event && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteEvent(item.id)}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Define styles inside component to use themed colors
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      ...shadows.small,
    },
    title: {
      ...textStyles.h3,
    },
    subtitle: {
      ...textStyles.body2,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    listContent: {
      padding: spacing.md,
      paddingBottom: spacing.xxl,
    },
    eventCard: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      ...shadows.small,
    },
    eventDateContainer: {
      width: 60,
      height: 60,
      borderRadius: borderRadius.sm,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    eventMonth: {
      ...textStyles.caption,
      color: colors.white,
      fontWeight: typography.fontWeightBold,
    },
    eventDay: {
      ...textStyles.h3,
      color: colors.white,
      lineHeight: typography.lineHeight28,
    },
    eventContent: {
      flex: 1,
    },
    eventTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
      flexWrap: 'wrap',
    },
    eventTitle: {
      ...textStyles.body1,
      fontWeight: typography.fontWeightSemiBold,
      flex: 1,
    },
    officialBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary + '15',
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
      gap: 4,
    },
    officialBadgeText: {
      fontSize: 11,
      color: colors.accent,  // Using accent orange for better visibility
      fontWeight: typography.fontWeightSemiBold,
    },
    eventType: {
      ...textStyles.caption,
      color: colors.accent,  // Using accent orange for better visibility
      fontWeight: typography.fontWeightSemiBold,
      marginBottom: spacing.xs,
    },
    eventDescription: {
      ...textStyles.body2,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    eventDetails: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    eventDetailItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    eventDetailText: {
      ...textStyles.caption,
      color: colors.textSecondary,
    },
    eventActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    attendButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.sm,
      gap: spacing.xs,
    },
    attendingButton: {
      backgroundColor: colors.white,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    attendButtonText: {
      ...textStyles.body2,
      color: colors.white,
      fontWeight: typography.fontWeightSemiBold,
    },
    attendingButtonText: {
      color: colors.primary,
    },
    deleteButton: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.error + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    fab: {
      position: 'absolute',
      bottom: spacing.xl,
      right: spacing.lg,
      width: 56,
      height: 56,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      ...shadows.large,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: spacing.xxxl,
    },
    emptyTitle: {
      ...textStyles.h3,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    emptySubtitle: {
      ...textStyles.body2,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    calendarContainer: {
      backgroundColor: colors.surface,
      margin: spacing.md,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      ...shadows.small,
    },
    calendarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    monthButton: {
      padding: spacing.sm,
    },
    monthTitle: {
      ...textStyles.h3,
    },
    weekDaysRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: spacing.sm,
    },
    weekDayText: {
      ...textStyles.caption,
      color: colors.textSecondary,
      fontWeight: typography.fontWeightBold,
      width: 40,
      textAlign: 'center',
    },
    calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    calendarDay: {
      width: '14.28%',
      aspectRatio: 1,
      padding: spacing.xs,
      alignItems: 'center',
    },
    dayNumber: {
      width: 32,
      height: 32,
      borderRadius: borderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    todayNumber: {
      backgroundColor: colors.primary,
    },
    dayText: {
      ...textStyles.body2,
      color: colors.text,
    },
    todayText: {
      color: colors.white,
      fontWeight: typography.fontWeightBold,
    },
    eventIndicators: {
      flexDirection: 'row',
      gap: 2,
      marginTop: spacing.xs,
    },
    eventBox: {
      width: 6,
      height: 6,
      borderRadius: 2,
      backgroundColor: colors.primary,
    },
    legendContainer: {
      backgroundColor: colors.surface,
      margin: spacing.md,
      marginTop: 0,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      ...shadows.small,
    },
    legendHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    legendTitle: {
      ...textStyles.body1,
      fontWeight: typography.fontWeightSemiBold,
      color: colors.textPrimary,
    },
    clearFilterText: {
      ...textStyles.caption,
      color: colors.primary,
      fontWeight: typography.fontWeightSemiBold,
    },
    legendGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minWidth: '30%',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: borderRadius.sm,
    },
    legendItemSelected: {
      backgroundColor: colors.primary + '15',
    },
    legendDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    legendText: {
      ...textStyles.caption,
      color: colors.textSecondary,
    },
    legendTextSelected: {
      color: colors.primary,
      fontWeight: typography.fontWeightSemiBold,
    },
    eventsListSection: {
      padding: spacing.md,
    },
    eventsListHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    sectionTitle: {
      ...textStyles.h3,
    },
    showAllText: {
      ...textStyles.body2,
      color: colors.primary,
      fontWeight: typography.fontWeightSemiBold,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: borderRadius.lg,
      borderTopRightRadius: borderRadius.lg,
      maxHeight: '80%',
      ...shadows.large,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray200,
    },
    modalTitle: {
      ...textStyles.h2,
    },
    modalForm: {
      padding: spacing.lg,
    },
    inputLabel: {
      ...textStyles.body1,
      fontWeight: typography.fontWeightSemiBold,
      marginBottom: spacing.sm,
      marginTop: spacing.md,
      color: colors.text,
    },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.gray300,
      borderRadius: borderRadius.sm,
      padding: spacing.md,
      ...textStyles.body1,
      color: colors.text,
    },
    textArea: {
      height: 100,
      textAlignVertical: 'top',
    },
    dateDisplay: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.gray300,
      borderRadius: borderRadius.sm,
      padding: spacing.md,
      ...textStyles.body1,
      color: colors.textSecondary,
    },
    dateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.gray300,
      borderRadius: borderRadius.sm,
      padding: spacing.md,
      gap: spacing.sm,
    },
    dateButtonText: {
      ...textStyles.body1,
      color: colors.text,
      flex: 1,
    },
    pickerContainer: {
      marginTop: spacing.sm,
      marginBottom: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.gray300,
    },
    doneButton: {
      backgroundColor: colors.primary,
      padding: spacing.sm,
      borderRadius: borderRadius.sm,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    doneButtonText: {
      ...textStyles.body2,
      color: colors.white,
      fontWeight: typography.fontWeightSemiBold,
    },
    createButton: {
      backgroundColor: colors.primary,
      padding: spacing.md,
      borderRadius: borderRadius.sm,
      alignItems: 'center',
      marginTop: spacing.xl,
      marginBottom: spacing.lg,
    },
    createButtonText: {
      ...textStyles.body1,
      color: colors.white,
      fontWeight: typography.fontWeightBold,
    },
    createButtonDisabled: {
      backgroundColor: colors.gray400,
      opacity: 0.5,
    },
    compactPickerContainer: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.gray300,
      borderRadius: borderRadius.sm,
      overflow: 'hidden',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    inlinePickerContainer: {
      marginTop: spacing.sm,
      marginBottom: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.gray300,
    },
    pickerWrapper: {
      height: 200,
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
    },
    picker: {
      width: '100%',
      height: 200,
    },
    dayModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    dayModalContent: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      width: '100%',
      maxWidth: 500,
      maxHeight: '80%',
      ...shadows.large,
    },
    dayModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray200,
    },
    dayModalTitle: {
      ...textStyles.h3,
      flex: 1,
    },
    dayModalScroll: {
      padding: spacing.lg,
    },
    dayModalEmpty: {
      alignItems: 'center',
      paddingVertical: spacing.xxxl,
    },
    dayModalEmptyText: {
      ...textStyles.body1,
      color: colors.textSecondary,
      marginTop: spacing.md,
    },
    dayModalEventCard: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      borderRadius: borderRadius.md,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    dayModalEventIndicator: {
      width: 4,
      backgroundColor: colors.primary,
    },
    dayModalEventContent: {
      flex: 1,
      padding: spacing.md,
    },
    dayModalEventTitle: {
      ...textStyles.body1,
      fontWeight: typography.fontWeightSemiBold,
      marginBottom: spacing.xs,
      flex: 1,
    },
    dayModalEventDescription: {
      ...textStyles.body2,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    dayModalEventDetails: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.sm,
      flexWrap: 'wrap',
    },
    dayModalAttendButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.sm,
      gap: spacing.xs,
    },
    dayModalAttendButtonText: {
      ...textStyles.caption,
      color: colors.white,
      fontWeight: typography.fontWeightSemiBold,
    },
    searchContainer: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xl,
      padding: spacing.lg,
      margin: spacing.md,
      marginTop: 0,
      ...shadows.small,
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: colors.gray200,
    },
    searchIcon: {
      marginRight: spacing.sm,
    },
    searchInput: {
      flex: 1,
      fontSize: typography.fontSize14,
      color: colors.text,
      padding: 0,
    },
    clearButton: {
      padding: spacing.xs,
    },
  });

  if (loading) {
    return (
      <View style={[commonStyles.container, commonStyles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const days = getDaysInMonth(currentMonth);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Filter events by selected category and search query
  const filteredEvents = events.filter(event => {
    // Filter by category
    if (selectedCategory && getEventCategory(event) !== selectedCategory) {
      return false;
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = event.title.toLowerCase().includes(query);
      const matchesDescription = event.description?.toLowerCase().includes(query);
      const matchesLocation = event.location?.toLowerCase().includes(query);
      const matchesType = event.event_type?.toLowerCase().includes(query);

      return matchesTitle || matchesDescription || matchesLocation || matchesType;
    }

    return true;
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Campus Events</Text>
        <Text style={styles.subtitle}>Discover and attend upcoming events</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Calendar Section */}
        <View style={styles.calendarContainer}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthButton}>
              <Ionicons name="chevron-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthButton}>
              <Ionicons name="chevron-forward" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekDaysRow}>
            {weekDays.map(day => (
              <Text key={day} style={styles.weekDayText}>{day}</Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {days.map((day, index) => renderCalendarDay(day, index))}
          </View>
        </View>

        {/* Color Legend */}
        <View style={styles.legendContainer}>
          <View style={styles.legendHeader}>
            <Text style={styles.legendTitle}>Event Categories</Text>
            {selectedCategory && (
              <TouchableOpacity onPress={() => setSelectedCategory(null)}>
                <Text style={styles.clearFilterText}>Clear Filter</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.legendGrid}>
            {['Academic', 'Social', 'Career', 'Meeting', 'Cultural', 'Sports', 'Campus', 'User'].map(category => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.legendItem,
                  selectedCategory === category && styles.legendItemSelected
                ]}
                onPress={() => setSelectedCategory(selectedCategory === category ? null : category)}
              >
                <View style={[styles.legendDot, { backgroundColor: getCategoryColor(category) }]} />
                <Text style={[
                  styles.legendText,
                  selectedCategory === category && styles.legendTextSelected
                ]}>{category}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search events..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Events List Section */}
        <View style={styles.eventsListSection}>
          <View style={styles.eventsListHeader}>
            <Text style={styles.sectionTitle}>
              {selectedCategory ? `${selectedCategory} Events` : 'Upcoming Events'}
            </Text>
            {filteredEvents.length > 5 && (
              <TouchableOpacity onPress={() => setShowAllUpcoming(!showAllUpcoming)}>
                <Text style={styles.showAllText}>
                  {showAllUpcoming ? 'Show Less' : `Show All (${filteredEvents.length})`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {filteredEvents.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={80} color={colors.gray400} />
              <Text style={styles.emptyTitle}>
                {selectedCategory ? `No ${selectedCategory} events` : 'No upcoming events'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {selectedCategory ? 'Try selecting a different category' : 'Check back later or create your own event'}
              </Text>
            </View>
          ) : (
            (showAllUpcoming ? filteredEvents : filteredEvents.slice(0, 5)).map(item => (
              <View key={item.id}>
                {renderEventItem({ item })}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* Day Events Modal */}
      <Modal
        visible={showDayEventsModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDayEventsModal(false)}
      >
        <View style={styles.dayModalOverlay}>
          <View style={styles.dayModalContent}>
            <View style={styles.dayModalHeader}>
              <Text style={styles.dayModalTitle}>
                {selectedDate?.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
              <TouchableOpacity onPress={() => setShowDayEventsModal(false)}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.dayModalScroll} showsVerticalScrollIndicator={false}>
              {selectedDate && getEventsForDate(selectedDate).length === 0 ? (
                <View style={styles.dayModalEmpty}>
                  <Ionicons name="calendar-outline" size={60} color={colors.gray400} />
                  <Text style={styles.dayModalEmptyText}>No events on this day</Text>
                </View>
              ) : (
                selectedDate && getEventsForDate(selectedDate).map(event => (
                  <View key={event.id} style={styles.dayModalEventCard}>
                    <View style={[
                      styles.dayModalEventIndicator,
                      { backgroundColor: getEventColor(event) }
                    ]} />
                    <View style={styles.dayModalEventContent}>
                      <View style={styles.eventTitleRow}>
                        <Text style={styles.dayModalEventTitle}>{event.title}</Text>
                        {event.is_official_event && (
                          <View style={styles.officialBadge}>
                            <Ionicons name="shield-checkmark" size={12} color={colors.primary} />
                            <Text style={styles.officialBadgeText}>Official</Text>
                          </View>
                        )}
                      </View>
                      {event.event_type && (
                        <Text style={styles.eventType}>{event.event_type}</Text>
                      )}
                      {event.description && (
                        <Text style={styles.dayModalEventDescription} numberOfLines={2}>
                          {event.description}
                        </Text>
                      )}
                      <View style={styles.dayModalEventDetails}>
                        <Ionicons name="time-outline" size={16} color={colors.primary} />
                        <Text style={styles.eventDetailText}>
                          {formatTime(event.start_time)}
                        </Text>
                        {event.location && (
                          <>
                            <Ionicons name="location-outline" size={16} color={colors.primary} style={{ marginLeft: spacing.md }} />
                            <Text style={styles.eventDetailText}>{event.location}</Text>
                          </>
                        )}
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.dayModalAttendButton,
                          attendingEventIds.has(event.id) && styles.attendingButton
                        ]}
                        onPress={() => handleAttendEvent(event.id)}
                      >
                        <Ionicons
                          name={attendingEventIds.has(event.id) ? "checkmark-circle" : "checkmark-circle-outline"}
                          size={16}
                          color={attendingEventIds.has(event.id) ? colors.primary : colors.white}
                        />
                        <Text style={[
                          styles.dayModalAttendButtonText,
                          attendingEventIds.has(event.id) && styles.attendingButtonText
                        ]}>
                          {attendingEventIds.has(event.id) ? 'Attending' : 'Attend'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Event Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Event</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Event Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter event title"
                placeholderTextColor={colors.textSecondary}
                value={newEvent.title}
                onChangeText={(text) => setNewEvent({ ...newEvent, title: text })}
              />

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter event description"
                placeholderTextColor={colors.textSecondary}
                value={newEvent.description}
                onChangeText={(text) => setNewEvent({ ...newEvent, description: text })}
                multiline
                numberOfLines={4}
              />

              <Text style={styles.inputLabel}>Location</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter event location"
                placeholderTextColor={colors.textSecondary}
                value={newEvent.location}
                onChangeText={(text) => setNewEvent({ ...newEvent, location: text })}
              />

              <Text style={styles.inputLabel}>Start Date</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={formatDateForInput(newEvent.start_time)}
                  onChange={(e) => handleWebDateChange(e.target.value, true)}
                  style={{
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.gray300,
                    borderRadius: borderRadius.sm,
                    padding: spacing.md,
                    fontSize: 16,
                    fontFamily: 'inherit',
                    width: '100%',
                    color: colors.textPrimary,
                  }}
                />
              ) : Platform.OS === 'ios' ? (
                <View style={styles.compactPickerContainer}>
                  <DateTimePicker
                    value={newEvent.start_time}
                    mode="date"
                    display="compact"
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        handleStartDateConfirm(selectedDate);
                      }
                    }}
                    themeVariant={isDarkMode ? "dark" : "light"}
                  />
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowStartDatePicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={20} color={colors.textPrimary} />
                    <Text style={styles.dateButtonText}>
                      {newEvent.start_time.toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>
                  {showStartDatePicker && (
                    <DateTimePicker
                      value={newEvent.start_time}
                      mode="date"
                      display="default"
                      onChange={(event, selectedDate) => {
                        setShowStartDatePicker(false);
                        if (event.type === 'set' && selectedDate) {
                          handleStartDateConfirm(selectedDate);
                        }
                      }}
                    />
                  )}
                </>
              )}

              <Text style={styles.inputLabel}>Start Time</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="time"
                  value={formatTimeForInput(newEvent.start_time)}
                  onChange={(e) => handleWebTimeChange(e.target.value, true)}
                  style={{
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.gray300,
                    borderRadius: borderRadius.sm,
                    padding: spacing.md,
                    fontSize: 16,
                    fontFamily: 'inherit',
                    width: '100%',
                    color: colors.textPrimary,
                  }}
                />
              ) : Platform.OS === 'ios' ? (
                <View style={styles.compactPickerContainer}>
                  <DateTimePicker
                    value={newEvent.start_time}
                    mode="time"
                    display="compact"
                    onChange={(event, selectedTime) => {
                      if (selectedTime) {
                        handleStartTimeConfirm(selectedTime);
                      }
                    }}
                    themeVariant={isDarkMode ? "dark" : "light"}
                  />
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowStartTimePicker(true)}
                  >
                    <Ionicons name="time-outline" size={20} color={colors.textPrimary} />
                    <Text style={styles.dateButtonText}>
                      {newEvent.start_time.toLocaleTimeString()}
                    </Text>
                  </TouchableOpacity>
                  {showStartTimePicker && (
                    <DateTimePicker
                      value={newEvent.start_time}
                      mode="time"
                      display="default"
                      onChange={(event, selectedTime) => {
                        setShowStartTimePicker(false);
                        if (event.type === 'set' && selectedTime) {
                          handleStartTimeConfirm(selectedTime);
                        }
                      }}
                    />
                  )}
                </>
              )}

              <Text style={styles.inputLabel}>End Date</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={formatDateForInput(newEvent.end_time)}
                  onChange={(e) => handleWebDateChange(e.target.value, false)}
                  style={{
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.gray300,
                    borderRadius: borderRadius.sm,
                    padding: spacing.md,
                    fontSize: 16,
                    fontFamily: 'inherit',
                    width: '100%',
                    color: colors.textPrimary,
                  }}
                />
              ) : Platform.OS === 'ios' ? (
                <View style={styles.compactPickerContainer}>
                  <DateTimePicker
                    value={newEvent.end_time}
                    mode="date"
                    display="compact"
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        handleEndDateConfirm(selectedDate);
                      }
                    }}
                    themeVariant={isDarkMode ? "dark" : "light"}
                  />
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowEndDatePicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={20} color={colors.textPrimary} />
                    <Text style={styles.dateButtonText}>
                      {newEvent.end_time.toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>
                  {showEndDatePicker && (
                    <DateTimePicker
                      value={newEvent.end_time}
                      mode="date"
                      display="default"
                      onChange={(event, selectedDate) => {
                        setShowEndDatePicker(false);
                        if (event.type === 'set' && selectedDate) {
                          handleEndDateConfirm(selectedDate);
                        }
                      }}
                    />
                  )}
                </>
              )}

              <Text style={styles.inputLabel}>End Time</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="time"
                  value={formatTimeForInput(newEvent.end_time)}
                  onChange={(e) => handleWebTimeChange(e.target.value, false)}
                  style={{
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.gray300,
                    borderRadius: borderRadius.sm,
                    padding: spacing.md,
                    fontSize: 16,
                    fontFamily: 'inherit',
                    width: '100%',
                    color: colors.textPrimary,
                  }}
                />
              ) : Platform.OS === 'ios' ? (
                <View style={styles.compactPickerContainer}>
                  <DateTimePicker
                    value={newEvent.end_time}
                    mode="time"
                    display="compact"
                    onChange={(event, selectedTime) => {
                      if (selectedTime) {
                        handleEndTimeConfirm(selectedTime);
                      }
                    }}
                    themeVariant={isDarkMode ? "dark" : "light"}
                  />
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowEndTimePicker(true)}
                  >
                    <Ionicons name="time-outline" size={20} color={colors.textPrimary} />
                    <Text style={styles.dateButtonText}>
                      {newEvent.end_time.toLocaleTimeString()}
                    </Text>
                  </TouchableOpacity>
                  {showEndTimePicker && (
                    <DateTimePicker
                      value={newEvent.end_time}
                      mode="time"
                      display="default"
                      onChange={(event, selectedTime) => {
                        setShowEndTimePicker(false);
                        if (event.type === 'set' && selectedTime) {
                          handleEndTimeConfirm(selectedTime);
                        }
                      }}
                    />
                  )}
                </>
              )}

              <TouchableOpacity
                style={[styles.createButton, !newEvent.title.trim() && styles.createButtonDisabled]}
                onPress={handleCreateEvent}
                disabled={!newEvent.title.trim()}
              >
                <Text style={styles.createButtonText}>Create Event</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
