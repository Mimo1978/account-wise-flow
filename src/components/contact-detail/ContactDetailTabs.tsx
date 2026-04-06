import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Briefcase, FolderOpen, FileText, Mic, Square, Globe, Users, Lock, Pin, Loader2, Search, ExternalLink, Plus, Clock, Trash2, Pencil, X, Check, Sparkles, ChevronDown } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props { contact: any; }

function NoteComposer({ contactId, onSaved, note, setNote, saveNote }: { contactId: string; onSaved: () => void; note: string; setNote: (v: string) => void; saveNote: { mutate: () => void; isPending: boolean } }) {
  const content = note;
  const setContent = setNote;
  const [visibility, setVisibility] = useState<"public"|"team"|"private">("team");
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [saving, setSaving] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (event: any) => {
      let interim = "", final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t + " ";
        else interim += t;
      }
      if (final) { setNote(note + " " + final); }
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
    const trimmed = content.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("notes").insert({
        entity_type: "contact", entity_id: contactId,
        content: trimmed, visibility,
        owner_id: user?.id || null, pinned: false, source: "ui",
      });
      if (error) throw error;
      setContent(""); setLiveTranscript("");
      onSaved(); toast.success("Note saved");
    } catch { toast.error("Failed to save note"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="relative">
        <Textarea
          id="note-input"
          placeholder="Write a note about this contact..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[100px] text-sm resize-none"
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(); }}
        />
        {isRecording && liveTranscript && (
          <p className="absolute bottom-2 left-3 right-3 text-xs text-primary/60 italic pointer-events-none truncate">{liveTranscript}</p>
        )}
      </div>
      {isRecording && (
        <div className="flex items-center gap-2 px-1">
          <div className="flex items-end gap-px h-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="w-0.5 bg-red-500 rounded-full animate-pulse" style={{ height: `${4 + (i % 3) * 4 + Math.random() * 4}px`, animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
          <span className="text-xs text-red-500 font-medium">Recording — speak now</span>
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

function NoteCard({ note, onPin }: { note: any; onPin: () => void }) {
  const p = note.profiles;
  const initials = p ? `${(p.first_name||"")[0]||""}${(p.last_name||"")[0]||""}`.toUpperCase()||"?" : "?";
  const name = p ? `${p.first_name||""} ${p.last_name||""}`.trim()||"Unknown" : "Unknown";
  return (
    <div className={cn("rounded-lg border bg-card p-3 transition-colors", note.pinned && "border-primary/30 bg-primary/5")}>
      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-[11px] font-semibold text-primary shrink-0 mt-0.5">{initials}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-medium">{name}</span>
            <span className="text-xs text-muted-foreground">{format(new Date(note.created_at), "dd MMM yyyy · HH:mm")}</span>
            <span className="text-xs text-muted-foreground">({formatDistanceToNow(new Date(note.created_at), {addSuffix:true})})</span>
            {note.visibility==="public" && <Globe className="w-3 h-3 text-muted-foreground"/>}
            {note.visibility==="private" && <Lock className="w-3 h-3 text-muted-foreground"/>}
            {note.source==="voice" && <span className="text-[10px] border border-border rounded px-1 text-muted-foreground">voice</span>}
            {note.pinned && <span className="text-[10px] border border-primary/40 rounded px-1 text-primary">pinned</span>}
          </div>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{note.content}</p>
        </div>
        <button onClick={onPin} className="shrink-0 text-muted-foreground hover:text-primary transition-colors mt-0.5" title={note.pinned?"Unpin":"Pin"}>
          <Pin className={cn("w-3.5 h-3.5", note.pinned && "fill-primary text-primary")}/>
        </button>
      </div>
    </div>
  );
}

function LinkSearchPanel({ title, searchFn, onLink, navigate, linkLabel }: {
  title: string; searchFn: (q: string) => Promise<any[]>;
  onLink: (item: any) => Promise<void>; navigate: any; linkLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState<string|null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const r = await searchFn(query);
      setResults(r); setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="border border-border rounded-lg p-3 bg-muted/30 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground"/>
        <Input placeholder="Search by name..." value={query} onChange={e => setQuery(e.target.value)} className="pl-8 h-8 text-xs"/>
      </div>
      {loading && <p className="text-xs text-muted-foreground px-1">Searching...</p>}
      {results.map(item => (
        <div key={item.id} className="flex items-center justify-between p-2 rounded border border-border bg-card text-xs">
          <div>
            <p className="font-medium">{item.title || item.name}</p>
            {item.subtitle && <p className="text-muted-foreground">{item.subtitle}</p>}
          </div>
          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" disabled={!!linking}
            onClick={async () => { setLinking(item.id); await onLink(item); setLinking(null); setQuery(""); setResults([]); }}>
            {linking===item.id ? <Loader2 className="w-3 h-3 animate-spin"/> : linkLabel}
          </Button>
        </div>
      ))}
      {query && !loading && results.length===0 && <p className="text-xs text-muted-foreground px-1">No results found</p>}
    </div>
  );
}

export function ContactDetailTabs({ contact }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showDealLink, setShowDealLink] = useState(false);
  const [showProjectLink, setShowProjectLink] = useState(false);
  const [note, setNote] = useState("");

  const saveNote = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("notes").insert({
        entity_type: "contact",
        entity_id: contact.id,
        content: note.trim(),
        visibility: "team",
        owner_id: user?.id || null,
        pinned: false,
        source: "ui",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-notes", contact.id], refetchType: "active" });
      setNote("");
      toast.success("Note saved");
    },
    onError: () => toast.error("Failed to save note"),
  });

  const { data: notes = [], refetch: refetchNotes } = useQuery({
    queryKey: ["contact-notes", contact.id],
    queryFn: async () => {
      const { data } = await supabase.from("notes")
        .select("*")
        .eq("entity_type", "contact").eq("entity_id", contact.id)
        .order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(100);
      return data || [];
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

  const searchDeals = async (q: string) => {
    const { data } = await supabase.from("crm_deals")
      .select("id, title, value, currency, stage, crm_companies(name)")
      .ilike("title", `%${q}%`).is("deleted_at", null).limit(8);
    return (data || []).map((d: any) => ({ ...d, subtitle: `${d.currency} ${Number(d.value).toLocaleString()} · ${d.crm_companies?.name||""}` }));
  };

  const linkDeal = async (deal: any) => {
    await supabase.from("crm_deals").update({ contact_id: contact.id }).eq("id", deal.id);
    refetchDeals(); setShowDealLink(false);
    toast.success("Deal linked");
  };

  const searchProjects = async (q: string) => {
    const { data } = await supabase.from("engagements")
      .select("id, name, engagement_type, stage").ilike("name", `%${q}%`).limit(8);
    return (data || []).map((p: any) => ({ ...p, title: p.name, subtitle: `${p.engagement_type} · ${p.stage}` }));
  };

  const linkProject = async (project: any) => {
    await supabase.from("engagements").update({ contact_id: contact.id }).eq("id", project.id);
    refetchProjects(); setShowProjectLink(false);
    toast.success("Project linked");
  };

  return (
    <div className="space-y-6">

      {/* ── NOTES — always visible at top, no tab ── */}
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
          <div className="space-y-2 mt-4">
            {notes.map((note: any) => (
              <NoteCard key={note.id} note={note} onPin={() => pinNote.mutate({ id: note.id, pinned: note.pinned })}/>
            ))}
          </div>
        )}
        {notes.length === 0 && (
          <div className="mt-4 flex flex-col items-center justify-center py-8 text-center border border-dashed border-border rounded-lg">
            <MessageSquare className="w-8 h-8 text-muted-foreground/30 mb-2"/>
            <p className="text-sm text-muted-foreground">No notes yet — add the first one above</p>
            <p className="text-xs text-muted-foreground opacity-50 mt-1">Query key: contact-notes-{contact.id?.slice(0,8)}</p>
          </div>
        )}
      </section>

      <div className="border-t border-border"/>

      {/* ── DEALS ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-blue-500"/>
            Deals
            {deals.length > 0 && <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-medium">{deals.length}</span>}
          </h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowDealLink(v => !v)}>
              <Search className="w-3 h-3"/> Link deal
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => navigate("/crm/deals")}>
              <ExternalLink className="w-3 h-3"/> All deals
            </Button>
          </div>
        </div>
        {showDealLink && (
          <div className="mb-3">
            <LinkSearchPanel title="Search and link an existing deal" searchFn={searchDeals} onLink={linkDeal} navigate={navigate} linkLabel="Link"/>
          </div>
        )}
        {deals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center border border-dashed border-border rounded-lg">
            <Briefcase className="w-6 h-6 text-muted-foreground/30 mb-2"/>
            <p className="text-sm text-muted-foreground mb-2">No deals linked to this contact</p>
            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setShowDealLink(true)}>
              <Search className="w-3 h-3"/> Link a deal
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {deals.map((deal: any) => (
              <button key={deal.id} onClick={() => navigate(`/crm/deals/${deal.id}`)}
                className="w-full p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors text-left">
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
              </button>
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
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowProjectLink(v => !v)}>
              <Search className="w-3 h-3"/> Link project
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => navigate("/projects")}>
              <ExternalLink className="w-3 h-3"/> All projects
            </Button>
          </div>
        </div>
        {showProjectLink && (
          <div className="mb-3">
            <LinkSearchPanel title="Search and link an existing project" searchFn={searchProjects} onLink={linkProject} navigate={navigate} linkLabel="Link"/>
          </div>
        )}
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center border border-dashed border-border rounded-lg">
            <FolderOpen className="w-6 h-6 text-muted-foreground/30 mb-2"/>
            <p className="text-sm text-muted-foreground mb-2">No projects linked to this contact</p>
            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setShowProjectLink(true)}>
              <Search className="w-3 h-3"/> Link a project
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((project: any) => (
              <button key={project.id} onClick={() => navigate(`/projects/${project.id}`)}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors text-left">
                <div>
                  <p className="text-sm font-medium">{project.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{project.engagement_type?.replace("_"," ")||"—"}</p>
                </div>
                <Badge variant="outline" className="text-xs">{project.stage}</Badge>
              </button>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
