import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { QuickCreateSelect, COMPANY_QUICK_FIELDS, CONTACT_QUICK_FIELDS } from "@/components/shared/QuickCreateSelect";
import { useCreateCrmProject, useUpdateCrmProject } from "@/hooks/use-crm-projects";
import { useCrmDeals } from "@/hooks/use-crm-deals";
import { toast } from "@/hooks/use-toast";
import { Info } from "lucide-react";
import type { CrmProject } from "@/types/crm";
import { cn } from "@/lib/utils";

const PROJECT_TYPES = ["consulting", "recruitment", "technology", "legal", "other"];
const STATUSES = ["active", "planning", "paused", "completed"];
const CURRENCIES = ["GBP", "USD", "EUR"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: CrmProject | null;
  defaultCompanyId?: string;
  navigateOnCreate?: boolean;
}

export function AddEditProjectPanel({ open, onOpenChange, project, defaultCompanyId, navigateOnCreate = true }: Props) {
  const navigate = useNavigate();
  const isEdit = !!project;
  const createMut = useCreateCrmProject();
  const updateMut = useUpdateCrmProject();

  const [form, setForm] = useState({
    name: "",
    company_id: defaultCompanyId || "",
    contact_id: "",
    description: "",
    project_type: "",
    status: "active",
    assigned_to: "",
    start_date: "",
    end_date: "",
    budget: "",
    currency: "GBP",
    deal_id: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load deals for the selected company
  const { data: companyDeals = [] } = useCrmDeals(
    form.company_id ? { company_id: form.company_id } : undefined
  );

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name || "",
        company_id: project.company_id || "",
        contact_id: "",
        description: project.description || "",
        project_type: project.project_type || "",
        status: project.status || "active",
        assigned_to: project.assigned_to || "",
        start_date: project.start_date || "",
        end_date: project.end_date || "",
        budget: project.budget != null ? String(project.budget) : "",
        currency: project.currency || "GBP",
        deal_id: "",
      });
    } else {
      setForm({
        name: "", company_id: defaultCompanyId || "", contact_id: "", description: "",
        project_type: "", status: "active", assigned_to: "",
        start_date: "", end_date: "", budget: "", currency: "GBP", deal_id: "",
      });
    }
  }, [project, open, defaultCompanyId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Project name is required";
    if (!form.company_id) e.company_id = "Company is required";
    if (!form.project_type) e.project_type = "Project type is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const payload: any = {
      name: form.name,
      company_id: form.company_id || null,
      description: form.description || null,
      project_type: form.project_type,
      status: form.status,
      assigned_to: form.assigned_to || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      budget: form.budget ? parseFloat(form.budget) : null,
      currency: form.currency,
    };
    try {
      if (isEdit && project) {
        await updateMut.mutateAsync({ id: project.id, ...payload });
        toast({ title: "Project updated" });
        onOpenChange(false);
      } else {
        const created = await createMut.mutateAsync(payload);
        toast({ title: "Project created" });
        onOpenChange(false);
        if (navigateOnCreate) navigate(`/crm/projects/${created.id}`);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto" data-jarvis-id="create-project-modal">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Project" : "Add Project"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Project Name */}
          <div>
            <Label htmlFor="proj-name">Project Name *</Label>
            <Input
              id="proj-name"
              autoFocus
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>

          {/* Company — QuickCreateSelect */}
          <QuickCreateSelect
            table="crm_companies"
            value={form.company_id || null}
            onChange={(id) => setForm(f => ({ ...f, company_id: id, contact_id: "", deal_id: "" }))}
            label="Company"
            required
            placeholder="Search companies…"
            quickCreateFields={COMPANY_QUICK_FIELDS}
            quickCreateHint="You can complete all company details in the Companies tab after finishing project setup."
            error={errors.company_id}
            data-jarvis-id="project-company-field"
          />

          {/* Key Contact — QuickCreateSelect (filtered to company) */}
          {form.company_id && (
            <QuickCreateSelect
              table="crm_contacts"
              value={form.contact_id || null}
              onChange={(id) => setForm(f => ({ ...f, contact_id: id }))}
              companyId={form.company_id}
              label="Key Contact (optional)"
              placeholder="Search contacts at this company…"
              quickCreateFields={CONTACT_QUICK_FIELDS}
              quickCreateHint="Full contact details can be added in Contacts."
              data-jarvis-id="project-contact-field"
            />
          )}

          {/* Project Type — chip selector */}
          <div>
            <Label>Project Type *</Label>
            <div className="flex flex-wrap gap-2 mt-1.5" data-jarvis-id="project-type-selector">
              {PROJECT_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, project_type: t }))}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm border transition-colors capitalize",
                    form.project_type === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            {errors.project_type && <p className="text-xs text-destructive mt-1">{errors.project_type}</p>}
          </div>

          {/* Stage — chip selector */}
          <div>
            <Label>Stage</Label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {STATUSES.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, status: s }))}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm border transition-colors capitalize",
                    form.status === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Forecast Value & Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="proj-budget">Forecast Value £</Label>
              <Input id="proj-budget" type="number" min="0" step="0.01" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} />
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

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="proj-start">Start Date</Label>
              <Input id="proj-start" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="proj-end">Target End Date</Label>
              <Input id="proj-end" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>

          {/* Linked Deal */}
          {form.company_id && companyDeals.length > 0 && (
            <div>
              <Label>Linked Deal</Label>
              <Select value={form.deal_id} onValueChange={v => setForm(f => ({ ...f, deal_id: v === "_none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Link to a deal (optional)" /></SelectTrigger>
                <SelectContent className="bg-popover z-[9999]">
                  <SelectItem value="_none">None</SelectItem>
                  {companyDeals.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Description */}
          <div>
            <Label htmlFor="proj-desc">Description</Label>
            <Textarea id="proj-desc" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
        </div>

        <SheetFooter className="flex items-center justify-between sm:justify-between">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Info className="h-3 w-3" /> Complete full details after creation
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Update" : "Create Project →"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
