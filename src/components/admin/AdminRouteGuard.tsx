import { ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions, AppRole } from '@/hooks/use-permissions';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Loader2 } from 'lucide-react';

type AdminSection =
  | 'overview'
  | 'access'
  | 'governance'
  | 'data-quality'
  | 'orgchart'
  | 'outreach'
  | 'signals'
  | 'schema'
  | 'support'
  | 'workspace'
  | 'integrations';

const SECTION_ACCESS: Record<AdminSection, AppRole[]> = {
  overview: ['admin', 'manager', 'contributor', 'viewer'],
  schema: ['admin', 'manager', 'contributor', 'viewer'],
  support: ['admin', 'manager', 'contributor', 'viewer'],
  'data-quality': ['admin', 'manager', 'contributor'],
  outreach: ['admin', 'manager', 'contributor'],
  orgchart: ['admin', 'manager', 'contributor'],
  signals: ['admin', 'manager', 'contributor'],
  governance: ['admin', 'manager'],
  workspace: ['admin', 'manager'],
  integrations: ['admin', 'manager'],
  access: ['admin', 'manager'],
};

interface AdminRouteGuardProps {
  section: AdminSection;
  children: ReactNode;
}

export function AdminRouteGuard({ section, children }: AdminRouteGuardProps) {
  const { role, isLoading, userId } = usePermissions();
  const { currentWorkspace } = useWorkspace();
  const location = useLocation();

  // Dev console logs
  useEffect(() => {
    if (!isLoading) {
      console.log('[Admin] page load success', {
        path: location.pathname,
        section,
        role,
        userId,
        workspaceId: currentWorkspace?.id ?? null,
      });
    }
  }, [isLoading, location.pathname, section, role, userId, currentWorkspace?.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!role) {
    return <Navigate to="/auth" replace />;
  }

  const allowedRoles = SECTION_ACCESS[section] ?? ['admin'];
  if (!allowedRoles.includes(role)) {
    console.warn('[Admin] access denied', { section, role, userId });
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="text-sm text-muted-foreground">
            Your role ({role}) does not have access to this section.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export { SECTION_ACCESS };
export type { AdminSection };
