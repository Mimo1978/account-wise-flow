import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { Contact } from "@/lib/types";
import { usePermissions } from "@/hooks/use-permissions";
import { AccountCanvas } from "@/components/canvas/AccountCanvas";
import { useOrgChartTree } from "@/hooks/use-org-chart-tree";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft, Building2, Globe, MapPin, Phone, Users, Network,
  Pencil, Plus, TrendingUp, User, Mail, Clock, FileText, Activity,
  ChevronDown, ExternalLink, DollarSign, Calendar, StickyNote,
  AlertTriangle, CheckCircle2, Info, Loader2, Flag, BookOpen,
  CalendarClock, Shield, X, PartyPopper, XCircle, Trash2,
  Search, Upload, Download, MoreHorizontal,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DeleteRecordModal } from "@/components/deletion/DeleteRecordModal";
import { DeletionRequestBanner } from "@/components/deletion/DeletionRequestBanner";
import { useDeletionPermission } from "@/hooks/use-deletion";

/* ─── helpers ─── */
const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
};
const fmtDateShort = (d?: string | null) => {
  if (!d) return "—";
  try { return format(parseISO(d), "d MMM"); } catch { return d; }
};
const daysAgo = (d?: string | null) => {
  if (!d) return null;
  try { return differenceInDays(new Date(), parseISO(d)); } catch { return null; }
};

const DOC_TYPES = [
  { value: "sow", label: "SOW" },
  { value: "msa", label: "MSA" },
  { value: "proposal", label: "Proposal" },
  { value: "rfp", label: "RFP / Bid" },
  { value: "contract", label: "Contract" },
  { value: "nda", label: "NDA" },
  { value: "other", label: "Other" },
];

