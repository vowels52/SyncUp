import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Modal, TextInput, Platform, KeyboardAvoidingView, Image } from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '@/constants/theme';
import { textStyles, commonStyles } from '@/constants/styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';

interface UserProfile {
  id: string;
  full_name: string | null;
  major: string | null;
  year: string | null;
  profile_image_url: string | null;
}

interface Event {
  id: string;
  title: string;
  start_time: string;
  location: string | null;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
}

interface Club {
  id: string;
  name: string;
  description: string | null;
}

interface SearchResult {
  id: string;
  full_name: string | null;
  major: string | null;
  year: string | null;
  bio: string | null;
  email: string;
  profile_image_url: string | null;
  connectionStatus?: 'none' | 'pending' | 'accepted' | 'rejected';
}

export default function HomeScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [recentGroups, setRecentGroups] = useState<Group[]>([]);
  const [myClubs, setMyClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [showAllGroups, setShowAllGroups] = useState(false);
  const [showAllClubs, setShowAllClubs] = useState(false);

  // Form state
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    location: '',
    start_time: new Date(),
    end_time: new Date(),
  });

  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    club_type: '',
    category: '',
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
  const router = useRouter();

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch user profile
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('id, full_name, major, year, profile_image_url')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // Fetch my events (events I'm attending)
      const { data: attendingData } = await supabase
        .from('event_attendees')
        .select('events(id, title, start_time, location)')
        .eq('user_id', user.id)
        .eq('status', 'going');

      if (attendingData) {
        const myEvents = attendingData
          .filter((item: any) => item.events)
          .map((item: any) => ({
            id: item.events.id,
            title: item.events.title,
            start_time: item.events.start_time,
            location: item.events.location,
          }))
          .filter((event: any) => new Date(event.start_time) >= new Date())
          .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

        setUpcomingEvents(myEvents);
      }

      // Fetch my study groups and clubs (groups I've joined)
      const { data: memberData } = await supabase
        .from('group_members')
        .select('groups(id, name, description, is_official_club)')
        .eq('user_id', user.id);

      if (memberData) {
        // Filter to only show non-official clubs (study groups)
        const myStudyGroups = memberData
          .filter((item: any) => item.groups && item.groups.is_official_club === false)
          .map((item: any) => ({
            id: item.groups.id,
            name: item.groups.name,
            description: item.groups.description,
          }));

        setRecentGroups(myStudyGroups);

        // Filter to only show official clubs
        const myJoinedClubs = memberData
          .filter((item: any) => item.groups && item.groups.is_official_club === true)
          .map((item: any) => ({
            id: item.groups.id,
            name: item.groups.name,
            description: item.groups.description,
          }));

        setMyClubs(myJoinedClubs);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
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
      fetchData();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to create event');
    }
  };

  const handleCreateGroup = async () => {
    if (!user) {
      showAlert('Error', 'You must be logged in to create groups');
      return;
    }

    if (!newGroup.name.trim()) {
      showAlert('Error', 'Please enter a group name');
      return;
    }

    try {
      // Insert the new group and get the created group's ID
      const { data: createdGroup, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: newGroup.name,
          description: newGroup.description || null,
          club_type: newGroup.club_type || null,
          category: newGroup.category || null,
          creator_id: user.id,
          is_official_club: false,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Automatically add the creator as a member of the group
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: createdGroup.id,
          user_id: user.id,
          role: 'admin',
        });

      if (memberError) throw memberError;

      showAlert('Success', 'Group created successfully!');
      closeGroupModal();
      fetchData();
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to create group');
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

  const closeGroupModal = () => {
    setShowGroupModal(false);
    setNewGroup({
      name: '',
      description: '',
      club_type: '',
      category: '',
    });
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

  const handleWebDateChange = (dateString: string, isStart: boolean) => {
    if (!dateString || dateString.trim() === '') return;

    const date = new Date(dateString + 'T00:00:00');
    if (isNaN(date.getTime())) return;

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

  const handleSearch = async (query: string) => {
    if (!query.trim() || !user) {
      setSearchResults([]);
      return;
    }

    setSearching(true);

    try {
      // First, get all user search results
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, major, year, bio, email, profile_image_url')
        .neq('id', user.id)
        .not('full_name', 'is', null);

      if (error) throw error;

      if (!data) {
        setSearchResults([]);
        setSearching(false);
        return;
      }

      // Filter results client-side for better mobile compatibility
      const queryLower = query.toLowerCase();
      const filteredData = data.filter(profile => {
        const nameMatch = profile.full_name && profile.full_name.toLowerCase().includes(queryLower);
        const emailMatch = profile.email && profile.email.toLowerCase().includes(queryLower);
        const majorMatch = profile.major && profile.major.toLowerCase().includes(queryLower);
        return nameMatch || emailMatch || majorMatch;
      }).slice(0, 20); // Limit to 20 results

      // Then, get all existing connections for the current user
      const { data: connections, error: connectionsError } = await supabase
        .from('connections')
        .select('user_id, connected_user_id, status')
        .or(`user_id.eq.${user.id},connected_user_id.eq.${user.id}`);

      if (connectionsError) {
        console.error('Connections query error:', connectionsError);
      }

      // Map connection status to each search result
      const resultsWithStatus = filteredData.map(result => {
        const connection = connections?.find(
          conn =>
            (conn.user_id === user.id && conn.connected_user_id === result.id) ||
            (conn.connected_user_id === user.id && conn.user_id === result.id)
        );

        return {
          ...result,
          connectionStatus: connection?.status || 'none'
        } as SearchResult;
      });

      setSearchResults(resultsWithStatus);
    } catch (error: any) {
      console.error('Search error:', error);
      showAlert('Error', error.message || 'Failed to search users');
    } finally {
      setSearching(false);
    }
  };

  const handleSendConnectionRequest = async (userId: string) => {
    if (!user) return;

    try {
      // Insert connection request
      const { error: connectionError } = await supabase
        .from('connections')
        .insert({
          user_id: user.id,
          connected_user_id: userId,
          status: 'pending',
        });

      if (connectionError) throw connectionError;

      // Also record in match history so user doesn't appear in discover page
      const { error: historyError } = await supabase
        .from('match_history')
        .insert({
          user_id: user.id,
          viewed_user_id: userId,
          action: 'connect',
        });

      if (historyError) {
        // Log but don't fail if history insert fails
        console.error('Error recording match history:', historyError);
      }

      showAlert('Success', 'Connection request sent!');

      // Update the connection status in search results instead of removing
      setSearchResults(searchResults.map(r =>
        r.id === userId ? { ...r, connectionStatus: 'pending' as const } : r
      ));
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to send connection request');
    }
  };

  const closeSearchModal = () => {
    setShowSearchModal(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  if (loading) {
    return (
      <View style={[commonStyles.container, commonStyles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{profile?.full_name || 'Student'}</Text>
            <Text style={styles.userInfo}>
              {profile?.major ? `${profile.major} • ${profile.year}` : 'Complete your profile'}
            </Text>
          </View>
          <TouchableOpacity style={styles.avatar} onPress={() => router.push('/profile')}>
            {profile?.profile_image_url ? (
              <Image source={{ uri: profile.profile_image_url }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={32} color={colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionCard} onPress={() => setShowSearchModal(true)}>
            <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
              <Ionicons name="search" size={24} color={colors.white} />
            </View>
            <Text style={styles.actionText}>Find Matches</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => setShowGroupModal(true)}>
            <View style={[styles.actionIcon, { backgroundColor: colors.accent }]}>
              <Ionicons name="add-circle" size={24} color={colors.white} />
            </View>
            <Text style={styles.actionText}>Create Group</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => setShowAddModal(true)}>
            <View style={[styles.actionIcon, { backgroundColor: colors.success }]}>
              <Ionicons name="calendar-outline" size={24} color={colors.white} />
            </View>
            <Text style={styles.actionText}>New Event</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Events</Text>
            {upcomingEvents.length > 3 && (
              <TouchableOpacity onPress={() => setShowAllEvents(!showAllEvents)}>
                <Text style={styles.seeAllText}>
                  {showAllEvents ? 'Show Less' : `See All (${upcomingEvents.length})`}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {upcomingEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={colors.gray400} />
              <Text style={styles.emptyStateText}>No events yet</Text>
              <Text style={styles.emptyStateSubtext}>Attend events from the Events tab to see them here</Text>
            </View>
          ) : (
            (showAllEvents ? upcomingEvents : upcomingEvents.slice(0, 3)).map((event) => (
              <TouchableOpacity
                key={event.id}
                style={styles.eventCard}
                onPress={() => router.push(`/event-detail?id=${event.id}`)}
              >
                <View style={styles.eventIcon}>
                  <Ionicons name="calendar" size={20} color={colors.primary} />
                </View>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventDetails}>
                    {formatDate(event.start_time)}
                    {event.location && ` • ${event.location}`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Study Groups</Text>
            {recentGroups.length > 3 && (
              <TouchableOpacity onPress={() => setShowAllGroups(!showAllGroups)}>
                <Text style={styles.seeAllText}>
                  {showAllGroups ? 'Show Less' : `See All (${recentGroups.length})`}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {recentGroups.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={colors.gray400} />
              <Text style={styles.emptyStateText}>No groups yet</Text>
              <Text style={styles.emptyStateSubtext}>Create or join study groups to collaborate</Text>
            </View>
          ) : (
            (showAllGroups ? recentGroups : recentGroups.slice(0, 3)).map((group) => (
              <TouchableOpacity
                key={group.id}
                style={styles.groupCard}
                onPress={() => router.push(`/study-group-detail?id=${group.id}&from=home`)}
              >
                <View style={[styles.groupIcon, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="people" size={20} color={colors.white} />
                </View>
                <View style={styles.groupInfo}>
                  <Text style={styles.groupName}>{group.name}</Text>
                  <Text style={styles.groupDescription} numberOfLines={1}>
                    {group.description || 'No description'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Clubs</Text>
            {myClubs.length > 3 && (
              <TouchableOpacity onPress={() => setShowAllClubs(!showAllClubs)}>
                <Text style={styles.seeAllText}>
                  {showAllClubs ? 'Show Less' : `See All (${myClubs.length})`}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {myClubs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="business-outline" size={48} color={colors.gray400} />
              <Text style={styles.emptyStateText}>No clubs joined</Text>
              <Text style={styles.emptyStateSubtext}>Discover and join UWB clubs in the Groups tab</Text>
            </View>
          ) : (
            (showAllClubs ? myClubs : myClubs.slice(0, 3)).map((club) => (
              <TouchableOpacity
                key={club.id}
                style={styles.groupCard}
                onPress={() => router.push(`/club-detail?id=${club.id}&from=home`)}
              >
                <View style={[styles.groupIcon, { backgroundColor: colors.accent }]}>
                  <Ionicons name="business" size={20} color={colors.white} />
                </View>
                <View style={styles.groupInfo}>
                  <Text style={styles.groupName}>{club.name}</Text>
                  <Text style={styles.groupDescription} numberOfLines={1}>
                    {club.description || 'No description'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

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
                    themeVariant="light"
                  />
                </View>
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
                    themeVariant="light"
                  />
                </View>
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
                    themeVariant="light"
                  />
                </View>
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
                    themeVariant="light"
                  />
                </View>
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

              <TouchableOpacity style={styles.createButton} onPress={handleCreateEvent}>
                <Text style={styles.createButtonText}>Create Event</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Search Modal */}
      <Modal
        visible={showSearchModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeSearchModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalContent, styles.searchModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Search People</Text>
              <TouchableOpacity onPress={closeSearchModal}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <Ionicons name="search" size={20} color={colors.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name, email, or major..."
                  value={searchQuery}
                  onChangeText={(text) => {
                    setSearchQuery(text);
                    handleSearch(text);
                  }}
                  autoFocus
                />
              </View>
            </View>

            <ScrollView
              style={styles.searchResults}
              contentContainerStyle={styles.searchResultsContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {searching ? (
                <View style={styles.searchLoadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : searchQuery.trim() === '' ? (
                <View style={styles.searchEmptyContainer}>
                  <Ionicons name="search-outline" size={64} color={colors.gray400} />
                  <Text style={styles.searchEmptyText}>Search for people you know</Text>
                  <Text style={styles.searchEmptySubtext}>
                    Enter a name, email, or major to find other students
                  </Text>
                </View>
              ) : searchResults.length === 0 ? (
                <View style={styles.searchEmptyContainer}>
                  <Ionicons name="people-outline" size={64} color={colors.gray400} />
                  <Text style={styles.searchEmptyText}>No results found</Text>
                  <Text style={styles.searchEmptySubtext}>
                    Try a different search term
                  </Text>
                </View>
              ) : (
                searchResults.map((result) => (
                  <View key={result.id} style={styles.searchResultCard}>
                    <View style={styles.searchResultHeader}>
                      {result.profile_image_url ? (
                        <Image
                          source={{ uri: result.profile_image_url }}
                          style={styles.searchResultAvatar}
                        />
                      ) : (
                        <View style={styles.searchResultAvatar}>
                          <Ionicons name="person" size={24} color={colors.white} />
                        </View>
                      )}
                      <View style={styles.searchResultInfo}>
                        <Text style={styles.searchResultName}>
                          {result.full_name || 'Anonymous Student'}
                        </Text>
                        {result.major && result.year && (
                          <Text style={styles.searchResultDetails}>
                            {result.major} • {result.year}
                          </Text>
                        )}
                        <Text style={styles.searchResultEmail}>{result.email}</Text>
                      </View>
                    </View>
                    {result.connectionStatus === 'accepted' ? (
                      <View style={[styles.connectButton, styles.connectedButton]}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={styles.connectedButtonText}>Connected</Text>
                      </View>
                    ) : result.connectionStatus === 'pending' ? (
                      <View style={[styles.connectButton, styles.connectedButton]}>
                        <Ionicons name="time" size={16} color={colors.textSecondary} />
                        <Text style={styles.connectedButtonText}>Pending</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.connectButton}
                        onPress={() => handleSendConnectionRequest(result.id)}
                      >
                        <Ionicons name="person-add" size={16} color={colors.white} />
                        <Text style={styles.connectButtonText}>Connect</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Create Group Modal */}
      <Modal
        visible={showGroupModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeGroupModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Group</Text>
              <TouchableOpacity onPress={closeGroupModal}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Group Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter group name"
                value={newGroup.name}
                onChangeText={(text) => setNewGroup({ ...newGroup, name: text })}
              />

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter group description"
                value={newGroup.description}
                onChangeText={(text) => setNewGroup({ ...newGroup, description: text })}
                multiline
                numberOfLines={4}
              />

              <Text style={styles.inputLabel}>Club Type</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Academic, Social, Sports"
                value={newGroup.club_type}
                onChangeText={(text) => setNewGroup({ ...newGroup, club_type: text })}
              />

              <Text style={styles.inputLabel}>Category</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Computer Science, Business"
                value={newGroup.category}
                onChangeText={(text) => setNewGroup({ ...newGroup, category: text })}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.createButton} onPress={handleCreateGroup}>
                <Text style={styles.createButtonText}>Create Group</Text>
              </TouchableOpacity>
            </View>
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
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    ...textStyles.body2,
    color: colors.white,
    opacity: 0.9,
  },
  userName: {
    ...textStyles.h3,
    color: colors.white,
    marginTop: spacing.xs,
  },
  userInfo: {
    ...textStyles.caption,
    color: colors.white,
    opacity: 0.8,
    marginTop: spacing.xs,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 56,
    height: 56,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: spacing.xs,
    alignItems: 'center',
    ...shadows.small,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  actionText: {
    ...textStyles.caption,
    fontWeight: typography.fontWeightSemiBold,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...textStyles.h4,
  },
  seeAllText: {
    ...textStyles.body2,
    color: colors.primary,
    fontWeight: typography.fontWeightSemiBold,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    ...textStyles.body1,
    fontWeight: typography.fontWeightSemiBold,
    marginBottom: spacing.xs,
  },
  eventDetails: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    ...textStyles.body1,
    fontWeight: typography.fontWeightSemiBold,
    marginBottom: spacing.xs,
  },
  groupDescription: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.small,
  },
  emptyStateText: {
    ...textStyles.body1,
    fontWeight: typography.fontWeightSemiBold,
    marginTop: spacing.md,
  },
  emptyStateSubtext: {
    ...textStyles.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
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
  searchModalContent: {
    height: '90%',
    maxHeight: '90%',
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
  compactPickerContainer: {
    backgroundColor: colors.white || '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    paddingVertical: spacing.xs,
  },
  searchContainer: {
    padding: spacing.lg,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    ...textStyles.body1,
  },
  searchResults: {
    flex: 1,
  },
  searchResultsContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  searchLoadingContainer: {
    paddingVertical: spacing.xl * 2,
    alignItems: 'center',
  },
  searchEmptyContainer: {
    paddingVertical: spacing.xl * 2,
    alignItems: 'center',
  },
  searchEmptyText: {
    ...textStyles.h4,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  searchEmptySubtext: {
    ...textStyles.body2,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  searchResultCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  searchResultHeader: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  searchResultAvatar: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    ...textStyles.body1,
    fontWeight: typography.fontWeightSemiBold,
    marginBottom: spacing.xs,
  },
  searchResultDetails: {
    ...textStyles.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  searchResultEmail: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  connectButtonText: {
    ...textStyles.body2,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.white,
  },
  connectedButton: {
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  connectedButtonText: {
    ...textStyles.body2,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.textSecondary,
  },
});
