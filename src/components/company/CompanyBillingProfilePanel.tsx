import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCompanyBillingProfile, useUpsertCompanyBillingProfile } from '@/hooks/use-company-billing-profile';
import { toast } from 'sonner';
import { Loader2, Save, Receipt } from 'lucide-react';

interface CompanyBillingProfilePanelProps {
  workspaceId: string;
  companyId: string;
}

export function CompanyBillingProfilePanel({ workspaceId, companyId }: CompanyBillingProfilePanelProps) {
  const { data: profile, isLoading } = useCompanyBillingProfile(workspaceId, companyId);
  const upsert = useUpsertCompanyBillingProfile();

  const [form, setForm] = useState({
    billing_email: '',
    billing_address_line1: '',
    billing_address_line2: '',
    billing_city: '',
    billing_postcode: '',
    billing_country: '',
    vat_number: '',
    po_number: '',
    notes: '',
  });

  useEffect(() => {
    if (profile) {
      setForm({
        billing_email: profile.billing_email ?? '',
        billing_address_line1: profile.billing_address_line1 ?? '',
        billing_address_line2: profile.billing_address_line2 ?? '',
        billing_city: profile.billing_city ?? '',
        billing_postcode: profile.billing_postcode ?? '',
        billing_country: profile.billing_country ?? '',
        vat_number: profile.vat_number ?? '',
        po_number: profile.po_number ?? '',
        notes: profile.notes ?? '',
      });
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        workspace_id: workspaceId,
        company_id: companyId,
        billing_email: form.billing_email || null,
        billing_address_line1: form.billing_address_line1 || null,
        billing_address_line2: form.billing_address_line2 || null,
        billing_city: form.billing_city || null,
        billing_postcode: form.billing_postcode || null,
        billing_country: form.billing_country || null,
        vat_number: form.vat_number || null,
        po_number: form.po_number || null,
        notes: form.notes || null,
      });
      toast.success('Billing profile saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    }
  };

  const update = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="w-4 h-4" />
          Billing Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs">Billing Email</Label>
          <Input value={form.billing_email} onChange={(e) => update('billing_email', e.target.value)} placeholder="billing@company.com" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Address Line 1</Label>
            <Input value={form.billing_address_line1} onChange={(e) => update('billing_address_line1', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Address Line 2</Label>
            <Input value={form.billing_address_line2} onChange={(e) => update('billing_address_line2', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label className="text-xs">City</Label>
            <Input value={form.billing_city} onChange={(e) => update('billing_city', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Postcode</Label>
            <Input value={form.billing_postcode} onChange={(e) => update('billing_postcode', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Country</Label>
            <Input value={form.billing_country} onChange={(e) => update('billing_country', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">VAT Number</Label>
            <Input value={form.vat_number} onChange={(e) => update('vat_number', e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">PO Number</Label>
            <Input value={form.po_number} onChange={(e) => update('po_number', e.target.value)} />
          </div>
        </div>
        <div>
          <Label className="text-xs">Notes</Label>
          <Textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={2} />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={upsert.isPending} className="gap-1.5">
            {upsert.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
