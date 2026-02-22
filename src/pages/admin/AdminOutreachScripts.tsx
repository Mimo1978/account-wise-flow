import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/use-permissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

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

const CHANNELS: Channel[] = ['email', 'sms', 'call'];

const EMPTY_FORM = { name: '', channel: 'email' as Channel, subject: '', body: '', is_default: false };

export default function AdminOutreachScripts() {
  const { currentWorkspace } = useWorkspace();
  const { isAdmin, userId } = usePermissions();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Channel>('email');

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Script | null>(null);

  const wid = currentWorkspace?.id;

  const fetchScripts = useCallback(async () => {
    if (!wid) return;
    setLoading(true);
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
    setLoading(false);
  }, [wid]);

  useEffect(() => { fetchScripts(); }, [fetchScripts]);

  const filteredScripts = scripts.filter(s => s.channel === activeTab);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, channel: activeTab });
    setFormOpen(true);
  };

  const openEdit = (s: Script) => {
    setEditingId(s.id);
    setForm({ name: s.name, channel: s.channel, subject: s.subject || '', body: s.body, is_default: s.is_default });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!wid || !isAdmin) return;
    if (!form.name.trim() || !form.body.trim()) {
      toast.error('Name and body are required');
      return;
    }
    setSaving(true);

    try {
      // If setting as default, unset existing default for this channel
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
          .update({
            name: form.name.trim(),
            channel: form.channel,
            subject: form.subject.trim() || null,
            body: form.body.trim(),
            is_default: form.is_default,
          })
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Script updated');
      } else {
        const { error } = await supabase
          .from('outreach_scripts')
          .insert({
            workspace_id: wid,
            name: form.name.trim(),
            channel: form.channel,
            subject: form.subject.trim() || null,
            body: form.body.trim(),
            is_default: form.is_default,
            created_by: userId,
          });
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

    // Check if linked to active campaign
    const { count } = await supabase
      .from('outreach_campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', wid!)
      .neq('status', 'completed')
      .or(`call_script_id.eq.${deleteTarget.id},email_script_id.eq.${deleteTarget.id},sms_script_id.eq.${deleteTarget.id}`);

    if (count && count > 0) {
      toast.error('Cannot delete — script is linked to an active campaign');
      setDeleteTarget(null);
      return;
    }

    const { error } = await supabase
      .from('outreach_scripts')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Script deleted');
      fetchScripts();
    }
    setDeleteTarget(null);
  };

  if (loading) {
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
          <h1 className="text-2xl font-bold tracking-tight">Outreach Scripts</h1>
          <p className="text-muted-foreground text-sm">Manage scripts by channel. One default per channel.</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> New Script
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Channel)}>
        <TabsList>
          {CHANNELS.map(ch => (
            <TabsTrigger key={ch} value={ch} className="capitalize">{ch}</TabsTrigger>
          ))}
        </TabsList>

        {CHANNELS.map(ch => (
          <TabsContent key={ch} value={ch}>
            <Card>
              <CardContent className="p-0">
                {filteredScripts.length === 0 ? (
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

      {/* Create / Edit Dialog */}
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
              <Select value={form.channel} onValueChange={(v) => setForm(f => ({ ...f, channel: v as Channel }))}>
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
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingId ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
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
