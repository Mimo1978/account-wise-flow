import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Users,
  FileText,
  Settings,
  Plus,
  Edit2,
  Pencil,
  Check,
  X,
  Mail,
  Phone,
  MessageSquare,
  CalendarClock,
  Bot,
  Inbox,
  Briefcase,
  Rocket,
  Loader2,
} from "lucide-react";
import {
  useOutreachTargets,
  useUpdateCampaign,
  useUpdateTargetState,
  type OutreachCampaign,
  type OutreachTarget,
  type OutreachTargetState,
} from "@/hooks/use-outreach";
import { useOutreachScripts } from "@/hooks/use-scripts";
import type { OutreachScript } from "@/lib/script-types";
import { OutreachTargetRow } from "./OutreachTargetRow";
import { AddTargetsModal } from "./AddTargetsModal";
import { ScriptBuilderModal } from "./ScriptBuilderModal";
import { TargetDetailSheet } from "./TargetDetailSheet";
import { AutomationSettingsPanel } from "./AutomationSettingsPanel";
import { InboundResponsesPanel } from "./InboundResponsesPanel";
import { CampaignSetupGuide } from "./CampaignSetupGuide";
import { ChannelModeSelector, type ChannelKey } from "./ChannelModeSelector";
import { format, parseISO } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  campaign: OutreachCampaign;
  onBack: () => void;
  projectId?: string;
}

const CAMPAIGN_STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  archived: "bg-muted text-muted-foreground",
};

const CHANNEL_BADGE: Record<string, string> = {
  email: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  sms: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  call: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
};

// ─── Campaign Detail View ─────────────────────────────────────────────────────

