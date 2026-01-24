import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FlaskConical, Briefcase, ArrowRight, Sparkles, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface WorkspaceInfo {
  id: string;
  name: string;
  isDemo: boolean;
  workspaceMode: string;
  type: string;
  role: string;
}

/**
 * Workspace Selector Page
 * 
 * After login, users can choose between:
 * - Demo Workspace: Sandboxed environment with full features, seeded data
 * - My Workspace: Real production workspace (create if none exists)
 */
const WorkspaceSelector = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [joiningDemo, setJoiningDemo] = useState(false);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);

  // Derived state
  const demoWorkspace = workspaces.find(w => w.isDemo);
  const realWorkspace = workspaces.find(w => !w.isDemo);
  const hasRealWorkspace = !!realWorkspace;
  const isDemoUser = !!demoWorkspace;

  useEffect(() => {
    const fetchWorkspaces = async () => {
      if (!user) return;
      
      console.log('[WorkspaceSelector] Fetching workspaces for user:', user.id);
      
      try {
        const { data, error } = await supabase.functions.invoke('workspace-management/get-user-workspaces');
        
        if (error) {
          console.error('[WorkspaceSelector] Error fetching workspaces:', error);
          throw error;
        }
        
        console.log('[WorkspaceSelector] Workspaces response:', data);
        
        if (data?.success && data?.workspaces) {
          setWorkspaces(data.workspaces);
        }
      } catch (error) {
        console.error('[WorkspaceSelector] Failed to fetch workspaces:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (!authLoading && user) {
      fetchWorkspaces();
    } else if (!authLoading && !user) {
      setIsLoading(false);
    }
  }, [user, authLoading]);

  const handleEnterDemo = async () => {
    if (!user) {
      console.error('[WorkspaceSelector] No user found');
      toast.error('Please log in to continue');
      return;
    }
    
    console.log('[WorkspaceSelector] Enter Demo clicked');
    console.log('[WorkspaceSelector] User ID:', user.id);
    console.log('[WorkspaceSelector] Is already demo user:', isDemoUser);
    
    setJoiningDemo(true);
    const loadingToast = toast.loading('Preparing demo workspace...');
    
    try {
      // Step 1: Join demo workspace (idempotent - creates membership if needed)
      console.log('[WorkspaceSelector] Step 1: Calling join-demo...');
      const { data, error } = await supabase.functions.invoke('workspace-management/join-demo');
      
      console.log('[WorkspaceSelector] Join demo response:', { data, error });
      
      if (error) {
        console.error('[WorkspaceSelector] Edge function error:', error);
        throw new Error(error.message || 'Failed to connect to demo workspace service');
      }
      
      if (!data?.success) {
        console.error('[WorkspaceSelector] Join demo failed:', data);
        throw new Error(data?.error || 'Failed to join demo workspace');
      }
      
      console.log('[WorkspaceSelector] Successfully joined demo workspace:', data.workspaceId);
      
      // Step 2: Store active workspace in localStorage for persistence
      if (data.workspaceId) {
        localStorage.setItem('lovable_current_workspace', data.workspaceId);
        console.log('[WorkspaceSelector] Stored workspace ID in localStorage');
      }
      
      // Step 3: Navigate to demo workspace
      toast.dismiss(loadingToast);
      toast.success('Welcome to the Demo Workspace!');
      console.log('[WorkspaceSelector] Navigating to /demo-workspace');
      navigate('/demo-workspace');
      
    } catch (error: any) {
      console.error('[WorkspaceSelector] Demo join failed:', error);
      toast.dismiss(loadingToast);
      
      // Show detailed error for debugging
      const errorMessage = error?.message || 'Unknown error occurred';
      console.error('[WorkspaceSelector] Error details:', {
        message: errorMessage,
        userId: user.id,
        stack: error?.stack
      });
      
      toast.error(`Demo workspace could not be accessed: ${errorMessage}`);
    } finally {
      setJoiningDemo(false);
    }
  };

  const handleEnterWorkspace = async () => {
    if (!user) {
      toast.error('Please log in to continue');
      return;
    }

    if (realWorkspace) {
      // User has a real workspace, navigate to it
      console.log('[WorkspaceSelector] Entering real workspace:', realWorkspace.id);
      localStorage.setItem('lovable_current_workspace', realWorkspace.id);
      navigate('/canvas');
      return;
    }

    // User doesn't have a workspace, create one
    console.log('[WorkspaceSelector] Creating new workspace for user:', user.id);
    setCreatingWorkspace(true);
    const loadingToast = toast.loading('Creating your workspace...');
    
    try {
      const { data, error } = await supabase.functions.invoke('workspace-management/create-workspace', {
        body: { name: 'My Workspace' }
      });
      
      console.log('[WorkspaceSelector] Create workspace response:', { data, error });
      
      if (error) {
        console.error('[WorkspaceSelector] Edge function error:', error);
        throw new Error(error.message || 'Failed to create workspace');
      }
      
      if (!data?.success) {
        console.error('[WorkspaceSelector] Create workspace failed:', data);
        throw new Error(data?.error || 'Failed to create workspace');
      }
      
      console.log('[WorkspaceSelector] Successfully created workspace:', data.workspaceId);
      
      // Store active workspace
      if (data.workspaceId) {
        localStorage.setItem('lovable_current_workspace', data.workspaceId);
      }
      
      toast.dismiss(loadingToast);
      toast.success('Workspace created successfully!');
      navigate('/canvas');
      
    } catch (error: any) {
      console.error('[WorkspaceSelector] Workspace creation failed:', error);
      toast.dismiss(loadingToast);
      toast.error(`Failed to create workspace: ${error?.message || 'Unknown error'}`);
    } finally {
      setCreatingWorkspace(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading workspaces...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                CLIENT MAPPER
              </span>
            </Link>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              Signed in as {user?.email}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-3xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Choose Your Workspace</h1>
            <p className="text-muted-foreground">
              Select where you'd like to work today
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Demo Workspace Card */}
            <Card className="relative overflow-hidden border-2 hover:border-amber-500/50 transition-colors cursor-pointer group">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <FlaskConical className="w-6 h-6 text-amber-600" />
                  </div>
                  <Badge variant="outline" className="bg-amber-100/50 text-amber-700 border-amber-300">
                    Sandbox
                  </Badge>
                </div>
                <CardTitle className="text-xl mt-4">Demo Workspace</CardTitle>
                <CardDescription>
                  Explore all features with sample data. Perfect for learning and testing.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Full feature access (Canvas, AI, Import)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Pre-loaded sample companies & contacts
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Isolated from real data
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Reset anytime to start fresh
                  </li>
                </ul>
                <Button 
                  onClick={handleEnterDemo}
                  className="w-full gap-2 bg-amber-500 hover:bg-amber-600"
                  disabled={joiningDemo}
                >
                  {joiningDemo ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isDemoUser ? 'Entering...' : 'Setting up...'}
                    </>
                  ) : (
                    <>
                      Enter Demo Workspace
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Real Workspace Card */}
            <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-colors cursor-pointer">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-primary" />
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Briefcase className="w-6 h-6 text-primary" />
                  </div>
                  {hasRealWorkspace ? (
                    <Badge variant="outline" className="bg-green-100/50 text-green-700 border-green-300">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-blue-100/50 text-blue-700 border-blue-300">
                      <Plus className="w-3 h-3 mr-1" />
                      New
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-xl mt-4">My Workspace</CardTitle>
                <CardDescription>
                  {hasRealWorkspace 
                    ? `Access your workspace: ${realWorkspace.name}`
                    : 'Start fresh with a blank CRM. Add your own companies and contacts.'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {hasRealWorkspace ? 'Real customer relationship data' : 'Start from scratch'}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Team collaboration features
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Full RBAC & permissions
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Audit logging enabled
                  </li>
                </ul>
                <Button 
                  onClick={handleEnterWorkspace}
                  className="w-full gap-2"
                  disabled={creatingWorkspace}
                >
                  {creatingWorkspace ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating workspace...
                    </>
                  ) : hasRealWorkspace ? (
                    <>
                      Enter My Workspace
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create My Workspace
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            Demo workspace data is completely isolated from production data.
            <br />
            You can use both workspaces simultaneously.
          </p>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSelector;
