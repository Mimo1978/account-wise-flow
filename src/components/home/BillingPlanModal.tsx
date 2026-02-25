import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateBillingPlan, useUpdateBillingPlan, type BillingPlan } from '@/hooks/use-billing-plans';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Info } from 'lucide-react';

interface BillingPlanModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  engagementId: string;
  companyId: string;
  existingPlan?: BillingPlan | null;
}

/* ─── Plan-type rules ─── */
const PLAN_TYPE_RULES: Record<string, {
  label: string;
  hint: string;
  allowedFrequencies: string[];
  allowedModes: string[];
  defaultFrequency: string;
  defaultMode: string;
}> = {
  consulting: {
    label: 'Consulting',
    hint: 'Supports monthly/weekly billing with fixed or day-rate modes.',
    allowedFrequencies: ['weekly', 'biweekly', 'monthly', 'quarterly'],
    allowedModes: ['fixed', 'day_rate', 'estimate'],
    defaultFrequency: 'monthly',
    defaultMode: 'fixed',
  },
  recruitment: {
    label: 'Recruitment',
    hint: 'Fixed-fee milestone billing. Use "Create milestone invoice" to invoice on stage change.',
    allowedFrequencies: ['milestone'],
    allowedModes: ['fixed'],
    defaultFrequency: 'milestone',
    defaultMode: 'fixed',
  },
  managed_services: {
    label: 'Managed Services',
    hint: 'Fixed monthly or quarterly retainer.',
    allowedFrequencies: ['monthly', 'quarterly'],
    allowedModes: ['fixed'],
    defaultFrequency: 'monthly',
    defaultMode: 'fixed',
  },
};

const ALL_FREQUENCIES: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  milestone: 'Milestone',
};

const ALL_MODES: Record<string, string> = {
  fixed: 'Fixed Amount',
  day_rate: 'Day Rate',
  estimate: 'Estimate',
};

