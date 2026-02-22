import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Trash2,
  GitMerge,
  Crown,
  Clock,
  Check,
  X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/use-permissions';
import { toast } from 'sonner';

/* ─── Types ─── */

interface ValidationIssue {
  severity: 'error' | 'warning';
  company: string;
  companyId: string;
  message: string;
  type: 'multiple_roots' | 'no_root' | 'orphan_child' | 'orphan_parent' | 'cycle' | 'duplicate_child';
  edgeId?: string;
  contactId?: string;
  /** For multiple roots: list of root edge ids */
  rootEdgeIds?: string[];
  rootContactIds?: string[];
}

interface RepairRequest {
  id: string;
  request_type: string;
  status: string;
  reason: string | null;
  requested_at: string;
  requested_by: string;
  decided_at: string | null;
  decided_by: string | null;
  rejection_reason: string | null;
  merge_data: Record<string, unknown> | null;
  company_id: string | null;
  workspace_id: string;
}

/* ─── Component ─── */

export default function AdminOrgChart() {
  const { currentWorkspace } = useWorkspace();
  const { role, isAdmin, userId } = usePermissions();

  // Validation state
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);

  // Repair requests state
  const [requests, setRequests] = useState<RepairRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [submittingRepair, setSubmittingRepair] = useState<string | null>(null);
  const [applyingRequest, setApplyingRequest] = useState<string | null>(null);

  // For "set single root" selection
  const [selectedRoot, setSelectedRoot] = useState<Record<string, string>>({});

  /* ─── Validation Runner ─── */

  const runValidation = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setValidating(true);
    setIssues([]);
    const found: ValidationIssue[] = [];

    try {
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .eq('team_id', currentWorkspace.id);

      if (!companies?.length) {
        setValidated(true);
        setValidating(false);
        return;
      }

      const companyIds = companies.map((c) => c.id);
      const { data: edges } = await supabase
        .from('org_chart_edges')
        .select('id, company_id, child_contact_id, parent_contact_id')
        .in('company_id', companyIds);

      const allEdges = edges ?? [];
      const companyMap = new Map(companies.map((c) => [c.id, c.name]));

      // Check contact existence
      const referencedContactIds = new Set<string>();
      allEdges.forEach((e) => {
        referencedContactIds.add(e.child_contact_id);
        if (e.parent_contact_id) referencedContactIds.add(e.parent_contact_id);
      });

      let existingContactIds = new Set<string>();
      if (referencedContactIds.size > 0) {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id')
          .in('id', Array.from(referencedContactIds))
          .is('deleted_at', null);
        existingContactIds = new Set((contacts ?? []).map((c) => c.id));
      }

      for (const companyId of companyIds) {
        const companyName = companyMap.get(companyId) ?? companyId;
        const companyEdges = allEdges.filter((e) => e.company_id === companyId);
        if (companyEdges.length === 0) continue;

        // 1) Root checks
        const roots = companyEdges.filter((e) => e.parent_contact_id === null);
        if (roots.length === 0) {
          found.push({ severity: 'error', company: companyName, companyId, message: 'No root node found.', type: 'no_root' });
        } else if (roots.length > 1) {
          found.push({
            severity: 'error', company: companyName, companyId,
            message: `Multiple roots found (${roots.length}). Expected exactly one.`,
            type: 'multiple_roots',
            rootEdgeIds: roots.map((r) => r.id),
            rootContactIds: roots.map((r) => r.child_contact_id),
          });
        }

        // 2) Cycle detection
        const parentMap = new Map<string, string | null>();
        companyEdges.forEach((e) => parentMap.set(e.child_contact_id, e.parent_contact_id));

        for (const contactId of parentMap.keys()) {
          const visited = new Set<string>();
          let current: string | null = contactId;
          let hasCycle = false;
          while (current) {
            if (visited.has(current)) { hasCycle = true; break; }
            visited.add(current);
            current = parentMap.get(current) ?? null;
          }
          if (hasCycle) {
            found.push({ severity: 'error', company: companyName, companyId, message: `Cycle detected involving contact ${contactId.slice(0, 8)}…`, type: 'cycle', contactId });
            break;
          }
        }

        // 3) Orphan checks
        companyEdges.forEach((e) => {
          if (!existingContactIds.has(e.child_contact_id)) {
            found.push({
              severity: 'warning', company: companyName, companyId,
              message: `Child contact ${e.child_contact_id.slice(0, 8)}… not found or deleted.`,
              type: 'orphan_child', edgeId: e.id, contactId: e.child_contact_id,
            });
          }
          if (e.parent_contact_id && !existingContactIds.has(e.parent_contact_id)) {
            found.push({
              severity: 'warning', company: companyName, companyId,
              message: `Parent contact ${e.parent_contact_id.slice(0, 8)}… not found or deleted.`,
              type: 'orphan_parent', edgeId: e.id, contactId: e.parent_contact_id,
            });
          }
        });

        // 4) Duplicate child check (should be enforced by unique constraint, but validate)
        const childCounts = new Map<string, number>();
        companyEdges.forEach((e) => childCounts.set(e.child_contact_id, (childCounts.get(e.child_contact_id) ?? 0) + 1));
        childCounts.forEach((count, cid) => {
          if (count > 1) {
            found.push({
              severity: 'error', company: companyName, companyId,
              message: `Contact ${cid.slice(0, 8)}… appears as child ${count} times.`,
              type: 'duplicate_child', contactId: cid,
            });
          }
        });
      }

      setIssues(found);
      setValidated(true);
    } catch (err) {
      console.error('Validation failed:', err);
      toast.error('Validation failed');
    } finally {
      setValidating(false);
    }
  }, [currentWorkspace?.id]);

  /* ─── Repair Request Helpers ─── */

  const loadRequests = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setLoadingRequests(true);
    try {
      const { data, error } = await supabase
        .from('data_change_requests')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('request_type', 'org_chart_repair')
        .order('requested_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setRequests((data as unknown as RepairRequest[]) ?? []);
    } catch (err) {
      console.error('Failed to load repair requests:', err);
      toast.error('Failed to load repair requests');
    } finally {
      setLoadingRequests(false);
    }
  }, [currentWorkspace?.id]);

  const submitRepairRequest = async (
    repairType: string,
    description: string,
    companyId: string,
    repairData: Record<string, unknown>
  ) => {
    if (!currentWorkspace?.id || !userId) return;
    const key = `${repairType}-${JSON.stringify(repairData)}`;
    setSubmittingRepair(key);
    try {
      const { error } = await supabase.from('data_change_requests').insert({
        workspace_id: currentWorkspace.id,
        request_type: 'org_chart_repair',
        requested_by: userId,
        company_id: companyId,
        reason: description,
        merge_data: { repair_action: repairType, ...repairData } as unknown as Record<string, never>,
        duplicate_contact_ids: [],
        status: 'pending',
      });
      if (error) throw error;
      toast.success('Repair request submitted for approval');
      loadRequests();
    } catch (err: any) {
      console.error('Repair request failed:', err);
      toast.error(err.message || 'Failed to submit repair request');
    } finally {
      setSubmittingRepair(null);
    }
  };

  const applyRepair = async (request: RepairRequest) => {
    if (!isAdmin && role !== 'manager') {
      toast.error('Only admins and managers can approve repairs');
      return;
    }
    setApplyingRequest(request.id);
    try {
      const data = request.merge_data as Record<string, unknown> | null;
      const action = data?.repair_action as string;

      if (action === 'remove_orphan_edge') {
        const edgeId = data?.edge_id as string;
        const { error } = await supabase.from('org_chart_edges').delete().eq('id', edgeId);
        if (error) throw error;
      } else if (action === 'set_single_root') {
        const keepEdgeId = data?.keep_edge_id as string;
        const removeEdgeIds = data?.remove_edge_ids as string[];
        if (removeEdgeIds?.length) {
          const { error } = await supabase.from('org_chart_edges').delete().in('id', removeEdgeIds);
          if (error) throw error;
        }
        // The kept root edge is already correct (parent_contact_id IS NULL)
        void keepEdgeId;
      } else {
        toast.error(`Unknown repair action: ${action}`);
        setApplyingRequest(null);
        return;
      }

      // Mark request as approved
      const { error: updateError } = await supabase
        .from('data_change_requests')
        .update({ status: 'approved', decided_by: userId, decided_at: new Date().toISOString(), applied_at: new Date().toISOString() })
        .eq('id', request.id);
      if (updateError) throw updateError;

      toast.success('Repair applied successfully');
      loadRequests();
    } catch (err: any) {
      console.error('Apply repair failed:', err);
      toast.error(err.message || 'Failed to apply repair');
    } finally {
      setApplyingRequest(null);
    }
  };

  const rejectRequest = async (requestId: string) => {
    setApplyingRequest(requestId);
    try {
      const { error } = await supabase
        .from('data_change_requests')
        .update({ status: 'rejected', decided_by: userId, decided_at: new Date().toISOString(), rejection_reason: 'Rejected by admin' })
        .eq('id', requestId);
      if (error) throw error;
      toast.success('Request rejected');
      loadRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject request');
    } finally {
      setApplyingRequest(null);
    }
  };

  /* ─── Repair Action Handlers ─── */

  const handleRemoveOrphan = (issue: ValidationIssue) => {
    if (!issue.edgeId) return;
    if (isAdmin) {
      // Admin can submit + auto-approve, but we still go through governance
      submitRepairRequest(
        'remove_orphan_edge',
        `Remove orphan edge referencing missing contact ${issue.contactId?.slice(0, 8)}… in ${issue.company}`,
        issue.companyId,
        { edge_id: issue.edgeId, contact_id: issue.contactId }
      );
    } else {
      submitRepairRequest(
        'remove_orphan_edge',
        `Request to remove orphan edge referencing missing contact ${issue.contactId?.slice(0, 8)}… in ${issue.company}`,
        issue.companyId,
        { edge_id: issue.edgeId, contact_id: issue.contactId }
      );
    }
  };

  const handleSetRoot = (issue: ValidationIssue) => {
    if (!issue.rootEdgeIds || !issue.rootContactIds) return;
    const issueKey = `${issue.companyId}-roots`;
    const chosen = selectedRoot[issueKey];
    if (!chosen) {
      toast.error('Select which contact should be the root');
      return;
    }
    const keepIdx = issue.rootContactIds.indexOf(chosen);
    if (keepIdx === -1) return;
    const keepEdgeId = issue.rootEdgeIds[keepIdx];
    const removeEdgeIds = issue.rootEdgeIds.filter((_, i) => i !== keepIdx);

    submitRepairRequest(
      'set_single_root',
      `Set ${chosen.slice(0, 8)}… as single root for ${issue.company}, removing ${removeEdgeIds.length} extra root(s)`,
      issue.companyId,
      { keep_edge_id: keepEdgeId, remove_edge_ids: removeEdgeIds, keep_contact_id: chosen }
    );
  };

  const canRepair = role === 'admin' || role === 'manager' || role === 'contributor';
  const canApprove = role === 'admin' || role === 'manager';

  /* ─── Render ─── */

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Org Chart Integrity</h1>
        <p className="text-muted-foreground text-sm">Validate structure and submit governed repair requests.</p>
      </div>

      <Tabs defaultValue="validation" onValueChange={(v) => { if (v === 'requests') loadRequests(); }}>
        <TabsList>
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="requests">Repair Requests</TabsTrigger>
        </TabsList>

        {/* ─── Validation Tab ─── */}
        <TabsContent value="validation" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Structure Validation</CardTitle>
                <CardDescription>Check for single root, cycles, orphan edges, and duplicate children.</CardDescription>
              </div>
              <Button onClick={runValidation} disabled={validating} size="sm" className="gap-1.5">
                {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Run Validation
              </Button>
            </CardHeader>
            <CardContent>
              {!validated && !validating && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Click "Run Validation" to check all company org charts.
                </p>
              )}
              {validating && (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {validated && !validating && issues.length === 0 && (
                <div className="flex items-center gap-2 justify-center py-6 text-sm text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                  All org charts are structurally valid.
                </div>
              )}
              {validated && !validating && issues.length > 0 && (
                <div className="space-y-3">
                  {issues.map((issue, idx) => {
                    const issueKey = `${issue.companyId}-roots`;
                    return (
                      <div key={idx} className="flex items-start gap-2 px-3 py-2.5 rounded-md border border-border">
                        {issue.severity === 'error' ? (
                          <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={issue.severity === 'error' ? 'destructive' : 'secondary'} className="text-[10px]">
                              {issue.severity}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{issue.company}</span>
                          </div>
                          <p className="text-sm mt-0.5">{issue.message}</p>

                          {/* Repair actions */}
                          {canRepair && (issue.type === 'orphan_child' || issue.type === 'orphan_parent') && issue.edgeId && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2 gap-1.5 text-xs"
                              disabled={submittingRepair !== null}
                              onClick={() => handleRemoveOrphan(issue)}
                            >
                              <Trash2 className="w-3 h-3" />
                              {isAdmin ? 'Submit Remove Orphan' : 'Request Remove Orphan'}
                            </Button>
                          )}

                          {canRepair && issue.type === 'multiple_roots' && issue.rootContactIds && (
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              <Select
                                value={selectedRoot[issueKey] ?? ''}
                                onValueChange={(v) => setSelectedRoot((prev) => ({ ...prev, [issueKey]: v }))}
                              >
                                <SelectTrigger className="w-48 h-8 text-xs">
                                  <SelectValue placeholder="Choose root…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {issue.rootContactIds.map((cid) => (
                                    <SelectItem key={cid} value={cid} className="text-xs font-mono">
                                      {cid.slice(0, 12)}…
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 text-xs"
                                disabled={!selectedRoot[issueKey] || submittingRepair !== null}
                                onClick={() => handleSetRoot(issue)}
                              >
                                <Crown className="w-3 h-3" />
                                {isAdmin ? 'Submit Set Root' : 'Request Set Root'}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Repair Requests Tab ─── */}
        <TabsContent value="requests" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Repair Requests</CardTitle>
                <CardDescription>Governed repair actions requiring manager/admin approval.</CardDescription>
              </div>
              <Button onClick={loadRequests} disabled={loadingRequests} size="sm" variant="outline" className="gap-1.5">
                {loadingRequests ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {loadingRequests && (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {!loadingRequests && requests.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No repair requests found.</p>
              )}
              {!loadingRequests && requests.length > 0 && (
                <div className="space-y-3">
                  {requests.map((req) => {
                    const repairData = req.merge_data as Record<string, unknown> | null;
                    const action = repairData?.repair_action as string ?? 'unknown';
                    const isPending = req.status === 'pending';
                    return (
                      <div key={req.id} className="px-3 py-2.5 rounded-md border border-border space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={req.status === 'approved' ? 'default' : req.status === 'rejected' ? 'destructive' : 'secondary'}
                            className="text-[10px]"
                          >
                            {req.status}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] font-mono">{action}</Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(req.requested_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm">{req.reason}</p>

                        {isPending && canApprove && (
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              className="gap-1 text-xs h-7"
                              disabled={applyingRequest === req.id}
                              onClick={() => applyRepair(req)}
                            >
                              {applyingRequest === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              Approve & Apply
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs h-7"
                              disabled={applyingRequest === req.id}
                              onClick={() => rejectRequest(req.id)}
                            >
                              <X className="w-3 h-3" />
                              Reject
                            </Button>
                          </div>
                        )}

                        {isPending && !canApprove && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                            <Clock className="w-3 h-3" />
                            Awaiting manager/admin approval
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
