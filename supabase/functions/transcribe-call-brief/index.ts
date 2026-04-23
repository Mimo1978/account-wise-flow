import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "missing_key", message: "ElevenLabs API key not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { audio_base64, mime_type } = await req.json();
    if (!audio_base64) throw new Error("audio_base64 required");

    // Decode base64 to bytes
    const binary = Uint8Array.from(atob(audio_base64), c => c.charCodeAt(0));
    const blob = new Blob([binary], { type: mime_type || "audio/webm" });

    const formData = new FormData();
    formData.append("file", blob, "recording.webm");
    formData.append("model_id", "scribe_v2");
    formData.append("language_code", "eng");

    const resp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: formData,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("ElevenLabs error", resp.status, errText);
      return new Response(
        JSON.stringify({ error: "transcription_failed", message: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await resp.json();
    return new Response(
      JSON.stringify({ text: data.text || "" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("transcribe-call-brief error", e);
    return new Response(
      JSON.stringify({ error: "unknown", message: e instanceof Error ? e.message : "Failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});