import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  Mail, Phone, MessageSquare, Calendar, XCircle, 
  Bot, CheckCircle2, RotateCcw, ChevronDown, ChevronRight,
  AlertTriangle, ExternalLink, Save, Pencil, FileText,
} from "lucide-react";
import {
  OutreachTarget,
  OutreachEvent,
  OutreachEventType,
  OutreachTargetState,
  useUpdateTargetState,
  useOutreachEvents,
} from "@/hooks/use-outreach";
import { usePersonRoute, buildPersonProfileUrl } from "@/hooks/use-person-identity";
import { AICallAgentModal } from "@/components/outreach/AICallAgentModal";
import { format, parseISO } from "date-fns";
import { EVENT_TYPE_LABEL, TARGET_STATE_LABEL, TARGET_STATE_BADGE_CLASS } from "@/lib/outreach-enums";

interface Props {
  target: OutreachTarget | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Channel the campaign will use first — drives the "missing contact" warning */
  primaryChannel?: "email" | "sms" | "call";
  /** All active channels — drives which fields are flagged */
  activeChannels?: Array<"email" | "sms" | "call">;
  /** Optional: id of the current campaign (used to round-trip back from the full profile) */
  campaignId?: string;
}

export function TargetDetailSheet({ target, open, onOpenChange, primaryChannel, activeChannels = [], campaignId }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { mutateAsync: updateState, isPending } = useUpdateTargetState();
  const { data: events = [] } = useOutreachEvents(target?.id);
  const { data: personRoute } = usePersonRoute(target?.person_identity_id ?? null);
  const [aiCallOpen, setAiCallOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  if (!target) return null;

  // Canonical resolution via person_identity (Talent → Contact → CRM priority).
  // Falls back to per-target source tagging if identity hasn't loaded, then to
  // the legacy heuristic so we never break for very old rows.
  const personProfile = buildPersonProfileUrl(personRoute ?? null);
  const fallbackSource: "candidates" | "contacts" | "crm_contacts" | undefined =
    target.contact_source ??
    (target.candidate_id ? "candidates" : target.contact_id ? "contacts" : undefined);

  const resolvedOpenAs: "contact" | "candidate" | null = personProfile.url
    ? personProfile.source === "talent"
      ? "candidate"
      : "contact"
    : fallbackSource === "candidates" && target.candidate_id
    ? "candidate"
    : (fallbackSource === "contacts" || fallbackSource === "crm_contacts") && target.contact_id
    ? "contact"
    : null;

  const contactSource: "contacts" | "crm_contacts" =
    personProfile.source === "crm_contact" || fallbackSource === "crm_contacts"
      ? "crm_contacts"
      : "contacts";
  const contactProfileLabel =
    contactSource === "crm_contacts" ? "Open CRM Contact" : "Open Contact Profile";

  const needsEmail = activeChannels.includes("email") && !target.entity_email;
  const needsPhone = (activeChannels.includes("sms") || activeChannels.includes("call")) && !target.entity_phone;
  const primaryNeeds =
    primaryChannel === "email"
      ? !target.entity_email
      : primaryChannel === "sms" || primaryChannel === "call"
      ? !target.entity_phone
      : false;

  const beginEditContact = () => {
    setEmailDraft(target.entity_email ?? "");
    setPhoneDraft(target.entity_phone ?? "");
    setEditingContact(true);
  };

  const handleViewFullProfile = () => {
    const qs = campaignId ? `?returnTo=outreach&campaignId=${campaignId}` : "?returnTo=outreach";
    const backState = {
      from: `/outreach${campaignId ? `?campaignId=${campaignId}` : ""}`,
      fromLabel: "Back to Campaign",
    };

    // Prefer the canonical person_identity route — guarantees the profile exists.
    if (personProfile.url) {
      navigate(`${personProfile.url}${qs}`, { state: backState });
      onOpenChange(false);
      return;
    }
    // Fallback for legacy rows without identity link
    if (resolvedOpenAs === "contact" && target.contact_id) {
      const profilePath =
        contactSource === "crm_contacts"
          ? `/crm/contacts/${target.contact_id}`
          : `/contacts/${target.contact_id}`;
      navigate(`${profilePath}${qs}`, { state: backState });
    } else if (resolvedOpenAs === "candidate" && target.candidate_id) {
      navigate(`/talent/${target.candidate_id}${qs}`, { state: backState });
    } else {
      toast.info("No linked profile for this target.");
      return;
    }
    onOpenChange(false);
  };

  const saveContactInline = async () => {
    setSavingContact(true);
    try {
      const updates: Record<string, string | null> = {
        email: emailDraft.trim() || null,
        phone: phoneDraft.trim() || null,
      };
      let table: "candidates" | "crm_contacts" | "contacts" | null = null;
      let id: string | undefined;
      if (resolvedOpenAs === "contact" && target.contact_id) {
        table = contactSource === "crm_contacts" ? "crm_contacts" : "contacts";
        id = target.contact_id;
      } else if (resolvedOpenAs === "candidate" && target.candidate_id) {
        table = "candidates";
        id = target.candidate_id;
      }
      if (!table || !id) {
        toast.error("This target has no linked profile to update.");
        setSavingContact(false);
        return;
      }
      const { error } = await supabase.from(table).update(updates).eq("id", id);
      if (error) throw error;
      toast.success("Contact details saved");
      setEditingContact(false);
      // Refresh outreach + profile queries
      queryClient.invalidateQueries({ queryKey: ["outreach"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["outreach_targets"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["candidates"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["crm_contacts"], exact: false });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save contact");
    } finally {
      setSavingContact(false);
    }
  };

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
          {/* Quick actions: view full profile / edit */}
          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-7 text-xs"
              onClick={handleViewFullProfile}
              disabled={!resolvedOpenAs}
            >
              <ExternalLink className="w-3 h-3" />
              {resolvedOpenAs === "contact"
                ? contactProfileLabel
                : resolvedOpenAs === "candidate"
                ? "Open Talent Profile"
                : "No linked profile"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 h-7 text-xs"
              onClick={beginEditContact}
              disabled={!resolvedOpenAs}
              title="Edit email & phone inline"
            >
              <Pencil className="w-3 h-3" /> Edit Contact
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-5">
            {/* Missing-contact warning for the active campaign channel */}
            {primaryChannel && primaryNeeds && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0 text-xs">
                  <p className="font-medium text-amber-200">
                    Missing {primaryChannel === "email" ? "email" : "phone number"} for {primaryChannel.toUpperCase()} outreach
                  </p>
                  <p className="text-amber-200/80 mt-0.5">
                    Add it below, open the full profile to check the CV, or remove this target from the queue before launch.
                  </p>
                </div>
              </div>
            )}

            {/* Contact info */}
            {editingContact ? (
              <div className="space-y-3 rounded-md border border-border/60 bg-muted/30 p-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase text-muted-foreground tracking-wide">Email</Label>
                  <Input
                    type="email"
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    placeholder="name@company.com"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase text-muted-foreground tracking-wide">Phone</Label>
                  <Input
                    type="tel"
                    value={phoneDraft}
                    onChange={(e) => setPhoneDraft(e.target.value)}
                    placeholder="+44 7…"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" className="gap-1.5 h-7 text-xs" onClick={saveContactInline} disabled={savingContact}>
                    <Save className="w-3 h-3" /> {savingContact ? "Saving…" : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingContact(false)} disabled={savingContact}>
                    Cancel
                  </Button>
                  {(target.candidate_id || target.contact_id) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs ml-auto gap-1.5 text-muted-foreground hover:text-foreground"
                      onClick={handleViewFullProfile}
                      title={resolvedOpenAs === "candidate" ? "Open full profile to view CV" : "Open full contact profile"}
                    >
                      <FileText className="w-3 h-3" /> {resolvedOpenAs === "candidate" ? "View CV" : "Open Profile"}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className={`w-3.5 h-3.5 shrink-0 ${needsEmail ? "text-amber-400" : "text-muted-foreground"}`} />
                  {target.entity_email ? (
                    <span className="truncate text-muted-foreground">{target.entity_email}</span>
                  ) : (
                    <span className={`italic ${needsEmail ? "text-amber-300" : "text-muted-foreground/60"}`}>
                      no email{needsEmail ? " — required for this campaign" : ""}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className={`w-3.5 h-3.5 shrink-0 ${needsPhone ? "text-amber-400" : "text-muted-foreground"}`} />
                  {target.entity_phone ? (
                    <span className="text-muted-foreground">{target.entity_phone}</span>
                  ) : (
                    <span className={`italic ${needsPhone ? "text-amber-300" : "text-muted-foreground/60"}`}>
                      no phone{needsPhone ? " — required for this campaign" : ""}
                    </span>
                  )}
                </div>
              </div>
            )}

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
