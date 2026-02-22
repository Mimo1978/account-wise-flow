import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

interface ValidationIssue {
  severity: 'error' | 'warning';
  company: string;
  message: string;
}

export default function AdminOrgChart() {
  const { currentWorkspace } = useWorkspace();
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);

  // RPC tester state
  const [rpcCompanyId, setRpcCompanyId] = useState('');
  const [rpcContactId, setRpcContactId] = useState('');
  const [rpcResult, setRpcResult] = useState<string | null>(null);
  const [rpcLoading, setRpcLoading] = useState(false);

  const runValidation = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setValidating(true);
    setIssues([]);
    const found: ValidationIssue[] = [];

    try {
      // Fetch all companies in workspace
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .eq('team_id', currentWorkspace.id);

      if (!companies?.length) {
        setValidated(true);
        setValidating(false);
        return;
      }

      // Fetch all org chart edges for these companies
      const companyIds = companies.map((c) => c.id);
      const { data: edges } = await supabase
        .from('org_chart_edges')
        .select('id, company_id, child_contact_id, parent_contact_id')
        .in('company_id', companyIds);

      const allEdges = edges ?? [];
      const companyMap = new Map(companies.map((c) => [c.id, c.name]));

      // Fetch all referenced contact ids to check existence
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

      // Validate per company
      for (const companyId of companyIds) {
        const companyName = companyMap.get(companyId) ?? companyId;
        const companyEdges = allEdges.filter((e) => e.company_id === companyId);

        if (companyEdges.length === 0) continue;

        // 1) Check single root
        const roots = companyEdges.filter((e) => e.parent_contact_id === null);
        if (roots.length === 0) {
          found.push({ severity: 'error', company: companyName, message: 'No root node found (all edges have a parent).' });
        } else if (roots.length > 1) {
          found.push({ severity: 'error', company: companyName, message: `Multiple roots found (${roots.length}). Expected exactly one.` });
        }

        // 2) Check for cycles using parent traversal
        const parentMap = new Map<string, string | null>();
        companyEdges.forEach((e) => {
          parentMap.set(e.child_contact_id, e.parent_contact_id);
        });

        for (const contactId of parentMap.keys()) {
          const visited = new Set<string>();
          let current: string | null = contactId;
          let hasCycle = false;
          while (current) {
            if (visited.has(current)) {
              hasCycle = true;
              break;
            }
            visited.add(current);
            current = parentMap.get(current) ?? null;
          }
          if (hasCycle) {
            found.push({ severity: 'error', company: companyName, message: `Cycle detected involving contact ${contactId.slice(0, 8)}…` });
            break; // one cycle report per company is enough
          }
        }

        // 3) Check referenced contacts exist
        companyEdges.forEach((e) => {
          if (!existingContactIds.has(e.child_contact_id)) {
            found.push({ severity: 'warning', company: companyName, message: `Child contact ${e.child_contact_id.slice(0, 8)}… not found or deleted.` });
          }
          if (e.parent_contact_id && !existingContactIds.has(e.parent_contact_id)) {
            found.push({ severity: 'warning', company: companyName, message: `Parent contact ${e.parent_contact_id.slice(0, 8)}… not found or deleted.` });
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
      setRpcResult(data ?? '(null — this is a root node)');
    } catch (err: any) {
      setRpcResult(`Error: ${err.message}`);
    } finally {
      setRpcLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Org Chart Validation</h1>
        <p className="text-muted-foreground text-sm">Read-only structural checks on org chart integrity.</p>
      </div>

      {/* Validation */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Structure Validation</CardTitle>
            <CardDescription>Check for single root, cycles, and missing contacts.</CardDescription>
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
            <div className="space-y-2">
              {issues.map((issue, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 px-3 py-2 rounded-md border border-border"
                >
                  {issue.severity === 'error' ? (
                    <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={issue.severity === 'error' ? 'destructive' : 'secondary'} className="text-[10px]">
                        {issue.severity}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{issue.company}</span>
                    </div>
                    <p className="text-sm mt-0.5">{issue.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* RPC Tester */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parent Lookup (RPC)</CardTitle>
          <CardDescription>Test <code className="text-xs bg-muted px-1 py-0.5 rounded">get_org_parent</code> for a specific contact.</CardDescription>
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
    </div>
  );
}
