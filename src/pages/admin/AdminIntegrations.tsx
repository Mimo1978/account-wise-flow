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

  // Bland.ai state
  const [blandApiKey, setBlandApiKey] = useState('');
  const [blandShow, setBlandShow] = useState(false);
  const { isConfigured: blandConfigured, isLoading: blandLoading } = useIsServiceConfigured('bland');

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

  const handleSaveBland = () => {
    if (!blandApiKey.trim()) {
      toast.error('Please enter your Bland.ai API key');
      return;
    }
    saveKeys.mutate(
      [{ service: 'bland', key_name: 'BLAND_API_KEY', key_value: blandApiKey }],
      {
        onSuccess: () => {
          toast.success('Bland.ai configured — AI calling is ready');
          setBlandApiKey('');
        },
        onError: (err: any) => toast.error(err.message || 'Failed to save'),
      }
    );
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

      {/* Bland.ai — Two-way AI Calling */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Phone className="w-5 h-5" />
            Bland.ai — Two-way AI Calling
            {blandLoading ? (
              <Loader2 className="w-4 h-4 animate-spin ml-2" />
            ) : blandConfigured ? (
              <Badge variant="default" className="gap-1 ml-2"><CheckCircle2 className="w-3 h-3" />Active</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1 ml-2">Not configured</Badge>
            )}
            <Badge className="ml-1 text-[10px] bg-amber-500 text-white">Recommended</Badge>
          </CardTitle>
          <CardDescription>
            Full two-way AI conversations. Bland dials the candidate, listens, responds naturally, handles the entire call, and sends a transcript back. Bring your own key — £0.09/min. No limit on call duration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="bland-key" className="text-sm font-medium">BLAND_API_KEY</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="bland-key"
                  type={blandShow ? 'text' : 'password'}
                  placeholder={blandConfigured ? '••••••••••••••••' : 'sk-...'}
                  value={blandApiKey}
                  onChange={(e) => setBlandApiKey(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button" variant="ghost" size="sm"
                  className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setBlandShow(!blandShow)}
                >
                  {blandShow ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <Button onClick={handleSaveBland} disabled={!blandApiKey.trim() || saveKeys.isPending} className="gap-1.5">
                {saveKeys.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </Button>
            </div>
          </div>
          <div className="rounded-md bg-muted/50 border border-border p-3 space-y-1.5">
            <p className="text-xs font-medium text-foreground">How it works</p>
            <p className="text-xs text-muted-foreground">1. Say "Jarvis, call [name]" or click the Call button on any contact or candidate</p>
            <p className="text-xs text-muted-foreground">2. Bland dials them immediately using your script and call purpose</p>
            <p className="text-xs text-muted-foreground">3. The AI listens and responds naturally — full two-way conversation</p>
            <p className="text-xs text-muted-foreground">4. Call transcript and outcome log automatically in Client Mapper</p>
          </div>
          <div className="flex items-center gap-4 pt-1">
            <a href="https://app.bland.ai" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              Sign up at bland.ai <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">Free trial includes test calls</span>
          </div>
        </CardContent>
      </Card>

      {/* Twilio (AI Calling) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Phone className="w-5 h-5" />
            Twilio (AI Calling)
            {twLoading ? (
              <Loader2 className="w-4 h-4 animate-spin ml-2" />
            ) : twConfigured ? (
              <Badge variant="default" className="gap-1 ml-2"><CheckCircle2 className="w-3 h-3" />Active</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1 ml-2">Not configured</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Fallback for one-way scripted calls when Bland.ai is not configured. If you have Bland.ai set up, Twilio is optional. Required only if you want basic outbound SMS.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="tw-sid" className="text-sm font-medium">TWILIO_ACCOUNT_SID</Label>
            <Input id="tw-sid" type={twShow ? 'text' : 'password'} placeholder={twConfigured ? '••••••••••••••••' : 'ACxxxxxxxxxxxxxxxx'} value={twAccountSid} onChange={(e) => setTwAccountSid(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tw-token" className="text-sm font-medium">TWILIO_AUTH_TOKEN</Label>
            <Input id="tw-token" type={twShow ? 'text' : 'password'} placeholder={twConfigured ? '••••••••••••••••' : 'Your auth token'} value={twAuthToken} onChange={(e) => setTwAuthToken(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tw-phone" className="text-sm font-medium">TWILIO_PHONE_NUMBER</Label>
            <Input id="tw-phone" type="text" placeholder="+15551234567 (E.164 format)" value={twPhoneNumber} onChange={(e) => setTwPhoneNumber(e.target.value)} />
          </div>
          <div className="flex items-center justify-between pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setTwShow(!twShow)} className="text-muted-foreground">
              {twShow ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
              {twShow ? 'Hide' : 'Show'} secrets
            </Button>
            <Button onClick={handleSaveTwilio} disabled={saveKeys.isPending} className="gap-1.5">
              {saveKeys.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Twilio
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            <a href="https://console.twilio.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Open Twilio Console <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </CardContent>
      </Card>

      {/* ElevenLabs (Voice Synthesis) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mic className="w-5 h-5" />
            ElevenLabs (Voice)
            {elLoading ? (
              <Loader2 className="w-4 h-4 animate-spin ml-2" />
            ) : elConfigured ? (
              <Badge variant="default" className="gap-1 ml-2"><CheckCircle2 className="w-3 h-3" />Active</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1 ml-2">Not configured</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Natural AI voice for Jarvis calls. Voice ID is optional — defaults to "21m00Tcm4TlvDq8ikWAM" (Rachel).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="el-key" className="text-sm font-medium">ELEVEN_LABS_API_KEY</Label>
            <Input id="el-key" type={elShow ? 'text' : 'password'} placeholder={elConfigured ? '••••••••••••••••' : 'sk_...'} value={elApiKey} onChange={(e) => setElApiKey(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="el-voice" className="text-sm font-medium">ELEVEN_LABS_VOICE_ID <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="el-voice" type="text" placeholder="21m00Tcm4TlvDq8ikWAM (Rachel — default)" value={elVoiceId} onChange={(e) => setElVoiceId(e.target.value)} />
          </div>
          <div className="flex items-center justify-between pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setElShow(!elShow)} className="text-muted-foreground">
              {elShow ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
              {elShow ? 'Hide' : 'Show'} key
            </Button>
            <Button onClick={handleSaveElevenLabs} disabled={saveKeys.isPending} className="gap-1.5">
              {saveKeys.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save ElevenLabs
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Get API key <ExternalLink className="w-3 h-3" />
            </a>
            {' • '}
            <a href="https://elevenlabs.io/app/voice-library" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Browse voices <ExternalLink className="w-3 h-3" />
            </a>
          </p>
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
