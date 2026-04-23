import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(
        JSON.stringify({ error: "missing_key", message: "Lovable AI key not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { audio_base64, mime_type } = await req.json();
    if (!audio_base64) throw new Error("audio_base64 required");

    const audioMime = mime_type || "audio/webm";

    // Use Lovable AI Gateway with Gemini multimodal for transcription
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a precise speech-to-text transcriber. Output ONLY the verbatim spoken text in plain language. Do not add commentary, quotation marks, timestamps, speaker labels, or any formatting. If the audio is silent or unintelligible, output nothing.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe this audio into plain text:" },
              {
                type: "input_audio",
                input_audio: { data: audio_base64, format: audioMime.includes("mp3") ? "mp3" : "webm" },
              },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Lovable AI transcription error", resp.status, errText);
      if (resp.status === 429) {
        return new Response(
          JSON.stringify({ error: "rate_limit", message: "Too many requests — try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (resp.status === 402) {
        return new Response(
          JSON.stringify({ error: "credits_exhausted", message: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "transcription_failed", message: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || "";
    return new Response(
      JSON.stringify({ text }),
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