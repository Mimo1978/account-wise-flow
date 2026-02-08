import { FlaskConical, ArrowRight, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useWorkspaceUtils } from '@/hooks/use-workspace';
import { CreateWorkspacePrompt } from '@/components/workspace/CreateWorkspacePrompt';

interface DemoBannerProps {
  variant?: 'authenticated' | 'public';
  onReset?: () => void;
  isResetting?: boolean;
}

/**
 * Demo Mode Banner
 * 
 * Displays a subtle, non-intrusive banner indicating the user is in demo mode.
 * - Authenticated demo: Shows reset option and prompt to create real workspace
 * - Public demo: Shows sign-in prompt
 */
export const DemoBanner: React.FC<DemoBannerProps> = ({ 
  variant = 'authenticated',
  onReset,
  isResetting = false 
}) => {
  const [showCreatePrompt, setShowCreatePrompt] = useState(false);
  const { hasRealWorkspace } = useWorkspaceUtils();
  const [hasReal, setHasReal] = useState<boolean | null>(null);

  // Check if user has a real workspace on mount
  useEffect(() => {
    if (variant === 'authenticated') {
      hasRealWorkspace().then(setHasReal);
    }
  }, [variant, hasRealWorkspace]);

  if (variant === 'public') {
    return (
      <div className="bg-accent/50 border-b border-accent">
        <div className="container mx-auto px-6 py-2 flex items-center justify-center gap-3 text-sm">
          <FlaskConical className="w-4 h-4 text-accent-foreground flex-shrink-0" />
          <span className="text-accent-foreground">
            Public Demo — Read-only preview with sample data
          </span>
          <Link to="/auth">
            <Button variant="ghost" size="sm" className="gap-1 h-7">
              Sign up to save your data
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-accent/50 border-b border-accent">
        <div className="container mx-auto px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FlaskConical className="w-4 h-4 text-accent-foreground flex-shrink-0" />
            <span className="text-sm text-accent-foreground">
              Demo Workspace — Changes are isolated and won't affect your real data
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {onReset && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onReset}
                disabled={isResetting}
                className="gap-1 h-7"
              >
                {isResetting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                Reset Demo
              </Button>
            )}
            
            {hasReal === false && (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => setShowCreatePrompt(true)}
                className="gap-1 h-7"
              >
                Create Your Workspace
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
            
            {hasReal === true && (
              <Link to="/companies">
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="gap-1 h-7"
                >
                  Go to My Workspace
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      <CreateWorkspacePrompt 
        open={showCreatePrompt} 
        onOpenChange={setShowCreatePrompt}
      />
    </>
  );
};
