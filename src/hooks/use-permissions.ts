import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'manager' | 'contributor' | 'viewer' | null;

interface PermissionsState {
  role: AppRole;
  teamId: string | null;
  userId: string | null;
  isLoading: boolean;
  canEdit: boolean;
  canInsert: boolean;
  canDelete: boolean;
  isAdmin: boolean;
  isManager: boolean;
}

export function usePermissions(): PermissionsState {
  const [role, setRole] = useState<AppRole>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchRoleAndTeam = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          if (mounted) {
            setRole(null);
            setTeamId(null);
            setUserId(null);
            setIsLoading(false);
          }
          return;
        }

        if (mounted) {
          setUserId(user.id);
        }

        // Fetch role
        const { data: roleData, error: roleError } = await supabase.rpc('get_user_role', {
          _user_id: user.id
        });

        // Fetch team_id
        const { data: teamData, error: teamError } = await supabase.rpc('get_user_team_id', {
          _user_id: user.id
        });

        if (mounted) {
          if (roleError) {
            console.error('Error fetching user role:', roleError);
            setRole(null);
          } else {
            setRole(roleData as AppRole);
          }

          if (teamError) {
            console.error('Error fetching user team:', teamError);
            setTeamId(null);
          } else {
            setTeamId(teamData as string | null);
          }

          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error in usePermissions:', err);
        if (mounted) {
          setRole(null);
          setTeamId(null);
          setUserId(null);
          setIsLoading(false);
        }
      }
    };

    fetchRoleAndTeam();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRoleAndTeam();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isContributor = role === 'contributor';
  const isViewer = role === 'viewer';

  return {
    role,
    teamId,
    userId,
    isLoading,
    // Can edit: admin, manager, contributor (owner/team check done at RLS level)
    canEdit: isAdmin || isManager || isContributor,
    // Can insert: admin, manager, contributor
    canInsert: isAdmin || isManager || isContributor,
    // Can delete: admin only
    canDelete: isAdmin,
    isAdmin,
    isManager,
  };
}

// Tooltip message for disabled actions
export function getPermissionTooltip(action: 'edit' | 'insert' | 'delete', role: AppRole): string | null {
  if (!role) {
    return 'Please sign in to perform this action';
  }
  
  switch (action) {
    case 'delete':
      if (role !== 'admin') {
        return 'Only admins can delete records';
      }
      break;
    case 'edit':
    case 'insert':
      if (role === 'viewer') {
        return 'Viewers have read-only access';
      }
      break;
  }
  
  return null;
}
