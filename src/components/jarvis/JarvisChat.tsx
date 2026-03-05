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
  RotateCcw,
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
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";

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
          {/* Confirmation buttons */}
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
          {/* Replay button for assistant messages */}
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
      // If still supposed to be listening but ended (browser cut off), don't auto-restart here
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
/*  Speech Synthesis with UK English preference                        */
/* ------------------------------------------------------------------ */
function useEnhancedSpeechSynthesis() {
  const [enabled, setEnabled] = useState(true); // Default ON for voice-first
  const [isSpeaking, setIsSpeaking] = useState(false);

  const getPreferredVoice = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    // Prefer UK English voices
    const ukVoice = voices.find(
      (v) => v.lang === "en-GB" && (v.name.includes("Google") || v.name.includes("Daniel") || v.name.includes("Martha"))
    );
    if (ukVoice) return ukVoice;
    // Fallback to any en-GB
    const anyUk = voices.find((v) => v.lang === "en-GB");
    if (anyUk) return anyUk;
    // Fallback to any English
    return voices.find((v) => v.lang.startsWith("en")) || null;
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || typeof window === "undefined" || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      const voice = getPreferredVoice();
      if (voice) utterance.voice = voice;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [enabled, getPreferredVoice]
  );

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  const toggle = useCallback(() => {
    setEnabled((e) => {
      if (e) {
        window.speechSynthesis?.cancel();
        setIsSpeaking(false);
      }
      return !e;
    });
  }, []);

  return { enabled, toggle, speak, stop, isSpeaking };
}

/* ------------------------------------------------------------------ */
/*  Chat panel                                                         */
/* ------------------------------------------------------------------ */
function JarvisChatPanel({ onClose, onActiveChange }: { onClose: () => void; onActiveChange?: (active: boolean) => void }) {
  const { messages, isLoading, sendMessage, clearHistory, userFirstName } = useJarvis();
  const [input, setInput] = useState("");
  const [keepListening, setKeepListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const tts = useEnhancedSpeechSynthesis();
  const hasGreetedRef = useRef(false);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInteractionRef = useRef(Date.now());

  // Auto-submit handler for voice
  const handleVoiceSubmit = useCallback(
    (text: string) => {
      if (text && !isLoading) {
        setInput("");
        sendMessage(text);
        lastInteractionRef.current = Date.now();
      }
    },
    [isLoading, sendMessage]
  );

  const speech = useEnhancedSpeechRecognition(handleVoiceSubmit);

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
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === "assistant") {
      if (tts.enabled) {
        tts.speak(last.content);
      }
      // Handle navigation
      if (last.navigateTo) {
        setTimeout(() => navigate(last.navigateTo!), 1000);
      }
      // Re-activate mic if keep listening is on
      if (keepListening && !isLoading) {
        // Wait for TTS to finish (approx) before re-listening
        const delay = tts.enabled ? Math.min(last.content.length * 60, 8000) : 500;
        const t = setTimeout(() => {
          if (keepListening && speech.supported) {
            speech.startListening();
          }
        }, delay);
        return () => clearTimeout(t);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Greeting on first open
  useEffect(() => {
    if (!hasGreetedRef.current) {
      hasGreetedRef.current = true;
      const greeting = `Hello ${userFirstName}. I'm Jarvis. How can I help you today?`;

      // Speak greeting
      if (tts.enabled) {
        // Need voices to be loaded first
        const speakGreeting = () => tts.speak(greeting);
        if (window.speechSynthesis.getVoices().length > 0) {
          setTimeout(speakGreeting, 300);
        } else {
          window.speechSynthesis.onvoiceschanged = () => {
            setTimeout(speakGreeting, 300);
          };
        }
      }

      // Start listening after greeting
      if (speech.supported) {
        const listenDelay = tts.enabled ? 3500 : 500;
        setTimeout(() => {
          if (speech.supported) speech.startListening();
        }, listenDelay);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep-listening auto-sleep after 3 minutes
  useEffect(() => {
    if (!keepListening) {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      return;
    }

    const checkSleep = () => {
      const elapsed = Date.now() - lastInteractionRef.current;
      if (elapsed >= 180_000) { // 3 minutes
        setKeepListening(false);
        speech.stopListening();
        if (tts.enabled) {
          tts.speak("Going to sleep. Click the button when you need me.");
        }
      } else {
        sleepTimerRef.current = setTimeout(checkSleep, 30_000);
      }
    };

    sleepTimerRef.current = setTimeout(checkSleep, 30_000);
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keepListening]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    speech.stopListening();
    lastInteractionRef.current = Date.now();
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
    sendMessage("Yes, go ahead.");
  };
  const handleCancel = () => {
    lastInteractionRef.current = Date.now();
    sendMessage("No, cancel that.");
  };

  const handleReplay = (text: string) => {
    tts.speak(text);
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
            <Sparkles className="h-4 w-4 text-primary" />
            {speech.isListening && (
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
            )}
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground leading-none">
              Jarvis
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {speech.isListening ? "Listening…" : tts.isSpeaking ? "Speaking…" : "AI CRM Assistant"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {/* TTS mute toggle */}
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
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { clearHistory(); hasGreetedRef.current = false; }}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Clear conversation</TooltipContent>
          </Tooltip>

          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { speech.stopListening(); tts.stop(); onClose(); }}>
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
                Hello {userFirstName}, I'm Jarvis
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
        </div>
      </ScrollArea>

      {/* Keep Listening toggle + Input */}
      <div className="border-t border-border p-3 shrink-0 space-y-2">
        {/* Keep Listening toggle */}
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
                if (v && !speech.isListening && !isLoading) {
                  speech.startListening();
                }
              }}
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Voice input button */}
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
                    if (speech.isListening) {
                      speech.stopListening();
                    } else {
                      speech.startListening();
                    }
                  }}
                  disabled={isLoading}
                >
                  {speech.isListening ? (
                    <>
                      <MicOff className="h-4 w-4" />
                      {/* Pulsing ring */}
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
