import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Auth Guard Component
 * 
 * Wraps protected CRM routes to ensure only authenticated users can access them.
 * - Shows loading spinner while checking auth state
 * - Auto-provisions workspace for new users (no selector needed)
 * - Redirects unauthenticated users to /auth with return URL preserved
 * - Renders children for authenticated users with workspace
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace, isLoading: workspaceLoading, refreshWorkspaces } = useWorkspace();
  const location = useLocation();
  const [isProvisioning, setIsProvisioning] = useState(false);
  const provisioningAttempted = useRef(false);

  // Auto-provision workspace for authenticated users without one
  useEffect(() => {
    const provisionWorkspace = async () => {
      if (!user || authLoading || workspaceLoading || currentWorkspace || provisioningAttempted.current || isProvisioning) {
        return;
      }

      provisioningAttempted.current = true;
      setIsProvisioning(true);

      console.log('[ProtectedRoute] No workspace found, auto-provisioning for user:', user.id);

      try {
        // Extract company name from email domain as default workspace name
        const emailDomain = user.email?.split('@')[1]?.split('.')[0];
        const workspaceName = emailDomain 
          ? emailDomain.charAt(0).toUpperCase() + emailDomain.slice(1) + ' Workspace'
          : 'My Workspace';

        const { data, error } = await supabase.functions.invoke('workspace-management/create-workspace', {
          body: { name: workspaceName }
        });

        if (error) {
          console.error('[ProtectedRoute] Failed to provision workspace:', error);
          setIsProvisioning(false);
          return;
        }

        if (data?.success && data?.workspaceId) {
          console.log('[ProtectedRoute] Workspace provisioned:', data.workspaceId);
          localStorage.setItem('lovable_current_workspace', data.workspaceId);
          await refreshWorkspaces();
        }
      } catch (err) {
        console.error('[ProtectedRoute] Error provisioning workspace:', err);
      } finally {
        setIsProvisioning(false);
      }
    };

    provisionWorkspace();
  }, [user, authLoading, workspaceLoading, currentWorkspace, refreshWorkspaces, isProvisioning]);

  // Show loading state while checking authentication or provisioning
  if (authLoading || workspaceLoading || isProvisioning) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">
            {isProvisioning ? 'Setting up your workspace...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  // Redirect unauthenticated users to login, preserving intended destination
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Render protected content for authenticated users
  return <>{children}</>;
};
