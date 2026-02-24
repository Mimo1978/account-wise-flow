import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone, Save, Loader2, Clock, CheckCircle2, XCircle, Calendar } from "lucide-react";
import type { OutreachTarget, CallOutcomeType } from "@/hooks/use-outreach";
import { useUpdateTargetState } from "@/hooks/use-outreach";
import { CALL_OUTCOME_LABEL, CALL_OUTCOME_CATEGORY, callOutcomeToState } from "@/lib/outreach-enums";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Props {
  target: OutreachTarget | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const ALL_OUTCOMES: CallOutcomeType[] = [
  "connected",
  "interested",
  "not_interested",
  "voicemail",
  "no_answer",
  "busy",
  "wrong_number",
  "callback_requested",
  "meeting_booked",
];

const OUTCOME_ICON: Record<string, string> = {
  positive: "text-green-600 dark:text-green-400",
  neutral: "text-muted-foreground",
  negative: "text-destructive",
};

export function LogCallModal({ target, open, onOpenChange }: Props) {
  const [outcome, setOutcome] = useState<CallOutcomeType | "">("");
  const [notes, setNotes] = useState("");
  const [duration, setDuration] = useState("");
  const [followUpAction, setFollowUpAction] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const { mutateAsync: updateState, isPending } = useUpdateTargetState();
  const [isLogging, setIsLogging] = useState(false);

  const handleLog = async () => {
    if (!target || !outcome) return;
    setIsLogging(true);

    try {
      const targetState = callOutcomeToState(outcome) ?? "contacted";

      // Log the event
      await updateState({
        targetId: target.id,
        state: targetState,
        eventType: "call_completed",
        metadata: {
          outcome,
          notes,
          duration_seconds: duration ? parseInt(duration, 10) * 60 : undefined,
          follow_up_action: followUpAction || undefined,
          follow_up_due: followUpDate || undefined,
          channel: "call",
        },
      });

      // Also insert a call_outcomes record
      const { data: { user } } = await supabase.auth.getUser();
      await db.from("call_outcomes").insert({
        workspace_id: target.workspace_id,
        target_id: target.id,
        candidate_id: target.candidate_id ?? null,
        contact_id: target.contact_id ?? null,
        outcome,
        notes,
        duration_seconds: duration ? parseInt(duration, 10) * 60 : null,
        follow_up_action: followUpAction || null,
        follow_up_due: followUpDate || null,
        caller_id: user?.id ?? null,
        engagement_id: (target as any).engagement_id ?? null,
      });

      toast.success(`Call logged: ${CALL_OUTCOME_LABEL[outcome]}`);
      onOpenChange(false);
      resetForm();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to log call");
    } finally {
      setIsLogging(false);
    }
  };

  const resetForm = () => {
    setOutcome("");
    setNotes("");
    setDuration("");
    setFollowUpAction("");
    setFollowUpDate("");
  };

  if (!target) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
              <Phone className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            Log Call
          </DialogTitle>
          <DialogDescription className="text-xs">
            {target.entity_name}
            {target.entity_phone ? ` · ${target.entity_phone}` : " · No phone on file"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Outcome selector — visual buttons */}
          <div className="space-y-2">
            <Label className="text-xs">Call Outcome</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {ALL_OUTCOMES.map((o) => {
                const cat = CALL_OUTCOME_CATEGORY[o];
                const isSelected = outcome === o;
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setOutcome(o)}
                    className={`
                      px-2 py-2 rounded-md border text-xs font-medium transition-all text-center
                      ${isSelected
                        ? cat === "positive"
                          ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 dark:border-green-700"
                          : cat === "negative"
                            ? "border-destructive bg-destructive/10 text-destructive"
                            : "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                      }
                    `}
                  >
                    {CALL_OUTCOME_LABEL[o]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <Label htmlFor="call-duration" className="text-xs flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> Duration (minutes)
            </Label>
            <Input
              id="call-duration"
              type="number"
              className="h-8 text-sm w-24"
              placeholder="0"
              min="0"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="call-notes" className="text-xs">Notes</Label>
            <Textarea
              id="call-notes"
              className="min-h-[80px] text-sm resize-y"
              placeholder="Key takeaways from the call…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Follow-up */}
          {(outcome === "callback_requested" || outcome === "interested" || outcome === "connected") && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="follow-up-action" className="text-xs flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> Follow-up Action
                </Label>
                <Input
                  id="follow-up-action"
                  className="h-8 text-sm"
                  placeholder="e.g. Send JD"
                  value={followUpAction}
                  onChange={(e) => setFollowUpAction(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="follow-up-date" className="text-xs">Follow-up Date</Label>
                <Input
                  id="follow-up-date"
                  type="date"
                  className="h-8 text-sm"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={!outcome || isLogging || isPending}
              onClick={handleLog}
            >
              {(isLogging || isPending) ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Log Call
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
