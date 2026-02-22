import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/use-permissions';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

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
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  applied: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
};

export default function AdminGovernanceRequests() {
  const { currentWorkspace } = useWorkspace();
  const { isAdmin, isManager } = usePermissions();
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const canDecide = isAdmin || isManager;

  const fetchRequests = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('data_change_requests')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('requested_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching requests:', error);
    } else {
      setRequests((data as ChangeRequest[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, [currentWorkspace?.id]);

  const handleDecision = async (id: string, decision: 'approved' | 'rejected') => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('data_change_requests')
      .update({
        status: decision,
        decided_by: user?.id ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update request: ' + error.message);
    } else {
      toast.success(`Request ${decision}`);
      fetchRequests();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Governance Requests</h1>
        <p className="text-muted-foreground text-sm">Review and manage data change requests.</p>
      </div>

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
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Requested</TableHead>
                  {canDecide && <TableHead className="w-28">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-sm">{r.request_type}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[r.status] || ''} variant="secondary">{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {r.reason || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(r.requested_at), 'dd MMM yyyy HH:mm')}
                    </TableCell>
                    {canDecide && (
                      <TableCell>
                        {r.status === 'pending' ? (
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDecision(r.id, 'approved')}>
                              <Check className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDecision(r.id, 'rejected')}>
                              <X className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Decided</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
