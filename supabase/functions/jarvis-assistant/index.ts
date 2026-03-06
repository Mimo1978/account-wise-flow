import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------- Tool definitions (OpenAI function-calling format) ----------
const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "search_companies",
      description: "Search CRM companies by name or keyword. Returns id, name, industry, city, country.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Search term" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_contacts",
      description: "Search CRM contacts by name, email, or job title. Optionally filter by company_id.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          company_id: { type: "string", description: "Optional company UUID to filter by" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_company",
      description: "Create a new company in the CRM.",
      parameters: {
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
  },
  {
    type: "function",
    function: {
      name: "create_contact",
      description: "Create a new contact in the CRM. GDPR consent must be collected.",
      parameters: {
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
  },
  {
    type: "function",
    function: {
      name: "create_project",
      description: "Create a new CRM project.",
      parameters: {
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
  },
  {
    type: "function",
    function: {
      name: "create_opportunity",
      description: "Create a new sales opportunity.",
      parameters: {
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
  },
  {
    type: "function",
    function: {
      name: "update_opportunity_stage",
      description: "Move an opportunity to a new pipeline stage.",
      parameters: {
        type: "object",
        properties: {
          opportunity_id: { type: "string" },
          new_stage: { type: "string" },
        },
        required: ["opportunity_id", "new_stage"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_deal",
      description: "Create a deal from a won opportunity.",
      parameters: {
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
  },
  {
    type: "function",
    function: {
      name: "create_invoice",
      description: "Create an invoice for a deal. Requires explicit user confirmation.",
      parameters: {
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
  },
  {
    type: "function",
    function: {
      name: "send_email",
      description: "Send an email to a contact. Requires Resend integration configured.",
      parameters: {
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
  },
  {
    type: "function",
    function: {
      name: "send_sms",
      description: "Send an SMS to a contact. Requires Twilio integration configured.",
      parameters: {
        type: "object",
        properties: {
          contact_id: { type: "string" },
          message: { type: "string" },
        },
        required: ["contact_id", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pipeline_summary",
      description: "Returns pipeline value grouped by stage.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contact_activity",
      description: "Returns last 10 activities for a contact.",
      parameters: {
        type: "object",
        properties: { contact_id: { type: "string" } },
        required: ["contact_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_company_overview",
      description: "Returns company stats: contacts count, pipeline value, invoiced total.",
      parameters: {
        type: "object",
        properties: { company_id: { type: "string" } },
        required: ["company_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_call",
      description: "Log a call activity with a contact in the CRM.",
      parameters: {
        type: "object",
        properties: {
          contact_id: { type: "string" },
          subject: { type: "string", description: "Brief call summary" },
          body: { type: "string", description: "Detailed notes from the call" },
          outcome: { type: "string", description: "e.g. positive, neutral, negative, no_answer" },
          follow_up_action: { type: "string", description: "Next step after the call" },
        },
        required: ["contact_id", "subject"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate",
      description: "Navigate the user to a specific page or trigger a UI action. Destinations: home, dashboard, companies, contacts, talent, outreach, insights, canvas, projects, reports, deals, pipeline, invoices, documents, admin, integrations, billing settings, team management, jarvis settings, branding, outreach settings, signals, data quality. Actions: add company, add contact, add deal, add candidate, import contacts, create campaign, create invoice, import companies.",
      parameters: {
        type: "object",
        properties: {
          destination: { type: "string", description: "Page name or action keyword from the list above" },
          entity_id: { type: "string", description: "Optional entity ID for detail pages" },
        },
        required: ["destination"],
      },
    },
  },
];

const SYSTEM_PROMPT = `You are Jarvis, the AI assistant for this CRM. You help users manage their contacts, companies, projects, opportunities, deals, documents, and invoices through natural conversation.

CRITICAL RULES — YOU MUST FOLLOW THESE:
1. TOOL USAGE: You MUST use the provided tool functions for ALL actions. Never pretend to do something without calling a tool. If you say "Done" or "Created", a tool MUST have been called.
2. WHEN USER CONFIRMS: When the user says "yes", "go ahead", "confirm", "do it", "sure", "yep", or similar — you MUST IMMEDIATELY call the appropriate tool function. Do NOT just say you did it — actually call the tool.
3. Never reveal raw database IDs to users — use names instead.
4. Keep responses concise and conversational — never more than 2 questions per message.
5. When logging calls, search for the contact first to get their ID.
6. When asked to navigate, use the navigate tool immediately.
7. For search queries, call the search tool and present results in a readable format.
8. If a user asks you to do something outside your tools, politely decline.

GUIDED DATA COLLECTION — follow these flows when creating records:

SMART EXTRACTION: If the user provides multiple fields at once (e.g. "Add Google as a tech company"), extract ALL provided fields and skip those questions. Only ask about fields NOT yet provided.

SKIP HANDLING: If the user says "skip", "not sure", "none", or "no" for an optional field — leave it blank and move on immediately.

MEMORY: Never re-ask for information already provided in the conversation.

CREATE COMPANY flow — ask in order, 1-2 questions per message:
1. "What is the company name?" (required — if already provided, skip)
2. "What industry are they in? For example: Technology, Finance, Recruitment, Legal, Healthcare, Retail, or something else?"
3. "How would you describe the relationship? Warm, Cold, Active, or Prospect?"
4. "Any notes to add? You can say 'skip' if not."
5. Confirm: "I'll create [name] in [industry], status [status]. Shall I go ahead?"
6. After creation: "[Name] has been added to your companies."

CREATE CONTACT flow — ask in order, 1-2 questions per message:
1. "What is their first and last name?" (required)
2. "Which company do they work at?" — use search_companies to find matches and offer them
3. "What is their job title?"
4. "What is their email address? (optional but recommended)"
5. "What is their phone number? (optional)"
6. "Do you have GDPR consent to contact them? Yes, No, or Pending?"
7. "Any notes? You can say 'skip'."
8. Confirm all fields then create.

LOG CALL flow:
1. "Who did you speak with?" — use search_contacts to find the person
2. "How did it go? Positive, Neutral, or Negative?"
3. "What was discussed?" — free text
4. "Any follow-up needed? If yes, what and when?"
5. Confirm and log.

CREATE DEAL flow:
1. "Which company is this deal with?" — search existing companies
2. "What is the deal name or description?"
3. "What is the value? And which currency — GBP, USD, EUR?"
4. "What stage is it at? Lead, Qualified, Proposal, or Negotiation?"
5. "What is the expected close date?"
6. Confirm and create.

CREATE OPPORTUNITY flow:
1. "What is the opportunity title?"
2. "Which company is this for?" — search existing companies
3. "What is the estimated value?"
4. "What stage? Lead, Qualified, Proposal, Negotiation, or Closed Won?"
5. Confirm and create.

CREATE PROJECT flow:
1. "What is the project name?"
2. "Which company is this for?" — search existing companies
3. "What type of project? e.g. Implementation, Consulting, Support"
4. "Any description?"
5. Confirm and create.

CONFIRMATION: Always confirm before executing. State ALL collected fields clearly using names (never IDs). Only call the tool AFTER the user confirms.`;

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
      // Build headquarters string from city/country
      const city = (input.city as string) || null;
      const country = (input.country as string) || null;
      const headquarters = [city, country].filter(Boolean).join(", ") || null;

      // Fetch user's workspace/team_id — required for RLS visibility
      const { data: userRole, error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .select("team_id")
        .eq("user_id", userId)
        .limit(1)
        .single();
      const teamId = userRole?.team_id || null;
      console.log("[create_company] userId:", userId, "team_id:", teamId);

      const insertPayload = {
        name: input.name as string,
        website: (input.website as string) || null,
        industry: (input.industry as string) || null,
        headquarters,
        owner_id: userId,
        team_id: teamId,
      };
      console.log("[create_company] Attempting insert into 'companies' with payload:", JSON.stringify(insertPayload));

      const { data, error } = await supabaseAdmin
        .from("companies")
        .insert(insertPayload)
        .select("id, name")
        .single();

      if (error) {
        console.error("[create_company] Insert FAILED:", error.message);
        return { result: { error: error.message }, entityType: "companies" };
      }
      console.log("[create_company] Insert SUCCESS — id:", data?.id, "name:", data?.name);
      return { result: { ...data, navigate_to: "/companies" }, entityType: "companies", entityId: data?.id };
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
      const { data: contact } = await supabaseAdmin
        .from("crm_contacts")
        .select("email, first_name, company_id")
        .eq("id", input.contact_id as string)
        .single();
      if (!contact?.email) return { result: { error: "Contact has no email address" }, entityType: "crm_contacts" };

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
    case "log_call": {
      const { data, error } = await supabaseAdmin
        .from("crm_activities")
        .insert({
          type: "call",
          direction: "outbound",
          subject: (input.subject as string) || "Call logged",
          body: (input.body as string) || null,
          contact_id: input.contact_id as string,
          status: "completed",
          completed_at: new Date().toISOString(),
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) return { result: { error: error.message }, entityType: "crm_activities" };
      return { result: { success: true, activity_id: data?.id }, entityType: "crm_activities", entityId: data?.id };
    }
    case "navigate": {
      const dest = (input.destination as string).toLowerCase().trim();
      const entityId = input.entity_id as string | undefined;

      // Comprehensive navigation map with action support
      const navMap: Record<string, { path: string; action?: string; targetId?: string }> = {
        // Main pages
        home: { path: "/home" },
        dashboard: { path: "/home" },
        companies: { path: "/companies" },
        contacts: { path: "/contacts" },
        talent: { path: "/talent" },
        outreach: { path: "/outreach" },
        insights: { path: "/executive-insights" },
        canvas: { path: "/canvas" },
        projects: { path: "/projects" },
        reports: { path: "/reports" },
        // CRM detail areas
        deals: { path: "/crm/deals" },
        pipeline: { path: "/crm/pipeline" },
        invoices: { path: "/crm/invoices" },
        "crm projects": { path: "/crm/projects" },
        documents: { path: "/crm/documents" },
        // Admin
        admin: { path: "/admin" },
        integrations: { path: "/admin/integrations" },
        "admin integrations": { path: "/admin/integrations" },
        "billing settings": { path: "/admin/billing" },
        "team management": { path: "/admin/workspace" },
        "jarvis settings": { path: "/admin/jarvis" },
        branding: { path: "/admin/branding" },
        "outreach settings": { path: "/admin/outreach" },
        signals: { path: "/admin/signals" },
        "data quality": { path: "/admin/data-quality" },
        // Actions (navigate + click)
        "add company": { path: "/companies", action: "click", targetId: "add-company-button" },
        "add contact": { path: "/contacts", action: "click", targetId: "add-contact-button" },
        "add deal": { path: "/crm/deals", action: "click", targetId: "add-deal-button" },
        "add candidate": { path: "/talent", action: "click", targetId: "add-candidate-button" },
        "import contacts": { path: "/contacts", action: "click", targetId: "import-button" },
        "create campaign": { path: "/outreach", action: "click", targetId: "new-campaign-button" },
        "create invoice": { path: "/home", action: "click", targetId: "create-invoice-button" },
        "import companies": { path: "/companies", action: "click", targetId: "import-companies-button" },
      };

      // Try exact match first, then fuzzy keyword match
      let entry = navMap[dest];
      if (!entry) {
        for (const [key, val] of Object.entries(navMap)) {
          if (dest.includes(key) || key.includes(dest)) {
            entry = val;
            break;
          }
        }
      }

      let path = entry?.path || "/home";
      if (entityId) {
        if (dest.includes("compan")) path = `/companies/${entityId}`;
        else if (dest.includes("contact")) path = `/crm/contacts/${entityId}`;
        else if (dest.includes("deal")) path = `/crm/deals/${entityId}`;
        else if (dest.includes("project")) path = `/crm/projects/${entityId}`;
        else if (dest.includes("invoice")) path = `/crm/invoices/${entityId}`;
      }

      const result: Record<string, unknown> = { navigate_to: path };
      if (entry?.action) result.action = entry.action;
      if (entry?.targetId) result.target_id = entry.targetId;

      return { result, entityType: "navigation", entityId: path };
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

    // Rate limiting
    const rateCheck = await checkRateLimit(supabaseAdmin, userId, "jarvis-assistant", 60);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: "Rate limit reached. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user_message, conversation_history, user_first_name } = await req.json();
    if (!user_message || typeof user_message !== "string") {
      return new Response(JSON.stringify({ error: "user_message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build messages for Lovable AI (OpenAI format)
    const systemWithName = user_first_name
      ? SYSTEM_PROMPT + `\n\nThe user's first name is "${user_first_name}". Use it when greeting them.`
      : SYSTEM_PROMPT;

    const messages = [
      { role: "system", content: systemWithName },
      ...(conversation_history || []),
      { role: "user", content: user_message },
    ];

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initial call
    let aiResponse = await callLovableAI(lovableApiKey, messages);

    // Tool use loop (max 5 iterations)
    let iterations = 0;
    let currentMessages = [...messages];
    const actionsExecuted: Array<{ tool: string; entityType: string; entityId?: string; success: boolean }> = [];

    while (aiResponse.choices?.[0]?.finish_reason === "tool_calls" && iterations < 5) {
      iterations++;
      const toolCalls = aiResponse.choices[0].message.tool_calls || [];

      // Add assistant message with tool calls
      currentMessages.push(aiResponse.choices[0].message);

      for (const toolCall of toolCalls) {
        const toolInput = JSON.parse(toolCall.function.arguments || "{}");
        const { result, entityType, entityId } = await executeTool(
          toolCall.function.name,
          toolInput,
          supabaseAdmin,
          userId
        );

        const hasError = result && typeof result === "object" && "error" in (result as any);

        // Track executed actions
        actionsExecuted.push({
          tool: toolCall.function.name,
          entityType,
          entityId: entityId || undefined,
          success: !hasError,
        });

        // Audit log
        await logAudit(
          supabaseAdmin,
          userId,
          toolCall.function.name,
          entityType,
          entityId || null,
          `tool:${toolCall.function.name}`,
          hasError ? `error:${(result as any).error}` : entityId ? `entity:${entityId}` : "search_results"
        );

        // Add tool result
        currentMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      aiResponse = await callLovableAI(lovableApiKey, currentMessages);
    }

    // Also handle tool_calls in the final response (not just finish_reason loop)
    const finalToolCalls = aiResponse.choices?.[0]?.message?.tool_calls;
    if (finalToolCalls && finalToolCalls.length > 0) {
      currentMessages.push(aiResponse.choices[0].message);
      
      for (const toolCall of finalToolCalls) {
        const toolInput = JSON.parse(toolCall.function.arguments || "{}");
        const { result, entityType, entityId } = await executeTool(
          toolCall.function.name,
          toolInput,
          supabaseAdmin,
          userId
        );

        const hasError = result && typeof result === "object" && "error" in (result as any);
        actionsExecuted.push({
          tool: toolCall.function.name,
          entityType,
          entityId: entityId || undefined,
          success: !hasError,
        });

        await logAudit(
          supabaseAdmin,
          userId,
          toolCall.function.name,
          entityType,
          entityId || null,
          `tool:${toolCall.function.name}`,
          hasError ? `error:${(result as any).error}` : entityId ? `entity:${entityId}` : "search_results"
        );

        currentMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      // Get final text response after executing remaining tools
      aiResponse = await callLovableAI(lovableApiKey, currentMessages);
    }

    // Extract text response
    const responseText = aiResponse.choices?.[0]?.message?.content || "";

    // Extract navigation + target action from executed actions
    let navigationPath: string | null = null;
    let targetAction: string | null = null;
    let targetId: string | null = null;

    for (const msg of currentMessages) {
      if ((msg as any).role === "tool" && typeof (msg as any).content === "string") {
        try {
          const parsed = JSON.parse((msg as any).content);
          if (parsed?.navigate_to) {
            navigationPath = parsed.navigate_to;
            if (parsed?.action) targetAction = parsed.action;
            if (parsed?.target_id) targetId = parsed.target_id;
          }
        } catch {}
      }
    }

    // Build invalidation list for frontend cache
    const invalidateQueries: string[] = [];
    const mutationTools = new Set(["create_company", "create_contact", "create_project", "create_opportunity", "update_opportunity_stage", "create_deal", "create_invoice", "log_call", "send_email", "send_sms"]);
    const entityQueryMap: Record<string, string[]> = {
      crm_companies: ["crm_companies"],
      crm_contacts: ["crm_contacts"],
      crm_projects: ["crm_projects"],
      crm_opportunities: ["crm_opportunities"],
      crm_deals: ["crm_deals"],
      crm_invoices: ["crm_invoices"],
      crm_activities: ["crm_activities"],
      email: ["crm_activities"],
      sms: ["crm_activities"],
    };

    for (const action of actionsExecuted) {
      if (mutationTools.has(action.tool) && action.success) {
        const queries = entityQueryMap[action.entityType] || [];
        for (const q of queries) {
          if (!invalidateQueries.includes(q)) invalidateQueries.push(q);
        }
      }
    }

    return new Response(
      JSON.stringify({
        response: responseText,
        navigate_to: navigationPath,
        target_action: targetAction,
        target_id: targetId,
        actions_executed: actionsExecuted.filter(a => mutationTools.has(a.tool)),
        invalidate_queries: invalidateQueries,
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

async function callLovableAI(apiKey: string, messages: any[]) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      max_completion_tokens: 4096,
      messages,
      tools: TOOL_DEFINITIONS,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`AI API error ${res.status}: ${errorText}`);
  }

  return await res.json();
}
