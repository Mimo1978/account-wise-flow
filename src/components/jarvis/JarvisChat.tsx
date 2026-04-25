import { useState, useRef, useEffect, useCallback } from "react";
import { JarvisConfirmationCard, ConfirmCardData } from "@/components/jarvis/JarvisConfirmationCard";
import { JarvisSuccessBanner, BannerData, buildBannerData } from "@/components/jarvis/JarvisSuccessBanner";
import {
  Sparkles,
  X,
  Send,
  Trash2,
  Mic,
  MicOff,
  Volume2,
  VolumeOff,
  CheckCircle2,
  Loader2,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useJarvis, JarvisMessage, JarvisSuggestion, JarvisActionPayload, JarvisFlowState, getFlowHighlightId } from "@/hooks/use-jarvis";
import { useJarvisSettings } from "@/hooks/use-jarvis-settings";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { useJarvisNavigation } from "@/hooks/use-jarvis-navigation";
import { GuidedTourPlayer } from "@/components/jarvis/GuidedTourPlayer";
import { TourTooltipBubble } from "@/components/jarvis/TourTooltipBubble";
import { jarvisSpotlight } from "@/lib/JarvisSpotlight";
import { playYourTurnChime, playListeningPing } from "@/lib/jarvis-sounds";

/* ------------------------------------------------------------------ */
/*  Typing indicator                                                   */
/* ------------------------------------------------------------------ */
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <div className="flex items-end gap-[3px] h-5">
          {[
            { h: 8,  d: '0ms'   },
            { h: 14, d: '80ms'  },
            { h: 20, d: '160ms' },
            { h: 16, d: '120ms' },
            { h: 20, d: '200ms' },
            { h: 10, d: '240ms' },
            { h: 18, d: '280ms' },
            { h: 8,  d: '320ms' },
          ].map((bar, i) => (
            <div
              key={i}
              className="w-[2px] rounded-full bg-primary/70"
              style={{
                height: `${bar.h}px`,
                animation: `cmPipelinePulse 0.8s ease-in-out ${bar.d} infinite alternate`,
              }}
            />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes cmPipelinePulse {
          from { opacity: 0.25; transform: scaleY(0.5); }
          to   { opacity: 1;    transform: scaleY(1);   }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Flow progress bar                                                   */
/* ------------------------------------------------------------------ */
const FLOW_LABELS: Record<string, string> = {
  CREATE_COMPANY: 'Creating Company',
  CREATE_CONTACT: 'Creating Contact',
  LOG_CALL: 'Logging Call',
  CREATE_DEAL: 'Creating Deal',
};

const FLOW_STEP_COUNTS: Record<string, number> = {
  CREATE_COMPANY: 4,
  CREATE_CONTACT: 7,
  LOG_CALL: 4,
  CREATE_DEAL: 5,
};

function FlowProgressBar({ flowState, onCancel }: { flowState: JarvisFlowState; onCancel: () => void }) {
  const total = FLOW_STEP_COUNTS[flowState.flow!] || 4;
  const current = Math.min(flowState.currentQuestion + 1, total);
  const pct = (current / total) * 100;

  return (
    <div className="px-3 py-2 border-t border-border bg-primary/5 shrink-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-foreground">
          {FLOW_LABELS[flowState.flow!] || 'Collecting data'}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {flowState.awaitingConfirmation ? 'Confirm to save' : `Step ${current} of ${total}`}
          </span>
          <button
            onClick={onCancel}
            className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            flowState.awaitingConfirmation ? "bg-amber-500" : "bg-primary"
          )}
          style={{ width: `${flowState.awaitingConfirmation ? 100 : pct}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Help menu for SHOW_MENU / fallback                                 */
/* ------------------------------------------------------------------ */
const HELP_MENU_ITEMS = [
  { label: 'Companies', destination: 'companies' },
  { label: 'Contacts', destination: 'contacts' },
  { label: 'Talent', destination: 'talent' },
  { label: 'Canvas', destination: 'canvas' },
  { label: 'Outreach', destination: 'outreach' },
  { label: 'Insights', destination: 'insights' },
  { label: 'Projects', destination: 'projects' },
  { label: 'Admin', destination: 'admin' },
];

function HelpMenuGrid({ onNavigate }: { onNavigate: (dest: string) => void }) {
  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs font-semibold text-orange-500">Here's what I can help with:</p>
      <div className="grid grid-cols-2 gap-1.5">
        {HELP_MENU_ITEMS.map((item) => (
          <button
            key={item.destination}
            onClick={() => onNavigate(item.destination)}
            className="text-xs px-3 py-2 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors text-center"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Visual state type                                                  */
/* ------------------------------------------------------------------ */
type JarvisVisualState = "idle" | "listening" | "thinking" | "speaking";

/* ------------------------------------------------------------------ */
/*  Message bubble                                                     */
/* ------------------------------------------------------------------ */
function MessageBubble({
  message,
  onConfirm,
  onCancel,
  onReplay,
  onSuggestionClick,
  onNavigate,
}: {
  message: JarvisMessage;
  onConfirm?: () => void;
  onCancel?: () => void;
  onReplay?: () => void;
  onSuggestionClick?: (suggestion: JarvisSuggestion) => void;
  onNavigate?: (dest: string) => void;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("flex w-full gap-2", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
      )}

      <div className="flex flex-col gap-1.5 max-w-[80%]">
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted text-foreground rounded-bl-md"
          )}
        >
          {message.isSuccess && (
            <CheckCircle2 className="h-4 w-4 text-emerald-500 inline mr-1.5 -mt-0.5" />
          )}
          {message.content}
        </div>

        {/* Help menu grid for SHOW_MENU */}
        {!isUser && message.actionPayload?.type === 'SHOW_MENU' && onNavigate && (
          <HelpMenuGrid onNavigate={onNavigate} />
        )}

        {/* Suggestion chips / SHOW_MENU buttons */}
        {!isUser && message.suggestions && message.suggestions.length > 0 && message.actionPayload?.type !== 'SHOW_MENU' && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {message.suggestions.map((s) => {
              const isMenu = (s as any).isMenu || message.actionPayload?.type === 'SHOW_MENU';
              return (
                <button
                  key={s.destination}
                  onClick={() => onSuggestionClick?.(s)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border transition-colors font-medium",
                    isMenu
                      ? "bg-orange-500 text-white border-orange-500 hover:bg-orange-600 hover:border-orange-600"
                      : "border-border hover:bg-accent hover:border-primary/30 text-foreground"
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 items-center">
          {message.awaitingConfirmation && onConfirm && onCancel && (
            <>
              <Button size="sm" className="h-7 text-xs" onClick={onConfirm}>
                Yes
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCancel}>
                No
              </Button>
            </>
          )}
          {!isUser && onReplay && (
            <button
              onClick={onReplay}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Replay voice"
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Enhanced Speech Recognition with auto-submit                       */
/* ------------------------------------------------------------------ */
function useEnhancedSpeechRecognition(onFinalTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTextRef = useRef("");

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterimTranscript("");
    finalTextRef.current = "";
  }, [clearSilenceTimer]);

  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    // Stop any existing recognition
    recognitionRef.current?.stop();
    clearSilenceTimer();

    const recognition = new SpeechRecognition();
    recognition.lang = "en-GB";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        finalTextRef.current = final;
      }
      setInterimTranscript(finalTextRef.current + interim);

      // Reset silence timer on each result
      clearSilenceTimer();
      silenceTimerRef.current = setTimeout(() => {
        const text = (finalTextRef.current || interim).trim();
        if (text) {
          onFinalTranscript(text);
        }
        stopListening();
      }, 1500);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
    };

    recognition.onerror = (e: any) => {
      if (e.error !== "aborted") {
        console.warn("Speech recognition error:", e.error);
      }
      setIsListening(false);
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;
    finalTextRef.current = "";
    recognition.start();
    setIsListening(true);
    setInterimTranscript("");
    playListeningPing();
  }, [onFinalTranscript, clearSilenceTimer, stopListening]);

  const supported =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  return { isListening, interimTranscript, startListening, stopListening, supported };
}

/* ------------------------------------------------------------------ */
/*  ElevenLabs TTS with browser fallback                               */
/* ------------------------------------------------------------------ */
interface SpeakOptions {
  autoSpotlight?: boolean;
  clearSpotlightOnEnd?: boolean;
}

function useElevenLabsTTS(
  voiceGender?: 'male' | 'female',
  speed?: number,
  volume?: number,
  muteDefault?: boolean,
  elevenLabsVoiceId?: string
) {
  const [enabled, setEnabled] = useState(!muteDefault);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onDoneRef = useRef<(() => void) | null>(null);

  // Browser fallback voice
  const getPreferredVoice = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    const gender = voiceGender || 'male';
    if (gender === 'male') {
      const malePreferred = ["Google UK English Male", "Microsoft George", "Daniel"];
      for (const name of malePreferred) {
        const v = voices.find((v) => v.name.includes(name));
        if (v) return v;
      }
      return voices.find((v) => v.name.includes("Male") && v.lang.startsWith("en"))
        || voices.find((v) => v.lang === "en-GB")
        || voices.find((v) => v.lang.startsWith("en"))
        || null;
    } else {
      const femalePreferred = ["Google UK English Female", "Microsoft Hazel", "Martha", "Samantha"];
      for (const name of femalePreferred) {
        const v = voices.find((v) => v.name.includes(name));
        if (v) return v;
      }
      return voices.find((v) => v.name.includes("Female") && v.lang.startsWith("en"))
        || voices.find((v) => v.lang === "en-GB")
        || voices.find((v) => v.lang.startsWith("en"))
        || null;
    }
  }, [voiceGender]);

  const speakBrowserFallback = useCallback(
    (text: string, onDone?: () => void, options?: SpeakOptions) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        onDone?.();
        return;
      }

      const resolved = {
        autoSpotlight: options?.autoSpotlight ?? true,
        clearSpotlightOnEnd: options?.clearSpotlightOnEnd ?? true,
      };

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speed ?? 1.0;
      utterance.pitch = 1.0;
      utterance.volume = (volume ?? 80) / 100;
      const voice = getPreferredVoice();
      if (voice) utterance.voice = voice;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        if (resolved.clearSpotlightOnEnd) jarvisSpotlight.clearAll();
        onDone?.();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        if (resolved.clearSpotlightOnEnd) jarvisSpotlight.clearAll();
        onDone?.();
      };
      window.speechSynthesis.speak(utterance);
    },
    [getPreferredVoice, speed, volume]
  );

  const speak = useCallback(
    async (text: string, onDone?: () => void, options?: SpeakOptions) => {
      if (!enabled || !text || !text.trim()) {
        onDone?.();
        return;
      }

      const resolved = {
        autoSpotlight: options?.autoSpotlight ?? true,
        clearSpotlightOnEnd: options?.clearSpotlightOnEnd ?? true,
      };

      onDoneRef.current = onDone || null;
      setIsSpeaking(true);

      // Auto-spotlight any elements mentioned in normal speech (disabled for guided tours)
      if (resolved.autoSpotlight) {
        jarvisSpotlight.autoSpotlight(text);
      }

      try {
        // Try ElevenLabs first
        const { data, error } = await supabase.functions.invoke("jarvis-speak", {
          body: { text, voice_id: elevenLabsVoiceId || "pNInz6obpgDQGcFmaJgB" },
        });

        if (error || data?.fallback || !data?.audio) {
          // Fallback to browser TTS
          console.log("[Jarvis] ElevenLabs unavailable, using browser TTS");
          setIsSpeaking(false);
          onDoneRef.current = null;
          speakBrowserFallback(text, onDone, resolved);
          return;
        }

        // Play ElevenLabs audio via data URI
        const audioUrl = `data:audio/mpeg;base64,${data.audio}`;
        const audio = new Audio(audioUrl);
        audio.volume = (volume ?? 80) / 100;
        audioRef.current = audio;

        audio.onended = () => {
          setIsSpeaking(false);
          audioRef.current = null;
          if (resolved.clearSpotlightOnEnd) jarvisSpotlight.clearAll();
          onDoneRef.current?.();
          onDoneRef.current = null;
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          audioRef.current = null;
          onDoneRef.current = null;
          // Fallback on audio play error
          speakBrowserFallback(text, onDone, resolved);
        };

        await audio.play();
      } catch (e) {
        console.warn("[Jarvis] ElevenLabs error, falling back:", e);
        setIsSpeaking(false);
        onDoneRef.current = null;
        speakBrowserFallback(text, onDone, resolved);
      }
    },
    [enabled, elevenLabsVoiceId, volume, speakBrowserFallback]
  );

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    jarvisSpotlight.clearAll();
    onDoneRef.current = null;
  }, []);

  const toggle = useCallback(() => {
    setEnabled((e) => {
      if (e) {
        stop();
      }
      return !e;
    });
  }, [stop]);

  return { enabled, toggle, speak, stop, isSpeaking };
}

/* ------------------------------------------------------------------ */
/*  Hook: detect modals & focused inputs to auto-pause Jarvis          */
/* ------------------------------------------------------------------ */
function useJarvisPauseDetection(
  onPause: () => void,
  suppressRef?: React.MutableRefObject<boolean>
) {
  useEffect(() => {
    const isSuppressed = () => !!suppressRef?.current;

    const handleFocusIn = (e: FocusEvent) => {
      if (isSuppressed()) return;
      const el = e.target as HTMLElement;
      if (!el) return;
      const tag = el.tagName?.toLowerCase();
      if (el.getAttribute("placeholder")?.includes("Jarvis")) return;
      if (
        tag === "input" ||
        tag === "textarea" ||
        el.isContentEditable ||
        el.getAttribute("role") === "textbox"
      ) {
        onPause();
      }
    };

    const observer = new MutationObserver(() => {
      if (isSuppressed()) return;
      const hasModal = document.querySelector(
        '[role="dialog"], [role="alertdialog"], [data-radix-portal], .modal, [data-state="open"][data-radix-dialog-overlay]'
      );
      if (hasModal) {
        onPause();
      }
    });

    document.addEventListener("focusin", handleFocusIn);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      observer.disconnect();
    };
  }, [onPause, suppressRef]);
}

/* ------------------------------------------------------------------ */
/*  Chat panel                                                         */
/* ------------------------------------------------------------------ */
function JarvisChatPanel({ onClose, onActiveChange }: { onClose: () => void; onActiveChange?: (active: boolean) => void }) {
  const { messages, isLoading, sendMessage, clearHistory, userFirstName, userPreferredName, flowState, cancelFlow, saveFromCard, registerEntity, setMessages } = useJarvis();
  const { settings: jarvisSettings } = useJarvisSettings();
  const [input, setInput] = useState("");
  const [keepListening, setKeepListening] = useState(false);
  const [bannerData, setBannerData] = useState<BannerData | null>(null);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const lastBannerMsgIdx = useRef(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // Draggable panel logic
  const PANEL_W = 420;
  const PANEL_H = 580;
  const panelRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragHintVisible, setDragHintVisible] = useState(false);

  const getDefaultPos = useCallback(() => ({
    x: window.innerWidth - PANEL_W - 24,
    y: window.innerHeight - PANEL_H - 96,
  }), []);

  const [panelPos, setPanelPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = sessionStorage.getItem("jarvis_panel_position");
      if (saved) {
        const p = JSON.parse(saved);
        if (typeof p.x === "number" && typeof p.y === "number") return p;
      }
    } catch {}
    return getDefaultPos();
  });
  const jarvisLocation = useLocation();
  const jarvisNav = useJarvisNavigation();
  const tts = useElevenLabsTTS(
    jarvisSettings.voice_gender,
    jarvisSettings.speaking_speed,
    jarvisSettings.volume,
    jarvisSettings.mute_by_default,
    jarvisSettings.elevenlabs_voice_id
  );

  // Sync spotlight settings to the singleton manager
  useEffect(() => {
    jarvisSpotlight.configure({
      spotlight_enabled: jarvisSettings.spotlight_enabled,
      page_glow_enabled: jarvisSettings.page_glow_enabled ?? true,
      tooltip_labels_enabled: jarvisSettings.tooltip_labels_enabled ?? true,
    });
  }, [jarvisSettings.spotlight_enabled, jarvisSettings.page_glow_enabled, jarvisSettings.tooltip_labels_enabled]);

  // Drag handlers (desktop only)
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (isMobile || !panelRef.current) return;
    e.preventDefault();
    const rect = panelRef.current.getBoundingClientRect();
    dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setIsDragging(true);
  }, [isMobile]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent) => {
      let nx = e.clientX - dragOffsetRef.current.x;
      let ny = e.clientY - dragOffsetRef.current.y;
      nx = Math.max(0, Math.min(window.innerWidth - PANEL_W, nx));
      ny = Math.max(0, Math.min(window.innerHeight - PANEL_H, ny));
      setPanelPos({ x: nx, y: ny });
    };
    const handleUp = () => setIsDragging(false);
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    return () => { document.removeEventListener("mousemove", handleMove); document.removeEventListener("mouseup", handleUp); };
  }, [isDragging]);

  // Persist position to sessionStorage
  useEffect(() => {
    if (!isDragging && !isMobile) {
      try { sessionStorage.setItem("jarvis_panel_position", JSON.stringify(panelPos)); } catch {}
    }
  }, [panelPos, isDragging, isMobile]);

  // Clamp panel position into viewport whenever the window resizes or zoom changes.
  // Prevents the chat box from opening off-screen when the user has zoomed/resized
  // since the position was last persisted.
  useEffect(() => {
    if (isMobile) return;
    const clamp = () => {
      setPanelPos((prev) => {
        const margin = 8;
        const maxX = Math.max(margin, window.innerWidth - PANEL_W - margin);
        const maxY = Math.max(margin, window.innerHeight - PANEL_H - margin);
        const nx = Math.min(Math.max(margin, prev.x), maxX);
        const ny = Math.min(Math.max(margin, prev.y), maxY);
        if (nx === prev.x && ny === prev.y) return prev;
        return { x: nx, y: ny };
      });
    };
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [isMobile]);

  const isGuideMode =
    jarvisNav.tourState.status === "running" || jarvisNav.tourState.status === "paused";

  // Tour tooltip state — driven by events from the navigation hook
  const [tourTooltipRect, setTourTooltipRect] = useState<DOMRect | null>(null);
  const [tourSpeechText, setTourSpeechText] = useState("");

  useEffect(() => {
    const handleTooltip = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setTourTooltipRect(detail?.rect || null);
      setTourSpeechText(detail?.speechText || "");
    };
    window.addEventListener("jarvis-tour-tooltip", handleTooltip);
    return () => window.removeEventListener("jarvis-tour-tooltip", handleTooltip);
  }, []);

  // Emit tour-active state for the FAB
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("jarvis-tour-active", { detail: { active: isGuideMode } }));
  }, [isGuideMode]);

  // Auto-dodge: reposition panel when a highlighted element overlaps with it
  const savedPosBeforeDodge = useRef<{ x: number; y: number } | null>(null);
  const dodgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isMobile) return;

    const getCurrentPos = () => {
      const panelEl = panelRef.current;
      return panelEl
        ? { x: panelEl.getBoundingClientRect().left, y: panelEl.getBoundingClientRect().top }
        : panelPos;
    };

    const moveToOppositeSide = () => {
      const currentPos = getCurrentPos();
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;
      const margin = 16;
      const onRightHalf = currentPos.x + PANEL_W / 2 > viewW / 2;
      const targetX = onRightHalf
        ? margin
        : Math.max(margin, viewW - PANEL_W - margin);
      const targetY = Math.max(margin, Math.min(viewH - PANEL_H - margin, currentPos.y));
      setPanelPos({ x: targetX, y: targetY });
    };

    const handleGuideStep = () => {
      if (dodgeTimerRef.current) {
        clearTimeout(dodgeTimerRef.current);
        dodgeTimerRef.current = null;
      }
      savedPosBeforeDodge.current = null;
      moveToOppositeSide();
    };

    const handleHighlight = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.rect) return;
      const hlRect = detail.rect as DOMRect;

      const currentPos = getCurrentPos();
      const panelRect = {
        left: currentPos.x,
        top: currentPos.y,
        right: currentPos.x + PANEL_W,
        bottom: currentPos.y + PANEL_H,
      };
      const overlaps = !(
        panelRect.right < hlRect.left ||
        panelRect.left > hlRect.right ||
        panelRect.bottom < hlRect.top ||
        panelRect.top > hlRect.bottom
      );
      if (!overlaps) return;

      if (!savedPosBeforeDodge.current) {
        savedPosBeforeDodge.current = { ...currentPos };
      }

      if (dodgeTimerRef.current) {
        clearTimeout(dodgeTimerRef.current);
        dodgeTimerRef.current = null;
      }

      const viewW = window.innerWidth;
      const viewH = window.innerHeight;
      let newX = currentPos.x;
      let newY = currentPos.y;

      if (hlRect.left > viewW / 2) {
        newX = Math.max(16, hlRect.left - PANEL_W - 32);
      } else {
        newX = Math.min(viewW - PANEL_W - 16, hlRect.right + 32);
      }
      if (newY + PANEL_H > hlRect.top && newY < hlRect.bottom) {
        if (hlRect.top > PANEL_H + 32) {
          newY = hlRect.top - PANEL_H - 32;
        } else {
          newY = Math.min(viewH - PANEL_H - 16, hlRect.bottom + 32);
        }
      }
      newX = Math.max(0, Math.min(viewW - PANEL_W, newX));
      newY = Math.max(0, Math.min(viewH - PANEL_H, newY));
      setPanelPos({ x: newX, y: newY });
    };

    // Restore panel position when highlights are cleared (outside guided mode)
    const handleClear = () => {
      if (isGuideMode) {
        savedPosBeforeDodge.current = null;
        return;
      }
      if (savedPosBeforeDodge.current) {
        dodgeTimerRef.current = setTimeout(() => {
          if (savedPosBeforeDodge.current) {
            setPanelPos(savedPosBeforeDodge.current);
            savedPosBeforeDodge.current = null;
          }
        }, 300);
      }
    };

    window.addEventListener("jarvis-guide-next-step", handleGuideStep);
    window.addEventListener("jarvis-highlight", handleHighlight);
    window.addEventListener("jarvis-highlight-clear", handleClear);
    return () => {
      window.removeEventListener("jarvis-guide-next-step", handleGuideStep);
      window.removeEventListener("jarvis-highlight", handleHighlight);
      window.removeEventListener("jarvis-highlight-clear", handleClear);
      if (dodgeTimerRef.current) clearTimeout(dodgeTimerRef.current);
    };
  }, [panelPos, isMobile, isGuideMode]);

  // Show drag hint during tours
  useEffect(() => {
    if (jarvisNav.tourState.status === "running" && !isMobile) {
      setDragHintVisible(true);
      const t = setTimeout(() => setDragHintVisible(false), 4000);
      return () => clearTimeout(t);
    } else {
      setDragHintVisible(false);
    }
  }, [jarvisNav.tourState.status, isMobile]);

  const greetingDoneRef = useRef(false);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInteractionRef = useRef(Date.now());
  const assistantName = jarvisSettings.assistant_name || 'Jarvis';
  const prevLocationRef = useRef(jarvisLocation.pathname);
  const conversationActiveRef = useRef(false); // Track if user started a conversation
  const pausedRef = useRef(false); // Track if auto-paused by modal/focus
  const workflowActiveRef = useRef(false); // True while Jarvis is driving a multi-step workflow (e.g. AI Call) — suppresses pause-on-modal

  // Auto-submit handler for voice — also intercept tour commands
  const handleVoiceSubmit = useCallback(
    (text: string) => {
      if (!text || isLoading) return;

      const lower = text.toLowerCase().trim();

      // Tour voice controls
      if (jarvisNav.tourState.status === "running" || jarvisNav.tourState.status === "paused") {
        if (/^(stop|cancel|quit|end tour)$/i.test(lower)) {
          jarvisNav.stopTour();
          return;
        }
        if (/^(pause|wait|hold on)$/i.test(lower)) {
          jarvisNav.pauseTour();
          return;
        }
        if (/^(next|skip|continue|go on|resume)$/i.test(lower)) {
          if (jarvisNav.tourState.status === "paused") {
            jarvisNav.resumeTour();
          } else {
            jarvisNav.skipTourStep();
          }
          return;
        }
      }

      setInput("");
      conversationActiveRef.current = true;
      sendMessage(text);
      lastInteractionRef.current = Date.now();
    },
    [isLoading, sendMessage, jarvisNav]
  );

  const speech = useEnhancedSpeechRecognition(handleVoiceSubmit);

  // Re-listen after TTS finishes (conversational flow)
  const relistenAfterSpeech = useCallback(() => {
    if (!speech.supported) return;
    // While a workflow is active, ALWAYS re-listen — ignore stale pause flag.
    if (workflowActiveRef.current) {
      pausedRef.current = false;
    } else if (pausedRef.current) {
      return;
    }
    // Always re-listen after Jarvis speaks during an active conversation
    if (conversationActiveRef.current || keepListening || workflowActiveRef.current) {
      if (tts.enabled) playYourTurnChime();
      setTimeout(() => {
        if (!pausedRef.current || workflowActiveRef.current) {
          speech.startListening();
        }
      }, 200);
    }
  }, [speech, keepListening, tts.enabled]);

  // --- Auto-pause on modals/form focus ---
  const pauseListening = useCallback(() => {
    // Don't pause while a Jarvis-driven workflow is in progress —
    // modals opened by Jarvis itself must NOT mute the mic.
    if (workflowActiveRef.current) return;
    pausedRef.current = true;
    speech.stopListening();
  }, [speech]);

  useJarvisPauseDetection(pauseListening, workflowActiveRef);

  // --- Stop listening on route change ---
  useEffect(() => {
    if (jarvisLocation.pathname !== prevLocationRef.current) {
      prevLocationRef.current = jarvisLocation.pathname;
      speech.stopListening();
      pausedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jarvisLocation.pathname]);

  // Report active state
  useEffect(() => {
    onActiveChange?.(speech.isListening);
  }, [speech.isListening, onActiveChange]);

  // Auto-scroll on new messages
  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, [messages, isLoading]);

  // Fill input with live voice transcript
  useEffect(() => {
    if (speech.interimTranscript) setInput(speech.interimTranscript);
  }, [speech.interimTranscript]);

  // Speak assistant responses + handle navigation + guided tours + success banner
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === "assistant") {
      // Detect workflow-driving tools (e.g. start_ai_call_workflow). When Jarvis
      // launches a multi-step workflow, keep the mic engaged through modal opens.
      const startedWorkflow = last.actionsExecuted?.some(
        (a) => a.success && /^start_/.test(a.tool)
      );
      if (startedWorkflow) {
        workflowActiveRef.current = true;
        pausedRef.current = false;
      }
      // Workflow ends when an action explicitly completes it (initiate_/create_ on the same flow)
      const endedWorkflow = last.actionsExecuted?.some(
        (a) => a.success && /^(initiate_ai_call|cancel_workflow)$/.test(a.tool)
      );
      if (endedWorkflow) {
        workflowActiveRef.current = false;
      }

      // Show success banner for completed actions
      const msgIdx = messages.length - 1;
      if (
        msgIdx > lastBannerMsgIdx.current &&
        last.actionsExecuted?.some((a) => a.success)
      ) {
        const banner = buildBannerData(
          last.actionsExecuted!,
          last.content,
          last.navigateTo
        );
        if (banner) {
          lastBannerMsgIdx.current = msgIdx;
          setBannerData(banner);
        }
      }

      // Auto-navigate after successful creation/mutation actions
      const hasSuccessfulMutation = last.actionsExecuted?.some(
        (a) => a.success && /^(create_|generate_|initiate_|mark_|send_|update_|delete_|start_)/.test(a.tool)
      );
      const isSearchAction = last.actionsExecuted?.some(a => a.tool === 'search_talent');
      if (last.navigateTo && hasSuccessfulMutation) {
        if (isSearchAction) {
          setShowSearchOverlay(true);
          setTimeout(() => {
            setShowSearchOverlay(false);
            navigate(last.navigateTo!);
          }, 2800);
        } else {
          setTimeout(() => {
            navigate(last.navigateTo!);
          }, 1500);
        }
      }

      // Check for guided tour first
      if (last.guidedTour && last.guidedTour.length > 0) {
        const speakAsync = (text: string) =>
          new Promise<void>((resolve) => {
            if (tts.enabled) {
              tts.speak(text, resolve, {
                autoSpotlight: false,
                clearSpotlightOnEnd: false,
              });
            } else {
              resolve();
            }
          });

        const runTour = async () => {
          const completionMsg = await jarvisNav.runGuidedTour(last.guidedTour!, speakAsync);
          if (completionMsg) {
            // Speak the completion message
            await speakAsync(completionMsg);
          }
          relistenAfterSpeech();
        };

        if (tts.enabled) {
          tts.speak(last.content, () => { runTour(); }, { autoSpotlight: false });
        } else {
          runTour();
        }
      } else {
        // Delegate navigation to the dedicated hook
        jarvisNav.handleMessageNavigation({
          navigateTo: last.navigateTo,
          targetId: last.targetId,
          targetAction: last.targetAction,
        });

        if (tts.enabled) {
          tts.speak(last.content, relistenAfterSpeech);
        } else {
          relistenAfterSpeech();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Highlight the relevant form field when flow state changes
  useEffect(() => {
    const highlightId = getFlowHighlightId(flowState);
    if (highlightId) {
      jarvisNav.highlightElement(highlightId);
    }
  }, [flowState.flow, flowState.currentQuestion]);

  // One-time greeting per session — only on FIRST open
  const doSessionGreeting = useCallback(() => {
    const alreadyGreeted = sessionStorage.getItem("jarvis_greeted");
    if (alreadyGreeted || greetingDoneRef.current) {
      // Subsequent opens: silent, just start listening
      conversationActiveRef.current = true;
      if (speech.supported) {
        speech.startListening();
      }
      return;
    }
    greetingDoneRef.current = true;
    sessionStorage.setItem("jarvis_greeted", "1");

    const displayName = userPreferredName || userFirstName || "";
    const isNewUser = sessionStorage.getItem("jarvis_new_user") === "true";

    if (isNewUser) {
      sessionStorage.removeItem("jarvis_new_user");

      // New user personalised greeting sequence
      const greeting1 = `Welcome to your Command Centre, ${displayName}. I'm ${assistantName} — I'm here whenever you need me. You can talk to me or type. Just tell me what you need.`;

      const doNewUserGreeting = () => {
        conversationActiveRef.current = true;
        if (tts.enabled) {
          tts.speak(greeting1, () => {
            setTimeout(() => {
              sendMessage("How many active projects and deals do I have?");
            }, 2000);
          });
        }
      };

      setTimeout(doNewUserGreeting, 1500);
    } else {
      // Standard time-based greeting
      const hour = new Date().getHours();
      const timeGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
      const greeting = `${timeGreeting}, ${displayName}. How can I help you today?`;

      const doGreeting = () => {
        conversationActiveRef.current = true;
        if (tts.enabled) {
          tts.speak(greeting, () => {
            if (speech.supported) {
              speech.startListening();
            }
          });
        } else {
          if (speech.supported) {
            speech.startListening();
          }
        }
      };

      setTimeout(doGreeting, 500);
    }

    // Pre-warm the edge function
    supabase.functions.invoke("jarvis-assistant", {
      body: { user_message: "ping", conversation_history: [], user_first_name: "" },
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trigger greeting when panel mounts
  useEffect(() => {
    doSessionGreeting();
  }, [doSessionGreeting]);

  // Keep-listening auto-sleep (60s silence → stop)
  useEffect(() => {
    if (!conversationActiveRef.current && !keepListening) {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      return;
    }

    const sleepMs = 60_000; // 60 seconds of silence

    const checkSleep = () => {
      const elapsed = Date.now() - lastInteractionRef.current;
      if (elapsed >= sleepMs) {
        conversationActiveRef.current = false;
        setKeepListening(false);
        speech.stopListening();
        workflowActiveRef.current = false;
      } else {
        sleepTimerRef.current = setTimeout(checkSleep, 15_000);
      }
    };

    sleepTimerRef.current = setTimeout(checkSleep, 15_000);
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keepListening, messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    const lower = trimmed.toLowerCase();

    // Intercept tour control commands from text input
    if (jarvisNav.tourState.status === "running" || jarvisNav.tourState.status === "paused") {
      if (/^(stop|cancel|quit|end tour)$/i.test(lower)) {
        setInput("");
        jarvisNav.stopTour();
        return;
      }
      if (/^(pause|wait|hold on)$/i.test(lower)) {
        setInput("");
        jarvisNav.pauseTour();
        return;
      }
      if (/^(next|skip|continue|go on|resume)$/i.test(lower)) {
        setInput("");
        if (jarvisNav.tourState.status === "paused") {
          jarvisNav.resumeTour();
        } else {
          jarvisNav.skipTourStep();
        }
        return;
      }
    }

    setInput("");
    speech.stopListening();
    conversationActiveRef.current = true;
    lastInteractionRef.current = Date.now();
    pausedRef.current = false;
    sendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleConfirm = () => {
    lastInteractionRef.current = Date.now();
    pausedRef.current = false;
    sendMessage("Yes, go ahead.");
  };
  const handleCancel = () => {
    lastInteractionRef.current = Date.now();
    sendMessage("No, cancel that.");
  };

  const handleReplay = (text: string) => {
    tts.speak(text);
  };

  // Compute visual state and propagate speaking state to floating button
  const visualState: JarvisVisualState = speech.isListening
    ? "listening"
    : isLoading
    ? "thinking"
    : tts.isSpeaking
    ? "speaking"
    : "idle";

  // Sync speaking state to floating button via custom event
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('jarvis-speaking', { detail: { speaking: tts.isSpeaking } }));
  }, [tts.isSpeaking]);

  const statusText: Record<JarvisVisualState, string> = {
    listening: "Listening…",
    thinking: "Thinking…",
    speaking: "Speaking…",
    idle: "AI CRM Assistant",
  };

  // When tour is active, render tooltip bubble instead of full panel
  if (isGuideMode) {
    return (
      <>
        <TourTooltipBubble
          tour={jarvisNav.tourState}
          speechText={tourSpeechText}
          targetRect={tourTooltipRect}
          onPrevious={() => {
            // No built-in "go back" — skip is forward only, so we just skip
            jarvisNav.skipTourStep();
          }}
          onNext={() => {
            if (jarvisNav.tourState.status === "paused") {
              jarvisNav.resumeTour();
            } else {
              jarvisNav.skipTourStep();
            }
          }}
          onExit={() => {
            // Store progress for resume
            try {
              sessionStorage.setItem("jarvis_tour_step", String(jarvisNav.tourState.currentStep));
            } catch {}
            jarvisNav.stopTour();
          }}
          isFinalStep={jarvisNav.tourState.currentStep === jarvisNav.tourState.steps.length - 1}
        />
      </>
    );
  }

  return (
    <>
      {bannerData && (
        <JarvisSuccessBanner
          data={bannerData}
          onDismiss={() => setBannerData(null)}
        />
      )}
    <div
      ref={panelRef}
      className={cn(
        "fixed z-[60] flex flex-col border border-border bg-background shadow-2xl overflow-hidden",
        isMobile
          ? "inset-0 rounded-none"
          : "w-[420px] h-[580px] max-w-[calc(100vw-16px)] max-h-[calc(100vh-16px)] rounded-2xl",
        isDragging && "select-none"
      )}
      style={isMobile ? undefined : { left: panelPos.x, top: panelPos.y }}
    >
      {/* Drag handle + Header */}
      <div className="shrink-0 border-b border-border bg-gradient-to-r from-primary/5 to-primary/10">
        {/* Drag handle bar (desktop only) */}
        {!isMobile && (
          <div
            onMouseDown={handleDragStart}
            className="h-8 flex items-center justify-center gap-2 relative"
            style={{ cursor: isDragging ? "grabbing" : "grab" }}
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
            {dragHintVisible && (
              <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-medium whitespace-nowrap z-10 animate-fade-in shadow-md">
                Drag me out of the way
              </span>
            )}
          </div>
        )}
        {/* Header content */}
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center relative">
              {visualState === "thinking" ? (
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
              ) : visualState === "speaking" ? (
                <Volume2 className="h-4 w-4 text-primary animate-pulse" />
              ) : (
                <Sparkles className="h-4 w-4 text-primary" />
              )}
              {visualState === "listening" && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
              )}
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground leading-none">
                {assistantName}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {statusText[visualState]}
              </p>
            </div>
          </div>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={tts.toggle}>
                {tts.enabled ? (
                  <Volume2 className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <VolumeOff className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {tts.enabled ? "Mute voice" : "Enable voice"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { clearHistory(); }}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Clear conversation</TooltipContent>
          </Tooltip>

          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
            speech.stopListening();
            tts.stop();
            conversationActiveRef.current = false;
            onClose();
          }}>
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef as any}>
        <div className="flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-12">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-6 w-6 text-primary/50" />
              </div>
              <p className="font-medium text-foreground">
                {userFirstName ? `Hello ${userFirstName}, I'm ${assistantName}` : `Hello, I'm ${assistantName}`}
              </p>
              <p className="text-xs mt-1.5 max-w-[260px] mx-auto">
                Ask me to search contacts, create companies, log calls, or
                get pipeline insights. You can speak or type.
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center mt-4">
                {[
                  "Show pipeline summary",
                  "Add a new company",
                  "Search contacts",
                  "Log a call",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-xs px-2.5 py-1 rounded-full border border-border hover:bg-accent transition-colors text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isLastAssistant =
              msg.role === "assistant" &&
              msg.awaitingConfirmation &&
              i === messages.length - 1;
            return (
              <div key={i} className="flex flex-col gap-2">
                <MessageBubble
                  message={msg}
                  onConfirm={isLastAssistant ? handleConfirm : undefined}
                  onCancel={isLastAssistant ? handleCancel : undefined}
                  onReplay={msg.role === "assistant" ? () => handleReplay(msg.content) : undefined}
                  onSuggestionClick={(suggestion) => {
                    jarvisNav.navigateTo(suggestion.destination);
                  }}
                  onNavigate={(dest) => {
                    jarvisNav.navigateTo(dest);
                  }}
                />
                {/* Inline confirmation card */}
                {msg.confirmCard && (
                  <div className="ml-8">
                    <JarvisConfirmationCard
                      card={msg.confirmCard}
                      onSave={async (fields, resolvedIds) => {
                        const result = await saveFromCard(msg.confirmCard!.cardType, fields, resolvedIds);
                        if (result.success) {
                          // Collapse card by removing it from the message
                          setMessages(prev => prev.map((m, idx) =>
                            idx === i ? { ...m, confirmCard: undefined, isSuccess: true } : m
                          ));
                          // Add success message
                          setMessages(prev => [...prev, {
                            role: "assistant" as const,
                            content: `${result.name || "Record"} saved.`,
                            isSuccess: true,
                          }]);
                          if (tts.enabled) {
                            tts.speak(`${result.name || "Record"} saved.`, relistenAfterSpeech);
                          }
                        } else {
                          toast.error(result.error || "Save failed");
                        }
                      }}
                      onCancel={() => {
                        setMessages(prev => prev.map((m, idx) =>
                          idx === i ? { ...m, confirmCard: undefined } : m
                        ));
                        setMessages(prev => [...prev, {
                          role: "assistant" as const,
                          content: "Cancelled.",
                        }]);
                        if (tts.enabled) {
                          tts.speak("Cancelled.", relistenAfterSpeech);
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && <TypingDots />}

          {/* Live transcript indicator */}
          {speech.isListening && speech.interimTranscript && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/5 border border-destructive/20 text-sm text-foreground">
              <span className="h-2 w-2 rounded-full bg-destructive animate-pulse shrink-0" />
              <span className="italic opacity-70">{speech.interimTranscript}</span>
            </div>
          )}

          {/* Listening indicator when no transcript yet */}
          {speech.isListening && !speech.interimTranscript && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/5 border border-destructive/20 text-sm text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-destructive animate-pulse shrink-0" />
              <span className="italic">Listening…</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Active Flow Indicator */}
      {flowState.flow && (
        <FlowProgressBar flowState={flowState} onCancel={cancelFlow} />
      )}

      {/* Guided Tour Player */}
      <GuidedTourPlayer
        tour={jarvisNav.tourState}
        onPause={jarvisNav.pauseTour}
        onResume={jarvisNav.resumeTour}
        onSkip={jarvisNav.skipTourStep}
        onStop={jarvisNav.stopTour}
      />

      {/* Keep Listening toggle + Input */}
      <div className="border-t border-border p-3 shrink-0 space-y-2">
        {speech.supported && (
          <div className="flex items-center justify-between px-1">
            <label htmlFor="keep-listening" className="text-xs text-muted-foreground cursor-pointer">
              Keep Listening
            </label>
            <Switch
              id="keep-listening"
              checked={keepListening}
              onCheckedChange={(v) => {
                setKeepListening(v);
                lastInteractionRef.current = Date.now();
                pausedRef.current = false;
                if (v && !speech.isListening && !isLoading && !tts.isSpeaking) {
                  conversationActiveRef.current = true;
                  speech.startListening();
                }
                if (!v && !conversationActiveRef.current) {
                  speech.stopListening();
                }
              }}
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          {speech.supported && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-9 w-9 shrink-0 rounded-full relative",
                    speech.isListening &&
                      "bg-destructive/10 text-destructive"
                  )}
                  onClick={() => {
                    lastInteractionRef.current = Date.now();
                    pausedRef.current = false;
                    if (speech.isListening) {
                      speech.stopListening();
                    } else {
                      conversationActiveRef.current = true;
                      speech.startListening();
                    }
                  }}
                  disabled={isLoading || tts.isSpeaking}
                >
                  {speech.isListening ? (
                    <>
                      <MicOff className="h-4 w-4" />
                      <span className="absolute inset-0 rounded-full border-2 border-destructive animate-ping opacity-30" />
                    </>
                  ) : (
                    <Mic className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {speech.isListening ? "Stop recording" : "Voice input"}
              </TooltipContent>
            </Tooltip>
          )}

          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={speech.isListening ? "Listening…" : "Ask Jarvis anything…"}
            className="h-9 text-sm"
            disabled={isLoading}
          />

          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="h-9 w-9 shrink-0 rounded-full"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Floating action button with command palette                        */
/* ------------------------------------------------------------------ */
export function JarvisFloatingButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [idlePulse, setIdlePulse] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);

  // Listen for jarvis-open / jarvis-close events (from onboarding)
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    const handleClose = () => setIsOpen(false);
    const handleSpeaking = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setIsSpeaking(detail?.speaking ?? false);
    };
    const handleTourActive = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setIsTourActive(detail?.active ?? false);
    };
    window.addEventListener('jarvis-open', handleOpen);
    window.addEventListener('jarvis-close', handleClose);
    window.addEventListener('jarvis-speaking', handleSpeaking);
    window.addEventListener('jarvis-tour-active', handleTourActive);
    return () => {
      window.removeEventListener('jarvis-open', handleOpen);
      window.removeEventListener('jarvis-close', handleClose);
      window.removeEventListener('jarvis-speaking', handleSpeaking);
      window.removeEventListener('jarvis-tour-active', handleTourActive);
    };
  }, []);

  // Track active state → derive listening
  useEffect(() => {
    setIsListening(isActive && isOpen && !isSpeaking);
  }, [isActive, isOpen, isSpeaking]);

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowPalette(p => !p);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Idle pulse after 30s of no interaction
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const resetIdle = () => {
      setIdlePulse(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdlePulse(true), 30000);
    };
    resetIdle();
    document.addEventListener('click', resetIdle);
    document.addEventListener('keydown', resetIdle);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', resetIdle);
      document.removeEventListener('keydown', resetIdle);
    };
  }, []);

  // Lazy import palette
  const [PaletteComponent, setPaletteComponent] = useState<any>(null);
  useEffect(() => {
    if (showPalette && !PaletteComponent) {
      import('@/components/jarvis/JarvisCommandPalette').then(m => {
        setPaletteComponent(() => m.JarvisCommandPalette);
      });
    }
  }, [showPalette, PaletteComponent]);

  const handleJarvisMessage = useCallback((message: string) => {
    setIsOpen(true);
  }, []);

  // Sound wave bars for speaking state
  const SoundWaveBars = () => (
    <div className="flex items-center justify-center gap-[3px]">
      <span className="jarvis-wave-bar-1 block w-[3px] h-4 rounded-sm bg-primary-foreground origin-center" />
      <span className="jarvis-wave-bar-2 block w-[3px] h-4 rounded-sm bg-primary-foreground origin-center" />
      <span className="jarvis-wave-bar-3 block w-[3px] h-4 rounded-sm bg-primary-foreground origin-center" />
    </div>
  );

  // Determine button visual class
  const buttonAnimClass = isTourActive
    ? "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse"
    : isOpen
    ? isSpeaking
      ? "" // speaking: no ring, wave icon shown instead
      : isListening
        ? "jarvis-listening-ring"
        : ""
    : idlePulse
      ? "animate-pulse"
      : "";

  return (
    <>
      {isOpen && (
        <JarvisChatPanel
          onClose={() => setIsOpen(false)}
          onActiveChange={(active) => {
            setIsActive(active);
          }}
        />
      )}

      {PaletteComponent && (
        <PaletteComponent
          open={showPalette}
          onOpenChange={setShowPalette}
          onJarvisMessage={handleJarvisMessage}
        />
      )}

      {/* ? button for command palette */}
      {!isOpen && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setShowPalette(true)}
              className="fixed bottom-6 right-[5.5rem] z-[59] h-9 w-9 rounded-full flex items-center justify-center bg-muted text-muted-foreground border border-border shadow-md hover:bg-accent transition-colors"
              aria-label="Jarvis Commands"
            >
              <span className="text-sm font-bold">?</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            Commands <kbd className="ml-1 text-[10px] px-1 py-0.5 rounded bg-background font-mono">⌘K</kbd>
          </TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setIsOpen((o) => !o)}
            className={cn(
              "fixed bottom-6 right-6 z-[60] h-14 w-14 rounded-full flex items-center justify-center",
              "bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              buttonAnimClass
            )}
            aria-label="Ask Jarvis"
          >
            {isOpen ? (
              isSpeaking ? (
                <SoundWaveBars />
              ) : (
                <X className="h-6 w-6" />
              )
            ) : (
              <Sparkles className="h-6 w-6" />
            )}
          </button>
        </TooltipTrigger>
        {!isOpen && (
          <TooltipContent side="left">
            Ask Jarvis — or press <kbd className="text-[10px] px-1 py-0.5 rounded bg-background font-mono ml-1">⌘K</kbd> for commands
          </TooltipContent>
        )}
      </Tooltip>
    </>
  );
}
