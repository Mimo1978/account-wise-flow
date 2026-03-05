import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

const WELCOME_SHOWN_KEY = 'cm_welcome_shown';

export function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const alreadyShown = localStorage.getItem(`${WELCOME_SHOWN_KEY}_${user.id}`);
    if (alreadyShown) return;

    // Check if this is a new user (profile exists and created recently)
    const checkNewUser = async () => {
      const { data } = await supabase
        .from('profiles' as any)
        .select('first_name, created_at')
        .eq('id', user.id)
        .single();

      if (!data) return;
      const profile = data as any;
      const createdAt = new Date(profile.created_at);
      const now = new Date();
      const diffMs = now.getTime() - createdAt.getTime();
      // Show welcome only if profile created within last 5 minutes
      if (diffMs < 5 * 60 * 1000) {
        setFirstName(profile.first_name || '');
        setOpen(true);
      } else {
        // Not a new user, mark as shown
        localStorage.setItem(`${WELCOME_SHOWN_KEY}_${user.id}`, 'true');
      }
    };

    checkNewUser();
  }, [user]);

  const handleContinue = () => {
    if (user) localStorage.setItem(`${WELCOME_SHOWN_KEY}_${user.id}`, 'true');
    setOpen(false);
    navigate('/workspace-selector');
  };

  const handleClose = () => {
    if (user) localStorage.setItem(`${WELCOME_SHOWN_KEY}_${user.id}`, 'true');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center items-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-2xl">
            Welcome to Client Mapper{firstName ? `, ${firstName}` : ''}!
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            Let's set up your workspace so you can start mapping your client relationships.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center pt-4">
          <Button onClick={handleContinue} className="h-11 px-8 text-base">
            Set up your workspace
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
