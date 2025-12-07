import { createContext, useContext, useEffect, ReactNode } from 'react';
import ReactGA from 'react-ga4';
import { useAuth } from '@/template';

interface AnalyticsContextType {
  logEvent: (eventName: string, params?: Record<string, any>) => void;
  logPageView: (pageName: string, params?: Record<string, any>) => void;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // Initialize GA4 on mount
  useEffect(() => {
    const measurementId = process.env.EXPO_PUBLIC_GA4_MEASUREMENT_ID;
    if (measurementId) {
      ReactGA.initialize(measurementId, {
        gaOptions: {
          debug_mode: process.env.NODE_ENV === 'development',
        },
      });
      console.log('[Analytics] Initialized with ID:', measurementId);
    } else {
      console.warn('[Analytics] No Measurement ID found');
    }
  }, []);

  // Set user ID when authenticated
  useEffect(() => {
    if (user?.id) {
      ReactGA.set({ userId: user.id });
      console.log('[Analytics] User identified:', user.id);
    }
  }, [user]);

  const logEvent = (eventName: string, params?: Record<string, any>) => {
    try {
      ReactGA.event(eventName, params);
      console.log(`[Analytics] Event: ${eventName}`, params);
    } catch (error) {
      console.error('[Analytics] Error logging event:', error);
    }
  };

  const logPageView = (pageName: string, params?: Record<string, any>) => {
    try {
      ReactGA.send({ hitType: 'pageview', page: pageName, ...params });
      console.log(`[Analytics] Page view: ${pageName}`);
    } catch (error) {
      console.error('[Analytics] Error logging page view:', error);
    }
  };

  return (
    <AnalyticsContext.Provider value={{ logEvent, logPageView }}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within AnalyticsProvider');
  }
  return context;
}
