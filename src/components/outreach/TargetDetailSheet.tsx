import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Mail, Phone, MessageSquare, Calendar, XCircle, 
  Bot, CheckCircle2, RotateCcw, ChevronDown, ChevronRight,
} from "lucide-react";
import {
  OutreachTarget,
  OutreachEvent,
  OutreachEventType,
  OutreachTargetState,
  useUpdateTargetState,
  useOutreachEvents,
} from "@/hooks/use-outreach";
import { AICallAgentModal } from "@/components/outreach/AICallAgentModal";
import { format, parseISO } from "date-fns";
import { EVENT_TYPE_LABEL, TARGET_STATE_LABEL, TARGET_STATE_BADGE_CLASS } from "@/lib/outreach-enums";

interface Props {
  target: OutreachTarget | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

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
            <Badge className={`shrink-0 text-xs font-medium capitalize ${TARGET_STATE_BADGE_CLASS[target.state]}`}>
              {TARGET_STATE_LABEL[target.state]}
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
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Outreach</p>
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
                  onClick={() => setAiCallOpen(true)}
                >
                  <Bot className="w-3.5 h-3.5" /> AI Call Agent
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 justify-start col-span-2"
                  disabled={isPending}
                  onClick={() => handleAction("booked", "booked")}
                >
                  <Calendar className="w-3.5 h-3.5" /> Book Meeting
                </Button>
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 flex-1 justify-start"
                  disabled={isPending || target.state === "queued"}
                  onClick={() => handleAction("queued", "status_changed", { reset: true, previous_state: target.state })}
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset to Queued
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
                    <ActivityEventItem key={ev.id} event={ev} />
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

const EVENT_ICONS: Partial<Record<string, typeof Mail>> = {
  email_sent: Mail,
  sms_sent: MessageSquare,
  call_made: Phone,
  call_scheduled: Calendar,
  call_completed: Phone,
  booked: Calendar,
  opted_out: XCircle,
  snoozed: CheckCircle2,
};

function ActivityEventItem({ event }: { event: OutreachEvent }) {
  const [open, setOpen] = useState(false);
  const hasEmailBody = event.event_type === "email_sent" && (event.subject || event.body);
  const Icon = EVENT_ICONS[event.event_type] ?? CheckCircle2;

  const content = (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
        <Icon className="w-3 h-3 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {hasEmailBody && (
            open ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
          )}
          <p className="text-sm font-medium">{EVENT_TYPE_LABEL[event.event_type] ?? event.event_type}</p>
        </div>
        {event.event_type === "email_sent" && event.subject && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{event.subject}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {format(parseISO(event.performed_at), "d MMM yyyy, HH:mm")}
        </p>
      </div>
    </div>
  );

  if (!hasEmailBody) return content;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full text-left cursor-pointer hover:bg-muted/50 rounded-md p-1 -m-1 transition-colors">
          {content}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-9 mt-1.5 p-3 bg-muted/30 rounded-md text-xs text-muted-foreground whitespace-pre-wrap border border-border/50">
          {event.body || "(no body)"}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
