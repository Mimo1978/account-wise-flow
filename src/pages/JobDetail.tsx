import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageBackButton } from '@/components/ui/page-back-button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  useJob,
  useJobAdverts,
  useJobShortlist,
  useJobApplications,
  useUpdateJobStatus,
  useRemoveFromShortlist,
  useRunShortlist,
  useUpdateShortlistStatus,
  useApproveAllShortlist,
  useUpdateShortlistPriority,
  useOutreachMessages,
  useDraftOutreach,
  useSendOutreachBatch,
  useSendOutreachSms,
  useSendOutreachAiCall,
  useUpdateOutreachMessage,
  useLogCandidateReply,
  useJobUnreviewedReplies,
  useUpdateApplicationStatus,
  useBulkUpdateApplicationStatus,
  useConvertToCandidate,
  useProcessApplication,
  type JobShortlistEntry,
  type OutreachMessage,
  type JobApplication,
} from '@/hooks/use-jobs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useBoardFormats,
  useUpdateAdvert,
  usePublishAdvert,
  useToggleConfidential,
  BOARD_DEFINITIONS,
} from '@/hooks/use-job-adverts';
import { GenerateAdvertsModal } from '@/components/jobs/GenerateAdvertsModal';
import { BoardFormatModal } from '@/components/jobs/BoardFormatModal';
import { ShortlistBuilderModal } from '@/components/jobs/ShortlistBuilderModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import {
  Briefcase, FileText, Users, Inbox, Activity, Sparkles, Send, Play,
  Pause, CheckCircle2, XCircle, FileEdit, Copy, Globe, Loader2, Settings2,
  Trash2, Mail, MessageSquare, AlertTriangle, ChevronDown, ChevronUp, GripVertical,
  ShieldCheck, Archive, ArrowUp, Phone, PhoneCall, Reply, Bell, Search,
} from 'lucide-react';
import { JobBriefSection } from '@/components/jobs/JobBriefSection';
import { ProjectLinker, ProjectLinkPrompt, FilledModalLinker } from '@/components/jobs/ProjectLinker';
import { useJobProjects } from '@/hooks/use-job-projects';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { useCreateDeal, DEAL_STAGES } from '@/hooks/use-deals';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';


/* Inline company search dropdown */
function CompanySearchInline({ search, onSearchChange, onSelect }: { search: string; onSearchChange: (v: string) => void; onSelect: (id: string) => void }) {
  const { data: companies = [] } = useQuery({
    queryKey: ['companies-search', search],
    queryFn: async () => {
      const { data } = await supabase
        .from('companies')
        .select('id, name')
        .ilike('name', `%${search}%`)
        .limit(10);
      return (data || []) as { id: string; name: string }[];
    },
  });
  return (
    <div className="space-y-1">
      <Input
        placeholder="Search companies…"
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        className="h-8 text-sm"
        autoFocus
      />
      <div className="max-h-40 overflow-y-auto">
        {companies.map(c => (
          <button
            key={c.id}
            className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors"
            onClick={() => onSelect(c.id)}
          >
            {c.name}
          </button>
        ))}
        {companies.length === 0 && search && (
          <p className="text-xs text-muted-foreground px-2 py-1">No companies found</p>
        )}
      </div>
    </div>
  );
}

