import { useCallback } from 'react';
import { useWorkspace, Workspace, WorkspaceType } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

/**
 * Hook for workspace management utilities
 * Provides helper functions for common workspace operations
 */
export function useWorkspaceUtils() {
  const { user } = useAuth();
  const { 
    currentWorkspace, 
    isInDemoWorkspace, 
    setCurrentWorkspace,
    refreshWorkspaces 
  } = useWorkspace();
  const navigate = useNavigate();

  /**
   * Get the current workspace ID (for use in queries)
   */
  const getCurrentWorkspaceId = useCallback((): string | null => {
    return currentWorkspace?.id ?? null;
  }, [currentWorkspace]);

  /**
   * Check if the current workspace is a demo workspace
   */
  const isDemoWorkspace = useCallback((): boolean => {
    return isInDemoWorkspace;
  }, [isInDemoWorkspace]);

  /**
   * Enter the demo workspace (join if not already a member)
   */
  const enterDemoWorkspace = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data: teamId, error } = await supabase.rpc('join_demo_team', {
        _user_id: user.id
      });

      if (error) {
        console.error('Error joining demo team:', error);
        return false;
      }

      // Refresh workspaces to get the updated list
      await refreshWorkspaces();
      
      // Navigate to demo workspace
      navigate('/demo-workspace');
      return true;
    } catch (error) {
      console.error('Error entering demo workspace:', error);
      return false;
    }
  }, [user, refreshWorkspaces, navigate]);

  /**
   * Leave the demo workspace
   */
  const leaveDemoWorkspace = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase.rpc('leave_demo_team', {
        _user_id: user.id
      });

      if (error) {
        console.error('Error leaving demo team:', error);
        return false;
      }

      // Clear current workspace if it was the demo
      if (isInDemoWorkspace) {
        setCurrentWorkspace(null);
      }

      // Refresh workspaces
      await refreshWorkspaces();
      
      // Navigate to workspace selector
      navigate('/workspace');
      return true;
    } catch (error) {
      console.error('Error leaving demo workspace:', error);
      return false;
    }
  }, [user, isInDemoWorkspace, setCurrentWorkspace, refreshWorkspaces, navigate]);

  /**
   * Reset demo data to default state
   */
  const resetDemoData = useCallback(async (): Promise<boolean> => {
    if (!user || !isInDemoWorkspace) return false;

    try {
      const { error } = await supabase.rpc('reset_demo_data', {
        _user_id: user.id
      });

      if (error) {
        console.error('Error resetting demo data:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error resetting demo data:', error);
      return false;
    }
  }, [user, isInDemoWorkspace]);

  /**
   * Check if user has access to a real workspace
   */
  const hasRealWorkspace = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase.rpc('has_real_workspace', {
        _user_id: user.id
      });

      if (error) {
        console.error('Error checking real workspace:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Error checking real workspace:', error);
      return false;
    }
  }, [user]);

  return {
    currentWorkspace,
    getCurrentWorkspaceId,
    isDemoWorkspace,
    isInDemoWorkspace,
    enterDemoWorkspace,
    leaveDemoWorkspace,
    resetDemoData,
    hasRealWorkspace,
  };
}

/**
 * Simple hook to get workspace ID for use in data queries
 * This ensures all queries are scoped to the current workspace
 */
export function useWorkspaceId(): string | null {
  const { currentWorkspace } = useWorkspace();
  return currentWorkspace?.id ?? null;
}

/**
 * Hook to check if current user is in demo mode
 */
export function useIsDemoMode(): boolean {
  const { isInDemoWorkspace } = useWorkspace();
  return isInDemoWorkspace;
}
