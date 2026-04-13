import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WebResearchConfig {
  companyName: string;
  companyId?: string;
  regions: string[];
  focusAreas: string[];
  depth: string;
  seedPerson?: {
    name: string;
    title: string;
  };
  existingContacts?: Array<{ name: string; title: string }>;
}

interface WebResearchPerson {
  id: string;
  name: string;
  title: string;
  department?: string;
  location?: string;
  sources: Array<{
    url: string;
    title: string;
    sourceType: string;
    publishedDate?: string;
    excerpt?: string;
    accessedAt: string;
  }>;
  confidence: "high" | "medium" | "low";
  reportsTo?: string;
  reportsToConfidence?: "high" | "medium" | "low";
  discoveredAt: string;
  verified: boolean;
  placeholder: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = (await req.json()) as WebResearchConfig;

    if (!config.companyName) {
      return new Response(
        JSON.stringify({ error: "companyName is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[orgchart-web-research] Starting AI research for: ${config.companyName}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const depthInstruction = {
      leadership_only: "Only C-suite and board members (CEO, CFO, CTO, COO, CMO, etc.)",
      leadership_plus_1: "C-suite plus VPs and department heads who report directly to them",
      leadership_plus_2: "C-suite, VPs/department heads, and directors/senior managers below them",
    }[config.depth] || "C-suite and direct reports";

    const regionFocus = config.regions?.length > 0
      ? `Focus on offices/operations in: ${config.regions.join(", ")}.`
      : "";

    const focusDepts = config.focusAreas?.length > 0 && !config.focusAreas.includes("all")
      ? `Focus on these departments: ${config.focusAreas.join(", ")}.`
      : "Cover all major departments.";

    const seedInfo = config.seedPerson
      ? `Known leader: ${config.seedPerson.name} (${config.seedPerson.title}). Build the hierarchy around them.`
      : "";

    const existingInfo = config.existingContacts?.length
      ? `These people are ALREADY in the org chart (do NOT include them again): ${config.existingContacts.map(c => `${c.name} (${c.title})`).join(", ")}.`
      : "";

    const systemPrompt = `You are an expert corporate research analyst. Your task is to identify the leadership structure of a company based on your knowledge. Return ONLY people you are reasonably confident actually hold or recently held these positions. Do NOT fabricate names. If you don't know real people, return fewer results rather than making up names. For each person, indicate a confidence level and who they likely report to.`;

    const userPrompt = `Research the leadership team of "${config.companyName}".

Scope: ${depthInstruction}
${regionFocus}
${focusDepts}
${seedInfo}
${existingInfo}

For each person found, provide:
- name (full name)
- title (exact job title)
- department (e.g. Executive, Technology, Finance, Sales, Marketing, Operations, HR, Legal)
- location (city/country if known)
- confidence: "high" if widely reported, "medium" if mentioned in 1-2 sources, "low" if inferred
- reportsTo: name of their likely direct manager
- reportsToConfidence: confidence of the reporting relationship
- sourceDescription: brief description of where this info comes from (e.g. "Company website leadership page", "Press release Q1 2024", "Industry conference bio")

Return results as a JSON array. Only include real people you have knowledge about.`;

    const toolSchema = {
      type: "function" as const,
      function: {
        name: "return_leadership_data",
        description: "Return the discovered leadership team members",
        parameters: {
          type: "object",
          properties: {
            people: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  title: { type: "string" },
                  department: { type: "string" },
                  location: { type: "string" },
                  confidence: { type: "string", enum: ["high", "medium", "low"] },
                  reportsTo: { type: "string" },
                  reportsToConfidence: { type: "string", enum: ["high", "medium", "low"] },
                  sourceDescription: { type: "string" },
                },
                required: ["name", "title", "confidence"],
                additionalProperties: false,
              },
            },
            companyNotes: {
              type: "string",
              description: "Any caveats about the data quality or company",
            },
          },
          required: ["people"],
          additionalProperties: false,
        },
      },
    };

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [toolSchema],
        tool_choice: { type: "function", function: { name: "return_leadership_data" } },
      }),
    });

    if (!aiResponse.ok) {
      const statusCode = aiResponse.status;
      const errText = await aiResponse.text();
      console.error(`[orgchart-web-research] AI gateway error ${statusCode}:`, errText);

      if (statusCode === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment.", success: false, people: [], stats: { totalFound: 0, highConfidence: 0, mediumConfidence: 0, lowConfidence: 0, sourcesChecked: 0 }, companyName: config.companyName, completedAt: new Date().toISOString() }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (statusCode === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage.", success: false, people: [], stats: { totalFound: 0, highConfidence: 0, mediumConfidence: 0, lowConfidence: 0, sourcesChecked: 0 }, companyName: config.companyName, completedAt: new Date().toISOString() }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${statusCode}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("No structured response from AI");
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const aiPeople: any[] = parsed.people || [];
    const now = new Date().toISOString();

    const people: WebResearchPerson[] = aiPeople.map((p: any) => ({
      id: crypto.randomUUID(),
      name: p.name || "Unknown",
      title: p.title || "Unknown",
      department: p.department || undefined,
      location: p.location || undefined,
      sources: [
        {
          url: `https://www.google.com/search?q="${encodeURIComponent(p.name)}"+"${encodeURIComponent(config.companyName)}"`,
          title: p.sourceDescription || "AI Knowledge Base",
          sourceType: "ai_analysis",
          excerpt: `${p.name} identified as ${p.title} at ${config.companyName}`,
          accessedAt: now,
        },
      ],
      confidence: p.confidence || "low",
      reportsTo: p.reportsTo || undefined,
      reportsToConfidence: p.reportsToConfidence || undefined,
      discoveredAt: now,
      verified: false,
      placeholder: true,
    }));

    const stats = {
      totalFound: people.length,
      highConfidence: people.filter((p) => p.confidence === "high").length,
      mediumConfidence: people.filter((p) => p.confidence === "medium").length,
      lowConfidence: people.filter((p) => p.confidence === "low").length,
      sourcesChecked: 1,
    };

    const warnings = [
      "Results are based on AI analysis of publicly available information.",
      "All contacts require manual verification before saving to your CRM.",
    ];
    if (parsed.companyNotes) {
      warnings.push(parsed.companyNotes);
    }

    console.log(`[orgchart-web-research] Found ${people.length} people for ${config.companyName}`);

    return new Response(JSON.stringify({
      success: true,
      companyName: config.companyName,
      people,
      stats,
      warnings,
      completedAt: now,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[orgchart-web-research] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        people: [],
        stats: { totalFound: 0, highConfidence: 0, mediumConfidence: 0, lowConfidence: 0, sourcesChecked: 0 },
        companyName: "",
        completedAt: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
