import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface AuditEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  changed_by: string | null;
  changed_at: string;
  diff: Record<string, unknown>;
  context: Record<string, unknown>;
  workspace_id: string | null;
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  update: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  delete: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
};

export default function AdminGovernanceAudit() {
  const { currentWorkspace } = useWorkspace();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityTypeFilter, setEntityTypeFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');

  const fetchAudit = async () => {
    setLoading(true);
    let query = supabase
      .from('audit_log')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(200);

    if (currentWorkspace?.id) {
      query = query.eq('workspace_id', currentWorkspace.id);
    }
    if (entityTypeFilter !== 'all') {
      query = query.eq('entity_type', entityTypeFilter);
    }
    if (actionFilter !== 'all') {
      query = query.eq('action', actionFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching audit log:', error);
    } else {
      setEntries((data as AuditEntry[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAudit(); }, [currentWorkspace?.id, entityTypeFilter, actionFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground text-sm">Immutable record of all data changes.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAudit} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Entity type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            <SelectItem value="contacts">Contacts</SelectItem>
            <SelectItem value="companies">Companies</SelectItem>
            <SelectItem value="candidates">Candidates</SelectItem>
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No audit entries found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead>Changed By</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Badge className={ACTION_COLORS[e.action] || ''} variant="secondary">{e.action}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{e.entity_type}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[120px] truncate">{e.entity_id}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[120px] truncate">{e.changed_by || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(e.changed_at), 'dd MMM yyyy HH:mm:ss')}
                    </TableCell>
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
