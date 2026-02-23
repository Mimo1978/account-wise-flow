import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Plus, Search, Users, Megaphone, Filter, FileText, Edit2, Trash2, ChevronRight, RotateCcw, Mail, Phone, Calendar, XCircle, BellOff, CheckCircle, ArrowRight } from "lucide-react";
import {
  useOutreachCampaigns,
  useOutreachTargets,
  type OutreachTarget,
  type OutreachTargetState,
  type OutreachCampaignStatus,
  type OutreachCampaign,
  useBatchResetTargets,
  useBatchUpdateTargetState,
} from "@/hooks/use-outreach";
import { useOutreachScripts, useDeleteScript } from "@/hooks/use-scripts";
import { CreateCampaignModal } from "@/components/outreach/CreateCampaignModal";
import { AddTargetsModal } from "@/components/outreach/AddTargetsModal";
import { OutreachTargetRow } from "@/components/outreach/OutreachTargetRow";
import { TargetDetailSheet } from "@/components/outreach/TargetDetailSheet";
import { ScriptBuilderModal } from "@/components/outreach/ScriptBuilderModal";
import { CampaignDetailView } from "@/components/outreach/CampaignDetailView";
import type { OutreachScript } from "@/lib/script-types";
import { format, parseISO } from "date-fns";
import { usePermissions } from "@/hooks/use-permissions";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";


// ─── Campaign status badge ────────────────────────────────────────────────────

