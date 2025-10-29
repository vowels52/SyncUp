// @ts-nocheck
import { AuthUser, SendOTPOptions, SignUpResult } from '../types';
import { safeSupabaseOperation, getSharedSupabaseClient } from '../../core/client';
import { configManager } from '../../core/config';
import { Platform } from 'react-native';

// Visibility change listener related variables
let lastVisibilityChange = 0;
let visibilityListener: (() => void) | null = null;

// Operation state tracking to prevent deadlock
let isUpdatingUser = false;

const TIMEOUT_CONFIG = {
  AUTH_OPERATIONS: 10000,
  DATA_QUERIES: 8000,  
  SESSION_REFRESH: 5000,
  USER_UPDATE: 15000,
};

// Utility function to add timeout to any Promise with proper cleanup
const withTimeout = <T>(
  promise: Promise<T>, 
  timeoutMs: number, 
  operation: string = 'Operation'
): Promise<T> => {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operation} timeout after ${timeoutMs/1000} seconds`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
};

const isAuthError = (error: any): boolean => {
  if (error.message?.includes('timeout')) return false;
  return error.status === 401 || 
         error.status === 403 || 
         error.message?.includes('invalid_token');
};

// Visibility monitoring logic - used to optimize auth event handling
const setupVisibilityMonitoring = () => {
  if (visibilityListener || Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }

  visibilityListener = () => {
    lastVisibilityChange = Date.now();
  };

  document.addEventListener('visibilitychange', visibilityListener);
};

export const isVisibilityTriggeredAuthEvent = (event: string): boolean => {
  if (event !== 'SIGNED_IN') return false;

  const timeSinceVisibilityChange = Date.now() - lastVisibilityChange;
  return timeSinceVisibilityChange < 1000;
};

export const getLastVisibilityChange = (): number => lastVisibilityChange;

// Enhanced event filtering to prevent deadlock
export const shouldIgnoreAuthEvent = (event: string): boolean => {
  // Ignore USER_UPDATED events during updateUser operation to prevent deadlock
  if (event === 'USER_UPDATED' && isUpdatingUser) {
    return true;
  }
  
  // Ignore visibility-triggered events
  if (isVisibilityTriggeredAuthEvent(event)) {
    return true;
  }
  
  return false;
};

export class AuthService {
  constructor() {
    // Initialize visibility monitoring
    setupVisibilityMonitoring();
  }

  private get supabase() {
    return getSharedSupabaseClient();
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const user = await safeSupabaseOperation(async (client) => {
        const { data: { user }, error: getUserError } = await withTimeout(
          client.auth.getUser(),
          TIMEOUT_CONFIG.DATA_QUERIES,
          'GetUser'
        );
        
        return user;
      }, true);
      
      if (!user) return null;

      const fallbackUser: AuthUser = {
        id: user.id,
        email: user.email || '',
        username: user.email ? user.email.split('@')[0] : `user_${user.id.slice(0, 8)}`,
        created_at: user.created_at,
        updated_at: user.updated_at || user.created_at,
      };

      const authConfig = configManager.getModuleConfig('auth');
      const tableName = authConfig?.profileTableName || 'user_profiles';

      try {
        const profile = await safeSupabaseOperation(async (client) => {
          const { data: profile, error: profileError } = await withTimeout(
            client
              .from(tableName)
              .select('*')
              .eq('id', user.id)
              .single(),
            TIMEOUT_CONFIG.DATA_QUERIES,
            'ProfileQuery'
          );
          
          if (profileError) {
            if (profileError.message.includes('timeout')) {
              console.warn('[Template:AuthService] Profile query timeout, using fallback data');
              return null;
            } else if (profileError.code === 'PGRST116') {
              console.warn(`[Template:AuthService] Profile table '${tableName}' not found. Using fallback data.`);
            } else if (profileError.code === 'PGRST301') {
              console.warn(`[Template:AuthService] User profile not found in '${tableName}'. Creating trigger may be needed.`);
            } else {
              console.warn(`[Template:AuthService] Profile query failed:`, profileError.message);
            }
            return null;
          }
          
          return profile;
        });

        if (profile) {
          return {
            id: profile.id || fallbackUser.id,
            email: profile.email || fallbackUser.email,
            username: profile.username || fallbackUser.username,
            created_at: profile.created_at || fallbackUser.created_at,
            updated_at: profile.updated_at || fallbackUser.updated_at,
          };
        }

        console.warn(`[Template:AuthService] Profile data is null for user ${user.id}. Using fallback data.`);
        return fallbackUser;

      } catch (profileError) {
        const errorMessage = profileError instanceof Error ? profileError.message : 'Unknown profile error';
        console.warn(`[Template:AuthService] Profile table access error:`, errorMessage);
        return fallbackUser;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown getCurrentUser error';
      
      if (isAuthError(error)) {
        return null;
      }
      
      try {
        const session = await safeSupabaseOperation(async (client) => {
          const { data: { session } } = await client.auth.getSession();
          return session;
        });
        
        if (session?.user) {
          const sessionUser = session.user;
          const fallbackUser: AuthUser = {
            id: sessionUser.id,
            email: sessionUser.email || '',
            username: sessionUser.email ? sessionUser.email.split('@')[0] : `user_${sessionUser.id.slice(0, 8)}`,
            created_at: sessionUser.created_at,
            updated_at: sessionUser.updated_at || sessionUser.created_at,
          };
          return fallbackUser;
        }
      } catch (sessionError) {
        console.warn('[Template:AuthService] Session fallback also failed:', sessionError);
      }
      
      return null;
    }
  }

  async sendOTP(email: string, options: SendOTPOptions = {}) {
    try {
      const { shouldCreateUser = true, emailRedirectTo } = options;
      
      return await safeSupabaseOperation(async (client) => {
        const { error } = await withTimeout(
          client.auth.signInWithOtp({
            email,
            options: {
              shouldCreateUser,
              emailRedirectTo,
            }
          }),
          TIMEOUT_CONFIG.AUTH_OPERATIONS,
          'SendOTP'
        );
        
        if (error) {
          if (error.message.includes('timeout')) {
            return { error: 'Network is slow, please retry', errorType: 'timeout' };
          }
          return { error: error.message, errorType: 'business' };
        }
        
        return {};
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sendOTP error';
      console.warn('[Template:AuthService] SendOTP system exception:', errorMessage);
      
      if (errorMessage.includes('timeout')) {
        return { error: 'Network connection timeout, please check network and retry', errorType: 'timeout' };
      }
      
      return { error: 'Failed to send verification code', errorType: 'network' };
    }
  }

  async verifyOTPAndLogin(email: string, otp: string, options?: { password?: string }) {
    try {
      return await safeSupabaseOperation(async (client) => {
        // Step 1: Verify OTP first
        const { data, error } = await withTimeout(
          client.auth.verifyOtp({
            email,
            token: otp,
            type: 'email'
          }),
          TIMEOUT_CONFIG.AUTH_OPERATIONS,
          'VerifyOTP'
        );

        if (error) {
          if (error.message.includes('Database error saving new user')) {
            console.warn('[Template:AuthService] Database trigger missing, auth function available but user profile creation failed');
            console.warn('[Template:AuthService] Please refer to SDK documentation to set up user_profiles table and triggers');
          }
          
          if (error.message.includes('timeout')) {
            return { error: 'Verification timeout, please retry', user: null, errorType: 'timeout' };
          }
          
          return { error: error.message, user: null, errorType: 'business' };
        }

        if (data.user) {
  
          // Step 2: Update user with password if provided (with deadlock prevention)
          if (options?.password) {
            
            try {
              // Set flag to prevent deadlock
              isUpdatingUser = true;
              
              const { data: updateData, error: updateError } = await withTimeout(
                client.auth.updateUser({ password: options.password }),
                TIMEOUT_CONFIG.USER_UPDATE,
                'UpdateUser'
              );
              
              
              if (updateError) {
                console.warn('[Template:AuthService] User update failed after OTP verification:', updateError.message);
                // Note: We don't fail the entire operation if user update fails
                // The user is still successfully authenticated via OTP
              }
              
              // Clear flag after a delay to ensure all events are processed
              setTimeout(() => {
                isUpdatingUser = false;
              }, 2000);
              
            } catch (updateError) {
              // Clear flag on error
              isUpdatingUser = false;
              // Continue with the authentication flow
            }
          }

          // Standard flow: Check session status (wait a bit if we just updated user)
          if (options?.password) {
            // Wait a moment for the update to settle
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          try {
            const authUser = await this.getCurrentUser();
            
            if (authUser) {
              return { user: authUser };
            } else {
              // Final fallback: Use original verification data
              const fallbackUser: AuthUser = {
                id: data.user.id,
                email: data.user.email || '',
                username: data.user.email ? data.user.email.split('@')[0] : `user_${data.user.id.slice(0, 8)}`,
                created_at: data.user.created_at,
                updated_at: data.user.updated_at || data.user.created_at,
              };
              return { user: fallbackUser };
            }
          } catch (userError) {
            const errorMessage = userError instanceof Error ? userError.message : 'Unknown error';
            
            // Use fallback data
            const fallbackUser: AuthUser = {
              id: data.user.id,
              email: data.user.email || '',
              username: data.user.email ? data.user.email.split('@')[0] : `user_${data.user.id.slice(0, 8)}`,
              created_at: data.user.created_at,
              updated_at: data.user.updated_at || data.user.created_at,
            };
            return { user: fallbackUser };
          }
        }
        
        return { user: null };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown verifyOTP error';
      console.warn('[Template:AuthService] VerifyOTPAndLogin system exception:', errorMessage);
      
      // Clear flag on any error
      isUpdatingUser = false;
      
      if (errorMessage.includes('timeout')) {
        return { error: 'Login timeout, please retry', user: null, errorType: 'timeout' };
      }
      
      return { error: 'Login failed', user: null, errorType: 'network' };
    }
  }

  async signUpWithPassword(email: string, password: string, metadata: Record<string, any> = {}): Promise<SignUpResult> {
    try {
      return await safeSupabaseOperation(async (client) => {
        const { data, error } = await withTimeout(
          client.auth.signUp({
            email,
            password,
            options: {
              data: metadata
            }
          }),
          TIMEOUT_CONFIG.AUTH_OPERATIONS,
          'SignUp'
        );

        if (error) {
          if (error.message.includes('timeout')) {
            return { error: 'Sign up timeout, please retry', errorType: 'timeout' };
          }
          return { error: error.message, errorType: 'business' };
        }

        if (data.user && !data.session) {
          return { 
            user: null, 
            needsEmailConfirmation: true 
          };
        }

        if (data.user && data.session) {
          try {
            const authUser = await this.getCurrentUser();
            return { user: authUser };
          } catch (userError) {
            console.warn('[Template:AuthService] Error retrieving user after signup:', userError);
            return { error: 'Sign up succeeded but failed to load profile', user: null, errorType: 'network' };
          }
        }
        
        return { user: null };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown signUp error';
      console.warn('[Template:AuthService] SignUpWithPassword system exception:', errorMessage);
      
      if (errorMessage.includes('timeout')) {
        return { error: 'Sign up timeout, please retry', errorType: 'timeout' };
      }
      
      return { error: 'Sign up failed', errorType: 'network' };
    }
  }

  async signInWithPassword(email: string, password: string) {
    try {
      return await safeSupabaseOperation(async (client) => {
        const { data, error } = await withTimeout(
          client.auth.signInWithPassword({
            email,
            password
          }),
          TIMEOUT_CONFIG.AUTH_OPERATIONS,
          'SignIn'
        );

        if (error) {
          if (error.message.includes('timeout')) {
            return { error: 'Sign in timeout, please retry', user: null, errorType: 'timeout' };
          }
          return { error: error.message, user: null, errorType: 'business' };
        }

        if (data.user) {
          try {
            const authUser = await this.getCurrentUser();
            
            if (authUser) {
              return { user: authUser };
            } else {
              return { error: 'Failed to load user profile', user: null, errorType: 'business' };
            }
          } catch (userError) {
            console.warn('[Template:AuthService] Error retrieving user after sign in:', userError);
            return { error: 'Sign in succeeded but failed to load profile', user: null, errorType: 'network' };
          }
        }
        
        return { user: null };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown signIn error';
      console.warn('[Template:AuthService] SignInWithPassword system exception:', errorMessage);
      
      if (errorMessage.includes('timeout')) {
        return { error: 'Sign in timeout, please retry', user: null, errorType: 'timeout' };
      }
      
      return { error: 'Sign in failed', user: null, errorType: 'network' };
    }
  }

  async logout() {
    try {
      return await safeSupabaseOperation(async (client) => {
        const { error } = await withTimeout(
          client.auth.signOut(),
          TIMEOUT_CONFIG.AUTH_OPERATIONS,
          'Logout'
        );
        
        if (error) {
          if (error.message.includes('timeout')) {
            return { error: 'Logout timeout, please retry', errorType: 'timeout' };
          }
          return { error: error.message, errorType: 'business' };
        }
        
        return {};
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown logout error';
      console.warn('[Template:AuthService] Logout system exception:', errorMessage);
      
      if (errorMessage.includes('timeout')) {
        return { error: 'Logout timeout, please check network and retry', errorType: 'timeout' };
      }
      
      return { error: errorMessage, errorType: 'network' };
    }
  }

  async refreshSession() {
    try {
      return await safeSupabaseOperation(async (client) => {
        const { error } = await withTimeout(
          client.auth.refreshSession(),
          TIMEOUT_CONFIG.SESSION_REFRESH,
          'RefreshSession'
        );
        
        if (error) {
          if (error.message.includes('timeout')) {
            console.warn('[Template:AuthService] Session refresh timeout');
          } else {
            console.warn('[Template:AuthService] Refresh session error:', error);
          }
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown refresh error';
      console.warn('[Template:AuthService] RefreshSession system exception:', errorMessage);
    }
  }

  onAuthStateChange(callback: (user: AuthUser | null) => void) {
    try {
      const { data: { subscription } } = this.supabase.auth.onAuthStateChange(
        async (event, session) => {
          // Use enhanced event filtering to prevent deadlock
          if (shouldIgnoreAuthEvent(event)) {
            return;
          }
          
          if (session?.user) {
            try {
              const authUser = await this.getCurrentUser();
              callback(authUser);
            } catch (error) {
              console.warn('[Template:AuthService] Error in auth state change callback:', error);
              callback(null);
            }
          } else {
            callback(null);
          }
        }
      );

      return subscription;
    } catch (error) {
      console.error('[Template:AuthService] Failed to set up auth state listener:', error);
      throw error;
    }
  }
}

export const authService = new AuthService();
