import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mic, Square, Sparkles, Maximize2, Loader2, Wand2 } from "lucide-react";
import { useVoiceDictation } from "@/hooks/use-voice-dictation";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface QuickTemplate {
  label: string;
  text: string;
}

interface Props {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  multiline?: boolean;
  className?: string;
  /** Channel context passed to AI Polish so the prompt is appropriate */
  channel?: "email" | "sms" | "call";
  /** Optional preset snippets that insert/append at cursor */
  quickTemplates?: QuickTemplate[];
  /** Label shown in the expand modal title */
  expandTitle?: string;
  /** Disable the toolbar entirely (read-only mode) */
  disabled?: boolean;
  /** Extra slot rendered inside toolbar (e.g. char counter / variable picker btn) */
  toolbarExtras?: React.ReactNode;
}

/**
 * EnhancedTextField — a textarea (or input when multiline=false) with a
 * per-field toolbar offering:
 *  • Voice dictation (appends transcript to current value)
 *  • AI Polish (rewrites THIS field only — never touches sibling fields)
 *  • Expand to fullscreen modal for comfortable typing
 *  • Quick-template buttons that insert ready-made copy
 *  • Native browser spellcheck (spellCheck=true)
 */
export function EnhancedTextField({
  id,
  value,
  onChange,
  placeholder,
  rows = 6,
  multiline = true,
  className,
  channel = "email",
  quickTemplates,
  expandTitle = "Edit text",
  disabled,
  toolbarExtras,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const dict = useVoiceDictation();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    if (!ta || !multiline) {
      onChange((value ? value + (value.endsWith(" ") ? "" : " ") : "") + text);
      return;
    }
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + text.length, start + text.length);
    }, 10);
  };

  const handleVoiceToggle = async () => {
    try {
      if (!dict.recording) {
        await dict.start();
        toast.message("Recording… click stop when done");
      } else {
        const text = await dict.stopAndTranscribe();
        if (text) {
          const sep = value && !value.endsWith(" ") && !value.endsWith("\n") ? " " : "";
          onChange(value + sep + text);
          toast.success("Transcribed");
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Voice dictation failed");
    }
  };

  const handlePolish = async () => {
    if (!value.trim()) {
      toast.error("Nothing to polish yet");
      return;
    }
    setPolishing(true);
    try {
      // Send only this field's body — server returns a polished body string.
      // We replace ONLY this field; sibling fields (subject, other call blocks)
      // are untouched because we never sent them.
      const { data, error } = await supabase.functions.invoke("ai-script-assist", {
        body: {
          mode: "polish",
          channel,
          body: value,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || data?.error || "AI failed");
      if (typeof data.body === "string" && data.body.trim()) {
        const cleaned = data.body;
        if (cleaned.trim() === value.trim()) {
          toast.message("Looks clean — no changes needed");
        } else {
          onChange(cleaned);
          toast.success("Polished — typos and grammar fixed");
        }
      } else {
        toast.message("No changes suggested");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI polish failed");
    } finally {
      setPolishing(false);
    }
  };

  // Auto-grow when expanded modal mounts
  useEffect(() => {
    if (expanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [expanded]);

  const Toolbar = (
    <div className="flex items-center gap-1 flex-wrap">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={cn("h-7 px-2 gap-1.5", dict.recording && "text-destructive")}
        onClick={handleVoiceToggle}
        disabled={disabled || dict.transcribing}
        title={dict.recording ? "Stop recording" : "Voice dictate"}
      >
        {dict.transcribing ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : dict.recording ? (
          <Square className="w-3.5 h-3.5 fill-current" />
        ) : (
          <Mic className="w-3.5 h-3.5" />
        )}
        <span className="text-[11px]">
          {dict.recording ? `Stop ${dict.elapsed}s` : dict.transcribing ? "Transcribing…" : "Dictate"}
        </span>
      </Button>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 px-2 gap-1.5"
        onClick={handlePolish}
        disabled={disabled || polishing || !value.trim()}
        title="Polish only this field — leaves other fields untouched"
      >
        {polishing ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
        <span className="text-[11px]">AI Polish</span>
      </Button>

      {multiline && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 gap-1.5"
          onClick={() => setExpanded(true)}
          disabled={disabled}
          title="Expand to fullscreen"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="text-[11px]">Expand</span>
        </Button>
      )}

      {toolbarExtras}
    </div>
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        {Toolbar}
      </div>

      {quickTemplates && quickTemplates.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {quickTemplates.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => insertAtCursor(t.text)}
              disabled={disabled}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-border/60 hover:bg-accent transition-colors"
              title={t.text}
            >
              <Wand2 className="w-2.5 h-2.5" />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {multiline ? (
        <Textarea
          id={id}
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          spellCheck
          disabled={disabled}
          className={cn("text-sm font-mono resize-y", className)}
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck
          disabled={disabled}
          className={cn("text-sm", className)}
        />
      )}

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0 z-[10001]">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/50 shrink-0">
            <DialogTitle className="text-base font-semibold">{expandTitle}</DialogTitle>
            <div className="pt-2">{Toolbar}</div>
          </DialogHeader>
          <div className="flex-1 min-h-0 px-6 py-4">
            <Textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              spellCheck
              placeholder={placeholder}
              className="w-full h-full text-sm font-mono resize-none"
            />
          </div>
          <div className="px-6 py-3 border-t border-border/50 flex justify-end shrink-0">
            <Button size="sm" onClick={() => setExpanded(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}