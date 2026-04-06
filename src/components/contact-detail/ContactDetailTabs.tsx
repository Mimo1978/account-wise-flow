import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, MessageSquare, Clock, Briefcase, FolderOpen, Mic, Square, Globe, Users, Lock, Pin, Loader2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props { contact: any; }

const PIPELINE_STAGES = ["lead", "qualified", "proposal", "negotiation", "won"];
const PIPELINE_LABELS: Record<string, string> = { lead: "Lead", qualified: "Qualified", proposal: "Proposal", negotiation: "Negotiation", won: "Won" };

function PipelineChevron({ currentStage }: { currentStage: string }) {
  const normalizedStage = currentStage?.toLowerCase().replace("closed_", "") || "";
  const activeIndex = PIPELINE_STAGES.indexOf(normalizedStage);
  return (
    <div className="flex items-center gap-0.5 mt-2">
      {PIPELINE_STAGES.map((stage, i) => {
        const isActive = i <= activeIndex && activeIndex >= 0;
        const isLost = normalizedStage === "lost";
        return (
          <div
            key={stage}
            className={`
              relative flex-1 h-6 flex items-center justify-center text-[10px] font-medium
              ${i === 0 ? "rounded-l-md" : ""} 
              ${i === PIPELINE_STAGES.length - 1 ? "rounded-r-md" : ""}
              ${isLost ? "bg-red-500/20 text-red-400" : isActive ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground/60"}
              transition-colors
            `}
          >
            {PIPELINE_LABELS[stage]}
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ icon: Icon, text, actionLabel, onAction }: { icon: any; text: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/30 mb-2" />
      <p className="text-sm text-muted-foreground">{text}</p>
      {actionLabel && <Button variant="link" size="sm" className="mt-1 text-xs" onClick={onAction}>{actionLabel}</Button>}
    </div>
  );
}

function NoteComposer({ contactId, onSaved }: { contactId: string; onSaved: () => void }) {
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<"public" | "team" | "private">("team");
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [saving, setSaving] = useState(false);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t + " ";
        else interim += t;
      }
      if (final) {
        setContent(prev => (prev + " " + final).trim());
        setLiveTranscript(interim);
      } else {
        setLiveTranscript(interim);
      }
    };
    r.onerror = () => { setIsRecording(false); setLiveTranscript(""); toast.error("Voice error — try again"); };
    r.onend = () => { setIsRecording(false); setLiveTranscript(""); };
    recognitionRef.current = r;
    return () => r.stop();
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) { toast.error("Voice not supported — use Chrome or Edge"); return; }
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setLiveTranscript("");
    } else {
      setIsRecording(true);
      setLiveTranscript("");
      recognitionRef.current.start();
      textareaRef.current?.focus();
    }
  };

  const save = async () => {
    const trimmed = content.trim();
    if (!trimmed) { toast.error("Note cannot be empty"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("notes").insert({
        entity_type: "contact",
        entity_id: contactId,
        content: trimmed,
        visibility,
        owner_id: user?.id || null,
        pinned: false,
        source: "ui",
      });
      if (error) throw error;
      setContent("");
      setLiveTranscript("");
      onSaved();
      toast.success("Note saved");
    } catch {
      toast.error("Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          id="note-composer"
          placeholder="Write a note about this contact..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[88px] text-sm resize-none pr-3"
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(); }}
        />
        {isRecording && liveTranscript && (
          <div className="absolute bottom-2 left-3 right-3 pointer-events-none">
            <p className="text-xs text-primary/70 italic truncate">{liveTranscript}</p>
          </div>
        )}
      </div>

      {isRecording && (
        <div className="flex items-center gap-2 px-1">
          <div className="flex items-end gap-0.5 h-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="w-1 bg-red-500 rounded-full animate-pulse" style={{ height: `${Math.random() * 16 + 4}px`, animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
          <span className="text-xs text-red-500 font-medium">Recording — speak now</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button size="sm" variant={isRecording ? "destructive" : "outline"} className="gap-1.5 h-8 text-xs" onClick={toggleVoice}>
            {isRecording ? <><Square className="w-3 h-3" /> Stop</> : <><Mic className="w-3 h-3" /> Dictate</>}
          </Button>
          <Select value={visibility} onValueChange={v => setVisibility(v as any)}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public"><span className="flex items-center gap-1.5 text-xs"><Globe className="w-3 h-3" /> Public</span></SelectItem>
              <SelectItem value="team"><span className="flex items-center gap-1.5 text-xs"><Users className="w-3 h-3" /> Team</span></SelectItem>
              <SelectItem value="private"><span className="flex items-center gap-1.5 text-xs"><Lock className="w-3 h-3" /> Private</span></SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="h-8 text-xs px-4" disabled={!content.trim() || saving} onClick={save}>
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save note"}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground px-0.5">Tip: ⌘+Enter to save quickly</p>
    </div>
  );
}

function NotesList({ notes, onPin }: { notes: any[]; onPin: (id: string, pinned: boolean) => void }) {
  if (notes.length === 0) return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
      <p className="text-sm text-muted-foreground">No notes yet — add the first one above</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {notes.map((note: any) => {
        const p = note.profiles;
        const initials = p ? `${(p.first_name || "")[0] || ""}${(p.last_name || "")[0] || ""}`.toUpperCase() || "?" : "?";
        const authorName = p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unknown" : "Unknown";
        const visIcon = note.visibility === "public" ? <Globe className="w-3 h-3" /> : note.visibility === "private" ? <Lock className="w-3 h-3" /> : <Users className="w-3 h-3" />;
        return (
          <div key={note.id} className={cn("rounded-lg border bg-card p-3 transition-colors", note.pinned && "border-primary/30 bg-primary/5")}>
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-[11px] font-semibold text-primary shrink-0 mt-0.5">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-medium text-foreground">{authorName}</span>
                  <span className="text-xs text-muted-foreground">{format(new Date(note.created_at), "dd MMM yyyy · HH:mm")}</span>
                  <span className="text-xs text-muted-foreground" title={formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}>
                    ({formatDistanceToNow(new Date(note.created_at), { addSuffix: true })})
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">{visIcon}</span>
                  {note.source === "voice" && <Badge variant="outline" className="text-[10px] h-4 px-1.5">voice</Badge>}
                  {note.pinned && <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-primary/40 text-primary">pinned</Badge>}
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{note.content}</p>
              </div>
              <button onClick={() => onPin(note.id, note.pinned)} className="shrink-0 text-muted-foreground hover:text-primary transition-colors mt-0.5 p-0.5" title={note.pinned ? "Unpin" : "Pin to top"}>
                <Pin className={cn("w-3.5 h-3.5", note.pinned && "fill-primary text-primary")} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ContactDetailTabs({ contact }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: deals = [] } = useQuery({
    queryKey: ["contact-deals", contact.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_deals").select("id, title, stage, value, currency, status, company_id, crm_companies(name)").eq("contact_id", contact.id).is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: notes = [], refetch: refetchNotes } = useQuery({
    queryKey: ["contact-notes", contact.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("notes").select("*, profiles(first_name, last_name)").eq("entity_type", "contact").eq("entity_id", contact.id).order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ["contact-timeline", contact.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_log").select("*").eq("entity_id", contact.id).order("changed_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["contact-documents", contact.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_documents" as any).select("*").eq("contact_id", contact.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: directProjects = [] } = useQuery({
    queryKey: ["contact-direct-projects", contact.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("engagements").select("id, name, engagement_type, stage, health").eq("contact_id", contact.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({ ...p, _source: "primary" as const }));
    },
  });

  const dealIds = deals.map((d: any) => d.id);
  const { data: dealProjects = [] } = useQuery({
    queryKey: ["contact-deal-projects", dealIds],
    queryFn: async () => {
      if (dealIds.length === 0) return [];
      const { data, error } = await supabase.from("crm_projects").select("*").in("deal_id", dealIds).is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({ ...p, _source: "deal" as const }));
    },
    enabled: dealIds.length > 0,
  });

  const allProjects = (() => {
    const seen = new Set<string>();
    const combined: any[] = [];
    for (const p of directProjects) { if (!seen.has(p.id)) { seen.add(p.id); combined.push(p); } }
    for (const p of dealProjects) { if (!seen.has(p.id)) { seen.add(p.id); combined.push(p); } }
    return combined;
  })();

  const pinNote = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const { error } = await supabase.from("notes").update({ pinned: !pinned }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-notes", contact.id] }),
  });

  const focusNoteComposer = () => {
    const tab = document.querySelector('[data-value="notes"]') as HTMLElement;
    tab?.click();
    setTimeout(() => document.getElementById("note-composer")?.focus(), 100);
  };

  return (
    <Tabs defaultValue="notes">
      <TabsList className="bg-card border border-border">
        <TabsTrigger value="notes" data-value="notes">
          Notes {notes.length > 0 && <span className="ml-1.5 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">{notes.length}</span>}
        </TabsTrigger>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
        <TabsTrigger value="deals">Deals</TabsTrigger>
        <TabsTrigger value="projects">Projects</TabsTrigger>
        <TabsTrigger value="documents">Documents</TabsTrigger>
      </TabsList>

      {/* NOTES TAB — first and default */}
      <TabsContent value="notes" className="mt-4 space-y-4">
        <NoteComposer contactId={contact.id} onSaved={() => qc.invalidateQueries({ queryKey: ["contact-notes", contact.id] })} />
        <NotesList notes={notes} onPin={(id, pinned) => pinNote.mutate({ id, pinned })} />
      </TabsContent>

      {/* OVERVIEW TAB */}
      <TabsContent value="overview" className="space-y-4 mt-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary" />Connected Deals</CardTitle></CardHeader>
          <CardContent>
            {deals.length === 0 ? <EmptyState icon={Briefcase} text="No deals linked" actionLabel="+ Link Deal" onAction={() => navigate("/crm/deals")} /> : (
              <div className="space-y-2">
                {deals.slice(0, 3).map((deal: any) => (
                  <button key={deal.id} onClick={() => navigate(`/crm/deals/${deal.id}`)} className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-background/50 hover:bg-accent/50 transition-colors text-left">
                    <div><p className="text-sm font-medium">{deal.title}</p><p className="text-xs text-muted-foreground">{deal.crm_companies?.name || "—"}</p></div>
                    <div className="flex items-center gap-2"><span className="text-sm font-medium">{deal.currency} {Number(deal.value).toLocaleString()}</span></div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FolderOpen className="h-4 w-4 text-emerald-500" />Connected Projects</CardTitle></CardHeader>
          <CardContent>
            {allProjects.length === 0 ? <EmptyState icon={FolderOpen} text="No projects linked" /> : (
              <div className="space-y-2">
                {allProjects.slice(0, 3).map((project: any) => (
                  <button key={project.id} onClick={() => navigate(`/projects/${project.id}`)} className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-background/50 hover:bg-accent/50 transition-colors text-left">
                    <div><p className="text-sm font-medium">{project.name}</p></div>
                    <Badge variant="outline" className="text-xs">{project.status || project.stage}</Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4 text-amber-500" />Recent Notes</CardTitle>
            {notes.length > 0 && <button className="text-xs text-primary hover:underline" onClick={focusNoteComposer}>View all in Notes tab →</button>}
          </CardHeader>
          <CardContent>
            {notes.length === 0 ? <EmptyState icon={MessageSquare} text="No notes yet" actionLabel="+ Add Note" onAction={focusNoteComposer} /> : (
              <div className="space-y-2">
                {notes.slice(0, 3).map((note: any) => {
                  const p = note.profiles;
                  const initials = p ? `${(p.first_name || "")[0] || ""}${(p.last_name || "")[0] || ""}`.toUpperCase() || "?" : "?";
                  return (
                    <div key={note.id} className="p-3 rounded-lg border border-border bg-background/50">
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">{initials}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground line-clamp-2">{note.content}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(note.created_at), "dd MMM yyyy · HH:mm")}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button className="w-full text-xs text-primary hover:underline text-center pt-1" onClick={focusNoteComposer}>See all {notes.length} notes →</button>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* TIMELINE TAB */}
      <TabsContent value="timeline" className="mt-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Activity Timeline</CardTitle>
            <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" /> Log Activity</Button>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 && notes.length === 0 ? <EmptyState icon={Clock} text="No activity yet." /> : (
              <div className="space-y-1">
                {[...notes.map((n: any) => ({ type: "note", date: n.created_at, content: n.content, id: n.id })),
                  ...timeline.map((t: any) => ({ type: "audit", date: t.changed_at, content: `${t.action} on ${t.entity_type}`, id: t.id }))
                ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(item => (
                  <div key={item.id} className="flex gap-3 py-2 border-b border-border/40 last:border-0">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {item.type === "note" ? <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" /> : <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground line-clamp-2">{item.content}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(item.date), "dd MMM yyyy · HH:mm")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* DEALS TAB */}
      <TabsContent value="deals" className="mt-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Deals</CardTitle></CardHeader>
          <CardContent>
            {deals.length === 0 ? <EmptyState icon={Briefcase} text="No deals linked to this contact" actionLabel="+ Link Deal" onAction={() => navigate("/crm/deals")} /> : (
              <div className="space-y-3">
                {deals.map((deal: any) => (
                  <button key={deal.id} onClick={() => navigate(`/crm/deals/${deal.id}`)} className="w-full p-3 rounded-lg border border-border bg-background/50 hover:bg-accent/50 transition-colors text-left space-y-1">
                    <div className="flex items-center justify-between"><p className="text-sm font-medium">{deal.title}</p><span className="text-sm font-semibold">{deal.currency} {Number(deal.value).toLocaleString()}</span></div>
                    <PipelineChevron currentStage={deal.stage} />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* PROJECTS TAB */}
      <TabsContent value="projects" className="mt-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Projects</CardTitle></CardHeader>
          <CardContent>
            {allProjects.length === 0 ? <EmptyState icon={FolderOpen} text="No projects connected" /> : (
              <div className="space-y-2">
                {allProjects.map((project: any) => (
                  <button key={project.id} onClick={() => navigate(`/projects/${project.id}`)} className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-background/50 hover:bg-accent/50 transition-colors text-left">
                    <div><p className="text-sm font-medium">{project.name}</p></div>
                    <div className="flex items-center gap-2"><Badge variant="outline" className="text-[10px]">{project._source === "primary" ? "Primary contact" : "Deal contact"}</Badge><Badge variant="outline" className="text-xs">{project.status || project.stage}</Badge></div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* DOCUMENTS TAB */}
      <TabsContent value="documents" className="mt-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Documents</CardTitle></CardHeader>
          <CardContent>
            {documents.length === 0 ? <EmptyState icon={FileText} text="No documents linked to this contact" actionLabel="+ Upload Document" /> : (
              <div className="space-y-2">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background/50">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{doc.title}</p><p className="text-xs text-muted-foreground">{doc.type} · {format(new Date(doc.created_at), "dd MMM yyyy")}</p></div>
                    <Badge variant="outline" className="text-xs">{doc.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