export function CampaignDetailView({ campaign, onBack, projectId }: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"targets" | "scripts" | "settings" | "automation" | "responses">("targets");
  const [addTargetsOpen, setAddTargetsOpen] = useState(false);
  const [scriptBuilderOpen, setScriptBuilderOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<OutreachScript | undefined>();
  const [defaultScriptChannel, setDefaultScriptChannel] = useState<ChannelKey | undefined>();
  const [selectedTarget, setSelectedTarget] = useState<OutreachTarget | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [filterState, setFilterState] = useState<OutreachTargetState | "">("");
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [editName, setEditName] = useState(campaign.name);
  const [editDescription, setEditDescription] = useState(campaign.description ?? "");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingHeader && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingHeader]);

  const handleSaveHeader = () => {
    if (!editName.trim()) {
      toast.error("Campaign name cannot be empty");
      return;
    }
    updateCampaign({ id: campaign.id, name: editName.trim(), description: editDescription.trim() || null } as any);
    toast.success("Campaign updated");
    setIsEditingHeader(false);
  };

  const handleCancelEdit = () => {
    setEditName(campaign.name);
    setEditDescription(campaign.description ?? "");
    setIsEditingHeader(false);
  };

  const { data: targets = [], isLoading: targetsLoading } = useOutreachTargets({
    campaignId: campaign.id,
    state: filterState || undefined,
  });
  const { data: scripts = [], isLoading: scriptsLoading } = useOutreachScripts(campaign.id);
  const { data: allScripts = [] } = useOutreachScripts();
  const { mutate: updateCampaign, isPending: isUpdating } = useUpdateCampaign();
  const { mutateAsync: updateTargetState } = useUpdateTargetState();
  const [isLaunching, setIsLaunching] = useState(false);

  // Settings local state (persisted on save)
  const [emailScriptId, setEmailScriptId] = useState(campaign.email_script_id ?? "");
  const [smsScriptId, setSmsScriptId] = useState(campaign.sms_script_id ?? "");
  const [callScriptId, setCallScriptId] = useState(campaign.call_script_id ?? "");
  const [calendarConnectionId, setCalendarConnectionId] = useState(
    campaign.calendar_connection_id ?? ""
  );
  const [callingHoursStart, setCallingHoursStart] = useState(
    campaign.calling_hours_start ?? "09:00"
  );
  const [callingHoursEnd, setCallingHoursEnd] = useState(
    campaign.calling_hours_end ?? "18:00"
  );
  const [maxCallAttempts, setMaxCallAttempts] = useState(
    String(campaign.max_call_attempts ?? 3)
  );
  const [optOutRequired, setOptOutRequired] = useState(campaign.opt_out_required ?? true);
  const [callingTimezone, setCallingTimezone] = useState(
    campaign.calling_timezone ?? "UTC"
  );

  // Channel mode (single vs mixed). Initialised from existing campaign config:
  // any channel that already has a script assigned counts as active, plus the
  // campaign's primary `channel` field. Persisted in component state for now —
  // the underlying `campaign.channel` stays as the primary.
  const initialActive = (() => {
    const set = new Set<ChannelKey>();
    if (campaign.email_script_id) set.add("email");
    if (campaign.sms_script_id) set.add("sms");
    if (campaign.call_script_id) set.add("call");
    const primary = (["email", "sms", "call"].includes(campaign.channel as string)
      ? (campaign.channel as ChannelKey)
      : "email");
    set.add(primary);
    return { active: Array.from(set), primary };
  })();
  const [activeChannels, setActiveChannels] = useState<ChannelKey[]>(initialActive.active);
  const [primaryChannel, setPrimaryChannel] = useState<ChannelKey>(initialActive.primary);
  const scriptsTabRef = useRef<HTMLDivElement>(null);
  const [highlightChannel, setHighlightChannel] = useState<ChannelKey | null>(null);

  const saveSettings = () => {
    updateCampaign({
      id: campaign.id,
      email_script_id: emailScriptId || undefined,
      sms_script_id: smsScriptId || undefined,
      call_script_id: callScriptId || undefined,
      calendar_connection_id: calendarConnectionId || undefined,
      calling_hours_start: callingHoursStart,
      calling_hours_end: callingHoursEnd,
      max_call_attempts: parseInt(maxCallAttempts, 10) || 3,
      opt_out_required: optOutRequired,
      calling_timezone: callingTimezone,
      channel: primaryChannel,
    } as Parameters<typeof updateCampaign>[0]);
  };

  const openTarget = (t: OutreachTarget) => {
    setSelectedTarget(t);
    setDetailOpen(true);
  };

  const openScriptBuilder = (script?: OutreachScript, defaultChannel?: ChannelKey) => {
    setEditingScript(script);
    setDefaultScriptChannel(defaultChannel);
    setScriptBuilderOpen(true);
  };

  // Derived stats
  const queued = targets.filter((t) => t.state === "queued").length;
  const contacted = targets.filter((t) => t.state !== "queued").length;
  const booked = targets.filter((t) => t.state === "booked").length;
  const optedOut = targets.filter((t) => t.state === "opted_out").length;

  // ── Launch All: contact every queued target using campaign's configured scripts ──
  const resolveVars = (text: string, t: OutreachTarget): string => {
    if (!text) return "";
    const first = (t.entity_name ?? "").split(" ")[0] ?? "";
    return text
      .replace(/\{\{candidate\.first_name\}\}/g, first)
      .replace(/\{\{contact\.first_name\}\}/g, first)
      .replace(/\{\{candidate\.full_name\}\}/g, t.entity_name ?? "")
      .replace(/\{\{contact\.full_name\}\}/g, t.entity_name ?? "")
      .replace(/\{\{candidate\.current_title\}\}/g, t.entity_title ?? "")
      .replace(/\{\{candidate\.current_company\}\}/g, t.entity_company ?? "")
      .replace(/\{\{contact\.company\}\}/g, t.entity_company ?? "");
  };

  const handleLaunchAll = async () => {
    const queuedTargets = targets.filter((t) => t.state === "queued");
    if (queuedTargets.length === 0) {
      toast.info("No queued targets to launch");
      return;
    }

    // Build per-channel script map for every active channel
    const channelScript: Record<ChannelKey, OutreachScript | undefined> = {
      email: allScripts.find((s) => s.id === campaign.email_script_id),
      sms:   allScripts.find((s) => s.id === campaign.sms_script_id),
      call:  allScripts.find((s) => s.id === campaign.call_script_id),
    };
    const missing = activeChannels.filter((c) => !channelScript[c]);
    if (missing.length > 0) {
      toast.error(
        `Missing script for: ${missing.map((c) => c.toUpperCase()).join(", ")}. Opening Scripts tab.`,
        { duration: 6000 }
      );
      setTab("scripts");
      setHighlightChannel(missing[0]);
      return;
    }

    const channelsLabel = activeChannels.map((c) => c.toUpperCase()).join(" + ");
    const ok = window.confirm(
      `Launch outreach to ${queuedTargets.length} queued target${queuedTargets.length !== 1 ? "s" : ""} via ${channelsLabel}?\n\nEach target will be contacted on every active channel they have details for. Primary channel: ${primaryChannel.toUpperCase()}.`
    );
    if (!ok) return;

    setIsLaunching(true);
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    // Activate the campaign if it's still in draft
    if (campaign.status === "draft") {
      try {
        updateCampaign({ id: campaign.id, status: "active" } as any);
      } catch {
        /* non-blocking */
      }
    }

    const eventTypeFor = (c: ChannelKey) =>
      c === "email" ? "email_sent" : c === "sms" ? "sms_sent" : "call_made";

    // Order channels: primary first, then the rest
    const orderedChannels: ChannelKey[] = [
      primaryChannel,
      ...activeChannels.filter((c) => c !== primaryChannel),
    ].filter((c, i, arr) => arr.indexOf(c) === i);

    for (const t of queuedTargets) {
      for (const c of orderedChannels) {
        const script = channelScript[c]!;
        const hasContact = c === "email" ? !!t.entity_email : !!t.entity_phone;
        if (!hasContact) {
          skipped++;
          continue;
        }
        try {
          // State precedence in the hook prevents downgrade; safe to set "contacted" each time.
          await updateTargetState({
            targetId: t.id,
            state: "contacted",
            eventType: eventTypeFor(c) as any,
            metadata: {
              channel: c,
              script_id: script.id,
              script_name: script.name,
              subject: resolveVars(script.subject ?? "", t),
              body: resolveVars(script.body ?? "", t),
              launched_via: "launch_all",
              is_primary: c === primaryChannel,
            },
          });
          sent++;
        } catch (e) {
          failed++;
        }
      }
    }

    setIsLaunching(false);
    if (sent > 0) toast.success(`Launched ${sent} outreach event${sent !== 1 ? "s" : ""} across ${orderedChannels.length} channel${orderedChannels.length !== 1 ? "s" : ""}.`);
    if (skipped > 0) toast.warning(`${skipped} send${skipped !== 1 ? "s" : ""} skipped — target missing email or phone.`);
    if (failed > 0) toast.error(`${failed} send${failed !== 1 ? "s" : ""} failed.`);
  };

  // Scripts grouped by channel for the Scripts tab
  const emailScripts = allScripts.filter((s) => s.channel === "email");
  const smsScripts = allScripts.filter((s) => s.channel === "sms");
  const callScripts = allScripts.filter((s) => s.channel === "call");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-background">
        <div className="container mx-auto px-6 py-5">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
              onClick={onBack}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Campaigns
            </Button>
            {projectId && (
              <>
                <span className="text-muted-foreground text-xs">·</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-7"
                  onClick={() => navigate(`/projects/${projectId}?tab=outreach`)}
                >
                  <Briefcase className="w-3 h-3" />
                  Back to Project
                </Button>
              </>
            )}
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {isEditingHeader ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      ref={nameInputRef}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="text-lg font-bold h-9 max-w-sm"
                      placeholder="Campaign name"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveHeader();
                        if (e.key === "Escape") handleCancelEdit();
                      }}
                    />
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-primary" onClick={handleSaveHeader}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={handleCancelEdit}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="text-sm max-w-md min-h-[60px]"
                    placeholder="Optional description..."
                    rows={2}
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold tracking-tight truncate">{campaign.name}</h1>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => setIsEditingHeader(true)}
                      title="Edit campaign name & description"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Badge
                      className={`text-[10px] capitalize font-medium ${CAMPAIGN_STATUS_BADGE[campaign.status]}`}
                    >
                      {campaign.status}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] capitalize ${CHANNEL_BADGE[campaign.channel] ?? ""}`}
                    >
                      {campaign.channel}
                    </Badge>
                  </div>
                  {campaign.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                      {campaign.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Created {format(parseISO(campaign.created_at), "d MMM yyyy")}
                  </p>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="default"
                className="gap-2 bg-primary hover:bg-primary/90"
                onClick={handleLaunchAll}
                disabled={isLaunching || queued === 0}
                title={
                  queued === 0
                    ? "No queued targets to launch"
                    : `Launch outreach to all ${queued} queued target${queued !== 1 ? "s" : ""}`
                }
                data-jarvis-id="launch-all-button"
              >
                {isLaunching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Rocket className="w-3.5 h-3.5" />
                )}
                {isLaunching ? "Launching…" : `Launch All${queued > 0 ? ` (${queued})` : ""}`}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => openScriptBuilder()}
                data-jarvis-id="new-script-button"
              >
                <FileText className="w-3.5 h-3.5" />
                New Script
              </Button>
              <Button
                size="sm"
                className="gap-2"
                onClick={() => setAddTargetsOpen(true)}
                data-jarvis-id="add-targets-button"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Targets
              </Button>
            </div>
          </div>

          {/* Stats strip */}
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border/40">
            <div className="text-center">
              <p className="text-lg font-bold">{targets.length}</p>
              <p className="text-[11px] text-muted-foreground">Total</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-muted-foreground">{queued}</p>
              <p className="text-[11px] text-muted-foreground">Queued</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{contacted}</p>
              <p className="text-[11px] text-muted-foreground">Contacted</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-primary">{booked}</p>
              <p className="text-[11px] text-muted-foreground">Booked</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-destructive">{optedOut}</p>
              <p className="text-[11px] text-muted-foreground">Opted Out</p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="container mx-auto px-6 py-6">
        {/* Channel mode (single vs mixed) */}
        <ChannelModeSelector
          active={activeChannels}
          primary={primaryChannel}
          onChange={({ active, primary }) => {
            setActiveChannels(active);
            setPrimaryChannel(primary);
          }}
        />

        {/* Visual step-by-step guide */}
        <CampaignSetupGuide
          activeChannels={activeChannels}
          primaryChannel={primaryChannel}
          channelStatus={[
            {
              channel: "email",
              scriptCount: allScripts.filter((s) => s.channel === "email").length,
              scriptAssigned: Boolean(campaign.email_script_id),
            },
            {
              channel: "sms",
              scriptCount: allScripts.filter((s) => s.channel === "sms").length,
              scriptAssigned: Boolean(campaign.sms_script_id),
            },
            {
              channel: "call",
              scriptCount: allScripts.filter((s) => s.channel === "call").length,
              scriptAssigned: Boolean(campaign.call_script_id),
            },
          ]}
          targetCount={targets.length}
          queuedCount={queued}
          isLaunching={isLaunching}
          onAddTargets={() => setAddTargetsOpen(true)}
          onCreateScript={(c) => {
            setTab("scripts");
            openScriptBuilder(undefined, c);
          }}
          onAssignScript={(c) => {
            setTab("scripts");
            setHighlightChannel(c);
            // Scroll to the assignment block once tab swap renders
            setTimeout(() => scriptsTabRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
            setTimeout(() => setHighlightChannel(null), 2400);
          }}
          onLaunch={handleLaunchAll}
        />

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="mb-4">
            <TabsTrigger value="targets" className="gap-2" data-jarvis-id="outreach-tab-queue">
              <Users className="w-3.5 h-3.5" />
              Targets
              {targets.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                  {targets.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="responses" className="gap-2" data-jarvis-id="outreach-tab-responses">
              <Inbox className="w-3.5 h-3.5" />
              Responses
            </TabsTrigger>
            <TabsTrigger value="scripts" className="gap-2" data-jarvis-id="outreach-tab-scripts">
              <FileText className="w-3.5 h-3.5" />
              Scripts
            </TabsTrigger>
            <TabsTrigger value="automation" className="gap-2" data-jarvis-id="outreach-tab-automation">
              <Bot className="w-3.5 h-3.5" />
              Automation
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2" data-jarvis-id="outreach-tab-settings">
              <Settings className="w-3.5 h-3.5" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* ── Targets Tab ── */}
          <TabsContent value="targets" className="mt-0">
            <div className="flex items-center gap-2 mb-3">
              <Select
                value={filterState || "all"}
                onValueChange={(v) =>
                  setFilterState(v === "all" ? "" : (v as OutreachTargetState))
                }
              >
                <SelectTrigger className="h-8 w-[140px] text-sm">
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  <SelectItem value="queued">Queued</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="responded">Responded</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="snoozed">Snoozed</SelectItem>
                  <SelectItem value="opted_out">Opted Out</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                </SelectContent>
              </Select>
              {filterState && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs px-2"
                  onClick={() => setFilterState("")}
                >
                  Clear
                </Button>
              )}
            </div>

            <div className="rounded-lg border border-border/50 bg-card">
              {targetsLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : targets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Users className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="font-medium text-sm">No targets yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    Add candidates from your talent pool to start outreach.
                  </p>
                  <Button
                    size="sm"
                    className="mt-4 gap-2"
                    onClick={() => setAddTargetsOpen(true)}
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Targets
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-medium">Name</TableHead>
                      <TableHead className="text-xs font-medium hidden md:table-cell">Campaign</TableHead>
                      <TableHead className="text-xs font-medium">State</TableHead>
                      <TableHead className="text-xs font-medium hidden lg:table-cell">Last Contact</TableHead>
                      <TableHead className="text-xs font-medium w-[200px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {targets.map((target) => (
                      <OutreachTargetRow
                        key={target.id}
                        target={target}
                        onOpen={openTarget}
                      />
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            {targets.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2 px-1">
                {targets.length} target{targets.length !== 1 ? "s" : ""}
              </p>
            )}
          </TabsContent>

          {/* ── Responses Tab ── */}
          <TabsContent value="responses" className="mt-0">
            <InboundResponsesPanel campaignId={campaign.id} />
          </TabsContent>

          {/* ── Scripts Tab ── */}
          <TabsContent value="scripts" className="mt-0 space-y-6" data-jarvis-id="outreach-panel-scripts">
            {/* Script assignment section */}
            <div ref={scriptsTabRef} className="rounded-lg border border-border/50 bg-card p-5 space-y-5" data-jarvis-id="outreach-script-assignment">
              <div>
                <h3 className="text-sm font-semibold mb-1">Assigned Scripts</h3>
                <p className="text-xs text-muted-foreground">
                  Select which scripts this campaign uses per channel. Scripts can be created
                  below or in the global Scripts tab.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {/* Email */}
                <div className={`space-y-1.5 rounded-md p-2 -m-2 transition-colors ${highlightChannel === "email" ? "bg-primary/10 ring-1 ring-primary/40" : ""}`}>
                  <Label className="text-xs flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-primary" />
                    Email Script
                  </Label>
                  <Select
                    value={emailScriptId || "none"}
                    onValueChange={(v) => setEmailScriptId(v === "none" ? "" : v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {emailScripts.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* SMS */}
                <div className={`space-y-1.5 rounded-md p-2 -m-2 transition-colors ${highlightChannel === "sms" ? "bg-primary/10 ring-1 ring-primary/40" : ""}`}>
                  <Label className="text-xs flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-primary" />
                    SMS Script
                  </Label>
                  <Select
                    value={smsScriptId || "none"}
                    onValueChange={(v) => setSmsScriptId(v === "none" ? "" : v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {smsScripts.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Call */}
                <div className={`space-y-1.5 rounded-md p-2 -m-2 transition-colors ${highlightChannel === "call" ? "bg-primary/10 ring-1 ring-primary/40" : ""}`}>
                  <Label className="text-xs flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-primary" />
                    Call Script
                  </Label>
                  <Select
                    value={callScriptId || "none"}
                    onValueChange={(v) => setCallScriptId(v === "none" ? "" : v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {callScripts.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={saveSettings}
                  disabled={isUpdating}
                  data-jarvis-id="script-save-assignments-button"
                >
                  {isUpdating ? "Saving…" : "Save Script Assignments"}
                </Button>
              </div>
            </div>

            {/* Campaign-specific scripts list */}
            <div data-jarvis-id="outreach-scripts-list">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold">Campaign Scripts</h3>
                  <p className="text-xs text-muted-foreground">
                    Scripts created specifically for this campaign.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => openScriptBuilder()}
                  data-jarvis-id="new-script-button"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Script
                </Button>
              </div>

              {scriptsLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : scripts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center">
                  <FileText className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No campaign-specific scripts. Create one or assign a global script above.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {scripts.map((script) => (
                    <div
                      key={script.id}
                      className="rounded-lg border border-border/50 bg-card px-4 py-3 hover:border-border transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{script.name}</span>
                            <Badge
                              className={`text-[10px] capitalize ${CHANNEL_BADGE[script.channel] ?? "bg-muted text-muted-foreground"}`}
                            >
                              {script.channel}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">v{script.version}</span>
                          </div>
                          {script.subject && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              Subject: {script.subject}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 shrink-0"
                        onClick={() => openScriptBuilder(script)}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Automation Tab ── */}
          <TabsContent value="automation" className="mt-0">
            <div className="max-w-xl">
              <AutomationSettingsPanel campaignId={campaign.id} />
            </div>
          </TabsContent>

          {/* ── Settings Tab ── */}
          <TabsContent value="settings" className="mt-0">
            <div className="max-w-xl space-y-6">
              {/* Calendar */}
              <div className="rounded-lg border border-border/50 bg-card p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <CalendarClock className="w-4 h-4" />
                    Calendar & Scheduling
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Connect a calendar to offer booking slots during AI calls.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Calendar Connection ID</Label>
                  <Input
                    className="h-8 text-sm"
                    placeholder="e.g. cal_xxxxxxxx"
                    value={calendarConnectionId}
                    onChange={(e) => setCalendarConnectionId(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Paste your calendar integration ID. Used to offer meeting slots during AI calls.
                  </p>
                </div>
              </div>

              {/* Calling hours */}
              <div className="rounded-lg border border-border/50 bg-card p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Calling Hours
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    AI calls will only be made within these hours. Applied to all targets in this campaign.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Start Time</Label>
                    <Input
                      type="time"
                      className="h-8 text-sm"
                      value={callingHoursStart}
                      onChange={(e) => setCallingHoursStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">End Time</Label>
                    <Input
                      type="time"
                      className="h-8 text-sm"
                      value={callingHoursEnd}
                      onChange={(e) => setCallingHoursEnd(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Timezone</Label>
                  <Select value={callingTimezone} onValueChange={setCallingTimezone}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="Europe/London">Europe/London</SelectItem>
                      <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                      <SelectItem value="America/New_York">America/New_York</SelectItem>
                      <SelectItem value="America/Chicago">America/Chicago</SelectItem>
                      <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                      <SelectItem value="Asia/Dubai">Asia/Dubai</SelectItem>
                      <SelectItem value="Asia/Singapore">Asia/Singapore</SelectItem>
                      <SelectItem value="Australia/Sydney">Australia/Sydney</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Call attempts & compliance */}
              <div className="rounded-lg border border-border/50 bg-card p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Compliance & Limits</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Set guardrails to protect candidate experience and stay compliant.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Max Call Attempts per Target</Label>
                  <Select value={maxCallAttempts} onValueChange={setMaxCallAttempts}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 10].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} attempt{n !== 1 ? "s" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium">Opt-Out Required</p>
                    <p className="text-xs text-muted-foreground">
                      Every call/message must offer opt-out. Required for GDPR compliance.
                    </p>
                  </div>
                  <Switch
                    checked={optOutRequired}
                    onCheckedChange={setOptOutRequired}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveSettings} disabled={isUpdating}>
                  {isUpdating ? "Saving…" : "Save Settings"}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <AddTargetsModal
        open={addTargetsOpen}
        onOpenChange={setAddTargetsOpen}
        campaignId={campaign.id}
      />

      <ScriptBuilderModal
        open={scriptBuilderOpen}
        onOpenChange={setScriptBuilderOpen}
        campaignId={campaign.id}
        script={editingScript}
        defaultChannel={defaultScriptChannel}
      />

      <TargetDetailSheet
        target={selectedTarget}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
