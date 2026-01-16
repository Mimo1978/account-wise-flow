import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Auth Guard Component
 * 
 * Wraps protected CRM routes to ensure only authenticated users can access them.
 * - Shows loading spinner while checking auth state
 * - Redirects unauthenticated users to /auth with return URL preserved
 * - Renders children for authenticated users
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
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
