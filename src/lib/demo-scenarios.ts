import { Account, Contact, Talent, TalentEngagement, Note } from "./types";

/**
 * Demo Scenario Types
 * Each scenario represents a different use case/story
 */
export type DemoScenarioId =
  | "account-expansion" 
  | "renewal-risk" 
  | "recruiting-pipeline" 
  | "new-logo-prospecting";

export interface DemoScenario {
  id: DemoScenarioId;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  accounts: Account[];
  talents?: Talent[];
  engagements?: TalentEngagement[];
  insights: DemoInsight[];
}

export interface DemoInsight {
  id: string;
  type: "coverage-gap" | "risk" | "opportunity" | "action" | "talent";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  relatedContactIds?: string[];
  recommendedActions?: string[];
}

// ============================================================================
// SCENARIO A: ACCOUNT EXPANSION
// Enterprise company with partial org coverage, AI highlights gaps
// ============================================================================

const accountExpansionContacts: Contact[] = [
  // Executive - Good coverage
  {
    id: "ae-1",
    name: "Victoria Chen",
    title: "CEO",
    department: "Executive",
    seniority: "executive",
    email: "victoria.chen@nexustech.com",
    phone: "+1 (555) 800-0001",
    status: "champion",
    engagementScore: 95,
    role: "economic-buyer",
    lastContact: "2025-01-20",
    contactOwner: "Sarah Williams",
  },
  {
    id: "ae-2",
    name: "Marcus Williams",
    title: "CFO",
    department: "Executive",
    seniority: "executive",
    email: "marcus.williams@nexustech.com",
    phone: "+1 (555) 800-0002",
    status: "engaged",
    engagementScore: 82,
    role: "economic-buyer",
    reportsTo: "ae-1",
    lastContact: "2025-01-18",
    contactOwner: "Sarah Williams",
  },
  {
    id: "ae-3",
    name: "Diana Rodriguez",
    title: "CTO",
    department: "Executive",
    seniority: "executive",
    email: "diana.rodriguez@nexustech.com",
    phone: "+1 (555) 800-0003",
    status: "champion",
    engagementScore: 92,
    role: "champion",
    reportsTo: "ae-1",
    lastContact: "2025-01-21",
    contactOwner: "Michael Chen",
  },
  // Technology - Strong coverage
  {
    id: "ae-4",
    name: "Alex Kim",
    title: "VP Engineering",
    department: "Technology",
    seniority: "director",
    email: "alex.kim@nexustech.com",
    phone: "+1 (555) 800-0004",
    status: "engaged",
    engagementScore: 85,
    role: "technical-evaluator",
    reportsTo: "ae-3",
    lastContact: "2025-01-19",
    contactOwner: "Michael Chen",
  },
  {
    id: "ae-5",
    name: "Jordan Lee",
    title: "Engineering Manager",
    department: "Technology",
    seniority: "manager",
    email: "jordan.lee@nexustech.com",
    phone: "+1 (555) 800-0005",
    status: "warm",
    engagementScore: 68,
    role: "influencer",
    reportsTo: "ae-4",
    lastContact: "2025-01-15",
    contactOwner: "Michael Chen",
  },
  {
    id: "ae-6",
    name: "Taylor Brooks",
    title: "Sr. DevOps Engineer",
    department: "Technology",
    seniority: "senior",
    email: "taylor.brooks@nexustech.com",
    phone: "+1 (555) 800-0006",
    status: "champion",
    engagementScore: 88,
    role: "champion",
    reportsTo: "ae-4",
    lastContact: "2025-01-20",
    contactOwner: "Michael Chen",
  },
  // Product - PARTIAL COVERAGE (Gap!)
  {
    id: "ae-7",
    name: "Casey Morgan",
    title: "VP Product",
    department: "Product",
    seniority: "director",
    email: "casey.morgan@nexustech.com",
    phone: "+1 (555) 800-0007",
    status: "new",
    engagementScore: 35,
    reportsTo: "ae-1",
    lastContact: "2025-01-05",
    contactOwner: "Sarah Williams",
  },
  // Operations - NO COVERAGE (Major Gap!)
  // Sales - Some coverage
  {
    id: "ae-8",
    name: "Riley Anderson",
    title: "VP Sales",
    department: "Sales",
    seniority: "director",
    email: "riley.anderson@nexustech.com",
    phone: "+1 (555) 800-0008",
    status: "engaged",
    engagementScore: 75,
    role: "influencer",
    reportsTo: "ae-1",
    lastContact: "2025-01-17",
    contactOwner: "Sarah Williams",
  },
  {
    id: "ae-9",
    name: "Sam Martinez",
    title: "Sales Director",
    department: "Sales",
    seniority: "manager",
    email: "sam.martinez@nexustech.com",
    phone: "+1 (555) 800-0009",
    status: "warm",
    engagementScore: 62,
    reportsTo: "ae-8",
    lastContact: "2025-01-14",
    contactOwner: "Sarah Williams",
  },
  // Finance - NO COVERAGE (Gap!)
];

