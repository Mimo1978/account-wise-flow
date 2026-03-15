import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuickCreateSelect, COMPANY_QUICK_FIELDS, CONTACT_QUICK_FIELDS } from "@/components/shared/QuickCreateSelect";
import { useCreateCrmDeal, useUpdateCrmDeal, PAYMENT_TERMS } from "@/hooks/use-crm-deals";
import { useUpdateCrmOpportunity } from "@/hooks/use-crm-opportunities";
import { useCrmOpportunities } from "@/hooks/use-crm-opportunities";
import { defaultProbabilityForStage } from "@/lib/deal-utils";
import { toast } from "@/hooks/use-toast";
import type { CrmDeal } from "@/types/crm";
import { cn } from "@/lib/utils";

const CURRENCIES = ["GBP", "USD", "EUR"];
const SOURCES = [
  { value: "inbound", label: "Inbound — they came to us" },
  { value: "outbound", label: "Outbound — we reached out" },
  { value: "referral", label: "Referral — introduced by someone" },
  { value: "existing_client", label: "Existing client — repeat/expansion" },
  { value: "event", label: "Event — met at an event" },
  { value: "other", label: "Other" },
];
const STATUSES = ["active", "complete", "cancelled"];
const STAGES = [
  { value: "lead", label: "Lead", color: "bg-blue-500" },
  { value: "qualified", label: "Qualified", color: "bg-purple-500" },
  { value: "proposal", label: "Proposal", color: "bg-amber-500" },
  { value: "negotiation", label: "Negotiation", color: "bg-orange-500" },
  { value: "won", label: "Won", color: "bg-green-500" },
  { value: "lost", label: "Lost", color: "bg-red-500" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: CrmDeal | null;
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
  const { data: opps = [] } = useCrmOpportunities();

  

  const [form, setForm] = useState({
    title: "",
    company_id: "",
    contact_id: "",
    opportunity_id: "",
    value: "",
    currency: "GBP",
    stage: "lead",
    probability: "10",
    signed_date: "",
    start_date: "",
    end_date: "",
    expected_close_date: "",
    payment_terms: "",
    status: "active",
    notes: "",
    project_id: "",
    source: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [probManual, setProbManual] = useState(false);

  useEffect(() => {
    if (deal) {
      setForm({
        title: deal.title || "",
        company_id: deal.company_id || "",
        contact_id: deal.contact_id || "",
        opportunity_id: deal.opportunity_id || "",
        value: String(deal.value ?? ""),
        currency: deal.currency || "GBP",
        stage: deal.stage || "lead",
        probability: String(deal.probability ?? defaultProbabilityForStage(deal.stage || "lead")),
        signed_date: deal.signed_date || "",
        start_date: deal.start_date || "",
        end_date: deal.end_date || "",
        expected_close_date: deal.expected_close_date || "",
        payment_terms: deal.payment_terms || "",
        status: deal.status || "active",
        notes: deal.notes || "",
        project_id: deal.project_id || "",
        source: (deal as any).source || "",
      });
      setProbManual(false);
    } else if (fromOpportunity) {
      setForm({
        title: fromOpportunity.title,
        company_id: fromOpportunity.company_id || "",
        contact_id: "",
        opportunity_id: fromOpportunity.id,
        value: String(fromOpportunity.value),
        currency: fromOpportunity.currency,
        stage: "lead",
        probability: "10",
        signed_date: new Date().toISOString().split("T")[0],
        start_date: "",
        end_date: "",
        expected_close_date: "",
        payment_terms: "",
        status: "active",
        notes: "",
        project_id: "",
        source: "",
      });
      setProbManual(false);
    } else {
      setForm({
        title: "", company_id: "", contact_id: "", opportunity_id: "", value: "",
        currency: "GBP", stage: "lead", probability: "10",
        signed_date: "", start_date: "", end_date: "", expected_close_date: "",
        payment_terms: "", status: "active", notes: "", project_id: "", source: "",
      });
      setProbManual(false);
    }
  }, [deal, fromOpportunity, open]);

  const handleStageChange = (stage: string) => {
    setForm(f => ({
      ...f,
      stage,
      probability: probManual ? f.probability : String(defaultProbabilityForStage(stage)),
    }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.company_id) e.company_id = "Company is required";
    if (!form.value || isNaN(Number(form.value))) e.value = "Valid value is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const payload: any = {
      title: form.title,
      company_id: form.company_id || null,
      contact_id: form.contact_id || null,
      opportunity_id: form.opportunity_id || null,
      value: parseFloat(form.value),
      currency: form.currency,
      stage: form.stage,
      probability: parseInt(form.probability) || 0,
      signed_date: form.signed_date || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      expected_close_date: form.expected_close_date || null,
      payment_terms: form.payment_terms || null,
      status: form.status,
      notes: form.notes || null,
      project_id: form.project_id || null,
    };
    try {
      if (isEdit && deal) {
        await updateMut.mutateAsync({ id: deal.id, ...payload });
        toast({ title: "Deal updated" });
      } else {
        await createMut.mutateAsync(payload);
        if (form.opportunity_id) {
          try { await updateOpp.mutateAsync({ id: form.opportunity_id, stage: "closed_won", probability: 100 }); } catch { /* ignore */ }
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[70vw] max-h-[80vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>{isEdit ? "Edit Deal" : "Create Deal"}</DialogTitle>
          <DialogDescription className="sr-only">{isEdit ? "Edit deal details" : "Create a new deal"}</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-5">
          {/* Two-column layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {/* Left column */}
            <div className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
              </div>

              <QuickCreateSelect
                table="crm_companies"
                value={form.company_id || null}
                onChange={(id) => setForm(f => ({ ...f, company_id: id, contact_id: "" }))}
                label="Company"
                required
                placeholder="Search companies…"
                quickCreateFields={COMPANY_QUICK_FIELDS}
                quickCreateHint="You can complete all company details in the Companies tab later."
                error={errors.company_id}
              />

              <QuickCreateSelect
                table="crm_contacts"
                value={form.contact_id || null}
                onChange={(id) => setForm(f => ({ ...f, contact_id: id }))}
                companyId={form.company_id || undefined}
                label="Key Contact (optional)"
                placeholder="Search contacts…"
                quickCreateFields={CONTACT_QUICK_FIELDS}
                quickCreateHint="Full contact details can be added in Contacts."
              />
            </div>

            {/* Right column */}
            <div className="space-y-4">
              <div>
                <Label>Stage</Label>
                <Select value={form.stage} onValueChange={handleStageChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover z-[9999]">
                    {STAGES.map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        <span className="flex items-center gap-2">
                          <span className={cn("w-2.5 h-2.5 rounded-full", s.color)} />
                          {s.label}
                        </span>
                      </SelectItem>
                    ))}
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

              <div>
                <Label>Probability (%)</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min="0" max="100" value={form.probability}
                    onChange={e => { setForm(f => ({ ...f, probability: e.target.value })); setProbManual(true); }}
                    className="w-24"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                  {probManual && (
                    <button className="text-xs text-primary hover:underline"
                      onClick={() => { setForm(f => ({ ...f, probability: String(defaultProbabilityForStage(f.stage)) })); setProbManual(false); }}>
                      Reset to default
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Full width rows */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>Expected Close</Label>
              <Input type="date" value={form.expected_close_date} onChange={e => setForm(f => ({ ...f, expected_close_date: e.target.value }))} />
            </div>
            <div>
              <Label>Signed Date</Label>
              <Input type="date" value={form.signed_date} onChange={e => setForm(f => ({ ...f, signed_date: e.target.value }))} />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Payment Terms</Label>
              <Select value={form.payment_terms || "_none"} onValueChange={v => setForm(f => ({ ...f, payment_terms: v === "_none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent className="bg-popover z-[9999]">
                  <SelectItem value="_none">None</SelectItem>
                  {PAYMENT_TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
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
          </div>

          <div>
            <Label>Linked Opportunity</Label>
            <Select value={form.opportunity_id || "_none"} onValueChange={v => setForm(f => ({ ...f, opportunity_id: v === "_none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Select opportunity" /></SelectTrigger>
              <SelectContent className="bg-popover z-[9999]">
                <SelectItem value="_none">None</SelectItem>
                {opps.map(o => <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea rows={4} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>

        <DialogFooter className="px-6 pb-6 pt-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : isEdit ? "Update" : "Create Deal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
