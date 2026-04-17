import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AddLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

const SOURCES = ["LinkedIn (manual)", "Phone referral", "Email", "Other"];
const INTENTS = ["Client brief", "Candidate application", "Unknown"];

const INTENT_MAP: Record<string, string | null> = {
  "Client brief": "client_brief",
  "Candidate application": "candidate_application",
  "Unknown": null,
};

export default function AddLeadModal({ open, onOpenChange, onCreated }: AddLeadModalProps) {
  const { currentWorkspace } = useWorkspace();
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState(SOURCES[0]);
  const [intent, setIntent] = useState(INTENTS[2]);
  const [message, setMessage] = useState("");

  const reset = () => {
    setName(""); setCompany(""); setEmail(""); setPhone("");
    setSource(SOURCES[0]); setIntent(INTENTS[2]); setMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!currentWorkspace?.id) {
      toast.error("No workspace selected");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("leads" as any).insert({
      sender_name: name.trim(),
      title: company.trim() || null,
      sender_email: email.trim() || null,
      sender_phone: phone.trim() || null,
      source_channel: source,
      ai_intent: INTENT_MAP[intent],
      message: message.trim() || null,
      status: "new",
      workspace_id: currentWorkspace.id,
      created_at: new Date().toISOString(),
    } as any);
    setSubmitting(false);

    if (error) {
      toast.error(`Failed to add lead: ${error.message}`);
      return;
    }

    toast.success("Lead added");
    reset();
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="lead-name">Name <span className="text-destructive">*</span></Label>
            <Input id="lead-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lead-company">Company</Label>
              <Input id="lead-company" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-phone">Phone</Label>
              <Input id="lead-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-email">Email</Label>
            <Input id="lead-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Intent</Label>
              <Select value={intent} onValueChange={setIntent}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTENTS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-message">Their message or your notes</Label>
            <Textarea id="lead-message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
