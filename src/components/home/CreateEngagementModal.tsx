import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateEngagement } from '@/hooks/use-engagements';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TYPES = [
  { value: 'consulting', label: 'Consulting' },
  { value: 'recruitment', label: 'Recruitment' },
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

export function CreateEngagementModal({ open, onOpenChange }: Props) {
  const { currentWorkspace } = useWorkspace();
  const createMutation = useCreateEngagement();

  const [name, setName] = useState('');
  const [engagementType, setEngagementType] = useState('consulting');
  const [stage, setStage] = useState('active');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !currentWorkspace) return;

    try {
      await createMutation.mutateAsync({
        workspace_id: currentWorkspace.id,
        name: name.trim(),
        engagement_type: engagementType,
        stage,
        description: description.trim() || null,
      });
      toast.success('Project created');
      setName('');
      setDescription('');
      setEngagementType('consulting');
      setStage('active');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create project');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="eng-name">Project Name</Label>
            <Input
              id="eng-name"
              placeholder="e.g. Q1 Delivery — Acme"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
