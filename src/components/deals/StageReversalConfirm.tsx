import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';

interface Props {
  dealName: string;
  targetStage: string;
  children: React.ReactElement;
  onConfirm: () => void;
}

export function StageReversalConfirm({ dealName, targetStage, children, onConfirm }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={(e) => { e.preventDefault(); setOpen(true); }}>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" align="start">
        <div className="flex items-start gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm">Move <strong>{dealName}</strong> back to <strong>{targetStage}</strong>? This will update the pipeline.</p>
        </div>
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" onClick={() => { onConfirm(); setOpen(false); }}>Confirm</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
