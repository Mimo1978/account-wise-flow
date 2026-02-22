import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, Plus, Pencil, Trash2, Star, AlertTriangle } from 'lucide-react';
import { useWorkspaceSettings, type OutreachRules } from '@/hooks/use-workspace-settings';
import { usePermissions } from '@/hooks/use-permissions';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

// ────────────────── Types ──────────────────

type Channel = 'email' | 'sms' | 'call';

interface Script {
  id: string;
  workspace_id: string;
  name: string;
  channel: Channel;
  subject: string | null;
  body: string;
  is_default: boolean;
  campaign_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const CHANNELS: Channel[] = ['email', 'call', 'sms'];

const OUTREACH_DEFAULTS: OutreachRules = {
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
};

const TIMEZONES = [
  'UTC', 'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'America/New_York',
  'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Asia/Tokyo',
  'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney',
];

const TOGGLE_RULES: { key: keyof OutreachRules; label: string; description: string }[] = [
  { key: 'opt_out_required', label: 'Opt-out required', description: 'Targets must be given an opt-out option before outreach.' },
  { key: 'prevent_state_downgrade', label: 'Prevent state downgrade', description: 'Targets cannot move backwards in the outreach pipeline.' },
  { key: 'lock_opted_out', label: 'Lock opted-out targets', description: 'Once opted out, the target is permanently locked.' },
  { key: 'manager_can_reopen', label: 'Manager can reopen', description: 'Allow managers to reopen completed or closed targets.' },
  { key: 'treat_wrong_number_as_opt_out', label: 'Treat wrong number as opt-out', description: 'Automatically opt out targets with wrong numbers.' },
  { key: 'auto_snooze_on_max_attempts', label: 'Auto-snooze on max attempts', description: 'Snooze targets that hit the max call attempts.' },
];

const EMPTY_FORM = { name: '', channel: 'email' as Channel, subject: '', body: '', is_default: false };

// ────────────────── Component ──────────────────

export default function AdminOutreach() {
  const { currentWorkspace } = useWorkspace();
  const { settings, isLoading: settingsLoading, updateSettings, isUpdating } = useWorkspaceSettings();
  const { role, isAdmin, userId } = usePermissions();

  const [topTab, setTopTab] = useState('settings');

  // ── Settings state ──
  const [rules, setRules] = useState<OutreachRules>(OUTREACH_DEFAULTS);
  const [settingsDirty, setSettingsDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      const saved = (settings as any).outreach_rules as Partial<OutreachRules> | undefined;
      setRules({ ...OUTREACH_DEFAULTS, ...saved });
      setSettingsDirty(false);
    }
  }, [settings]);

  const handleToggle = (key: keyof OutreachRules) => {
    setRules(prev => ({ ...prev, [key]: !prev[key] }));
    setSettingsDirty(true);
  };

  const handleInputChange = (key: keyof OutreachRules, value: string | number) => {
    setRules(prev => ({ ...prev, [key]: value }));
    setSettingsDirty(true);
  };

  const handleSaveSettings = () => {
    updateSettings({ outreach_rules: rules } as any);
    setSettingsDirty(false);
  };

  // ── Scripts state ──
  const wid = currentWorkspace?.id;
  const [scripts, setScripts] = useState<Script[]>([]);
  const [scriptsLoading, setScriptsLoading] = useState(true);
  const [scriptTab, setScriptTab] = useState<Channel>('email');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Script | null>(null);

  const fetchScripts = useCallback(async () => {
    if (!wid) return;
    setScriptsLoading(true);
    const { data, error } = await supabase
      .from('outreach_scripts')
      .select('*')
      .eq('workspace_id', wid)
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      toast.error('Failed to load scripts');
    } else {
      setScripts((data as Script[]) || []);
    }
    setScriptsLoading(false);
  }, [wid]);

  useEffect(() => { fetchScripts(); }, [fetchScripts]);

  const filteredScripts = scripts.filter(s => s.channel === scriptTab);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, channel: scriptTab });
    setFormOpen(true);
  };

  const openEdit = (s: Script) => {
    setEditingId(s.id);
    setForm({ name: s.name, channel: s.channel, subject: s.subject || '', body: s.body, is_default: s.is_default });
    setFormOpen(true);
  };

  const handleSaveScript = async () => {
    if (!wid || !isAdmin) return;
    if (!form.name.trim() || !form.body.trim()) {
      toast.error('Name and body are required');
      return;
    }
    setSaving(true);
    try {
      if (form.is_default) {
        await supabase
          .from('outreach_scripts')
          .update({ is_default: false })
          .eq('workspace_id', wid)
          .eq('channel', form.channel)
          .eq('is_default', true);
      }
      if (editingId) {
        const { error } = await supabase
          .from('outreach_scripts')
          .update({ name: form.name.trim(), channel: form.channel, subject: form.subject.trim() || null, body: form.body.trim(), is_default: form.is_default })
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Script updated');
      } else {
        const { error } = await supabase
          .from('outreach_scripts')
          .insert({ workspace_id: wid, name: form.name.trim(), channel: form.channel, subject: form.subject.trim() || null, body: form.body.trim(), is_default: form.is_default, created_by: userId });
        if (error) throw error;
        toast.success('Script created');
      }
      setFormOpen(false);
      fetchScripts();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save script');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !isAdmin) return;
    const { count } = await supabase
      .from('outreach_campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', wid!)
      .neq('status', 'completed')
      .or(`call_script_id.eq.${deleteTarget.id},email_script_id.eq.${deleteTarget.id},sms_script_id.eq.${deleteTarget.id}`);
    if (count && count > 0) {
      toast.error('Cannot delete — script linked to active campaign');
      setDeleteTarget(null);
      return;
    }
    const { error } = await supabase.from('outreach_scripts').delete().eq('id', deleteTarget.id);
    if (error) toast.error(error.message);
    else { toast.success('Script deleted'); fetchScripts(); }
    setDeleteTarget(null);
  };

  // ── Defaults tab: set default script per channel ──
  const handleSetDefault = async (scriptId: string, channel: Channel) => {
    if (!wid) return;
    // Unset all defaults for this channel
    await supabase
      .from('outreach_scripts')
      .update({ is_default: false })
      .eq('workspace_id', wid)
      .eq('channel', channel)
      .eq('is_default', true);
    // Set the new default
    const { error } = await supabase
      .from('outreach_scripts')
      .update({ is_default: true })
      .eq('id', scriptId);
    if (error) {
      toast.error('Failed to set default');
    } else {
      toast.success(`Default ${channel} script updated`);
      fetchScripts();
    }
  };

  const isAdminOrManager = role === 'admin' || role === 'manager';

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Outreach Management</h1>
        <p className="text-muted-foreground text-sm">Configure outreach rules, manage scripts, and set channel defaults.</p>
      </div>

      <Tabs value={topTab} onValueChange={setTopTab}>
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="scripts">Scripts</TabsTrigger>
          <TabsTrigger value="defaults">Defaults</TabsTrigger>
        </TabsList>

        {/* ════════ SETTINGS TAB ════════ */}
        <TabsContent value="settings" className="space-y-6 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Outreach Settings</h2>
              <p className="text-muted-foreground text-xs">Workspace-wide outreach rules and guardrails.</p>
            </div>
            {isAdminOrManager && (
              <Button onClick={handleSaveSettings} disabled={!settingsDirty || isUpdating} size="sm" className="gap-1.5">
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </Button>
            )}
          </div>

          {/* Calling defaults */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Calling Defaults</CardTitle>
              <CardDescription>Default calling window and attempt limits for new campaigns.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="calling-start" className="text-xs">Calling Hours Start</Label>
                  <Input
                    id="calling-start"
                    type="time"
                    value={rules.calling_hours_start}
                    onChange={e => handleInputChange('calling_hours_start', e.target.value)}
                    disabled={!isAdminOrManager}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="calling-end" className="text-xs">Calling Hours End</Label>
                  <Input
                    id="calling-end"
                    type="time"
                    value={rules.calling_hours_end}
                    onChange={e => handleInputChange('calling_hours_end', e.target.value)}
                    disabled={!isAdminOrManager}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="calling-tz" className="text-xs">Timezone</Label>
                  <Select
                    value={rules.calling_timezone}
                    onValueChange={v => handleInputChange('calling_timezone', v)}
                    disabled={!isAdminOrManager}
                  >
                    <SelectTrigger id="calling-tz"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="max-attempts" className="text-xs">Max Call Attempts</Label>
                  <Input
                    id="max-attempts"
                    type="number"
                    min={1}
                    max={20}
                    value={rules.max_call_attempts_default}
                    onChange={e => handleInputChange('max_call_attempts_default', parseInt(e.target.value) || 3)}
                    disabled={!isAdminOrManager}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Toggle rules */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Outreach Rules</CardTitle>
              <CardDescription>These rules apply globally to all campaigns in this workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {TOGGLE_RULES.map(({ key, label, description }) => (
                <div key={key} className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5 flex-1">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  <Switch
                    checked={!!rules[key]}
                    onCheckedChange={() => handleToggle(key)}
                    disabled={!isAdminOrManager}
                  />
                </div>
              ))}
              {!isAdminOrManager && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Only admins and managers can change settings.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════ SCRIPTS TAB ════════ */}
        <TabsContent value="scripts" className="space-y-6 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Outreach Scripts</h2>
              <p className="text-muted-foreground text-xs">Manage scripts by channel. One default per channel.</p>
            </div>
            {isAdmin && (
              <Button size="sm" onClick={openCreate} className="gap-1.5">
                <Plus className="w-4 h-4" /> New Script
              </Button>
            )}
          </div>

          <Tabs value={scriptTab} onValueChange={v => setScriptTab(v as Channel)}>
            <TabsList>
              {CHANNELS.map(ch => (
                <TabsTrigger key={ch} value={ch} className="capitalize">{ch}</TabsTrigger>
              ))}
            </TabsList>

            {CHANNELS.map(ch => (
              <TabsContent key={ch} value={ch}>
                <Card>
                  <CardContent className="p-0">
                    {scriptsLoading ? (
                      <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                    ) : filteredScripts.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground text-sm">No {ch} scripts yet.</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            {ch === 'email' && <TableHead>Subject</TableHead>}
                            <TableHead>Default</TableHead>
                            <TableHead>Created</TableHead>
                            {isAdmin && <TableHead className="w-24">Actions</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredScripts.map(s => (
                            <TableRow key={s.id}>
                              <TableCell className="font-medium">{s.name}</TableCell>
                              {ch === 'email' && <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">{s.subject || '—'}</TableCell>}
                              <TableCell>
                                {s.is_default && <Badge variant="secondary" className="bg-primary/10 text-primary">Default</Badge>}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{format(new Date(s.created_at), 'dd MMM yyyy')}</TableCell>
                              {isAdmin && (
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(s)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>

        {/* ════════ DEFAULTS TAB ════════ */}
        <TabsContent value="defaults" className="space-y-6 mt-4">
          <div>
            <h2 className="text-lg font-semibold">Default Scripts</h2>
            <p className="text-muted-foreground text-xs">Select one default script per channel. New campaigns will use these automatically.</p>
          </div>

          {scriptsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4">
              {CHANNELS.map(channel => {
                const channelScripts = scripts.filter(s => s.channel === channel);
                const currentDefault = channelScripts.find(s => s.is_default);
                return (
                  <Card key={channel}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base capitalize">{channel} Script</CardTitle>
                        {currentDefault && (
                          <Badge variant="secondary" className="bg-primary/10 text-primary gap-1">
                            <Star className="w-3 h-3" /> {currentDefault.name}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {channelScripts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No {channel} scripts created yet. Create one in the Scripts tab.</p>
                      ) : (
                        <Select
                          value={currentDefault?.id ?? ''}
                          onValueChange={v => { if (v) handleSetDefault(v, channel); }}
                          disabled={!isAdminOrManager}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={`Select default ${channel} script`} />
                          </SelectTrigger>
                          <SelectContent>
                            {channelScripts.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {!isAdminOrManager && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Only admins and managers can change default scripts.
                </p>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Script Create/Edit Dialog ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Script' : 'New Script'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Initial outreach" />
            </div>
            <div>
              <Label>Channel</Label>
              <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v as Channel }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map(ch => <SelectItem key={ch} value={ch} className="capitalize">{ch}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.channel === 'email' && (
              <div>
                <Label>Subject</Label>
                <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Email subject line" />
              </div>
            )}
            <div>
              <Label>Body</Label>
              <Textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={8} placeholder="Script body..." />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_default} onCheckedChange={v => setForm(f => ({ ...f, is_default: v }))} />
              <Label>Set as default for this channel</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveScript} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingId ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete script?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.name}". Scripts linked to active campaigns cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
