import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, Key, Shield, ArrowRight, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { useIsServiceConfigured } from '@/hooks/use-integration-settings';
import { useNavigate } from 'react-router-dom';

export default function AdminSmsGuide() {
  const { isConfigured, isLoading } = useIsServiceConfigured('twilio');
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Phone className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            SMS Integration
            <Badge variant="outline" className="ml-2 text-xs align-middle">Guide</Badge>
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Send SMS messages directly from the CRM using Twilio
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
                <p className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">SMS is Active</p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-400/70">
                  Twilio credentials are configured. You can send SMS from contact records and outreach campaigns.
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">SMS is Not Configured</p>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/70">
                  Twilio Account SID, Auth Token, and a phone number are required. Follow the steps below.
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
          <CardDescription>Get SMS working in under 15 minutes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Step number={1} title="Create a Twilio account">
            <p>Go to <a href="https://twilio.com" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline inline-flex items-center gap-1">twilio.com <ExternalLink className="h-3 w-3" /></a> and sign up.</p>
            <p>You'll receive <span className="font-medium text-foreground">free trial credit</span> to test SMS and voice features.</p>
          </Step>

          <Step number={2} title="Find your Account SID and Auth Token">
            <p>In the Twilio Console, your <span className="font-medium text-foreground">Account SID</span> and <span className="font-medium text-foreground">Auth Token</span> are displayed at the top of the dashboard.</p>
            <p>Account SID starts with <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">AC</code>. Click "Show" to reveal the Auth Token.</p>
          </Step>

          <Step number={3} title="Get a phone number">
            <p>In Twilio Console → <span className="font-medium text-foreground">Phone Numbers → Buy a Number</span>.</p>
            <p>Select a number with <span className="font-medium text-foreground">SMS</span> and <span className="font-medium text-foreground">Voice</span> capabilities.</p>
            <p>Note it in E.164 format, e.g. <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">+441234567890</code></p>
            <p className="text-xs bg-muted p-2 rounded-md mt-1">💡 If you want to send SMS to verified numbers only (trial), you can start testing immediately without upgrading.</p>
          </Step>

          <Step number={4} title="Enter credentials in the CRM">
            <p>Go to <Button variant="link" className="h-auto p-0 text-sm" onClick={() => navigate('/settings/integrations')}>Settings → Integrations</Button></p>
            <p>Find the <span className="font-medium text-foreground">SMS & Voice via Twilio</span> card and expand "Set up now".</p>
            <p>Enter your <span className="font-medium text-foreground">Account SID</span>, <span className="font-medium text-foreground">Auth Token</span>, and <span className="font-medium text-foreground">Phone Number</span>.</p>
            <p>Click <span className="font-medium text-foreground">Save Keys</span>, then <span className="font-medium text-foreground">Test Connection</span>.</p>
          </Step>
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            What You Can Do With SMS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <FeatureCard icon="💬" title="Send from Contact Records" description="Open any contact with a phone number and click SMS to compose." />
            <FeatureCard icon="✅" title="GDPR Consent Check" description="Automatic consent verification before sending — protects you and your contacts." />
            <FeatureCard icon="📊" title="Outreach Campaigns" description="Include SMS steps in multi-channel outreach sequences." />
            <FeatureCard icon="📋" title="Activity Logging" description="Every SMS is automatically logged as an outbound activity on the contact record." />
          </div>
        </CardContent>
      </Card>

      {/* Where to find it */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Where to Find SMS in the CRM</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <LocationItem label="CRM Contacts" path="Contact record → SMS button in actions bar" />
          <LocationItem label="Outreach Module" path="Outreach → Campaign → Compose SMS" />
          <LocationItem label="Jarvis" path="Chat → 'Send an SMS to [name]'" />
        </CardContent>
      </Card>

      {/* Important notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Important Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• <span className="text-foreground font-medium">Trial accounts</span> can only send to verified numbers. Upgrade your Twilio account to send to any number.</p>
          <p>• <span className="text-foreground font-medium">International SMS</span> requires enabling the destination country in Twilio's Geo Permissions settings.</p>
          <p>• <span className="text-foreground font-medium">Phone format</span> — contact phone numbers should include country code (e.g. +44, +1) for reliable delivery.</p>
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
          <p>• <span className="text-foreground font-medium">Keys stored server-side</span> — Twilio credentials never reach the browser.</p>
          <p>• <span className="text-foreground font-medium">Per-user isolation</span> — each user manages their own credentials.</p>
          <p>• <span className="text-foreground font-medium">Rate limited</span> — 50 SMS per user per hour to prevent abuse.</p>
          <p>• <span className="text-foreground font-medium">GDPR enforced</span> — contacts without recorded consent cannot receive SMS.</p>
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