const PIPELINE_TYPE_BADGE: Record<string, { className: string; label: string; border: string }> = {
  confirmed: { className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30', label: 'Confirmed', border: 'border-solid' },
  speculative: { className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30', label: 'Speculative', border: 'border-dashed' },
  internal: { className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30', label: 'Internal', border: 'border-solid' },
  proposal: { className: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30', label: 'Proposal', border: 'border-dashed' },
};

const STATUS_BADGE: Record<string, { className: string; label: string }> = {
  draft: { className: 'bg-muted text-muted-foreground', label: 'Draft' },
  active: { className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30', label: 'Active' },
  paused: { className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30', label: 'Paused' },
  filled: { className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30', label: 'Filled' },
  cancelled: { className: 'bg-destructive/15 text-destructive border-destructive/30', label: 'Cancelled' },
};

const SHORTLIST_STATUS: Record<string, string> = {
  pending: 'Pending', contacted: 'Contacted', responded: 'Responded',
  interviewing: 'Interviewing', rejected: 'Rejected', placed: 'Placed',
  approved: 'Approved', reserve: 'Reserve',
};

const INTEREST_BADGE: Record<string, { className: string; label: string }> = {
  yes: { className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30', label: 'Interested' },
  no: { className: 'bg-destructive/15 text-destructive border-destructive/30', label: 'Not Interested' },
  maybe: { className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30', label: 'Maybe' },
  unclear: { className: 'bg-muted text-muted-foreground', label: 'Unclear' },
};

function ShortlistReplyBadge({ jobId }: { jobId: string }) {
  const { data: count = 0 } = useJobUnreviewedReplies(jobId);
  if (count === 0) return null;
  return (
    <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
      {count}
    </span>
  );
}

const APP_STATUS: Record<string, string> = {
  new: 'New', reviewing: 'Reviewing', shortlisted: 'Shortlisted',
  rejected: 'Rejected', interviewing: 'Interviewing', offered: 'Offered', placed: 'Placed',
};

const ADVERT_STATUS_BADGE: Record<string, { className: string; label: string }> = {
  draft: { className: 'bg-muted text-muted-foreground', label: 'Draft' },
  published: { className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30', label: 'Published' },
  ready_to_post: { className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30', label: 'Ready to Post' },
  expired: { className: 'bg-muted text-muted-foreground', label: 'Expired' },
};

const JobDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: job, isLoading } = useJob(id);
  const updateStatus = useUpdateJobStatus();
  const { data: jobProjectLinks = [] } = useJobProjects(id);
  const [showFilledModal, setShowFilledModal] = useState(false);
  const { currentWorkspace } = useWorkspace();

  // Inline title edit
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  // Shortlist builder modal
  const [showShortlistBuilder, setShowShortlistBuilder] = useState(false);

  // Company assignment
  const [showCompanySearch, setShowCompanySearch] = useState(false);
  const [companySearch, setCompanySearch] = useState('');

  // Deal creation prompt state
  const [showDealPrompt, setShowDealPrompt] = useState(false);
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(null);
  const [dealName, setDealName] = useState('');
  const [dealStage, setDealStage] = useState('lead');
  const [dealCloseDate, setDealCloseDate] = useState('');
  const [dealValue, setDealValue] = useState(0);
  const createDeal = useCreateDeal();

  const handleProjectLinked = useCallback((projectId: string) => {
    if (!job) return;
    setLinkedProjectId(projectId);
    setDealName(`${job.title} — Placement Fee`);
    setDealStage('lead');
    setDealCloseDate(job.start_date || '');
    setDealValue(0);
    setShowDealPrompt(true);
  }, [job]);

  const handleCreateDeal = () => {
    if (!job || !currentWorkspace?.id || !job.company_id) return;
    createDeal.mutate({
      workspace_id: currentWorkspace.id,
      company_id: job.company_id,
      title: dealName,
      stage: dealStage,
      value: dealValue,
      expected_close_date: dealCloseDate || null,
    }, {
      onSuccess: () => {
        toast.success('Deal created and linked to pipeline');
        setShowDealPrompt(false);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const handleSaveTitle = useCallback(async () => {
    if (!job || !titleDraft.trim() || titleDraft.trim() === job.title) {
      setEditingTitle(false);
      return;
    }
    const { error } = await supabase.from('jobs').update({ title: titleDraft.trim() } as any).eq('id', job.id);
    if (error) {
      toast.error('Failed to update title');
    } else {
      queryClient.invalidateQueries({ queryKey: ['jobs', job.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Title updated');
    }
    setEditingTitle(false);
  }, [job, titleDraft, queryClient]);

  const handleAssignCompany = useCallback(async (companyId: string) => {
    if (!job) return;
    const { error } = await supabase.from('jobs').update({ company_id: companyId } as any).eq('id', job.id);
    if (error) {
      toast.error('Failed to assign company');
    } else {
      queryClient.invalidateQueries({ queryKey: ['jobs', job.id] });
      toast.success('Company assigned');
    }
    setShowCompanySearch(false);
  }, [job, queryClient]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-6 py-8 max-w-5xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="container mx-auto px-6 py-8 max-w-5xl text-center">
        <p className="text-muted-foreground">Job not found.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/jobs')}>
          Back to Jobs
        </Button>
      </div>
    );
  }

  const badge = STATUS_BADGE[job.status] || STATUS_BADGE.draft;
  const pipelineType = (job as any).pipeline_type || 'confirmed';
  const ptBadge = PIPELINE_TYPE_BADGE[pipelineType] || PIPELINE_TYPE_BADGE.confirmed;
  const hasLinkedProject = jobProjectLinks.length > 0;
  const handleStatusChange = (newStatus: string) => {
    updateStatus.mutate({ id: job.id, status: newStatus });
    if (newStatus === 'filled' && !hasLinkedProject) {
      setShowFilledModal(true);
    }
  };

  const openShortlistBuilder = () => setShowShortlistBuilder(true);

  return (
    <div className="container mx-auto px-6 py-8 max-w-5xl space-y-6">
      <PageBackButton fallback="/jobs" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            {editingTitle ? (
              <Input
                autoFocus
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                className="text-2xl font-bold h-auto py-0 px-1 border-primary"
              />
            ) : (
              <h1
                className="text-2xl font-bold text-foreground tracking-tight cursor-pointer hover:text-primary/80 transition-colors"
                onClick={() => { setTitleDraft(job.title); setEditingTitle(true); }}
                title="Click to edit title"
              >
                {job.title}
              </h1>
            )}
            <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
            <Badge variant="outline" className={ptBadge.className}>{ptBadge.label}</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Popover open={showCompanySearch} onOpenChange={setShowCompanySearch}>
              <PopoverTrigger asChild>
                <button className="hover:text-foreground transition-colors hover:underline">
                  {(job as any).companies?.name || 'No company — click to assign'}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <CompanySearchInline
                  search={companySearch}
                  onSearchChange={setCompanySearch}
                  onSelect={handleAssignCompany}
                />
              </PopoverContent>
            </Popover>
            {job.location && <><span>·</span><span>{job.location}</span></>}
            {job.job_type && <><span>·</span><span>{job.job_type}</span></>}
            <span>·</span>
            <ProjectLinker jobId={job.id} jobTitle={job.title} onProjectLinked={handleProjectLinked} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" data-jarvis-id="job-generate-spec-button">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate Spec
          </Button>
          <Button variant="outline" size="sm" onClick={openShortlistBuilder} data-jarvis-id="job-run-shortlist-button">
            <Users className="w-3.5 h-3.5 mr-1.5" /> Run Shortlist
          </Button>
        </div>
      </div>

      {/* Deal creation prompt after project linking */}
      <Dialog open={showDealPrompt} onOpenChange={setShowDealPrompt}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Track a placement fee?</DialogTitle>
            <DialogDescription>
              Is there a deal associated with this placement? This lets you track the fee in your pipeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-sm">Deal Name</Label>
              <Input value={dealName} onChange={(e) => setDealName(e.target.value)} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Stage</Label>
                <Select value={dealStage} onValueChange={setDealStage}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEAL_STAGES.map(s => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Value</Label>
                <Input type="number" value={dealValue} onChange={(e) => setDealValue(Number(e.target.value))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-sm">Expected Close Date</Label>
              <Input type="date" value={dealCloseDate} onChange={(e) => setDealCloseDate(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setShowDealPrompt(false)}>
              No thanks
            </Button>
            <Button onClick={handleCreateDeal} disabled={createDeal.isPending || !dealName.trim()}>
              {createDeal.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Yes — create a deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filled role celebration modal (Pause point 4) */}
      <Dialog open={showFilledModal} onOpenChange={setShowFilledModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              🎉 Role filled!
            </DialogTitle>
            <DialogDescription>
              Link this to a project to log it as a completed deliverable and update your pipeline.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setShowFilledModal(false)}>
              Close
            </Button>
            <FilledModalLinker jobId={job.id} jobTitle={job.title} onLinked={() => setShowFilledModal(false)} onProjectLinked={handleProjectLinked} />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Controls */}
      <Card>
        <CardContent className="py-3 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-muted-foreground mr-2">Change status:</span>
          {job.status !== 'draft' && (
            <Button variant="outline" size="sm" onClick={() => handleStatusChange('draft')}>
              <FileEdit className="w-3.5 h-3.5 mr-1.5" /> Draft
            </Button>
          )}
          {job.status !== 'active' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-emerald-700 dark:text-emerald-400">
                  <Play className="w-3.5 h-3.5 mr-1.5" /> Active
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Activate this job?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will make the job visible on your job board. Confirm?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleStatusChange('active')}>Confirm</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {job.status !== 'paused' && job.status === 'active' && (
            <Button variant="outline" size="sm" className="text-amber-700 dark:text-amber-400" onClick={() => handleStatusChange('paused')}>
              <Pause className="w-3.5 h-3.5 mr-1.5" /> Pause
            </Button>
          )}
          {job.status !== 'filled' && (
            <Button variant="outline" size="sm" className="text-blue-700 dark:text-blue-400" onClick={() => handleStatusChange('filled')}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Filled
            </Button>
          )}
          {job.status !== 'cancelled' && (
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleStatusChange('cancelled')}>
              <XCircle className="w-3.5 h-3.5 mr-1.5" /> Cancel
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-jarvis-id="job-tab-overview">
            <Briefcase className="w-3.5 h-3.5 mr-1.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="adverts" data-jarvis-id="job-tab-adverts">
            <FileText className="w-3.5 h-3.5 mr-1.5" /> Adverts
          </TabsTrigger>
          <TabsTrigger value="shortlist" data-jarvis-id="job-tab-shortlist" className="relative">
            <Users className="w-3.5 h-3.5 mr-1.5" /> Shortlist
            <ShortlistReplyBadge jobId={job.id} />
          </TabsTrigger>
          <TabsTrigger value="outreach" data-jarvis-id="job-tab-outreach">
            <Send className="w-3.5 h-3.5 mr-1.5" /> Outreach
          </TabsTrigger>
          <TabsTrigger value="applications" data-jarvis-id="job-tab-applications">
            <Inbox className="w-3.5 h-3.5 mr-1.5" /> Applications
          </TabsTrigger>
          <TabsTrigger value="activity" data-jarvis-id="job-tab-activity">
            <Activity className="w-3.5 h-3.5 mr-1.5" /> Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" data-jarvis-section="job-brief-box"><OverviewTab job={job} onProjectLinked={handleProjectLinked} /></TabsContent>
        <TabsContent value="adverts" data-jarvis-section="job-adverts-list"><AdvertsTab jobId={job.id} jobTitle={job.title} /></TabsContent>
        <TabsContent value="shortlist" data-jarvis-section="job-shortlist-table"><ShortlistTab jobId={job.id} jobTitle={job.title} onProjectLinked={handleProjectLinked} onOpenShortlistBuilder={openShortlistBuilder} /></TabsContent>
        <TabsContent value="outreach"><OutreachTab jobId={job.id} jobTitle={job.title} /></TabsContent>
        <TabsContent value="applications" data-jarvis-section="job-applications-table"><ApplicationsTab jobId={job.id} /></TabsContent>
        <TabsContent value="activity"><ActivityTab /></TabsContent>
      </Tabs>

      {/* Shortlist Builder Modal */}
      <ShortlistBuilderModal
        open={showShortlistBuilder}
        onOpenChange={setShowShortlistBuilder}
        jobId={job.id}
        jobTitle={job.title}
        workspaceId={currentWorkspace?.id}
        projectId={(job as any).project_id || null}
        fullSpec={job.full_spec || job.raw_brief || null}
        specSeniority={job.spec_seniority}
        specSectors={job.spec_sectors}
        specMustHaveSkills={job.spec_must_have_skills}
        specWorkType={(job as any).spec_work_type || null}
        specWorkLocation={job.spec_work_location || null}
      />
    </div>
  );
};

// ---------- Overview Tab ----------
function OverviewTab({ job, onProjectLinked }: { job: any; onProjectLinked?: (projectId: string) => void }) {
  const toggleConfidential = useToggleConfidential();
  const isConfidential = job.is_confidential ?? false;
  const { currentWorkspace } = useWorkspace();

  const salaryStr = job.salary_min || job.salary_max
    ? `${job.salary_currency} ${job.salary_min?.toLocaleString() ?? '?'} – ${job.salary_max?.toLocaleString() ?? '?'}`
    : '—';

  return (
    <div className="space-y-6">
      {/* Automation Pipeline Tracker */}
      {currentWorkspace?.id && (
        <AutomationPipelineTracker
          jobId={job.id}
          workspaceId={currentWorkspace.id}
          automationEnabled={job.automation_enabled ?? false}
          specApproved={job.spec_approved}
          shortlistLocked={job.shortlist_locked}
        />
      )}

      {/* Job Brief Section — the primary workflow entry point */}
      <JobBriefSection job={job} onProjectLinked={onProjectLinked} />

      {/* Details card */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Details</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Job Type" value={job.job_type || '—'} />
          <Row label="Location" value={job.location || '—'} />
          <Row label="Remote Policy" value={job.remote_policy || '—'} />
          <Row label="Salary" value={salaryStr} />
          <Row label="Start Date" value={job.start_date ? format(new Date(job.start_date), 'dd MMM yyyy') : '—'} />
          {job.end_date && <Row label="End Date" value={format(new Date(job.end_date), 'dd MMM yyyy')} />}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <Label htmlFor="confidential-toggle" className="text-sm font-medium">Confidential Role</Label>
              <p className="text-xs text-muted-foreground">Hide company name from adverts</p>
            </div>
            <Switch
              id="confidential-toggle"
              checked={isConfidential}
              onCheckedChange={(checked) => toggleConfidential.mutate({ jobId: job.id, isConfidential: checked })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}

// ---------- Adverts Tab ----------
function AdvertsTab({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const { data: adverts = [], isLoading } = useJobAdverts(jobId);
  const { data: boardFormats = [] } = useBoardFormats();
  const { data: jobProjectLinks = [] } = useJobProjects(jobId);
  const updateAdvert = useUpdateAdvert();
  const publishAdvert = usePublishAdvert();
  const queryClient = useQueryClient();

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [boardFormatBoard, setBoardFormatBoard] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const existingBoardFormats = new Set(boardFormats.map(f => f.board));
  const existingFormat = boardFormatBoard ? boardFormats.find(f => f.board === boardFormatBoard) : null;

  const handleGenerate = useCallback(async (boards: string[]) => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-adverts', {
        body: { job_id: jobId, boards },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const successCount = data.results?.filter((r: any) => r.advert).length || 0;
      const failCount = data.results?.filter((r: any) => r.error).length || 0;
      queryClient.invalidateQueries({ queryKey: ['job_adverts'] });
      if (successCount > 0) toast.success(`${successCount} advert${successCount > 1 ? 's' : ''} generated`);
      if (failCount > 0) toast.error(`${failCount} advert${failCount > 1 ? 's' : ''} failed to generate`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate adverts');
    } finally {
      setIsGenerating(false);
    }
  }, [jobId, queryClient]);

  const handleSaveEdit = (id: string) => {
    updateAdvert.mutate({ id, content: editContent });
    setEditingId(null);
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Advert text copied to clipboard');
  };

  // Custom publish handler with project link toast (Pause point 2)
  const handlePublish = (advertId: string, board: string) => {
    publishAdvert.mutate({ id: advertId, board }, {
      onSuccess: () => {
        if (jobProjectLinks.length === 0) {
          // Show toast with link action for pause point 2
          toast.info('This job is live. Link it to a project to track progress in your Command Centre.', {
            duration: 5000,
          });
        }
      },
    });
  };

  if (isLoading) return <TableSkeleton />;

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-sm">Job Adverts</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGenerateModal(true)}
            data-jarvis-id="job-generate-adverts-button"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate Adverts
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {adverts.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <FileText className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">No adverts yet. Generate adverts from the job specification.</p>
              <Button variant="outline" size="sm" onClick={() => setShowGenerateModal(true)}>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate Adverts
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {adverts.map(a => {
                const statusBadge = ADVERT_STATUS_BADGE[a.status] || ADVERT_STATUS_BADGE.draft;
                const boardDef = BOARD_DEFINITIONS[a.board || ''];
                const isEditing = editingId === a.id;

                return (
                  <div key={a.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm capitalize">{boardDef?.label || a.board || '—'}</span>
                        <Badge variant="outline" className={statusBadge.className}>{statusBadge.label}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {a.word_count ?? 0} words · {a.character_count ?? 0} chars
                        </span>
                        {boardDef?.maxWords && a.word_count && a.word_count > boardDef.maxWords && (
                          <span className="text-xs text-destructive font-medium">Over limit!</span>
                        )}
                        {boardDef?.maxChars && a.character_count && a.character_count > boardDef.maxChars && (
                          <span className="text-xs text-destructive font-medium">Over limit!</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {!isEditing && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setEditingId(a.id); setEditContent(a.content || ''); }}
                            >
                              <FileEdit className="w-3.5 h-3.5 mr-1" /> Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(a.content || '')}
                            >
                              <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                            </Button>
                            {a.status === 'draft' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePublish(a.id, a.board || '')}
                                data-jarvis-id="job-publish-button"
                              >
                                {a.board === 'internal' ? (
                                  <><Globe className="w-3.5 h-3.5 mr-1" /> Publish</>
                                ) : (
                                  <><Send className="w-3.5 h-3.5 mr-1" /> Ready to Post</>
                                )}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          rows={12}
                          className="text-sm font-mono"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {editContent.trim().split(/\s+/).filter(Boolean).length} words · {editContent.length} chars
                          </span>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                            <Button size="sm" onClick={() => handleSaveEdit(a.id)} disabled={updateAdvert.isPending}>
                              Save Changes
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded-md p-3 overflow-y-auto">
                        {a.content || 'No content'}
                      </div>
                    )}
                    {a.published_at && (
                      <p className="text-xs text-muted-foreground">
                        Published {format(new Date(a.published_at), 'dd MMM yyyy HH:mm')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <GenerateAdvertsModal
        open={showGenerateModal}
        onOpenChange={setShowGenerateModal}
        onGenerate={handleGenerate}
        onOpenBoardFormat={(board) => { setBoardFormatBoard(board); }}
        existingBoardFormats={existingBoardFormats}
        isGenerating={isGenerating}
      />

      {boardFormatBoard && (
        <BoardFormatModal
          board={boardFormatBoard}
          existingFormat={existingFormat}
          open={!!boardFormatBoard}
          onOpenChange={(open) => { if (!open) setBoardFormatBoard(null); }}
        />
      )}
    </>
  );
}

// ---------- Shortlist Tab ----------
function ShortlistTab({ jobId, jobTitle, onProjectLinked, onOpenShortlistBuilder }: { jobId: string; jobTitle: string; onProjectLinked?: (projectId: string) => void; onOpenShortlistBuilder?: () => void }) {
  const { data: entries = [], isLoading } = useJobShortlist(jobId);
  const removeFromShortlist = useRemoveFromShortlist();
  const runShortlist = useRunShortlist();
  const updateStatus = useUpdateShortlistStatus();
  const approveAll = useApproveAllShortlist();
  const updatePriority = useUpdateShortlistPriority();
  const logReply = useLogCandidateReply();
  const [reviewMode, setReviewMode] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [logReplyOpen, setLogReplyOpen] = useState(false);
  const [logReplyEntryId, setLogReplyEntryId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  if (isLoading) return <TableSkeleton />;

  const pendingEntries = entries.filter(e => e.status === 'pending');
  const approvedEntries = entries.filter(e => e.status === 'approved');
  const reserveEntries = entries.filter(e => e.status === 'reserve');
  const hasPending = pendingEntries.length > 0;
  const allApproved = entries.length > 0 && pendingEntries.length === 0 && reserveEntries.length === 0;

  const scoreBadgeClass = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
    if (score >= 60) return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
    return 'bg-muted text-muted-foreground';
  };

  const statusBadge = (status: string, entry?: JobShortlistEntry) => {
    if (status === 'responded' && entry?.candidate_interest) {
      const ib = INTEREST_BADGE[entry.candidate_interest] || INTEREST_BADGE.unclear;
      return <Badge variant="outline" className={ib.className}>{ib.label}</Badge>;
    }
    if (status === 'rejected' && entry?.candidate_interest === 'no') {
      return <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">Declined</Badge>;
    }
    switch (status) {
      case 'approved': return <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Approved</Badge>;
      case 'reserve': return <Badge variant="outline" className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30">Reserve</Badge>;
      case 'contacted': return <Badge variant="outline" className="bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30">Contacted</Badge>;
      default: return <Badge variant="outline" className="bg-muted text-muted-foreground">Pending Review</Badge>;
    }
  };

  const handleLogReply = (entryId: string) => {
    setLogReplyEntryId(entryId);
    setReplyText('');
    setLogReplyOpen(true);
  };

  const handleSubmitReply = () => {
    if (!logReplyEntryId || !replyText.trim()) return;
    logReply.mutate({ shortlist_id: logReplyEntryId, reply_text: replyText.trim() });
    setLogReplyOpen(false);
    setLogReplyEntryId(null);
    setReplyText('');
  };

  const handleDragStart = (id: string) => setDragId(id);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ordered = [...entries];
    const fromIdx = ordered.findIndex(e => e.id === dragId);
    const toIdx = ordered.findIndex(e => e.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = ordered.splice(fromIdx, 1);
    ordered.splice(toIdx, 0, moved);
    const updates = ordered.map((e, i) => ({ id: e.id, priority: i + 1 }));
    updatePriority.mutate(updates);
    setDragId(null);
  };

  const handleMoveToTop = (id: string) => {
    const ordered = [...entries];
    const idx = ordered.findIndex(e => e.id === id);
    if (idx <= 0) return;
    const [moved] = ordered.splice(idx, 1);
    ordered.unshift(moved);
    const updates = ordered.map((e, i) => ({ id: e.id, priority: i + 1 }));
    updatePriority.mutate(updates);
    toast.success('Moved to top of shortlist');
  };

  return (
    <div className="space-y-4">
      {/* Pause point 3: Project link prompt when candidates are onProjectLinked={onProjectLinked} in progress */}
      {entries.length > 0 && (
        <ProjectLinkPrompt jobId={jobId} jobTitle={jobTitle} variant="shortlist" />
      )}

      {/* Review Banner */}
      {entries.length > 0 && hasPending && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Jarvis has shortlisted {entries.length} candidate{entries.length !== 1 ? 's' : ''}. Review and approve before sending outreach.
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {approvedEntries.length} approved · {pendingEntries.length} pending · {reserveEntries.length} reserve
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                size="sm"
                onClick={() => approveAll.mutate(jobId)}
                disabled={approveAll.isPending}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                {approveAll.isPending ? 'Approving...' : 'Approve All & Proceed'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReviewMode(!reviewMode)}
              >
                {reviewMode ? 'Compact View' : 'Review Individually'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approved banner */}
      {allApproved && entries.length > 0 && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm font-medium text-foreground">
                Shortlist approved. {approvedEntries.length} candidate{approvedEntries.length !== 1 ? 's' : ''} ready for outreach.
              </p>
            </div>
            <Button size="sm" data-jarvis-id="job-send-outreach-button">
              <Send className="w-3.5 h-3.5 mr-1.5" /> Proceed to Outreach
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-sm">Shortlisted Candidates</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenShortlistBuilder}
            data-jarvis-id="job-run-shortlist-trigger"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Run Shortlist
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <Users className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">No candidates shortlisted yet.</p>
              <p className="text-xs text-muted-foreground">Click "Run Shortlist" to match candidates from your talent database.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenShortlistBuilder}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Run Shortlist
              </Button>
            </div>
          ) : reviewMode ? (
            /* ---- Review Individually Mode ---- */
            <div className="divide-y divide-border">
              {entries.map((e, idx) => {
                const isExpanded = expandedId === e.id;
                return (
                  <div
                    key={e.id}
                    draggable
                    onDragStart={() => handleDragStart(e.id)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(e.id)}
                    className="p-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab flex-shrink-0" />
                      <span className="text-xs font-mono text-muted-foreground w-5">#{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{e.candidates?.name || '—'}</span>
                          {e.match_score != null && (
                            <Badge variant="outline" className={scoreBadgeClass(e.match_score)}>{e.match_score}%</Badge>
                          )}
                          {statusBadge(e.status, e)}
                          {e.availability_warning && (
                            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="w-3 h-3" /> {e.availability_warning}
                            </span>
                          )}
                        </div>
                        {e.candidates?.current_title && (
                          <p className="text-xs text-muted-foreground mt-0.5">{e.candidates.current_title}{e.candidates.location ? ` · ${e.candidates.location}` : ''}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {e.status === 'pending' && (
                          <>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus.mutate({ id: e.id, status: 'approved' })}>
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus.mutate({ id: e.id, status: 'reserve' })}>
                              <Archive className="w-3 h-3 mr-1" /> Reserve
                            </Button>
                          </>
                        )}
                        {e.status === 'reserve' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus.mutate({ id: e.id, status: 'approved' })}>
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                          </Button>
                        )}
                        {e.status === 'approved' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus.mutate({ id: e.id, status: 'pending' })}>
                            Undo
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleMoveToTop(e.id)} title="Move to top">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => removeFromShortlist.mutate(e.id)} title="Remove">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setExpandedId(isExpanded ? null : e.id)}>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 ml-12 space-y-3 text-sm">
                        {(e.match_reasons || []).length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Match Reasons</p>
                            <div className="flex flex-wrap gap-1">
                              {(e.match_reasons || []).map((r, i) => (
                                <span key={i} className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{r}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {(e.concerns || []).length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Concerns</p>
                            <div className="flex flex-wrap gap-1">
                              {(e.concerns as string[] || []).map((c, i) => (
                                <span key={i} className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">{c}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border">
                          <span>Availability: {e.candidates?.availability_status || 'Unknown'}</span>
                          <span>Location: {e.candidates?.location || 'Unknown'}</span>
                        </div>
                        {e.candidate_interest && (
                          <div className="flex items-center gap-2 text-xs pt-1 border-t border-border">
                            <Reply className="w-3 h-3 text-muted-foreground" />
                            <span>Response: <strong className="capitalize">{e.candidate_interest}</strong></span>
                            {e.availability_confirmed && <span className="text-muted-foreground">· {e.availability_confirmed}</span>}
                            {e.response_received_at && <span className="text-muted-foreground">· {format(new Date(e.response_received_at), 'dd MMM HH:mm')}</span>}
                          </div>
                        )}
                        <div className="flex items-center gap-1 pt-1">
                          <Button variant="ghost" size="sm" className="h-7 text-xs"><Mail className="w-3 h-3 mr-1" /> Email</Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs"><MessageSquare className="w-3 h-3 mr-1" /> SMS</Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleLogReply(e.id)}>
                            <Reply className="w-3 h-3 mr-1" /> Log Reply
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ---- Compact Table Mode ---- */
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead className="w-20">Score</TableHead>
                  <TableHead>Match Reasons</TableHead>
                  <TableHead>Availability</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e, idx) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs text-muted-foreground font-mono">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <span className="font-medium text-sm">{e.candidates?.name || '—'}</span>
                        {e.candidates?.current_title && (
                          <p className="text-xs text-muted-foreground">{e.candidates.current_title}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {e.match_score != null ? (
                        <Badge variant="outline" className={scoreBadgeClass(e.match_score)}>{e.match_score}%</Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(e.match_reasons || []).slice(0, 3).map((r, i) => (
                          <span key={i} className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{r}</span>
                        ))}
                        {(e.concerns || []).length > 0 && (
                          <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                            {(e.concerns as string[])[0]}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {e.availability_warning ? (
                        <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="w-3 h-3" />
                          {e.availability_warning}
                        </div>
                      ) : (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">Available</span>
                      )}
                    </TableCell>
                    <TableCell>{statusBadge(e.status, e)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        {e.status === 'pending' && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Approve" onClick={() => updateStatus.mutate({ id: e.id, status: 'approved' })}>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Log Reply" onClick={() => handleLogReply(e.id)}>
                          <Reply className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Email"><Mail className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="SMS"><MessageSquare className="w-3.5 h-3.5" /></Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          title="Remove"
                          onClick={() => removeFromShortlist.mutate(e.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Log Reply Dialog */}
      <Dialog open={logReplyOpen} onOpenChange={setLogReplyOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Log Candidate Reply</DialogTitle>
            <DialogDescription>
              Paste the candidate's reply or summarise their response. Jarvis will automatically parse their interest and availability.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Paste candidate's reply here..."
            rows={6}
            className="text-sm"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setLogReplyOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleSubmitReply}
              disabled={!replyText.trim() || logReply.isPending}
            >
              {logReply.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Parsing...</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Parse & Save</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Outreach Tab ----------
const CHANNEL_ICON: Record<string, typeof Mail> = { email: Mail, sms: MessageSquare, ai_call: PhoneCall };
const CHANNEL_LABEL: Record<string, string> = { email: 'Email', sms: 'SMS', ai_call: 'AI Call' };

function OutreachTab({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const { data: messages = [], isLoading } = useOutreachMessages(jobId);
  const { data: shortlist = [] } = useJobShortlist(jobId);
  const draftOutreach = useDraftOutreach();
  const sendBatch = useSendOutreachBatch();
  const sendSms = useSendOutreachSms();
  const sendAiCall = useSendOutreachAiCall();
  const updateMessage = useUpdateOutreachMessage();

  const [showSetup, setShowSetup] = useState(false);
  const [automationLevel, setAutomationLevel] = useState('draft');
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [recruiterPhone, setRecruiterPhone] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [campaignName, setCampaignName] = useState(`${jobTitle} Outreach - ${format(new Date(), 'dd MMM yyyy')}`);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['email']);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');

  const approvedCount = shortlist.filter(e => e.status === 'approved').length;

  const filteredMessages = channelFilter === 'all' ? messages : messages.filter(m => (m as any).channel === channelFilter);
  const drafts = filteredMessages.filter(m => m.status === 'draft');
  const sent = filteredMessages.filter(m => m.status === 'sent');
  const failed = filteredMessages.filter(m => m.status === 'failed');

  const toggleChannel = (ch: string) => {
    setSelectedChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    );
  };

  const handleDraft = () => {
    draftOutreach.mutate({
      job_id: jobId,
      automation_level: automationLevel,
      from_name: fromName || undefined,
      from_email: fromEmail || undefined,
      campaign_name: campaignName || undefined,
      channels: selectedChannels,
      recruiter_phone: recruiterPhone || undefined,
      agency_name: agencyName || undefined,
    });
    setShowSetup(false);
  };

  const handleSendAll = () => {
    // Send by channel type
    const emailDrafts = drafts.filter(m => (m as any).channel === 'email').map(m => m.id);
    const smsDrafts = drafts.filter(m => (m as any).channel === 'sms').map(m => m.id);
    const aiCallDrafts = drafts.filter(m => (m as any).channel === 'ai_call').map(m => m.id);

    if (emailDrafts.length > 0) sendBatch.mutate(emailDrafts);
    if (smsDrafts.length > 0) sendSms.mutate(smsDrafts);
    if (aiCallDrafts.length > 0) sendAiCall.mutate(aiCallDrafts);
  };

  const handleSendOne = (msg: OutreachMessage) => {
    const ch = (msg as any).channel || 'email';
    if (ch === 'sms') sendSms.mutate([msg.id]);
    else if (ch === 'ai_call') sendAiCall.mutate([msg.id]);
    else sendBatch.mutate([msg.id]);
  };

  const handleSaveEdit = (id: string) => {
    updateMessage.mutate({ id, subject: editSubject, body: editBody });
    setEditingMsgId(null);
  };

  const isSending = sendBatch.isPending || sendSms.isPending || sendAiCall.isPending;

  if (isLoading) return <TableSkeleton />;

  // Count channels
  const emailMsgCount = messages.filter(m => (m as any).channel === 'email').length;
  const smsMsgCount = messages.filter(m => (m as any).channel === 'sms').length;
  const aiCallMsgCount = messages.filter(m => (m as any).channel === 'ai_call').length;

  return (
    <div className="space-y-4">
      {/* AI Call Compliance Banner */}
      {(selectedChannels.includes('ai_call') || aiCallMsgCount > 0) && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-medium">AI Call Compliance Reminder</p>
              <p>Ensure you have a legitimate interest basis under UK GDPR to contact candidates by phone. AI-generated calls must comply with Ofcom guidelines. Calls are logged for audit purposes.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Setup / Draft Panel */}
      {messages.length === 0 && !showSetup && (
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <Mail className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">
              {approvedCount > 0
                ? `${approvedCount} approved candidate${approvedCount !== 1 ? 's' : ''} ready for outreach.`
                : 'Approve candidates on the Shortlist tab first.'}
            </p>
            <Button
              size="sm"
              onClick={() => setShowSetup(true)}
              disabled={approvedCount === 0}
              data-jarvis-id="job-draft-outreach-button"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Draft Outreach
            </Button>
          </CardContent>
        </Card>
      )}

      {showSetup && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-sm">Outreach Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Channel Selection */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Channels</Label>
              <div className="flex items-center gap-4">
                {(['email', 'sms', 'ai_call'] as const).map(ch => {
                  const Icon = CHANNEL_ICON[ch];
                  return (
                    <label key={ch} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedChannels.includes(ch)}
                        onCheckedChange={() => toggleChannel(ch)}
                      />
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm">{CHANNEL_LABEL[ch]}</span>
                      {ch === 'ai_call' && <Badge variant="outline" className="text-[10px] ml-1">Automated voice</Badge>}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Automation Level</Label>
                <Select value={automationLevel} onValueChange={setAutomationLevel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft only — review before sending</SelectItem>
                    <SelectItem value="approve_batch">Approve batch — review then send all</SelectItem>
                    <SelectItem value="auto_send">Auto-send — generate & send immediately</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Campaign Name</Label>
                <Input value={campaignName} onChange={e => setCampaignName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">From Name</Label>
                <Input value={fromName} onChange={e => setFromName(e.target.value)} placeholder="Your name (from profile)" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">From Email</Label>
                <Input value={fromEmail} onChange={e => setFromEmail(e.target.value)} placeholder="Resend verified sender" />
              </div>
              {(selectedChannels.includes('sms') || selectedChannels.includes('ai_call')) && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Recruiter Phone</Label>
                    <Input value={recruiterPhone} onChange={e => setRecruiterPhone(e.target.value)} placeholder="+44 7XXX XXXXXX" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Agency Name</Label>
                    <Input value={agencyName} onChange={e => setAgencyName(e.target.value)} placeholder="Your agency" />
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowSetup(false)}>Cancel</Button>
              <Button size="sm" onClick={handleDraft} disabled={draftOutreach.isPending || selectedChannels.length === 0}>
                {draftOutreach.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Drafting...</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate for {approvedCount} Candidate{approvedCount !== 1 ? 's' : ''}</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Channel filter tabs */}
      {messages.length > 0 && (
        <div className="flex items-center gap-1 border-b border-border">
          {['all', 'email', 'sms', 'ai_call'].map(f => {
            const count = f === 'all' ? messages.length : messages.filter(m => (m as any).channel === f).length;
            if (f !== 'all' && count === 0) return null;
            return (
              <button
                key={f}
                onClick={() => setChannelFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                  channelFilter === f
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {f === 'all' ? 'All' : CHANNEL_LABEL[f]} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Batch Actions */}
      {drafts.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              {drafts.length} draft{drafts.length !== 1 ? 's' : ''} ready for review.
              {sent.length > 0 && ` ${sent.length} already sent.`}
              {failed.length > 0 && ` ${failed.length} failed.`}
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setShowSetup(true)} variant="outline">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Draft More
              </Button>
              <Button size="sm" onClick={handleSendAll} disabled={isSending}>
                {isSending ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="w-3.5 h-3.5 mr-1.5" /> Approve All & Send</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sent summary */}
      {sent.length > 0 && drafts.length === 0 && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="py-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-medium text-foreground">
              Outreach sent to {sent.length} candidate{sent.length !== 1 ? 's' : ''} for {jobTitle}.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Message List */}
      {filteredMessages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Outreach Messages</CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border">
            {filteredMessages.map(msg => {
              const isEditing = editingMsgId === msg.id;
              const ch = (msg as any).channel || 'email';
              const ChIcon = CHANNEL_ICON[ch] || Mail;
              const statusColor = msg.status === 'sent'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                : msg.status === 'failed'
                  ? 'bg-destructive/15 text-destructive border-destructive/30'
                  : 'bg-muted text-muted-foreground';

              // Get display content based on channel
              const displayBody = ch === 'sms' ? (msg as any).sms_body : ch === 'ai_call' ? (msg as any).ai_call_script : msg.body;

              return (
                <div key={msg.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ChIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-medium text-sm">{msg.candidate_name || '—'}</span>
                      <span className="text-xs text-muted-foreground">
                        {ch === 'email' ? msg.candidate_email : (msg as any).candidate_phone || ''}
                      </span>
                      <Badge variant="outline" className={statusColor}>{msg.status}</Badge>
                      <Badge variant="outline" className="text-[10px]">{CHANNEL_LABEL[ch]}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      {msg.status === 'draft' && !isEditing && ch === 'email' && (
                        <Button variant="ghost" size="sm" onClick={() => {
                          setEditingMsgId(msg.id);
                          setEditSubject(msg.subject);
                          setEditBody(msg.body || '');
                        }}>
                          <FileEdit className="w-3.5 h-3.5 mr-1" /> Edit
                        </Button>
                      )}
                      {msg.status === 'draft' && (
                        <Button variant="outline" size="sm" onClick={() => handleSendOne(msg)} disabled={isSending}>
                          <Send className="w-3.5 h-3.5 mr-1" /> Send
                        </Button>
                      )}
                      {msg.status === 'failed' && (
                        <Button variant="outline" size="sm" onClick={() => handleSendOne(msg)} disabled={isSending}>
                          <Send className="w-3.5 h-3.5 mr-1" /> Retry
                        </Button>
                      )}
                      {msg.sent_at && (
                        <span className="text-xs text-muted-foreground">Sent {format(new Date(msg.sent_at), 'dd MMM HH:mm')}</span>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <Input value={editSubject} onChange={e => setEditSubject(e.target.value)} placeholder="Subject" className="text-sm" />
                      <Textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={8} className="text-sm font-mono" />
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => setEditingMsgId(null)}>Cancel</Button>
                        <Button size="sm" onClick={() => handleSaveEdit(msg.id)}>Save</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {ch === 'email' && <p className="text-sm font-medium text-foreground">Subject: {msg.subject}</p>}
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded-md p-3 max-h-40 overflow-y-auto">
                        {displayBody || ''}
                      </div>
                    </div>
                  )}

                  {msg.error_message && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {msg.error_message}
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------- Applications Tab ----------
function ApplicationsTab({ jobId }: { jobId: string }) {
  const { data: apps = [], isLoading } = useJobApplications(jobId);
  const updateStatus = useUpdateApplicationStatus();
  const bulkUpdate = useBulkUpdateApplicationStatus();
  const convertToCandidate = useConvertToCandidate();
  const processApp = useProcessApplication();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = statusFilter === 'all' ? apps : apps.filter(a => a.status === statusFilter);
  const allSelected = filtered.length > 0 && filtered.every(a => selected.has(a.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(a => a.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const scoreBadge = (score: number | null) => {
    if (score == null) return <span className="text-muted-foreground text-xs">Pending</span>;
    const cls = score >= 80
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
      : score >= 60
        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
        : 'bg-muted text-muted-foreground';
    return <Badge variant="outline" className={cls}>{score}/100</Badge>;
  };

  if (isLoading) return <TableSkeleton />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base">Applications ({apps.length})</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="reviewing">Reviewing</SelectItem>
                <SelectItem value="shortlisted">Shortlisted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            {selected.size > 0 && (
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-xs">{selected.size} selected</Badge>
                <Button
                  variant="outline" size="sm" className="text-xs h-7"
                  onClick={() => bulkUpdate.mutate({ ids: Array.from(selected), status: 'rejected' })}
                >
                  <XCircle className="w-3 h-3 mr-1" /> Reject
                </Button>
                <Button
                  variant="outline" size="sm" className="text-xs h-7"
                  onClick={() => bulkUpdate.mutate({ ids: Array.from(selected), status: 'shortlisted' })}
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Shortlist
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {statusFilter === 'all' ? 'No applications received yet.' : `No ${statusFilter} applications.`}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Applicant</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>AI Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(a => (
                <TableRow key={a.id} className={a.status === 'new' ? 'bg-primary/5' : ''}>
                  <TableCell>
                    <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggleOne(a.id)} />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <span className="font-medium text-foreground">{a.applicant_name || '—'}</span>
                      {a.applicant_email && (
                        <p className="text-xs text-muted-foreground">{a.applicant_email}</p>
                      )}
                      {a.ai_summary && (
                        <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{a.ai_summary}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize text-sm text-muted-foreground">{a.source?.replace('_', ' ') || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {a.created_at ? format(new Date(a.created_at), 'dd MMM yyyy') : '—'}
                  </TableCell>
                  <TableCell>{scoreBadge(a.ai_match_score)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {APP_STATUS[a.status] || a.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {a.cv_url && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                          <a href={a.cv_url} target="_blank" rel="noopener noreferrer">
                            <FileText className="w-3 h-3 mr-1" /> CV
                          </a>
                        </Button>
                      )}
                      {!a.processed_at && (
                        <Button
                          variant="ghost" size="sm" className="h-7 text-xs"
                          disabled={processApp.isPending}
                          onClick={() => processApp.mutate(a.id)}
                        >
                          <Sparkles className="w-3 h-3 mr-1" /> Score
                        </Button>
                      )}
                      {a.status !== 'shortlisted' && a.status !== 'rejected' && (
                        <Button
                          variant="ghost" size="sm" className="h-7 text-xs text-emerald-600"
                          onClick={() => updateStatus.mutate({ id: a.id, status: 'shortlisted', oldStatus: a.status })}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Shortlist
                        </Button>
                      )}
                      {a.status !== 'rejected' && (
                        <Button
                          variant="ghost" size="sm" className="h-7 text-xs text-destructive"
                          onClick={() => updateStatus.mutate({ id: a.id, status: 'rejected', oldStatus: a.status })}
                        >
                          <XCircle className="w-3 h-3 mr-1" /> Reject
                        </Button>
                      )}
                      {!a.candidate_id && (
                        <Button
                          variant="ghost" size="sm" className="h-7 text-xs"
                          disabled={convertToCandidate.isPending}
                          onClick={() => convertToCandidate.mutate(a)}
                        >
                          <Users className="w-3 h-3 mr-1" /> Convert
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Activity Tab ----------
function ActivityTab() {
  return (
    <Card>
      <CardContent className="py-8 text-center">
        <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Activity timeline coming soon.</p>
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-2 p-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

export default JobDetail;
