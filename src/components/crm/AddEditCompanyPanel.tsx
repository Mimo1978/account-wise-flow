import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCrmCompany, useUpdateCrmCompany } from "@/hooks/use-crm-companies";
import { toast } from "@/hooks/use-toast";
import type { CrmCompany } from "@/types/crm";

const INDUSTRIES = [
  "Technology", "Financial Services", "Healthcare", "Manufacturing",
  "Retail", "Professional Services", "Consulting", "Energy",
  "Telecommunications", "Education", "Real Estate", "Media", "Other",
];

const SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"];

const COUNTRIES = [
  "United Kingdom", "United States", "Germany", "France", "Netherlands",
  "Ireland", "Australia", "Canada", "Singapore", "India", "Other",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: CrmCompany | null;
}

export function AddEditCompanyPanel({ open, onOpenChange, company }: Props) {
  const isEdit = !!company;
  const createMut = useCreateCrmCompany();
  const updateMut = useUpdateCrmCompany();

  const [form, setForm] = useState({
    name: "",
    website: "",
    industry: "",
    size: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    postcode: "",
    country: "",
    notes: "",
  });

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name || "",
        website: company.website || "",
        industry: company.industry || "",
        size: company.size || "",
        phone: company.phone || "",
        address_line1: company.address_line1 || "",
        address_line2: company.address_line2 || "",
        city: company.city || "",
        postcode: company.postcode || "",
        country: company.country || "",
        notes: company.notes || "",
      });
    } else {
      setForm({
        name: "", website: "", industry: "", size: "", phone: "",
        address_line1: "", address_line2: "", city: "", postcode: "",
        country: "", notes: "",
      });
    }
  }, [company, open]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Company name is required";
    if (form.website && !/^https?:\/\/.+\..+/.test(form.website)) {
      e.website = "Enter a valid URL (https://...)";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      if (isEdit && company) {
        await updateMut.mutateAsync({ id: company.id, ...form });
        toast({ title: "Company updated" });
      } else {
        await createMut.mutateAsync(form);
        toast({ title: "Company created" });
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
          <SheetTitle>{isEdit ? "Edit Company" : "Add Company"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="name">Company Name *</Label>
            <Input id="name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>

          <div>
            <Label htmlFor="website">Website</Label>
            <Input id="website" placeholder="https://..." value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
            {errors.website && <p className="text-xs text-destructive mt-1">{errors.website}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Industry</Label>
              <Select value={form.industry} onValueChange={v => setForm(f => ({ ...f, industry: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent className="bg-popover z-[9999]">
                  {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Size</Label>
              <Select value={form.size} onValueChange={v => setForm(f => ({ ...f, size: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent className="bg-popover z-[9999]">
                  {SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>

          <div>
            <Label htmlFor="addr1">Address Line 1</Label>
            <Input id="addr1" value={form.address_line1} onChange={e => setForm(f => ({ ...f, address_line1: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="addr2">Address Line 2</Label>
            <Input id="addr2" value={form.address_line2} onChange={e => setForm(f => ({ ...f, address_line2: e.target.value }))} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="postcode">Postcode</Label>
              <Input id="postcode" value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))} />
            </div>
            <div>
              <Label>Country</Label>
              <Select value={form.country} onValueChange={v => setForm(f => ({ ...f, country: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent className="bg-popover z-[9999]">
                  {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={4} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : isEdit ? "Update" : "Create Company"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
