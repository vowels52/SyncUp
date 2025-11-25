import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, typography } from '@/constants/theme';
import { textStyles } from '@/constants/styles';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';
import { router, usePathname } from 'expo-router';

interface DMNotification {
  id: string;
  senderName: string;
  senderId: string;
  message: string;
  conversationId: string;
  isGroupMessage?: boolean;
  groupConversationId?: string;
  groupName?: string;
}

interface DMNotificationContextType {
  showNotification: (notification: DMNotification) => void;
}

const DMNotificationContext = createContext<DMNotificationContextType | undefined>(undefined);

export const useDMNotification = () => {
  const context = useContext(DMNotificationContext);
  if (!context) {
    throw new Error('useDMNotification must be used within DMNotificationProvider');
  }
  return context;
};

export const DMNotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notification, setNotification] = useState<DMNotification | null>(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { user } = useAuth();
  const supabase = getSupabaseClient();
  const pathname = usePathname();

  useEffect(() => {
    if (!user) return;

    // Subscribe to new DM messages
    const dmChannel = supabase
      .channel('dm-notifications-global')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          const newMessage = payload.new as any;

          // Don't show notification if user is viewing this conversation
          const isViewingConversation = pathname.includes('dm-conversation');

          if (isViewingConversation) {
            return;
          }

          // Fetch sender info
          const { data: senderData } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', newMessage.sender_id)
            .single();

          showNotification({
            id: newMessage.id,
            senderName: senderData?.full_name || 'Someone',
            senderId: newMessage.sender_id,
            message: newMessage.content,
            conversationId: newMessage.conversation_id,
          });
        }
      )
      .subscribe();

    // Subscribe to group messages
    const groupChannel = supabase
      .channel('group-messages-notifications-global')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
        },
        async (payload) => {
          const newMessage = payload.new as any;

          // Skip if this is our own message
          if (newMessage.sender_id === user.id) {
            return;
          }

          // Check if user is a member of this group
          const { data: membership } = await supabase
            .from('group_chat_members')
            .select('group_conversation_id')
            .eq('group_conversation_id', newMessage.group_conversation_id)
            .eq('user_id', user.id)
            .single();

          if (!membership) {
            return; // User is not a member of this group
          }

          // Don't show notification if user is viewing this group conversation
          const isViewingGroupConversation = pathname.includes('group-chat-conversation');

          if (isViewingGroupConversation) {
            return;
          }

          // Fetch sender info
          const { data: senderData } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', newMessage.sender_id)
            .single();

          // Fetch group info
          const { data: groupData } = await supabase
            .from('group_conversations')
            .select('name')
            .eq('id', newMessage.group_conversation_id)
            .single();

          showNotification({
            id: newMessage.id,
            senderName: senderData?.full_name || 'Someone',
            senderId: newMessage.sender_id,
            message: newMessage.content,
            conversationId: '', // Not used for group messages
            isGroupMessage: true,
            groupConversationId: newMessage.group_conversation_id,
            groupName: groupData?.name || 'Group Chat',
          });
        }
      )
      .subscribe();

    return () => {
      dmChannel.unsubscribe();
      groupChannel.unsubscribe();
    };
  }, [user, pathname]);

  const showNotification = (notif: DMNotification) => {
    setNotification(notif);

    // Slide in animation
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();

    // Auto-hide after 4 seconds
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      hideNotification();
    }, 4000);
  };

  const hideNotification = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setNotification(null);
    });
  };

  const handleNotificationPress = () => {
    if (notification) {
      hideNotification();
      if (notification.isGroupMessage) {
        router.push({
          pathname: '/group-chat-conversation',
          params: {
            groupConversationId: notification.groupConversationId!,
          },
        });
      } else {
        router.push({
          pathname: '/dm-conversation',
          params: {
            conversationId: notification.conversationId,
            otherUserId: notification.senderId,
          },
        });
      }
    }
  };

  return (
    <DMNotificationContext.Provider value={{ showNotification }}>
      {children}
      {notification && (
        <Animated.View
          style={[
            styles.notificationContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.notification}
            onPress={handleNotificationPress}
            activeOpacity={0.9}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="chatbubble" size={24} color={colors.primary} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.senderName} numberOfLines={1}>
                {notification.isGroupMessage
                  ? `${notification.groupName}: ${notification.senderName}`
                  : notification.senderName}
              </Text>
              <Text style={styles.messageText} numberOfLines={2}>
                {notification.message}
              </Text>
            </View>
            <TouchableOpacity onPress={hideNotification} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={colors.gray500} />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      )}
    </DMNotificationContext.Provider>
  );
};

const styles = StyleSheet.create({
  notificationContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 10,
    left: spacing.md,
    right: spacing.md,
    zIndex: 9999,
  },
  notification: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.large,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  textContainer: {
    flex: 1,
  },
  senderName: {
    ...textStyles.body1,
    fontWeight: typography.fontWeightSemiBold,
    marginBottom: spacing.xs,
  },
  messageText: {
    ...textStyles.body2,
    color: colors.textSecondary,
  },
  closeButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
});
