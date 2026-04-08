import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useCreateDeal } from '@/hooks/use-deals';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type DealType = 'contractor' | 'permanent' | 'consulting';

const TYPE_CONFIG: Record<DealType, { label: string; sub: string; context: string; color: string; btn: string; ctxColor: string }> = {
  contractor: {
    label: 'Contractor',
    sub: 'Day rate · timesheet · monthly invoice',
    context: 'Log weekly timesheets after placement. Monthly invoices generate automatically from approved days × day rate.',
    color: 'border-amber-500 bg-amber-50 dark:bg-amber-950/20',
    btn: 'bg-amber-600 hover:bg-amber-500 text-white',
    ctxColor: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200',
  },
  permanent: {
    label: 'Permanent',
    sub: 'One-off fee · single invoice',
    context: 'One invoice raised on placement. Enter salary and fee % — the invoice amount calculates automatically.',
    color: 'border-violet-500 bg-violet-50 dark:bg-violet-950/20',
    btn: 'bg-violet-600 hover:bg-violet-500 text-white',
    ctxColor: 'bg-violet-50 border-violet-200 text-violet-900 dark:bg-violet-950/30 dark:border-violet-800 dark:text-violet-200',
  },
  consulting: {
    label: 'Consulting',
    sub: 'Retainer · project · SOW billing',
    context: 'Links to a delivery project with a billing plan. Fixed retainer or day rate invoiced on schedule.',
    color: 'border-blue-500 bg-blue-50 dark:bg-blue-950/20',
    btn: 'bg-blue-600 hover:bg-blue-500 text-white',
    ctxColor: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-200',
  },
};

interface Props { open: boolean; onOpenChange: (open: boolean) => void; }