const accountExpansionInsights: DemoInsight[] = [
  {
    id: "ae-insight-1",
    type: "coverage-gap",
    severity: "critical",
    title: "No Operations Coverage",
    description: "Operations department has zero contacts mapped. This is a critical gap for enterprise deals.",
    recommendedActions: [
      "Request intro via CTO Diana Rodriguez",
      "Research COO on LinkedIn",
      "Check recent job postings for Ops leadership",
    ],
  },
  {
    id: "ae-insight-2",
    type: "coverage-gap",
    severity: "warning",
    title: "Finance Team Unmapped",
    description: "No finance contacts beyond CFO. Procurement and budget holders are unknown.",
    relatedContactIds: ["ae-2"],
    recommendedActions: [
      "Ask CFO Marcus for org chart",
      "Identify procurement lead",
    ],
  },
  {
    id: "ae-insight-3",
    type: "opportunity",
    severity: "info",
    title: "Product Team Expansion Ready",
    description: "VP Product Casey Morgan is new but engaged. Good opportunity to build relationship.",
    relatedContactIds: ["ae-7"],
    recommendedActions: [
      "Schedule product roadmap discussion",
      "Share relevant case studies",
    ],
  },
  {
    id: "ae-insight-4",
    type: "action",
    severity: "info",
    title: "Champions Aligned",
    description: "Taylor Brooks (DevOps) and Diana Rodriguez (CTO) are both champions. Leverage for expansion.",
    relatedContactIds: ["ae-3", "ae-6"],
  },
];

// ============================================================================
// SCENARIO B: RENEWAL RISK
// Existing client with declining engagement and warning signs
// ============================================================================

