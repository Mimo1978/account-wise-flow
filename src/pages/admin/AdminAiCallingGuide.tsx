import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, Key, Shield, ArrowRight, CheckCircle2, AlertTriangle, ExternalLink, Phone } from 'lucide-react';
import { useIsServiceConfigured } from '@/hooks/use-integration-settings';
import { useNavigate } from 'react-router-dom';

export default function AdminAiCallingGuide() {
  const twilioStatus = useIsServiceConfigured('twilio');
  const elevenLabsStatus = useIsServiceConfigured('elevenlabs');
  const navigate = useNavigate();

  const isFullyConfigured = twilioStatus.isConfigured && elevenLabsStatus.isConfigured;
  const isPartial = twilioStatus.isConfigured && !elevenLabsStatus.isConfigured;
  const isLoading = twilioStatus.isLoading || elevenLabsStatus.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Mic className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            AI Agent Calling
            <Badge variant="outline" className="ml-2 text-xs align-middle">Guide</Badge>
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Automated outbound voice calls powered by Twilio + ElevenLabs
          </p>
        </div>
      </div>

      {/* Status */}
      <Card className={isFullyConfigured ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20'}>
        <CardContent className="flex items-center gap-4 py-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Checking configuration…</p>
          ) : isFullyConfigured ? (
            <>
              <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">AI Calling is Fully Active</p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-400/70">
                  Twilio and ElevenLabs are configured. AI-powered voice calls with natural speech are ready to use.
                </p>
              </div>
            </>
          ) : isPartial ? (
            <>
              <CheckCircle2 className="h-6 w-6 text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">Partially Configured</p>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/70">
                  Twilio is set up (basic calling works). Add ElevenLabs for natural AI voice — it's optional but recommended.
                </p>
              </div>
              <Button size="sm" onClick={() => navigate('/settings/integrations')}>
                <Key className="h-3.5 w-3.5 mr-1.5" />
                Add ElevenLabs
              </Button>
            </>
          ) : (
            <>
              <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">AI Calling is Not Configured</p>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/70">
                  Twilio is required for calling. ElevenLabs is optional for natural AI voice. Follow the steps below.
                </p>
              </div>
              <Button size="sm" onClick={() => navigate('/settings/integrations')}>
                <Key className="h-3.5 w-3.5 mr-1.5" />
                Go to Integrations
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Requirements overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">What You Need</CardTitle>
          <CardDescription>AI Calling uses two services working together</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="p-3 rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="h-4 w-4 text-primary" />
                <p className="font-semibold text-sm">Twilio</p>
                <Badge variant="destructive" className="text-[10px]">Required</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Handles the phone call — connects to the contact's number, manages the call session, and records outcomes.</p>
              <div className="mt-2 flex items-center gap-1.5">
                {twilioStatus.isConfigured ? (
                  <Badge className="bg-emerald-600 text-white text-[10px]"><CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Connected</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Not configured</Badge>
                )}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Mic className="h-4 w-4 text-primary" />
                <p className="font-semibold text-sm">ElevenLabs</p>
                <Badge variant="outline" className="text-[10px]">Optional</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Provides natural-sounding AI voice. Without it, calls use basic text-to-speech which sounds more robotic.</p>
              <div className="mt-2 flex items-center gap-1.5">
                {elevenLabsStatus.isConfigured ? (
                  <Badge className="bg-emerald-600 text-white text-[10px]"><CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Connected</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Not configured</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Setup Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            Setup Instructions
          </CardTitle>
          <CardDescription>Step-by-step — start with Twilio, optionally add ElevenLabs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Part 1 — Twilio (Required)</p>
            <div className="space-y-4">
              <Step number={1} title="Create a Twilio account">
                <p>Go to <a href="https://twilio.com" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline inline-flex items-center gap-1">twilio.com <ExternalLink className="h-3 w-3" /></a> and sign up. You'll get free trial credit.</p>
              </Step>
              <Step number={2} title="Get Account SID and Auth Token">
                <p>In Twilio Console dashboard — <span className="font-medium text-foreground">Account SID</span> (starts with <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">AC</code>) and <span className="font-medium text-foreground">Auth Token</span> are at the top.</p>
              </Step>
              <Step number={3} title="Buy a phone number with Voice capability">
                <p>Go to <span className="font-medium text-foreground">Phone Numbers → Buy a Number</span>. Select one with <span className="font-medium text-foreground">Voice</span> enabled.</p>
                <p>Note it in E.164 format: <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">+441234567890</code></p>
              </Step>
              <Step number={4} title="Save Twilio credentials">
                <p>Go to <Button variant="link" className="h-auto p-0 text-sm" onClick={() => navigate('/settings/integrations')}>Settings → Integrations</Button> → <span className="font-medium text-foreground">SMS & Voice via Twilio</span> and enter all three values.</p>
              </Step>
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Part 2 — ElevenLabs (Optional, Recommended)</p>
            <div className="space-y-4">
              <Step number={5} title="Create an ElevenLabs account">
                <p>Go to <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline inline-flex items-center gap-1">elevenlabs.io <ExternalLink className="h-3 w-3" /></a> — the free tier gives you <span className="font-medium text-foreground">10,000 characters/month</span>.</p>
              </Step>
              <Step number={6} title="Generate an API key">
                <p>Click your profile icon → <span className="font-medium text-foreground">Profile + API Key → Generate</span>. Copy the key.</p>
              </Step>
              <Step number={7} title="Save ElevenLabs key">
                <p>Go to <Button variant="link" className="h-auto p-0 text-sm" onClick={() => navigate('/settings/integrations')}>Settings → Integrations</Button> → <span className="font-medium text-foreground">AI Voice via ElevenLabs</span> and paste your key.</p>
                <p className="text-xs bg-muted p-2 rounded-md mt-1">💡 The AI voice is used automatically on outbound calls — no extra configuration needed.</p>
              </Step>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mic className="h-4 w-4 text-primary" />
            What AI Calling Can Do
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <FeatureCard icon="📞" title="Automated Outbound Calls" description="AI calls contacts using purpose-driven scripts (e.g. payment reminders, follow-ups)." />
            <FeatureCard icon="🎭" title="Natural AI Voice" description="ElevenLabs makes the AI sound human — multiple voice and accent options." />
            <FeatureCard icon="📝" title="Script Builder" description="Create and manage call scripts with structured prompts and talking points." />
            <FeatureCard icon="📊" title="Outcome Tracking" description="Call outcomes, duration, and notes are logged automatically on the contact record." />
            <FeatureCard icon="🔄" title="Follow-up Actions" description="Set callback times and follow-up tasks directly from call results." />
            <FeatureCard icon="🎧" title="Call Recordings" description="Twilio recordings are linked and accessible from the activity timeline." />
          </div>
        </CardContent>
      </Card>

      {/* Where to find it */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Where to Find AI Calling in the CRM</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <LocationItem label="CRM Contacts" path="Contact record → Call button in actions bar" />
          <LocationItem label="Outreach Module" path="Outreach → Campaign → AI Call action on targets" />
          <LocationItem label="Scripts" path="Admin → Outreach Defaults for script assignment" />
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Security & Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• <span className="text-foreground font-medium">Keys stored server-side</span> — Twilio and ElevenLabs credentials never reach the browser.</p>
          <p>• <span className="text-foreground font-medium">Call recordings</span> are managed by Twilio and subject to their retention policies.</p>
          <p>• <span className="text-foreground font-medium">All calls logged</span> — outcome, duration, and notes are recorded in the CRM audit trail.</p>
          <p>• <span className="text-foreground font-medium">Consent awareness</span> — ensure you have appropriate consent before making automated calls in your jurisdiction.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
        {number}
      </div>
      <div>
        <p className="font-semibold text-sm text-foreground">{title}</p>
        <div className="text-sm text-muted-foreground mt-1 space-y-1">{children}</div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex gap-3 p-3 rounded-lg border border-border bg-muted/20">
      <span className="text-lg shrink-0">{icon}</span>
      <div>
        <p className="font-medium text-sm text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function LocationItem({ label, path }: { label: string; path: string }) {
  return (
    <div className="flex items-start gap-2">
      <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
      <p><span className="font-medium text-foreground">{label}</span> — {path}</p>
    </div>
  );
}
