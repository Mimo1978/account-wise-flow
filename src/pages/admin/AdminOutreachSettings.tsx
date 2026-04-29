import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Save } from 'lucide-react';
import { useWorkspaceSettings, type OutreachRules } from '@/hooks/use-workspace-settings';
import { usePermissions } from '@/hooks/use-permissions';
import { ShieldAlert } from 'lucide-react';

const DEFAULTS: OutreachRules = {
  prevent_state_downgrade: true,
  lock_opted_out: true,
  manager_can_reopen: false,
  treat_wrong_number_as_opt_out: true,
  auto_snooze_on_max_attempts: true,
  opt_out_required: true,
  calling_hours_start: '09:00',
  calling_hours_end: '18:00',
  calling_timezone: 'UTC',
  max_call_attempts_default: 3,
  default_target_priority: 5,
  default_target_state: 'queued',
};

const RULE_META: { key: keyof OutreachRules; label: string; description: string }[] = [
  { key: 'prevent_state_downgrade', label: 'Prevent state downgrade', description: 'Targets cannot move backwards in the outreach pipeline (e.g. from contacted back to queued).' },
  { key: 'lock_opted_out', label: 'Lock opted-out targets', description: 'Once a target opts out, their record is permanently locked and cannot be re-enrolled.' },
  { key: 'manager_can_reopen', label: 'Manager can reopen', description: 'Allow managers to reopen completed or closed targets for follow-up outreach.' },
  { key: 'treat_wrong_number_as_opt_out', label: 'Treat wrong number as opt-out', description: 'Automatically treat a "wrong number" call outcome as an opt-out to prevent further calls.' },
  { key: 'auto_snooze_on_max_attempts', label: 'Auto-snooze on max attempts', description: 'Automatically snooze targets who have reached the maximum call attempts instead of marking as failed.' },
];

export default function AdminOutreachSettings() {
  const { settings, isLoading, updateSettings, isUpdating } = useWorkspaceSettings();
  const { role } = usePermissions();
  const [rules, setRules] = useState<OutreachRules>(DEFAULTS);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      const saved = (settings as any).outreach_rules as Partial<OutreachRules> | undefined;
      setRules({ ...DEFAULTS, ...saved });
      setDirty(false);
    }
  }, [settings]);

  const handleToggle = (key: keyof OutreachRules) => {
    setRules((prev) => ({ ...prev, [key]: !prev[key] }));
    setDirty(true);
  };

  const handleSave = () => {
    updateSettings({ outreach_rules: rules } as any);
    setDirty(false);
  };

  const isAdmin = role === 'admin';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Outreach Settings</h1>
          <p className="text-muted-foreground text-sm">Configure workspace-wide outreach rules and guardrails.</p>
        </div>
        {isAdmin && (
          <Button onClick={handleSave} disabled={!dirty || isUpdating} size="sm">
            {isUpdating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Save
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outreach Rules</CardTitle>
          <CardDescription>These rules apply globally to all campaigns in this workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {RULE_META.map(({ key, label, description }) => (
            <div key={key} className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">{label}</Label>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <Switch
                checked={!!rules[key]}
                onCheckedChange={() => handleToggle(key)}
                disabled={!isAdmin}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-destructive" />
            Script Safety Filter
          </CardTitle>
          <CardDescription>
            Brand-protection rules that scan every outreach script before it can be saved or
            launched. Blocks profanity, slurs, hate speech, discriminatory wording, threats and
            requests for sensitive personal data. Structural checks (minimum content, required
            email subject, required call blocks) always apply regardless of this setting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Strict script safety (recommended)</Label>
              <p className="text-xs text-muted-foreground">
                When ON, scripts containing profanity, slurs, discriminatory language, threats or
                sensitive data requests cannot be saved. When OFF, those issues are logged as
                warnings only — use with care and only with a documented business reason.
              </p>
            </div>
            <Switch
              checked={(rules as any).script_safety_strict !== false}
              onCheckedChange={(checked) => {
                setRules((prev) => ({ ...(prev as any), script_safety_strict: checked }) as OutreachRules);
                setDirty(true);
              }}
              disabled={!isAdmin}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
