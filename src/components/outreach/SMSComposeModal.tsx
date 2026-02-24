import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { MessageSquare, Send, FileText, Loader2, Save } from "lucide-react";
import type { OutreachTarget } from "@/hooks/use-outreach";
import { useOutreachScripts, useCreateScript } from "@/hooks/use-scripts";
import { useUpdateTargetState } from "@/hooks/use-outreach";
import { toast } from "sonner";

interface Props {
  target: OutreachTarget | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function SMSComposeModal({ target, open, onOpenChange }: Props) {
  const [body, setBody] = useState("");
  const [selectedScriptId, setSelectedScriptId] = useState("");

  const { data: scripts = [] } = useOutreachScripts();
  const smsScripts = scripts.filter((s) => s.channel === "sms");
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
    const script = smsScripts.find((s) => s.id === scriptId);
    if (script) {
      setBody(resolveVariables(script.body));
    }
  };

  const handleSend = async () => {
    if (!target || !body.trim()) return;
    await updateState({
      targetId: target.id,
      state: "contacted",
      eventType: "sms_sent",
      metadata: {
        body,
        script_id: selectedScriptId || undefined,
        channel: "sms",
      },
    });
    toast.success("SMS logged for " + target.entity_name);
    onOpenChange(false);
    resetForm();
  };

  const handleSaveAsScript = () => {
    if (!body.trim()) return;
    createScript({
      name: "SMS: " + (body.substring(0, 30) + "…"),
      channel: "sms",
      body,
      is_default: false,
      guardrails: [],
    });
  };

  const resetForm = () => {
    setBody("");
    setSelectedScriptId("");
  };

  if (!target) return null;

  const isOverLimit = body.length > 160;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            Compose SMS
          </DialogTitle>
          <DialogDescription className="text-xs">
            To: {target.entity_name}
            {target.entity_phone ? ` · ${target.entity_phone}` : " · No phone on file"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Template selector */}
          {smsScripts.length > 0 && (
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
                  {smsScripts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="sms-body" className="text-xs">Message</Label>
            <Textarea
              id="sms-body"
              className="min-h-[100px] text-sm resize-y"
              placeholder="Write your SMS message…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="flex items-center justify-between">
              {isOverLimit && (
                <Badge variant="outline" className="text-[10px] text-yellow-600 border-yellow-300">
                  May be split by carrier
                </Badge>
              )}
              <p className={`text-[10px] ml-auto ${isOverLimit ? "text-yellow-600" : "text-muted-foreground"}`}>
                {body.length}/160
              </p>
            </div>
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
              Log SMS Sent
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