const renewalRiskContacts: Contact[] = [
  // Executive - Disengaged
  {
    id: "rr-1",
    name: "Jonathan Blake",
    title: "CEO",
    department: "Executive",
    seniority: "executive",
    email: "j.blake@meridianfin.com",
    phone: "+1 (555) 700-0001",
    status: "unknown",
    engagementScore: 25,
    role: "economic-buyer",
    lastContact: "2024-11-15", // 2+ months ago!
    contactOwner: "Sarah Williams",
  },
  {
    id: "rr-2",
    name: "Patricia Huang",
    title: "CFO",
    department: "Executive",
    seniority: "executive",
    email: "p.huang@meridianfin.com",
    phone: "+1 (555) 700-0002",
    status: "blocker",
    engagementScore: 15,
    role: "blocker",
    reportsTo: "rr-1",
    lastContact: "2024-12-01",
    contactOwner: "Sarah Williams",
    notes: [
      {
        id: "rr-note-1",
        date: "2024-12-01",
        author: "Sarah Williams",
        content: "Patricia raised budget concerns. Mentioned 'reviewing all vendor contracts'.",
        pinned: true,
        visibility: "team",
      }
    ],
  },
  {
    id: "rr-3",
    name: "David Chen",
    title: "CTO",
    department: "Executive",
    seniority: "executive",
    email: "d.chen@meridianfin.com",
    phone: "+1 (555) 700-0003",
    status: "warm",
    engagementScore: 55,
    role: "technical-evaluator",
    reportsTo: "rr-1",
    lastContact: "2025-01-10",
    contactOwner: "Michael Chen",
  },
  // KEY STAKEHOLDER LEFT! (Former Champion)
  {
    id: "rr-4",
    name: "Michelle Torres",
    title: "Former VP Engineering",
    department: "Technology",
    seniority: "director",
    email: "m.torres@meridianfin.com",
    phone: "+1 (555) 700-0004",
    status: "unknown",
    engagementScore: 0,
    role: "champion",
    reportsTo: "rr-3",
    lastContact: "2024-10-20",
    contactOwner: "Michael Chen",
    notes: [
      {
        id: "rr-note-2",
        date: "2024-11-01",
        author: "Michael Chen",
        content: "Michelle has left the company. Was our primary champion. Need to identify new sponsor ASAP.",
        pinned: true,
        visibility: "team",
      }
    ],
  },
  // New replacement - unknown stance
  {
    id: "rr-5",
    name: "Gregory Okonkwo",
    title: "VP Engineering",
    department: "Technology",
    seniority: "director",
    email: "g.okonkwo@meridianfin.com",
    phone: "+1 (555) 700-0005",
    status: "new",
    engagementScore: 20,
    reportsTo: "rr-3",
    lastContact: "2025-01-05",
    contactOwner: "Michael Chen",
  },
  {
    id: "rr-6",
    name: "Lisa Park",
    title: "Engineering Manager",
    department: "Technology",
    seniority: "manager",
    email: "l.park@meridianfin.com",
    phone: "+1 (555) 700-0006",
    status: "engaged",
    engagementScore: 72,
    role: "influencer",
    reportsTo: "rr-5",
    lastContact: "2025-01-18",
    contactOwner: "Michael Chen",
  },
  {
    id: "rr-7",
    name: "Kevin Wright",
    title: "Sr. Developer",
    department: "Technology",
    seniority: "senior",
    email: "k.wright@meridianfin.com",
    phone: "+1 (555) 700-0007",
    status: "warm",
    engagementScore: 65,
    reportsTo: "rr-6",
    lastContact: "2025-01-12",
    contactOwner: "Michael Chen",
  },
  // Procurement - Active threat
  {
    id: "rr-8",
    name: "Angela Foster",
    title: "Procurement Director",
    department: "Procurement",
    seniority: "director",
    email: "a.foster@meridianfin.com",
    phone: "+1 (555) 700-0008",
    status: "blocker",
    engagementScore: 10,
    role: "blocker",
    reportsTo: "rr-2",
    lastContact: "2024-12-15",
    contactOwner: "Sarah Williams",
    notes: [
      {
        id: "rr-note-3",
        date: "2024-12-15",
        author: "Sarah Williams",
        content: "Angela mentioned they're 'evaluating alternatives' for contract renewal. Red flag.",
        pinned: true,
        visibility: "team",
      }
    ],
  },
];

const renewalRiskInsights: DemoInsight[] = [
  {
    id: "rr-insight-1",
    type: "risk",
    severity: "critical",
    title: "Champion Departure",
    description: "Michelle Torres, our primary champion, has left the company. New VP Gregory Okonkwo is unproven.",
    relatedContactIds: ["rr-4", "rr-5"],
    recommendedActions: [
      "Schedule intro call with Gregory Okonkwo immediately",
      "Prepare value demonstration for new leadership",
      "Ask Lisa Park for intel on Gregory's priorities",
    ],
  },
  {
    id: "rr-insight-2",
    type: "risk",
    severity: "critical",
    title: "Contract Renewal at Risk",
    description: "Procurement is 'evaluating alternatives'. CFO Patricia Huang is a known blocker with budget concerns.",
    relatedContactIds: ["rr-2", "rr-8"],
    recommendedActions: [
      "Prepare ROI documentation for CFO meeting",
      "Identify competitive intel on alternatives",
      "Engage CEO through CTO relationship",
    ],
  },
  {
    id: "rr-insight-3",
    type: "risk",
    severity: "warning",
    title: "Executive Disengagement",
    description: "CEO Jonathan Blake hasn't been contacted in 2+ months. Relationship is cooling.",
    relatedContactIds: ["rr-1"],
    recommendedActions: [
      "Request exec-to-exec call",
      "Send personalized industry insights",
    ],
  },
  {
    id: "rr-insight-4",
    type: "opportunity",
    severity: "info",
    title: "Technical Team Still Engaged",
    description: "Lisa Park and Kevin Wright remain engaged. Use them to demonstrate ongoing value.",
    relatedContactIds: ["rr-6", "rr-7"],
  },
];

