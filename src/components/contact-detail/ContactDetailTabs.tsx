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

interface Props {
  contact: any;
}

const PIPELINE_STAGES = ["lead", "qualified", "proposal", "negotiation", "won"];
const PIPELINE_LABELS: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
};

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
              ${isLost ? "bg-red-500/20 text-red-400" : isActive ? "bg-[#378ADD]/20 text-[#378ADD]" : "bg-muted/50 text-muted-foreground/60"}
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

export function ContactDetailTabs({ contact }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [noteVisibility, setNoteVisibility] = useState<"public" | "team" | "private">("team");
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    recognitionRef.current = new SR();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.onresult = (event: any) => {
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript + " ";
      }
      if (final) setVoiceTranscript(prev => prev + final);
    };
    recognitionRef.current.onerror = () => { setIsRecording(false); toast.error("Voice error — try again"); };
    return () => recognitionRef.current?.stop();
  }, []);

  const startVoice = () => {
    if (!recognitionRef.current) { toast.error("Voice not supported in this browser"); return; }
    setVoiceTranscript("");
    setIsRecording(true);
    recognitionRef.current.start();
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
    if (voiceTranscript.trim()) setNewNote(prev => (prev + " " + voiceTranscript).trim());
    setVoiceTranscript("");
  };

  const addNote = useMutation({
    mutationFn: async () => {
      const content = newNote.trim();
      if (!content) throw new Error("empty");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("notes").insert({
        entity_type: "contact",
        entity_id: contact.id,
        content,
        visibility: noteVisibility,
        owner_id: user?.id || null,
        pinned: false,
        source: "ui",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-notes", contact.id] });
      setNewNote("");
      toast.success("Note saved");
    },
    onError: (e: any) => {
      if (e.message !== "empty") toast.error("Failed to save note");
    },
  });

  const pinNote = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const { error } = await supabase.from("notes").update({ pinned: !pinned }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-notes", contact.id] }),
  });

  // Deals linked to this contact
  const { data: deals = [] } = useQuery({
    queryKey: ["contact-deals", contact.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_deals")
        .select("id, title, stage, value, currency, status, company_id, crm_companies(name)")
        .eq("contact_id", contact.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Notes for this contact
  const { data: notes = [] } = useQuery({
    queryKey: ["contact-notes", contact.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("*, profiles(first_name, last_name)")
        .eq("entity_type", "contact")
        .eq("entity_id", contact.id)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ["contact-timeline", contact.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .eq("entity_id", contact.id)
        .order("changed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Documents linked to this contact
  const { data: documents = [] } = useQuery({
    queryKey: ["contact-documents", contact.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_documents" as any)
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Direct project assignments (engagements where contact_id = this contact)
  const { data: directProjects = [] } = useQuery({
    queryKey: ["contact-direct-projects", contact.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engagements")
        .select("id, name, engagement_type, stage, health")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({ ...p, _source: "primary" as const }));
    },
  });

  // Projects linked via deals
  const dealIds = deals.map((d: any) => d.id);
  const { data: dealProjects = [] } = useQuery({
    queryKey: ["contact-deal-projects", dealIds],
    queryFn: async () => {
      if (dealIds.length === 0) return [];
      const { data, error } = await supabase
        .from("crm_projects")
        .select("*")
        .in("deal_id", dealIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({ ...p, _source: "deal" as const }));
    },
    enabled: dealIds.length > 0,
  });

  // Combine projects, deduplicating by id
  const allProjects = (() => {
    const seen = new Set<string>();
    const combined: any[] = [];
    for (const p of directProjects) {
      if (!seen.has(p.id)) { seen.add(p.id); combined.push(p); }
    }
    for (const p of dealProjects) {
      if (!seen.has(p.id)) { seen.add(p.id); combined.push(p); }
    }
    return combined;
  })();

  return (
    <Tabs defaultValue="overview">
      <TabsList className="bg-card border border-border">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="notes">
          Notes {notes.length > 0 && <span className="ml-1 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">{notes.length}</span>}
        </TabsTrigger>
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
        <TabsTrigger value="deals">Deals</TabsTrigger>
        <TabsTrigger value="projects">Projects</TabsTrigger>
        <TabsTrigger value="documents">Documents</TabsTrigger>
      </TabsList>

      {/* OVERVIEW TAB */}
      <TabsContent value="overview" className="space-y-4 mt-4">
        {/* Connected Deals */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-[#378ADD]" />
              Connected Deals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deals.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                text="No deals linked"
                actionLabel="+ Link Deal"
                onAction={() => navigate("/crm/deals")}
              />
            ) : (
              <div className="space-y-2">
                {deals.slice(0, 3).map((deal: any) => (
                  <button
                    key={deal.id}
                    onClick={() => navigate(`/crm/deals/${deal.id}`)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-background/50 hover:bg-accent/50 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{deal.title}</p>
                      <p className="text-xs text-muted-foreground">{deal.crm_companies?.name || "—"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {deal.currency} {Number(deal.value).toLocaleString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connected Projects */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-emerald-400" />
              Connected Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allProjects.length === 0 ? (
              <EmptyState icon={FolderOpen} text="No projects linked" />
            ) : (
              <div className="space-y-2">
                {allProjects.slice(0, 3).map((project: any) => (
                  <button
                    key={project.id}
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-background/50 hover:bg-accent/50 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{project.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {project._source === "primary" ? "Primary contact" : "Deal contact"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{project.status || project.stage}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Notes */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-amber-400" />
              Recent Notes
            </CardTitle>
            {notes.length > 3 && (
              <button className="text-xs text-[#378ADD] hover:underline">
                View all
              </button>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-3">
              <Textarea
                placeholder="Write a note…"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="min-h-[80px] text-sm"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={!newNote.trim() || addNote.isPending}
                  onClick={() => addNote.mutate()}
                >
                  Save note
                </Button>
              </div>
            </div>
            {notes.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                text="No notes yet"
                actionLabel="+ Add Note"
                onAction={() => {
                  const tab = document.querySelector('[value="notes"]') as HTMLElement;
                  tab?.click();
                  setTimeout(() => document.getElementById("note-composer")?.focus(), 150);
                }}
              />
            ) : (
              <div className="space-y-2">
                {notes.slice(0, 3).map((note: any) => (
                  <div key={note.id} className="p-3 rounded-lg border border-border bg-background/50">
                    <p className="text-sm text-foreground line-clamp-2">{note.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(note.created_at), "dd MMM yyyy HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* NOTES TAB */}
      <TabsContent value="notes" className="mt-4 space-y-4">
        {/* Composer */}
        <Card className="bg-card border-border">
          <CardContent className="pt-4 space-y-3">
            <Textarea
              id="note-composer"
              placeholder="Write a note about this contact..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="min-h-[96px] text-sm resize-none"
            />
            {isRecording && voiceTranscript && (
              <p className="text-xs text-muted-foreground italic px-1">Recording: {voiceTranscript}</p>
            )}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={isRecording ? "destructive" : "outline"}
                  className="gap-1.5 h-8 text-xs"
                  onClick={isRecording ? stopVoice : startVoice}
                >
                  {isRecording ? <><Square className="w-3 h-3" /> Stop</> : <><Mic className="w-3 h-3" /> Voice</>}
                </Button>
                <Select value={noteVisibility} onValueChange={(v) => setNoteVisibility(v as any)}>
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
              <Button
                size="sm"
                className="h-8 text-xs px-4"
                disabled={!newNote.trim() || addNote.isPending}
                onClick={() => addNote.mutate()}
              >
                {addNote.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save note"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notes list */}
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No notes yet. Add the first one above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note: any) => {
              const author = note.profiles;
              const initials = author
                ? `${(author.first_name || "")[0] || ""}${(author.last_name || "")[0] || ""}`.toUpperCase() || "?"
                : "?";
              const authorName = author
                ? `${author.first_name || ""} ${author.last_name || ""}`.trim() || "Unknown"
                : "Unknown";
              const visIcon = note.visibility === "public" ? <Globe className="w-3 h-3" /> : note.visibility === "private" ? <Lock className="w-3 h-3" /> : <Users className="w-3 h-3" />;
              return (
                <Card key={note.id} className={cn("bg-card border-border", note.pinned && "border-primary/40")}>
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary shrink-0 mt-0.5">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-medium text-foreground">{authorName}</span>
                          <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}</span>
                          <span className="text-xs text-muted-foreground" title={format(new Date(note.created_at), "dd MMM yyyy HH:mm")}>{format(new Date(note.created_at), "dd MMM yyyy")}</span>
                          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">{visIcon} {note.visibility}</span>
                          {note.source === "voice" && <Badge variant="outline" className="text-[10px] h-4 px-1">voice</Badge>}
                          {note.pinned && <Badge variant="outline" className="text-[10px] h-4 px-1 border-primary/40 text-primary">pinned</Badge>}
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{note.content}</p>
                      </div>
                      <button
                        onClick={() => pinNote.mutate({ id: note.id, pinned: note.pinned })}
                        className="shrink-0 text-muted-foreground hover:text-primary transition-colors mt-0.5"
                        title={note.pinned ? "Unpin" : "Pin"}
                      >
                        <Pin className={cn("w-3.5 h-3.5", note.pinned && "fill-primary text-primary")} />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </TabsContent>

      {/* TIMELINE TAB */}
      <TabsContent value="timeline" className="mt-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Activity Timeline</CardTitle>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" /> Log Activity
            </Button>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 && notes.length === 0 ? (
              <EmptyState icon={Clock} text="No activity yet. Add a note to get started." actionLabel="+ Add Note" />
            ) : (
              <div className="space-y-0">
                {[
                  ...notes.map((n: any) => ({
                    id: n.id,
                    type: "note" as const,
                    date: n.created_at,
                    content: n.content,
                  })),
                  ...timeline.map((t: any) => ({
                    id: t.id,
                    type: "audit" as const,
                    date: t.changed_at,
                    content: `${t.action} on ${t.entity_type}`,
                    diff: t.diff,
                  })),
                ]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((item) => (
                    <div key={item.id} className="flex gap-3 py-3 border-l-2 border-border pl-4 ml-2">
                      <div className="shrink-0 mt-0.5">
                        {item.type === "note" ? (
                          <MessageSquare className="h-4 w-4 text-amber-400" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-foreground line-clamp-2">{item.content}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(item.date), "dd MMM yyyy HH:mm")}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* DEALS TAB — with pipeline chevrons */}
      <TabsContent value="deals" className="mt-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Linked Deals</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" /> Link Existing Deal
              </Button>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" /> Create New Deal
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {deals.length === 0 ? (
              <EmptyState icon={Briefcase} text="No deals linked to this contact" actionLabel="+ Link Deal" />
            ) : (
              <div className="space-y-3">
                {deals.map((deal: any) => (
                  <button
                    key={deal.id}
                    onClick={() => navigate(`/crm/deals/${deal.id}`)}
                    className="w-full p-3 rounded-lg border border-border bg-background/50 hover:bg-accent/50 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{deal.title}</p>
                        <p className="text-xs text-muted-foreground">{deal.crm_companies?.name || "—"}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">
                          {deal.currency} {Number(deal.value).toLocaleString()}
                        </span>
                        <Badge variant="outline" className="text-xs">{deal.status}</Badge>
                      </div>
                    </div>
                    <PipelineChevron currentStage={deal.stage} />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* PROJECTS TAB — combined direct + via deals */}
      <TabsContent value="projects" className="mt-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Connected Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {allProjects.length === 0 ? (
              <EmptyState icon={FolderOpen} text="No projects connected" />
            ) : (
              <div className="space-y-2">
                {allProjects.map((project: any) => (
                  <button
                    key={project.id}
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-background/50 hover:bg-accent/50 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{project.name}</p>
                      {project.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{project.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {project._source === "primary" ? "Primary contact" : "Deal contact"}
                      </Badge>
                      {project.project_type && <Badge variant="outline" className="text-xs">{project.project_type}</Badge>}
                      <Badge variant="outline" className="text-xs">{project.status || project.stage}</Badge>
                    </div>
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
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Documents</CardTitle>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" /> Upload Document
            </Button>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <EmptyState icon={FileText} text="No documents linked to this contact" actionLabel="+ Upload Document" />
            ) : (
              <div className="space-y-2">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.status && <Badge variant="outline" className="text-xs">{doc.status}</Badge>}
                      <span className="text-xs text-muted-foreground">
                        {doc.created_at && format(new Date(doc.created_at), "dd MMM yyyy")}
                      </span>
                    </div>
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

function EmptyState({
  icon: Icon,
  text,
  actionLabel,
  onAction,
}: {
  icon: any;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/50 mb-2" />
      <p className="text-sm text-muted-foreground">{text}</p>
      {actionLabel && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
