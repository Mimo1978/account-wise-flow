import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ChevronRight,
  RotateCcw,
  NotebookPen,
  FileText,
  AlertTriangle,
} from "lucide-react";
import {
  OutreachTarget,
  OutreachTargetState,
  OutreachEventType,
  useUpdateTargetState,
} from "@/hooks/use-outreach";
import { usePersonRoute } from "@/hooks/use-person-identity";
import { isOutreachBlocked, isCallBlocked, TARGET_STATE_LABEL, TARGET_STATE_BADGE_CLASS } from "@/lib/outreach-enums";
import { EmailComposeModal } from "@/components/outreach/EmailComposeModal";
import { SMSComposeModal } from "@/components/outreach/SMSComposeModal";
import { LogCallModal } from "@/components/outreach/LogCallModal";
import { AICallAgentModal } from "@/components/outreach/AICallAgentModal";
import { MeetingSchedulerModal } from "@/components/outreach/MeetingSchedulerModal";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

interface Props {
  target: OutreachTarget;
  onOpen: (t: OutreachTarget) => void;
  selected?: boolean;
  onSelectChange?: (id: string, checked: boolean) => void;
  /** Channels with assigned scripts on the parent campaign */
  assignedChannels?: Array<{ channel: "email" | "sms" | "call"; scriptName: string; scriptVersion?: number; isPrimary?: boolean }>;
  /** Active channels selected for the campaign — drives the missing-contact warning */
  activeChannels?: Array<"email" | "sms" | "call">;
  /** The campaign's primary channel */
  primaryChannel?: "email" | "sms" | "call";
  launchStatus?: {
    status: "dialing" | "in_progress" | "sent" | "failed" | "skipped";
    message: string;
    channel?: "email" | "sms" | "call";
  };
}

