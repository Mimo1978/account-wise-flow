import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Mail, Loader2, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface RuntimeConfig {
  resend_configured: boolean;
  outreach_from_email: string | null;
}

export default function AdminIntegrations() {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('get-public-runtime-config');
        if (fnError) throw fnError;
        setConfig(data as RuntimeConfig);
      } catch (err: any) {
        console.error('Failed to fetch runtime config:', err);
        setError(err.message || 'Failed to load configuration');
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          View the status of external service integrations.
        </p>
      </div>

      {/* Outreach Email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="w-5 h-5" />
            Outreach Email
          </CardTitle>
          <CardDescription>
            Configuration for sending outreach emails via Resend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading configuration…
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          ) : config ? (
            <div className="space-y-3">
              {/* Resend API Key */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Resend API Key</span>
                {config.resend_configured ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Configured
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Not configured
                  </Badge>
                )}
              </div>

              {/* FROM email */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">From Email</span>
                {config.outreach_from_email ? (
                  <span className="text-sm text-muted-foreground font-mono">
                    {config.outreach_from_email}
                  </span>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Not configured
                  </Badge>
                )}
              </div>

              {/* Warning if missing */}
              {(!config.resend_configured || !config.outreach_from_email) && (
                <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-sm text-destructive font-medium">Configuration Incomplete</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    To send outreach emails, you must configure the <code className="font-mono text-xs bg-muted px-1 rounded">RESEND_API_KEY</code> and{' '}
                    <code className="font-mono text-xs bg-muted px-1 rounded">OUTREACH_FROM_EMAIL</code> secrets in your backend environment.
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Google Calendar Integration - Coming Soon */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="w-5 h-5" />
            Google Calendar Sync
            <Badge variant="secondary" className="text-[10px] ml-2">Coming Soon</Badge>
          </CardTitle>
          <CardDescription>
            Sync your CRM diary events bidirectionally with Google Calendar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Connection Status</span>
              <Badge variant="secondary" className="gap-1">
                Not Connected
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              When connected, diary events (calls, meetings, tasks) will automatically sync to your Google Calendar and vice versa.
            </p>
            <Button variant="outline" size="sm" disabled className="gap-2">
              <Calendar className="w-4 h-4" />
              Connect Google Calendar
            </Button>
            <p className="text-xs text-muted-foreground italic">
              Google Calendar sync is under development. You can book and manage diary events through Jarvis and the Home diary section today.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
