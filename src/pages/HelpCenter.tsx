import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LifeBuoy,
  Search,
  Sparkles,
  Home,
  Building2,
  Users,
  UserCog,
  Briefcase,
  ClipboardList,
  Megaphone,
  Network,
  FileText,
  Receipt,
  TrendingUp,
  FolderKanban,
  Database,
  ShieldCheck,
  BookOpen,
  Zap,
  Phone,
  Mail,
  Calendar,
  Star,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/* ------------------------------------------------------------------ */
/*  Help Center — feature catalog with "Ask Jarvis" hooks              */
/* ------------------------------------------------------------------ */

type HelpEntry = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  path?: string;
  where: string;
  summary: string;
  steps: string[];
  jarvisPrompt: string;
  tags: string[];
};

type HelpSection = {
  id: string;
  label: string;
  accent: string; // hsl
  blurb: string;
  entries: HelpEntry[];
};

const SECTIONS: HelpSection[] = [
  {
    id: "command",
    label: "Command Centre",
    accent: "199 89% 48%",
    blurb: "Your daily nerve center — KPIs, pipeline overview, diary and active placements.",
    entries: [
      {
        title: "Home Dashboard",
        icon: Home,
        path: "/home",
        where: "Top-left logo or sidebar → Home",
        summary: "Single-screen overview of pipeline, projects, placements, diary and missing-data alerts.",
        steps: [
          "Open Home from the sidebar.",
          "Scan KPI tiles — click any tile to drill into the underlying list.",
          "Use the This Week diary strip to add/edit reminders inline.",
        ],
        jarvisPrompt: "Give me a guided tour of the Home Command Centre.",
        tags: ["dashboard", "kpi", "diary", "home"],
      },
      {
        title: "Leads Inbox",
        icon: ClipboardList,
        path: "/leads",
        where: "Sidebar → Leads",
        summary: "Inbound enquiries and applicants ready to be triaged into Contacts, Talent or Deals.",
        steps: [
          "Open Leads.",
          "Click a lead to view enriched details.",
          "Convert into a Contact, Talent record or Deal in one click.",
        ],
        jarvisPrompt: "Walk me through triaging a new lead from the Leads Inbox.",
        tags: ["inbox", "leads", "triage"],
      },
    ],
  },
  {
    id: "crm",
    label: "CRM & Companies",
    accent: "210 90% 60%",
    blurb: "Company-first CRM with contacts, deals and the visual Org Chart canvas.",
    entries: [
      {
        title: "Companies Database",
        icon: Building2,
        path: "/companies",
        where: "Sidebar → Companies",
        summary: "Master list of accounts. Click a row to open the Company Hub with 8 record tabs.",
        steps: [
          "Open Companies.",
          "Search or filter by industry, owner or status.",
          "Click a company name to enter its Hub.",
        ],
        jarvisPrompt: "Show me how to use the Companies database and Company Hub.",
        tags: ["companies", "accounts", "crm"],
      },
      {
        title: "Contacts",
        icon: Users,
        path: "/contacts",
        where: "Sidebar → Contacts",
        summary: "All people across all accounts. Hover a row for inline email, SMS or campaign actions.",
        steps: [
          "Open Contacts.",
          "Hover a row to reveal quick-action icons.",
          "Click a name to open the slide-in Contact panel.",
        ],
        jarvisPrompt: "Tour the Contacts list and explain the inline engagement actions.",
        tags: ["contacts", "people", "outreach"],
      },
      {
        title: "Org Chart Canvas",
        icon: Network,
        path: "/canvas",
        where: "Sidebar → Canvas (or click 'View Org Chart' from any company)",
        summary: "Visual hierarchy of any account. Empty companies show a ghost card prompting first-contact creation.",
        steps: [
          "Open Canvas and pick a company from the floating search bar.",
          "Drag nodes to restructure — edges save automatically.",
          "Click the ghost card on empty companies to add your first contact.",
        ],
        jarvisPrompt: "Open the Org Chart canvas and show me how to map a company structure.",
        tags: ["canvas", "org chart", "visual"],
      },
      {
        title: "Deals Pipeline",
        icon: TrendingUp,
        path: "/crm/deals",
        where: "Sidebar → Deals",
        summary: "PipelineChevron-driven kanban for Contractor, Perm and Consulting deals with commercial guardrails.",
        steps: [
          "Open Deals.",
          "Drag a deal between stages, or click the chevron header on any deal card.",
          "Won deals require a linked project + invoice (system enforces this).",
        ],
        jarvisPrompt: "Walk me through creating a new deal and moving it through the pipeline.",
        tags: ["deals", "pipeline", "sales"],
      },
    ],
  },
  {
    id: "recruitment",
    label: "Recruitment",
    accent: "142 71% 45%",
    blurb: "Talent database, jobs, projects, placements and the AI matching engine.",
    entries: [
      {
        title: "Talent Database",
        icon: UserCog,
        path: "/talent",
        where: "Sidebar → Talent",
        summary: "Searchable candidate library with CV indicators, status hot-buttons and Match Mode (PII-anonymised).",
        steps: [
          "Open Talent.",
          "Filter by location, skills, availability or seniority.",
          "Open a candidate to view CV preview and notes side-by-side.",
        ],
        jarvisPrompt: "Show me how to search talent and use Match Mode.",
        tags: ["talent", "candidates", "cv"],
      },
      {
        title: "Jobs",
        icon: Briefcase,
        path: "/jobs",
        where: "Sidebar → Jobs",
        summary: "Job records with status lifecycle (Draft → Active → Paused → Filled), adverts and applications.",
        steps: [
          "Open Jobs.",
          "Create a new job or click an existing one.",
          "Approve the spec to flip status to Active and unlock outreach.",
        ],
        jarvisPrompt: "Take me through creating a new job and approving its spec.",
        tags: ["jobs", "adverts", "spec"],
      },
      {
        title: "Projects",
        icon: FolderKanban,
        path: "/projects",
        where: "Sidebar → Projects",
        summary: "Recruitment, Contractor, Perm and Consulting projects with stage checklists and audit feed.",
        steps: [
          "Open Projects.",
          "Click a project to enter its Detail hub.",
          "Use the stage controls and review the Activity Audit Feed.",
        ],
        jarvisPrompt: "Tour the Projects hub and explain stage management.",
        tags: ["projects", "delivery", "stages"],
      },
      {
        title: "Placements",
        icon: Star,
        path: "/placements",
        where: "Sidebar → Placements",
        summary: "Active and historical placements with timesheet grid and draft-invoice generation.",
        steps: [
          "Open Placements.",
          "Click a placement for the management hub.",
          "Add timesheet rows and generate a draft invoice.",
        ],
        jarvisPrompt: "Show me how to manage a live placement and generate an invoice.",
        tags: ["placements", "timesheets", "invoice"],
      },
      {
        title: "Bulk CV Upload",
        icon: Database,
        path: "/bulk-upload",
        where: "Talent page → 'Bulk Upload' button (or /bulk-upload)",
        summary: "Parallel batched CV imports powered by AI extraction.",
        steps: [
          "Open Bulk CV Upload.",
          "Drop up to dozens of CVs into the dropzone.",
          "Review parsed candidates and confirm.",
        ],
        jarvisPrompt: "Walk me through importing a batch of CVs.",
        tags: ["import", "cv", "bulk"],
      },
    ],
  },
  {
    id: "outreach",
    label: "Outreach & Comms",
    accent: "25 95% 53%",
    blurb: "Email, SMS, AI Voice Calls and campaign orchestration.",
    entries: [
      {
        title: "Outreach Queue",
        icon: Megaphone,
        path: "/outreach",
        where: "Sidebar → Outreach",
        summary: "High-density target queue with always-visible Email, SMS and Mark-Done actions.",
        steps: [
          "Open Outreach.",
          "Filter by campaign or status.",
          "Use inline buttons to send, log or skip a target.",
        ],
        jarvisPrompt: "Tour the Outreach queue and show me how campaigns work.",
        tags: ["outreach", "campaigns", "queue"],
      },
      {
        title: "Email Templates",
        icon: Mail,
        path: "/settings/email-templates",
        where: "Profile menu → Workspace Settings → Email Templates",
        summary: "Reusable email bodies with merge tokens for outreach and transactional flows.",
        steps: [
          "Open Email Templates.",
          "Edit or create a template using the visual editor.",
          "Reference {{candidate_name}}, {{job_title}} etc. for personalization.",
        ],
        jarvisPrompt: "Show me how to build an email template with merge tokens.",
        tags: ["email", "templates", "merge"],
      },
      {
        title: "AI Voice Calling",
        icon: Phone,
        path: "/admin/ai-calling-guide",
        where: "Admin → AI Calling Guide",
        summary: "Automated outbound calls with GDPR consent gates and Confidential Role masking.",
        steps: [
          "Read the AI Calling Guide.",
          "Enable in Admin → Outreach Settings.",
          "Trigger from a candidate row → 'AI Call'.",
        ],
        jarvisPrompt: "Explain AI Voice Calling and the compliance steps.",
        tags: ["ai", "calls", "voice"],
      },
    ],
  },
  {
    id: "commercial",
    label: "Commercial & Billing",
    accent: "280 65% 60%",
    blurb: "Documents, invoices, accounts and billing automation.",
    entries: [
      {
        title: "Documents Hub",
        icon: FileText,
        path: "/documents",
        where: "Sidebar → Documents",
        summary: "Unified repository for SOWs, contracts, proposals, NDAs and invoices.",
        steps: [
          "Open Documents.",
          "Filter by type, status or company.",
          "Upload or generate, then mark Sent / Signed.",
        ],
        jarvisPrompt: "Tour the Documents hub and how to upload a contract.",
        tags: ["documents", "sow", "contracts"],
      },
      {
        title: "Accounts & Billing",
        icon: Receipt,
        path: "/accounts",
        where: "Sidebar → Accounts",
        summary: "Account-level billing profiles, invoices and recurring plans.",
        steps: [
          "Open Accounts.",
          "Pick a company to view its billing profile.",
          "Open an invoice via the slide-in panel for line-item edits.",
        ],
        jarvisPrompt: "Walk me through generating and sending an invoice.",
        tags: ["accounts", "invoices", "billing"],
      },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    accent: "340 82% 59%",
    blurb: "Analytics, executive insights and search.",
    entries: [
      {
        title: "Executive Insights",
        icon: Sparkles,
        path: "/insights",
        where: "Sidebar → Insights",
        summary: "AI-generated executive summary across pipeline, talent and revenue signals.",
        steps: [
          "Open Insights.",
          "Review the curated signals.",
          "Click any insight for the underlying records.",
        ],
        jarvisPrompt: "Show me how to read Executive Insights and act on them.",
        tags: ["insights", "ai", "exec"],
      },
      {
        title: "Analytics Dashboard",
        icon: TrendingUp,
        path: "/dashboard",
        where: "Sidebar → Dashboard",
        summary: "Charts, conversion rates and team performance with time-range filters.",
        steps: [
          "Open Dashboard.",
          "Adjust the date range.",
          "Hover any chart for tooltips and click to drill in.",
        ],
        jarvisPrompt: "Tour the Analytics dashboard.",
        tags: ["analytics", "charts", "metrics"],
      },
    ],
  },
  {
    id: "admin",
    label: "Admin & Governance",
    accent: "292 84% 61%",
    blurb: "Roles, integrations, governance, billing and Jarvis settings.",
    entries: [
      {
        title: "Admin Console",
        icon: ShieldCheck,
        path: "/admin",
        where: "Profile menu → Admin Console (Admin/Manager only)",
        summary: "Central hub for access, governance, data quality and integrations.",
        steps: [
          "Open Admin.",
          "Pick a section from the sub-nav.",
          "Changes apply workspace-wide — be deliberate.",
        ],
        jarvisPrompt: "Tour the Admin Console sections.",
        tags: ["admin", "governance"],
      },
      {
        title: "Integrations",
        icon: Zap,
        path: "/admin/integrations",
        where: "Admin → Integrations",
        summary: "Workspace-level keys for Resend, Twilio, ElevenLabs, Anthropic and CloudConvert.",
        steps: [
          "Open Integrations.",
          "Add or rotate API keys per provider.",
          "Test connectivity with the built-in checks.",
        ],
        jarvisPrompt: "Show me how to connect an integration safely.",
        tags: ["integrations", "api", "keys"],
      },
      {
        title: "Jarvis Settings",
        icon: Sparkles,
        path: "/admin/jarvis-settings",
        where: "Admin → Jarvis Settings",
        summary: "Voice, persona, tour mode and assistant behaviour.",
        steps: [
          "Open Jarvis Settings.",
          "Pick a voice and tone.",
          "Toggle guided tour mode.",
        ],
        jarvisPrompt: "Explain the Jarvis settings and what each toggle does.",
        tags: ["jarvis", "voice", "ai"],
      },
    ],
  },
  {
    id: "diary",
    label: "Diary & Reminders",
    accent: "190 95% 50%",
    blurb: "Your week strip and 5-reminder automation.",
    entries: [
      {
        title: "This Week Diary",
        icon: Calendar,
        path: "/home",
        where: "Home page → 'This Week' widget",
        summary: "Horizontal 7-day strip with dot indicators; auto-creates 5 daily reminders.",
        steps: [
          "Open Home.",
          "Click any day to inspect items.",
          "Add a reminder inline; AI suggests follow-ups.",
        ],
        jarvisPrompt: "Tour the diary widget and explain auto-reminders.",
        tags: ["diary", "reminders", "calendar"],
      },
    ],
  },
];

const ALL_ENTRIES = SECTIONS.flatMap((s) => s.entries.map((e) => ({ ...e, section: s })));

function askJarvis(prompt: string) {
  window.dispatchEvent(new CustomEvent("jarvis-open", { detail: { prompt } }));
  // Pre-fill clipboard so user can paste if seed isn't supported yet
  try {
    navigator.clipboard?.writeText(prompt);
  } catch {}
}

export default function HelpCenter() {
  const [query, setQuery] = useState("");

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.map((s) => ({
      ...s,
      entries: s.entries.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.summary.toLowerCase().includes(q) ||
          e.where.toLowerCase().includes(q) ||
          e.tags.some((t) => t.includes(q))
      ),
    })).filter((s) => s.entries.length > 0);
  }, [query]);

  return (
    <div className="h-full overflow-y-auto overflow-x-auto bg-background">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Hero */}
        <div className="mb-8 flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <LifeBuoy className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Help & Feature Guide</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Every feature, where to find it, and a quick how-to. When in doubt — hit the flashing
                Jarvis star ✨ on any card and your AI co-pilot will walk you through it.
              </p>
            </div>
          </div>
          <Button
            onClick={() => askJarvis("I'm in the Help Center. Give me a 60-second tour of the whole product, then ask me what I want to do first.")}
            className="gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Tour the whole product
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-8 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search features (e.g. 'org chart', 'invoice', 'cv')…"
            className="pl-9 h-10"
          />
        </div>

        {/* Section quick-jump */}
        <div className="flex flex-wrap gap-2 mb-8">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="px-3 py-1.5 rounded-full text-xs font-medium border border-border/50 bg-card hover:bg-accent/40 transition-colors"
              style={{ color: `hsl(${s.accent})` }}
            >
              {s.label}
            </a>
          ))}
        </div>

        {/* Sections */}
        <div className="space-y-12">
          {filteredSections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-20">
              <div
                className="flex items-center gap-3 mb-3 pb-2 border-b"
                style={{ borderColor: `hsl(${section.accent} / 0.4)` }}
              >
                <span
                  className="inline-block w-2 h-6 rounded-sm"
                  style={{ backgroundColor: `hsl(${section.accent})` }}
                />
                <h2 className="text-lg font-semibold text-foreground">{section.label}</h2>
                <span className="text-xs text-muted-foreground">{section.blurb}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {section.entries.map((entry) => (
                  <FeatureCard key={entry.title} entry={entry} accent={section.accent} />
                ))}
              </div>
            </section>
          ))}

          {filteredSections.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              No matches for "{query}". Try a different keyword — or{" "}
              <button
                onClick={() => askJarvis(`I'm searching the Help Center for "${query}" but found nothing. Help me find the right feature.`)}
                className="text-primary hover:underline"
              >
                ask Jarvis
              </button>
              .
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="mt-16 mb-8">
          <Card className="p-6 bg-gradient-to-br from-primary/10 via-card to-card border-primary/20">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary animate-pulse">
                  <Sparkles className="w-6 h-6" />
                </div>
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary animate-ping" />
              </div>
              <div className="flex-1 min-w-[240px]">
                <h3 className="font-semibold text-foreground">Stuck? Ask Jarvis anything.</h3>
                <p className="text-sm text-muted-foreground">
                  Hit the floating Jarvis button (bottom-right) or any ✨ on the cards above. Jarvis can
                  navigate, fill forms, run searches and even orchestrate full recruitment campaigns.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => askJarvis("Open the Jarvis tour and walk me through what you can do.")}
              >
                Meet Jarvis
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature card                                                        */
/* ------------------------------------------------------------------ */
function FeatureCard({ entry, accent }: { entry: HelpEntry; accent: string }) {
  const Icon = entry.icon;
  return (
    <Card className="p-4 group hover:bg-accent/20 transition-colors flex flex-col h-full relative overflow-hidden">
      {/* Accent strip */}
      <span
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: `hsl(${accent})` }}
      />

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `hsl(${accent} / 0.15)`, color: `hsl(${accent})` }}
          >
            <Icon className="w-4 h-4" />
          </div>
          <h3 className="font-semibold text-foreground text-[14px] leading-tight">{entry.title}</h3>
        </div>

        {/* When in doubt — flashing Jarvis star */}
        <button
          onClick={() => askJarvis(entry.jarvisPrompt)}
          title="When in doubt — ask Jarvis ✨"
          className="relative shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-primary hover:bg-primary/15 transition-colors"
        >
          <Sparkles className="w-4 h-4 relative z-10" />
          <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <span className="absolute inset-[5px] rounded-full bg-primary/30 animate-pulse" />
        </button>
      </div>

      <Badge variant="outline" className="self-start mb-2 text-[10px] font-normal">
        {entry.where}
      </Badge>

      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{entry.summary}</p>

      <ol className="text-[12px] text-foreground/80 space-y-1 mb-4 list-decimal list-inside">
        {entry.steps.map((s, i) => (
          <li key={i} className="leading-snug">{s}</li>
        ))}
      </ol>

      <div className="mt-auto flex items-center gap-2 pt-2 border-t border-border/50">
        {entry.path && (
          <Link
            to={entry.path}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            Open →
          </Link>
        )}
        <button
          onClick={() => askJarvis(entry.jarvisPrompt)}
          className="ml-auto text-[11px] font-medium text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors"
        >
          <Sparkles className="w-3 h-3" />
          Ask Jarvis to guide me
        </button>
      </div>
    </Card>
  );
}