const CAMPAIGN_STATUS_BADGE: Record<OutreachCampaignStatus, string> = {
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

// ─── Outreach Page ────────────────────────────────────────────────────────────

export default function OutreachPage() {
  const [tab, setTab] = useState<"queue" | "campaigns" | "scripts">("queue");
  const [createCampaignOpen, setCreateCampaignOpen] = useState(false);
  const [addTargetsOpen, setAddTargetsOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<OutreachTarget | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newCampaignId, setNewCampaignId] = useState<string | undefined>();
  const [scriptBuilderOpen, setScriptBuilderOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<OutreachScript | undefined>();
  const [selectedCampaign, setSelectedCampaign] = useState<OutreachCampaign | null>(null);

  // Filters
  const [searchText, setSearchText] = useState("");
  const [filterCampaign, setFilterCampaign] = useState("");
  const [filterState, setFilterState] = useState<OutreachTargetState | "">("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { data: campaigns = [], isLoading: campaignsLoading } = useOutreachCampaigns();
  const { data: targets = [], isLoading: targetsLoading } = useOutreachTargets({
    campaignId: filterCampaign || undefined,
    state: filterState || undefined,
  });
  const { data: scripts = [], isLoading: scriptsLoading } = useOutreachScripts();
  const { mutate: deleteScript } = useDeleteScript();
  const { mutate: batchReset, isPending: batchResetting } = useBatchResetTargets();
  const { mutate: batchUpdate, isPending: batchUpdating } = useBatchUpdateTargetState();
  const { canEdit, canInsert, canDelete, role, teamId, userId } = usePermissions();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const isReadOnly = !canEdit;

  const filteredTargets = targets.filter((t) => {
    if (!searchText.trim()) return true;
    const q = searchText.toLowerCase();
    return (
      t.entity_name.toLowerCase().includes(q) ||
      t.entity_title?.toLowerCase().includes(q) ||
      t.entity_company?.toLowerCase().includes(q) ||
      t.entity_email?.toLowerCase().includes(q)
    );
  });

  // Selection helpers
  const allSelected = filteredTargets.length > 0 && filteredTargets.every((t) => selectedIds.has(t.id));
  const someSelected = filteredTargets.some((t) => selectedIds.has(t.id));
  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTargets.map((t) => t.id)));
    }
  };
  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };
  const handleBatchReset = () => {
    const ids = Array.from(selectedIds);
    batchReset(ids, { onSuccess: () => setSelectedIds(new Set()) });
  };
  const handleBatchState = (state: OutreachTargetState) => {
    const ids = Array.from(selectedIds);
    batchUpdate({ targetIds: ids, state }, { onSuccess: () => setSelectedIds(new Set()) });
  };
  const isBatchBusy = batchResetting || batchUpdating;


  const openTarget = (t: OutreachTarget) => {
    setSelectedTarget(t);
    setDetailOpen(true);
  };

  const handleCampaignCreated = (id: string) => {
    setNewCampaignId(id);
    setTab("campaigns");
  };

  const openScriptBuilder = (script?: OutreachScript) => {
    setEditingScript(script);
    setScriptBuilderOpen(true);
  };

  // If a campaign is selected, render the Campaign Detail Hub
  if (selectedCampaign) {
    const liveCampaign = campaigns.find((c) => c.id === selectedCampaign.id) ?? selectedCampaign;
    return (
      <CampaignDetailView
        campaign={liveCampaign}
        onBack={() => {
          setSelectedCampaign(null);
          setTab("campaigns");
        }}
      />
    );
  }

  // Stats
  const totalTargets = targets.length;
  const contacted = targets.filter((t) => t.state !== "queued").length;
  const booked = targets.filter((t) => t.state === "booked").length;

  return (
    <div className="min-h-screen bg-background">
      {/* DEV-ONLY diagnostic banner */}
      {import.meta.env.DEV && (
        <div className="bg-yellow-100 dark:bg-yellow-900/30 border-b border-yellow-300 dark:border-yellow-700 px-6 py-2 text-xs font-mono text-yellow-900 dark:text-yellow-200 flex flex-wrap gap-x-6 gap-y-1">
          <span>workspace: {currentWorkspace?.id ?? "none"}</span>
          <span>user: {user?.id ?? userId ?? "none"}</span>
          <span>role: {role ?? "loading"}</span>
          <span>teamId: {teamId ?? "none"}</span>
          <span>campaigns: {campaignsLoading ? "…" : campaigns.length}</span>
          <span>targets: {targetsLoading ? "…" : targets.length}</span>
          <span>scripts: {scriptsLoading ? "…" : scripts.length}</span>
          <span>source: Supabase (real data)</span>
        </div>
      )}
      {/* Header */}
      <div className="border-b border-border/50 bg-background">
        <div className="container mx-auto px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Megaphone className="w-6 h-6 text-primary" />
                Outreach
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage campaigns, target queues, and track every outreach interaction
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setAddTargetsOpen(true)}
                disabled={campaigns.length === 0 || isReadOnly}
                title={isReadOnly ? "Viewers have read-only access" : undefined}
              >
                <Users className="w-4 h-4" />
                Add Targets
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => openScriptBuilder()}
                disabled={isReadOnly}
                title={isReadOnly ? "Viewers have read-only access" : undefined}
              >
                <FileText className="w-4 h-4" />
                New Script
              </Button>
              <Button
                size="sm"
                className="gap-2"
                onClick={() => setCreateCampaignOpen(true)}
                disabled={isReadOnly}
                title={isReadOnly ? "Viewers have read-only access" : undefined}
              >
                <Plus className="w-4 h-4" />
                New Campaign
              </Button>
            </div>
          </div>

          {/* Stats */}
          {targets.length > 0 && (
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border/40">
              <div className="text-center">
                <p className="text-xl font-bold">{totalTargets}</p>
                <p className="text-xs text-muted-foreground">Total Targets</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">{contacted}</p>
                <p className="text-xs text-muted-foreground">Contacted</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">{booked}</p>
                <p className="text-xs text-muted-foreground">Booked</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">
                  {totalTargets > 0 ? Math.round((booked / totalTargets) * 100) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Conversion</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="container mx-auto px-6 py-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "queue" | "campaigns" | "scripts")}>
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="queue" className="gap-2">
                <Users className="w-3.5 h-3.5" />
                Target Queue
              </TabsTrigger>
              <TabsTrigger value="campaigns" className="gap-2">
                <Megaphone className="w-3.5 h-3.5" />
                Campaigns
                {campaigns.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                    {campaigns.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="scripts" className="gap-2">
                <FileText className="w-3.5 h-3.5" />
                Scripts
                {scripts.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                    {scripts.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ─── Target Queue Tab ─── */}
          <TabsContent value="queue" className="mt-0">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="pl-9 h-8 text-sm"
                  placeholder="Search targets..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>

              <Select
                value={filterCampaign || "all"}
                onValueChange={(v) => setFilterCampaign(v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-8 w-[180px] text-sm">
                  <Filter className="w-3 h-3 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Campaign" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Campaigns</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filterState || "all"}
                onValueChange={(v) =>
                  setFilterState(v === "all" ? "" : (v as OutreachTargetState))
                }
              >
                <SelectTrigger className="h-8 w-[140px] text-sm">
                  <SelectValue placeholder="State" />
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

              {(filterCampaign || filterState || searchText) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => {
                    setFilterCampaign("");
                    setFilterState("");
                    setSearchText("");
                  }}
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Batch action bar — above table */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 mb-3 px-4 py-2.5 rounded-lg border border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-2 duration-200">
                <span className="text-sm font-medium whitespace-nowrap">
                  {selectedIds.size} selected
                </span>
                <div className="h-4 w-px bg-border mx-1" />
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" disabled={isBatchBusy || isReadOnly} onClick={() => handleBatchState("queued")}>
                    <RotateCcw className="w-3 h-3" /> Queued
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" disabled={isBatchBusy || isReadOnly} onClick={() => handleBatchState("contacted")}>
                    <Mail className="w-3 h-3" /> Contacted
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" disabled={isBatchBusy || isReadOnly} onClick={() => handleBatchState("responded")}>
                    <ArrowRight className="w-3 h-3" /> Responded
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" disabled={isBatchBusy || isReadOnly} onClick={() => handleBatchState("booked")}>
                    <Calendar className="w-3 h-3" /> Booked
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" disabled={isBatchBusy || isReadOnly} onClick={() => handleBatchState("snoozed")}>
                    <BellOff className="w-3 h-3" /> Snoozed
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" disabled={isBatchBusy || isReadOnly} onClick={() => handleBatchState("converted")}>
                    <CheckCircle className="w-3 h-3" /> Converted
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs text-destructive hover:text-destructive" disabled={isBatchBusy || isReadOnly} onClick={() => handleBatchState("opted_out")}>
                    <XCircle className="w-3 h-3" /> Opted Out
                  </Button>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto whitespace-nowrap" onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
              </div>
            )}

            {/* Table */}
            <div className="rounded-lg border border-border/50 bg-card">
              {targetsLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : filteredTargets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Users className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="font-medium text-sm">No targets in queue</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    {campaigns.length === 0
                      ? "Create a campaign first, then add targets from your talent or contacts database."
                      : "Add candidates from your talent pool to get started."}
                  </p>
                  {campaigns.length === 0 ? (
                    <Button
                      size="sm"
                      className="mt-4 gap-2"
                      onClick={() => setCreateCampaignOpen(true)}
                    >
                      <Plus className="w-3.5 h-3.5" /> New Campaign
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="mt-4 gap-2"
                      onClick={() => setAddTargetsOpen(true)}
                    >
                      <Users className="w-3.5 h-3.5" /> Add Targets
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10 px-4">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                          onChange={toggleAll}
                          className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                        />
                      </TableHead>
                      <TableHead className="text-xs font-medium">Name</TableHead>
                      <TableHead className="text-xs font-medium hidden md:table-cell">Campaign</TableHead>
                      <TableHead className="text-xs font-medium">State</TableHead>
                      <TableHead className="text-xs font-medium hidden lg:table-cell">Last Contact</TableHead>
                      <TableHead className="text-xs font-medium w-[200px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTargets.map((target) => (
                      <OutreachTargetRow
                        key={target.id}
                        target={target}
                        onOpen={openTarget}
                        selected={selectedIds.has(target.id)}
                        onSelectChange={toggleOne}
                      />
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {filteredTargets.length > 0 && selectedIds.size === 0 && (
              <p className="text-xs text-muted-foreground mt-2 px-1">
                {filteredTargets.length} target{filteredTargets.length !== 1 ? "s" : ""}
              </p>
            )}
          </TabsContent>

          {/* ─── Campaigns Tab ─── */}
          <TabsContent value="campaigns" className="mt-0">
            {campaignsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : campaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Megaphone className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="font-medium text-sm">No campaigns yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create your first campaign to start managing outreach.
                </p>
                <Button
                  size="sm"
                  className="mt-4 gap-2"
                  onClick={() => setCreateCampaignOpen(true)}
                >
                  <Plus className="w-3.5 h-3.5" /> New Campaign
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="rounded-lg border border-border/50 bg-card p-4 hover:border-border transition-colors cursor-pointer group"
                    onClick={() => setSelectedCampaign(campaign)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                            {campaign.name}
                          </h3>
                          <Badge
                            className={`text-[10px] capitalize font-medium ${CAMPAIGN_STATUS_BADGE[campaign.status]}`}
                          >
                            {campaign.status}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {campaign.channel}
                          </Badge>
                        </div>
                        {campaign.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {campaign.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs h-8"
                          onClick={() => setSelectedCampaign(campaign)}
                        >
                          View
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 h-8"
                          onClick={() => {
                            setNewCampaignId(campaign.id);
                            setAddTargetsOpen(true);
                          }}
                        >
                          <Users className="w-3.5 h-3.5" />
                          Add Targets
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/40">
                      <div className="text-center">
                        <p className="text-sm font-semibold">{campaign.target_count}</p>
                        <p className="text-[10px] text-muted-foreground">Targets</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold">{campaign.contacted_count}</p>
                        <p className="text-[10px] text-muted-foreground">Contacted</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold">{campaign.response_count}</p>
                        <p className="text-[10px] text-muted-foreground">Responses</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-[10px] text-muted-foreground">
                          Created {format(parseISO(campaign.created_at), "d MMM yyyy")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── Scripts Tab ─── */}
          <TabsContent value="scripts" className="mt-0">
            {scriptsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : scripts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="font-medium text-sm">No scripts yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Create email, SMS and call scripts with template variables and guardrails.
                </p>
                <Button
                  size="sm"
                  className="mt-4 gap-2"
                  onClick={() => openScriptBuilder()}
                >
                  <Plus className="w-3.5 h-3.5" /> New Script
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {scripts.map((script) => (
                  <div
                    key={script.id}
                    className="rounded-lg border border-border/50 bg-card px-4 py-3 hover:border-border transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1 flex items-center gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate">{script.name}</span>
                            <Badge
                              className={`text-[10px] capitalize ${CHANNEL_BADGE[script.channel] ?? "bg-muted text-muted-foreground"}`}
                            >
                              {script.channel}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              v{script.version}
                            </span>
                            {script.is_default && (
                              <Badge variant="outline" className="text-[10px]">Default</Badge>
                            )}
                          </div>
                          {script.subject && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              Subject: {script.subject}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-muted-foreground hidden sm:block">
                          {format(parseISO(script.updated_at), "d MMM yy")}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => openScriptBuilder(script)}
                          title="Edit script"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => deleteScript(script.id)}
                          title="Delete script"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals & Sheets */}
      <CreateCampaignModal
        open={createCampaignOpen}
        onOpenChange={setCreateCampaignOpen}
        onCreated={handleCampaignCreated}
      />

      <AddTargetsModal
        open={addTargetsOpen}
        onOpenChange={setAddTargetsOpen}
        campaignId={newCampaignId ?? campaigns[0]?.id ?? ""}
      />

      <TargetDetailSheet
        target={selectedTarget}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      <ScriptBuilderModal
        open={scriptBuilderOpen}
        onOpenChange={setScriptBuilderOpen}
        campaignId={newCampaignId}
        script={editingScript}
      />
    </div>
  );
}