// ============================================================================
// SCENARIO C: RECRUITING PIPELINE
// Talent Database focused with contractors in client orgs
// ============================================================================

const recruitingPipelineContacts: Contact[] = [
  {
    id: "rp-1",
    name: "Robert Chang",
    title: "CTO",
    department: "Executive",
    seniority: "executive",
    email: "r.chang@velocityai.com",
    phone: "+1 (555) 600-0001",
    status: "champion",
    engagementScore: 90,
    role: "champion",
    lastContact: "2025-01-21",
    contactOwner: "Michael Chen",
  },
  {
    id: "rp-2",
    name: "Samantha Reid",
    title: "VP Engineering",
    department: "Technology",
    seniority: "director",
    email: "s.reid@velocityai.com",
    phone: "+1 (555) 600-0002",
    status: "engaged",
    engagementScore: 85,
    role: "technical-evaluator",
    reportsTo: "rp-1",
    lastContact: "2025-01-20",
    contactOwner: "Michael Chen",
  },
  {
    id: "rp-3",
    name: "Thomas Grant",
    title: "Engineering Manager",
    department: "Technology",
    seniority: "manager",
    email: "t.grant@velocityai.com",
    phone: "+1 (555) 600-0003",
    status: "champion",
    engagementScore: 88,
    role: "influencer",
    reportsTo: "rp-2",
    lastContact: "2025-01-19",
    contactOwner: "Michael Chen",
  },
  {
    id: "rp-4",
    name: "Nicole Foster",
    title: "Data Science Lead",
    department: "Technology",
    seniority: "senior",
    email: "n.foster@velocityai.com",
    phone: "+1 (555) 600-0004",
    status: "engaged",
    engagementScore: 78,
    reportsTo: "rp-2",
    lastContact: "2025-01-18",
    contactOwner: "Michael Chen",
  },
  {
    id: "rp-5",
    name: "Derek Liu",
    title: "Product Director",
    department: "Product",
    seniority: "director",
    email: "d.liu@velocityai.com",
    phone: "+1 (555) 600-0005",
    status: "warm",
    engagementScore: 65,
    role: "influencer",
    reportsTo: "rp-1",
    lastContact: "2025-01-15",
    contactOwner: "Sarah Williams",
  },
];

