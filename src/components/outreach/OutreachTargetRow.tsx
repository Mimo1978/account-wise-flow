import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Mail,
  MessageSquare,
  Phone,
  Calendar,
  BellOff,
  XCircle,
  Bot,
  MoreHorizontal,
  ChevronRight,
} from "lucide-react";
import {
  OutreachTarget,
  OutreachTargetState,
  OutreachEventType,
  useUpdateTargetState,
} from "@/hooks/use-outreach";
import { format, parseISO } from "date-fns";

interface Props {
  target: OutreachTarget;
  onOpen: (t: OutreachTarget) => void;
}

const STATE_BADGE: Record<OutreachTargetState, { label: string; className: string }> = {
  queued: { label: "Queued", className: "bg-muted text-muted-foreground" },
  contacted: { label: "Contacted", className: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" },
  responded: { label: "Responded", className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" },
  booked: { label: "Booked", className: "bg-primary/10 text-primary" },
  snoozed: { label: "Snoozed", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300" },
  opted_out: { label: "Opted Out", className: "bg-destructive/10 text-destructive" },
  converted: { label: "Converted", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
};

export function OutreachTargetRow({ target, onOpen }: Props) {
  const { mutateAsync, isPending } = useUpdateTargetState();

  const act = async (
    state: OutreachTargetState,
    eventType: OutreachEventType,
    meta: Record<string, unknown> = {}
  ) => {
    await mutateAsync({ targetId: target.id, state, eventType, metadata: meta });
  };

  const badge = STATE_BADGE[target.state] ?? STATE_BADGE.queued;

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors group">
      {/* Name / title */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <button
            className="text-sm font-medium text-left hover:text-primary transition-colors line-clamp-1"
            onClick={() => onOpen(target)}
          >
            {target.entity_name}
          </button>
          <span className="text-xs text-muted-foreground line-clamp-1">
            {[target.entity_title, target.entity_company].filter(Boolean).join(" · ")}
          </span>
        </div>
      </td>

      {/* Campaign */}
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-xs text-muted-foreground truncate max-w-[140px] block">
          {(target.campaign as OutreachTarget["campaign"])?.name ?? "—"}
        </span>
      </td>

      {/* State */}
      <td className="px-4 py-3">
        <Badge className={`text-xs font-medium capitalize ${badge.className}`}>
          {badge.label}
        </Badge>
      </td>

      {/* Last contacted */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-xs text-muted-foreground">
          {target.last_contacted_at
            ? format(parseISO(target.last_contacted_at), "d MMM")
            : "—"}
        </span>
      </td>

      {/* Quick actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Send Email"
            disabled={isPending}
            onClick={() => act("contacted", "email_sent")}
          >
            <Mail className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Send SMS"
            disabled={isPending}
            onClick={() => act("contacted", "sms_sent")}
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Log Call"
            disabled={isPending}
            onClick={() => act("contacted", "call_made")}
          >
            <Phone className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Book Meeting"
            disabled={isPending}
            onClick={() => act("booked", "booked")}
          >
            <Calendar className="w-3.5 h-3.5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => act("contacted", "call_scheduled")}>
                <Bot className="w-3.5 h-3.5 mr-2" /> AI Call
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  act("snoozed", "snoozed", {
                    snooze_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                  })
                }
              >
                <BellOff className="w-3.5 h-3.5 mr-2" /> Snooze 7 days
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => act("opted_out", "opted_out")}
              >
                <XCircle className="w-3.5 h-3.5 mr-2" /> Opt Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onOpen(target)}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
