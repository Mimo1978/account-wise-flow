import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Briefcase, MapPin, DollarSign, Globe, Shield, Send, Eye, Save, ChevronRight, CheckCircle2, Zap, Star, Link, Info, Newspaper, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';

const EXTERNAL_BOARDS = [
  { id: 'jobserve', label: 'JobServe', logo: '🟦', category: 'Tech & IT', description: 'Leading IT & tech contractor board', popular: true },
  { id: 'reed', label: 'Reed', logo: '🔴', category: 'General', description: "UK's #1 job site — 14M+ candidates", popular: true },
  { id: 'indeed', label: 'Indeed', logo: '🟣', category: 'General', description: "World's most-visited job site", popular: true },
  { id: 'linkedin', label: 'LinkedIn', logo: '🔵', category: 'Professional', description: 'Professional network — 900M+ members', popular: true },
  { id: 'efinancialcareers', label: 'eFinancialCareers', logo: '🏦', category: 'Finance', description: 'Global financial services jobs', popular: false },
  { id: 'cwjobs', label: 'CWJobs', logo: '💻', category: 'Tech & IT', description: 'UK IT professionals', popular: false },
  { id: 'totaljobs', label: 'TotalJobs', logo: '🟡', category: 'General', description: '280K+ live jobs, 17M+ candidates', popular: false },
  { id: 'cv_library', label: 'CV-Library', logo: '📄', category: 'General', description: '21M+ UK CVs', popular: false },
  { id: 'own_board', label: 'Your Job Board', logo: '⭐', category: 'Own', description: 'Post to your public-facing job board', popular: false },
];

const JOB_TYPES = ['Permanent', 'Contract', 'Temporary', 'Interim', 'Part-Time', 'Freelance', 'Graduate', 'Apprenticeship'];
const EMPLOYMENT_TYPES = ['Full Time', 'Part Time', 'Contract', 'Flexible'];
const REMOTE_OPTIONS = ['On-site', 'Hybrid', 'Remote', 'Remote-first'];
const CURRENCIES = ['GBP', 'EUR', 'USD', 'AED', 'SGD'];
const SALARY_PERIODS = ['per annum', 'per day', 'per hour'];
const SECTORS = ['Technology & IT', 'Finance & Banking', 'Healthcare', 'Engineering', 'Marketing & Sales', 'Legal', 'HR & Recruitment', 'Operations', 'Creative & Design', 'Education', 'Retail & FMCG', 'Property'];
const SENIORITY = ['Graduate', 'Junior', 'Mid-Level', 'Senior', 'Lead', 'Manager', 'Director', 'C-Suite'];
const POST_DURATIONS = ['7 days', '14 days', '28 days', '60 days', '90 days'];

const STEPS = [
  { id: 'role', label: 'Role Details', icon: Briefcase },
  { id: 'location', label: 'Location & Work', icon: MapPin },
  { id: 'compensation', label: 'Compensation', icon: DollarSign },
  { id: 'description', label: 'Description', icon: Newspaper },
  { id: 'boards', label: 'Post To Boards', icon: Send },
];

interface PostJobFormProps {
  jobId: string;
  jobTitle: string;
  jobSpec: string | null;
  existingData?: {
    location?: string | null;
    job_type?: string | null;
    remote_policy?: string | null;
    salary_min?: number | null;
    salary_max?: number | null;
    salary_currency?: string;
    spec_sectors?: string[] | null;
  };
  onClose?: () => void;
}

