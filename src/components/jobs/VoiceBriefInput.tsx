import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

interface VoiceBriefInputProps {
  onTranscript: (text: string) => void;
}

export function VoiceBriefInput({ onTranscript }: VoiceBriefInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const startRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition not supported in this browser. Try Chrome.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-GB';

    let finalTranscript = '';

    recognition.onresult = (event: any) => {
      // Reset silence timer on each result
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      // Auto-stop after 3 seconds of silence
      silenceTimerRef.current = setTimeout(() => {
        recognition.stop();
      }, 3000);
    };

    recognition.onend = () => {
      setIsRecording(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (finalTranscript.trim()) {
        onTranscript(finalTranscript.trim());
        toast.success('Voice captured — review and edit below');
      }
    };

    recognition.onerror = (event: any) => {
      setIsRecording(false);
      if (event.error !== 'aborted') {
        toast.error(`Speech recognition error: ${event.error}`);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [onTranscript]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  }, []);

  return (
    <Button
      type="button"
      variant={isRecording ? 'destructive' : 'outline'}
      size="sm"
      onClick={isRecording ? stopRecording : startRecording}
      className="gap-1.5"
    >
      {isRecording ? (
        <>
          <MicOff className="w-3.5 h-3.5" />
          <span className="animate-pulse">Recording…</span>
        </>
      ) : (
        <>
          <Mic className="w-3.5 h-3.5" />
          Speak your brief
        </>
      )}
    </Button>
  );
}
