import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminSettingsPanel } from '@/components/admin/AdminSettingsPanel';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function WorkspaceSettings() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();

  // Check if user is admin or manager
  const canAccessSettings = user && (
    // This will be properly checked via RLS on the backend
    true // Frontend just shows the UI; backend enforces permissions
  );

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
          {/* Back Button */}
          <Button
            onClick={() => navigate(-1)}
            variant="ghost"
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {/* Settings Panel */}
          <AdminSettingsPanel />
        </div>
      </div>
    </ProtectedRoute>
  );
}
