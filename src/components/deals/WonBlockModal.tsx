import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Briefcase, Receipt } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealTitle: string;
  hasProject: boolean;
  hasInvoice: boolean;
  onCreateProject: () => void;
  onCreateInvoice: () => void;
}

export function WonBlockModal({ open, onOpenChange, dealTitle, hasProject, hasInvoice, onCreateProject, onCreateInvoice }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>To mark "{dealTitle}" as Won you need:</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
            {hasProject ? (
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500 shrink-0" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">Linked Project</p>
              <p className="text-xs text-muted-foreground">{hasProject ? 'Project is linked' : 'No project linked to this deal'}</p>
            </div>
            {!hasProject && (
              <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={onCreateProject}>
                <Briefcase className="w-3 h-3" /> Create
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
            {hasInvoice ? (
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500 shrink-0" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">Invoice Exists</p>
              <p className="text-xs text-muted-foreground">{hasInvoice ? 'Invoice found' : 'No invoice for this project yet'}</p>
            </div>
            {!hasInvoice && (
              <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={onCreateInvoice}>
                <Receipt className="w-3 h-3" /> Create
              </Button>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
