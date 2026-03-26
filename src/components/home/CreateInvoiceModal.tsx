import { useState, useEffect } from 'react';
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
  /** Pre-fill company */
  prefillCompanyId?: string;
  /** Pre-fill engagement */
  prefillEngagementId?: string;
}

export function CreateInvoiceModal({ open, onOpenChange, prefillCompanyId, prefillEngagementId }: Props) {
  const { currentWorkspace } = useWorkspace();
  const createInvoice = useCreateInvoice();

  const [companyId, setCompanyId] = useState('');
  const [engagementId, setEngagementId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('draft');
  const [notes, setNotes] = useState('');

  // Apply prefills when modal opens
  useEffect(() => {
    if (open) {
      setCompanyId(prefillCompanyId ?? '');
      setEngagementId(prefillEngagementId ?? '');
    }
  }, [open, prefillCompanyId, prefillEngagementId]);

  // Fetch from both companies and crm_companies for the dropdown
  const { data: companies = [] } = useQuery({
    queryKey: ['companies-list-merged', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      // crm_invoices FK references crm_companies, so we need crm_companies IDs
      const [{ data: crmData }, { data: coreData }] = await Promise.all([
        supabase.from('crm_companies' as any).select('id, name').is('deleted_at', null).order('name'),
        supabase.from('companies').select('id, name').eq('team_id', currentWorkspace.id).is('deleted_at', null).order('name'),
      ]);
      // Merge, preferring crm_companies (since that's where the FK points)
      const seen = new Set<string>();
      const merged: { id: string; name: string }[] = [];
      for (const c of ((crmData as any[]) || [])) {
        const key = c.name?.toLowerCase().trim();
        if (key && !seen.has(key)) { seen.add(key); merged.push(c); }
      }
      for (const c of (coreData || [])) {
        const key = c.name?.toLowerCase().trim();
        if (key && !seen.has(key)) { seen.add(key); merged.push(c); }
      }
      return merged.sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!currentWorkspace?.id && open,
  });

  const { data: engagements = [] } = useQuery({
    queryKey: ['engagements-list', currentWorkspace?.id, companyId],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      let query = supabase
        .from('engagements')
        .select('id, name, company_id')
        .eq('workspace_id', currentWorkspace.id)
        .order('name');

      // Filter engagements by selected company when one is chosen
      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data } = await query;
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
              onChange={(e) => {
                setCompanyId(e.target.value);
                // Reset engagement if company changes and it no longer matches
                if (engagementId) {
                  const eng = engagements.find(en => en.id === engagementId);
                  if (eng && eng.company_id !== e.target.value) {
                    setEngagementId('');
                  }
                }
              }}
            >
              <option value="">Select company…</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Project (optional)</Label>
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
