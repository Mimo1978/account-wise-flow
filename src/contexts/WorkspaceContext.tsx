import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

export type WorkspaceType = 'real' | 'demo';

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  isDemo: boolean;
  role?: string;
}

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  isLoading: boolean;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  isInDemoWorkspace: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};

const WORKSPACE_STORAGE_KEY = 'lovable_current_workspace';

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspaceState(null);
      setIsLoading(false);
      return;
    }

    try {
      // Get user's current workspace ID from their role
      const { data: workspaceId, error: wsError } = await supabase.rpc('get_current_workspace_id', {
        _user_id: user.id
      });

      if (wsError) {
        console.error('Error fetching workspace ID:', wsError);
      }

      // If user has a workspace, get its details
      if (workspaceId) {
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('id, name, is_demo')
          .eq('id', workspaceId)
          .single();

        if (!teamError && teamData) {
          const workspace: Workspace = {
            id: teamData.id,
            name: teamData.name,
            type: teamData.is_demo ? 'demo' : 'real',
            isDemo: teamData.is_demo
          };
          
          setWorkspaces([workspace]);
          
          // Check localStorage for previously selected workspace
          const storedWorkspaceId = localStorage.getItem(WORKSPACE_STORAGE_KEY);
          if (storedWorkspaceId === workspace.id) {
            setCurrentWorkspaceState(workspace);
          } else {
            setCurrentWorkspaceState(workspace);
            localStorage.setItem(WORKSPACE_STORAGE_KEY, workspace.id);
          }
        }
      } else {
        setWorkspaces([]);
        setCurrentWorkspaceState(null);
        localStorage.removeItem(WORKSPACE_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const setCurrentWorkspace = useCallback((workspace: Workspace | null) => {
    setCurrentWorkspaceState(workspace);
    if (workspace) {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, workspace.id);
    } else {
      localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    }
  }, []);

  const switchWorkspace = useCallback(async (workspaceId: string) => {
    const workspace = workspaces.find(w => w.id === workspaceId);
    if (workspace) {
      setCurrentWorkspace(workspace);
    }
  }, [workspaces, setCurrentWorkspace]);

  const refreshWorkspaces = useCallback(async () => {
    setIsLoading(true);
    await fetchWorkspaces();
  }, [fetchWorkspaces]);

  const isInDemoWorkspace = currentWorkspace?.isDemo ?? false;

  const value = {
    currentWorkspace,
    workspaces,
    isLoading,
    setCurrentWorkspace,
    switchWorkspace,
    refreshWorkspaces,
    isInDemoWorkspace,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};
