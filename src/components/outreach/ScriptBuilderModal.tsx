import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Layers,
  Plus,
  Save,
  Trash2,
  Variable,
  FlaskConical,
  Sparkles,
  Briefcase,
  Loader2,
} from "lucide-react";
import {
  ALLOWED_VARIABLES,
  DEFAULT_GUARDRAILS,
  checkGuardrails,
  getDefaultScriptBody,
  getDefaultCallBlocks,
  type GuardrailViolation,
  type OutreachScript,
  type ScriptChannel,
  type CallBlock,
  type CallBlockType,
} from "@/lib/script-types";
import { useCreateScript, useUpdateScript } from "@/hooks/use-scripts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useJobs } from "@/hooks/use-jobs";
import { useWorkspaceSettings } from "@/hooks/use-workspace-settings";
import { Building2 } from "lucide-react";

import { ScriptSimulator } from "./ScriptSimulator";
import { cn } from "@/lib/utils";
import { EnhancedTextField } from "./EnhancedTextField";
import { ScriptTemplateLibrary, type ReadyTemplate } from "./ScriptTemplateLibrary";
import { CallGoalTemplates, type CallGoalTemplate } from "./CallGoalTemplates";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { ProofreadReviewModal, type ProofreadField } from "./ProofreadReviewModal";
import { AssignToCampaignPrompt } from "./AssignToCampaignPrompt";
import { JarvisScriptWizard, type WizardPatch } from "./JarvisScriptWizard";
import { Bot } from "lucide-react";
import { RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Quick-insert ready-made snippets per channel for fast script authoring.
const QUICK_TEMPLATES_EMAIL = [
  { label: "Greeting", text: "Hi {{candidate.first_name}},\n\n" },
  { label: "Hook", text: "I came across your background and thought of an opportunity that aligns with your experience. " },
  { label: "Value", text: "It's a strong fit for someone with your skills in {{candidate.skills_top}}. " },
  { label: "Call-to-action", text: "\n\nWould you be open to a quick 10-minute call this week?" },
  { label: "Sign-off", text: "\n\nBest regards,\n{{recruiter.name}}\n{{agency.name}}" },
  { label: "Opt-out", text: "\n\nIf you'd prefer not to receive these messages, just reply STOP." },
];
const QUICK_TEMPLATES_SMS = [
  { label: "Greeting", text: "Hi {{candidate.first_name}}, " },
  { label: "Quick pitch", text: "{{recruiter.name}} from {{agency.name}} here — " },
  { label: "Ask", text: "Open to a quick chat about a new role? " },
  { label: "Opt-out", text: "Reply STOP to opt out." },
];
const QUICK_TEMPLATES_SUBJECT = [
  { label: "Role + co", text: "{{job.title}} opportunity at {{job.company}}" },
  { label: "Quick chat", text: "Quick chat about {{job.title}}?" },
  { label: "Personal", text: "{{candidate.first_name}} — thought of you for this" },
];
const QUICK_TEMPLATES_CALL = [
  { label: "Intro", text: "Hi {{candidate.first_name}}, this is {{recruiter.name}} from {{agency.name}}. " },
  { label: "Permission", text: "Do you have a couple of minutes to chat? " },
  { label: "Question", text: "What's most important to you in your next role? " },
  { label: "Close", text: "Thanks for your time — I'll follow up with details by email." },
];

// re-export type for callers
export type { OutreachScript };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignId?: string;
  /** Pass existing script to edit */
  script?: OutreachScript;
  /** Pre-select the channel when creating a new script */
  defaultChannel?: ScriptChannel;
}

const BLOCK_TYPE_LABELS: Record<CallBlockType, string> = {
  intro: "Introduction",
  permission: "Permission Check",
  questions: "Qualifying Questions",
  branching: "Branching Response",
  close: "Close",
};

const BLOCK_TYPE_COLORS: Record<CallBlockType, string> = {
  intro: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  permission: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  questions: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  branching: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  close: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
};

// ─── Main component ───────────────────────────────────────────────────────────

