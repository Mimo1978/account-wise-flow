import { useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useVoiceDictation() {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const stopTimer = () => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
  };

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setElapsed(0);
      const startedAt = Date.now();
      timerRef.current = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 250);
    } catch (err: any) {
      throw new Error(err?.message || "Microphone permission denied");
    }
  }, []);

  const stopAndTranscribe = useCallback(async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const mr = mediaRecorderRef.current;
      if (!mr) return reject(new Error("Not recording"));
      mr.onstop = async () => {
        stopTimer();
        streamRef.current?.getTracks().forEach(t => t.stop());
        setRecording(false);
        setTranscribing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const arrayBuf = await blob.arrayBuffer();
          // Convert to base64 in chunks to avoid stack overflow
          const bytes = new Uint8Array(arrayBuf);
          let binary = "";
          const CHUNK = 0x8000;
          for (let i = 0; i < bytes.length; i += CHUNK) {
            binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as any);
          }
          const b64 = btoa(binary);
          const { data, error } = await supabase.functions.invoke("transcribe-call-brief", {
            body: { audio_base64: b64, mime_type: "audio/webm" },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data?.message || "Transcription failed");
          resolve(data?.text || "");
        } catch (e: any) {
          reject(e);
        } finally {
          setTranscribing(false);
        }
      };
      mr.stop();
    });
  }, []);

  const cancel = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    stopTimer();
    streamRef.current?.getTracks().forEach(t => t.stop());
    chunksRef.current = [];
    setRecording(false);
    setTranscribing(false);
  }, []);

  return { recording, transcribing, elapsed, start, stopAndTranscribe, cancel };
}