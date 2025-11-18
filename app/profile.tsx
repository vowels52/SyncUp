import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, FlatList, Image, Switch } from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '@/constants/theme';
import { textStyles, commonStyles } from '@/constants/styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useAlert, useTheme } from '@/template';
import { useRouter, useFocusEffect } from 'expo-router';
import { getSupabaseClient } from '@/template';
import { pickImage } from '@/template/core/imageUpload';
import { updateProfileImage, removeProfileImage } from '@/template/core/profileImageService';
import { useThemedColors } from '@/hooks/useThemedColors';

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  major: string | null;
  year: string | null;
  bio: string | null;
  university: string | null;
  profile_image_url: string | null;
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionsCount, setConnectionsCount] = useState(0);
  const [groupsCount, setGroupsCount] = useState(0);
  const [eventsCount, setEventsCount] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'connections' | 'groups' | 'events' | null>(null);
  const [modalData, setModalData] = useState<any[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const { themeMode, isDarkMode, setThemeMode } = useTheme();
  const router = useRouter();
  const supabase = getSupabaseClient();
  const themedColors = useThemedColors();

  useEffect(() => {
    fetchProfile();
    fetchStatistics();
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
      fetchStatistics();
    }, [user])
  );

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfile(data);
      }
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    if (!user) return;

    try {
      // Fetch connections count (accepted connections only)
      const { count: connectionsCount, error: connectionsError } = await supabase
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'accepted')
        .or(`user_id.eq.${user.id},connected_user_id.eq.${user.id}`);

      if (connectionsError) throw connectionsError;
      setConnectionsCount(connectionsCount || 0);

      // Fetch groups count
      const { count: groupsCount, error: groupsError } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (groupsError) throw groupsError;
      setGroupsCount(groupsCount || 0);

      // Fetch events count (attending events only)
      const { count: eventsCount, error: eventsError } = await supabase
        .from('event_attendees')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'going');

      if (eventsError) throw eventsError;
      setEventsCount(eventsCount || 0);
    } catch (error: any) {
      console.error('Failed to fetch statistics:', error.message);
    }
  };

  const handleChangeProfileImage = async () => {
    if (!user || !profile) return;

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
        profile.profile_image_url
      );

      // Update local profile state
      setProfile({ ...profile, profile_image_url: imageUrl });

      showAlert('Success', 'Profile picture updated successfully');
    } catch (error: any) {
      console.error('Failed to upload profile image:', error);
      showAlert('Error', error.message || 'Failed to upload profile picture');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveProfileImage = async () => {
    if (!user || !profile || !profile.profile_image_url) return;

    showAlert('Remove Profile Picture', 'Are you sure you want to remove your profile picture?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setUploadingImage(true);

            await removeProfileImage(user.id, profile.profile_image_url!);

            // Update local profile state
            setProfile({ ...profile, profile_image_url: null });

            showAlert('Success', 'Profile picture removed');
          } catch (error: any) {
            console.error('Failed to remove profile image:', error);
            showAlert('Error', error.message || 'Failed to remove profile picture');
          } finally {
            setUploadingImage(false);
          }
        },
      },
    ]);
  };

  const handleLogout = async () => {
    showAlert('Confirm Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          const { error } = await logout();
          if (error) {
            showAlert('Error', error);
          } else {
            router.replace('/auth');
          }
        },
      },
    ]);
  };

  const fetchDetailedConnections = async () => {
    if (!user) return;
    setLoadingModal(true);

    try {
      const { data, error } = await supabase
        .from('connections')
        .select(`
          id,
          user_id,
          connected_user_id,
          user_profiles!connections_connected_user_id_fkey(id, full_name, email, major, year, profile_image_url),
          connected_profiles:user_profiles!connections_user_id_fkey(id, full_name, email, major, year, profile_image_url)
        `)
        .eq('status', 'accepted')
        .or(`user_id.eq.${user.id},connected_user_id.eq.${user.id}`);

      if (error) throw error;

      // Extract the connected user's profile (the one that's not the current user)
      const connections = data?.map((conn: any) => {
        const isRequester = conn.user_id === user.id;
        const connectedUser = isRequester ? conn.user_profiles : conn.connected_profiles;
        return {
          id: conn.id, // Connection record ID for deletion
          userId: connectedUser.id, // User's profile ID
          name: connectedUser.full_name || 'Anonymous',
          email: connectedUser.email,
          major: connectedUser.major || 'N/A',
          year: connectedUser.year || '',
          profile_image_url: connectedUser.profile_image_url || null,
        };
      }) || [];

      setModalData(connections);
    } catch (error: any) {
      console.error('Failed to fetch connections:', error.message);
      showAlert('Error', 'Failed to load connections');
    } finally {
      setLoadingModal(false);
    }
  };

  const fetchDetailedGroups = async () => {
    if (!user) return;
    setLoadingModal(true);

    try {
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          id,
          group_id,
          role,
          groups(id, name, description, image_url)
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      const groups = data?.map((membership: any) => ({
        id: membership.groups.id,
        name: membership.groups.name,
        description: membership.groups.description || 'No description',
        image_url: membership.groups.image_url,
        role: membership.role,
      })) || [];

      setModalData(groups);
    } catch (error: any) {
      console.error('Failed to fetch groups:', error.message);
      showAlert('Error', 'Failed to load groups');
    } finally {
      setLoadingModal(false);
    }
  };

  const fetchDetailedEvents = async () => {
    if (!user) return;
    setLoadingModal(true);

    try {
      const { data, error } = await supabase
        .from('event_attendees')
        .select(`
          id,
          status,
          events(id, title, description, start_time, location)
        `)
        .eq('user_id', user.id)
        .eq('status', 'going');

      if (error) throw error;

      const events = data?.map((attendance: any) => ({
        id: attendance.events.id,
        title: attendance.events.title,
        description: attendance.events.description || 'No description',
        start_time: attendance.events.start_time,
        location: attendance.events.location || 'TBD',
      })) || [];

      setModalData(events);
    } catch (error: any) {
      console.error('Failed to fetch events:', error.message);
      showAlert('Error', 'Failed to load events');
    } finally {
      setLoadingModal(false);
    }
  };

  const handleStatPress = async (type: 'connections' | 'groups' | 'events') => {
    setModalType(type);
    setModalVisible(true);

    if (type === 'connections') {
      await fetchDetailedConnections();
    } else if (type === 'groups') {
      await fetchDetailedGroups();
    } else if (type === 'events') {
      await fetchDetailedEvents();
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!user) return;

    try {
      // Delete the connection by its ID
      const { data, error, count } = await supabase
        .from('connections')
        .delete({ count: 'exact' })
        .eq('id', connectionId)
        .select();

      if (error) throw error;

      // Check if any rows were actually deleted
      if (!data || data.length === 0) {
        throw new Error('Unable to remove connection. You may not have permission to delete this connection.');
      }

      // Refresh connections list and count
      await fetchDetailedConnections();
      await fetchStatistics();
      showAlert('Success', 'Connection removed');
    } catch (error: any) {
      console.error('Failed to disconnect:', error.message);
      showAlert('Error', error.message || 'Failed to remove connection');
    }
  };

  const handleLeaveGroup = async (groupId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Refresh groups list and count
      await fetchDetailedGroups();
      await fetchStatistics();
      showAlert('Success', 'Left group');
    } catch (error: any) {
      console.error('Failed to leave group:', error.message);
      showAlert('Error', 'Failed to leave group');
    }
  };

  const handleUnattendEvent = async (eventId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('event_attendees')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Refresh events list and count
      await fetchDetailedEvents();
      await fetchStatistics();
      showAlert('Success', 'Removed from event');
    } catch (error: any) {
      console.error('Failed to unattend event:', error.message);
      showAlert('Error', 'Failed to remove from event');
    }
  };

  // Generate styles dynamically based on theme
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themedColors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      backgroundColor: themedColors.surface,
      borderBottomWidth: 1,
      borderBottomColor: themedColors.gray200,
    },
    backButton: {
      padding: spacing.xs,
    },
    headerTitle: {
      ...textStyles.h3,
      color: themedColors.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    headerSpacer: {
      width: 40,
    },
    content: {
      flex: 1,
    },
    profileHeader: {
      backgroundColor: themedColors.surface,
      paddingVertical: spacing.xl,
      alignItems: 'center',
      ...shadows.small,
    },
    avatarContainer: {
      position: 'relative',
      marginBottom: spacing.md,
    },
    avatarLarge: {
      width: 120,
      height: 120,
      borderRadius: borderRadius.full,
      backgroundColor: themedColors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    editAvatarButton: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      backgroundColor: themedColors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: themedColors.surface,
    },
    removeAvatarButton: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      backgroundColor: themedColors.error,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: themedColors.surface,
    },
    profileName: {
      ...textStyles.h2,
      color: themedColors.textPrimary,
      marginBottom: spacing.xs,
    },
    profileEmail: {
      ...textStyles.body2,
      color: themedColors.textSecondary,
      marginBottom: spacing.md,
    },
    badge: {
      backgroundColor: themedColors.gray100,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
    },
    badgeText: {
      ...textStyles.caption,
      color: themedColors.textPrimary,
      fontWeight: typography.fontWeightSemiBold,
    },
    section: {
      padding: spacing.md,
    },
    sectionTitle: {
      ...textStyles.h4,
      color: themedColors.textPrimary,
      marginBottom: spacing.md,
    },
    card: {
      backgroundColor: themedColors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      ...shadows.small,
    },
    bioText: {
      ...textStyles.body2,
      color: themedColors.textSecondary,
      lineHeight: typography.lineHeight24,
    },
    statsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    statCard: {
      flex: 1,
      backgroundColor: themedColors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      alignItems: 'center',
      ...shadows.small,
    },
    statValue: {
      ...textStyles.h3,
      color: themedColors.textPrimary,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    statLabel: {
      ...textStyles.caption,
      color: themedColors.textSecondary,
    },
    menuItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: themedColors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      ...shadows.small,
    },
    menuItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    menuItemText: {
      ...textStyles.body1,
      color: themedColors.textPrimary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: themedColors.overlay,
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: themedColors.surface,
      borderTopLeftRadius: borderRadius.lg,
      borderTopRightRadius: borderRadius.lg,
      maxHeight: '80%',
      paddingBottom: spacing.xl,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: themedColors.gray200,
    },
    modalTitle: {
      ...textStyles.h3,
      color: themedColors.textPrimary,
    },
    modalLoading: {
      padding: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 200,
    },
    emptyState: {
      padding: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 200,
    },
    emptyText: {
      ...textStyles.body1,
      color: themedColors.textSecondary,
      marginTop: spacing.md,
    },
    modalItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      marginHorizontal: spacing.md,
      marginVertical: spacing.xs,
      backgroundColor: themedColors.background,
      borderRadius: borderRadius.md,
      ...shadows.small,
    },
    modalItemIcon: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.md,
      backgroundColor: themedColors.gray100,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    modalItemContent: {
      flex: 1,
    },
    modalItemTitle: {
      ...textStyles.body1,
      color: themedColors.textPrimary,
      fontWeight: typography.fontWeightSemiBold,
      marginBottom: spacing.xs,
    },
    modalItemSubtitle: {
      ...textStyles.caption,
      color: themedColors.textSecondary,
      marginBottom: spacing.xs,
    },
    modalItemEmail: {
      ...textStyles.caption,
      color: themedColors.textSecondary,
    },
    connectionAvatar: {
      width: 56,
      height: 56,
      borderRadius: borderRadius.full,
      backgroundColor: themedColors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    groupImage: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.md,
      marginRight: spacing.md,
    },
    deleteButton: {
      padding: spacing.xs,
    },
  });

  if (loading) {
    return (
      <View style={[commonStyles.container, commonStyles.centerContent]}>
        <ActivityIndicator size="large" color={themedColors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={themedColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {profile?.profile_image_url ? (
              <Image
                source={{ uri: profile.profile_image_url }}
                style={styles.avatarLarge}
              />
            ) : (
              <View style={styles.avatarLarge}>
                <Ionicons name="person" size={64} color={themedColors.white} />
              </View>
            )}
            <TouchableOpacity
              style={styles.editAvatarButton}
              onPress={handleChangeProfileImage}
              disabled={uploadingImage}
            >
              {uploadingImage ? (
                <ActivityIndicator size="small" color={themedColors.white} />
              ) : (
                <Ionicons name="camera" size={20} color={themedColors.white} />
              )}
            </TouchableOpacity>
            {profile?.profile_image_url && !uploadingImage && (
              <TouchableOpacity
                style={styles.removeAvatarButton}
                onPress={handleRemoveProfileImage}
              >
                <Ionicons name="close" size={20} color={themedColors.white} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.profileName}>
            {profile?.full_name || 'Anonymous Student'}
          </Text>
          <Text style={styles.profileEmail}>{profile?.email || user?.email}</Text>

          {profile?.major && profile?.year && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {profile.major} • {profile.year}
              </Text>
            </View>
          )}
        </View>

        {profile?.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.card}>
              <Text style={styles.bioText}>{profile.bio}</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistics</Text>
          <View style={styles.statsGrid}>
            <TouchableOpacity
              style={styles.statCard}
              onPress={() => handleStatPress('connections')}
            >
              <Ionicons name="people" size={32} color={themedColors.primary} />
              <Text style={styles.statValue}>{connectionsCount}</Text>
              <Text style={styles.statLabel}>Connections</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCard}
              onPress={() => handleStatPress('groups')}
            >
              <Ionicons name="grid" size={32} color={themedColors.accent} />
              <Text style={styles.statValue}>{groupsCount}</Text>
              <Text style={styles.statLabel}>Groups</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCard}
              onPress={() => handleStatPress('events')}
            >
              <Ionicons name="calendar" size={32} color={themedColors.success} />
              <Text style={styles.statValue}>{eventsCount}</Text>
              <Text style={styles.statLabel}>Events</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>

          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="moon-outline" size={24} color={themedColors.textPrimary} />
              <Text style={styles.menuItemText}>Dark Mode</Text>
            </View>
            <Switch
              value={themeMode === 'dark'}
              onValueChange={(value) => setThemeMode(value ? 'dark' : 'light')}
              trackColor={{ false: themedColors.gray300, true: themedColors.primary }}
              thumbColor={themedColors.white}
            />
          </View>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              if (themeMode === 'auto') {
                showAlert('Auto Theme', 'Theme is set to follow your system settings');
              } else {
                setThemeMode('auto');
                showAlert('Auto Theme', 'Theme will now follow your system settings');
              }
            }}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="contrast-outline" size={24} color={themedColors.textPrimary} />
              <Text style={styles.menuItemText}>Auto (System)</Text>
            </View>
            {themeMode === 'auto' && (
              <Ionicons name="checkmark-circle" size={24} color={themedColors.primary} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/edit-profile')}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="person-outline" size={24} color={themedColors.textPrimary} />
              <Text style={styles.menuItemText}>Edit Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themedColors.gray400} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/match-preferences')}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="options-outline" size={24} color={colors.textPrimary} />
              <Text style={styles.menuItemText}>Match Preferences</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/notifications')}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="notifications-outline" size={24} color={themedColors.textPrimary} />
              <Text style={styles.menuItemText}>Notifications</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themedColors.gray400} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/privacy')}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="lock-closed-outline" size={24} color={themedColors.textPrimary} />
              <Text style={styles.menuItemText}>Privacy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themedColors.gray400} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/help')}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="help-circle-outline" size={24} color={themedColors.textPrimary} />
              <Text style={styles.menuItemText}>Help & Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themedColors.gray400} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="log-out-outline" size={24} color={themedColors.error} />
              <Text style={[styles.menuItemText, { color: themedColors.error }]}>Logout</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themedColors.gray400} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalType === 'connections' && 'My Connections'}
                {modalType === 'groups' && 'My Groups'}
                {modalType === 'events' && 'My Events'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={28} color={themedColors.textPrimary} />
              </TouchableOpacity>
            </View>

            {loadingModal ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={themedColors.primary} />
              </View>
            ) : modalData.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name={modalType === 'connections' ? 'people-outline' : modalType === 'groups' ? 'grid-outline' : 'calendar-outline'}
                  size={64}
                  color={themedColors.gray400}
                />
                <Text style={styles.emptyText}>
                  {modalType === 'connections' && 'No connections yet'}
                  {modalType === 'groups' && 'Not a member of any groups'}
                  {modalType === 'events' && 'Not attending any events'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={modalData}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.modalItem}>
                    {modalType === 'connections' && (
                      <>
                        {item.profile_image_url ? (
                          <Image
                            source={{ uri: item.profile_image_url }}
                            style={styles.connectionAvatar}
                          />
                        ) : (
                          <View style={styles.connectionAvatar}>
                            <Ionicons name="person" size={28} color={themedColors.white} />
                          </View>
                        )}
                        <View style={styles.modalItemContent}>
                          <Text style={styles.modalItemTitle}>{item.name}</Text>
                          <Text style={styles.modalItemSubtitle}>
                            {item.major}{item.year ? ` • ${item.year}` : ''}
                          </Text>
                          <Text style={styles.modalItemEmail}>{item.email}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleDisconnect(item.id)}
                          style={styles.deleteButton}
                        >
                          <Ionicons name="close-circle" size={24} color={themedColors.error} />
                        </TouchableOpacity>
                      </>
                    )}
                    {modalType === 'groups' && (
                      <>
                        {item.image_url ? (
                          <Image
                            source={{ uri: item.image_url }}
                            style={styles.groupImage}
                          />
                        ) : (
                          <View style={styles.modalItemIcon}>
                            <Ionicons name="grid" size={24} color={themedColors.accent} />
                          </View>
                        )}
                        <View style={styles.modalItemContent}>
                          <Text style={styles.modalItemTitle}>{item.name}</Text>
                          <Text style={styles.modalItemSubtitle}>{item.description}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleLeaveGroup(item.id)}
                          style={styles.deleteButton}
                        >
                          <Ionicons name="close-circle" size={24} color={themedColors.error} />
                        </TouchableOpacity>
                      </>
                    )}
                    {modalType === 'events' && (
                      <>
                        <View style={styles.modalItemIcon}>
                          <Ionicons name="calendar" size={24} color={themedColors.success} />
                        </View>
                        <View style={styles.modalItemContent}>
                          <Text style={styles.modalItemTitle}>{item.title}</Text>
                          <Text style={styles.modalItemSubtitle}>
                            {item.location} • {new Date(item.start_time).toLocaleDateString()}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleUnattendEvent(item.id)}
                          style={styles.deleteButton}
                        >
                          <Ionicons name="close-circle" size={24} color={themedColors.error} />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
