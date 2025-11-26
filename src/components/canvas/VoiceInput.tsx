import { useState, useRef, useEffect } from "react";
import { Mic, Square, Loader2, ChevronDown, Users, Phone, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface VoiceInputProps {
  onTranscriptComplete: (transcript: string, noteType: string) => void;
}

type NoteType = "meeting" | "call" | "reminder";

const noteTypeConfig: Record<NoteType, { label: string; title: string; description: string; icon: React.ReactNode }> = {
  meeting: {
    label: "Meeting Notes",
    title: "Add Meeting Notes",
    description: "Record notes from your meeting with this contact",
    icon: <Users className="w-4 h-4 mr-2" />,
  },
  call: {
    label: "Call Notes",
    title: "Add Call Notes",
    description: "Record notes from your phone call with this contact",
    icon: <Phone className="w-4 h-4 mr-2" />,
  },
  reminder: {
    label: "Reminder",
    title: "Add Voice Reminder",
    description: "Record a reminder for follow-up actions",
    icon: <Bell className="w-4 h-4 mr-2" />,
  },
};

export const VoiceInput = ({ onTranscriptComplete }: VoiceInputProps) => {
  const [open, setOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedNoteType, setSelectedNoteType] = useState<NoteType>("meeting");
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check if browser supports speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = "";
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPiece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptPiece + " ";
          }
        }
        
        if (finalTranscript) {
          setTranscript(prev => prev + finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        toast.error("Voice recording error");
        setIsRecording(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleNoteTypeSelect = (type: NoteType) => {
    setSelectedNoteType(type);
    setOpen(true);
  };

  const startRecording = () => {
    if (!recognitionRef.current) {
      toast.error("Voice recording not supported in this browser");
      return;
    }

    setTranscript("");
    setIsRecording(true);
    recognitionRef.current.start();
    toast.success("Recording started");
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
    toast.success("Recording stopped");
  };

  const handleSave = () => {
    if (transcript.trim()) {
      onTranscriptComplete(transcript, selectedNoteType);
      setOpen(false);
      setTranscript("");
      toast.success(`${noteTypeConfig[selectedNoteType].label} added`);
    }
  };

  const config = noteTypeConfig[selectedNoteType];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Mic className="w-4 h-4" />
            Voice Note
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="z-[10000] bg-popover border border-border shadow-lg">
          <DropdownMenuItem onClick={() => handleNoteTypeSelect("meeting")}>
            <Users className="w-4 h-4 mr-2" />
            Meeting Notes
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleNoteTypeSelect("call")}>
            <Phone className="w-4 h-4 mr-2" />
            Call Notes
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleNoteTypeSelect("reminder")}>
            <Bell className="w-4 h-4 mr-2" />
            Reminder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={(newOpen) => {
        if (!newOpen && isRecording) {
          stopRecording();
        }
        setOpen(newOpen);
      }}>
        <DialogContent className="z-[10001]">
          <DialogHeader>
            <DialogTitle>{config.title}</DialogTitle>
            <DialogDescription>
              {config.description}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex justify-center">
              {!isRecording ? (
                <Button
                  onClick={startRecording}
                  size="lg"
                  className="gap-2 h-20 w-20 rounded-full"
                >
                  <Mic className="w-6 h-6" />
                </Button>
              ) : (
                <Button
                  onClick={stopRecording}
                  size="lg"
                  variant="destructive"
                  className="gap-2 h-20 w-20 rounded-full animate-pulse"
                >
                  <Square className="w-6 h-6" />
                </Button>
              )}
            </div>

            {isRecording && (
              <p className="text-center text-sm text-muted-foreground animate-pulse">
                Recording... speak now
              </p>
            )}

            {transcript && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Transcript (editable)</label>
                <Textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Your voice note will appear here..."
                  className="min-h-[120px]"
                />
                <Button onClick={handleSave} className="w-full">
                  Save {config.label}
                </Button>
              </div>
            )}

            {!recognitionRef.current && (
              <p className="text-xs text-center text-muted-foreground">
                Voice recording not supported in this browser. Try Chrome or Edge.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};