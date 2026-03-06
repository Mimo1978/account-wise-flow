export interface NavigationEntry {
  path: string;
  label: string;
  keywords: string[];
  /** If set, after navigating Jarvis will try to click / highlight this element */
  action?: "click";
  targetId?: string;
}

export const navigationMap: Record<string, NavigationEntry> = {
  // ── Main pages ──────────────────────────────────────────────
  home: {
    path: "/home",
    label: "Home Dashboard",
    keywords: ["home", "dashboard", "command center", "start", "overview"],
  },
  companies: {
    path: "/companies",
    label: "Companies",
    keywords: ["companies", "accounts", "clients", "firms", "company list"],
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
    path: "/executive-insights",
    label: "Revenue Intelligence",
    keywords: ["insights", "analytics", "intelligence", "reports", "revenue", "executive insights"],
  },
  canvas: {
    path: "/canvas",
    label: "Canvas",
    keywords: ["canvas", "org chart", "relationship map", "org tree", "visual"],
  },
  projects: {
    path: "/projects",
    label: "Projects",
    keywords: ["projects", "work", "deliverables", "project list"],
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
    label: "Integrations Settings",
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
  adminBranding: {
    path: "/admin/branding",
    label: "Branding",
    keywords: ["branding", "logo", "brand colours", "brand colors"],
  },
  adminOutreach: {
    path: "/admin/outreach",
    label: "Outreach Settings",
    keywords: ["outreach settings", "campaign settings"],
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
    keywords: ["add company", "new company", "create company button"],
  },
  addContact: {
    path: "/contacts",
    label: "Add Contact",
    action: "click",
    targetId: "add-contact-button",
    keywords: ["add contact", "new contact", "create contact button"],
  },
  addDeal: {
    path: "/crm/deals",
    label: "Create Deal",
    action: "click",
    targetId: "add-deal-button",
    keywords: ["add deal", "new deal", "create deal button"],
  },
  addCandidate: {
    path: "/talent",
    label: "Add Candidate",
    action: "click",
    targetId: "add-candidate-button",
    keywords: ["add candidate", "new candidate", "create candidate button"],
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
    path: "/home",
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
};

/**
 * Resolve a user query like "open companies" or "go to integrations" to a
 * NavigationEntry by fuzzy-matching against the keywords list.
 */
export function resolveNavigation(query: string): NavigationEntry | null {
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
        // Longer keyword matches = higher confidence
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
