import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCrmDeal, DEAL_STATUS_LABELS, DEAL_STATUS_COLORS } from "@/hooks/use-crm-deals";
import { useCrmDocuments, useUpdateCrmDocument, getSignedDocumentUrl, DOC_TYPE_LABELS, DOC_STATUS_LABELS, DOC_STATUS_COLORS } from "@/hooks/use-crm-documents";
import { useCrmInvoices, INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, getDisplayStatus } from "@/hooks/use-crm-invoices";
import { AddEditDealPanel } from "@/components/crm/AddEditDealPanel";
import { CrmDocumentUploadModal } from "@/components/crm/CrmDocumentUploadModal";
import { CreateCrmInvoicePanel } from "@/components/crm/CreateCrmInvoicePanel";
import { toast } from "@/hooks/use-toast";
import { Pencil, ArrowLeft, Loader2, ExternalLink, Upload, Send, CheckCircle, FileText, Download, Plus } from "lucide-react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function CrmDealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: deal, isLoading } = useCrmDeal(id);
  const { data: docs = [] } = useCrmDocuments({ deal_id: id });
  const { data: invoices = [] } = useCrmInvoices({ deal_id: id });
  const updateDoc = useUpdateCrmDocument();
  const [editOpen, setEditOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!deal) return <div className="p-6 text-muted-foreground">Deal not found</div>;

  const currencySymbol = deal.currency === "GBP" ? "£" : deal.currency === "USD" ? "$" : "€";

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

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/crm/deals")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{deal.title}</h1>
            <Badge variant="secondary" className={DEAL_STATUS_COLORS[deal.status]}>{DEAL_STATUS_LABELS[deal.status]}</Badge>
            <span className="text-lg font-semibold text-foreground">{currencySymbol}{deal.value.toLocaleString()}</span>
          </div>
          {deal.crm_companies && (
            <span className="text-sm text-primary cursor-pointer hover:underline" onClick={() => navigate(`/crm/companies/${deal.crm_companies!.id}`)}>
              {deal.crm_companies.name} <ExternalLink className="inline h-3 w-3" />
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
          <TabsTrigger value="documents">Documents ({docs.length})</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
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
    </div>
  );
}
