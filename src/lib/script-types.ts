/**
 * Script Builder Types
 * Full type definitions for outreach scripts with guardrails and versioning.
 */

// ─── Allowed template variables (allow-list) ──────────────────────────────────

export const ALLOWED_VARIABLES = [
  { key: "{{candidate.first_name}}", label: "First Name", category: "candidate", requiresEvidence: false },
  { key: "{{candidate.full_name}}", label: "Full Name", category: "candidate", requiresEvidence: false },
  { key: "{{candidate.current_title}}", label: "Current Title", category: "candidate", requiresEvidence: false },
  { key: "{{candidate.current_company}}", label: "Current Company", category: "candidate", requiresEvidence: false },
  { key: "{{candidate.location}}", label: "Location", category: "candidate", requiresEvidence: false },
  { key: "{{candidate.skills}}", label: "Top Skills (comma list)", category: "candidate", requiresEvidence: false },
  { key: "{{candidate.availability}}", label: "Availability Status", category: "candidate", requiresEvidence: false },
  { key: "{{job.title}}", label: "Job Title", category: "job", requiresEvidence: false },
  { key: "{{job.company}}", label: "Hiring Company", category: "job", requiresEvidence: false },
  { key: "{{job.location}}", label: "Job Location", category: "job", requiresEvidence: false },
  { key: "{{job.rate}}", label: "Rate / Salary", category: "job", requiresEvidence: false },
  { key: "{{job.type}}", label: "Job Type (perm/contract)", category: "job", requiresEvidence: false },
  { key: "{{recruiter.name}}", label: "Recruiter Name", category: "recruiter", requiresEvidence: false },
  { key: "{{recruiter.phone}}", label: "Recruiter Phone", category: "recruiter", requiresEvidence: false },
  { key: "{{agency.name}}", label: "Agency / Firm Name", category: "agency", requiresEvidence: false },
  { key: "{{campaign.name}}", label: "Campaign Name", category: "campaign", requiresEvidence: false },
  // Evidence-gated variables — require consent/source proof
  { key: "{{candidate.registered}}", label: "Registered Status", category: "candidate", requiresEvidence: true, evidenceField: "source" },
  { key: "{{candidate.consent_date}}", label: "Consent Date", category: "candidate", requiresEvidence: true, evidenceField: "consent" },
] as const;

export type AllowedVariable = typeof ALLOWED_VARIABLES[number];

// ─── Guardrails ───────────────────────────────────────────────────────────────

export interface GuardrailRule {
  id: string;
  label: string;
  description: string;
  pattern: string;
  severity: "error" | "warning";
  satisfiedBy?: string[];
}

export const DEFAULT_GUARDRAILS: GuardrailRule[] = [
  {
    id: "no_registered_claim",
    label: "No unverified registration claim",
    description: "Claiming a candidate is 'registered with us' without evidence violates GDPR and trust norms.",
    pattern: "\\b(registered with us|on our books|in our database|in our system)\\b",
    severity: "error",
    satisfiedBy: ["{{candidate.registered}}"],
  },
  {
    id: "no_consent_claim",
    label: "No unverified consent claim",
    description: "Stating consent was given without the candidate's consent record being confirmed.",
    pattern: "\\b(you agreed|you consented|per your consent|with your permission)\\b",
    severity: "error",
    satisfiedBy: ["{{candidate.consent_date}}"],
  },
  {
    id: "no_salary_guarantee",
    label: "No salary guarantees",
    description: "Guaranteeing an exact salary range before a role is confirmed creates legal liability.",
    pattern: "\\b(guaranteed salary|guaranteed rate|guaranteed pay)\\b",
    severity: "error",
  },
  {
    id: "no_exclusivity_claim",
    label: "No exclusivity claims",
    description: "Claiming exclusive access to a role when it may be multi-listed is misleading.",
    pattern: "\\b(exclusively|only through us|only via us|you can only apply)\\b",
    severity: "warning",
  },
  {
    id: "sms_length",
    label: "SMS character limit",
    description: "SMS messages over 160 characters may be split by carriers. Aim to keep concise.",
    pattern: "__SMS_LENGTH__",
    severity: "warning",
  },
  {
    id: "no_urgency_pressure",
    label: "Avoid high-pressure urgency",
    description: "Language that creates artificial urgency can harm candidate experience and brand.",
    pattern: "\\b(act now|don't wait|last chance|final opportunity|apply immediately)\\b",
    severity: "warning",
  },
];

