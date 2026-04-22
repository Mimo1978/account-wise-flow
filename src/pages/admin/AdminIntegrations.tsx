import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle2, Mail, Loader2, Calendar, FileText, ExternalLink, Eye, EyeOff, Save, Phone, Mic } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIsServiceConfigured, useSaveIntegrationKeys, useIntegrationSettings } from '@/hooks/use-integration-settings';
import { toast } from 'sonner';
import { useEffect } from 'react';

interface RuntimeConfig {
  resend_configured: boolean;
  outreach_from_email: string | null;
}

export default function AdminIntegrations() {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // CloudConvert state
  const [ccApiKey, setCcApiKey] = useState('');
  const [ccShowKey, setCcShowKey] = useState(false);
  const { isConfigured: ccConfigured, isLoading: ccLoading } = useIsServiceConfigured('cloudconvert');
  const { data: ccSettings } = useIntegrationSettings('cloudconvert');
  const saveKeys = useSaveIntegrationKeys();

  // Twilio state
  const [twAccountSid, setTwAccountSid] = useState('');
  const [twAuthToken, setTwAuthToken] = useState('');
  const [twPhoneNumber, setTwPhoneNumber] = useState('');
  const [twShow, setTwShow] = useState(false);
  const { isConfigured: twConfigured, isLoading: twLoading } = useIsServiceConfigured('twilio');

  // ElevenLabs state
  const [elApiKey, setElApiKey] = useState('');
  const [elVoiceId, setElVoiceId] = useState('');
  const [elShow, setElShow] = useState(false);
  const { isConfigured: elConfigured, isLoading: elLoading } = useIsServiceConfigured('elevenlabs');

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

  const handleSaveCloudConvert = () => {
    if (!ccApiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }
    saveKeys.mutate(
      [{ service: 'cloudconvert', key_name: 'CLOUDCONVERT_API_KEY', key_value: ccApiKey }],
      {
        onSuccess: () => {
          toast.success('CloudConvert API key saved');
          setCcApiKey('');
        },
        onError: (err: any) => toast.error(err.message || 'Failed to save'),
      }
    );
  };

  const handleSaveTwilio = () => {
    const keys = [
      { service: 'twilio', key_name: 'TWILIO_ACCOUNT_SID', key_value: twAccountSid },
      { service: 'twilio', key_name: 'TWILIO_AUTH_TOKEN', key_value: twAuthToken },
      { service: 'twilio', key_name: 'TWILIO_PHONE_NUMBER', key_value: twPhoneNumber },
    ].filter(k => k.key_value.trim() !== '');
    if (keys.length === 0) {
      toast.error('Enter at least one Twilio value');
      return;
    }
    saveKeys.mutate(keys, {
      onSuccess: () => {
        toast.success('Twilio keys saved');
        setTwAccountSid(''); setTwAuthToken(''); setTwPhoneNumber('');
      },
      onError: (err: any) => toast.error(err.message || 'Failed to save'),
    });
  };

  const handleSaveElevenLabs = () => {
    const keys = [
      { service: 'elevenlabs', key_name: 'ELEVEN_LABS_API_KEY', key_value: elApiKey },
      { service: 'elevenlabs', key_name: 'ELEVEN_LABS_VOICE_ID', key_value: elVoiceId },
    ].filter(k => k.key_value.trim() !== '');
    if (keys.length === 0) {
      toast.error('Enter at least one ElevenLabs value');
      return;
    }
    saveKeys.mutate(keys, {
      onSuccess: () => {
        toast.success('ElevenLabs keys saved');
        setElApiKey(''); setElVoiceId('');
      },
      onError: (err: any) => toast.error(err.message || 'Failed to save'),
    });
  };

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

      {/* CV Preview (CloudConvert) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5" />
            CV Preview (CloudConvert)
            {ccLoading ? (
              <Loader2 className="w-4 h-4 animate-spin ml-2" />
            ) : ccConfigured ? (
              <Badge variant="default" className="gap-1 ml-2">
                <CheckCircle2 className="w-3 h-3" />
                Active
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1 ml-2">
                Not configured
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Converts uploaded Word documents to PDF so CVs display in their exact original format. Free tier: 25 conversions/day.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cc-api-key" className="text-sm font-medium">
              CloudConvert API Key
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="cc-api-key"
                  type={ccShowKey ? 'text' : 'password'}
                  placeholder={ccConfigured ? '••••••••••••••••' : 'Enter your API key from cloudconvert.com'}
                  value={ccApiKey}
                  onChange={(e) => setCcApiKey(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setCcShowKey(!ccShowKey)}
                >
                  {ccShowKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <Button
                onClick={handleSaveCloudConvert}
                disabled={!ccApiKey.trim() || saveKeys.isPending}
                className="gap-1.5"
              >
                {saveKeys.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              <a
                href="https://cloudconvert.com/dashboard/api/v2/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Get free API key
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
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
