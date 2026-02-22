import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Loader2, RefreshCw, Download, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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

const PAGE_SIZE = 25;

export default function AdminGovernanceAudit() {
  const { currentWorkspace } = useWorkspace();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);

  // Filters
  const [entityTypeFilter, setEntityTypeFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [performedByFilter, setPerformedByFilter] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const fetchAudit = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);

    let query = supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .eq('workspace_id', currentWorkspace.id)
      .order('changed_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (entityTypeFilter !== 'all') query = query.eq('entity_type', entityTypeFilter);
    if (actionFilter !== 'all') query = query.eq('action', actionFilter);
    if (performedByFilter.trim()) query = query.eq('changed_by', performedByFilter.trim());
    if (dateFrom) query = query.gte('changed_at', dateFrom.toISOString());
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      query = query.lte('changed_at', end.toISOString());
    }

    const { data, error, count } = await query;
    if (error) {
      console.error('Error fetching audit log:', error);
    } else {
      setEntries((data as AuditEntry[]) || []);
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAudit(); }, [currentWorkspace?.id, entityTypeFilter, actionFilter, performedByFilter, dateFrom, dateTo, page]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [entityTypeFilter, actionFilter, performedByFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(0, page - 2);
    const end = Math.min(totalPages - 1, page + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground text-sm">Immutable record of all data changes. {totalCount} entries.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportJSON} disabled={entries.length === 0}>
            <Download className="w-4 h-4 mr-1" /> Export JSON
          </Button>
          <Button variant="outline" size="sm" onClick={fetchAudit} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Entity type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            <SelectItem value="contacts">Contacts</SelectItem>
            <SelectItem value="companies">Companies</SelectItem>
            <SelectItem value="candidates">Candidates</SelectItem>
            <SelectItem value="user_roles">User Roles</SelectItem>
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
        <Input
          placeholder="Performed by (user ID)"
          value={performedByFilter}
          onChange={(e) => setPerformedByFilter(e.target.value)}
          className="w-56"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn('w-36 justify-start text-left font-normal', !dateFrom && 'text-muted-foreground')}>
              <CalendarIcon className="w-4 h-4 mr-1" />
              {dateFrom ? format(dateFrom, 'dd MMM yyyy') : 'From date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn('w-36 justify-start text-left font-normal', !dateTo && 'text-muted-foreground')}>
              <CalendarIcon className="w-4 h-4 mr-1" />
              {dateTo ? format(dateTo, 'dd MMM yyyy') : 'To date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        {(dateFrom || dateTo || performedByFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); setPerformedByFilter(''); }}>
            Clear
          </Button>
        )}
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
                  <TableHead>Performed By</TableHead>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious onClick={() => setPage((p) => Math.max(0, p - 1))} className={page === 0 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
            </PaginationItem>
            {pageNumbers.map((p) => (
              <PaginationItem key={p}>
                <PaginationLink isActive={p === page} onClick={() => setPage(p)} className="cursor-pointer">
                  {p + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} className={page >= totalPages - 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
