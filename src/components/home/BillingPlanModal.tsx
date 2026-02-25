import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateBillingPlan, useUpdateBillingPlan, type BillingPlan } from '@/hooks/use-billing-plans';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface BillingPlanModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  engagementId: string;
  companyId: string;
  existingPlan?: BillingPlan | null;
}

const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'milestone', label: 'Milestone' },
];

const BILLING_MODES = [
  { value: 'fixed', label: 'Fixed Amount' },
  { value: 'day_rate', label: 'Day Rate' },
  { value: 'estimate', label: 'Estimate' },
];

const PLAN_TYPES = [
  { value: 'consulting', label: 'Consulting' },
  { value: 'recruitment', label: 'Recruitment' },
  { value: 'managed_services', label: 'Managed Services' },
];

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
      next_run_date: nextRunDate || null,
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
              <Select value={planType} onValueChange={setPlanType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLAN_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Billing Mode */}
          <div>
            <Label className="text-xs">Billing Mode</Label>
            <Select value={billingMode} onValueChange={setBillingMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BILLING_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Amount fields based on billing mode */}
          {(billingMode === 'fixed' || billingMode === 'estimate') && (
            <div>
              <Label className="text-xs">Fixed Amount (GBP)</Label>
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

          {/* Invoice day + VAT */}
          <div className="grid grid-cols-2 gap-3">
            {frequency === 'monthly' && (
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

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Next Run Date</Label>
              <Input type="date" value={nextRunDate} onChange={(e) => setNextRunDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

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
