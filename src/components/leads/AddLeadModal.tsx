import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, Mic, MicOff, Sparkles, X } from "lucide-react";

interface AddLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

const SOURCES = ["LinkedIn (manual)", "Phone referral", "Email", "Other"];
const INTENTS = ["Client brief", "Candidate application", "Unknown"];

const INTENT_MAP: Record<string, string | null> = {
  "Client brief": "client_brief",
  "Candidate application": "candidate_application",
  "Unknown": null,
};

export default function AddLeadModal({ open, onOpenChange, onCreated }: AddLeadModalProps) {
  const { currentWorkspace } = useWorkspace();
  const [submitting, setSubmitting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState(SOURCES[0]);
  const [intent, setIntent] = useState(INTENTS[2]);
  const [message, setMessage] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const reset = () => {
    setName(""); setCompany(""); setEmail(""); setPhone("");
    setSource(SOURCES[0]); setIntent(INTENTS[2]); setMessage("");
    setImagePreview(null);
  };

  // Stop dictation when modal closes
  useEffect(() => {
    if (!open && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      setListening(false);
    }
  }, [open]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image too large (max 8MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      setExtracting(true);
      try {
        const { data, error } = await supabase.functions.invoke("extract-lead-from-image", {
          body: { imageBase64: base64 },
        });
        if (error) throw error;
        const extracted = data?.data || {};
        if (extracted.name) setName(extracted.name);
        if (extracted.company) setCompany(extracted.company);
        if (extracted.email) setEmail(extracted.email);
        if (extracted.phone) setPhone(extracted.phone);
        if (extracted.source && SOURCES.includes(extracted.source)) setSource(extracted.source);
        if (extracted.ai_intent && INTENTS.includes(extracted.ai_intent)) setIntent(extracted.ai_intent);
        if (extracted.message) setMessage(extracted.message);
        toast.success("Lead details extracted from screenshot");
      } catch (err: any) {
        toast.error(`Could not read screenshot: ${err.message || err}`);
      } finally {
        setExtracting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleDictation = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice dictation not supported in this browser. Try Chrome.");
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalText = message ? message + " " : "";

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += transcript + " ";
        else interim += transcript;
      }
      if (final) finalText += final;
      setMessage(finalText + interim);
    };

    recognition.onerror = (e: any) => {
      toast.error(`Mic error: ${e.error}`);
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
    toast.info("Listening… speak the lead details");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!currentWorkspace?.id) {
      toast.error("No workspace selected");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("leads" as any).insert({
      sender_name: name.trim(),
      title: company.trim() || null,
      sender_email: email.trim() || null,
      sender_phone: phone.trim() || null,
      source_channel: source,
      ai_intent: INTENT_MAP[intent],
      message: message.trim() || null,
      status: "new",
      workspace_id: currentWorkspace.id,
      created_at: new Date().toISOString(),
    } as any);
    setSubmitting(false);

    if (error) {
      toast.error(`Failed to add lead: ${error.message}`);
      return;
    }

    toast.success("Lead added");
    reset();
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a lead</DialogTitle>
        </DialogHeader>

        {/* AI helpers */}
        <div className="flex flex-col gap-2 rounded-md border border-dashed border-border bg-muted/30 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Save time — let AI fill the form
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
              disabled={extracting || submitting}
            >
              {extracting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {extracting ? "Reading…" : "Upload screenshot"}
            </Button>
            <Button
              type="button"
              variant={listening ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={toggleDictation}
              disabled={submitting}
            >
              {listening ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
              {listening ? "Stop" : "Dictate"}
            </Button>
          </div>
          {imagePreview && (
            <div className="relative mt-1">
              <img src={imagePreview} alt="Lead screenshot" className="w-full max-h-32 object-contain rounded border border-border" />
              <button
                type="button"
                onClick={() => setImagePreview(null)}
                className="absolute top-1 right-1 bg-background/80 rounded-full p-1 hover:bg-background"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="lead-name">Name <span className="text-destructive">*</span></Label>
            <Input id="lead-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lead-company">Company</Label>
              <Input id="lead-company" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-phone">Phone</Label>
              <Input id="lead-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-email">Email</Label>
            <Input id="lead-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Intent</Label>
              <Select value={intent} onValueChange={setIntent}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTENTS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-message">Their message or your notes</Label>
            <Textarea id="lead-message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || extracting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
