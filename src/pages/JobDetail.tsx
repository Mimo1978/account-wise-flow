import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  type JobShortlistEntry,
} from '@/hooks/use-jobs';
import {
  useBoardFormats,
  useUpdateAdvert,
  usePublishAdvert,
  useToggleConfidential,
  BOARD_DEFINITIONS,
} from '@/hooks/use-job-adverts';
import { GenerateAdvertsModal } from '@/components/jobs/GenerateAdvertsModal';
import { BoardFormatModal } from '@/components/jobs/BoardFormatModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  Briefcase, FileText, Users, Inbox, Activity, Sparkles, Send, Play,
  Pause, CheckCircle2, XCircle, FileEdit, Copy, Globe, Loader2, Settings2,
  Trash2, Mail, MessageSquare, AlertTriangle, ChevronDown, ChevronUp, GripVertical,
  ShieldCheck, Archive, ArrowUp,
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
  pending: 'Pending', contacted: 'Contacted', responded: 'Responded',
  interviewing: 'Interviewing', rejected: 'Rejected', placed: 'Placed',
};

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
      <PageBackButton fallback="/jobs" />

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
        <TabsContent value="activity"><ActivityTab /></TabsContent>
      </Tabs>
    </div>
  );
};

// ---------- Overview Tab ----------
function OverviewTab({ job }: { job: any }) {
  const toggleConfidential = useToggleConfidential();
  const isConfidential = job.is_confidential ?? false;

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
  const { data: boardFormats = [] } = useBoardFormats();
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
                                onClick={() => publishAdvert.mutate({ id: a.id, board: a.board || '' })}
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
                      <div className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded-md p-3 max-h-48 overflow-y-auto">
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
function ShortlistTab({ jobId }: { jobId: string }) {
  const { data: entries = [], isLoading } = useJobShortlist(jobId);
  const removeFromShortlist = useRemoveFromShortlist();
  const runShortlist = useRunShortlist();

  if (isLoading) return <TableSkeleton />;

  const scoreBadgeClass = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
    if (score >= 60) return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-sm">Shortlisted Candidates</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => runShortlist.mutate(jobId)}
            disabled={runShortlist.isPending}
            data-jarvis-id="job-run-shortlist-trigger"
          >
            {runShortlist.isPending ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Matching...</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Run Shortlist</>
            )}
          </Button>
          <Button variant="outline" size="sm" data-jarvis-id="job-send-outreach-button">
            <Send className="w-3.5 h-3.5 mr-1.5" /> Send Outreach
          </Button>
        </div>
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
              onClick={() => runShortlist.mutate(jobId)}
              disabled={runShortlist.isPending}
            >
              {runShortlist.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Matching...</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Run Shortlist</>
              )}
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead className="w-20">Score</TableHead>
                <TableHead>Match Reasons</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(e => (
                <TableRow key={e.id}>
                  <TableCell>
                    <div className="space-y-0.5">
                      <span className="font-medium text-sm">{(e as any).candidates?.name || '—'}</span>
                      {(e as any).candidates?.current_title && (
                        <p className="text-xs text-muted-foreground">{(e as any).candidates.current_title}</p>
                      )}
                      {(e as any).candidates?.location && (
                        <p className="text-xs text-muted-foreground">{(e as any).candidates.location}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {e.match_score != null ? (
                      <Badge variant="outline" className={scoreBadgeClass(e.match_score)}>
                        {e.match_score}%
                      </Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(e.match_reasons || []).slice(0, 4).map((r, i) => (
                        <span key={i} className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          {r}
                        </span>
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
                  <TableCell className="text-sm">{SHORTLIST_STATUS[e.status] || e.status}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Email">
                        <Mail className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="SMS">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </Button>
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
                    {a.ai_match_score != null ? <Badge variant="outline">{a.ai_match_score}%</Badge> : '—'}
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
