import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { Download, ShieldOff, Trash2, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { usePermissions } from "@/hooks/use-permissions";
import type { CrmContactWithCompany } from "@/hooks/use-crm-contacts";

interface Props {
  contact: CrmContactWithCompany;
}

export function GdprDataRightsTab({ contact }: Props) {
  const { isAdmin, userId } = usePermissions();
  const qc = useQueryClient();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [erasureOpen, setErasureOpen] = useState(false);
  const [erasureConfirmText, setErasureConfirmText] = useState("");
  const [exporting, setExporting] = useState(false);

  // Consent history
  const { data: consentLog, isLoading: logLoading } = useQuery({
    queryKey: ["gdpr_consent_log", contact.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gdpr_consent_log" as any)
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Withdraw consent
  const withdrawMut = useMutation({
    mutationFn: async () => {
      // Update contact
      const { error: updateErr } = await supabase
        .from("crm_contacts" as any)
        .update({ gdpr_consent: false, gdpr_consent_date: new Date().toISOString() } as any)
        .eq("id", contact.id);
      if (updateErr) throw updateErr;

      // Log to consent log
      const { error: logErr } = await supabase
        .from("gdpr_consent_log" as any)
        .insert({
          contact_id: contact.id,
          action: "withdrawn",
          method: "manual",
          recorded_by: userId,
        } as any);
      if (logErr) throw logErr;

      // Audit log
      const { error: auditErr } = await supabase
        .from("crm_ai_audit_log" as any)
        .insert({
          action: "gdpr_consent_withdrawn",
          entity_type: "crm_contacts",
          entity_id: contact.id,
          user_id: userId,
          input_summary: "action:gdpr_consent_withdrawn",
          output_summary: `entity:${contact.id}`,
        } as any);
      if (auditErr) console.error("Audit log error:", auditErr);
    },
    onSuccess: () => {
      toast.success("Consent withdrawn successfully");
      qc.invalidateQueries({ queryKey: ["crm_contacts"] });
      qc.invalidateQueries({ queryKey: ["gdpr_consent_log", contact.id] });
      setWithdrawOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Right to Erasure (anonymisation)
  const erasureMut = useMutation({
    mutationFn: async () => {
      const { error: updateErr } = await supabase
        .from("crm_contacts" as any)
        .update({
          first_name: "Anonymised",
          last_name: "Contact",
          email: "anonymised@deleted.invalid",
          phone: null,
          mobile: null,
          linkedin_url: null,
          notes: null,
          gdpr_consent: false,
          gdpr_consent_date: new Date().toISOString(),
          gdpr_consent_method: null,
        } as any)
        .eq("id", contact.id);
      if (updateErr) throw updateErr;

      // Log consent withdrawal
      const { error: logErr } = await supabase
        .from("gdpr_consent_log" as any)
        .insert({
          contact_id: contact.id,
          action: "withdrawn",
          method: "right_to_erasure",
          recorded_by: userId,
        } as any);
      if (logErr) console.error("Consent log error:", logErr);

      // Audit log
      const { error: auditErr } = await supabase
        .from("crm_ai_audit_log" as any)
        .insert({
          action: "gdpr_erasure",
          entity_type: "crm_contacts",
          entity_id: contact.id,
          user_id: userId,
          input_summary: "action:gdpr_erasure",
          output_summary: `entity:${contact.id}`,
        } as any);
      if (auditErr) console.error("Audit log error:", auditErr);
    },
    onSuccess: () => {
      toast.success("Contact data anonymised");
      qc.invalidateQueries({ queryKey: ["crm_contacts"] });
      qc.invalidateQueries({ queryKey: ["gdpr_consent_log", contact.id] });
      setErasureOpen(false);
      setErasureConfirmText("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Export contact data
  const handleExport = async () => {
    setExporting(true);
    try {
      // Gather all data
      const [contactRes, activitiesRes, oppsRes] = await Promise.all([
        supabase.from("crm_contacts" as any).select("*, crm_companies(id, name)").eq("id", contact.id).single(),
        supabase.from("crm_activities" as any).select("*").eq("contact_id", contact.id).order("created_at", { ascending: false }),
        supabase.from("crm_opportunities" as any).select("*").eq("contact_id", contact.id),
      ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        contact: contactRes.data,
        activities: activitiesRes.data ?? [],
        opportunities: oppsRes.data ?? [],
      };

      // Download as JSON
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${contact.first_name}_${contact.last_name}_data_export_${format(new Date(), "yyyy-MM-dd")}.json`;
      a.click();
      URL.revokeObjectURL(url);

      // Audit log
      await supabase
        .from("crm_ai_audit_log" as any)
        .insert({
          action: "gdpr_data_export",
          entity_type: "crm_contacts",
          entity_id: contact.id,
          user_id: userId,
          input_summary: "action:gdpr_data_export",
          output_summary: `entity:${contact.id}`,
        } as any);

      toast.success("Data exported successfully");
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const isAnonymised = contact.email === "anonymised@deleted.invalid";

  return (
    <div className="space-y-4">
      {/* Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">GDPR Rights Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
            Export Contact Data
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWithdrawOpen(true)}
            disabled={!contact.gdpr_consent || isAnonymised}
          >
            <ShieldOff className="h-4 w-4 mr-1" />
            Withdraw Consent
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setErasureOpen(true)}
            disabled={!isAdmin || isAnonymised}
            title={!isAdmin ? "Admin role required" : undefined}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Right to Erasure
          </Button>
          {isAnonymised && (
            <Badge variant="outline" className="text-muted-foreground">
              <CheckCircle className="h-3 w-3 mr-1" /> Data anonymised
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Current Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Current Consent Status</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div className="flex gap-2">
            <span className="text-muted-foreground w-28">Consent</span>
            <Badge variant={contact.gdpr_consent ? "default" : "outline"}>
              {contact.gdpr_consent ? "Given" : "Not Given"}
            </Badge>
          </div>
          {contact.gdpr_consent_method && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-28">Method</span>
              <span className="capitalize">{contact.gdpr_consent_method}</span>
            </div>
          )}
          {contact.gdpr_consent_date && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-28">Date</span>
              <span>{format(new Date(contact.gdpr_consent_date), "dd MMM yyyy")}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Consent History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Consent History</CardTitle>
        </CardHeader>
        <CardContent>
          {logLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (consentLog?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No consent changes recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consentLog!.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">{format(new Date(log.created_at), "dd MMM yyyy HH:mm")}</TableCell>
                    <TableCell>
                      <Badge variant={log.action === "given" ? "default" : "outline"} className="capitalize text-xs">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs capitalize">{log.method || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Withdraw Consent Modal */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Withdraw Consent
            </DialogTitle>
            <DialogDescription>
              This will record consent as withdrawn. You should stop all direct marketing to this contact. Proceed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => withdrawMut.mutate()} disabled={withdrawMut.isPending}>
              {withdrawMut.isPending ? "Processing…" : "Withdraw Consent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Right to Erasure Modal */}
      <Dialog open={erasureOpen} onOpenChange={(o) => { setErasureOpen(o); if (!o) setErasureConfirmText(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Right to Erasure
            </DialogTitle>
            <DialogDescription>
              This will anonymise this contact's personal data. Name will become "Anonymised Contact",
              email/phone will be cleared. Activities and financial records are retained for legal compliance.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Type <strong>DELETE</strong> to confirm:</p>
            <Input
              value={erasureConfirmText}
              onChange={(e) => setErasureConfirmText(e.target.value)}
              placeholder="Type DELETE"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setErasureOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => erasureMut.mutate()}
              disabled={erasureConfirmText !== "DELETE" || erasureMut.isPending}
            >
              {erasureMut.isPending ? "Anonymising…" : "Confirm Erasure"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
