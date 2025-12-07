import { Stack } from 'expo-router';
import { AuthProvider, AlertProvider, ThemeProvider } from '@/template';
import { DMNotificationProvider } from '@/components/DMNotificationProvider';
import { AnalyticsProvider } from '@/contexts/AnalyticsContext';
import { useRouteAnalytics } from '@/hooks/useRouteAnalytics';

function RootLayoutNav() {
  // Auto-track page views on route changes
  useRouteAnalytics();

  return (
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
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AlertProvider>
        <AuthProvider>
          <AnalyticsProvider>
            <DMNotificationProvider>
              <RootLayoutNav />
            </DMNotificationProvider>
          </AnalyticsProvider>
        </AuthProvider>
      </AlertProvider>
    </ThemeProvider>
  );
}
