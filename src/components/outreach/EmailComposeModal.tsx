import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Send, FileText, Loader2, Save } from "lucide-react";
import type { OutreachTarget } from "@/hooks/use-outreach";
import { useOutreachScripts, useCreateScript } from "@/hooks/use-scripts";
import type { OutreachScript } from "@/lib/script-types";
import { useUpdateTargetState } from "@/hooks/use-outreach";
import { toast } from "sonner";

interface Props {
  target: OutreachTarget | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function EmailComposeModal({ target, open, onOpenChange }: Props) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedScriptId, setSelectedScriptId] = useState("");

  const { data: scripts = [] } = useOutreachScripts();
  const emailScripts = scripts.filter((s) => s.channel === "email");
  const { mutateAsync: updateState, isPending: isSending } = useUpdateTargetState();
  const { mutate: createScript, isPending: isSavingScript } = useCreateScript();

  const resolveVariables = (text: string): string => {
    if (!target) return text;
    return text
      .replace(/\{\{candidate\.first_name\}\}/g, target.entity_name.split(" ")[0])
      .replace(/\{\{candidate\.full_name\}\}/g, target.entity_name)
      .replace(/\{\{candidate\.current_title\}\}/g, target.entity_title ?? "")
      .replace(/\{\{candidate\.current_company\}\}/g, target.entity_company ?? "");
  };

  const handleSelectScript = (scriptId: string) => {
    setSelectedScriptId(scriptId);
    const script = emailScripts.find((s) => s.id === scriptId);
    if (script) {
      setSubject(resolveVariables(script.subject ?? ""));
      setBody(resolveVariables(script.body));
    }
  };

  const handleSend = async () => {
    if (!target || !body.trim()) return;
    await updateState({
      targetId: target.id,
      state: "contacted",
      eventType: "email_sent",
      metadata: {
        subject,
        body,
        script_id: selectedScriptId || undefined,
        channel: "email",
      },
    });
    toast.success("Email logged for " + target.entity_name);
    onOpenChange(false);
    resetForm();
  };

  const handleSaveAsScript = () => {
    if (!body.trim()) return;
    createScript({
      name: subject || "Untitled Email Script",
      channel: "email",
      subject,
      body,
      is_default: false,
      guardrails: [],
    });
  };

  const resetForm = () => {
    setSubject("");
    setBody("");
    setSelectedScriptId("");
  };

  if (!target) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
              <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            Compose Email
          </DialogTitle>
          <DialogDescription className="text-xs">
            To: {target.entity_name}
            {target.entity_email ? ` · ${target.entity_email}` : " · No email on file"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Template selector */}
          {emailScripts.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <FileText className="w-3 h-3" /> Use Template
              </Label>
              <Select value={selectedScriptId || "none"} onValueChange={(v) => handleSelectScript(v === "none" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select a template…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Write from scratch —</SelectItem>
                  {emailScripts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="email-subject" className="text-xs">Subject</Label>
            <Input
              id="email-subject"
              className="h-8 text-sm"
              placeholder="Re: Opportunity at…"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="email-body" className="text-xs">Message</Label>
            <Textarea
              id="email-body"
              className="min-h-[180px] text-sm resize-y"
              placeholder="Write your email message…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground text-right">{body.length} characters</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleSaveAsScript}
              disabled={!body.trim() || isSavingScript}
            >
              <Save className="w-3 h-3" />
              Save as Script
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={!body.trim() || isSending}
              onClick={handleSend}
            >
              {isSending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Log Email Sent
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
