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
  ArrowUpRight,
  Key,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useJarvis, JarvisMessage } from "@/hooks/use-jarvis";
import { useIsServiceConfigured } from "@/hooks/use-integration-settings";
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
}: {
  message: JarvisMessage;
  onConfirm?: () => void;
  onCancel?: () => void;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("flex w-full gap-2", isUser ? "justify-end" : "justify-start")}
    >
      {/* Jarvis avatar */}
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

        {/* Confirmation buttons */}
        {message.awaitingConfirmation && onConfirm && onCancel && (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={onConfirm}
            >
              Confirm
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Voice hooks                                                        */
/* ------------------------------------------------------------------ */
function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      const t = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join("");
      setTranscript(t);
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setTranscript("");
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const supported =
    typeof window !== "undefined" &&
    !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );

  return { isListening, transcript, startListening, stopListening, supported };
}

function useSpeechSynthesis() {
  const [enabled, setEnabled] = useState(false);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || typeof window === "undefined" || !window.speechSynthesis)
        return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    },
    [enabled]
  );

  const toggle = useCallback(() => {
    setEnabled((e) => {
      if (e) window.speechSynthesis?.cancel();
      return !e;
    });
  }, []);

  return { enabled, toggle, speak };
}

/* ------------------------------------------------------------------ */
/*  Unconfigured panel                                                 */
/* ------------------------------------------------------------------ */
function JarvisUnconfiguredPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  return (
    <div
      className={cn(
        "fixed z-[60] flex flex-col border border-border bg-background shadow-2xl overflow-hidden",
        isMobile
          ? "inset-0 rounded-none"
          : "bottom-24 right-6 w-[420px] h-[580px] rounded-2xl"
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-primary/5 to-primary/10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground leading-none">Jarvis</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">AI CRM Assistant</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Key className="h-8 w-8 text-primary/60" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-lg">Jarvis Needs Setup</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-[300px]">
            To use Jarvis, you need to connect your Anthropic API key. This takes less than 2 minutes.
          </p>
        </div>

        <div className="w-full space-y-2 mt-2">
          <Button className="w-full" onClick={() => { onClose(); navigate('/settings/integrations'); }}>
            <Key className="h-4 w-4 mr-2" />
            Set Up API Key
          </Button>
          <Button variant="outline" className="w-full" onClick={() => { onClose(); navigate('/admin/jarvis-guide'); }}>
            <Settings className="h-4 w-4 mr-2" />
            View Setup Guide
          </Button>
        </div>

        <div className="text-xs text-muted-foreground mt-4 space-y-1 text-left w-full">
          <p className="font-medium text-foreground">Quick steps:</p>
          <p>1. Get an API key from console.anthropic.com</p>
          <p>2. Go to Settings → Integrations</p>
          <p>3. Paste your key in the Jarvis AI section</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Chat panel                                                         */
/* ------------------------------------------------------------------ */
function JarvisChatPanel({ onClose }: { onClose: () => void }) {
  const { messages, isLoading, sendMessage, clearHistory } = useJarvis();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const speech = useSpeechRecognition();
  const tts = useSpeechSynthesis();

  // Auto-scroll on new messages
  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, [messages, isLoading]);

  // Fill input with voice transcript
  useEffect(() => {
    if (speech.transcript) setInput(speech.transcript);
  }, [speech.transcript]);

  // Speak assistant responses
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && tts.enabled) {
      tts.speak(last.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    speech.stopListening();
    sendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleConfirm = () => sendMessage("Yes, go ahead.");
  const handleCancel = () => sendMessage("No, cancel that.");

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
          <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground leading-none">
              Jarvis
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              AI CRM Assistant
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {/* TTS toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={tts.toggle}
              >
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
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={clearHistory}
                title="Clear history"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Clear conversation</TooltipContent>
          </Tooltip>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
          >
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
              <p className="font-medium text-foreground">Hi, I'm Jarvis</p>
              <p className="text-xs mt-1.5 max-w-[260px] mx-auto">
                Ask me to search contacts, create opportunities, send emails, or
                get pipeline insights.
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center mt-4">
                {[
                  "Show pipeline summary",
                  "Add a new company",
                  "Search contacts",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInput(s);
                    }}
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
              />
            );
          })}

          {isLoading && <TypingDots />}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-3 shrink-0">
        <div className="flex items-center gap-2">
          {/* Voice input */}
          {speech.supported && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-9 w-9 shrink-0 rounded-full",
                    speech.isListening &&
                      "bg-destructive/10 text-destructive animate-pulse"
                  )}
                  onClick={
                    speech.isListening
                      ? speech.stopListening
                      : speech.startListening
                  }
                  disabled={isLoading}
                >
                  {speech.isListening ? (
                    <MicOff className="h-4 w-4" />
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
            placeholder="Ask Jarvis anything… (e.g. Add Sarah from Acme)"
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
  const { isConfigured, isLoading } = useIsServiceConfigured("anthropic");

  if (isLoading) return null;

  return (
    <>
      {isOpen && (
        isConfigured
          ? <JarvisChatPanel onClose={() => setIsOpen(false)} />
          : <JarvisUnconfiguredPanel onClose={() => setIsOpen(false)} />
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setIsOpen((o) => !o)}
            className={cn(
              "fixed bottom-6 right-6 z-[60] h-14 w-14 rounded-full flex items-center justify-center",
              "bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              !isOpen && "jarvis-pulse-ring"
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
