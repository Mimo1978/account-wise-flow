import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useBillingSettings, useUpsertBillingSettings, type WorkspaceBillingSettings } from '@/hooks/use-billing-settings';
import { toast } from 'sonner';
import { Loader2, Save, FileText, CreditCard, Building2 } from 'lucide-react';

const AdminBilling = () => {
  const { currentWorkspace } = useWorkspace();
  const { data: settings, isLoading } = useBillingSettings(currentWorkspace?.id);
  const upsert = useUpsertBillingSettings();

  const [form, setForm] = useState({
    legal_name: '',
    trading_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    postcode: '',
    country: '',
    vat_number: '',
    tax_label: 'VAT',
    payment_terms_days: '14',
    bank_account_name: '',
    bank_sort_code: '',
    bank_account_number: '',
    bank_iban: '',
    bank_swift: '',
    invoice_prefix: 'INV',
    next_invoice_number: '1',
    currency: 'GBP',
    logo_url: '',
  });

  useEffect(() => {
    if (settings) {
      setForm({
        legal_name: settings.legal_name ?? '',
        trading_name: settings.trading_name ?? '',
        address_line1: settings.address_line1 ?? '',
        address_line2: settings.address_line2 ?? '',
        city: settings.city ?? '',
        postcode: settings.postcode ?? '',
        country: settings.country ?? '',
        vat_number: settings.vat_number ?? '',
        tax_label: settings.tax_label ?? 'VAT',
        payment_terms_days: String(settings.payment_terms_days ?? 14),
        bank_account_name: settings.bank_account_name ?? '',
        bank_sort_code: settings.bank_sort_code ?? '',
        bank_account_number: settings.bank_account_number ?? '',
        bank_iban: settings.bank_iban ?? '',
        bank_swift: settings.bank_swift ?? '',
        invoice_prefix: settings.invoice_prefix ?? 'INV',
        next_invoice_number: String(settings.next_invoice_number ?? 1),
        currency: settings.currency ?? 'GBP',
        logo_url: settings.logo_url ?? '',
      });
    }
  }, [settings]);

  const handleSave = async () => {
    if (!currentWorkspace?.id) return;
    try {
      await upsert.mutateAsync({
        workspace_id: currentWorkspace.id,
        legal_name: form.legal_name || null,
        trading_name: form.trading_name || null,
        address_line1: form.address_line1 || null,
        address_line2: form.address_line2 || null,
        city: form.city || null,
        postcode: form.postcode || null,
        country: form.country || null,
        vat_number: form.vat_number || null,
        tax_label: form.tax_label,
        payment_terms_days: parseInt(form.payment_terms_days) || 14,
        bank_account_name: form.bank_account_name || null,
        bank_sort_code: form.bank_sort_code || null,
        bank_account_number: form.bank_account_number || null,
        bank_iban: form.bank_iban || null,
        bank_swift: form.bank_swift || null,
        invoice_prefix: form.invoice_prefix || 'INV',
        next_invoice_number: parseInt(form.next_invoice_number) || 1,
        currency: form.currency,
        logo_url: form.logo_url || null,
      });
      toast.success('Billing settings saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    }
  };

  const update = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const nextInvPreview = `${form.invoice_prefix}-${String(parseInt(form.next_invoice_number) || 1).padStart(6, '0')}`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Billing & Invoices</h2>
        <p className="text-muted-foreground">Configure workspace billing details, invoice numbering, and payment information.</p>
      </div>

      {/* Company Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="w-4 h-4" />
            Company Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Legal Name</Label>
              <Input value={form.legal_name} onChange={(e) => update('legal_name', e.target.value)} placeholder="Company Ltd" />
            </div>
            <div>
              <Label className="text-xs">Trading Name</Label>
              <Input value={form.trading_name} onChange={(e) => update('trading_name', e.target.value)} placeholder="Brand name" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Address Line 1</Label>
              <Input value={form.address_line1} onChange={(e) => update('address_line1', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Address Line 2</Label>
              <Input value={form.address_line2} onChange={(e) => update('address_line2', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">City</Label>
              <Input value={form.city} onChange={(e) => update('city', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Postcode</Label>
              <Input value={form.postcode} onChange={(e) => update('postcode', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Country</Label>
              <Input value={form.country} onChange={(e) => update('country', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">VAT / Tax Number</Label>
              <Input value={form.vat_number} onChange={(e) => update('vat_number', e.target.value)} placeholder="GB123456789" />
            </div>
            <div>
              <Label className="text-xs">Tax Label</Label>
              <Input value={form.tax_label} onChange={(e) => update('tax_label', e.target.value)} placeholder="VAT" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Logo URL</Label>
            <Input value={form.logo_url} onChange={(e) => update('logo_url', e.target.value)} placeholder="https://..." />
          </div>
        </CardContent>
      </Card>

      {/* Invoice Numbering */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="w-4 h-4" />
            Invoice Numbering
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Prefix</Label>
              <Input value={form.invoice_prefix} onChange={(e) => update('invoice_prefix', e.target.value)} placeholder="INV" />
            </div>
            <div>
              <Label className="text-xs">Next Number</Label>
              <Input type="number" value={form.next_invoice_number} onChange={(e) => update('next_invoice_number', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Preview</Label>
              <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted/50 text-sm font-mono">
                {nextInvPreview}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Default Currency</Label>
              <Input value={form.currency} onChange={(e) => update('currency', e.target.value)} placeholder="GBP" />
            </div>
            <div>
              <Label className="text-xs">Payment Terms (days)</Label>
              <Input type="number" value={form.payment_terms_days} onChange={(e) => update('payment_terms_days', e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bank Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="w-4 h-4" />
            Payment Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Account Name</Label>
            <Input value={form.bank_account_name} onChange={(e) => update('bank_account_name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Sort Code</Label>
              <Input value={form.bank_sort_code} onChange={(e) => update('bank_sort_code', e.target.value)} placeholder="00-00-00" />
            </div>
            <div>
              <Label className="text-xs">Account Number</Label>
              <Input value={form.bank_account_number} onChange={(e) => update('bank_account_number', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">IBAN</Label>
              <Input value={form.bank_iban} onChange={(e) => update('bank_iban', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">SWIFT / BIC</Label>
              <Input value={form.bank_swift} onChange={(e) => update('bank_swift', e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={upsert.isPending} className="gap-1.5">
          {upsert.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
};

export default AdminBilling;
