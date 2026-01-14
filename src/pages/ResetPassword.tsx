import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, ArrowLeft, Loader2, CheckCircle, AlertCircle, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const passwordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ResetState = 'loading' | 'ready' | 'success' | 'error' | 'expired';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [resetState, setResetState] = useState<ResetState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    // Supabase sends users here after clicking the reset link
    // The session should already be established via the access_token in URL hash
    const checkSession = async () => {
      // Check for error in URL params (e.g., expired link)
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');
      
      if (error) {
        setResetState('expired');
        setErrorMessage(errorDescription || 'The reset link is invalid or has expired.');
        return;
      }

      // Check if we have an active session (Supabase auto-exchanges the token)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        // Try to get session from URL hash (PKCE flow)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        
        if (accessToken && type === 'recovery') {
          // Set the session manually
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
          
          if (setSessionError) {
            setResetState('expired');
            setErrorMessage('The reset link is invalid or has expired.');
            return;
          }
          setResetState('ready');
        } else {
          setResetState('expired');
          setErrorMessage('No valid reset token found. Please request a new reset link.');
        }
      } else {
        setResetState('ready');
      }
    };

    checkSession();
  }, [searchParams]);

  const validateForm = () => {
    try {
      passwordSchema.parse({ password, confirmPassword });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { password?: string; confirmPassword?: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0] === 'password') fieldErrors.password = err.message;
          if (err.path[0] === 'confirmPassword') fieldErrors.confirmPassword = err.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        if (error.message.includes('same as')) {
          toast({
            variant: 'destructive',
            title: 'Password Update Failed',
            description: 'New password must be different from your current password.',
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Password Update Failed',
            description: error.message,
          });
        }
        return;
      }

      setResetState('success');
      toast({
        title: 'Password Updated',
        description: 'Your password has been successfully updated.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update password. Please try again.';
      toast({
        variant: 'destructive',
        title: 'Password Update Failed',
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    navigate('/canvas', { replace: true });
  };

  const handleRequestNewLink = () => {
    navigate('/auth', { replace: true });
  };

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
            <Link to="/">
              <Button variant="ghost" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Reset Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <KeyRound className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Reset Password</CardTitle>
            <CardDescription>
              {resetState === 'ready' && 'Enter your new password below'}
              {resetState === 'loading' && 'Verifying your reset link...'}
              {resetState === 'success' && 'Your password has been updated'}
              {(resetState === 'error' || resetState === 'expired') && 'Unable to reset password'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {resetState === 'loading' && (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Verifying reset link...</p>
              </div>
            )}

            {resetState === 'ready' && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating password...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </Button>
              </form>
            )}

            {resetState === 'success' && (
              <div className="flex flex-col items-center py-6 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="font-semibold text-lg mb-2">Password Updated!</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  Your password has been successfully changed. You can now use your new password to sign in.
                </p>
                <Button onClick={handleContinue} className="w-full">
                  Continue to App
                </Button>
              </div>
            )}

            {(resetState === 'error' || resetState === 'expired') && (
              <div className="flex flex-col items-center py-6 text-center">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <h3 className="font-semibold text-lg mb-2">Link Expired or Invalid</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  {errorMessage || 'The password reset link has expired or is invalid. Please request a new one.'}
                </p>
                <Button onClick={handleRequestNewLink} className="w-full">
                  Request a New Reset Link
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
