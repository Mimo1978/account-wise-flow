import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Building2, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CreateWorkspacePromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Create Workspace Prompt
 * 
 * Shown when a user wants to transition from Demo mode to Real mode.
 * Creates a new, isolated workspace for the user's own data.
 * 
 * Key behaviors:
 * - Demo data is NEVER copied to the new workspace
 * - User starts with a clean slate
 * - Workspace is fully isolated via RLS
 */
export const CreateWorkspacePrompt: React.FC<CreateWorkspacePromptProps> = ({
  open,
  onOpenChange,
}) => {
  const { user } = useAuth();
  const { refreshWorkspaces } = useWorkspace();
  const navigate = useNavigate();
  const [workspaceName, setWorkspaceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Derive default workspace name from email
  const defaultName = user?.email
    ? user.email.split('@')[1]?.split('.')[0]
      ? `${user.email.split('@')[1].split('.')[0].charAt(0).toUpperCase()}${user.email.split('@')[1].split('.')[0].slice(1)} Workspace`
      : 'My Workspace'
    : 'My Workspace';

  const handleCreate = async () => {
    if (!user) {
      toast.error('You must be signed in to create a workspace');
      return;
    }

    setIsCreating(true);
    try {
      const name = workspaceName.trim() || defaultName;
      
      const { data, error } = await supabase.functions.invoke('workspace-management', {
        body: { 
          action: 'create-workspace',
          name 
        }
      });

      if (error) throw error;

      if (data?.success) {
        // Store the new workspace ID
        localStorage.setItem('lovable_current_workspace', data.workspaceId);
        
        // Refresh workspaces to pick up the new one
        await refreshWorkspaces();
        
        toast.success(`Welcome to ${name}! Your workspace is ready.`);
        onOpenChange(false);
        
        // Navigate to the real workspace
        navigate('/companies');
      } else {
        throw new Error(data?.error || 'Failed to create workspace');
      }
    } catch (error: any) {
      console.error('Error creating workspace:', error);
      toast.error(error.message || 'Failed to create workspace');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <DialogTitle className="text-xl">Create Your Workspace</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            Ready to save your own data? Create a workspace to get started with your own companies, contacts, and insights.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Workspace Name</Label>
            <Input
              id="workspace-name"
              placeholder={defaultName}
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">
              You can always change this later in settings.
            </p>
          </div>

          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <div className="flex items-start gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Your data, your control</p>
                <p className="text-xs text-muted-foreground">
                  Your workspace is completely separate from demo data. Nothing from the demo will be copied over.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            Continue with Demo
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating}
            className="gap-2"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Create Workspace
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