export function BillingPlanModal({
  open,
  onOpenChange,
  workspaceId,
  engagementId,
  companyId,
  existingPlan,
}: BillingPlanModalProps) {
  const { toast } = useToast();
  const createPlan = useCreateBillingPlan();
  const updatePlan = useUpdateBillingPlan();
  const isEdit = !!existingPlan;

  const [planName, setPlanName] = useState('');
  const [planType, setPlanType] = useState('consulting');
  const [frequency, setFrequency] = useState('monthly');
  const [billingMode, setBillingMode] = useState('fixed');
  const [fixedAmount, setFixedAmount] = useState('');
  const [dayRate, setDayRate] = useState('');
  const [includedDays, setIncludedDays] = useState('');
  const [estimatedDays, setEstimatedDays] = useState('');
  const [invoiceDayOfMonth, setInvoiceDayOfMonth] = useState('');
  const [vatRate, setVatRate] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [nextRunDate, setNextRunDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  const rules = PLAN_TYPE_RULES[planType] ?? PLAN_TYPE_RULES.consulting;

  // When plan type changes, reset frequency & mode to valid defaults
  const handlePlanTypeChange = (newType: string) => {
    setPlanType(newType);
    const r = PLAN_TYPE_RULES[newType] ?? PLAN_TYPE_RULES.consulting;
    if (!r.allowedFrequencies.includes(frequency)) setFrequency(r.defaultFrequency);
    if (!r.allowedModes.includes(billingMode)) setBillingMode(r.defaultMode);
  };

  useEffect(() => {
    if (open && existingPlan) {
      setPlanName(existingPlan.plan_name);
      setPlanType(existingPlan.plan_type);
      setFrequency(existingPlan.frequency);
      setBillingMode(existingPlan.billing_mode);
      setFixedAmount(existingPlan.fixed_amount?.toString() ?? '');
      setDayRate(existingPlan.day_rate?.toString() ?? '');
      setIncludedDays(existingPlan.included_days?.toString() ?? '');
      setEstimatedDays(existingPlan.estimated_days?.toString() ?? '');
      setInvoiceDayOfMonth(existingPlan.invoice_day_of_month?.toString() ?? '');
      setVatRate(existingPlan.vat_rate?.toString() ?? '');
      setPoNumber(existingPlan.po_number ?? '');
      setNextRunDate(existingPlan.next_run_date ?? '');
      setEndDate(existingPlan.end_date ?? '');
      setNotes(existingPlan.notes ?? '');
    } else if (open && !existingPlan) {
      setPlanName('');
      setPlanType('consulting');
      setFrequency('monthly');
      setBillingMode('fixed');
      setFixedAmount('');
      setDayRate('');
      setIncludedDays('');
      setEstimatedDays('');
      setInvoiceDayOfMonth('');
      setVatRate('');
      setPoNumber('');
      setNextRunDate('');
      setEndDate('');
      setNotes('');
    }
  }, [open, existingPlan]);

  const isMilestone = frequency === 'milestone';
  const isPending = createPlan.isPending || updatePlan.isPending;

  const handleSubmit = async () => {
    if (!planName.trim()) {
      toast({ title: 'Plan name is required', variant: 'destructive' });
      return;
    }

    const payload = {
      plan_name: planName.trim(),
      plan_type: planType,
      frequency,
      billing_mode: billingMode,
      fixed_amount: fixedAmount ? parseFloat(fixedAmount) : null,
      day_rate: dayRate ? parseFloat(dayRate) : null,
      included_days: includedDays ? parseInt(includedDays) : null,
      estimated_days: estimatedDays ? parseInt(estimatedDays) : null,
      invoice_day_of_month: invoiceDayOfMonth ? parseInt(invoiceDayOfMonth) : null,
      vat_rate: vatRate ? parseFloat(vatRate) : null,
      po_number: poNumber || null,
      next_run_date: isMilestone ? null : (nextRunDate || null),
      end_date: endDate || null,
      notes: notes || null,
    };

    try {
      if (isEdit && existingPlan) {
        await updatePlan.mutateAsync({ id: existingPlan.id, ...payload });
        toast({ title: 'Billing plan updated' });
      } else {
        await createPlan.mutateAsync({
          workspace_id: workspaceId,
          engagement_id: engagementId,
          company_id: companyId,
          ...payload,
        });
        toast({ title: 'Billing plan created' });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Billing Plan' : 'Create Billing Plan'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Plan Name */}
          <div>
            <Label className="text-xs">Plan Name *</Label>
            <Input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="e.g. Monthly Retainer" />
          </div>

          {/* Plan Type + Frequency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Plan Type</Label>
              <Select value={planType} onValueChange={handlePlanTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PLAN_TYPE_RULES).map(([val, r]) => (
                    <SelectItem key={val} value={val}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {rules.allowedFrequencies.map((f) => (
                    <SelectItem key={f} value={f}>{ALL_FREQUENCIES[f]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Plan type hint */}
          <div className="flex items-start gap-2 rounded-md bg-muted/50 p-2.5">
            <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">{rules.hint}</p>
          </div>

          {/* Billing Mode */}
          <div>
            <Label className="text-xs">Billing Mode</Label>
            <Select value={billingMode} onValueChange={setBillingMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {rules.allowedModes.map((m) => (
                  <SelectItem key={m} value={m}>{ALL_MODES[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount fields based on billing mode */}
          {(billingMode === 'fixed' || billingMode === 'estimate') && (
            <div>
              <Label className="text-xs">
                {isMilestone ? 'Milestone Fee (GBP)' : 'Fixed Amount (GBP)'}
              </Label>
              <Input type="number" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} placeholder="0.00" />
            </div>
          )}
          {(billingMode === 'day_rate' || billingMode === 'estimate') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Day Rate (GBP)</Label>
                <Input type="number" value={dayRate} onChange={(e) => setDayRate(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <Label className="text-xs">{billingMode === 'day_rate' ? 'Included Days' : 'Estimated Days'}</Label>
                <Input
                  type="number"
                  value={billingMode === 'day_rate' ? includedDays : estimatedDays}
                  onChange={(e) => billingMode === 'day_rate' ? setIncludedDays(e.target.value) : setEstimatedDays(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {/* Invoice day + VAT — hide invoice day for milestone */}
          <div className="grid grid-cols-2 gap-3">
            {frequency === 'monthly' && !isMilestone && (
              <div>
                <Label className="text-xs">Invoice Day of Month</Label>
                <Input type="number" min="1" max="28" value={invoiceDayOfMonth} onChange={(e) => setInvoiceDayOfMonth(e.target.value)} placeholder="1-28" />
              </div>
            )}
            <div>
              <Label className="text-xs">VAT Rate (%)</Label>
              <Input type="number" value={vatRate} onChange={(e) => setVatRate(e.target.value)} placeholder="e.g. 20" />
            </div>
          </div>

          {/* PO Number */}
          <div>
            <Label className="text-xs">PO Number</Label>
            <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Optional" />
          </div>

          {/* Dates — hide next run for milestone */}
          <div className={`grid gap-3 ${isMilestone ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {!isMilestone && (
              <div>
                <Label className="text-xs">Next Run Date</Label>
                <Input type="date" value={nextRunDate} onChange={(e) => setNextRunDate(e.target.value)} />
              </div>
            )}
            <div>
              <Label className="text-xs">End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          {isMilestone && (
            <div className="flex items-start gap-2 rounded-md bg-muted/50 p-2.5">
              <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Milestone plans are invoiced manually. Use the "Create milestone invoice" button on the Billing tab when a stage changes.
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." rows={2} />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
            {isEdit ? 'Update Plan' : 'Create Plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
