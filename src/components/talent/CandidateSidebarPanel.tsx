import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { CreateCampaignModal } from "@/components/outreach/CreateCampaignModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare, Briefcase, FolderOpen, Mic, Square, Globe, Users, Lock, Pin,
  Loader2, Search, ExternalLink, Trash2, Pencil, X, Check, Sparkles, ChevronDown, ChevronRight,
  Link2, CalendarIcon, Mail, Phone, MapPin, Linkedin, Clock, Megaphone, Plus, Maximize2,
} from "lucide-react";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import type { Talent } from "@/lib/types";
import type { TalentHeaderStatusKey } from "@/lib/talent-status";

/* ─── Status Hot Buttons ─── */
const CANDIDATE_STATUSES = [
  { key: "open_to_work", label: "Open to Work", color: "bg-emerald-500 hover:bg-emerald-600 text-white" },
  { key: "on_assignment", label: "On Assignment", color: "bg-blue-500 hover:bg-blue-600 text-white" },
  { key: "not_available", label: "Not Available", color: "bg-red-500 hover:bg-red-600 text-white" },
  { key: "newly_added", label: "Newly Added", color: "bg-purple-500 hover:bg-purple-600 text-white" },
  { key: "interviewing", label: "Interviewing", color: "bg-amber-500 hover:bg-amber-600 text-white" },
  { key: "placed", label: "Placed", color: "bg-teal-600 hover:bg-teal-700 text-white" },
] as const;

function getStatusColor(status: string) {
  return CANDIDATE_STATUSES.find(s => s.key === status)?.color || "bg-muted text-muted-foreground";
}
function getStatusLabel(status: string) {
  return CANDIDATE_STATUSES.find(s => s.key === status)?.label || status;
}

/* ─── Note Composer (compact) ─── */
function NoteComposer({ candidateId, currentUserId, workspaceId, onSaved }: {
  candidateId: string; currentUserId: string | null; workspaceId: string | null; onSaved: () => void;
}) {
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState<"public"|"team"|"private">("team");
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [saving, setSaving] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous = true; r.interimResults = true;
    r.onresult = (event: any) => {
      let interim = "", final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t + " "; else interim += t;
      }
      if (final) setNote(prev => prev + " " + final);
      setLiveTranscript(interim);
    };
    r.onerror = () => { setIsRecording(false); setLiveTranscript(""); };
    r.onend = () => { setIsRecording(false); setLiveTranscript(""); };
    recognitionRef.current = r;
    return () => r.stop();
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) { toast.error("Voice not supported — use Chrome or Edge"); return; }
    if (isRecording) { recognitionRef.current.stop(); setIsRecording(false); setLiveTranscript(""); }
    else { setIsRecording(true); recognitionRef.current.start(); }
  };

  const save = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("candidate_notes").insert({
        candidate_id: candidateId,
        body: note.trim(),
        visibility,
        owner_id: currentUserId,
        team_id: workspaceId,
      } as any);
      if (error) throw error;
      setNote(""); toast.success("Note saved"); onSaved();
    } catch (err: any) { toast.error(err.message || "Failed to save note"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
      <div className="relative">
        <Textarea placeholder="Write a note..." value={note} onChange={e => setNote(e.target.value)}
          className="min-h-[70px] text-xs resize-none"
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(); }} />
        {isRecording && liveTranscript && (
          <p className="absolute bottom-2 left-3 right-3 text-[10px] text-primary/60 italic pointer-events-none truncate">{liveTranscript}</p>
        )}
      </div>
      {isRecording && (
        <div className="flex items-center gap-2 px-1">
          <div className="flex items-end gap-px h-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="w-0.5 rounded-full animate-pulse bg-destructive" style={{ height: `${3 + (i % 3) * 3 + Math.random() * 3}px`, animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
          <span className="text-[10px] text-destructive font-medium">Recording</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant={isRecording ? "destructive" : "outline"} className="gap-1 h-7 text-[10px] px-2" onClick={toggleVoice}>
          {isRecording ? <><Square className="w-3 h-3"/>Stop</> : <><Mic className="w-3 h-3"/>Dictate</>}
        </Button>
        <Select value={visibility} onValueChange={v => setVisibility(v as any)}>
          <SelectTrigger className="h-7 w-[70px] text-[10px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="public"><span className="flex items-center gap-1 text-[10px]"><Globe className="w-3 h-3"/>Public</span></SelectItem>
            <SelectItem value="team"><span className="flex items-center gap-1 text-[10px]"><Users className="w-3 h-3"/>Team</span></SelectItem>
            <SelectItem value="private"><span className="flex items-center gap-1 text-[10px]"><Lock className="w-3 h-3"/>Private</span></SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="h-7 text-[10px] px-3 bg-emerald-600 hover:bg-emerald-700 text-white ml-auto" disabled={!note.trim() || saving} onClick={save}>
          {saving ? <Loader2 className="w-3 h-3 animate-spin"/> : "Save note"}
        </Button>
      </div>
    </div>
  );
}

