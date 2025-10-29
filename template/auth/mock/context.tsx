// @ts-nocheck
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthUser } from '../types';
import { mockAuthService } from './service';

// Context type definition - consistent with Supabase Auth
interface MockAuthContextState {
  user: AuthUser | null;
  loading: boolean;
  operationLoading: boolean;
  initialized: boolean;
}

interface MockAuthContextActions {
  setOperationLoading: (loading: boolean) => void;
}

type MockAuthContextType = MockAuthContextState & MockAuthContextActions;

// Create Context
const MockAuthContext = createContext<MockAuthContextType | undefined>(undefined);

// MockAuthProvider - clean design
interface MockAuthProviderProps {
  children: ReactNode;
}

export function MockAuthProvider({ children }: MockAuthProviderProps) {
  const [state, setState] = useState<MockAuthContextState>({
    user: null,
    loading: true,
    operationLoading: false,
    initialized: false,
  });

    // Unified state update function
  const updateState = (updates: Partial<MockAuthContextState>) => {
    setState(prevState => {
      const newState = { ...prevState, ...updates };
      return newState;
    });
  };

  // Set operation loading state
  const setOperationLoading = (loading: boolean) => {
    updateState({ operationLoading: loading });
  };

  // Initialize Mock auth system - execute only once
  useEffect(() => {
    let isMounted = true;
    let authSubscription: any = null;

    const initializeMockAuth = async () => {      
      try {
        // 1. Get current user state
        const currentUser = await mockAuthService.getCurrentUser();
        
        if (isMounted) {
          updateState({ 
            user: currentUser, 
            loading: false, 
            initialized: true 
          });
        }

        // 2. Set up auth state listener
        authSubscription = mockAuthService.onAuthStateChange((authUser) => {
          if (isMounted) {
            updateState({ user: authUser });
          }
        });

      } catch (error) {
        console.warn('[Template:MockAuthProvider] Mock auth initialization failed:', error);
        if (isMounted) {
          updateState({ 
            user: null, 
            loading: false, 
            initialized: true 
          });
        }
      }
    };

    initializeMockAuth();

    // Cleanup function
    return () => {
      isMounted = false;
      if (authSubscription?.unsubscribe) {
        authSubscription.unsubscribe();
      }
    };
  }, []); // Empty dependency array ensures single execution

  // Context value
  const contextValue: MockAuthContextType = {
    ...state,
    setOperationLoading,
  };

  return (
    <MockAuthContext.Provider value={contextValue}>
      {children}
    </MockAuthContext.Provider>
  );
}

// useMockAuthContext Hook - internal use
export function useMockAuthContext(): MockAuthContextType {
  const context = useContext(MockAuthContext);
  
  if (context === undefined) {
    throw new Error('useMockAuthContext must be used within a MockAuthProvider');
  }
  
  return context;
}