const recruitingTalents: Talent[] = [
  {
    id: "rp-t1",
    name: "James Wilson",
    email: "j.wilson@consultant.io",
    phone: "+1 (555) 550-0001",
    skills: ["Solutions Architecture", "AWS", "Kubernetes", "Microservices"],
    roleType: "Solutions Architect",
    seniority: "executive",
    availability: "deployed",
    rate: "$200/hr",
    notes: "Deployed at Velocity AI. Contract ends Feb 28.",
    aiOverview: "Enterprise solutions architect with 15+ years experience. Currently leading cloud transformation at Velocity AI. Contract renewal discussion needed.",
    location: "San Francisco, CA",
    lastUpdated: "2025-01-15",
    dataQuality: "parsed",
    status: "active",
    cvSource: "upload",
  },
  {
    id: "rp-t2",
    name: "Maria Santos",
    email: "m.santos@freelance.io",
    phone: "+1 (555) 550-0002",
    skills: ["Data Engineering", "Python", "Spark", "Airflow"],
    roleType: "Data Engineer",
    seniority: "senior",
    availability: "deployed",
    rate: "$150/hr",
    notes: "Deployed at Velocity AI. Contract ends March 15. Client wants extension.",
    aiOverview: "Strong data engineer working on Velocity AI's ML pipeline. Client has expressed interest in 6-month extension.",
    location: "Chicago, IL",
    lastUpdated: "2025-01-18",
    dataQuality: "parsed",
    status: "active",
    cvSource: "linkedin",
  },
  {
    id: "rp-t3",
    name: "Alex Chen",
    email: "a.chen@devops.expert",
    phone: "+1 (555) 550-0003",
    skills: ["DevOps", "Terraform", "Docker", "CI/CD", "AWS"],
    roleType: "DevOps Engineer",
    seniority: "senior",
    availability: "available",
    rate: "$140/hr",
    notes: "Available immediately. Strong fit for Velocity AI's upcoming infrastructure project.",
    aiOverview: "DevOps specialist with expertise in cloud infrastructure. Recently completed engagement, looking for new opportunity.",
    location: "Austin, TX",
    lastUpdated: "2025-01-20",
    dataQuality: "parsed",
    status: "active",
    cvSource: "upload",
  },
  {
    id: "rp-t4",
    name: "Priya Sharma",
    email: "p.sharma@react.dev",
    phone: "+1 (555) 550-0004",
    skills: ["React", "TypeScript", "Node.js", "GraphQL"],
    roleType: "Full Stack Developer",
    seniority: "senior",
    availability: "interviewing",
    rate: "$130/hr",
    notes: "In final rounds with Velocity AI for frontend lead position.",
    aiOverview: "Full stack developer specializing in React. Excellent frontend skills, completing interview process.",
    location: "New York, NY",
    lastUpdated: "2025-01-19",
    dataQuality: "parsed",
    status: "active",
    cvSource: "upload",
  },
  {
    id: "rp-t5",
    name: "David Lee",
    email: "d.lee@security.io",
    phone: "+1 (555) 550-0005",
    skills: ["Cybersecurity", "Penetration Testing", "SIEM", "SOC"],
    roleType: "Security Consultant",
    seniority: "senior",
    availability: "available",
    rate: "$175/hr",
    notes: "Available for new engagements. Previous client engagement ended.",
    aiOverview: "CISSP-certified security consultant. Available for immediate deployment.",
    location: "Washington, DC",
    lastUpdated: "2025-01-21",
    dataQuality: "parsed",
    status: "active",
    cvSource: "manual",
  },
];

const recruitingEngagements: TalentEngagement[] = [
  {
    id: "rp-eng-1",
    talentId: "rp-t1",
    companyId: "rp-acc-1",
    status: "deployed",
    roleType: "Solutions Architect",
    department: "Technology",
    startDate: "2024-09-01",
    endDate: "2025-02-28",
    notes: "Contract ends Feb 28. Discuss renewal.",
  },
  {
    id: "rp-eng-2",
    talentId: "rp-t2",
    companyId: "rp-acc-1",
    status: "deployed",
    roleType: "Data Engineer",
    department: "Technology",
    startDate: "2024-10-15",
    endDate: "2025-03-15",
    notes: "Client interested in 6-month extension.",
  },
  {
    id: "rp-eng-3",
    talentId: "rp-t3",
    companyId: "rp-acc-1",
    status: "proposed",
    roleType: "DevOps Engineer",
    department: "Technology",
    notes: "Proposed for Q2 infrastructure modernization.",
  },
  {
    id: "rp-eng-4",
    talentId: "rp-t4",
    companyId: "rp-acc-1",
    status: "interviewing",
    roleType: "Full Stack Developer",
    department: "Technology",
    notes: "Final interview scheduled next week.",
  },
];

