import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Calendar, 
  Clock, 
  Users, 
  Plus, 
  Check,
  ChevronRight,
  Download,
  Sparkles,
  Globe,
  X,
  Send
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ScheduleActionModalProps {
  email?: string;
  contactName: string;
  children: React.ReactNode;
  onOpenComposer?: (email: string, subject: string, body: string) => void;
}

type ModalView = "main" | "attendees" | "propose-times" | "ai-scheduler";

interface TimeSlot {
  id: string;
  date: string;
  time: string;
  label: string;
  confidence?: number;
}

const calendarOptions = [
  { id: "google", label: "Google Calendar", icon: Calendar, color: "#4285F4" },
  { id: "outlook", label: "Outlook / Microsoft 365", icon: Calendar, color: "#0078D4" },
  { id: "apple", label: "Apple Calendar", icon: Calendar, color: "#007AFF" },
  { id: "ics", label: "Download .ics file", icon: Download, color: "#6B7280" },
];

const suggestedTimes: TimeSlot[] = [
  { id: "1", date: "Tomorrow", time: "10:00 AM", label: "Morning slot", confidence: 95 },
  { id: "2", date: "Tomorrow", time: "2:00 PM", label: "Afternoon slot", confidence: 87 },
  { id: "3", date: "Thursday", time: "11:00 AM", label: "Mid-morning", confidence: 82 },
];

const generateICSContent = (title: string, attendees: string[], date: Date, duration: number = 60) => {
  const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const endDate = new Date(date.getTime() + duration * 60000);
  
  return `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${formatDate(date)}
DTEND:${formatDate(endDate)}
SUMMARY:${title}
${attendees.map(a => `ATTENDEE:mailto:${a}`).join('\n')}
END:VEVENT
END:VCALENDAR`;
};

