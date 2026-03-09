export interface NavigationEntry {
  path: string;
  label: string;
  keywords: string[];
  action?: "click";
  targetId?: string;
}

export const navigationMap: Record<string, NavigationEntry> = {
  // ── Main pages ──────────────────────────────────────────────
  home: {
    path: "/",
    label: "Home Dashboard",
    keywords: ["home", "dashboard", "command center", "start", "overview"],
  },
  companies: {
    path: "/companies",
    label: "Companies",
    keywords: ["companies", "accounts", "clients", "firms", "company list"],
  },
  companyDetail: {
    path: "/companies/:id",
    label: "Company Detail",
    keywords: ["company detail", "view company", "company page", "company profile"],
  },
  contacts: {
    path: "/contacts",
    label: "Contacts",
    keywords: ["contacts", "people", "leads", "person", "stakeholders"],
  },
  talent: {
    path: "/talent",
    label: "Talent Database",
    keywords: ["talent", "candidates", "cvs", "recruitment", "talent database"],
  },
  outreach: {
    path: "/outreach",
    label: "Outreach",
    keywords: ["outreach", "campaigns", "sequences", "email campaigns"],
  },
  insights: {
    path: "/insights",
    label: "Analytics & Intelligence",
    keywords: ["insights", "analytics", "intelligence", "reports", "revenue", "executive insights", "win rate", "forecast", "pipeline chart"],
  },
  canvas: {
    path: "/canvas",
    label: "Canvas Relationship Map",
    keywords: ["canvas", "org chart", "relationship map", "org tree", "visual", "organisation chart", "organization chart"],
  },
  projects: {
    path: "/projects",
    label: "Projects",
    keywords: ["projects", "work", "deliverables", "project list"],
  },
  jobs: {
    path: "/jobs",
    label: "Jobs",
    keywords: ["jobs", "job list", "roles", "vacancies", "job specs", "requirements", "open roles"],
  },
  jobsUnlinked: {
    path: "/jobs?filter=unlinked",
    label: "Unlinked Jobs",
    keywords: ["unlinked jobs", "jobs without project", "jobs not linked", "jobs not tracked", "loose jobs"],
  },
  jobDetail: {
    path: "/jobs/:id",
    label: "Job Detail",
    keywords: ["job detail", "view job", "job page", "job spec detail"],
  },
  reports: {
    path: "/reports",
    label: "Reports",
    keywords: ["reports", "reporting", "charts", "metrics"],
  },

  // ── CRM detail areas ───────────────────────────────────────
  deals: {
    path: "/crm/deals",
    label: "Deals",
    keywords: ["deals", "deal list", "closed deals", "won deals"],
  },
  pipeline: {
    path: "/crm/pipeline",
    label: "Pipeline",
    keywords: ["pipeline", "sales pipeline", "funnel", "stages"],
  },
  invoices: {
    path: "/crm/invoices",
    label: "Invoices",
    keywords: ["invoices", "billing", "payments", "invoice list"],
  },
  crmProjects: {
    path: "/crm/projects",
    label: "CRM Projects",
    keywords: ["crm projects", "client projects"],
  },
  crmDocuments: {
    path: "/crm/documents",
    label: "Documents",
    keywords: ["documents", "files", "contracts", "proposals"],
  },

  // ── Admin ───────────────────────────────────────────────────
  admin: {
    path: "/admin",
    label: "Admin Console",
    keywords: ["admin", "settings", "administration", "configure", "admin console"],
  },
  adminIntegrations: {
    path: "/admin/integrations",
    label: "Integrations",
    keywords: ["integrations", "api keys", "resend", "twilio", "elevenlabs", "anthropic"],
  },
  adminBilling: {
    path: "/admin/billing",
    label: "Billing Settings",
    keywords: ["billing settings", "invoice settings", "payment settings"],
  },
  adminTeam: {
    path: "/admin/workspace",
    label: "Team Management",
    keywords: ["team", "users", "members", "roles", "permissions", "invite"],
  },
  adminJarvis: {
    path: "/admin/jarvis",
    label: "Jarvis Settings",
    keywords: ["jarvis settings", "voice settings", "ai settings"],
  },
  adminSchema: {
    path: "/admin/schema",
    label: "Schema Inventory",
    keywords: ["schema", "database", "tables", "data model", "schema inventory"],
  },
  adminBranding: {
    path: "/admin/branding",
    label: "Branding",
    keywords: ["branding", "logo", "brand colours", "brand colors"],
  },
  adminOutreach: {
    path: "/admin/outreach",
    label: "Outreach Defaults",
    keywords: ["outreach settings", "campaign settings", "calling hours", "compliance"],
  },
  adminSignals: {
    path: "/admin/signals",
    label: "Signals Settings",
    keywords: ["signals", "alerts", "triggers"],
  },
  adminDataQuality: {
    path: "/admin/data-quality",
    label: "Data Quality",
    keywords: ["data quality", "duplicates", "data health"],
  },

  // ── Actions (navigate + click a button) ─────────────────────
  addCompany: {
    path: "/companies",
    label: "Add Company",
    action: "click",
    targetId: "add-company-button",
    keywords: ["add company", "new company", "create company", "create company button"],
  },
  addContact: {
    path: "/contacts",
    label: "Add Contact",
    action: "click",
    targetId: "add-contact-button",
    keywords: ["add contact", "new contact", "create contact", "create contact button"],
  },
  addDeal: {
    path: "/companies",
    label: "Create Deal",
    action: "click",
    targetId: "add-deal-button",
    keywords: ["add deal", "new deal", "create deal", "create deal button"],
  },
  addCandidate: {
    path: "/talent",
    label: "Add Candidate",
    action: "click",
    targetId: "add-candidate-button",
    keywords: ["add candidate", "new candidate", "create candidate", "create candidate button"],
  },
  importContacts: {
    path: "/contacts",
    label: "Import Contacts",
    action: "click",
    targetId: "import-button",
    keywords: ["import contacts", "upload contacts", "bulk import"],
  },
  createCampaign: {
    path: "/outreach",
    label: "Create Campaign",
    action: "click",
    targetId: "new-campaign-button",
    keywords: ["new campaign", "create campaign", "outreach campaign"],
  },
  createInvoice: {
    path: "/",
    label: "Create Invoice",
    action: "click",
    targetId: "create-invoice-button",
    keywords: ["create invoice", "new invoice", "add invoice"],
  },
  importCompanies: {
    path: "/companies",
    label: "Import Companies",
    action: "click",
    targetId: "import-companies-button",
    keywords: ["import companies", "upload companies", "bulk company import"],
  },

  // ── Canvas actions ──────────────────────────────────────────
  canvasEdit: {
    path: "/canvas",
    label: "Edit Org Chart",
    action: "click",
    targetId: "canvas-edit-button",
    keywords: ["edit org chart", "edit canvas", "edit structure", "change org chart", "manipulate org chart", "move nodes", "rearrange", "rearrange org chart", "edit organisation"],
  },
  canvasAddNode: {
    path: "/canvas",
    label: "Add Person to Org Chart",
    action: "click",
    targetId: "canvas-add-node-button",
    keywords: ["add person", "add node", "add to org chart", "new person on canvas", "add contact to chart", "add person to chart"],
  },
  canvasConnect: {
    path: "/canvas",
    label: "Connect People",
    action: "click",
    targetId: "canvas-connect-tool",
    keywords: ["connect", "draw connection", "link people", "reporting line", "add relationship", "connect people"],
  },
  canvasFitView: {
    path: "/canvas",
    label: "Reset Canvas View",
    action: "click",
    targetId: "canvas-fit-view",
    keywords: ["reset view", "fit to screen", "zoom out canvas", "see full chart"],
  },
  canvasBuildOrgChart: {
    path: "/canvas",
    label: "Build Org Chart",
    action: "click",
    targetId: "canvas-build-orgchart",
    keywords: ["build org chart", "create org chart", "generate org chart", "build structure"],
  },
  canvasAIResearch: {
    path: "/canvas",
    label: "AI Research Company Structure",
    action: "click",
    targetId: "canvas-ai-research",
    keywords: ["research company", "ai research", "find contacts", "research org", "look up structure"],
  },

  // ── Outreach in-page actions ────────────────────────────────
  addTargets: {
    path: "/outreach",
    label: "Add Targets",
    action: "click",
    targetId: "add-targets-button",
    keywords: ["add targets", "add outreach targets", "new targets"],
  },
  newScript: {
    path: "/outreach",
    label: "New Script",
    action: "click",
    targetId: "new-script-button",
    keywords: ["new script", "create script", "call script"],
  },

  // ── Home in-page actions ────────────────────────────────────
  addSow: {
    path: "/",
    label: "Add SOW",
    action: "click",
    targetId: "home-add-sow-button",
    keywords: ["add sow", "new sow", "statement of work", "create sow"],
  },
  createProject: {
    path: "/",
    label: "Create Project",
    action: "click",
    targetId: "home-create-project-button",
    keywords: ["create project", "new project", "add project"],
  },

  // ── Contacts in-page actions ────────────────────────────────
  viewOrgChart: {
    path: "/contacts",
    label: "View Org Chart",
    action: "click",
    targetId: "contacts-view-orgchart-button",
    keywords: ["view org chart from contacts", "contacts org chart"],
  },
  // ── Report Builder ────────────────────────────────
  pullPipelineReport: {
    path: "/home",
    label: "Pull Pipeline Report",
    action: "click",
    targetId: "pull-report",
    keywords: ["pull pipeline report", "pipeline report", "deals report", "show pipeline"],
  },
  pullRecruitmentReport: {
    path: "/home",
    label: "Pull Recruitment Report",
    action: "click",
    targetId: "pull-report",
    keywords: ["recruitment report", "jobs report", "hiring report", "show recruitment report"],
  },
  pullBillingReport: {
    path: "/home",
    label: "Pull Billing Report",
    action: "click",
    targetId: "pull-report",
    keywords: ["billing report", "invoice report", "download billing report"],
  },
  refreshCommandCentre: {
    path: "/home",
    label: "Refresh Command Centre",
    action: "click",
    targetId: "refresh-command-centre",
    keywords: ["refresh command centre", "refresh command center", "refresh home", "reload dashboard"],
  },
};

/**
 * Resolve a user query like "open companies" or "go to integrations" to a
 * NavigationEntry by fuzzy-matching against the keywords list.
 */
export function findDestination(query: string): NavigationEntry | null {
  const q = query.toLowerCase().trim();

  // Exact key match
  if (navigationMap[q]) return navigationMap[q];

  // Score each entry by how many keywords match
  let best: NavigationEntry | null = null;
  let bestScore = 0;

  for (const entry of Object.values(navigationMap)) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (q.includes(kw) || kw.includes(q)) {
        score += kw.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return bestScore > 0 ? best : null;
}

/** @deprecated Use findDestination instead */
export const resolveNavigation = findDestination;
