import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCrmDeal, useUpdateCrmDeal, PAYMENT_TERMS } from "@/hooks/use-crm-deals";
import { useUpdateCrmOpportunity } from "@/hooks/use-crm-opportunities";
import { useCrmCompanies } from "@/hooks/use-crm-companies";
import { useCrmOpportunities } from "@/hooks/use-crm-opportunities";
import { toast } from "@/hooks/use-toast";
import type { CrmDeal } from "@/types/crm";

const CURRENCIES = ["GBP", "USD", "EUR"];
const STATUSES = ["active", "complete", "cancelled"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: CrmDeal | null;
  /** Pre-populate from opportunity conversion */
  fromOpportunity?: {
    id: string;
    title: string;
    company_id: string | null;
    value: number;
    currency: string;
  } | null;
}

export function AddEditDealPanel({ open, onOpenChange, deal, fromOpportunity }: Props) {
  const isEdit = !!deal;
  const createMut = useCreateCrmDeal();
  const updateMut = useUpdateCrmDeal();
  const updateOpp = useUpdateCrmOpportunity();
  const { data: companies = [] } = useCrmCompanies();
  const { data: opps = [] } = useCrmOpportunities();

  const [form, setForm] = useState({
    title: "",
    company_id: "",
    opportunity_id: "",
    value: "",
    currency: "GBP",
    signed_date: "",
    start_date: "",
    end_date: "",
    payment_terms: "",
    status: "active",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (deal) {
      setForm({
        title: deal.title || "",
        company_id: deal.company_id || "",
        opportunity_id: deal.opportunity_id || "",
        value: String(deal.value ?? ""),
        currency: deal.currency || "GBP",
        signed_date: deal.signed_date || "",
        start_date: deal.start_date || "",
        end_date: deal.end_date || "",
        payment_terms: deal.payment_terms || "",
        status: deal.status || "active",
        notes: deal.notes || "",
      });
    } else if (fromOpportunity) {
      setForm({
        title: fromOpportunity.title,
        company_id: fromOpportunity.company_id || "",
        opportunity_id: fromOpportunity.id,
        value: String(fromOpportunity.value),
        currency: fromOpportunity.currency,
        signed_date: new Date().toISOString().split("T")[0],
        start_date: "",
        end_date: "",
        payment_terms: "",
        status: "active",
        notes: "",
      });
    } else {
      setForm({
        title: "", company_id: "", opportunity_id: "", value: "",
        currency: "GBP", signed_date: "", start_date: "", end_date: "",
        payment_terms: "", status: "active", notes: "",
      });
    }
  }, [deal, fromOpportunity, open]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.company_id) e.company_id = "Company is required";
    if (!form.value || isNaN(Number(form.value))) e.value = "Valid value is required";
    if (!form.start_date) e.start_date = "Start date is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const payload: any = {
      title: form.title,
      company_id: form.company_id || null,
      opportunity_id: form.opportunity_id || null,
      value: parseFloat(form.value),
      currency: form.currency,
      signed_date: form.signed_date || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      payment_terms: form.payment_terms || null,
      status: form.status,
      notes: form.notes || null,
    };
    try {
      if (isEdit && deal) {
        await updateMut.mutateAsync({ id: deal.id, ...payload });
        toast({ title: "Deal updated" });
      } else {
        await createMut.mutateAsync(payload);
        // Auto-update linked opportunity to closed_won
        if (form.opportunity_id) {
          try {
            await updateOpp.mutateAsync({ id: form.opportunity_id, stage: "closed_won", probability: 100 });
          } catch { /* ignore if already closed */ }
        }
        toast({ title: "Deal created" });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Deal" : "Create Deal"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
          </div>

          <div>
            <Label>Company *</Label>
            <Select value={form.company_id} onValueChange={v => setForm(f => ({ ...f, company_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
              <SelectContent className="bg-popover z-[9999]">
                {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.company_id && <p className="text-xs text-destructive mt-1">{errors.company_id}</p>}
          </div>

          <div>
            <Label>Linked Opportunity</Label>
            <Select value={form.opportunity_id} onValueChange={v => setForm(f => ({ ...f, opportunity_id: v === "_none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Select opportunity" /></SelectTrigger>
              <SelectContent className="bg-popover z-[9999]">
                <SelectItem value="_none">None</SelectItem>
                {opps.map(o => <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Value *</Label>
              <Input type="number" min="0" step="0.01" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
              {errors.value && <p className="text-xs text-destructive mt-1">{errors.value}</p>}
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover z-[9999]">
                  {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Signed Date</Label>
              <Input type="date" value={form.signed_date} onChange={e => setForm(f => ({ ...f, signed_date: e.target.value }))} />
            </div>
            <div>
              <Label>Start Date *</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              {errors.start_date && <p className="text-xs text-destructive mt-1">{errors.start_date}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>End Date</Label>
              <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
            <div>
              <Label>Payment Terms</Label>
              <Select value={form.payment_terms} onValueChange={v => setForm(f => ({ ...f, payment_terms: v === "_none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent className="bg-popover z-[9999]">
                  <SelectItem value="_none">None</SelectItem>
                  {PAYMENT_TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover z-[9999]">
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : isEdit ? "Update" : "Create Deal"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
