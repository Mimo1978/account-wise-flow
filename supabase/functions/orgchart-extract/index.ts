import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PhoneEntry {
  number: string;
  type: "work" | "mobile" | "desk" | "home" | "other";
  confidence: "high" | "medium" | "low";
}

interface ExtractedPerson {
  full_name: string;
  job_title: string;
  department: string;
  location: string;
  company: string;
  email?: string;
  email_confidence?: "high" | "medium" | "low";
  phones?: PhoneEntry[];
  confidence: "high" | "medium" | "low";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType, rawText, extractionType } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let prompt: string;
    let messages: any[];

    if (extractionType === "ocr") {
      // OCR + AI extraction from image
      prompt = `You are an expert at extracting organizational information from images.

Analyze this image which may be an org chart, business card, screenshot, or document containing people and their roles.

Extract each person you can identify with the following fields:
- full_name: The person's full name
- job_title: Their job title or role
- department: The department they work in (if visible or inferable)
- location: Their location (city, office, etc.) if present
- company: The company name if visible
- email: Their email address if visible
- email_confidence: Confidence in the email extraction ("high", "medium", or "low")
- phones: Array of phone numbers if visible, each with:
  - number: The phone number (normalize to include country code if possible, e.g., +44 7xxx or +1 xxx)
  - type: One of "work", "mobile", "desk", "home", or "other"
  - confidence: Confidence in this phone extraction ("high", "medium", or "low")

Phone normalization rules:
- Strip spaces, parentheses, dashes for storage
- UK numbers starting with 07 should become +447
- Add country code if inferable from context

For each person, also assign an overall confidence level:
- "high": Name and title are clearly visible
- "medium": Name is clear but title is partially visible or inferred
- "low": Information is unclear or heavily inferred

Return a JSON object with this exact structure:
{
  "ocrText": "The raw text extracted from the image",
  "people": [
    {
      "full_name": "...",
      "job_title": "...",
      "department": "...",
      "location": "...",
      "company": "...",
      "email": "...",
      "email_confidence": "high" | "medium" | "low",
      "phones": [
        { "number": "+447...", "type": "mobile", "confidence": "high" }
      ],
      "confidence": "high" | "medium" | "low"
    }
  ]
}

Return ONLY the JSON, no additional text.`;

      messages = [
        { role: "system", content: prompt },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
            {
              type: "text",
              text: "Extract all people and their organizational information from this image.",
            },
          ],
        },
      ];
    } else {
      // Text-based extraction (paste/CSV that needs AI help)
      prompt = `You are an expert at parsing organizational data from text.

Parse the following text which contains information about people in an organization. The text may be:
- A pasted list with names and titles
- A bulleted list
- Unstructured text mentioning people and roles
- CSV-like data

Extract each person you can identify with the following fields:
- full_name: The person's full name
- job_title: Their job title or role
- department: The department they work in (if mentioned or inferable)
- location: Their location (city, office, etc.) if present
- company: The company name if visible
- email: Their email address if present
- email_confidence: Confidence in the email extraction ("high", "medium", or "low")
- phones: Array of phone numbers if present, each with:
  - number: The phone number (normalize to include country code, e.g., +44 7xxx or +1 xxx)
  - type: One of "work", "mobile", "desk", "home", or "other"
  - confidence: Confidence in this phone extraction ("high", "medium", or "low")

Phone normalization rules:
- Strip spaces, parentheses, dashes for storage
- UK numbers starting with 07 should become +447
- Add country code if inferable from context

For each person, also assign a confidence level:
- "high": Name and title are clearly stated
- "medium": Name is clear but title is partially clear or inferred
- "low": Information is unclear or heavily inferred

Return a JSON object with this exact structure:
{
  "people": [
    {
      "full_name": "...",
      "job_title": "...",
      "department": "...",
      "location": "...",
      "company": "...",
      "email": "...",
      "email_confidence": "high" | "medium" | "low",
      "phones": [
        { "number": "+447...", "type": "mobile", "confidence": "high" }
      ],
      "confidence": "high" | "medium" | "low"
    }
  ]
}

Return ONLY the JSON, no additional text.`;

      messages = [
        { role: "system", content: prompt },
        {
          role: "user",
          content: `Parse the following text and extract people information:\n\n${rawText}`,
        },
      ];
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          temperature: 0.1,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse the JSON response
    let result;
    try {
      // Handle potential markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1]?.trim() || content.trim();
      result = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI response as JSON");
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("orgchart-extract error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
