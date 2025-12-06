import { useEffect } from 'react';
import { useSegments, usePathname } from 'expo-router';
import { useAnalytics } from '@/contexts/AnalyticsContext';

export function useRouteAnalytics() {
  const segments = useSegments();
  const pathname = usePathname();
  const { logPageView } = useAnalytics();

  useEffect(() => {
    // Convert pathname to readable page name
    const pageName = pathname === '/' ? 'Home' : pathname;

    logPageView(pageName, {
      segments: segments.join('/'),
    });
  }, [pathname, segments]);
}
