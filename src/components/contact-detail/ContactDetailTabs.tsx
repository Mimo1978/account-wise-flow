import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, FileText, MessageSquare, Clock, Briefcase, FolderOpen } from "lucide-react";
import { format } from "date-fns";

interface Props {
  contact: any;
}

const stageColors: Record<string, string> = {
  lead: "bg-blue-500/20 text-blue-400",
  discovery: "bg-cyan-500/20 text-cyan-400",
  proposal: "bg-amber-500/20 text-amber-400",
  negotiation: "bg-violet-500/20 text-violet-400",
  won: "bg-emerald-500/20 text-emerald-400",
  lost: "bg-red-500/20 text-red-400",
  closed_won: "bg-emerald-500/20 text-emerald-400",
  closed_lost: "bg-red-500/20 text-red-400",
};

export function ContactDetailTabs({ contact }: Props) {
  const navigate = useNavigate();

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
        .select("*")
        .eq("entity_type", "contact")
        .eq("entity_id", contact.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Timeline: audit log entries
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
        .from("commercial_documents")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Projects linked via deals
  const dealIds = deals.map((d: any) => d.id);
  const { data: projects = [] } = useQuery({
    queryKey: ["contact-projects", dealIds],
    queryFn: async () => {
      if (dealIds.length === 0) return [];
      const { data, error } = await supabase
        .from("crm_projects")
        .select("*")
        .in("deal_id", dealIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: dealIds.length > 0,
  });

  return (
    <Tabs defaultValue="overview">
      <TabsList className="bg-[#1A1F2E] border border-border">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
        <TabsTrigger value="deals">Deals</TabsTrigger>
        <TabsTrigger value="projects">Projects</TabsTrigger>
        <TabsTrigger value="documents">Documents</TabsTrigger>
      </TabsList>

      {/* OVERVIEW TAB */}
      <TabsContent value="overview" className="space-y-4 mt-4">
        {/* Connected Deals */}
        <Card className="bg-[#1A1F2E] border-border">
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
                {deals.map((deal: any) => (
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
                      <Badge variant="outline" className={`text-xs ${stageColors[deal.stage] || "bg-muted text-muted-foreground"}`}>
                        {deal.stage}
                      </Badge>
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
        <Card className="bg-[#1A1F2E] border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-emerald-400" />
              Connected Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <EmptyState icon={FolderOpen} text="No projects linked via deals" />
            ) : (
              <div className="space-y-2">
                {projects.map((project: any) => (
                  <button
                    key={project.id}
                    onClick={() => navigate(`/crm/projects/${project.id}`)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-background/50 hover:bg-accent/50 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{project.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {project.project_type && (
                        <Badge variant="outline" className="text-xs">{project.project_type}</Badge>
                      )}
                      <Badge variant="outline" className="text-xs">{project.status}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Notes */}
        <Card className="bg-[#1A1F2E] border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-amber-400" />
              Recent Notes
            </CardTitle>
            {notes.length > 3 && (
              <button
                className="text-xs text-[#378ADD] hover:underline"
                onClick={() => {/* switch to timeline tab */}}
              >
                View all
              </button>
            )}
          </CardHeader>
          <CardContent>
            {notes.length === 0 ? (
              <EmptyState icon={MessageSquare} text="No notes yet" actionLabel="+ Add Note" />
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

      {/* TIMELINE TAB */}
      <TabsContent value="timeline" className="mt-4">
        <Card className="bg-[#1A1F2E] border-border">
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
                {/* Merge notes and audit entries, sorted by date */}
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

      {/* DEALS TAB */}
      <TabsContent value="deals" className="mt-4">
        <Card className="bg-[#1A1F2E] border-border">
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
              <div className="space-y-2">
                {deals.map((deal: any) => (
                  <button
                    key={deal.id}
                    onClick={() => navigate(`/crm/deals/${deal.id}`)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-background/50 hover:bg-accent/50 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{deal.title}</p>
                      <p className="text-xs text-muted-foreground">{deal.crm_companies?.name || "—"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={`text-xs ${stageColors[deal.stage] || ""}`}>
                        {deal.stage}
                      </Badge>
                      <span className="text-sm font-medium">
                        {deal.currency} {Number(deal.value).toLocaleString()}
                      </span>
                      <Badge variant="outline" className="text-xs">{deal.status}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* PROJECTS TAB */}
      <TabsContent value="projects" className="mt-4">
        <Card className="bg-[#1A1F2E] border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Connected Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <EmptyState icon={FolderOpen} text="No projects connected via deals" />
            ) : (
              <div className="space-y-2">
                {projects.map((project: any) => (
                  <button
                    key={project.id}
                    onClick={() => navigate(`/crm/projects/${project.id}`)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-background/50 hover:bg-accent/50 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{project.name}</p>
                      {project.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{project.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {project.project_type && <Badge variant="outline" className="text-xs">{project.project_type}</Badge>}
                      <Badge variant="outline" className="text-xs">{project.status}</Badge>
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
        <Card className="bg-[#1A1F2E] border-border">
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
