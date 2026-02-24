import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  CalendarClock,
  Crown,
  Mail,
  MessageSquare,
  Phone,
  Sparkles,
  Lock,
} from "lucide-react";
import {
  useAutomationSettings,
  useUpsertAutomationSettings,
  useCalendarConnections,
} from "@/hooks/use-outreach-automation";
import { usePremiumStatus } from "@/hooks/use-premium";

interface Props {
  campaignId: string;
}

export function AutomationSettingsPanel({ campaignId }: Props) {
  const { data: settings, isLoading } = useAutomationSettings(campaignId);
  const { data: calendars = [] } = useCalendarConnections();
  const { mutate: save, isPending } = useUpsertAutomationSettings();
  const { isPremium, tier } = usePremiumStatus();

  // Local state
  const [aiProcessing, setAiProcessing] = useState(false);
  const [autoClassify, setAutoClassify] = useState(true);
  const [autoLogFeedback, setAutoLogFeedback] = useState(true);
  const [autoScheduleMeetings, setAutoScheduleMeetings] = useState(false);
  const [autoScheduleCallbacks, setAutoScheduleCallbacks] = useState(false);
  const [calendarId, setCalendarId] = useState("");
  const [meetingBuffer, setMeetingBuffer] = useState("15");
  const [meetingDuration, setMeetingDuration] = useState("30");
  const [schedulingWindow, setSchedulingWindow] = useState("5");
  const [aiAcknowledge, setAiAcknowledge] = useState(false);
  const [aiSendConfirmations, setAiSendConfirmations] = useState(false);
  const [requireApproval, setRequireApproval] = useState(true);

  useEffect(() => {
    if (settings) {
      setAiProcessing(settings.ai_response_processing_enabled);
      setAutoClassify(settings.auto_classify_responses);
      setAutoLogFeedback(settings.auto_log_feedback);
      setAutoScheduleMeetings(settings.auto_schedule_meetings);
      setAutoScheduleCallbacks(settings.auto_schedule_callbacks);
      setCalendarId(settings.preferred_calendar_connection_id ?? "");
      setMeetingBuffer(String(settings.meeting_buffer_minutes));
      setMeetingDuration(String(settings.default_meeting_duration));
      setSchedulingWindow(String(settings.scheduling_window_days));
      setAiAcknowledge(settings.ai_acknowledge_responses);
      setAiSendConfirmations(settings.ai_send_confirmations);
      setRequireApproval(settings.require_human_approval);
    }
  }, [settings]);

  const handleSave = () => {
    save({
      campaign_id: campaignId,
      ai_response_processing_enabled: aiProcessing,
      auto_classify_responses: autoClassify,
      auto_log_feedback: autoLogFeedback,
      auto_schedule_meetings: autoScheduleMeetings,
      auto_schedule_callbacks: autoScheduleCallbacks,
      preferred_calendar_connection_id: calendarId || undefined,
      meeting_buffer_minutes: parseInt(meetingBuffer) || 15,
      default_meeting_duration: parseInt(meetingDuration) || 30,
      scheduling_window_days: parseInt(schedulingWindow) || 5,
      ai_acknowledge_responses: aiAcknowledge,
      ai_send_confirmations: aiSendConfirmations,
      require_human_approval: requireApproval,
    });
  };

  const PremiumGate = ({ children, feature }: { children: React.ReactNode; feature: string }) => {
    if (isPremium) return <>{children}</>;
    return (
      <div className="relative">
        <div className="opacity-50 pointer-events-none">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg">
          <div className="text-center px-4">
            <Lock className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-xs font-medium text-muted-foreground">Premium Feature</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Upgrade to Premium to enable {feature}
            </p>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading automation settings…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Subscription badge */}
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={`text-[10px] ${
            isPremium
              ? "border-amber-500 text-amber-700 dark:text-amber-400"
              : "border-border text-muted-foreground"
          }`}
        >
          <Crown className="w-3 h-3 mr-1" />
          {tier.charAt(0).toUpperCase() + tier.slice(1)} Plan
        </Badge>
        {!isPremium && (
          <span className="text-[10px] text-muted-foreground">
            Some features require Premium subscription
          </span>
        )}
      </div>

      {/* AI Response Processing */}
      <div className="rounded-lg border border-border/50 bg-card p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              AI Response Processing
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automatically classify inbound responses and log feedback on records.
            </p>
          </div>
          <Switch checked={aiProcessing} onCheckedChange={setAiProcessing} />
        </div>

        {aiProcessing && (
          <div className="space-y-3 pl-6 border-l-2 border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Auto-classify responses</p>
                <p className="text-[11px] text-muted-foreground">
                  AI detects intent: interested, meeting request, opt-out, etc.
                </p>
              </div>
              <Switch checked={autoClassify} onCheckedChange={setAutoClassify} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Auto-log feedback to records</p>
                <p className="text-[11px] text-muted-foreground">
                  AI analysis is saved as a note on the candidate/contact record.
                </p>
              </div>
              <Switch checked={autoLogFeedback} onCheckedChange={setAutoLogFeedback} />
            </div>
          </div>
        )}
      </div>

      {/* AI Agent Behavior */}
      <PremiumGate feature="AI Agent automation">
        <div className="rounded-lg border border-border/50 bg-card p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              AI Agent Behavior
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure how the AI agent handles responses autonomously.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">AI acknowledges responses</p>
                <p className="text-[11px] text-muted-foreground">
                  AI sends an acknowledgment when a target replies.
                </p>
              </div>
              <Switch checked={aiAcknowledge} onCheckedChange={setAiAcknowledge} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">AI sends booking confirmations</p>
                <p className="text-[11px] text-muted-foreground">
                  AI sends calendar confirmation after scheduling.
                </p>
              </div>
              <Switch checked={aiSendConfirmations} onCheckedChange={setAiSendConfirmations} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Require human approval</p>
                <p className="text-[11px] text-muted-foreground">
                  All AI-initiated actions need your approval before execution.
                </p>
              </div>
              <Switch checked={requireApproval} onCheckedChange={setRequireApproval} />
            </div>
          </div>
        </div>
      </PremiumGate>

      {/* Calendar Auto-Scheduling */}
      <PremiumGate feature="calendar auto-scheduling">
        <div className="rounded-lg border border-border/50 bg-card p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-primary" />
              Calendar Auto-Scheduling
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              When AI detects a meeting or callback request, automatically create calendar events.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Auto-schedule meetings</p>
                <p className="text-[11px] text-muted-foreground">
                  AI books meetings when targets request one.
                </p>
              </div>
              <Switch checked={autoScheduleMeetings} onCheckedChange={setAutoScheduleMeetings} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Auto-schedule callbacks</p>
                <p className="text-[11px] text-muted-foreground">
                  AI schedules call-backs when requested by targets.
                </p>
              </div>
              <Switch checked={autoScheduleCallbacks} onCheckedChange={setAutoScheduleCallbacks} />
            </div>
          </div>

          {(autoScheduleMeetings || autoScheduleCallbacks) && (
            <div className="space-y-3 pt-2 border-t border-border/40">
              <div className="space-y-1.5">
                <Label className="text-xs">Preferred Calendar</Label>
                <Select value={calendarId || "none"} onValueChange={(v) => setCalendarId(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select calendar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not connected</SelectItem>
                    {calendars.map((cal) => (
                      <SelectItem key={cal.id} value={cal.id}>
                        {cal.provider_account_email || cal.provider} ({cal.provider})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {calendars.length === 0 && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400">
                    No calendars connected. Go to workspace settings to connect Google or Microsoft calendar.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Buffer (min)</Label>
                  <Input
                    className="h-7 text-xs"
                    type="number"
                    value={meetingBuffer}
                    onChange={(e) => setMeetingBuffer(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Duration (min)</Label>
                  <Input
                    className="h-7 text-xs"
                    type="number"
                    value={meetingDuration}
                    onChange={(e) => setMeetingDuration(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Window (days)</Label>
                  <Input
                    className="h-7 text-xs"
                    type="number"
                    value={schedulingWindow}
                    onChange={(e) => setSchedulingWindow(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </PremiumGate>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending} size="sm">
          {isPending ? "Saving…" : "Save Automation Settings"}
        </Button>
      </div>
    </div>
  );
}
