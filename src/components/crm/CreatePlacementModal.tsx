import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: any;
}

export function CreatePlacementModal({ open, onOpenChange, deal }: Props) {
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    placement_type: "contractor",
    start_date: deal?.start_date || "",
    end_date: deal?.end_date || "",
    rate_per_day: deal?.value ? String(deal.value) : "",
    placement_fee: "",
    currency: deal?.currency || "GBP",
    billing_contact_email: "",
    po_number: "",
    invoice_frequency: "monthly",
  });

  const save = async () => {
    if (!currentWorkspace?.id || !form.start_date) {
      toast.error("Start date is required");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("placements" as any).insert({
        workspace_id: currentWorkspace.id,
        company_id: deal?.company_id || null,
        contact_id: deal?.contact_id || null,
        deal_id: deal?.id || null,
        placement_type: form.placement_type,
        status: "active",
        start_date: form.start_date,
        end_date: form.end_date || null,
        rate_per_day: form.placement_type === "contractor" ? Number(form.rate_per_day) : null,
        placement_fee: form.placement_type === "permanent" ? Number(form.placement_fee) : null,
        currency: form.currency,
        billing_contact_email: form.billing_contact_email || null,
        po_number: form.po_number || null,
        invoice_frequency: form.invoice_frequency,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["placements-home"] });
      toast.success("Placement created");
      onOpenChange(false);
    } catch {
      toast.error("Failed to create placement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Convert to Placement</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Placement type</Label>
            <Select value={form.placement_type} onValueChange={v => setForm(f => ({ ...f, placement_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contractor">Contractor — day rate + timesheet</SelectItem>
                <SelectItem value="permanent">Permanent — one-off fee</SelectItem>
                <SelectItem value="consulting">Consulting — retainer / day rate</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>End date {form.placement_type === "permanent" ? "(optional)" : ""}</Label>
              <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>

          {form.placement_type === "contractor" && (
            <div className="space-y-1.5">
              <Label>Day rate ({form.currency})</Label>
              <Input type="number" value={form.rate_per_day} onChange={e => setForm(f => ({ ...f, rate_per_day: e.target.value }))} />
            </div>
          )}
          {form.placement_type === "permanent" && (
            <div className="space-y-1.5">
              <Label>Placement fee ({form.currency})</Label>
              <Input type="number" value={form.placement_fee} onChange={e => setForm(f => ({ ...f, placement_fee: e.target.value }))} />
            </div>
          )}
          {form.placement_type === "contractor" && (
            <div className="space-y-1.5">
              <Label>Invoice frequency</Label>
              <Select value={form.invoice_frequency} onValueChange={v => setForm(f => ({ ...f, invoice_frequency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Billing contact email (accounts team)</Label>
            <Input type="email" placeholder="accounts@client.com" value={form.billing_contact_email} onChange={e => setForm(f => ({ ...f, billing_contact_email: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>PO number (optional)</Label>
            <Input value={form.po_number} onChange={e => setForm(f => ({ ...f, po_number: e.target.value }))} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={loading}>
            {loading ? "Creating..." : "Create Placement"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
