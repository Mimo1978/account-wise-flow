import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  XCircle,
  Copy,
  RefreshCw,
  Search,
  Download,
  Wrench,
  Activity,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/* ─── Types ─── */

interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'pending';
  detail: string;
  latencyMs?: number;
}

interface CampaignOption {
  id: string;
  name: string;
  target_count: number;
  contacted_count: number;
  response_count: number;
}

/* ─── Component ─── */

export default function AdminSupport() {
  const { currentWorkspace } = useWorkspace();
  const { role, isAdmin, isManager } = usePermissions();
  const { user } = useAuth();

  // Diagnostics
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [running, setRunning] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  // RPC tester
  const [rpcCompanyId, setRpcCompanyId] = useState('');
  const [rpcContactId, setRpcContactId] = useState('');
  const [rpcResult, setRpcResult] = useState<string | null>(null);
  const [rpcLoading, setRpcLoading] = useState(false);

  // Campaign fix
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [campaignsLoaded, setCampaignsLoaded] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [fixingCampaign, setFixingCampaign] = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);

  const canFix = isAdmin || isManager;

  /* ─── Quick Diagnostics ─── */

  const runChecks = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setRunning(true);
    const results: HealthCheck[] = [];
    const tableCounts: Record<string, number> = {};

    // 1) DB connectivity — contacts
    const t1 = performance.now();
    try {
      const { count, error } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', currentWorkspace.id)
        .is('deleted_at', null);
      if (error) throw error;
      tableCounts.contacts = count ?? 0;
      results.push({ name: 'DB: contacts', status: 'pass', detail: `${count ?? 0} rows`, latencyMs: Math.round(performance.now() - t1) });
    } catch (err: any) {
      results.push({ name: 'DB: contacts', status: 'fail', detail: err.message, latencyMs: Math.round(performance.now() - t1) });
    }

    // 2) DB connectivity — companies
    const t2 = performance.now();
    try {
      const { count, error } = await supabase
        .from('companies')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', currentWorkspace.id);
      if (error) throw error;
      tableCounts.companies = count ?? 0;
      results.push({ name: 'DB: companies', status: 'pass', detail: `${count ?? 0} rows`, latencyMs: Math.round(performance.now() - t2) });
    } catch (err: any) {
      results.push({ name: 'DB: companies', status: 'fail', detail: err.message, latencyMs: Math.round(performance.now() - t2) });
    }

    // 3) DB connectivity — candidates
    const t3 = performance.now();
    try {
      const { count, error } = await supabase
        .from('candidates')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', currentWorkspace.id);
      if (error) throw error;
      tableCounts.candidates = count ?? 0;
      results.push({ name: 'DB: candidates', status: 'pass', detail: `${count ?? 0} rows`, latencyMs: Math.round(performance.now() - t3) });
    } catch (err: any) {
      results.push({ name: 'DB: candidates', status: 'fail', detail: err.message, latencyMs: Math.round(performance.now() - t3) });
    }

    // 4) RLS check — outreach_targets
    const t4 = performance.now();
    try {
      const { count, error } = await supabase
        .from('outreach_targets')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id);
      if (error) throw error;
      tableCounts.outreach_targets = count ?? 0;
      results.push({ name: 'RLS: outreach_targets', status: 'pass', detail: `${count ?? 0} rows visible`, latencyMs: Math.round(performance.now() - t4) });
    } catch (err: any) {
      results.push({ name: 'RLS: outreach_targets', status: 'fail', detail: err.message, latencyMs: Math.round(performance.now() - t4) });
    }

    // 5) RLS check — outreach_events
    const t5 = performance.now();
    try {
      const { error } = await supabase
        .from('outreach_events')
        .select('id')
        .eq('workspace_id', currentWorkspace.id)
        .limit(1);
      if (error) throw error;
      results.push({ name: 'RLS: outreach_events', status: 'pass', detail: 'Read access OK', latencyMs: Math.round(performance.now() - t5) });
    } catch (err: any) {
      results.push({ name: 'RLS: outreach_events', status: 'fail', detail: err.message, latencyMs: Math.round(performance.now() - t5) });
    }

    // 6) RLS check — data_change_requests
    const t6 = performance.now();
    try {
      const { error } = await supabase
        .from('data_change_requests')
        .select('id')
        .eq('workspace_id', currentWorkspace.id)
        .limit(1);
      if (error) throw error;
      results.push({ name: 'RLS: data_change_requests', status: 'pass', detail: 'Read access OK', latencyMs: Math.round(performance.now() - t6) });
    } catch (err: any) {
      results.push({ name: 'RLS: data_change_requests', status: 'fail', detail: err.message, latencyMs: Math.round(performance.now() - t6) });
    }

    // 7) Campaigns count
    try {
      const { count } = await supabase
        .from('outreach_campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id);
      tableCounts.outreach_campaigns = count ?? 0;
    } catch { /* ignore */ }

    // 8) Session info
    results.push({
      name: 'Session',
      status: 'pass',
      detail: `Workspace: ${currentWorkspace.id.slice(0, 8)}… | Role: ${role ?? 'unknown'}`,
    });

    setCounts(tableCounts);
    setChecks(results);
    setRunning(false);
  }, [currentWorkspace?.id, role]);

  /* ─── RPC Tester ─── */

  const testRpc = async () => {
    if (!rpcCompanyId.trim() || !rpcContactId.trim()) {
      toast.error('Both company ID and contact ID are required');
      return;
    }
    setRpcLoading(true);
    setRpcResult(null);
    try {
      const { data, error } = await supabase.rpc('get_org_parent', {
        p_company_id: rpcCompanyId.trim(),
        p_contact_id: rpcContactId.trim(),
      });
      if (error) throw error;
      setRpcResult(data ?? '(null — root node)');
    } catch (err: any) {
      setRpcResult(`Error: ${err.message}`);
    } finally {
      setRpcLoading(false);
    }
  };

  /* ─── Campaign Counter Fix ─── */

  const loadCampaigns = async () => {
    if (!currentWorkspace?.id) return;
    try {
      const { data, error } = await supabase
        .from('outreach_campaigns')
        .select('id, name, target_count, contacted_count, response_count')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCampaigns(data ?? []);
      setCampaignsLoaded(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load campaigns');
    }
  };

  const recalcCampaign = async () => {
    if (!selectedCampaign || !currentWorkspace?.id) return;
    setFixingCampaign(true);
    try {
      // Count targets
      const { count: targetCount, error: e1 } = await supabase
        .from('outreach_targets')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', selectedCampaign)
        .eq('workspace_id', currentWorkspace.id);
      if (e1) throw e1;

      // Count contacted (state not in queued/snoozed)
      const { count: contactedCount, error: e2 } = await supabase
        .from('outreach_targets')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', selectedCampaign)
        .eq('workspace_id', currentWorkspace.id)
        .not('state', 'in', '("queued","snoozed")');
      if (e2) throw e2;

      // Count responded (state in responded/converted)
      const { count: responseCount, error: e3 } = await supabase
        .from('outreach_targets')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', selectedCampaign)
        .eq('workspace_id', currentWorkspace.id)
        .in('state', ['responded', 'converted']);
      if (e3) throw e3;

      // Update campaign
      const { error: updateErr } = await supabase
        .from('outreach_campaigns')
        .update({
          target_count: targetCount ?? 0,
          contacted_count: contactedCount ?? 0,
          response_count: responseCount ?? 0,
        })
        .eq('id', selectedCampaign)
        .eq('workspace_id', currentWorkspace.id);
      if (updateErr) throw updateErr;

      toast.success(`Counters recalculated: ${targetCount} targets, ${contactedCount} contacted, ${responseCount} responded`);

      // Refresh campaign list
      loadCampaigns();
    } catch (err: any) {
      toast.error(err.message || 'Failed to recalculate');
    } finally {
      setFixingCampaign(false);
    }
  };

  /* ─── Export Bundle ─── */

  const exportBundle = async () => {
    if (!currentWorkspace?.id) return;
    setExporting(true);
    try {
      // Gather workspace data
      const [
        { data: teamData },
        { data: rolesData },
        { data: settingsData },
        { data: brandingData },
      ] = await Promise.all([
        supabase.from('teams').select('*').eq('id', currentWorkspace.id).single(),
        supabase.from('user_roles').select('id, user_id, role, team_id, created_at').eq('team_id', currentWorkspace.id),
        supabase.from('workspace_settings').select('*').eq('workspace_id', currentWorkspace.id),
        supabase.from('workspace_branding').select('*').eq('workspace_id', currentWorkspace.id),
      ]);

      // Gather counts
      const countResults: Record<string, number> = {};
      const countFetchers = [
        supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('team_id', currentWorkspace.id).is('deleted_at', null),
        supabase.from('companies').select('id', { count: 'exact', head: true }).eq('team_id', currentWorkspace.id),
        supabase.from('candidates').select('id', { count: 'exact', head: true }).eq('tenant_id', currentWorkspace.id),
        supabase.from('outreach_campaigns').select('id', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id),
        supabase.from('outreach_targets').select('id', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id),
      ];
      const countNames = ['contacts', 'companies', 'candidates', 'outreach_campaigns', 'outreach_targets'];
      const countResponses = await Promise.all(countFetchers);
      countResponses.forEach((r, i) => { countResults[countNames[i]] = r.count ?? 0; });

      const bundle = {
        exported_at: new Date().toISOString(),
        exported_by: user?.id ?? null,
        workspace: teamData ?? null,
        roles: rolesData ?? [],
        settings: settingsData ?? [],
        branding: brandingData ?? [],
        record_counts: countResults,
      };

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workspace-snapshot-${currentWorkspace.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Workspace snapshot exported');
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  /* ─── Render ─── */

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Support & Diagnostics</h1>
        <p className="text-muted-foreground text-sm">System health, common fixes, and data export tools.</p>
      </div>

      <Tabs defaultValue="diagnostics">
        <TabsList>
          <TabsTrigger value="diagnostics" className="gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            Diagnostics
          </TabsTrigger>
          <TabsTrigger value="fixes" className="gap-1.5">
            <Wrench className="w-3.5 h-3.5" />
            Common Fixes
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Export
          </TabsTrigger>
        </TabsList>

        {/* ─── Diagnostics Tab ─── */}
        <TabsContent value="diagnostics" className="space-y-4 mt-4">
          {/* Session Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Current Session</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Workspace ID</p>
                  <p className="font-mono text-xs mt-0.5">{currentWorkspace?.id ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Workspace Name</p>
                  <p className="mt-0.5">{currentWorkspace?.name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">User ID</p>
                  <p className="font-mono text-xs mt-0.5">{user?.id ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Role</p>
                  <Badge variant="outline" className="mt-0.5">{role ?? 'unknown'}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Health Checks */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">DB & RLS Checks</CardTitle>
                <CardDescription>Verify database connectivity and row-level security access.</CardDescription>
              </div>
              <Button onClick={runChecks} disabled={running} size="sm" className="gap-1.5">
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Run Checks
              </Button>
            </CardHeader>
            <CardContent>
              {checks.length === 0 && !running && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Click "Run Checks" to verify system health.
                </p>
              )}
              {running && (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {checks.length > 0 && !running && (
                <div className="space-y-1.5">
                  {checks.map((check, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-md border border-border">
                      <div className="flex items-center gap-2">
                        {check.status === 'pass' ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive shrink-0" />
                        )}
                        <span className="text-sm font-medium">{check.name}</span>
                        {check.latencyMs !== undefined && (
                          <span className="text-[10px] text-muted-foreground">{check.latencyMs}ms</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground max-w-[50%] text-right truncate">{check.detail}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Record Counts */}
              {Object.keys(counts).length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Record Counts</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(counts).map(([table, count]) => (
                      <div key={table} className="px-3 py-1.5 rounded-md border border-border">
                        <p className="text-[10px] text-muted-foreground">{table}</p>
                        <p className="text-sm font-semibold">{count.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* RPC Tester */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">RPC: get_org_parent</CardTitle>
              <CardDescription>Test parent lookup for a specific contact in a company.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Company ID</label>
                  <Input
                    placeholder="uuid"
                    value={rpcCompanyId}
                    onChange={(e) => setRpcCompanyId(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Contact ID</label>
                  <Input
                    placeholder="uuid"
                    value={rpcContactId}
                    onChange={(e) => setRpcContactId(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <Button onClick={testRpc} disabled={rpcLoading} size="sm" variant="outline" className="gap-1.5">
                {rpcLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Lookup Parent
              </Button>
              {rpcResult !== null && (
                <div className="p-3 rounded-md bg-muted border border-border">
                  <p className="text-xs text-muted-foreground">parent_contact_id:</p>
                  <p className="text-sm font-mono mt-1">{rpcResult}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Common Fixes Tab ─── */}
        <TabsContent value="fixes" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recalculate Campaign Counters</CardTitle>
              <CardDescription>
                Re-aggregate target_count, contacted_count, and response_count from actual outreach_targets data.
                {!canFix && <span className="block mt-1 text-destructive text-xs">Requires manager or admin role.</span>}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!campaignsLoaded && (
                <Button onClick={loadCampaigns} size="sm" variant="outline" className="gap-1.5" disabled={!canFix}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Load Campaigns
                </Button>
              )}

              {campaignsLoaded && campaigns.length === 0 && (
                <p className="text-sm text-muted-foreground">No campaigns found in this workspace.</p>
              )}

              {campaignsLoaded && campaigns.length > 0 && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Select Campaign</label>
                    <Select value={selectedCampaign} onValueChange={setSelectedCampaign} disabled={!canFix}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose a campaign…" />
                      </SelectTrigger>
                      <SelectContent>
                        {campaigns.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <div className="flex items-center gap-2">
                              <span>{c.name}</span>
                              <span className="text-[10px] text-muted-foreground">
                                T:{c.target_count} C:{c.contacted_count} R:{c.response_count}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={recalcCampaign}
                    disabled={!selectedCampaign || fixingCampaign || !canFix}
                    size="sm"
                    className="gap-1.5"
                  >
                    {fixingCampaign ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                    Recalculate Counters
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Export Tab ─── */}
        <TabsContent value="export" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workspace Snapshot</CardTitle>
              <CardDescription>
                Export a JSON bundle containing workspace config, roles, settings, branding, and record counts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>The export includes:</p>
                <ul className="list-disc list-inside text-xs space-y-0.5">
                  <li>Workspace metadata (name, mode, type)</li>
                  <li>User roles assigned to this workspace</li>
                  <li>Workspace settings (settings_json)</li>
                  <li>Branding configuration</li>
                  <li>Record counts (contacts, companies, candidates, campaigns, targets)</li>
                </ul>
              </div>
              <div className="flex gap-2">
                <Button onClick={exportBundle} disabled={exporting} size="sm" className="gap-1.5">
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Download JSON Snapshot
                </Button>
                <Button
                  onClick={() => {
                    const snapshot = {
                      timestamp: new Date().toISOString(),
                      workspace_id: currentWorkspace?.id,
                      workspace_name: currentWorkspace?.name,
                      user_id: user?.id,
                      user_role: role,
                      table_counts: counts,
                      health_checks: checks.map((c) => ({ name: c.name, status: c.status, detail: c.detail })),
                    };
                    navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
                    toast.success('Quick snapshot copied to clipboard');
                  }}
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy to Clipboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
