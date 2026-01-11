import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'manager' | 'contributor' | 'viewer' | null;

interface PermissionsState {
  role: AppRole;
  isLoading: boolean;
  canEdit: boolean;
  canInsert: boolean;
  canDelete: boolean;
  isAdmin: boolean;
  isManager: boolean;
}

export function usePermissions(): PermissionsState {
  const [role, setRole] = useState<AppRole>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          if (mounted) {
            setRole(null);
            setIsLoading(false);
          }
          return;
        }

        const { data, error } = await supabase.rpc('get_user_role', {
          _user_id: user.id
        });

        if (mounted) {
          if (error) {
            console.error('Error fetching user role:', error);
            setRole(null);
          } else {
            setRole(data as AppRole);
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error in usePermissions:', err);
        if (mounted) {
          setRole(null);
          setIsLoading(false);
        }
      }
    };

    fetchRole();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRole();
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
