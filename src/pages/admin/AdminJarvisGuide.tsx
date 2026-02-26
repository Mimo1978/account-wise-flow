import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Key, MessageSquare, Mic, Shield, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useIsServiceConfigured } from '@/hooks/use-integration-settings';
import { useNavigate } from 'react-router-dom';

export default function AdminJarvisGuide() {
  const { isConfigured, isLoading } = useIsServiceConfigured('anthropic');
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Jarvis AI Assistant
            <Badge variant="outline" className="ml-2 text-xs align-middle">Guide</Badge>
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Setup instructions and feature overview for the Jarvis CRM assistant
          </p>
        </div>
      </div>

      {/* Status card */}
      <Card className={isConfigured ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20'}>
        <CardContent className="flex items-center gap-4 py-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Checking configuration…</p>
          ) : isConfigured ? (
            <>
              <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">Jarvis is Active</p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-400/70">
                  The Anthropic API key is configured. Jarvis is available via the floating button in the bottom-right corner of every page.
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">Jarvis is Not Configured</p>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/70">
                  An Anthropic API key is required. Follow the setup steps below to enable Jarvis.
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

      {/* Setup Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            Setup Instructions
          </CardTitle>
          <CardDescription>Follow these steps to enable Jarvis for your workspace</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Step number={1} title="Get an Anthropic API Key">
            <p>Visit <span className="font-medium text-foreground">console.anthropic.com</span> and create an account if you don't have one.</p>
            <p>Navigate to <span className="font-medium text-foreground">API Keys</span> in your dashboard and generate a new key.</p>
            <p className="text-amber-600 dark:text-amber-400 font-medium">⚠ Keep this key secret — never share it publicly.</p>
          </Step>

          <Step number={2} title="Add the Key in Integrations Settings">
            <p>Go to <Button variant="link" className="h-auto p-0 text-sm" onClick={() => navigate('/settings/integrations')}>Settings → Integrations</Button></p>
            <p>Find the <span className="font-medium text-foreground">Jarvis AI (Anthropic)</span> section and paste your API key.</p>
            <p>Click <span className="font-medium text-foreground">Save</span>. The key is encrypted and stored securely per-user.</p>
          </Step>

          <Step number={3} title="Start Using Jarvis">
            <p>Once configured, a <span className="font-medium text-foreground">sparkle button</span> appears in the bottom-right corner of every page.</p>
            <p>Click it to open the Jarvis chat panel and start interacting.</p>
          </Step>
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            What Jarvis Can Do
          </CardTitle>
          <CardDescription>Natural language commands for your CRM</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <FeatureCard icon="🔍" title="Search & Lookup" description="Find contacts, companies, and deals using natural language queries." />
            <FeatureCard icon="➕" title="Create Records" description="Add contacts, companies, and opportunities by describing them." />
            <FeatureCard icon="📊" title="Pipeline Insights" description="Get summaries of your pipeline, revenue forecasts, and deal stages." />
            <FeatureCard icon="📧" title="Send Communications" description="Draft and send emails or SMS via integrated services." />
            <FeatureCard icon="🎤" title="Voice Input" description="Click the microphone to speak your commands — runs entirely in-browser." />
            <FeatureCard icon="🔊" title="Voice Output" description="Toggle text-to-speech in the chat header to hear Jarvis respond aloud." />
          </div>
        </CardContent>
      </Card>

      {/* Safety */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Security & Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• <span className="text-foreground font-medium">Write actions require confirmation</span> — Jarvis always asks before creating, updating, or deleting records.</p>
          <p>• <span className="text-foreground font-medium">No conversation history is stored</span> — chat clears on page refresh. No PII is persisted.</p>
          <p>• <span className="text-foreground font-medium">API key is server-side only</span> — your Anthropic key is never sent to the browser.</p>
          <p>• <span className="text-foreground font-medium">Audit logging</span> — all AI actions are logged (action type + entity ID only, no PII).</p>
          <p>• <span className="text-foreground font-medium">Rate limited</span> — 60 requests per user per hour to prevent abuse.</p>
        </CardContent>
      </Card>

      {/* Example prompts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Example Commands</CardTitle>
          <CardDescription>Try saying or typing these in the Jarvis chat</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              'Add a contact called Tom Jones at Google, email tom@google.com',
              'Show me the pipeline summary',
              'Search contacts at Acme Corporation',
              'Create an opportunity for £50k with TechForward',
              'What deals are closing this month?',
              'Send an email to Sarah Chen',
            ].map((cmd) => (
              <div key={cmd} className="flex items-start gap-2 text-sm p-2 rounded-md bg-muted/50">
                <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span className="text-foreground">{cmd}</span>
              </div>
            ))}
          </div>
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
