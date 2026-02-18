import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Bot,
  Phone,
  PhoneOff,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Calendar,
  Send,
  User,
  Loader2,
  Shield,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { OutreachTarget } from "@/hooks/use-outreach";
import { useQueryClient } from "@tanstack/react-query";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ConversationMessage {
  role: "assistant" | "user";
  content: string;
}

interface StructuredAnswers {
  outcome?: string;
  interest_level?: string;
  availability?: string;
  availability_date?: string;
  notice_period?: string;
  best_callback_time?: string;
  opted_out?: boolean;
  wants_meeting?: boolean;
  meeting_slot?: string;
  summary?: string;
}

type CallPhase = "pre_check" | "calling" | "complete" | "blocked";

interface PreCheckState {
  passed: boolean;
  blockers: string[];
  warnings: string[];
}

interface Props {
  target: OutreachTarget | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

// ─── Hardcoded demo recruiter slots (would come from calendar integration) ─────

const DEMO_SLOTS = [
  "Tomorrow at 10:00 AM",
  "Tomorrow at 2:00 PM",
  "Thursday at 11:00 AM",
];

// ─── Outcome badge helper ──────────────────────────────────────────────────────

function OutcomeBadge({ answers }: { answers: StructuredAnswers }) {
  if (answers.opted_out) {
    return (
      <Badge className="bg-destructive/10 text-destructive gap-1.5">
        <XCircle className="w-3 h-3" /> Opted Out
      </Badge>
    );
  }
  if (answers.wants_meeting) {
    return (
      <Badge className="bg-primary/10 text-primary gap-1.5">
        <Calendar className="w-3 h-3" /> Meeting Booked
      </Badge>
    );
  }
  if (answers.interest_level === "high" || answers.interest_level === "medium") {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 gap-1.5">
        <CheckCircle2 className="w-3 h-3" /> Interested
      </Badge>
    );
  }
  return (
    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 gap-1.5">
      <Phone className="w-3 h-3" /> Contacted
    </Badge>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function AICallAgentModal({ target, open, onOpenChange }: Props) {
  const [phase, setPhase] = useState<CallPhase>("pre_check");
  const [preCheck, setPreCheck] = useState<PreCheckState | null>(null);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [structuredAnswers, setStructuredAnswers] = useState<StructuredAnswers | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  // Reset state when dialog opens/target changes
  useEffect(() => {
    if (open && target) {
      setPhase("pre_check");
      setPreCheck(null);
      setConversation([]);
      setUserInput("");
      setIsLoading(false);
      setStructuredAnswers(null);
      setCallDuration(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  // Call timer
  useEffect(() => {
    if (phase === "calling") {
      timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // ─── Initiate call ──────────────────────────────────────────────────────────

  const initiateCall = async () => {
    if (!target) return;
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-call-agent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            target_id: target.id,
            workspace_id: target.workspace_id,
            recruiter_calendar_slots: DEMO_SLOTS,
          }),
        }
      );

      const data = await response.json();

      if (data.blocked) {
        setPreCheck({ passed: false, blockers: data.blockers, warnings: data.warnings ?? [] });
        setPhase("blocked");
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        toast.error(data.error ?? "Failed to initiate call");
        setIsLoading(false);
        return;
      }

      // Pre-checks passed, show warnings if any before continuing
      const warnings: string[] = data.warnings ?? [];
      setPreCheck({ passed: true, blockers: [], warnings });
      setConversation(data.updated_history ?? [{ role: "assistant", content: data.message }]);
      setPhase("calling");

      if (data.is_complete) {
        setStructuredAnswers(data.structured_answers);
        setPhase("complete");
        qc.invalidateQueries({ queryKey: ["outreach_targets"] });
        qc.invalidateQueries({ queryKey: ["outreach_events"] });
      }
    } catch (err) {
      toast.error("Failed to start AI call");
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Send user message (simulating candidate response) ─────────────────────

  const sendMessage = async () => {
    if (!target || !userInput.trim() || isLoading) return;
    const msg = userInput.trim();
    setUserInput("");

    const newHistory: ConversationMessage[] = [...conversation, { role: "user", content: msg }];
    setConversation(newHistory);
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-call-agent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            target_id: target.id,
            workspace_id: target.workspace_id,
            recruiter_calendar_slots: DEMO_SLOTS,
            conversation_history: newHistory,
            user_message: msg,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "AI response failed");
        setIsLoading(false);
        return;
      }

      setConversation(data.updated_history ?? newHistory);

      if (data.is_complete) {
        setStructuredAnswers(data.structured_answers);
        setPhase("complete");
        qc.invalidateQueries({ queryKey: ["outreach_targets"] });
        qc.invalidateQueries({ queryKey: ["outreach_events"] });
        toast.success("Call completed — outcomes saved");
      }
    } catch (err) {
      toast.error("Failed to send message");
    } finally {
      setIsLoading(false);
    }
  };

  // ─── End call manually ──────────────────────────────────────────────────────

  const endCallEarly = async () => {
    if (!target) return;
    setIsLoading(true);

    // Send a special message to trigger call close
    const newHistory: ConversationMessage[] = [
      ...conversation,
      { role: "user", content: "[RECRUITER_ENDED_CALL] The recruiter has ended the call early. Wrap up politely and emit CALL_COMPLETE with outcome=connected." },
    ];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-call-agent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            target_id: target.id,
            workspace_id: target.workspace_id,
            recruiter_calendar_slots: DEMO_SLOTS,
            conversation_history: newHistory,
          }),
        }
      );

