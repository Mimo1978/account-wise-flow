import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, UserPlus, Users, ExternalLink, Loader2, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAddTargets, useOutreachTargets } from "@/hooks/use-outreach";
import { parseBooleanQuery, simpleQueryToTsquery } from "@/lib/boolean-search-parser";

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

// ─── Boolean detection ────────────────────────────────────────────────────────

const BOOLEAN_PATTERN = /\bAND\b|\bOR\b|\bNOT\b|"[^"]+"|-\w+/;

function isBooleanQuery(q: string): boolean {
  return BOOLEAN_PATTERN.test(q);
}

/**
 * Build a PostgREST OR filter string for contacts.
 * Each term is matched across name/title/department/email.
 * Terms are OR'd together (any term matching = include).
 */
function buildContactOrFilter(terms: string[]): string {
  return terms
    .map((t) =>
      `name.ilike.%${t}%,title.ilike.%${t}%,department.ilike.%${t}%,email.ilike.%${t}%,phone.ilike.%${t}%`
    )
    .join(",");
}

/** Normalise "-exclude" prefix-minus into NOT syntax for the parser */
function normaliseMinus(q: string): string {
  return q.replace(/(^|\s)-(\w+)/g, "$1NOT $2");
}

// ─── Debounce hook ────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

// ─── Component ────────────────────────────────────────────────────────────────

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
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce the raw input so we don't fire on every keystroke
  const debouncedSearch = useDebounce(search, 280);
  const searchTerm = debouncedSearch.trim();

  // Load existing targets for de-duplication
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

  // Detect boolean mode
  const isBoolean = useMemo(() => isBooleanQuery(searchTerm), [searchTerm]);

  // Parse query once for use in both queries
  const parsed = useMemo(() => {
    if (!searchTerm) return null;
    const normalised = normaliseMinus(searchTerm);
    if (isBoolean) return parseBooleanQuery(normalised);
    // Simple mode: prefix-match all words
    return { tsquery: simpleQueryToTsquery(normalised), terms: normalised.split(/\s+/).filter(Boolean), isValid: true };
  }, [searchTerm, isBoolean]);

  // ── Candidates query ──────────────────────────────────────────────────────
  const { data: candidates = [], isLoading: loadingCandidates } = useQuery({
    queryKey: ["add_targets_candidates", currentWorkspace?.id, searchTerm, isBoolean],
    enabled: !!currentWorkspace?.id && open && kind !== "contacts",
    staleTime: 10_000,
    queryFn: async () => {
      if (!searchTerm) {
        // Default: most recent 40 candidates
        const { data } = await supabase
          .from("candidates")
          .select("id, name, email, phone, current_title, current_company, availability_status, location")
          .eq("tenant_id", currentWorkspace!.id)
          .order("updated_at", { ascending: false })
          .limit(40);
        return mapCandidates(data ?? []);
      }

      // Use the search_candidates RPC for full-text / boolean support
      const tsq = parsed?.tsquery;
      if (!tsq || !parsed?.isValid) {
        // Fallback: plain ilike
        const { data } = await supabase
          .from("candidates")
          .select("id, name, email, phone, current_title, current_company, availability_status, location")
          .eq("tenant_id", currentWorkspace!.id)
          .or(`name.ilike.%${searchTerm}%,current_title.ilike.%${searchTerm}%,current_company.ilike.%${searchTerm}%`)
          .limit(40);
        return mapCandidates(data ?? []);
      }

      const { data } = await supabase.rpc("search_candidates", {
        query_text: tsq,
        workspace_id: currentWorkspace!.id,
        use_tsquery: true,
        include_cv: false,
      });
      return (data ?? []).map((c: {
        id: string; name: string; email?: string; current_title?: string; location?: string;
      }) => ({
        id: c.id,
        kind: "candidate" as const,
        name: c.name,
        email: (c as { email?: string }).email ?? undefined,
        phone: undefined,
        title: c.current_title ?? undefined,
        company: undefined,
        location: c.location ?? undefined,
      })) as CandidateRow[];
    },
  });

  // ── Contacts query ────────────────────────────────────────────────────────
  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ["add_targets_contacts", currentWorkspace?.id, searchTerm],
    enabled: !!currentWorkspace?.id && open && kind !== "candidates",
    staleTime: 10_000,
    queryFn: async () => {
      // Join company to get company name for display
      let q = supabase
        .from("contacts")
        .select("id, name, email, phone, title, department, companies(name)")
        .eq("team_id", currentWorkspace!.id)
        .order("name")
        .limit(40);

      const terms = parsed?.terms?.length ? parsed.terms : searchTerm ? [searchTerm] : [];

      if (terms.length > 0) {
        q = q.or(buildContactOrFilter(terms));
      }

      const { data } = await q;
      return (data ?? []).map((c) => {
        const companyName = Array.isArray(c.companies)
          ? (c.companies[0] as { name: string } | undefined)?.name
          : (c.companies as { name: string } | null)?.name;
        return {
          id: c.id,
          kind: "contact" as const,
          name: c.name,
          email: c.email ?? undefined,
          phone: c.phone ?? undefined,
          title: c.title ?? undefined,
          company: companyName ?? undefined,
          department: c.department ?? undefined,
        };
      }) as ContactRow[];
    },
  });

  // ── Merge and de-dupe ─────────────────────────────────────────────────────
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
  const isLoading =
    (kind !== "contacts" && loadingCandidates) ||
    (kind !== "candidates" && loadingContacts);

  // ── Selection helpers ─────────────────────────────────────────────────────
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

  // ── Add selected ──────────────────────────────────────────────────────────
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
                ref={inputRef}
                className="pl-9 h-8 text-sm pr-9"
                placeholder='Search… or try: react AND NOT junior, "project manager"'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              {isBoolean && (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-mono">
                    BOOL
                  </Badge>
                </span>
              )}
            </div>
            <Tabs
              value={kind}
              onValueChange={(v) => {
                setKind(v as EntityKind);
                setSelected(new Map());
              }}
            >
              <TabsList className="h-8">
                <TabsTrigger value="both" className="text-xs px-2.5 h-6">Both</TabsTrigger>
                <TabsTrigger value="candidates" className="text-xs px-2.5 h-6">Talent</TabsTrigger>
                <TabsTrigger value="contacts" className="text-xs px-2.5 h-6">Contacts</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Boolean hint */}
          {isBoolean && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Boolean mode active — using <code className="font-mono">AND / OR / NOT</code> and{" "}
                <code className="font-mono">"phrases"</code>. Prefix <code className="font-mono">-word</code> to exclude.
              </span>
            </div>
          )}

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
          <ScrollArea className="h-60 rounded-md border border-border/50 bg-muted/20">
            <div className="p-1.5 space-y-0.5">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : availableResults.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground font-medium">No results in your workspace</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use{" "}
                    <button
                      className="underline underline-offset-2 hover:text-foreground transition-colors"
                      onClick={() => { onOpenChange(false); navigate("/talent"); }}
                    >
                      Open Talent Search
                    </button>
                    {" "}or{" "}
                    <button
                      className="underline underline-offset-2 hover:text-foreground transition-colors"
                      onClick={() => { onOpenChange(false); navigate("/contacts"); }}
                    >
                      Open Contacts Search
                    </button>
                    {" "}for advanced filters.
                  </p>
                </div>
              ) : (
                availableResults.map((row) => (
                  <label
                    key={`${row.kind}:${row.id}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/60 cursor-pointer transition-colors"
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
                          className={`text-[9px] px-1 py-0 h-3.5 shrink-0 capitalize ${
                            row.kind === "candidate"
                              ? "border-emerald-200 text-emerald-600 dark:border-emerald-800 dark:text-emerald-400"
                              : "border-blue-200 text-blue-600 dark:border-blue-800 dark:text-blue-400"
                          }`}
                        >
                          {row.kind === "candidate" ? "talent" : "contact"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {row.kind === "candidate"
                          ? [row.title, row.company, (row as CandidateRow).location]
                              .filter(Boolean)
                              .join(" · ")
                          : [row.title, row.company, (row as ContactRow).department].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {/* Channel availability dots */}
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        title={row.email ? "Email available" : "No email"}
                        className={`w-1.5 h-1.5 rounded-full ${row.email ? "bg-primary" : "bg-muted-foreground/25"}`}
                      />
                      <span
                        title={row.phone ? "Phone available" : "No phone"}
                        className={`w-1.5 h-1.5 rounded-full ${row.phone ? "bg-primary" : "bg-muted-foreground/25"}`}
                      />
                    </div>
                    {row.kind === "candidate" && (row as CandidateRow).availability_status && (
                      <Badge
                        variant={
                          (row as CandidateRow).availability_status === "available"
                            ? "default"
                            : "secondary"
                        }
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
          <p className="text-xs text-muted-foreground mb-2 font-medium">
            Advanced search &amp; bulk import
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs h-8"
              onClick={() => { onOpenChange(false); navigate("/talent"); }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Talent Search
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs h-8"
              onClick={() => { onOpenChange(false); navigate("/contacts"); }}
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapCandidates(
  data: Array<{
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    current_title?: string | null;
    current_company?: string | null;
    availability_status?: string | null;
    location?: string | null;
  }>
): CandidateRow[] {
  return data.map((c) => ({
    id: c.id,
    kind: "candidate" as const,
    name: c.name,
    email: c.email ?? undefined,
    phone: c.phone ?? undefined,
    title: c.current_title ?? undefined,
    company: c.current_company ?? undefined,
    availability_status: c.availability_status ?? undefined,
    location: c.location ?? undefined,
  }));
}