export function CreateDealModal({ open, onOpenChange }: Props) {
  const { currentWorkspace } = useWorkspace();
  const createDeal = useCreateDeal();
  const [dealType, setDealType] = useState<DealType>('contractor');
  const [form, setForm] = useState({
    title: '', companyId: '', contactId: '', candidateSearch: '',
    candidateId: '', candidateName: '',
    dayRate: '', salary: '', feePercentage: '20',
    startDate: '', endDate: '', billingEmail: '',
    value: '', probability: '50', closeDate: '',
  });
  const [candidateResults, setCandidateResults] = useState<any[]>([]);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const { data: crmCompanies = [] } = useQuery({
    queryKey: ['crm-companies-modal', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data } = await supabase.from('crm_companies' as any).select('id, name').order('name').limit(100);
      return data ?? [];
    },
    enabled: !!currentWorkspace?.id && open,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['crm-contacts-modal', form.companyId],
    queryFn: async () => {
      if (!form.companyId) return [];
      const { data } = await supabase.from('crm_contacts' as any).select('id, first_name, last_name').eq('company_id', form.companyId).order('last_name').limit(50);
      return data ?? [];
    },
    enabled: !!form.companyId && open,
  });

  useEffect(() => {
    if (!form.candidateSearch.trim()) { setCandidateResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('candidates' as any).select('id, name, current_title').ilike('name', `%${form.candidateSearch}%`).limit(8);
      setCandidateResults(data || []);
    }, 250);
    return () => clearTimeout(t);
  }, [form.candidateSearch]);

  const feeAmount = dealType === 'permanent' && form.salary && form.feePercentage
    ? Math.round(Number(form.salary) * Number(form.feePercentage) / 100)
    : null;

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('Deal name is required'); return; }
    if (!form.companyId) { toast.error('Company is required'); return; }
    try {
      await createDeal.mutateAsync({
        workspace_id: currentWorkspace?.id,
        company_id: form.companyId,
        title: form.title,
        stage: 'lead',
        deal_type: dealType,
        candidate_id: form.candidateId || null,
        day_rate: dealType === 'contractor' && form.dayRate ? Number(form.dayRate) : null,
        salary: dealType === 'permanent' && form.salary ? Number(form.salary) : null,
        fee_percentage: dealType === 'permanent' ? Number(form.feePercentage) : null,
        value: feeAmount || (form.value ? Number(form.value) : 0),
        start_date: form.startDate || null,
        end_date: form.endDate || null,
        billing_email: form.billingEmail || null,
        probability: Number(form.probability),
        expected_close_date: form.closeDate || null,
        contact_id: form.contactId || null,
      } as any);
      toast.success('Deal created');
      onOpenChange(false);
      setForm({ title:'',companyId:'',contactId:'',candidateSearch:'',candidateId:'',candidateName:'',dayRate:'',salary:'',feePercentage:'20',startDate:'',endDate:'',billingEmail:'',value:'',probability:'50',closeDate:'' });
    } catch { toast.error('Failed to create deal'); }
  };

  const cfg = TYPE_CONFIG[dealType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create deal</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Pick a type — the form adapts to show only what you need
          </p>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(TYPE_CONFIG) as [DealType, typeof TYPE_CONFIG[DealType]][]).map(([type, c]) => (
            <button
              key={type}
              type="button"
              onClick={() => setDealType(type)}
              className={cn('rounded-lg border-2 p-2.5 text-center transition-all', dealType === type ? c.color : 'border-border hover:border-border/80')}
            >
              <p className="text-xs font-semibold">{c.label}</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{c.sub}</p>
            </button>
          ))}
        </div>

        <div className={cn('rounded-md border p-2.5 text-xs leading-relaxed', cfg.ctxColor)}>
          {cfg.context}
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Deal name *</Label>
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder={dealType === 'contractor' ? 'e.g. Richie McKern — Iseg contract' : dealType === 'permanent' ? 'e.g. Senior Dev — Iseg permanent' : 'e.g. Q2 Consulting — Acme'} className="mt-1 h-8 text-xs" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Company *</Label>
              <Select value={form.companyId} onValueChange={(v) => set('companyId', v)}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Select company…" /></SelectTrigger>
                <SelectContent>
                  {crmCompanies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Contact (hiring manager)</Label>
              <Select value={form.contactId} onValueChange={(v) => set('contactId', v)} disabled={!form.companyId}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Select contact…" /></SelectTrigger>
                <SelectContent>
                  {contacts.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(dealType === 'contractor' || dealType === 'permanent') && (
            <div>
              <Label className="text-xs">Candidate</Label>
              {form.candidateId ? (
                <div className="flex items-center gap-2 mt-1 px-3 py-1.5 rounded-md border bg-muted/50 text-xs">
                  <span className="flex-1">{form.candidateName}</span>
                  <button type="button" onClick={() => set('candidateId', '')} className="text-muted-foreground hover:text-foreground">✕</button>
                </div>
              ) : (
                <div className="relative mt-1">
                  <Input value={form.candidateSearch} onChange={(e) => set('candidateSearch', e.target.value)} placeholder="Search talent database…" className="h-8 text-xs" />
                  {candidateResults.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                      {candidateResults.map((c: any) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { set('candidateId', c.id); set('candidateName', c.name); set('candidateSearch', ''); setCandidateResults([]); }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex justify-between items-center"
                        >
                          <span>{c.name}</span>
                          <span className="text-muted-foreground">{c.current_title || '—'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {dealType === 'contractor' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Day rate (GBP)</Label>
                  <Input type="number" value={form.dayRate} onChange={(e) => set('dayRate', e.target.value)} placeholder="650" className="mt-1 h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Invoice frequency</Label>
                  <Select defaultValue="monthly">
                    <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Start date</Label>
                  <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} className="mt-1 h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">End date</Label>
                  <Input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} className="mt-1 h-8 text-xs" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Billing email (accounts team)</Label>
                <Input value={form.billingEmail} onChange={(e) => set('billingEmail', e.target.value)} placeholder="accounts@client.com" className="mt-1 h-8 text-xs" />
              </div>
            </>
          )}

          {dealType === 'permanent' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Annual salary (GBP)</Label>
                  <Input type="number" value={form.salary} onChange={(e) => set('salary', e.target.value)} placeholder="75000" className="mt-1 h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">
                    Fee % {feeAmount ? <span className="text-muted-foreground">→ £{feeAmount.toLocaleString()}</span> : ''}
                  </Label>
                  <Input type="number" value={form.feePercentage} onChange={(e) => set('feePercentage', e.target.value)} className="mt-1 h-8 text-xs" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Start date</Label>
                <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} className="mt-1 h-8 text-xs" />
              </div>
            </>
          )}

          {dealType === 'consulting' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Deal value (GBP)</Label>
                  <Input type="number" value={form.value} onChange={(e) => set('value', e.target.value)} placeholder="50000" className="mt-1 h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Expected close</Label>
                  <Input type="date" value={form.closeDate} onChange={(e) => set('closeDate', e.target.value)} className="mt-1 h-8 text-xs" />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={createDeal.isPending} className={cn('gap-1.5', cfg.btn)}>
            {createDeal.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create {cfg.label.toLowerCase()} deal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
