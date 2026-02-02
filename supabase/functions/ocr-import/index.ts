import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ExtractedRow {
  fields: Record<string, string>;
  confidence: "high" | "medium" | "low";
  rawText?: string;
}

interface OCRResponse {
  success: boolean;
  rows: ExtractedRow[];
  headers: string[];
  totalRows: number;
  warnings?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { image, entityType, mimeType } = await req.json();

    if (!image) {
      return new Response(
        JSON.stringify({ error: "No image data provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build the prompt based on entity type
    const entityPrompts: Record<string, string> = {
      companies: `Extract company/organization data from this image. Look for:
- Company Name (required)
- Headquarters/Location
- Phone/Switchboard
- Industry/Sector
- Regions/Countries
- Status (Active/Warm/Cooling)
- Owner/Manager
- Notes/Description`,
      contacts: `Extract contact/person data from this image. Look for:
- Name (required)
- Email
- Phone
- Company
- Job Title
- Department
- Seniority Level
- Notes`,
      talent: `Extract candidate/talent data from this image. Look for:
- Name (required)
- Email
- Phone
- Location
- Role/Title
- Seniority
- Skills (comma-separated)
- Availability
- Rate/Salary
- LinkedIn URL
- Notes`,
    };

    const entityFields: Record<string, string[]> = {
      companies: ["name", "headquarters", "switchboard", "industry", "regions", "status", "owner", "notes"],
      contacts: ["name", "email", "phone", "company", "title", "department", "seniority", "notes"],
      talent: ["name", "email", "phone", "location", "roleType", "seniority", "skills", "availability", "rate", "linkedIn", "notes"],
    };

    const systemPrompt = `You are an OCR data extraction assistant. Your job is to extract structured data from images (screenshots, scanned documents, business cards, tables, etc.) and return it in a specific format.

RULES:
1. Extract ALL visible rows/entries from the image
2. Assign a confidence level to each row: "high" (clear text, all key fields visible), "medium" (some fields unclear or missing), "low" (mostly guessing or very poor quality)
3. If text is unclear, make your best guess but mark as low confidence
4. For tables, extract each row separately
5. For business cards, each card is one row
6. Skip completely unreadable content
7. Be conservative - only mark "high" confidence when you're very sure`;

    const userPrompt = `${entityPrompts[entityType] || entityPrompts.companies}

Return a JSON object with this exact structure:
{
  "rows": [
    {
      "fields": {
        // field_id: "extracted_value" for each field found
      },
      "confidence": "high" | "medium" | "low",
      "rawText": "original text snippet if helpful"
    }
  ],
  "headers": ["field_id1", "field_id2", ...], // list of field IDs that were found
  "totalRows": number,
  "warnings": ["any issues or notes about the extraction"]
}

Available fields: ${JSON.stringify(entityFields[entityType] || entityFields.companies)}

Extract all data visible in the image now.`;

    console.log(`[ocr-import] Processing ${entityType} extraction, mimeType: ${mimeType}`);

    // Call Lovable AI with vision capabilities
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType || "image/png"};base64,${image}`,
                },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

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
      console.error("[ocr-import] AI gateway error:", response.status, errorText);
      throw new Error("AI processing failed");
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    console.log("[ocr-import] AI response received:", content.substring(0, 200));

    // Parse the AI response
    let parsedResult: OCRResponse;
    try {
      parsedResult = JSON.parse(content);
    } catch (parseError) {
      console.error("[ocr-import] Failed to parse AI response:", parseError);
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse AI response");
      }
    }

    // Validate and normalize the response
    const result: OCRResponse = {
      success: true,
      rows: parsedResult.rows || [],
      headers: parsedResult.headers || entityFields[entityType] || [],
      totalRows: parsedResult.totalRows || parsedResult.rows?.length || 0,
      warnings: parsedResult.warnings || [],
    };

    // Add warnings for low confidence extractions
    const lowConfidenceCount = result.rows.filter(r => r.confidence === "low").length;
    if (lowConfidenceCount > 0) {
      result.warnings = result.warnings || [];
      result.warnings.push(`${lowConfidenceCount} row(s) have low confidence - please review carefully`);
    }

    console.log(`[ocr-import] Extraction complete: ${result.totalRows} rows, ${lowConfidenceCount} low confidence`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[ocr-import] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "OCR processing failed",
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
