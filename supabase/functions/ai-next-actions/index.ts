import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EntityContext {
  entityType: "candidate" | "contact" | "both";
  entityId: string;
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  headline?: string;
  skills?: string[];
  experience?: any[];
  linkedIn?: string;
  location?: string;
  company?: { id?: string; name: string };
  cvAttached?: boolean;
  source?: string;
}

interface CRMContext {
  openRoles?: { id: string; title: string; skills: string[]; company?: string }[];
  missingOrgRoles?: { company: string; department: string; role: string }[];
  activeAccounts?: { id: string; name: string; contactCount: number }[];
  relatedContacts?: { id: string; name: string; title: string; company: string }[];
}

interface SuggestedAction {
  id: string;
  category: "recruitment" | "sales" | "crossover" | "data_quality";
  title: string;
  reasoning: string;
  confidenceScore: number;
  actionType: string;
  actionData?: Record<string, any>;
  ctaLabel: string;
  ctaPath?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    // Create user client for RLS-aware queries
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Verify user auth
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    const { entityContext, workspaceId } = payload as { 
      entityContext: EntityContext; 
      workspaceId?: string;
    };

    if (!entityContext || !entityContext.entityType) {
      return new Response(JSON.stringify({ error: "Missing entityContext" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build CRM context from internal data only
    const crmContext = await buildCRMContext(userClient, entityContext, workspaceId);

    // Generate AI suggestions
    const suggestions = await generateAISuggestions(entityContext, crmContext);

    return new Response(JSON.stringify({ 
      actions: suggestions,
      generatedAt: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("AI Next Actions error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function buildCRMContext(
  supabase: any, 
  entity: EntityContext,
  workspaceId?: string
): Promise<CRMContext> {
  const context: CRMContext = {
    openRoles: [],
    missingOrgRoles: [],
    activeAccounts: [],
    relatedContacts: [],
  };

  try {
    // Get active accounts (companies) user has access to
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name")
      .limit(20);

    if (companies) {
      // Get contact counts for each company
      for (const company of companies) {
        const { count } = await supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("company_id", company.id);
        
        context.activeAccounts?.push({
          id: company.id,
          name: company.name,
          contactCount: count || 0,
        });
      }
    }

    // If entity has a company, find related contacts
    if (entity.company?.id) {
      const { data: relatedContacts } = await supabase
        .from("contacts")
        .select("id, name, title")
        .eq("company_id", entity.company.id)
        .limit(10);

      if (relatedContacts) {
        context.relatedContacts = relatedContacts.map((c: any) => ({
          id: c.id,
          name: c.name,
          title: c.title || "Unknown",
          company: entity.company?.name || "",
        }));
      }
    }

    // Check for org chart gaps - find companies with few contacts
    const companiesWithGaps = context.activeAccounts?.filter(
      (a) => a.contactCount < 5 && a.contactCount > 0
    );

    if (companiesWithGaps && companiesWithGaps.length > 0) {
      context.missingOrgRoles = companiesWithGaps.slice(0, 3).map((c) => ({
        company: c.name,
        department: "Leadership",
        role: "Key stakeholder mapping needed",
      }));
    }

  } catch (e) {
    console.error("Error building CRM context:", e);
  }

  return context;
}

async function generateAISuggestions(
  entity: EntityContext,
  crm: CRMContext
): Promise<SuggestedAction[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    return generateFallbackSuggestions(entity, crm);
  }

  const entitySummary = buildEntitySummary(entity);
  const crmSummary = buildCRMSummary(crm);

  const systemPrompt = `You are an AI assistant for a CRM/ATS platform. Analyze the newly approved entity and suggest 3-5 high-value next actions.

ENTITY DATA:
${entitySummary}

CRM CONTEXT (internal data only):
${crmSummary}

RULES:
- Only suggest actions based on provided data - NO hallucination
- Prioritize by: revenue/placement impact > time sensitivity > confidence > effort required
- Each action needs confidence_score (50-100), skip if below 50
- Be specific - reference actual names, companies, skills from the data
- Categories: recruitment (for candidates), sales (for contacts), crossover (for both), data_quality

RESPONSE FORMAT (JSON):
{
  "actions": [
    {
      "id": "unique_id",
      "category": "recruitment|sales|crossover|data_quality",
      "title": "Short action title",
      "reasoning": "One sentence explaining why this matters",
      "confidenceScore": 75,
      "actionType": "match_role|add_orgchart|generate_cv|expand_mapping|add_linkedin|review_duplicates|schedule_outreach|view_company",
      "actionData": { "optional": "context-specific data" },
      "ctaLabel": "Button text",
      "ctaPath": "/optional/route"
    }
  ]
}`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Generate best next actions for this entity." },
        ],
      }),
    });

    if (!response.ok) {
      console.error("AI gateway error:", response.status);
      return generateFallbackSuggestions(entity, crm);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let jsonContent = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonContent);
    const actions = (parsed.actions || []).filter(
      (a: SuggestedAction) => a.confidenceScore >= 50
    );

    return actions.slice(0, 5);

  } catch (error) {
    console.error("AI suggestion error:", error);
    return generateFallbackSuggestions(entity, crm);
  }
}

function buildEntitySummary(entity: EntityContext): string {
  let summary = `Type: ${entity.entityType}\n`;
  summary += `Name: ${entity.name}\n`;
  if (entity.email) summary += `Email: ${entity.email}\n`;
  if (entity.phone) summary += `Phone: ${entity.phone}\n`;
  if (entity.title) summary += `Title: ${entity.title}\n`;
  if (entity.headline) summary += `Headline: ${entity.headline}\n`;
  if (entity.location) summary += `Location: ${entity.location}\n`;
  if (entity.linkedIn) summary += `LinkedIn: ${entity.linkedIn}\n`;
  if (entity.company) summary += `Company: ${entity.company.name}\n`;
  if (entity.cvAttached) summary += `CV: Attached\n`;
  if (entity.skills && entity.skills.length > 0) {
    summary += `Skills: ${entity.skills.slice(0, 15).join(", ")}\n`;
  }
  if (entity.experience && entity.experience.length > 0) {
    summary += `Experience:\n`;
    entity.experience.slice(0, 3).forEach((exp: any) => {
      summary += `  - ${exp.title || "Unknown"} at ${exp.company || "Unknown"}\n`;
    });
  }
  return summary;
}

function buildCRMSummary(crm: CRMContext): string {
  let summary = "";
  
  if (crm.activeAccounts && crm.activeAccounts.length > 0) {
    summary += `Active Accounts (${crm.activeAccounts.length}):\n`;
    crm.activeAccounts.slice(0, 5).forEach((a) => {
      summary += `  - ${a.name}: ${a.contactCount} contacts\n`;
    });
  }

  if (crm.relatedContacts && crm.relatedContacts.length > 0) {
    summary += `Related Contacts at same company:\n`;
    crm.relatedContacts.slice(0, 5).forEach((c) => {
      summary += `  - ${c.name} (${c.title})\n`;
    });
  }

  if (crm.missingOrgRoles && crm.missingOrgRoles.length > 0) {
    summary += `Org Chart Gaps:\n`;
    crm.missingOrgRoles.forEach((g) => {
      summary += `  - ${g.company}: ${g.role}\n`;
    });
  }

  return summary || "No additional CRM context available.";
}

function generateFallbackSuggestions(
  entity: EntityContext,
  crm: CRMContext
): SuggestedAction[] {
  const actions: SuggestedAction[] = [];

  // Data quality suggestions
  if (!entity.linkedIn) {
    actions.push({
      id: "add_linkedin",
      category: "data_quality",
      title: "Add LinkedIn profile",
      reasoning: "LinkedIn profile enables better matching and networking insights.",
      confidenceScore: 85,
      actionType: "add_linkedin",
      ctaLabel: "Add LinkedIn",
    });
  }

  if (entity.entityType === "candidate" || entity.entityType === "both") {
    // Recruitment suggestions
    actions.push({
      id: "view_talent",
      category: "recruitment",
      title: `Review ${entity.name}'s talent profile`,
      reasoning: "Verify extracted skills and experience are accurate for matching.",
      confidenceScore: 90,
      actionType: "view_profile",
      ctaLabel: "View Profile",
      ctaPath: "/talent",
    });

    if (entity.cvAttached) {
      actions.push({
        id: "generate_cv",
        category: "recruitment",
        title: "Generate tailored CV version",
        reasoning: "Create a focused CV for specific opportunities.",
        confidenceScore: 70,
        actionType: "generate_cv",
        ctaLabel: "Generate CV",
      });
    }
  }

  if (entity.entityType === "contact" || entity.entityType === "both") {
    // Sales/account suggestions
    if (entity.company) {
      actions.push({
        id: "expand_orgchart",
        category: "sales",
        title: `Map ${entity.company.name} org chart`,
        reasoning: "Expand stakeholder coverage for this account.",
        confidenceScore: 80,
        actionType: "expand_mapping",
        ctaLabel: "View Org Chart",
        ctaPath: "/canvas",
      });
    }

    actions.push({
      id: "view_contacts",
      category: "sales",
      title: "Review contact in database",
      reasoning: "Verify contact details and relationship status.",
      confidenceScore: 85,
      actionType: "view_profile",
      ctaLabel: "View Contact",
      ctaPath: "/contacts",
    });
  }

  // Crossover suggestions for "both"
  if (entity.entityType === "both" && entity.company) {
    actions.push({
      id: "crossover_intro",
      category: "crossover",
      title: "Identify warm introduction paths",
      reasoning: `${entity.name} works at ${entity.company.name} - potential for warm intros.`,
      confidenceScore: 75,
      actionType: "view_company",
      ctaLabel: "Explore Connections",
      ctaPath: "/canvas",
    });
  }

  return actions.slice(0, 5);
}
