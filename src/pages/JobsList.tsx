import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useJobs, useJobCounts, useCreateJob } from '@/hooks/use-jobs';
import { Plus, Briefcase, Search, ExternalLink, AlertTriangle, Filter } from 'lucide-react';
import { SectionCard } from '@/components/ui/SectionCard';
import { format } from 'date-fns';

const STATUS_BADGE: Record<string, { variant: 'secondary' | 'default' | 'outline' | 'destructive'; className: string; label: string }> = {
  draft: { variant: 'secondary', className: 'bg-muted text-muted-foreground', label: 'Draft' },
  active: { variant: 'default', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30', label: 'Active' },
  paused: { variant: 'outline', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30', label: 'Paused' },
  filled: { variant: 'outline', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30', label: 'Filled' },
  cancelled: { variant: 'destructive', className: 'bg-destructive/15 text-destructive border-destructive/30', label: 'Cancelled' },
};

const JobsList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentWorkspace } = useWorkspace();
  const { data: jobs = [], isLoading } = useJobs();
  const { data: counts } = useJobCounts(currentWorkspace?.id);
  const createJob = useCreateJob();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showUnlinked, setShowUnlinked] = useState(searchParams.get('filter') === 'unlinked');

  // Fetch all job-project links with project names and deal values
  const { data: jobLinks = [] } = useQuery({
    queryKey: ['jobs_projects_list', currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs_projects' as any)
        .select('job_id, crm_projects(id, name, status)')
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['jobs_deals_list', currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_deals')
        .select('id, title, value, currency, company_id')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentWorkspace?.id,
  });

  // Build lookup maps
  const projectByJobId = useMemo(() => {
    const map: Record<string, { id: string; name: string }> = {};
    jobLinks.forEach((l: any) => {
      if (l.crm_projects) map[l.job_id] = l.crm_projects;
    });
    return map;
  }, [jobLinks]);

  const dealByJobTitle = useMemo(() => {
    const map: Record<string, { value: number; currency: string }> = {};
    deals.forEach((d: any) => {
      if (d.title?.includes('Placement Fee')) {
        // Extract job title from deal name pattern "[Job Title] — Placement Fee"
        map[d.title] = { value: d.value, currency: d.currency };
      }
    });
    return map;
  }, [deals]);

  const activeCount = useMemo(() => jobs.filter(j => j.status === 'active').length, [jobs]);

  const filtered = useMemo(() => {
    return jobs.filter(j => {
      if (statusFilter !== 'all' && j.status !== statusFilter) return false;
      if (typeFilter !== 'all' && j.job_type !== typeFilter) return false;
      if (showUnlinked) {
        if (j.status !== 'active') return false;
        if (projectByJobId[j.id]) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const companyName = (j as any).companies?.name || '';
        if (!j.title.toLowerCase().includes(q) && !companyName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [jobs, statusFilter, typeFilter, search, showUnlinked, projectByJobId]);

  const handleCreate = () => {
    createJob.mutate({ title: 'Untitled Job' }, {
      onSuccess: (data: any) => navigate(`/jobs/${data.id}`),
    });
  };

  return (
    <div className="min-h-screen" style={{ background: '#0F1117' }}>
      <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#F8FAFC' }}>Jobs</h1>
            <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
              {activeCount} active role{activeCount !== 1 ? 's' : ''} in workspace
            </p>
          </div>
        </div>

        <SectionCard
          accentColor="#9B6FE8"
          title="Jobs"
          icon={<Briefcase className="w-4 h-4" />}
          headerRight={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 border-[#2D3748] text-slate-300 hover:bg-[#252B3B]" asChild>
                <a href="/jobs/board" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5" /> View Public Board
                </a>
              </Button>
              <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-500 text-white" onClick={handleCreate} data-jarvis-id="add-job-button">
                <Plus className="w-3.5 h-3.5" /> + New Job
              </Button>
            </div>
          }
        >
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#94A3B8' }} />
              <Input placeholder="Search jobs or companies…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="filled">Filled</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Job type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="permanent">Permanent</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="temp">Temp</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant={showUnlinked ? 'default' : 'outline'} className="gap-1.5 h-9" onClick={() => setShowUnlinked(v => !v)}
              style={!showUnlinked ? { borderColor: '#2D3748', color: '#94A3B8' } : {}}>
              <Filter className="w-3.5 h-3.5" /> Unlinked Jobs
            </Button>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-2 py-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: '#2D3748' }}>
                <Briefcase className="w-6 h-6" style={{ color: '#94A3B8' }} />
              </div>
              <h3 className="text-sm font-semibold" style={{ color: '#F8FAFC' }}>No jobs yet</h3>
              <p className="text-xs mt-1 max-w-sm" style={{ color: '#94A3B8' }}>
                Create a job to start building specs, adverts, and shortlists.
              </p>
              <Button size="sm" className="mt-4 gap-1.5 bg-blue-600 hover:bg-blue-500 text-white" onClick={handleCreate}>
                <Plus className="w-3.5 h-3.5" /> + New Job
              </Button>
            </div>
          ) : (
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #2D3748' }}>
              <Table>
                <TableHeader>
                   <TableRow>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Hiring Manager</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Pipeline</TableHead>
                    <TableHead className="text-center">Applications</TableHead>
                    <TableHead className="text-center">Shortlisted</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((job, index) => {
                    const badge = STATUS_BADGE[job.status] || STATUS_BADGE.draft;
                    const appCount = counts?.appCounts?.[job.id] ?? 0;
                    const shortCount = counts?.shortCounts?.[job.id] ?? 0;
                    const linkedProject = projectByJobId[job.id];
                    const dealKey = `${job.title} — Placement Fee`;
                    const linkedDeal = dealByJobTitle[dealKey];
                    const isActiveUnlinked = job.status === 'active' && !linkedProject;
                    return (
                      <TableRow key={job.id} className="cursor-pointer"
                        style={{
                          background: index % 2 === 1 ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                          transition: 'background 0.1s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = index % 2 === 1 ? 'rgba(255, 255, 255, 0.04)' : 'transparent'; }}
                        onClick={() => navigate(`/jobs/${job.id}`)}>
                        <TableCell className="font-medium">{job.title}</TableCell>
                        <TableCell style={{ color: '#94A3B8' }}>{(job as any).companies?.name || '—'}</TableCell>
                        <TableCell className="text-sm" style={{ color: '#94A3B8' }}>
                          {(job as any).hiring_manager
                            ? <span className="text-primary cursor-pointer hover:underline" onClick={(e) => { e.stopPropagation(); navigate(`/contacts/${(job as any).hiring_manager.id}`); }}>{(job as any).hiring_manager.first_name} {(job as any).hiring_manager.last_name}</span>
                            : '—'}
                        </TableCell>
                        <TableCell className="capitalize" style={{ color: '#94A3B8' }}>{job.job_type || '—'}</TableCell>
                        <TableCell style={{ color: '#94A3B8' }}>{job.location || '—'}</TableCell>
                        <TableCell><Badge variant={badge.variant} className={badge.className}>{badge.label}</Badge></TableCell>
                        <TableCell>
                          {linkedProject ? (
                            <span className="text-sm text-primary hover:underline cursor-pointer" onClick={e => { e.stopPropagation(); navigate(`/crm/projects/${linkedProject.id}`); }}>{linkedProject.name}</span>
                          ) : isActiveUnlinked ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center gap-1 text-sm" style={{ color: '#94A3B8' }}>— <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /></span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[220px] text-xs">This active job isn't linked to a project.</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-sm" style={{ color: '#94A3B8' }}>—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm" style={{ color: '#94A3B8' }}>
                          {linkedDeal ? (
                            <span className="font-medium" style={{ color: '#F8FAFC' }}>
                              {linkedDeal.currency === 'GBP' ? '£' : linkedDeal.currency === 'USD' ? '$' : linkedDeal.currency === 'EUR' ? '€' : ''}{linkedDeal.value.toLocaleString()}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-center">{appCount}</TableCell>
                        <TableCell className="text-center">{shortCount}</TableCell>
                        <TableCell className="text-sm" style={{ color: '#94A3B8' }}>{format(new Date(job.created_at), 'dd MMM yyyy')}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
};

export default JobsList;
