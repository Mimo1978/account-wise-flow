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
  existingAdverts?: Set<string>; // boards that already have adverts
}

export function GenerateAdvertsModal({ open, onOpenChange, onGenerate, onOpenBoardFormat, existingBoardFormats, isGenerating, existingAdverts = new Set() }: Props) {
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

  // Pre-select boards without existing adverts when modal opens
  const boardEntries = Object.entries(BOARD_DEFINITIONS);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Select Boards & Generate</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Select which job boards to generate adverts for:</p>
        <div className="space-y-3 pt-2">
          {boardEntries.map(([key, def]) => {
            const hasExisting = existingAdverts.has(key);
            return (
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
                    {hasExisting && (
                      <span className="ml-2 text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                        ✓ Exists — will regenerate
                      </span>
                    )}
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
              </div>
            );
          })}
        </div>

        {/* Warning if regenerating existing adverts */}
        {Array.from(selected).some(b => existingAdverts.has(b)) && (
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-2 rounded-md">
            ⚠️ Regenerating will replace existing advert content. Any manual edits will be lost.
          </p>
        )}

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
