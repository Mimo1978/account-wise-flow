import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CalendarIcon,
  Clock,
  Plus,
  Video,
  Phone,
  MapPin,
  Zap,
  User,
  Briefcase,
  Trash2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { format, addDays, setHours, setMinutes, startOfTomorrow, startOfDay, addWeeks, isBefore, isAfter, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useScheduledActions, useCancelScheduledAction, type ScheduledAction } from "@/hooks/use-outreach-automation";
import { useUpdateTargetState, type OutreachTarget } from "@/hooks/use-outreach";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Props {
  target: OutreachTarget;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const DURATION_OPTIONS = [
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
];

const MEETING_TYPES = [
  { value: "video", label: "Video Call", icon: Video },
  { value: "phone", label: "Phone Call", icon: Phone },
  { value: "in_person", label: "In Person", icon: MapPin },
];

const TIME_SLOTS = Array.from({ length: 20 }, (_, i) => {
  const h = Math.floor(i / 2) + 8; // 8:00 to 17:30
  const m = (i % 2) * 30;
  return {
    value: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    label: `${h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`,
  };
});

function getQuickSlots() {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = startOfTomorrow();
  const nextWeek = addWeeks(today, 1);

  const slots = [];

  // Today slots (only if before 4pm)
  if (now.getHours() < 16) {
    const nextHour = setMinutes(setHours(today, Math.max(now.getHours() + 1, 9)), 0);
    if (nextHour.getHours() < 18) {
      slots.push({
        label: `Today ${format(nextHour, "h:mm a")}`,
        date: nextHour,
        tag: "Today",
      });
    }
    const afternoon = setMinutes(setHours(today, 14), 0);
    if (isAfter(afternoon, now)) {
      slots.push({
        label: "Today 2:00 PM",
        date: afternoon,
        tag: "Today",
      });
    }
  }

  // Tomorrow slots
  slots.push({
    label: `Tomorrow 10:00 AM`,
    date: setMinutes(setHours(tomorrow, 10), 0),
    tag: "Tomorrow",
  });
  slots.push({
    label: `Tomorrow 2:00 PM`,
    date: setMinutes(setHours(tomorrow, 14), 0),
    tag: "Tomorrow",
  });

  // Day after tomorrow
  const dayAfter = addDays(today, 2);
  slots.push({
    label: `${format(dayAfter, "EEE")} 10:00 AM`,
    date: setMinutes(setHours(dayAfter, 10), 0),
    tag: format(dayAfter, "EEE"),
  });

  // Next week
  const nextMon = addDays(nextWeek, (8 - nextWeek.getDay()) % 7 || 7);
  slots.push({
    label: `Next ${format(nextMon, "EEE")} 10:00 AM`,
    date: setMinutes(setHours(nextMon, 10), 0),
    tag: "Next week",
  });

  return slots.slice(0, 5);
}

export function MeetingSchedulerModal({ target, open, onOpenChange }: Props) {
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  const { mutateAsync: updateState } = useUpdateTargetState();
  const { mutate: cancelAction } = useCancelScheduledAction();

  // Fetch existing meetings for this target
  const { data: allActions = [] } = useScheduledActions(
    (target.campaign as OutreachTarget["campaign"])?.id
  );

  const targetMeetings = useMemo(
    () =>
      allActions.filter(
        (a) =>
          a.target_id === target.id &&
          a.action_type === "meeting" &&
          a.status !== "cancelled" &&
          isAfter(parseISO(a.scheduled_for), new Date())
      ),
    [allActions, target.id]
  );

  // Form state
  const [mode, setMode] = useState<"quick" | "custom">("quick");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState("10:00");
  const [duration, setDuration] = useState("30");
  const [meetingType, setMeetingType] = useState("video");
  const [title, setTitle] = useState(`Meeting with ${target.entity_name}`);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const quickSlots = useMemo(() => getQuickSlots(), []);

  const createMeeting = useMutation({
    mutationFn: async (scheduledFor: Date) => {
      const { data, error } = await db
        .from("outreach_scheduled_actions")
        .insert({
          workspace_id: currentWorkspace!.id,
          campaign_id: (target.campaign as OutreachTarget["campaign"])?.id || null,
          target_id: target.id,
          action_type: "meeting",
          scheduled_for: scheduledFor.toISOString(),
          status: "approved",
          requires_approval: false,
          meeting_title: title,
          meeting_duration_minutes: parseInt(duration),
          meeting_notes: notes || null,
        })
        .select()
        .single();
      if (error) throw error;

      // Also update target state to booked
      await updateState({
        targetId: target.id,
        state: "booked",
        eventType: "booked",
        metadata: {
          meeting_type: meetingType,
          scheduled_for: scheduledFor.toISOString(),
          duration_minutes: parseInt(duration),
          meeting_title: title,
        },
      });

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-actions"] });
      qc.invalidateQueries({ queryKey: ["outreach_targets"] });
      toast.success("Meeting scheduled successfully");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleQuickBook = (slot: { date: Date }) => {
    createMeeting.mutate(slot.date);
  };

  const handleCustomBook = () => {
    if (!selectedDate) {
      toast.error("Please select a date");
      return;
    }
    const [h, m] = selectedTime.split(":").map(Number);
    const dateTime = setMinutes(setHours(selectedDate, h), m);
    createMeeting.mutate(dateTime);
  };

  const isPending = createMeeting.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        {/* Header with target info */}
        <div className="bg-muted/30 border-b border-border/50 px-5 pt-5 pb-4">
          <DialogHeader className="mb-3">
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              Schedule Meeting
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background px-3 py-2.5">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{target.entity_name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {[target.entity_title, target.entity_company].filter(Boolean).join(" · ")}
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] capitalize shrink-0">
              {target.entity_type ?? "candidate"}
            </Badge>
          </div>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="px-5 py-4 space-y-4">
            {/* Existing upcoming meetings */}
            {targetMeetings.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Upcoming Meetings ({targetMeetings.length})
                </Label>
                <div className="space-y-1.5">
                  {targetMeetings.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">
                            {m.meeting_title || "Meeting"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(parseISO(m.scheduled_for), "EEE d MMM · h:mm a")}
                            {m.meeting_duration_minutes && ` · ${m.meeting_duration_minutes}min`}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => cancelAction(m.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Separator />
              </div>
            )}

            {/* Quick slots */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3 h-3" />
                  Quick Schedule
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={() => setMode(mode === "quick" ? "custom" : "quick")}
                >
                  {mode === "quick" ? "Custom date →" : "← Quick slots"}
                </Button>
              </div>

              {mode === "quick" ? (
                <div className="grid grid-cols-1 gap-1.5">
                  {quickSlots.map((slot, i) => (
                    <button
                      key={i}
                      disabled={isPending}
                      onClick={() => handleQuickBook(slot)}
                      className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg border border-border/50 bg-background hover:bg-accent hover:border-primary/30 transition-all text-left group disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                          <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{slot.label}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(slot.date, "EEEE, d MMMM yyyy")}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {slot.tag}
                      </Badge>
                    </button>
                  ))}
                </div>
              ) : (
                /* Custom date/time picker */
                <div className="space-y-3">
                  {/* Meeting title */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Meeting Title</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Meeting with..."
                      className="h-8 text-sm"
                    />
                  </div>

                  {/* Date picker */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal h-8 text-sm",
                            !selectedDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="w-3.5 h-3.5 mr-2" />
                          {selectedDate ? format(selectedDate, "EEE, d MMMM yyyy") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          disabled={(date) => isBefore(date, startOfDay(new Date()))}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Time + Duration row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Time</Label>
                      <Select value={selectedTime} onValueChange={setSelectedTime}>
                        <SelectTrigger className="h-8 text-sm">
                          <Clock className="w-3 h-3 mr-1.5 text-muted-foreground" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_SLOTS.map((ts) => (
                            <SelectItem key={ts.value} value={ts.value}>
                              {ts.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Duration</Label>
                      <Select value={duration} onValueChange={setDuration}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DURATION_OPTIONS.map((d) => (
                            <SelectItem key={d.value} value={d.value}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Meeting type */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Meeting Type</Label>
                    <div className="flex gap-1.5">
                      {MEETING_TYPES.map((mt) => (
                        <Button
                          key={mt.value}
                          variant={meetingType === mt.value ? "default" : "outline"}
                          size="sm"
                          className="flex-1 h-8 text-xs gap-1.5"
                          onClick={() => setMeetingType(mt.value)}
                        >
                          <mt.icon className="w-3 h-3" />
                          {mt.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Notes (optional)</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Agenda, talking points, location..."
                      rows={2}
                      className="text-sm min-h-[60px]"
                    />
                  </div>

                  {/* Book button */}
                  <Button
                    className="w-full gap-2"
                    onClick={handleCustomBook}
                    disabled={!selectedDate || isPending}
                  >
                    <Plus className="w-4 h-4" />
                    {isPending ? "Scheduling..." : "Schedule Meeting"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
