import { useLocation } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';

export type WorkspaceMode = 'real' | 'demo-authenticated' | 'demo-public';

/**
 * Hook to determine the current workspace mode
 * 
 * Three distinct modes:
 * 1. 'real' - Authenticated user in their own workspace (full CRUD, persistent data)
 * 2. 'demo-authenticated' - Authenticated user in demo sandbox (full CRUD, isolated demo data)
 * 3. 'demo-public' - Unauthenticated user viewing public demo (read-only, sample data)
 */
export function useWorkspaceMode(): {
  mode: WorkspaceMode;
  isDemo: boolean;
  isReadOnly: boolean;
  isDemoAuthenticated: boolean;
  isRealWorkspace: boolean;
} {
  const { user } = useAuth();
  const { currentWorkspace, isInDemoWorkspace } = useWorkspace();
  const location = useLocation();

  // Public demo route (no auth required)
  const isPublicDemoRoute = location.pathname === '/demo';
  
  // Authenticated demo workspace
  const isDemoWorkspaceRoute = location.pathname === '/demo-workspace';
  
  // Determine mode
  let mode: WorkspaceMode;
  
  if (isPublicDemoRoute) {
    mode = 'demo-public';
  } else if (!user) {
    // No user, default to public demo behavior
    mode = 'demo-public';
  } else if (isDemoWorkspaceRoute || isInDemoWorkspace) {
    mode = 'demo-authenticated';
  } else {
    mode = 'real';
  }

  return {
    mode,
    isDemo: mode !== 'real',
    isReadOnly: mode === 'demo-public',
    isDemoAuthenticated: mode === 'demo-authenticated',
    isRealWorkspace: mode === 'real',
  };
}

/**
 * Guard hook that throws an error if called in demo mode
 * Use this in mutations/actions that should NEVER affect demo data
 */
export function useRealModeGuard(): void {
  const { mode } = useWorkspaceMode();
  
  if (mode !== 'real') {
    throw new Error('This action requires a real workspace. Demo data cannot be modified.');
  }
}

/**
 * Hook to check if the current context should show demo UI indicators
 */
export function useDemoIndicator(): {
  showBanner: boolean;
  showBadge: boolean;
  bannerVariant: 'authenticated' | 'public';
} {
  const { mode } = useWorkspaceMode();
  
  return {
    showBanner: mode !== 'real',
    showBadge: mode !== 'real',
    bannerVariant: mode === 'demo-public' ? 'public' : 'authenticated',
  };
}
