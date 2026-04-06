import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogPortal, DialogOverlay, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { MessageSquare, Briefcase, FolderOpen, Mic, Square, Globe, Users, Lock, Pin, Loader2, Search, ExternalLink, Trash2, Pencil, X, Check, Sparkles, ChevronDown, Link2, CalendarIcon } from "lucide-react";
import { format, formatDistanceToNow, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface Props { contact: any; embedded?: boolean; }

/* ─── Note Composer ─── */
function NoteComposer({ contactId, onSaved, note, setNote, saveNote }: { contactId: string; onSaved: () => void; note: string; setNote: (v: string) => void; saveNote: { mutate: () => void; isPending: boolean } }) {
  const [visibility, setVisibility] = useState<"public"|"team"|"private">("team");
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
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
      if (final) setNote(note + " " + final);
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

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="relative">
        <Textarea id="note-input" placeholder="Write a note about this contact..." value={note}
          onChange={(e) => setNote(e.target.value)} className="min-h-[100px] text-sm resize-none"
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { if (note.trim()) saveNote.mutate(); } }} />
        {isRecording && liveTranscript && (
          <p className="absolute bottom-2 left-3 right-3 text-xs text-primary/60 italic pointer-events-none truncate">{liveTranscript}</p>
        )}
      </div>
      {isRecording && (
        <div className="flex items-center gap-2 px-1">
          <div className="flex items-end gap-px h-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="w-0.5 rounded-full animate-pulse bg-destructive" style={{ height: `${4 + (i % 3) * 4 + Math.random() * 4}px`, animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
          <span className="text-xs text-destructive font-medium">Recording — speak now</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button size="sm" variant={isRecording ? "destructive" : "outline"} className="gap-1.5 h-8 text-xs" onClick={toggleVoice}>
            {isRecording ? <><Square className="w-3 h-3" />Stop</> : <><Mic className="w-3 h-3" />Dictate</>}
          </Button>
          <Select value={visibility} onValueChange={v => setVisibility(v as any)}>
            <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="public"><span className="flex items-center gap-1 text-xs"><Globe className="w-3 h-3"/>Public</span></SelectItem>
              <SelectItem value="team"><span className="flex items-center gap-1 text-xs"><Users className="w-3 h-3"/>Team</span></SelectItem>
              <SelectItem value="private"><span className="flex items-center gap-1 text-xs"><Lock className="w-3 h-3"/>Private</span></SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="h-8 text-xs px-4" disabled={!note.trim() || saveNote.isPending} onClick={() => { if (note.trim()) saveNote.mutate(); }}>
          {saveNote.isPending ? <Loader2 className="w-3 h-3 animate-spin"/> : "Save note"}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">⌘+Enter to save quickly</p>
    </div>
  );
}