// ─── Call block structure ─────────────────────────────────────────────────────

export type CallBlockType = "intro" | "permission" | "questions" | "branching" | "close";

export interface CallBlock {
  id: string;
  type: CallBlockType;
  title: string;
  content: string;
  branches?: Array<{
    id: string;
    label: string;
    response: string;
  }>;
}

// ─── Script ───────────────────────────────────────────────────────────────────

export type ScriptChannel = "email" | "sms" | "call";

export interface OutreachScript {
  id: string;
  workspace_id: string;
  campaign_id?: string;
  name: string;
  channel: ScriptChannel;
  subject?: string;
  body: string;
  call_blocks?: CallBlock[];
  guardrails: GuardrailRule[];
  is_default: boolean;
  version: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// ─── Guardrail check ──────────────────────────────────────────────────────────

export interface GuardrailViolation {
  rule: GuardrailRule;
  matchedText: string;
  position: number;
}

export function checkGuardrails(
  body: string,
  channel: ScriptChannel,
  guardrails: GuardrailRule[]
): GuardrailViolation[] {
  const violations: GuardrailViolation[] = [];

  for (const rule of guardrails) {
    if (rule.id === "sms_length" && channel === "sms") {
      if (body.length > 160) {
        violations.push({ rule, matchedText: `${body.length} chars`, position: 160 });
      }
      continue;
    }
    if (rule.pattern === "__SMS_LENGTH__") continue;

    const regex = new RegExp(rule.pattern, "gi");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(body)) !== null) {
      const satisfied = rule.satisfiedBy?.some((v) => body.includes(v));
      if (!satisfied) {
        violations.push({ rule, matchedText: match[0], position: match.index });
      }
      break;
    }
  }

  return violations;
}

// ─── Template variable resolver ───────────────────────────────────────────────

export interface SimulatorCandidate {
  first_name: string;
  full_name: string;
  current_title: string;
  current_company: string;
  location: string;
  skills: string;
  availability: string;
  source?: string;
  registered?: string;
  consent_date?: string;
}

export interface SimulatorJob {
  title: string;
  company: string;
  location: string;
  rate: string;
  type: string;
}

export interface SimulatorContext {
  candidate: SimulatorCandidate;
  job: SimulatorJob;
  recruiter: { name: string; phone: string };
  agency: { name: string };
  campaign: { name: string };
}

export function resolveTemplate(template: string, ctx: SimulatorContext): string {
  let out = template;
  out = out.replace(/\{\{candidate\.first_name\}\}/g, ctx.candidate.first_name);
  out = out.replace(/\{\{candidate\.full_name\}\}/g, ctx.candidate.full_name);
  out = out.replace(/\{\{candidate\.current_title\}\}/g, ctx.candidate.current_title);
  out = out.replace(/\{\{candidate\.current_company\}\}/g, ctx.candidate.current_company);
  out = out.replace(/\{\{candidate\.location\}\}/g, ctx.candidate.location);
  out = out.replace(/\{\{candidate\.skills\}\}/g, ctx.candidate.skills);
  out = out.replace(/\{\{candidate\.availability\}\}/g, ctx.candidate.availability);
  out = out.replace(/\{\{candidate\.registered\}\}/g, ctx.candidate.registered ?? "[not available]");
  out = out.replace(/\{\{candidate\.consent_date\}\}/g, ctx.candidate.consent_date ?? "[not available]");
  out = out.replace(/\{\{job\.title\}\}/g, ctx.job.title);
  out = out.replace(/\{\{job\.company\}\}/g, ctx.job.company);
  out = out.replace(/\{\{job\.location\}\}/g, ctx.job.location);
  out = out.replace(/\{\{job\.rate\}\}/g, ctx.job.rate);
  out = out.replace(/\{\{job\.type\}\}/g, ctx.job.type);
  out = out.replace(/\{\{recruiter\.name\}\}/g, ctx.recruiter.name);
  out = out.replace(/\{\{recruiter\.phone\}\}/g, ctx.recruiter.phone);
  out = out.replace(/\{\{agency\.name\}\}/g, ctx.agency?.name ?? "");
  out = out.replace(/\{\{campaign\.name\}\}/g, ctx.campaign.name);
  return out;
}