const recruitingInsights: DemoInsight[] = [
  {
    id: "rp-insight-1",
    type: "talent",
    severity: "critical",
    title: "Contract Expiring: James Wilson",
    description: "Solutions Architect contract ends Feb 28. Client renewal decision needed by Feb 15.",
    recommendedActions: [
      "Schedule contract renewal discussion with CTO",
      "Prepare extension proposal with updated rates",
      "Identify backup candidates if renewal fails",
    ],
  },
  {
    id: "rp-insight-2",
    type: "opportunity",
    severity: "info",
    title: "Extension Opportunity: Maria Santos",
    description: "Client has expressed interest in 6-month extension for Data Engineer. High satisfaction reported.",
    recommendedActions: [
      "Confirm Maria's availability for extension",
      "Prepare extension paperwork",
      "Discuss rate adjustment if applicable",
    ],
  },
  {
    id: "rp-insight-3",
    type: "action",
    severity: "warning",
    title: "Follow Up: Priya Sharma Interview",
    description: "Final interview for Frontend Lead position. Decision expected this week.",
    recommendedActions: [
      "Check in with hiring manager Thomas Grant",
      "Prepare offer terms for quick turnaround",
    ],
  },
  {
    id: "rp-insight-4",
    type: "opportunity",
    severity: "info",
    title: "New Placement: DevOps Role Open",
    description: "Q2 infrastructure project requires DevOps Engineer. Alex Chen is a strong fit.",
    recommendedActions: [
      "Submit Alex Chen's profile to VP Engineering",
      "Prepare technical assessment if needed",
    ],
  },
];

// ============================================================================
// SCENARIO D: NEW LOGO PROSPECTING
// Cold target company with minimal data, external signals
// ============================================================================

const newLogoContacts: Contact[] = [
  {
    id: "nl-1",
    name: "Sarah Mitchell",
    title: "CEO",
    department: "Executive",
    seniority: "executive",
    email: "s.mitchell@quantumleap.io",
    phone: "+1 (555) 500-0001",
    status: "unknown",
    engagementScore: 5,
    lastContact: undefined,
    contactOwner: "Sarah Williams",
  },
  {
    id: "nl-2",
    name: "James Park",
    title: "CTO",
    department: "Executive",
    seniority: "executive",
    email: "j.park@quantumleap.io",
    phone: "+1 (555) 500-0002",
    status: "unknown",
    engagementScore: 5,
    lastContact: undefined,
    contactOwner: "Michael Chen",
  },
  {
    id: "nl-3",
    name: "Emma Wilson",
    title: "VP Engineering",
    department: "Technology",
    seniority: "director",
    email: "e.wilson@quantumleap.io",
    phone: "+1 (555) 500-0003",
    status: "new",
    engagementScore: 15,
    reportsTo: "nl-2",
    lastContact: "2025-01-18",
    contactOwner: "Michael Chen",
    notes: [
      {
        id: "nl-note-1",
        date: "2025-01-18",
        author: "Michael Chen",
        content: "Connected on LinkedIn. Emma attended our webinar on cloud architecture.",
        pinned: true,
        visibility: "team",
      }
    ],
  },
];

const newLogoInsights: DemoInsight[] = [
  {
    id: "nl-insight-1",
    type: "opportunity",
    severity: "info",
    title: "Series C Funding Announced",
    description: "Quantum Leap closed $50M Series C last week. Likely expanding engineering team.",
    recommendedActions: [
      "Research their tech stack from job postings",
      "Prepare tailored outreach to CTO",
      "Identify mutual connections on LinkedIn",
    ],
  },
  {
    id: "nl-insight-2",
    type: "action",
    severity: "info",
    title: "Warm Lead: Emma Wilson",
    description: "VP Engineering attended our webinar. Good entry point for initial conversation.",
    relatedContactIds: ["nl-3"],
    recommendedActions: [
      "Send personalized follow-up on webinar topics",
      "Offer 1:1 technical consultation",
      "Ask for intro to CTO if conversation goes well",
    ],
  },
  {
    id: "nl-insight-3",
    type: "coverage-gap",
    severity: "warning",
    title: "Limited Org Visibility",
    description: "Only 3 contacts mapped. Unknown reporting structure and decision makers.",
    recommendedActions: [
      "Use LinkedIn Sales Navigator for org research",
      "Check for recent hiring announcements",
      "Identify key departments to target",
    ],
  },
  {
    id: "nl-insight-4",
    type: "opportunity",
    severity: "info",
    title: "Technology Stack Signal",
    description: "Job postings indicate Kubernetes and AWS usage. Strong alignment with our services.",
    recommendedActions: [
      "Prepare case study for similar tech stack",
      "Highlight relevant expertise in outreach",
    ],
  },
];

// ============================================================================
// SCENARIO DEFINITIONS
// ============================================================================