export const ScheduleActionModal = ({ 
  email, 
  contactName, 
  children,
  onOpenComposer 
}: ScheduleActionModalProps) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ModalView>("main");
  const [attendees, setAttendees] = useState<string[]>(email ? [email] : []);
  const [ccList, setCcList] = useState<string[]>([]);
  const [newAttendee, setNewAttendee] = useState("");
  const [newCc, setNewCc] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<TimeSlot[] | null>(null);

  const handleOpenCalendar = (calendarType: string) => {
    const meetingTitle = `Meeting with ${contactName}`;
    const attendeeEmails = attendees.join(',');
    
    switch (calendarType) {
      case "google":
        window.open(
          `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(meetingTitle)}&add=${encodeURIComponent(attendeeEmails)}`,
          "_blank"
        );
        break;
      case "outlook":
        window.open(
          `https://outlook.office.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(meetingTitle)}&to=${encodeURIComponent(attendeeEmails)}`,
          "_blank"
        );
        break;
      case "apple":
        // Apple Calendar uses webcal protocol or .ics
        const icsContent = generateICSContent(meetingTitle, attendees, new Date());
        const blob = new Blob([icsContent], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meeting-${contactName.replace(/\s+/g, '-')}.ics`;
        a.click();
        URL.revokeObjectURL(url);
        break;
      case "ics":
        const icsFile = generateICSContent(meetingTitle, attendees, new Date());
        const fileBlob = new Blob([icsFile], { type: 'text/calendar' });
        const fileUrl = URL.createObjectURL(fileBlob);
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = `meeting-${contactName.replace(/\s+/g, '-')}.ics`;
        link.click();
        URL.revokeObjectURL(fileUrl);
        toast.success("Calendar file downloaded");
        break;
    }
    setOpen(false);
  };

  const handleAddAttendee = () => {
    if (newAttendee && newAttendee.includes("@")) {
      setAttendees([...attendees, newAttendee]);
      setNewAttendee("");
    }
  };

  const handleAddCc = () => {
    if (newCc && newCc.includes("@")) {
      setCcList([...ccList, newCc]);
      setNewCc("");
    }
  };

  const handleRemoveAttendee = (emailToRemove: string) => {
    setAttendees(attendees.filter(e => e !== emailToRemove));
  };

  const handleRemoveCc = (emailToRemove: string) => {
    setCcList(ccList.filter(e => e !== emailToRemove));
  };

  const handleToggleSlot = (slotId: string) => {
    if (selectedSlots.includes(slotId)) {
      setSelectedSlots(selectedSlots.filter(id => id !== slotId));
    } else if (selectedSlots.length < 3) {
      setSelectedSlots([...selectedSlots, slotId]);
    } else {
      toast.error("Maximum 3 time slots allowed");
    }
  };

  const handleProposeTimes = () => {
    if (selectedSlots.length === 0) {
      toast.error("Please select at least one time slot");
      return;
    }
    
    const selectedTimesText = selectedSlots
      .map(id => {
        const slot = suggestedTimes.find(s => s.id === id);
        return slot ? `• ${slot.date} at ${slot.time}` : "";
      })
      .join("\n");
    
    const subject = `Meeting Request: ${contactName}`;
    const body = `Hi ${contactName.split(" ")[0]},\n\nI'd like to schedule a meeting with you. Here are some times that work for me:\n\n${selectedTimesText}\n\nPlease let me know which works best for you, or suggest an alternative.\n\nBest regards`;
    
    if (onOpenComposer && email) {
      onOpenComposer(email, subject, body);
    } else {
      toast.success("Meeting invite draft created", {
        description: "Opening email composer..."
      });
    }
    setOpen(false);
  };

  const handleAiScheduler = async () => {
    setIsAiAnalyzing(true);
    
    // Simulate AI analysis
    setTimeout(() => {
      setAiSuggestions([
        { id: "ai-1", date: "Tomorrow", time: "10:30 AM", label: "Best Match", confidence: 98 },
        { id: "ai-2", date: "Wednesday", time: "3:00 PM", label: "Backup Option 1", confidence: 89 },
        { id: "ai-3", date: "Friday", time: "9:00 AM", label: "Backup Option 2", confidence: 84 },
      ]);
      setIsAiAnalyzing(false);
    }, 1500);
  };

  const handleAcceptAiSuggestion = (slot: TimeSlot) => {
    toast.success(`Meeting scheduled for ${slot.date} at ${slot.time}`, {
      description: "Calendar invite will be sent to all attendees"
    });
    setOpen(false);
  };

  const handleBack = () => {
    if (view === "main") return;
    setView("main");
    setAiSuggestions(null);
  };

  const renderMainView = () => (
    <div className="space-y-1">
      {/* Calendar Options */}
      <p className="text-xs text-muted-foreground px-3 py-1">Open Calendar</p>
      {calendarOptions.map((cal) => (
        <button
          key={cal.id}
          onClick={() => handleOpenCalendar(cal.id)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent transition-colors"
        >
          <span className="p-1.5 rounded-full" style={{ backgroundColor: `${cal.color}15` }}>
            <cal.icon className="w-4 h-4" style={{ color: cal.color }} />
          </span>
          <span className="text-sm">{cal.label}</span>
        </button>
      ))}

      <div className="h-px bg-border my-2" />

      {/* Advanced Options */}
      <p className="text-xs text-muted-foreground px-3 py-1">Advanced</p>
      
      <button
        onClick={() => setView("attendees")}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-accent transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="p-1.5 rounded-full bg-primary/10">
            <Users className="w-4 h-4 text-primary" />
          </span>
          <div className="text-left">
            <span className="text-sm">Manage Attendees</span>
            <p className="text-xs text-muted-foreground">{attendees.length} attendee(s)</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>

      <button
        onClick={() => setView("propose-times")}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-accent transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="p-1.5 rounded-full bg-primary/10">
            <Clock className="w-4 h-4 text-primary" />
          </span>
          <div className="text-left">
            <span className="text-sm">Propose Times</span>
            <p className="text-xs text-muted-foreground">Select 2-3 slots</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>

      <button
        onClick={() => { setView("ai-scheduler"); handleAiScheduler(); }}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-accent transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="p-1.5 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20">
            <Sparkles className="w-4 h-4 text-primary" />
          </span>
          <div className="text-left">
            <span className="text-sm">AI Auto-Scheduler</span>
            <p className="text-xs text-muted-foreground">Find optimal times</p>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs">Recommended</Badge>
      </button>
    </div>
  );

  const renderAttendeesView = () => (
    <div className="space-y-3">
      {/* Contact (Primary) */}
      <div>
        <p className="text-xs text-muted-foreground px-1 mb-2">Primary Contact</p>
        {email && (
          <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 rounded-md">
            <Badge variant="outline" className="text-xs">{contactName}</Badge>
            <span className="text-xs text-muted-foreground truncate">{email}</span>
          </div>
        )}
      </div>

      {/* Attendees */}
      <div>
        <p className="text-xs text-muted-foreground px-1 mb-2">Additional Attendees</p>
        <div className="space-y-1">
          {attendees.filter(a => a !== email).map((att, idx) => (
            <div key={idx} className="flex items-center justify-between px-2 py-1.5 bg-muted/30 rounded-md">
              <span className="text-sm truncate">{att}</span>
              <button onClick={() => handleRemoveAttendee(att)} className="text-muted-foreground hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              placeholder="Add attendee email"
              value={newAttendee}
              onChange={(e) => setNewAttendee(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddAttendee()}
              className="h-8 text-sm"
            />
            <Button size="sm" variant="outline" onClick={handleAddAttendee} className="h-8 px-2">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* CC List */}
      <div>
        <p className="text-xs text-muted-foreground px-1 mb-2">CC (Assistants)</p>
        <div className="space-y-1">
          {ccList.map((cc, idx) => (
            <div key={idx} className="flex items-center justify-between px-2 py-1.5 bg-muted/30 rounded-md">
              <span className="text-sm truncate">{cc}</span>
              <button onClick={() => handleRemoveCc(cc)} className="text-muted-foreground hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              placeholder="CC email"
              value={newCc}
              onChange={(e) => setNewCc(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCc()}
              className="h-8 text-sm"
            />
            <Button size="sm" variant="outline" onClick={handleAddCc} className="h-8 px-2">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <Button onClick={() => setView("main")} className="w-full mt-2" size="sm">
        <Check className="w-4 h-4 mr-2" />
        Done
      </Button>
    </div>
  );

  const renderProposeTimesView = () => (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground px-1">Select 2-3 available time slots</p>
      
      <div className="space-y-1">
        {suggestedTimes.map((slot) => (
          <button
            key={slot.id}
            onClick={() => handleToggleSlot(slot.id)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5 rounded-md transition-colors",
              selectedSlots.includes(slot.id) 
                ? "bg-primary/10 border border-primary/30" 
                : "hover:bg-accent border border-transparent"
            )}
          >
            <div className="flex items-center gap-3">
              <span className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                selectedSlots.includes(slot.id) 
                  ? "border-primary bg-primary" 
                  : "border-muted-foreground"
              )}>
                {selectedSlots.includes(slot.id) && <Check className="w-3 h-3 text-primary-foreground" />}
              </span>
              <div className="text-left">
                <p className="text-sm font-medium">{slot.date} at {slot.time}</p>
                <p className="text-xs text-muted-foreground">{slot.label}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <Button onClick={handleProposeTimes} className="w-full" size="sm" disabled={selectedSlots.length === 0}>
        <Send className="w-4 h-4 mr-2" />
        Create Meeting Invite
      </Button>
    </div>
  );

  const renderAiSchedulerView = () => (
    <div className="space-y-3">
      {isAiAnalyzing ? (
        <div className="py-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Analyzing calendars...</p>
          <p className="text-xs text-muted-foreground mt-1">Checking availability & time zones</p>
        </div>
      ) : aiSuggestions ? (
        <>
          <div className="flex items-center gap-2 px-1">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">AI-optimized for both parties</p>
          </div>
          
          <div className="space-y-1">
            {aiSuggestions.map((slot, idx) => (
              <button
                key={slot.id}
                onClick={() => handleAcceptAiSuggestion(slot)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-3 rounded-md transition-colors border",
                  idx === 0 
                    ? "bg-primary/5 border-primary/30 hover:bg-primary/10" 
                    : "hover:bg-accent border-transparent"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "p-1.5 rounded-full",
                    idx === 0 ? "bg-primary/20" : "bg-muted"
                  )}>
                    {idx === 0 ? (
                      <Sparkles className="w-4 h-4 text-primary" />
                    ) : (
                      <Clock className="w-4 h-4 text-muted-foreground" />
                    )}
                  </span>
                  <div className="text-left">
                    <p className="text-sm font-medium">{slot.date} at {slot.time}</p>
                    <p className="text-xs text-muted-foreground">{slot.label}</p>
                  </div>
                </div>
                <Badge variant={idx === 0 ? "default" : "secondary"} className="text-xs">
                  {slot.confidence}% match
                </Badge>
              </button>
            ))}
          </div>
          
          <p className="text-xs text-muted-foreground text-center px-2">
            Click a time to schedule instantly
          </p>
        </>
      ) : null}
    </div>
  );

  const getHeaderTitle = () => {
    switch (view) {
      case "attendees": return "Manage Attendees";
      case "propose-times": return "Propose Times";
      case "ai-scheduler": return "AI Auto-Scheduler";
      default: return `Schedule with ${contactName}`;
    }
  };

  return (
    <Popover open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) {
        setView("main");
        setAiSuggestions(null);
        setSelectedSlots([]);
      }
    }}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent 
        align="start" 
        className="w-80 p-0 z-[10000] bg-popover border border-border shadow-lg overflow-hidden"
        sideOffset={8}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <p className="text-sm font-medium">{getHeaderTitle()}</p>
          {view !== "main" && (
            <button 
              onClick={handleBack}
              className="text-xs text-primary hover:underline mt-1"
            >
              ← Back to options
            </button>
          )}
        </div>

        <div className="p-2 max-h-[400px] overflow-y-auto">
          {view === "main" && renderMainView()}
          {view === "attendees" && renderAttendeesView()}
          {view === "propose-times" && renderProposeTimesView()}
          {view === "ai-scheduler" && renderAiSchedulerView()}
        </div>
      </PopoverContent>
    </Popover>
  );
};
