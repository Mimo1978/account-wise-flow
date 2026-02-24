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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Mail,
  MessageSquare,
  Phone,
  Calendar,
  XCircle,
  MoreHorizontal,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import {
  OutreachTarget,
  OutreachTargetState,
  OutreachEventType,
  useUpdateTargetState,
} from "@/hooks/use-outreach";
import { isOutreachBlocked, isCallBlocked, TARGET_STATE_LABEL, TARGET_STATE_BADGE_CLASS } from "@/lib/outreach-enums";
import { EmailComposeModal } from "@/components/outreach/EmailComposeModal";
import { SMSComposeModal } from "@/components/outreach/SMSComposeModal";
import { LogCallModal } from "@/components/outreach/LogCallModal";
import { format, parseISO } from "date-fns";
import { useState } from "react";

interface Props {
  target: OutreachTarget;
  onOpen: (t: OutreachTarget) => void;
  selected?: boolean;
  onSelectChange?: (id: string, checked: boolean) => void;
}

export function OutreachTargetRow({ target, onOpen, selected, onSelectChange }: Props) {
  const { mutateAsync, isPending } = useUpdateTargetState();
  const [emailOpen, setEmailOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [callLogOpen, setCallLogOpen] = useState(false);

  const complianceFlags = {
    state: target.state,
    do_not_contact: !!(target as unknown as Record<string, unknown>).do_not_contact,
    do_not_call: !!(target as unknown as Record<string, unknown>).do_not_call,
  };
  const outreachBlocked = isOutreachBlocked(complianceFlags);
  const callBlocked = isCallBlocked(complianceFlags);

  const act = async (
    state: OutreachTargetState,
    eventType: OutreachEventType,
    meta: Record<string, unknown> = {}
  ) => {
    await mutateAsync({ targetId: target.id, state, eventType, metadata: meta });
  };

  const badgeLabel = TARGET_STATE_LABEL[target.state] ?? target.state;
  const badgeClass = TARGET_STATE_BADGE_CLASS[target.state] ?? TARGET_STATE_BADGE_CLASS.queued;

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      {/* Checkbox */}
      {onSelectChange && (
        <td className="px-4 py-3 w-10">
          <input
            type="checkbox"
            checked={!!selected}
            onChange={(e) => onSelectChange(target.id, e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
          />
        </td>
      )}
      {/* Name / title */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <button
            className="text-sm font-medium text-left hover:text-primary transition-colors line-clamp-1"
            onClick={() => onOpen(target)}
          >
            {target.entity_name}
          </button>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground line-clamp-1">
              {[target.entity_title, target.entity_company].filter(Boolean).join(" · ")}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              {target.entity_email ? (
                <span title="Email available"><Mail className="w-3 h-3 text-primary/70" /></span>
              ) : (
                <span title="No email"><Mail className="w-3 h-3 text-muted-foreground/30" /></span>
              )}
              {target.entity_phone ? (
                <span title="Phone available"><Phone className="w-3 h-3 text-primary/70" /></span>
              ) : (
                <span title="No phone"><Phone className="w-3 h-3 text-muted-foreground/30" /></span>
              )}
            </span>
            <span
              className={`text-[9px] px-1 py-0 rounded border font-medium capitalize leading-4 ${
                target.entity_type === "contact"
                  ? "border-blue-200 text-blue-600 dark:border-blue-800 dark:text-blue-400"
                  : "border-emerald-200 text-emerald-600 dark:border-emerald-800 dark:text-emerald-400"
              }`}
            >
              {target.entity_type ?? "candidate"}
            </span>
          </div>
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
        <Badge className={`text-xs font-medium capitalize ${badgeClass}`}>
          {badgeLabel}
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

      {/* Actions — always visible */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={isPending || outreachBlocked || !target.entity_email}
                onClick={() => setEmailOpen(true)}
              >
                <Mail className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Send Email</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={isPending || outreachBlocked || !target.entity_phone}
                onClick={() => setSmsOpen(true)}
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Send SMS</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={isPending || callBlocked}
                onClick={() => setCallLogOpen(true)}
              >
                <Phone className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Log Call</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={isPending || outreachBlocked}
                onClick={() => act("booked", "booked")}
              >
                <Calendar className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Book Meeting</TooltipContent>
          </Tooltip>

          {/* Overflow: Reset + Opt Out */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={() => act("queued", "status_changed", { reset: true, previous_state: target.state })}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-2" /> Reset to Queued
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

        {/* Action modals */}
        <EmailComposeModal target={target} open={emailOpen} onOpenChange={setEmailOpen} />
        <SMSComposeModal target={target} open={smsOpen} onOpenChange={setSmsOpen} />
        <LogCallModal target={target} open={callLogOpen} onOpenChange={setCallLogOpen} />
      </td>
    </tr>
  );
}
