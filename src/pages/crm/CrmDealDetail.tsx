import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useCrmDeal, DEAL_STATUS_LABELS, DEAL_STATUS_COLORS } from "@/hooks/use-crm-deals";
import { useCrmDocuments, useUpdateCrmDocument, getSignedDocumentUrl, DOC_TYPE_LABELS, DOC_STATUS_LABELS, DOC_STATUS_COLORS } from "@/hooks/use-crm-documents";
import { useCrmInvoices, INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, getDisplayStatus } from "@/hooks/use-crm-invoices";
import { AddEditDealPanel } from "@/components/crm/AddEditDealPanel";
import { CrmDocumentUploadModal } from "@/components/crm/CrmDocumentUploadModal";
import { CreateCrmInvoicePanel } from "@/components/crm/CreateCrmInvoicePanel";
import { DeleteRecordModal } from "@/components/deletion/DeleteRecordModal";
import { DeletionRequestBanner } from "@/components/deletion/DeletionRequestBanner";
import { useDeletionPermission } from "@/hooks/use-deletion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Pencil, ArrowLeft, Loader2, ExternalLink, Upload, Send, CheckCircle, FileText, Download, Plus, ChevronLeft, Trash2, AlertTriangle, ArrowRight, Briefcase, User, FolderOpen, Search } from "lucide-react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function CrmDealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: deal, isLoading } = useCrmDeal(id);
  const { data: docs = [] } = useCrmDocuments({ deal_id: id });
  const { data: invoices = [] } = useCrmInvoices({ deal_id: id });
  const updateDoc = useUpdateCrmDocument();
  const [editOpen, setEditOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [projectPopoverOpen, setProjectPopoverOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const perm = useDeletionPermission();

  // ── Contact query ──
  const { data: availableContacts = [] } = useQuery({
    queryKey: ["crm-contacts-for-deal", deal?.company_id],
    queryFn: async () => {
      let q = supabase.from("crm_contacts").select("id, first_name, last_name, job_title").is("deleted_at", null);
      if (deal?.company_id) {
        q = q.eq("company_id", deal.company_id);
      } else {
        q = q.limit(50);
      }
      const { data } = await q.order("last_name");
      return (data ?? []) as { id: string; first_name: string; last_name: string; job_title: string | null }[];
    },
    enabled: !!deal,
  });

  // ── Current contact ──
  const { data: currentContact } = useQuery({
    queryKey: ["crm-contact-detail", deal?.contact_id],
    queryFn: async () => {
      if (!deal?.contact_id) return null;
      const { data } = await supabase.from("crm_contacts").select("id, first_name, last_name, job_title").eq("id", deal.contact_id).single();
      return data as { id: string; first_name: string; last_name: string; job_title: string | null } | null;
    },
    enabled: !!deal?.contact_id,
  });

  // ── Projects query ──
  const { data: availableProjects = [] } = useQuery({
    queryKey: ["crm-projects-for-deal", deal?.company_id],
    queryFn: async () => {
      let q = supabase.from("crm_projects" as any).select("id, name, status, workflow_stage").is("deleted_at", null);
      if (deal?.company_id) q = q.eq("company_id", deal.company_id);
      const { data } = await q.order("name");
      return (data ?? []) as { id: string; name: string; status: string; workflow_stage: string | null }[];
    },
    enabled: !!deal,
  });

  // ── Current project ──
  const { data: currentProject } = useQuery({
    queryKey: ["crm-project-detail", deal?.project_id],
    queryFn: async () => {
      if (!deal?.project_id) return null;
      const { data } = await supabase.from("crm_projects" as any).select("id, name, status, workflow_stage").eq("id", deal.project_id).single();
      return data as { id: string; name: string; status: string; workflow_stage: string | null } | null;
    },
    enabled: !!deal?.project_id,
  });

  // ── Engagement (delivery project) ──
  const { data: engagement } = useQuery({
    queryKey: ["engagement-for-deal", deal?.engagement_id],
    queryFn: async () => {
      if (!deal?.engagement_id) return null;
      const { data } = await supabase.from("engagements").select("id, name").eq("id", deal.engagement_id).single();
      return data as { id: string; name: string } | null;
    },
    enabled: !!deal?.engagement_id,
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!deal) return <div className="p-6 text-muted-foreground">Deal not found</div>;

  const currencySymbol = deal.currency === "GBP" ? "£" : deal.currency === "USD" ? "$" : "€";

  const invalidateDealQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["crm_deals"] });
    queryClient.invalidateQueries({ queryKey: ["crm-deal", id] });
    queryClient.invalidateQueries({ queryKey: ["deals"] });
    queryClient.invalidateQueries({ queryKey: ["all-crm-deals"] });
  };

  const handleAssignContact = async (contactId: string) => {
    const { error } = await supabase.from("crm_deals").update({ contact_id: contactId } as any).eq("id", deal.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Contact assigned" });
    setContactPopoverOpen(false);
    invalidateDealQueries();
    queryClient.invalidateQueries({ queryKey: ["crm-contact-detail"] });
  };

  const handleLinkProject = async (projectId: string) => {
    const { error } = await supabase.from("crm_deals").update({ project_id: projectId } as any).eq("id", deal.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Project linked" });
    setProjectPopoverOpen(false);
    invalidateDealQueries();
    queryClient.invalidateQueries({ queryKey: ["crm-project-detail"] });
  };

  const handleCreateAndLinkProject = async () => {
    const { data: newProject, error } = await supabase.from("crm_projects" as any).insert({
      name: deal.title,
      company_id: deal.company_id,
      status: "active",
    }).select().single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await handleLinkProject((newProject as any).id);
    toast({ title: "Project created and linked" });
  };

  const handleMarkSent = async (docId: string) => {
    try {
      await updateDoc.mutateAsync({ id: docId, status: "sent", sent_at: new Date().toISOString() } as any);
      toast({ title: "Marked as Sent" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleMarkSigned = async (docId: string) => {
    try {
      await updateDoc.mutateAsync({ id: docId, status: "signed", signed_at: new Date().toISOString() } as any);
      toast({ title: "Marked as Signed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDownload = async (fileUrl: string, title: string) => {
    const url = await getSignedDocumentUrl(fileUrl);
    if (url) {
      window.open(url, "_blank");
    } else {
      toast({ title: "Failed to generate download link", variant: "destructive" });
    }
  };

  const filteredContacts = availableContacts.filter(c =>
    !contactSearch || `${c.first_name} ${c.last_name} ${c.job_title ?? ""}`.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const filteredProjects = availableProjects.filter(p =>
    !projectSearch || p.name?.toLowerCase().includes(projectSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 text-muted-foreground hover:text-foreground -ml-2">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{deal.title}</h1>
            <Badge variant="secondary" className={DEAL_STATUS_COLORS[deal.status]}>{DEAL_STATUS_LABELS[deal.status]}</Badge>
            <span className="text-lg font-semibold text-foreground">{currencySymbol}{deal.value.toLocaleString()}</span>
          </div>
          {deal.crm_companies && (
            <span className="text-sm text-primary cursor-pointer hover:underline" onClick={() => navigate(`/companies/${deal.crm_companies!.id}`)}>
              {deal.crm_companies.name} <ExternalLink className="inline h-3 w-3" />
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {perm.canSeeDeleteOption && (
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-1" />
              {perm.canDeleteDirectly ? "Delete" : "Request deletion"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-1" /> Edit
          </Button>
        </div>
      </div>

      <DeletionRequestBanner recordType="crm_deals" recordId={deal.id} />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents ({docs.length})</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Dates & payment terms */}
          <Card>
            <CardContent className="py-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div><span className="text-muted-foreground">Signed Date</span><p className="font-medium">{deal.signed_date ? format(new Date(deal.signed_date), "dd MMM yyyy") : "—"}</p></div>
                <div><span className="text-muted-foreground">Start Date</span><p className="font-medium">{deal.start_date ? format(new Date(deal.start_date), "dd MMM yyyy") : "—"}</p></div>
                <div><span className="text-muted-foreground">End Date</span><p className="font-medium">{deal.end_date ? format(new Date(deal.end_date), "dd MMM yyyy") : "—"}</p></div>
                <div><span className="text-muted-foreground">Payment Terms</span><p className="font-medium">{deal.payment_terms || "—"}</p></div>
                <div><span className="text-muted-foreground">Currency</span><p className="font-medium">{deal.currency}</p></div>
              </div>
              {deal.crm_opportunities && (
                <div>
                  <span className="text-muted-foreground">Linked Opportunity</span>
                  <p className="font-medium text-primary cursor-pointer hover:underline" onClick={() => navigate(`/crm/opportunities/${deal.crm_opportunities!.id}`)}>
                    {deal.crm_opportunities.title}
                  </p>
                </div>
              )}
              {deal.notes && (
                <div><span className="text-muted-foreground">Notes</span><p className="mt-1 whitespace-pre-wrap">{deal.notes}</p></div>
              )}
            </CardContent>
          </Card>

          {/* A) Contact Section */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4" /> Contact</CardTitle>
            </CardHeader>
            <CardContent>
              {deal.contact_id && currentContact ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{currentContact.first_name} {currentContact.last_name}</p>
                    {currentContact.job_title && <p className="text-xs text-muted-foreground">{currentContact.job_title}</p>}
                  </div>
                  <Popover open={contactPopoverOpen} onOpenChange={(v) => { setContactPopoverOpen(v); setContactSearch(""); }}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-xs text-primary">Change</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-2 bg-popover z-[9999]" align="end">
                      <Input placeholder="Search contacts..." value={contactSearch} onChange={e => setContactSearch(e.target.value)} className="h-8 text-xs mb-2" />
                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {filteredContacts.map(c => (
                          <button key={c.id} onClick={() => handleAssignContact(c.id)}
                            className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted truncate">
                            {c.first_name} {c.last_name}{c.job_title ? ` · ${c.job_title}` : ""}
                          </button>
                        ))}
                        {filteredContacts.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1">No contacts found</p>}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium border border-amber-500/40 text-amber-400 bg-amber-500/10">
                    <AlertTriangle className="w-3 h-3" /> No contact assigned
                  </span>
                  <Popover open={contactPopoverOpen} onOpenChange={(v) => { setContactPopoverOpen(v); setContactSearch(""); }}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="text-xs gap-1"><User className="w-3 h-3" /> Assign Contact</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-2 bg-popover z-[9999]" align="start">
                      <Input placeholder="Search contacts..." value={contactSearch} onChange={e => setContactSearch(e.target.value)} className="h-8 text-xs mb-2" />
                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {filteredContacts.map(c => (
                          <button key={c.id} onClick={() => handleAssignContact(c.id)}
                            className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted truncate">
                            {c.first_name} {c.last_name}{c.job_title ? ` · ${c.job_title}` : ""}
                          </button>
                        ))}
                        {filteredContacts.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1">No contacts found</p>}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </CardContent>
          </Card>

          {/* B) Project Section */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><FolderOpen className="w-4 h-4" /> Project</CardTitle>
            </CardHeader>
            <CardContent>
              {deal.project_id && currentProject ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-primary cursor-pointer hover:underline" onClick={() => navigate(`/crm/projects/${currentProject.id}`)}>
                      {currentProject.name}
                    </p>
                    {currentProject.workflow_stage && <p className="text-xs text-muted-foreground">Stage: {currentProject.workflow_stage}</p>}
                  </div>
                  <Popover open={projectPopoverOpen} onOpenChange={(v) => { setProjectPopoverOpen(v); setProjectSearch(""); }}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-xs text-primary">Change</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-2 bg-popover z-[9999]" align="end">
                      <Input placeholder="Search projects..." value={projectSearch} onChange={e => setProjectSearch(e.target.value)} className="h-8 text-xs mb-2" />
                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {filteredProjects.map(p => (
                          <button key={p.id} onClick={() => handleLinkProject(p.id)}
                            className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted truncate">
                            {p.name}
                          </button>
                        ))}
                        {filteredProjects.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1">No projects found</p>}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium border border-amber-500/40 text-amber-400 bg-amber-500/10">
                    <AlertTriangle className="w-3 h-3" /> No project linked
                  </span>
                  <Popover open={projectPopoverOpen} onOpenChange={(v) => { setProjectPopoverOpen(v); setProjectSearch(""); }}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="text-xs gap-1"><FolderOpen className="w-3 h-3" /> Link Project</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-2 bg-popover z-[9999]" align="start">
                      <Input placeholder="Search projects..." value={projectSearch} onChange={e => setProjectSearch(e.target.value)} className="h-8 text-xs mb-2" />
                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {filteredProjects.map(p => (
                          <button key={p.id} onClick={() => handleLinkProject(p.id)}
                            className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted truncate">
                            {p.name}
                          </button>
                        ))}
                        {filteredProjects.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1">No projects found</p>}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleCreateAndLinkProject}>
                    <Plus className="w-3 h-3" /> Create New Project
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* C) Engagement / Delivery Link */}
          {deal.engagement_id && engagement ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Briefcase className="w-4 h-4" /> Delivery Project</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{engagement.name}</p>
                  <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => navigate(`/projects/${engagement.id}`)}>
                    View Project <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : deal.stage === "won" && !deal.engagement_id ? (
            <Card className="border-green-500/30">
              <CardContent className="py-4">
                <p className="text-sm text-muted-foreground mb-2">This deal is Won — create a delivery project to begin work</p>
                <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-500 text-white">
                  <Briefcase className="w-3 h-3" /> Create Delivery Project
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="documents">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4 mr-1" /> Upload Document
              </Button>
            </div>
            {docs.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No documents yet. Upload one to get started.</CardContent></Card>
            ) : (
              <div className="border rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Signed</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docs.map(doc => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {doc.title}
                        </TableCell>
                        <TableCell><Badge variant="outline">{DOC_TYPE_LABELS[doc.type]}</Badge></TableCell>
                        <TableCell>v{doc.version}</TableCell>
                        <TableCell><Badge variant="secondary" className={DOC_STATUS_COLORS[doc.status]}>{DOC_STATUS_LABELS[doc.status]}</Badge></TableCell>
                        <TableCell>{doc.sent_at ? format(new Date(doc.sent_at), "dd MMM yyyy") : "—"}</TableCell>
                        <TableCell>{doc.signed_at ? format(new Date(doc.signed_at), "dd MMM yyyy") : "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {doc.file_url && (
                              <Button variant="ghost" size="icon" onClick={() => handleDownload(doc.file_url!, doc.title)} title="Download">
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            {doc.status === "draft" && (
                              <Button variant="ghost" size="sm" onClick={() => handleMarkSent(doc.id)} title="Mark as Sent">
                                <Send className="h-4 w-4 mr-1" /> Send
                              </Button>
                            )}
                            {doc.status === "sent" && (
                              <Button variant="ghost" size="sm" onClick={() => handleMarkSigned(doc.id)} title="Mark as Signed">
                                <CheckCircle className="h-4 w-4 mr-1" /> Sign
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="invoices">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setInvoiceOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Create Invoice
              </Button>
            </div>
            {invoices.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No invoices yet. Create one to get started.</CardContent></Card>
            ) : (
              <div className="border rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map(inv => {
                      const ds = getDisplayStatus(inv);
                      const cs = deal?.currency === "GBP" ? "£" : deal?.currency === "USD" ? "$" : "€";
                      return (
                        <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/crm/invoices/${inv.id}`)}>
                          <TableCell className="font-medium text-primary">{inv.invoice_number || "—"}</TableCell>
                          <TableCell>{inv.issue_date ? format(new Date(inv.issue_date), "dd MMM yyyy") : "—"}</TableCell>
                          <TableCell>{inv.due_date ? format(new Date(inv.due_date), "dd MMM yyyy") : "—"}</TableCell>
                          <TableCell className="font-semibold">{cs}{inv.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell><Badge variant="secondary" className={INVOICE_STATUS_COLORS[ds]}>{INVOICE_STATUS_LABELS[ds]}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <Card><CardContent className="py-8 text-center text-muted-foreground">Activity log coming soon</CardContent></Card>
        </TabsContent>
      </Tabs>

      <AddEditDealPanel open={editOpen} onOpenChange={setEditOpen} deal={deal} />
      <CrmDocumentUploadModal open={uploadOpen} onOpenChange={setUploadOpen} defaultDealId={id} defaultCompanyId={deal.company_id || undefined} />
      <CreateCrmInvoicePanel open={invoiceOpen} onOpenChange={setInvoiceOpen} defaultDealId={id} />
      <DeleteRecordModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        recordType="crm_deals"
        recordId={deal.id}
        recordName={deal.title}
        onDeleted={() => navigate("/crm/deals")}
      />
    </div>
  );
}
