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
import { Plus, Search, Users, Megaphone, Filter } from "lucide-react";
import {
  useOutreachCampaigns,
  useOutreachTargets,
  OutreachTarget,
  OutreachTargetState,
  OutreachCampaignStatus,
} from "@/hooks/use-outreach";
import { CreateCampaignModal } from "@/components/outreach/CreateCampaignModal";
import { AddTargetsModal } from "@/components/outreach/AddTargetsModal";
import { OutreachTargetRow } from "@/components/outreach/OutreachTargetRow";
import { TargetDetailSheet } from "@/components/outreach/TargetDetailSheet";
import { format, parseISO } from "date-fns";

// ─── Campaign status badge ────────────────────────────────────────────────────

const CAMPAIGN_STATUS_BADGE: Record<OutreachCampaignStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  archived: "bg-muted text-muted-foreground",
};

// ─── Outreach Page ────────────────────────────────────────────────────────────

export default function OutreachPage() {
  const [tab, setTab] = useState<"queue" | "campaigns">("queue");
  const [createCampaignOpen, setCreateCampaignOpen] = useState(false);
  const [addTargetsOpen, setAddTargetsOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<OutreachTarget | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newCampaignId, setNewCampaignId] = useState<string | undefined>();

  // Filters
  const [searchText, setSearchText] = useState("");
  const [filterCampaign, setFilterCampaign] = useState("");
  const [filterState, setFilterState] = useState<OutreachTargetState | "">("");

  const { data: campaigns = [], isLoading: campaignsLoading } = useOutreachCampaigns();
  const { data: targets = [], isLoading: targetsLoading } = useOutreachTargets({
    campaignId: filterCampaign || undefined,
    state: filterState || undefined,
  });

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

  const openTarget = (t: OutreachTarget) => {
    setSelectedTarget(t);
    setDetailOpen(true);
  };

  const handleCampaignCreated = (id: string) => {
    setNewCampaignId(id);
    setTab("campaigns");
  };

  // Stats
  const totalTargets = targets.length;
  const contacted = targets.filter((t) => t.state !== "queued").length;
  const booked = targets.filter((t) => t.state === "booked").length;

  return (
    <div className="min-h-screen bg-background">
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
                disabled={campaigns.length === 0}
              >
                <Users className="w-4 h-4" />
                Add Targets
              </Button>
              <Button
                size="sm"
                className="gap-2"
                onClick={() => setCreateCampaignOpen(true)}
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
        <Tabs value={tab} onValueChange={(v) => setTab(v as "queue" | "campaigns")}>
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
                      />
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {filteredTargets.length > 0 && (
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
                    className="rounded-lg border border-border/50 bg-card p-4 hover:border-border transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-sm truncate">{campaign.name}</h3>
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
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 gap-2"
                        onClick={() => {
                          setNewCampaignId(campaign.id);
                          setAddTargetsOpen(true);
                        }}
                      >
                        <Users className="w-3.5 h-3.5" />
                        Add Targets
                      </Button>
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
    </div>
  );
}
