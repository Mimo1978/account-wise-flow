import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight, Check } from "lucide-react";
import { getTransitionChecklist, type WorkflowStage } from "@/lib/project-workflows";
import { useAdvanceProjectStage } from "@/hooks/use-project-workflow";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectType: string;
  currentStage: string | null;
  targetStage: WorkflowStage | null;
  completedStages: Array<{ stage: string; completed_at: string }>;
  workspaceId: string;
  onAdvanced?: () => void;
}

export function StageTransitionPanel({
  open,
  onOpenChange,
  projectId,
  projectType,
  currentStage,
  targetStage,
  completedStages,
  workspaceId,
  onAdvanced,
}: Props) {
  const advanceMut = useAdvanceProjectStage();
  const [notes, setNotes] = useState("");
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  if (!targetStage) return null;

  const checklist = currentStage
    ? getTransitionChecklist(projectType, currentStage, targetStage.id)
    : [];

  const uncheckedCount = checklist.length - checkedItems.size;

  const handleAdvance = async () => {
    try {
      await advanceMut.mutateAsync({
        projectId,
        workspaceId,
        currentStage,
        nextStage: targetStage.id,
        completedStages,
        notes: notes.trim() || undefined,
      });
      toast.success(`Project advanced to ${targetStage.label}`);
      setNotes("");
      setCheckedItems(new Set());
      onOpenChange(false);
      onAdvanced?.();
    } catch (err) {
      toast.error("Failed to advance stage");
    }
  };

  const toggleItem = (idx: number) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] max-w-full flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5" style={{ color: targetStage.colour }} />
            Move to: {targetStage.label}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Stage description */}
          <div className="rounded-lg border border-border p-4 bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: targetStage.colour }}
              />
              <span className="font-semibold text-sm">{targetStage.label}</span>
            </div>
            <p className="text-sm text-muted-foreground">{targetStage.description}</p>
          </div>

          {/* Checklist */}
          {checklist.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Recommended before advancing</h3>
                {uncheckedCount > 0 && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20 gap-1 text-xs">
                    <AlertTriangle className="w-3 h-3" />
                    {uncheckedCount} unchecked
                  </Badge>
                )}
              </div>
              <div className="space-y-2">
                {checklist.map((item, idx) => (
                  <label
                    key={idx}
                    className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={checkedItems.has(idx)}
                      onCheckedChange={() => toggleItem(idx)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm">{item.label}</p>
                      {item.hint && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.hint}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add a note about this transition..."
              rows={3}
            />
          </div>
        </div>

        <SheetFooter className="flex gap-2 pt-4 border-t border-border pb-20">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Stay on current stage
          </Button>
          <Button
            onClick={handleAdvance}
            disabled={advanceMut.isPending}
            className="flex-1 gap-1.5"
            style={{ backgroundColor: targetStage.colour }}
          >
            <Check className="w-4 h-4" />
            Advance to {targetStage.label}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