// ─── Default body templates ───────────────────────────────────────────────────

export function getDefaultScriptBody(channel: ScriptChannel): string {
  if (channel === "email") {
    return `Hi {{candidate.first_name}},

I hope this finds you well. My name is {{recruiter.name}} from {{agency.name}}, and I'm reaching out about a {{job.type}} {{job.title}} opportunity with {{job.company}}.

Based on your background in {{candidate.current_title}}, this could be a strong fit. The role is based in {{job.location}} at a rate of {{job.rate}}.

If you'd like to hear more, I'd love to schedule a quick call at your convenience.

Best regards,
{{recruiter.name}}
{{agency.name}}
{{recruiter.phone}}`;
  }
  if (channel === "sms") {
    return `Hi {{candidate.first_name}}, it's {{recruiter.name}} at {{agency.name}}. I have a {{job.type}} {{job.title}} role with {{job.company}} ({{job.location}}) that may suit you. Worth a quick chat?`;
  }
  return "";
}

// ─── Default call blocks ──────────────────────────────────────────────────────

export function getDefaultCallBlocks(): CallBlock[] {
  return [
    {
      id: "intro",
      type: "intro",
      title: "Introduction",
      content:
        "Hi, am I speaking with {{candidate.first_name}}? Great – my name is {{recruiter.name}} calling from {{agency.name}}. I specialise in {{job.title}} roles. I've got about 2 minutes – is now an okay time to speak?",
    },
    {
      id: "permission",
      type: "permission",
      title: "Permission Check",
      content:
        "I wanted to reach out about a {{job.type}} {{job.title}} opportunity at {{job.company}} in {{job.location}}. Does that sound like something you'd be open to hearing more about?",
      branches: [
        { id: "perm-yes", label: "Yes / Open to it", response: "Proceed to questions" },
        { id: "perm-no", label: "Not right now / No", response: "Respect and close politely" },
      ],
    },
    {
      id: "questions",
      type: "questions",
      title: "Qualifying Questions",
      content:
        "Can I ask — what's your current availability like? And are you looking for a permanent position or would you consider contract work? The rate on this one is {{job.rate}}.",
    },
    {
      id: "close",
      type: "close",
      title: "Close",
      content:
        "That's really helpful, thank you. I'll send over a brief overview via email so you have the details. Would it be okay if I followed up later this week? My number is {{recruiter.phone}} if you'd like to call me directly.",
    },
  ];
}

// ─── Default simulator context ────────────────────────────────────────────────

export const DEFAULT_SIMULATOR_CONTEXT: SimulatorContext = {
  candidate: {
    first_name: "Alex",
    full_name: "Alex Chen",
    current_title: "Senior Data Engineer",
    current_company: "FinTech Corp",
    location: "New York, NY",
    skills: "Python, Spark, AWS",
    availability: "Available",
  },
  job: {
    title: "Lead Data Engineer",
    company: "Acme Capital",
    location: "New York, NY",
    rate: "$150–$175/hr",
    type: "Contract",
  },
  recruiter: {
    name: "Sarah Mitchell",
    phone: "+1 (555) 000-1234",
  },
  agency: {
    name: "Bluebridge Data",
  },
  campaign: {
    name: "Q1 Data Engineering Push",
  },
};