/* ─── Browse All Deals Modal ─── */
function BrowseDealsModal({ open, onOpenChange, onLink, linkedDealIds }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onLink: (deal: any) => Promise<void>; linkedDealIds: string[];
}) {
  const [search, setSearch] = useState("");
  const [linking, setLinking] = useState<string|null>(null);

  const { data: allDeals = [], isLoading } = useQuery({
    queryKey: ["browse-all-deals"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_deals")
        .select("id, title, value, currency, stage, status, expected_close_date, crm_companies(name)")
        .is("deleted_at", null).order("created_at", { ascending: false }).limit(200);
      return data || [];
    },
    enabled: open,
  });

  const filtered = allDeals.filter((d: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return d.title?.toLowerCase().includes(q) || d.crm_companies?.name?.toLowerCase().includes(q) || d.stage?.toLowerCase().includes(q);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="z-[10000]" />
        <div className="fixed left-[50%] top-[50%] z-[10001] w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] max-h-[80vh] flex flex-col gap-4 border bg-background p-6 shadow-lg sm:rounded-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Briefcase className="w-4 h-4 text-primary"/>Browse & Link Deals
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground"/>
            <Input placeholder="Search deals by name, company, or stage..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm"/>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground"/></div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No deals found</p>
            ) : (
              <div className="space-y-1.5 pr-3">
                {filtered.map((deal: any) => {
                  const isLinked = linkedDealIds.includes(deal.id);
                  return (
                    <div key={deal.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors">
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="text-sm font-medium truncate">{deal.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {deal.crm_companies?.name && <span className="text-xs text-muted-foreground">{deal.crm_companies.name}</span>}
                          <Badge variant="outline" className="text-[10px] capitalize h-5">{deal.stage}</Badge>
                          <span className="text-xs font-medium">{deal.currency} {Number(deal.value).toLocaleString()}</span>
                          {deal.expected_close_date && <span className="text-xs text-muted-foreground">Close: {format(new Date(deal.expected_close_date), "dd MMM yyyy")}</span>}
                        </div>
                      </div>
                      {isLinked ? (
                        <Badge className="text-[10px] bg-primary/15 text-primary border-0">Linked</Badge>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0" disabled={!!linking}
                          onClick={async () => { setLinking(deal.id); await onLink(deal); setLinking(null); }}>
                          {linking === deal.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <><Link2 className="w-3 h-3"/>Link</>}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
          <p className="text-[10px] text-muted-foreground">{filtered.length} deal{filtered.length !== 1 ? "s" : ""} shown</p>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="absolute right-4 top-4 h-7 w-7 rounded-full hover:bg-accent">
            <X className="h-4 w-4" /><span className="sr-only">Close</span>
          </Button>
        </div>
      </DialogPortal>
    </Dialog>
  );
}

/* ─── Browse All Projects Modal ─── */
function BrowseProjectsModal({ open, onOpenChange, onLink, linkedProjectIds }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onLink: (project: any) => Promise<void>; linkedProjectIds: string[];
}) {
  const [search, setSearch] = useState("");
  const [linking, setLinking] = useState<string|null>(null);

  const { data: allProjects = [], isLoading } = useQuery({
    queryKey: ["browse-all-projects"],
    queryFn: async () => {
      const { data } = await supabase.from("engagements")
        .select("id, name, engagement_type, stage, health, company_id, companies(name)")
        .order("created_at", { ascending: false }).limit(200);
      return data || [];
    },
    enabled: open,
  });

  const filtered = allProjects.filter((p: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name?.toLowerCase().includes(q) || p.companies?.name?.toLowerCase().includes(q) || p.stage?.toLowerCase().includes(q) || p.engagement_type?.toLowerCase().includes(q);
  });

  const healthColor: Record<string, string> = { green: "text-emerald-500", amber: "text-amber-500", red: "text-destructive" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="z-[10000]" />
        <div className="fixed left-[50%] top-[50%] z-[10001] w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] max-h-[80vh] flex flex-col gap-4 border bg-background p-6 shadow-lg sm:rounded-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="w-4 h-4 text-primary"/>Browse & Link Projects
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground"/>
            <Input placeholder="Search projects by name, company, type, or stage..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm"/>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground"/></div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No projects found</p>
            ) : (
              <div className="space-y-1.5 pr-3">
                {filtered.map((project: any) => {
                  const isLinked = linkedProjectIds.includes(project.id);
                  return (
                    <div key={project.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors">
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="text-sm font-medium truncate">{project.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {project.companies?.name && <span className="text-xs text-muted-foreground">{project.companies.name}</span>}
                          <Badge variant="outline" className="text-[10px] capitalize h-5">{project.engagement_type?.replace("_"," ")||"—"}</Badge>
                          <Badge variant="outline" className="text-[10px] h-5">{project.stage}</Badge>
                          {project.health && <span className={cn("text-[10px] font-medium capitalize", healthColor[project.health] || "text-muted-foreground")}>● {project.health}</span>}
                        </div>
                      </div>
                      {isLinked ? (
                        <Badge className="text-[10px] bg-primary/15 text-primary border-0">Linked</Badge>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0" disabled={!!linking}
                          onClick={async () => { setLinking(project.id); await onLink(project); setLinking(null); }}>
                          {linking === project.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <><Link2 className="w-3 h-3"/>Link</>}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
          <p className="text-[10px] text-muted-foreground">{filtered.length} project{filtered.length !== 1 ? "s" : ""} shown</p>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="absolute right-4 top-4 h-7 w-7 rounded-full hover:bg-accent">
            <X className="h-4 w-4" /><span className="sr-only">Close</span>
          </Button>
        </div>
      </DialogPortal>
    </Dialog>
  );
}

/* ─── Main Component ─── */
export function ContactDetailTabs({ contact, embedded = false }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showDealBrowser, setShowDealBrowser] = useState(false);
  const [showProjectBrowser, setShowProjectBrowser] = useState(false);
  const [note, setNote] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string|null>(null);
  const [editContent, setEditContent] = useState("");
  const [deletingNoteId, setDeletingNoteId] = useState<string|null>(null);
  const [noteSearch, setNoteSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [aiSummary, setAiSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);

  // Get current user for ownership checks
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
    staleTime: 60_000,
  });

  const saveNote = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("notes").insert({
        entity_type: "contact", entity_id: contact.id,
        content: note.trim(), visibility: "team",
        owner_id: user?.id || null, pinned: false, source: "ui",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-notes", contact.id], refetchType: "active" });
      setNote(""); toast.success("Note saved");
    },
    onError: () => toast.error("Failed to save note"),
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["contact-notes", contact.id],
    queryFn: async () => {
      const { data: rawNotes } = await supabase.from("notes")
        .select("*")
        .eq("entity_type", "contact").eq("entity_id", contact.id)
        .order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(100);
      if (!rawNotes || rawNotes.length === 0) return [];
      // Fetch profiles for owner_ids
      const ownerIds = [...new Set(rawNotes.map(n => n.owner_id).filter(Boolean))];
      let profilesMap: Record<string, any> = {};
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles")
          .select("id, first_name, last_name").in("id", ownerIds);
        if (profiles) profiles.forEach(p => { profilesMap[p.id] = p; });
      }
      return rawNotes.map(n => ({ ...n, profiles: n.owner_id ? profilesMap[n.owner_id] || null : null }));
    },
  });

  // Resolve canonical contact -> crm_contacts id for FK-based queries
  const { data: crmContactId } = useQuery({
    queryKey: ["crm-contact-resolve", contact.id, contact.email, contact.name],
    queryFn: async () => {
      if (contact.email) {
        const { data } = await supabase.from("crm_contacts")
          .select("id").eq("email", contact.email).limit(1).maybeSingle();
        if (data) return data.id;
      }
      const nameParts = (contact.name || "").trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      if (firstName && lastName) {
        const { data } = await supabase.from("crm_contacts")
          .select("id").ilike("first_name", firstName).ilike("last_name", lastName).limit(1).maybeSingle();
        if (data) return data.id;
      }
      return null;
    },
    staleTime: 30_000,
  });

  const { data: deals = [], refetch: refetchDeals } = useQuery({
    queryKey: ["contact-deals", contact.id, crmContactId],
    queryFn: async () => {
      if (!crmContactId) return [];
      const { data } = await supabase.from("crm_deals")
        .select("id, title, stage, value, currency, status, contact_id, crm_companies(name)")
        .eq("contact_id", crmContactId)
        .is("deleted_at", null).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!crmContactId,
  });

  const { data: projects = [], refetch: refetchProjects } = useQuery({
    queryKey: ["contact-projects", contact.id, crmContactId],
    queryFn: async () => {
      if (!crmContactId) return [];
      const { data } = await supabase.from("engagements")
        .select("id, name, engagement_type, stage, health, company_id")
        .eq("contact_id", crmContactId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!crmContactId,
  });

  const pinNote = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      await supabase.from("notes").update({ pinned: !pinned }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-notes", contact.id] }),
  });

  const editNote = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase.from("notes").update({ content: content.trim() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-notes", contact.id], refetchType: "active" });
      setEditingNoteId(null); setEditContent(""); toast.success("Note updated");
    },
    onError: () => toast.error("Failed to update note"),
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-notes", contact.id], refetchType: "active" });
      setDeletingNoteId(null); toast.success("Note deleted");
    },
    onError: () => toast.error("Failed to delete note"),
  });

  const generateSummary = async () => {
    if (notes.length === 0) return;
    setSummaryLoading(true);
    try {
      const noteText = notes.map((n: any) => `- ${n.content}`).join("\n");
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-notes-summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ noteText }),
      });
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      setAiSummary(data.summary || "Could not generate summary.");
    } catch {
      toast.error("AI summary failed");
    } finally {
      setSummaryLoading(false);
    }
  };

  // Resolve the crm_contacts id for this canonical contact (needed for FK constraints)
  const resolveCrmContactId = async (): Promise<string | null> => {
    // Try to find existing crm_contacts record by email match
    if (contact.email) {
      const { data: existing } = await supabase.from("crm_contacts")
        .select("id")
        .eq("email", contact.email)
        .limit(1)
        .maybeSingle();
      if (existing) return existing.id;
    }
    // Try name match as fallback
    const nameParts = (contact.name || "").trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    if (firstName && lastName) {
      const { data: byName } = await supabase.from("crm_contacts")
        .select("id")
        .ilike("first_name", firstName)
        .ilike("last_name", lastName)
        .limit(1)
        .maybeSingle();
      if (byName) return byName.id;
    }
    // Create a new crm_contacts record
    const { data: newContact, error: createErr } = await supabase.from("crm_contacts")
      .insert({
        first_name: firstName || contact.name || "Unknown",
        last_name: lastName || "",
        email: contact.email || null,
        phone: contact.phone || null,
        job_title: contact.title || null,
        company_id: null,
      } as any)
      .select("id")
      .single();
    if (createErr) { toast.error("Failed to resolve CRM contact: " + createErr.message); return null; }
    return newContact?.id || null;
  };

  const linkDeal = async (deal: any) => {
    const crmContactId = await resolveCrmContactId();
    if (!crmContactId) return;
    const { error } = await supabase.from("crm_deals").update({ contact_id: crmContactId } as any).eq("id", deal.id);
    if (error) { toast.error("Failed to link deal: " + error.message); return; }
    refetchDeals();
    qc.invalidateQueries({ queryKey: ["browse-all-deals"] });
    qc.invalidateQueries({ queryKey: ["crm_deals"] });
    qc.invalidateQueries({ queryKey: ["deal-detail"] });
    toast.success("Deal linked");
  };

  const linkProject = async (project: any) => {
    const crmContactId = await resolveCrmContactId();
    if (!crmContactId) return;
    const { error } = await supabase.from("engagements").update({ contact_id: crmContactId } as any).eq("id", project.id);
    if (error) { toast.error("Failed to link project: " + error.message); return; }
    refetchProjects();
    qc.invalidateQueries({ queryKey: ["browse-all-projects"] });
    qc.invalidateQueries({ queryKey: ["engagements"] });
    qc.invalidateQueries({ queryKey: ["engagement"] });
    qc.invalidateQueries({ queryKey: ["crm_projects"] });
    qc.invalidateQueries({ queryKey: ["project-detail"] });
    qc.invalidateQueries({ queryKey: ["engagement-contact-detail"] });
    toast.success("Project linked");
  };

  const getAuthor = (n: any) => {
    const p = n.profiles;
    const initials = p ? `${(p.first_name||"")[0]||""}${(p.last_name||"")[0]||""}`.toUpperCase()||"?" : "?";
    const name = p ? `${p.first_name||""} ${p.last_name||""}`.trim()||"You" : "You";
    return { initials, name };
  };

  return (
    <div className="space-y-6">

      {/* ── NOTES ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-amber-500"/>
            Notes
            {notes.length > 0 && <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">{notes.length}</span>}
          </h2>
        </div>
        <NoteComposer contactId={contact.id} onSaved={() => qc.invalidateQueries({ queryKey: ["contact-notes", contact.id] })} note={note} setNote={setNote} saveNote={saveNote}/>
        {notes.length > 0 && (
          <div className="mt-4">
            {/* AI Summary — always available when 3+ notes */}
            {notes.length >= 3 && (
              <div className="mb-3">
                {aiSummary ? (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-primary flex items-center gap-1.5"><Sparkles className="w-3 h-3"/>AI Summary</span>
                      <button onClick={() => setAiSummary("")} className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3"/></button>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{aiSummary}</p>
                  </div>
                ) : (
                  <button onClick={generateSummary} disabled={summaryLoading}
                    className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors">
                    <Sparkles className="w-3 h-3"/>
                    {summaryLoading ? "Generating..." : "Summarise all notes with AI"}
                  </button>
                )}
              </div>
            )}

            {/* Search + Date Range */}
            {notes.length > 5 && (
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground"/>
                  <Input placeholder="Search notes..." value={noteSearch} onChange={e => setNoteSearch(e.target.value)} className="pl-8 h-8 text-xs"/>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1.5 shrink-0", dateRange?.from && "border-primary text-primary")}>
                      <CalendarIcon className="w-3.5 h-3.5"/>
                      {dateRange?.from ? (
                        dateRange.to ? `${format(dateRange.from, "dd/MM")} – ${format(dateRange.to, "dd/MM")}` : format(dateRange.from, "dd MMM yyyy")
                      ) : "Date range"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[10002]" align="end">
                    <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={1} initialFocus className="pointer-events-auto"/>
                    {dateRange?.from && (
                      <div className="border-t p-2 flex justify-end">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDateRange(undefined)}>Clear</Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Notes list */}
            {(() => {
              const filtered = notes.filter((n: any) => {
                // Text search
                if (noteSearch) {
                  const q = noteSearch.toLowerCase();
                  if (!n.content.toLowerCase().includes(q) && !format(new Date(n.created_at), "dd MMM yyyy").toLowerCase().includes(q)) return false;
                }
                // Date range filter
                if (dateRange?.from) {
                  const noteDate = new Date(n.created_at);
                  const start = startOfDay(dateRange.from);
                  const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
                  if (!isWithinInterval(noteDate, { start, end })) return false;
                }
                return true;
              });
              const visible = showAllNotes ? filtered : filtered.slice(0, 5);
              return (
                <div className="space-y-2">
                  {visible.map((n: any) => {
                    const author = getAuthor(n);
                    return (
                      <div key={n.id} className="rounded-lg border border-border bg-card p-3 group">
                        {editingNoteId === n.id ? (
                          <div className="space-y-2">
                            <Textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                              className="min-h-[80px] text-sm resize-none" autoFocus/>
                            <div className="flex gap-2">
                              <Button size="sm" className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={!editContent.trim() || editNote.isPending}
                                onClick={() => editNote.mutate({ id: n.id, content: editContent })}>
                                <Check className="w-3 h-3"/> Save
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs"
                                onClick={() => { setEditingNoteId(null); setEditContent(""); }}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : deletingNoteId === n.id ? (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">Delete this note? This cannot be undone.</p>
                            <div className="flex gap-2">
                              <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" disabled={deleteNote.isPending}
                                onClick={() => deleteNote.mutate(n.id)}>
                                <Trash2 className="w-3 h-3"/> Delete
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs"
                                onClick={() => setDeletingNoteId(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0 mt-0.5">
                              {author.initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium">{author.name}</span>
                                <span className="text-xs text-muted-foreground">{format(new Date(n.created_at), "dd MMM yyyy · HH:mm")}</span>
                                {n.source === "voice" && <span className="text-[10px] border border-border rounded px-1 text-muted-foreground">voice</span>}
                                {n.pinned && <span className="text-[10px] border border-primary/40 rounded px-1 text-primary">pinned</span>}
                              </div>
                              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{n.content}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => pinNote.mutate({ id: n.id, pinned: n.pinned })}
                                className={cn("p-1.5 rounded-md transition-colors", n.pinned ? "bg-amber-100 text-amber-600 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400" : "bg-muted/60 text-muted-foreground hover:bg-amber-100 hover:text-amber-600")} title={n.pinned?"Unpin":"Pin"}>
                                <Pin className={cn("w-3.5 h-3.5", n.pinned && "fill-current")}/>
                              </button>
                              {currentUser?.id === n.owner_id && (
                                <button onClick={() => { setEditingNoteId(n.id); setEditContent(n.content); }}
                                  className="p-1.5 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors" title="Edit">
                                  <Pencil className="w-3.5 h-3.5"/>
                                </button>
                              )}
                              {currentUser?.id === n.owner_id && (
                                <button onClick={() => setDeletingNoteId(n.id)}
                                  className="p-1.5 rounded-md bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors" title="Delete">
                                  <Trash2 className="w-3.5 h-3.5"/>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filtered.length > 5 && (
                    <button onClick={() => setShowAllNotes(v => !v)}
                      className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-1 transition-colors">
                      <ChevronDown className={`w-3 h-3 transition-transform ${showAllNotes ? "rotate-180" : ""}`}/>
                      {showAllNotes ? "Show less" : `Show ${filtered.length - 5} more notes`}
                    </button>
                  )}
                  {filtered.length === 0 && noteSearch && (
                    <p className="text-xs text-muted-foreground text-center py-4">No notes matching "{noteSearch}"</p>
                  )}
                </div>
              );
            })()}
          </div>
        )}
        {notes.length === 0 && (
          <div className="mt-4 flex flex-col items-center justify-center py-8 text-center border border-dashed border-border rounded-lg">
            <MessageSquare className="w-8 h-8 text-muted-foreground/30 mb-2"/>
            <p className="text-sm text-muted-foreground">No notes yet — add the first one above</p>
          </div>
        )}
      </section>

      <div className="border-t border-border"/>

      {/* ── DEALS ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary"/>
            Deals
            {deals.length > 0 && <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">{deals.length}</span>}
          </h2>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowDealBrowser(true)}>
            <Link2 className="w-3 h-3"/> Browse & link deal
          </Button>
        </div>
        {deals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center border border-dashed border-border rounded-lg">
            <Briefcase className="w-6 h-6 text-muted-foreground/30 mb-2"/>
            <p className="text-sm text-muted-foreground mb-2">No deals linked to this contact</p>
            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setShowDealBrowser(true)}>
              <Link2 className="w-3 h-3"/> Browse & link a deal
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {deals.map((deal: any) => (
              <div key={deal.id}
                className={cn("w-full p-3 rounded-lg border border-border bg-card text-left", !embedded && "hover:bg-accent/50 cursor-pointer transition-colors")}
                onClick={() => !embedded && navigate(`/crm/deals/${deal.id}`, { state: { from: `/contacts/${contact.id}`, fromLabel: contact.name } })}
                role={embedded ? undefined : "button"}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{deal.title}</p>
                    <p className="text-xs text-muted-foreground">{deal.crm_companies?.name||"—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{deal.currency} {Number(deal.value).toLocaleString()}</span>
                    <Badge variant="outline" className="text-xs capitalize">{deal.stage}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="border-t border-border"/>

      {/* ── PROJECTS ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-emerald-500"/>
            Projects
            {projects.length > 0 && <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">{projects.length}</span>}
          </h2>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowProjectBrowser(true)}>
            <Link2 className="w-3 h-3"/> Browse & link project
          </Button>
        </div>
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center border border-dashed border-border rounded-lg">
            <FolderOpen className="w-6 h-6 text-muted-foreground/30 mb-2"/>
            <p className="text-sm text-muted-foreground mb-2">No projects linked to this contact</p>
            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setShowProjectBrowser(true)}>
              <Link2 className="w-3 h-3"/> Browse & link a project
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((project: any) => (
              <div key={project.id}
                className={cn("w-full flex items-center justify-between p-3 rounded-lg border border-border bg-card text-left", !embedded && "hover:bg-accent/50 cursor-pointer transition-colors")}
                onClick={() => !embedded && navigate(`/projects/${project.id}`, { state: { from: `/contacts/${contact.id}`, fromLabel: contact.name } })}
                role={embedded ? undefined : "button"}>
                <div>
                  <p className="text-sm font-medium">{project.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{project.engagement_type?.replace("_"," ")||"—"}</p>
                </div>
                <Badge variant="outline" className="text-xs">{project.stage}</Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Picker Modals ── */}
      <BrowseDealsModal open={showDealBrowser} onOpenChange={setShowDealBrowser}
        onLink={linkDeal} linkedDealIds={deals.map((d: any) => d.id)}/>
      <BrowseProjectsModal open={showProjectBrowser} onOpenChange={setShowProjectBrowser}
        onLink={linkProject} linkedProjectIds={projects.map((p: any) => p.id)}/>
    </div>
  );
}
