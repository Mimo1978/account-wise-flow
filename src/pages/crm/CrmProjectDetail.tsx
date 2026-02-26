import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCrmProject } from "@/hooks/use-crm-projects";
import { useCrmOpportunities } from "@/hooks/use-crm-opportunities";
import { STAGE_LABELS, STAGE_COLORS } from "@/hooks/use-crm-opportunities";
import { AddEditProjectPanel } from "@/components/crm/AddEditProjectPanel";
import { AddEditOpportunityPanel } from "@/components/crm/AddEditOpportunityPanel";
import { Pencil, Plus, ArrowLeft, Loader2, ExternalLink } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  paused: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function CrmProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading } = useCrmProject(id);
  const { data: opportunities = [] } = useCrmOpportunities({ project_id: id });
  const [editOpen, setEditOpen] = useState(false);
  const [oppPanelOpen, setOppPanelOpen] = useState(false);

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!project) return <div className="p-6 text-muted-foreground">Project not found</div>;

  const currencySymbol = project.currency === "GBP" ? "£" : project.currency === "USD" ? "$" : "€";
  const totalPipeline = opportunities.reduce((s, o) => s + (o.value || 0), 0);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/crm/projects")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
            <Badge className={STATUS_COLORS[project.status] || ""} variant="secondary">{project.status}</Badge>
            {project.project_type && <Badge variant="outline" className="capitalize">{project.project_type}</Badge>}
          </div>
          {project.crm_companies && (
            <span className="text-sm text-primary cursor-pointer hover:underline" onClick={() => navigate(`/crm/companies/${project.crm_companies!.id}`)}>
              {project.crm_companies.name} <ExternalLink className="inline h-3 w-3" />
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4 mr-1" /> Edit
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities ({opportunities.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm">Details</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {project.description && <div><span className="text-muted-foreground">Description:</span> <p className="mt-1">{project.description}</p></div>}
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">Start Date</span><p>{project.start_date ? format(new Date(project.start_date), "dd MMM yyyy") : "—"}</p></div>
                  <div><span className="text-muted-foreground">End Date</span><p>{project.end_date ? format(new Date(project.end_date), "dd MMM yyyy") : "—"}</p></div>
                  <div><span className="text-muted-foreground">Budget</span><p>{project.budget != null ? `${currencySymbol}${project.budget.toLocaleString()}` : "—"}</p></div>
                  <div><span className="text-muted-foreground">Assigned To</span><p>{project.assigned_to || "—"}</p></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Key Stats</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">Opportunities</span><p className="text-lg font-semibold">{opportunities.length}</p></div>
                  <div><span className="text-muted-foreground">Pipeline Value</span><p className="text-lg font-semibold">{currencySymbol}{totalPipeline.toLocaleString()}</p></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="opportunities">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setOppPanelOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Opportunity</Button>
          </div>
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Probability</TableHead>
                  <TableHead>Expected Close</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opportunities.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No opportunities yet</TableCell></TableRow>
                ) : opportunities.map(o => (
                  <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/crm/opportunities/${o.id}`)}>
                    <TableCell className="font-medium text-primary">{o.title}</TableCell>
                    <TableCell><Badge className={STAGE_COLORS[o.stage]} variant="secondary">{STAGE_LABELS[o.stage]}</Badge></TableCell>
                    <TableCell>{currencySymbol}{o.value.toLocaleString()}</TableCell>
                    <TableCell>{o.probability}%</TableCell>
                    <TableCell>{o.expected_close_date ? format(new Date(o.expected_close_date), "dd MMM yyyy") : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <Card><CardContent className="py-8 text-center text-muted-foreground">Documents coming soon</CardContent></Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card><CardContent className="py-8 text-center text-muted-foreground">Activity log coming soon</CardContent></Card>
        </TabsContent>
      </Tabs>

      <AddEditProjectPanel open={editOpen} onOpenChange={setEditOpen} project={project} navigateOnCreate={false} />
      <AddEditOpportunityPanel open={oppPanelOpen} onOpenChange={setOppPanelOpen} defaultCompanyId={project.company_id || undefined} defaultProjectId={project.id} />
    </div>
  );
}
