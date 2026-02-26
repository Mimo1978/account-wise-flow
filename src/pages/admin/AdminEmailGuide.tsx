import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Key, Shield, ArrowRight, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { useIsServiceConfigured } from '@/hooks/use-integration-settings';
import { useNavigate } from 'react-router-dom';

export default function AdminEmailGuide() {
  const { isConfigured, isLoading } = useIsServiceConfigured('resend');
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Mail className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Email Integration
            <Badge variant="outline" className="ml-2 text-xs align-middle">Guide</Badge>
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Send emails directly from the CRM using Resend
          </p>
        </div>
      </div>

      {/* Status */}
      <Card className={isConfigured ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20'}>
        <CardContent className="flex items-center gap-4 py-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Checking configuration…</p>
          ) : isConfigured ? (
            <>
              <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">Email is Active</p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-400/70">
                  Resend API key and from email are configured. You can send emails from contact records, outreach campaigns, and via Jarvis.
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">Email is Not Configured</p>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/70">
                  A Resend API key and verified sender email are required. Follow the steps below.
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
          <CardDescription>Get sending in under 10 minutes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Step number={1} title="Create a free Resend account">
            <p>Go to <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline inline-flex items-center gap-1">resend.com <ExternalLink className="h-3 w-3" /></a> and sign up — no credit card required.</p>
            <p>Free tier includes <span className="font-medium text-foreground">3,000 emails/month</span> and <span className="font-medium text-foreground">100 emails/day</span>.</p>
          </Step>

          <Step number={2} title="Verify your sending domain">
            <p>In the Resend dashboard, go to <span className="font-medium text-foreground">Domains → Add Domain</span>.</p>
            <p>Add the DNS records they provide to your domain registrar (e.g. GoDaddy, Cloudflare, Namecheap).</p>
            <p>Wait for verification — usually takes <span className="font-medium text-foreground">5–10 minutes</span>.</p>
            <p className="text-xs bg-muted p-2 rounded-md mt-1">💡 You can use a subdomain like <code className="text-xs bg-muted-foreground/10 px-1 rounded">mail.yourcompany.com</code> to keep your main domain clean.</p>
          </Step>

          <Step number={3} title="Generate your API key">
            <p>In Resend dashboard, go to <span className="font-medium text-foreground">API Keys → Create API Key</span>.</p>
            <p>Name it something like <span className="font-medium text-foreground">"CRM Integration"</span>.</p>
            <p>Copy the key — it starts with <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">re_</code></p>
          </Step>

          <Step number={4} title="Enter credentials in the CRM">
            <p>Go to <Button variant="link" className="h-auto p-0 text-sm" onClick={() => navigate('/settings/integrations')}>Settings → Integrations</Button></p>
            <p>Find the <span className="font-medium text-foreground">Email via Resend</span> card and expand "Set up now".</p>
            <p>Paste your <span className="font-medium text-foreground">API Key</span> and your <span className="font-medium text-foreground">verified sender email</span> (e.g. hello@yourcompany.com).</p>
            <p>Click <span className="font-medium text-foreground">Save Keys</span>, then <span className="font-medium text-foreground">Test Connection</span> to verify.</p>
          </Step>
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            What You Can Do With Email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <FeatureCard icon="📧" title="Send from Contact Records" description="Open any contact and click Email to compose and send directly." />
            <FeatureCard icon="📝" title="Email Templates" description="Create reusable templates with merge tags like {{first_name}} and {{company_name}}." />
            <FeatureCard icon="📊" title="Outreach Campaigns" description="Send sequenced outreach emails to lists of contacts with tracking." />
            <FeatureCard icon="🤖" title="Jarvis Integration" description="Ask Jarvis to draft and send emails using natural language commands." />
          </div>
        </CardContent>
      </Card>

      {/* Where to find it */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Where to Find Email in the CRM</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <LocationItem label="CRM Contacts" path="Contact record → Email button in actions bar" />
          <LocationItem label="Outreach Module" path="Outreach → Campaign → Compose Email" />
          <LocationItem label="Templates" path="Settings → Email Templates" />
          <LocationItem label="Jarvis" path="Chat → 'Send an email to [name]'" />
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Security & Limits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• <span className="text-foreground font-medium">Keys stored server-side</span> — your Resend API key never reaches the browser.</p>
          <p>• <span className="text-foreground font-medium">Per-user isolation</span> — each user manages their own credentials, protected by row-level security.</p>
          <p>• <span className="text-foreground font-medium">Rate limited</span> — 100 emails per user per hour to prevent abuse.</p>
          <p>• <span className="text-foreground font-medium">All emails logged</span> — every sent email is recorded as a CRM activity for full audit trail.</p>
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
