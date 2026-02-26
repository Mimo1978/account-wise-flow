import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------- Tool definitions for Claude ----------
const TOOL_DEFINITIONS = [
  {
    name: "search_companies",
    description: "Search CRM companies by name or keyword. Returns id, name, industry, city, country.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Search term" } },
      required: ["query"],
    },
  },
  {
    name: "search_contacts",
    description: "Search CRM contacts by name, email, or job title. Optionally filter by company_id.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        company_id: { type: "string", description: "Optional company UUID to filter by" },
      },
      required: ["query"],
    },
  },
  {
    name: "create_company",
    description: "Create a new company in the CRM.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        website: { type: "string" },
        industry: { type: "string" },
        city: { type: "string" },
        country: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "create_contact",
    description: "Create a new contact in the CRM. GDPR consent must be collected.",
    input_schema: {
      type: "object",
      properties: {
        first_name: { type: "string" },
        last_name: { type: "string" },
        email: { type: "string" },
        company_id: { type: "string" },
        job_title: { type: "string" },
        phone: { type: "string" },
        gdpr_consent: { type: "boolean" },
        gdpr_consent_method: { type: "string" },
      },
      required: ["first_name", "last_name", "email", "company_id", "gdpr_consent"],
    },
  },
  {
    name: "create_project",
    description: "Create a new CRM project.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        company_id: { type: "string" },
        project_type: { type: "string" },
        description: { type: "string" },
      },
      required: ["name", "company_id", "project_type"],
    },
  },
  {
    name: "create_opportunity",
    description: "Create a new sales opportunity.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        company_id: { type: "string" },
        project_id: { type: "string" },
        value: { type: "number" },
        currency: { type: "string" },
        stage: { type: "string" },
        expected_close_date: { type: "string" },
        contact_id: { type: "string" },
      },
      required: ["title", "company_id", "value"],
    },
  },
  {
    name: "update_opportunity_stage",
    description: "Move an opportunity to a new pipeline stage.",
    input_schema: {
      type: "object",
      properties: {
        opportunity_id: { type: "string" },
        new_stage: { type: "string" },
      },
      required: ["opportunity_id", "new_stage"],
    },
  },
  {
    name: "create_deal",
    description: "Create a deal from a won opportunity.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        opportunity_id: { type: "string" },
        company_id: { type: "string" },
        value: { type: "number" },
        signed_date: { type: "string" },
        payment_terms: { type: "string" },
      },
      required: ["title", "company_id", "value"],
    },
  },
  {
    name: "create_invoice",
    description: "Create an invoice for a deal. Requires explicit user confirmation.",
    input_schema: {
      type: "object",
      properties: {
        deal_id: { type: "string" },
        line_items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity: { type: "number" },
              unit_price: { type: "number" },
              vat_rate: { type: "number" },
            },
            required: ["description", "quantity", "unit_price"],
          },
        },
        due_date: { type: "string" },
      },
      required: ["deal_id", "line_items"],
    },
  },
  {
    name: "send_email",
    description: "Send an email to a contact. Requires Resend integration configured.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
        template_id: { type: "string" },
      },
      required: ["contact_id", "subject", "body"],
    },
  },
  {
    name: "send_sms",
    description: "Send an SMS to a contact. Requires Twilio integration configured.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: { type: "string" },
        message: { type: "string" },
      },
      required: ["contact_id", "message"],
    },
  },
  {
    name: "get_pipeline_summary",
    description: "Returns pipeline value grouped by stage.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_contact_activity",
    description: "Returns last 10 activities for a contact.",
    input_schema: {
      type: "object",
      properties: { contact_id: { type: "string" } },
      required: ["contact_id"],
    },
  },
  {
    name: "get_company_overview",
    description: "Returns company stats: contacts count, pipeline value, invoiced total.",
    input_schema: {
      type: "object",
      properties: { company_id: { type: "string" } },
      required: ["company_id"],
    },
  },
];

const SYSTEM_PROMPT = `You are Jarvis, the AI assistant for this CRM. You help users manage their contacts, companies, projects, opportunities, deals, documents, and invoices through natural conversation.

Rules:
- Always confirm what you are about to do before executing any write action
- For destructive or financial actions (creating invoices, closing deals), always ask for explicit confirmation
- Never reveal raw database IDs to users — use names instead
- If you are unsure of a field value, ask for it rather than guessing
- Keep responses concise and professional
- If a user asks you to do something outside your tools, politely decline`;