const DOC_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "under_review", label: "Under Review" },
  { value: "signed", label: "Signed" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];

  { value: "cold", label: "Cold", color: "bg-muted text-muted-foreground" },
  { value: "warm", label: "Warm", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "hot", label: "Hot", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  { value: "client", label: "Client", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "prospect", label: "Prospect", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  { value: "dormant", label: "Dormant", color: "bg-muted text-muted-foreground italic" },
];
const getStatusConfig = (s?: string) => STATUS_OPTIONS.find(o => o.value === s) || STATUS_OPTIONS[0];

const INDUSTRY_OPTIONS = [
  "Technology", "Financial Services", "Healthcare", "Manufacturing",
  "Retail", "Professional Services", "Consulting", "Energy",
  "Telecommunications", "Education", "Real Estate", "Media", "Other",
];

const ACCOUNT_FLAGS = [
  { value: "do_not_contact", label: "Do Not Contact", icon: Shield, color: "text-red-600" },
  { value: "legal_hold", label: "Legal Hold", icon: Shield, color: "text-amber-600" },
  { value: "in_negotiation", label: "In Negotiation", icon: BookOpen, color: "text-blue-600" },
  { value: "vip_account", label: "VIP Account", icon: Flag, color: "text-purple-600" },
  { value: "dormant", label: "Dormant", icon: Clock, color: "text-muted-foreground" },
];

const PIPELINE_STAGES = [
  { value: "lead", label: "Lead" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const STAGE_COLORS: Record<string, string> = {
  lead: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  qualified: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  proposal: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  negotiation: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  won: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  lost: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  complete: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

/* ══════════════════════════════════════════════════════════════════
   REUSABLE SLIDE-IN PANEL — 520px, sticky footer, pb-20
   ══════════════════════════════════════════════════════════════════ */
function SlideInPanel({ open, onClose, title, subtitle, children, footer }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent className="sm:max-w-[520px] overflow-y-auto flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle>{title}{subtitle ? ` — ${subtitle}` : ""}</SheetTitle>
          {subtitle && <SheetDescription>{subtitle}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {children}
        </div>
        {footer && (
          <div className="sticky bottom-0 border-t border-border bg-background px-6 py-5 pb-20 flex items-center justify-between gap-2">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ─── Company Documents Section ─── */
const DOC_TYPE_BADGES: Record<string, { label: string; color: string }> = {
  sow: { label: "SOW", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  msa: { label: "MSA", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  proposal: { label: "Proposal", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  rfp: { label: "RFP", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  contract: { label: "Contract", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  nda: { label: "NDA", color: "bg-muted text-muted-foreground" },
  other: { label: "Other", color: "bg-muted text-muted-foreground" },
};
const DOC_STATUS_BADGES: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
  sent: { label: "Sent", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  under_review: { label: "Under Review", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  signed: { label: "Signed", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  active: { label: "Active", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  expired: { label: "Expired", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  cancelled: { label: "Cancelled", color: "bg-muted text-muted-foreground" },
};
function CompanyDocumentsSection({ docs, companyName, companyId, workspaceId }: { docs: any[]; companyName: string; companyId: string; workspaceId: string }) {
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [editDoc, setEditDoc] = useState<any>(null);

  // Upload form state
  const [formType, setFormType] = useState("sow");
  const [formName, setFormName] = useState("");
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
  const [dragActive, setDragActive] = useState(false);

  // Contacts for this company
  const { data: contactsList = [] } = useQuery({
    queryKey: ["contacts-for-company-docs", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, name").eq("company_id", companyId).is("deleted_at", null).order("name");
      return data || [];
    },
    enabled: !!companyId,
  });

  const resetForm = () => {
    setFormType("sow"); setFormName(""); setFormContactId("");
    setFormValue(""); setFormCurrency("GBP"); setFormStartDate(""); setFormEndDate("");
    setFormSignedDate(""); setFormStatus("draft"); setFormNotes(""); setFormFile(null);
    setEditDoc(null);
  };

  const openUpload = (doc?: any) => {
    if (doc) {
      setEditDoc(doc);
      setFormType(doc.type); setFormName(doc.name);
      setFormContactId(doc.contact_id || "");
      setFormValue(doc.value ? String(doc.value) : "");
      setFormCurrency(doc.currency || "GBP"); setFormStartDate(doc.start_date || "");
      setFormEndDate(doc.end_date || ""); setFormSignedDate(doc.signed_date || "");
      setFormStatus(doc.status); setFormNotes(doc.notes || "");
    } else {
      resetForm();
    }
    setUploadOpen(true);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      const file = e.dataTransfer.files[0];
      const maxSize = 25 * 1024 * 1024;
      if (file.size > maxSize) {
        toast({ title: "File too large", description: "Maximum file size is 25MB", variant: "destructive" });
        return;
      }
      setFormFile(file);
      if (!formName) setFormName(file.name.replace(/\.[^.]+$/, ""));
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast({ title: "Document name is required", variant: "destructive" }); return; }
    if (!formFile && !editDoc) { toast({ title: "Please attach a file", description: "Drag and drop or click to upload a document file", variant: "destructive" }); return; }
    setSaving(true);
    try {
      let fileUrl = editDoc?.file_url || null;
      let fileName = editDoc?.file_name || null;

      if (formFile) {
        const path = `${workspaceId}/${formType}/${Date.now()}_${formFile.name}`;
        const { error: uploadErr } = await supabase.storage.from("commercial-documents").upload(path, formFile, { upsert: false });
        if (uploadErr) throw uploadErr;
        fileUrl = path;
        fileName = formFile.name;
      }

      const payload: any = {
        workspace_id: workspaceId,
        type: formType,
        name: formName.trim(),
        company_id: companyId,
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
        toast({ title: "Document updated" });
      } else {
        const { error } = await supabase.from("commercial_documents" as any).insert(payload);
        if (error) throw error;
        toast({ title: "Document uploaded successfully" });
      }

      queryClient.invalidateQueries({ queryKey: ["company-commercial-docs", companyId] });
      queryClient.invalidateQueries({ queryKey: ["commercial_documents"] });
      setUploadOpen(false);
      resetForm();
    } catch (err: any) {
      toast({ title: "Failed to save document", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Delete this document?")) return;
    const { error } = await supabase.from("commercial_documents" as any).delete().eq("id", docId);
    if (error) { toast({ title: "Failed to delete", variant: "destructive" }); return; }
    toast({ title: "Document deleted" });
    queryClient.invalidateQueries({ queryKey: ["company-commercial-docs", companyId] });
    queryClient.invalidateQueries({ queryKey: ["commercial_documents"] });
  };

  const handleDownload = async (doc: any) => {
    if (!doc.file_url) { toast({ title: "No file attached", variant: "destructive" }); return; }
    const { data, error } = await supabase.storage.from("commercial-documents").createSignedUrl(doc.file_url, 3600);
    if (error || !data?.signedUrl) { toast({ title: "Failed to get download link", variant: "destructive" }); return; }
    window.open(data.signedUrl, "_blank");
  };

  // Filter docs
  const filtered = useMemo(() => {
    return docs.filter((d: any) => {
      if (filterType !== "all" && d.type !== filterType) return false;
      if (filterStatus !== "all" && d.status !== filterStatus) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        if (!(d.name || "").toLowerCase().includes(s) && !(d.file_name || "").toLowerCase().includes(s) && !(d.notes || "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [docs, filterType, filterStatus, searchTerm]);

  const endDateWarning = formEndDate ? (() => {
    const days = differenceInDays(parseISO(formEndDate), new Date());
    if (days < 30 && days >= 0) return `⚠️ End date is ${days} days away`;
    return null;
  })() : null;

  return (
    <div className="space-y-4">
      {/* Header with search, filters, and add button */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search documents..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {DOC_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {DOC_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" className="gap-1.5 ml-auto" onClick={() => openUpload()}>
          <Plus className="w-3.5 h-3.5" /> Add Document
        </Button>
      </div>

      {/* Document count */}
      <p className="text-xs text-muted-foreground">{filtered.length} of {docs.length} document{docs.length !== 1 ? "s" : ""}</p>

      {/* Documents list */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <FileText className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-3">{docs.length === 0 ? `No documents for ${companyName}` : "No documents match your filters"}</p>
          {docs.length === 0 && (
            <Button variant="outline" size="sm" onClick={() => openUpload()} className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Document</Button>
          )}
        </CardContent></Card>
      ) : (
        <Card className="border border-border rounded-xl overflow-hidden" style={{ borderLeft: '4px solid hsl(var(--primary))' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Document Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Value</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Start</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">End</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">File</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc: any, i: number) => {
                  const typeConf = DOC_TYPE_BADGES[doc.type] || DOC_TYPE_BADGES.other;
                  const statusConf = DOC_STATUS_BADGES[doc.status] || DOC_STATUS_BADGES.draft;
                  const endDays = doc.end_date ? differenceInDays(parseISO(doc.end_date), new Date()) : null;
                  return (
                    <tr key={doc.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${i % 2 === 1 ? "bg-muted/10" : ""}`}>
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{doc.name}</span>
                        {doc.file_name && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">{doc.file_name}</p>}
                      </td>
                      <td className="px-4 py-3"><Badge className={`text-xs ${typeConf.color} border-0`}>{typeConf.label}</Badge></td>
                      <td className="px-4 py-3 text-muted-foreground">{doc.value > 0 ? `${doc.currency || "GBP"} ${Number(doc.value).toLocaleString()}` : "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{doc.start_date ? format(parseISO(doc.start_date), "dd MMM yyyy") : "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${endDays !== null && endDays <= 30 && endDays >= 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                          {doc.end_date ? format(parseISO(doc.end_date), "dd MMM yyyy") : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3"><Badge className={`text-xs ${statusConf.color} border-0`}>{statusConf.label}</Badge></td>
                      <td className="px-4 py-3">
                        {doc.file_url ? (
                          <Badge variant="outline" className="text-xs gap-1 cursor-pointer hover:bg-muted/50" onClick={() => handleDownload(doc)}>
                            <FileText className="w-3 h-3" /> Attached
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </td>
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
        </Card>
      )}

      {/* Upload / Edit Panel */}
      <Sheet open={uploadOpen} onOpenChange={v => { if (!v) { setUploadOpen(false); resetForm(); } }}>
        <SheetContent className={cn(
          "overflow-y-auto flex flex-col p-0 transition-all duration-200",
          fullScreen ? "sm:max-w-full w-full" : "sm:max-w-[620px]"
        )}>
          <SheetHeader className="px-6 pt-6 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle>{editDoc ? `Edit — ${formName || "Document"}` : `Upload Document — ${companyName}`}</SheetTitle>
                <SheetDescription>Attach a file and fill in document details for {companyName}</SheetDescription>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setFullScreen(!fullScreen)} title={fullScreen ? "Exit full screen" : "Full screen"}>
                {fullScreen ? <X className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
              </Button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className={cn("space-y-5", fullScreen && "max-w-3xl mx-auto")}>
              {/* File Upload Zone - REQUIRED */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  File Upload <span className="text-destructive">*</span>
                </Label>
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById("company-doc-file-input")?.click()}
                  className={cn(
                    "relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-all",
                    fullScreen ? "p-12" : "p-8",
                    dragActive ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-muted/30",
                    formFile && "border-green-500/50 bg-green-500/5"
                  )}
                >
                  <input
                    id="company-doc-file-input"
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) {
                        if (f.size > 25 * 1024 * 1024) {
                          toast({ title: "File too large", description: "Max 25MB", variant: "destructive" });
                          return;
                        }
                        setFormFile(f);
                        if (!formName) setFormName(f.name.replace(/\.[^.]+$/, ""));
                      }
                    }}
                  />
                  {formFile ? (
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-500/10">
                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{formFile.name}</p>
                        <p className="text-xs text-muted-foreground">{(formFile.size / 1024).toFixed(0)} KB · Click to change</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 ml-2" onClick={e => { e.stopPropagation(); setFormFile(null); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload className={cn("text-muted-foreground mb-3", fullScreen ? "h-12 w-12" : "h-8 w-8")} />
                      <p className="text-sm font-medium mb-1">Drag & drop your document here</p>
                      <p className="text-xs text-muted-foreground">or click to browse your computer</p>
                      <p className="text-xs text-muted-foreground mt-2">PDF, DOCX, XLSX, PNG, JPG — Max 25MB</p>
                    </>
                  )}
                </div>
              </div>

              <Separator />

              {/* Document details form */}
              <div className={cn("space-y-4", fullScreen && "grid grid-cols-2 gap-x-6 gap-y-4 space-y-0")}>
                <div className={fullScreen ? "col-span-1" : ""}>
                  <Label className="text-xs font-medium">Document Type <span className="text-destructive">*</span></Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DOC_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className={fullScreen ? "col-span-1" : ""}>
                  <Label className="text-xs font-medium">Document Name <span className="text-destructive">*</span></Label>
                  <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. LSEG Technology SOW Q1 2026" />
                </div>
                <div className={fullScreen ? "col-span-1" : ""}>
                  <Label className="text-xs font-medium">Company</Label>
                  <Input value={companyName} disabled className="bg-muted/50" />
                </div>
                {contactsList.length > 0 && (
                  <div className={fullScreen ? "col-span-1" : ""}>
                    <Label className="text-xs font-medium">Signatory Contact ({contactsList.length} available)</Label>
                    <Select value={formContactId} onValueChange={setFormContactId}>
                      <SelectTrigger><SelectValue placeholder="Select contact..." /></SelectTrigger>
                      <SelectContent>
                        {contactsList.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className={fullScreen ? "col-span-1" : ""}>
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
                </div>
                <div className={fullScreen ? "col-span-1" : ""}>
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
                </div>
                <div className={fullScreen ? "col-span-1" : ""}>
                  <Label className="text-xs font-medium">Signed Date</Label>
                  <Input type="date" value={formSignedDate} onChange={e => setFormSignedDate(e.target.value)} />
                </div>
                <div className={fullScreen ? "col-span-1" : ""}>
                  <Label className="text-xs font-medium">Status</Label>
                  <Select value={formStatus} onValueChange={setFormStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DOC_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className={fullScreen ? "col-span-2" : ""}>
                  <Label className="text-xs font-medium">Notes</Label>
                  <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={3} placeholder="Additional notes..." />
                </div>
              </div>
            </div>
          </div>

          {/* Sticky footer */}
          <div className="sticky bottom-0 border-t border-border bg-background px-6 py-5 pb-20 flex items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => { setUploadOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || (!formFile && !editDoc)}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editDoc ? "Save Changes" : "Upload & Save"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════════ */
export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isAdmin, isManager } = usePermissions();
  const canAssignOwner = isAdmin || isManager;
  const perm = useDeletionPermission();

  // Org chart hierarchy from org_chart_edges (single source of truth)
  const { nodes: orgNodes } = useOrgChartTree(id);

  const [editOpen, setEditOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [addDealOpen, setAddDealOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [addInvoiceOpen, setAddInvoiceOpen] = useState(false);
  const [logActivityOpen, setLogActivityOpen] = useState(false);
  const [logActivityType, setLogActivityType] = useState("note");
  const [editDealId, setEditDealId] = useState<string | null>(null);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [ownerPopoverOpen, setOwnerPopoverOpen] = useState(false);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // ── Fetch company (from companies table) ──
  const { data: rawCompany, isLoading } = useQuery({
    queryKey: ["companies", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from("companies").select("*").eq("id", id).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  // ── Auto-sync to crm_companies — find or create a matching CRM record ──
  const { data: crmCompanyId } = useQuery({
    queryKey: ["crm-company-sync", id, rawCompany?.name],
    queryFn: async () => {
      if (!id || !rawCompany) return null;
      const companyName = rawCompany.name;
      console.log("[CompanyDetail] Syncing crm_companies for:", companyName, "companies.id:", id);

      // First try to find existing crm_companies record by name
      const { data: existing } = await supabase
        .from("crm_companies").select("id")
        .eq("name", companyName).limit(1);

      if (existing && existing.length > 0) {
        console.log("[CompanyDetail] Found existing crm_companies record:", existing[0].id);
        return existing[0].id as string;
      }

      // Create one
      const { data: created, error } = await supabase
        .from("crm_companies").insert({
          name: companyName,
          industry: rawCompany.industry || null,
          website: rawCompany.website || null,
          phone: rawCompany.switchboard || null,
        }).select("id").single();

      if (error) {
        console.error("[CompanyDetail] Failed to create crm_companies record:", error);
        return null;
      }
      console.log("[CompanyDetail] Created crm_companies record:", created.id);
      return created.id as string;
    },
    enabled: !!id && !!rawCompany,
    staleTime: Infinity,
  });

  // ── Fetch contacts ──
  const { data: contacts = [] } = useQuery({
    queryKey: ["company-contacts", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("contacts").select("*")
        .eq("company_id", id).is("deleted_at", null).order("name");
      if (error) return [];
      return (data || []).map((c: any): Contact => ({
        id: c.id, name: c.name, title: c.title || "", department: c.department || "",
        seniority: c.seniority || "mid", email: c.email || "", phone: c.phone || "",
        status: (c.status as Contact["status"]) || "new", engagementScore: 50,
        location: c.location, lastContact: c.updated_at,
      }));
    },
    enabled: !!id,
  });

  // ── Fetch workspace users ──
  const { data: workspaceUsers = [] } = useQuery({
    queryKey: ["workspace-users", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await supabase.from("user_roles" as any).select("user_id, role").eq("team_id", currentWorkspace.id);
      if (error) return [];
      const userIds = (data || []).map((r: any) => r.user_id);
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles" as any).select("id, first_name, last_name").in("id", userIds);
      return (profiles || []).map((p: any) => ({
        id: p.id,
        name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "User",
      }));
    },
    enabled: !!currentWorkspace?.id,
  });

  // ── Fetch deals (using crm_company_id) ──
  const { data: deals = [] } = useQuery({
    queryKey: ["company-deals", crmCompanyId],
    queryFn: async () => {
      if (!crmCompanyId) return [];
      console.log("[CompanyDetail] Fetching deals for crm_company_id:", crmCompanyId);
      const { data, error } = await supabase
        .from("crm_deals" as any).select("*")
        .eq("company_id", crmCompanyId).order("created_at", { ascending: false });
      if (error) { console.error("[CompanyDetail] Deals query error:", error); return []; }
      console.log("[CompanyDetail] Deals result:", data?.length, data);
      return data || [];
    },
    enabled: !!crmCompanyId,
  });

  // ── Fetch projects (using crm_company_id) ──
  const { data: projects = [] } = useQuery({
    queryKey: ["company-projects", crmCompanyId],
    queryFn: async () => {
      if (!crmCompanyId) return [];
      const { data, error } = await supabase
        .from("crm_projects" as any).select("*")
        .eq("company_id", crmCompanyId).order("created_at", { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!crmCompanyId,
  });

  // ── Fetch invoices (using crm_company_id) ──
  const { data: invoices = [] } = useQuery({
    queryKey: ["company-invoices", crmCompanyId],
    queryFn: async () => {
      if (!crmCompanyId) return [];
      const { data, error } = await supabase
        .from("crm_invoices" as any).select("*")
        .eq("company_id", crmCompanyId).order("created_at", { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!crmCompanyId,
  });

  // ── Fetch activities (using crm_company_id) ──
  const { data: activities = [] } = useQuery({
    queryKey: ["company-all-activities", crmCompanyId, id],
    queryFn: async () => {
      if (!crmCompanyId) return [];
      const { data: companyActs } = await supabase
        .from("crm_activities" as any).select("*")
        .eq("company_id", crmCompanyId).order("created_at", { ascending: false }).limit(200);
      // Also get contact-level activities
      const { data: contactRows } = await supabase
        .from("contacts").select("id").eq("company_id", id!).is("deleted_at", null);
      const contactIds = (contactRows || []).map((c: any) => c.id);
      let contactActs: any[] = [];
      if (contactIds.length > 0) {
        const { data } = await supabase
          .from("crm_activities" as any).select("*")
          .in("contact_id", contactIds).order("created_at", { ascending: false }).limit(200);
        contactActs = data || [];
      }
      const allMap = new Map<string, any>();
      [...(companyActs || []), ...contactActs].forEach((a: any) => allMap.set(a.id, a));
      return Array.from(allMap.values()).sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!crmCompanyId,
  });

  // ── Fetch commercial documents for this company ──
  const { data: companyDocs = [] } = useQuery({
    queryKey: ["company-commercial-docs", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("commercial_documents" as any).select("*")
        .eq("company_id", id).order("created_at", { ascending: false });
      if (error) { console.error("company docs error:", error); return []; }
      return data || [];
    },
    enabled: !!id,
  });

  // ── Mutations ──
  const updateCompany = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      if (!id) throw new Error("No company id");
      const { error } = await supabase.from("companies").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies", id] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });

  const handleInlineUpdate = useCallback(async (field: string, value: string) => {
    try {
      await updateCompany.mutateAsync({ [field]: value || null });
      toast({ title: "Updated", description: `${field} saved.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }, [updateCompany]);

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateCompany.mutateAsync({ relationship_status: newStatus });
      setStatusPopoverOpen(false);
      toast({ title: "Status updated" });
    } catch {}
  };

  const handleOwnerAssign = async (userId: string, userName: string) => {
    try {
      await updateCompany.mutateAsync({ account_manager: userName, owner_id: userId });
      setOwnerPopoverOpen(false);
      toast({ title: "Account owner assigned", description: userName });
    } catch {}
  };

  const handlePanelSaved = (queryKeys: string[][]) => {
    queryKeys.forEach(k => queryClient.invalidateQueries({ queryKey: k }));
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Loading company…</div>;
  if (!rawCompany) return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Company not found</div>;

  const company = rawCompany;
  const statusConfig = getStatusConfig(company.relationship_status);
  const ownerName = company.account_manager || null;

  // Pipeline value: sum deals not won/lost
  const openDealsValue = (deals as any[])
    .filter((d: any) => {
      const stage = d.stage || d.status;
      return !["won", "lost", "complete", "cancelled"].includes(stage);
    })
    .reduce((sum: number, d: any) => sum + (d.value || 0), 0);

  // Coverage score
  const departmentMap = new Map<string, { count: number; hasExec: boolean }>();
  contacts.forEach(c => {
    const dept = c.department || "Other";
    const existing = departmentMap.get(dept) || { count: 0, hasExec: false };
    existing.count += 1;
    if (c.seniority === "executive" || c.seniority === "director") existing.hasExec = true;
    departmentMap.set(dept, existing);
  });
  const departments = Array.from(departmentMap.entries());
  const executiveCount = contacts.filter(c => c.seniority === "executive" || c.seniority === "director").length;
  const championCount = contacts.filter(c => c.status === "champion").length;
  const coverageScore = Math.min(100, Math.max(0, (departments.length * 15) + (executiveCount * 20) + (championCount * 25)));
  const coverageColor = coverageScore >= 70 ? "text-green-600" : coverageScore >= 40 ? "text-amber-600" : "text-red-600";
  const coverageStroke = coverageScore >= 70 ? "stroke-green-500" : coverageScore >= 40 ? "stroke-amber-500" : "stroke-red-500";

  // AI insights
  const insights: { type: "success" | "warning" | "info"; text: string }[] = [];
  if (executiveCount === 0) insights.push({ type: "warning", text: "No executive sponsor identified" });
  else insights.push({ type: "success", text: `${executiveCount} executive-level relationship${executiveCount > 1 ? "s" : ""} established` });
  if (departments.length >= 3) {
    const topDept = departments.sort((a, b) => b[1].count - a[1].count)[0];
    insights.push({ type: "info", text: `${topDept[0]} has ${topDept[1].count} contacts — strong coverage` });
  }
  if (departments.length < 2) insights.push({ type: "warning", text: "Limited departmental coverage — expand across functions" });
  if (championCount > 0) insights.push({ type: "success", text: `${championCount} identified champion${championCount > 1 ? "s" : ""}` });

  return (
    <div className="bg-background min-h-screen">
      {/* ─── HEADER ─── */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => navigate("/companies")} className="gap-1 text-muted-foreground hover:text-foreground -ml-2">
              <ChevronLeft className="h-4 w-4" /> Companies
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground truncate">{company.name}</h1>
                {company.industry && <Badge variant="secondary">{company.industry}</Badge>}
                <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button data-jarvis-id="company-status-badge"
                      className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors hover:opacity-80", statusConfig.color)}>
                      {statusConfig.label} <ChevronDown className="h-3 w-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-40 p-1" align="start">
                    {STATUS_OPTIONS.map(opt => (
                      <button key={opt.value} onClick={() => handleStatusChange(opt.value)}
                        className={cn("w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted flex items-center gap-2", opt.value === company.relationship_status && "bg-muted")}>
                        <span className={cn("w-2 h-2 rounded-full", opt.color.split(" ")[0])} /> {opt.label}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
              {company.website && (
                <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1 mt-0.5">
                  <Globe className="h-3 w-3" />{company.website}
                </a>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} data-jarvis-id="company-edit-button">
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
            {perm.canSeeDeleteOption && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {perm.canDeleteDirectly ? "Delete" : "Request Deletion"}
              </Button>
            )}
          </div>


          <DeletionRequestBanner recordType="companies" recordId={id!} />

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <QuickStat icon={TrendingUp} label="Engagement Score" value={`${company.engagement_score || 50}%`} />
            <QuickStat icon={Users} label="Total Contacts" value={String(contacts.length)} />
            <QuickStat icon={Clock} label="Last Activity" value={fmtDate(company.updated_at)} />
            <Popover open={ownerPopoverOpen} onOpenChange={setOwnerPopoverOpen}>
              <PopoverTrigger asChild>
                <Card className="cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all" data-jarvis-id="company-assign-owner">
                  <CardContent className="pt-4 pb-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {ownerName ? (
                        <Avatar className="h-9 w-9"><AvatarFallback className="text-xs bg-primary/10 text-primary">{ownerName.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}</AvatarFallback></Avatar>
                      ) : <User className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{ownerName || "Unassigned"}</p>
                      <p className="text-xs text-muted-foreground">Account Lead</p>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start" sideOffset={4}>
                <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {(canAssignOwner) ? "Assign Account Owner" : "Account Owner"}
                </p>
                {ownerName && (
                  <div className="px-2 py-2 mb-1 rounded-md bg-primary/5 border border-primary/10 flex items-center gap-2">
                    <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px] bg-primary/10 text-primary">{ownerName.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}</AvatarFallback></Avatar>
                    <span className="text-sm font-medium text-foreground">{ownerName}</span>
                    <Badge variant="secondary" className="ml-auto text-[10px]">Current</Badge>
                  </div>
                )}
                {canAssignOwner ? (
                  <>
                    {workspaceUsers.length > 0 ? (
                      <div className="space-y-0.5 max-h-48 overflow-y-auto">
                        {workspaceUsers.map((u: any) => (
                          <button key={u.id} onClick={() => handleOwnerAssign(u.id, u.name)}
                            className={cn("w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-muted flex items-center gap-2 transition-colors", u.name === ownerName && "bg-muted")}>
                            <Avatar className="h-5 w-5"><AvatarFallback className="text-[10px]">{u.name.charAt(0)}</AvatarFallback></Avatar>
                            <span className="truncate">{u.name}</span>
                            {u.name === ownerName && <CheckCircle2 className="h-3.5 w-3.5 text-primary ml-auto shrink-0" />}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="px-2 py-3 text-xs text-muted-foreground text-center">No workspace users found</p>
                    )}
                    {ownerName && (
                      <button onClick={() => handleOwnerAssign("", "")}
                        className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-destructive/10 text-destructive flex items-center gap-2 mt-1 border-t border-border pt-2">
                        <X className="h-3.5 w-3.5" /> Unassign Owner
                      </button>
                    )}
                  </>
                ) : (
                  <p className="px-2 py-2 text-xs text-muted-foreground">
                    {ownerName ? `Owned by ${ownerName}` : "No owner assigned"} — only admins and managers can reassign.
                  </p>
                )}
              </PopoverContent>
            </Popover>
            <QuickStat icon={DollarSign} label="Pipeline"
              value={openDealsValue > 0 ? `£${openDealsValue.toLocaleString()}` : "£0"}
              valueClass={openDealsValue > 0 ? "text-green-600" : undefined} />
          </div>


          {/* ACTION BAR */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setAddContactOpen(true)} data-jarvis-id="company-add-contact-button">
              <Plus className="h-4 w-4 mr-1" /> Add Contact
            </Button>
            <Button size="sm" onClick={() => setAddDealOpen(true)} data-jarvis-id="company-add-deal-button">
              <Plus className="h-4 w-4 mr-1" /> Add Deal
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAddLeadOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Capture Lead
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-jarvis-id="company-log-activity-button">
                  <Plus className="h-4 w-4 mr-1" /> Log Activity <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => { setLogActivityType("note"); setLogActivityOpen(true); }}>
                  <StickyNote className="h-4 w-4 mr-2" /> Add Account Note
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setLogActivityType("call"); setLogActivityOpen(true); }}>
                  <Phone className="h-4 w-4 mr-2" /> Log Team Activity
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setLogActivityType("task"); setLogActivityOpen(true); }}>
                  <Flag className="h-4 w-4 mr-2" /> Set Account Flag
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setLogActivityType("meeting"); setLogActivityOpen(true); }}>
                  <CalendarClock className="h-4 w-4 mr-2" /> Schedule Team Review
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={() => navigate(`/canvas?company=${id}`, { state: { from: `/companies/${id}`, fromLabel: `Back to ${company.name}` } })} data-jarvis-id="company-open-canvas-button">
              <Network className="h-4 w-4 mr-1" /> Open on Canvas
            </Button>
          </div>
        </div>
      </div>

      {/* ─── BODY ─── */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="overview">
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="overview" data-jarvis-id="company-tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="contacts" data-jarvis-id="company-tab-contacts">Contacts ({contacts.length})</TabsTrigger>
            <TabsTrigger value="deals" data-jarvis-id="company-tab-deals">Deals ({(deals as any[]).length})</TabsTrigger>
            <TabsTrigger value="projects" data-jarvis-id="company-tab-projects">Projects ({(projects as any[]).length})</TabsTrigger>
            <TabsTrigger value="documents" data-jarvis-id="company-tab-documents">Documents ({(companyDocs as any[]).length})</TabsTrigger>
            <TabsTrigger value="activity" data-jarvis-id="company-tab-activity">Activity</TabsTrigger>
            <TabsTrigger value="canvas" data-jarvis-id="company-tab-canvas">Canvas</TabsTrigger>
            <TabsTrigger value="invoices" data-jarvis-id="company-tab-invoices">Invoices ({(invoices as any[]).length})</TabsTrigger>
          </TabsList>

          {/* ─── OVERVIEW TAB ─── */}
          <TabsContent value="overview">
            <div className="flex gap-6 items-start">
              <div className="flex-1 min-w-0 space-y-5" style={{ flex: "0 0 65%" }}>
                <Card data-jarvis-id="company-coverage-score">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-5">
                      <div className="relative h-20 w-20 shrink-0">
                        <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
                          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth="3" strokeDasharray={`${coverageScore}, 100`} strokeLinecap="round" className={coverageStroke} />
                        </svg>
                        <span className={cn("absolute inset-0 flex items-center justify-center text-lg font-bold", coverageColor)}>{coverageScore}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">Coverage Score</p>
                          <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                            <TooltipContent className="max-w-xs text-xs">Coverage improves by adding contacts across departments, logging calls, and assigning an executive sponsor.</TooltipContent>
                          </Tooltip></TooltipProvider>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {departments.map(([name, data]) => (
                            <Badge key={name} variant="secondary" className={cn("text-xs", data.hasExec && "bg-primary/10 text-primary")}>{name} ({data.count})</Badge>
                          ))}
                          {departments.length === 0 && <span className="text-xs text-muted-foreground">No departments mapped</span>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-2" data-jarvis-id="company-ai-insights">
                  <p className="text-sm font-semibold">AI Insights</p>
                  {insights.map((ins, i) => (
                    <div key={i} className={cn("flex items-start gap-2.5 p-3 rounded-lg text-sm bg-card border-l-[3px]",
                      ins.type === "warning" && "border-l-amber-500", ins.type === "info" && "border-l-blue-500", ins.type === "success" && "border-l-green-500")}>
                      {ins.type === "success" && <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />}
                      {ins.type === "warning" && <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />}
                      {ins.type === "info" && <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />}
                      <span className="text-foreground">{ins.text}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Active Engagements</p>
                  {(deals as any[]).length === 0 && (projects as any[]).length === 0 ? (
                    <div className="border border-dashed border-border rounded-lg p-4 text-center max-h-[120px] flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">No active engagements. Add a deal or project to get started.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {(deals as any[]).slice(0, 3).map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card text-sm cursor-pointer hover:bg-muted/50"
                          onClick={() => setEditDealId(d.id)}>
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{d.title}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">£{(d.value || 0).toLocaleString()}</span>
                            <Badge className={cn("text-xs capitalize", STAGE_COLORS[d.stage || d.status] || "bg-muted text-muted-foreground")}>{d.stage || d.status}</Badge>
                          </div>
                        </div>
                      ))}
                      {(projects as any[]).slice(0, 3).map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card text-sm cursor-pointer hover:bg-muted/50"
                          onClick={() => setEditProjectId(p.id)}>
                          <div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-medium">{p.name}</span></div>
                          <Badge variant="secondary" className="text-xs capitalize">{p.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="w-80 shrink-0 hidden lg:block">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Company Details</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-3">
                    <InlineField label="Website" value={company.website} field="website" onSave={handleInlineUpdate} isLink />
                    <InlineField label="Switchboard" value={company.switchboard} field="switchboard" onSave={handleInlineUpdate} />
                    <InlineField label="HQ Location" value={company.headquarters} field="headquarters" onSave={handleInlineUpdate} />
                    <InlineField label="Industry" value={company.industry} field="industry" onSave={handleInlineUpdate} />
                    <InlineField label="Company Size" value={company.size} field="size" onSave={handleInlineUpdate} />
                    <InlineField label="LinkedIn" value={(company as any).linkedin_url} field="linkedin_url" onSave={handleInlineUpdate} isLink />
                    <div className="flex items-start gap-2 py-1">
                      <span className="text-muted-foreground w-24 shrink-0 text-xs pt-0.5">Account Owner</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="text-foreground hover:underline text-left flex items-center gap-1">
                            {ownerName || <span className="text-muted-foreground">Unassigned</span>}
                            {canAssignOwner && <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="start">
                          {canAssignOwner ? (
                            <>
                              <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">Reassign Owner</p>
                              {workspaceUsers.map((u: any) => (
                                <button key={u.id} onClick={() => handleOwnerAssign(u.id, u.name)}
                                  className={cn("w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-muted flex items-center gap-2", u.name === ownerName && "bg-muted")}>
                                  <Avatar className="h-5 w-5"><AvatarFallback className="text-[10px]">{u.name.charAt(0)}</AvatarFallback></Avatar>
                                  {u.name}
                                  {u.name === ownerName && <CheckCircle2 className="h-3.5 w-3.5 text-primary ml-auto" />}
                                </button>
                              ))}
                              {workspaceUsers.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">No workspace users found</p>}
                            </>
                          ) : (
                            <p className="px-2 py-2 text-xs text-muted-foreground">Only admins and managers can reassign ownership.</p>
                          )}
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Separator />
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Created: {fmtDate(company.created_at)}</p>
                      <p>Updated: {fmtDate(company.updated_at)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ─── CONTACTS TAB ─── */}
          <TabsContent value="contacts">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{contacts.length} contacts at {company.name}</p>
                <Button size="sm" variant="outline" onClick={() => setAddContactOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Contact</Button>
              </div>
              {contacts.length === 0 ? (
                <Card><CardContent className="py-12 text-center">
                  <Users className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground mb-3">No contacts yet. Add the first contact at {company.name}.</p>
                  <Button size="sm" onClick={() => setAddContactOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Contact</Button>
                </CardContent></Card>
              ) : (
                <Card><div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border text-left text-muted-foreground">
                      <th className="p-3 font-medium">Name</th><th className="p-3 font-medium">Title</th>
                      <th className="p-3 font-medium">Department</th><th className="p-3 font-medium">Email</th>
                      <th className="p-3 font-medium">Phone</th><th className="p-3 font-medium">Last Activity</th>
                      <th className="p-3 font-medium">Actions</th>
                    </tr></thead>
                    <tbody>
                      {contacts.map(c => (
                        <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/contacts/${c.id}`)}>
                          <td className="p-3 font-medium text-primary hover:underline cursor-pointer">{c.name}</td>
                          <td className="p-3 text-muted-foreground">{c.title || "—"}</td>
                          <td className="p-3 text-muted-foreground">{c.department || "—"}</td>
                          <td className="p-3 text-muted-foreground truncate max-w-[180px]">{c.email || "—"}</td>
                          <td className="p-3 text-muted-foreground">{c.phone || "—"}</td>
                          <td className="p-3 text-muted-foreground">{fmtDate(c.lastContact)}</td>
                          <td className="p-3" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setLogActivityType("call"); setLogActivityOpen(true); }}>Call</Button>
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setLogActivityType("email"); setLogActivityOpen(true); }}>Email</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div></Card>
              )}
            </div>
          </TabsContent>

          {/* ─── DEALS TAB ─── */}
          <TabsContent value="deals">
            <DealsTab deals={deals as any[]} companyName={company.name}
              onAddDeal={() => setAddDealOpen(true)}
              onEditDeal={(dealId) => setEditDealId(dealId)} />
          </TabsContent>

          {/* ─── PROJECTS TAB ─── */}
          <TabsContent value="projects">
            <ProjectsTab projects={projects as any[]} companyName={company.name}
              onAddProject={() => setAddProjectOpen(true)}
              onEditProject={(projectId) => setEditProjectId(projectId)} />
          </TabsContent>

          {/* ─── DOCUMENTS TAB ─── */}
          <TabsContent value="documents">
            <CompanyDocumentsSection docs={companyDocs} companyName={company.name} companyId={id!} onUpload={() => navigate('/documents')} />
          </TabsContent>

          {/* ─── ACTIVITY TAB ─── */}
          <TabsContent value="activity">
            <ActivityIntelligenceTab activities={activities} contacts={contacts} companyName={company.name} />
          </TabsContent>

          {/* ─── CANVAS TAB ─── */}
          <TabsContent value="canvas">
            {contacts.length === 0 ? (
              <Card><CardContent className="py-12 text-center">
                <Users className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium mb-1">No contacts available</p>
                <p className="text-sm text-muted-foreground mb-4">Add contacts to {company.name} to view them on the canvas.</p>
                <Button size="sm" onClick={() => setAddContactOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Contact</Button>
              </CardContent></Card>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{contacts.length} contacts mapped</p>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/canvas?company=${id}`, { state: { from: `/companies/${id}`, fromLabel: `Back to ${company.name}` } })}>
                    <ExternalLink className="h-4 w-4 mr-1" /> Open Full Canvas
                  </Button>
                </div>
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="h-[500px] relative">
                      <AccountCanvas
                        account={(() => {
                          // Build hierarchy maps from org_chart_edges (same source as full Canvas page)
                          const parentMap = new Map<string, string | null>();
                          const siblingOrderMap = new Map<string, number>();
                          for (const node of orgNodes) {
                            parentMap.set(node.contactId, node.parentContactId);
                            siblingOrderMap.set(node.contactId, node.siblingOrder);
                          }
                          return {
                            id: company.id,
                            name: company.name,
                            industry: company.industry || 'Other',
                            size: company.size || 'Unknown',
                            contacts: contacts.map((c: any) => ({
                              id: c.id,
                              name: c.name,
                              title: c.title || '',
                              department: c.department || '',
                              seniority: c.seniority || 'mid',
                              email: c.email || '',
                              phone: c.phone || '',
                              status: c.status || 'unknown',
                              engagementScore: 50,
                              managerId: parentMap.get(c.id) ?? null,
                              siblingOrder: siblingOrderMap.get(c.id) ?? 0,
                            })),
                          lastUpdated: company.updated_at,
                          engagementScore: 50,
                          };
                        })()}
                        onContactClick={(contact) => {
                          navigate(`/contacts/${contact.id}`, { state: { from: `/companies/${id}`, fromLabel: `Back to ${company.name}` } });
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ─── INVOICES TAB ─── */}
          <TabsContent value="invoices">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{(invoices as any[]).length} invoices</p>
                <Button size="sm" variant="outline" onClick={() => setAddInvoiceOpen(true)}><Plus className="h-4 w-4 mr-1" /> Create Invoice</Button>
              </div>
              {(invoices as any[]).length === 0 ? (
                <Card><CardContent className="py-12 text-center">
                  <FileText className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground mb-3">No invoices yet.</p>
                  <Button size="sm" variant="outline" onClick={() => setAddInvoiceOpen(true)}><Plus className="h-4 w-4 mr-1" /> Create Invoice</Button>
                </CardContent></Card>
              ) : (
                <Card><div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border text-left text-muted-foreground">
                      <th className="p-3 font-medium">Invoice #</th><th className="p-3 font-medium">Amount</th>
                      <th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Due Date</th>
                    </tr></thead>
                    <tbody>
                      {(invoices as any[]).map((inv: any) => (
                        <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                          <td className="p-3 font-medium">{inv.invoice_number || "—"}</td>
                          <td className="p-3">£{(inv.total || 0).toLocaleString()}</td>
                          <td className="p-3"><Badge variant="secondary" className="text-xs capitalize">{inv.status}</Badge></td>
                          <td className="p-3 text-muted-foreground">{fmtDate(inv.due_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div></Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── DELETE MODAL ─── */}
      <DeleteRecordModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        recordType="companies"
        recordId={id!}
        recordName={company.name}
        onDeleted={() => navigate("/companies")}
      />

      {/* ─── ALL SLIDE-IN PANELS ─── */}
      <EditCompanyPanel open={editOpen} onClose={() => setEditOpen(false)} company={company}
        onSaved={() => { setEditOpen(false); handlePanelSaved([["companies", id!]]); }} />

      <AddContactPanel open={addContactOpen} onClose={() => setAddContactOpen(false)}
        companyId={id!} companyName={company.name}
        onSaved={() => { setAddContactOpen(false); handlePanelSaved([["company-contacts", id!]]); }} />

      {crmCompanyId && (
        <>
          <AddDealPanel open={addDealOpen} onClose={() => setAddDealOpen(false)}
            companyId={crmCompanyId} companyName={company.name}
            onSaved={() => { setAddDealOpen(false); handlePanelSaved([["company-deals", crmCompanyId], ["crm_deals"]]); }} />

          <EditDealPanel open={!!editDealId} onClose={() => setEditDealId(null)}
            dealId={editDealId || ""} companyName={company.name} crmCompanyId={crmCompanyId}
            onSaved={() => { setEditDealId(null); handlePanelSaved([["company-deals", crmCompanyId], ["crm_deals"]]); }}
            onCreateProject={(dealTitle) => {
              setEditDealId(null);
              setAddProjectOpen(true);
            }} />

          <AddProjectPanel open={addProjectOpen} onClose={() => setAddProjectOpen(false)}
            companyId={crmCompanyId} companyName={company.name}
            onSaved={() => { setAddProjectOpen(false); handlePanelSaved([["company-projects", crmCompanyId], ["crm_projects"]]); }} />

          <EditProjectPanel open={!!editProjectId} onClose={() => setEditProjectId(null)}
            projectId={editProjectId || ""} companyName={company.name}
            onSaved={() => { setEditProjectId(null); handlePanelSaved([["company-projects", crmCompanyId], ["crm_projects"]]); }} />

          <AddInvoicePanel open={addInvoiceOpen} onClose={() => setAddInvoiceOpen(false)}
            companyId={crmCompanyId} companyName={company.name}
            onSaved={() => { setAddInvoiceOpen(false); handlePanelSaved([["company-invoices", crmCompanyId], ["crm_invoices"]]); }} />

          <LogActivityPanel open={logActivityOpen} onClose={() => setLogActivityOpen(false)}
            companyId={crmCompanyId} companyName={company.name} defaultType={logActivityType}
            contacts={contacts}
            onSaved={() => { setLogActivityOpen(false); handlePanelSaved([["company-all-activities", crmCompanyId, id!]]); }} />

          <AddLeadPanel open={addLeadOpen} onClose={() => setAddLeadOpen(false)}
            companyId={crmCompanyId} companyName={company.name}
            onSaved={() => { setAddLeadOpen(false); toast({ title: "Lead captured" }); }} />
        </>
      )}
    </div>
  );
}

/* ─── QUICK STAT ─── */
function QuickStat({ icon: Icon, label, value, valueClass }: { icon: any; label: string; value: string; valueClass?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className={cn("text-sm font-medium text-foreground truncate", valueClass)}>{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── INLINE FIELD ─── */
function InlineField({ label, value, field, onSave, isLink }: {
  label: string; value?: string | null; field: string;
  onSave: (field: string, value: string) => void; isLink?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  useEffect(() => { setDraft(value || ""); }, [value]);

  return (
    <div className="flex items-start gap-2 py-1 group">
      <span className="text-muted-foreground w-24 shrink-0 text-xs pt-0.5">{label}</span>
      {editing ? (
        <Input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
          onBlur={() => { onSave(field, draft); setEditing(false); }}
          onKeyDown={e => { if (e.key === "Enter") { onSave(field, draft); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
          className="h-7 text-sm" />
      ) : (
        <button onClick={() => setEditing(true)} className="text-left flex-1 min-w-0 hover:bg-muted/50 rounded px-1 -mx-1 transition-colors">
          {value ? (isLink ? (
            <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1" onClick={e => e.stopPropagation()}>
              {value.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3" />
            </a>
          ) : value) : <span className="text-muted-foreground italic">—</span>}
        </button>
      )}
    </div>
  );
}

/* ─── DEALS TAB ─── */
function DealsTab({ deals, companyName, onAddDeal, onEditDeal }: {
  deals: any[]; companyName: string; onAddDeal: () => void; onEditDeal: (id: string) => void;
}) {
  const grouped = useMemo(() => {
    const active = deals.filter(d => !["won", "lost", "complete", "cancelled"].includes(d.stage || d.status));
    const won = deals.filter(d => (d.stage || d.status) === "won" || d.status === "complete");
    const lost = deals.filter(d => (d.stage || d.status) === "lost" || d.status === "cancelled");
    return { active, won, lost };
  }, [deals]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{deals.length} deals at {companyName}</p>
        <Button size="sm" onClick={onAddDeal}><Plus className="h-4 w-4 mr-1" /> Add Deal</Button>
      </div>
      {deals.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <DollarSign className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground mb-3">No deals yet.</p>
          <Button size="sm" onClick={onAddDeal}><Plus className="h-4 w-4 mr-1" /> Add Deal</Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-5">
          {grouped.active.length > 0 && <DealGroup title="Active Deals" deals={grouped.active} onEdit={onEditDeal} />}
          {grouped.won.length > 0 && <DealGroup title="Won" deals={grouped.won} onEdit={onEditDeal} />}
          {grouped.lost.length > 0 && <DealGroup title="Lost / Cancelled" deals={grouped.lost} onEdit={onEditDeal} />}
        </div>
      )}
    </div>
  );
}

function DealGroup({ title, deals, onEdit }: { title: string; deals: any[]; onEdit: (id: string) => void }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {deals.map(d => (
          <Card key={d.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onEdit(d.id)}>
            <CardContent className="p-4 space-y-2">
              <p className="font-semibold text-sm truncate">{d.title}</p>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-foreground">£{(d.value || 0).toLocaleString()}</span>
                <Badge className={cn("text-xs capitalize", STAGE_COLORS[d.stage || d.status] || "bg-muted text-muted-foreground")}>{d.stage || d.status}</Badge>
              </div>
              {/* Integrity badges */}
              {(!d.contact_id || !d.project_id) && (
                <div className="flex items-center gap-1">
                  {!d.contact_id && (
                    <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium border border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                      ! No contact
                    </span>
                  )}
                  {!d.project_id && (
                    <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium border border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                      ! No project
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Close: {fmtDateShort(d.end_date || d.signed_date)}</span>
                <span>{d.created_at ? `${differenceInDays(new Date(), parseISO(d.created_at))}d open` : ""}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ─── PROJECTS TAB ─── */
function ProjectsTab({ projects, companyName, onAddProject, onEditProject }: {
  projects: any[]; companyName: string; onAddProject: () => void; onEditProject: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{projects.length} projects at {companyName}</p>
        <Button size="sm" variant="outline" onClick={onAddProject}><Plus className="h-4 w-4 mr-1" /> Add Project</Button>
      </div>
      {projects.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <FileText className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground mb-3">No projects linked yet.</p>
          <Button size="sm" variant="outline" onClick={onAddProject}><Plus className="h-4 w-4 mr-1" /> Add Project</Button>
        </CardContent></Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p: any) => (
            <Card key={p.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onEditProject(p.id)}>
              <CardContent className="p-4 space-y-2">
                <p className="font-semibold text-sm truncate">{p.name}</p>
                <div className="flex items-center gap-2">
                  {p.project_type && <Badge variant="outline" className="text-xs">{p.project_type}</Badge>}
                  <Badge variant="secondary" className="text-xs capitalize">{p.status}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{p.budget ? `£${p.budget.toLocaleString()}` : "No budget"}</span>
                  <span>Updated {fmtDateShort(p.updated_at)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── ACTIVITY INTELLIGENCE TAB ─── */
function ActivityIntelligenceTab({ activities, contacts, companyName }: {
  activities: any[]; contacts: Contact[]; companyName: string;
}) {
  const [filter, setFilter] = useState("all");

  const contactActivityCounts = useMemo(() => {
    const map = new Map<string, { count: number; lastDate: string | null; channels: Set<string> }>();
    contacts.forEach(c => map.set(c.id, { count: 0, lastDate: null, channels: new Set() }));
    activities.forEach((a: any) => {
      if (a.contact_id && map.has(a.contact_id)) {
        const entry = map.get(a.contact_id)!;
        entry.count++;
        entry.channels.add(a.type);
        if (!entry.lastDate || a.created_at > entry.lastDate) entry.lastDate = a.created_at;
      }
    });
    return map;
  }, [activities, contacts]);

  const mostActiveContact = useMemo(() => {
    let best: { name: string; count: number } | null = null;
    contacts.forEach(c => {
      const data = contactActivityCounts.get(c.id);
      if (data && data.count > 0 && (!best || data.count > best.count)) best = { name: c.name, count: data.count };
    });
    return best;
  }, [contacts, contactActivityCounts]);

  const lastActivity = activities[0] as any | undefined;
  const lastTouchedText = lastActivity
    ? `${lastActivity.type} — ${daysAgo(lastActivity.created_at)}d ago`
    : "No activity";

  const getWarmth = (lastDate: string | null) => {
    if (!lastDate) return { label: "Cold", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" };
    const days = daysAgo(lastDate) || 999;
    if (days <= 30) return { label: "Active", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" };
    if (days <= 90) return { label: "Cooling", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" };
    return { label: "Cold", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" };
  };

  const filtered = filter === "all" ? activities : activities.filter((a: any) => a.type === filter);

  const contactsWithActivity = useMemo(() => {
    return contacts.map(c => {
      const data = contactActivityCounts.get(c.id) || { count: 0, lastDate: null, channels: new Set<string>() };
      return { ...c, actCount: data.count, lastActDate: data.lastDate, channels: Array.from(data.channels), warmth: getWarmth(data.lastDate) };
    }).sort((a, b) => {
      if (!a.lastActDate && !b.lastActDate) return 0;
      if (!a.lastActDate) return 1;
      if (!b.lastActDate) return -1;
      return new Date(b.lastActDate).getTime() - new Date(a.lastActDate).getTime();
    });
  }, [contacts, contactActivityCounts]);

  const getIcon = (type: string) => {
    switch (type) {
      case "call": return <Phone className="h-3.5 w-3.5" />;
      case "email": return <Mail className="h-3.5 w-3.5" />;
      case "meeting": return <Calendar className="h-3.5 w-3.5" />;
      case "note": return <StickyNote className="h-3.5 w-3.5" />;
      case "task": return <Flag className="h-3.5 w-3.5" />;
      default: return <Activity className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground mb-1">Most Active Contact</p>
          <p className="font-semibold text-sm">{mostActiveContact ? `${mostActiveContact.name} (${mostActiveContact.count})` : "—"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground mb-1">Last Touched</p>
          <p className="font-semibold text-sm">{lastTouchedText}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground mb-1">Total Interactions</p>
          <p className="font-semibold text-sm">{activities.length}</p>
        </CardContent></Card>
      </div>

      {contacts.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Contact Engagement</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-muted-foreground">
                  <th className="p-3 font-medium">Contact</th><th className="p-3 font-medium">Title</th>
                  <th className="p-3 font-medium">Last Activity</th><th className="p-3 font-medium">Count</th>
                  <th className="p-3 font-medium">Channels</th><th className="p-3 font-medium">Warmth</th>
                </tr></thead>
                <tbody>
                  {contactsWithActivity.map(c => (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="p-3 font-medium">{c.name}</td>
                      <td className="p-3 text-muted-foreground">{c.title || "—"}</td>
                      <td className="p-3 text-muted-foreground">{fmtDate(c.lastActDate)}</td>
                      <td className="p-3 text-muted-foreground">{c.actCount}</td>
                      <td className="p-3">
                        <div className="flex gap-1">{c.channels.map(ch => (
                          <Badge key={ch} variant="outline" className="text-[10px] px-1.5 py-0">{ch}</Badge>
                        ))}</div>
                      </td>
                      <td className="p-3"><Badge className={cn("text-xs", c.warmth.color)}>{c.warmth.label}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {["all", "call", "email", "meeting", "note", "task"].map(f => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" className="text-xs capitalize" onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f + "s"}
            </Button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-3" /> No activity recorded yet.
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card text-sm">
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">{getIcon(a.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{a.subject || `${a.type} logged`}</p>
                  {a.body && <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">{a.body}</p>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{fmtDate(a.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SLIDE-IN PANELS
   ══════════════════════════════════════════════════════════════════ */

function EditCompanyPanel({ open, onClose, company, onSaved }: {
  open: boolean; onClose: () => void; company: any; onSaved: () => void;
}) {
  const [form, setForm] = useState({ name: "", headquarters: "", switchboard: "", industry: "", size: "", website: "", notes: "", relationship_status: "warm" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open && company) setForm({
      name: company.name || "", headquarters: company.headquarters || "", switchboard: company.switchboard || "",
      industry: company.industry || "", size: company.size || "", website: company.website || "",
      notes: company.notes || "", relationship_status: company.relationship_status || "warm",
    });
  }, [open, company]);
  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("companies").update({
        name: form.name, headquarters: form.headquarters || null, switchboard: form.switchboard || null,
        industry: form.industry || null, size: form.size || null, website: form.website || null,
        notes: form.notes || null, relationship_status: form.relationship_status,
      }).eq("id", company.id);
      if (error) throw error;
      toast({ title: "Company updated" }); onSaved();
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };
  return (
    <SlideInPanel open={open} onClose={onClose} title="Edit Company" subtitle={company?.name}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Saving…</> : "Save Changes"}</Button></>}>
      <div><Label>Company Name <span className="text-red-500">*</span></Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
      <div><Label>Website</Label><Input placeholder="https://..." value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Industry</Label>
          <Select value={form.industry} onValueChange={v => setForm(f => ({ ...f, industry: v }))}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent className="bg-popover z-[9999]">{INDUSTRY_OPTIONS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
          </Select></div>
        <div><Label>Size</Label><Input value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} placeholder="e.g. 500+" /></div>
      </div>
      <div><Label>HQ Location</Label><Input value={form.headquarters} onChange={e => setForm(f => ({ ...f, headquarters: e.target.value }))} /></div>
      <div><Label>Switchboard</Label><Input value={form.switchboard} onChange={e => setForm(f => ({ ...f, switchboard: e.target.value }))} /></div>
      <div><Label>Status</Label>
        <Select value={form.relationship_status} onValueChange={v => setForm(f => ({ ...f, relationship_status: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent className="bg-popover z-[9999]">{STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select></div>
      <div><Label>Notes</Label><Textarea rows={4} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
    </SlideInPanel>
  );
}

function AddContactPanel({ open, onClose, companyId, companyName, onSaved }: {
  open: boolean; onClose: () => void; companyId: string; companyName: string; onSaved: () => void;
}) {
  const [name, setName] = useState(""); const [title, setTitle] = useState(""); const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(""); const [dept, setDept] = useState(""); const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setName(""); setTitle(""); setEmail(""); setPhone(""); setDept(""); } }, [open]);
  const handleSave = async () => {
    if (!name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("contacts").insert({ name, title: title || null, email: email || null, phone: phone || null, department: dept || null, company_id: companyId } as any);
      if (error) throw error;
      toast({ title: "Contact added" }); onSaved();
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };
  return (
    <SlideInPanel open={open} onClose={onClose} title="Add Contact" subtitle={companyName}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? "Adding…" : "Add Contact"}</Button></>}>
      <div className="bg-muted/50 rounded-lg p-3 text-sm"><span className="text-muted-foreground">Company:</span> <span className="font-medium">{companyName}</span> <span className="text-xs text-muted-foreground">(locked)</span></div>
      <div><Label>Full Name <span className="text-red-500">*</span></Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" /></div>
      <div><Label>Job Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
      <div><Label>Email</Label><Input value={email} onChange={e => setEmail(e.target.value)} type="email" /></div>
      <div><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
      <div><Label>Department</Label><Input value={dept} onChange={e => setDept(e.target.value)} /></div>
    </SlideInPanel>
  );
}

function AddDealPanel({ open, onClose, companyId, companyName, onSaved }: {
  open: boolean; onClose: () => void; companyId: string; companyName: string; onSaved: () => void;
}) {
  const [title, setTitle] = useState(""); const [value, setValue] = useState(""); const [stage, setStage] = useState("lead");
  const [endDate, setEndDate] = useState(""); const [notes, setNotes] = useState(""); const [saving, setSaving] = useState(false);
  const [confirmStage, setConfirmStage] = useState<string | null>(null);

  useEffect(() => { if (open) { setTitle(""); setValue(""); setStage("lead"); setEndDate(""); setNotes(""); } }, [open]);

  const handleStageChange = (newStage: string) => {
    if (newStage === "won" || newStage === "lost") {
      setConfirmStage(newStage);
    } else {
      setStage(newStage);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) { toast({ title: "Deal name required", variant: "destructive" }); return; }
    setSaving(true);
    console.log("[AddDeal] Inserting deal with company_id (crm_companies UUID):", companyId);
    try {
      const { error } = await supabase.from("crm_deals" as any).insert({
        title, value: parseFloat(value) || 0, currency: "GBP", status: stage === "won" ? "complete" : stage === "lost" ? "cancelled" : "active",
        stage, company_id: companyId,
        end_date: endDate || null, notes: notes || null,
      } as any);
      if (error) throw error;
      toast({ title: "Deal created" }); onSaved();
    } catch (err: any) {
      console.error("[AddDeal] Insert error:", err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    finally { setSaving(false); }
  };

  return (
    <>
      <SlideInPanel open={open} onClose={onClose} title="Add Deal" subtitle={companyName}
        footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? "Creating…" : "Create Deal"}</Button></>}>
        <div className="bg-muted/50 rounded-lg p-3 text-sm"><span className="text-muted-foreground">Company:</span> <span className="font-medium">{companyName}</span> <span className="text-xs text-muted-foreground">(locked)</span></div>
        <div><Label>Deal Name <span className="text-red-500">*</span></Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Recruitment Q1 2026" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Value (£)</Label><Input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="0" /></div>
          <div><Label>Stage</Label>
            <Select value={stage} onValueChange={handleStageChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover z-[9999]">
                {PIPELINE_STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select></div>
        </div>
        <div><Label>Expected Close Date</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
        <div><Label>Notes</Label><Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></div>
      </SlideInPanel>

      <AlertDialog open={!!confirmStage} onOpenChange={() => setConfirmStage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {confirmStage === "won" ? <><PartyPopper className="h-5 w-5 text-green-600" /> Mark this deal as Won?</> : <><XCircle className="h-5 w-5 text-red-600" /> Mark this deal as Lost?</>}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmStage === "won" ? "Congratulations! This will move the deal to the Won stage." : "This will mark the deal as lost."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setStage(confirmStage!); setConfirmStage(null); }}>
              {confirmStage === "won" ? "Yes, mark as Won 🎉" : "Yes, mark as Lost"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EditDealPanel({ open, onClose, dealId, companyName, crmCompanyId, onSaved, onCreateProject }: {
  open: boolean; onClose: () => void; dealId: string; companyName: string; crmCompanyId: string;
  onSaved: () => void; onCreateProject: (title: string) => void;
}) {
  const { data: deal } = useQuery({
    queryKey: ["crm_deals", dealId],
    queryFn: async () => { const { data } = await supabase.from("crm_deals" as any).select("*").eq("id", dealId).single(); return data as any; },
    enabled: !!dealId && open,
  });
  const [title, setTitle] = useState(""); const [value, setValue] = useState(""); const [stage, setStage] = useState("lead");
  const [endDate, setEndDate] = useState(""); const [notes, setNotes] = useState(""); const [saving, setSaving] = useState(false);
  const [confirmStage, setConfirmStage] = useState<string | null>(null);
  const [showProjectPrompt, setShowProjectPrompt] = useState(false);

  useEffect(() => {
    if (deal) {
      setTitle(deal.title || ""); setValue(String(deal.value || ""));
      setStage(deal.stage || deal.status || "lead");
      setEndDate(deal.end_date || ""); setNotes(deal.notes || "");
    }
  }, [deal]);

  const handleStageChange = (newStage: string) => {
    if (newStage === "won" || newStage === "lost") {
      setConfirmStage(newStage);
    } else {
      setStage(newStage);
      // Prompt project creation on proposal+
      if (newStage === "proposal" || newStage === "negotiation") {
        setShowProjectPrompt(true);
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("crm_deals" as any).update({
        title, value: parseFloat(value) || 0,
        status: stage === "won" ? "complete" : stage === "lost" ? "cancelled" : "active",
        stage,
        end_date: endDate || null, notes: notes || null,
      } as any).eq("id", dealId);
      if (error) throw error;
      toast({ title: "Deal updated" }); onSaved();
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <>
      <SlideInPanel open={open} onClose={onClose} title="Edit Deal" subtitle={companyName}
        footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button></>}>
        <div><Label>Deal Name</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Value (£)</Label><Input type="number" value={value} onChange={e => setValue(e.target.value)} /></div>
          <div><Label>Stage</Label>
            <Select value={stage} onValueChange={handleStageChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover z-[9999]">
                {PIPELINE_STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select></div>
        </div>
        <div><Label>Expected Close Date</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
        <div><Label>Notes</Label><Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></div>
      </SlideInPanel>

      <AlertDialog open={!!confirmStage} onOpenChange={() => setConfirmStage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {confirmStage === "won" ? <><PartyPopper className="h-5 w-5 text-green-600" /> Mark this deal as Won?</> : <><XCircle className="h-5 w-5 text-red-600" /> Mark this deal as Lost?</>}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setStage(confirmStage!); setConfirmStage(null); }}>
              {confirmStage === "won" ? "Yes, mark as Won 🎉" : "Yes, mark as Lost"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showProjectPrompt} onOpenChange={setShowProjectPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create a project for this deal?</AlertDialogTitle>
            <AlertDialogDescription>This deal is progressing — would you like to create a project to track delivery?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowProjectPrompt(false); onCreateProject(title); }}>Create Project</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AddProjectPanel({ open, onClose, companyId, companyName, onSaved }: {
  open: boolean; onClose: () => void; companyId: string; companyName: string; onSaved: () => void;
}) {
  const [name, setName] = useState(""); const [type, setType] = useState(""); const [status, setStatus] = useState("active");
  const [budget, setBudget] = useState(""); const [startDate, setStartDate] = useState(""); const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setName(""); setType(""); setStatus("active"); setBudget(""); setStartDate(""); setNotes(""); } }, [open]);
  const handleSave = async () => {
    if (!name.trim()) { toast({ title: "Project name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("crm_projects" as any).insert({
        name, project_type: type || null, status, budget: parseFloat(budget) || null, currency: "GBP",
        company_id: companyId, start_date: startDate || null, description: notes || null,
      } as any);
      if (error) throw error;
      toast({ title: "Project created" }); onSaved();
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };
  return (
    <SlideInPanel open={open} onClose={onClose} title="Add Project" subtitle={companyName}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? "Creating…" : "Create Project"}</Button></>}>
      <div className="bg-muted/50 rounded-lg p-3 text-sm"><span className="text-muted-foreground">Company:</span> <span className="font-medium">{companyName}</span> <span className="text-xs text-muted-foreground">(locked)</span></div>
      <div><Label>Project Name <span className="text-red-500">*</span></Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cloud Migration" /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent className="bg-popover z-[9999]">
              <SelectItem value="consulting">Consulting</SelectItem><SelectItem value="recruitment">Recruitment</SelectItem><SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select></div>
        <div><Label>Stage</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover z-[9999]">
              <SelectItem value="active">Active</SelectItem><SelectItem value="paused">Paused</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select></div>
      </div>
      <div><Label>Budget (£)</Label><Input type="number" value={budget} onChange={e => setBudget(e.target.value)} /></div>
      <div><Label>Start Date</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
      <div><Label>Notes</Label><Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></div>
    </SlideInPanel>
  );
}

function EditProjectPanel({ open, onClose, projectId, companyName, onSaved }: {
  open: boolean; onClose: () => void; projectId: string; companyName: string; onSaved: () => void;
}) {
  const { data: project } = useQuery({
    queryKey: ["crm_projects", projectId],
    queryFn: async () => { const { data } = await supabase.from("crm_projects" as any).select("*").eq("id", projectId).single(); return data as any; },
    enabled: !!projectId && open,
  });
  const [name, setName] = useState(""); const [type, setType] = useState(""); const [status, setStatus] = useState("active");
  const [budget, setBudget] = useState(""); const [notes, setNotes] = useState(""); const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (project) { setName(project.name || ""); setType(project.project_type || ""); setStatus(project.status || "active"); setBudget(String(project.budget || "")); setNotes(project.description || ""); }
  }, [project]);
  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("crm_projects" as any).update({
        name, project_type: type || null, status, budget: parseFloat(budget) || null, description: notes || null,
      } as any).eq("id", projectId);
      if (error) throw error;
      toast({ title: "Project updated" }); onSaved();
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };
  return (
    <SlideInPanel open={open} onClose={onClose} title="Edit Project" subtitle={companyName}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button></>}>
      <div><Label>Project Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent className="bg-popover z-[9999]">
              <SelectItem value="consulting">Consulting</SelectItem><SelectItem value="recruitment">Recruitment</SelectItem><SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select></div>
        <div><Label>Stage</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover z-[9999]">
              <SelectItem value="active">Active</SelectItem><SelectItem value="paused">Paused</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select></div>
      </div>
      <div><Label>Budget (£)</Label><Input type="number" value={budget} onChange={e => setBudget(e.target.value)} /></div>
      <div><Label>Notes</Label><Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></div>
    </SlideInPanel>
  );
}

function LogActivityPanel({ open, onClose, companyId, companyName, defaultType, contacts, onSaved }: {
  open: boolean; onClose: () => void; companyId: string; companyName: string; defaultType: string; contacts: Contact[]; onSaved: () => void;
}) {
  const [type, setType] = useState(defaultType);
  const [subject, setSubject] = useState(""); const [body, setBody] = useState("");
  const [contactId, setContactId] = useState(""); const [saving, setSaving] = useState(false);
  const [flagValue, setFlagValue] = useState("");

  useEffect(() => { if (open) { setType(defaultType); setSubject(""); setBody(""); setContactId(""); setFlagValue(""); } }, [open, defaultType]);

  const isFlag = type === "task";
  const isTeamActivity = type === "call";

  const handleSave = async () => {
    if (!isFlag && !subject.trim()) { toast({ title: "Subject required", variant: "destructive" }); return; }
    if (isFlag && !flagValue) { toast({ title: "Select a flag", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("crm_activities" as any).insert({
        type: isFlag ? "task" : type,
        subject: isFlag ? `Account Flag: ${ACCOUNT_FLAGS.find(f => f.value === flagValue)?.label || flagValue}` : subject,
        body: body || null, company_id: companyId,
        contact_id: contactId && contactId !== "_none" ? contactId : null,
        status: type === "meeting" ? "scheduled" : "completed",
        direction: "outbound",
      } as any);
      if (error) throw error;
      toast({ title: isFlag ? "Account flag set" : "Activity logged" }); onSaved();
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const panelTitle = isFlag ? "Set Account Flag" : isTeamActivity ? "Log Team Activity" : type === "meeting" ? "Schedule Team Review" : "Add Account Note";

  return (
    <SlideInPanel open={open} onClose={onClose} title={panelTitle} subtitle={companyName}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : isFlag ? "Set Flag" : "Log Activity"}</Button></>}>
      {isFlag ? (
        <div className="space-y-3">
          <Label>Account Flag</Label>
          {ACCOUNT_FLAGS.map(f => (
            <button key={f.value} onClick={() => setFlagValue(f.value)}
              className={cn("w-full flex items-center gap-3 p-3 rounded-lg border text-sm text-left transition-colors",
                flagValue === f.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50")}>
              <f.icon className={cn("h-4 w-4", f.color)} />
              <span>{f.label}</span>
            </button>
          ))}
          <div><Label>Notes (optional)</Label><Textarea rows={2} value={body} onChange={e => setBody(e.target.value)} /></div>
        </div>
      ) : (
        <>
          {isTeamActivity && contacts.length > 0 && (
            <div><Label>Link to Contact</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger><SelectValue placeholder="Select contact (optional)" /></SelectTrigger>
                <SelectContent className="bg-popover z-[9999]">
                  <SelectItem value="_none">None — company level</SelectItem>
                  {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select></div>
          )}
          <div><Label>Subject <span className="text-red-500">*</span></Label><Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief description" /></div>
          <div><Label>Notes</Label><Textarea rows={3} value={body} onChange={e => setBody(e.target.value)} /></div>
        </>
      )}
    </SlideInPanel>
  );
}

function AddInvoicePanel({ open, onClose, companyId, companyName, onSaved }: {
  open: boolean; onClose: () => void; companyId: string; companyName: string; onSaved: () => void;
}) {
  const [invNumber, setInvNumber] = useState(""); const [total, setTotal] = useState("");
  const [dueDate, setDueDate] = useState(""); const [notes, setNotes] = useState(""); const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setInvNumber(""); setTotal(""); setDueDate(""); setNotes(""); } }, [open]);
  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("crm_invoices" as any).insert({
        company_id: companyId, invoice_number: invNumber || null, total: parseFloat(total) || 0,
        subtotal: parseFloat(total) || 0, vat_rate: 0, vat_amount: 0, currency: "GBP",
        due_date: dueDate || null, notes: notes || null, status: "draft",
      } as any);
      if (error) throw error;
      toast({ title: "Invoice created" }); onSaved();
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };
  return (
    <SlideInPanel open={open} onClose={onClose} title="Create Invoice" subtitle={companyName}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? "Creating…" : "Create Invoice"}</Button></>}>
      <div className="bg-muted/50 rounded-lg p-3 text-sm"><span className="text-muted-foreground">Company:</span> <span className="font-medium">{companyName}</span></div>
      <div><Label>Invoice Number</Label><Input value={invNumber} onChange={e => setInvNumber(e.target.value)} placeholder="INV-001" /></div>
      <div><Label>Total (£)</Label><Input type="number" value={total} onChange={e => setTotal(e.target.value)} /></div>
      <div><Label>Due Date</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
      <div><Label>Notes</Label><Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></div>
    </SlideInPanel>
  );
}

function AddLeadPanel({ open, onClose, companyId, companyName, onSaved }: {
  open: boolean; onClose: () => void; companyId: string; companyName: string; onSaved: () => void;
}) {
  const [title, setTitle] = useState(""); const [source, setSource] = useState("inbound");
  const [notes, setNotes] = useState(""); const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setTitle(""); setSource("inbound"); setNotes(""); } }, [open]);
  const handleSave = async () => {
    if (!title.trim()) { toast({ title: "Lead title required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("leads" as any).insert({
        title, source, notes: notes || null, company_id: companyId, status: "new",
      } as any);
      if (error) throw error;
      onSaved();
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };
  return (
    <SlideInPanel open={open} onClose={onClose} title="Capture Lead" subtitle={companyName}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Capture Lead"}</Button></>}>
      <div className="bg-muted/50 rounded-lg p-3 text-sm"><span className="text-muted-foreground">Company:</span> <span className="font-medium">{companyName}</span></div>
      <div><Label>Lead Title <span className="text-red-500">*</span></Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Infrastructure consulting opportunity" /></div>
      <div><Label>Source</Label>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent className="bg-popover z-[9999]">
            <SelectItem value="inbound">Inbound</SelectItem>
            <SelectItem value="referral">Referral</SelectItem>
            <SelectItem value="outbound">Outbound</SelectItem>
            <SelectItem value="job_board">Job Board</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select></div>
      <div><Label>Notes</Label><Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></div>
    </SlideInPanel>
  );
}
