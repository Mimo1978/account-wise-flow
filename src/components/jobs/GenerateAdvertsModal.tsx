import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { BOARD_DEFINITIONS } from '@/hooks/use-job-adverts';
import { Loader2, Settings2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (boards: string[]) => Promise<void>;
  onOpenBoardFormat: (board: string) => void;
  existingBoardFormats: Set<string>;
  isGenerating: boolean;
}

export function GenerateAdvertsModal({ open, onOpenChange, onGenerate, onOpenBoardFormat, existingBoardFormats, isGenerating }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (board: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(board)) next.delete(board);
      else next.add(board);
      return next;
    });
  };

  const handleGenerate = async () => {
    if (selected.size === 0) return;
    await onGenerate(Array.from(selected));
    setSelected(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Generate Adverts</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Select which job boards to generate adverts for:</p>
        <div className="space-y-3 pt-2">
          {Object.entries(BOARD_DEFINITIONS).map(([key, def]) => (
            <div key={key} className="flex items-start gap-3">
              <Checkbox
                id={`board-${key}`}
                checked={selected.has(key)}
                onCheckedChange={() => toggle(key)}
                disabled={isGenerating}
              />
              <div className="flex-1">
                <Label htmlFor={`board-${key}`} className="text-sm font-medium cursor-pointer">
                  {def.label}
                </Label>
                <p className="text-xs text-muted-foreground">{def.description}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => onOpenBoardFormat(key)}
                title="Format settings"
              >
                <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
              {existingBoardFormats.has(key) && (
                <span className="text-[10px] text-emerald-600 font-medium mt-0.5">Saved</span>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={selected.size === 0 || isGenerating}>
            {isGenerating ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Generating...</>
            ) : (
              `Generate ${selected.size} advert${selected.size !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
