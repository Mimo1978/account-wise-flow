import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuickCreateSelect, COMPANY_QUICK_FIELDS, CONTACT_QUICK_FIELDS } from "@/components/shared/QuickCreateSelect";
import { useCreateCrmDeal, useUpdateCrmDeal } from "@/hooks/use-crm-deals";
import { defaultProbabilityForStage } from "@/lib/deal-utils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { CrmDeal } from "@/types/crm";
import { cn } from "@/lib/utils";

type DealType = "contractor" | "permanent" | "consulting";

const DEAL_TYPES: { value: DealType; label: string; sub: string; active: string; ctx: string; ctxText: string }[] = [
  {
    value: "contractor",
    label: "Contractor",
    sub: "Day rate · timesheet · invoice",
    active: "border-amber-500 bg-amber-50 dark:bg-amber-950/30",
    ctx: "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200",
    ctxText: "Log weekly timesheets after placement. Monthly invoices generate automatically from approved days × day rate.",
  },
  {
    value: "permanent",
    label: "Permanent",
    sub: "One-off placement fee",
    active: "border-violet-500 bg-violet-50 dark:bg-violet-950/30",
    ctx: "bg-violet-50 border-violet-200 text-violet-900 dark:bg-violet-950/30 dark:border-violet-800 dark:text-violet-200",
    ctxText: "One invoice raised on placement. Enter salary and fee % — the invoice amount calculates automatically.",
  },
  {
    value: "consulting",
    label: "Consulting",
    sub: "Retainer · project · SOW",
    active: "border-blue-500 bg-blue-50 dark:bg-blue-950/30",
    ctx: "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-200",
    ctxText: "Links to a delivery project. Set up a billing plan on the project for recurring invoices or milestones.",
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: CrmDeal | null;
}

const empty = {
  deal_type: "contractor" as DealType,
  title: "", company_id: "", contact_id: "",
  candidate_id: "", candidate_name: "",
  day_rate: "", start_date: "", end_date: "", billing_email: "",
  salary: "", fee_percentage: "20",
  value: "", expected_close_date: "",
};

export function AddEditDealPanel({ open, onOpenChange, deal }: Props) {
  const isEdit = !!deal;
  const createMut = useCreateCrmDeal();
  const updateMut = useUpdateCrmDeal();
  const [form, setForm] = useState({ ...empty });
  const [candidateResults, setCandidateResults] = useState<any[]>([]);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (deal) {
      setForm({
        deal_type: ((deal as any).deal_type as DealType) || "contractor",
        title: deal.title || "",
        company_id: deal.company_id || "",
        contact_id: deal.contact_id || "",
        candidate_id: (deal as any).candidate_id || "",
        candidate_name: "",
        day_rate: (deal as any).day_rate ? String((deal as any).day_rate) : "",
        start_date: deal.start_date || "",
        end_date: deal.end_date || "",
        billing_email: (deal as any).billing_email || "",
        salary: (deal as any).salary ? String((deal as any).salary) : "",
        fee_percentage: (deal as any).fee_percentage ? String((deal as any).fee_percentage) : "20",
        value: String(deal.value ?? ""),
        expected_close_date: deal.expected_close_date || "",
      });
    } else {
      setForm({ ...empty });
      setCandidateSearch("");
      setCandidateResults([]);
    }
  }, [deal, open]);

  useEffect(() => {
    if (!candidateSearch.trim()) { setCandidateResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from("candidates" as any).select("id, name, current_title").ilike("name", `%${candidateSearch}%`).limit(8);
      setCandidateResults(data || []);
    }, 250);
    return () => clearTimeout(t);
  }, [candidateSearch]);

  const feeAmount = form.deal_type === "permanent" && form.salary && form.fee_percentage
    ? Math.round(Number(form.salary) * Number(form.fee_percentage) / 100)
    : null;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Deal name is required";
    if (!form.company_id) e.company_id = "Company is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const payload: any = {
      title: form.title,
      company_id: form.company_id || null,
      contact_id: form.contact_id || null,
      stage: "lead",
      probability: defaultProbabilityForStage("lead"),
      deal_type: form.deal_type,
      candidate_id: form.candidate_id || null,
      day_rate: form.day_rate ? parseFloat(form.day_rate) : null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      billing_email: form.billing_email || null,
      salary: form.salary ? parseFloat(form.salary) : null,
      fee_percentage: form.fee_percentage ? parseFloat(form.fee_percentage) : null,
      value: feeAmount || (form.value ? parseFloat(form.value) : 0),
      expected_close_date: form.expected_close_date || null,
      currency: "GBP",
      status: "active",
    };
    try {
      if (isEdit && deal) {
        await updateMut.mutateAsync({ id: deal.id, ...payload });
        toast({ title: "Deal updated" });
      } else {
        await createMut.mutateAsync(payload);
        toast({ title: "Deal created" });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const cfg = DEAL_TYPES.find(t => t.value === form.deal_type)!;
  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Deal" : "Create Deal"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update deal details" : "Pick a type — the form shows only what you need"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!isEdit && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {DEAL_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => set("deal_type", t.value)}
                    className={cn("rounded-lg border-2 p-2.5 text-center transition-all",
                      form.deal_type === t.value ? t.active : "border-border text-muted-foreground hover:border-muted-foreground/40")}>
                    <div className="text-sm font-semibold">{t.label}</div>
                    <div className="text-[10px] mt-0.5 opacity-70">{t.sub}</div>
                  </button>
                ))}
              </div>
              <p className={cn("text-xs rounded-md border px-3 py-2", cfg.ctx)}>{cfg.ctxText}</p>
            </>
          )}

          <div>
            <Label className="text-xs font-medium">Deal name *</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)}
              placeholder={form.deal_type === "contractor" ? "e.g. Richie McKern — Iseg contract" : form.deal_type === "permanent" ? "e.g. Senior Dev — Iseg perm" : "e.g. Q2 Consulting — Acme"}
              className="mt-1 h-9 text-sm" />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Company *</Label>
              <div className="mt-1">
                <QuickCreateSelect table="crm_companies" value={form.company_id}
                  onSelect={(id: string) => setForm(f => ({ ...f, company_id: id, contact_id: "" }))}
                  label="" placeholder="Search companies…" quickCreateFields={COMPANY_QUICK_FIELDS}
                  quickCreateHint="Complete company details in Companies later." error={errors.company_id} />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium">Contact (hiring manager)</Label>
              <div className="mt-1">
                <QuickCreateSelect table="crm_contacts" value={form.contact_id}
                  onSelect={(id: string) => setForm(f => ({ ...f, contact_id: id }))}
                  companyId={form.company_id || undefined}
                  label="" placeholder="Search contacts…" quickCreateFields={CONTACT_QUICK_FIELDS}
                  quickCreateHint="Full details in Contacts." />
              </div>
            </div>
          </div>

          {(form.deal_type === "contractor" || form.deal_type === "permanent") && (
            <div>
              <Label className="text-xs font-medium">Candidate</Label>
              {form.candidate_id ? (
                <div className="mt-1 flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <span className="flex-1">{form.candidate_name}</span>
                  <button type="button" onClick={() => setForm(f => ({ ...f, candidate_id: "", candidate_name: "" }))}
                    className="text-xs text-muted-foreground hover:text-foreground">✕</button>
                </div>
              ) : (
                <div className="relative mt-1">
                  <Input value={candidateSearch} onChange={e => setCandidateSearch(e.target.value)}
                    placeholder="Search talent database…" className="h-9 text-sm" />
                  {candidateResults.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-48 overflow-y-auto">
                      {candidateResults.map((c: any) => (
                        <button key={c.id} type="button"
                          onClick={() => { setForm(f => ({ ...f, candidate_id: c.id, candidate_name: c.name })); setCandidateSearch(""); setCandidateResults([]); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between items-center">
                          <span>{c.name}</span>
                          <span className="text-xs text-muted-foreground">{c.current_title || "—"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {form.deal_type === "contractor" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Day rate (GBP)</Label>
                  <Input type="number" value={form.day_rate} onChange={e => set("day_rate", e.target.value)} placeholder="650" className="mt-1 h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs font-medium">Billing email (accounts)</Label>
                  <Input value={form.billing_email} onChange={e => set("billing_email", e.target.value)} placeholder="accounts@client.com" className="mt-1 h-9 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs font-medium">Start date</Label><Input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} className="mt-1 h-9 text-sm" /></div>
                <div><Label className="text-xs font-medium">End date</Label><Input type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} className="mt-1 h-9 text-sm" /></div>
              </div>
            </>
          )}

          {form.deal_type === "permanent" && (
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs font-medium">Annual salary (GBP)</Label><Input type="number" value={form.salary} onChange={e => set("salary", e.target.value)} placeholder="75000" className="mt-1 h-9 text-sm" /></div>
              <div>
                <Label className="text-xs font-medium">
                  Fee %{feeAmount ? <span className="text-muted-foreground ml-1">→ £{feeAmount.toLocaleString()}</span> : ""}
                </Label>
                <Input type="number" value={form.fee_percentage} onChange={e => set("fee_percentage", e.target.value)} className="mt-1 h-9 text-sm" />
              </div>
              <div><Label className="text-xs font-medium">Start date</Label><Input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} className="mt-1 h-9 text-sm" /></div>
            </div>
          )}

          {form.deal_type === "consulting" && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-medium">Deal value (GBP)</Label><Input type="number" value={form.value} onChange={e => set("value", e.target.value)} placeholder="50000" className="mt-1 h-9 text-sm" /></div>
              <div><Label className="text-xs font-medium">Expected close</Label><Input type="date" value={form.expected_close_date} onChange={e => set("expected_close_date", e.target.value)} className="mt-1 h-9 text-sm" /></div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : isEdit ? "Update deal" : `Create ${form.deal_type} deal`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
