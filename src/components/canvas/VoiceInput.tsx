import { useState, useRef, useEffect } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface VoiceInputProps {
  onTranscriptComplete: (transcript: string) => void;
}

export const VoiceInput = ({ onTranscriptComplete }: VoiceInputProps) => {
  const [open, setOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
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
      onTranscriptComplete(transcript);
      setOpen(false);
      setTranscript("");
      toast.success("Voice note added");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen && isRecording) {
        stopRecording();
      }
      setOpen(newOpen);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Mic className="w-4 h-4" />
          Voice Note
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Voice Note</DialogTitle>
          <DialogDescription>
            Record voice notes, updates, or action items for this contact
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
                Save Note
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
  );
};
