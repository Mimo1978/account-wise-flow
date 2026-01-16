import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FlaskConical, Briefcase, ArrowRight, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

/**
 * Workspace Selector Page
 * 
 * After login, users can choose between:
 * - Demo Workspace: Sandboxed environment with full features, isolated data
 * - My Workspace: Real production workspace (if they have one)
 */
const WorkspaceSelector = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(true);
  const [hasRealWorkspace, setHasRealWorkspace] = useState(false);
  const [isDemoUser, setIsDemoUser] = useState(false);
  const [joiningDemo, setJoiningDemo] = useState(false);

  useEffect(() => {
    const checkWorkspaces = async () => {
      if (!user) return;
      
      try {
        // Check if user has a real workspace
        const { data: hasReal, error: realError } = await supabase.rpc('has_real_workspace', { 
          _user_id: user.id 
        });
        if (realError) throw realError;
        setHasRealWorkspace(!!hasReal);
        
        // Check if user is already a demo user
        const { data: isDemo, error: demoError } = await supabase.rpc('is_demo_user', { 
          _user_id: user.id 
        });
        if (demoError) throw demoError;
        setIsDemoUser(!!isDemo);
        
      } catch (error) {
        console.error('Error checking workspaces:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (!authLoading) {
      checkWorkspaces();
    }
  }, [user, authLoading]);

  const handleJoinDemo = async () => {
    if (!user) return;
    
    setJoiningDemo(true);
    try {
      const { data, error } = await supabase.rpc('join_demo_team', { 
        _user_id: user.id 
      });
      
      if (error) throw error;
      
      toast.success('Welcome to the Demo Workspace!');
      navigate('/demo-workspace');
    } catch (error) {
      console.error('Failed to join demo:', error);
      toast.error('Failed to join demo workspace. Please try again.');
    } finally {
      setJoiningDemo(false);
    }
  };

  const handleEnterDemo = () => {
    navigate('/demo-workspace');
  };

  const handleEnterWorkspace = () => {
    navigate('/canvas');
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
                  onClick={isDemoUser ? handleEnterDemo : handleJoinDemo}
                  className="w-full gap-2 bg-amber-500 hover:bg-amber-600"
                  disabled={joiningDemo}
                >
                  {joiningDemo ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Setting up...
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
            <Card className={`relative overflow-hidden border-2 transition-colors ${
              hasRealWorkspace 
                ? 'hover:border-primary/50 cursor-pointer' 
                : 'opacity-60'
            }`}>
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
                    <Badge variant="outline" className="bg-muted text-muted-foreground">
                      Not Set Up
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-xl mt-4">My Workspace</CardTitle>
                <CardDescription>
                  {hasRealWorkspace 
                    ? 'Access your real company data and contacts.'
                    : 'Your production workspace for real customer data.'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Real customer relationship data
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
                  variant={hasRealWorkspace ? "default" : "outline"}
                  className="w-full gap-2"
                  disabled={!hasRealWorkspace}
                >
                  {hasRealWorkspace ? (
                    <>
                      Enter My Workspace
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    'Contact Admin to Set Up'
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