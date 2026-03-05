import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/use-permissions';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminSettingsPanel } from '@/components/admin/AdminSettingsPanel';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Database, ChevronLeft } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

function AdminNav() {
  const { isAdmin } = usePermissions();
  const location = useLocation();

  if (!isAdmin) return null;

  const tabs = [
    { label: 'Top Tier Companies', path: '/workspace-settings' },
    { label: 'Schema Inventory', path: '/admin/schema', icon: Database },
  ];

  return (
    <div className="flex gap-1 border-b border-border mb-6">
      {tabs.map((tab) => {
        const active = location.pathname === tab.path;
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5',
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            {tab.icon && <tab.icon className="h-3.5 w-3.5" />}
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export default function WorkspaceSettings() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();

  const canAccessSettings = user && true;

  if (!canAccessSettings) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">You do not have permission to access workspace settings.</p>
          <Button onClick={() => navigate('/')} variant="outline">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <Button
            onClick={() => navigate(-1)}
            variant="ghost"
            size="sm"
            className="mb-6 gap-1 text-muted-foreground hover:text-foreground -ml-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>

          <AdminNav />

          <AdminSettingsPanel />
        </div>
      </div>
    </ProtectedRoute>
  );
}
