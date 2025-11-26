import { Stack } from 'expo-router';
import { AuthProvider, AlertProvider, ThemeProvider } from '@/template';
import { DMNotificationProvider } from '@/components/DMNotificationProvider';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AlertProvider>
        <AuthProvider>
          <DMNotificationProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="auth" options={{ headerShown: false }} />
              <Stack.Screen
                name="onboarding"
                options={{
                  headerShown: false,
                  presentation: 'modal',
                  gestureEnabled: false,
                }}
              />
              <Stack.Screen
                name="club-detail"
                options={{
                  headerShown: false,
                  presentation: 'card'
                }}
              />
            </Stack>
          </DMNotificationProvider>
        </AuthProvider>
      </AlertProvider>
    </ThemeProvider>
  );
}
