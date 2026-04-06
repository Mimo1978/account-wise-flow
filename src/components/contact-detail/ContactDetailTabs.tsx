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
import { MessageSquare, Briefcase, FolderOpen, Mic, Square, Globe, Users, Lock, Pin, Loader2, Search, ExternalLink, Trash2, Pencil, X, Check, Sparkles, ChevronDown, Link2, CalendarDays } from "lucide-react";
import { format, formatDistanceToNow, isWithinInterval, startOfDay, endOfDay, parseISO } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
          <button onClick={() => onOpenChange(false)} className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
            <X className="h-4 w-4" /><span className="sr-only">Close</span>
          </button>
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
          <button onClick={() => onOpenChange(false)} className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
            <X className="h-4 w-4" /><span className="sr-only">Close</span>
          </button>
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
  const [aiSummary, setAiSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [datePickerOpen, setDatePickerOpen] = useState(false);

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

  const { data: deals = [], refetch: refetchDeals } = useQuery({
    queryKey: ["contact-deals", contact.id],
    queryFn: async () => {
      const { data } = await supabase.from("crm_deals")
        .select("id, title, stage, value, currency, status, contact_id, crm_companies(name)")
        .or(`contact_id.eq.${contact.id}`)
        .is("deleted_at", null).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: projects = [], refetch: refetchProjects } = useQuery({
    queryKey: ["contact-projects", contact.id],
    queryFn: async () => {
      const { data } = await supabase.from("engagements")
        .select("id, name, engagement_type, stage, health, company_id")
        .or(`contact_id.eq.${contact.id}`)
        .order("created_at", { ascending: false });
      return data || [];
    },
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

  const linkDeal = async (deal: any) => {
    await supabase.from("crm_deals").update({ contact_id: contact.id }).eq("id", deal.id);
    refetchDeals();
    qc.invalidateQueries({ queryKey: ["browse-all-deals"] });
    toast.success("Deal linked");
  };

  const linkProject = async (project: any) => {
    await supabase.from("engagements").update({ contact_id: contact.id }).eq("id", project.id);
    refetchProjects();
    qc.invalidateQueries({ queryKey: ["browse-all-projects"] });
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
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground"/>
                <Input placeholder="Search notes by content..." value={noteSearch} onChange={e => setNoteSearch(e.target.value)} className="pl-8 h-8 text-xs"/>
              </div>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1.5 shrink-0", (dateRange.from || dateRange.to) && "border-primary text-primary")}>
                    <CalendarDays className="w-3 h-3"/>
                    {dateRange.from ? (dateRange.to ? `${format(dateRange.from, "dd MMM")} – ${format(dateRange.to, "dd MMM")}` : format(dateRange.from, "dd MMM yyyy")) : "Date filter"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[10002]" align="end">
                  <Calendar mode="range" selected={dateRange.from ? { from: dateRange.from, to: dateRange.to } : undefined}
                    onSelect={(range) => { setDateRange({ from: range?.from, to: range?.to }); if (range?.to) setDatePickerOpen(false); }}
                    numberOfMonths={1} initialFocus className="pointer-events-auto"/>
                  {(dateRange.from || dateRange.to) && (
                    <div className="border-t border-border p-2">
                      <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => { setDateRange({}); setDatePickerOpen(false); }}>
                        Clear date filter
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {/* Notes list */}
            {(() => {
              const filtered = notes.filter((n: any) => {
                const matchesText = !noteSearch || n.content.toLowerCase().includes(noteSearch.toLowerCase());
                const noteDate = new Date(n.created_at);
                const matchesDate = !dateRange.from || isWithinInterval(noteDate, {
                  start: startOfDay(dateRange.from),
                  end: endOfDay(dateRange.to || dateRange.from),
                });
                return matchesText && matchesDate;
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
                              <Button size="sm" className="h-7 text-xs gap-1" disabled={!editContent.trim() || editNote.isPending}
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
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button onClick={() => pinNote.mutate({ id: n.id, pinned: n.pinned })}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title={n.pinned?"Unpin":"Pin"}>
                                <Pin className={cn("w-3 h-3", n.pinned && "fill-primary text-primary")}/>
                              </button>
                              <button onClick={() => { setEditingNoteId(n.id); setEditContent(n.content); }}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                                <Pencil className="w-3 h-3"/>
                              </button>
                              <button onClick={() => setDeletingNoteId(n.id)}
                                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                                <Trash2 className="w-3 h-3"/>
                              </button>
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
