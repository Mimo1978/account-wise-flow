import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/components/ui/sonner';
import { Search, MapPin, Briefcase, Calendar, Upload, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PublicJob {
  id: string;
  title: string;
  company_id: string | null;
  is_confidential: boolean;
  job_type: string | null;
  location: string | null;
  remote_policy: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  created_at: string | null;
  workspace_id: string;
  companies: { name: string; logo_url: string | null } | null;
  job_adverts: { content: string | null }[];
}

function usePublicJobs() {
  return useQuery({
    queryKey: ['public-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, company_id, is_confidential, job_type, location, remote_policy, salary_min, salary_max, salary_currency, created_at, workspace_id, companies(name, logo_url), job_adverts!inner(content)')
        .eq('status', 'active')
        .eq('job_adverts.board', 'internal')
        .eq('job_adverts.status', 'published')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PublicJob[];
    },
  });
}

const TYPE_COLORS: Record<string, string> = {
  permanent: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  contract: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  temp: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
};

function formatSalary(min: number | null, max: number | null, currency: string | null) {
  if (!min && !max) return 'Competitive';
  const c = currency || 'GBP';
  const fmt = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

export default function PublicJobBoard() {
  const { data: jobs = [], isLoading } = usePublicJobs();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [applyingTo, setApplyingTo] = useState<PublicJob | null>(null);

  const locations = useMemo(() => {
    const locs = new Set<string>();
    jobs.forEach(j => j.location && locs.add(j.location));
    return Array.from(locs).sort();
  }, [jobs]);

  // Build company filter options (only non-confidential companies with active jobs)
  const companyOptions = useMemo(() => {
    const map = new Map<string, string>();
    jobs.forEach(j => {
      if (!j.is_confidential && j.company_id && j.companies?.name) {
        map.set(j.company_id, j.companies.name);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [jobs]);

  const filtered = useMemo(() => {
    return jobs.filter(j => {
      if (typeFilter !== 'all' && j.job_type !== typeFilter) return false;
      if (locationFilter && j.location !== locationFilter) return false;
      if (companyFilter !== 'all' && j.company_id !== companyFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const companyName = j.is_confidential ? '' : (j.companies?.name || '');
        const advert = j.job_adverts?.[0]?.content || '';
        if (!j.title.toLowerCase().includes(q) && !companyName.toLowerCase().includes(q) && !advert.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [jobs, typeFilter, locationFilter, companyFilter, search]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg text-foreground tracking-tight">Client Mapper</span>
          </div>
        </div>
      </header>

      <section className="bg-gradient-to-b from-primary/5 to-background py-16 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tight">
            Find Your Next Role
          </h1>
          <p className="text-lg text-muted-foreground">
            Browse open positions from top employers
          </p>
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search by title, company, or keyword…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-12 h-12 text-base"
            />
          </div>
        </div>
      </section>

      {/* Filters */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Job Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="permanent">Permanent</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
              <SelectItem value="temp">Temp</SelectItem>
            </SelectContent>
          </Select>
          {locations.length > 0 && (
            <Select value={locationFilter || 'all'} onValueChange={v => setLocationFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {companyOptions.length > 1 && (
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Company" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companyOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <span className="text-sm text-muted-foreground ml-auto">
            {filtered.length} role{filtered.length !== 1 ? 's' : ''} found
          </span>
        </div>

        {/* Job Cards */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><CardContent className="p-6 space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-9 w-28" />
              </CardContent></Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-foreground">No roles match your search</h3>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(job => {
              const advert = job.job_adverts?.[0]?.content || '';
              const snippet = advert.length > 150 ? advert.slice(0, 150) + '…' : advert;
              const isConfidential = job.is_confidential;
              const companyDisplay = isConfidential ? 'Our Client' : (job.companies?.name || 'Company');
              const logoUrl = isConfidential ? null : (job.companies as any)?.logo_url;
              return (
                <Card key={job.id} className="flex flex-col hover:shadow-md transition-shadow">
                  <CardContent className="p-5 flex flex-col flex-1 gap-3">
                    <div className="flex items-start gap-3">
                      {!isConfidential && (
                        <Avatar className="w-10 h-10 rounded-lg shrink-0">
                          {logoUrl && <AvatarImage src={logoUrl} alt={companyDisplay} />}
                          <AvatarFallback className="rounded-lg bg-muted text-xs font-semibold">
                            {(job.companies?.name || 'C').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-bold text-foreground text-base leading-snug">{job.title}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">{companyDisplay}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {job.job_type && (
                        <Badge variant="outline" className={TYPE_COLORS[job.job_type] || ''}>
                          {job.job_type.charAt(0).toUpperCase() + job.job_type.slice(1)}
                        </Badge>
                      )}
                      {job.remote_policy && job.remote_policy !== 'onsite' && (
                        <Badge variant="outline" className="capitalize">{job.remote_policy}</Badge>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {job.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>{job.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 shrink-0" />
                        <span>{formatSalary(job.salary_min, job.salary_max, job.salary_currency)}</span>
                      </div>
                    </div>
                    {snippet && <p className="text-sm text-muted-foreground line-clamp-3">{snippet}</p>}
                    <div className="mt-auto pt-3 flex items-center justify-between">
                      <Button size="sm" onClick={() => setApplyingTo(job)}>Apply Now</Button>
                      {job.created_at && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-6 text-center text-xs text-muted-foreground">
        Powered by Client Mapper
      </footer>

      {/* Application Sheet */}
      <ApplicationSheet job={applyingTo} onClose={() => setApplyingTo(null)} />
    </div>
  );
}

function ApplicationSheet({ job, onClose }: { job: PublicJob | null; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', linkedin: '', coverLetter: '' });
  const [gdpr, setGdpr] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const resetForm = useCallback(() => {
    setForm({ name: '', email: '', phone: '', linkedin: '', coverLetter: '' });
    setGdpr(false);
    setCvFile(null);
    setSubmitted(false);
  }, []);

  const handleClose = () => { resetForm(); onClose(); };

  const submit = useMutation({
    mutationFn: async () => {
      if (!job) throw new Error('No job selected');
      if (!form.name.trim() || !form.email.trim()) throw new Error('Name and email are required');
      if (!gdpr) throw new Error('You must consent to GDPR');

      let cv_url: string | null = null;
      if (cvFile) {
        const path = `applications/${job.id}/${Date.now()}_${cvFile.name}`;
        const { error: uploadError } = await supabase.storage.from('cvs').upload(path, cvFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('cvs').getPublicUrl(path);
        cv_url = publicUrl;
      }

      const { error } = await supabase.from('job_applications').insert({
        job_id: job.id,
        workspace_id: job.workspace_id,
        applicant_name: form.name.trim(),
        applicant_email: form.email.trim(),
        applicant_phone: form.phone.trim() || null,
        linkedin_url: form.linkedin.trim() || null,
        cover_letter: form.coverLetter.trim() || null,
        cv_url,
        source: 'internal_board',
        gdpr_consent: true,
        status: 'new',
      } as any);
      if (error) throw error;

      // Fire-and-forget notification + AI processing
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      fetch(`https://${projectId}.supabase.co/functions/v1/notify-new-application`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({
          job_id: job.id,
          applicant_name: form.name.trim(),
          applicant_email: form.email.trim(),
          applicant_phone: form.phone.trim() || null,
        }),
      }).catch(() => {});

      // Trigger AI scoring pipeline - get the inserted application ID first
      const { data: insertedApp } = await supabase
        .from('job_applications')
        .select('id')
        .eq('job_id', job.id)
        .eq('applicant_email', form.email.trim())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (insertedApp) {
        fetch(`https://${projectId}.supabase.co/functions/v1/process-application`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          body: JSON.stringify({ application_id: insertedApp.id }),
        }).catch(() => {});
      }
    },
    onSuccess: () => setSubmitted(true),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={!!job} onOpenChange={open => { if (!open) handleClose(); }}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{submitted ? 'Application Submitted' : `Apply — ${job?.title ?? ''}`}</SheetTitle>
        </SheetHeader>

        {submitted ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-500" />
            <h3 className="text-lg font-semibold text-foreground">Thank you!</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Your application has been received. We'll be in touch shortly.
            </p>
            <Button variant="outline" onClick={handleClose}>Close</Button>
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="app-name">Full Name *</Label>
              <Input id="app-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="app-email">Email *</Label>
              <Input id="app-email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="app-phone">Phone</Label>
              <Input id="app-phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="app-linkedin">LinkedIn URL</Label>
              <Input id="app-linkedin" value={form.linkedin} onChange={e => setForm(f => ({ ...f, linkedin: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="app-cover">Cover Letter</Label>
              <Textarea id="app-cover" rows={4} value={form.coverLetter} onChange={e => setForm(f => ({ ...f, coverLetter: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>CV Upload (PDF)</Label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type === 'application/pdf') setCvFile(f); }}
                onClick={() => document.getElementById('cv-file-input')?.click()}
              >
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                {cvFile ? (
                  <p className="text-sm text-foreground font-medium">{cvFile.name}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Drag & drop PDF or click to browse</p>
                )}
                <input
                  id="cv-file-input"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setCvFile(f); }}
                />
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox id="gdpr" checked={gdpr} onCheckedChange={v => setGdpr(!!v)} className="mt-0.5" />
              <Label htmlFor="gdpr" className="text-xs text-muted-foreground leading-snug cursor-pointer">
                I consent to my data being stored and used for recruitment purposes
              </Label>
            </div>
            <Button
              className="w-full"
              disabled={!form.name.trim() || !form.email.trim() || !gdpr || submit.isPending}
              onClick={() => submit.mutate()}
            >
              {submit.isPending ? 'Submitting…' : 'Submit Application'}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
