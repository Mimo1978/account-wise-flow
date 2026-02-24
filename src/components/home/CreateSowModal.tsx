import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useCreateSow } from '@/hooks/use-sows';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateSowModal({ open, onOpenChange }: Props) {
  const { currentWorkspace } = useWorkspace();
  const createSow = useCreateSow();

  const [companyId, setCompanyId] = useState('');
  const [engagementId, setEngagementId] = useState('');
  const [sowRef, setSowRef] = useState('');
  const [status, setStatus] = useState('draft');
  const [billingModel, setBillingModel] = useState('fixed');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [renewalDate, setRenewalDate] = useState('');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');

  const { data: companies = [] } = useQuery({
    queryKey: ['companies-list', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data } = await supabase
        .from('companies')
        .select('id, name')
        .eq('team_id', currentWorkspace.id)
        .order('name');
      return data ?? [];
    },
    enabled: !!currentWorkspace?.id && open,
  });

  const { data: engagements = [] } = useQuery({
    queryKey: ['engagements-list', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data } = await supabase
        .from('engagements')
        .select('id, name')
        .eq('workspace_id', currentWorkspace.id)
        .order('name');
      return data ?? [];
    },
    enabled: !!currentWorkspace?.id && open,
  });

  const handleSubmit = () => {
    if (!currentWorkspace?.id || !companyId) {
      toast.error('Please select a company');
      return;
    }

    createSow.mutate(
      {
        workspace_id: currentWorkspace.id,
        company_id: companyId,
        engagement_id: engagementId && engagementId !== '__none__' ? engagementId : null,
        sow_ref: sowRef || null,
        status,
        billing_model: billingModel,
        start_date: startDate || null,
        end_date: endDate || null,
        renewal_date: renewalDate || null,
        value: parseInt(value) || 0,
        notes: notes || null,
      },
      {
        onSuccess: () => {
          toast.success('SOW created');
          onOpenChange(false);
          resetForm();
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  const resetForm = () => {
    setCompanyId('');
    setEngagementId('');
    setSowRef('');
    setStatus('draft');
    setBillingModel('fixed');
    setStartDate('');
    setEndDate('');
    setRenewalDate('');
    setValue('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add SOW / Contract</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Company *</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Engagement (optional)</Label>
            <Select value={engagementId} onValueChange={setEngagementId}>
              <SelectTrigger><SelectValue placeholder="Link to engagement" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {engagements.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>SOW Reference</Label>
              <Input value={sowRef} onChange={(e) => setSowRef(e.target.value)} placeholder="SOW-001" />
            </div>
            <div className="grid gap-1.5">
              <Label>Value (GBP)</Label>
              <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="signed">Signed</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Billing Model</Label>
              <Select value={billingModel} onValueChange={setBillingModel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="time_materials">Time & Materials</SelectItem>
                  <SelectItem value="retained">Retained</SelectItem>
                  <SelectItem value="contingency">Contingency</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Renewal Date</Label>
              <Input type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contract details..." rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createSow.isPending}>
            {createSow.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Create SOW
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
