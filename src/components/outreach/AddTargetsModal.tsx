import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, UserPlus, Users, ExternalLink, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAddTargets, useOutreachTargets } from "@/hooks/use-outreach";

// ─── Types ────────────────────────────────────────────────────────────────────

type EntityKind = "candidates" | "contacts" | "both";

interface CandidateRow {
  id: string;
  kind: "candidate";
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  company?: string;
  availability_status?: string;
  location?: string;
}

interface ContactRow {
  id: string;
  kind: "contact";
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  company?: string;
  department?: string;
}

type ResultRow = CandidateRow | ContactRow;

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignId: string;
}

export function AddTargetsModal({ open, onOpenChange, campaignId }: Props) {
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<EntityKind>("both");
  const [selected, setSelected] = useState<Map<string, ResultRow>>(new Map());
  const { mutateAsync: addTargets, isPending } = useAddTargets();

  // Load existing targets for this campaign so we can de-dupe
  const { data: existingTargets = [] } = useOutreachTargets({
    campaignId: campaignId || undefined,
  });

  const existingCandidateIds = useMemo(
    () => new Set(existingTargets.map((t) => t.candidate_id).filter(Boolean)),
    [existingTargets]
  );
  const existingContactIds = useMemo(
    () => new Set(existingTargets.map((t) => t.contact_id).filter(Boolean)),
    [existingTargets]
  );

  const searchTerm = search.trim();

  // ── Candidates query ──
  const { data: candidates = [], isLoading: loadingCandidates } = useQuery({
    queryKey: ["add_targets_candidates", currentWorkspace?.id, searchTerm],
    enabled: !!currentWorkspace?.id && open && kind !== "contacts",
    queryFn: async () => {
      let q = supabase
        .from("candidates")
        .select("id, name, email, phone, current_title, current_company, availability_status, location")
        .eq("tenant_id", currentWorkspace!.id)
        .order("name");
      if (searchTerm) {
        q = q.or(
          `name.ilike.%${searchTerm}%,current_title.ilike.%${searchTerm}%,current_company.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%`
        );
      }
      const { data } = await q.limit(40);
      return (data ?? []).map((c) => ({
        id: c.id,
        kind: "candidate" as const,
        name: c.name,
        email: c.email ?? undefined,
        phone: c.phone ?? undefined,
        title: c.current_title ?? undefined,
        company: c.current_company ?? undefined,
        availability_status: c.availability_status ?? undefined,
        location: c.location ?? undefined,
      })) as CandidateRow[];
    },
  });

  // ── Contacts query ──
  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ["add_targets_contacts", currentWorkspace?.id, searchTerm],
    enabled: !!currentWorkspace?.id && open && kind !== "candidates",
    queryFn: async () => {
      let q = supabase
        .from("contacts")
        .select("id, name, email, phone, title, company_id, department")
        .eq("team_id", currentWorkspace!.id)
        .order("name");
      if (searchTerm) {
        q = q.or(`name.ilike.%${searchTerm}%,title.ilike.%${searchTerm}%,department.ilike.%${searchTerm}%`);
      }
      const { data } = await q.limit(40);
      return (data ?? []).map((c) => ({
        id: c.id,
        kind: "contact" as const,
        name: c.name,
        email: c.email ?? undefined,
        phone: c.phone ?? undefined,
        title: c.title ?? undefined,
        company: undefined,
        department: c.department ?? undefined,
      })) as ContactRow[];
    },
  });

  // ── Merge and filter ──
  const results = useMemo<ResultRow[]>(() => {
    const rows: ResultRow[] = [];
    if (kind !== "contacts") rows.push(...candidates);
    if (kind !== "candidates") rows.push(...contacts);
    return rows;
  }, [candidates, contacts, kind]);

  const isAlreadyAdded = (row: ResultRow) => {
    if (row.kind === "candidate") return existingCandidateIds.has(row.id);
    return existingContactIds.has(row.id);
  };

  const availableResults = results.filter((r) => !isAlreadyAdded(r));
  const alreadyAddedCount = results.length - availableResults.length;
  const isLoading = (kind !== "contacts" && loadingCandidates) || (kind !== "candidates" && loadingContacts);

  const toggleRow = (row: ResultRow) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const key = `${row.kind}:${row.id}`;
      next.has(key) ? next.delete(key) : next.set(key, row);
      return next;
    });
  };

  const isSelected = (row: ResultRow) => selected.has(`${row.kind}:${row.id}`);

  const toggleAll = () => {
    if (selected.size === availableResults.length) {
      setSelected(new Map());
    } else {
      const next = new Map<string, ResultRow>();
      availableResults.forEach((r) => next.set(`${r.kind}:${r.id}`, r));
      setSelected(next);
    }
  };

  const handleAdd = async () => {
    const rows = Array.from(selected.values());
    await addTargets(
      rows.map((r) => ({
        campaign_id: campaignId,
        candidate_id: r.kind === "candidate" ? r.id : undefined,
        contact_id: r.kind === "contact" ? r.id : undefined,
        entity_type: r.kind === "candidate" ? ("candidate" as const) : ("contact" as const),
        entity_name: r.name,
        entity_email: r.email,
        entity_phone: r.phone,
        entity_title: r.title,
        entity_company: r.company,
      }))
    );
    setSelected(new Map());
    onOpenChange(false);
  };

  const openTalentSearch = () => {
    onOpenChange(false);
    navigate("/talent");
  };

  const openContactsSearch = () => {
    onOpenChange(false);
    navigate("/contacts");
  };

  const handleClose = () => {
    setSearch("");
    setSelected(new Map());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserPlus className="w-4 h-4" />
            Add Targets
          </DialogTitle>
        </DialogHeader>

        {/* ── Quick Add Section ── */}
        <div className="px-5 pt-4 pb-3 space-y-3">
          {/* Kind toggle + search row */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="pl-9 h-8 text-sm"
                placeholder="Search candidates or contacts…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <Tabs value={kind} onValueChange={(v) => { setKind(v as EntityKind); setSelected(new Map()); }}>
              <TabsList className="h-8">
                <TabsTrigger value="both" className="text-xs px-2.5 h-6">Both</TabsTrigger>
                <TabsTrigger value="candidates" className="text-xs px-2.5 h-6">Candidates</TabsTrigger>
                <TabsTrigger value="contacts" className="text-xs px-2.5 h-6">Contacts</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Select-all row */}
          {availableResults.length > 1 && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selected.size === availableResults.length && availableResults.length > 0}
                onCheckedChange={toggleAll}
                className="h-3.5 w-3.5"
              />
              <span className="text-xs text-muted-foreground">
                Select all ({availableResults.length})
              </span>
              {alreadyAddedCount > 0 && (
                <span className="text-xs text-muted-foreground ml-auto">
                  {alreadyAddedCount} already in campaign
                </span>
              )}
            </div>
          )}

          {/* Results list */}
          <ScrollArea className="h-64 rounded-md border border-border/50 bg-muted/20">
            <div className="p-1.5 space-y-0.5">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : availableResults.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground font-medium">No results</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {searchTerm
                      ? "Try a different search term."
                      : "No records found in your workspace."}
                    {" "}Use Talent Search below for advanced filters.
                  </p>
                </div>
              ) : (
                availableResults.map((row) => (
                  <label
                    key={`${row.kind}:${row.id}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/60 cursor-pointer transition-colors group"
                  >
                    <Checkbox
                      checked={isSelected(row)}
                      onCheckedChange={() => toggleRow(row)}
                      className="h-3.5 w-3.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{row.name}</p>
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 h-3.5 shrink-0 capitalize"
                        >
                          {row.kind === "candidate" ? "talent" : "contact"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {row.kind === "candidate"
                          ? [row.title, row.company, row.location].filter(Boolean).join(" · ")
                          : [row.title, (row as ContactRow).department].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {row.kind === "candidate" && (row as CandidateRow).availability_status && (
                      <Badge
                        variant={(row as CandidateRow).availability_status === "available" ? "default" : "secondary"}
                        className="text-[10px] shrink-0"
                      >
                        {(row as CandidateRow).availability_status}
                      </Badge>
                    )}
                  </label>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ── Import section ── */}
        <Separator />
        <div className="px-5 py-3">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Advanced search & bulk import</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs h-8"
              onClick={openTalentSearch}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Talent Search
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs h-8"
              onClick={openContactsSearch}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Contacts Search
            </Button>
          </div>
        </div>

        {/* ── Footer ── */}
        <Separator />
        <div className="px-5 py-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {selected.size > 0
              ? `${selected.size} selected`
              : `${availableResults.length} result${availableResults.length !== 1 ? "s" : ""}`}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={selected.size === 0 || isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Adding…
                </>
              ) : (
                `Add ${selected.size > 0 ? selected.size + " " : ""}Target${selected.size !== 1 ? "s" : ""}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
