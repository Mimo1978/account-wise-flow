import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCrmProject, useUpdateCrmProject } from "@/hooks/use-crm-projects";
import { useCrmCompanies } from "@/hooks/use-crm-companies";
import { toast } from "@/hooks/use-toast";
import type { CrmProject } from "@/types/crm";

const PROJECT_TYPES = ["consulting", "development", "design", "retainer", "other"];
const STATUSES = ["active", "completed", "paused", "cancelled"];
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
  const { data: companies = [] } = useCrmCompanies();
  const [companySearch, setCompanySearch] = useState("");

  const [form, setForm] = useState({
    name: "",
    company_id: defaultCompanyId || "",
    description: "",
    project_type: "",
    status: "active",
    assigned_to: "",
    start_date: "",
    end_date: "",
    budget: "",
    currency: "GBP",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name || "",
        company_id: project.company_id || "",
        description: project.description || "",
        project_type: project.project_type || "",
        status: project.status || "active",
        assigned_to: project.assigned_to || "",
        start_date: project.start_date || "",
        end_date: project.end_date || "",
        budget: project.budget != null ? String(project.budget) : "",
        currency: project.currency || "GBP",
      });
    } else {
      setForm({
        name: "", company_id: defaultCompanyId || "", description: "",
        project_type: "", status: "active", assigned_to: "",
        start_date: "", end_date: "", budget: "", currency: "GBP",
      });
    }
  }, [project, open, defaultCompanyId]);

  const filteredCompanies = companies.filter(c =>
    !companySearch || c.name.toLowerCase().includes(companySearch.toLowerCase())
  );

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
      ...form,
      budget: form.budget ? parseFloat(form.budget) : null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      assigned_to: form.assigned_to || null,
      company_id: form.company_id || null,
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
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Project" : "Add Project"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="proj-name">Project Name *</Label>
            <Input id="proj-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>

          <div>
            <Label>Company *</Label>
            <Select value={form.company_id} onValueChange={v => setForm(f => ({ ...f, company_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
              <SelectContent className="bg-popover z-[9999]">
                <div className="px-2 pb-2">
                  <Input placeholder="Search companies…" value={companySearch} onChange={e => setCompanySearch(e.target.value)} className="h-8" />
                </div>
                {filteredCompanies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.company_id && <p className="text-xs text-destructive mt-1">{errors.company_id}</p>}
          </div>

          <div>
            <Label htmlFor="proj-desc">Description</Label>
            <Textarea id="proj-desc" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Project Type *</Label>
              <Select value={form.project_type} onValueChange={v => setForm(f => ({ ...f, project_type: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent className="bg-popover z-[9999]">
                  {PROJECT_TYPES.map(t => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.project_type && <p className="text-xs text-destructive mt-1">{errors.project_type}</p>}
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover z-[9999]">
                  {STATUSES.map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="proj-assigned">Assigned To</Label>
            <Input id="proj-assigned" placeholder="Team member name" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="proj-start">Start Date</Label>
              <Input id="proj-start" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="proj-end">End Date</Label>
              <Input id="proj-end" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="proj-budget">Budget</Label>
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
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : isEdit ? "Update" : "Create Project"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
