import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageBackButton } from "@/components/ui/page-back-button";
import {
  FileText, Plus, Search, Upload, Download, Eye, Pencil, Trash2,
  Building2, Calendar, Loader2, MoreHorizontal, Filter, Shield, AlertTriangle,
} from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/* ─── Constants ─── */
const DOC_TYPES = [
  { value: "sow", label: "SOW", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "msa", label: "MSA", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "proposal", label: "Proposal", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  { value: "rfp", label: "RFP / Bid", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { value: "contract", label: "Contract", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "nda", label: "NDA", color: "bg-muted text-muted-foreground" },
  { value: "other", label: "Other", color: "bg-muted text-muted-foreground" },
];

const DOC_STATUSES = [
  { value: "draft", label: "Draft", color: "bg-muted text-muted-foreground" },
  { value: "sent", label: "Sent", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "under_review", label: "Under Review", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  { value: "signed", label: "Signed", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "active", label: "Active", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "expired", label: "Expired", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  { value: "cancelled", label: "Cancelled", color: "bg-muted text-muted-foreground" },
];

const getDocTypeConfig = (t: string) => DOC_TYPES.find(d => d.value === t) || DOC_TYPES[6];
const getDocStatusConfig = (s: string) => DOC_STATUSES.find(d => d.value === s) || DOC_STATUSES[0];

/* ─── Slide-in panel ─── */
function SlideInPanel({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent className="sm:max-w-[520px] overflow-y-auto flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Upload and manage commercial documents</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">{children}</div>
        {footer && (
          <div className="sticky bottom-0 border-t border-border bg-background px-6 py-5 pb-20 flex items-center justify-between gap-2">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ─── Main Page ─── */
export default function DocumentsHub() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const wsId = currentWorkspace?.id;

  const { isAdmin } = usePermissions();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<any>(null);
  const [confirmUpload, setConfirmUpload] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteReason, setDeleteReason] = useState("");

  // Form state
  const [formType, setFormType] = useState("sow");
  const [formName, setFormName] = useState("");
  const [formCompanyId, setFormCompanyId] = useState("");
  const [formContactId, setFormContactId] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formCurrency, setFormCurrency] = useState("GBP");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formSignedDate, setFormSignedDate] = useState("");
  const [formStatus, setFormStatus] = useState("draft");
  const [formNotes, setFormNotes] = useState("");
  const [formFile, setFormFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch documents
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["commercial_documents", wsId],
    queryFn: async () => {
      if (!wsId) return [];
      const { data, error } = await supabase
        .from("commercial_documents" as any)
        .select("*, companies(id, name), contacts(id, name)")
        .eq("workspace_id", wsId)
        .order("created_at", { ascending: false });
      if (error) { console.error("commercial_documents error:", error); return []; }
      return data || [];
    },
    enabled: !!wsId,
  });

  // Fetch companies for dropdown
  const { data: companies = [] } = useQuery({
    queryKey: ["companies-list", wsId],
    queryFn: async () => {
      if (!wsId) return [];
      const { data } = await supabase.from("companies").select("id, name").eq("team_id", wsId).order("name");
      return data || [];
    },
    enabled: !!wsId,
  });

  // Fetch contacts for dropdown
  const { data: contactsList = [] } = useQuery({
    queryKey: ["contacts-for-doc", formCompanyId],
    queryFn: async () => {
      if (!formCompanyId) return [];
      const { data } = await supabase.from("contacts").select("id, name").eq("company_id", formCompanyId).is("deleted_at", null).order("name");
      return data || [];
    },
    enabled: !!formCompanyId,
  });

  const filtered = useMemo(() => {
    return (docs as any[]).filter((d: any) => {
      if (filterType !== "all" && d.type !== filterType) return false;
      if (filterStatus !== "all" && d.status !== filterStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        const name = (d.name || "").toLowerCase();
        const company = (d.companies?.name || "").toLowerCase();
        if (!name.includes(s) && !company.includes(s)) return false;
      }
      return true;
    });
  }, [docs, filterType, filterStatus, search]);

  const resetForm = () => {
    setFormType("sow"); setFormName(""); setFormCompanyId(""); setFormContactId("");
    setFormValue(""); setFormCurrency("GBP"); setFormStartDate(""); setFormEndDate("");
    setFormSignedDate(""); setFormStatus("draft"); setFormNotes(""); setFormFile(null);
    setEditDoc(null);
  };

  const openUpload = (doc?: any) => {
    if (doc) {
      setEditDoc(doc);
      setFormType(doc.type); setFormName(doc.name); setFormCompanyId(doc.company_id || "");
      setFormContactId(doc.contact_id || ""); setFormValue(doc.value ? String(doc.value) : "");
      setFormCurrency(doc.currency || "GBP"); setFormStartDate(doc.start_date || "");
      setFormEndDate(doc.end_date || ""); setFormSignedDate(doc.signed_date || "");
      setFormStatus(doc.status); setFormNotes(doc.notes || "");
    } else {
      resetForm();
    }
    setUploadOpen(true);
  };

  const initiateUpload = () => {
    if (!formName.trim()) { toast.error("Document name is required"); return; }
    if (!wsId) return;
    if (editDoc) {
      performSave();
    } else {
      setConfirmUpload(true);
    }
  };

  const performSave = async () => {
    if (!wsId) return;
    setSaving(true);
    try {
      let fileUrl = editDoc?.file_url || null;
      let fileName = editDoc?.file_name || null;

      if (formFile) {
        const path = `${wsId}/${formType}/${Date.now()}_${formFile.name}`;
        const { error: uploadErr } = await supabase.storage.from("commercial-documents").upload(path, formFile, { upsert: false });
        if (uploadErr) throw uploadErr;
        fileUrl = path;
        fileName = formFile.name;
      }

      const payload: any = {
        workspace_id: wsId,
        type: formType,
        name: formName.trim(),
        company_id: formCompanyId || null,
        contact_id: formContactId || null,
        value: formValue ? parseFloat(formValue) : 0,
        currency: formCurrency,
        start_date: formStartDate || null,
        end_date: formEndDate || null,
        signed_date: formSignedDate || null,
        status: formStatus,
        file_url: fileUrl,
        file_name: fileName,
        notes: formNotes || null,
      };

      if (editDoc) {
        const { error } = await supabase.from("commercial_documents" as any).update(payload).eq("id", editDoc.id);
        if (error) throw error;
        toast.success("Document updated");
      } else {
        const { error } = await supabase.from("commercial_documents" as any).insert(payload);
        if (error) throw error;
        toast.success("Document uploaded");
      }

      queryClient.invalidateQueries({ queryKey: ["commercial_documents"] });
      setUploadOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Failed to save document");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (isAdmin) {
        const { error } = await supabase.from("commercial_documents" as any).delete().eq("id", deleteTarget.id);
        if (error) throw error;
        toast.success("Document permanently deleted");
      } else {
        const { error } = await supabase.from("commercial_documents" as any).update({
          deleted_at: new Date().toISOString(),
          deleted_by: (await supabase.auth.getUser()).data.user?.id || null,
          deletion_reason: deleteReason || "Requested for removal",
        }).eq("id", deleteTarget.id);
        if (error) throw error;
        toast.success("Deletion requested — awaiting admin approval");
      }
      queryClient.invalidateQueries({ queryKey: ["commercial_documents"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to process deletion");
    } finally {
      setDeleteTarget(null);
      setDeleteReason("");
    }
  };

  const handleDownload = async (doc: any) => {
    if (!doc.file_url) { toast.error("No file attached"); return; }
    const { data, error } = await supabase.storage.from("commercial-documents").createSignedUrl(doc.file_url, 3600);
    if (error || !data?.signedUrl) { toast.error("Failed to get download link"); return; }
    window.open(data.signedUrl, "_blank");
  };

  // End date warning
  const endDateWarning = formEndDate ? (() => {
    const days = differenceInDays(parseISO(formEndDate), new Date());
    if (days < 30 && days >= 0) return `⚠️ End date is ${days} days away`;
    return null;
  })() : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6">
        <PageBackButton />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Documents</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Commercial & legal document repository</p>
          </div>
          <Button className="gap-1.5" onClick={() => openUpload()}>
            <Plus className="w-4 h-4" /> Upload Document
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px]"><Filter className="w-3 h-3 mr-1" /><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {DOC_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {DOC_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Documents Table */}
        {isLoading ? (
          <Card className="border border-border rounded-xl"><CardContent className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></CardContent></Card>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-center justify-center text-center p-12 border border-border rounded-xl">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-sm font-semibold text-foreground">No documents found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">Upload SOWs, contracts, proposals and other commercial documents.</p>
            <Button className="mt-4 gap-1.5" onClick={() => openUpload()}><Plus className="w-3.5 h-3.5" /> Upload Document</Button>
          </Card>
        ) : (
          <Card className="border border-border rounded-xl overflow-hidden" style={{ borderLeft: '4px solid hsl(var(--primary))' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Document Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Value</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Start</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">End</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((doc: any, i: number) => {
                    const typeConf = getDocTypeConfig(doc.type);
                    const statusConf = getDocStatusConfig(doc.status);
                    const endDays = doc.end_date ? differenceInDays(parseISO(doc.end_date), new Date()) : null;
                    return (
                      <tr key={doc.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${i % 2 === 1 ? "bg-muted/10" : ""}`}>
                        <td className="px-4 py-3">
                          <span className="font-medium text-foreground">{doc.name}</span>
                          {doc.deleted_at && <Badge className="ml-2 text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-0">⚠ Deletion Requested</Badge>}
                          {doc.file_name && <p className="text-xs text-muted-foreground mt-0.5">{doc.file_name}</p>}
                        </td>
                        <td className="px-4 py-3"><Badge className={`text-xs ${typeConf.color} border-0`}>{typeConf.label}</Badge></td>
                        <td className="px-4 py-3 text-muted-foreground">{doc.companies?.name || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{doc.value > 0 ? `${doc.currency} ${Number(doc.value).toLocaleString()}` : "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{doc.start_date ? format(parseISO(doc.start_date), "dd MMM yyyy") : "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs ${endDays !== null && endDays <= 30 && endDays >= 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                            {doc.end_date ? format(parseISO(doc.end_date), "dd MMM yyyy") : "—"}
                          </span>
                          {endDays !== null && endDays <= 30 && endDays >= 0 && <p className="text-[10px] text-destructive">{endDays}d remaining</p>}
                        </td>
                        <td className="px-4 py-3"><Badge className={`text-xs ${statusConf.color} border-0`}>{statusConf.label}</Badge></td>
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {doc.file_url && <DropdownMenuItem onClick={() => handleDownload(doc)}><Download className="w-3.5 h-3.5 mr-2" /> Download</DropdownMenuItem>}
                              <DropdownMenuItem onClick={() => openUpload(doc)}><Pencil className="w-3.5 h-3.5 mr-2" /> Edit Details</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(doc.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5 mr-2" /> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
              Showing {filtered.length} of {(docs as any[]).length} documents
            </div>
          </Card>
        )}
      </div>

      {/* Upload/Edit Panel */}
      <SlideInPanel
        open={uploadOpen}
        onClose={() => { setUploadOpen(false); resetForm(); }}
        title={editDoc ? `Edit — ${formName || "Document"}` : "Upload Document"}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setUploadOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editDoc ? "Save Changes" : "Upload & Save"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-medium">Document Type <span className="text-destructive">*</span></Label>
            <Select value={formType} onValueChange={setFormType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DOC_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-medium">Document Name <span className="text-destructive">*</span></Label>
            <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. LSEG Technology SOW Q1 2026" />
          </div>
          <div>
            <Label className="text-xs font-medium">Company</Label>
            <Select value={formCompanyId} onValueChange={setFormCompanyId}>
              <SelectTrigger><SelectValue placeholder="Select company..." /></SelectTrigger>
              <SelectContent>
                {companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {formCompanyId && contactsList.length > 0 && (
            <div>
              <Label className="text-xs font-medium">Signatory Contact</Label>
              <Select value={formContactId} onValueChange={setFormContactId}>
                <SelectTrigger><SelectValue placeholder="Select contact..." /></SelectTrigger>
                <SelectContent>
                  {contactsList.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Value</Label>
              <Input type="number" value={formValue} onChange={e => setFormValue(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label className="text-xs font-medium">Currency</Label>
              <Select value={formCurrency} onValueChange={setFormCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Start Date</Label>
              <Input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-medium">End Date</Label>
              <Input type="date" value={formEndDate} onChange={e => setFormEndDate(e.target.value)} />
              {endDateWarning && <p className="text-xs text-destructive mt-1">{endDateWarning}</p>}
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium">Signed Date</Label>
            <Input type="date" value={formSignedDate} onChange={e => setFormSignedDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs font-medium">Status</Label>
            <Select value={formStatus} onValueChange={setFormStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DOC_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-medium">Notes</Label>
            <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={3} placeholder="Additional notes..." />
          </div>
          <div>
            <Label className="text-xs font-medium">File Upload</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
              <input type="file" className="hidden" id="doc-file-input"
                accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
                onChange={e => setFormFile(e.target.files?.[0] || null)} />
              <label htmlFor="doc-file-input" className="cursor-pointer">
                <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                {formFile ? (
                  <p className="text-sm font-medium text-foreground">{formFile.name}</p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, XLSX, PNG, JPG (max 25MB)</p>
                  </>
                )}
              </label>
            </div>
          </div>
        </div>
      </SlideInPanel>
    </div>
  );
}