export function PostJobForm({ jobId, jobTitle, jobSpec, existingData, onClose }: PostJobFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [postResults, setPostResults] = useState<any[]>([]);

  const [role, setRole] = useState({
    title: jobTitle || '',
    reference: '',
    sector: existingData?.spec_sectors?.[0] || '',
    seniority: '',
    jobType: existingData?.job_type || '',
    employmentType: 'Full Time',
    securityClearance: false,
    visaSponsorship: false,
    closingDate: '',
    postDuration: '28 days',
  });

  const [location, setLocation] = useState({
    city: existingData?.location || '',
    postalCode: '',
    country: 'United Kingdom',
    remotePolicy: existingData?.remote_policy || '',
    hybridDaysOffice: '',
  });

  const [compensation, setCompensation] = useState({
    currency: existingData?.salary_currency || 'GBP',
    salaryMin: existingData?.salary_min?.toString() || '',
    salaryMax: existingData?.salary_max?.toString() || '',
    period: 'per annum',
    showSalary: true,
    benefits: '',
    rateSingle: '',
    isRate: false,
  });

  const [description, setDescription] = useState({
    overview: '',
    responsibilities: '',
    requirements: '',
    niceToHave: '',
    aboutTeam: '',
    usedSpec: false,
  });

  const [boards, setBoards] = useState({
    selected: new Set(['own_board']),
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    applicationUrl: '',
    applicationMethod: 'email' as 'email' | 'url',
    confidential: false,
  });

  const stepValid = [
    role.title.trim().length > 0 && role.jobType.length > 0 && role.sector.length > 0,
    location.city.trim().length > 0 && location.remotePolicy.length > 0,
    true,
    description.overview.trim().length > 50 || description.usedSpec,
    boards.selected.size > 0,
  ];

  const toggleBoard = (id: string) => {
    setBoards(prev => {
      const next = new Set(prev.selected);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...prev, selected: next };
    });
  };

  const fillFromSpec = () => {
    if (!jobSpec) return;
    setDescription(d => ({ ...d, overview: jobSpec.substring(0, 2000), usedSpec: true }));
    toast.success('Job spec loaded into description');
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const fullDescription = [
        description.overview,
        description.responsibilities ? `Key Responsibilities\n${description.responsibilities}` : '',
        description.requirements ? `Required Skills & Experience\n${description.requirements}` : '',
        description.niceToHave ? `Nice to Have\n${description.niceToHave}` : '',
        description.aboutTeam ? `About the Team\n${description.aboutTeam}` : '',
        compensation.benefits ? `Package & Benefits\n${compensation.benefits}` : '',
      ].filter(Boolean).join('\n\n');

      const payload = {
        job_id: jobId,
        boards: Array.from(boards.selected),
        title: role.title,
        reference: role.reference || undefined,
        sector: role.sector || undefined,
        seniority: role.seniority || undefined,
        job_type: role.jobType || undefined,
        employment_type: role.employmentType || undefined,
        security_clearance: role.securityClearance,
        visa_sponsorship: role.visaSponsorship,
        closing_date: role.closingDate || undefined,
        post_duration: role.postDuration,
        city: location.city,
        postal_code: location.postalCode || undefined,
        country: location.country,
        remote_policy: location.remotePolicy,
        hybrid_days: location.hybridDaysOffice || undefined,
        currency: compensation.currency,
        salary_min: compensation.salaryMin ? Number(compensation.salaryMin) : undefined,
        salary_max: compensation.salaryMax ? Number(compensation.salaryMax) : undefined,
        rate: compensation.rateSingle ? Number(compensation.rateSingle) : undefined,
        rate_period: compensation.period,
        show_salary: compensation.showSalary,
        benefits: compensation.benefits || undefined,
        description: fullDescription,
        contact_name: boards.contactName || undefined,
        contact_email: boards.contactEmail || undefined,
        contact_phone: boards.contactPhone || undefined,
        application_url: boards.applicationUrl || undefined,
        application_method: boards.applicationMethod,
        is_confidential: boards.confidential,
      };

      const { data, error } = await supabase.functions.invoke('post-to-boards', { body: payload });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Posting failed');

      setPostResults(data.results || []);
      setSubmitted(true);
      const posted = data.summary?.posted || 0;
      const queued = data.summary?.queued || 0;
      if (posted > 0) toast.success(`Posted to ${posted} board${posted !== 1 ? 's' : ''}${queued > 0 ? `, ${queued} queued` : ''}`);
      else if (queued > 0) toast.info(`${queued} board${queued !== 1 ? 's' : ''} queued — add API keys in Admin > Integrations`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to post job');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="space-y-6 py-6 px-2">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-foreground">Job Submission Complete</h3>
          <p className="text-sm text-muted-foreground">Applications will appear in the Applications tab as they arrive.</p>
        </div>

        <div className="space-y-2">
          {postResults.map((r, idx) => {
            const boardDef = EXTERNAL_BOARDS.find(b => b.id === r.board);
            return (
              <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <span className="text-xl">{boardDef?.logo || '📋'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{boardDef?.label || r.board}</p>
                  {r.message && <p className="text-xs text-muted-foreground truncate">{r.message}</p>}
                </div>
                <Badge variant={r.status === 'posted' ? 'default' : r.status === 'queued' ? 'secondary' : 'destructive'}>
                  {r.status === 'posted' ? '✓ Live' : r.status === 'queued' ? '⏳ Queued' : r.status === 'failed' ? '✗ Failed' : 'Skipped'}
                </Badge>
              </div>
            );
          })}
        </div>

        <Button className="w-full" onClick={onClose}>Done</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Step indicator */}
      <div className="border-b bg-muted/30 px-4 py-3">
        <div className="flex items-center justify-center gap-1">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isCurrent = i === currentStep;
            const isDone = i < currentStep;
            const isValid = stepValid[i];
            return (
              <div key={step.id} className="flex items-center gap-1">
                <button onClick={() => i <= currentStep && setCurrentStep(i)} disabled={i > currentStep} className={cn('flex flex-col items-center gap-1 transition-all', i <= currentStep ? 'cursor-pointer' : 'cursor-not-allowed opacity-40')}>
                  <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-xs transition-all', isCurrent ? 'bg-primary text-primary-foreground shadow-sm' : isDone && isValid ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>
                    {isDone && isValid ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={cn('text-[10px] font-medium', isCurrent ? 'text-foreground' : 'text-muted-foreground')}>{step.label}</span>
                </button>
                {i < STEPS.length - 1 && <div className={cn('w-8 h-px mt-[-12px]', isDone ? 'bg-emerald-500/40' : 'bg-border')} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {currentStep === 0 && (
          <div className="space-y-6 max-w-2xl">
            <SectionHeader icon={<Briefcase className="h-4 w-4" />} title="Role Basics" />
            <div className="space-y-4">
              <FormField label="Job Title" required>
                <Input value={role.title} onChange={e => setRole(r => ({ ...r, title: e.target.value }))} placeholder="e.g. Senior Java Developer" />
                <FieldHint>Be specific — "Senior Java Developer" outperforms "Developer".</FieldHint>
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Job Type" required>
                  <Select value={role.jobType} onValueChange={v => setRole(r => ({ ...r, jobType: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>{JOB_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
                <FormField label="Employment Type">
                  <Select value={role.employmentType} onValueChange={v => setRole(r => ({ ...r, employmentType: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{EMPLOYMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Sector" required>
                  <Select value={role.sector} onValueChange={v => setRole(r => ({ ...r, sector: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select sector" /></SelectTrigger>
                    <SelectContent>{SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
                <FormField label="Seniority">
                  <Select value={role.seniority} onValueChange={v => setRole(r => ({ ...r, seniority: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                    <SelectContent>{SENIORITY.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Reference (optional)">
                  <Input value={role.reference} onChange={e => setRole(r => ({ ...r, reference: e.target.value }))} placeholder="e.g. REF-2026-001" />
                </FormField>
                <FormField label="Post Duration">
                  <Select value={role.postDuration} onValueChange={v => setRole(r => ({ ...r, postDuration: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{POST_DURATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
              </div>
              <FormField label="Closing Date (optional)">
                <Input type="date" value={role.closingDate} onChange={e => setRole(r => ({ ...r, closingDate: e.target.value }))} />
              </FormField>
            </div>
            <Separator />
            <SectionHeader icon={<Shield className="h-4 w-4" />} title="Compliance" />
            <div className="space-y-3">
              <ToggleRow label="Security Clearance Required" description="Candidates must hold or be eligible for clearance" checked={role.securityClearance} onCheckedChange={v => setRole(r => ({ ...r, securityClearance: v }))} />
              <ToggleRow label="Visa Sponsorship Available" description="Organisation can sponsor work visas" checked={role.visaSponsorship} onCheckedChange={v => setRole(r => ({ ...r, visaSponsorship: v }))} />
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-6 max-w-2xl">
            <SectionHeader icon={<MapPin className="h-4 w-4" />} title="Location" />
            <div className="space-y-4">
              <FormField label="City / Area" required>
                <Input value={location.city} onChange={e => setLocation(l => ({ ...l, city: e.target.value }))} placeholder="e.g. London, Manchester, Edinburgh" />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Postal Code">
                  <Input value={location.postalCode} onChange={e => setLocation(l => ({ ...l, postalCode: e.target.value }))} placeholder="e.g. EC2A 1NT" />
                </FormField>
                <FormField label="Country">
                  <Select value={location.country} onValueChange={v => setLocation(l => ({ ...l, country: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{['United Kingdom', 'Ireland', 'United States', 'Germany', 'France', 'Netherlands', 'Singapore', 'UAE'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
              </div>
            </div>
            <Separator />
            <SectionHeader icon={<Globe className="h-4 w-4" />} title="Working Pattern" />
            <div>
              <div className="grid grid-cols-2 gap-3">
                {REMOTE_OPTIONS.map(opt => (
                  <button key={opt} onClick={() => setLocation(l => ({ ...l, remotePolicy: opt }))} className={cn('px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all text-left', location.remotePolicy === opt ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-background text-muted-foreground hover:border-primary/40')}>
                    <div className="font-medium">{opt}</div>
                    <div className="text-xs opacity-70 mt-0.5 font-normal">{opt === 'On-site' ? '5 days in office' : opt === 'Hybrid' ? 'Split home/office' : opt === 'Remote' ? 'Mostly remote' : 'Fully remote'}</div>
                  </button>
                ))}
              </div>
            </div>
            {location.remotePolicy === 'Hybrid' && (
              <FormField label="Days in Office">
                <Select value={location.hybridDaysOffice} onValueChange={v => setLocation(l => ({ ...l, hybridDaysOffice: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{['1 day', '2 days', '3 days', '4 days', 'Flexible'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
            )}
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6 max-w-2xl">
            <SectionHeader icon={<DollarSign className="h-4 w-4" />} title="Compensation" />
            <FieldHint>Roles with salaries shown get 30% more applications. Candidates filter by salary — be transparent.</FieldHint>
            <div className="space-y-3">
              <ToggleRow label="Show Salary on Listing" description="Display salary range publicly" checked={compensation.showSalary} onCheckedChange={v => setCompensation(c => ({ ...c, showSalary: v }))} />
              <ToggleRow label="Day / Hourly Rate" description="Switch to rate-based pricing" checked={compensation.isRate} onCheckedChange={v => setCompensation(c => ({ ...c, isRate: v }))} />
            </div>
            {compensation.isRate ? (
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Currency">
                  <Select value={compensation.currency} onValueChange={v => setCompensation(c => ({ ...c, currency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
                <FormField label="Rate">
                  <div className="flex gap-2">
                    <Input type="number" value={compensation.rateSingle} onChange={e => setCompensation(c => ({ ...c, rateSingle: e.target.value }))} placeholder="500" className="flex-1" />
                    <Select value={compensation.period} onValueChange={v => setCompensation(c => ({ ...c, period: v }))}>
                      <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{SALARY_PERIODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </FormField>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <FormField label="Currency">
                    <Select value={compensation.currency} onValueChange={v => setCompensation(c => ({ ...c, currency: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Min Salary">
                    <Input type="number" value={compensation.salaryMin} onChange={e => setCompensation(c => ({ ...c, salaryMin: e.target.value }))} placeholder="60,000" />
                  </FormField>
                  <FormField label="Max Salary">
                    <Input type="number" value={compensation.salaryMax} onChange={e => setCompensation(c => ({ ...c, salaryMax: e.target.value }))} placeholder="80,000" />
                  </FormField>
                </div>
                <FormField label="Pay Period">
                  <div className="flex gap-2">
                    {SALARY_PERIODS.map(p => (
                      <button key={p} onClick={() => setCompensation(c => ({ ...c, period: p }))} className={cn('px-3 py-1.5 rounded-md border text-sm transition-all', compensation.period === p ? 'border-primary bg-primary/10 text-foreground font-medium' : 'border-border text-muted-foreground hover:border-primary/40')}>{p}</button>
                    ))}
                  </div>
                </FormField>
              </div>
            )}
            <Separator />
            <FormField label="Benefits & Package">
              <Textarea value={compensation.benefits} onChange={e => setCompensation(c => ({ ...c, benefits: e.target.value }))} placeholder="e.g. 25 days holiday, private health insurance, pension matched to 5%..." rows={3} />
              <FieldHint>List everything — even small perks matter to candidates.</FieldHint>
            </FormField>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6 max-w-2xl">
            <div className="flex items-center justify-between">
              <SectionHeader icon={<Newspaper className="h-4 w-4" />} title="Job Description" />
              {jobSpec && (
                <Button variant="outline" size="sm" onClick={fillFromSpec} className="flex-shrink-0">
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Import from Spec
                </Button>
              )}
            </div>
            {jobSpec && !description.usedSpec && <InfoBanner>You have a job spec — click <strong>Import from Spec</strong> to pre-fill, or write your own below.</InfoBanner>}
            {description.usedSpec && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-500/10 rounded-md px-3 py-2">
                <CheckCircle2 className="h-3.5 w-3.5" />Spec content imported — customise below as needed
              </div>
            )}
            <FormField label="Role Overview" required>
              <Textarea value={description.overview} onChange={e => setDescription(d => ({ ...d, overview: e.target.value }))} placeholder="Write a compelling overview of the role and opportunity..." rows={5} />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{description.overview.length} characters</span>
                <span>Recommended: 300–800 chars</span>
              </div>
            </FormField>
            <FormField label="Key Responsibilities">
              <Textarea value={description.responsibilities} onChange={e => setDescription(d => ({ ...d, responsibilities: e.target.value }))} placeholder={"• Design and build core features\n• Collaborate with product and design\n• Own delivery from spec to deployment"} rows={5} />
              <FieldHint>Use bullet points. 5–8 responsibilities. Start each with a strong verb.</FieldHint>
            </FormField>
            <FormField label="Essential Skills & Experience">
              <Textarea value={description.requirements} onChange={e => setDescription(d => ({ ...d, requirements: e.target.value }))} placeholder={"• 5+ years Python or Java\n• Strong SQL skills\n• Cloud platform experience (AWS / GCP / Azure)"} rows={5} />
            </FormField>
            <FormField label="Nice to Have (optional)">
              <Textarea value={description.niceToHave} onChange={e => setDescription(d => ({ ...d, niceToHave: e.target.value }))} placeholder={"• Kubernetes experience\n• Open source contributions"} rows={3} />
            </FormField>
            <FormField label="About the Team / Company">
              <Textarea value={description.aboutTeam} onChange={e => setDescription(d => ({ ...d, aboutTeam: e.target.value }))} placeholder="What makes this team or company special..." rows={3} />
            </FormField>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <SectionHeader icon={<Send className="h-4 w-4" />} title="Select Job Boards" />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1.5 flex-shrink-0">
                <Zap className="h-3 w-3 text-primary" />Broadbean-style multi-post
              </div>
            </div>
            <InfoBanner><strong>One-click multi-posting:</strong> Select all boards and we'll format and submit your advert to each simultaneously — no copy-paste, no separate logins.</InfoBanner>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Popular Boards</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                {EXTERNAL_BOARDS.filter(b => b.popular).map(board => <BoardCard key={board.id} board={board} selected={boards.selected.has(board.id)} onToggle={() => toggleBoard(board.id)} />)}
              </div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">More Boards</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {EXTERNAL_BOARDS.filter(b => !b.popular).map(board => <BoardCard key={board.id} board={board} selected={boards.selected.has(board.id)} onToggle={() => toggleBoard(board.id)} />)}
              </div>
            </div>
            <Separator />
            <SectionHeader icon={<Link className="h-4 w-4" />} title="Application Settings" />
            <div className="space-y-4 max-w-2xl">
              <div className="flex gap-4">
                {(['email', 'url'] as const).map(method => (
                  <button key={method} onClick={() => setBoards(b => ({ ...b, applicationMethod: method }))} className={cn('flex-1 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all text-left', boards.applicationMethod === method ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-primary/40')}>
                    {method === 'email' ? '✉️ Apply by Email' : '🔗 Apply via URL'}
                    <div className="text-xs opacity-70 mt-0.5 font-normal">{method === 'email' ? 'Applications sent to your inbox' : 'Link to your ATS or careers page'}</div>
                  </button>
                ))}
              </div>
              {boards.applicationMethod === 'email' ? (
                <div className="grid gap-3">
                  <FormField label="Contact Name"><Input value={boards.contactName} onChange={e => setBoards(b => ({ ...b, contactName: e.target.value }))} placeholder="Recruiter or hiring manager name" /></FormField>
                  <FormField label="Application Email"><Input type="email" value={boards.contactEmail} onChange={e => setBoards(b => ({ ...b, contactEmail: e.target.value }))} placeholder="applications@yourcompany.com" /></FormField>
                  <FormField label="Phone (optional)"><PhoneInput value={boards.contactPhone} onChange={(v) => setBoards(b => ({ ...b, contactPhone: v }))} /></FormField>
                </div>
              ) : (
                <FormField label="Application URL"><Input value={boards.applicationUrl} onChange={e => setBoards(b => ({ ...b, applicationUrl: e.target.value }))} placeholder="https://careers.yourcompany.com/jobs/..." /></FormField>
              )}
              <ToggleRow label="Confidential Listing" description="Hide company name from candidates" checked={boards.confidential} onCheckedChange={v => setBoards(b => ({ ...b, confidential: v }))} />
            </div>
            {boards.selected.size > 0 && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="py-3 px-4">
                  <p className="text-xs font-medium text-foreground mb-2">Posting to {boards.selected.size} board{boards.selected.size !== 1 ? 's' : ''}:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(boards.selected).map(id => {
                      const b = EXTERNAL_BOARDS.find(bd => bd.id === id);
                      return b ? <Badge key={id} variant="secondary" className="text-xs">{b.logo} {b.label}</Badge> : null;
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="border-t px-6 py-4 flex items-center justify-between bg-background">
        <div className="flex gap-2">
          {currentStep > 0 && <Button variant="ghost" size="sm" onClick={() => setCurrentStep(s => s - 1)}>Back</Button>}
          <Button variant="ghost" size="sm"><Save className="h-3.5 w-3.5 mr-1.5" />Save Draft</Button>
        </div>
        <div className="flex gap-2">
          {currentStep < STEPS.length - 1 ? (
            <Button size="sm" disabled={!stepValid[currentStep]} onClick={() => setCurrentStep(s => s + 1)}>Continue <ChevronRight className="h-4 w-4 ml-1" /></Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm"><Eye className="h-3.5 w-3.5 mr-1.5" />Preview</Button>
              <Button size="sm" disabled={isSubmitting || !stepValid[currentStep]} onClick={handleSubmit}>
                {isSubmitting ? <>Posting to {boards.selected.size} boards…</> : <>Post to {boards.selected.size} Board{boards.selected.size !== 1 ? 's' : ''}</>}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <div className="flex items-center gap-2 text-sm font-semibold text-foreground">{icon}<span>{title}</span></div>;
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs font-medium text-foreground">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>{children}</div>;
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground mt-1">{children}</p>;
}

function ToggleRow({ label, description, checked, onCheckedChange }: { label: string; description: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3.5 py-2.5 border border-border/50">
      <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary" />
      <span>{children}</span>
    </div>
  );
}

function BoardCard({ board, selected, onToggle }: { board: typeof EXTERNAL_BOARDS[0]; selected: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={cn('flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left w-full', selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30 bg-background')}>
      <span className="text-xl flex-shrink-0">{board.logo}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{board.label}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{board.category}</Badge>
          {board.popular && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
        </div>
        <p className="text-xs text-muted-foreground truncate">{board.description}</p>
      </div>
      <div className={cn('h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all', selected ? 'border-primary bg-primary' : 'border-muted-foreground/30')}>
        {selected && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />}
      </div>
    </button>
  );
}
