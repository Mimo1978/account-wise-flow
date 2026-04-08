import { useState, useEffect } from "react";
import { PipelineChevron as SharedPipelineChevron } from "@/components/pipeline/PipelineChevron";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCrmDeal, DEAL_STATUS_LABELS, DEAL_STATUS_COLORS } from "@/hooks/use-crm-deals";
import { useCrmDocuments, useUpdateCrmDocument, getSignedDocumentUrl, DOC_TYPE_LABELS, DOC_STATUS_LABELS, DOC_STATUS_COLORS } from "@/hooks/use-crm-documents";
import { useCrmInvoices, INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, getDisplayStatus } from "@/hooks/use-crm-invoices";
import { AddEditDealPanel } from "@/components/crm/AddEditDealPanel";
import { CrmDocumentUploadModal } from "@/components/crm/CrmDocumentUploadModal";
import { CreateCrmInvoicePanel } from "@/components/crm/CreateCrmInvoicePanel";
import { DeleteRecordModal } from "@/components/deletion/DeleteRecordModal";
import { DeletionRequestBanner } from "@/components/deletion/DeletionRequestBanner";
import { useDeletionPermission } from "@/hooks/use-deletion";
import { getProjectBadgeSeverity, getContactBadgeSeverity, BADGE_SEVERITY_STYLES } from "@/lib/deal-utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useConfirmation } from "@/contexts/ConfirmationContext";
import {
  Pencil, ArrowLeft, Loader2, ExternalLink, Upload, Send, CheckCircle, FileText, Download, Plus,
  ChevronLeft, Trash2, AlertTriangle, ArrowRight, Briefcase, User, Users, FolderOpen, Search, Building2,
  ChevronRight, XCircle, Clock,
} from "lucide-react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/* ─── Pipeline stages ─── */
const STAGES = ["lead", "qualified", "proposal", "negotiation", "won"] as const;
const STAGE_LABELS: Record<string, string> = { lead: "Lead", qualified: "Qualified", proposal: "Proposal", negotiation: "Negotiation", won: "Won", placed: "Placed", lost: "Lost" };
const STAGE_COLORS: Record<string, string> = {
  lead: "bg-blue-500", qualified: "bg-purple-500", proposal: "bg-amber-500",
  negotiation: "bg-orange-500", won: "bg-green-500", lost: "bg-red-500",
};

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
  const [placementOpen, setPlacementOpen] = useState(false);
  const perm = useDeletionPermission();
  const { showConfirmation } = useConfirmation();

  // Popover states
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [companyPopoverOpen, setCompanyPopoverOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [projectPopoverOpen, setProjectPopoverOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");

  // Quick-add inline forms
  const [quickContactOpen, setQuickContactOpen] = useState(false);
  const [quickContactForm, setQuickContactForm] = useState({ first_name: "", last_name: "", job_title: "", email: "" });
  const [quickProjectOpen, setQuickProjectOpen] = useState(false);
  const [quickProjectForm, setQuickProjectForm] = useState({ name: "", project_type: "consulting" });

  // Stage confirmation
  const [stageConfirm, setStageConfirm] = useState<{ stage: string; direction: "forward" | "backward" } | null>(null);

  const d = (deal ?? {}) as any;

  // ── Contact query: company contacts + all contacts ──
  const { data: companyContacts = [] } = useQuery({
    queryKey: ["crm-contacts-company", d.company_id],
    queryFn: async () => {
      if (!d.company_id) return [];
      const { data } = await supabase.from("crm_contacts").select("id, first_name, last_name, job_title, company_id").is("deleted_at", null).eq("company_id", d.company_id).order("last_name").limit(20);
      return (data ?? []) as { id: string; first_name: string; last_name: string; job_title: string | null; company_id: string | null }[];
    },
    enabled: !!deal && !!d.company_id,
  });

  const { data: allContacts = [] } = useQuery({
    queryKey: ["crm-contacts-all", contactSearch],
    queryFn: async () => {
      let q = supabase.from("crm_contacts").select("id, first_name, last_name, job_title, company_id, crm_companies(name)").is("deleted_at", null).order("last_name").limit(30);
      if (contactSearch.trim()) q = q.or(`first_name.ilike.%${contactSearch}%,last_name.ilike.%${contactSearch}%`);
      const { data } = await q;
      return (data ?? []) as any[];
    },
    enabled: !!deal && contactPopoverOpen,
  });

  // ── Current contact ──
  const { data: currentContact } = useQuery({
    queryKey: ["crm-contact-detail", d.contact_id],
    queryFn: async () => {
      if (!d.contact_id) return null;
      const { data } = await supabase.from("crm_contacts").select("id, first_name, last_name, job_title").eq("id", d.contact_id).single();
      return data as { id: string; first_name: string; last_name: string; job_title: string | null } | null;
    },
    enabled: !!d.contact_id,
  });

  // ── Companies query ──
  const { data: availableCompanies = [] } = useQuery({
    queryKey: ["crm-companies-search", companySearch],
    queryFn: async () => {
      let q = supabase.from("crm_companies").select("id, name, industry").is("deleted_at", null).order("name").limit(20);
      if (companySearch.trim()) q = q.ilike("name", `%${companySearch}%`);
      const { data } = await q;
      return (data ?? []) as { id: string; name: string; industry: string | null }[];
    },
    enabled: !!deal && companyPopoverOpen,
  });

  // ── Projects query ──
  const { data: availableProjects = [] } = useQuery({
    queryKey: ["crm-projects-for-deal", d.company_id, projectSearch],
    queryFn: async () => {
      let q = (supabase.from as any)("crm_projects").select("id, name, status, workflow_stage").is("deleted_at", null);
      if (d.company_id) q = q.eq("company_id", d.company_id);
      if (projectSearch.trim()) q = q.ilike("name", `%${projectSearch}%`);
      const { data } = await q.order("name").limit(20);
      return (data ?? []) as unknown as { id: string; name: string; status: string; workflow_stage: string | null }[];
    },
    enabled: !!deal && projectPopoverOpen,
  });

  // ── Current project ──
  const { data: currentProject } = useQuery({
    queryKey: ["crm-project-detail", d.project_id],
    queryFn: async () => {
      if (!d.project_id) return null;
      const { data } = await (supabase.from as any)("crm_projects").select("id, name, status, workflow_stage").eq("id", d.project_id).single();
      return data as unknown as { id: string; name: string; status: string; workflow_stage: string | null } | null;
    },
    enabled: !!d.project_id,
  });

  // ── Engagement ──
  const { data: engagement } = useQuery({
    queryKey: ["engagement-for-deal", d.engagement_id],
    queryFn: async () => {
      if (!d.engagement_id) return null;
      const { data } = await supabase.from("engagements").select("id, name").eq("id", d.engagement_id).single();
      return data as { id: string; name: string } | null;
    },
    enabled: !!d.engagement_id,
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!deal) return <div className="p-6 text-muted-foreground">Deal not found</div>;

  const currencySymbol = deal.currency === "GBP" ? "£" : deal.currency === "USD" ? "$" : "€";
  const currentStageIdx = STAGES.indexOf(d.stage as any);

  const invalidateDealQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["crm_deals"] });
    queryClient.invalidateQueries({ queryKey: ["crm-deal", id] });
    queryClient.invalidateQueries({ queryKey: ["deals"] });
    queryClient.invalidateQueries({ queryKey: ["all-crm-deals"] });
  };

  const handleStageChange = async (newStage: string) => {
    const { error } = await supabase.from("crm_deals").update({ stage: newStage } as any).eq("id", deal.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    showConfirmation({ type: 'success', title: 'Stage updated', message: `Deal moved to ${STAGE_LABELS[newStage]}.` });
    invalidateDealQueries();
    setStageConfirm(null);
  };

  const handleAssignCompany = async (companyId: string) => {
    const { error } = await supabase.from("crm_deals").update({ company_id: companyId } as any).eq("id", deal.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    const company = availableCompanies.find(c => c.id === companyId);
    showConfirmation({ type: 'success', title: 'Company assigned', message: `${company?.name || 'Company'} has been linked to this deal.` });
    setCompanyPopoverOpen(false);
    invalidateDealQueries();
    queryClient.invalidateQueries({ queryKey: ["crm-contacts-company"] });
  };

  const handleAssignContact = async (contactId: string) => {
    const { error } = await supabase.from("crm_deals").update({ contact_id: contactId } as any).eq("id", deal.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    showConfirmation({ type: 'success', title: 'Contact assigned', message: 'Contact is now the key contact for this deal.' });
    setContactPopoverOpen(false);
    invalidateDealQueries();
    queryClient.invalidateQueries({ queryKey: ["crm-contact-detail"] });
  };

  const handleLinkProject = async (projectId: string) => {
    const { error } = await supabase.from("crm_deals").update({ project_id: projectId } as any).eq("id", deal.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    showConfirmation({ type: 'success', title: 'Project linked', message: 'Project has been connected to this deal.' });
    setProjectPopoverOpen(false);
    invalidateDealQueries();
    queryClient.invalidateQueries({ queryKey: ["crm-project-detail"] });
  };

  const handleQuickAddContact = async () => {
    if (!quickContactForm.first_name.trim() || !quickContactForm.last_name.trim()) {
      toast({ title: "First and last name are required", variant: "destructive" }); return;
    }
    const { data: newContact, error } = await supabase.from("crm_contacts").insert({
      first_name: quickContactForm.first_name,
      last_name: quickContactForm.last_name,
      job_title: quickContactForm.job_title || null,
      email: quickContactForm.email || null,
      company_id: d.company_id || null,
    } as any).select().single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await handleAssignContact((newContact as any).id);
    showConfirmation({ type: 'success', title: 'Contact added', message: `${quickContactForm.first_name} ${quickContactForm.last_name} added and assigned.` });
    setQuickContactOpen(false);
    setQuickContactForm({ first_name: "", last_name: "", job_title: "", email: "" });
  };

  const handleQuickCreateProject = async () => {
    if (!quickProjectForm.name.trim()) {
      toast({ title: "Project name is required", variant: "destructive" }); return;
    }
    const { data: newProject, error } = await (supabase.from as any)("crm_projects").insert({
      name: quickProjectForm.name,
      company_id: d.company_id || null,
      status: "active",
      project_type: quickProjectForm.project_type,
    }).select().single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await handleLinkProject((newProject as any).id);
    showConfirmation({ type: 'success', title: 'Project created', message: `"${quickProjectForm.name}" is ready in your Projects.` });
    setQuickProjectOpen(false);
    setQuickProjectForm({ name: deal.title, project_type: "consulting" });
  };

  const handleMarkSent = async (docId: string) => {
    try {
      await updateDoc.mutateAsync({ id: docId, status: "sent", sent_at: new Date().toISOString() } as any);
      toast({ title: "Marked as Sent" });
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const handleMarkSigned = async (docId: string) => {
    try {
      await updateDoc.mutateAsync({ id: docId, status: "signed", signed_at: new Date().toISOString() } as any);
      toast({ title: "Marked as Signed" });
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const handleDownload = async (fileUrl: string, title: string) => {
    const url = await getSignedDocumentUrl(fileUrl);
    if (url) window.open(url, "_blank");
    else toast({ title: "Failed to generate download link", variant: "destructive" });
  };

  // Build contact list with grouping
  const getGroupedContacts = () => {
    const search = contactSearch.toLowerCase().trim();
    const companyFiltered = companyContacts.filter(c =>
      !search || `${c.first_name} ${c.last_name} ${c.job_title ?? ""}`.toLowerCase().includes(search)
    );
    const companyIds = new Set(companyFiltered.map(c => c.id));
    const otherContacts = allContacts.filter(c => !companyIds.has(c.id));
    return { companyFiltered, otherContacts };
  };

  const { companyFiltered, otherContacts } = getGroupedContacts();
  const companyName = deal.crm_companies?.name;

  // Next stage
  const nextStageIdx = currentStageIdx + 1;
  const nextStage = nextStageIdx < STAGES.length ? STAGES[nextStageIdx] : null;
  const isTerminal = d.stage === "won" || d.stage === "lost" || d.stage === "placed";

  return (
    <div className="h-full overflow-y-auto overflow-x-auto bg-background">
    <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground px-2 py-1 -ml-2 rounded-md transition-all duration-150 hover:bg-accent border-l-2 border-transparent hover:border-primary group">
          <ChevronLeft className="h-4 w-4 transition-transform duration-150 group-hover:-translate-x-0.5" />
          Back
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{deal.title}</h1>
            <Badge variant="secondary" className={DEAL_STATUS_COLORS[deal.status]}>{DEAL_STATUS_LABELS[deal.status]}</Badge>
            <span className="text-lg font-semibold text-foreground">{currencySymbol}{deal.value.toLocaleString()}</span>
          </div>
          {companyName && (
            <span className="text-sm text-primary cursor-pointer hover:underline" onClick={() => navigate(`/crm/companies/${deal.crm_companies!.id}`)}>
              {companyName} <ExternalLink className="inline h-3 w-3" />
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {perm.canSeeDeleteOption && (
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-1" /> {perm.canDeleteDirectly ? "Delete" : "Request deletion"}
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
          {/* ── Pipeline Position ── */}
          <Card>
            <CardContent className="py-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pipeline Position</p>
              <SharedPipelineChevron
                mode="progress"
                currentStage={d.stage}
                onStageSelect={(stage) => handleStageChange(stage)}
                dealTitle={deal.title}
                showCounts={false}
                showValues={false}
              />
              {isTerminal && (
                <div className="flex justify-end mt-3">
                  <Badge className={d.stage === "won" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}>
                    {d.stage === "won" ? "✓ Won" : "✗ Lost"}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Financial Summary ── */}
          <Card>
            <CardContent className="py-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Financial Summary</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Deal Value</span><p className="text-lg font-bold">{currencySymbol}{deal.value.toLocaleString()}</p></div>
                <div><span className="text-muted-foreground">Probability</span><p className="text-lg font-bold">{d.probability ?? 0}%</p></div>
                <div><span className="text-muted-foreground">Weighted Value</span><p className="text-lg font-bold">{currencySymbol}{Math.round(deal.value * (d.probability ?? 0) / 100).toLocaleString()}</p></div>
                <div><span className="text-muted-foreground">Invoiced</span><p className="text-lg font-bold">{currencySymbol}{invoices.reduce((s, inv) => s + (inv.total || 0), 0).toLocaleString()}</p></div>
              </div>
            </CardContent>
          </Card>

          {/* ── Company Section ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2 border-b border-border pb-2">
                <Building2 className="w-4 h-4" /> Company
              </CardTitle>
            </CardHeader>
            <CardContent>
              {d.company_id && deal.crm_companies ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-primary cursor-pointer hover:underline" onClick={() => navigate(`/crm/companies/${deal.crm_companies!.id}`)}>
                    {deal.crm_companies.name} <ExternalLink className="inline h-3 w-3" />
                  </span>
                  <Popover open={companyPopoverOpen} onOpenChange={(v) => { setCompanyPopoverOpen(v); setCompanySearch(""); }}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-xs text-primary">Change</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-2 bg-popover z-[9999]" align="end">
                      <Input placeholder="Search companies..." value={companySearch} onChange={e => setCompanySearch(e.target.value)} className="h-8 text-xs mb-2" autoFocus />
                      <div className="max-h-60 overflow-y-auto space-y-0.5">
                        {availableCompanies.map(c => (
                          <button key={c.id} onClick={() => handleAssignCompany(c.id)}
                            className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted truncate">
                            {c.name}{c.industry ? ` · ${c.industry}` : ""}
                          </button>
                        ))}
                        {availableCompanies.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1">No companies found</p>}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium border", BADGE_SEVERITY_STYLES.red)}>
                    <AlertTriangle className="w-3 h-3" /> No company assigned
                  </span>
                  <Popover open={companyPopoverOpen} onOpenChange={(v) => { setCompanyPopoverOpen(v); setCompanySearch(""); }}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="text-xs gap-1"><Building2 className="w-3 h-3" /> Assign Company</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-2 bg-popover z-[9999]" align="start">
                      <Input placeholder="Search companies..." value={companySearch} onChange={e => setCompanySearch(e.target.value)} className="h-8 text-xs mb-2" autoFocus />
                      <div className="max-h-60 overflow-y-auto space-y-0.5">
                        {availableCompanies.map(c => (
                          <button key={c.id} onClick={() => handleAssignCompany(c.id)}
                            className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted truncate">
                            {c.name}{c.industry ? ` · ${c.industry}` : ""}
                          </button>
                        ))}
                        {availableCompanies.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1">No companies found</p>}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Contact Section ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2 border-b border-border pb-2">
                <User className="w-4 h-4" /> Contact
              </CardTitle>
            </CardHeader>
            <CardContent>
              {d.contact_id && currentContact ? (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-primary cursor-pointer hover:underline" onClick={() => navigate(`/crm/contacts/${currentContact.id}`)}>{currentContact.first_name} {currentContact.last_name}</span>
                    {currentContact.job_title && <p className="text-xs text-muted-foreground">{currentContact.job_title}</p>}
                  </div>
                  <Popover open={contactPopoverOpen} onOpenChange={(v) => { setContactPopoverOpen(v); setContactSearch(""); }}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-xs text-primary">Change</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-2 bg-popover z-[9999]" align="end">
                      <Input placeholder="Search contacts..." value={contactSearch} onChange={e => setContactSearch(e.target.value)} className="h-8 text-xs mb-2" autoFocus />
                      <ContactSearchResults companyContacts={companyFiltered} otherContacts={otherContacts} companyName={companyName} onSelect={handleAssignContact} />
                      <QuickAddContactFooter companyName={companyName} onOpen={() => { setContactPopoverOpen(false); setQuickContactOpen(true); }} />
                    </PopoverContent>
                  </Popover>
                </div>
              ) : (
                <div className="space-y-2">
                  {!d.company_id && (
                    <p className="text-xs text-muted-foreground italic">Assign a company first to see their contacts</p>
                  )}
                  <div className="flex items-center gap-3">
                    {(() => {
                      const sev = getContactBadgeSeverity(d.stage || "lead");
                      return (
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium border", BADGE_SEVERITY_STYLES[sev])}>
                          {sev === "grey" ? "ℹ" : <AlertTriangle className="w-3 h-3" />} No contact assigned
                        </span>
                      );
                    })()}
                    <Popover open={contactPopoverOpen} onOpenChange={(v) => { setContactPopoverOpen(v); setContactSearch(""); }}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="text-xs gap-1"><User className="w-3 h-3" /> Assign Contact</Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-2 bg-popover z-[9999]" align="start">
                        {!d.company_id && (
                          <p className="text-xs text-amber-500 mb-2 px-1">Tip: assign a company first to filter contacts automatically. Or search all contacts below:</p>
                        )}
                        <Input placeholder="Search contacts..." value={contactSearch} onChange={e => setContactSearch(e.target.value)} className="h-8 text-xs mb-2" autoFocus />
                        <ContactSearchResults companyContacts={companyFiltered} otherContacts={otherContacts} companyName={companyName} onSelect={handleAssignContact} />
                        <QuickAddContactFooter companyName={companyName} onOpen={() => { setContactPopoverOpen(false); setQuickContactOpen(true); }} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}

              {/* Quick-add contact form */}
              {quickContactOpen && (
                <div className="mt-3 border border-border rounded-lg p-3 bg-muted/30 space-y-2">
                  <p className="text-xs font-semibold">Quick add contact{companyName ? ` to ${companyName}` : ""}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="First name *" value={quickContactForm.first_name} onChange={e => setQuickContactForm(f => ({ ...f, first_name: e.target.value }))} className="h-8 text-xs" />
                    <Input placeholder="Last name *" value={quickContactForm.last_name} onChange={e => setQuickContactForm(f => ({ ...f, last_name: e.target.value }))} className="h-8 text-xs" />
                  </div>
                  <Input placeholder="Job title" value={quickContactForm.job_title} onChange={e => setQuickContactForm(f => ({ ...f, job_title: e.target.value }))} className="h-8 text-xs" />
                  <Input placeholder="Email" value={quickContactForm.email} onChange={e => setQuickContactForm(f => ({ ...f, email: e.target.value }))} className="h-8 text-xs" />
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setQuickContactOpen(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleQuickAddContact}>Add</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Candidate Section ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2 border-b border-border pb-2">
                <User className="w-4 h-4" /> Candidate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Search your talent database to link the placed candidate to this deal.</p>
                <CandidateSearchInline
                  dealId={deal.id}
                  onLinked={() => queryClient.invalidateQueries({ queryKey: ["crm_deals", deal.id] })}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Project Section ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2 border-b border-border pb-2">
                <FolderOpen className="w-4 h-4" /> Project
              </CardTitle>
            </CardHeader>
            <CardContent>
              {d.project_id && currentProject ? (
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
                      <Input placeholder="Search projects..." value={projectSearch} onChange={e => setProjectSearch(e.target.value)} className="h-8 text-xs mb-2" autoFocus />
                      <div className="max-h-60 overflow-y-auto space-y-0.5">
                        {availableProjects.map(p => (
                          <button key={p.id} onClick={() => handleLinkProject(p.id)}
                            className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted truncate">{p.name}</button>
                        ))}
                        {availableProjects.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1">No projects found</p>}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    {(() => {
                      const sev = getProjectBadgeSeverity(d.stage || "lead");
                      return (
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium border", BADGE_SEVERITY_STYLES[sev])}>
                          {sev === "grey" ? "ℹ" : sev === "red" ? <AlertTriangle className="w-3 h-3" /> : "!"} No project linked
                        </span>
                      );
                    })()}
                    <Popover open={projectPopoverOpen} onOpenChange={(v) => { setProjectPopoverOpen(v); setProjectSearch(""); }}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="text-xs gap-1"><FolderOpen className="w-3 h-3" /> Link Project</Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-2 bg-popover z-[9999]" align="start">
                        <Input placeholder="Search projects..." value={projectSearch} onChange={e => setProjectSearch(e.target.value)} className="h-8 text-xs mb-2" autoFocus />
                        <div className="max-h-60 overflow-y-auto space-y-0.5">
                          {availableProjects.map(p => (
                            <button key={p.id} onClick={() => handleLinkProject(p.id)}
                              className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted truncate">{p.name}</button>
                          ))}
                          {availableProjects.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1">No projects found</p>}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => { setQuickProjectForm({ name: deal.title, project_type: "consulting" }); setQuickProjectOpen(true); }}>
                      <Plus className="w-3 h-3" /> Create New Project
                    </Button>
                  </div>

                  {/* Quick-create project form */}
                  {quickProjectOpen && (
                    <div className="border border-border rounded-lg p-3 bg-muted/30 space-y-2">
                      <p className="text-xs font-semibold">Create new project</p>
                      <Input placeholder="Project name *" value={quickProjectForm.name} onChange={e => setQuickProjectForm(f => ({ ...f, name: e.target.value }))} className="h-8 text-xs" />
                      <div>
                        <Label className="text-xs">Type</Label>
                        <div className="flex gap-1 mt-1">
                          {["consulting", "recruitment", "managed"].map(t => (
                            <Button key={t} size="sm" variant={quickProjectForm.project_type === t ? "default" : "outline"} className="text-xs capitalize h-7"
                              onClick={() => setQuickProjectForm(f => ({ ...f, project_type: t }))}>{t}</Button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setQuickProjectOpen(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleQuickCreateProject}>Create & Link</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Engagement / Delivery ── */}
          {d.engagement_id && engagement ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2 border-b border-border pb-2"><Briefcase className="w-4 h-4" /> Delivery Project</CardTitle>
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
          ) : null}
          {d.stage === "won" && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardContent className="py-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-sm font-semibold text-amber-400">Deal Won — next steps</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Convert to a placement to track timesheets and invoices, or create a delivery project for consulting work.
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" className="gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-medium"
                      onClick={() => setPlacementOpen(true)}>
                      <Users className="w-3.5 h-3.5" /> Convert to Placement
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Briefcase className="w-3.5 h-3.5" /> Create Delivery Project
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {d.stage === "placed" && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-400 mb-0.5">✓ Active Placement</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      This deal has been converted to a placement. A draft invoice has been created — log timesheet days then approve and send it.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        className="gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-medium text-xs h-7"
                        onClick={() => navigate("/home")}
                      >
                        <Clock className="w-3 h-3" /> Log Timesheet
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-amber-500/30 text-amber-400 text-xs h-7"
                        onClick={() => navigate("/accounts")}
                      >
                        <FileText className="w-3 h-3" /> View Invoice
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Dates & Info ── */}
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
        </TabsContent>

        {/* ── Documents Tab (unchanged) ── */}
        <TabsContent value="documents">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4 mr-1" /> Upload Document</Button>
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
                          <FileText className="h-4 w-4 text-muted-foreground" />{doc.title}
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

        {/* ── Invoices Tab (unchanged) ── */}
        <TabsContent value="invoices">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setInvoiceOpen(true)}><Plus className="h-4 w-4 mr-1" /> Create Invoice</Button>
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

        {/* ── Activity Tab (unchanged) ── */}
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
    </div>
  );
}

/* ── Contact search results with grouping ── */
function ContactSearchResults({ companyContacts, otherContacts, companyName, onSelect }: {
  companyContacts: any[]; otherContacts: any[]; companyName?: string | null; onSelect: (id: string) => void;
}) {
  return (
    <div className="max-h-60 overflow-y-auto space-y-0.5">
      {companyContacts.length > 0 && (
        <>
          {companyName && <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-1">At {companyName}</p>}
          {companyContacts.map(c => (
            <button key={c.id} onClick={() => onSelect(c.id)}
              className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted truncate">
              {c.first_name} {c.last_name}{c.job_title ? ` · ${c.job_title}` : ""}
            </button>
          ))}
        </>
      )}
      {otherContacts.length > 0 && (
        <>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-2">Other contacts</p>
          {otherContacts.map((c: any) => (
            <button key={c.id} onClick={() => onSelect(c.id)}
              className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted truncate">
              {c.first_name} {c.last_name}{c.job_title ? ` · ${c.job_title}` : ""}
              {c.crm_companies?.name ? <span className="text-muted-foreground ml-1">({c.crm_companies.name})</span> : ""}
            </button>
          ))}
        </>
      )}
      {companyContacts.length === 0 && otherContacts.length === 0 && (
        <p className="text-xs text-muted-foreground px-2 py-1">No contacts found</p>
      )}
    </div>
  );
}

function QuickAddContactFooter({ companyName, onOpen }: { companyName?: string | null; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full text-left px-2 py-2 text-xs text-primary hover:bg-muted rounded mt-1 border-t border-border font-medium"
    >
      <Plus className="w-3 h-3 inline mr-1" />
      Add new contact{companyName ? ` to ${companyName}` : ""}
    </button>
  );
}

function CandidateSearchInline({ dealId, onLinked }: { dealId: string; onLinked: () => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [linked, setLinked] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase.from("candidates" as any).select("id, name, current_title").ilike("name", `%${search}%`).limit(8);
      setResults(data || []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  if (linked) {
    return (
      <div className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/30">
        <div>
          <p className="text-sm font-medium">{linked.name}</p>
          <p className="text-xs text-muted-foreground">{linked.current_title || "—"}</p>
        </div>
        <Button size="sm" variant="ghost" className="text-xs" onClick={() => setLinked(null)}>Change</Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Input placeholder="Search candidates..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-xs" />
      {loading && <p className="text-xs text-muted-foreground px-1">Searching...</p>}
      {results.map(c => (
        <button key={c.id} onClick={() => setLinked(c)}
          className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted border border-border flex items-center justify-between">
          <span className="font-medium">{c.name}</span>
          <span className="text-muted-foreground">{c.current_title || "—"}</span>
        </button>
      ))}
      {search && !loading && results.length === 0 && <p className="text-xs text-muted-foreground px-1">No candidates found</p>}
    </div>
  );
}
