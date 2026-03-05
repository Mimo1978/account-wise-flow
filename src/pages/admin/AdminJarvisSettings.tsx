import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Volume2, Mic, Sparkles, Settings2, RotateCcw, Loader2 } from 'lucide-react';
import { useJarvisSettings, DEFAULT_JARVIS_SETTINGS, JarvisSettings } from '@/hooks/use-jarvis-settings';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Speed label                                                        */
/* ------------------------------------------------------------------ */
function speedLabel(v: number): string {
  if (v <= 0.8) return 'Slow';
  if (v <= 1.1) return 'Normal';
  return 'Fast';
}

/* ------------------------------------------------------------------ */
/*  Test voice helper                                                  */
/* ------------------------------------------------------------------ */
function testVoice(s: JarvisSettings) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(
    `Hello, I am ${s.assistant_name}. Ready to assist you.`
  );
  utterance.rate = s.speaking_speed;
  utterance.volume = s.volume / 100;

  const voices = window.speechSynthesis.getVoices();
  if (s.voice_gender === 'male') {
    const preferred = ['Google UK English Male', 'Microsoft George', 'Daniel'];
    let voice = null;
    for (const name of preferred) {
      voice = voices.find((v) => v.name.includes(name));
      if (voice) break;
    }
    if (!voice) voice = voices.find((v) => v.name.includes('Male') && v.lang.startsWith('en'));
    if (!voice) voice = voices.find((v) => v.lang === 'en-GB');
    if (voice) utterance.voice = voice;
  } else {
    const preferred = ['Google UK English Female', 'Microsoft Hazel', 'Martha', 'Samantha'];
    let voice = null;
    for (const name of preferred) {
      voice = voices.find((v) => v.name.includes(name));
      if (voice) break;
    }
    if (!voice) voice = voices.find((v) => v.name.includes('Female') && v.lang.startsWith('en'));
    if (!voice) voice = voices.find((v) => v.lang === 'en-GB');
    if (voice) utterance.voice = voice;
  }

  window.speechSynthesis.speak(utterance);
}

