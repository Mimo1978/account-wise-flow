import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Onboarding = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleContinue = async () => {
    if (!user) return;
    // Mark onboarding as complete
    await supabase
      .from('profiles')
      .update({ onboarding_phase: 2 } as any)
      .eq('id', user.id);
    navigate('/home', { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F1117' }}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: '#0F1117' }}>
      <div className="w-full max-w-md text-center space-y-8">
        <div className="flex items-center gap-3 justify-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <span className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent tracking-tight">
            CLIENT MAPPER
          </span>
        </div>

        <div className="space-y-3" style={{ backgroundColor: '#1A1F2E', border: '1px solid #2D3748', borderRadius: '12px', padding: '2rem' }}>
          <h1 className="text-2xl font-semibold text-foreground">Welcome aboard! 🎉</h1>
          <p className="text-muted-foreground">
            Your account is ready. Let's get you set up with your workspace.
          </p>
          <Button onClick={handleContinue} className="w-full h-11 text-base mt-4">
            Get Started →
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
