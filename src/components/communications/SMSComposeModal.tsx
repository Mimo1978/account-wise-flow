import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactMobile?: string | null;
  contactFirstName?: string;
  companyId?: string | null;
  gdprConsent: boolean;
}

export function SMSComposeModal({ open, onOpenChange, contactId, contactMobile, contactFirstName, companyId, gdprConsent }: Props) {
  const [to, setTo] = useState(contactMobile || "");
  const [message, setMessage] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [sending, setSending] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setTo(contactMobile || "");
      setMessage("");
      setConsentConfirmed(false);
    }
  }, [open, contactMobile]);

  const charCount = message.length;

  const handleSend = async () => {
    if (!to.trim() || !message.trim()) {
      toast.error("Phone number and message are required");
      return;
    }

    // Log GDPR override if consent not given
    if (!gdprConsent && consentConfirmed) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("crm_ai_audit_log" as any).insert({
            action: "sms_gdpr_override",
            entity_type: "crm_contacts",
            entity_id: contactId,
            user_id: user.id,
            input_summary: "action:sms_gdpr_override",
            output_summary: `entity:${contactId}`,
          } as any);
        }
      } catch (e) {
        console.error("Audit log error:", e);
      }
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: { to_number: to.trim(), message, contact_id: contactId, company_id: companyId || null },
      });
      if (error) throw error;
      if (data?.error === "integration_not_configured") {
        toast.error("SMS not configured — go to Settings > Integrations");
        onOpenChange(false);
        navigate("/settings/integrations");
        return;
      }
      if (!data?.success) throw new Error(data?.message || "Send failed");
      toast.success("SMS sent");
      qc.invalidateQueries({ queryKey: ["crm_activities"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const canSend = gdprConsent || consentConfirmed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send SMS</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!gdprConsent && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                <AlertTriangle className="w-4 h-4" />
                This contact has not confirmed marketing consent.
              </div>
              <p className="text-xs text-muted-foreground">
                You should only send SMS if you have a legitimate interest basis documented.
              </p>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="consent-confirm"
                  checked={consentConfirmed}
                  onCheckedChange={(c) => setConsentConfirmed(c === true)}
                />
                <label htmlFor="consent-confirm" className="text-xs text-foreground">
                  I confirm I have a lawful basis to contact this person
                </label>
              </div>
            </div>
          )}

          <div>
            <Label>To</Label>
            <Input value={to} onChange={e => setTo(e.target.value)} placeholder="+441234567890" />
          </div>
          <div>
            <Label>Message *</Label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value.slice(0, 160))}
              maxLength={160}
              rows={3}
              placeholder="Type your message..."
            />
            <p className={cn(
              "text-xs mt-1 text-right",
              charCount >= 160 ? "text-destructive" : charCount >= 140 ? "text-amber-500" : "text-muted-foreground"
            )}>
              {charCount}/160
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending || !canSend}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Send SMS
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