/* ------------------------------------------------------------------ */
/*  Section wrapper                                                    */
/* ------------------------------------------------------------------ */
function Section({ icon: Icon, title, description, children }: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {children}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main panel                                                         */
/* ------------------------------------------------------------------ */
export default function AdminJarvisSettings() {
  const { settings, isLoading, saveSettings, isSaving } = useJarvisSettings();
  const [draft, setDraft] = useState<JarvisSettings>(DEFAULT_JARVIS_SETTINGS);
  const [dirty, setDirty] = useState(false);

  // Sync draft when loaded
  useEffect(() => {
    if (!isLoading && settings) {
      setDraft(settings);
      setDirty(false);
    }
  }, [isLoading, settings]);

  const update = useCallback(<K extends keyof JarvisSettings>(key: K, value: JarvisSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  const handleSave = () => {
    saveSettings(draft);
    setDirty(false);
  };

  const handleReset = () => {
    setDraft(DEFAULT_JARVIS_SETTINGS);
    setDirty(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Jarvis Settings</h2>
        <p className="text-muted-foreground mt-1">Configure the AI voice assistant for your workspace</p>
      </div>

      {/* ==================== VOICE ==================== */}
      <Section icon={Volume2} title="Voice Settings" description="Control how Jarvis sounds">
        {/* Gender */}
        <div className="space-y-2">
          <Label>Voice Gender</Label>
          <div className="flex gap-2">
            {(['male', 'female'] as const).map((g) => (
              <Button
                key={g}
                size="sm"
                variant={draft.voice_gender === g ? 'default' : 'outline'}
                onClick={() => update('voice_gender', g)}
                className="capitalize"
              >
                {g}
              </Button>
            ))}
          </div>
        </div>

        {/* Style */}
        <div className="space-y-2">
          <Label>Voice Style</Label>
          <Select value={draft.voice_style} onValueChange={(v) => update('voice_style', v as any)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="friendly">Friendly</SelectItem>
              <SelectItem value="formal">Formal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Speed */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Speaking Speed</Label>
            <span className="text-sm text-muted-foreground">{speedLabel(draft.speaking_speed)}</span>
          </div>
          <Slider
            min={0.7}
            max={1.3}
            step={0.1}
            value={[draft.speaking_speed]}
            onValueChange={([v]) => update('speaking_speed', v)}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Slow</span><span>Normal</span><span>Fast</span>
          </div>
        </div>

        {/* Volume */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Volume</Label>
            <span className="text-sm text-muted-foreground">{draft.volume}%</span>
          </div>
          <Slider
            min={0}
            max={100}
            step={5}
            value={[draft.volume]}
            onValueChange={([v]) => update('volume', v)}
            className="w-full"
          />
        </div>

        {/* Mute by default */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Mute Jarvis by default</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Text-only mode — no voice output</p>
          </div>
          <Switch checked={draft.mute_by_default} onCheckedChange={(v) => update('mute_by_default', v)} />
        </div>

        {/* Test */}
        <Button variant="outline" size="sm" onClick={() => testVoice(draft)} className="gap-2">
          <Volume2 className="h-4 w-4" /> Test Voice
        </Button>
      </Section>

      {/* ==================== PERSONALISATION ==================== */}
      <Section icon={Sparkles} title="Personalisation" description="Customise the assistant's identity">
        <div className="space-y-2">
          <Label>Assistant Name</Label>
          <Input
            value={draft.assistant_name}
            onChange={(e) => update('assistant_name', e.target.value)}
            placeholder="Jarvis"
            className="max-w-xs"
          />
          <p className="text-xs text-muted-foreground">This name is used in greetings and UI labels</p>
        </div>

        <div className="space-y-2">
          <Label>Greeting Message</Label>
          <Textarea
            value={draft.greeting_message}
            onChange={(e) => update('greeting_message', e.target.value)}
            rows={2}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Use {'{{name}}'} for user's first name and {'{{assistant}}'} for the assistant name
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Label>Wake Word</Label>
              <Badge variant="secondary" className="text-[10px]">Coming Soon</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Activate with a voice command</p>
          </div>
          <Switch disabled checked={false} />
        </div>
      </Section>

      {/* ==================== BEHAVIOUR ==================== */}
      <Section icon={Settings2} title="Behaviour" description="Control how the assistant interacts">
        <div className="space-y-2">
          <Label>Auto-Sleep Timeout</Label>
          <Select value={String(draft.auto_sleep_minutes)} onValueChange={(v) => update('auto_sleep_minutes', Number(v))}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 minute</SelectItem>
              <SelectItem value="3">3 minutes</SelectItem>
              <SelectItem value="5">5 minutes</SelectItem>
              <SelectItem value="0">Never</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Keep Listening by Default</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Automatically reactivate microphone after each response</p>
          </div>
          <Switch checked={draft.keep_listening_default} onCheckedChange={(v) => update('keep_listening_default', v)} />
        </div>

        <div className="space-y-2">
          <Label>Confirmation Before Actions</Label>
          <Select value={draft.confirmation_mode} onValueChange={(v) => update('confirmation_mode', v as any)}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="always">Always — confirm every action</SelectItem>
              <SelectItem value="smart">Smart — only destructive actions</SelectItem>
              <SelectItem value="never">Never — execute immediately</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Show Conversation History</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Display message history in the Jarvis panel</p>
          </div>
          <Switch checked={draft.show_conversation_history} onCheckedChange={(v) => update('show_conversation_history', v)} />
        </div>
      </Section>

      {/* ==================== ACTIONS ==================== */}
      <Separator />
      <div className="flex items-center justify-between">
        <button onClick={handleReset} className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 flex items-center gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" /> Reset to Defaults
        </button>
        <Button onClick={handleSave} disabled={!dirty || isSaving} className="min-w-[140px]">
          {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
