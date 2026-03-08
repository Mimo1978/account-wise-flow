import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useCreateCrmContact, useUpdateCrmContact } from "@/hooks/use-crm-contacts";
import { useCrmCompanies } from "@/hooks/use-crm-companies";
import { toast } from "@/hooks/use-toast";
import type { CrmContact } from "@/types/crm";
import { format } from "date-fns";

const CONTACT_METHODS = ["email", "phone", "mobile"];
const CONSENT_METHODS = ["verbal", "email", "website-form", "written"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: CrmContact | null;
  prefillCompanyId?: string;
}

export function AddEditContactPanel({ open, onOpenChange, contact, prefillCompanyId }: Props) {
  const isEdit = !!contact;
  const createMut = useCreateCrmContact();
  const updateMut = useUpdateCrmContact();
  const { data: companies } = useCrmCompanies();

  const [companySearch, setCompanySearch] = useState("");

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    company_id: "",
    job_title: "",
    email: "",
    phone: "",
    mobile: "",
    linkedin_url: "",
    preferred_contact: "",
    notes: "",
    gdpr_consent: false,
    gdpr_consent_method: "",
    gdpr_consent_date: "",
  });

  useEffect(() => {
    if (contact) {
      setForm({
        first_name: contact.first_name || "",
        last_name: contact.last_name || "",
        company_id: contact.company_id || "",
        job_title: contact.job_title || "",
        email: contact.email || "",
        phone: contact.phone || "",
        mobile: contact.mobile || "",
        linkedin_url: contact.linkedin_url || "",
        preferred_contact: contact.preferred_contact || "",
        notes: contact.notes || "",
        gdpr_consent: contact.gdpr_consent ?? false,
        gdpr_consent_method: contact.gdpr_consent_method || "",
        gdpr_consent_date: contact.gdpr_consent_date
          ? format(new Date(contact.gdpr_consent_date), "yyyy-MM-dd")
          : "",
      });
    } else {
      setForm({
        first_name: "", last_name: "", company_id: prefillCompanyId || "",
        job_title: "", email: "", phone: "", mobile: "", linkedin_url: "",
        preferred_contact: "", notes: "", gdpr_consent: false,
        gdpr_consent_method: "", gdpr_consent_date: "",
      });
    }
    setCompanySearch("");
  }, [contact, open, prefillCompanyId]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.first_name.trim()) e.first_name = "Required";
    if (!form.last_name.trim()) e.last_name = "Required";
    if (!form.company_id) e.company_id = "Required";
    if (!form.email.trim()) e.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email";
    if (form.gdpr_consent && !form.gdpr_consent_method) e.gdpr_consent_method = "Required when consent is given";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const payload: any = { ...form };
    if (form.gdpr_consent && !form.gdpr_consent_date) {
      payload.gdpr_consent_date = new Date().toISOString();
    } else if (form.gdpr_consent_date) {
      payload.gdpr_consent_date = new Date(form.gdpr_consent_date).toISOString();
    } else {
      payload.gdpr_consent_date = null;
    }
    try {
      if (isEdit && contact) {
        await updateMut.mutateAsync({ id: contact.id, ...payload });
        toast({ title: "Contact updated" });
      } else {
        await createMut.mutateAsync(payload);
        toast({ title: "Contact created" });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const filteredCompanies = (companies ?? []).filter(c =>
    !companySearch || c.name.toLowerCase().includes(companySearch.toLowerCase())
  );

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Contact" : "Add Contact"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>First Name *</Label>
              <Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} data-jarvis-id="contact-first-name-input" />
              {errors.first_name && <p className="text-xs text-destructive mt-1">{errors.first_name}</p>}
            </div>
            <div>
              <Label>Last Name *</Label>
              <Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} data-jarvis-id="contact-last-name-input" data-jarvis-id="contact-last-name-input" data-jarvis-id="contact-last-name-input" />
              {errors.last_name && <p className="text-xs text-destructive mt-1">{errors.last_name}</p>}
            </div>
          </div>

          <div>
            <Label>Company *</Label>
            <Select value={form.company_id} onValueChange={v => setForm(f => ({ ...f, company_id: v }))} data-jarvis-id="contact-company-select">
              <SelectTrigger data-jarvis-id="contact-company-select"><SelectValue placeholder="Select company" /></SelectTrigger>
              <SelectContent className="bg-popover z-[9999]">
                <div className="p-2">
                  <Input
                    placeholder="Search companies…"
                    value={companySearch}
                    onChange={e => setCompanySearch(e.target.value)}
                    className="h-8"
                  />
                </div>
                {filteredCompanies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
                {filteredCompanies.length === 0 && (
                  <p className="p-2 text-xs text-muted-foreground">No companies found</p>
                )}
              </SelectContent>
            </Select>
            {errors.company_id && <p className="text-xs text-destructive mt-1">{errors.company_id}</p>}
          </div>

          <div>
            <Label>Job Title</Label>
            <Input value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} />
          </div>

          <div>
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} data-jarvis-id="contact-email-input" />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} data-jarvis-id="contact-phone-input" />
            </div>
            <div>
              <Label>Mobile</Label>
              <Input value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} />
            </div>
          </div>

          <div>
            <Label>LinkedIn URL</Label>
            <Input value={form.linkedin_url} onChange={e => setForm(f => ({ ...f, linkedin_url: e.target.value }))} />
          </div>

          <div>
            <Label>Preferred Contact Method</Label>
            <Select value={form.preferred_contact} onValueChange={v => setForm(f => ({ ...f, preferred_contact: v }))}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent className="bg-popover z-[9999]">
                {CONTACT_METHODS.map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} data-jarvis-id="notes-input" />
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Data & Consent</h4>
            <p className="text-xs text-muted-foreground">You must record a lawful basis for storing this contact.</p>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.gdpr_consent}
                onCheckedChange={checked => {
                  setForm(f => ({
                    ...f,
                    gdpr_consent: checked,
                    gdpr_consent_date: checked && !f.gdpr_consent_date
                      ? format(new Date(), "yyyy-MM-dd")
                      : f.gdpr_consent_date,
                  }));
                }}
              />
              <Label>GDPR Consent</Label>
            </div>

            {form.gdpr_consent && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Consent Method *</Label>
                  <Select value={form.gdpr_consent_method} onValueChange={v => setForm(f => ({ ...f, gdpr_consent_method: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent className="bg-popover z-[9999]">
                      {CONSENT_METHODS.map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {errors.gdpr_consent_method && <p className="text-xs text-destructive mt-1">{errors.gdpr_consent_method}</p>}
                </div>
                <div>
                  <Label>Consent Date</Label>
                  <Input
                    type="date"
                    value={form.gdpr_consent_date}
                    onChange={e => setForm(f => ({ ...f, gdpr_consent_date: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <SheetF data-jarvis-id="cancel-button"ooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending} data-jarvis-id="save-button">
            {isPending ? "Saving…" : isEdit ? "Update" : "Create Contact"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
