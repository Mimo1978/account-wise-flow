import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCrmInvoice, useUpdateCrmInvoice, INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, getDisplayStatus, getCrmInvoiceSignedUrl } from "@/hooks/use-crm-invoices";
import { useCrmInvoiceLineItems } from "@/hooks/use-crm-invoice-line-items";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, Pencil, Download, Send, CheckCircle, XCircle, ExternalLink, ChevronLeft } from "lucide-react";
import { format } from "date-fns";

export default function CrmInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: invoice, isLoading } = useCrmInvoice(id);
  const { data: lineItems = [] } = useCrmInvoiceLineItems(id);
  const updateInvoice = useUpdateCrmInvoice();

  const [paidModalOpen, setPaidModalOpen] = useState(false);
  const [paidDate, setPaidDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paymentMethod, setPaymentMethod] = useState("bank transfer");
  const [pdfLoading, setPdfLoading] = useState(false);

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!invoice) return <div className="p-6 text-muted-foreground">Invoice not found</div>;

  const displayStatus = getDisplayStatus(invoice);
  const currencySymbol = invoice.currency === "GBP" ? "£" : invoice.currency === "USD" ? "$" : "€";

  const handleSend = async () => {
    try {
      await updateInvoice.mutateAsync({ id: invoice.id, status: "sent" } as any);
      toast({ title: "Invoice marked as Sent" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleMarkPaid = async () => {
    try {
      await updateInvoice.mutateAsync({
        id: invoice.id,
        status: "paid",
        paid_at: new Date(paidDate).toISOString(),
        payment_method: paymentMethod,
      } as any);
      setPaidModalOpen(false);
      toast({ title: "Invoice marked as Paid" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleCancel = async () => {
    try {
      await updateInvoice.mutateAsync({ id: invoice.id, status: "cancelled" } as any);
      toast({ title: "Invoice cancelled" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("crm-invoice-pdf", {
        body: { invoice_id: invoice.id },
      });
      if (error) throw error;

      if (data?.storage_path) {
        const url = await getCrmInvoiceSignedUrl(data.storage_path);
        if (url) window.open(url, "_blank");
        else toast({ title: "Could not generate download link", variant: "destructive" });
      } else if (data?.html) {
        // Fallback: open HTML in new tab
        const blob = new Blob([data.html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      }
      toast({ title: "Invoice PDF generated" });
    } catch (err: any) {
      toast({ title: "PDF generation failed", description: err.message, variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="
            inline-flex items-center gap-1.5
            text-sm font-medium
            text-foreground
            px-2 py-1 -ml-2 rounded-md
            transition-all duration-150
            hover:bg-accent
            border-l-2 border-transparent
            hover:border-primary
            group
          "
        >
          <ChevronLeft className="h-4 w-4 transition-transform duration-150 group-hover:-translate-x-0.5" />
          Back
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{invoice.invoice_number || "Draft Invoice"}</h1>
            <Badge variant="secondary" className={INVOICE_STATUS_COLORS[displayStatus]}>
              {INVOICE_STATUS_LABELS[displayStatus]}
            </Badge>
            <span className="text-lg font-semibold">{currencySymbol}{invoice.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            {invoice.crm_companies && (
              <span className="text-primary cursor-pointer hover:underline" onClick={() => navigate(`/companies/${invoice.crm_companies!.id}`)}>
                {invoice.crm_companies.name} <ExternalLink className="inline h-3 w-3" />
              </span>
            )}
            {invoice.crm_deals && (
              <span className="text-primary cursor-pointer hover:underline" onClick={() => navigate(`/crm/deals/${invoice.crm_deals!.id}`)}>
                Deal: {invoice.crm_deals.title} <ExternalLink className="inline h-3 w-3" />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {invoice.status === "draft" && (
          <Button variant="outline" onClick={handleSend}><Send className="h-4 w-4 mr-1" /> Send</Button>
        )}
        <Button variant="outline" onClick={handleDownloadPdf} disabled={pdfLoading}>
          <Download className="h-4 w-4 mr-1" /> {pdfLoading ? "Generating…" : "Download PDF"}
        </Button>
        {(invoice.status === "sent" || displayStatus === "overdue") && (
          <Button variant="outline" onClick={() => setPaidModalOpen(true)}>
            <CheckCircle className="h-4 w-4 mr-1" /> Mark Paid
          </Button>
        )}
        {invoice.status !== "paid" && invoice.status !== "cancelled" && (
          <Button variant="ghost" className="text-destructive" onClick={handleCancel}>
            <XCircle className="h-4 w-4 mr-1" /> Cancel
          </Button>
        )}
      </div>

      {/* Invoice preview */}
      <Card>
        <CardContent className="py-6">
          {/* Dates */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
            <div>
              <span className="text-muted-foreground">Issue Date</span>
              <p className="font-medium">{invoice.issue_date ? format(new Date(invoice.issue_date), "dd MMM yyyy") : "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Due Date</span>
              <p className="font-medium">{invoice.due_date ? format(new Date(invoice.due_date), "dd MMM yyyy") : "—"}</p>
            </div>
            {invoice.paid_at && (
              <div>
                <span className="text-muted-foreground">Paid Date</span>
                <p className="font-medium">{format(new Date(invoice.paid_at), "dd MMM yyyy")}</p>
              </div>
            )}
            {invoice.payment_method && (
              <div>
                <span className="text-muted-foreground">Payment Method</span>
                <p className="font-medium capitalize">{invoice.payment_method}</p>
              </div>
            )}
          </div>

          {/* Line items table */}
          <div className="border rounded-lg overflow-auto mb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">VAT %</TableHead>
                  <TableHead className="text-right">VAT Amount</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">No line items</TableCell></TableRow>
                ) : lineItems.map((li, idx) => (
                  <TableRow key={li.id} className={idx % 2 === 1 ? "bg-muted/30" : ""}>
                    <TableCell>{li.description}</TableCell>
                    <TableCell className="text-center">{li.quantity}</TableCell>
                    <TableCell className="text-right">{currencySymbol}{li.unit_price.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{li.vat_rate}%</TableCell>
                    <TableCell className="text-right">{currencySymbol}{(li.line_total * li.vat_rate / 100).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">{currencySymbol}{li.line_total.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-72 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{currencySymbol}{invoice.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total VAT</span>
                <span>{currencySymbol}{invoice.vat_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                <span>Total</span>
                <span>{currencySymbol}{invoice.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="mt-6 p-4 bg-muted/30 rounded-lg border-l-4 border-primary/30">
              <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mark Paid Modal */}
      <Dialog open={paidModalOpen} onOpenChange={setPaidModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Invoice as Paid</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Payment Date *</Label>
              <Input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} />
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover z-[9999]">
                  <SelectItem value="bank transfer">Bank Transfer</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaidModalOpen(false)}>Cancel</Button>
            <Button onClick={handleMarkPaid} disabled={updateInvoice.isPending}>Confirm Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
