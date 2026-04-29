/**
 * JarvisScriptWizard
 *
 * Slide-in guided assistant for the Script Builder modal. It illuminates each
 * field one-at-a-time, asks the user a question (voice + text), autofills the
 * field, then moves on. Pre-flight Q&A drafts the whole script if the user
 * just wants to "get it done".
 *
 * Self-contained — no new tables, no new edge functions. Uses the existing
 * `jarvis-speak` function for voice output (graceful fallback to browser TTS)
 * and the browser Web Speech API for voice input. The user can always type
 * their answer instead of speaking, or skip a step.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles,
  Mic,
  MicOff,
  X,
  Send,
  SkipForward,
  Volume2,
  VolumeX,
  ChevronRight,
  Bot,
  CheckCircle2,
  Loader2,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { playYourTurnChime, playListeningPing } from "@/lib/jarvis-sounds";

/* ────────────────────────────── Types ────────────────────────────── */

export type WizardChannel = "email" | "sms" | "call";

export interface WizardCallBlockPatch {
  blockId: string;
  content: string;
}

/** Patch the wizard sends back to the modal. Modal applies via setters. */
export interface WizardPatch {
  name?: string;
  subject?: string;
  body?: string;
  channel?: WizardChannel;
  agentName?: string;
  callBlock?: WizardCallBlockPatch;
}

export interface WizardCurrent {
  name: string;
  channel: WizardChannel;
  subject: string;
  body: string;
  agentName: string;
  callBlocks: Array<{ id: string; type: string; title: string; content: string }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Current values from the modal — used to skip steps already completed. */
  current: WizardCurrent;
  /** Apply a partial patch to the modal state. */
  onApply: (patch: WizardPatch) => void;
}

/* ───────────────────────── Step definitions ─────────────────────────
 * Each step has a `targetSelector` matching a `data-jarvis-id` in the
 * Script Builder modal. The wizard scrolls + glows that element while the
 * step is active.
 */

type StepKind = "intro" | "preflight" | "objective" | "field" | "done";

interface FieldStep {
  kind: "field";
  id: string;
  targetSelector: string;
  label: string;
  /** What Jarvis says before asking. */
  explain: string;
  /** Question shown to the user. */
  question: string;
  /** Channel filter — only shown for matching channel. */
  channels?: WizardChannel[];
  /** Read current value for this field — used to decide review vs blank flow. */
  readCurrent: (c: WizardCurrent) => string;
  /** Build the patch that gets applied to the modal. */
  apply: (answer: string, c: WizardCurrent) => WizardPatch;
  /** Field kind sent to ai-script-assist suggest_field mode. */
  fieldKind:
    | "name"
    | "subject"
    | "email_body"
    | "sms_body"
    | "agent_name"
    | "call_intro"
    | "call_permission"
    | "call_questions"
    | "call_branching"
    | "call_close"
    | "call_block";
  /** For call channel — points to a specific block id at runtime. */
  callBlockId?: string;
}

/* ────────────────────────── Voice helpers ────────────────────────── */

// Browser Speech Recognition – feature-detected, optional.
// Defined outside the component so the type works in TS strict mode.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSpeechRecognition(): any {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

/**
 * Browser TTS fallback. Picks the smoothest available voice (prefers
 * Google/Microsoft natural voices over the default robotic voice that ships
 * with most OSes) and uses warmer prosody so Jarvis doesn't sound like a
 * 1950s toy robot when ElevenLabs isn't configured.
 */
function speakWithBrowser(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  const pickVoice = (): SpeechSynthesisVoice | null => {
    const voices = synth.getVoices();
    if (!voices?.length) return null;
    const preferOrder = [
      /Google UK English Female/i,
      /Google US English/i,
      /Microsoft (Aria|Jenny|Libby|Sonia)/i,
      /Samantha/i,
      /Karen/i,
      /Serena/i,
      /^en-GB.*Female/i,
      /^en-US.*Female/i,
    ];
    for (const re of preferOrder) {
      const v = voices.find((vc) => re.test(vc.name) || re.test(vc.voiceURI));
      if (v) return v;
    }
    return voices.find((v) => v.lang?.startsWith("en")) || voices[0];
  };
  const speakNow = () => {
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = 1.0;
    u.pitch = 1.05;
    u.volume = 0.95;
    synth.cancel();
    synth.speak(u);
  };
  if (synth.getVoices().length === 0) {
    // Voices load asynchronously on first call in some browsers
    const handler = () => {
      synth.removeEventListener("voiceschanged", handler);
      speakNow();
    };
    synth.addEventListener("voiceschanged", handler);
    // safety: try after 250ms anyway
    setTimeout(speakNow, 300);
  } else {
    speakNow();
  }
}

/* ────────────────────────── Component ────────────────────────────── */

