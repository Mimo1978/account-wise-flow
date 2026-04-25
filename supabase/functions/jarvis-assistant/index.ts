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
      description: "Navigate the user to a specific page or trigger a UI action. Destinations: home, dashboard, companies, contacts, talent, outreach, insights, canvas, projects, jobs, reports, deals, pipeline, invoices, documents, admin, integrations, billing settings, team management, jarvis settings, branding, outreach settings, signals, data quality. Actions: add company, add contact, add deal, add candidate, import contacts, create campaign, create invoice, import companies, add job, new job. Canvas actions: edit org chart, add person to org chart, build org chart, ai research, connect people, reset view, save chart, zoom in, zoom out, fit view.",
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
  {
    type: "function",
    function: {
      name: "navigate_to_canvas_for_company",
      description: "Navigate to the Canvas org chart view for a specific company. Searches for the company by name first.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "The company name to search for and show on canvas" },
        },
        required: ["company_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate_to_contact_record",
      description: "Navigate directly to a specific contact's detail page. Searches for the contact by name and opens their record. Use when the user says 'open [name]'s contact', 'show me [name]'s record', 'go to [name]', 'take me to [name]'s contact page', etc.",
      parameters: {
        type: "object",
        properties: {
          contact_name: { type: "string", description: "The contact name to search for and navigate to" },
        },
        required: ["contact_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate_to_company_record",
      description: "Navigate directly to a specific company's detail page. Searches for the company by name and opens their record. Use when the user says 'open [company]', 'show me [company]'s record', 'go to [company]', 'take me to [company]'s page', etc.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "The company name to search for and navigate to" },
        },
        required: ["company_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookup_company",
      description: "Look up a company by name within the user's workspace. Use this BEFORE creating contacts, deals, opportunities, or projects that need a company_id. Returns up to 5 matches. If 1 match: use it. If multiple: ask user to pick. If 0: offer to create it.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Company name to search for" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookup_contact",
      description: "Look up a contact by name within the user's workspace. Use this BEFORE logging calls or linking activities to a contact. Returns up to 5 matches with company name.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Contact name to search for" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookup_candidate",
      description: "Look up a candidate by name within the user's workspace. Use this BEFORE linking candidates to opportunities or projects. Returns up to 5 matches.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Candidate name to search for" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_job_spec",
      description: "Generate a full professional job specification from a raw brief using AI. Returns structured JSON with job_title, company_overview, role_summary, key_responsibilities, essential_skills, desirable_skills, what_we_offer, salary_range, location, job_type, start_date. Use after collecting the raw brief from the user.",
      parameters: {
        type: "object",
        properties: {
          raw_brief: { type: "string", description: "The recruiter's raw description of the role" },
          job_title: { type: "string", description: "Extracted or clarified job title" },
          company_name: { type: "string", description: "Client company name" },
          job_type: { type: "string", description: "permanent, contract, or temp" },
          location: { type: "string" },
          salary_info: { type: "string", description: "Salary or rate info from the brief" },
          start_date: { type: "string" },
        },
        required: ["raw_brief"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_job",
      description: "Save a job specification to the jobs table. Call this ONLY after the user confirms the generated spec.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          company_id: { type: "string" },
          raw_brief: { type: "string" },
          full_spec: { type: "string", description: "JSON stringified full spec" },
          job_type: { type: "string" },
          location: { type: "string" },
          remote_policy: { type: "string" },
          salary_min: { type: "number" },
          salary_max: { type: "number" },
          salary_currency: { type: "string" },
          start_date: { type: "string" },
          end_date: { type: "string" },
        },
        required: ["title", "raw_brief", "full_spec"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_adverts",
      description: "Generate tailored job adverts for selected job boards from a job specification. Respects each board's word/character limits and format rules. Supports boards: internal, linkedin, jobserve, reed, own_site, indeed.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "The job UUID to generate adverts for" },
          boards: {
            type: "array",
            items: { type: "string" },
            description: "Array of board names to generate for, e.g. ['linkedin', 'reed', 'indeed']",
          },
        },
        required: ["job_id", "boards"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_shortlist",
      description: "Run AI candidate matching against a job specification. Searches the talent database and produces a ranked shortlist of best matches. Use when the user says 'find candidates for this job', 'shortlist for this job', 'who matches this role', 'run shortlist'.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "The job UUID to run matching for" },
        },
        required: ["job_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "approve_all_shortlist",
      description: "Approve all pending candidates on a job shortlist. Use when the user says 'approve everyone', 'approve all', 'approve the shortlist', 'proceed with everyone'.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "The job UUID" },
        },
        required: ["job_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_shortlist_entry",
      description: "Update a single shortlist entry status or remove it. Use for 'remove [name] from the list', 'move [name] to reserve', 'approve [name]'.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "The job UUID" },
          candidate_name: { type: "string", description: "Candidate name to find" },
          action: { type: "string", description: "One of: approve, remove, reserve, move_to_top" },
        },
        required: ["job_id", "candidate_name", "action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "describe_shortlist_candidate",
      description: "Get detailed info about a shortlisted candidate including match reasons, concerns, and availability. Use when user says 'tell me about [name]', 'who is the best match', 'describe [name]'.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "The job UUID" },
          candidate_name: { type: "string", description: "Candidate name, or 'top' for highest scored" },
        },
        required: ["job_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_outreach_emails",
      description: "Draft personalised outreach emails for approved shortlisted candidates. Use when the user says 'draft outreach', 'email the shortlist', 'send outreach', 'draft emails for [job]'.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "The job UUID" },
          automation_level: { type: "string", description: "draft, approve_batch, or auto_send" },
        },
        required: ["job_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_outreach_status",
      description: "Check how many candidates have been contacted for a job. Use when user asks 'how many have we contacted', 'outreach status for [job]'.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "The job UUID" },
        },
        required: ["job_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_advert",
      description: "Update the content of an existing job advert. Use when the user asks to shorten, rephrase, or modify a specific advert.",
      parameters: {
        type: "object",
        properties: {
          advert_id: { type: "string" },
          instruction: { type: "string", description: "What to change, e.g. 'shorten by 20%' or 'make more benefits-led'" },
          job_id: { type: "string", description: "The parent job ID for context" },
        },
        required: ["advert_id", "instruction", "job_id"],
      },
    },
  },
  // ─── Diary tools ───
  {
    type: "function",
    function: {
      name: "find_diary_slots",
      description: "Find available 30-minute diary slots for the recruiter in the next 5 working days. Use when the user says 'book a call', 'find a time', 'what slots are free', 'schedule a meeting'.",
      parameters: {
        type: "object",
        properties: {
          max_slots: { type: "number", description: "Number of slots to return (default 3)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_diary_event",
      description: "Book a diary event (call/meeting/task/reminder) for the recruiter. Use after the user confirms a time slot. For reminders (remind me to..., follow up with..., call back...), set event_type='reminder' and end_time=start_time — no availability check needed.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          start_time: { type: "string", description: "ISO datetime" },
          end_time: { type: "string", description: "ISO datetime. For reminders, set equal to start_time." },
          event_type: { type: "string", description: "call, meeting, task, or reminder. Use 'reminder' for follow-ups, callbacks, nudges." },
          candidate_name: { type: "string", description: "Candidate name to look up" },
          job_id: { type: "string" },
          contact_name: { type: "string" },
        },
        required: ["title", "start_time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_diary_events",
      description: "Get diary events for today, tomorrow, or a date range. Use when user asks 'what's in my diary', 'what calls do I have today', 'show my schedule'.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "today, tomorrow, this_week, or custom" },
          date_from: { type: "string", description: "ISO date for custom range" },
          date_to: { type: "string", description: "ISO date for custom range" },
        },
        required: ["period"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_diary_event",
      description: "Cancel a diary event. Use when user says 'cancel the call with [name]', 'remove that meeting'.",
      parameters: {
        type: "object",
        properties: {
          candidate_name: { type: "string", description: "Search for event by candidate name" },
          event_id: { type: "string", description: "Direct event ID if known" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reschedule_diary_event",
      description: "Reschedule a diary event to a new time. Use when user says 'reschedule [name] call', 'move that meeting'.",
      parameters: {
        type: "object",
        properties: {
          candidate_name: { type: "string", description: "Search for event by candidate name" },
          event_id: { type: "string", description: "Direct event ID if known" },
          new_start_time: { type: "string", description: "New ISO datetime" },
          new_end_time: { type: "string", description: "New ISO datetime" },
        },
        required: [],
      },
    },
  },
  // ─── Recruitment workflow tools ───
  {
    type: "function",
    function: {
      name: "get_job_applications_summary",
      description: "Get a summary of applications for a specific job — total count, status breakdown, and top-scored applicants. Use when user asks 'how many applications for [job]', 'show me applications for [job]'.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "The job UUID" },
        },
        required: ["job_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "score_unprocessed_applications",
      description: "Trigger AI scoring for all unprocessed applications on a job. Use when user says 'score applications for [job]', 'process new applications'.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "The job UUID" },
        },
        required: ["job_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_reject_low_scoring",
      description: "Reject all applications scoring below a threshold (default 50). ALWAYS ask for confirmation first. Use when user says 'reject low-scoring applications', 'reject all bad applications'.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "The job UUID" },
          threshold: { type: "number", description: "Score threshold below which to reject (default 50)" },
        },
        required: ["job_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_shortlist_summary",
      description: "Get a summary of the shortlist for a job — counts by status, top candidates. Use when user asks 'shortlist status for [job]', 'how is the shortlist looking'.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "The job UUID" },
        },
        required: ["job_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_unresponsive_candidates",
      description: "List candidates who haven't responded to outreach for a job. Use when user says 'who haven't we heard from', 'unresponsive candidates for [job]'.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "The job UUID" },
        },
        required: ["job_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookup_job",
      description: "Look up a job by title within the user's workspace. Use this to find a job_id before running recruitment actions like shortlisting, scoring, or outreach.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Job title to search for" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_applicant_update",
      description: "Send an automated status update email to an applicant when their application status changes. Use when updating application status.",
      parameters: {
        type: "object",
        properties: {
          application_id: { type: "string" },
          new_status: { type: "string" },
          old_status: { type: "string" },
        },
        required: ["application_id", "new_status"],
      },
    },
  },
  // ─── Golden Thread: Job-Project-Deal linkage tools ───
  {
    type: "function",
    function: {
      name: "get_unlinked_jobs",
      description: "List all active jobs that are NOT linked to a project. Use when user asks 'what jobs aren't tracked', 'show me unlinked jobs', 'which jobs need a project'.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recruitment_pipeline_value",
      description: "Get total pipeline value from recruitment placement deals this month. Use when user asks 'recruitment pipeline value', 'placement fee total', 'how much is recruitment worth this month'.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "link_job_to_project",
      description: "Link a job to a CRM project. Use when user says 'link this job to a project', 'connect job to project'. Requires job_id and project_id.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "The job UUID" },
          project_id: { type: "string", description: "The CRM project UUID" },
        },
        required: ["job_id", "project_id"],
      },
    },
  },
  // ─── CRUD tools ───
  {
    type: "function",
    function: {
      name: "update_record",
      description: "Update any CRM record — company, contact, deal, opportunity, engagement/project, or invoice. Use when user says 'change', 'update', 'edit', 'set', 'rename', 'mark as'.",
      parameters: {
        type: "object",
        properties: {
          entity_type: { type: "string", enum: ["company","contact","deal","opportunity","engagement","invoice","candidate"] },
          entity_id: { type: "string" },
          fields: { type: "object", description: "Key-value pairs of fields to update" },
        },
        required: ["entity_type", "entity_id", "fields"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_record",
      description: "Delete a CRM record. ALWAYS confirm with user first. Use when user says 'delete', 'remove', 'get rid of'.",
      parameters: {
        type: "object",
        properties: {
          entity_type: { type: "string", enum: ["company","contact","deal","opportunity","engagement","candidate"] },
          entity_id: { type: "string" },
          entity_name: { type: "string", description: "Human readable name for confirmation" },
        },
        required: ["entity_type", "entity_id", "entity_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_candidate",
      description: "Add a new candidate to the Talent Database.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          current_title: { type: "string" },
          current_company: { type: "string" },
          location: { type: "string" },
          skills: { type: "string", description: "Comma-separated list of skills" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_and_send_invoice",
      description: "Generate an invoice PDF and email it to the client. Use when user says 'send the invoice', 'email the invoice to the client', 'generate and send invoice'.",
      parameters: {
        type: "object",
        properties: {
          invoice_id: { type: "string" },
          contact_id: { type: "string", description: "Contact to send invoice to" },
        },
        required: ["invoice_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "initiate_ai_call",
      description: "DIRECT BACKGROUND CALL — only use when the user explicitly asks to dial immediately WITHOUT review (e.g. 'just dial them now, no script review'). For the standard 'call [name]' / 'AI call [name]' workflow, prefer start_ai_call_workflow which opens the AI Call modal on the candidate's screen so the user can review the script and press Initiate manually.",
      parameters: {
        type: "object",
        properties: {
          contact_id: { type: "string", description: "Contact or candidate ID to call" },
          phone_number: { type: "string", description: "Phone number if not in CRM" },
          purpose: { type: "string", description: "Purpose of the call e.g. follow-up, intro call" },
          custom_instructions: { type: "string", description: "Any specific talking points or instructions" },
        },
        required: ["purpose"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_ai_call_workflow",
      description: "PREFERRED for 'AI call [name]' / 'phone [name]' / 'call [candidate]'. Opens the candidate's profile in the Talent screen and automatically opens the AI Call modal, optionally pre-filling the purpose and brief in real time. Use this so the user can SEE the workflow happen on screen, review/edit the script, then press Initiate Call themselves. Do NOT place the call yourself — this tool only navigates and prepares the modal.",
      parameters: {
        type: "object",
        properties: {
          candidate_query: { type: "string", description: "Name, email, or fragment used to look up the candidate (e.g. 'Michael Smith', 'mike@acme')." },
          candidate_id: { type: "string", description: "Optional: candidate ID if already known from earlier in the conversation." },
          purpose: { type: "string", description: "Optional: nature of the call to pre-fill (e.g. 'Book a meeting', 'Intro Call', 'Follow Up', 'Demo Confirmation')." },
          brief: { type: "string", description: "Optional: short brief / talking points to pre-fill the script box. The user can refine before sending." },
          auto_enhance: { type: "boolean", description: "If true, the modal automatically asks the AI to enhance the brief into a full voice-agent script as soon as it opens." },
        },
        required: ["candidate_query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_sow",
      description: "Create a Statement of Work linked to a company and engagement. Use when user says 'create a SOW', 'new statement of work', 'add a SOW for [company]'.",
      parameters: {
        type: "object",
        properties: {
          company_id: { type: "string" },
          engagement_id: { type: "string" },
          sow_ref: { type: "string", description: "SOW reference number e.g. SOW-001" },
          value: { type: "number" },
          currency: { type: "string" },
          billing_model: { type: "string", description: "fixed, retainer, or time_and_materials" },
          start_date: { type: "string" },
          end_date: { type: "string" },
          notes: { type: "string" },
        },
        required: ["company_id", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_outreach_campaign",
      description: "Create a new outreach campaign. Use when user says 'create a campaign', 'new outreach campaign', 'start a campaign for [job/purpose]'.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          channel: { type: "string", description: "email, sms, call, or linkedin" },
          description: { type: "string" },
        },
        required: ["name", "channel"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_to_outreach",
      description: "Add a contact or candidate to an outreach campaign target queue. Use when user says 'add [name] to outreach', 'put [name] in the campaign queue', 'add to outreach queue'.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string" },
          contact_id: { type: "string", description: "Contact UUID" },
          candidate_id: { type: "string", description: "Candidate UUID" },
          entity_name: { type: "string" },
          entity_email: { type: "string" },
          entity_phone: { type: "string" },
        },
        required: ["campaign_id", "entity_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_note",
      description: "Add a note to a contact or company record. Use when user says 'add a note', 'make a note', 'note that', 'write this down about [name]'.",
      parameters: {
        type: "object",
        properties: {
          entity_type: { type: "string", enum: ["contact", "company"], description: "Whether this note is for a contact or company" },
          entity_id: { type: "string", description: "The UUID of the contact or company" },
          content: { type: "string", description: "The note text to save" },
          pinned: { type: "boolean", description: "Whether to pin this note. Default false." },
        },
        required: ["entity_type", "entity_id", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_invoice_paid",
      description: "Mark an invoice as paid. Use when user says 'mark invoice paid', '[company] paid', 'invoice received'.",
      parameters: {
        type: "object",
        properties: {
          invoice_id: { type: "string" },
          company_name: { type: "string", description: "Use to look up invoice if no ID" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_talent",
      description: "Search the talent database for candidates matching a role. Use when user asks to find candidates, search CVs, match talent, or run a shortlist. Converts natural language into a scored match against all candidates. Results are anonymised — names hidden until user requests reveal. Use this for: 'find me a BA', 'search for a Python developer', 'who do we have with SAP experience', 'match candidates to this role'.",
      parameters: {
        type: "object",
        properties: {
          role_title: { type: "string", description: "The job title or role to search for e.g. 'Senior Business Analyst'" },
          key_skills: { type: "array", items: { type: "string" }, description: "Skills to match e.g. ['Python', 'AWS', 'Agile']" },
          sector: { type: "string", description: "Industry sector e.g. 'banking', 'technology', 'healthcare'" },
          location: { type: "string", description: "Preferred location e.g. 'London'" },
          min_years_experience: { type: "number", description: "Minimum years of relevant experience" },
          job_id: { type: "string", description: "Optional — link results to an existing job if user is searching for a specific open role" },
        },
        required: ["role_title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "universal_search",
      description: "GLOBAL SEARCH across the entire system. Use this when the user asks to find ANY record by ANY field — first name only, surname only, partial email, phone digits, company, job title, project name, deal title, invoice number, candidate skill, location, headline, etc. Also use it for date-bounded queries ('deals closing this month', 'projects started in Jan'). Searches: candidates, contacts, crm_contacts, companies, crm_companies, crm_projects, crm_deals, crm_opportunities, crm_invoices, jobs. Prefer this over lookup_* when the user gives a fragment, a single token, or asks broadly ('find Michael', 'anything about Acme', 'invoice 1042').",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text query — any fragment, token, name, email, phone, number, keyword. Required." },
          entity_types: {
            type: "array",
            items: { type: "string", enum: ["candidate","contact","crm_contact","company","crm_company","project","deal","opportunity","invoice","job"] },
            description: "Optional — restrict to specific entity types. Leave empty to search everything.",
          },
          date_from: { type: "string", description: "Optional ISO date (YYYY-MM-DD) — only return records created on/after this date." },
          date_to: { type: "string", description: "Optional ISO date (YYYY-MM-DD) — only return records created on/before this date." },
          limit_per_type: { type: "number", description: "Max results per entity type. Default 10." },
        },
        required: ["query"],
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
9. RULE: After ANY tool call, check the result object. If it contains an 'error' field, you MUST report the failure clearly — never say 'Done', 'Created', or 'Saved' if the tool returned an error. Say exactly what failed and why.
10. UNIVERSAL SEARCH RULE — CRITICAL: If the user asks to find, search for, look up, or list ANY person, record, or entity by a name, fragment, email, phone, number, keyword, or company (e.g. "find all Michaels", "search for Michael", "any candidate called John", "look up Acme", "show me invoice 1042", "everyone named Sarah") — you MUST call \`universal_search\` with that text as \`query\`. NEVER refuse a name-only search. NEVER demand role title, skills, location, or any other field — \`universal_search\` accepts a single fragment and returns matches across name, email, phone, title, company, location, headline and more. Only use \`search_talent\` when the user explicitly describes a ROLE or SKILL set (e.g. "find me a Python developer", "shortlist BAs", "candidates with SAP experience"). For plain-name talent lookups, ALWAYS use \`universal_search\` with entity_types=["candidate"].
11. NAVIGATE-FIRST, DON'T-READ-EVERYTHING RULE (CRITICAL UX RULE): When you run ANY search (universal_search, search_talent, search_companies, search_contacts, search_deals, etc.) you MUST:
    a) ALWAYS use the \`navigate_to\` URL returned by the search tool so the user lands on the relevant list page with the search pre-applied — they SEE the results on screen. Set the response \`navigate_to\` to that URL.
    b) NEVER enumerate every result aloud. NEVER read out long lists of names, emails, companies, deals, etc.
    c) Reply with a SHORT summary only — e.g. "I've opened the Talent page and filtered for 'Michael' — 14 matches. Want me to read the top 10, or take it from here?"
    d) Then WAIT for the user. Only if they explicitly say "yes, read them" / "top 10 please" / "list them" should you read out a numbered list, capped at 10.
    e) The same rule applies for every action you take — navigate to the relevant CRM screen first, narrate one short sentence about what is now visible, and ask if they want to do anything else. The user must always be able to take over manually from the screen you've opened.

RULE — NAVIGATE BEFORE ACTING (critical):
When asked to do something TO or FOR a specific person or company (add a note, log a call, send an email, update a field), you MUST:
STEP 1: Navigate to their record FIRST using navigate_to_contact_record or navigate_to_company_record. Do this immediately — do not ask questions first.
STEP 2: Confirm you have found them: "I've opened [Name]'s record. Now I'll add the note."
STEP 3: THEN collect any missing information needed.
STEP 4: THEN execute the write tool (add_note, log_call etc).
This is the correct order: NAVIGATE → CONFIRM → COLLECT → EXECUTE
NOT the wrong order: COLLECT → EXECUTE → NAVIGATE (this causes the glitch)
Example — "Add a note on Ken Beinert saying he called back":
RIGHT: navigate_to_contact_record("Ken Beinert") → say "I've opened Ken's record" → say "What would you like the note to say?" → add_note(entity_type="contact", entity_id=ken_id, content=...)
Example — "Log a call with Ken":
RIGHT: navigate_to_contact_record("Ken Beinert") → say "I've opened Ken's record. How did the call go?" → log_call(contact_id=ken_id, ...)
Example — "Add a note to Iseg saying they are expanding":
RIGHT: navigate_to_company_record("Iseg") → say "I've opened Iseg's record. Adding your note now." → add_note(entity_type="company", entity_id=iseg_id, ...)
AFTER CREATION RULE: When you have JUST created a contact or company in the same conversation and the user asks to do something with them, you ALREADY have their ID from the creation tool result. Use that ID directly — call navigate_to_contact_record with their name, then proceed. Do NOT say you cannot find them.

NAVIGATION RULE FOR ACTIONS: When executing any tool that creates, updates, or sends something, you MUST include navigate_to in the result so the UI can take the user to the relevant page after the action completes. Examples:
- After create_company → navigate_to: "/companies"
- After create_contact → navigate_to: "/contacts"
- After create_deal → navigate_to: "/crm/deals"
- After create_candidate → navigate_to: "/talent"
- After create_sow → navigate_to: "/home"
- After send_email or send_sms → navigate_to: "/contacts"
- After initiate_ai_call → navigate_to: "/contacts"
- After mark_invoice_paid → navigate_to: "/crm/invoices"
- After generate_and_send_invoice → navigate_to: the invoice detail page
The navigate_to value is already set by most tools — just make sure you don't override it. When narrating what happened, tell the user they can see the result on the relevant page.

CONFIRMATION LANGUAGE:
- After a successful create_company: say "[Name] has been added. You can see it on the Companies page now."
- After create_contact: "[Name] has been added to your Contacts and linked to [Company]."
- After create_invoice: "Invoice [number] has been created for £[total]. Want me to generate the PDF and send it?"

ADDITIONAL INTENT PATTERNS:
- "call [name]" / "phone [name]" → initiate_ai_call
- "send the invoice" / "email invoice to [name]" → generate_and_send_invoice
- "find me a [role]" / "search for candidates" / "who do we have with [skill]" / "match candidates" / "run a search" → search_talent
- When search_talent returns results, present them as a numbered list showing rank, score, title, company, and tenure. Always end with: "Tap 'Reveal' next to any candidate on the Talent page to see their name and contact details."
- PRIVACY RULE: Never reveal candidate names from search_talent results. The match engine anonymises all results. Names are only shown after the user taps Reveal in the UI.

UNIVERSAL SEARCH — use \`universal_search\` when the user gives ANY fragment that could match across the database:
- Single token like "Michael", "Acme", "1042", "London", a partial email, a phone fragment.
- "find anything about X", "who is X", "show me everything for X", "search for X".
- Date-bounded queries like "deals from this month", "projects started in January" (pass date_from/date_to).
- When the user wants a specific entity type, set entity_types e.g. ["candidate"], ["deal","invoice"]. Otherwise leave empty to search ALL.
- ALWAYS prefer universal_search over lookup_candidate / lookup_contact / lookup_company when the input is a single word or fragment — it returns matches across every field (name, email, phone, title, company, location, headline, project name, deal title, invoice number, etc.) and across every entity type.
- Present results grouped by type, e.g. "Candidates: Michael Smith (Senior Dev @ Acme), Michael Jones (PM)…  Contacts: Michael Brown @ Globex…  Deals: Michael Project Phase 2 (£40k, Won)…". Include id-less names only — never expose UUIDs.
- "mark [company] invoice paid" / "[company] paid" → mark_invoice_paid
- "create a SOW for [company]" → create_sow
- "new campaign" / "create outreach campaign" → create_outreach_campaign
- "add [name] to outreach" / "add to campaign queue" → add_to_outreach
- "add a candidate" / "new candidate [name]" → create_candidate
- "update [entity] [field] to [value]" / "change [field]" → update_record
- "delete [entity]" / "remove [name]" → delete_record (ALWAYS confirm first)
- "add a note on [name]" / "make a note about [name]" / "note that [name] said X" / "write down that [company] is expanding" → add_note

NOTE intents — "add a note on [name]", "make a note about [name]", "note that [name] said X", "write down that [company] is expanding":
1. Navigate to their record first (navigate_to_contact_record or navigate_to_company_record)
2. If note content not yet provided: "What would you like the note to say?"
3. Once confirmed: call add_note with the entity_id from the navigation result
4. After success: "Note saved on [name]'s record."

UPDATE intents — "change the deal value to £50k", "mark invoice as paid", "update Ken's job title to CTO", "rename the project to X":
- Ask the user to confirm the change before calling update_record.
- After success: "Done — [field] updated to [new value]."

DELETE intents — ALWAYS say: "Are you sure you want to delete [name]? This cannot be undone." and wait for explicit 'yes' before calling delete_record. Never delete without confirmation.

CREATE CANDIDATE flow — "add a candidate", "new candidate", "add [name] to talent":
1. "What's their full name?"
2. "What's their current role and company?"
3. "What's their email and phone?"
4. "What are their key skills? List them."
5. "Where are they based?"
6. Confirm and create.

CREATE SOW flow — "create a SOW", "new SOW for [company]":
1. "Which company is this SOW for?" (use existing session company if available)
2. "What's the SOW reference number? e.g. SOW-001"
3. "What's the value? And currency — GBP, USD, EUR?"
4. "Billing model — fixed fee, retainer, or time and materials?"
5. "Start and end dates?"
6. Confirm and create.

INVOICE SEND intents — "send the invoice", "email the invoice", "send invoice to [contact]":
- If no invoice_id in context: "Which invoice? I can look it up — what's the company or deal name?"
- If no contact_id: "Who should I send it to? I'll look up the contact."
- Confirm: "I'll generate the PDF for invoice [number] (£[total]) and email it to [name] at [email]. Shall I go ahead?"
- After success: "Done — invoice [number] has been generated and sent to [name]. I've also logged it in the CRM."

CALL intents — "call [name]", "phone [name]", "make a call":
1. Look up the contact/candidate using lookup_contact or lookup_candidate.
2. If they have a phone number: "I'll call [name] at [number]. What's the purpose of the call?"
3. If no number: "I can't find a phone number for [name]. Do you have their number?"
4. Confirm: "I'll initiate an AI call to [name] at [number] for [purpose]. Shall I go ahead?"
5. After success: "Call connected to [name]. I've logged it on their record."

NAVIGATION INTENT DETECTION — detect these patterns and respond accordingly:

NAVIGATE intents (phrases like "take me to X", "go to X", "open X", "show me X"):
- Call the navigate tool with the destination immediately.
- Respond with a short confirmation like "Taking you to Contacts now."

HIGHLIGHT intents (phrases like "where is X", "where do I find X"):
- Call the navigate tool with the destination.
- Respond explaining where the feature is and what it does.

GUIDED TOUR intents (phrases like "how do I X", "walk me through X", "show me how to X", "I want to add X"):
- Instead of just navigating, return a structured guided_tour in your response.
- Format your response as a conversational message, then on a new line add a JSON block wrapped in <guided_tour>...</guided_tour> tags.
- CRITICAL TOUR RULES:
  1. ONE GLOW AT A TIME — each step automatically clears the previous highlight. Never worry about overlapping.
  2. USE "clickAndOpen" for tabs — when showing a tab (e.g. Campaigns, Scripts), use "clickAndOpen" to click it open AND keep it glowing while you speak about it. This lets the user see what's INSIDE the tab.
  3. After opening a tab with clickAndOpen, highlight individual elements INSIDE that tab in subsequent steps.
  4. Speak happens AFTER the highlight/click, so the user sees the element before hearing about it.
  5. The highlight stays active until the next step starts.
- Available step properties: navigate (path), highlight (element ID — glow only), click (glow briefly then click, clears glow after), clickAndOpen (click to open AND keep glowing), speak (text), delay (ms).
- Example for "show me how to add a company":
  Response: "I'll show you how to add a company. Watch the screen."
  <guided_tour>[
    {"navigate":"/companies","highlight":"nav-companies","speak":"First, let me take you to Companies.","delay":1500},
    {"highlight":"add-company-button","speak":"This is the Add Company button.","delay":2500},
    {"click":"add-company-button","speak":"I'll open it for you.","delay":1500},
    {"highlight":"company-name-input","speak":"Enter the company name here.","delay":1500}
  ]</guided_tour>
- Available element IDs for highlights/clicks:
  Navigation: nav-home, nav-companies, nav-contacts, nav-talent, nav-outreach, nav-insights, nav-canvas, nav-projects, nav-admin.
  Companies page: add-company-button, companies-search-input, companies-filter-industry, companies-filter-country, companies-import-button, companies-team-settings.
  Company detail: company-tab-overview, company-tab-contacts, company-tab-deals, company-tab-projects, company-tab-documents, company-tab-activities, company-tab-canvas, company-tab-invoices, company-edit-button, company-add-contact-button, company-log-call-button, company-send-email-button, company-open-canvas-button, company-build-orgchart-button.
  Contacts page: add-contact-button, contacts-search-input, contacts-import-button, contacts-view-orgchart-button.
  Talent page: add-candidate-button, talent-search-input, talent-import-button, talent-filter-availability, talent-filter-role-type, talent-boolean-search-toggle.
  Outreach page: new-campaign-button, add-targets-button, new-script-button, outreach-tab-queue, outreach-tab-campaigns, outreach-tab-scripts.
  Insights page: insights-risk-snapshot, insights-relationship-strength, insights-pipeline-signals, insights-sales-momentum, insights-org-penetration.
   Home page: home-create-invoice-button, home-add-sow-button, home-create-project-button, home-create-deal-button, home-billing-snapshot, home-pipeline-snapshot, home-diary, home-my-work.
   Jobs page: add-job-button, job-tab-overview, job-tab-adverts, job-tab-shortlist, job-tab-applications, job-generate-spec-button, job-generate-adverts-button, job-run-shortlist-button, job-publish-button, job-send-outreach-button.
   Admin pages: admin-workspace-roles, admin-data-quality, admin-outreach-defaults, admin-billing-invoices, admin-schema-inventory, admin-integrations, admin-jarvis-settings.
   Canvas page: canvas-page, canvas-add-node-button, canvas-edit-button, canvas-zoom-in, canvas-zoom-out, canvas-fit-view, canvas-company-select, canvas-build-orgchart, canvas-ai-research, canvas-connect-tool, canvas-delete-node, canvas-save-layout.
  Forms: company-name-input, contact-first-name-input, contact-email-input, contact-company-select, deal-value-input, deal-stage-select, notes-input, save-button.

CANVAS ORG CHART GUIDED TOURS — when user asks about editing, building, or manipulating an org chart:
- "edit org chart" / "move org chart structure" / "rearrange org chart" / "move people around on the chart" / "rearrange the org structure":
  <guided_tour>[
    {"navigate":"/canvas","speak":"Opening Canvas now.","delay":500},
    {"highlight":"canvas-company-select","speak":"First select the company whose org chart you want to edit.","delay":2500},
    {"highlight":"canvas-edit-button","speak":"Then click Edit to enter edit mode. You can then drag and move any person on the chart.","delay":3000},
    {"highlight":"canvas-add-node-button","speak":"Use this button to add new people to the chart.","delay":3000},
    {"highlight":"canvas-connect-tool","speak":"Use this tool to draw reporting lines between people.","delay":3000},
    {"highlight":"canvas-save-layout","speak":"When you're done, click Save to keep your changes.","delay":2000}
  ]</guided_tour>
- "build org chart" / "create org chart":
  <guided_tour>[
    {"navigate":"/canvas","speak":"Let me take you to Canvas.","delay":500},
    {"highlight":"canvas-company-select","speak":"First, select the company you want to build an org chart for.","delay":2500},
    {"highlight":"canvas-build-orgchart","speak":"Click Build Org Chart to create a structure from your contacts.","delay":3000}
  ]</guided_tour>
- "research company structure" / "ai research org":
  <guided_tour>[
    {"navigate":"/canvas","speak":"Opening Canvas now.","delay":500},
    {"highlight":"canvas-company-select","speak":"Select the company you want to research.","delay":2500},
    {"highlight":"canvas-ai-research","speak":"Click AI Assistant to research the company structure using public sources.","delay":3000}
  ]</guided_tour>

SMART INTENT MATCHING — map vague or natural language to the correct action. Use these examples as patterns:

Canvas intents:
- "show me the org chart for [company]" / "open canvas for [company]" / "take me to canvas for [company]" → use navigate_to_canvas_for_company tool with the company name. This searches the database and navigates to /canvas?company=[id].
- "add someone to the org chart" / "add a person to the chart" → navigate to canvas, click canvas-add-node-button
- "connect two people" / "link people" / "draw a reporting line" → navigate to canvas, click canvas-connect-tool
- "I want to see the chart properly" / "zoom to fit" / "show the full chart" / "I can't see the full chart" → navigate to canvas, click canvas-fit-view
- "save the chart" / "save the layout" → navigate to canvas, click canvas-save-layout
- "zoom in on the chart" → navigate to canvas, click canvas-zoom-in
- "remove [name] from the chart" / "delete that node" → navigate to canvas, highlight canvas-delete-node, ask for confirmation before clicking
- "move [person] to report to [person]" → navigate to canvas, highlight the relevant canvas-node-[slugified-name], explain they need to use Edit Structure mode and drag the node

Company/Contact intents:
- "open [name]'s contact record" / "show me [name]'s contact" / "go to [name]'s page" / "take me to [name]" → use navigate_to_contact_record tool with the contact name. This searches the database and navigates directly to /contacts/[id]. ALWAYS use this tool when the user asks to open, view, or go to a specific person's contact record. Do NOT just navigate to /contacts list page.
- "open [company name]" / "show me [company]'s record" / "go to [company]" → use navigate_to_company_record tool with the company name. This searches the database and navigates directly to /companies/[id]. ALWAYS use this tool when the user asks to open, view, or go to a specific company's page.
- "filter my companies by industry" / "sort companies by sector" → navigate to /companies, highlight companies-filter-industry, explain it filters the list
- "search for a contact" / "find someone" / "look up a person" → navigate to /contacts, highlight contacts-search-input, explain they can type a name or email
- "import my contacts" / "upload a spreadsheet of contacts" → navigate to /contacts, highlight contacts-import-button

Talent intents:
- "run a boolean search" / "advanced search for candidates" / "use boolean operators":
  <guided_tour>[
    {"navigate":"/talent","speak":"Let me take you to the Talent Database.","delay":500},
    {"highlight":"talent-boolean-search-toggle","speak":"Toggle this on to enable Boolean search. You can use AND, OR, NOT, quotes for exact phrases, and parentheses to group terms.","delay":4000},
    {"highlight":"talent-search-input","speak":"Then type your search query here. For example: React AND (Senior OR Lead) NOT Junior.","delay":3000}
  ]</guided_tour>

Admin/Settings intents:
- "where do I set up email" / "configure email integration" / "set up Resend" / "how do I send emails":
  <guided_tour>[
    {"navigate":"/admin/integrations","speak":"Let me take you to the Integrations settings.","delay":500},
    {"highlight":"admin-integrations","speak":"This is where you configure all your API keys. To send emails, you need a Resend API key. Click on the Resend section.","delay":3500},
    {"speak":"You'll need to sign up at resend.com, create an API key, and paste it here. Once set, you can send emails from the CRM, outreach campaigns, and contact pages.","delay":4000}
  ]</guided_tour>
- "where do I set up SMS" / "configure SMS" / "set up Twilio" / "how do I send text messages":
  <guided_tour>[
    {"navigate":"/admin/integrations","speak":"Let me take you to Integrations.","delay":500},
    {"highlight":"admin-integrations","speak":"For SMS, you need a Twilio API key. Twilio provides the phone number and messaging service.","delay":3500},
    {"speak":"Sign up at twilio.com, get your Account SID and Auth Token, then paste them here. Once configured, you can send SMS from outreach and contact pages.","delay":4000}
  ]</guided_tour>
- "where do I set up AI calls" / "configure AI calling" / "set up ElevenLabs" / "how do AI voice calls work":
  <guided_tour>[
    {"navigate":"/admin/integrations","speak":"Let me show you the AI Calling setup.","delay":500},
    {"highlight":"admin-integrations","speak":"AI Calling requires two integrations: Twilio for phone calls and ElevenLabs for the AI voice. Both API keys go here.","delay":4000},
    {"speak":"Once both are configured, you can make AI-powered calls from the outreach queue. The AI follows scripts you create in the Scripts tab and logs outcomes automatically.","delay":4500}
  ]</guided_tour>
- "how do I set up all integrations" / "walk me through API keys" / "what API keys do I need":
  <guided_tour>[
    {"navigate":"/admin/integrations","speak":"Let me walk you through all the integrations.","delay":500},
    {"highlight":"admin-integrations","speak":"This page has four integrations. Resend for email, Twilio for SMS and phone calls, ElevenLabs for AI voice, and Anthropic for advanced AI features.","delay":4500},
    {"speak":"Each one needs an API key from the provider. I recommend setting up Resend first for email, then Twilio for SMS. ElevenLabs is optional but enables realistic AI voice calls.","delay":4500},
    {"speak":"Once your keys are saved, the features unlock automatically across the CRM. You'll see email, SMS, and call buttons appear on contact and outreach pages.","delay":4000}
  ]</guided_tour>
- "how do I invite a team member" / "add someone to my workspace" / "manage roles":
  <guided_tour>[
    {"navigate":"/admin","speak":"Let me take you to Admin.","delay":500},
    {"highlight":"admin-workspace-roles","speak":"Click here to open Team Management where you can invite new members and assign roles.","delay":3000}
  ]</guided_tour>

Home/Dashboard intents:
- "show me my pipeline" / "where is the pipeline" / "pipeline overview" → navigate to /home, highlight home-pipeline-snapshot, explain it shows pipeline value by stage
- "I want to see revenue" / "show revenue data" / "revenue overview" → navigate to /executive-insights, highlight insights-risk-snapshot, explain the revenue intelligence dashboard

Outreach intents:
- "create a new outreach script" / "write a call script" → navigate to /outreach, click new-script-button
- "add targets to my campaign" / "add people to outreach" → navigate to /outreach, highlight add-targets-button
- "show me the campaigns tab" / "explain campaigns" / "how do campaigns work" / "walk me through outreach":
  <guided_tour>[
    {"navigate":"/outreach","speak":"Let me take you to the Outreach page.","delay":500},
    {"clickAndOpen":"outreach-tab-queue","speak":"This is the Target Queue tab. I am opening it now so you can see it clearly.","delay":2200},
    {"highlight":"outreach-panel-queue","speak":"Inside this panel, you can filter targets and run outreach actions like Email, SMS, Manual Call, and AI Call.","delay":3200},
    {"highlight":"add-targets-button","speak":"Use this button to add new targets to your outreach queue.","delay":2500},
    {"clickAndOpen":"outreach-tab-campaigns","speak":"Now I am opening the Campaigns tab.","delay":2200},
    {"highlight":"outreach-campaigns-list","speak":"These campaign cards show status, channel, volume, and conversion so you can manage performance quickly.","delay":3200},
    {"highlight":"new-campaign-button","speak":"Click here to create a new campaign and choose your channel strategy.","delay":2800},
    {"clickAndOpen":"outreach-tab-scripts","speak":"Now I am opening the Scripts tab.","delay":2200},
    {"highlight":"outreach-scripts-list","speak":"This area contains your reusable script templates for calls, email, and SMS.","delay":3000},
    {"highlight":"new-script-button","speak":"Create a new script here. Set the purpose, tone, and key questions for the AI.","delay":2800},
    {"clickAndOpen":"outreach-tab-queue","speak":"I will return to the queue so you can launch outreach actions immediately.","delay":2600}
  ]</guided_tour>
- "explain the target queue" / "how does the queue work" / "what is the target queue":
  <guided_tour>[
    {"navigate":"/outreach","speak":"Let me show you the Target Queue.","delay":500},
    {"clickAndOpen":"outreach-tab-queue","speak":"I am opening the Target Queue now.","delay":2200},
    {"highlight":"outreach-panel-queue","speak":"The Target Queue shows every contact queued for outreach with status, campaign, and fast action controls.","delay":3500},
    {"highlight":"add-targets-button","speak":"Use this button to add more targets to your active campaign. You can search contacts or import a list.","delay":3000}
  ]</guided_tour>

LOST USER intent ("I'm lost", "help me", "help", "where am I", "what can you do", "I don't know where I am"):
- Navigate to /home and offer a menu of common tasks using SHOW_MENU action.
- Text: "No worries! Here are the main areas I can help with."
- <action>{"type":"SHOW_MENU","options":["Home Dashboard","Companies","Contacts","Talent Database","Outreach","Revenue Intelligence","Canvas Org Chart","Projects","Admin Settings"]}</action>

CONTEXTUAL SUGGESTIONS — when the user asks "what can I do here", "what are my options", "what's available here":
Respond based on the CURRENT page (last entry in nav_history):
- /companies: "You can add a company, filter by industry, import from CSV, or click any company to view its details."
- /canvas: "You can search for a company, build their org chart, edit node positions, add people, or draw reporting lines."
- /contacts: "You can add contacts, import a list, search by name or company, or view someone's activity history."
- /talent: "You can search candidates, use boolean search, filter by availability, or add a new candidate."
- /outreach: "You can create a campaign, add targets, write scripts, or view your outreach queue."
- /insights or /executive-insights: "This page shows your revenue intelligence. Scroll down to see relationship scores, pipeline signals, and org penetration."
- /home: "This is your command centre. You can create invoices, deals, projects, view your diary, or check pipeline stats."
- /admin: "From here you can manage team roles, integrations, branding, billing settings, and data quality."
- /projects: "You can view all active projects, create new ones, or click into a project for details."
- For any other page, describe what you know about it or offer the help menu.

WHAT HAVE WE LOOKED AT — when the user asks "what have we looked at", "where have we been", "recent pages":
- Use the nav_history to list the last 5 unique pages visited by their labels.
- Example: "Here's what we've looked at: Companies, then Canvas, then Admin, then Contacts, and now Insights."

STRUCTURED ACTION RESPONSE — In addition to your spoken message, you MUST include an <action> JSON block for ANY navigation, highlighting, tour, or menu action. Format:

<action>{"type":"NAVIGATE","destination":"companies"}</action>
<action>{"type":"NAVIGATE","destination":"canvas","highlight":"canvas-add-node-button","label":"Add Person"}</action>
<action>{"type":"GUIDED_TOUR","steps":[...]}</action>
<action>{"type":"HIGHLIGHT","highlight":"add-company-button","label":"Add Company button"}</action>
<action>{"type":"CLICK","highlight":"canvas-fit-view","label":"Fit to screen"}</action>
<action>{"type":"SHOW_MENU","options":["Home Dashboard","Companies","Contacts","Talent Database","Outreach","Revenue Intelligence","Canvas Org Chart","Projects","Admin Settings"]}</action>
<action>{"type":"NONE"}</action>

Action types:
- NAVIGATE: Go to a page. Include "destination" (navigation map key or path). Optionally "highlight" and "label".
- GUIDED_TOUR: Multi-step walkthrough. Include "steps" array (same format as guided_tour).
- HIGHLIGHT: Highlight an element without navigating. Include "highlight" (data-jarvis-id) and "label".
- CLICK: Highlight then click an element. Include "highlight" (data-jarvis-id).
- SHOW_MENU: Show clickable menu options. Include "options" array of strings.
- CREATE: Data creation intent. Include "intent" (e.g. "company") and "fields" with extracted values.
- NONE: No UI action needed.

ALWAYS include an <action> block when performing navigation or UI actions. Use NONE for pure conversation.

FALLBACK DISCOVERY — when you receive a request you don't recognise or can't map to a known page/action:
1. First, try to fuzzy-match the user's words against ALL known page names, button labels, tab names, and element IDs listed above.
2. If you find a plausible match — navigate there and highlight it. Say: "I found something that might be what you're looking for. Does this help?"
3. If you truly cannot find any match, respond with:
   - Text: "I couldn't find that. Here's what I can help with."
   - <action>{"type":"SHOW_MENU","options":["Home Dashboard","Companies","Contacts","Talent Database","Outreach","Revenue Intelligence","Canvas Org Chart","Projects","Admin Settings"]}</action>
- IMPORTANT: Before falling back to SHOW_MENU, ALWAYS try to search for a keyword match first.

GUIDED DATA COLLECTION — follow these flows when creating records:

SMART EXTRACTION: If the user provides multiple fields at once (e.g. "Add Google as a tech company"), extract ALL provided fields and skip those questions. Only ask about fields NOT yet provided.

SKIP HANDLING: If the user says "skip", "not sure", "none", or "no" for an optional field — leave it blank and move on immediately.

MEMORY: Never re-ask for information already provided in the conversation.

SESSION ENTITY MEMORY — CRITICAL FOR MULTI-STEP WORKFLOWS:
When you create an entity (company, contact, project, etc.), the tool returns an ID. You MUST remember this ID for the remainder of the conversation. If the user then says "add a contact to that company" or "create a project for them", use the ID you already have — DO NOT call lookup_company again. Only call lookup if you genuinely don't know the entity.

Example multi-step flow:
1. User: "Add a company called Acme in London"
2. You create the company → get back id "abc123"
3. User: "Now add John Smith as a contact there"
4. You ALREADY KNOW the company_id is "abc123" — use it directly in create_contact. Do NOT call lookup_company.

SPELLING VERIFICATION — CRITICAL:
Before creating ANY company, you MUST confirm the spelling with the user. Voice input can mishear names.
- After hearing the company name, display it in chat and ask: "I heard the company name as **[Name]**. Is that correct, or would you like to edit it?"
- Wait for confirmation before proceeding.
- If the user says "yes" or "correct", continue with the flow.
- If they provide a correction, use the corrected name.

DUPLICATE CHECKING — CRITICAL:
Before creating a company, ALWAYS call lookup_company first to check if it already exists.
- If a match is found: tell the user "I found an existing company called **[Name]** [in Location]. Did you mean this one, or is this a different office/entity?"
- If the user confirms it's the same: use the existing company ID.
- If the user says it's different (e.g. different office location): proceed to create with a distinguishing detail (e.g. "LSEG New York" vs "LSEG London").
- NEVER create a company without checking first.

OFFICE LOCATION — REQUIRED:
When creating a company, ALWAYS ask for the office location (city and country) as a minimum. This helps distinguish between offices of the same company.
- "Where is their office located? City and country."
- If the user provides city only, that's fine — skip country.

CREATE COMPANY flow — ask in order, 1-2 questions per message:
1. "What is the company name?" (required — if already provided, skip)
2. SPELLING CHECK: "I'll create a company called **[Name]**. Is that spelling correct?"
3. DUPLICATE CHECK: Call lookup_company. If matches found, ask user. If no matches, continue.
4. "Where is their office located? City and country?" (required)
5. "What industry are they in? For example: Technology, Finance, Recruitment, Legal, Healthcare, Retail, or something else?"
6. "Any notes to add? You can say 'skip' if not."
7. Confirm: "I'll create [name] in [city, country], industry [industry]. Shall I go ahead?"
8. After creation: "[Name] has been added to your companies. The company ID is stored — I can now add contacts, projects, or deals for them immediately."

CREATE CONTACT flow — ask in order, 1-2 questions per message:
1. "What is their first and last name?" (required)
2. "Which company do they work at?" — if you already have the company from this session, say "Is this for [Company Name] that we just created?" Otherwise use lookup_company to find matches and offer them.
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
1. "Which company is this deal with?" — use existing session company if available, otherwise search
2. "What is the deal name or description?"
3. "What is the value? And which currency — GBP, USD, EUR?"
4. "What stage is it at? Lead, Qualified, Proposal, or Negotiation?"
5. "What is the expected close date?"
6. Confirm and create.

CREATE OPPORTUNITY flow:
1. "What is the opportunity title?"
2. "Which company is this for?" — use existing session company if available, otherwise search
3. "What is the estimated value?"
4. "What stage? Lead, Qualified, Proposal, Negotiation, or Closed Won?"
5. Confirm and create.

CREATE PROJECT flow:
1. "What is the project name?"
2. "Which company is this for?" — use existing session company if available, otherwise search
3. "What type of project? e.g. Implementation, Consulting, Support"
4. "Any description?"
5. Confirm and create.

ENTITY LOOKUP BEFORE LINKING — CRITICAL:
When creating a contact, deal, opportunity, project, or logging a call that references another entity (company, contact, or candidate):
1. FIRST check if you already have the entity ID from earlier in this conversation (SESSION ENTITY MEMORY).
2. If you don't have it, call the appropriate lookup tool (lookup_company, lookup_contact, or lookup_candidate).
3. If exactly 1 result is returned: use that ID automatically and proceed.
4. If multiple results: ask the user "I found a few matches — did you mean [name1], [name2], or [name3]?" and wait for their answer.
5. If 0 results: say "I couldn't find [name] in your workspace. Would you like me to create it first?" and wait.
6. NEVER guess or fabricate an entity ID. NEVER pass a name string where an ID is required.

CONFIRMATION: Always confirm before executing. State ALL collected fields clearly using names (never IDs). Only call the tool AFTER the user confirms.

JOB SPEC WRITER FLOW — detect intents: "new job", "write a job spec", "I have a new role", "new requirement", "create a job", "I have a requirement":

Step 1 — Capture brief:
  Say: "Tell me about the role — just give me the key details and I'll build the full spec."
  Wait for the user's rough brief. Extract: job title, company, type (perm/contract/temp), location, salary/rate, start date, any skills mentioned.

Step 2 — Clarify gaps (max 3 questions total, 1-2 per message):
  If job title missing: "What's the job title?"
  If company missing: "Which client is this for?" — use lookup_company to find matches
  If type missing: "Is this permanent, contract, or temp?"
  Do NOT ask about every field — extract what you can, leave the rest blank.

Step 3 — Generate spec:
  Call the generate_job_spec tool with the raw brief and all clarified values.
  Display the generated spec in a structured format:
  **[Job Title]**
  **Role Summary:** ...
  **Key Responsibilities:**
  • ...
  **Essential Skills:**
  • ...
  **Desirable Skills:**
  • ...
  **What We Offer:**
  • ...
  **Salary:** ... | **Location:** ... | **Type:** ... | **Start:** ...

  Say: "Here's your job spec. Shall I save it, or would you like to change anything?"

Step 4 — Refinement:
  If user says "change the salary to X" or "add cloud experience to essential skills" — make the change in the spec and show the updated version.
  Ask again: "Updated. Shall I save it now?"

Step 5 — Save:
  When user confirms, call create_job with: raw_brief (original text), full_spec (JSON stringified), all extracted fields.
  Navigate to /jobs/[new-id].
  Say: "[Title] spec saved. Ready to generate adverts?"

NAVIGATION — Jobs:
  "take me to jobs" / "show me my jobs" / "open jobs" / "jobs list" → navigate to /jobs
  "open job [name]" → navigate to /jobs, search for the job

SHORTLIST / CANDIDATE MATCHING — detect intents:
  "find candidates for [job]" / "shortlist for this job" / "who matches this role" / "run shortlist" / "match candidates" / "shortlist candidates":
  - If a job_id is available from context or the current page, call run_shortlist immediately.
  - After the shortlist runs, report: "I found [n] strong matches for [job title]. Top candidate is [name] with a score of [n]. Shall I draft outreach emails to the shortlist?"
  - If the user is on a job detail page, use the job_id from the URL.

SHORTLIST REVIEW — detect intents:
  "tell me about [name]" / "who is the best match" / "describe [name]":
  - Call describe_shortlist_candidate with the name or "top" for highest scored.
  - Read out their score, match reasons, concerns, and availability naturally.
  "remove [name] from the list" / "take [name] off":
  - Call update_shortlist_entry with action "remove".
  "move [name] to the top" / "put [name] first":
  - Call update_shortlist_entry with action "move_to_top".
  "approve everyone" / "approve all" / "approve the shortlist" / "approve everyone and proceed":
  - Call approve_all_shortlist. Then say: "Shortlist approved. [n] candidates ready for outreach. Want me to draft the emails now?"
  "approve [name]":
  - Call update_shortlist_entry with action "approve".
  "move [name] to reserve" / "hold [name] back":
  - Call update_shortlist_entry with action "reserve".

OUTREACH EMAIL intents:
   "draft outreach for [job]" / "email the shortlist" / "send outreach" / "draft emails":
   - Call draft_outreach_emails with the job_id. After drafting: "I've drafted [n] personalised emails for [job title]. Head to the Outreach tab to review and send them."
   "how many candidates have we contacted for [job]" / "outreach status":
   - Call get_outreach_status. Report naturally: "You've sent outreach to [n] candidates for [job title], with [n] still in draft."

DIARY / CALENDAR intents:
  "take me to my diary" / "show my diary" / "open my schedule":
   - Navigate to /home, highlight home-diary element.
   - Say: "Here's your diary on the Command Centre. Your scheduled calls and meetings for this week are here."
  "book a call with [candidate]" / "schedule a call with [name]" / "find a time to speak to [name]":
   - First call find_diary_slots to get available slots.
   - Present 3 options: "I have these slots available: [1], [2], [3]. Which works best?"
   - When user picks one, call book_diary_event with the title "Call with [candidate] re [job title]".
   - After booking: "Booked. [Name] is in your diary for [day] at [time]."
  "what's in my diary today" / "what calls do I have" / "my schedule":
   - Call get_diary_events with period=today (or tomorrow, this_week).
   - Read out events naturally: "You have [n] events today: [list with times]."
   "cancel the call with [name]" / "remove that meeting":
   - Call cancel_diary_event with candidate_name.
   - "Done. The call with [name] has been cancelled."
   "reschedule [name] call" / "move the meeting with [name]":
   - Call reschedule_diary_event with candidate_name (no new time → gets new slots).
   - Present new options, then update when confirmed.
   "what recruitment calls do I have this week":
   - Call get_diary_events with period=this_week, then filter to event_type=call in your response.

REMINDER vs MEETING distinction:
  MEETINGS (call, meeting): book a time slot, check availability. Use for: client calls, team meetings, interviews.
  REMINDERS (reminder, task): alert only, no slot needed. Use for: "remind me to call Ken back", "follow up with Acme Thursday", "check in on that invoice Friday".
  When user says "remind me to...", "follow up with...", "call back...", "check in on..." → book as reminder type, NOT as a meeting. Ask for day/time only, not duration.
  Example: "Remind me to call Ken Beinert back Thursday morning"
   → book_diary_event(title: "Call back Ken Beinert", event_type: "reminder", start_time: Thursday 09:00, end_time: Thursday 09:00, contact_id: ken_id)
   → say "Done — reminder set for Thursday at 9am to call Ken back. You'll see it in your diary on the Command Centre."

CALLBACK intents — "call [name] back [time]", "remind me to call [name]", "schedule a callback with [name]", "[name] asked me to call back [time]":
  1. Look up contact/candidate using lookup_contact or lookup_candidate.
  2. Book as reminder type (NOT a meeting slot):
     book_diary_event(title: "Call back [name]", event_type: "reminder", start_time: [parsed time], end_time: [same], contact_id or candidate_id: [resolved id])
  3. Say: "Done — I'll remind you to call [name] back on [day] at [time]. You'll see it in the Reminders tab on your Command Centre."
  Do not book callbacks as meetings — they are reminders only.

RECRUITMENT WORKFLOW — full end-to-end intents:

JOB LOOKUP — CRITICAL:
  Before running any job-related action (shortlisting, scoring, outreach, applications) where the user says "[job title]" instead of providing an ID:
  - Call lookup_job with the title to find the job_id.
  - If 1 match: use it. If multiple: ask. If 0: say "I couldn't find a job matching that."

JOB MANAGEMENT:
  "show me all active jobs" / "what jobs are active":
  - Navigate to /jobs and mention they can filter by status there.
  "how many applications for [job]":
  - Call lookup_job to get job_id, then call get_job_applications_summary.
  - Report: "[job title] has [n] applications: [n] new, [n] reviewing, [n] shortlisted, [n] rejected."
  "what's the status of the [job] shortlist" / "shortlist status":
  - Call lookup_job, then get_shortlist_summary.
  - Report counts by status and top 3 candidates with scores.
  "who haven't we heard back from on [job]" / "unresponsive candidates":
  - Call lookup_job, then get_unresponsive_candidates.
  - List candidates with outreach sent but no response.

SPEC AND ADVERTS:
  "write a job spec" / "new job spec" → enter JOB SPEC WRITER FLOW above.
  "generate adverts for [job]" / "create adverts":
  - Call lookup_job to find the job, then call generate_adverts with desired boards.
  "show me the LinkedIn advert for [job]":
  - Navigate to /jobs/[job_id] with highlight on job-tab-adverts.

SHORTLIST AND OUTREACH:
  "shortlist candidates for [job]" → lookup_job then run_shortlist.
  "send outreach for [job]" / "email the shortlist for [job]":
  - lookup_job then draft_outreach_emails.
  "how many candidates responded to [job] outreach":
  - lookup_job then get_outreach_status. Report responded vs no response.

APPLICATIONS:
  "show me new applications for [job]":
  - lookup_job, navigate to /jobs/[job_id] with highlight on job-tab-applications.
  "score the applications for [job]" / "process applications":
  - lookup_job then score_unprocessed_applications. Report how many were scored.
  "reject all low-scoring applications for [job]":
  - lookup_job then get_job_applications_summary to check counts.
  - Ask: "I found [n] applications scoring below 50. Want me to reject them all?"
  - After confirmation: call bulk_reject_low_scoring.

DIARY CONTEXT:
  "book a call with [candidate] about [job]" → lookup_job for job_id, then diary booking flow.

GOLDEN THREAD — Job-Project-Deal Linkage intents:

"link this job to a project" / "connect this job to a project":
  - If on a job detail page, use the job_id from context.
  - Navigate to the job detail page and say: "Use the Project linker in the header to search for or create a project."
  - <action>{"type":"NAVIGATE","destination":"jobs","highlight":"job-project-linker","label":"Link to Project"}</action>

"create a project for this job" / "make a project for this role":
  - Navigate to project creation with the job title pre-filled.
  - <action>{"type":"NAVIGATE","destination":"/projects/new"}</action>
  - Say: "I'll take you to create a new project — the job title will be pre-filled."

"show me unlinked jobs" / "unlinked jobs" / "jobs without a project":
  - Navigate to /jobs with the unlinked filter active.
  - <action>{"type":"NAVIGATE","destination":"/jobs?filter=unlinked"}</action>
  - Say: "Taking you to Jobs with the Unlinked filter active."

"what jobs aren't tracked in a project" / "which jobs need a project" / "jobs not linked":
  - Call get_unlinked_jobs. Read out the list naturally.
  - Say: "You have [n] active jobs without a project: [list]. Want me to take you there to link them?"

"what's the pipeline value from recruitment this month" / "recruitment pipeline value" / "placement fee total":
  - Call get_recruitment_pipeline_value. Report the total.
  - Say: "Your recruitment pipeline this month is worth [£X] across [n] placement deals."`;






// ---------- Universal record lookup helper ----------
async function lookupRecord(
  table: string,
  searchField: string,
  query: string,
  workspaceId: string | null,
  supabase: ReturnType<typeof createClient>,
  workspaceColumn = "team_id",
  extraFilters?: (q: any) => any
): Promise<any[]> {
  let q = supabase
    .from(table)
    .select("id, " + searchField)
    .ilike(searchField, `%${query}%`)
    .limit(5);
  if (workspaceId) {
    q = q.eq(workspaceColumn, workspaceId);
  }
  if (extraFilters) {
    q = extraFilters(q);
  }
  const { data, error } = await q;
  if (error) console.error("[lookupRecord] Error:", table, error.message);
  console.log("[lookupRecord]", table, searchField, query, "workspace:", workspaceId, "results:", (data || []).length);
  return data || [];
}

// Helper to get user's workspace ID
async function getUserTeamId(supabaseAdmin: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("team_id")
    .eq("user_id", userId)
    .limit(1)
    .single();
  return data?.team_id || null;
}

async function findExistingCompanyByName(
  supabaseAdmin: ReturnType<typeof createClient>,
  companyName: string,
  teamId: string | null,
): Promise<{ id: string; name: string } | null> {
  let q = supabaseAdmin
    .from("companies")
    .select("id, name")
    .ilike("name", companyName)
    .is("deleted_at", null)
    .limit(1);

  if (teamId) q = q.eq("team_id", teamId);

  const { data } = await q;
  return data?.[0] ?? null;
}

async function resolveCompanyIds(
  supabaseAdmin: ReturnType<typeof createClient>,
  inputCompanyId: string | null,
  userId: string,
  teamId: string | null,
): Promise<{ companyId: string | null; crmCompanyId: string | null }> {
  const rawCompanyId = (inputCompanyId || "").trim();
  if (!rawCompanyId) return { companyId: null, crmCompanyId: null };

  // Try core companies first
  const { data: companyRow } = await supabaseAdmin
    .from("companies")
    .select("id, name, website, industry, size, switchboard, headquarters")
    .eq("id", rawCompanyId)
    .maybeSingle();

  if (companyRow) {
    let crmCompanyId: string | null = null;

    const { data: crmMatches } = await supabaseAdmin
      .from("crm_companies")
      .select("id, name")
      .ilike("name", companyRow.name)
      .is("deleted_at", null)
      .limit(1);

    crmCompanyId = crmMatches?.[0]?.id ?? null;

    if (!crmCompanyId) {
      const headquartersParts = (companyRow.headquarters || "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

      const { data: createdCrmCompany } = await supabaseAdmin
        .from("crm_companies")
        .insert({
          name: companyRow.name,
          website: companyRow.website || null,
          industry: companyRow.industry || null,
          size: companyRow.size || null,
          phone: companyRow.switchboard || null,
          city: headquartersParts[0] || null,
          country: headquartersParts.length > 1 ? headquartersParts.slice(1).join(", ") : null,
          created_by: userId,
        })
        .select("id")
        .single();

      crmCompanyId = createdCrmCompany?.id ?? null;
    }

    return { companyId: companyRow.id, crmCompanyId };
  }

  // Fallback: try CRM companies and map back to core companies
  const { data: crmCompanyRow } = await supabaseAdmin
    .from("crm_companies")
    .select("id, name, website, industry, size, phone, city, country")
    .eq("id", rawCompanyId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!crmCompanyRow) {
    return { companyId: null, crmCompanyId: null };
  }

  let companyId: string | null = null;
  const existingCompany = await findExistingCompanyByName(supabaseAdmin, crmCompanyRow.name, teamId);

  if (existingCompany) {
    companyId = existingCompany.id;
  } else {
    const headquarters = [crmCompanyRow.city, crmCompanyRow.country].filter(Boolean).join(", ") || null;

    const { data: createdCompany } = await supabaseAdmin
      .from("companies")
      .insert({
        name: crmCompanyRow.name,
        website: crmCompanyRow.website || null,
        industry: crmCompanyRow.industry || null,
        size: crmCompanyRow.size || null,
        switchboard: crmCompanyRow.phone || null,
        headquarters,
        owner_id: userId,
        team_id: teamId,
      })
      .select("id")
      .single();

    companyId = createdCompany?.id ?? null;
  }

  return { companyId, crmCompanyId: crmCompanyRow.id };
}

// ---------- Direct save from confirmation cards ----------
async function executeDirectSave(
  cardType: string,
  fields: Record<string, string>,
  resolvedIds: Record<string, string>,
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ created?: any; error?: string }> {
  const teamId = await getUserTeamId(supabaseAdmin, userId);

  switch (cardType) {
    case "company": {
      const name = fields.name?.trim();
      if (!name) return { error: "Company name is required" };

      const headquarters = [fields.city, fields.country].filter(Boolean).join(", ") || null;

      const { data, error } = await supabaseAdmin
        .from("companies")
        .insert({
          name,
          website: fields.website || null,
          industry: fields.industry || null,
          headquarters,
          owner_id: userId,
          team_id: teamId,
        })
        .select("id, name")
        .single();
      if (error) return { error: error.message };

      // Sync to crm_companies
      let crmId: string | null = null;
      try {
        const { data: crmData } = await supabaseAdmin
          .from("crm_companies")
          .insert({
            name,
            website: fields.website || null,
            industry: fields.industry || null,
            city: fields.city || null,
            country: fields.country || null,
            created_by: userId,
          })
          .select("id")
          .single();
        crmId = crmData?.id ?? null;
      } catch {}

      await logAudit(supabaseAdmin, userId, "direct_save_company", "companies", data?.id, "card_save", `created:${data?.name}`);
      return { created: { id: data?.id, name: data?.name, crm_id: crmId, type: "company", entity_type: "companies" } };
    }
    case "contact": {
      const firstName = fields.first_name?.trim();
      const lastName = fields.last_name?.trim();
      if (!firstName || !lastName) return { error: "First and last name are required" };

      const companyId = resolvedIds.company_id || null;
      const fullName = `${firstName} ${lastName}`;

      const { data, error } = await supabaseAdmin
        .from("contacts")
        .insert({
          name: fullName,
          email: fields.email || null,
          company_id: companyId,
          title: fields.job_title || null,
          phone: fields.phone || null,
          owner_id: userId,
          team_id: teamId,
        })
        .select("id, name")
        .single();
      if (error) return { error: error.message };

      await logAudit(supabaseAdmin, userId, "direct_save_contact", "contacts", data?.id, "card_save", `created:${data?.name}`);
      return { created: { id: data?.id, name: data?.name, type: "contact", entity_type: "contacts" } };
    }
    case "deal": {
      const title = fields.title?.trim();
      if (!title) return { error: "Deal title is required" };

      const resolved = await resolveCompanyIds(supabaseAdmin, resolvedIds.company_id || null, userId, teamId);
      const { data, error } = await supabaseAdmin
        .from("crm_deals")
        .insert({
          title,
          company_id: resolved.crmCompanyId || null,
          value: parseFloat(fields.value) || 0,
          currency: fields.currency || "GBP",
          stage: fields.stage || "lead",
          created_by: userId,
        })
        .select("id, title")
        .single();
      if (error) return { error: error.message };

      await logAudit(supabaseAdmin, userId, "direct_save_deal", "crm_deals", data?.id, "card_save", `created:${data?.title}`);
      return { created: { id: data?.id, name: data?.title, type: "deal", entity_type: "crm_deals" } };
    }
    case "project": {
      const name = fields.name?.trim();
      if (!name) return { error: "Project name is required" };

      const resolved = await resolveCompanyIds(supabaseAdmin, resolvedIds.company_id || null, userId, teamId);
      const { data, error } = await supabaseAdmin
        .from("crm_projects")
        .insert({
          name,
          company_id: resolved.crmCompanyId || null,
          project_type: fields.project_type || null,
          description: fields.description || null,
          created_by: userId,
        })
        .select("id, name")
        .single();
      if (error) return { error: error.message };

      await logAudit(supabaseAdmin, userId, "direct_save_project", "crm_projects", data?.id, "card_save", `created:${data?.name}`);
      return { created: { id: data?.id, name: data?.name, type: "project", entity_type: "crm_projects" } };
    }
    case "opportunity": {
      const title = fields.title?.trim();
      if (!title) return { error: "Opportunity title is required" };

      const resolved = await resolveCompanyIds(supabaseAdmin, resolvedIds.company_id || null, userId, teamId);
      const { data, error } = await supabaseAdmin
        .from("crm_opportunities")
        .insert({
          title,
          company_id: resolved.crmCompanyId || null,
          value: parseFloat(fields.value) || 0,
          stage: fields.stage || "lead",
          created_by: userId,
        })
        .select("id, title")
        .single();
      if (error) return { error: error.message };

      await logAudit(supabaseAdmin, userId, "direct_save_opportunity", "crm_opportunities", data?.id, "card_save", `created:${data?.title}`);
      return { created: { id: data?.id, name: data?.title, type: "opportunity", entity_type: "crm_opportunities" } };
    }
    default:
      return { error: `Unknown card type: ${cardType}` };
  }
}

// ---------- Tool executors ----------
async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  authHeader: string
): Promise<{ result: unknown; entityType: string; entityId?: string }> {
  switch (toolName) {
    case "search_companies": {
      const teamId = await getUserTeamId(supabaseAdmin, userId);

      let q = supabaseAdmin
        .from("companies")
        .select("id, name, industry, headquarters")
        .ilike("name", `%${input.query}%`)
        .is("deleted_at", null)
        .limit(10);

      if (teamId) q = q.eq("team_id", teamId);

      const { data } = await q;
      const result = (data ?? []).map((company: any) => ({
        id: company.id,
        name: company.name,
        industry: company.industry,
        headquarters: company.headquarters,
        source: "companies",
      }));

      return { result, entityType: "companies" };
    }
    case "search_contacts": {
      const teamId = await getUserTeamId(supabaseAdmin, userId);

      const resolved = await resolveCompanyIds(
        supabaseAdmin,
        (input.company_id as string) || null,
        userId,
        teamId,
      );

      let q = supabaseAdmin
        .from("contacts")
        .select("id, name, email, title, company_id")
        .is("deleted_at", null);

      if (teamId) q = q.eq("team_id", teamId);
      if (resolved.companyId) q = q.eq("company_id", resolved.companyId);
      q = q.or(`name.ilike.%${input.query}%,email.ilike.%${input.query}%,title.ilike.%${input.query}%`);

      const { data } = await q.limit(10);
      return { result: data ?? [], entityType: "contacts" };
    }
    case "create_company": {
      const normalizedName = (input.name as string)?.trim();
      if (!normalizedName) {
        return { result: { error: "Company name is required" }, entityType: "companies" };
      }

      // Build headquarters string from city/country
      const city = (input.city as string) || null;
      const country = (input.country as string) || null;
      const headquarters = [city, country].filter(Boolean).join(", ") || null;

      // Fetch user's workspace/team_id — required for workspace visibility
      const teamId = await getUserTeamId(supabaseAdmin, userId);
      console.log("[create_company] userId:", userId, "team_id:", teamId);

      // Check for existing company (exact name match)
      const existing = await findExistingCompanyByName(supabaseAdmin, normalizedName, teamId);
      if (existing) {
        console.log("[create_company] Existing match found — id:", existing.id, "name:", existing.name);
        return {
          result: {
            ...existing,
            navigate_to: "/companies",
            matched_existing: true,
            message: `A company called "${existing.name}" already exists. Use this company_id for subsequent operations.`,
          },
          entityType: "companies",
          entityId: existing.id,
        };
      }

      // Also check for fuzzy/partial matches to warn about duplicates
      const { data: fuzzyMatches } = await supabaseAdmin
        .from("companies")
        .select("id, name, headquarters")
        .ilike("name", `%${normalizedName}%`)
        .is("deleted_at", null)
        .limit(5);
      if (teamId) {
        // Filter in code since we already have the query
      }
      if (fuzzyMatches && fuzzyMatches.length > 0) {
        const matchList = fuzzyMatches.map((m: any) => `${m.name}${m.headquarters ? ` (${m.headquarters})` : ""}`).join(", ");
        console.log("[create_company] Fuzzy matches found:", matchList);
        // Return fuzzy matches as a warning but still proceed (the AI should have confirmed)
      }

      const insertPayload = {
        name: normalizedName,
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

      // Sync to crm_companies so FK references from crm_deals, crm_projects, crm_opportunities work
      let crmCompanyId: string | null = null;
      try {
        const { data: crmData } = await supabaseAdmin
          .from("crm_companies")
          .insert({
            name: normalizedName,
            website: (input.website as string) || null,
            industry: (input.industry as string) || null,
            city: city,
            country: country,
            created_by: userId,
            team_id: teamId,
          })
          .select("id")
          .single();
        crmCompanyId = crmData?.id ?? null;
        console.log("[create_company] CRM sync SUCCESS — crm_company_id:", crmCompanyId);
      } catch (syncErr) {
        console.warn("[create_company] CRM sync failed (non-critical):", syncErr);
      }

      return {
        result: {
          ...data,
          crm_company_id: crmCompanyId,
          navigate_to: "/companies",
          message: `Company "${data?.name}" created successfully. Use company_id "${data?.id}" for adding contacts, and crm_company_id "${crmCompanyId}" for deals/projects/opportunities.`,
        },
        entityType: "companies",
        entityId: data?.id,
      };
    }
    case "create_contact": {
      const firstName = (input.first_name as string)?.trim() || "";
      const lastName = (input.last_name as string)?.trim() || "";

      if (!firstName || !lastName) {
        return { result: { error: "Both first_name and last_name are required" }, entityType: "contacts" };
      }

      const teamId = await getUserTeamId(supabaseAdmin, userId);
      const resolved = await resolveCompanyIds(
        supabaseAdmin,
        (input.company_id as string) || null,
        userId,
        teamId,
      );

      if (input.company_id && !resolved.companyId) {
        return {
          result: { error: "Company could not be resolved. Please select an existing company first." },
          entityType: "contacts",
        };
      }

      const fullName = `${firstName} ${lastName}`.trim();

      const { data, error } = await supabaseAdmin
        .from("contacts")
        .insert({
          name: fullName,
          email: (input.email as string) || null,
          company_id: resolved.companyId,
          title: (input.job_title as string) || null,
          phone: (input.phone as string) || null,
          owner_id: userId,
          team_id: teamId,
        })
        .select("id, name, email, title, company_id")
        .single();

      if (error) return { result: { error: error.message }, entityType: "contacts" };

      // Sync to crm_contacts so send_email/send_sms tools can find this contact
      let crmContactId: string | null = null;
      try {
        // Find matching crm_companies record for the company_id
        let crmCompanyId: string | null = null;
        if (resolved.companyId) {
          const { data: coreCompany } = await supabaseAdmin
            .from("companies")
            .select("name")
            .eq("id", resolved.companyId)
            .single();
          if (coreCompany?.name) {
            const { data: crmCompany } = await supabaseAdmin
              .from("crm_companies")
              .select("id")
              .ilike("name", coreCompany.name)
              .limit(1)
              .single();
            crmCompanyId = crmCompany?.id ?? null;
          }
        }
        // Also use resolved.crmCompanyId if available
        if (!crmCompanyId && resolved.crmCompanyId) {
          crmCompanyId = resolved.crmCompanyId;
        }

        const { data: crmContactData } = await supabaseAdmin
          .from("crm_contacts")
          .insert({
            first_name: firstName,
            last_name: lastName,
            email: (input.email as string) || null,
            phone: (input.phone as string) || null,
            job_title: (input.job_title as string) || null,
            company_id: crmCompanyId,
            team_id: teamId,
            created_by: userId,
            gdpr_consent: (input.gdpr_consent as boolean) ?? false,
            gdpr_consent_method: (input.gdpr_consent_method as string) || null,
            gdpr_consent_date: (input.gdpr_consent as boolean) ? new Date().toISOString() : null,
          })
          .select("id")
          .single();
        crmContactId = crmContactData?.id ?? null;
        console.log("[create_contact] CRM sync SUCCESS — crm_contact_id:", crmContactId);
      } catch (syncErr) {
        console.warn("[create_contact] CRM sync failed (non-critical):", syncErr);
      }

      return {
        result: { ...data, crm_contact_id: crmContactId },
        entityType: "contacts",
        entityId: data?.id,
      };
    }
    case "create_project": {
      // Write to engagements table (the Projects page reads from engagements)
      const projTeamId = await getUserTeamId(supabaseAdmin, userId);
      const projResolved = await resolveCompanyIds(
        supabaseAdmin,
        (input.company_id as string) || null,
        userId,
        projTeamId,
      );
      // Use core company_id (not crm_companies) since engagements FK references companies
      const engagementCompanyId = projResolved.companyId || (input.company_id as string) || null;
      const { data, error } = await supabaseAdmin
        .from("engagements")
        .insert({
          name: input.name as string,
          company_id: engagementCompanyId,
          engagement_type: (input.project_type as string) || "project",
          description: (input.description as string) || null,
          owner_id: userId,
          workspace_id: projTeamId,
          stage: "active",
          health: "on_track",
          forecast_value: 0,
          currency: "GBP",
        })
        .select("id, name")
        .single();
      if (error) return { result: { error: error.message }, entityType: "crm_projects" };
      return { result: data, entityType: "crm_projects", entityId: data?.id };
    }
    case "create_opportunity": {
      // crm_opportunities has FK to crm_companies, so resolve the company ID
      const oppTeamId = await getUserTeamId(supabaseAdmin, userId);
      const oppResolved = await resolveCompanyIds(
        supabaseAdmin,
        (input.company_id as string) || null,
        userId,
        oppTeamId,
      );
      const { data, error } = await supabaseAdmin
        .from("crm_opportunities")
        .insert({
          title: input.title as string,
          company_id: oppResolved.crmCompanyId || (input.company_id as string) || null,
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
      // crm_deals has FK to crm_companies, so resolve the company ID
      const dealTeamId = await getUserTeamId(supabaseAdmin, userId);
      const dealResolved = await resolveCompanyIds(
        supabaseAdmin,
        (input.company_id as string) || null,
        userId,
        dealTeamId,
      );
      const { data, error } = await supabaseAdmin
        .from("crm_deals")
        .insert({
          title: input.title as string,
          opportunity_id: (input.opportunity_id as string) || null,
          company_id: dealResolved.crmCompanyId || (input.company_id as string) || null,
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
      // Dual-table lookup: try contacts first, fall back to crm_contacts
      const { data: coreContact } = await supabaseAdmin
        .from("contacts")
        .select("email, name, phone, company_id")
        .eq("id", input.contact_id as string)
        .maybeSingle();
      const finalContact = coreContact ?? (await supabaseAdmin
        .from("crm_contacts")
        .select("email, first_name, last_name, company_id")
        .eq("id", input.contact_id as string)
        .maybeSingle()).data;
      const contactEmail = finalContact?.email;
      const contactName = coreContact?.name ??
        `${(finalContact as any)?.first_name ?? ""} ${(finalContact as any)?.last_name ?? ""}`.trim();
      const contactCompanyId = finalContact?.company_id;

      if (!contactEmail) return { result: { error: "Contact has no email address" }, entityType: "contacts" };

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
          to: contactEmail,
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
        company_id: contactCompanyId,
        status: "completed",
        completed_at: new Date().toISOString(),
        created_by: userId,
      });
      return { result: { success: true, sent_to: contactEmail }, entityType: "email" };
    }
    case "send_sms": {
      // Dual-table lookup: try contacts first, fall back to crm_contacts
      const { data: coreSmsContact } = await supabaseAdmin
        .from("contacts")
        .select("phone, name, company_id")
        .eq("id", input.contact_id as string)
        .maybeSingle();
      const finalSmsContact = coreSmsContact ?? (await supabaseAdmin
        .from("crm_contacts")
        .select("mobile, first_name, last_name, company_id")
        .eq("id", input.contact_id as string)
        .maybeSingle()).data;
      const smsPhone = coreSmsContact?.phone ?? (finalSmsContact as any)?.mobile;
      const smsCompanyId = finalSmsContact?.company_id;

      if (!smsPhone) return { result: { error: "Contact has no phone/mobile number" }, entityType: "contacts" };

      const { data: smsKeys } = await supabaseAdmin
        .from("integration_settings")
        .select("key_name, key_value")
        .eq("user_id", userId)
        .eq("service", "twilio");
      const smsKeyMap = Object.fromEntries((smsKeys ?? []).map((k: any) => [k.key_name, k.key_value]));
      if (!smsKeyMap.TWILIO_ACCOUNT_SID || !smsKeyMap.TWILIO_AUTH_TOKEN || !smsKeyMap.TWILIO_PHONE_NUMBER) {
        return { result: { error: "Twilio integration not configured" }, entityType: "sms" };
      }

      const params = new URLSearchParams({
        From: smsKeyMap.TWILIO_PHONE_NUMBER,
        To: smsPhone,
        Body: input.message as string,
      });
      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${smsKeyMap.TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: "Basic " + btoa(`${smsKeyMap.TWILIO_ACCOUNT_SID}:${smsKeyMap.TWILIO_AUTH_TOKEN}`),
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
        company_id: smsCompanyId,
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
      // Resolve contact - check contacts table first for company_id
      const contactId = input.contact_id as string;
      let resolvedContactId = contactId;
      let callCompanyId: string | null = null;

      const { data: coreContact } = await supabaseAdmin
        .from("contacts")
        .select("id, company_id")
        .eq("id", contactId)
        .maybeSingle();

      if (coreContact) {
        resolvedContactId = coreContact.id;
        callCompanyId = coreContact.company_id;
      }

      const { data, error } = await supabaseAdmin
        .from("crm_activities")
        .insert({
          type: "call",
          direction: "outbound",
          subject: (input.subject as string) || "Call logged",
          body: (input.body as string) || null,
          contact_id: resolvedContactId,
          company_id: callCompanyId,
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
        // Canvas actions
        "save chart": { path: "/canvas", action: "click", targetId: "canvas-save-layout" },
        "save the chart": { path: "/canvas", action: "click", targetId: "canvas-save-layout" },
        "fit view": { path: "/canvas", action: "click", targetId: "canvas-fit-view" },
        "fit the chart": { path: "/canvas", action: "click", targetId: "canvas-fit-view" },
        "fit chart to screen": { path: "/canvas", action: "click", targetId: "canvas-fit-view" },
        "zoom in": { path: "/canvas", action: "click", targetId: "canvas-zoom-in" },
        "zoom in on the chart": { path: "/canvas", action: "click", targetId: "canvas-zoom-in" },
        "zoom out": { path: "/canvas", action: "click", targetId: "canvas-zoom-out" },
        "build org chart": { path: "/canvas", action: "click", targetId: "canvas-build-orgchart" },
        "build the org chart": { path: "/canvas", action: "click", targetId: "canvas-build-orgchart" },
        "research org": { path: "/canvas", action: "click", targetId: "canvas-ai-research" },
        "research the org structure": { path: "/canvas", action: "click", targetId: "canvas-ai-research" },
        "add to org chart": { path: "/canvas", action: "click", targetId: "canvas-add-node-button" },
        "add person to org chart": { path: "/canvas", action: "click", targetId: "canvas-add-node-button" },
        "add someone to the org chart": { path: "/canvas", action: "click", targetId: "canvas-add-node-button" },
        "connect people": { path: "/canvas", action: "click", targetId: "canvas-connect-tool" },
        "connect two people": { path: "/canvas", action: "click", targetId: "canvas-connect-tool" },
        "draw reporting line": { path: "/canvas", action: "click", targetId: "canvas-connect-tool" },
        "delete node": { path: "/canvas", action: "click", targetId: "canvas-delete-node" },
        "remove from chart": { path: "/canvas", action: "click", targetId: "canvas-delete-node" },
        // Diary / Calendar
        diary: { path: "/home#diary" },
        "my diary": { path: "/home#diary" },
        "this week": { path: "/home#diary" },
        "my schedule": { path: "/home#diary" },
        "my calendar": { path: "/home#diary" },
        // Jobs
        jobs: { path: "/jobs" },
        "jobs list": { path: "/jobs" },
        "my jobs": { path: "/jobs" },
        "show jobs": { path: "/jobs" },
        "open jobs": { path: "/jobs" },
        "add job": { path: "/jobs", action: "click", targetId: "add-job-button" },
        "new job": { path: "/jobs", action: "click", targetId: "add-job-button" },
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
        else if (dest.includes("contact")) path = `/contacts/${entityId}`;
        else if (dest.includes("deal")) path = `/crm/deals/${entityId}`;
        else if (dest.includes("project")) path = `/crm/projects/${entityId}`;
        else if (dest.includes("invoice")) path = `/crm/invoices/${entityId}`;
      }

      const result: Record<string, unknown> = { navigate_to: path };
      if (entry?.action) result.action = entry.action;
      if (entry?.targetId) result.target_id = entry.targetId;

      return { result, entityType: "navigation", entityId: path };
    }
    case "navigate_to_canvas_for_company": {
      const companyName = (input.company_name as string).trim();
      // Look up company by name
      const { data: companies } = await supabaseAdmin
        .from("companies")
        .select("id, name")
        .ilike("name", `%${companyName}%`)
        .limit(5);
      
      if (!companies || companies.length === 0) {
        // Try CRM companies as fallback
        const { data: crmCompanies } = await supabaseAdmin
          .from("crm_companies")
          .select("id, name")
          .ilike("name", `%${companyName}%`)
          .is("deleted_at", null)
          .limit(5);
        
        if (!crmCompanies || crmCompanies.length === 0) {
          return { result: { error: `No company found matching "${companyName}"` }, entityType: "companies" };
        }
        return {
          result: { navigate_to: `/canvas?company=${crmCompanies[0].id}`, matched_company: crmCompanies[0].name },
          entityType: "navigation",
          entityId: crmCompanies[0].id,
        };
      }

      return {
        result: { navigate_to: `/canvas?company=${companies[0].id}`, matched_company: companies[0].name },
        entityType: "navigation",
        entityId: companies[0].id,
      };
    }
    case "navigate_to_contact_record": {
      const contactName = (input.contact_name as string).trim();
      console.log("[navigate_to_contact_record] Searching for:", contactName);
      
      // Search contacts table
      const { data: contacts } = await supabaseAdmin
        .from("contacts")
        .select("id, name, title, company_id, companies(name)")
        .ilike("name", `%${contactName}%`)
        .is("deleted_at", null)
        .limit(5);
      
      // Search crm_contacts table
      const { data: crmContacts } = await supabaseAdmin
        .from("crm_contacts")
        .select("id, first_name, last_name, job_title, company_id, crm_companies(name)")
        .or(`first_name.ilike.%${contactName}%,last_name.ilike.%${contactName}%`)
        .is("deleted_at", null)
        .limit(5);
      
      const allMatches = [
        ...(contacts ?? []).map((c: any) => ({ id: c.id, name: c.name, title: c.title, company: c.companies?.name, source: "contacts" })),
        ...(crmContacts ?? []).map((c: any) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`, title: c.job_title, company: c.crm_companies?.name, source: "crm_contacts" })),
      ];
      
      if (allMatches.length === 0) {
        return { result: { error: `No contact found matching "${contactName}". Try searching on the contacts page.` }, entityType: "contacts" };
      }
      
      // Use first match
      const match = allMatches[0];
      console.log("[navigate_to_contact_record] Navigating to:", match.name, match.id);
      return {
        result: { navigate_to: `/contacts/${match.id}`, matched_contact: match.name, matched_title: match.title, matched_company: match.company },
        entityType: "navigation",
        entityId: match.id,
      };
    }
    case "navigate_to_company_record": {
      const companyName = (input.company_name as string).trim();
      console.log("[navigate_to_company_record] Searching for:", companyName);
      
      const { data: companies } = await supabaseAdmin
        .from("companies")
        .select("id, name, industry")
        .ilike("name", `%${companyName}%`)
        .is("deleted_at", null)
        .limit(5);
      
      const { data: crmCompanies } = await supabaseAdmin
        .from("crm_companies")
        .select("id, name, industry")
        .ilike("name", `%${companyName}%`)
        .is("deleted_at", null)
        .limit(5);
      
      const allMatches = [
        ...(companies ?? []).map((c: any) => ({ id: c.id, name: c.name, industry: c.industry, source: "companies" })),
        ...(crmCompanies ?? []).map((c: any) => ({ id: c.id, name: c.name, industry: c.industry, source: "crm_companies" })),
      ];
      
      if (allMatches.length === 0) {
        return { result: { error: `No company found matching "${companyName}". Try searching on the companies page.` }, entityType: "companies" };
      }
      
      const match = allMatches[0];
      console.log("[navigate_to_company_record] Navigating to:", match.name, match.id);
      return {
        result: { navigate_to: `/companies/${match.id}`, matched_company: match.name, matched_industry: match.industry },
        entityType: "navigation",
        entityId: match.id,
      };
    }
    case "lookup_company": {
      const name = (input.name as string).trim();
      const teamId = await getUserTeamId(supabaseAdmin, userId);

      // Search core companies with location info
      const { data: coreCompanies } = await supabaseAdmin
        .from("companies")
        .select("id, name, headquarters, industry")
        .ilike("name", `%${name}%`)
        .is("deleted_at", null)
        .limit(5)
        .then((res: any) => {
          if (teamId && res.data) {
            // Filter by team in code to avoid query complexity
            return { ...res, data: res.data };
          }
          return res;
        });

      let q2 = supabaseAdmin
        .from("companies")
        .select("id, name, headquarters, industry")
        .ilike("name", `%${name}%`)
        .is("deleted_at", null)
        .limit(5);
      if (teamId) q2 = q2.eq("team_id", teamId);
      const { data: filteredCoreCompanies } = await q2;

      // Search CRM companies with location info
      const { data: crmCompaniesResult } = await supabaseAdmin
        .from("crm_companies")
        .select("id, name, city, country, industry")
        .ilike("name", `%${name}%`)
        .is("deleted_at", null)
        .limit(5);

      const dedupedByName = new Map<string, { id: string; name: string; location: string | null; industry: string | null; source: "companies" | "crm_companies" }>();

      for (const c of filteredCoreCompanies || []) {
        const key = (c.name || "").trim().toLowerCase();
        if (!key) continue;
        if (!dedupedByName.has(key)) {
          dedupedByName.set(key, { id: c.id, name: c.name, location: c.headquarters, industry: c.industry, source: "companies" });
        }
      }

      for (const c of crmCompaniesResult || []) {
        const key = (c.name || "").trim().toLowerCase();
        if (!key) continue;
        if (!dedupedByName.has(key)) {
          const loc = [c.city, c.country].filter(Boolean).join(", ") || null;
          dedupedByName.set(key, { id: c.id, name: c.name, location: loc, industry: c.industry, source: "crm_companies" });
        }
      }

      const allMatches = Array.from(dedupedByName.values()).slice(0, 5);
      console.log("[lookup_company] query:", name, "workspace:", teamId, "total_matches:", allMatches.length);

      if (allMatches.length === 0) {
        return { result: { matches: [], message: `No company found matching "${name}". Would you like me to create it?` }, entityType: "companies" };
      }
      if (allMatches.length === 1) {
        const m = allMatches[0];
        const locStr = m.location ? ` in ${m.location}` : "";
        return { result: { matches: allMatches, auto_selected: m, message: `Found "${m.name}"${locStr} — using this company.` }, entityType: "companies" };
      }
      const matchDesc = allMatches.slice(0, 3).map((c: any) => `${c.name}${c.location ? ` (${c.location})` : ""}`).join(", or ");
      return { result: { matches: allMatches, message: `Found ${allMatches.length} companies matching "${name}". Did you mean ${matchDesc}?` }, entityType: "companies" };
    }
    case "lookup_contact": {
      const name = (input.name as string).trim();
      const teamId = await getUserTeamId(supabaseAdmin, userId);

      // Search contacts table (workspace-scoped) with joined company name
      const { data: contacts } = await supabaseAdmin
        .from("contacts")
        .select("id, name, title, email, company_id, companies(name)")
        .ilike("name", `%${name}%`)
        .eq("team_id", teamId)
        .is("deleted_at", null)
        .limit(5);
      console.log("[lookup_contact] contacts table:", name, "workspace:", teamId, "results:", (contacts || []).length);

      // Search crm_contacts table
      const { data: crmContacts } = await supabaseAdmin
        .from("crm_contacts")
        .select("id, first_name, last_name, email, job_title, company_id, crm_companies(name)")
        .or(`first_name.ilike.%${name}%,last_name.ilike.%${name}%`)
        .is("deleted_at", null)
        .limit(5);
      console.log("[lookup_contact] crm_contacts table:", name, "results:", (crmContacts || []).length);

      const allMatches = [
        ...(contacts ?? []).map((c: any) => ({ id: c.id, name: c.name, title: c.title, email: c.email, company_name: c.companies?.name, source: "contacts" })),
        ...(crmContacts ?? []).map((c: any) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`, title: c.job_title, email: c.email, company_name: c.crm_companies?.name, source: "crm_contacts" })),
      ];

      if (allMatches.length === 0) {
        return { result: { matches: [], message: `No contact found matching "${name}".` }, entityType: "contacts" };
      }
      if (allMatches.length === 1) {
        return { result: { matches: allMatches, auto_selected: allMatches[0], message: `Found "${allMatches[0].name}" — using this contact.` }, entityType: "contacts" };
      }
      return { result: { matches: allMatches, message: `Found ${allMatches.length} contacts matching "${name}". Did you mean ${allMatches.slice(0, 3).map((c: any) => c.name).join(", or ")}?` }, entityType: "contacts" };
    }
    case "lookup_candidate": {
      const name = (input.name as string).trim();
      const teamId = await getUserTeamId(supabaseAdmin, userId);

      // Search across ALL identifying fields so partial first-name, surname-only,
      // email fragment, phone digits, job title, company, location or headline all match.
      const safe = name.replace(/[%,()]/g, " ").trim();
      const tokens = safe.split(/\s+/).filter(Boolean);
      let q = supabaseAdmin
        .from("candidates")
        .select("id, name, email, phone, current_title, current_company, location, headline")
        .limit(15);
      if (teamId) q = q.eq("tenant_id", teamId);
      // Build OR across every searchable field for the full query…
      const fields = ["name","email","phone","current_title","current_company","location","headline"];
      const orParts: string[] = fields.map((f) => `${f}.ilike.%${safe}%`);
      // …and for each individual token (so "Michael Smith" still hits "Michael" only records)
      if (tokens.length > 1) {
        for (const t of tokens) {
          for (const f of fields) orParts.push(`${f}.ilike.%${t}%`);
        }
      }
      q = q.or(orParts.join(","));
      const { data, error } = await q;
      if (error) console.error("[lookup_candidate] error:", error.message);
      const allMatches = (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        title: c.current_title,
        company: c.current_company,
        location: c.location,
        headline: c.headline,
      }));
      console.log("[lookup_candidate] query:", name, "workspace:", teamId, "total_matches:", allMatches.length);

      if (allMatches.length === 0) {
        return { result: { matches: [], message: `No candidate found matching "${name}".` }, entityType: "candidates" };
      }
      if (allMatches.length === 1) {
        return { result: { matches: allMatches, auto_selected: allMatches[0], message: `Found "${allMatches[0].name}" — using this candidate.` }, entityType: "candidates" };
      }
      return { result: { matches: allMatches, message: `Found ${allMatches.length} candidates matching "${name}". Did you mean ${allMatches.slice(0, 3).map((c: any) => c.name).join(", or ")}?` }, entityType: "candidates" };
    }
    case "universal_search": {
      const rawQ = ((input.query as string) || "").trim();
      if (!rawQ) {
        return { result: { error: "Query is required" }, entityType: "search" };
      }
      const q = rawQ.replace(/[%,()]/g, " ").trim();
      const tokens = q.split(/\s+/).filter(Boolean);
      const teamId = await getUserTeamId(supabaseAdmin, userId);
      const types: string[] = Array.isArray(input.entity_types) && (input.entity_types as string[]).length > 0
        ? (input.entity_types as string[])
        : ["candidate","contact","crm_contact","company","crm_company","project","deal","opportunity","invoice","job"];
      const limit = Math.max(1, Math.min(25, Number(input.limit_per_type) || 10));
      const dateFrom = (input.date_from as string) || null;
      const dateTo = (input.date_to as string) || null;

      const buildOr = (fields: string[]) => {
        const parts: string[] = fields.map((f) => `${f}.ilike.%${q}%`);
        if (tokens.length > 1) {
          for (const t of tokens) for (const f of fields) parts.push(`${f}.ilike.%${t}%`);
        }
        return parts.join(",");
      };

      const applyDates = (qb: any, col = "created_at") => {
        if (dateFrom) qb = qb.gte(col, dateFrom);
        if (dateTo) qb = qb.lte(col, dateTo);
        return qb;
      };

      const out: Record<string, any[]> = {};
      const summary: Record<string, number> = {};

      try {
        if (types.includes("candidate")) {
          let qb = supabaseAdmin.from("candidates")
            .select("id, name, email, phone, current_title, current_company, location, headline, created_at")
            .or(buildOr(["name","email","phone","current_title","current_company","location","headline"]))
            .limit(limit);
          if (teamId) qb = qb.eq("tenant_id", teamId);
          qb = applyDates(qb);
          const { data } = await qb;
          out.candidates = data || [];
          summary.candidates = out.candidates.length;
        }
        if (types.includes("contact")) {
          let qb = supabaseAdmin.from("contacts")
            .select("id, name, email, title, company_id, created_at")
            .or(buildOr(["name","email","title"]))
            .is("deleted_at", null)
            .limit(limit);
          if (teamId) qb = qb.eq("team_id", teamId);
          qb = applyDates(qb);
          const { data } = await qb;
          out.contacts = data || [];
          summary.contacts = out.contacts.length;
        }
        if (types.includes("crm_contact")) {
          let qb = supabaseAdmin.from("crm_contacts")
            .select("id, first_name, last_name, email, phone, job_title, company_id, created_at")
            .or(buildOr(["first_name","last_name","email","phone","job_title"]))
            .is("deleted_at", null)
            .limit(limit);
          qb = applyDates(qb);
          const { data } = await qb;
          out.crm_contacts = (data || []).map((c: any) => ({ ...c, name: `${c.first_name || ""} ${c.last_name || ""}`.trim() }));
          summary.crm_contacts = out.crm_contacts.length;
        }
        if (types.includes("company")) {
          let qb = supabaseAdmin.from("companies")
            .select("id, name, industry, headquarters, website, created_at")
            .or(buildOr(["name","industry","headquarters","website"]))
            .is("deleted_at", null)
            .limit(limit);
          if (teamId) qb = qb.eq("team_id", teamId);
          qb = applyDates(qb);
          const { data } = await qb;
          out.companies = data || [];
          summary.companies = out.companies.length;
        }
        if (types.includes("crm_company")) {
          let qb = supabaseAdmin.from("crm_companies")
            .select("id, name, industry, website, city, country, created_at")
            .or(buildOr(["name","industry","website","city","country"]))
            .is("deleted_at", null)
            .limit(limit);
          qb = applyDates(qb);
          const { data } = await qb;
          out.crm_companies = data || [];
          summary.crm_companies = out.crm_companies.length;
        }
        if (types.includes("project")) {
          let qb = supabaseAdmin.from("crm_projects")
            .select("id, name, description, status, company_id, start_date, end_date, created_at")
            .or(buildOr(["name","description","status"]))
            .is("deleted_at", null)
            .limit(limit);
          qb = applyDates(qb);
          const { data } = await qb;
          out.projects = data || [];
          summary.projects = out.projects.length;
        }
        if (types.includes("deal")) {
          let qb = supabaseAdmin.from("crm_deals")
            .select("id, title, stage, status, value, company_id, start_date, end_date, created_at")
            .or(buildOr(["title","stage","status"]))
            .is("deleted_at", null)
            .limit(limit);
          if (teamId) qb = qb.eq("workspace_id", teamId);
          qb = applyDates(qb);
          const { data } = await qb;
          out.deals = data || [];
          summary.deals = out.deals.length;
        }
        if (types.includes("opportunity")) {
          let qb = supabaseAdmin.from("crm_opportunities")
            .select("id, title, stage, value, company_id, created_at")
            .or(buildOr(["title","stage"]))
            .limit(limit);
          qb = applyDates(qb);
          const { data } = await qb;
          out.opportunities = data || [];
          summary.opportunities = out.opportunities.length;
        }
        if (types.includes("invoice")) {
          let qb = supabaseAdmin.from("crm_invoices")
            .select("id, invoice_number, status, total, company_id, due_date, created_at")
            .or(buildOr(["invoice_number","status"]))
            .is("deleted_at", null)
            .limit(limit);
          qb = applyDates(qb);
          const { data } = await qb;
          out.invoices = data || [];
          summary.invoices = out.invoices.length;
        }
        if (types.includes("job")) {
          let qb = supabaseAdmin.from("jobs")
            .select("id, title, status, company_id, start_date, end_date, created_at")
            .or(buildOr(["title","status"]))
            .is("deleted_at", null)
            .limit(limit);
          if (teamId) qb = qb.eq("workspace_id", teamId);
          qb = applyDates(qb);
          const { data } = await qb;
          out.jobs = data || [];
          summary.jobs = out.jobs.length;
        }
      } catch (e) {
        console.error("[universal_search] error:", e);
      }

      const total = Object.values(summary).reduce((a, b) => a + b, 0);
      console.log("[universal_search] query:", q, "types:", types.join(","), "summary:", summary);

      // Decide where to navigate the user so they SEE the search visually.
      // Priority: explicit entity_types[0] → entity type with the most matches → /talent default.
      const TYPE_TO_PATH: Record<string, string> = {
        candidate: "/talent",
        contact: "/contacts",
        crm_contact: "/contacts",
        company: "/companies",
        crm_company: "/companies",
        project: "/crm/projects",
        deal: "/crm/deals",
        opportunity: "/crm/deals",
        invoice: "/accounts",
        job: "/jobs",
      };
      const TYPE_TO_BUCKET: Record<string, string> = {
        candidate: "candidates",
        contact: "contacts",
        crm_contact: "crm_contacts",
        company: "companies",
        crm_company: "crm_companies",
        project: "projects",
        deal: "deals",
        opportunity: "opportunities",
        invoice: "invoices",
        job: "jobs",
      };
      let primaryType: string | null = null;
      const explicit = Array.isArray(input.entity_types) ? (input.entity_types as string[]) : [];
      if (explicit.length === 1) {
        primaryType = explicit[0];
      } else {
        // pick the type with the most results (deterministic order via TYPE_TO_PATH keys)
        let best = -1;
        for (const t of Object.keys(TYPE_TO_PATH)) {
          const bucket = TYPE_TO_BUCKET[t];
          const n = (summary as Record<string, number>)[bucket] ?? 0;
          if (n > best) { best = n; primaryType = t; }
        }
      }
      const basePath = (primaryType && TYPE_TO_PATH[primaryType]) || "/talent";
      const navigate_to = `${basePath}?q=${encodeURIComponent(rawQ)}`;

      return {
        result: {
          query: rawQ,
          total,
          summary,
          results: out,
          navigate_to,
          primary_type: primaryType,
          message: total === 0
            ? `No matches found for "${rawQ}".`
            : `Found ${total} record${total === 1 ? "" : "s"} across ${Object.entries(summary).filter(([,v]) => v > 0).map(([k,v]) => `${v} ${k}`).join(", ")}.`,
        },
        entityType: "search",
      };
    }
    case "generate_job_spec": {
      const rawBrief = input.raw_brief as string;
      const jobTitle = (input.job_title as string) || "";
      const companyName = (input.company_name as string) || "";
      const jobType = (input.job_type as string) || "";
      const location = (input.location as string) || "";
      const salaryInfo = (input.salary_info as string) || "";
      const startDate = (input.start_date as string) || "";

      const specPrompt = `Raw brief: ${rawBrief}
${jobTitle ? `Job title: ${jobTitle}` : ""}
${companyName ? `Company: ${companyName}` : ""}
${jobType ? `Type: ${jobType}` : ""}
${location ? `Location: ${location}` : ""}
${salaryInfo ? `Salary/Rate: ${salaryInfo}` : ""}
${startDate ? `Start date: ${startDate}` : ""}`;

      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (!lovableKey) {
        return { result: { error: "AI service not configured" }, entityType: "jobs" };
      }

      const specResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              content: `You are an expert recruitment consultant. Generate a professional job specification from the brief provided. Return JSON with these exact fields:
  job_title (string), company_overview (2 sentences string), role_summary (3-4 sentences string),
  key_responsibilities (array of 6-10 bullet strings),
  essential_skills (array of 5-8 bullet strings),
  desirable_skills (array of 3-5 bullet strings),
  what_we_offer (array of 4-6 bullet strings),
  salary_range (string), location (string), job_type (string - permanent/contract/temp), start_date (string),
  about_the_recruiter (2 sentences string).
Return ONLY valid JSON, no markdown fences.`,
            },
            { role: "user", content: specPrompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "return_job_spec",
              description: "Return the generated job specification",
              parameters: {
                type: "object",
                properties: {
                  job_title: { type: "string" },
                  company_overview: { type: "string" },
                  role_summary: { type: "string" },
                  key_responsibilities: { type: "array", items: { type: "string" } },
                  essential_skills: { type: "array", items: { type: "string" } },
                  desirable_skills: { type: "array", items: { type: "string" } },
                  what_we_offer: { type: "array", items: { type: "string" } },
                  salary_range: { type: "string" },
                  location: { type: "string" },
                  job_type: { type: "string" },
                  start_date: { type: "string" },
                  about_the_recruiter: { type: "string" },
                },
                required: ["job_title", "role_summary", "key_responsibilities", "essential_skills"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "return_job_spec" } },
        }),
      });

      if (!specResponse.ok) {
        console.error("[generate_job_spec] AI error:", specResponse.status);
        return { result: { error: "Failed to generate job spec" }, entityType: "jobs" };
      }

      const specData = await specResponse.json();
      let generatedSpec: any = {};
      const toolCalls = specData.choices?.[0]?.message?.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        try {
          generatedSpec = JSON.parse(toolCalls[0].function.arguments);
        } catch (e) {
          console.error("[generate_job_spec] Parse error:", e);
        }
      } else {
        // Fallback: try parsing content directly
        const content = specData.choices?.[0]?.message?.content || "";
        try {
          generatedSpec = JSON.parse(content.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
        } catch (e) {
          console.error("[generate_job_spec] Content parse error:", e);
          return { result: { error: "Failed to parse generated spec" }, entityType: "jobs" };
        }
      }

      console.log("[generate_job_spec] Generated spec for:", generatedSpec.job_title);
      return { result: { spec: generatedSpec }, entityType: "jobs" };
    }
    case "create_job": {
      const teamId = await getUserTeamId(supabaseAdmin, userId);
      if (!teamId) return { result: { error: "No workspace found" }, entityType: "jobs" };

      const insertPayload: Record<string, unknown> = {
        title: input.title as string,
        workspace_id: teamId,
        raw_brief: (input.raw_brief as string) || null,
        full_spec: (input.full_spec as string) || null,
        job_type: (input.job_type as string) || null,
        location: (input.location as string) || null,
        remote_policy: (input.remote_policy as string) || null,
        salary_min: (input.salary_min as number) || null,
        salary_max: (input.salary_max as number) || null,
        salary_currency: (input.salary_currency as string) || "GBP",
        start_date: (input.start_date as string) || null,
        end_date: (input.end_date as string) || null,
        company_id: (input.company_id as string) || null,
        status: "draft",
        created_by: userId,
      };

      const { data, error } = await supabaseAdmin
        .from("jobs")
        .insert(insertPayload)
        .select("id, title")
        .single();

      if (error) {
        console.error("[create_job] Error:", error.message);
        return { result: { error: error.message }, entityType: "jobs" };
      }

      console.log("[create_job] Created job:", data?.id, data?.title);
      return {
        result: { ...data, navigate_to: `/jobs/${data?.id}` },
        entityType: "jobs",
        entityId: data?.id,
      };
    }
    case "generate_adverts": {
      // Delegate to the generate-adverts edge function via internal fetch
      const jobId = input.job_id as string;
      const boards = input.boards as string[];
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-adverts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ job_id: jobId, boards }),
      });
      const data = await res.json();
      if (!res.ok) return { result: { error: data.error || "Advert generation failed" }, entityType: "job_adverts" };
      const successCount = (data.results || []).filter((r: any) => r.advert).length;
      return {
        result: { ...data, message: `Generated ${successCount} advert(s) successfully.`, navigate_to: `/jobs/${jobId}` },
        entityType: "job_adverts",
        entityId: jobId,
      };
    }
    case "update_advert": {
      const advertId = input.advert_id as string;
      const instruction = input.instruction as string;
      const jobId = input.job_id as string;

      // Fetch current advert
      const { data: advert } = await supabaseAdmin
        .from("job_adverts")
        .select("content, board")
        .eq("id", advertId)
        .single();
      if (!advert?.content) return { result: { error: "Advert not found" }, entityType: "job_adverts" };

      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (!lovableKey) return { result: { error: "AI not configured" }, entityType: "job_adverts" };

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are an expert recruitment copywriter. Modify the job advert as instructed. Return only the updated plain text, no markdown." },
            { role: "user", content: `Current advert for ${advert.board}:\n\n${advert.content}\n\nInstruction: ${instruction}` },
          ],
        }),
      });
      if (!aiRes.ok) return { result: { error: "AI rewrite failed" }, entityType: "job_adverts" };
      const aiData = await aiRes.json();
      const newContent = aiData.choices?.[0]?.message?.content || "";
      const wordCount = newContent.trim().split(/\s+/).filter(Boolean).length;
      const charCount = newContent.length;

      await supabaseAdmin.from("job_adverts").update({ content: newContent, word_count: wordCount, character_count: charCount }).eq("id", advertId);
      return { result: { success: true, board: advert.board, word_count: wordCount }, entityType: "job_adverts", entityId: advertId };
    }
    case "run_shortlist": {
      const jobId = input.job_id as string;
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const res = await fetch(`${supabaseUrl}/functions/v1/run-shortlist`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ job_id: jobId }),
      });
      const data = await res.json();
      if (!res.ok) return { result: { error: data.error || "Shortlist generation failed" }, entityType: "job_shortlist" };
      return {
        result: { ...data, navigate_to: `/jobs/${jobId}` },
        entityType: "job_shortlist",
        entityId: jobId,
      };
    }
    case "approve_all_shortlist": {
      const jobId = input.job_id as string;
      const { data: updated, error } = await supabaseAdmin
        .from("job_shortlist")
        .update({ status: "approved" })
        .eq("job_id", jobId)
        .in("status", ["pending", "reserve"])
        .select("id");
      if (error) return { result: { error: error.message }, entityType: "job_shortlist" };
      const count = updated?.length || 0;
      return {
        result: { success: true, approved_count: count, message: `${count} candidates approved for outreach.`, navigate_to: `/jobs/${jobId}` },
        entityType: "job_shortlist",
        entityId: jobId,
      };
    }
    case "update_shortlist_entry": {
      const jobId = input.job_id as string;
      const candidateName = (input.candidate_name as string).toLowerCase();
      const action = input.action as string;
      
      const { data: entries } = await supabaseAdmin
        .from("job_shortlist")
        .select("id, candidate_id, match_score, status, candidates(name)")
        .eq("job_id", jobId);
      
      const match = (entries || []).find((e: any) => e.candidates?.name?.toLowerCase().includes(candidateName));
      if (!match) return { result: { error: `No shortlisted candidate matching "${input.candidate_name}" found.` }, entityType: "job_shortlist" };
      
      if (action === "remove") {
        await supabaseAdmin.from("job_shortlist").delete().eq("id", match.id);
        return { result: { success: true, message: `Removed ${(match as any).candidates?.name} from the shortlist.`, navigate_to: `/jobs/${jobId}` }, entityType: "job_shortlist", entityId: jobId };
      } else if (action === "approve") {
        await supabaseAdmin.from("job_shortlist").update({ status: "approved" }).eq("id", match.id);
        return { result: { success: true, message: `${(match as any).candidates?.name} approved.`, navigate_to: `/jobs/${jobId}` }, entityType: "job_shortlist", entityId: jobId };
      } else if (action === "reserve") {
        await supabaseAdmin.from("job_shortlist").update({ status: "reserve" }).eq("id", match.id);
        return { result: { success: true, message: `${(match as any).candidates?.name} moved to reserve.`, navigate_to: `/jobs/${jobId}` }, entityType: "job_shortlist", entityId: jobId };
      } else if (action === "move_to_top") {
        await supabaseAdmin.from("job_shortlist").update({ priority: 0 }).eq("id", match.id);
        const { data: others } = await supabaseAdmin.from("job_shortlist").select("id").eq("job_id", jobId).neq("id", match.id).order("priority");
        for (let i = 0; i < (others || []).length; i++) {
          await supabaseAdmin.from("job_shortlist").update({ priority: i + 1 }).eq("id", others![i].id);
        }
        return { result: { success: true, message: `${(match as any).candidates?.name} moved to position 1.`, navigate_to: `/jobs/${jobId}` }, entityType: "job_shortlist", entityId: jobId };
      }
      return { result: { error: `Unknown action: ${action}` }, entityType: "job_shortlist" };
    }
    case "describe_shortlist_candidate": {
      const jobId = input.job_id as string;
      const candidateName = ((input.candidate_name as string) || "top").toLowerCase();
      
      const { data: entries } = await supabaseAdmin
        .from("job_shortlist")
        .select("id, match_score, match_reasons, concerns, availability_warning, status, candidates(name, current_title, location, availability_status)")
        .eq("job_id", jobId)
        .order("match_score", { ascending: false });
      
      if (!entries || entries.length === 0) return { result: { error: "No candidates on this shortlist." }, entityType: "job_shortlist" };
      
      let candidate;
      if (candidateName === "top" || candidateName === "best") {
        candidate = entries[0];
      } else {
        candidate = entries.find((e: any) => e.candidates?.name?.toLowerCase().includes(candidateName));
      }
      if (!candidate) return { result: { error: `No candidate matching "${input.candidate_name}" found on the shortlist.` }, entityType: "job_shortlist" };
      
      return {
        result: {
          name: (candidate as any).candidates?.name,
          title: (candidate as any).candidates?.current_title,
          location: (candidate as any).candidates?.location,
          availability: (candidate as any).candidates?.availability_status,
          score: candidate.match_score,
          match_reasons: candidate.match_reasons,
          concerns: candidate.concerns,
          availability_warning: candidate.availability_warning,
          status: candidate.status,
        },
        entityType: "job_shortlist",
        entityId: jobId,
      };
    }
    case "draft_outreach_emails": {
      const jobId = input.job_id as string;
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const res = await fetch(`${supabaseUrl}/functions/v1/draft-outreach`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          job_id: jobId,
          automation_level: (input.automation_level as string) || "draft",
        }),
      });
      const data = await res.json();
      if (!res.ok) return { result: { error: data.error || "Draft outreach failed" }, entityType: "outreach_messages" };
      return {
        result: { ...data, navigate_to: `/jobs/${jobId}` },
        entityType: "outreach_messages",
        entityId: jobId,
      };
    }
    case "get_outreach_status": {
      const jobId = input.job_id as string;
      const { data: msgs } = await supabaseAdmin
        .from("outreach_messages")
        .select("status, candidate_name")
        .eq("job_id", jobId);
      const drafted = (msgs || []).filter((m: any) => m.status === "draft").length;
      const sent = (msgs || []).filter((m: any) => m.status === "sent").length;
      const failed = (msgs || []).filter((m: any) => m.status === "failed").length;
      return {
        result: { total: (msgs || []).length, drafted, sent, failed, message: `Outreach status: ${sent} sent, ${drafted} drafts, ${failed} failed.` },
        entityType: "outreach_messages",
        entityId: jobId,
      };
    }
    // ─── Diary tools ───
    case "find_diary_slots": {
      const teamId = await getUserTeamId(supabaseAdmin, userId);
      if (!teamId) return { result: { error: "No workspace found" }, entityType: "diary_events" };
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const res = await fetch(`${supabaseUrl}/functions/v1/diary-booking`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "find_slots", user_id: userId, workspace_id: teamId, max_slots: input.max_slots || 3 }),
      });
      const data = await res.json();
      if (!res.ok) return { result: { error: data.error || "Failed to find slots" }, entityType: "diary_events" };
      return { result: data, entityType: "diary_events" };
    }
    case "book_diary_event": {
      const teamId = await getUserTeamId(supabaseAdmin, userId);
      if (!teamId) return { result: { error: "No workspace found" }, entityType: "diary_events" };
      
      // Resolve candidate_id if name provided
      let candidateId: string | null = null;
      if (input.candidate_name) {
        const candidates = await lookupRecord("candidates", "name", input.candidate_name as string, teamId, supabaseAdmin, "tenant_id");
        if (candidates.length > 0) candidateId = candidates[0].id;
      }
      
      // Resolve contact_id if name provided
      let contactId: string | null = null;
      if (input.contact_name) {
        const contacts = await lookupRecord("contacts", "name", input.contact_name as string, teamId, supabaseAdmin);
        if (contacts.length > 0) contactId = contacts[0].id;
      }

      const eventType = (input.event_type as string) || "call";
      const isReminder = eventType === "reminder";

      // For reminders: end_time = start_time, skip availability check, insert directly
      const startTime = input.start_time as string;
      const endTime = isReminder ? startTime : (input.end_time as string || startTime);

      if (!isReminder && !input.end_time) {
        return { result: { error: "end_time required for non-reminder events" }, entityType: "diary_events" };
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const res = await fetch(`${supabaseUrl}/functions/v1/diary-booking`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "book",
          user_id: userId,
          workspace_id: teamId,
          title: input.title,
          description: input.description || null,
          start_time: startTime,
          end_time: endTime,
          event_type: eventType,
          candidate_id: candidateId,
          contact_id: contactId,
          job_id: input.job_id || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) return { result: { error: data.error || "Failed to book" }, entityType: "diary_events" };
      return { result: { ...data, navigate_to: "/home#diary" }, entityType: "diary_events", entityId: data.event?.id };
    }
    case "get_diary_events": {
      const teamId = await getUserTeamId(supabaseAdmin, userId);
      if (!teamId) return { result: { error: "No workspace found" }, entityType: "diary_events" };
      
      const now = new Date();
      let dateFrom: string;
      let dateTo: string;
      const period = (input.period as string) || "today";
      
      if (period === "today") {
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
      } else if (period === "tomorrow") {
        const tom = new Date(now);
        tom.setDate(tom.getDate() + 1);
        dateFrom = new Date(tom.getFullYear(), tom.getMonth(), tom.getDate()).toISOString();
        dateTo = new Date(tom.getFullYear(), tom.getMonth(), tom.getDate(), 23, 59, 59).toISOString();
      } else if (period === "this_week") {
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const endOfWeek = new Date(now);
        endOfWeek.setDate(endOfWeek.getDate() + (5 - endOfWeek.getDay()));
        dateTo = new Date(endOfWeek.getFullYear(), endOfWeek.getMonth(), endOfWeek.getDate(), 23, 59, 59).toISOString();
      } else {
        dateFrom = (input.date_from as string) || now.toISOString();
        dateTo = (input.date_to as string) || new Date(now.getTime() + 7 * 86400000).toISOString();
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const res = await fetch(`${supabaseUrl}/functions/v1/diary-booking`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_events", user_id: userId, workspace_id: teamId, date_from: dateFrom, date_to: dateTo }),
      });
      const data = await res.json();
      if (!res.ok) return { result: { error: data.error || "Failed to get events" }, entityType: "diary_events" };
      return { result: data, entityType: "diary_events" };
    }
    case "cancel_diary_event": {
      const teamId = await getUserTeamId(supabaseAdmin, userId);
      if (!teamId) return { result: { error: "No workspace found" }, entityType: "diary_events" };
      
      let eventId = input.event_id as string;
      
      // If candidate_name provided, find the event
      if (!eventId && input.candidate_name) {
        const { data: events } = await supabaseAdmin
          .from("diary_events")
          .select("id, title, start_time, candidate_id, candidates(name)")
          .eq("user_id", userId)
          .eq("status", "scheduled")
          .order("start_time");
        
        const match = (events || []).find((e: any) =>
          e.title?.toLowerCase().includes((input.candidate_name as string).toLowerCase()) ||
          e.candidates?.name?.toLowerCase().includes((input.candidate_name as string).toLowerCase())
        );
        if (!match) return { result: { error: `No scheduled event found matching "${input.candidate_name}".` }, entityType: "diary_events" };
        eventId = match.id;
      }
      
      if (!eventId) return { result: { error: "event_id or candidate_name required" }, entityType: "diary_events" };

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const res = await fetch(`${supabaseUrl}/functions/v1/diary-booking`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", user_id: userId, workspace_id: teamId, event_id: eventId }),
      });
      const data = await res.json();
      if (!res.ok) return { result: { error: data.error || "Failed to cancel" }, entityType: "diary_events" };
      return { result: { ...data, navigate_to: "/home#diary" }, entityType: "diary_events", entityId: eventId };
    }
    case "reschedule_diary_event": {
      const teamId = await getUserTeamId(supabaseAdmin, userId);
      if (!teamId) return { result: { error: "No workspace found" }, entityType: "diary_events" };
      
      let eventId = input.event_id as string;
      
      if (!eventId && input.candidate_name) {
        const { data: events } = await supabaseAdmin
          .from("diary_events")
          .select("id, title, candidate_id, candidates(name)")
          .eq("user_id", userId)
          .eq("status", "scheduled")
          .order("start_time");
        
        const match = (events || []).find((e: any) =>
          e.title?.toLowerCase().includes((input.candidate_name as string).toLowerCase()) ||
          e.candidates?.name?.toLowerCase().includes((input.candidate_name as string).toLowerCase())
        );
        if (!match) return { result: { error: `No scheduled event found matching "${input.candidate_name}".` }, entityType: "diary_events" };
        eventId = match.id;
      }
      
      if (!eventId) return { result: { error: "event_id or candidate_name required" }, entityType: "diary_events" };
      
      // If no new time provided, find new slots first
      if (!input.new_start_time) {
        const slotsRes = await fetch(`${Deno.env.get("SUPABASE_URL")!}/functions/v1/diary-booking`, {
          method: "POST",
          headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "find_slots", user_id: userId, workspace_id: teamId, max_slots: 3 }),
        });
        const slotsData = await slotsRes.json();
        return { result: { needs_new_time: true, event_id: eventId, available_slots: slotsData.slots || [] }, entityType: "diary_events" };
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const res = await fetch(`${supabaseUrl}/functions/v1/diary-booking`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reschedule", user_id: userId, workspace_id: teamId, event_id: eventId, new_start_time: input.new_start_time, new_end_time: input.new_end_time }),
      });
      const data = await res.json();
      if (!res.ok) return { result: { error: data.error || "Failed to reschedule" }, entityType: "diary_events" };
      return { result: { ...data, navigate_to: "/home#diary" }, entityType: "diary_events", entityId: eventId };
    }
    // ─── Recruitment workflow tools ───
    case "lookup_job": {
      const title = (input.title as string).trim();
      const teamId = await getUserTeamId(supabaseAdmin, userId);
      const { data: jobs } = await supabaseAdmin
        .from("jobs")
        .select("id, title, status, company_id, companies(name)")
        .ilike("title", `%${title}%`)
        .eq("workspace_id", teamId)
        .limit(5);
      
      if (!jobs || jobs.length === 0) {
        return { result: { matches: [], message: `No job found matching "${title}".` }, entityType: "jobs" };
      }
      if (jobs.length === 1) {
        return { result: { matches: jobs, auto_selected: jobs[0], message: `Found "${jobs[0].title}" — using this job.` }, entityType: "jobs" };
      }
      return { result: { matches: jobs, message: `Found ${jobs.length} jobs matching "${title}". Did you mean ${jobs.slice(0, 3).map((j: any) => j.title).join(", or ")}?` }, entityType: "jobs" };
    }
    case "get_job_applications_summary": {
      const jobId = input.job_id as string;
      const { data: job } = await supabaseAdmin.from("jobs").select("title").eq("id", jobId).single();
      const { data: apps } = await supabaseAdmin
        .from("job_applications")
        .select("id, status, ai_match_score, applicant_name")
        .eq("job_id", jobId);
      
      const total = (apps || []).length;
      const byStatus: Record<string, number> = {};
      for (const app of apps || []) {
        byStatus[app.status || "new"] = (byStatus[app.status || "new"] || 0) + 1;
      }
      const topScored = (apps || [])
        .filter((a: any) => a.ai_match_score != null)
        .sort((a: any, b: any) => (b.ai_match_score || 0) - (a.ai_match_score || 0))
        .slice(0, 3)
        .map((a: any) => ({ name: a.applicant_name, score: a.ai_match_score }));
      const unscored = (apps || []).filter((a: any) => a.ai_match_score == null).length;
      
      return {
        result: {
          job_title: job?.title,
          total,
          by_status: byStatus,
          top_scored: topScored,
          unscored,
          message: `${job?.title || "Job"} has ${total} applications: ${Object.entries(byStatus).map(([s, c]) => `${c} ${s}`).join(", ")}.${unscored > 0 ? ` ${unscored} still need scoring.` : ""}`,
        },
        entityType: "job_applications",
        entityId: jobId,
      };
    }
    case "score_unprocessed_applications": {
      const jobId = input.job_id as string;
      const { data: apps } = await supabaseAdmin
        .from("job_applications")
        .select("id")
        .eq("job_id", jobId)
        .is("processed_at", null);
      
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      let scored = 0;
      for (const app of apps || []) {
        const res = await fetch(`${supabaseUrl}/functions/v1/process-application`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ application_id: app.id }),
        });
        if (res.ok) scored++;
      }
      return {
        result: { scored, total: (apps || []).length, message: `Scored ${scored} applications.`, navigate_to: `/jobs/${jobId}` },
        entityType: "job_applications",
        entityId: jobId,
      };
    }
    case "bulk_reject_low_scoring": {
      const jobId = input.job_id as string;
      const threshold = (input.threshold as number) || 50;
      const { data: apps } = await supabaseAdmin
        .from("job_applications")
        .select("id, applicant_name, ai_match_score")
        .eq("job_id", jobId)
        .lt("ai_match_score", threshold)
        .neq("status", "rejected");
      
      const ids = (apps || []).map((a: any) => a.id);
      if (ids.length === 0) {
        return { result: { rejected: 0, message: `No applications scoring below ${threshold} to reject.` }, entityType: "job_applications" };
      }
      
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      
      // Update status
      await supabaseAdmin.from("job_applications").update({ status: "rejected" }).in("id", ids);
      
      // Send rejection emails
      for (const app of apps || []) {
        await fetch(`${supabaseUrl}/functions/v1/send-applicant-update`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ application_id: app.id, new_status: "rejected", old_status: "new" }),
        }).catch(() => {});
      }
      
      return {
        result: { rejected: ids.length, threshold, message: `Rejected ${ids.length} applications scoring below ${threshold}.`, navigate_to: `/jobs/${jobId}` },
        entityType: "job_applications",
        entityId: jobId,
      };
    }
    case "get_shortlist_summary": {
      const jobId = input.job_id as string;
      const { data: job } = await supabaseAdmin.from("jobs").select("title").eq("id", jobId).single();
      const { data: entries } = await supabaseAdmin
        .from("job_shortlist")
        .select("id, status, match_score, candidates(name)")
        .eq("job_id", jobId)
        .order("match_score", { ascending: false });
      
      const total = (entries || []).length;
      const byStatus: Record<string, number> = {};
      for (const e of entries || []) {
        byStatus[e.status || "pending"] = (byStatus[e.status || "pending"] || 0) + 1;
      }
      const topCandidates = (entries || []).slice(0, 3).map((e: any) => ({
        name: e.candidates?.name,
        score: e.match_score,
        status: e.status,
      }));
      
      return {
        result: {
          job_title: job?.title,
          total,
          by_status: byStatus,
          top_candidates: topCandidates,
          message: `${job?.title || "Job"} shortlist has ${total} candidates: ${Object.entries(byStatus).map(([s, c]) => `${c} ${s}`).join(", ")}.`,
        },
        entityType: "job_shortlist",
        entityId: jobId,
      };
    }
    case "get_unresponsive_candidates": {
      const jobId = input.job_id as string;
      const { data: job } = await supabaseAdmin.from("jobs").select("title").eq("id", jobId).single();
      const { data: entries } = await supabaseAdmin
        .from("job_shortlist")
        .select("id, candidate_id, outreach_sent_at, response_received_at, candidates(name, email)")
        .eq("job_id", jobId)
        .not("outreach_sent_at", "is", null)
        .is("response_received_at", null);
      
      const unresponsive = (entries || []).map((e: any) => ({
        name: e.candidates?.name,
        email: e.candidates?.email,
        sent_at: e.outreach_sent_at,
      }));
      
      return {
        result: {
          job_title: job?.title,
          count: unresponsive.length,
          candidates: unresponsive,
          message: unresponsive.length > 0
            ? `${unresponsive.length} candidates haven't responded: ${unresponsive.map((c: any) => c.name).join(", ")}.`
            : "Everyone has responded!",
        },
        entityType: "job_shortlist",
        entityId: jobId,
      };
    }
    case "send_applicant_update": {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const res = await fetch(`${supabaseUrl}/functions/v1/send-applicant-update`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: input.application_id,
          new_status: input.new_status,
          old_status: input.old_status || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) return { result: { error: data.error || "Failed to send update" }, entityType: "job_applications" };
      return { result: data, entityType: "job_applications", entityId: input.application_id as string };
    }
    // ─── Golden Thread tools ───
    case "get_unlinked_jobs": {
      const teamId = await getUserTeamId(supabaseAdmin, userId);
      const { data: allJobs } = await supabaseAdmin
        .from("jobs")
        .select("id, title, status, companies(name)")
        .eq("workspace_id", teamId)
        .eq("status", "active");
      
      const { data: links } = await supabaseAdmin
        .from("jobs_projects")
        .select("job_id");
      
      const linkedJobIds = new Set((links ?? []).map((l: any) => l.job_id));
      const unlinked = (allJobs ?? []).filter((j: any) => !linkedJobIds.has(j.id));
      
      return {
        result: {
          count: unlinked.length,
          jobs: unlinked.map((j: any) => ({
            id: j.id,
            title: j.title,
            company: j.companies?.name || "No company",
          })),
          message: unlinked.length === 0
            ? "All active jobs are linked to projects."
            : `${unlinked.length} active job${unlinked.length > 1 ? "s" : ""} not linked to a project: ${unlinked.map((j: any) => j.title).join(", ")}.`,
        },
        entityType: "jobs",
      };
    }
    case "get_recruitment_pipeline_value": {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      
      const { data: deals } = await supabaseAdmin
        .from("crm_deals")
        .select("id, title, value, currency")
        .ilike("title", "%Placement Fee%")
        .gte("created_at", startOfMonth);
      
      const total = (deals ?? []).reduce((s: number, d: any) => s + (d.value || 0), 0);
      const currency = deals?.[0]?.currency || "GBP";
      
      return {
        result: {
          total,
          currency,
          deal_count: (deals ?? []).length,
          deals: (deals ?? []).map((d: any) => ({ title: d.title, value: d.value, currency: d.currency })),
          message: (deals ?? []).length === 0
            ? "No recruitment placement deals created this month yet."
            : `Recruitment pipeline this month: ${currency === "GBP" ? "£" : currency === "USD" ? "$" : "€"}${total.toLocaleString()} across ${(deals ?? []).length} placement deal${(deals ?? []).length > 1 ? "s" : ""}.`,
        },
        entityType: "crm_deals",
      };
    }
    case "link_job_to_project": {
      const jobId = input.job_id as string;
      const projectId = input.project_id as string;
      
      const { error } = await supabaseAdmin
        .from("jobs_projects")
        .insert({ job_id: jobId, project_id: projectId, created_by: userId });
      
      if (error) {
        if (error.code === "23505") {
          return { result: { message: "This job is already linked to that project." }, entityType: "jobs_projects" };
        }
        return { result: { error: error.message }, entityType: "jobs_projects" };
      }
      
      return {
        result: { success: true, message: "Job linked to project successfully." },
        entityType: "jobs_projects",
        invalidate_queries: ["jobs_projects", "jobs_projects_list"],
      };
    }
    // ─── New CRUD tools ───
    case "update_record": {
      const tableMap: Record<string, string> = {
        company: "companies",
        contact: "contacts",
        deal: "crm_deals",
        opportunity: "crm_opportunities",
        engagement: "engagements",
        invoice: "crm_invoices",
        candidate: "candidates",
      };
      const table = tableMap[input.entity_type as string];
      if (!table) return { result: { error: "Unknown entity type" }, entityType: "unknown" };

      const { data, error } = await supabaseAdmin
        .from(table)
        .update({ ...(input.fields as object), updated_at: new Date().toISOString() })
        .eq("id", input.entity_id as string)
        .select()
        .single();
      if (error) return { result: { error: error.message }, entityType: table };
      return { result: { success: true, updated: data }, entityType: table, entityId: input.entity_id as string };
    }
    case "delete_record": {
      const delTableMap: Record<string, string> = {
        company: "companies",
        contact: "contacts",
        deal: "crm_deals",
        opportunity: "crm_opportunities",
        engagement: "engagements",
        candidate: "candidates",
      };
      const delTable = delTableMap[input.entity_type as string];
      if (!delTable) return { result: { error: "Unknown entity type" }, entityType: "unknown" };

      // Soft delete where possible (tables with deleted_at column)
      const softDeleteTables = new Set(["companies", "contacts", "crm_deals", "crm_opportunities"]);
      if (softDeleteTables.has(delTable)) {
        const { error } = await supabaseAdmin
          .from(delTable)
          .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", input.entity_id as string);
        if (error) return { result: { error: error.message }, entityType: delTable };
      } else {
        const { error } = await supabaseAdmin
          .from(delTable)
          .delete()
          .eq("id", input.entity_id as string);
        if (error) return { result: { error: error.message }, entityType: delTable };
      }
      return { result: { success: true, deleted: input.entity_name }, entityType: delTable, entityId: input.entity_id as string };
    }
    case "create_candidate": {
      const candTeamId = await getUserTeamId(supabaseAdmin, userId);
      const { data, error } = await supabaseAdmin
        .from("candidates")
        .insert({
          name: input.name as string,
          email: (input.email as string) || null,
          phone: (input.phone as string) || null,
          current_title: (input.current_title as string) || null,
          current_company: (input.current_company as string) || null,
          location: (input.location as string) || null,
          skills: input.skills
            ? { primary_skills: (input.skills as string).split(",").map((s: string) => s.trim()) }
            : [],
          tenant_id: candTeamId,
          owner_id: userId,
          source: "jarvis",
          status: "active",
        })
        .select("id, name")
        .single();
      if (error) return { result: { error: error.message }, entityType: "candidates" };
      return { result: { ...data, navigate_to: `/talent` }, entityType: "candidates", entityId: data?.id };
    }
    case "generate_and_send_invoice": {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      // Step 1: Generate PDF via existing edge function
      const pdfRes = await fetch(`${supabaseUrl}/functions/v1/invoice-generate-pdf`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: input.invoice_id }),
      });
      const pdfData = await pdfRes.json();
      if (!pdfRes.ok) return { result: { error: pdfData.error || "PDF generation failed" }, entityType: "crm_invoices" };

      // Step 2: Get invoice details
      const { data: invoice } = await supabaseAdmin
        .from("crm_invoices")
        .select("*, crm_companies(name), crm_deals(title)")
        .eq("id", input.invoice_id as string)
        .single();

      // Step 3: Send email via Resend if contact_id provided
      if (input.contact_id) {
        const { data: invContact } = await supabaseAdmin
          .from("contacts")
          .select("email, name")
          .eq("id", input.contact_id as string)
          .maybeSingle();
        if (invContact?.email) {
          const { data: invKeys } = await supabaseAdmin
            .from("integration_settings")
            .select("key_name, key_value")
            .eq("user_id", userId)
            .eq("service", "resend");
          const invKeyMap = Object.fromEntries((invKeys ?? []).map((k: any) => [k.key_name, k.key_value]));
          if (invKeyMap.RESEND_API_KEY && invKeyMap.FROM_EMAIL_ADDRESS) {
            const emailBody = `<p>Dear ${invContact.name},</p><p>Please find attached invoice ${invoice?.invoice_number} for £${invoice?.total?.toLocaleString()}.</p><p>Due date: ${invoice?.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB') : 'As agreed'}.</p><p>Kind regards</p>`;
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${invKeyMap.RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: invKeyMap.FROM_EMAIL_ADDRESS,
                to: invContact.email,
                subject: `Invoice ${invoice?.invoice_number} — ${(invoice?.crm_companies as any)?.name || ""}`,
                html: emailBody,
              }),
            });
          }
        }
      }

      return {
        result: {
          success: true,
          invoice_number: invoice?.invoice_number || pdfData.invoice_number,
          message: `Invoice ${invoice?.invoice_number || ""} generated and sent.`,
          navigate_to: `/crm/invoices/${input.invoice_id}`,
        },
        entityType: "crm_invoices",
        entityId: input.invoice_id as string,
      };
    }
    case "initiate_ai_call": {
      let toNumber = input.phone_number as string;
      if (!toNumber && input.contact_id) {
        const { data: callContact } = await supabaseAdmin
          .from("contacts")
          .select("phone, name")
          .eq("id", input.contact_id as string)
          .maybeSingle();
        toNumber = callContact?.phone || "";
        if (!toNumber) {
          const { data: callCand } = await supabaseAdmin
            .from("candidates")
            .select("phone, name")
            .eq("id", input.contact_id as string)
            .maybeSingle();
          toNumber = callCand?.phone || "";
        }
      }
      if (!toNumber) return { result: { error: "No phone number found. Please provide a number." }, entityType: "calls" };

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      const callRes = await fetch(`${supabaseUrl}/functions/v1/initiate-ai-call`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: input.contact_id || null,
          to_number: toNumber,
          purpose: input.purpose,
          custom_instructions: input.custom_instructions || null,
        }),
      });
      const callData = await callRes.json();
      if (!callRes.ok) return { result: { error: callData.message || "Call failed to connect" }, entityType: "calls" };
      return {
        result: { success: true, call_sid: callData.call_sid, message: `Call initiated to ${toNumber}. Call SID: ${callData.call_sid}` },
        entityType: "calls",
      };
    }
    case "create_sow": {
      const sowTeamId = await getUserTeamId(supabaseAdmin, userId);
      const sowResolved = await resolveCompanyIds(supabaseAdmin, input.company_id as string, userId, sowTeamId);
      const { data, error } = await supabaseAdmin
        .from("sows")
        .insert({
          workspace_id: sowTeamId,
          company_id: sowResolved.companyId || input.company_id,
          engagement_id: (input.engagement_id as string) || null,
          sow_ref: (input.sow_ref as string) || null,
          value: (input.value as number) || 0,
          currency: (input.currency as string) || "GBP",
          billing_model: (input.billing_model as string) || "fixed",
          start_date: (input.start_date as string) || null,
          end_date: (input.end_date as string) || null,
          notes: (input.notes as string) || null,
          status: "draft",
        })
        .select("id, sow_ref, value")
        .single();
      if (error) return { result: { error: error.message }, entityType: "sows" };
      return { result: { ...data, navigate_to: "/home" }, entityType: "sows", entityId: data?.id };
    }
    case "create_outreach_campaign": {
      const campTeamId = await getUserTeamId(supabaseAdmin, userId);
      const { data, error } = await supabaseAdmin
        .from("outreach_campaigns")
        .insert({
          workspace_id: campTeamId,
          name: input.name as string,
          channel: input.channel as string,
          description: (input.description as string) || null,
          status: "draft",
          owner_id: userId,
        })
        .select("id, name")
        .single();
      if (error) return { result: { error: error.message }, entityType: "outreach_campaigns" };
      return { result: { ...data, navigate_to: "/outreach" }, entityType: "outreach_campaigns", entityId: data?.id };
    }
    case "add_to_outreach": {
      const outTeamId = await getUserTeamId(supabaseAdmin, userId);
      let entityEmail = input.entity_email as string;
      let entityPhone = input.entity_phone as string;

      if (input.contact_id && !entityEmail) {
        const { data: outContact } = await supabaseAdmin
          .from("contacts").select("email, phone, name")
          .eq("id", input.contact_id as string).maybeSingle();
        entityEmail = entityEmail || outContact?.email || "";
        entityPhone = entityPhone || outContact?.phone || "";
      }

      const { data, error } = await supabaseAdmin
        .from("outreach_targets")
        .insert({
          workspace_id: outTeamId,
          campaign_id: input.campaign_id as string,
          contact_id: (input.contact_id as string) || null,
          candidate_id: (input.candidate_id as string) || null,
          entity_name: input.entity_name as string,
          entity_email: entityEmail || null,
          entity_phone: entityPhone || null,
          state: "queued",
          priority: 5,
        })
        .select("id")
        .single();
      if (error) return { result: { error: error.message }, entityType: "outreach_targets" };
      return { result: { success: true, navigate_to: "/outreach" }, entityType: "outreach_targets", entityId: data?.id };
    }
    case "add_note": {
      const noteTeamId = await getUserTeamId(supabaseAdmin, userId);
      const { data, error } = await supabaseAdmin
        .from("notes")
        .insert({
          entity_type: input.entity_type as string,
          entity_id: input.entity_id as string,
          content: input.content as string,
          pinned: (input.pinned as boolean) || false,
          owner_id: userId,
          team_id: noteTeamId,
          source: "voice",
          visibility: "team",
        })
        .select("id")
        .single();
      if (error) return { result: { error: error.message }, entityType: "notes" };
      return {
        result: { success: true, note_id: data?.id },
        entityType: "notes",
        entityId: input.entity_id as string,
      };
    }
    case "mark_invoice_paid": {
      let invoiceId = input.invoice_id as string;
      if (!invoiceId && input.company_name) {
        const { data: inv } = await supabaseAdmin
          .from("crm_invoices")
          .select("id, invoice_number, total, crm_companies(name)")
          .neq("status", "paid")
          .order("created_at", { ascending: false })
          .limit(10);
        // Filter in code for company name match
        const match = (inv ?? []).find((i: any) => 
          (i.crm_companies as any)?.name?.toLowerCase().includes((input.company_name as string).toLowerCase())
        );
        invoiceId = match?.id;
      }
      if (!invoiceId) return { result: { error: "No unpaid invoice found. Which invoice?" }, entityType: "crm_invoices" };

      const { data, error } = await supabaseAdmin
        .from("crm_invoices")
        .update({ status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", invoiceId)
        .select("id, invoice_number, total")
        .single();
      if (error) return { result: { error: error.message }, entityType: "crm_invoices" };
      return {
        result: { success: true, ...data, message: `Invoice ${data?.invoice_number} marked as paid.` },
        entityType: "crm_invoices",
        entityId: invoiceId,
      };
    }
    case "search_talent": {
      const roleTitle = input.role_title as string;
      const keySkills = (input.key_skills as string[]) || [];
      const sector = (input.sector as string) || "";
      const location = (input.location as string) || "";
      const minYears = (input.min_years_experience as number) || 0;
      const teamId = await getUserTeamId(supabaseAdmin, userId);
      if (!teamId) return { result: { error: "Workspace not found" }, entityType: "candidates" };

      // Build a lightweight job spec for the match engine
      // First create a temporary job spec record to pass to job-match
      const { data: tempSpec, error: specError } = await supabaseAdmin
        .from("job_specs")
        .insert({
          workspace_id: teamId,
          title: roleTitle,
          key_skills: keySkills.length > 0 ? keySkills : null,
          sector: sector || null,
          location: location || null,
          type: "permanent",
          description_text: `Find candidates for: ${roleTitle}${sector ? ` in ${sector}` : ""}${location ? `, based in ${location}` : ""}${minYears > 0 ? `, ${minYears}+ years experience` : ""}`,
        })
        .select()
        .single();

      if (specError || !tempSpec) {
        return { result: { error: "Failed to create search spec" }, entityType: "candidates" };
      }

      // Call the job-match edge function
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const res = await fetch(`${supabaseUrl}/functions/v1/job-match`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobSpecId: tempSpec.id }),
      });

      const data = await res.json();

      // Clean up the temporary spec
      await supabaseAdmin.from("job_specs").delete().eq("id", tempSpec.id);

      if (!res.ok || !data.success) {
        return {
          result: {
            success: false,
            total_found: 0,
            top_matches: [],
            message: `I searched your talent database for "${roleTitle}" but couldn't complete the search. This usually means there are no parsed CVs in the system yet. To add candidates: go to Talent → Add Candidate, or import CVs using the Import button.`,
          },
          entityType: "candidates",
        };
      }

      const matches = (data.matches || []).slice(0, 10);
      const topMatches = matches.map((m: any, i: number) => ({
        rank: i + 1,
        score: m.overall_score,
        title: m.candidate?.current_title || "Unknown role",
        company: m.candidate?.current_company || "Unknown company",
        location: m.candidate?.location || "Unknown",
        skills_matched: m.score_breakdown?.matched_skills?.slice(0, 4) || [],
        tenure: m.score_breakdown?.tenure_analysis?.average_tenure_months
          ? `${Math.round(m.score_breakdown.tenure_analysis.average_tenure_months / 12 * 10) / 10}yr avg tenure`
          : null,
        risk_flags: m.risk_flags || [],
        candidate_id: m.talent_id,
        // No name or email — PII hidden until user requests reveal
      }));

      if (data.matchCount === 0 || topMatches.length === 0) {
        return {
          result: {
            success: true,
            total_found: 0,
            top_matches: [],
            navigate_to: "/talent",
            message: `I searched your talent database for "${roleTitle}" but found no matching candidates${keySkills.length > 0 ? ` with skills: ${keySkills.join(", ")}` : ""}. Your database currently has candidates but none match this criteria. Try broadening the search — fewer skills, or remove the sector filter. Or add new candidates via Talent → Add Candidate.`,
          },
          entityType: "candidates",
        };
      }

      return {
        result: {
          success: true,
          total_found: data.matchCount,
          top_matches: topMatches,
          navigate_to: `/talent?match=${tempSpec.id}`,
          message: `Found ${data.matchCount} candidates matching "${roleTitle}". Showing the top ${topMatches.length} ranked by fit — company prestige, tenure stability, and skill coverage. I'm taking you to the Talent page now. Names are hidden — tap Reveal on the ones you want to engage.`,
        },
        entityType: "candidates",
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

    // Rate limiting
    const rateCheck = await checkRateLimit(supabaseAdmin, userId, "jarvis-assistant", 60);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: "Rate limit reached. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { user_message, conversation_history, user_first_name, nav_history, flow_state, entity_memory, direct_save } = body;

    // ── Direct save from confirmation card ──
    if (direct_save) {
      const { card_type, fields, resolved_ids } = body;
      const result = await executeDirectSave(card_type, fields, resolved_ids || {}, supabaseAdmin, userId);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!user_message || typeof user_message !== "string") {
      return new Response(JSON.stringify({ error: "user_message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build messages for Lovable AI (OpenAI format)
    let systemWithName = SYSTEM_PROMPT;
    if (user_first_name) {
      systemWithName += `\n\nThe user's first name is "${user_first_name}". Use it when greeting them.`;
    }
    // Inject session navigation history so Jarvis can handle "go back" requests
    if (nav_history && Array.isArray(nav_history) && nav_history.length > 0) {
      const historyStr = nav_history
        .map((e: { path: string; label: string }) => `${e.label} (${e.path})`)
        .join(" → ");
      const currentPage = nav_history[nav_history.length - 1];
      systemWithName += `\n\nSESSION NAVIGATION HISTORY (pages visited in order, earliest first):\n${historyStr}\nCurrent page: ${currentPage?.label || 'unknown'} (${currentPage?.path || '/'})\nUse this to answer "go back", "where did we come from", "back to that company", "back to where we started", "what have we looked at" requests.`;
    }
    // Inject active flow state for guided collection continuity
    if (flow_state && flow_state.flow) {
      systemWithName += `\n\nACTIVE GUIDED COLLECTION FLOW:
Type: ${flow_state.flow}
Fields collected so far: ${JSON.stringify(flow_state.collectedFields)}
Current question index: ${flow_state.currentQuestion}
Awaiting confirmation: ${flow_state.awaitingConfirmation}

IMPORTANT: You are in the middle of a ${flow_state.flow} flow. Continue from where you left off.
- Do NOT restart the flow or re-ask for fields already collected.
- Ask the NEXT unanswered field(s) — maximum 2 per message.
- If all fields are collected and awaitingConfirmation is false, present a summary and ask to confirm.
- If the user says "cancel", "stop", or "start over", abort the flow and confirm cancellation.
- If the user says "change the [field]", ask for the new value for that specific field.`;
    }

    // Inject entity memory from frontend session
    if (entity_memory && typeof entity_memory === "string") {
      systemWithName += `\n\n${entity_memory}`;
    }

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
          userId,
          authHeader!
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
          userId,
          authHeader!
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
    let responseText = aiResponse.choices?.[0]?.message?.content || "";

    const parseJsonValue = (raw: string): unknown | null => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };

    const extractBalanced = (
      source: string,
      startIndex: number,
      openChar: "{" | "[",
      closeChar: "}" | "]"
    ): { value: string | null; endIndex: number } => {
      const begin = source.indexOf(openChar, startIndex);
      if (begin === -1) return { value: null, endIndex: startIndex };

      let depth = 0;
      let inString = false;
      let escaped = false;

      for (let i = begin; i < source.length; i++) {
        const ch = source[i];

        if (inString) {
          if (escaped) {
            escaped = false;
            continue;
          }
          if (ch === "\\") {
            escaped = true;
            continue;
          }
          if (ch === '"') {
            inString = false;
          }
          continue;
        }

        if (ch === '"') {
          inString = true;
          continue;
        }

        if (ch === openChar) depth += 1;
        if (ch === closeChar) depth -= 1;

        if (depth === 0) {
          return { value: source.slice(begin, i + 1), endIndex: i + 1 };
        }
      }

      return { value: null, endIndex: startIndex };
    };

    const extractActionPayload = (text: string): { payload: Record<string, unknown> | null; cleanedText: string } => {
      const lower = text.toLowerCase();
      const openIndex = lower.indexOf("<action>");
      if (openIndex === -1) return { payload: null, cleanedText: text };

      const afterOpen = openIndex + "<action>".length;
      const closeIndex = lower.indexOf("</action>", afterOpen);

      let payload: Record<string, unknown> | null = null;
      let removeEnd = closeIndex !== -1 ? closeIndex + "</action>".length : afterOpen;

      if (closeIndex !== -1) {
        const explicitPayload = parseJsonValue(text.slice(afterOpen, closeIndex).trim());
        if (explicitPayload && typeof explicitPayload === "object" && !Array.isArray(explicitPayload)) {
          payload = explicitPayload as Record<string, unknown>;
        } else {
          const fallbackObject = extractBalanced(text, afterOpen, "{", "}");
          const fallbackPayload = fallbackObject.value ? parseJsonValue(fallbackObject.value) : null;
          if (fallbackPayload && typeof fallbackPayload === "object" && !Array.isArray(fallbackPayload)) {
            payload = fallbackPayload as Record<string, unknown>;
            removeEnd = Math.max(removeEnd, fallbackObject.endIndex);
          }
        }
      } else {
        const fallbackObject = extractBalanced(text, afterOpen, "{", "}");
        const fallbackPayload = fallbackObject.value ? parseJsonValue(fallbackObject.value) : null;
        if (fallbackPayload && typeof fallbackPayload === "object" && !Array.isArray(fallbackPayload)) {
          payload = fallbackPayload as Record<string, unknown>;
          removeEnd = fallbackObject.endIndex;
        }
      }

      let cleanedText = `${text.slice(0, openIndex)} ${text.slice(removeEnd)}`;
      cleanedText = cleanedText.replace(/^\s*<\/guided_tour>\s*/i, "");
      return { payload, cleanedText: cleanedText.trim() };
    };

    const { payload: actionPayload, cleanedText } = extractActionPayload(responseText);
    responseText = cleanedText;

    // Parse guided_tour from action payload first, then legacy tags
    let guidedTour: any[] | null = null;
    if (actionPayload?.type === "GUIDED_TOUR" && Array.isArray(actionPayload?.steps)) {
      guidedTour = actionPayload.steps as any[];
    }

    const tourMatch = responseText.match(/<guided_tour>([\s\S]*?)<\/guided_tour>/i);
    if (!guidedTour && tourMatch) {
      const parsedTour = parseJsonValue(tourMatch[1]);
      if (Array.isArray(parsedTour)) {
        guidedTour = parsedTour as any[];
      }
      responseText = responseText.replace(/<guided_tour>[\s\S]*?<\/guided_tour>/i, "").trim();
    }

    const legacyTourOpenIndex = responseText.toLowerCase().indexOf("<guided_tour>");
    if (!guidedTour && legacyTourOpenIndex !== -1) {
      const fallbackArray = extractBalanced(responseText, legacyTourOpenIndex, "[", "]");
      const parsedFallback = fallbackArray.value ? parseJsonValue(fallbackArray.value) : null;
      if (Array.isArray(parsedFallback)) {
        guidedTour = parsedFallback as any[];
        responseText = `${responseText.slice(0, legacyTourOpenIndex)} ${responseText.slice(fallbackArray.endIndex)}`.trim();
      }
    }

    // Parse suggestions from response text or action payload
    let suggestions: any[] | null = null;
    if (actionPayload?.type === 'SHOW_MENU' && actionPayload?.options) {
      // Convert SHOW_MENU options to suggestion format
      const menuOptions = actionPayload.options as string[];
      const menuDestMap: Record<string, string> = {
        "Home Dashboard": "home", "Companies": "companies", "Contacts": "contacts",
        "Talent Database": "talent", "Outreach": "outreach", "Revenue Intelligence": "insights",
        "Canvas Org Chart": "canvas", "Canvas": "canvas", "Projects": "projects",
        "Admin Settings": "admin", "Admin": "admin",
      };
      suggestions = menuOptions.map(label => ({
        label,
        destination: menuDestMap[label] || label.toLowerCase(),
        isMenu: true,
      }));
    }
    const suggestionsMatch = responseText.match(/<suggestions>([\s\S]*?)<\/suggestions>/);
    if (suggestionsMatch) {
      try {
        suggestions = JSON.parse(suggestionsMatch[1]);
        responseText = responseText.replace(/<suggestions>[\s\S]*?<\/suggestions>/, '').trim();
      } catch (e) {
        console.warn("[jarvis] Failed to parse suggestions:", e);
      }
    }

    // Strip any malformed control tags from user-facing response text
    responseText = responseText
      .replace(/<\/?action>/gi, "")
      .replace(/<\/?guided_tour>/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Extract navigation + target action from action payload or executed tool results
    let navigationPath: string | null = null;
    let targetAction: string | null = null;
    let targetId: string | null = null;

    // First check structured action payload
    if (actionPayload) {
      const aType = actionPayload.type as string;
      if (aType === 'NAVIGATE' && actionPayload.destination) {
        navigationPath = actionPayload.destination as string;
        if (actionPayload.highlight) targetId = actionPayload.highlight as string;
      } else if (aType === 'HIGHLIGHT' && actionPayload.highlight) {
        targetId = actionPayload.highlight as string;
      } else if (aType === 'CLICK' && actionPayload.highlight) {
        targetId = actionPayload.highlight as string;
        targetAction = 'click';
      }
    }

    // Then check tool results (may override or supplement)
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
    const mutationTools = new Set(["create_company", "create_contact", "create_project", "create_opportunity", "update_opportunity_stage", "create_deal", "create_invoice", "log_call", "send_email", "send_sms", "create_job", "generate_adverts", "update_advert", "run_shortlist", "approve_all_shortlist", "update_shortlist_entry", "describe_shortlist_candidate", "book_diary_event", "cancel_diary_event", "reschedule_diary_event", "update_record", "delete_record", "create_candidate", "generate_and_send_invoice", "initiate_ai_call", "create_sow", "create_outreach_campaign", "add_to_outreach", "mark_invoice_paid", "search_talent"]);
    const entityQueryMap: Record<string, string[]> = {
      companies: ["companies", "canvas-companies", "crm_companies"],
      contacts: ["contacts", "company-contacts", "crm_contacts", "all-contacts"],
      crm_companies: ["crm_companies"],
      crm_contacts: ["crm_contacts"],
      crm_projects: ["crm_projects", "engagements"],
      crm_opportunities: ["crm_opportunities"],
      crm_deals: ["crm_deals"],
      crm_invoices: ["crm_invoices", "invoices"],
      crm_activities: ["crm_activities"],
      email: ["crm_activities"],
      sms: ["crm_activities"],
      jobs: ["jobs"],
      job_adverts: ["job_adverts"],
      job_shortlist: ["job_shortlist"],
      diary_events: ["diary_events"],
      candidates: ["candidates", "talent"],
      engagements: ["engagements", "crm_projects"],
      sows: ["sows", "engagements"],
      outreach_campaigns: ["outreach_campaigns"],
      outreach_targets: ["outreach_targets", "outreach_campaigns"],
      calls: ["crm_activities"],
    };

    for (const action of actionsExecuted) {
      if (mutationTools.has(action.tool) && action.success) {
        const queries = entityQueryMap[action.entityType] || [];
        for (const q of queries) {
          if (!invalidateQueries.includes(q)) invalidateQueries.push(q);
        }
      }
    }

    // Collect created entities for frontend session memory
    const createdEntities: Array<{ type: string; id: string; name: string; crm_id?: string }> = [];
    const creationTools = new Set(["create_company", "create_contact", "create_project", "create_opportunity", "create_deal", "create_candidate", "create_sow", "create_outreach_campaign"]);
    for (const msg of currentMessages) {
      if ((msg as any).role === "tool" && typeof (msg as any).content === "string") {
        try {
          const parsed = JSON.parse((msg as any).content);
          if (parsed?.id && parsed?.name && !parsed?.error) {
            // Determine type from the tool call that produced this result
            const toolCallId = (msg as any).tool_call_id;
            const matchingAction = actionsExecuted.find(a => a.entityId === parsed.id);
            const entityType = parsed.matched_existing ? "company" :
              matchingAction?.tool === "create_company" ? "company" :
              matchingAction?.tool === "create_contact" ? "contact" :
              matchingAction?.tool === "create_deal" ? "deal" :
              matchingAction?.tool === "create_project" ? "project" :
              matchingAction?.tool === "create_opportunity" ? "opportunity" : null;
            if (entityType) {
              createdEntities.push({
                type: entityType,
                id: parsed.id,
                name: parsed.name || parsed.title || "",
                crm_id: parsed.crm_company_id,
              });
            }
          }
        } catch {}
      }
    }

    return new Response(
      JSON.stringify({
        response: responseText,
        navigate_to: navigationPath,
        target_action: targetAction,
        target_id: targetId,
        guided_tour: guidedTour,
        suggestions: suggestions,
        action: actionPayload,
        actions_executed: actionsExecuted.filter(a => mutationTools.has(a.tool)),
        invalidate_queries: invalidateQueries,
        created_entities: createdEntities.length > 0 ? createdEntities : undefined,
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