export const demoScenarios: DemoScenario[] = [
  {
    id: "account-expansion",
    name: "Account Expansion",
    description: "Enterprise with partial coverage, AI shows gaps and targets",
    icon: "TrendingUp",
    accounts: [
      {
        id: "ae-acc-1",
        name: "Nexus Technologies",
        industry: "Enterprise SaaS",
        size: "2,500 employees",
        contacts: accountExpansionContacts,
        lastUpdated: "2025-01-21",
        engagementScore: 75,
        accountManager: {
          name: "Sarah Williams",
          title: "Enterprise Account Manager",
        },
        lastInteraction: "2 days ago",
        primaryChampion: { name: "Diana Rodriguez", title: "CTO" },
        recentNews: [
          {
            id: "ae-news-1",
            date: "2025-01-15",
            headline: "Nexus Technologies expands APAC operations",
            summary: "New offices in Singapore and Tokyo signal growth",
          },
        ],
      },
    ],
    insights: accountExpansionInsights,
  },
  {
    id: "renewal-risk",
    name: "Renewal Risk",
    description: "Declining engagement, key stakeholder left, contract at risk",
    icon: "AlertTriangle",
    accounts: [
      {
        id: "rr-acc-1",
        name: "Meridian Financial",
        industry: "Financial Services",
        size: "5,000 employees",
        contacts: renewalRiskContacts,
        lastUpdated: "2025-01-18",
        engagementScore: 42,
        accountManager: {
          name: "Sarah Williams",
          title: "Enterprise Account Manager",
        },
        lastInteraction: "3 days ago",
        primaryChampion: undefined, // Champion left!
        knownBlockers: ["Patricia Huang (CFO)", "Angela Foster (Procurement)"],
        importantNote: "⚠️ Contract renewal at risk. Champion departed. New VP unproven.",
        recentNews: [
          {
            id: "rr-news-1",
            date: "2025-01-10",
            headline: "Meridian Financial announces cost reduction initiative",
            summary: "15% budget cuts across technology vendors",
          },
        ],
      },
    ],
    insights: renewalRiskInsights,
  },
  {
    id: "recruiting-pipeline",
    name: "Recruiting Pipeline",
    description: "Talent database with contractors placed in client orgs",
    icon: "Users",
    accounts: [
      {
        id: "rp-acc-1",
        name: "Velocity AI",
        industry: "AI/ML Platform",
        size: "800 employees",
        contacts: recruitingPipelineContacts,
        lastUpdated: "2025-01-21",
        engagementScore: 88,
        accountManager: {
          name: "Michael Chen",
          title: "Strategic Account Manager",
        },
        lastInteraction: "1 day ago",
        primaryChampion: { name: "Robert Chang", title: "CTO" },
      },
    ],
    talents: recruitingTalents,
    engagements: recruitingEngagements,
    insights: recruitingInsights,
  },
  {
    id: "new-logo-prospecting",
    name: "New Logo",
    description: "Cold target with minimal data, AI suggests approach",
    icon: "Target",
    accounts: [
      {
        id: "nl-acc-1",
        name: "Quantum Leap Technologies",
        industry: "Quantum Computing",
        size: "150 employees",
        contacts: newLogoContacts,
        lastUpdated: "2025-01-18",
        engagementScore: 12,
        accountManager: {
          name: "Sarah Williams",
          title: "Business Development",
        },
        lastInteraction: "3 days ago",
        recentNews: [
          {
            id: "nl-news-1",
            date: "2025-01-12",
            headline: "Quantum Leap raises $50M Series C",
            summary: "Funding to accelerate enterprise product development",
          },
          {
            id: "nl-news-2",
            date: "2025-01-08",
            headline: "Quantum Leap hiring 50+ engineers",
            summary: "Major expansion of engineering team planned",
          },
        ],
      },
    ],
    insights: newLogoInsights,
  },
];

// Helper to get scenario by ID
export const getScenarioById = (id: DemoScenarioId): DemoScenario | undefined => {
  return demoScenarios.find(s => s.id === id);
};

// Default scenario
export const defaultScenarioId: DemoScenarioId = "account-expansion";
