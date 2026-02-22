import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/use-permissions';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Check, X, AlertCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChangeRequest {
  id: string;
  request_type: string;
  status: string;
  reason: string | null;
  requested_by: string;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  rejection_reason: string | null;
  canonical_contact_id: string | null;
  duplicate_contact_ids: string[];
  company_id: string | null;
  workspace_id: string;
  merge_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  applied_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  applied: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
};

const TYPE_LABELS: Record<string, string> = {
  merge: 'Merge Contacts',
  retire: 'Retire Contacts',
  hard_delete: 'Hard Delete',
};

export default function AdminGovernanceRequests() {
  const { currentWorkspace } = useWorkspace();
  const { isAdmin, isManager, userId } = usePermissions();
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ChangeRequest | null>(null);
  const [processing, setProcessing] = useState(false);

  // Reject dialog state
  const [rejectTarget, setRejectTarget] = useState<ChangeRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Approve confirmation state
  const [approveTarget, setApproveTarget] = useState<ChangeRequest | null>(null);

  const canDecide = isAdmin || isManager;

  const fetchRequests = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('data_change_requests')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('requested_at', { ascending: false })
      .limit(200);

    if (err) {
      setError(err.message);
    } else {
      setRequests((data as ChangeRequest[]) || []);
    }
    setLoading(false);
  }, [currentWorkspace?.id]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // ── Execute the underlying action ──

  const executeRetire = async (req: ChangeRequest) => {
    const dupIds = req.duplicate_contact_ids;
    const canonicalId = req.canonical_contact_id;

    for (const dupId of dupIds) {
      const { data: edge } = await supabase
        .from('org_chart_edges')
        .select('parent_contact_id')
        .eq('child_contact_id', dupId)
        .maybeSingle();
      const newParent = edge?.parent_contact_id || null;
      await supabase.from('org_chart_edges').update({ parent_contact_id: newParent }).eq('parent_contact_id', dupId);
      await supabase.from('org_chart_edges').delete().eq('child_contact_id', dupId);
    }

    const { error } = await supabase
      .from('contacts')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', dupIds);
    if (error) throw error;

    return { retired_ids: dupIds, canonical_id: canonicalId };
  };

  const executeMerge = async (req: ChangeRequest) => {
    const dupIds = req.duplicate_contact_ids;
    const canonicalId = req.canonical_contact_id;
    if (!canonicalId) throw new Error('No canonical contact specified');

    // Apply merge_data patch to canonical if present
    const patch = req.merge_data || {};
    if (Object.keys(patch).length > 0) {
      const { error: patchErr } = await supabase
        .from('contacts')
        .update(patch as any)
        .eq('id', canonicalId);
      if (patchErr) throw patchErr;
    }

    // Re-parent org chart and soft-delete duplicates (same as retire)
    for (const dupId of dupIds) {
      const { data: edge } = await supabase
        .from('org_chart_edges')
        .select('parent_contact_id')
        .eq('child_contact_id', dupId)
        .maybeSingle();
      const newParent = edge?.parent_contact_id || canonicalId;
      await supabase.from('org_chart_edges').update({ parent_contact_id: newParent }).eq('parent_contact_id', dupId);
      await supabase.from('org_chart_edges').delete().eq('child_contact_id', dupId);
    }

    const { error } = await supabase
      .from('contacts')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', dupIds);
    if (error) throw error;

    return { merged_from_ids: dupIds, canonical_id: canonicalId, fields_applied: patch };
  };

  const executeHardDelete = async (req: ChangeRequest) => {
    const dupIds = req.duplicate_contact_ids;
    const canonicalId = req.canonical_contact_id;

    for (const dupId of dupIds) {
      await supabase.from('org_chart_edges').update({ parent_contact_id: canonicalId }).eq('parent_contact_id', dupId);
      await supabase.from('org_chart_edges').delete().eq('child_contact_id', dupId);
    }

    const { error } = await supabase.from('contacts').delete().in('id', dupIds);
    if (error) throw error;

    return { deleted_ids: dupIds, canonical_id: canonicalId };
  };

  // ── Approve ──

  const handleApprove = async (req: ChangeRequest) => {
    // Double-approval guard
    if (req.status !== 'pending') {
      toast.error('This request has already been decided.');
      return;
    }

    setProcessing(true);
    try {
      // Re-fetch to prevent race condition (double approval)
      const { data: fresh } = await supabase
        .from('data_change_requests')
        .select('status')
        .eq('id', req.id)
        .single();

      if (fresh?.status !== 'pending') {
        toast.error('This request was already decided by another user.');
        fetchRequests();
        setApproveTarget(null);
        setProcessing(false);
        return;
      }

      // Execute the action
      let diffPayload: Record<string, unknown> = {};
      if (req.request_type === 'merge') {
        diffPayload = await executeMerge(req);
      } else if (req.request_type === 'retire') {
        diffPayload = await executeRetire(req);
      } else if (req.request_type === 'hard_delete') {
        if (!isAdmin) {
          toast.error('Only admins can approve hard deletes.');
          setProcessing(false);
          setApproveTarget(null);
          return;
        }
        diffPayload = await executeHardDelete(req);
      }

      // Mark request as approved + applied
      const now = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from('data_change_requests')
        .update({
          status: 'approved',
          decided_by: userId,
          decided_at: now,
          applied_at: now,
        })
        .eq('id', req.id);

      if (updateErr) throw updateErr;

      toast.success(`Request approved and ${req.request_type} executed.`);
      setApproveTarget(null);
      setSelected(null);
      fetchRequests();
    } catch (err: any) {
      console.error('[Governance] Approve failed:', err);
      toast.error('Approval failed: ' + (err.message || 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  // ── Reject ──

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (rejectTarget.status !== 'pending') {
      toast.error('This request has already been decided.');
      setRejectTarget(null);
      return;
    }

    setProcessing(true);
    try {
      const { error: updateErr } = await supabase
        .from('data_change_requests')
        .update({
          status: 'rejected',
          decided_by: userId,
          decided_at: new Date().toISOString(),
          rejection_reason: rejectReason.trim() || null,
        })
        .eq('id', rejectTarget.id);

      if (updateErr) throw updateErr;

      toast.success('Request rejected.');
      setRejectTarget(null);
      setRejectReason('');
      setSelected(null);
      fetchRequests();
    } catch (err: any) {
      toast.error('Rejection failed: ' + (err.message || 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Governance Requests</h1>
        <p className="text-muted-foreground text-sm">Review and manage data change requests.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No requests found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                    <TableCell className="font-mono text-xs">{r.id.slice(0, 8)}…</TableCell>
                    <TableCell className="text-sm font-medium">{TYPE_LABELS[r.request_type] || r.request_type}</TableCell>
                    <TableCell className="font-mono text-xs">{r.requested_by.slice(0, 8)}…</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[r.status] || ''} variant="secondary">{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(r.requested_at), 'dd MMM yyyy HH:mm')}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {r.status === 'pending' && canDecide ? (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Approve" onClick={() => setApproveTarget(r)}>
                            <Check className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Reject" onClick={() => { setRejectTarget(r); setRejectReason(''); }}>
                            <X className="w-4 h-4 text-destructive" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="View details" onClick={() => setSelected(r)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="View details" onClick={() => setSelected(r)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
          <SheetHeader className="px-6 py-5 border-b border-border bg-card shrink-0">
            <SheetTitle>Request Detail</SheetTitle>
          </SheetHeader>
          {selected && (
            <ScrollArea className="flex-1 px-6 py-4">
              <div className="space-y-4">
                <DetailRow label="ID" value={selected.id} mono />
                <DetailRow label="Type" value={TYPE_LABELS[selected.request_type] || selected.request_type} />
                <DetailRow label="Status">
                  <Badge className={STATUS_COLORS[selected.status] || ''} variant="secondary">{selected.status}</Badge>
                </DetailRow>
                <DetailRow label="Requested By" value={selected.requested_by} mono />
                <DetailRow label="Requested At" value={format(new Date(selected.requested_at), 'dd MMM yyyy HH:mm:ss')} />
                <DetailRow label="Reason" value={selected.reason || '—'} />

                {selected.canonical_contact_id && (
                  <DetailRow label="Canonical Contact" value={selected.canonical_contact_id} mono />
                )}
                {selected.duplicate_contact_ids?.length > 0 && (
                  <DetailRow label="Duplicate Contacts">
                    <div className="space-y-1">
                      {selected.duplicate_contact_ids.map((id) => (
                        <code key={id} className="block text-xs bg-muted px-2 py-1 rounded">{id}</code>
                      ))}
                    </div>
                  </DetailRow>
                )}
                {selected.company_id && (
                  <DetailRow label="Company ID" value={selected.company_id} mono />
                )}

                {selected.merge_data && Object.keys(selected.merge_data).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Merge Data (Payload Diff)</p>
                    <pre className="text-xs bg-muted rounded p-3 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(selected.merge_data, null, 2)}
                    </pre>
                  </div>
                )}

                {selected.decided_by && (
                  <>
                    <DetailRow label="Decided By" value={selected.decided_by} mono />
                    <DetailRow label="Decided At" value={selected.decided_at ? format(new Date(selected.decided_at), 'dd MMM yyyy HH:mm:ss') : '—'} />
                  </>
                )}
                {selected.rejection_reason && (
                  <DetailRow label="Rejection Reason" value={selected.rejection_reason} />
                )}
                {selected.applied_at && (
                  <DetailRow label="Applied At" value={format(new Date(selected.applied_at), 'dd MMM yyyy HH:mm:ss')} />
                )}

                {/* Actions in drawer */}
                {selected.status === 'pending' && canDecide && (
                  <div className="flex gap-2 pt-4 border-t border-border">
                    <Button size="sm" onClick={() => setApproveTarget(selected)} disabled={processing}>
                      <Check className="w-4 h-4 mr-1" /> Approve & Execute
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => { setRejectTarget(selected); setRejectReason(''); }} disabled={processing}>
                      <X className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>

      {/* Approve Confirmation */}
      <AlertDialog open={!!approveTarget} onOpenChange={(open) => !open && setApproveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve & Execute Request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will execute the <strong>{approveTarget ? (TYPE_LABELS[approveTarget.request_type] || approveTarget.request_type) : ''}</strong> action
              on {approveTarget?.duplicate_contact_ids?.length || 0} contact(s). This cannot be undone for hard deletes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={processing}
              onClick={() => approveTarget && handleApprove(approveTarget)}
            >
              {processing && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Approve & Execute
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Request</AlertDialogTitle>
            <AlertDialogDescription>
              Provide an optional reason for rejecting this {rejectTarget ? (TYPE_LABELS[rejectTarget.request_type] || rejectTarget.request_type) : ''} request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="reject-reason">Reason (optional)</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Why is this request being rejected?"
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={processing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleReject}
            >
              {processing && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DetailRow({ label, value, mono, children }: { label: string; value?: string; mono?: boolean; children?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-0.5">{label}</p>
      {children || (
        <p className={`text-sm ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
      )}
    </div>
  );
}