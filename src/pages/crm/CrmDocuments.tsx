import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, FileText, Download, Send, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCrmDocuments, useUpdateCrmDocument, getSignedDocumentUrl, DOC_TYPE_LABELS, DOC_STATUS_LABELS, DOC_STATUS_COLORS } from "@/hooks/use-crm-documents";
import { useCrmCompanies } from "@/hooks/use-crm-companies";
import { CrmDocumentUploadModal } from "@/components/crm/CrmDocumentUploadModal";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { CrmDocumentType } from "@/types/crm";

const DOC_TYPES: CrmDocumentType[] = ["sow", "contract", "proposal", "nda", "invoice", "other"];

export default function CrmDocumentsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: docs = [], isLoading } = useCrmDocuments({
    search: search || undefined,
    type: typeFilter || undefined,
    status: statusFilter || undefined,
    company_id: companyFilter || undefined,
  });
  const { data: companies = [] } = useCrmCompanies();
  const updateDoc = useUpdateCrmDocument();

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

  const handleDownload = async (fileUrl: string) => {
    const url = await getSignedDocumentUrl(fileUrl);
    if (url) window.open(url, "_blank");
    else toast({ title: "Failed to generate link", variant: "destructive" });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Documents</h1>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Upload Document
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search documents…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={v => setTypeFilter(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent className="bg-popover z-[9999]">
            <SelectItem value="_all">All Types</SelectItem>
            {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent className="bg-popover z-[9999]">
            <SelectItem value="_all">All Statuses</SelectItem>
            {Object.entries(DOC_STATUS_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={companyFilter} onValueChange={v => setCompanyFilter(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Company" /></SelectTrigger>
          <SelectContent className="bg-popover z-[9999]">
            <SelectItem value="_all">All Companies</SelectItem>
            {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Deal</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Signed</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : docs.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No documents found</TableCell></TableRow>
            ) : docs.map(doc => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium">{doc.title}</TableCell>
                <TableCell><Badge variant="outline">{DOC_TYPE_LABELS[doc.type]}</Badge></TableCell>
                <TableCell>
                  {doc.crm_companies ? (
                    <span className="text-primary cursor-pointer hover:underline" onClick={() => navigate(`/crm/companies/${doc.crm_companies!.id}`)}>
                      {doc.crm_companies.name}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  {doc.crm_deals ? (
                    <span className="text-primary cursor-pointer hover:underline" onClick={() => navigate(`/crm/deals/${doc.crm_deals!.id}`)}>
                      {doc.crm_deals.title}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell>v{doc.version}</TableCell>
                <TableCell><Badge variant="secondary" className={DOC_STATUS_COLORS[doc.status]}>{DOC_STATUS_LABELS[doc.status]}</Badge></TableCell>
                <TableCell>{doc.sent_at ? format(new Date(doc.sent_at), "dd MMM yyyy") : "—"}</TableCell>
                <TableCell>{doc.signed_at ? format(new Date(doc.signed_at), "dd MMM yyyy") : "—"}</TableCell>
                <TableCell>{format(new Date(doc.created_at), "dd MMM yyyy")}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {doc.file_url && (
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(doc.file_url!)} title="Download">
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    {doc.status === "draft" && (
                      <Button variant="ghost" size="sm" onClick={() => handleMarkSent(doc.id)}>
                        <Send className="h-4 w-4 mr-1" /> Send
                      </Button>
                    )}
                    {doc.status === "sent" && (
                      <Button variant="ghost" size="sm" onClick={() => handleMarkSigned(doc.id)}>
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

      <CrmDocumentUploadModal open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}
