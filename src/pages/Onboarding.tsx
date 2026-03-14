import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Step indicator                                                     */
/* ------------------------------------------------------------------ */
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const isComplete = step < current;
        const isCurrent = step === current;
        return (
          <div
            key={step}
            className={cn(
              'w-2.5 h-2.5 rounded-full transition-all duration-300',
              isComplete && 'bg-primary',
              isCurrent && 'bg-primary scale-125',
              !isComplete && !isCurrent && 'bg-border'
            )}
          >
            {isComplete && (
              <div className="w-full h-full rounded-full flex items-center justify-center">
                <Check className="w-2 h-2 text-primary-foreground" />
              </div>
            )}
          </div>
        );
      })}
      <span className="text-xs text-muted-foreground ml-2">Step {current} of {total}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Selection button group                                             */
/* ------------------------------------------------------------------ */
function ButtonGroup({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 border',
            value === opt.value
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-[#2D3748] bg-transparent text-muted-foreground hover:border-muted-foreground/40'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated prompt lines for Step 2                                   */
/* ------------------------------------------------------------------ */
function AnimatedPrompts() {
  const prompts = [
    '"Create a new deal for HSBC worth £50,000"',
    '"Show me all overdue invoices"',
    '"Take me to the outreach page"',
  ];
  const [visible, setVisible] = useState<number[]>([]);

  useEffect(() => {
    const timers = prompts.map((_, i) =>
      setTimeout(() => setVisible((prev) => [...prev, i]), 800 * (i + 1))
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="space-y-3 py-4">
      {prompts.map((p, i) => (
        <p
          key={i}
          className={cn(
            'text-sm text-primary/90 font-mono transition-all duration-500',
            visible.includes(i)
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-2'
          )}
        >
          {p}
        </p>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 2 — Meet Jarvis (auto-speaks introduction)                    */
/* ------------------------------------------------------------------ */
function Step2MeetJarvis({ preferredName, onNext }: { preferredName: string; onNext: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      // Open Jarvis panel
      window.dispatchEvent(new CustomEvent('jarvis-open'));
      // Speak the introduction
      const msg = `Hi ${preferredName}. I'm Jarvis. It's great to meet you. I'm here to help you manage your business, grow your pipeline, and make sure nothing falls through the cracks. Whenever you need me, just tap my button. Let's get started.`;
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(msg);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        // Dispatch speaking state for button animation
        window.dispatchEvent(new CustomEvent('jarvis-speaking', { detail: { speaking: true } }));
        utterance.onend = () => {
          window.dispatchEvent(new CustomEvent('jarvis-speaking', { detail: { speaking: false } }));
        };
        utterance.onerror = () => {
          window.dispatchEvent(new CustomEvent('jarvis-speaking', { detail: { speaking: false } }));
        };
        window.speechSynthesis.speak(utterance);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [preferredName]);

  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-primary flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">Meet Jarvis</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Jarvis is your AI business partner. He lives in the bottom-right corner
          of every page. Ask him to create deals, find contacts, navigate the app,
          or pull a report — all by voice or text.
        </p>
      </div>

      <AnimatedPrompts />

      <Button onClick={onNext} className="w-full h-11 text-base">
        Got it →
      </Button>

      <p className="text-xs text-muted-foreground/70">
        You can always find Jarvis in the bottom-right corner
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Onboarding                                                    */
/* ------------------------------------------------------------------ */
const TEAM_SIZES = [
  { label: 'Just me', value: 'solo' },
  { label: '2–5', value: '2-5' },
  { label: '6–15', value: '6-15' },
  { label: '16+', value: '16+' },
];

const PRIMARY_USES = [
  { label: 'Recruitment', value: 'recruitment' },
  { label: 'Consulting', value: 'consulting' },
  { label: 'Both', value: 'both' },
  { label: 'Something else', value: 'other' },
];

const Onboarding = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [transitioning, setTransitioning] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  // Step 1 fields
  const [firstName, setFirstName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [primaryUse, setPrimaryUse] = useState('');

  // Load profile data
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('first_name, onboarding_phase, preferred_name, job_title, team_size, primary_use')
        .eq('id', user.id)
        .single();

      if (data) {
        const phase = (data as any).onboarding_phase ?? 1;
        if (phase >= 2) {
          navigate('/home', { replace: true });
          return;
        }
        const fn = data.first_name || '';
        setFirstName(fn);
        setPreferredName((data as any).preferred_name || fn);
        setJobTitle((data as any).job_title || '');
        setTeamSize((data as any).team_size || '');
        setPrimaryUse((data as any).primary_use || '');
      }
      setProfileLoading(false);
    };

    load();
  }, [user, navigate]);

  // Redirect unauthenticated
  useEffect(() => {
    if (!loading && !user) navigate('/auth', { replace: true });
  }, [user, loading, navigate]);

  const goNext = async () => {
    setTransitioning(true);
    // Save step 1 data
    if (step === 1 && user) {
      await supabase
        .from('profiles')
        .update({
          preferred_name: preferredName.trim() || firstName,
          job_title: jobTitle.trim() || null,
          team_size: teamSize || null,
          primary_use: primaryUse || null,
        } as any)
        .eq('id', user.id);
    }
    setTimeout(() => {
      setStep((s) => s + 1);
      setTransitioning(false);
    }, 200);
  };

  const handleFinish = async () => {
    if (!user) return;
    // Persist onboarding_phase = 2 and verify
    await supabase
      .from('profiles')
      .update({ onboarding_phase: 2 } as any)
      .eq('id', user.id);
    // Re-query to confirm persistence
    const { data: verify } = await supabase
      .from('profiles')
      .select('onboarding_phase')
      .eq('id', user.id)
      .single();
    if (verify && (verify as any).onboarding_phase < 2) {
      // Retry once
      await supabase
        .from('profiles')
        .update({ onboarding_phase: 2 } as any)
        .eq('id', user.id);
    }
    sessionStorage.setItem('jarvis_new_user', 'true');
    navigate('/home', { replace: true });
  };

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F1117' }}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const step1Valid = preferredName.trim().length > 0;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6" style={{ backgroundColor: '#0F1117' }}>
      {/* Pattern overlay */}
      <div className="fixed inset-0 opacity-[0.015] pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)',
        backgroundSize: '32px 32px',
      }} />

      <div className="relative w-full max-w-[520px]">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent tracking-tight">
            CLIENT MAPPER
          </span>
        </div>

        <div
          className="rounded-xl p-6 sm:p-8"
          style={{ backgroundColor: '#1A1F2E', border: '1px solid #2D3748' }}
        >
          <StepDots current={step} total={3} />

          {/* Step content with transition */}
          <div
            className={cn(
              'transition-all duration-200',
              transitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
            )}
          >
            {/* ========== STEP 1 ========== */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center space-y-1.5">
                  <h1 className="text-xl font-semibold text-foreground">
                    Welcome to Client Mapper, {firstName || 'there'}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Let's personalise your experience. This takes 60 seconds.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="preferred-name">What should Jarvis call you?</Label>
                    <Input
                      id="preferred-name"
                      value={preferredName}
                      onChange={(e) => setPreferredName(e.target.value)}
                      placeholder={firstName || 'Your preferred name'}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="job-title">What is your role?</Label>
                    <Input
                      id="job-title"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="e.g. Managing Director, Senior Recruiter"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>How big is your team?</Label>
                    <ButtonGroup options={TEAM_SIZES} value={teamSize} onChange={setTeamSize} />
                  </div>

                  <div className="space-y-2">
                    <Label>What will you use Client Mapper for most?</Label>
                    <ButtonGroup options={PRIMARY_USES} value={primaryUse} onChange={setPrimaryUse} />
                  </div>
                </div>

                <Button
                  onClick={goNext}
                  className="w-full h-11 text-base"
                  disabled={!step1Valid}
                >
                  Next →
                </Button>
              </div>
            )}

            {/* ========== STEP 2 ========== */}
            {step === 2 && (
              <Step2MeetJarvis
                preferredName={preferredName || firstName}
                onNext={() => {
                  // Stop any ongoing speech and close Jarvis
                  window.speechSynthesis?.cancel();
                  window.dispatchEvent(new CustomEvent('jarvis-close'));
                  goNext();
                }}
              />
            )}

            {/* ========== STEP 3 ========== */}
            {step === 3 && (
              <div className="space-y-6 text-center">
                <div className="space-y-2">
                  <h1 className="text-xl font-semibold text-foreground">
                    You're all set, {preferredName || firstName || 'there'} 🎉
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Your Command Centre is ready. Jarvis will guide you from here.
                  </p>
                </div>

                <Button onClick={handleFinish} className="w-full h-11 text-base">
                  Open my Command Centre →
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
