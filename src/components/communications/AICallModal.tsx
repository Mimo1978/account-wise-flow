import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { Phone, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQueryClient } from "@tanstack/react-query";

const PURPOSES = [
  "Intro Call",
  "Follow Up",
  "Demo Confirmation",
  "Payment Reminder",
  "Chasing Invoice",
  "Other",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactFirstName: string;
  contactLastName: string;
  companyName?: string;
  contactMobile?: string | null;
}

export function AICallModal({ open, onOpenChange, contactId, contactFirstName, contactLastName, companyName, contactMobile }: Props) {
  const [purpose, setPurpose] = useState("");
  const [instructions, setInstructions] = useState("");
  const [status, setStatus] = useState<"idle" | "calling" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setPurpose("");
      setInstructions("");
      setStatus("idle");
      setErrorMsg("");
    }
  }, [open]);

  const handleCall = async () => {
    if (!purpose) {
      toast.error("Please select a purpose");
      return;
    }
    setStatus("calling");
    try {
      const { data, error } = await supabase.functions.invoke("initiate-ai-call", {
        body: {
          contact_id: contactId,
          to_number: contactMobile || "",
          purpose,
          custom_instructions: instructions,
        },
      });
      if (error) throw error;
      if (data?.error === "integration_not_configured") {
        toast.error("No calling provider configured — go to Admin → Integrations and add your Bland.ai key");
        onOpenChange(false);
        return;
      }
      if (!data?.success) throw new Error(data?.message || "Call failed");
      setStatus("success");
      qc.invalidateQueries({ queryKey: ["crm_activities"] });
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message || "Call failed");
    }
  };

  const fullName = `${contactFirstName} ${contactLastName}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" /> AI Outbound Call
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Contact info */}
          <div className="flex items-center gap-3 rounded-lg border border-border p-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback>{contactFirstName[0]}{contactLastName[0]}</AvatarFallback>
            </Avatar>
            <div className="text-sm">
              <p className="font-medium text-foreground">{fullName}</p>
              {companyName && <p className="text-muted-foreground">{companyName}</p>}
              <p className="text-muted-foreground font-mono text-xs">{contactMobile || "No phone"}</p>
            </div>
          </div>

          {status === "idle" && (
            <>
              <div>
                <Label>Purpose *</Label>
                <Select value={purpose} onValueChange={setPurpose}>
                  <SelectTrigger><SelectValue placeholder="Select purpose" /></SelectTrigger>
                  <SelectContent>
                    {PURPOSES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Custom Instructions</Label>
                <Textarea
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  placeholder="Any specific context for the AI e.g. 'We last spoke in March about their website redesign project'"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button onClick={handleCall} disabled={!purpose || !contactMobile}>Start AI Call</Button>
              </div>
            </>
          )}

          {status === "calling" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Connecting call to {contactFirstName}…</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              <p className="text-sm text-foreground">{contactFirstName} will receive the call shortly. Activity has been logged.</p>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <XCircle className="w-8 h-8 text-destructive" />
              <p className="text-sm text-destructive">{errorMsg}</p>
              <Button variant="outline" onClick={() => setStatus("idle")}>Try Again</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
