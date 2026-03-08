import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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
} from '@/hooks/use-jobs';
import {
  Briefcase,
  FileText,
  Users,
  Inbox,
  Activity,
  Sparkles,
  Send,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  FileEdit,
} from 'lucide-react';
import { format } from 'date-fns';

const STATUS_BADGE: Record<string, { className: string; label: string }> = {
  draft: { className: 'bg-muted text-muted-foreground', label: 'Draft' },
  active: { className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30', label: 'Active' },
  paused: { className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30', label: 'Paused' },
  filled: { className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30', label: 'Filled' },
  cancelled: { className: 'bg-destructive/15 text-destructive border-destructive/30', label: 'Cancelled' },
};

const SHORTLIST_STATUS: Record<string, string> = {
  pending: 'Pending',
  contacted: 'Contacted',
  responded: 'Responded',
  interviewing: 'Interviewing',
  rejected: 'Rejected',
  placed: 'Placed',
};

const APP_STATUS: Record<string, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  shortlisted: 'Shortlisted',
  rejected: 'Rejected',
  interviewing: 'Interviewing',
  offered: 'Offered',
  placed: 'Placed',
};

const JobDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: job, isLoading } = useJob(id);
  const updateStatus = useUpdateJobStatus();

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

  const handleStatusChange = (newStatus: string) => {
    updateStatus.mutate({ id: job.id, status: newStatus });
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-5xl space-y-6">
      <PageBackButton fallbackPath="/jobs" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{job.title}</h1>
            <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {(job as any).companies?.name || 'No company'}
            {job.location ? ` · ${job.location}` : ''}
            {job.job_type ? ` · ${job.job_type}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" data-jarvis-id="job-generate-spec-button">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate Spec
          </Button>
          <Button variant="outline" size="sm" data-jarvis-id="job-generate-adverts-button">
            <FileText className="w-3.5 h-3.5 mr-1.5" /> Generate Adverts
          </Button>
          <Button variant="outline" size="sm" data-jarvis-id="job-run-shortlist-button">
            <Users className="w-3.5 h-3.5 mr-1.5" /> Run Shortlist
          </Button>
        </div>
      </div>

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
          <TabsTrigger value="shortlist" data-jarvis-id="job-tab-shortlist">
            <Users className="w-3.5 h-3.5 mr-1.5" /> Shortlist
          </TabsTrigger>
          <TabsTrigger value="applications" data-jarvis-id="job-tab-applications">
            <Inbox className="w-3.5 h-3.5 mr-1.5" /> Applications
          </TabsTrigger>
          <TabsTrigger value="activity" data-jarvis-id="job-tab-activity">
            <Activity className="w-3.5 h-3.5 mr-1.5" /> Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab job={job} /></TabsContent>
        <TabsContent value="adverts"><AdvertsTab jobId={job.id} /></TabsContent>
        <TabsContent value="shortlist"><ShortlistTab jobId={job.id} /></TabsContent>
        <TabsContent value="applications"><ApplicationsTab jobId={job.id} /></TabsContent>
        <TabsContent value="activity"><ActivityTab jobId={job.id} /></TabsContent>
      </Tabs>
    </div>
  );
};

// ---------- Overview Tab ----------
function OverviewTab({ job }: { job: any }) {
  const salaryStr = job.salary_min || job.salary_max
    ? `${job.salary_currency} ${job.salary_min?.toLocaleString() ?? '?'} – ${job.salary_max?.toLocaleString() ?? '?'}`
    : '—';

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-sm">Details</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Job Type" value={job.job_type || '—'} />
          <Row label="Location" value={job.location || '—'} />
          <Row label="Remote Policy" value={job.remote_policy || '—'} />
          <Row label="Salary" value={salaryStr} />
          <Row label="Start Date" value={job.start_date ? format(new Date(job.start_date), 'dd MMM yyyy') : '—'} />
          {job.end_date && <Row label="End Date" value={format(new Date(job.end_date), 'dd MMM yyyy')} />}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Full Specification</CardTitle></CardHeader>
        <CardContent>
          {job.full_spec ? (
            <div className="text-sm text-foreground whitespace-pre-wrap">{job.full_spec}</div>
          ) : job.raw_brief ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Raw Brief</p>
              <div className="text-sm text-foreground whitespace-pre-wrap">{job.raw_brief}</div>
              <Button variant="outline" size="sm" data-jarvis-id="job-generate-spec-button">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate Full Spec
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No specification yet. Add a raw brief or generate one with AI.</p>
          )}
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
function AdvertsTab({ jobId }: { jobId: string }) {
  const { data: adverts = [], isLoading } = useJobAdverts(jobId);

  if (isLoading) return <TableSkeleton />;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-sm">Job Adverts</CardTitle>
        <Button variant="outline" size="sm" data-jarvis-id="job-publish-button">
          <Send className="w-3.5 h-3.5 mr-1.5" /> Publish
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {adverts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No adverts yet. Generate adverts from the job specification.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Board</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Words</TableHead>
                <TableHead>Chars</TableHead>
                <TableHead>Published</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adverts.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium capitalize">{a.board || '—'}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{a.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{a.word_count ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{a.character_count ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {a.published_at ? format(new Date(a.published_at), 'dd MMM yyyy') : '—'}
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

// ---------- Shortlist Tab ----------
function ShortlistTab({ jobId }: { jobId: string }) {
  const { data: entries = [], isLoading } = useJobShortlist(jobId);

  if (isLoading) return <TableSkeleton />;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-sm">Shortlisted Candidates</CardTitle>
        <Button variant="outline" size="sm" data-jarvis-id="job-send-outreach-button">
          <Send className="w-3.5 h-3.5 mr-1.5" /> Send Outreach
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No candidates shortlisted yet. Run the AI shortlist to find matches.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Interest</TableHead>
                <TableHead>Outreach</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(e => (
                <TableRow key={e.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{(e as any).candidates?.name || '—'}</span>
                      {(e as any).candidates?.current_title && (
                        <span className="text-xs text-muted-foreground ml-1.5">{(e as any).candidates.current_title}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {e.match_score != null ? (
                      <Badge variant="outline" className={
                        e.match_score >= 80 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' :
                        e.match_score >= 50 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' :
                        'bg-muted text-muted-foreground'
                      }>
                        {e.match_score}%
                      </Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-sm">{SHORTLIST_STATUS[e.status] || e.status}</TableCell>
                  <TableCell className="text-sm capitalize">{e.candidate_interest || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {e.outreach_sent_at ? format(new Date(e.outreach_sent_at), 'dd MMM') : '—'}
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

// ---------- Applications Tab ----------
function ApplicationsTab({ jobId }: { jobId: string }) {
  const { data: apps = [], isLoading } = useJobApplications(jobId);

  if (isLoading) return <TableSkeleton />;

  return (
    <Card>
      <CardContent className="p-0">
        {apps.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No applications received yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>AI Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applied</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.map(a => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{a.applicant_name || '—'}</span>
                      {a.applicant_email && <span className="text-xs text-muted-foreground ml-1.5">{a.applicant_email}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">{a.source || '—'}</TableCell>
                  <TableCell>
                    {a.ai_match_score != null ? (
                      <Badge variant="outline">{a.ai_match_score}%</Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-sm">{APP_STATUS[a.status] || a.status}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(a.created_at), 'dd MMM yyyy')}
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
function ActivityTab({ jobId }: { jobId: string }) {
  return (
    <Card>
      <CardContent className="py-8 text-center">
        <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Activity timeline coming soon. All job events will appear here.</p>
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
