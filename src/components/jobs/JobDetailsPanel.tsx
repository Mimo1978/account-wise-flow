import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToggleConfidential } from '@/hooks/use-job-adverts';
import { format } from 'date-fns';
import { Pencil, Check, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const JOB_TYPES = ['Permanent', 'Contract', 'Temporary', 'Interim', 'Part-Time', 'Freelance', 'Graduate', 'Apprenticeship'];
const REMOTE_OPTIONS = ['On-site', 'Hybrid', 'Remote', 'Remote-first'];
const CURRENCIES = ['GBP', 'EUR', 'USD', 'AED', 'SGD'];
const SENIORITY = ['Graduate', 'Junior', 'Mid-Level', 'Senior', 'Lead', 'Manager', 'Director', 'C-Suite'];
const PIPELINE_TYPES = ['Confirmed', 'Speculative', 'Internal', 'Proposal'];

interface JobDetailsPanelProps { job: any; }

export function JobDetailsPanel({ job }: JobDetailsPanelProps) {
  const queryClient = useQueryClient();
  const toggleConfidential = useToggleConfidential();
  const isConfidential = job.is_confidential ?? false;

  const save = async (field: string, value: any) => {
    const { error } = await supabase.from('jobs').update({ [field]: value, updated_at: new Date().toISOString() } as any).eq('id', job.id);
    if (error) { toast.error(`Failed to update ${field}`); } else {
      queryClient.invalidateQueries({ queryKey: ['jobs', job.id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Job Details</h3>
      </div>
      <div className="space-y-1.5">
        <DetailRow label="Type" required><SelectField value={job.job_type || ''} placeholder="Select type" options={JOB_TYPES.map(t => ({ value: t.toLowerCase(), label: t }))} onSave={v => save('job_type', v)} /></DetailRow>
        <DetailRow label="Pipeline"><SelectField value={job.pipeline_type || ''} placeholder="Select pipeline" options={PIPELINE_TYPES.map(t => ({ value: t.toLowerCase(), label: t }))} onSave={v => save('pipeline_type', v)} /></DetailRow>
        <DetailRow label="Seniority"><SelectField value={job.spec_seniority || ''} placeholder="Select level" options={SENIORITY.map(s => ({ value: s.toLowerCase(), label: s }))} onSave={v => save('spec_seniority', v)} /></DetailRow>
        <DetailRow label="Location" required><InlineTextField value={job.location || ''} placeholder="e.g. London" onSave={v => save('location', v)} /></DetailRow>
        <DetailRow label="Remote"><SelectField value={job.remote_policy || ''} placeholder="Select policy" options={REMOTE_OPTIONS.map(r => ({ value: r.toLowerCase(), label: r }))} onSave={v => save('remote_policy', v)} /></DetailRow>
        <DetailRow label="Salary"><SalaryField job={job} onSave={(f, v) => save(f, v)} /></DetailRow>
        <DetailRow label="Start Date"><DateField value={job.start_date || ''} onSave={v => save('start_date', v || null)} /></DetailRow>
        <DetailRow label="Reference"><InlineTextField value={job.reference || ''} placeholder="e.g. REF-001" onSave={v => save('reference', v)} /></DetailRow>
        <div className="flex items-center justify-between py-1.5"><Label className="text-xs text-muted-foreground">SC / DV Required</Label><Switch checked={job.security_clearance ?? false} onCheckedChange={v => save('security_clearance', v)} /></div>
        <div className="flex items-center justify-between py-1.5"><Label className="text-xs text-muted-foreground">Visa Sponsorship</Label><Switch checked={job.visa_sponsorship ?? false} onCheckedChange={v => save('visa_sponsorship', v)} /></div>
        <div className="flex items-center justify-between py-1.5">
          <div className="flex flex-col gap-0.5">
            <Label className="text-xs text-muted-foreground">Confidential</Label>
            <Switch checked={isConfidential} onCheckedChange={checked => toggleConfidential.mutate({ jobId: job.id, isConfidential: checked })} />
            <span className="text-[10px] text-muted-foreground">Hides company name</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 min-h-[32px]">
      <span className="text-xs text-muted-foreground shrink-0">{label}{required && <span className="text-destructive ml-0.5">*</span>}</span>
      <div className="flex-1 flex justify-end ml-4">{children}</div>
    </div>
  );
}

function SelectField({ value, placeholder, options, onSave }: { value: string; placeholder: string; options: { value: string; label: string }[]; onSave: (v: string) => void }) {
  return (
    <Select value={value || '__none__'} onValueChange={v => onSave(v === '__none__' ? '' : v)}>
      <SelectTrigger className="h-7 text-xs border-none shadow-none bg-transparent px-2 w-auto min-w-[100px] justify-end gap-1 hover:bg-muted/50 transition-colors [&>svg]:h-3 [&>svg]:w-3">
        <SelectValue placeholder={<span className="text-muted-foreground">{placeholder}</span>} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">— Not set —</SelectItem>
        {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function InlineTextField({ value, placeholder, onSave }: { value: string; placeholder: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const commit = () => { if (draft !== value) onSave(draft); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };
  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }} className="h-6 text-xs py-0 px-2 flex-1" placeholder={placeholder} />
        <button onClick={commit} className="text-primary"><Check className="h-3.5 w-3.5" /></button>
        <button onClick={cancel} className="text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
    );
  }
  return (
    <button onClick={() => { setDraft(value); setEditing(true); }} className="flex items-center gap-1.5 group text-right max-w-full">
      <span className={cn("text-xs truncate", value ? "text-foreground" : "text-muted-foreground")}>{value || placeholder}</span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}

function DateField({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const commit = () => { if (draft !== value) onSave(draft); setEditing(false); };
  const displayValue = value ? (() => { try { return format(new Date(value), 'dd MMM yyyy'); } catch { return value; } })() : null;
  if (editing) {
    return <Input autoFocus type="date" value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }} className="h-6 text-xs py-0 px-2 w-36" />;
  }
  return (
    <button onClick={() => { setDraft(value); setEditing(true); }} className="flex items-center gap-1.5 group text-right">
      <span className={cn("text-xs", displayValue ? "text-foreground" : "text-muted-foreground")}>{displayValue || 'Click to set'}</span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function SalaryField({ job, onSave }: { job: any; onSave: (field: string, value: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [min, setMin] = useState(job.salary_min?.toString() || '');
  const [max, setMax] = useState(job.salary_max?.toString() || '');
  const [currency, setCurrency] = useState(job.salary_currency || 'GBP');
  const commit = () => { onSave('salary_min', min ? Number(min) : null); onSave('salary_max', max ? Number(max) : null); onSave('salary_currency', currency); setEditing(false); };
  const hasValue = job.salary_min || job.salary_max;
  const displayStr = hasValue ? `${job.salary_currency || 'GBP'} ${job.salary_min?.toLocaleString() ?? '?'} – ${job.salary_max?.toLocaleString() ?? '?'}` : null;
  if (editing) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1">
          <select value={currency} onChange={e => setCurrency(e.target.value)} className="h-6 text-xs border rounded px-1 bg-background">
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <Input value={min} onChange={e => setMin(e.target.value)} placeholder="Min" className="h-6 text-xs py-0 px-2 w-20" type="number" />
          <span className="text-xs text-muted-foreground">–</span>
          <Input value={max} onChange={e => setMax(e.target.value)} placeholder="Max" className="h-6 text-xs py-0 px-2 w-20" type="number" />
        </div>
        <div className="flex gap-2">
          <button onClick={commit} className="text-xs text-primary hover:underline">Save</button>
          <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">Cancel</button>
        </div>
      </div>
    );
  }
  return (
    <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 group text-right">
      <span className={cn("text-xs", displayStr ? "text-foreground" : "text-muted-foreground")}>{displayStr || 'Click to set salary'}</span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
