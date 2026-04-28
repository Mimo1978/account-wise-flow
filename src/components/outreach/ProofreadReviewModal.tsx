import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, AlertTriangle, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProofreadIssue {
  kind: "spelling" | "grammar" | "punctuation" | "capitalisation" | "phrasing";
  original: string;
  suggestion: string;
  explanation?: string;
}

export interface ProofreadField {
  id: string;
  label: string;
  original: string;
  corrected: string;
  issues: ProofreadIssue[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fields: ProofreadField[];
  /** User accepted suggested fixes — apply the corrected map and continue with save. */
  onAcceptAndSave: (correctedById: Record<string, string>) => void;
  /** User skipped fixes and wants to save raw text anyway. */
  onSaveAnyway: () => void;
  saving?: boolean;
}

const KIND_COLOR: Record<ProofreadIssue["kind"], string> = {
  spelling: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  grammar: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  punctuation: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  capitalisation: "bg-violet-500/10 text-violet-400 border-violet-500/30",
  phrasing: "bg-teal-500/10 text-teal-400 border-teal-500/30",
};

/**
 * ProofreadReviewModal — the security gate shown BEFORE a script is saved.
 * Lists every spelling / grammar / punctuation issue per field, lets the user
 * accept the corrected version per field (or all at once), then saves.
 * If there are no issues, the parent should bypass this modal entirely.
 */
export function ProofreadReviewModal({
  open,
  onOpenChange,
  fields,
  onAcceptAndSave,
  onSaveAnyway,
  saving,
}: Props) {
  // Per-field accept/reject state — all default to ACCEPTED.
  const [accepted, setAccepted] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(fields.map((f) => [f.id, true])),
  );

  const totalIssues = useMemo(
    () => fields.reduce((acc, f) => acc + f.issues.length, 0),
    [fields],
  );

  const acceptedCount = useMemo(
    () => fields.filter((f) => accepted[f.id]).length,
    [accepted, fields],
  );

  const handleApply = () => {
    const map: Record<string, string> = {};
    for (const f of fields) {
      if (accepted[f.id]) map[f.id] = f.corrected;
    }
    onAcceptAndSave(map);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col p-0 gap-0 z-[10002]">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/50 shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 grid place-items-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold">
                Pre-flight check — {totalIssues} issue{totalIssues === 1 ? "" : "s"} found
              </DialogTitle>
              <DialogDescription className="text-xs mt-1">
                Review and accept fixes before saving. The AI agent will read this script word-for-word — typos and grammar errors will be heard by the recipient.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4 space-y-4">
            {fields.map((f) => {
              const isAccepted = !!accepted[f.id];
              return (
                <div
                  key={f.id}
                  className={cn(
                    "rounded-lg border p-3 transition-colors",
                    isAccepted
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/60 bg-muted/20",
                  )}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium truncate">{f.label}</span>
                      <Badge
                        variant="outline"
                        className="h-5 px-1.5 text-[10px] gap-1 border-border/60"
                      >
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {f.issues.length}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={isAccepted ? "default" : "outline"}
                      className="h-7 text-[11px] gap-1"
                      onClick={() =>
                        setAccepted((p) => ({ ...p, [f.id]: !p[f.id] }))
                      }
                    >
                      {isAccepted ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> Apply fix
                        </>
                      ) : (
                        <>
                          <X className="w-3 h-3" /> Keep mine
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Issues list */}
                  {f.issues.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {f.issues.slice(0, 12).map((iss, i) => (
                        <span
                          key={i}
                          className={cn(
                            "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border",
                            KIND_COLOR[iss.kind],
                          )}
                          title={iss.explanation || ""}
                        >
                          <span className="line-through opacity-70 max-w-[140px] truncate">
                            {iss.original}
                          </span>
                          <span>→</span>
                          <span className="font-medium max-w-[160px] truncate">
                            {iss.suggestion}
                          </span>
                        </span>
                      ))}
                      {f.issues.length > 12 && (
                        <span className="text-[10px] text-muted-foreground self-center">
                          +{f.issues.length - 12} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Diff preview */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div className="rounded border border-border/40 bg-background/40 p-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                        Yours
                      </div>
                      <div className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed max-h-32 overflow-auto">
                        {f.original || <span className="text-muted-foreground italic">empty</span>}
                      </div>
                    </div>
                    <div className="rounded border border-primary/30 bg-primary/5 p-2">
                      <div className="text-[10px] uppercase tracking-wide text-primary mb-1">
                        Corrected
                      </div>
                      <div className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed max-h-32 overflow-auto">
                        {f.corrected || <span className="text-muted-foreground italic">empty</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="px-6 py-3 border-t border-border/50 flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-muted-foreground">
            {acceptedCount} of {fields.length} field{fields.length === 1 ? "" : "s"} will be corrected.
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSaveAnyway}
              disabled={saving}
            >
              Save without fixes
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              disabled={saving}
              className="gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {saving ? "Saving…" : "Apply & Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}