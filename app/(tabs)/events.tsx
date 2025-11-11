import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, ScrollView, Platform } from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '@/constants/theme';
import { textStyles, commonStyles } from '@/constants/styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Event {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string | null;
  creator_id: string;
  created_at: string;
}

export default function EventsScreen() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Form state
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    location: '',
    start_time: new Date(),
    end_time: new Date(),
  });

  // Date/time picker state
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();

  useEffect(() => {
    fetchEvents();
  }, []);

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

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents();
  };

  const handleAttendEvent = async (eventId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('event_attendees')
        .insert({
          event_id: eventId,
          user_id: user.id,
          status: 'going',
        });

      if (error) throw error;

      showAlert('Success', 'You are now attending this event!');
    } catch (error: any) {
      if (error.message?.includes('duplicate key')) {
        showAlert('Info', 'You are already attending this event');
      } else {
        showAlert('Error', error.message || 'Failed to RSVP');
      }
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

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    // On Android, always close picker after interaction
    if (Platform.OS === 'android') {
      setShowStartDatePicker(false);
    }

    // Update value if user confirmed (not cancelled)
    if (selectedDate && event.type !== 'dismissed') {
      // Preserve the time when changing date
      const newDate = new Date(selectedDate);
      newDate.setHours(newEvent.start_time.getHours());
      newDate.setMinutes(newEvent.start_time.getMinutes());
      setNewEvent({ ...newEvent, start_time: newDate });
    } else if (event.type === 'dismissed' && Platform.OS === 'android') {
      // User cancelled on Android
      setShowStartDatePicker(false);
    }
  };

  const handleStartTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartTimePicker(false);
    }

    if (selectedTime && event.type !== 'dismissed') {
      setNewEvent({ ...newEvent, start_time: selectedTime });
    } else if (event.type === 'dismissed' && Platform.OS === 'android') {
      setShowStartTimePicker(false);
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndDatePicker(false);
    }

    if (selectedDate && event.type !== 'dismissed') {
      // Preserve the time when changing date
      const newDate = new Date(selectedDate);
      newDate.setHours(newEvent.end_time.getHours());
      newDate.setMinutes(newEvent.end_time.getMinutes());
      setNewEvent({ ...newEvent, end_time: newDate });
    } else if (event.type === 'dismissed' && Platform.OS === 'android') {
      setShowEndDatePicker(false);
    }
  };

  const handleEndTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndTimePicker(false);
    }

    if (selectedTime && event.type !== 'dismissed') {
      setNewEvent({ ...newEvent, end_time: selectedTime });
    } else if (event.type === 'dismissed' && Platform.OS === 'android') {
      setShowEndTimePicker(false);
    }
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

  const renderCalendarDay = (date: Date | null, index: number) => {
    if (!date) {
      return <View key={`empty-${index}`} style={styles.calendarDay} />;
    }

    const dayEvents = getEventsForDate(date);
    const isToday = date.toDateString() === new Date().toDateString();

    return (
      <View key={date.toISOString()} style={styles.calendarDay}>
        <View style={[styles.dayNumber, isToday && styles.todayNumber]}>
          <Text style={[styles.dayText, isToday && styles.todayText]}>
            {date.getDate()}
          </Text>
        </View>
        <View style={styles.eventIndicators}>
          {dayEvents.slice(0, 3).map((event, idx) => (
            <View key={event.id} style={styles.eventBox} />
          ))}
        </View>
      </View>
    );
  };

  const renderEventItem = ({ item }: { item: Event }) => (
    <TouchableOpacity style={styles.eventCard}>
      <View style={styles.eventDateContainer}>
        <Text style={styles.eventMonth}>
          {new Date(item.start_time).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
        </Text>
        <Text style={styles.eventDay}>
          {new Date(item.start_time).getDate()}
        </Text>
      </View>

      <View style={styles.eventContent}>
        <Text style={styles.eventTitle}>{item.title}</Text>

        {item.description && (
          <Text style={styles.eventDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.eventDetails}>
          {item.location && (
            <View style={styles.eventDetailItem}>
              <Ionicons name="location-outline" size={16} color={colors.primary} />
              <Text style={styles.eventDetailText}>{item.location}</Text>
            </View>
          )}

          <View style={styles.eventDetailItem}>
            <Ionicons name="time-outline" size={16} color={colors.primary} />
            <Text style={styles.eventDetailText}>
              {formatTime(item.start_time)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.attendButton}
          onPress={() => handleAttendEvent(item.id)}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
          <Text style={styles.attendButtonText}>Attend</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[commonStyles.container, commonStyles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const days = getDaysInMonth(currentMonth);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

        {/* Events List Section */}
        <View style={styles.eventsListSection}>
          <Text style={styles.sectionTitle}>Upcoming Events</Text>
          {events.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={80} color={colors.gray400} />
              <Text style={styles.emptyTitle}>No upcoming events</Text>
              <Text style={styles.emptySubtitle}>
                Check back later or create your own event
              </Text>
            </View>
          ) : (
            events.map(item => (
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
                value={newEvent.title}
                onChangeText={(text) => setNewEvent({ ...newEvent, title: text })}
              />

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter event description"
                value={newEvent.description}
                onChangeText={(text) => setNewEvent({ ...newEvent, description: text })}
                multiline
                numberOfLines={4}
              />

              <Text style={styles.inputLabel}>Location</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter event location"
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
                  }}
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowStartDatePicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                    <Text style={styles.dateButtonText}>
                      {newEvent.start_time.toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>
                  {showStartDatePicker && (
                    <View style={styles.pickerContainer}>
                      <DateTimePicker
                        value={newEvent.start_time}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleStartDateChange}
                        textColor={colors.text}
                      />
                      {Platform.OS === 'ios' && (
                        <TouchableOpacity
                          style={styles.doneButton}
                          onPress={() => setShowStartDatePicker(false)}
                        >
                          <Text style={styles.doneButtonText}>Done</Text>
                        </TouchableOpacity>
                      )}
                    </View>
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
                  }}
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowStartTimePicker(true)}
                  >
                    <Ionicons name="time-outline" size={20} color={colors.primary} />
                    <Text style={styles.dateButtonText}>
                      {newEvent.start_time.toLocaleTimeString()}
                    </Text>
                  </TouchableOpacity>
                  {showStartTimePicker && (
                    <View style={styles.pickerContainer}>
                      <DateTimePicker
                        value={newEvent.start_time}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleStartTimeChange}
                        textColor={colors.text}
                      />
                      {Platform.OS === 'ios' && (
                        <TouchableOpacity
                          style={styles.doneButton}
                          onPress={() => setShowStartTimePicker(false)}
                        >
                          <Text style={styles.doneButtonText}>Done</Text>
                        </TouchableOpacity>
                      )}
                    </View>
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
                  }}
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowEndDatePicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                    <Text style={styles.dateButtonText}>
                      {newEvent.end_time.toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>
                  {showEndDatePicker && (
                    <View style={styles.pickerContainer}>
                      <DateTimePicker
                        value={newEvent.end_time}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleEndDateChange}
                        textColor={colors.text}
                      />
                      {Platform.OS === 'ios' && (
                        <TouchableOpacity
                          style={styles.doneButton}
                          onPress={() => setShowEndDatePicker(false)}
                        >
                          <Text style={styles.doneButtonText}>Done</Text>
                        </TouchableOpacity>
                      )}
                    </View>
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
                  }}
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowEndTimePicker(true)}
                  >
                    <Ionicons name="time-outline" size={20} color={colors.primary} />
                    <Text style={styles.dateButtonText}>
                      {newEvent.end_time.toLocaleTimeString()}
                    </Text>
                  </TouchableOpacity>
                  {showEndTimePicker && (
                    <View style={styles.pickerContainer}>
                      <DateTimePicker
                        value={newEvent.end_time}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleEndTimeChange}
                        textColor={colors.text}
                      />
                      {Platform.OS === 'ios' && (
                        <TouchableOpacity
                          style={styles.doneButton}
                          onPress={() => setShowEndTimePicker(false)}
                        >
                          <Text style={styles.doneButtonText}>Done</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </>
              )}

              <TouchableOpacity style={styles.createButton} onPress={handleCreateEvent}>
                <Text style={styles.createButtonText}>Create Event</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

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
    backgroundColor: colors.primary,
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
  eventTitle: {
    ...textStyles.body1,
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
  attendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  attendButtonText: {
    ...textStyles.body2,
    color: colors.white,
    fontWeight: typography.fontWeightSemiBold,
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
  eventsListSection: {
    padding: spacing.md,
  },
  sectionTitle: {
    ...textStyles.h3,
    marginBottom: spacing.md,
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
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    ...textStyles.body1,
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
});
