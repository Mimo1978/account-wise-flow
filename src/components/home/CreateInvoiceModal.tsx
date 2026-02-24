import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useCreateInvoice } from '@/hooks/use-invoices';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateInvoiceModal({ open, onOpenChange }: Props) {
  const { currentWorkspace } = useWorkspace();
  const createInvoice = useCreateInvoice();

  const [companyId, setCompanyId] = useState('');
  const [engagementId, setEngagementId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('draft');
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

  const handleSubmit = async () => {
    if (!currentWorkspace?.id || !companyId) {
      toast.error('Company is required');
      return;
    }

    try {
      await createInvoice.mutateAsync({
        workspace_id: currentWorkspace.id,
        company_id: companyId,
        engagement_id: engagementId || null,
        invoice_number: invoiceNumber || null,
        amount: parseInt(amount) || 0,
        due_date: dueDate || null,
        status,
        notes: notes || null,
      });
      toast.success('Invoice created');
      onOpenChange(false);
      resetForm();
    } catch {
      toast.error('Failed to create invoice');
    }
  };

  const resetForm = () => {
    setCompanyId('');
    setEngagementId('');
    setInvoiceNumber('');
    setAmount('');
    setDueDate('');
    setStatus('draft');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Company *</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="">Select company…</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Engagement (optional)</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={engagementId}
              onChange={(e) => setEngagementId(e.target.value)}
            >
              <option value="">None</option>
              {engagements.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Invoice #</Label>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV-001" />
            </div>
            <div>
              <Label>Amount (GBP)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label>Status</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
              </select>
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createInvoice.isPending} className="gap-1.5">
            {createInvoice.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
