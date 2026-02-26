import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEmailTemplates } from "@/hooks/use-email-templates";
import { TipTapEditor } from "./TipTapEditor";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactEmail?: string | null;
  contactFirstName?: string;
  companyId?: string | null;
  companyName?: string;
  opportunityId?: string | null;
}

export function EmailComposeModal({ open, onOpenChange, contactId, contactEmail, contactFirstName, companyId, companyName, opportunityId }: Props) {
  const [to, setTo] = useState(contactEmail || "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [sending, setSending] = useState(false);
  const { data: templates = [] } = useEmailTemplates();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setTo(contactEmail || "");
      setSubject("");
      setBody("");
      setSelectedTemplate("");
    }
  }, [open, contactEmail]);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    if (templateId === "none") {
      return;
    }
    const t = templates.find(tpl => tpl.id === templateId);
    if (t) {
      let subj = t.subject;
      let html = t.body_html;
      const replacements: Record<string, string> = {
        "{{first_name}}": contactFirstName || "",
        "{{company_name}}": companyName || "",
      };
      for (const [tag, val] of Object.entries(replacements)) {
      subj = subj.split(tag).join(val);
        html = html.split(tag).join(val);
      }
      setSubject(subj);
      setBody(html);
    }
  };

  const handleSend = async () => {
    if (!to.trim() || !subject.trim()) {
      toast.error("To and Subject are required");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: { to: to.trim(), subject, html_body: body, contact_id: contactId, company_id: companyId || null, opportunity_id: opportunityId || null },
      });
      if (error) throw error;
      if (data?.error === "integration_not_configured") {
        toast.error("Email not configured — go to Settings > Integrations");
        onOpenChange(false);
        navigate("/settings/integrations");
        return;
      }
      if (!data?.success) throw new Error(data?.message || "Send failed");
      toast.success(`Email sent to ${to}`);
      qc.invalidateQueries({ queryKey: ["crm_activities"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compose Email</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>To</Label>
            <Input value={to} onChange={e => setTo(e.target.value)} placeholder="email@example.com" />
          </div>
          <div>
            <Label>Template</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
              <SelectTrigger><SelectValue placeholder="No template" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No template</SelectItem>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Subject *</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div>
            <Label>Body</Label>
            <TipTapEditor content={body} onChange={setBody} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Send
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
