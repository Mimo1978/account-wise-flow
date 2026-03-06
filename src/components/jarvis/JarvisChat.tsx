import { useState, useRef, useEffect, useCallback } from "react";
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
import { useJarvis, JarvisMessage } from "@/hooks/use-jarvis";
import { useJarvisSettings } from "@/hooks/use-jarvis-settings";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useJarvisNavigation } from "@/hooks/use-jarvis-navigation";

/* ------------------------------------------------------------------ */
/*  Typing indicator                                                   */
/* ------------------------------------------------------------------ */
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </span>
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
}: {
  message: JarvisMessage;
  onConfirm?: () => void;
  onCancel?: () => void;
  onReplay?: () => void;
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
  }, [onFinalTranscript, clearSilenceTimer, stopListening]);

  const supported =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  return { isListening, interimTranscript, startListening, stopListening, supported };
}

/* ------------------------------------------------------------------ */
/*  ElevenLabs TTS with browser fallback                               */
/* ------------------------------------------------------------------ */
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
    (text: string, onDone?: () => void) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        onDone?.();
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speed ?? 1.0;
      utterance.pitch = 1.0;
      utterance.volume = (volume ?? 80) / 100;
      const voice = getPreferredVoice();
      if (voice) utterance.voice = voice;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => { setIsSpeaking(false); onDone?.(); };
      utterance.onerror = () => { setIsSpeaking(false); onDone?.(); };
      window.speechSynthesis.speak(utterance);
    },
    [getPreferredVoice, speed, volume]
  );

  const speak = useCallback(
    async (text: string, onDone?: () => void) => {
      if (!enabled) {
        onDone?.();
        return;
      }

      onDoneRef.current = onDone || null;
      setIsSpeaking(true);

      try {
        // Try ElevenLabs first
        const { data, error } = await supabase.functions.invoke("jarvis-speak", {
          body: { text, voice_id: elevenLabsVoiceId || "pNInz6obpgDQGcFmaJgB" },
        });

        if (error || data?.fallback || !data?.audio) {
          // Fallback to browser TTS
          console.log("[Jarvis] ElevenLabs unavailable, using browser TTS");
          setIsSpeaking(false);
          speakBrowserFallback(text, onDone);
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
          onDoneRef.current?.();
          onDoneRef.current = null;
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          audioRef.current = null;
          // Fallback on audio play error
          speakBrowserFallback(text, onDone);
        };

        await audio.play();
      } catch (e) {
        console.warn("[Jarvis] ElevenLabs error, falling back:", e);
        setIsSpeaking(false);
        speakBrowserFallback(text, onDone);
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
function useJarvisPauseDetection(onPause: () => void) {
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
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
  }, [onPause]);
}

/* ------------------------------------------------------------------ */
/*  Chat panel                                                         */
/* ------------------------------------------------------------------ */
function JarvisChatPanel({ onClose, onActiveChange }: { onClose: () => void; onActiveChange?: (active: boolean) => void }) {
  const { messages, isLoading, sendMessage, clearHistory, userFirstName } = useJarvis();
  const { settings: jarvisSettings } = useJarvisSettings();
  const [input, setInput] = useState("");
  const [keepListening, setKeepListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const tts = useElevenLabsTTS(
    jarvisSettings.voice_gender,
    jarvisSettings.speaking_speed,
    jarvisSettings.volume,
    jarvisSettings.mute_by_default,
    jarvisSettings.elevenlabs_voice_id
  );
  const greetingDoneRef = useRef(false);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInteractionRef = useRef(Date.now());
  const assistantName = jarvisSettings.assistant_name || 'Jarvis';
  const prevLocationRef = useRef(location.pathname);
  const conversationActiveRef = useRef(false); // Track if user started a conversation
  const pausedRef = useRef(false); // Track if auto-paused by modal/focus

  // Auto-submit handler for voice
  const handleVoiceSubmit = useCallback(
    (text: string) => {
      if (text && !isLoading) {
        setInput("");
        conversationActiveRef.current = true; // Conversation is now active
        sendMessage(text);
        lastInteractionRef.current = Date.now();
      }
    },
    [isLoading, sendMessage]
  );

  const speech = useEnhancedSpeechRecognition(handleVoiceSubmit);

  // Re-listen after TTS finishes (conversational flow)
  const relistenAfterSpeech = useCallback(() => {
    if (!speech.supported) return;
    if (pausedRef.current) return;
    // Always re-listen after Jarvis speaks during an active conversation
    if (conversationActiveRef.current || keepListening) {
      setTimeout(() => {
        if (!pausedRef.current) {
          speech.startListening();
        }
      }, 200);
    }
  }, [speech, keepListening]);

  // --- Auto-pause on modals/form focus ---
  const pauseListening = useCallback(() => {
    pausedRef.current = true;
    speech.stopListening();
  }, [speech]);

  useJarvisPauseDetection(pauseListening);

  // --- Stop listening on route change ---
  useEffect(() => {
    if (location.pathname !== prevLocationRef.current) {
      prevLocationRef.current = location.pathname;
      speech.stopListening();
      pausedRef.current = false; // Reset on navigation
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

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

  // Speak assistant responses + handle navigation
  // After speaking, re-listen automatically for conversational flow
  // Also handle navigation + target element highlighting/clicking
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === "assistant") {
      if (last.navigateTo) {
        const navDelay = 600;
        setTimeout(() => {
          navigate(last.navigateTo!);
          // After navigation, try to highlight/click a target element
          if (last.targetId) {
            const attemptTarget = (retries: number) => {
              const el = document.getElementById(last.targetId!);
              if (el) {
                // Visual highlight pulse
                el.classList.add("jarvis-highlight");
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                setTimeout(() => el.classList.remove("jarvis-highlight"), 3000);
                // Auto-click if action is "click"
                if (last.targetAction === "click") {
                  setTimeout(() => el.click(), 800);
                }
              } else if (retries > 0) {
                setTimeout(() => attemptTarget(retries - 1), 400);
              }
            };
            // Wait for page to render after navigation
            setTimeout(() => attemptTarget(5), 500);
          }
        }, navDelay);
      } else if (last.targetId) {
        // Same page — highlight/click immediately
        const el = document.getElementById(last.targetId);
        if (el) {
          el.classList.add("jarvis-highlight");
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => el.classList.remove("jarvis-highlight"), 3000);
          if (last.targetAction === "click") {
            setTimeout(() => el.click(), 800);
          }
        }
      }

      if (tts.enabled) {
        tts.speak(last.content, relistenAfterSpeech);
      } else {
        // No TTS — re-listen for conversational flow
        relistenAfterSpeech();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // One-time greeting per session
  useEffect(() => {
    const alreadyGreeted = sessionStorage.getItem("jarvis_greeted");
    if (alreadyGreeted || greetingDoneRef.current) return;
    greetingDoneRef.current = true;
    sessionStorage.setItem("jarvis_greeted", "1");

    const greetingTemplate = jarvisSettings.greeting_message || "Hello {{name}}. I'm {{assistant}}. How can I help you today?";
    const greeting = greetingTemplate
      .replace("{{name}}", userFirstName || "")
      .replace("{{assistant}}", assistantName)
      .replace(/^\s+/, "")
      .replace(/\.\s*\./, ".");

    const doGreeting = () => {
      conversationActiveRef.current = true;
      if (tts.enabled) {
        tts.speak(greeting, () => {
          // After greeting, start listening for the first response
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

    // Small delay to let component mount
    setTimeout(doGreeting, 500);

    // Pre-warm the edge function
    supabase.functions.invoke("jarvis-assistant", {
      body: { user_message: "ping", conversation_history: [], user_first_name: "" },
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Compute visual state
  const visualState: JarvisVisualState = speech.isListening
    ? "listening"
    : isLoading
    ? "thinking"
    : tts.isSpeaking
    ? "speaking"
    : "idle";

  const statusText: Record<JarvisVisualState, string> = {
    listening: "Listening…",
    thinking: "Thinking…",
    speaking: "Speaking…",
    idle: "AI CRM Assistant",
  };

  return (
    <div
      className={cn(
        "fixed z-[60] flex flex-col border border-border bg-background shadow-2xl overflow-hidden",
        isMobile
          ? "inset-0 rounded-none"
          : "bottom-24 right-6 w-[420px] h-[580px] rounded-2xl"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-primary/5 to-primary/10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center relative">
            {visualState === "thinking" ? (
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
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
              <MessageBubble
                key={i}
                message={msg}
                onConfirm={isLastAssistant ? handleConfirm : undefined}
                onCancel={isLastAssistant ? handleCancel : undefined}
                onReplay={msg.role === "assistant" ? () => handleReplay(msg.content) : undefined}
              />
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
  );
}

/* ------------------------------------------------------------------ */
/*  Floating action button                                             */
/* ------------------------------------------------------------------ */
export function JarvisFloatingButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isActive, setIsActive] = useState(false);

  return (
    <>
      {isOpen && (
        <JarvisChatPanel
          onClose={() => setIsOpen(false)}
          onActiveChange={setIsActive}
        />
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setIsOpen((o) => !o)}
            className={cn(
              "fixed bottom-6 right-6 z-[60] h-14 w-14 rounded-full flex items-center justify-center",
              "bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              !isOpen && "jarvis-pulse-ring",
              isActive && isOpen && "jarvis-active-ring"
            )}
            aria-label="Ask Jarvis"
          >
            {isOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Sparkles className="h-6 w-6" />
            )}
          </button>
        </TooltipTrigger>
        {!isOpen && (
          <TooltipContent side="left">Ask Jarvis</TooltipContent>
        )}
      </Tooltip>
    </>
  );
}
