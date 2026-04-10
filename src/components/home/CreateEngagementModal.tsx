import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateEngagement } from '@/hooks/use-engagements';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill company when creating from a deal or company context */
  prefillCompanyId?: string;
  /** Pre-fill deal link */
  prefillDealId?: string;
  /** Pre-fill name */
  prefillName?: string;
  /** Pre-fill value */
  prefillValue?: number;
}

const TYPES = [
  { value: 'recruitment', label: 'Recruitment' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'permanent', label: 'Permanent' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'managed_service', label: 'Managed Service' },
  { value: 'other', label: 'Other' },
];

const STAGES = [
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
];

export function CreateEngagementModal({ open, onOpenChange, prefillCompanyId, prefillDealId, prefillName, prefillValue }: Props) {
  const { currentWorkspace } = useWorkspace();
  const createMutation = useCreateEngagement();

  const [name, setName] = useState(prefillName ?? '');
  const [companyId, setCompanyId] = useState(prefillCompanyId ?? '');
  const [engagementType, setEngagementType] = useState('consulting');
  const [stage, setStage] = useState('active');
  const [forecastValue, setForecastValue] = useState(prefillValue?.toString() ?? '');
  const [description, setDescription] = useState('');

  // Reset form when modal opens with prefills
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setName(prefillName ?? '');
      setCompanyId(prefillCompanyId ?? '');
      setForecastValue(prefillValue?.toString() ?? '');
    }
    onOpenChange(v);
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !currentWorkspace) return;
    if (!companyId) {
      toast.error('Please select a company');
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        workspace_id: currentWorkspace.id,
        name: name.trim(),
        company_id: companyId,
        engagement_type: engagementType,
        stage,
        description: description.trim() || null,
        forecast_value: forecastValue ? parseInt(forecastValue) : 0,
      });

      // If created from a deal, link the deal to this engagement
      if (prefillDealId && result?.id) {
        await supabase
          .from('crm_deals')
          .update({ engagement_id: result.id } as any)
          .eq('id', prefillDealId);
      }

      toast.success('Project created');
      setName('');
      setCompanyId('');
      setDescription('');
      setForecastValue('');
      setEngagementType('consulting');
      setStage('active');
      handleOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create project');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="eng-name">Project Name *</Label>
            <Input
              id="eng-name"
              placeholder="e.g. Q1 Delivery — Acme"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={engagementType} onValueChange={setEngagementType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Forecast Value (GBP)</Label>
            <Input
              type="number"
              placeholder="0"
              value={forecastValue}
              onChange={(e) => setForecastValue(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="eng-desc">Description (optional)</Label>
            <Textarea
              id="eng-desc"
              placeholder="Brief description…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || !companyId || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
