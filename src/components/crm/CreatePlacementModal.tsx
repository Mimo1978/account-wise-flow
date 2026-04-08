import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: any;
  onCreated?: () => void;
}

export function CreatePlacementModal({ open, onOpenChange, deal, onCreated }: Props) {
  const { currentWorkspace } = useWorkspace();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    placement_type: (deal as any)?.deal_type === "permanent" ? "permanent" : (deal as any)?.deal_type === "consulting" ? "consulting" : "contractor",
    start_date: deal?.start_date || "",
    end_date: deal?.end_date || "",
    rate_per_day: (deal as any)?.day_rate ? String((deal as any).day_rate) : "",
    placement_fee: "",
    currency: deal?.currency || "GBP",
    billing_contact_email: (deal as any)?.billing_email || "",
    po_number: "",
    invoice_frequency: "monthly",
    salary: (deal as any)?.salary ? String((deal as any).salary) : "",
    fee_percentage: (deal as any)?.fee_percentage ? String((deal as any).fee_percentage) : "20",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const feeAmount = form.placement_type === "permanent" && form.salary && form.fee_percentage
    ? Math.round(Number(form.salary) * Number(form.fee_percentage) / 100)
    : null;

  const save = async () => {
    if (!form.start_date) { toast({ title: "Start date is required", variant: "destructive" }); return; }
    if (!currentWorkspace?.id) return;
    setSaving(true);
    try {
      const { data: placement, error } = await (supabase.from as any)("placements").insert({
        workspace_id: currentWorkspace.id,
        company_id: deal?.company_id || null,
        contact_id: deal?.contact_id || null,
        deal_id: deal?.id || null,
        candidate_id: (deal as any)?.candidate_id || null,
        placement_type: form.placement_type,
        status: "active",
        start_date: form.start_date,
        end_date: form.end_date || null,
        rate_per_day: form.placement_type === "contractor" ? Number(form.rate_per_day) || null : null,
        placement_fee: form.placement_type === "permanent" ? (feeAmount || Number(form.placement_fee) || null) : null,
        currency: form.currency,
        billing_contact_email: form.billing_contact_email || null,
        po_number: form.po_number || null,
        invoice_frequency: form.invoice_frequency,
      }).select().single();

      if (error) throw error;

      await supabase.from("crm_deals").update({ stage: "placed" } as any).eq("id", deal.id);

      toast({ title: "Placement created", description: "Deal moved to Placed stage." });
      onCreated?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Convert to placement</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "contractor", label: "Contractor", sub: "Day rate · timesheet" },
              { value: "permanent", label: "Permanent", sub: "One-off fee" },
              { value: "consulting", label: "Consulting", sub: "Retainer / SOW" },
            ].map(t => (
              <button key={t.value} type="button" onClick={() => set("placement_type", t.value)}
                className={`rounded-lg border-2 p-2 text-center transition-all text-xs ${
                  form.placement_type === t.value
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 font-medium"
                    : "border-border text-muted-foreground"
                }`}>
                <p className="font-medium">{t.label}</p>
                <p className="text-[10px]">{t.sub}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Start date *</Label><Input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} className="mt-1 h-8 text-xs" /></div>
            <div><Label className="text-xs">End date</Label><Input type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} className="mt-1 h-8 text-xs" /></div>
          </div>

          {form.placement_type === "contractor" && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Day rate ({form.currency})</Label><Input type="number" value={form.rate_per_day} onChange={e => set("rate_per_day", e.target.value)} placeholder="650" className="mt-1 h-8 text-xs" /></div>
              <div>
                <Label className="text-xs">Invoice frequency</Label>
                <Select value={form.invoice_frequency} onValueChange={v => set("invoice_frequency", v)}>
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {form.placement_type === "permanent" && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Annual salary ({form.currency})</Label><Input type="number" value={form.salary} onChange={e => set("salary", e.target.value)} placeholder="75000" className="mt-1 h-8 text-xs" /></div>
              <div>
                <Label className="text-xs">Fee % {feeAmount ? <span className="text-muted-foreground">→ £{feeAmount.toLocaleString()}</span> : ""}</Label>
                <Input type="number" value={form.fee_percentage} onChange={e => set("fee_percentage", e.target.value)} className="mt-1 h-8 text-xs" />
              </div>
            </div>
          )}

          <div><Label className="text-xs">Billing contact email</Label><Input type="email" value={form.billing_contact_email} onChange={e => set("billing_contact_email", e.target.value)} placeholder="accounts@client.com" className="mt-1 h-8 text-xs" /></div>
          <div><Label className="text-xs">PO number (optional)</Label><Input value={form.po_number} onChange={e => set("po_number", e.target.value)} placeholder="PO-12345" className="mt-1 h-8 text-xs" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Creating…" : "Create placement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}