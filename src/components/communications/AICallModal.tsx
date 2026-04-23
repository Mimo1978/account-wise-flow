import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { Phone, CheckCircle2, Loader2, XCircle, Sparkles, Maximize2, Minimize2, CalendarCheck, PhoneIncoming, Briefcase, MessageSquare, RefreshCw, ChevronRight, Mic, Square, Save, BookmarkCheck, Trash2, Library } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useVoiceDictation } from "@/hooks/use-voice-dictation";
import { useCallBriefTemplates, useSaveCallBriefTemplate, useDeleteCallBriefTemplate, useTouchCallBriefTemplate, type CallBriefTemplate } from "@/hooks/use-call-brief-templates";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";

type PresetKey = "book_meeting" | "callback_check" | "intro" | "follow_up" | "demo_confirm" | "custom";

const PRESETS: { key: PresetKey; label: string; icon: any; brief: string; purpose: string }[] = [
  {
    key: "book_meeting",
    label: "Book a meeting",
    icon: CalendarCheck,
    purpose: "Book a meeting",
    brief: "Introduce yourself, ask if they have 20 minutes next week to explore how we can help, and offer two time slots.",
  },
  {
    key: "callback_check",
    label: "Check availability for a callback",
    icon: PhoneIncoming,
    purpose: "Callback availability",
    brief: "Confirm a good time for one of our consultants to call them back. Offer morning or afternoon options.",
  },
  {
    key: "intro",
    label: "Intro call from our agency",
    icon: Briefcase,
    purpose: "Intro Call",
    brief: "Briefly introduce the agency, what we do, and ask if they'd be open to a short discovery chat.",
  },
  {
    key: "follow_up",
    label: "Follow up on previous chat",
    icon: MessageSquare,
    purpose: "Follow Up",
    brief: "Reference our last conversation, check if anything has progressed on their side, and propose a clear next step.",
  },
  {
    key: "demo_confirm",
    label: "Confirm upcoming demo",
    icon: CheckCircle2,
    purpose: "Demo Confirmation",
    brief: "Confirm their demo time, ask if anyone else should join, and check if they have any questions in advance.",
  },
  { key: "custom", label: "Custom brief", icon: Sparkles, purpose: "Other", brief: "" },
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
  const [presetKey, setPresetKey] = useState<PresetKey | null>(null);
  const [purpose, setPurpose] = useState("");
  const [brief, setBrief] = useState("");
  const [enhanced, setEnhanced] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<"idle" | "calling" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const qc = useQueryClient();
  const voice = useVoiceDictation();
  const { data: templates = [] } = useCallBriefTemplates();
  const saveTemplate = useSaveCallBriefTemplate();
  const deleteTemplate = useDeleteCallBriefTemplate();
  const touchTemplate = useTouchCallBriefTemplate();

  useEffect(() => {
    if (open) {
      setPresetKey(null);
      setPurpose("");
      setBrief("");
      setEnhanced("");
      setEnhancing(false);
      setExpanded(false);
      setStatus("idle");
      setErrorMsg("");
      setSaveOpen(false);
      setSaveName("");
      setTemplatesOpen(false);
    }
  }, [open]);

  const fullName = `${contactFirstName} ${contactLastName}`.trim();
  const finalScript = useMemo(() => enhanced || brief, [enhanced, brief]);

  const pickPreset = (p: typeof PRESETS[number]) => {
    setPresetKey(p.key);
    setPurpose(p.purpose);
    if (p.key !== "custom") setBrief(p.brief);
    setEnhanced("");
  };

  const handleEnhance = async () => {
    if (!brief.trim()) {
      toast.error("Write a short brief first — the AI will refine it.");
      return;
    }
    setEnhancing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-enhance-call-brief", {
        body: { purpose: purpose || "Outbound call", brief, contact_name: contactFirstName, company_name: companyName },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data?.message || data.error);
      setEnhanced(data?.enhanced || "");
      toast.success("Brief enhanced");
    } catch (err: any) {
      toast.error(err.message || "Couldn't enhance brief");
    } finally {
      setEnhancing(false);
    }
  };

  const handleCall = async () => {
    if (!purpose.trim()) { toast.error("Pick a purpose or preset"); return; }
    if (!finalScript.trim()) { toast.error("Add a brief for the AI agent"); return; }
    setStatus("calling");
    try {
      const { data, error } = await supabase.functions.invoke("initiate-ai-call", {
        body: {
          contact_id: contactId,
          to_number: contactMobile || "",
          purpose,
          custom_instructions: finalScript,
        },
      });
      if (error) throw error;
      if (data?.error === "integration_not_configured") {
        toast.error("No calling provider configured — go to Admin → Integrations and add your Bland.ai key");
        onOpenChange(false);
        return;
      }
      if (data?.error === "rate_limit_exceeded") {
        toast.error(data.message || "Too many international calls are being placed right now. Please try again in a few minutes.");
        setStatus("idle");
        return;
      }
      if (data?.error === "provider_error" || data?.fallback) {
        throw new Error(data?.message || "Call provider is temporarily unavailable");
      }
      if (!data?.success) throw new Error(data?.message || "Call failed");
      setStatus("success");
      qc.invalidateQueries({ queryKey: ["crm_activities"] });
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message || "Call failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden transition-all duration-200",
          expanded ? "sm:max-w-5xl max-h-[92vh]" : "sm:max-w-xl max-h-[88vh]"
        )}
      >
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="h-8 w-8 rounded-full bg-primary/10 grid place-items-center">
                <Phone className="w-4 h-4 text-primary" />
              </div>
              AI Outbound Call
              <Badge variant="secondary" className="ml-1 text-[10px] uppercase tracking-wide">Beta</Badge>
            </DialogTitle>
            {status === "idle" && (
              <Button
                variant="ghost" size="sm"
                onClick={() => setExpanded(v => !v)}
                className="h-8 px-2 text-muted-foreground"
              >
                {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                <span className="ml-1.5 text-xs hidden sm:inline">{expanded ? "Compact" : "Expand"}</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="overflow-y-auto">
          {/* Contact strip */}
          <div className="px-6 py-3 flex items-center gap-3 border-b border-border bg-muted/30">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="text-xs font-medium">
                {contactFirstName[0]}{contactLastName[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm truncate">{fullName}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {companyName && <span className="truncate">{companyName}</span>}
                {companyName && contactMobile && <span>·</span>}
                <span className="font-mono">{contactMobile || "No phone on file"}</span>
              </div>
            </div>
          </div>

          {status === "idle" && (
            <div className={cn("p-6 grid gap-6", expanded && "lg:grid-cols-2")}>
              {/* LEFT: brief builder */}
              <div className="space-y-5">
                {/* Quick presets */}
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">
                    Quick brief
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESETS.map(p => {
                      const Icon = p.icon;
                      const active = presetKey === p.key;
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => pickPreset(p)}
                          className={cn(
                            "group flex items-start gap-2 rounded-lg border p-2.5 text-left transition-all",
                            "hover:border-primary/50 hover:bg-primary/5",
                            active ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-card"
                          )}
                        >
                          <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                          <span className={cn("text-xs leading-tight", active ? "text-foreground font-medium" : "text-foreground/80")}>
                            {p.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Purpose */}
                <div>
                  <Label htmlFor="ai-call-purpose" className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5 block">
                    Purpose
                  </Label>
                  <input
                    id="ai-call-purpose"
                    value={purpose}
                    onChange={e => setPurpose(e.target.value)}
                    placeholder="e.g. Book a meeting"
                    className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Brief */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="ai-call-brief" className="text-xs uppercase tracking-wide text-muted-foreground">
                      Your brief
                    </Label>
                    <Button
                      type="button" variant="ghost" size="sm"
                      onClick={handleEnhance}
                      disabled={enhancing || !brief.trim()}
                      className="h-7 px-2 text-xs gap-1.5"
                    >
                      {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-primary" />}
                      {enhanced ? "Re-enhance" : "Enhance with AI"}
                    </Button>
                  </div>
                  <Textarea
                    id="ai-call-brief"
                    value={brief}
                    onChange={e => { setBrief(e.target.value); if (enhanced) setEnhanced(""); }}
                    placeholder="Write a few words. e.g. 'Confirm interest in our Q2 advisory offer, propose a 15-min slot next Tue or Wed.'"
                    rows={expanded ? 8 : 5}
                    className="resize-none text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    The AI will polish your brief into a natural script with pauses, suitable for Bland.ai or Twilio voice agents.
                  </p>
                </div>
              </div>

              {/* RIGHT: enhanced preview (only when expanded OR when enhanced exists) */}
              {(expanded || enhanced) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      AI agent script {enhanced && <span className="ml-1 text-primary normal-case tracking-normal">· enhanced</span>}
                    </Label>
                    {enhanced && (
                      <Button variant="ghost" size="sm" onClick={handleEnhance} disabled={enhancing} className="h-7 px-2 text-xs gap-1.5">
                        <RefreshCw className={cn("w-3.5 h-3.5", enhancing && "animate-spin")} /> Regenerate
                      </Button>
                    )}
                  </div>
                  <div className={cn(
                    "rounded-lg border p-3 text-sm leading-relaxed whitespace-pre-wrap min-h-[140px]",
                    enhanced ? "border-primary/30 bg-primary/5 text-foreground" : "border-dashed border-border bg-muted/30 text-muted-foreground italic"
                  )}>
                    {enhanced || (enhancing ? "Enhancing your brief…" : "Click 'Enhance with AI' to preview the script the agent will speak.")}
                  </div>
                  {enhanced && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <ChevronRight className="w-3 h-3" />
                      You can still edit your brief on the left — re-enhance to refresh.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {status === "calling" && (
            <div className="flex flex-col items-center gap-3 py-12 px-6">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                <div className="relative h-12 w-12 rounded-full bg-primary/10 grid place-items-center">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
              </div>
              <p className="text-sm text-foreground font-medium">Dialling {contactFirstName}…</p>
              <p className="text-xs text-muted-foreground">Connecting through your AI voice provider</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-3 py-12 px-6 text-center">
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 grid place-items-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <p className="text-sm font-medium text-foreground">Call queued for {contactFirstName}</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                The AI agent will dial within seconds. A transcript and outcome will appear in this contact's activity timeline.
              </p>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="mt-2">Close</Button>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-3 py-12 px-6 text-center">
              <div className="h-12 w-12 rounded-full bg-destructive/10 grid place-items-center">
                <XCircle className="w-6 h-6 text-destructive" />
              </div>
              <p className="text-sm font-medium text-foreground">Call failed</p>
              <p className="text-xs text-destructive max-w-sm">{errorMsg}</p>
              <Button variant="outline" size="sm" onClick={() => setStatus("idle")} className="mt-2">Try again</Button>
            </div>
          )}
        </div>

        {/* Footer */}
        {status === "idle" && (
          <div className="px-6 py-3 border-t border-border bg-muted/20 flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              {contactMobile ? <>Will call <span className="font-mono text-foreground">{contactMobile}</span></> : "No phone number on this contact"}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                size="sm"
                onClick={handleCall}
                disabled={!purpose.trim() || !finalScript.trim() || !contactMobile}
                className="gap-1.5"
              >
                <Phone className="w-3.5 h-3.5" /> Start AI call
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
