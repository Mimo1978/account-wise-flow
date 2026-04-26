import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { Phone, CheckCircle2, Loader2, XCircle, Sparkles, Maximize2, Minimize2, CalendarCheck, PhoneIncoming, Briefcase, MessageSquare, RefreshCw, ChevronRight, Mic, Square, Save, BookmarkCheck, Trash2, Library, Expand, Shrink, GripHorizontal } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useVoiceDictation } from "@/hooks/use-voice-dictation";
import { useCallBriefTemplates, useSaveCallBriefTemplate, useDeleteCallBriefTemplate, useTouchCallBriefTemplate, type CallBriefTemplate } from "@/hooks/use-call-brief-templates";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CallTemplatesManager } from "./CallTemplatesManager";
import { formatDistanceToNow } from "date-fns";
import { JarvisWorking } from "@/components/ui/JarvisWorking";

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
  entityType?: "contact" | "crm_contact" | "candidate";
  /** Optional Jarvis-driven prefill so the modal arrives partially completed. */
  initialPurpose?: string;
  initialBrief?: string;
  /** When true, the modal will auto-trigger AI enhancement once the brief is set. */
  autoEnhance?: boolean;
}

export function AICallModal({ open, onOpenChange, contactId, contactFirstName, contactLastName, companyName, contactMobile, entityType = "contact", initialPurpose, initialBrief, autoEnhance }: Props) {
  const [presetKey, setPresetKey] = useState<PresetKey | null>(null);
  const [purpose, setPurpose] = useState("");
  const [brief, setBrief] = useState("");
  const [enhanced, setEnhanced] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [status, setStatus] = useState<"idle" | "calling" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveWhich, setSaveWhich] = useState<"both" | "original" | "enhanced">("both");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [autoSavedId, setAutoSavedId] = useState<string | null>(null);
  const qc = useQueryClient();
  const voice = useVoiceDictation();
  const { data: templates = [] } = useCallBriefTemplates();
  const saveTemplate = useSaveCallBriefTemplate();
  const deleteTemplate = useDeleteCallBriefTemplate();
  const touchTemplate = useTouchCallBriefTemplate();

  // ── Draft persistence ────────────────────────────────────────────────────
  // Keep the user's in-progress brief/script alive across modal closes,
  // navigation, and even Jarvis interruptions. Keyed by contact so each
  // person retains their own pending draft.
  const draftKey = `aiCallDraft:${contactId || "none"}`;
  const draftHydratedRef = useRef(false);

  useEffect(() => {
    if (open) {
      // Try to restore an in-flight draft first so nothing is ever lost.
      let restored: { purpose?: string; brief?: string; enhanced?: string } | null = null;
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) restored = JSON.parse(raw);
      } catch { /* ignore */ }

      const hasJarvisPrefill = !!(initialBrief || initialPurpose);
      const hasDraft = !!(restored && (restored.brief || restored.purpose || restored.enhanced));

      // Jarvis prefill wins on a fresh open ONLY if there is no saved draft
      // for this contact — otherwise we resume exactly where the user left off.
      const nextPurpose = hasDraft ? (restored!.purpose || initialPurpose || "") : (initialPurpose || "");
      const nextBrief   = hasDraft ? (restored!.brief   || initialBrief   || "") : (initialBrief   || "");
      const nextEnhanced = hasDraft ? (restored!.enhanced || "") : "";

      setPresetKey(nextBrief || nextPurpose ? "custom" : null);
      setPurpose(nextPurpose);
      setBrief(nextBrief);
      setEnhanced(nextEnhanced);
      setEnhancing(false);
      setExpanded(false);
      setFullscreen(false);
      setStatus("idle");
      setErrorMsg("");
      setSaveOpen(false);
      setSaveName("");
      setTemplatesOpen(false);
      setSaveWhich("both");
      setAutoSavedId(null);
      draftHydratedRef.current = true;

      if (hasDraft && !hasJarvisPrefill) {
        toast.info("Resumed your in-progress call brief", { duration: 2500 });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPurpose, initialBrief]);

  // Auto-save the draft on every meaningful change while the modal is open.
  useEffect(() => {
    if (!open || !draftHydratedRef.current) return;
    try {
      if (!purpose.trim() && !brief.trim() && !enhanced.trim()) {
        localStorage.removeItem(draftKey);
      } else {
        localStorage.setItem(draftKey, JSON.stringify({ purpose, brief, enhanced, savedAt: Date.now() }));
      }
    } catch { /* quota errors ignored */ }
  }, [open, purpose, brief, enhanced, draftKey]);

  const clearDraft = () => {
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
  };

  // ── Draggable positioning ────────────────────────────────────────────────
  // When not in fullscreen, the user can drag the modal by its header.
  // null position = use default centered Radix positioning.
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragStateRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!open) setDragPos(null);
  }, [open]);
  useEffect(() => {
    // Reset drag offset whenever fullscreen toggles to avoid orphan positions.
    if (fullscreen) setDragPos(null);
  }, [fullscreen]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (fullscreen) return;
    e.preventDefault();
    const base = dragPos ?? { x: 0, y: 0 };
    dragStateRef.current = { startX: e.clientX, startY: e.clientY, baseX: base.x, baseY: base.y };
    setDragging(true);
  }, [fullscreen, dragPos]);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => {
      const s = dragStateRef.current; if (!s) return;
      setDragPos({ x: s.baseX + (e.clientX - s.startX), y: s.baseY + (e.clientY - s.startY) });
    };
    const up = () => { setDragging(false); dragStateRef.current = null; };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    return () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
  }, [dragging]);

  // Jarvis-driven auto-enhance: when the modal is opened with a brief and
  // autoEnhance=true, run the AI refinement automatically so the user sees
  // the enhanced script appear in real time.
  const enhanceTriggeredRef = useRef(false);
  useEffect(() => {
    if (!open) { enhanceTriggeredRef.current = false; return; }
    if (autoEnhance && brief.trim() && !enhanced && !enhancing && !enhanceTriggeredRef.current) {
      enhanceTriggeredRef.current = true;
      handleEnhance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoEnhance, brief]);

  const fullName = `${contactFirstName} ${contactLastName}`.trim();
  const finalScript = useMemo(() => enhanced || brief, [enhanced, brief]);

  const pickPreset = (p: typeof PRESETS[number]) => {
    setPresetKey(p.key);
    // Never overwrite what the user has typed or dictated.
    setPurpose(prev => (prev.trim() ? prev : p.purpose));
    if (p.key !== "custom") {
      setBrief(prev => (prev.trim() ? prev : p.brief));
    }
    if (enhanced) setEnhanced("");
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
      const enhancedText = data?.enhanced || "";
      setEnhanced(enhancedText);
      toast.success("Brief enhanced for voice agent");
      // Auto-save to templates so nothing is ever lost, even if the user forgets.
      if (enhancedText && !autoSavedId) {
        try {
          const autoName = `Auto · ${(purpose || "Outbound call").slice(0, 40)} · ${new Date().toLocaleDateString()}`;
          const saved = await saveTemplate.mutateAsync({ name: autoName, purpose, brief, enhanced: enhancedText });
          setAutoSavedId(saved.id);
        } catch {
          // silent — auto-save is best effort
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Couldn't enhance brief");
    } finally {
      setEnhancing(false);
    }
  };

  const handleVoiceToggle = async () => {
    try {
      if (voice.recording) {
        const text = await voice.stopAndTranscribe();
        if (!text) { toast.error("Couldn't hear anything — try again"); return; }
        setBrief(prev => (prev ? `${prev.trim()} ${text}`.trim() : text));
        if (enhanced) setEnhanced("");
        toast.success("Transcribed");
      } else {
        await voice.start();
      }
    } catch (err: any) {
      toast.error(err.message || "Voice dictation failed");
    }
  };

  const handleSaveTemplate = async () => {
    if (!saveName.trim() || !brief.trim()) { toast.error("Add a name and a brief"); return; }
    try {
      // Decide what to persist based on the user's choice.
      const payload = {
        name: saveName.trim(),
        purpose,
        brief: saveWhich === "enhanced" && enhanced ? enhanced : brief,
        enhanced: saveWhich === "original" ? "" : enhanced,
      };
      await saveTemplate.mutateAsync(payload);
      toast.success(
        saveWhich === "original" ? "Original brief saved"
        : saveWhich === "enhanced" ? "Enhanced script saved"
        : "Template saved (original + enhanced)"
      );
      setSaveOpen(false);
      setSaveName("");
      setSaveWhich("both");
    } catch (e: any) {
      toast.error(e.message || "Couldn't save template");
    }
  };

  const applyTemplate = (t: CallBriefTemplate) => {
    setPurpose(t.purpose || "");
    setBrief(t.brief);
    setEnhanced(t.enhanced || "");
    setPresetKey("custom");
    setTemplatesOpen(false);
    touchTemplate.mutate(t.id);
    toast.success(`Loaded "${t.name}"`);
  };

  // Quick one-click save from below the AI Agent Script.
  // Auto-names the template and confirms with a date stamp.
  const handleQuickSaveScript = async () => {
    const sourceText = (enhanced || brief).trim();
    if (!sourceText) { toast.error("Nothing to save yet — write a brief or enhance one first."); return; }
    try {
      const now = new Date();
      const stamp = now.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const baseName = (purpose?.trim() || "Call script");
      const name = `${baseName} – ${stamp}`;
      await saveTemplate.mutateAsync({
        name,
        purpose: purpose || "",
        brief,
        enhanced: enhanced || "",
      });
      toast.success("Saved to your templates", {
        description: `"${name}" — available on every contact for future AI calls.`,
        duration: 4000,
      });
    } catch (e: any) {
      toast.error(e.message || "Couldn't save template");
    }
  };

  const handleCall = async () => {
    if (!purpose.trim()) { toast.error("Pick a purpose or preset"); return; }
    if (!finalScript.trim()) { toast.error("Add a brief for the AI agent"); return; }
    setStatus("calling");
    try {
      const { data, error } = await supabase.functions.invoke("initiate-ai-call", {
        body: {
          entity_id: contactId,
          entity_type: entityType,
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
      // Successful dial — wipe the draft so we don't resurrect a stale brief.
      clearDraft();
      qc.invalidateQueries({ queryKey: ["crm_activities"] });
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message || "Call failed");
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden flex flex-col transition-[width,max-width,height,max-height] duration-200",
          fullscreen
            ? "!fixed !inset-2 !left-2 !top-2 !translate-x-0 !translate-y-0 !w-[calc(100vw-1rem)] !max-w-none !h-[calc(100vh-1rem)] !max-h-none !rounded-lg"
            : expanded
              ? "sm:max-w-5xl max-h-[92vh] h-[92vh]"
              : "sm:max-w-xl max-h-[88vh] h-[88vh]"
        )}
        style={
          !fullscreen && dragPos
            ? {
                left: `calc(50% + ${dragPos.x}px)`,
                top: `calc(50% + ${dragPos.y}px)`,
              }
            : undefined
        }
        // Prevent accidental dismissal while Jarvis (or the user) is mid-flow.
        // The modal can still be closed via the X button, Cancel, or success.
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          // Only allow ESC to close on the success/error confirmation screens.
          if (status === "calling" || (status === "idle" && (brief.trim() || enhanced.trim()))) {
            e.preventDefault();
          }
        }}
      >
        {/* Header */}
        <DialogHeader
          onMouseDown={handleDragStart}
          className={cn(
            "px-6 py-4 border-b border-border bg-gradient-to-br from-primary/5 to-transparent shrink-0 select-none",
            !fullscreen && (dragging ? "cursor-grabbing" : "cursor-grab")
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="h-8 w-8 rounded-full bg-primary/10 grid place-items-center">
                <Phone className="w-4 h-4 text-primary" />
              </div>
              AI Outbound Call
              <Badge variant="secondary" className="ml-1 text-[10px] uppercase tracking-wide">Beta</Badge>
              {!fullscreen && (
                <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground/60 ml-1" aria-hidden />
              )}
            </DialogTitle>
            {status === "idle" && (
              <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setTemplatesOpen(true)}
                  className="h-8 px-2 text-muted-foreground gap-1.5"
                  title="Browse, edit and reuse saved templates"
                >
                  <Library className="w-4 h-4" />
                  <span className="text-xs hidden sm:inline">Templates</span>
                  {templates.length > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px]">{templates.length}</Badge>
                  )}
                </Button>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setExpanded(v => !v)}
                  className="h-8 px-2 text-muted-foreground"
                >
                  {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  <span className="ml-1.5 text-xs hidden sm:inline">{expanded ? "Compact" : "Expand"}</span>
                </Button>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setFullscreen(v => !v)}
                  className="h-8 px-2 text-muted-foreground"
                  title={fullscreen ? "Exit full screen" : "Full screen"}
                >
                  {fullscreen ? <Shrink className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
                  <span className="ml-1.5 text-xs hidden sm:inline">{fullscreen ? "Windowed" : "Full"}</span>
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
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
                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button" variant="ghost" size="sm"
                        onClick={handleVoiceToggle}
                        disabled={voice.transcribing}
                        className={cn(
                          "h-7 px-2 text-xs gap-1.5",
                          voice.recording && "text-destructive hover:text-destructive"
                        )}
                        title={voice.recording ? "Stop & transcribe" : "Dictate with mic"}
                      >
                        {voice.transcribing ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Transcribing…</>
                        ) : voice.recording ? (
                          <>
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
                            </span>
                            <Square className="w-3 h-3" /> {voice.elapsed}s
                          </>
                        ) : (
                          <><Mic className="w-3.5 h-3.5" /> Dictate</>
                        )}
                      </Button>
                      <Popover open={saveOpen} onOpenChange={setSaveOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button" variant="ghost" size="sm"
                            disabled={!brief.trim()}
                            className="h-7 px-2 text-xs gap-1.5"
                            title="Save this brief as a template"
                          >
                            <Save className="w-3.5 h-3.5" /> Save
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-80 p-3">
                          <Label className="text-xs">Template name</Label>
                          <input
                            value={saveName}
                            onChange={e => setSaveName(e.target.value)}
                            placeholder="e.g. Warm intro – C-suite"
                            className="w-full mt-1 h-8 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            onKeyDown={e => { if (e.key === "Enter") handleSaveTemplate(); }}
                          />
                          <Label className="text-xs mt-3 block">What to save</Label>
                          <div className="mt-1 grid grid-cols-3 gap-1.5">
                            {([
                              { k: "both", l: "Both" },
                              { k: "original", l: "Original" },
                              { k: "enhanced", l: "Enhanced" },
                            ] as const).map(opt => {
                              const disabled = opt.k === "enhanced" && !enhanced;
                              const active = saveWhich === opt.k;
                              return (
                                <button
                                  key={opt.k}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => setSaveWhich(opt.k)}
                                  className={cn(
                                    "h-7 rounded-md border text-[11px] font-medium transition-colors",
                                    active ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground",
                                    disabled && "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  {opt.l}
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
                            {autoSavedId ? "Already auto-saved once — this adds a named version." : "Tip: enhanced scripts are auto-saved so you never lose one."}
                          </p>
                          <div className="flex justify-end gap-2 mt-3">
                            <Button size="sm" variant="ghost" onClick={() => setSaveOpen(false)}>Cancel</Button>
                            <Button size="sm" onClick={handleSaveTemplate} disabled={saveTemplate.isPending || !saveName.trim()}>
                              {saveTemplate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookmarkCheck className="w-3.5 h-3.5" />}
                              Save
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Button
                        type="button" variant="ghost" size="sm"
                        onClick={handleEnhance}
                        disabled={enhancing || !brief.trim()}
                        className="h-7 px-2 text-xs gap-1.5"
                      >
                        {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-primary" />}
                        {enhanced ? "Re-enhance" : "Enhance"}
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    id="ai-call-brief"
                    value={brief}
                    onChange={e => { setBrief(e.target.value); if (enhanced) setEnhanced(""); }}
                    placeholder="Type or hit Dictate to speak. e.g. 'Confirm interest in our Q2 advisory offer, propose a 15-min slot next Tue or Wed.'"
                    rows={expanded ? 8 : 5}
                    className="resize-none text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    AI converts your brief into a turn-by-turn conversation — the agent speaks one line, <em>waits</em> for a reply, then responds. No blurted monologues.
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
                    "rounded-lg border p-3 text-sm leading-relaxed whitespace-pre-wrap min-h-[140px] overflow-y-auto",
                    fullscreen
                      ? "max-h-[calc(100vh-22rem)]"
                      : expanded
                        ? "max-h-[60vh]"
                        : "max-h-[40vh]",
                    enhanced ? "border-primary/30 bg-primary/5 text-foreground" : "border-dashed border-border bg-muted/30 text-muted-foreground italic"
                  )}>
                    {enhanced ? (
                      enhanced
                    ) : enhancing ? (
                      <div className="flex items-center justify-center min-h-[120px]">
                        <JarvisWorking
                          size={56}
                          label="Enhancing your brief"
                          sublabel="Jarvis is drafting a turn-by-turn script"
                        />
                      </div>
                    ) : (
                      "Click 'Enhance with AI' to preview the script the agent will speak."
                    )}
                  </div>
                  {enhanced && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <ChevronRight className="w-3 h-3" />
                      You can still edit your brief on the left — re-enhance to refresh.
                    </p>
                  )}
                  {(enhanced || brief.trim()) && (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <p className="text-[11px] text-muted-foreground">
                        Save this {enhanced ? "script" : "brief"} so you can reuse it on any contact.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleQuickSaveScript}
                        disabled={saveTemplate.isPending || !(enhanced || brief.trim())}
                        className="h-8 px-3 gap-1.5"
                        title="Save to your call templates"
                      >
                        {saveTemplate.isPending
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <BookmarkCheck className="w-3.5 h-3.5 text-primary" />}
                        Save to templates
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {status === "calling" && (
            <div className="flex flex-col items-center gap-2 py-12 px-6">
              <JarvisWorking
                size={88}
                label={`Dialling ${contactFirstName}`}
                sublabel="Connecting through your AI voice provider"
              />
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
    <CallTemplatesManager
      open={templatesOpen}
      onOpenChange={setTemplatesOpen}
      onUseTemplate={(t) => applyTemplate(t)}
    />
    </>
  );
}
