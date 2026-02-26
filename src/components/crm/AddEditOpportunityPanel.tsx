import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCrmOpportunity, useUpdateCrmOpportunity, STAGE_ORDER, STAGE_LABELS, STAGE_PROBABILITY } from "@/hooks/use-crm-opportunities";
import { useCrmCompanies } from "@/hooks/use-crm-companies";
import { useCrmProjects } from "@/hooks/use-crm-projects";
import { useCrmContacts } from "@/hooks/use-crm-contacts";
import { toast } from "@/hooks/use-toast";
import type { CrmOpportunity, CrmOpportunityStage } from "@/types/crm";

const CURRENCIES = ["GBP", "USD", "EUR"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity?: CrmOpportunity | null;
  defaultCompanyId?: string;
  defaultProjectId?: string;
}

export function AddEditOpportunityPanel({ open, onOpenChange, opportunity, defaultCompanyId, defaultProjectId }: Props) {
  const isEdit = !!opportunity;
  const createMut = useCreateCrmOpportunity();
  const updateMut = useUpdateCrmOpportunity();
  const { data: companies = [] } = useCrmCompanies();

  const [form, setForm] = useState({
    title: "",
    company_id: defaultCompanyId || "",
    project_id: defaultProjectId || "",
    contact_id: "",
    value: "",
    currency: "GBP",
    stage: "lead" as CrmOpportunityStage,
    probability: "10",
    expected_close_date: "",
    notes: "",
  });

  const { data: projects = [] } = useCrmProjects({ company_id: form.company_id || undefined });
  const { data: contacts = [] } = useCrmContacts({ company_id: form.company_id || undefined });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (opportunity) {
      setForm({
        title: opportunity.title || "",
        company_id: opportunity.company_id || "",
        project_id: opportunity.project_id || "",
        contact_id: opportunity.contact_id || "",
        value: String(opportunity.value ?? ""),
        currency: opportunity.currency || "GBP",
        stage: opportunity.stage || "lead",
        probability: String(opportunity.probability ?? 10),
        expected_close_date: opportunity.expected_close_date || "",
        notes: opportunity.notes || "",
      });
    } else {
      setForm({
        title: "", company_id: defaultCompanyId || "", project_id: defaultProjectId || "",
        contact_id: "", value: "", currency: "GBP", stage: "lead",
        probability: "10", expected_close_date: "", notes: "",
      });
    }
  }, [opportunity, open, defaultCompanyId, defaultProjectId]);

  const handleStageChange = (stage: CrmOpportunityStage) => {
    setForm(f => ({
      ...f,
      stage,
      probability: String(STAGE_PROBABILITY[stage]),
    }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.company_id) e.company_id = "Company is required";
    if (!form.value || isNaN(Number(form.value))) e.value = "Valid value is required";
    if (!form.expected_close_date) e.expected_close_date = "Expected close date is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const payload: any = {
      title: form.title,
      company_id: form.company_id || null,
      project_id: form.project_id || null,
      contact_id: form.contact_id || null,
      value: parseFloat(form.value),
      currency: form.currency,
      stage: form.stage,
      probability: parseInt(form.probability) || 0,
      expected_close_date: form.expected_close_date || null,
      notes: form.notes || null,
    };
    try {
      if (isEdit && opportunity) {
        await updateMut.mutateAsync({ id: opportunity.id, ...payload });
        toast({ title: "Opportunity updated" });
      } else {
        await createMut.mutateAsync(payload);
        toast({ title: "Opportunity created" });
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
          <SheetTitle>{isEdit ? "Edit Opportunity" : "Add Opportunity"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="opp-title">Title *</Label>
            <Input id="opp-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
          </div>

          <div>
            <Label>Company *</Label>
            <Select value={form.company_id} onValueChange={v => setForm(f => ({ ...f, company_id: v, project_id: "", contact_id: "" }))}>
              <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
              <SelectContent className="bg-popover z-[9999]">
                {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.company_id && <p className="text-xs text-destructive mt-1">{errors.company_id}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Project</Label>
              <Select value={form.project_id} onValueChange={v => setForm(f => ({ ...f, project_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent className="bg-popover z-[9999]">
                  <SelectItem value="_none">None</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Primary Contact</Label>
              <Select value={form.contact_id} onValueChange={v => setForm(f => ({ ...f, contact_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent className="bg-popover z-[9999]">
                  <SelectItem value="_none">None</SelectItem>
                  {contacts.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="opp-value">Value *</Label>
              <Input id="opp-value" type="number" min="0" step="0.01" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
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
              <Label>Stage</Label>
              <Select value={form.stage} onValueChange={v => handleStageChange(v as CrmOpportunityStage)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover z-[9999]">
                  {STAGE_ORDER.map(s => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="opp-prob">Probability %</Label>
              <Input id="opp-prob" type="number" min="0" max="100" value={form.probability} onChange={e => setForm(f => ({ ...f, probability: e.target.value }))} />
            </div>
          </div>

          <div>
            <Label htmlFor="opp-close">Expected Close Date *</Label>
            <Input id="opp-close" type="date" value={form.expected_close_date} onChange={e => setForm(f => ({ ...f, expected_close_date: e.target.value }))} />
            {errors.expected_close_date && <p className="text-xs text-destructive mt-1">{errors.expected_close_date}</p>}
          </div>

          <div>
            <Label htmlFor="opp-notes">Notes</Label>
            <Textarea id="opp-notes" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : isEdit ? "Update" : "Create Opportunity"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
