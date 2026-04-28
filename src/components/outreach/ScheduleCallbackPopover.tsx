import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarPlus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, addDays, addHours, startOfDay, nextFriday, nextMonday, isAfter } from "date-fns";

const TIME_OPTIONS = [
  { label: "In 1 hour", getValue: () => addHours(new Date(), 1) },
  { label: "Tomorrow 9am", getValue: () => { const d = addDays(startOfDay(new Date()), 1); d.setHours(9); return d; } },
  {
    label: "This Friday",
    getValue: () => {
      const now = new Date();
      const fri = nextFriday(startOfDay(now));
      // If today is Friday before noon, use today
      if (now.getDay() === 5 && now.getHours() < 12) {
        const d = startOfDay(now); d.setHours(9); return d;
      }
      fri.setHours(9);
      return fri;
    },
  },
  {
    label: "Next Monday",
    getValue: () => {
      const mon = nextMonday(startOfDay(new Date()));
      mon.setHours(9);
      return mon;
    },
  },
];

interface ScheduleCallbackPopoverProps {
  workspaceId: string;
  entityName: string;
  contactId?: string;
  candidateId?: string;
  companyId?: string;
  bright?: boolean;
}

export function ScheduleCallbackPopover({
  workspaceId,
  entityName,
  contactId,
  candidateId,
  companyId,
  bright = false,
}: ScheduleCallbackPopoverProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const dt = TIME_OPTIONS[selected].getValue();
      const iso = dt.toISOString();
      const { error } = await supabase.from("diary_events").insert({
        workspace_id: workspaceId,
        user_id: user.id,
        title: `Call back ${entityName}`,
        description: "Callback reminder set from database",
        event_type: "reminder",
        start_time: iso,
        end_time: iso,
        contact_id: contactId || null,
        candidate_id: candidateId || null,
        company_id: companyId || null,
        status: "scheduled",
      });
      if (error) throw error;
      return dt;
    },
    onSuccess: (dt) => {
      qc.invalidateQueries({ queryKey: ["diary_events"], exact: false });
      toast.success(`Callback reminder set for ${format(dt, "EEEE")} at ${format(dt, "HH:mm")}`);
      setOpen(false);
    },
    onError: () => toast.error("Failed to set reminder"),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {bright ? (
          <Button
            size="sm"
            className="gap-1.5 bg-amber-500/15 text-amber-300 border border-amber-500/50 hover:bg-amber-500/25 hover:text-amber-200 hover:border-amber-400/70 shadow-[0_0_12px_-2px_hsl(38_92%_55%/0.45)]"
            title={`Schedule callback — ${entityName}`}
            onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          >
            <CalendarPlus className="h-4 w-4" />
            Callback
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title={`Schedule callback — ${entityName}`}
            onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          >
            <CalendarPlus className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-3"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-semibold text-foreground mb-2 truncate">
          Callback — {entityName}
        </p>
        <div className="space-y-1.5 mb-3">
          {TIME_OPTIONS.map((opt, i) => (
            <button
              key={opt.label}
              onClick={() => setSelected(i)}
              className={cn(
                "w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                selected === i
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          className="w-full text-xs h-7"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Set reminder
        </Button>
      </PopoverContent>
    </Popover>
  );
}
