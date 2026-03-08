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
- "where do I set up email" / "configure email integration" / "set up Resend":
  <guided_tour>[
    {"navigate":"/admin/integrations","speak":"Let me take you to the Integrations settings.","delay":500},
    {"highlight":"admin-integrations","speak":"This is where you configure all your integrations including email via Resend, SMS via Twilio, and voice via ElevenLabs.","delay":3000}
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

ENTITY LOOKUP BEFORE LINKING — CRITICAL:
When creating a contact, deal, opportunity, project, or logging a call that references another entity (company, contact, or candidate):
1. ALWAYS call the appropriate lookup tool FIRST (lookup_company, lookup_contact, or lookup_candidate) using the name the user provided.
2. If exactly 1 result is returned: use that ID automatically and proceed.
3. If multiple results: ask the user "I found a few matches — did you mean [name1], [name2], or [name3]?" and wait for their answer.
4. If 0 results: say "I couldn't find [name] in your workspace. Would you like me to create it first?" and wait.
5. NEVER guess or fabricate an entity ID. NEVER pass a name string where an ID is required.

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
  - If the user is on a job detail page, use the job_id from the URL.`;


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
    case "lookup_company": {
      const name = (input.name as string).trim();
      const teamId = await getUserTeamId(supabaseAdmin, userId);

      // Search both tables using universal helper
      const companies = await lookupRecord("companies", "name", name, teamId, supabaseAdmin, "team_id");
      const crmCompanies = await lookupRecord("crm_companies", "name", name, null, supabaseAdmin, "created_by", (q: any) => q.is("deleted_at", null));

      const allMatches = [
        ...companies.map((c: any) => ({ id: c.id, name: c.name, source: "companies" })),
        ...crmCompanies.map((c: any) => ({ id: c.id, name: c.name, source: "crm_companies" })),
      ];
      console.log("[lookup_company] query:", name, "workspace:", teamId, "total_matches:", allMatches.length);

      if (allMatches.length === 0) {
        return { result: { matches: [], message: `No company found matching "${name}". Would you like me to create it?` }, entityType: "companies" };
      }
      if (allMatches.length === 1) {
        return { result: { matches: allMatches, auto_selected: allMatches[0], message: `Found "${allMatches[0].name}" — using this company.` }, entityType: "companies" };
      }
      return { result: { matches: allMatches, message: `Found ${allMatches.length} companies matching "${name}". Did you mean ${allMatches.slice(0, 3).map((c: any) => c.name).join(", or ")}?` }, entityType: "companies" };
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

      const allMatches = await lookupRecord("candidates", "name", name, teamId, supabaseAdmin, "tenant_id");
      console.log("[lookup_candidate] query:", name, "workspace:", teamId, "total_matches:", allMatches.length);

      if (allMatches.length === 0) {
        return { result: { matches: [], message: `No candidate found matching "${name}".` }, entityType: "candidates" };
      }
      if (allMatches.length === 1) {
        return { result: { matches: allMatches, auto_selected: allMatches[0], message: `Found "${allMatches[0].name}" — using this candidate.` }, entityType: "candidates" };
      }
      return { result: { matches: allMatches, message: `Found ${allMatches.length} candidates matching "${name}". Did you mean ${allMatches.slice(0, 3).map((c: any) => c.name).join(", or ")}?` }, entityType: "candidates" };
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

    const { user_message, conversation_history, user_first_name, nav_history, flow_state } = await req.json();
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
    let responseText = aiResponse.choices?.[0]?.message?.content || "";

    // Parse structured <action> block from response
    let actionPayload: Record<string, unknown> | null = null;
    const actionMatch = responseText.match(/<action>([\s\S]*?)<\/action>/);
    if (actionMatch) {
      try {
        actionPayload = JSON.parse(actionMatch[1]);
        responseText = responseText.replace(/<action>[\s\S]*?<\/action>/, '').trim();
      } catch (e) {
        console.warn("[jarvis] Failed to parse action:", e);
      }
    }

    // Parse guided_tour from response text if present (legacy format, also check action payload)
    let guidedTour: any[] | null = null;
    if (actionPayload?.type === 'GUIDED_TOUR' && actionPayload?.steps) {
      guidedTour = actionPayload.steps as any[];
    }
    const tourMatch = responseText.match(/<guided_tour>([\s\S]*?)<\/guided_tour>/);
    if (tourMatch) {
      try {
        guidedTour = JSON.parse(tourMatch[1]);
        responseText = responseText.replace(/<guided_tour>[\s\S]*?<\/guided_tour>/, '').trim();
      } catch (e) {
        console.warn("[jarvis] Failed to parse guided_tour:", e);
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
    const mutationTools = new Set(["create_company", "create_contact", "create_project", "create_opportunity", "update_opportunity_stage", "create_deal", "create_invoice", "log_call", "send_email", "send_sms", "create_job", "generate_adverts", "update_advert", "run_shortlist"]);
    const entityQueryMap: Record<string, string[]> = {
      companies: ["companies", "canvas-companies"],
      crm_companies: ["crm_companies"],
      crm_contacts: ["crm_contacts"],
      crm_projects: ["crm_projects"],
      crm_opportunities: ["crm_opportunities"],
      crm_deals: ["crm_deals"],
      crm_invoices: ["crm_invoices"],
      crm_activities: ["crm_activities"],
      email: ["crm_activities"],
      sms: ["crm_activities"],
      jobs: ["jobs"],
      job_adverts: ["job_adverts"],
      job_shortlist: ["job_shortlist"],
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
        guided_tour: guidedTour,
        suggestions: suggestions,
        action: actionPayload,
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
