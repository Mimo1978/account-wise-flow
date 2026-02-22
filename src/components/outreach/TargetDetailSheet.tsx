import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Mail, Phone, MessageSquare, Calendar, BellOff, XCircle, 
  Bot, Clock, CheckCircle2,
} from "lucide-react";
import {
  OutreachTarget,
  OutreachEventType,
  OutreachTargetState,
  useUpdateTargetState,
  useOutreachEvents,
} from "@/hooks/use-outreach";
import { AICallAgentModal } from "@/components/outreach/AICallAgentModal";
import { format, parseISO } from "date-fns";

interface Props {
  target: OutreachTarget | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const EVENT_LABELS: Record<string, string> = {
  email_sent: "Email Sent",
  sms_sent: "SMS Sent",
  call_made: "Call Made",
  call_scheduled: "Call Scheduled",
  call_completed: "Call Completed",
  responded: "Responded",
  booked: "Meeting Booked",
  snoozed: "Snoozed",
  opted_out: "Opted Out",
  note_added: "Note Added",
  status_changed: "Status Changed",
  added_to_campaign: "Added to Campaign",
};

const STATE_COLORS: Record<OutreachTargetState, string> = {
  queued: "bg-muted text-muted-foreground",
  contacted: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  responded: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  booked: "bg-primary/10 text-primary",
  snoozed: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  opted_out: "bg-destructive/10 text-destructive",
  converted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  closed: "bg-muted text-muted-foreground",
};

export function TargetDetailSheet({ target, open, onOpenChange }: Props) {
  const { mutateAsync: updateState, isPending } = useUpdateTargetState();
  const { data: events = [] } = useOutreachEvents(target?.id);
  const [aiCallOpen, setAiCallOpen] = useState(false);

  if (!target) return null;

  const handleAction = async (
    state: OutreachTargetState,
    eventType: OutreachEventType,
    extra: Record<string, unknown> = {}
  ) => {
    await updateState({ targetId: target.id, state, eventType, metadata: extra });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:max-w-[420px] flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-base truncate">{target.entity_name}</SheetTitle>
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {[target.entity_title, target.entity_company].filter(Boolean).join(" · ")}
              </p>
            </div>
            <Badge className={`shrink-0 text-xs font-medium capitalize ${STATE_COLORS[target.state]}`}>
              {target.state.replace("_", " ")}
            </Badge>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-5">
            {/* Contact info */}
            <div className="space-y-2">
              {target.entity_email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate text-muted-foreground">{target.entity_email}</span>
                </div>
              )}
              {target.entity_phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{target.entity_phone}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Actions */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Actions</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 justify-start"
                  disabled={isPending}
                  onClick={() => handleAction("contacted", "email_sent")}
                >
                  <Mail className="w-3.5 h-3.5" /> Send Email
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 justify-start"
                  disabled={isPending}
                  onClick={() => handleAction("contacted", "sms_sent")}
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Send SMS
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 justify-start"
                  disabled={isPending}
                  onClick={() => handleAction("contacted", "call_made")}
                >
                  <Phone className="w-3.5 h-3.5" /> Log Call
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 justify-start"
                  disabled={isPending}
                  onClick={() => handleAction("booked", "booked")}
                >
                  <Calendar className="w-3.5 h-3.5" /> Book Meeting
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 justify-start"
                  disabled={isPending}
                  onClick={() => setAiCallOpen(true)}
                >
                  <Bot className="w-3.5 h-3.5" /> AI Call Agent
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 justify-start"
                  disabled={isPending}
                  onClick={() => handleAction("snoozed", "snoozed", {
                    snooze_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                  })}
                >
                  <BellOff className="w-3.5 h-3.5" /> Snooze 7d
                </Button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="gap-2 w-full mt-2 text-destructive hover:text-destructive justify-start"
                disabled={isPending}
                onClick={() => handleAction("opted_out", "opted_out")}
              >
                <XCircle className="w-3.5 h-3.5" /> Mark as Opted Out
              </Button>
            </div>

            <Separator />

            {/* Event timeline */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Activity</p>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet</p>
              ) : (
                <div className="space-y-3">
                  {events.map((ev) => (
                    <div key={ev.id} className="flex items-start gap-3">
                      <div className="mt-0.5 w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{EVENT_LABELS[ev.event_type] ?? ev.event_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(ev.performed_at), "d MMM yyyy, HH:mm")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>

      <AICallAgentModal
        target={target}
        open={aiCallOpen}
        onOpenChange={setAiCallOpen}
      />
    </Sheet>
  );
}