      const data = await response.json();
      if (data.is_complete) {
        setStructuredAnswers(data.structured_answers);
        setConversation(data.updated_history ?? newHistory);
        setPhase("complete");
        qc.invalidateQueries({ queryKey: ["outreach_targets"] });
        toast.success("Call ended — outcomes saved");
      } else {
        setPhase("complete");
      }
    } catch {
      setPhase("complete");
    } finally {
      setIsLoading(false);
    }
  };

  if (!target) return null;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl flex flex-col gap-0 p-0 max-h-[90vh]">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-4 border-b shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base flex items-center gap-2">
                AI Call Agent
                {phase === "calling" && (
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">
                    {formatDuration(callDuration)}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5 truncate">
                {target.entity_name}
                {target.entity_title ? ` · ${target.entity_title}` : ""}
                {target.entity_phone ? ` · ${target.entity_phone}` : ""}
              </DialogDescription>
            </div>
            {phase === "calling" && (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">Live</span>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* ─── Pre-check phase ────────────────────────────────────────────── */}
          {phase === "pre_check" && (
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  Pre-Call Checks
                </p>
                <p className="text-xs text-muted-foreground">
                  The AI agent will run compliance and availability checks before initiating the call.
                </p>
              </div>

              <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-2.5">
                {[
                  { label: "Do Not Call flag", ok: !target.entity_phone || true },
                  { label: "Phone number available", ok: !!target.entity_phone },
                  { label: "Max attempts check", ok: true },
                  { label: "Target state eligible", ok: target.state !== "opted_out" },
                ].map((check) => (
                  <div key={check.label} className="flex items-center gap-2 text-sm">
                    {check.ok ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                    )}
                    <span className={check.ok ? "text-foreground" : "text-destructive"}>
                      {check.label}
                    </span>
                    {!check.ok && (
                      <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40 ml-auto">
                        BLOCKED
                      </Badge>
                    )}
                  </div>
                ))}
              </div>

              {!target.entity_phone && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    No phone number available. The call cannot proceed without a valid phone number.
                  </AlertDescription>
                </Alert>
              )}

              <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground text-xs">AI Disclosure Notice</p>
                <p>The AI agent will identify itself as an AI at the start of every call, state the agency it represents, and ask for permission before discussing the role. Opt-out requests are honoured immediately.</p>
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1 gap-2"
                  disabled={!target.entity_phone || isLoading}
                  onClick={initiateCall}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Phone className="w-4 h-4" />
                  )}
                  {isLoading ? "Running checks…" : "Initiate AI Call"}
                </Button>
              </div>
            </div>
          )}

          {/* ─── Blocked phase ───────────────────────────────────────────────── */}
          {phase === "blocked" && preCheck && (
            <div className="p-5 space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium text-sm mb-2">Call blocked</p>
                  <ul className="space-y-1">
                    {preCheck.blockers.map((b) => (
                      <li key={b} className="text-xs flex items-center gap-1.5">
                        <XCircle className="w-3 h-3 shrink-0" /> {b}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
              {preCheck.warnings.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="space-y-1">
                      {preCheck.warnings.map((w) => (
                        <li key={w} className="text-xs">{w}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              <Button variant="outline" size="sm" className="w-full" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          )}

          {/* ─── Calling phase ───────────────────────────────────────────────── */}
          {phase === "calling" && (
            <>
              {preCheck?.warnings && preCheck.warnings.length > 0 && (
                <div className="px-4 pt-3">
                  <Alert className="py-2">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <AlertDescription className="text-xs">
                      {preCheck.warnings.join(" · ")}
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Transcript */}
              <ScrollArea className="flex-1 px-4 py-3">
                <div className="space-y-3 pb-2">
                  {conversation.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        msg.role === "assistant"
                          ? "bg-primary/10"
                          : "bg-muted"
                      }`}>
                        {msg.role === "assistant" ? (
                          <Bot className="w-3 h-3 text-primary" />
                        ) : (
                          <User className="w-3 h-3 text-muted-foreground" />
                        )}
                      </div>
                      <div className={`rounded-xl px-3 py-2 max-w-[80%] text-sm leading-relaxed ${
                        msg.role === "assistant"
                          ? "bg-muted/60 text-foreground"
                          : "bg-primary text-primary-foreground"
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-3 h-3 text-primary" />
                      </div>
                      <div className="rounded-xl px-3 py-2 bg-muted/60">
                        <div className="flex gap-1 items-center h-4">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="border-t p-3 space-y-2 shrink-0">
                <p className="text-[10px] text-muted-foreground px-1">
                  Simulate candidate response — type what the candidate says
                </p>
                <div className="flex gap-2">
                  <Input
                    className="h-8 text-sm flex-1"
                    placeholder="Type candidate response…"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    disabled={isLoading}
                  />
                  <Button size="sm" className="h-8 px-3" onClick={sendMessage} disabled={isLoading || !userInput.trim()}>
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 px-3 gap-1.5"
                    onClick={endCallEarly}
                    disabled={isLoading}
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                    End
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* ─── Complete phase ──────────────────────────────────────────────── */}
          {phase === "complete" && (
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <p className="font-medium text-sm">Call complete</p>
                {structuredAnswers && <OutcomeBadge answers={structuredAnswers} />}
              </div>

              {structuredAnswers?.summary && (
                <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                  {structuredAnswers.summary}
                </div>
              )}

              {structuredAnswers && (
                <div className="rounded-lg border border-border/50 divide-y divide-border/50 text-sm">
                  {[
                    { label: "Interest Level", value: structuredAnswers.interest_level },
                    { label: "Availability", value: structuredAnswers.availability },
                    { label: "Available From", value: structuredAnswers.availability_date },
                    { label: "Notice Period", value: structuredAnswers.notice_period },
                    { label: "Best Callback", value: structuredAnswers.best_callback_time },
                    { label: "Meeting Slot", value: structuredAnswers.meeting_slot },
                  ]
                    .filter((row) => row.value)
                    .map((row) => (
                      <div key={row.label} className="flex items-center px-3 py-2 gap-3">
                        <span className="text-xs text-muted-foreground w-28 shrink-0">{row.label}</span>
                        <span className="text-xs font-medium capitalize">{row.value}</span>
                      </div>
                    ))}
                </div>
              )}

              <Separator />

              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                Outcomes, event log, and candidate record updated automatically.
              </div>

              <Button size="sm" className="w-full" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