export function JarvisScriptWizard({ open, onClose, current, onApply }: Props) {
  const [phase, setPhase] = useState<StepKind>("intro");
  // intro mode: 'quick' (30s explain) | 'full' (deep) | 'just_do_it' (skip explain)
  const [introMode, setIntroMode] = useState<"quick" | "full" | "just_do_it" | null>(null);

  // Pre-flight answers (used by 'just_do_it' to draft the whole script in one go)
  const [preflightStage, setPreflightStage] = useState(0);
  const [preflight, setPreflight] = useState<{
    purpose?: string;
    tone?: string;
    targetRole?: string;
    cta?: string;
  }>({});

  // Objective-driven prefill (quick / full walkthrough). User answers ONE
  // question — "what do you want out of this script?" — and Jarvis pre-drafts
  // every field/block in AI-friendly conversational style. The wizard then
  // walks through each step, surfacing the prefilled suggestion in the
  // 'suggested' sub-phase so the user can Accept / Tweak / Reject.
  const [objective, setObjective] = useState<string>("");
  // Map keyed by either a field id ("name", "subject", "body", "agentName")
  // or a call block type ("intro", "permission", ...). Lookup falls through
  // both.
  const [prefilled, setPrefilled] = useState<Record<string, string>>({});
  const prefilledRef = useRef<Record<string, string>>({});
  // When true, Jarvis auto-applies every prefilled suggestion in sequence
  // without waiting for the user — the user can hit "Pause" at any time.
  const [autoRun, setAutoRun] = useState(false);
  const autoRunRef = useRef(false);

  const [stepIdx, setStepIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [thinking, setThinking] = useState(false);
  // Per-field sub-flow:
  //  - 'review'    → existing content present, ask Keep/Edit/Redo
  //  - 'intent'    → ask user "what do you want out of this?" before AI suggest
  //  - 'suggested' → AI returned a suggestion, user can Accept/Tweak/Reject
  //  - 'edit'      → user typing/speaking the value directly (current default)
  type FieldSubPhase = "review" | "intent" | "suggested" | "edit";
  const [fieldSubPhase, setFieldSubPhase] = useState<FieldSubPhase>("edit");
  const [suggestion, setSuggestion] = useState<string>("");
  const [suggestRationale, setSuggestRationale] = useState<string>("");
  const [suggesting, setSuggesting] = useState(false);
  const [voiceOutEnabled, setVoiceOutEnabled] = useState(true);
  const [listening, setListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasMicSupport] = useState(() => !!getSpeechRecognition());
  // Once the user has granted mic permission within the wizard session, we
  // can safely auto-start listening after Jarvis finishes speaking. Without
  // this gate, browsers would silently swallow the mic activation because it
  // happens outside a user-gesture stack.
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const autoListenRef = useRef(true);

  // Conversation transcript shown in the panel
  const [messages, setMessages] = useState<Array<{ role: "jarvis" | "user"; text: string }>>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Draggable panel position (null = use default right/top fixed anchor)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const PANEL_W = 420;
  const PANEL_H = 580;

  // Standard mouse-based drag (matches JarvisChat panel pattern). Mouse events
  // — not pointer events with pointer capture — so clicks on action buttons in
  // the panel body never get hijacked by an in-flight drag gesture.
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    const panelEl = document.querySelector(
      "[data-jarvis-id='script-wizard-panel']"
    ) as HTMLElement | null;
    if (!panelEl) return;
    if ((e.target as HTMLElement | null)?.closest("button, input, textarea, [role='button']")) return;
    e.preventDefault();
    const rect = panelEl.getBoundingClientRect();
    dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      let nx = e.clientX - dragOffsetRef.current.x;
      let ny = e.clientY - dragOffsetRef.current.y;
      nx = Math.max(8, Math.min(window.innerWidth - PANEL_W - 8, nx));
      ny = Math.max(8, Math.min(window.innerHeight - PANEL_H - 8, ny));
      setPos({ x: nx, y: ny });
    };
    const onUp = () => setIsDragging(false);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  /* ─── Build the step list dynamically based on current channel ─── */

  const steps = useMemo<FieldStep[]>(() => {
    const c = current.channel;
    const list: FieldStep[] = [
      {
        kind: "field",
        id: "name",
        targetSelector: "[data-jarvis-id='script-name-input']",
        label: "Script Name",
        explain:
          "First, every script needs a memorable name so your team can find it later. Something like 'Senior Dev Outreach v1' works well.",
        question: "What would you like to name this script?",
        readCurrent: (c) => c.name,
        fieldKind: "name",
        apply: (a) => ({ name: a.trim() }),
      },
    ];

    if (c === "email") {
      list.push({
        kind: "field",
        id: "subject",
        targetSelector: "[data-jarvis-id='script-subject-input']",
        label: "Subject Line",
        channels: ["email"],
        explain:
          "The subject line is what gets your email opened. Keep it under 60 characters and make it personal.",
        question:
          "What's the subject? Tip: you can use {{job.title}} and {{candidate.first_name}} as variables.",
        readCurrent: (c) => c.subject,
        fieldKind: "subject",
        apply: (a) => ({ subject: a.trim() }),
      });
      list.push({
        kind: "field",
        id: "body",
        targetSelector: "[data-jarvis-id='script-body']",
        label: "Email Body",
        channels: ["email"],
        explain:
          "Now the body. I'll draft it from your answer — describe the role, the hook, and the call-to-action. I'll polish it for you.",
        question:
          "In a sentence or two, what's this email pitching? I'll write the full draft.",
        readCurrent: (c) => c.body,
        fieldKind: "email_body",
        apply: (a) => ({ body: a.trim() }),
      });
    }

    if (c === "sms") {
      list.push({
        kind: "field",
        id: "body",
        targetSelector: "[data-jarvis-id='script-body']",
        label: "SMS Body",
        channels: ["sms"],
        explain:
          "SMS must stay under 160 characters. Be punchy and include an opt-out like 'Reply STOP'.",
        question: "Sum up the message in one line — I'll tighten it for you.",
        readCurrent: (c) => c.body,
        fieldKind: "sms_body",
        apply: (a) => ({ body: a.trim() }),
      });
    }

    if (c === "call") {
      list.push({
        kind: "field",
        id: "agentName",
        targetSelector: "[data-jarvis-id='script-agent-name']",
        label: "AI Agent Name",
        channels: ["call"],
        explain:
          "Your AI agent introduces itself by name. Pick something friendly — it's the first impression your candidate hears.",
        question: "What name should the AI agent use? (e.g. Olivia, Marcus, or skip for auto)",
        readCurrent: (c) => c.agentName,
        fieldKind: "agent_name",
        apply: (a) => ({ agentName: a.trim() }),
      });

      // One step per call block
      for (const b of current.callBlocks) {
        const blockKind =
          b.type === "intro" ? "call_intro" :
          b.type === "permission" ? "call_permission" :
          b.type === "questions" ? "call_questions" :
          b.type === "branching" ? "call_branching" :
          b.type === "close" ? "call_close" : "call_block";
        list.push({
          kind: "field",
          id: `block-${b.id}`,
          targetSelector: `[data-jarvis-id='script-block-${b.id}']`,
          label: `Block: ${b.title || b.type}`,
          channels: ["call"],
          callBlockId: b.id,
          explain: blockExplainText(b.type),
          question: blockQuestionText(b.type),
          readCurrent: () => b.content,
          fieldKind: blockKind as FieldStep["fieldKind"],
          apply: (a) => ({ callBlock: { blockId: b.id, content: a.trim() } }),
        });
      }
    }
    return list;
  }, [current.channel, current.callBlocks]);

  /* ─── Spotlight: glow + scroll into view ─── */

  const clearGlow = useCallback(() => {
    document.querySelectorAll(".jarvis-wizard-glow, .jarvis-wizard-glow-modal, .jarvis-wizard-glow-field").forEach((el) => {
      el.classList.remove("jarvis-wizard-glow", "jarvis-wizard-glow-modal", "jarvis-wizard-glow-field");
    });
  }, []);

  const spotlightSelector = useCallback((selector: string | null) => {
    document.querySelectorAll(".jarvis-wizard-glow-field").forEach((el) => {
      el.classList.remove("jarvis-wizard-glow", "jarvis-wizard-glow-field");
    });

    const modal = document.querySelector("[data-jarvis-id='outreach-script-modal']");
    modal?.classList.add("jarvis-wizard-glow", "jarvis-wizard-glow-modal");

    if (!selector || selector === "[data-jarvis-id='outreach-script-modal']") return;
    const el = document.querySelector(selector);
    if (el) {
      el.classList.add("jarvis-wizard-glow", "jarvis-wizard-glow-field");
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  /* ─── Speak via jarvis-speak (with browser fallback) ─── */

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch { /* noop */ }
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (!voiceOutEnabled) return;
      const browserFallback = () => {
        setIsSpeaking(true);
        speakWithBrowser(text);
        // Best-effort: clear when synth finishes
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          const synth = window.speechSynthesis;
          const tick = () => {
            if (synth.speaking || synth.pending) {
              setTimeout(tick, 200);
            } else {
              setIsSpeaking(false);
              // "Your turn" chime so user knows Jarvis has finished talking
              try { playYourTurnChime(); } catch { /* noop */ }
              maybeAutoListen();
            }
          };
          setTimeout(tick, 250);
        }
      };
      try {
        const { data, error } = await supabase.functions.invoke("jarvis-speak", {
          // Sarah — smooth, warm, natural British-leaning voice
          body: { text, voice_id: "EXAVITQu4vr4xnSDxMaL" },
        });
        if (error || !data?.audio) {
          browserFallback();
          return;
        }
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
        audio.volume = 0.9;
        audioRef.current = audio;
        setIsSpeaking(true);
        const finish = (chime: boolean) => {
          setIsSpeaking(false);
          if (chime) {
            try { playYourTurnChime(); } catch { /* noop */ }
            maybeAutoListen();
          }
        };
        audio.onended = () => finish(true);
        audio.onerror = () => finish(false);
        audio.onpause = () => finish(false);
        audio.play().catch(() => {});
      } catch {
        browserFallback();
      }
    },
    // maybeAutoListen is defined below; we intentionally don't add it as a
    // dep because it's stable (uses refs) and adding it would re-create the
    // speak function on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [voiceOutEnabled]
  );

  /* ─── Voice input ─── */

  const startListening = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) return;
    try {
      const r = new SR();
      r.lang = "en-GB";
      r.interimResults = true;
      r.continuous = false;
      r.onresult = (e: SpeechRecognitionEvent) => {
        const txt = Array.from(e.results)
          .map((res) => res[0].transcript)
          .join(" ");
        setAnswer(txt);
      };
      r.onend = () => setListening(false);
      r.onerror = (ev: Event & { error?: string }) => {
        // 'not-allowed' / 'service-not-allowed' → mic permission revoked.
        // Disable auto-listen so we don't fight the browser on every turn.
        if (ev?.error === "not-allowed" || ev?.error === "service-not-allowed") {
          setMicPermissionGranted(false);
          autoListenRef.current = false;
        }
        setListening(false);
      };
      recognitionRef.current = r;
      r.start();
      setListening(true);
      setMicPermissionGranted(true);
      try { playListeningPing(); } catch { /* noop */ }
    } catch {
      setListening(false);
    }
  }, []);

  /**
   * Auto-start the mic if (a) the user has explicitly granted permission
   * earlier in the session by tapping the Speak button at least once, and
   * (b) we're in a phase where typing/speaking an answer is expected.
   * Without the explicit grant we'd hit a silent NotAllowedError because the
   * gesture context is lost across the await for Jarvis's audio.
   */
  // Track whether the active phase/sub-phase expects a typed/spoken answer.
  // We use a ref so the speak() callback can read the live value without
  // closing over stale state.
  const expectingAnswerRef = useRef(false);
  const maybeAutoListen = useCallback(() => {
    if (!autoListenRef.current) return;
    if (!micPermissionGranted) return;
    if (!hasMicSupport) return;
    if (!expectingAnswerRef.current) return;
    // Defer one tick so React state for "isSpeaking → false" is committed
    // before we flip to "listening" UI.
    setTimeout(() => {
      if (!autoListenRef.current) return;
      if (!expectingAnswerRef.current) return;
      startListening();
    }, 120);
  }, [micPermissionGranted, hasMicSupport, startListening]);

  /**
   * Interrupt Jarvis: stop the current speech and immediately open the mic
   * so the user can talk back. Bound to clicks anywhere on the panel body
   * (transcript area). Buttons in the action footer have their own handlers
   * via stopPropagation so they don't double-trigger.
   */
  const interruptJarvis = useCallback(() => {
    if (!isSpeaking) return;
    stopSpeaking();
    // Best-effort: if we already have permission, open the mic so the user
    // can finish their thought immediately.
    maybeAutoListen();
  }, [isSpeaking, stopSpeaking, maybeAutoListen]);

  // Keep `expectingAnswerRef` in sync with the live UI state. We listen for
  // a typed/spoken reply during preflight Q&A, while in a field's edit/intent
  // sub-phase. We do NOT listen during intro (button choice), review (Keep/
  // Edit/Redo buttons), suggested (Accept/Tweak/Reject buttons) or done.
  useEffect(() => {
    const expecting =
      phase === "preflight" ||
      (phase === "field" && (fieldSubPhase === "edit" || fieldSubPhase === "intent"));
    expectingAnswerRef.current = expecting;
    if (!expecting && listening) {
      try { recognitionRef.current?.stop(); } catch { /* noop */ }
      setListening(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, fieldSubPhase]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    setListening(false);
  }, []);

  /* ─── Chat helpers ─── */

  const sayJarvis = useCallback(
    (text: string) => {
      setMessages((m) => [...m, { role: "jarvis", text }]);
      speak(text);
    },
    [speak]
  );

  const sayUser = useCallback((text: string) => {
    setMessages((m) => [...m, { role: "user", text }]);
  }, []);

  /* ─── Lifecycle ─── */

  // On open: greet
  useEffect(() => {
    if (open) {
      if (typeof document !== "undefined") {
        document.body.classList.add("jarvis-wizard-active");
      }
      setMessages([]);
      setPhase("intro");
      setIntroMode(null);
      setStepIdx(0);
      setPreflightStage(0);
      setPreflight({});
      setAnswer("");
      setTimeout(() => {
        sayJarvis(
          "Hi, I'm Jarvis. Setting up scripts can be fiddly, so I'll guide you through it step by step. How would you like to start? Choose a quick 30-second walkthrough, the full deep-dive explanation, or let me ask you four short questions and draft the whole script for you."
        );
      }, 250);
    } else {
      // cleanup
      if (typeof document !== "undefined") {
        document.body.classList.remove("jarvis-wizard-active");
      }
      clearGlow();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      stopListening();
      setIsSpeaking(false);
      setThinking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Hard-stop everything when the component unmounts (e.g. parent modal closes
  // and removes the wizard from the React tree). This prevents Jarvis from
  // continuing to speak after the user exits the Edit Script screen.
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch { /* noop */ }
        audioRef.current.src = "";
        audioRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try { window.speechSynthesis.cancel(); } catch { /* noop */ }
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* noop */ }
        recognitionRef.current = null;
      }
      if (typeof document !== "undefined") {
        document.body.classList.remove("jarvis-wizard-active");
        document.querySelectorAll(".jarvis-wizard-glow, .jarvis-wizard-glow-modal, .jarvis-wizard-glow-field").forEach((el) => {
          el.classList.remove("jarvis-wizard-glow", "jarvis-wizard-glow-modal", "jarvis-wizard-glow-field");
        });
      }
    };
  }, []);

  // When a field step becomes active → spotlight + ask
  useEffect(() => {
    if (phase === "intro" || phase === "preflight") {
      // While Jarvis is explaining or running pre-flight Q&A, illuminate
      // the entire Edit Script modal so the user knows where the action is.
      spotlightSelector("[data-jarvis-id='outreach-script-modal']");
      return;
    }
    if (phase === "objective") {
      spotlightSelector("[data-jarvis-id='outreach-script-modal']");
      return;
    }
    if (phase !== "field") {
      clearGlow();
      return;
    }
    const step = steps[stepIdx];
    if (!step) return;
    spotlightSelector(step.targetSelector);
    setAnswer("");
    setSuggestion("");
    setSuggestRationale("");
    const existing = (step.readCurrent(current) || "").trim();
    const prefill = lookupPrefill(step, prefilledRef.current);

    // Prefilled draft from the objective step takes priority — surface it
    // immediately as a suggestion the user can Accept/Tweak/Reject. This is
    // the "Jarvis pre-builds every block in AI-friendly chat style" flow.
    if (prefill && prefill.trim().length > 0) {
      setSuggestion(prefill);
      setSuggestRationale("Pre-drafted from your objective.");
      setFieldSubPhase("suggested");
      sayJarvis(
        `${step.label} — here's what I drafted. Accept to save it, Tweak to edit, or ask me to try again.\n\n${prefill}`
      );
      // Auto-run: Jarvis applies and moves on by herself.
      if (autoRunRef.current) {
        setTimeout(() => {
          if (!autoRunRef.current) return;
          // Read latest step + suggestion from refs to avoid stale closure.
          const s = steps[stepIdx];
          if (!s) return;
          onApply(s.apply(prefill, current));
          sayJarvis(`Saved into ${s.label}. ✓`);
          advance();
        }, 1400);
      }
      return;
    }

    if (existing.length > 0) {
      setFieldSubPhase("review");
      const preview = existing.length > 200 ? existing.slice(0, 200) + "…" : existing;
      sayJarvis(
        `${step.explain} I can see you already have something here: "${preview}". Would you like to keep it as is, edit it yourself, or shall I suggest a fresh AI-friendly version based on what you want out of it?`
      );
    } else {
      setFieldSubPhase("edit");
      sayJarvis(`${step.explain} ${step.question}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stepIdx, steps]);

  /* ─── Intro choice handler ─── */

  const chooseIntro = (mode: "quick" | "full" | "just_do_it") => {
    setIntroMode(mode);
    sayUser(mode === "quick" ? "Quick walkthrough please" : mode === "full" ? "Full walkthrough" : "Just get it done");

    if (mode === "full") {
      sayJarvis(
        "Great. Here's how it works. Every script has three parts: a name, a channel, and content. The channel can be email, SMS, or call. Call scripts are built from blocks: an intro, a permission check, qualifying questions, optional branching responses, and a close. AI Polish rewrites your draft into clean copy. Linking a job weaves the role details in automatically, while keeping the company name anonymous until the candidate confirms interest. I'll highlight each field in gold as we go. You can interrupt, type, speak, or skip any step. Ready when you are."
      );
      setTimeout(() => {
        askObjective();
      }, 500);
      return;
    }

    if (mode === "quick") {
      sayJarvis(
        "Quick version. Name your script, pick a channel, and fill in the content. Call scripts use blocks for each part of the conversation. I'll highlight each field in gold, you tell me what you want, and I'll fill it in. Let's go."
      );
      setTimeout(() => {
        askObjective();
      }, 500);
      return;
    }

    // just_do_it → preflight Q&A
    setPhase("preflight");
    setPreflightStage(0);
    setTimeout(() => {
      sayJarvis(
        "Perfect. I'll ask four quick questions, then draft the entire script for you. Question one: what is the purpose of this outreach? For example, 'Senior React developer for a fintech in London'."
      );
    }, 400);
  };

  /* ─── Objective prefill (quick + full walkthroughs) ─── */

  const askObjective = () => {
    setPhase("objective");
    setAnswer("");
    setTimeout(() => {
      sayJarvis(
        "Before we walk through the fields, tell me in one or two sentences: what do you want this script to achieve? For example: 'book a 15-minute intro call with senior backend engineers in London for a fintech role, find out their notice period and salary expectations, and ask them to send an updated CV.' I'll pre-draft every field in natural AI-agent friendly language — you'll just review and tweak each one."
      );
    }, 250);
  };

  const handleObjectiveSubmit = async () => {
    if (!answer.trim()) return;
    sayUser(answer);
    const brief = answer.trim();
    setObjective(brief);
    setAnswer("");
    setThinking(true);
    sayJarvis("Pre-drafting every field for you now…");
    try {
      const blockTypes = current.callBlocks.map((b) => b.type);
      const { data, error } = await supabase.functions.invoke("ai-script-assist", {
        body: {
          mode: "draft_from_brief",
          channel: current.channel,
          brief,
          block_types: blockTypes,
        },
      });
      if (error || !data?.success || !data?.draft) {
        throw new Error(data?.message || error?.message || "Could not pre-draft");
      }
      const d = data.draft;
      const map: Record<string, string> = {};
      if (d.name) map.name = d.name;
      if (d.subject) map.subject = d.subject;
      if (d.body) map.body = d.body;
      if (d.agentName) map.agentName = d.agentName;
      if (d.blocks && typeof d.blocks === "object") {
        for (const [type, content] of Object.entries(d.blocks)) {
          if (typeof content === "string") map[`block:${type}`] = content;
        }
      }
      setPrefilled(map);
      prefilledRef.current = map;
      sayJarvis(
        "Done — every field has a draft ready. I'll walk you through each one. You can Accept, Tweak, or ask me to redo it. Or hit 'Run all' and I'll apply every draft for you."
      );
      setPhase("field");
      setStepIdx(findNextStep(steps, 0, current));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Pre-draft failed";
      sayJarvis(`${msg}. No worries — let's do it field-by-field instead. I'll ask one question per field.`);
      setPhase("field");
      setStepIdx(findNextStep(steps, 0, current));
    } finally {
      setThinking(false);
    }
  };

  /* ─── Pre-flight Q&A handler ─── */

  const handlePreflightSubmit = async () => {
    if (!answer.trim()) return;
    sayUser(answer);
    const a = answer.trim();
    setAnswer("");

    const next = { ...preflight };
    if (preflightStage === 0) next.purpose = a;
    else if (preflightStage === 1) next.targetRole = a;
    else if (preflightStage === 2) next.tone = a;
    else if (preflightStage === 3) next.cta = a;
    setPreflight(next);

    if (preflightStage < 3) {
      const prompts = [
        "Got it. Question 2: who's the ideal candidate? (seniority, location, skills)",
        "Nice. Question 3: what tone — friendly, formal, or punchy?",
        "Last one: what's the call-to-action? (book a call, reply yes, etc.)",
      ];
      sayJarvis(prompts[preflightStage]);
      setPreflightStage(preflightStage + 1);
      return;
    }

    // All 4 answered → draft
    sayJarvis("Excellent. Drafting your script now…");
    setThinking(true);
    try {
      const drafted = await draftFullScript({
        ...next,
        channel: current.channel,
      });
      // Apply name + content
      const namePatch: WizardPatch = current.name.trim() ? {} : { name: drafted.name };
      onApply(namePatch);
      if (current.channel === "email") {
        onApply({ subject: drafted.subject, body: drafted.body });
      } else if (current.channel === "sms") {
        onApply({ body: drafted.body });
      } else {
        // call: write into existing blocks
        for (const b of current.callBlocks) {
          const content = drafted.blocks?.[b.type] || drafted.body;
          if (content) onApply({ callBlock: { blockId: b.id, content } });
        }
        if (drafted.agentName) onApply({ agentName: drafted.agentName });
      }
      sayJarvis(
        "Done! I've filled in everything. Take a look — you can edit any field directly, or click 'Walk me through it' to review each one with me."
      );
      setPhase("done");
    } catch (e) {
      sayJarvis(
        "Sorry, I couldn't draft it automatically. Let's do it field-by-field instead — I'll guide you."
      );
      setPhase("field");
      setStepIdx(findNextStep(steps, 0, current));
    } finally {
      setThinking(false);
    }
  };

  /* ─── Field step submit ─── */

  const handleFieldSubmit = () => {
    const step = steps[stepIdx];
    if (!step) return;
    if (!answer.trim()) return;
    sayUser(answer);
    const patch = step.apply(answer, current);
    onApply(patch);
    sayJarvis(`Got it — saved into ${step.label}. ✓`);
    setAnswer("");
    advance();
  };

  /* ─── Per-field review actions ─── */

  const keepExisting = () => {
    const step = steps[stepIdx];
    if (!step) return;
    sayUser("Keep it as is");
    sayJarvis(`Perfect — leaving ${step.label} as it is. Moving on.`);
    advance();
  };

  const editMyself = () => {
    const step = steps[stepIdx];
    if (!step) return;
    sayUser("I'll edit it myself");
    setAnswer(step.readCurrent(current) || "");
    setFieldSubPhase("edit");
    sayJarvis(`Go ahead — type or speak the new ${step.label}, then hit Send.`);
  };

  const askForSuggestion = () => {
    const step = steps[stepIdx];
    if (!step) return;
    sayUser("Suggest a fresh version");
    setFieldSubPhase("intent");
    setAnswer("");
    sayJarvis(
      `What do you want out of this ${step.label.toLowerCase()}? Tell me the goal in your own words and I'll draft something that hits it while staying within the field's rules.`
    );
  };

  const requestSuggestion = useCallback(async () => {
    const step = steps[stepIdx];
    if (!step) return;
    if (!answer.trim()) return;
    sayUser(answer);
    const intent = answer.trim();
    setAnswer("");
    setSuggesting(true);
    setThinking(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-script-assist", {
        body: {
          mode: "suggest_field",
          channel: current.channel,
          field_kind: step.fieldKind,
          field_label: step.label,
          user_intent: intent,
          existing_content: step.readCurrent(current) || "",
        },
      });
      if (error || !data?.success || !data?.suggestion) {
        throw new Error(data?.message || error?.message || "AI suggestion failed");
      }
      setSuggestion(data.suggestion);
      setSuggestRationale(data.rationale || "");
      setFieldSubPhase("suggested");
      sayJarvis(`Here's my suggestion — accept it, tweak it, or reject and we'll try again.\n\n${data.suggestion}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't generate a suggestion";
      sayJarvis(`${msg}. Want to type it yourself instead?`);
      setFieldSubPhase("edit");
    } finally {
      setSuggesting(false);
      setThinking(false);
    }
  }, [answer, stepIdx, steps, current]);

  const acceptSuggestion = () => {
    const step = steps[stepIdx];
    if (!step || !suggestion) return;
    sayUser("Accept");
    onApply(step.apply(suggestion, current));
    sayJarvis(`Saved into ${step.label}. ✓`);
    setSuggestion("");
    setSuggestRationale("");
    advance();
  };

  const tweakSuggestion = () => {
    const step = steps[stepIdx];
    if (!step) return;
    sayUser("Let me tweak it");
    setAnswer(suggestion);
    setFieldSubPhase("edit");
    sayJarvis("Edit away — type or speak the changes, then Send.");
  };

  const rejectSuggestion = () => {
    sayUser("Try again");
    setSuggestion("");
    setSuggestRationale("");
    setFieldSubPhase("intent");
    setAnswer("");
    sayJarvis("No problem — what should I change about the goal? Tell me again in your own words.");
  };

  const skipStep = () => {
    sayUser("(skip)");
    sayJarvis("No worries, skipping that one.");
    setAnswer("");
    advance();
  };

  const advance = () => {
    const next = findNextStep(steps, stepIdx + 1, current);
    if (next >= steps.length) {
      setPhase("done");
      sayJarvis(
        "All done! Your script is ready. Review it, then click 'Update Script' to save. You can call me again any time."
      );
      spotlightSelector(null);
    } else {
      setStepIdx(next);
    }
  };

  /* ─── Render ─── */

  if (!open) return null;

  const currentStep = phase === "field" ? steps[stepIdx] : null;

  const panel = (
    <>
      {/* Glow keyframes injected once */}
      <style>{`
        .jarvis-wizard-glow {
          outline: 3px solid hsl(var(--warning)) !important;
          outline-offset: 4px !important;
          border-radius: 8px;
          box-shadow:
            0 0 0 6px hsl(var(--warning) / 0.30),
            0 0 30px hsl(var(--warning) / 0.55),
            0 0 60px hsl(var(--warning) / 0.30) !important;
          transition: outline 0.3s ease, box-shadow 0.3s ease;
        }
        .jarvis-wizard-glow-modal {
          outline-width: 4px !important;
          outline-offset: -2px !important;
          animation: none !important;
        }
        .jarvis-wizard-glow-field {
          animation: jarvis-wizard-pulse 1.4s ease-in-out infinite;
        }
        /* While Jarvis Script Wizard is active, hide the universal floating
           Jarvis FAB + command palette button so they don't compete with the
           in-context coach. */
        body.jarvis-wizard-active button[aria-label="Ask Jarvis"],
        body.jarvis-wizard-active button[aria-label="Jarvis Commands"] {
          display: none !important;
        }
        @keyframes jarvis-wizard-pulse {
          0%, 100% {
            box-shadow:
              0 0 0 6px hsl(var(--warning) / 0.30),
              0 0 30px hsl(var(--warning) / 0.45),
              0 0 60px hsl(var(--warning) / 0.25);
          }
          50% {
            box-shadow:
              0 0 0 8px hsl(var(--warning) / 0.55),
              0 0 40px hsl(var(--warning) / 0.85),
              0 0 80px hsl(var(--warning) / 0.40);
          }
        }
        @keyframes jarvis-wizard-slide-in {
          from { transform: translateX(24px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes cmPipelinePulse {
          from { transform: scaleY(0.5); opacity: 0.6; }
          to   { transform: scaleY(1);   opacity: 1; }
        }
        .jarvis-wizard-panel {
          animation: jarvis-wizard-slide-in 0.35s ease-out;
        }
      `}</style>

      <div
        className={cn(
          "jarvis-wizard-panel fixed z-[2147483000] flex flex-col border border-border bg-background shadow-2xl overflow-hidden rounded-2xl w-[420px] h-[580px] max-w-[calc(100vw-16px)] max-h-[calc(100vh-16px)] pointer-events-auto",
          isDragging && "select-none"
        )}
        data-jarvis-id="script-wizard-panel"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={
          pos
            ? { left: pos.x, top: pos.y }
            : { right: 16, top: 80 }
        }
      >
        {/* Drag handle + Header — mirrors standardised JarvisChat panel */}
        <div className="shrink-0 border-b border-border bg-gradient-to-r from-primary/5 to-primary/10">
          {/* Drag handle bar */}
          <div
            onMouseDown={handleDragStart}
            className="h-8 flex items-center justify-center gap-2 relative"
            style={{ cursor: isDragging ? "grabbing" : "grab" }}
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
          </div>
          {/* Header content */}
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center relative">
                {thinking ? (
                  <div className="flex items-end gap-[2px] h-3.5">
                    {[6,10,14,10,6].map((h, i) => (
                      <div
                        key={i}
                        className="w-[2px] rounded-full bg-primary"
                        style={{
                          height: `${h}px`,
                          animation: `cmPipelinePulse 0.8s ease-in-out ${i * 80}ms infinite alternate`,
                        }}
                      />
                    ))}
                  </div>
                ) : isSpeaking ? (
                  <Volume2 className="h-4 w-4 text-primary animate-pulse" />
                ) : listening ? (
                  <Mic className="h-4 w-4 text-primary" />
                ) : (
                  <Sparkles className="h-4 w-4 text-primary" />
                )}
                {listening && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
                )}
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground leading-none">Jarvis</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {thinking
                    ? "Thinking…"
                    : isSpeaking
                    ? "Speaking…"
                    : listening
                    ? "Listening…"
                    : phase === "intro"
                    ? "Choose how to start"
                    : phase === "preflight"
                    ? `Question ${preflightStage + 1} of 4`
                    : phase === "objective"
                    ? "What's your objective?"
                    : phase === "field" && currentStep
                    ? `Step ${stepIdx + 1}: ${currentStep.label}`
                    : phase === "done"
                    ? "All done"
                    : "Script Coach"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setVoiceOutEnabled((v) => !v)}
                title={voiceOutEnabled ? "Mute voice" : "Enable voice"}
              >
                {voiceOutEnabled ? (
                  <Volume2 className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose} title="Close">
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </div>

        {/* Conversation */}
        <ScrollArea
          className="flex-1 px-3 py-3"
          onClick={interruptJarvis}
          title={isSpeaking ? "Tap to interrupt Jarvis" : undefined}
        >
          <div className="space-y-2.5">
            {isSpeaking && (
              <div className="text-[10px] text-muted-foreground/70 italic text-center py-1">
                Tap anywhere to interrupt
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg px-3 py-2 text-xs leading-relaxed",
                  m.role === "jarvis"
                    ? "bg-primary/10 border border-primary/20 text-foreground"
                    : "bg-muted/40 border border-border/40 text-muted-foreground ml-6"
                )}
              >
                {m.role === "jarvis" && (
                  <div className="flex items-center gap-1 mb-0.5 text-[10px] text-primary font-semibold uppercase tracking-wide">
                    <Sparkles className="h-2.5 w-2.5" /> Jarvis
                  </div>
                )}
                {m.text}
              </div>
            ))}
            {thinking && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Drafting…
              </div>
            )}
            {/* Listening indicator (mirrors standardised JarvisChat) */}
            {listening && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/5 border border-destructive/20 text-xs text-foreground">
                <span className="h-2 w-2 rounded-full bg-destructive animate-pulse shrink-0" />
                <span className="italic opacity-80">{answer ? answer : "Listening…"}</span>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Speaking waveform bar — shown across the bottom whenever Jarvis is
            talking, so users with low audio / hard-of-hearing know she's
            active. Mirrors the visual language of the standard JarvisChat. */}
        {isSpeaking && (
          <div className="border-t border-border/50 bg-primary/5 px-3 py-2 shrink-0">
            <div className="flex items-center gap-2">
              <Volume2 className="h-3.5 w-3.5 text-primary shrink-0 animate-pulse" />
              <div className="flex-1 flex items-end justify-center gap-[2px] h-5">
                {Array.from({ length: 28 }).map((_, i) => {
                  const heights = [4, 8, 12, 16, 14, 18, 10, 6];
                  const h = heights[i % heights.length];
                  return (
                    <div
                      key={i}
                      className="w-[2px] rounded-full bg-primary/80"
                      style={{
                        height: `${h}px`,
                        animation: `cmPipelinePulse 0.7s ease-in-out ${(i % 8) * 70}ms infinite alternate`,
                      }}
                    />
                  );
                })}
              </div>
              <span className="text-[10px] uppercase tracking-wide text-primary font-semibold shrink-0">Speaking</span>
            </div>
          </div>
        )}

        {/* Action area */}
        <div className="border-t border-border/50 p-3 space-y-2">
          {phase === "intro" && (
            <div className="grid grid-cols-1 gap-1.5">
              <Button size="sm" variant="outline" className="justify-start text-xs h-8" onClick={() => chooseIntro("quick")}>
                <ChevronRight className="h-3 w-3 mr-1" /> Quick 30-sec walkthrough
              </Button>
              <Button size="sm" variant="outline" className="justify-start text-xs h-8" onClick={() => chooseIntro("full")}>
                <ChevronRight className="h-3 w-3 mr-1" /> Full walkthrough (explain everything)
              </Button>
              <Button
                size="sm"
                className="justify-start text-xs h-8 bg-gradient-to-r from-primary to-fuchsia-500 text-primary-foreground hover:opacity-90"
                onClick={() => chooseIntro("just_do_it")}
              >
                <Sparkles className="h-3 w-3 mr-1" /> Just get it done (4 questions)
              </Button>
            </div>
          )}

          {phase === "preflight" && (
            <>
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={listening ? "Listening…" : "Type or speak your answer…"}
                className="text-xs min-h-[60px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handlePreflightSubmit();
                  }
                }}
              />
              <div className="flex items-center gap-1.5">
                {hasMicSupport && (
                  <Button size="sm" variant={listening ? "default" : "outline"} className={cn("h-8 text-xs gap-1", listening && "bg-red-500 hover:bg-red-600 text-white")} onClick={listening ? stopListening : startListening}>
                    {listening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                    {listening ? "Stop" : "Speak"}
                  </Button>
                )}
                <div className="flex-1" />
                <Button size="sm" className="h-8 text-xs gap-1" onClick={handlePreflightSubmit} disabled={!answer.trim() || thinking}>
                  <Send className="h-3 w-3" /> Send
                </Button>
              </div>
            </>
          )}

          {phase === "objective" && (
            <>
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={listening ? "Listening…" : "e.g. Book a 15-min call with senior backend devs in London, find out their notice & salary, ask for an updated CV…"}
                className="text-xs min-h-[80px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleObjectiveSubmit();
                  }
                }}
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {hasMicSupport && (
                  <Button size="sm" variant={listening ? "default" : "outline"} className={cn("h-8 text-xs gap-1", listening && "bg-red-500 hover:bg-red-600 text-white")} onClick={listening ? stopListening : startListening}>
                    {listening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                    {listening ? "Stop" : "Speak"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs gap-1 text-muted-foreground"
                  onClick={() => {
                    sayUser("Skip — walk me through blank fields");
                    setPhase("field");
                    setStepIdx(findNextStep(steps, 0, current));
                  }}
                >
                  <SkipForward className="h-3 w-3" /> Skip
                </Button>
                <div className="flex-1" />
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1 bg-gradient-to-r from-primary to-fuchsia-500 text-primary-foreground hover:opacity-90"
                  onClick={handleObjectiveSubmit}
                  disabled={!answer.trim() || thinking}
                >
                  {thinking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Pre-draft all fields
                </Button>
              </div>
            </>
          )}

          {phase === "field" && fieldSubPhase === "review" && (
            <div className="grid grid-cols-1 gap-1.5">
              <Button size="sm" variant="outline" className="justify-start text-xs h-8" onClick={keepExisting}>
                <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" /> Keep as is
              </Button>
              <Button size="sm" variant="outline" className="justify-start text-xs h-8" onClick={editMyself}>
                <ChevronRight className="h-3 w-3 mr-1" /> Edit it myself
              </Button>
              <Button size="sm" className="justify-start text-xs h-8 bg-gradient-to-r from-primary to-fuchsia-500 text-primary-foreground hover:opacity-90" onClick={askForSuggestion}>
                <Sparkles className="h-3 w-3 mr-1" /> Suggest a fresh AI-friendly version
              </Button>
              <Button size="sm" variant="ghost" className="justify-start text-xs h-7 text-muted-foreground" onClick={skipStep}>
                <SkipForward className="h-3 w-3 mr-1" /> Skip this field
              </Button>
            </div>
          )}

          {phase === "field" && (fieldSubPhase === "edit" || fieldSubPhase === "intent") && (
            <>
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={
                  listening
                    ? "Listening…"
                    : fieldSubPhase === "intent"
                    ? "Tell me what you want out of this field…"
                    : "Type or speak the field content…"
                }
                className="text-xs min-h-[60px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (fieldSubPhase === "intent") requestSuggestion();
                    else handleFieldSubmit();
                  }
                }}
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {hasMicSupport && (
                  <Button size="sm" variant={listening ? "default" : "outline"} className={cn("h-8 text-xs gap-1", listening && "bg-red-500 hover:bg-red-600 text-white")} onClick={listening ? stopListening : startListening}>
                    {listening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                    {listening ? "Stop" : "Speak"}
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={skipStep}>
                  <SkipForward className="h-3 w-3" /> Skip
                </Button>
                <div className="flex-1" />
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={fieldSubPhase === "intent" ? requestSuggestion : handleFieldSubmit}
                  disabled={!answer.trim() || thinking || suggesting}
                >
                  {suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : fieldSubPhase === "intent" ? <Sparkles className="h-3 w-3" /> : <Send className="h-3 w-3" />}
                  {fieldSubPhase === "intent" ? "Draft it" : "Send"}
                </Button>
              </div>
            </>
          )}

          {phase === "field" && fieldSubPhase === "suggested" && (
            <div className="space-y-2">
              <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs whitespace-pre-wrap max-h-32 overflow-y-auto">
                {suggestion}
              </div>
              {suggestRationale && (
                <p className="text-[10px] text-muted-foreground italic">{suggestRationale}</p>
              )}
              <div className="grid grid-cols-3 gap-1.5">
                <Button size="sm" className="h-8 text-xs gap-1" onClick={acceptSuggestion}>
                  <CheckCircle2 className="h-3 w-3" /> Accept
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={tweakSuggestion}>
                  <ChevronRight className="h-3 w-3" /> Tweak
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={rejectSuggestion}>
                  <SkipForward className="h-3 w-3" /> Try again
                </Button>
              </div>
            </div>
          )}

          {phase === "done" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-green-500">
                <CheckCircle2 className="h-4 w-4" /> Script ready to save
              </div>
              <Button size="sm" className="w-full h-8 text-xs" onClick={onClose}>
                Close & review
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );

  if (typeof document === "undefined") return panel;
  return createPortal(panel, document.body);
}

/* ─────────────────────── Helper functions ─────────────────────── */

function findNextStep(steps: FieldStep[], from: number, _c: WizardCurrent): number {
  // Wizard now visits EVERY field — no auto-skipping. Existing content is
  // surfaced for review/edit/redo within the step itself.
  if (from >= steps.length) return steps.length;
  return from;
}

/**
 * Look up a prefilled draft for a given step from the map produced by
 * `draft_from_brief`. Maps the step's field id to the draft key.
 */
function lookupPrefill(step: FieldStep, map: Record<string, string>): string | null {
  if (!map || Object.keys(map).length === 0) return null;
  if (step.callBlockId) {
    // Find the block type from the step id pattern (block-<id>) — but we have
    // it in callBlockId; the caller mapped fieldKind. We use fieldKind to
    // recover block type.
    const t = step.fieldKind.replace(/^call_/, "");
    return map[`block:${t}`] ?? null;
  }
  switch (step.id) {
    case "name":
      return map.name ?? null;
    case "subject":
      return map.subject ?? null;
    case "body":
      return map.body ?? null;
    case "agentName":
      return map.agentName ?? null;
    default:
      return null;
  }
}

function blockExplainText(type: string): string {
  switch (type) {
    case "intro":
      return "The intro is what the AI agent says first — name, agency, and why they're calling.";
    case "permission":
      return "Permission check is critical for compliance — always ask if the candidate has a minute to talk.";
    case "questions":
      return "Qualifying questions reveal whether the candidate is a good fit (notice period, salary, location).";
    case "branching":
      return "Branching tells the AI how to respond if the candidate sounds interested vs not interested.";
    case "close":
      return "The close confirms next steps — usually scheduling a follow-up or sending the job spec by email.";
    default:
      return "Fill in what the AI agent should say in this block.";
  }
}

function blockQuestionText(type: string): string {
  switch (type) {
    case "intro":
      return "What should the agent say to introduce themselves and the call?";
    case "permission":
      return "How should the agent ask for permission to continue?";
    case "questions":
      return "List 2-3 questions you want answered (notice period, comp, location, etc.)";
    case "branching":
      return "Describe what to say if interested vs not interested.";
    case "close":
      return "How should the agent wrap up and confirm next steps?";
    default:
      return "What should the agent say here?";
  }
}

/** Drafts a full script via the existing ai-script-assist edge function. */
async function draftFullScript(input: {
  purpose?: string;
  targetRole?: string;
  tone?: string;
  cta?: string;
  channel: WizardChannel;
}): Promise<{
  name: string;
  subject?: string;
  body: string;
  blocks?: Record<string, string>;
  agentName?: string;
}> {
  const { purpose, targetRole, tone, cta, channel } = input;

  const prompt = [
    `Channel: ${channel}`,
    `Purpose: ${purpose ?? "outreach"}`,
    `Target candidate: ${targetRole ?? "general"}`,
    `Tone: ${tone ?? "friendly professional"}`,
    `Call-to-action: ${cta ?? "reply or book a quick chat"}`,
  ].join("\n");

  try {
    const { data, error } = await supabase.functions.invoke("ai-script-assist", {
      body: {
        mode: "draft_from_brief",
        channel,
        brief: prompt,
      },
    });
    if (!error && data?.success && data?.draft) {
      return {
        name: data.draft.name || `${channel} script`,
        subject: data.draft.subject,
        body: data.draft.body || "",
        blocks: data.draft.blocks,
        agentName: data.draft.agentName,
      };
    }
  } catch {
    /* fall through to local fallback */
  }

  // Local fallback — never leaves user empty-handed
  return localFallbackDraft(input);
}

function localFallbackDraft(input: {
  purpose?: string;
  targetRole?: string;
  tone?: string;
  cta?: string;
  channel: WizardChannel;
}) {
  const { purpose, targetRole, cta, channel } = input;
  const name = `${(purpose || "Outreach").split(" ").slice(0, 4).join(" ")} — draft`;
  if (channel === "email") {
    return {
      name,
      subject: `{{job.title}} opportunity — thought of you`,
      body: `Hi {{candidate.first_name}},\n\nI'm reaching out about ${purpose || "an opportunity"} for someone with your background${
        targetRole ? ` in ${targetRole}` : ""
      }.\n\n${cta || "Would you be open to a quick 10-minute call this week?"}\n\nBest,\n{{recruiter.name}}\n{{agency.name}}\n\nReply STOP to opt out.`,
    };
  }
  if (channel === "sms") {
    return {
      name,
      body: `Hi {{candidate.first_name}}, {{recruiter.name}} from {{agency.name}}. ${cta || "Open to a quick chat about a new role?"} Reply STOP to opt out.`,
    };
  }
  return {
    name,
    body: "",
    agentName: "Olivia",
    blocks: {
      intro: `Hi {{candidate.first_name}}, this is {{agent.name}} from {{agency.name}}. I'm calling about ${
        purpose || "an opportunity"
      }.`,
      permission: `Do you have a couple of minutes to chat?`,
      questions: `What's your current notice period, and what kind of role are you looking for next?`,
      close: `Thanks for your time — ${cta || "I'll send the details by email and we can set up a follow-up call."}`,
    },
  };
}