/* ─── Browse Deals Modal ─── */
function BrowseDealsModal({ open, onOpenChange, onLink, linkedDealIds }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onLink: (deal: any) => Promise<void>; linkedDealIds: string[];
}) {
  const [search, setSearch] = useState("");
  const [linking, setLinking] = useState<string|null>(null);
  const { data: allDeals = [], isLoading } = useQuery({
    queryKey: ["browse-all-deals"], queryFn: async () => {
      const { data } = await supabase.from("crm_deals")
        .select("id, title, value, currency, stage, status, expected_close_date, crm_companies(name)")
        .is("deleted_at", null).order("created_at", { ascending: false }).limit(200);
      return data || [];
    }, enabled: open,
  });
  const filtered = allDeals.filter((d: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return d.title?.toLowerCase().includes(q) || d.crm_companies?.name?.toLowerCase().includes(q);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="z-[10000]" />
        <div className="fixed left-[50%] top-[50%] z-[10001] w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] max-h-[80vh] flex flex-col gap-4 border bg-background p-6 shadow-lg sm:rounded-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-base"><Briefcase className="w-4 h-4 text-primary"/>Browse & Link Deals</DialogTitle></DialogHeader>
          <div className="relative"><Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground"/><Input placeholder="Search deals..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm"/></div>
          <ScrollArea className="flex-1 min-h-0">
            {isLoading ? <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground"/></div> : filtered.length === 0 ? <p className="text-sm text-muted-foreground text-center py-12">No deals found</p> : (
              <div className="space-y-1.5 pr-3">{filtered.map((deal: any) => {
                const isLinked = linkedDealIds.includes(deal.id);
                return (
                  <div key={deal.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm font-medium truncate">{deal.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {deal.crm_companies?.name && <span className="text-xs text-muted-foreground">{deal.crm_companies.name}</span>}
                        <Badge variant="outline" className="text-[10px] capitalize h-5">{deal.stage}</Badge>
                        <span className="text-xs font-medium">{deal.currency} {Number(deal.value).toLocaleString()}</span>
                      </div>
                    </div>
                    {isLinked ? <Badge className="text-[10px] bg-primary/15 text-primary border-0">Linked</Badge> : (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0" disabled={!!linking}
                        onClick={async () => { setLinking(deal.id); await onLink(deal); setLinking(null); }}>
                        {linking === deal.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <><Link2 className="w-3 h-3"/>Link</>}
                      </Button>
                    )}
                  </div>
                );
              })}</div>
            )}
          </ScrollArea>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="absolute right-4 top-4 h-7 w-7 rounded-full hover:bg-accent"><X className="h-4 w-4"/></Button>
        </div>
      </DialogPortal>
    </Dialog>
  );
}

/* ─── Browse Projects Modal ─── */
function BrowseProjectsModal({ open, onOpenChange, onLink, linkedProjectIds }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onLink: (project: any) => Promise<void>; linkedProjectIds: string[];
}) {
  const [search, setSearch] = useState("");
  const [linking, setLinking] = useState<string|null>(null);
  const { data: allProjects = [], isLoading } = useQuery({
    queryKey: ["browse-all-projects"], queryFn: async () => {
      const { data } = await supabase.from("crm_projects")
        .select("id, name, status, description, company_id, crm_companies(id, name)")
        .is("deleted_at", null).order("created_at", { ascending: false }).limit(200);
      return data || [];
    }, enabled: open,
  });
  const filtered = allProjects.filter((p: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name?.toLowerCase().includes(q) || p.crm_companies?.name?.toLowerCase().includes(q);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="z-[10000]" />
        <div className="fixed left-[50%] top-[50%] z-[10001] w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] max-h-[80vh] flex flex-col gap-4 border bg-background p-6 shadow-lg sm:rounded-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-base"><FolderOpen className="w-4 h-4 text-primary"/>Browse & Link Projects</DialogTitle></DialogHeader>
          <div className="relative"><Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground"/><Input placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm"/></div>
          <ScrollArea className="flex-1 min-h-0">
            {isLoading ? <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground"/></div> : filtered.length === 0 ? <p className="text-sm text-muted-foreground text-center py-12">No projects found</p> : (
              <div className="space-y-1.5 pr-3">{filtered.map((project: any) => {
                const isLinked = linkedProjectIds.includes(project.id);
                return (
                  <div key={project.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm font-medium truncate">{project.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {project.crm_companies?.name && <span className="text-xs text-muted-foreground">{project.crm_companies.name}</span>}
                        <Badge variant="outline" className="text-[10px] capitalize h-5">{project.status}</Badge>
                      </div>
                    </div>
                    {isLinked ? <Badge className="text-[10px] bg-primary/15 text-primary border-0">Linked</Badge> : (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0" disabled={!!linking}
                        onClick={async () => { setLinking(project.id); await onLink(project); setLinking(null); }}>
                        {linking === project.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <><Link2 className="w-3 h-3"/>Link</>}
                      </Button>
                    )}
                  </div>
                );
              })}</div>
            )}
          </ScrollArea>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="absolute right-4 top-4 h-7 w-7 rounded-full hover:bg-accent"><X className="h-4 w-4"/></Button>
        </div>
      </DialogPortal>
    </Dialog>
  );
}


/* ═══════════════════════════════════════════════
   Main Sidebar Panel
   ═══════════════════════════════════════════════ */
interface CandidateSidebarPanelProps {
  candidate: Talent;
  canEdit: boolean;
  canDelete: boolean;
  currentUserId: string | null;
  workspaceId: string | null;
  activeStatus: TalentHeaderStatusKey;
  onStatusChange: (status: TalentHeaderStatusKey) => Promise<void> | void;
}

export function CandidateSidebarPanel({ candidate, canEdit, canDelete, currentUserId, workspaceId, activeStatus, onStatusChange }: CandidateSidebarPanelProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showDealBrowser, setShowDealBrowser] = useState(false);
  const [showProjectBrowser, setShowProjectBrowser] = useState(false);
  const [showCampaignBrowser, setShowCampaignBrowser] = useState(false);
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string|null>(null);
  const [editContent, setEditContent] = useState("");
  const [deletingNoteId, setDeletingNoteId] = useState<string|null>(null);
  const [noteSearch, setNoteSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);

  // Current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => { const { data: { user } } = await supabase.auth.getUser(); return user; },
    staleTime: 60_000,
  });

  // Notes
  const { data: notes = [], refetch: refetchNotes } = useQuery({
    queryKey: ["candidate-notes-sidebar", candidate.id],
    queryFn: async () => {
      const { data } = await supabase.from("candidate_notes")
        .select("*")
        .eq("candidate_id", candidate.id)
        .eq("is_deleted", false)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (!data || data.length === 0) return [];
      const ownerIds = [...new Set(data.map((n: any) => n.owner_id).filter(Boolean))];
      let profilesMap: Record<string, any> = {};
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name").in("id", ownerIds);
        if (profiles) profiles.forEach(p => { profilesMap[p.id] = p; });
      }
      return data.map((n: any) => ({ ...n, profiles: n.owner_id ? profilesMap[n.owner_id] || null : null }));
    },
  });

  const pinNote = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      await supabase.from("candidate_notes").update({ pinned: !pinned } as any).eq("id", id);
    },
    onSuccess: () => refetchNotes(),
  });

  const editNote = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase.from("candidate_notes").update({ body: content.trim() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refetchNotes(); setEditingNoteId(null); setEditContent(""); toast.success("Note updated"); },
    onError: () => toast.error("Failed to update note"),
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("candidate_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refetchNotes(); setDeletingNoteId(null); toast.success("Note deleted"); },
    onError: () => toast.error("Failed to delete note"),
  });

  // Deals linked to this candidate
  const { data: deals = [], refetch: refetchDeals } = useQuery({
    queryKey: ["candidate-deals", candidate.id],
    queryFn: async () => {
      const { data } = await supabase.from("crm_deals")
        .select("id, title, stage, value, currency, status, crm_companies(name)")
        .eq("candidate_id", candidate.id)
        .is("deleted_at", null).order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Projects linked to this candidate via crm_deals
  const { data: projects = [], refetch: refetchProjects } = useQuery({
    queryKey: ["candidate-projects", candidate.id],
    queryFn: async () => {
      // Get project_ids from deals linked to this candidate
      const { data: dealRows } = await supabase.from("crm_deals")
        .select("project_id").eq("candidate_id", candidate.id).is("deleted_at", null).not("project_id", "is", null);
      const projectIds = (dealRows || []).map((d: any) => d.project_id).filter(Boolean);
      if (projectIds.length === 0) return [];
      const { data } = await supabase.from("crm_projects")
        .select("id, name, status, crm_companies(name)")
        .in("id", projectIds).is("deleted_at", null);
      return data || [];
    },
  });

  const linkDeal = async (deal: any) => {
    const { error } = await supabase.from("crm_deals").update({ candidate_id: candidate.id } as any).eq("id", deal.id);
    if (error) { toast.error("Failed to link deal: " + error.message); return; }
    refetchDeals(); refetchProjects();
    qc.invalidateQueries({ queryKey: ["crm_deals"] });
    qc.invalidateQueries({ queryKey: ["browse-all-deals"] });
    toast.success("Deal linked to candidate");
  };

  const linkProject = async (project: any) => {
    // Create or link a deal for this candidate+project combo
    const { data: existingDeal } = await supabase.from("crm_deals")
      .select("id").eq("candidate_id", candidate.id).eq("project_id", project.id).is("deleted_at", null).maybeSingle();
    if (existingDeal) { toast.info("Project already linked via a deal"); return; }
    // Create a deal linking candidate to project
    const { error } = await supabase.from("crm_deals").insert({
      title: `${candidate.name} — ${project.name}`,
      candidate_id: candidate.id,
      project_id: project.id,
      company_id: project.company_id || null,
      stage: "lead", value: 0, status: "active",
    } as any).select("id").single();
    if (error) { toast.error("Failed to link project: " + error.message); return; }
    refetchDeals(); refetchProjects();
    qc.invalidateQueries({ queryKey: ["crm_deals"] });
    qc.invalidateQueries({ queryKey: ["crm_projects"] });
    qc.invalidateQueries({ queryKey: ["browse-all-projects"] });
    toast.success("Project linked — deal created");
    // Offer status change
    await onStatusChange("interviewing");
  };

  // Outreach campaigns linked to this candidate
  const { data: linkedCampaigns = [], refetch: refetchCampaigns } = useQuery({
    queryKey: ["candidate-outreach-campaigns", candidate.id, workspaceId],
    queryFn: async () => {
      const db = supabase as any;
      const { data: targets } = await db.from("outreach_targets")
        .select("campaign_id, campaign:outreach_campaigns(id, name, status, channel, created_at)")
        .eq("candidate_id", candidate.id)
        .eq("entity_type", "candidate");
      if (!targets) return [];
      const seen = new Set<string>();
      return targets.filter((t: any) => {
        if (!t.campaign || seen.has(t.campaign.id)) return false;
        seen.add(t.campaign.id);
        return true;
      }).map((t: any) => t.campaign);
    },
  });

  // All campaigns for browse modal
  const { data: allCampaigns = [] } = useQuery({
    queryKey: ["browse-all-campaigns", workspaceId],
    enabled: showCampaignBrowser,
    queryFn: async () => {
      const db = supabase as any;
      const { data } = await db.from("outreach_campaigns")
        .select("id, name, status, channel, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }).limit(200);
      return data || [];
    },
  });

  const addCandidateToCampaign = async (campaignId: string, campaignName: string) => {
    const db = supabase as any;
    const currentCompany = candidate.experience?.find((item) => item.current)?.company || candidate.experience?.[0]?.company || null;
    const { data: existing } = await db.from("outreach_targets")
      .select("id").eq("campaign_id", campaignId).eq("candidate_id", candidate.id).maybeSingle();
    if (existing) { toast.info("Candidate already in this campaign"); refetchCampaigns(); return; }
    const { error } = await db.from("outreach_targets").insert({
      campaign_id: campaignId, candidate_id: candidate.id, entity_type: "candidate",
      entity_name: candidate.name, entity_email: candidate.email || null,
      entity_phone: candidate.phone || null, entity_title: candidate.roleType || null,
      entity_company: currentCompany, workspace_id: workspaceId,
      state: "queued", priority: 5, added_by: currentUserId,
    });
    if (error) { toast.error("Failed to add candidate: " + error.message); return; }
    const now = format(new Date(), "dd MMM yyyy · HH:mm");
    await supabase.from("candidate_notes").insert({
      candidate_id: candidate.id,
      body: `Automatically added to campaign "${campaignName}" on ${now}.`,
      visibility: "team", owner_id: currentUserId, team_id: workspaceId,
    } as any);
    refetchCampaigns(); refetchNotes();
    qc.invalidateQueries({ queryKey: ["outreach_campaigns"] });
    qc.invalidateQueries({ queryKey: ["outreach_targets"] });
    toast.success(`Added to "${campaignName}"`);
  };

  const handleCampaignCreated = async (campaignId: string) => {
    const db = supabase as any;
    const { data: campaign } = await db.from("outreach_campaigns").select("name").eq("id", campaignId).single();
    await addCandidateToCampaign(campaignId, campaign?.name || "New Campaign");
  };

  const getAuthor = (n: any) => {
    const p = n.profiles;
    const initials = p ? `${(p.first_name||"")[0]||""}${(p.last_name||"")[0]||""}`.toUpperCase()||"?" : "?";
    const name = p ? `${p.first_name||""} ${p.last_name||""}`.trim()||"You" : "You";
    return { initials, name };
  };

  return (
    <div className="space-y-4">
      {/* ── STATUS HOT BUTTONS ── */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Status</p>
          <div className="flex flex-wrap gap-1.5">
            {CANDIDATE_STATUSES.map(s => (
              <button key={s.key} onClick={() => void onStatusChange(s.key)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all",
                  activeStatus === s.key ? s.color + " ring-2 ring-offset-1 ring-offset-background shadow-sm" : "bg-muted text-muted-foreground hover:opacity-80"
                )}>
                {s.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── CONTACT INFO ── */}
      <Card>
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-sm">Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {candidate.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <a href={`mailto:${candidate.email}`} className="text-primary hover:underline truncate">{candidate.email}</a>
            </div>
          )}
          {candidate.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span>{candidate.phone}</span>
            </div>
          )}
          {candidate.location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>{candidate.location}</span>
            </div>
          )}
          {candidate.linkedIn && (
            <div className="flex items-center gap-2">
              <Linkedin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <a href={candidate.linkedIn} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                LinkedIn <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── NOTES ── */}
      <Card>
        <CardHeader className="pb-2 pt-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-amber-500"/>
              Notes
              {notes.length > 0 && <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">{notes.length}</span>}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <NoteComposer candidateId={candidate.id} currentUserId={currentUserId} workspaceId={workspaceId} onSaved={refetchNotes} />

          {notes.length > 0 && (
            <div>
              {notes.length >= 5 && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2 w-3 h-3 text-muted-foreground"/>
                    <Input placeholder="Search..." value={noteSearch} onChange={e => setNoteSearch(e.target.value)} className="pl-7 h-7 text-[10px]"/>
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("h-7 text-[10px] gap-1 shrink-0 px-2", dateRange?.from && "border-primary text-primary")}>
                        <CalendarIcon className="w-3 h-3"/>
                        {dateRange?.from ? (dateRange.to ? `${format(dateRange.from, "dd/MM")} – ${format(dateRange.to, "dd/MM")}` : format(dateRange.from, "dd MMM")) : "Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[10002]" align="end">
                      <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={1} initialFocus className="pointer-events-auto"/>
                      {dateRange?.from && <div className="border-t p-2 flex justify-end"><Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setDateRange(undefined)}>Clear</Button></div>}
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {(() => {
                const filtered = notes.filter((n: any) => {
                  if (noteSearch) {
                    const q = noteSearch.toLowerCase();
                    if (!n.body?.toLowerCase().includes(q) && !n.title?.toLowerCase().includes(q)) return false;
                  }
                  if (dateRange?.from) {
                    const noteDate = new Date(n.created_at);
                    const start = startOfDay(dateRange.from);
                    const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
                    if (!isWithinInterval(noteDate, { start, end })) return false;
                  }
                  return true;
                });
                const visible = showAllNotes ? filtered : filtered.slice(0, 4);
                return (
                  <div className="space-y-1.5">
                    {visible.map((n: any) => {
                      const author = getAuthor(n);
                      return (
                        <div key={n.id} className="rounded-lg border border-border bg-muted/30 p-2.5">
                          {editingNoteId === n.id ? (
                            <div className="space-y-2">
                              <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="min-h-[60px] text-xs resize-none" autoFocus/>
                              <div className="flex gap-1.5">
                                <Button size="sm" className="h-6 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2" disabled={!editContent.trim() || editNote.isPending}
                                  onClick={() => editNote.mutate({ id: n.id, content: editContent })}>
                                  <Check className="w-3 h-3"/> Save
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => { setEditingNoteId(null); setEditContent(""); }}>Cancel</Button>
                              </div>
                            </div>
                          ) : deletingNoteId === n.id ? (
                            <div className="space-y-2">
                              <p className="text-[10px] text-muted-foreground">Delete this note?</p>
                              <div className="flex gap-1.5">
                                <Button size="sm" variant="destructive" className="h-6 text-[10px] gap-1 px-2" disabled={deleteNote.isPending}
                                  onClick={() => deleteNote.mutate(n.id)}>
                                  <Trash2 className="w-3 h-3"/> Delete
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setDeletingNoteId(null)}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[8px] font-semibold text-primary shrink-0 mt-0.5">
                                {author.initials}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-[10px] font-medium">{author.name}</span>
                                  <span className="text-[10px] text-muted-foreground">{format(new Date(n.created_at), "dd MMM · HH:mm")}</span>
                                  {n.pinned && <span className="text-[8px] border border-primary/40 rounded px-1 text-primary">pin</span>}
                                </div>
                                {n.title && <p className="text-[10px] font-medium mb-0.5">{n.title}</p>}
                                <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{n.body}</p>
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button onClick={() => pinNote.mutate({ id: n.id, pinned: n.pinned })}
                                  className={cn("p-1 rounded transition-colors", n.pinned ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" : "text-muted-foreground hover:bg-amber-100 hover:text-amber-600")} title={n.pinned?"Unpin":"Pin"}>
                                  <Pin className={cn("w-3 h-3", n.pinned && "fill-current")}/>
                                </button>
                                {(currentUser?.id === n.owner_id || canDelete) && (
                                  <button onClick={() => { setEditingNoteId(n.id); setEditContent(n.body); }}
                                    className="p-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 transition-colors" title="Edit">
                                    <Pencil className="w-3 h-3"/>
                                  </button>
                                )}
                                {(currentUser?.id === n.owner_id || canDelete) && (
                                  <button onClick={() => setDeletingNoteId(n.id)}
                                    className="p-1 rounded bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 transition-colors" title="Delete">
                                    <Trash2 className="w-3 h-3"/>
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {filtered.length > 4 && (
                      <button onClick={() => setShowAllNotes(v => !v)}
                        className="w-full text-[10px] text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-1 transition-colors">
                        <ChevronDown className={`w-3 h-3 transition-transform ${showAllNotes ? "rotate-180" : ""}`}/>
                        {showAllNotes ? "Show less" : `Show ${filtered.length - 4} more`}
                      </button>
                    )}
                    {filtered.length === 0 && noteSearch && (
                      <p className="text-[10px] text-muted-foreground text-center py-3">No notes matching "{noteSearch}"</p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
          {notes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-4 text-center border border-dashed border-border rounded-lg">
              <MessageSquare className="w-5 h-5 text-muted-foreground/30 mb-1"/>
              <p className="text-[10px] text-muted-foreground">No notes yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── DEALS ── */}
      <Card>
        <CardHeader className="pb-2 pt-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5 text-primary"/>
              Deals
              {deals.length > 0 && <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">{deals.length}</span>}
            </CardTitle>
            <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-2" onClick={() => setShowDealBrowser(true)}>
              <Link2 className="w-3 h-3"/> Link Deal
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {deals.length === 0 ? (
            <div className="flex flex-col items-center py-3 text-center border border-dashed border-border rounded-lg">
              <Briefcase className="w-5 h-5 text-muted-foreground/30 mb-1"/>
              <p className="text-[10px] text-muted-foreground mb-1.5">No deals linked</p>
              <Button size="sm" variant="outline" className="text-[10px] gap-1 h-6 px-2" onClick={() => setShowDealBrowser(true)}>
                <Link2 className="w-3 h-3"/> Browse & link
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {deals.map((deal: any) => (
                <div key={deal.id} className="p-2 rounded-lg border border-border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/crm/deals/${deal.id}`)}>
                  <p className="text-xs font-medium truncate">{deal.title}</p>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{deal.crm_companies?.name||"—"}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold">{deal.currency} {Number(deal.value).toLocaleString()}</span>
                      <Badge variant="outline" className="text-[8px] capitalize h-4">{deal.stage}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── PROJECTS ── */}
      <Card>
        <CardHeader className="pb-2 pt-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderOpen className="w-3.5 h-3.5 text-emerald-500"/>
              Projects
              {projects.length > 0 && <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">{projects.length}</span>}
            </CardTitle>
            <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-2" onClick={() => setShowProjectBrowser(true)}>
              <Link2 className="w-3 h-3"/> Link Project
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="flex flex-col items-center py-3 text-center border border-dashed border-border rounded-lg">
              <FolderOpen className="w-5 h-5 text-muted-foreground/30 mb-1"/>
              <p className="text-[10px] text-muted-foreground mb-1.5">No projects linked</p>
              <Button size="sm" variant="outline" className="text-[10px] gap-1 h-6 px-2" onClick={() => setShowProjectBrowser(true)}>
                <Link2 className="w-3 h-3"/> Browse & link
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {projects.map((project: any) => (
                <div key={project.id} className="p-2 rounded-lg border border-border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/crm/projects/${project.id}`)}>
                  <p className="text-xs font-medium truncate">{project.name}</p>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{project.crm_companies?.name||"—"}</span>
                    <Badge variant="outline" className="text-[8px] capitalize h-4">{project.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── OUTREACH CAMPAIGNS ── */}
      <Card>
        <CardHeader className="pb-2 pt-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Megaphone className="w-3.5 h-3.5 text-orange-500"/>
              Outreach
              {linkedCampaigns.length > 0 && <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">{linkedCampaigns.length}</span>}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-2" onClick={() => setShowCampaignBrowser(true)}>
                <Link2 className="w-3 h-3"/> Link
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-2" onClick={() => setShowCreateCampaign(true)}>
                <Plus className="w-3 h-3"/> New
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {linkedCampaigns.length === 0 ? (
            <div className="flex flex-col items-center py-3 text-center border border-dashed border-border rounded-lg">
              <Megaphone className="w-5 h-5 text-muted-foreground/30 mb-1"/>
              <p className="text-[10px] text-muted-foreground mb-1.5">No campaigns linked</p>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="text-[10px] gap-1 h-6 px-2" onClick={() => setShowCampaignBrowser(true)}>
                  <Link2 className="w-3 h-3"/> Browse & link
                </Button>
                <Button size="sm" variant="outline" className="text-[10px] gap-1 h-6 px-2" onClick={() => setShowCreateCampaign(true)}>
                  <Plus className="w-3 h-3"/> Create new
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {linkedCampaigns.map((c: any) => (
                <div key={c.id} className="p-2 rounded-lg border border-border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/outreach`)}>
                  <p className="text-xs font-medium truncate">{c.name}</p>
                  <div className="flex items-center justify-between mt-0.5">
                    <Badge variant="outline" className="text-[8px] capitalize h-4">{c.channel}</Badge>
                    <Badge className={cn("text-[8px] h-4 border-0",
                      c.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : c.status === "draft" ? "bg-muted text-muted-foreground"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    )}>{c.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <BrowseDealsModal open={showDealBrowser} onOpenChange={setShowDealBrowser}
        onLink={linkDeal} linkedDealIds={deals.map((d: any) => d.id)} />
      <BrowseProjectsModal open={showProjectBrowser} onOpenChange={setShowProjectBrowser}
        onLink={linkProject} linkedProjectIds={projects.map((p: any) => p.id)} />

      {/* Browse Campaigns Modal */}
      <Dialog open={showCampaignBrowser} onOpenChange={setShowCampaignBrowser}>
        <DialogPortal>
          <DialogOverlay className="z-[10000]" />
          <div className="fixed left-[50%] top-[50%] z-[10001] w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] max-h-[80vh] flex flex-col gap-4 border bg-background p-6 shadow-lg sm:rounded-lg">
            <DialogHeader><DialogTitle className="flex items-center gap-2 text-base"><Megaphone className="w-4 h-4 text-primary"/>Browse & Link Campaigns</DialogTitle></DialogHeader>
            <ScrollArea className="flex-1 min-h-0">
              {allCampaigns.length === 0 ? <p className="text-sm text-muted-foreground text-center py-12">No campaigns found</p> : (
                <div className="space-y-1.5 pr-3">{allCampaigns.map((c: any) => {
                  const isLinked = linkedCampaigns.some((lc: any) => lc.id === c.id);
                  return (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors">
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] capitalize h-5">{c.channel}</Badge>
                          <Badge variant="outline" className="text-[10px] capitalize h-5">{c.status}</Badge>
                        </div>
                      </div>
                      {isLinked ? <Badge className="text-[10px] bg-primary/15 text-primary border-0">Linked</Badge> : (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0"
                          onClick={async () => { await addCandidateToCampaign(c.id, c.name); }}>
                          <Link2 className="w-3 h-3"/>Link
                        </Button>
                      )}
                    </div>
                  );
                })}</div>
              )}
            </ScrollArea>
            <Button variant="ghost" size="icon" onClick={() => setShowCampaignBrowser(false)} className="absolute right-4 top-4 h-7 w-7 rounded-full hover:bg-accent"><X className="h-4 w-4"/></Button>
          </div>
        </DialogPortal>
      </Dialog>

      {/* Create Campaign Modal */}
      <CreateCampaignModal open={showCreateCampaign} onOpenChange={setShowCreateCampaign} onCreated={handleCampaignCreated} />
    </div>
  );
}