// ---------- Tool executors ----------
async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string
): Promise<{ result: unknown; entityType: string; entityId?: string }> {
  switch (toolName) {
    case "search_companies": {
      const { data } = await supabaseAdmin
        .from("crm_companies")
        .select("id, name, industry, city, country")
        .ilike("name", `%${input.query}%`)
        .is("deleted_at", null)
        .limit(10);
      return { result: data ?? [], entityType: "crm_companies" };
    }
    case "search_contacts": {
      let q = supabaseAdmin
        .from("crm_contacts")
        .select("id, first_name, last_name, email, job_title, company_id")
        .is("deleted_at", null);
      if (input.company_id) q = q.eq("company_id", input.company_id as string);
      q = q.or(`first_name.ilike.%${input.query}%,last_name.ilike.%${input.query}%,email.ilike.%${input.query}%`);
      const { data } = await q.limit(10);
      return { result: data ?? [], entityType: "crm_contacts" };
    }
    case "create_company": {
      const { data, error } = await supabaseAdmin
        .from("crm_companies")
        .insert({
          name: input.name as string,
          website: (input.website as string) || null,
          industry: (input.industry as string) || null,
          city: (input.city as string) || null,
          country: (input.country as string) || null,
          created_by: userId,
        })
        .select("id, name")
        .single();
      if (error) return { result: { error: error.message }, entityType: "crm_companies" };
      return { result: data, entityType: "crm_companies", entityId: data?.id };
    }
    case "create_contact": {
      const { data, error } = await supabaseAdmin
        .from("crm_contacts")
        .insert({
          first_name: input.first_name as string,
          last_name: input.last_name as string,
          email: (input.email as string) || null,
          company_id: (input.company_id as string) || null,
          job_title: (input.job_title as string) || null,
          phone: (input.phone as string) || null,
          gdpr_consent: (input.gdpr_consent as boolean) || false,
          gdpr_consent_method: (input.gdpr_consent_method as string) || null,
          gdpr_consent_date: input.gdpr_consent ? new Date().toISOString() : null,
          created_by: userId,
        })
        .select("id, first_name, last_name")
        .single();
      if (error) return { result: { error: error.message }, entityType: "crm_contacts" };
      return { result: data, entityType: "crm_contacts", entityId: data?.id };
    }
    case "create_project": {
      const { data, error } = await supabaseAdmin
        .from("crm_projects")
        .insert({
          name: input.name as string,
          company_id: (input.company_id as string) || null,
          project_type: (input.project_type as string) || null,
          description: (input.description as string) || null,
          created_by: userId,
        })
        .select("id, name")
        .single();
      if (error) return { result: { error: error.message }, entityType: "crm_projects" };
      return { result: data, entityType: "crm_projects", entityId: data?.id };
    }
    case "create_opportunity": {
      const { data, error } = await supabaseAdmin
        .from("crm_opportunities")
        .insert({
          title: input.title as string,
          company_id: (input.company_id as string) || null,
          project_id: (input.project_id as string) || null,
          value: (input.value as number) || 0,
          currency: (input.currency as string) || "GBP",
          stage: (input.stage as string) || "lead",
          expected_close_date: (input.expected_close_date as string) || null,
          contact_id: (input.contact_id as string) || null,
          created_by: userId,
        })
        .select("id, title")
        .single();
      if (error) return { result: { error: error.message }, entityType: "crm_opportunities" };
      return { result: data, entityType: "crm_opportunities", entityId: data?.id };
    }
    case "update_opportunity_stage": {
      const { data, error } = await supabaseAdmin
        .from("crm_opportunities")
        .update({ stage: input.new_stage as string })
        .eq("id", input.opportunity_id as string)
        .select("id, title, stage")
        .single();
      if (error) return { result: { error: error.message }, entityType: "crm_opportunities" };
      return { result: data, entityType: "crm_opportunities", entityId: data?.id };
    }
    case "create_deal": {
      const { data, error } = await supabaseAdmin
        .from("crm_deals")
        .insert({
          title: input.title as string,
          opportunity_id: (input.opportunity_id as string) || null,
          company_id: (input.company_id as string) || null,
          value: (input.value as number) || 0,
          signed_date: (input.signed_date as string) || null,
          payment_terms: (input.payment_terms as string) || null,
          created_by: userId,
        })
        .select("id, title")
        .single();
      if (error) return { result: { error: error.message }, entityType: "crm_deals" };
      return { result: data, entityType: "crm_deals", entityId: data?.id };
    }
    case "create_invoice": {
      // Get deal to find company_id
      const { data: deal } = await supabaseAdmin
        .from("crm_deals")
        .select("company_id")
        .eq("id", input.deal_id as string)
        .single();

      const lineItems = input.line_items as Array<{
        description: string;
        quantity: number;
        unit_price: number;
        vat_rate?: number;
      }>;
      const subtotal = lineItems.reduce((s, li) => s + li.quantity * li.unit_price, 0);
      const vatRate = lineItems[0]?.vat_rate ?? 20;
      const vatAmount = subtotal * (vatRate / 100);

      const { data: inv, error } = await supabaseAdmin
        .from("crm_invoices")
        .insert({
          deal_id: input.deal_id as string,
          company_id: deal?.company_id || null,
          due_date: (input.due_date as string) || null,
          subtotal,
          vat_rate: vatRate,
          vat_amount: vatAmount,
          total: subtotal + vatAmount,
          created_by: userId,
        })
        .select("id, invoice_number, total")
        .single();
      if (error) return { result: { error: error.message }, entityType: "crm_invoices" };

      // Insert line items
      if (inv) {
        for (const li of lineItems) {
          await supabaseAdmin.from("crm_invoice_line_items").insert({
            invoice_id: inv.id,
            description: li.description,
            quantity: li.quantity,
            unit_price: li.unit_price,
            vat_rate: li.vat_rate ?? 20,
            line_total: li.quantity * li.unit_price,
          });
        }
      }
      return { result: inv, entityType: "crm_invoices", entityId: inv?.id };
    }
    case "send_email": {
      // Get contact email
      const { data: contact } = await supabaseAdmin
        .from("crm_contacts")
        .select("email, first_name, company_id")
        .eq("id", input.contact_id as string)
        .single();
      if (!contact?.email) return { result: { error: "Contact has no email address" }, entityType: "crm_contacts" };

      // Get user's Resend keys
      const { data: keys } = await supabaseAdmin
        .from("integration_settings")
        .select("key_name, key_value")
        .eq("user_id", userId)
        .eq("service", "resend");
      const keyMap = Object.fromEntries((keys ?? []).map((k: any) => [k.key_name, k.key_value]));
      if (!keyMap.RESEND_API_KEY || !keyMap.FROM_EMAIL_ADDRESS) {
        return { result: { error: "Resend integration not configured" }, entityType: "email" };
      }

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${keyMap.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: keyMap.FROM_EMAIL_ADDRESS,
          to: contact.email,
          subject: input.subject as string,
          html: input.body as string,
        }),
      });
      if (!res.ok) return { result: { error: `Email send failed: ${res.status}` }, entityType: "email" };

      // Log activity
      await supabaseAdmin.from("crm_activities").insert({
        type: "email",
        direction: "outbound",
        subject: input.subject as string,
        body: (input.body as string).replace(/<[^>]*>/g, "").slice(0, 500),
        contact_id: input.contact_id as string,
        company_id: contact.company_id,
        status: "completed",
        completed_at: new Date().toISOString(),
        created_by: userId,
      });
      return { result: { success: true, sent_to: contact.email }, entityType: "email" };
    }
    case "send_sms": {
      const { data: contact } = await supabaseAdmin
        .from("crm_contacts")
        .select("mobile, first_name, company_id")
        .eq("id", input.contact_id as string)
        .single();
      if (!contact?.mobile) return { result: { error: "Contact has no mobile number" }, entityType: "crm_contacts" };

      const { data: keys } = await supabaseAdmin
        .from("integration_settings")
        .select("key_name, key_value")
        .eq("user_id", userId)
        .eq("service", "twilio");
      const keyMap = Object.fromEntries((keys ?? []).map((k: any) => [k.key_name, k.key_value]));
      if (!keyMap.TWILIO_ACCOUNT_SID || !keyMap.TWILIO_AUTH_TOKEN || !keyMap.TWILIO_PHONE_NUMBER) {
        return { result: { error: "Twilio integration not configured" }, entityType: "sms" };
      }

      const params = new URLSearchParams({
        From: keyMap.TWILIO_PHONE_NUMBER,
        To: contact.mobile,
        Body: input.message as string,
      });
      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${keyMap.TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: "Basic " + btoa(`${keyMap.TWILIO_ACCOUNT_SID}:${keyMap.TWILIO_AUTH_TOKEN}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        }
      );
      if (!twilioRes.ok) return { result: { error: `SMS send failed: ${twilioRes.status}` }, entityType: "sms" };

      await supabaseAdmin.from("crm_activities").insert({
        type: "sms",
        direction: "outbound",
        body: (input.message as string).slice(0, 500),
        contact_id: input.contact_id as string,
        company_id: contact.company_id,
        status: "completed",
        completed_at: new Date().toISOString(),
        created_by: userId,
      });
      return { result: { success: true }, entityType: "sms" };
    }
    case "get_pipeline_summary": {
      const { data } = await supabaseAdmin
        .from("crm_opportunities")
        .select("stage, value");
      const stages: Record<string, { count: number; value: number }> = {};
      for (const opp of data ?? []) {
        if (!stages[opp.stage]) stages[opp.stage] = { count: 0, value: 0 };
        stages[opp.stage].count++;
        stages[opp.stage].value += opp.value || 0;
      }
      return { result: stages, entityType: "crm_opportunities" };
    }
    case "get_contact_activity": {
      const { data } = await supabaseAdmin
        .from("crm_activities")
        .select("type, direction, subject, body, status, completed_at, created_at")
        .eq("contact_id", input.contact_id as string)
        .order("created_at", { ascending: false })
        .limit(10);
      return { result: data ?? [], entityType: "crm_activities", entityId: input.contact_id as string };
    }
    case "get_company_overview": {
      const companyId = input.company_id as string;
      const [companyRes, contactsRes, oppsRes, invoicesRes] = await Promise.all([
        supabaseAdmin.from("crm_companies").select("id, name, industry, city, country").eq("id", companyId).single(),
        supabaseAdmin.from("crm_contacts").select("id").eq("company_id", companyId).is("deleted_at", null),
        supabaseAdmin.from("crm_opportunities").select("value, stage").eq("company_id", companyId),
        supabaseAdmin.from("crm_invoices").select("total, status").eq("company_id", companyId),
      ]);
      const pipelineValue = (oppsRes.data ?? [])
        .filter((o: any) => !["closed_won", "closed_lost"].includes(o.stage))
        .reduce((s: number, o: any) => s + (o.value || 0), 0);
      const invoicedTotal = (invoicesRes.data ?? []).reduce((s: number, i: any) => s + (i.total || 0), 0);
      return {
        result: {
          company: companyRes.data,
          contacts_count: contactsRes.data?.length ?? 0,
          pipeline_value: pipelineValue,
          invoiced_total: invoicedTotal,
          opportunities_count: oppsRes.data?.length ?? 0,
        },
        entityType: "crm_companies",
        entityId: companyId,
      };
    }
    default:
      return { result: { error: `Unknown tool: ${toolName}` }, entityType: "unknown" };
  }
}

// ---------- Audit logger (NO PII) ----------
async function logAudit(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  inputSummary: string,
  outputSummary: string
) {
  await supabaseAdmin.from("crm_ai_audit_log").insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    input_summary: inputSummary,
    output_summary: outputSummary,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Get Anthropic API key from integration_settings
    const { data: anthKeys } = await supabaseAdmin
      .from("integration_settings")
      .select("key_value")
      .eq("user_id", userId)
      .eq("service", "anthropic")
      .eq("key_name", "ANTHROPIC_API_KEY")
      .single();

    if (!anthKeys?.key_value) {
      return new Response(
        JSON.stringify({
          error: "integration_not_configured",
          service: "anthropic",
          message: "Jarvis is not set up. Go to Settings > Integrations to add your Anthropic API key.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user_message, conversation_history } = await req.json();
    if (!user_message || typeof user_message !== "string") {
      return new Response(JSON.stringify({ error: "user_message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build messages for Claude
    const messages = [
      ...(conversation_history || []),
      { role: "user", content: user_message },
    ];

    // Initial Claude call
    let claudeResponse = await callClaude(anthKeys.key_value, messages, SYSTEM_PROMPT);

    // Tool use loop (max 5 iterations to prevent infinite loops)
    let iterations = 0;
    while (claudeResponse.stop_reason === "tool_use" && iterations < 5) {
      iterations++;
      const toolBlocks = claudeResponse.content.filter((b: any) => b.type === "tool_use");
      const toolResults: any[] = [];

      for (const toolBlock of toolBlocks) {
        const { result, entityType, entityId } = await executeTool(
          toolBlock.name,
          toolBlock.input,
          supabaseAdmin,
          userId
        );

        // Audit log — NO PII, only action name and entity ID
        await logAudit(
          supabaseAdmin,
          userId,
          toolBlock.name,
          entityType,
          entityId || null,
          `tool:${toolBlock.name}`,
          entityId ? `entity:${entityId}` : "search_results"
        );

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolBlock.id,
          content: JSON.stringify(result),
        });
      }

      // Send tool results back to Claude
      const updatedMessages = [
        ...messages,
        { role: "assistant", content: claudeResponse.content },
        ...toolResults.map((tr) => ({ role: "user", content: [tr] })),
      ];

      claudeResponse = await callClaude(anthKeys.key_value, updatedMessages, SYSTEM_PROMPT);
    }

    // Extract text response
    const textBlocks = claudeResponse.content.filter((b: any) => b.type === "text");
    const responseText = textBlocks.map((b: any) => b.text).join("\n");

    return new Response(
      JSON.stringify({
        response: responseText,
        conversation_history: [
          ...messages,
          { role: "assistant", content: responseText },
        ],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("jarvis-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function callClaude(
  apiKey: string,
  messages: any[],
  systemPrompt: string
) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools: TOOL_DEFINITIONS,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Claude API error ${res.status}: ${errorText}`);
  }

  return await res.json();
}