export function OutreachTargetRow({ target, onOpen, selected, onSelectChange, assignedChannels = [], activeChannels = [], primaryChannel, launchStatus }: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentCampaignId = searchParams.get("campaignId") || "";
  const { mutateAsync, isPending } = useUpdateTargetState();
  const { data: personRoute } = usePersonRoute(target.person_identity_id ?? null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [callLogOpen, setCallLogOpen] = useState(false);
  const [aiCallOpen, setAiCallOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);

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

  const channelIcon = (c: "email" | "sms" | "call") =>
    c === "email" ? <Mail className="w-3 h-3" /> : c === "sms" ? <MessageSquare className="w-3 h-3" /> : <Phone className="w-3 h-3" />;
  const channelLabel = (c: "email" | "sms" | "call") => (c === "call" ? "AI Call" : c.toUpperCase());

  // Channel theme tokens — tactile coloured buttons that match the dark theme
  const channelTheme = {
    email:
      "bg-sky-500/15 text-sky-300 border border-sky-500/40 hover:bg-sky-500/25 hover:text-sky-200 hover:border-sky-400/60 shadow-[0_0_0_1px_hsl(var(--background))_inset]",
    sms:
      "bg-violet-500/15 text-violet-300 border border-violet-500/40 hover:bg-violet-500/25 hover:text-violet-200 hover:border-violet-400/60 shadow-[0_0_0_1px_hsl(var(--background))_inset]",
    call:
      "bg-amber-500/10 text-amber-300 border border-amber-500/40 hover:bg-amber-500/20 hover:text-amber-200 hover:border-amber-400/60 shadow-[0_0_0_1px_hsl(var(--background))_inset]",
    aiCall:
      "bg-emerald-500/15 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-500/25 hover:text-emerald-200 hover:border-emerald-400/70 shadow-[0_0_10px_-2px_hsl(152_76%_45%/0.4)]",
    meeting:
      "bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25 hover:text-amber-200 hover:border-amber-400/60 shadow-[0_0_0_1px_hsl(var(--background))_inset]",
  } as const;

  const chipTheme = (c: "email" | "sms" | "call", primary?: boolean) => {
    const base =
      c === "email"
        ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
        : c === "sms"
        ? "border-violet-500/50 bg-violet-500/10 text-violet-300"
        : "border-emerald-500/50 bg-emerald-500/10 text-emerald-300";
    return primary
      ? `${base} ring-1 ring-primary/50 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]`
      : base;
  };

  // Human-readable channel label for the State/Script chip.
  // e.g. "Email", "SMS", "AI Call" — paired with the script name + primary tag below.
  const verbFor = (c: "email" | "sms" | "call") =>
    c === "email" ? "Email" : c === "sms" ? "SMS" : "AI Call";

  // Canonical resolution via person_identity (Talent → Contact → CRM priority).
  // Uses the DB-tagged source as a fallback while the identity route loads.
  const fallbackSource: "candidates" | "contacts" | "crm_contacts" | undefined =
    target.contact_source ??
    (target.candidate_id ? "candidates" : target.contact_id ? "contacts" : undefined);

  const resolvedType: "contact" | "candidate" | null = personRoute
    ? personRoute.preferred_route === "talent"
      ? "candidate"
      : personRoute.preferred_route === "none"
      ? null
      : "contact"
    : fallbackSource === "candidates" && target.candidate_id
    ? "candidate"
    : (fallbackSource === "contacts" || fallbackSource === "crm_contacts") && target.contact_id
    ? "contact"
    : null;

  const isCrmContact =
    personRoute?.preferred_route === "crm_contact" || fallbackSource === "crm_contacts";
  const contactLabel = isCrmContact ? "CRM Contact" : "Contact";
  const contactTitle = isCrmContact
    ? "CRM Contact — opens in /crm/contacts"
    : "Contact — opens in /contacts";

  // Missing-contact detection for the campaign's active channels
  const missingForChannels: Array<"email" | "sms" | "call"> = activeChannels.filter((c) => {
    if (c === "email") return !target.entity_email;
    return !target.entity_phone; // sms + call both need a phone
  });
  const hasMissing = missingForChannels.length > 0 && target.state === "queued";
  const missingPrimary =
    primaryChannel &&
    target.state === "queued" &&
    ((primaryChannel === "email" && !target.entity_email) ||
      ((primaryChannel === "sms" || primaryChannel === "call") && !target.entity_phone));

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
            className="text-sm font-medium text-left hover:text-primary hover:underline transition-colors line-clamp-1"
            onClick={() => onOpen(target)}
            title="Open quick actions panel — use the panel to view full profile or edit contact"
          >
            {target.entity_name}
          </button>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground line-clamp-1">
              {[target.entity_title, target.entity_company].filter(Boolean).join(" · ")}
            </span>
            <span
              className={`text-[9px] px-1 py-0 rounded border font-medium capitalize leading-4 ${
                resolvedType === "contact"
                  ? "border-blue-200 text-blue-600 dark:border-blue-800 dark:text-blue-400"
                  : resolvedType === "candidate"
                  ? "border-emerald-200 text-emerald-600 dark:border-emerald-800 dark:text-emerald-400"
                  : "border-amber-300 text-amber-500 dark:border-amber-700 dark:text-amber-400"
              }`}
              title={
                resolvedType === "contact"
                  ? contactTitle
                  : resolvedType === "candidate"
                  ? "Talent record — opens in /talent"
                  : "No linked profile"
              }
            >
              {resolvedType === "contact"
                ? contactLabel
                : resolvedType === "candidate"
                ? "Talent"
                : "Unlinked"}
            </span>
          </div>
        </div>
      </td>

      {/* Contact details — email + phone */}
      <td className="px-4 py-3 hidden md:table-cell">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="inline-flex items-center gap-1.5 text-xs">
            <Mail className={`w-3 h-3 shrink-0 ${activeChannels.includes("email") && !target.entity_email ? "text-amber-400" : "text-muted-foreground"}`} />
            {target.entity_email ? (
              <span className="truncate max-w-[180px] text-foreground/90">{target.entity_email}</span>
            ) : (
              <span className={`italic ${activeChannels.includes("email") ? "text-amber-300/90" : "text-muted-foreground/60"}`}>no email</span>
            )}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs">
            <Phone className={`w-3 h-3 shrink-0 ${(activeChannels.includes("sms") || activeChannels.includes("call")) && !target.entity_phone ? "text-amber-400" : "text-muted-foreground"}`} />
            {target.entity_phone ? (
              <span className="text-foreground/90">{target.entity_phone}</span>
            ) : (
              <span className={`italic ${(activeChannels.includes("sms") || activeChannels.includes("call")) ? "text-amber-300/90" : "text-muted-foreground/60"}`}>no phone</span>
            )}
          </span>
          {hasMissing && (
            <button
              type="button"
              onClick={() => onOpen(target)}
              className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded border border-amber-500/50 bg-amber-500/10 text-[10px] text-amber-300 hover:bg-amber-500/20 transition-colors w-fit"
              title={`Missing ${missingForChannels.join(" + ").toUpperCase()} for this campaign — fix before launch or remove from queue`}
            >
              <AlertTriangle className="w-3 h-3" />
              Missing {missingForChannels.map((c) => (c === "email" ? "email" : "phone")).join(" + ")}
              {missingPrimary && <span className="ml-0.5 px-1 rounded-sm bg-amber-500/30 uppercase tracking-wide text-[8px]">primary</span>}
              <span className="opacity-70">· fix or remove</span>
            </button>
          )}
        </div>
      </td>

      {/* Campaign */}
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-xs text-muted-foreground truncate max-w-[140px] block">
          {(target.campaign as OutreachTarget["campaign"])?.name ?? "—"}
        </span>
      </td>

      {/* State + assigned script/channel */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1 items-start">
          <Badge className={`text-xs font-medium capitalize ${badgeClass}`}>
            {badgeLabel}
          </Badge>
          {assignedChannels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {assignedChannels.map((a) => (
                <Tooltip key={a.channel}>
                  <TooltipTrigger asChild>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-medium leading-4 ${chipTheme(a.channel, a.isPrimary)}`}
                    >
                      {channelIcon(a.channel)}
                      <span className="font-semibold">{verbFor(a.channel)}</span>
                      <span className="opacity-70">·</span>
                      <span className="opacity-90">
                        Script: <span className="font-medium">{a.scriptName}</span>
                        {a.scriptVersion ? <span className="opacity-70"> (v{a.scriptVersion})</span> : null}
                      </span>
                      {a.isPrimary && (
                        <span className="ml-0.5 px-1.5 py-[1px] rounded-sm bg-primary/30 text-primary-foreground/90 text-[9px] uppercase tracking-wide">
                          Primary channel
                        </span>
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-[260px]">
                    {channelLabel(a.channel)} channel will use the script
                    <span className="font-semibold"> "{a.scriptName}"</span>
                    {a.scriptVersion ? <span> (version {a.scriptVersion})</span> : null}.
                    {a.isPrimary && <span> This is the campaign's primary channel — it runs first.</span>}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
          {assignedChannels.length === 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-500/90">
              <FileText className="w-3 h-3" /> no script assigned
            </span>
          )}
          {launchStatus && (
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-medium max-w-[360px] ${
                launchStatus.status === "failed"
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : launchStatus.status === "skipped"
                  ? "border-muted-foreground/30 bg-muted text-muted-foreground"
                  : "border-primary/50 bg-primary/10 text-primary"
              }`}
              title={launchStatus.message}
            >
              {(launchStatus.status === "dialing" || launchStatus.status === "in_progress") && (
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse shrink-0" />
              )}
              <span className="shrink-0">
                {launchStatus.status === "dialing" ? "Dialing now" : launchStatus.status === "in_progress" ? "Call in progress" : launchStatus.status === "failed" ? "Call failed" : launchStatus.status === "skipped" ? "Skipped" : "Sent"}
              </span>
              <span className="truncate opacity-80">· {launchStatus.message}</span>
            </span>
          )}
          {/* AI call capture chips — what the agent learned on the last call */}
          {target.last_call_metadata && (
            <div className="flex items-center flex-wrap gap-1 mt-0.5 w-full">
              {target.last_call_metadata.notice_period && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-200 text-[10px] font-medium" title={`Notice period: ${target.last_call_metadata.notice_period}`}>
                  ⏳ Notice: {target.last_call_metadata.notice_period}
                </span>
              )}
              {target.last_call_metadata.availability && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-[10px] font-medium max-w-[260px] truncate" title={`Availability: ${target.last_call_metadata.availability}`}>
                  🗓️ {target.last_call_metadata.availability}
                </span>
              )}
              {target.last_call_metadata.sentiment && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-medium ${
                  target.last_call_metadata.sentiment === "positive" ? "bg-green-500/15 border-green-500/40 text-green-200"
                  : target.last_call_metadata.sentiment === "negative" ? "bg-red-500/15 border-red-500/40 text-red-200"
                  : "bg-muted border-border text-muted-foreground"
                }`} title={`Sentiment from last AI call: ${target.last_call_metadata.sentiment}`}>
                  {target.last_call_metadata.sentiment === "positive" ? "🙂" : target.last_call_metadata.sentiment === "negative" ? "🙁" : "😐"} {target.last_call_metadata.sentiment}
                </span>
              )}
              {target.followup_email_pending && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/20 border border-primary/50 text-primary text-[10px] font-medium animate-pulse" title={`Auto follow-up email queued: ${target.followup_email_topic || "info from call"}`}>
                  ✉️ Sending follow-up…
                </span>
              )}
              {target.last_call_metadata.recording_url && (
                <a
                  href={target.last_call_metadata.recording_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-card border border-border text-[10px] font-medium text-foreground hover:bg-accent"
                  title="Listen to call recording"
                >
                  🎧 Recording
                </a>
              )}
            </div>
          )}
        </div>
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
        <div className="flex items-center gap-1 flex-nowrap">
          <Button
            size="icon"
            variant="ghost"
            className={`h-7 w-7 rounded-md transition-all ${channelTheme.email} disabled:opacity-40`}
            disabled={isPending || outreachBlocked || !target.entity_email}
            onClick={() => setEmailOpen(true)}
            title={!target.entity_email ? "Email unavailable — no email on file. Open the panel to add one." : "Send Email"}
          >
            <Mail className="w-3.5 h-3.5" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className={`h-7 w-7 rounded-md transition-all ${channelTheme.sms} disabled:opacity-40`}
            disabled={isPending || outreachBlocked || !target.entity_phone}
            onClick={() => setSmsOpen(true)}
            title={!target.entity_phone ? "SMS unavailable — no phone on file. Open the panel to add one." : "Send SMS"}
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className={`h-7 px-2 gap-1 rounded-md transition-all ${channelTheme.call} disabled:opacity-40`}
            disabled={isPending || callBlocked}
            onClick={() => setCallLogOpen(true)}
            title="Log Call"
          >
            <NotebookPen className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">Log</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className={`h-7 px-2 gap-1 rounded-md transition-all ${channelTheme.aiCall} disabled:opacity-40`}
            disabled={isPending || callBlocked || !target.entity_phone}
            onClick={() => setAiCallOpen(true)}
            title={!target.entity_phone ? "AI Call unavailable — no phone on file. Open the panel to add one." : "Initiate AI Call"}
          >
            <Phone className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">AI</span>
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className={`h-7 w-7 rounded-md transition-all ${channelTheme.meeting} disabled:opacity-40`}
            disabled={isPending || outreachBlocked}
            onClick={() => setMeetingOpen(true)}
            title="Schedule Meeting"
          >
            <Calendar className="w-3.5 h-3.5" />
          </Button>

          {/* Inline: Reset to Queued — previously hidden in overflow menu */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-md border border-border/60 hover:bg-muted/60 text-muted-foreground hover:text-foreground disabled:opacity-40"
            disabled={isPending}
            onClick={() => act("queued", "status_changed", { reset: true, previous_state: target.state })}
            title="Reset to Queued"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>

          {/* Inline: Opt Out — previously hidden in overflow menu */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-md border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:border-destructive/60 disabled:opacity-40"
            disabled={isPending}
            onClick={() => act("opted_out", "opted_out")}
            title="Opt Out"
          >
            <XCircle className="w-3.5 h-3.5" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onOpen(target)}
            title="Open quick actions panel"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Action modals */}
        <EmailComposeModal target={target} open={emailOpen} onOpenChange={setEmailOpen} />
        <SMSComposeModal target={target} open={smsOpen} onOpenChange={setSmsOpen} />
        <LogCallModal target={target} open={callLogOpen} onOpenChange={setCallLogOpen} />
        <AICallAgentModal target={target} open={aiCallOpen} onOpenChange={setAiCallOpen} />
        <MeetingSchedulerModal target={target} open={meetingOpen} onOpenChange={setMeetingOpen} />
      </td>
    </tr>
  );
}