export function ScriptBuilderModal({ open, onOpenChange, campaignId, script, defaultChannel }: Props) {
  const isEdit = !!script;

  const [tab, setTab] = useState<"editor" | "guardrails" | "simulate">("editor");
  const [name, setName] = useState(script?.name ?? "");
  const [channel, setChannel] = useState<ScriptChannel>(script?.channel ?? defaultChannel ?? "email");
  const [subject, setSubject] = useState(script?.subject ?? "");
  const [body, setBody] = useState(script?.body ?? getDefaultScriptBody("email"));
  const [callBlocks, setCallBlocks] = useState<CallBlock[]>(script?.call_blocks ?? getDefaultCallBlocks());
  const [expandedBlock, setExpandedBlock] = useState<string | null>("intro");
  const [guardrails] = useState(script?.guardrails ?? DEFAULT_GUARDRAILS);
  const [varPickerOpen, setVarPickerOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  // Voice persona — auto-introduces the AI agent on calls. The integration
  // (ElevenLabs / Twilio) maps these to real voice IDs server-side.
  const [agentVoice, setAgentVoice] = useState<"auto" | "female_warm" | "female_pro" | "male_warm" | "male_pro">("auto");
  const [agentName, setAgentName] = useState<string>("");

  // Remember per-channel drafts so swapping the channel dropdown is
  // non-destructive and immediately reflects the right template.
  const initialChannel: ScriptChannel = script?.channel ?? defaultChannel ?? "email";
  const [emailDraft, setEmailDraft] = useState<string>(
    initialChannel === "email" ? (script?.body ?? getDefaultScriptBody("email")) : getDefaultScriptBody("email"),
  );
  const [smsDraft, setSmsDraft] = useState<string>(
    initialChannel === "sms" ? (script?.body ?? getDefaultScriptBody("sms")) : getDefaultScriptBody("sms"),
  );

  const { mutateAsync: createScript, isPending: creating } = useCreateScript();
  const { mutateAsync: updateScript, isPending: updating } = useUpdateScript();
  const isPending = creating || updating;

  // ── AI assist state ────────────────────────────────────────────────────────
  const [aiBusy, setAiBusy] = useState<null | "polish" | "link_job">(null);
  const [linkedJobId, setLinkedJobId] = useState<string | null>(null);
  // Pre-save spell/grammar gate state.
  const [proofreading, setProofreading] = useState(false);
  const [proofResults, setProofResults] = useState<ProofreadField[] | null>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  // Post-save: prompt to assign to a campaign (only when not already campaign-scoped).
  const [assignPromptOpen, setAssignPromptOpen] = useState(false);
  const [savedScript, setSavedScript] = useState<{ id: string; name: string; channel: ScriptChannel } | null>(null);
  const { data: jobs = [] } = useJobs();
  const activeJobs = jobs.filter((j) => j.status === "active" || j.status === "draft");

  // Jarvis guided wizard state — slides in over the modal and walks the user
  // through every field with voice + text + autofill.
  const [wizardOpen, setWizardOpen] = useState(false);

  // Confirm dialog for the destructive "Reset form" action in the header.
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  /**
   * Wipe every field in the editor back to a blank, default state so the user
   * can start the script over. Does not save — the user must still click
   * "Update Script" / "Create Script" to persist.
   */
  const handleResetForm = useCallback(() => {
    const ch: ScriptChannel = defaultChannel ?? "email";
    setName("");
    setChannel(ch);
    setSubject("");
    setBody(ch === "call" ? "" : getDefaultScriptBody(ch));
    setEmailDraft(getDefaultScriptBody("email"));
    setSmsDraft(getDefaultScriptBody("sms"));
    setCallBlocks(getDefaultCallBlocks());
    setExpandedBlock("intro");
    setLinkedJobId(null);
    setAgentVoice("auto");
    setAgentName("");
    setResetConfirmOpen(false);
    toast.success("Form reset — all fields cleared");
  }, [defaultChannel]);

  /**
   * Apply a partial patch from the Jarvis wizard back into modal state.
   * Always additive — never blows away existing user edits unless the wizard
   * explicitly provides a value for that field.
   */
  const applyWizardPatch = useCallback(
    (patch: WizardPatch) => {
      if (patch.name !== undefined) setName(patch.name);
      if (patch.channel !== undefined) handleChannelChange(patch.channel);
      if (patch.subject !== undefined) setSubject(patch.subject);
      if (patch.body !== undefined) {
        setBody(patch.body);
        if (channel === "email") setEmailDraft(patch.body);
        if (channel === "sms") setSmsDraft(patch.body);
      }
      if (patch.agentName !== undefined) setAgentName(patch.agentName);
      if (patch.callBlock) {
        setCallBlocks((prev) =>
          prev.map((b) =>
            b.id === patch.callBlock!.blockId ? { ...b, content: patch.callBlock!.content } : b,
          ),
        );
        setExpandedBlock(patch.callBlock.blockId);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [channel],
  );

  // ── Agency name (workspace setting) ───────────────────────────────────────
  const { settings, updateSettings } = useWorkspaceSettings();
  const { currentWorkspace } = useWorkspace();
  const [agencyName, setAgencyName] = useState<string>("");
  useEffect(() => {
    // Default to the workspace name (the enterprise paying for the service)
    // when no explicit agency_name has been saved yet.
    if (settings?.agency_name) setAgencyName(settings.agency_name);
    else if (currentWorkspace?.name) setAgencyName(currentWorkspace.name);
  }, [settings?.agency_name, currentWorkspace?.name]);
  const persistAgencyName = () => {
    const trimmed = agencyName.trim();
    if (trimmed === (settings?.agency_name ?? "")) return;
    updateSettings({ agency_name: trimmed });
  };

  // Reset all per-channel state when the modal is opened fresh for a new script,
  // and when an existing script is loaded into the modal.
  useEffect(() => {
    if (!open) return;
    setWizardOpen(false);
    setName(script?.name ?? "");
    const ch: ScriptChannel = script?.channel ?? defaultChannel ?? "email";
    setChannel(ch);
    setSubject(script?.subject ?? "");
    setBody(ch === "call" ? "" : (script?.body ?? getDefaultScriptBody(ch)));
    setEmailDraft(ch === "email" ? (script?.body ?? getDefaultScriptBody("email")) : getDefaultScriptBody("email"));
    setSmsDraft(ch === "sms" ? (script?.body ?? getDefaultScriptBody("sms")) : getDefaultScriptBody("sms"));
    setCallBlocks(script?.call_blocks ?? getDefaultCallBlocks());
    setExpandedBlock("intro");
    setLinkedJobId(null);
    setTab("editor");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, script?.id]);

  // Apply a ready-made template into the editor.
  const handleApplyTemplate = (tpl: ReadyTemplate, mode: "use" | "edit") => {
    // Switch channel if the template targets a different one
    if (tpl.channel !== channel) {
      setChannel(tpl.channel);
    }
    if (!name.trim()) setName(tpl.name);

    if (tpl.channel === "email") {
      setSubject(tpl.subject ?? "");
      setBody(tpl.body ?? "");
      setEmailDraft(tpl.body ?? "");
    } else if (tpl.channel === "sms") {
      setBody(tpl.body ?? "");
      setSmsDraft(tpl.body ?? "");
    } else if (tpl.channel === "call") {
      setCallBlocks(tpl.call_blocks ?? getDefaultCallBlocks());
      setExpandedBlock(tpl.call_blocks?.[0]?.id ?? "intro");
      setBody("");
    }
    setTemplatesOpen(false);
    toast.success(mode === "use" ? "Template applied — ready to save" : "Template applied — edit away");
  };

  // Live guardrail check
  const effectiveBody = channel === "call"
    ? callBlocks.map((b) => b.content).join("\n")
    : body;
  // Honour the workspace-level "Strict script safety" admin toggle (defaults
  // to ON). When OFF, profanity/discrimination/threat rules become warnings
  // instead of hard blockers — structural completeness checks still apply.
  const strictSafety =
    (settings as any)?.outreach_rules?.script_safety_strict !== false;
  const violations: GuardrailViolation[] = checkGuardrails(
    effectiveBody,
    channel,
    guardrails,
    { subject, callBlocks, strictSafety },
  );
  const errors = violations.filter((v) => v.rule.severity === "error");
  const warnings = violations.filter((v) => v.rule.severity === "warning");

  // When channel changes, reset the relevant per-channel state cleanly.
  // Always reset both body and call_blocks so the editor never shows stale
  // content from the previous channel.
  const handleChannelChange = (ch: ScriptChannel) => {
    if (ch === channel) return;
    // Stash the current channel's content into its draft slot so we can
    // restore it if the user switches back without losing edits.
    if (channel === "email") setEmailDraft(body);
    if (channel === "sms") setSmsDraft(body);

    setChannel(ch);
    // Subject only applies to email — keep it stashed so toggling back restores it.
    if (ch !== "email") {
      // no-op: we keep `subject` in state so it returns when the user comes back
    }
    if (ch === "call") {
      setBody("");
      if (callBlocks.length === 0) setCallBlocks(getDefaultCallBlocks());
      setExpandedBlock("intro");
    } else if (ch === "email") {
      setBody(emailDraft || getDefaultScriptBody("email"));
    } else if (ch === "sms") {
      setBody(smsDraft || getDefaultScriptBody("sms"));
    }
  };

  // ── AI Assist ──────────────────────────────────────────────────────────────
  async function runAiAssist(mode: "polish" | "link_job") {
    if (mode === "link_job" && !linkedJobId) {
      toast.error("Pick a job to link first");
      return;
    }
    setAiBusy(mode);
    try {
      const { data, error } = await supabase.functions.invoke("ai-script-assist", {
        body: {
          mode,
          channel,
          subject: channel === "email" ? subject : undefined,
          body: channel === "call" ? undefined : body,
          call_blocks: channel === "call" ? callBlocks : undefined,
          job_id: mode === "link_job" ? linkedJobId : undefined,
          agency_name: agencyName.trim() || undefined,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || data?.error || "AI failed");

      if (channel === "call" && Array.isArray(data.call_blocks)) {
        setCallBlocks(data.call_blocks);
      } else {
        if (typeof data.body === "string") setBody(data.body);
        if (channel === "email" && typeof data.subject === "string" && data.subject.trim()) {
          setSubject(data.subject);
        }
      }
      toast.success(
        mode === "polish"
          ? "Script polished"
          : `Job linked — company anonymised as "${data.anon_company || "a leading client"}"`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI assist failed";
      toast.error(msg);
    } finally {
      setAiBusy(null);
    }
  }

  // Insert a variable at cursor (for textarea)
  const insertVariable = useCallback((varKey: string) => {
    const ta = document.getElementById("script-body") as HTMLTextAreaElement | null;
    if (!ta) {
      setBody((prev) => prev + varKey);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    setBody((prev) => prev.slice(0, start) + varKey + prev.slice(end));
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + varKey.length, start + varKey.length);
    }, 10);
    setVarPickerOpen(false);
  }, []);

  // Call block helpers
  const updateBlock = (id: string, patch: Partial<CallBlock>) => {
    setCallBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };
  const addBlock = () => {
    const id = `block-${Date.now()}`;
    setCallBlocks((prev) => [
      ...prev,
      { id, type: "questions", title: "New Block", content: "" },
    ]);
    setExpandedBlock(id);
  };
  const removeBlock = (id: string) => {
    setCallBlocks((prev) => prev.filter((b) => b.id !== id));
  };
  const moveBlock = (id: string, dir: "up" | "down") => {
    setCallBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swapIdx = dir === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  };

  /**
   * Apply a ready-made goal template. If the existing script is empty / untouched,
   * we replace blocks outright; otherwise we append so the user doesn't lose work.
   */
  const handleApplyGoalTemplate = (blocks: CallBlock[], template: CallGoalTemplate) => {
    const existingHasContent = callBlocks.some((b) => b.content.trim().length > 0);
    if (existingHasContent) {
      setCallBlocks((prev) => [...prev, ...blocks]);
      toast.success(`Added "${template.label}" blocks below — edit to personalise.`);
    } else {
      setCallBlocks(blocks);
      toast.success(`Loaded "${template.label}" template — edit to personalise.`);
    }
    setExpandedBlock(blocks[0]?.id ?? null);
  };

  /**
   * Persist whatever is currently in state. Used as the final step after
   * the proofread gate (or when the user opts to save without fixes).
   */
  const persistScript = async (overrides?: {
    subject?: string;
    body?: string;
    callBlocks?: CallBlock[];
  }) => {
    const finalSubject = overrides?.subject ?? subject;
    const finalBody = overrides?.body ?? body;
    const finalBlocks = overrides?.callBlocks ?? callBlocks;

    const payload = {
      name,
      channel,
      subject: channel === "email" ? finalSubject : undefined,
      body: channel === "call" ? "" : finalBody,
      call_blocks: channel === "call" ? finalBlocks : undefined,
      guardrails,
      is_default: false,
      campaign_id: campaignId,
    };
    let resultId: string | undefined;
    if (isEdit && script) {
      const r = await updateScript({ id: script.id, ...payload });
      resultId = r?.id ?? script.id;
    } else {
      const r = await createScript(payload as Omit<OutreachScript, "id" | "created_at" | "updated_at" | "workspace_id" | "version">);
      resultId = r?.id;
    }
    // If the script wasn't created in the context of a specific campaign,
    // ask the user whether they want to assign it to one now. Otherwise
    // close immediately (the campaign view will pick up the new script).
    if (!campaignId && !isEdit && resultId) {
      setSavedScript({ id: resultId, name, channel });
      setAssignPromptOpen(true);
    } else {
      onOpenChange(false);
    }
  };

  /**
   * Pre-flight spell + grammar check. Runs the `proofread` mode of
   * ai-script-assist across every text field. If issues are found we open
   * the ProofreadReviewModal — otherwise we save immediately.
   * This is the "security gate" preventing typos being read aloud by an AI agent.
   */
  const handleSave = async () => {
    if (errors.length > 0) return; // blocked by guardrails

    // Build the field list to proofread depending on channel.
    const fields: Array<{ id: string; label: string; text: string }> = [];
    if (channel === "email") {
      if (subject?.trim()) fields.push({ id: "__subject", label: "Subject", text: subject });
      if (body?.trim()) fields.push({ id: "__body", label: "Email body", text: body });
    } else if (channel === "sms") {
      if (body?.trim()) fields.push({ id: "__body", label: "SMS body", text: body });
    } else {
      // call — every block content
      for (const b of callBlocks) {
        if (b.content?.trim()) {
          fields.push({ id: b.id, label: b.title || BLOCK_TYPE_LABELS[b.type], text: b.content });
        }
      }
    }

    if (fields.length === 0) {
      await persistScript();
      return;
    }

    setProofreading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-script-assist", {
        body: { mode: "proofread", channel, fields },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || data?.error || "Proofread failed");

      const corrected: ProofreadField[] = (data.corrected || [])
        .map((c: ProofreadField) => ({
          ...c,
          issues: Array.isArray(c.issues) ? c.issues : [],
        }))
        // only show fields that actually have issues OR a meaningful change
        .filter(
          (c: ProofreadField) =>
            (c.issues && c.issues.length > 0) ||
            (c.corrected && c.corrected.trim() !== c.original.trim()),
        );

      if (corrected.length === 0) {
        toast.success("Spell-check passed — saving");
        await persistScript();
        return;
      }

      setProofResults(corrected);
      setProofOpen(true);
    } catch (e) {
      // Non-blocking: warn the user and let them save anyway via a confirm.
      const msg = e instanceof Error ? e.message : "Spell-check unavailable";
      const ok = window.confirm(
        `${msg}\n\nProceed to save without spell-check? The AI agent will read this script word-for-word.`,
      );
      if (ok) await persistScript();
    } finally {
      setProofreading(false);
    }
  };

  const applyCorrectionsAndSave = async (correctedById: Record<string, string>) => {
    setPendingSave(true);
    try {
      let nextSubject = subject;
      let nextBody = body;
      let nextBlocks = callBlocks;

      if (channel === "email") {
        if (correctedById["__subject"] !== undefined) nextSubject = correctedById["__subject"];
        if (correctedById["__body"] !== undefined) nextBody = correctedById["__body"];
        setSubject(nextSubject);
        setBody(nextBody);
      } else if (channel === "sms") {
        if (correctedById["__body"] !== undefined) nextBody = correctedById["__body"];
        setBody(nextBody);
      } else {
        nextBlocks = callBlocks.map((b) =>
          correctedById[b.id] !== undefined ? { ...b, content: correctedById[b.id] } : b,
        );
        setCallBlocks(nextBlocks);
      }

      setProofOpen(false);
      setProofResults(null);
      await persistScript({ subject: nextSubject, body: nextBody, callBlocks: nextBlocks });
    } finally {
      setPendingSave(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0"
        data-jarvis-id="outreach-script-modal"
        onPointerDownOutside={(e) => {
          // Don't close the dialog when the user clicks inside the Jarvis
          // wizard panel (it lives outside the dialog DOM).
          const target = e.target as HTMLElement | null;
          if (target?.closest("[data-jarvis-id='script-wizard-panel']")) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest("[data-jarvis-id='script-wizard-panel']")) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/50 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-base font-semibold">
              {isEdit ? "Edit Script" : "New Script"}
              {script?.version && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  v{script.version}
                </span>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => setWizardOpen(true)}
                className="h-8 gap-1.5 bg-gradient-to-r from-primary to-fuchsia-500 text-primary-foreground hover:opacity-90 shadow-[0_0_12px_-2px_hsl(var(--primary)/0.6)]"
                data-jarvis-id="ask-jarvis-script-help"
                title="Let Jarvis walk you through setting up this script — voice + text guided wizard"
              >
                <Bot className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">Ask Jarvis</span>
              </Button>
              {violations.length > 0 && (
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1 text-xs",
                    errors.length > 0
                      ? "border-destructive text-destructive"
                      : "border-amber-500 text-amber-600"
                  )}
                >
                  <AlertTriangle className="w-3 h-3" />
                  {violations.length} issue{violations.length > 1 ? "s" : ""}
                </Badge>
              )}
              {violations.length === 0 && name && (
                <Badge
                  variant="outline"
                  className="gap-1 text-xs border-green-500 text-green-600"
                  title="No validation issues — script passes all guardrails"
                >
                  <CheckCircle2 className="w-3 h-3" /> No issues
                </Badge>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setResetConfirmOpen(true)}
                className="h-8 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                title="Clear every field and start this script over from a blank template"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">Reset form</span>
              </Button>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-end gap-3 mt-3">
            <div className="flex-1">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Script name (required)"
                className="h-8 text-sm"
                data-jarvis-id="script-name-input"
              />
            </div>
            <div>
              <Select value={channel} onValueChange={(v) => handleChannelChange(v as ScriptChannel)}>
                <SelectTrigger className="h-8 w-[130px] text-sm" data-jarvis-id="script-channel-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[10000]">
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="call">Call Script</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => setTemplatesOpen(true)}
              title="Browse pre-built, click-to-use templates for client meetings, candidate pitches and more"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs">Templates</span>
            </Button>
          </div>

          {/* AI assist toolbar */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {/* Agency name (workspace-wide, used by {{agency.name}}) */}
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                onBlur={persistAgencyName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="Your agency name (e.g. Bluebridge Data)"
                className="h-8 w-[220px] text-xs"
                title="Saved to workspace settings. Used to resolve {{agency.name}} in scripts."
              />
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => runAiAssist("polish")}
              disabled={
                aiBusy !== null ||
                (channel === "call" ? callBlocks.every((b) => !b.content.trim()) : !body.trim())
              }
            >
              {aiBusy === "polish" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span className="text-xs">AI Polish</span>
            </Button>

            <div className="flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
              <Select
                value={linkedJobId ?? "__none"}
                onValueChange={(v) => setLinkedJobId(v === "__none" ? null : v)}
              >
                <SelectTrigger className="h-8 w-[260px] text-xs">
                  <SelectValue placeholder="Link an active job…" />
                </SelectTrigger>
                <SelectContent className="z-[10000]">
                  <SelectItem value="__none" className="text-xs">
                    No job linked
                  </SelectItem>
                  {activeJobs.length === 0 && (
                    <SelectItem value="__empty" disabled className="text-xs">
                      No active jobs
                    </SelectItem>
                  )}
                  {activeJobs.map((j) => (
                    <SelectItem key={j.id} value={j.id} className="text-xs">
                      {j.title}
                      {j.companies?.name ? ` · ${j.companies.name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => runAiAssist("link_job")}
                disabled={!linkedJobId || aiBusy !== null}
                title="Weave anonymised job details into the script. Real company name is hidden until candidate confirms interest and availability."
              >
                {aiBusy === "link_job" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span className="text-xs">Inject Job (anonymised)</span>
              </Button>
            </div>
          </div>

          {/* Voice / Persona row — only relevant for AI Call scripts */}
          {channel === "call" && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-[11px] text-muted-foreground">AI agent voice:</span>
              <Select value={agentVoice} onValueChange={(v) => setAgentVoice(v as typeof agentVoice)}>
                <SelectTrigger className="h-8 w-[200px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[10000]">
                  <SelectItem value="auto" className="text-xs">Auto (use integration default)</SelectItem>
                  <SelectItem value="female_warm" className="text-xs">Female · warm</SelectItem>
                  <SelectItem value="female_pro" className="text-xs">Female · professional</SelectItem>
                  <SelectItem value="male_warm" className="text-xs">Male · warm</SelectItem>
                  <SelectItem value="male_pro" className="text-xs">Male · professional</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="Agent name (e.g. Olivia) — auto-suggested if blank"
                className="h-8 w-[260px] text-xs"
                title="Used by the AI agent to introduce itself: 'My name is {{agent.name}}…'"
                data-jarvis-id="script-agent-name"
              />
              <span className="text-[10px] text-muted-foreground">
                Resolves <code className="text-[10px]">{`{{agent.name}}`}</code> in your script.
              </span>
            </div>
          )}
        </DialogHeader>

        {/* Tabs */}
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          className="flex flex-col flex-1 min-h-0"
        >
          <TabsList className="mx-6 mt-3 mb-0 shrink-0 w-fit">
            <TabsTrigger value="editor" className="gap-1.5 text-xs" data-jarvis-id="script-tab-editor">
              <Layers className="w-3.5 h-3.5" /> Editor
            </TabsTrigger>
            <TabsTrigger value="guardrails" className="gap-1.5 text-xs" data-jarvis-id="script-tab-guardrails">
              <AlertTriangle className="w-3.5 h-3.5" />
              Guardrails
              {violations.length > 0 && (
                <span
                  className={cn(
                    "ml-1 rounded-full px-1.5 text-[10px] font-medium",
                    errors.length > 0 ? "bg-destructive text-destructive-foreground" : "bg-amber-500 text-white"
                  )}
                >
                  {violations.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="simulate" className="gap-1.5 text-xs" data-jarvis-id="script-tab-simulate">
              <FlaskConical className="w-3.5 h-3.5" /> Simulate
            </TabsTrigger>
          </TabsList>

          {/* ── EDITOR TAB ── */}
          <TabsContent value="editor" className="flex-1 min-h-0 mt-0 px-6 pb-0" data-jarvis-id="script-editor-panel">
            <ScrollArea className="h-full pr-1">
              <div className="py-4 space-y-4">
                {channel === "email" && (
                  <div className="space-y-1.5" data-jarvis-id="script-subject-input">
                    <Label className="text-xs">Subject Line</Label>
                    <EnhancedTextField
                      value={subject}
                      onChange={setSubject}
                      placeholder="e.g. {{job.title}} opportunity at {{job.company}}"
                      multiline={false}
                      channel="email"
                      quickTemplates={QUICK_TEMPLATES_SUBJECT}
                      expandTitle="Edit subject line"
                    />
                  </div>
                )}

                {channel !== "call" ? (
                  <div className="space-y-1.5" data-jarvis-id="script-body">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">
                        Body{" "}
                        {channel === "sms" && (
                          <span
                            className={cn(
                              "ml-2 text-[10px]",
                              body.length > 160 ? "text-destructive" : "text-muted-foreground"
                            )}
                          >
                            {body.length}/160
                          </span>
                        )}
                      </Label>
                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                        onClick={() => setVarPickerOpen((p) => !p)}
                      >
                        <Variable className="w-3 h-3" />
                        Insert Variable
                      </button>
                    </div>

                    {varPickerOpen && (
                      <VariablePicker onInsert={insertVariable} />
                    )}

                    <EnhancedTextField
                      id="script-body"
                      value={body}
                      onChange={setBody}
                      rows={channel === "sms" ? 4 : 14}
                      placeholder="Write your script here..."
                      channel={channel}
                      quickTemplates={channel === "sms" ? QUICK_TEMPLATES_SMS : QUICK_TEMPLATES_EMAIL}
                      expandTitle={channel === "sms" ? "Edit SMS body" : "Edit email body"}
                    />
                  </div>
                ) : (
                  /* Call blocks */
                  <div className="space-y-2" data-jarvis-id="script-call-blocks">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Call Blocks</Label>
                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                        onClick={addBlock}
                      >
                        <Plus className="w-3 h-3" /> Add Block
                      </button>
                    </div>
                    <div className="space-y-2">
                      {callBlocks.map((block, idx) => (
                        <div key={block.id} data-jarvis-id={`script-block-${block.id}`}>
                          <CallBlockCard
                            block={block}
                            isFirst={idx === 0}
                            isLast={idx === callBlocks.length - 1}
                            expanded={expandedBlock === block.id}
                            onToggle={() =>
                              setExpandedBlock((p) => (p === block.id ? null : block.id))
                            }
                            onChange={(patch) => updateBlock(block.id, patch)}
                            onRemove={() => removeBlock(block.id)}
                            onMove={(dir) => moveBlock(block.id, dir)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ── GUARDRAILS TAB ── */}
          <TabsContent value="guardrails" className="flex-1 min-h-0 mt-0 px-6 pb-0" data-jarvis-id="script-guardrails-list">
            <ScrollArea className="h-full pr-1">
              <div className="py-4 space-y-4">
                <p className="text-xs text-muted-foreground">
                  These guardrails are checked in real-time against your script body. Red rules block saving; amber
                  rules are advisory warnings.
                </p>
                <div className="space-y-2">
                  {guardrails.map((rule) => {
                    const violation = violations.find((v) => v.rule.id === rule.id);
                    return (
                      <div
                        key={rule.id}
                        className={cn(
                          "rounded-lg border p-3 text-sm",
                          violation?.rule.severity === "error"
                            ? "border-destructive/50 bg-destructive/5"
                            : violation?.rule.severity === "warning"
                            ? "border-amber-500/50 bg-amber-500/5"
                            : "border-border/50 bg-card"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {violation ? (
                            <AlertTriangle
                              className={cn(
                                "w-4 h-4 mt-0.5 shrink-0",
                                violation.rule.severity === "error"
                                  ? "text-destructive"
                                  : "text-amber-500"
                              )}
                            />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-green-500" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-xs">{rule.label}</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  rule.severity === "error"
                                    ? "border-destructive text-destructive"
                                    : "border-amber-500 text-amber-600"
                                )}
                              >
                                {rule.severity}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
                            {violation && (
                              <p className="text-xs mt-1">
                                Matched:{" "}
                                <code className="bg-muted px-1 rounded text-[11px]">
                                  "{violation.matchedText}"
                                </code>
                              </p>
                            )}
                            {rule.satisfiedBy && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                ✓ Bypassed if script includes:{" "}
                                <code className="text-[11px]">{rule.satisfiedBy.join(", ")}</code>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ── SIMULATE TAB ── */}
          <TabsContent value="simulate" className="flex-1 min-h-0 mt-0 px-6 pb-0">
            <ScriptSimulator
              body={body}
              callBlocks={channel === "call" ? callBlocks : undefined}
              subject={subject}
              channel={channel}
              agencyName={agencyName}
            />
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 flex items-center justify-between shrink-0">
          <p className="text-xs text-muted-foreground">
            {errors.length > 0
              ? `${errors.length} error${errors.length > 1 ? "s" : ""} must be resolved before saving`
              : warnings.length > 0
              ? `${warnings.length} advisory warning${warnings.length > 1 ? "s" : ""}`
              : ""}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="gap-2"
              onClick={handleSave}
              disabled={isPending || proofreading || !name.trim() || errors.length > 0}
            >
              {proofreading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {proofreading
                ? "Spell-checking…"
                : isPending
                ? "Saving…"
                : isEdit
                ? "Update Script"
                : "Save Script"}
            </Button>
          </div>
        </div>
      </DialogContent>
      <ScriptTemplateLibrary
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        channel={channel}
        onApply={handleApplyTemplate}
      />
      {proofResults && (
        <ProofreadReviewModal
          open={proofOpen}
          onOpenChange={(v) => {
            setProofOpen(v);
            if (!v) setProofResults(null);
          }}
          fields={proofResults}
          saving={pendingSave || isPending}
          onAcceptAndSave={applyCorrectionsAndSave}
          onSaveAnyway={async () => {
            setProofOpen(false);
            setProofResults(null);
            await persistScript();
          }}
        />
      )}
      {savedScript && (
        <AssignToCampaignPrompt
          open={assignPromptOpen}
          onOpenChange={(v) => {
            setAssignPromptOpen(v);
            if (!v) {
              setSavedScript(null);
              onOpenChange(false);
            }
          }}
          scriptId={savedScript.id}
          scriptName={savedScript.name}
          channel={savedScript.channel}
        />
      )}

      {/* Jarvis-guided script wizard — slide-in panel with voice + text */}
      <JarvisScriptWizard
        open={wizardOpen && open}
        onClose={() => setWizardOpen(false)}
        current={{
          name,
          channel,
          subject,
          body,
          agentName,
          callBlocks: callBlocks.map((b) => ({
            id: b.id,
            type: b.type,
            title: b.title,
            content: b.content,
          })),
        }}
        onApply={applyWizardPatch}
      />

      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent className="z-[10001]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Reset entire script?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently clear every field in the editor — script name, channel, subject,
              body, all call blocks, agent voice and any linked job — and return the form to a blank
              template. This action cannot be undone. Your previously saved version (if any) will not
              be affected until you click <span className="font-semibold">Update Script</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetForm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, reset form
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

// ─── Variable Picker ──────────────────────────────────────────────────────────

function VariablePicker({ onInsert }: { onInsert: (key: string) => void }) {
  const categories = ["candidate", "job", "recruiter", "agency", "campaign"] as const;
  return (
    <div className="border border-border rounded-lg bg-popover shadow-md p-3 space-y-3">
      {categories.map((cat) => {
        const vars = ALLOWED_VARIABLES.filter((v) => v.category === cat);
        return (
          <div key={cat}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 capitalize">
              {cat}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {vars.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => onInsert(v.key)}
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border hover:bg-accent transition-colors",
                    v.requiresEvidence
                      ? "border-amber-400/60 text-amber-700 dark:text-amber-400"
                      : "border-border text-foreground"
                  )}
                  title={v.requiresEvidence ? "Requires evidence/consent field" : undefined}
                >
                  {v.requiresEvidence && <AlertTriangle className="w-2.5 h-2.5" />}
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-1 pt-1">
        <Info className="w-3 h-3 text-amber-500 shrink-0" />
        <p className="text-[10px] text-muted-foreground">
          Amber variables require candidate consent or source evidence and are guardrail-protected.
        </p>
      </div>
    </div>
  );
}

// ─── Call Block Card ──────────────────────────────────────────────────────────

interface CallBlockCardProps {
  block: CallBlock;
  isFirst: boolean;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<CallBlock>) => void;
  onRemove: () => void;
  onMove: (dir: "up" | "down") => void;
}

function CallBlockCard({
  block,
  isFirst,
  isLast,
  expanded,
  onToggle,
  onChange,
  onRemove,
  onMove,
}: CallBlockCardProps) {
  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/30 transition-colors text-left"
        onClick={onToggle}
      >
        <Badge className={cn("text-[10px] shrink-0", BLOCK_TYPE_COLORS[block.type])}>
          {BLOCK_TYPE_LABELS[block.type]}
        </Badge>
        <span className="text-xs font-medium flex-1 truncate">{block.title}</span>
        <div className="flex items-center gap-1 shrink-0">
          {!isFirst && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onMove("up"); }}
              className="p-1 hover:bg-accent rounded"
            >
              <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
            </span>
          )}
          {!isLast && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onMove("down"); }}
              className="p-1 hover:bg-accent rounded"
            >
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </span>
          )}
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1 hover:bg-destructive/10 rounded text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border/40 pt-3">
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-[11px]">Block Title</Label>
              <Input
                value={block.title}
                onChange={(e) => onChange({ title: e.target.value })}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Type</Label>
              <Select
                value={block.type}
                onValueChange={(v) => onChange({ type: v as CallBlockType })}
              >
                <SelectTrigger className="h-7 w-[150px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[10000]">
                  {(Object.keys(BLOCK_TYPE_LABELS) as CallBlockType[]).map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">
                      {BLOCK_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Script Content</Label>
            <EnhancedTextField
              value={block.content}
              onChange={(v) => onChange({ content: v })}
              rows={4}
              placeholder="What the recruiter says in this block…"
              channel="call"
              quickTemplates={QUICK_TEMPLATES_CALL}
              expandTitle={`Edit "${block.title}" content`}
              className="text-xs"
            />
          </div>

          {block.type === "branching" && (
            <div className="space-y-2">
              <Label className="text-[11px]">Response Branches</Label>
              {(block.branches ?? []).map((branch, bi) => (
                <div key={branch.id} className="flex gap-2 items-start">
                  <span className="text-[10px] text-muted-foreground pt-1.5 w-5 shrink-0">
                    {bi + 1}.
                  </span>
                  <Input
                    value={branch.label}
                    onChange={(e) => {
                      const branches = [...(block.branches ?? [])];
                      branches[bi] = { ...branches[bi], label: e.target.value };
                      onChange({ branches });
                    }}
                    placeholder="Candidate response label"
                    className="h-7 text-xs flex-1"
                  />
                  <Input
                    value={branch.response}
                    onChange={(e) => {
                      const branches = [...(block.branches ?? [])];
                      branches[bi] = { ...branches[bi], response: e.target.value };
                      onChange({ branches });
                    }}
                    placeholder="Recruiter next action"
                    className="h-7 text-xs flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const branches = (block.branches ?? []).filter((_, i) => i !== bi);
                      onChange({ branches });
                    }}
                    className="p-1 mt-0.5 hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-xs text-primary hover:underline flex items-center gap-1"
                onClick={() => {
                  const branches = [
                    ...(block.branches ?? []),
                    { id: `br-${Date.now()}`, label: "", response: "" },
                  ];
                  onChange({ branches });
                }}
              >
                <Plus className="w-3 h-3" /> Add Branch
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
