import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useCreateDeal, DEAL_STAGES, DEAL_STAGE_LABELS } from '@/hooks/use-deals';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateDealModal({ open, onOpenChange }: Props) {
  const { currentWorkspace } = useWorkspace();
  const createDeal = useCreateDeal();

  const [companyId, setCompanyId] = useState('');
  const [name, setName] = useState('');
  const [stage, setStage] = useState('lead');
  const [value, setValue] = useState('');
  const [probability, setProbability] = useState('10');
  const [closeDate, setCloseDate] = useState('');
  const [nextStep, setNextStep] = useState('');

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

  const handleSubmit = async () => {
    if (!currentWorkspace?.id || !companyId || !name.trim()) {
      toast.error('Name and company are required');
      return;
    }
    try {
      await createDeal.mutateAsync({
        workspace_id: currentWorkspace.id,
        company_id: companyId,
        title: name.trim(),
        stage,
        value: parseInt(value) || 0,
        probability: Math.min(100, Math.max(0, parseInt(probability) || 10)),
        expected_close_date: closeDate || null,
        next_step: nextStep || null,
      });
      toast.success('Deal created');
      onOpenChange(false);
      resetForm();
    } catch {
      toast.error('Failed to create deal');
    }
  };

  const resetForm = () => {
    setCompanyId('');
    setName('');
    setStage('lead');
    setValue('');
    setProbability('10');
    setCloseDate('');
    setNextStep('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Deal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Deal Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q3 Consulting Engagement" />
          </div>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Stage</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
              >
                {DEAL_STAGES.map((s) => (
                  <option key={s} value={s}>{DEAL_STAGE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Value (GBP)</Label>
              <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Probability (%)</Label>
              <Input type="number" min={0} max={100} value={probability} onChange={(e) => setProbability(e.target.value)} />
            </div>
            <div>
              <Label>Expected Close</Label>
              <Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Next Step</Label>
            <Input value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="e.g. Send proposal" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createDeal.isPending} className="gap-1.5">
            {createDeal.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
