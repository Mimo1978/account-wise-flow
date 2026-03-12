import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, DollarSign, Search, Link2 } from "lucide-react";
import { differenceInDays, parseISO, format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { PageBackButton } from "@/components/ui/page-back-button";

const PIPELINE_STAGES = [
  { value: "lead", label: "Lead", color: "bg-blue-500" },
  { value: "qualified", label: "Qualified", color: "bg-cyan-500" },
  { value: "proposal", label: "Proposal", color: "bg-amber-500" },
  { value: "negotiation", label: "Negotiation", color: "bg-purple-500" },
  { value: "won", label: "Won", color: "bg-green-500" },
  { value: "lost", label: "Lost", color: "bg-red-500" },
];

const STAGE_BADGE: Record<string, string> = {
  lead: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  qualified: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  proposal: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  negotiation: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  won: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  lost: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function DealsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStage = searchParams.get("stage");
  const [stageFilter, setStageFilter] = useState<string | null>(initialStage);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [linkProjectDealId, setLinkProjectDealId] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState("");

  const handleStageFilter = (stage: string) => {
    const newStage = stageFilter === stage ? null : stage;
    setStageFilter(newStage);
    if (newStage) {
      setSearchParams({ stage: newStage });
    } else {
      setSearchParams({});
    }
  };

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["all-crm-deals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_deals")
        .select("*, crm_companies(id, name), crm_projects(id, name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["crm-companies-list"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_companies").select("id, name").order("name");
      return (data || []) as any[];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["crm-projects-list"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_projects" as any).select("id, name").order("name");
      return (data || []) as any[];
    },
  });

  const filtered = useMemo(() => {
    let result = deals;
    if (stageFilter) result = result.filter(d => (d.stage || d.status) === stageFilter);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(d => d.title?.toLowerCase().includes(s) || d.crm_companies?.name?.toLowerCase().includes(s));
    }
    return result;
  }, [deals, stageFilter, search]);

  const stageTotals = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    PIPELINE_STAGES.forEach(s => { map[s.value] = { count: 0, value: 0 }; });
    deals.forEach(d => {
      const stage = d.stage || d.status || "lead";
      if (map[stage]) { map[stage].count++; map[stage].value += d.value || 0; }
    });
    return map;
  }, [deals]);

  const handleLinkProject = async (dealId: string, projectId: string) => {
    const { error } = await supabase.from("crm_deals").update({ project_id: projectId } as any).eq("id", dealId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Project linked" });
    setLinkProjectDealId(null);
    queryClient.invalidateQueries({ queryKey: ["all-crm-deals"] });
  };

  const filteredProjects = projects.filter((p: any) =>
    !projectSearch || p.name?.toLowerCase().includes(projectSearch.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <PageBackButton fallback="/home" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Deals</h1>
          <p className="text-sm text-muted-foreground">Pipeline overview across all companies</p>
        </div>
        <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Deal</Button>
      </div>

      {/* Pipeline chevrons */}
      <div className="flex gap-0 overflow-x-auto">
        {PIPELINE_STAGES.map((s, i) => {
          const data = stageTotals[s.value];
          const isActive = stageFilter === s.value;
          return (
            <button key={s.value} onClick={() => handleStageFilter(s.value)}
              className={cn(
                "relative flex-1 min-w-[120px] py-3 px-4 text-center transition-all text-sm cursor-pointer",
                i === 0 ? "rounded-l-lg" : "", i === PIPELINE_STAGES.length - 1 ? "rounded-r-lg" : "",
                isActive ? `${s.color} text-white ring-2 ring-white ring-offset-2` : "bg-muted hover:brightness-110 text-foreground",
              )}>
              <p className="font-semibold">{s.label}</p>
              <p className={cn("text-xs", isActive ? "text-white/80" : "text-muted-foreground")}>{data.count} · £{(data.value / 1000).toFixed(0)}k</p>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search deals..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        {stageFilter && (
          <Button variant="ghost" size="sm" onClick={() => handleStageFilter(stageFilter)}>Clear filter</Button>
        )}
      </div>

      {/* Deal cards */}
      {isLoading ? (
        <p className="text-muted-foreground text-center py-12">Loading deals...</p>
      ) : filtered.length === 0 ? (
        <Card className="border border-border rounded-xl"><CardContent className="py-12 text-center">
          <DollarSign className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">{search || stageFilter ? "No deals match your filters." : "No deals yet. Create your first deal."}</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(d => (
            <Card key={d.id} className="hover:bg-muted/50 transition-colors cursor-pointer border border-border rounded-xl" style={{ borderLeft: '4px solid hsl(221 83% 53%)' }}
              onClick={() => navigate(`/crm/deals/${d.id}`, { state: { from: '/deals' } })}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm truncate">{d.title}</p>
                  <Badge className={cn("text-xs capitalize shrink-0", STAGE_BADGE[d.stage || d.status] || "bg-muted")}>{d.stage || d.status}</Badge>
                </div>
                <p className="text-lg font-bold">£{(d.value || 0).toLocaleString()}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{d.crm_companies?.name || "No company"}</span>
                  <span>{d.created_at ? `${differenceInDays(new Date(), parseISO(d.created_at))}d open` : ""}</span>
                </div>
                {/* Project link */}
                <div className="flex items-center gap-2 pt-1" onClick={e => e.stopPropagation()}>
                  {d.crm_projects?.name ? (
                    <Badge variant="outline" className="text-xs text-primary cursor-pointer hover:bg-primary/10"
                      onClick={() => navigate(`/crm/projects/${d.project_id}`, { state: { from: '/deals' } })}>
                      <Link2 className="h-3 w-3 mr-1" />{d.crm_projects.name}
                    </Badge>
                  ) : (
                    <Popover open={linkProjectDealId === d.id} onOpenChange={v => { setLinkProjectDealId(v ? d.id : null); setProjectSearch(""); }}>
                      <PopoverTrigger asChild>
                        <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                          <Plus className="h-3 w-3" /> Link Project
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-2" align="start">
                        <Input placeholder="Search projects..." value={projectSearch} onChange={e => setProjectSearch(e.target.value)} className="h-8 text-xs mb-2" />
                        <div className="max-h-40 overflow-y-auto space-y-0.5">
                          {filteredProjects.map((p: any) => (
                            <button key={p.id} onClick={() => handleLinkProject(d.id, p.id)}
                              className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted truncate">{p.name}</button>
                          ))}
                          {filteredProjects.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1">No projects found</p>}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                  {/* Stage prompt for proposal+ without project */}
                  {!d.project_id && ["proposal", "negotiation", "won"].includes(d.stage) && (
                    <span className="text-[10px] text-amber-600">No project linked</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Deal Sheet */}
      <AddDealSheet open={addOpen} onClose={() => setAddOpen(false)} companies={companies}
        onSaved={() => { setAddOpen(false); queryClient.invalidateQueries({ queryKey: ["all-crm-deals"] }); }} />
    </div>
  );
}

function AddDealSheet({ open, onClose, companies, onSaved }: {
  open: boolean; onClose: () => void; companies: any[]; onSaved: () => void;
}) {
  const [title, setTitle] = useState(""); const [value, setValue] = useState("");
  const [stage, setStage] = useState("lead"); const [companyId, setCompanyId] = useState("");
  const [endDate, setEndDate] = useState(""); const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) { toast({ title: "Deal name required", variant: "destructive" }); return; }
    if (!companyId) { toast({ title: "Select a company", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("crm_deals").insert({
        title, value: parseFloat(value) || 0, currency: "GBP",
        status: stage === "won" ? "complete" : stage === "lost" ? "cancelled" : "active",
        stage, company_id: companyId, end_date: endDate || null, notes: notes || null,
      } as any);
      if (error) throw error;
      toast({ title: "Deal created" }); onSaved();
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent className="sm:max-w-[520px] overflow-y-auto flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle>Add Deal</SheetTitle>
          <SheetDescription>Create a new deal</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div><Label>Company <span className="text-red-500">*</span></Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
              <SelectContent className="bg-popover z-[9999]">
                {companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select></div>
          <div><Label>Deal Name <span className="text-red-500">*</span></Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Value (£)</Label><Input type="number" value={value} onChange={e => setValue(e.target.value)} /></div>
            <div><Label>Stage</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover z-[9999]">
                  {PIPELINE_STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select></div>
          </div>
          <div><Label>Expected Close Date</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
          <div><Label>Notes</Label><Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <div className="sticky bottom-0 border-t border-border bg-background px-6 py-5 pb-20 flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Creating…" : "Create Deal"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
