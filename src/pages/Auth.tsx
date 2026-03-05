import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Sparkles, Loader2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { ForgotPasswordModal } from '@/components/auth/ForgotPasswordModal';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Password strength                                                  */
/* ------------------------------------------------------------------ */
function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;

  if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-destructive' };
  if (score === 2) return { score: 2, label: 'Fair', color: 'bg-warning' };
  if (score === 3) return { score: 3, label: 'Strong', color: 'bg-primary' };
  return { score: 4, label: 'Very strong', color: 'bg-success' };
}

function PasswordStrengthBar({ password }: { password: string }) {
  const strength = useMemo(() => getPasswordStrength(password), [password]);
  if (!password) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              i <= strength.score ? strength.color : 'bg-border'
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Password strength: {strength.label}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Must contain at least one number');

const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const signUpSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(50),
  lastName: z.string().trim().min(1, 'Last name is required').max(50),
  email: z.string().email('Please enter a valid email address'),
  password: passwordSchema,
  confirmPassword: z.string(),
  terms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
  gdpr: z.literal(true, { errorMap: () => ({ message: 'GDPR consent is required' }) }),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

/* ------------------------------------------------------------------ */
/*  Logo                                                               */
/* ------------------------------------------------------------------ */
function Logo({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  const iconSize = size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';
  const boxSize = size === 'lg' ? 'w-12 h-12' : 'w-10 h-10';
  const textSize = size === 'lg' ? 'text-3xl' : 'text-2xl';
  return (
    <div className="flex items-center gap-3 justify-center">
      <div className={cn(boxSize, 'rounded-xl bg-gradient-primary flex items-center justify-center')}>
        <Sparkles className={cn(iconSize, 'text-white')} />
      </div>
      <span className={cn(textSize, 'font-bold bg-gradient-primary bg-clip-text text-transparent tracking-tight')}>
        CLIENT MAPPER
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Auth page                                                     */
/* ------------------------------------------------------------------ */
const Auth = () => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [isLoading, setIsLoading] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Sign-in fields
  const [siEmail, setSiEmail] = useState('');
  const [siPassword, setSiPassword] = useState('');
  const [siRememberMe, setSiRememberMe] = useState(false);
  const [siErrors, setSiErrors] = useState<Record<string, string>>({});

  // Sign-up fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPassword, setSuPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [gdpr, setGdpr] = useState(false);
  const [suErrors, setSuErrors] = useState<Record<string, string>>({});

  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const shownAuthErrorRef = useRef(false);

  const searchParams = new URLSearchParams(location.search);
  const initialTab = searchParams.get('tab');
  useEffect(() => {
    if (initialTab === 'signup') setMode('signup');
  }, [initialTab]);

  const from = location.state?.from?.pathname || '/home';

  useEffect(() => {
    const errorMessage = (location.state as any)?.error as string | undefined;
    if (errorMessage && !shownAuthErrorRef.current) {
      shownAuthErrorRef.current = true;
      toast({ variant: 'destructive', title: 'Authentication Error', description: errorMessage });
    }
  }, [location.state, toast]);

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, navigate, from]);

  /* ---------- Sign In ---------- */
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = signInSchema.safeParse({ email: siEmail, password: siPassword });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((err) => { errs[String(err.path[0])] = err.message; });
      setSiErrors(errs);
      return;
    }
    setSiErrors({});
    setIsLoading(true);
    try {
      const { error } = await signIn(siEmail, siPassword);
      if (error) {
        let message = 'Failed to sign in. Please try again.';
        if (error.message.includes('Invalid login credentials')) message = 'Invalid email or password.';
        else if (error.message.includes('Email not confirmed')) message = 'Please confirm your email before signing in.';
        toast({ variant: 'destructive', title: 'Sign In Failed', description: message });
        return;
      }
      toast({ title: 'Signed In', description: 'Welcome back.' });
      navigate(from, { replace: true });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Sign In Failed', description: err instanceof Error ? err.message : 'Unable to sign in.' });
    } finally {
      setIsLoading(false);
    }
  };

  /* ---------- Sign Up ---------- */
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = signUpSchema.safeParse({
      firstName, lastName, email: suEmail, password: suPassword, confirmPassword, terms, gdpr,
    });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((err) => { errs[String(err.path[0])] = err.message; });
      setSuErrors(errs);
      return;
    }
    setSuErrors({});
    setIsLoading(true);
    try {
      const { error } = await signUp(suEmail, suPassword, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      if (error) {
        let message = 'Failed to create account.';
        if (error.message.includes('User already registered')) message = 'An account with this email already exists.';
        else if (error.message.includes('Password')) message = error.message;
        toast({ variant: 'destructive', title: 'Sign Up Failed', description: message });
        return;
      }
      toast({ title: 'Account Created', description: 'Please check your email to verify your account.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Sign Up Failed', description: err instanceof Error ? err.message : 'Unable to create account.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Subtle pattern overlay */}
      <div className="fixed inset-0 opacity-[0.015] pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)',
        backgroundSize: '32px 32px',
      }} />

      <div className="relative w-full max-w-[440px] space-y-8">
        {/* Logo */}
        <div className="text-center">
          <Logo size="lg" />
        </div>

        <Card className="border-border/60 shadow-lg">
          <CardContent className="pt-8 pb-8 px-6 sm:px-8">
            {mode === 'signin' ? (
              /* ========== SIGN IN ========== */
              <form onSubmit={handleSignIn} className="space-y-5">
                <div className="text-center mb-6">
                  <h1 className="text-xl font-semibold text-foreground">Welcome back</h1>
                  <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="si-email">Email</Label>
                  <Input id="si-email" type="email" placeholder="you@company.com" value={siEmail} onChange={(e) => setSiEmail(e.target.value)} disabled={isLoading} />
                  {siErrors.email && <p className="text-xs text-destructive">{siErrors.email}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="si-password">Password</Label>
                  <div className="relative">
                    <Input id="si-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={siPassword} onChange={(e) => setSiPassword(e.target.value)} disabled={isLoading} className="pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {siErrors.password && <p className="text-xs text-destructive">{siErrors.password}</p>}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox id="remember" checked={siRememberMe} onCheckedChange={(v) => setSiRememberMe(!!v)} />
                    <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">Remember me</Label>
                  </div>
                  <button type="button" onClick={() => setForgotPasswordOpen(true)} className="text-sm text-primary hover:underline underline-offset-4">
                    Forgot password?
                  </button>
                </div>

                <Button type="submit" className="w-full h-11 text-base" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</> : 'Sign In'}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Don't have an account?{' '}
                  <button type="button" onClick={() => setMode('signup')} className="text-primary font-medium hover:underline underline-offset-4">Sign up</button>
                </p>

                <p className="text-center text-xs text-muted-foreground/70 pt-2">
                  Trusted by relationship-driven teams
                </p>
              </form>
            ) : (
              /* ========== SIGN UP ========== */
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="text-center mb-5">
                  <h1 className="text-xl font-semibold text-foreground">Create your account</h1>
                  <p className="text-sm text-muted-foreground mt-1">Start mapping your client relationships</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="su-first">First name *</Label>
                    <Input id="su-first" placeholder="John" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={isLoading} />
                    {suErrors.firstName && <p className="text-xs text-destructive">{suErrors.firstName}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-last">Last name *</Label>
                    <Input id="su-last" placeholder="Smith" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={isLoading} />
                    {suErrors.lastName && <p className="text-xs text-destructive">{suErrors.lastName}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="su-email">Email *</Label>
                  <Input id="su-email" type="email" placeholder="you@company.com" value={suEmail} onChange={(e) => setSuEmail(e.target.value)} disabled={isLoading} />
                  {suErrors.email && <p className="text-xs text-destructive">{suErrors.email}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="su-password">Password *</Label>
                  <div className="relative">
                    <Input id="su-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={suPassword} onChange={(e) => setSuPassword(e.target.value)} disabled={isLoading} className="pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <PasswordStrengthBar password={suPassword} />
                  <p className="text-xs text-muted-foreground">Minimum 8 characters with uppercase, lowercase, and a number</p>
                  {suErrors.password && <p className="text-xs text-destructive">{suErrors.password}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="su-confirm">Confirm password *</Label>
                  <div className="relative">
                    <Input id="su-confirm" type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isLoading} className="pr-10" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {suErrors.confirmPassword && <p className="text-xs text-destructive">{suErrors.confirmPassword}</p>}
                </div>

                <div className="space-y-3 pt-1">
                  <div className="flex items-start gap-2">
                    <Checkbox id="terms" checked={terms} onCheckedChange={(v) => setTerms(!!v)} className="mt-0.5" />
                    <Label htmlFor="terms" className="text-sm font-normal leading-snug cursor-pointer">
                      I agree to the <span className="text-primary underline underline-offset-2">Terms of Service</span> and <span className="text-primary underline underline-offset-2">Privacy Policy</span>
                    </Label>
                  </div>
                  {suErrors.terms && <p className="text-xs text-destructive ml-6">{suErrors.terms}</p>}

                  <div className="flex items-start gap-2">
                    <Checkbox id="gdpr" checked={gdpr} onCheckedChange={(v) => setGdpr(!!v)} className="mt-0.5" />
                    <Label htmlFor="gdpr" className="text-sm font-normal leading-snug cursor-pointer">
                      I consent to my data being processed in accordance with GDPR
                    </Label>
                  </div>
                  {suErrors.gdpr && <p className="text-xs text-destructive ml-6">{suErrors.gdpr}</p>}
                </div>

                <Button type="submit" className="w-full h-11 text-base" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account…</> : 'Create Account'}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <button type="button" onClick={() => setMode('signin')} className="text-primary font-medium hover:underline underline-offset-4">Sign in</button>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <ForgotPasswordModal open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen} />
    </div>
  );
};

export default Auth;
