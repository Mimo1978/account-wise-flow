import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useCreateCrmInvoice, VAT_RATES } from "@/hooks/use-crm-invoices";
import { useCreateCrmInvoiceLineItem } from "@/hooks/use-crm-invoice-line-items";
import { useCrmDeals } from "@/hooks/use-crm-deals";
import { Plus, Trash2 } from "lucide-react";
import { format, addDays } from "date-fns";
import { useNavigate } from "react-router-dom";

interface LineItemDraft {
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDealId?: string;
}

export function CreateCrmInvoicePanel({ open, onOpenChange, defaultDealId }: Props) {
  const navigate = useNavigate();
  const { data: deals = [] } = useCrmDeals();
  const createInvoice = useCreateCrmInvoice();
  const createLineItem = useCreateCrmInvoiceLineItem();

  const [dealId, setDealId] = useState(defaultDealId || "");
  const [issueDate, setIssueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItemDraft[]>([
    { description: "", quantity: 1, unit_price: 0, vat_rate: 20 },
  ]);

  const selectedDeal = useMemo(() => deals.find(d => d.id === dealId), [deals, dealId]);

  // Auto-fill from deal
  useEffect(() => {
    if (selectedDeal) {
      setCurrency(selectedDeal.currency || "GBP");
      const terms = selectedDeal.payment_terms;
      let days = 30;
      if (terms === "60 days") days = 60;
      else if (terms === "upfront") days = 0;
      else if (terms === "monthly") days = 30;
      setDueDate(format(addDays(new Date(issueDate), days), "yyyy-MM-dd"));
    }
  }, [selectedDeal, issueDate]);

  useEffect(() => {
    if (defaultDealId) setDealId(defaultDealId);
  }, [defaultDealId]);

  const lineTotal = (l: LineItemDraft) => l.quantity * l.unit_price;
  const lineVat = (l: LineItemDraft) => lineTotal(l) * (l.vat_rate / 100);
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const totalVat = lines.reduce((s, l) => s + lineVat(l), 0);
  const total = subtotal + totalVat;

  const updateLine = (idx: number, field: keyof LineItemDraft, value: any) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const addLine = () => setLines(prev => [...prev, { description: "", quantity: 1, unit_price: 0, vat_rate: 20 }]);
  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));

  const currencySymbol = currency === "GBP" ? "£" : currency === "USD" ? "$" : "€";

  const handleSave = async (status: "draft" | "sent") => {
    if (!dealId) { toast({ title: "Deal is required", variant: "destructive" }); return; }
    if (!issueDate) { toast({ title: "Issue date is required", variant: "destructive" }); return; }
    if (lines.some(l => !l.description.trim())) { toast({ title: "All line items need a description", variant: "destructive" }); return; }

    try {
      const companyId = selectedDeal?.company_id || null;
      const invoice = await createInvoice.mutateAsync({
        deal_id: dealId,
        company_id: companyId,
        issue_date: issueDate,
        due_date: dueDate || null,
        currency,
        subtotal,
        vat_rate: 0, // stored per line
        vat_amount: totalVat,
        total,
        status,
        notes: notes || null,
      } as any);

      // Create line items
      for (const l of lines) {
        await createLineItem.mutateAsync({
          invoice_id: (invoice as any).id,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          vat_rate: l.vat_rate,
          line_total: lineTotal(l),
        } as any);
      }

      toast({ title: status === "sent" ? "Invoice created & sent" : "Invoice saved as draft" });
      onOpenChange(false);
      navigate(`/crm/invoices/${(invoice as any).id}`);
    } catch (err: any) {
      toast({ title: "Error creating invoice", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create Invoice</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Deal */}
          <div>
            <Label>Linked Deal *</Label>
            <Select value={dealId} onValueChange={setDealId}>
              <SelectTrigger><SelectValue placeholder="Select deal" /></SelectTrigger>
              <SelectContent className="bg-popover z-[9999]">
                {deals.map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.title} {d.crm_companies ? `(${d.crm_companies.name})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedDeal?.crm_companies && (
            <div>
              <Label>Company</Label>
              <Input value={selectedDeal.crm_companies.name} readOnly className="bg-muted" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Issue Date *</Label>
              <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover z-[9999]">
                <SelectItem value="GBP">GBP (£)</SelectItem>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-semibold">Line Items</Label>
              <Button variant="outline" size="sm" onClick={addLine}><Plus className="h-3 w-3 mr-1" /> Add Line</Button>
            </div>
            <div className="space-y-3">
              {lines.map((line, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <Input placeholder="Description *" value={line.description} onChange={e => updateLine(idx, "description", e.target.value)} />
                    </div>
                    {lines.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeLine(idx)} className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Qty</Label>
                      <Input type="number" min={1} value={line.quantity} onChange={e => updateLine(idx, "quantity", Number(e.target.value) || 0)} />
                    </div>
                    <div>
                      <Label className="text-xs">Unit Price</Label>
                      <Input type="number" min={0} step={0.01} value={line.unit_price} onChange={e => updateLine(idx, "unit_price", Number(e.target.value) || 0)} />
                    </div>
                    <div>
                      <Label className="text-xs">VAT Rate</Label>
                      <Select value={String(line.vat_rate)} onValueChange={v => updateLine(idx, "vat_rate", Number(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover z-[9999]">
                          {VAT_RATES.map(r => <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    Line: {currencySymbol}{lineTotal(line).toFixed(2)} + VAT {currencySymbol}{lineVat(line).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border rounded-lg p-4 bg-muted/20 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{currencySymbol}{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total VAT</span>
              <span>{currencySymbol}{totalVat.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
              <span>Total (inc. VAT)</span>
              <span>{currencySymbol}{total.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea placeholder="Payment instructions, bank details…" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" variant="outline" onClick={() => handleSave("draft")} disabled={createInvoice.isPending}>
              Save as Draft
            </Button>
            <Button className="flex-1" onClick={() => handleSave("sent")} disabled={createInvoice.isPending}>
              Save & Send
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
