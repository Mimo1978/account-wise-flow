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
  // ─── Safety filters (strict mode) ──────────────────────────────────────────
  // These are blocking errors by default and protect the brand, candidates and
  // the workspace against compliance risk. Workspace admins can downgrade them
  // to warnings via Admin → Outreach Settings → "Strict script safety".
  {
    id: "profanity_block",
    label: "Profanity / offensive language",
    description: "Outbound recruitment scripts must not contain profanity or offensive language.",
    // Word-boundary matched, case-insensitive. Deliberately conservative list.
    pattern: "\\b(fuck|fucking|shit|bitch|bastard|asshole|dick|cunt|wanker|prick|bollocks|piss off|crap)\\b",
    severity: "error",
  },
  {
    id: "slurs_hate_block",
    label: "Slurs or hate speech",
    description: "Slurs and hate speech are never permitted in outreach. Save is blocked.",
    pattern: "\\b(retard|retarded|f[a4]g|f[a4]gg[o0]t|n[i1]gg[ae3]r?|tr[a4]nny|sp[i1]c|ch[i1]nk|k[i1]ke|g[o0]ok)\\b",
    severity: "error",
  },
  {
    id: "discrimination_block",
    label: "Discriminatory language",
    description: "Recruitment must not screen by protected characteristics (age, gender, race, religion, disability, marital status, pregnancy).",
    pattern: "\\b(must be (male|female|man|woman|young|under \\d+|over \\d+)|no (women|men|gays|blacks|whites|asians|muslims|christians|jews|disabled)|whites only|men only|women only|no over[- ]?\\d+s?|no married|must not be pregnant)\\b",
    severity: "error",
  },
  {
    id: "threat_harassment_block",
    label: "Threatening or harassing language",
    description: "Threats, intimidation or harassment are never acceptable in outreach.",
    pattern: "\\b(i('| wi)ll (sue|destroy|ruin) you|you('| wi)ll regret|or else|we know where you (live|work)|stop ignoring me|answer me now|i(’|')m warning you)\\b",
    severity: "error",
  },
  {
    id: "dangerous_requests",
    label: "Sensitive data request",
    description: "Never request payment details, full national ID/SSN, or passwords inside an outreach script.",
    pattern: "\\b(your (credit card|cvv|bank account number|sort code|password|pin)|social security number|ssn|national insurance number)\\b",
    severity: "error",
  },
  // ─── Structural completeness checks ───────────────────────────────────────
  {
    id: "min_content",
    label: "Script body too short",
    description: "A script must contain enough content (at least 30 characters of meaningful text) to be sent.",
    pattern: "__MIN_CONTENT__",
    severity: "error",
  },
  {
    id: "subject_required",
    label: "Email subject required",
    description: "Email scripts must have a non-empty subject line before they can be saved.",
    pattern: "__SUBJECT_REQUIRED__",
    severity: "error",
  },
  {
    id: "call_blocks_required",
    label: "Call script missing core blocks",
    description: "Call scripts must have content in the Introduction, Permission and Close blocks.",
    pattern: "__CALL_BLOCKS_REQUIRED__",
    severity: "error",
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

/**
 * Optional structural context for the guardrail checker. Lets us validate
 * completeness (subject, call blocks) in addition to body content.
 */
export interface GuardrailContext {
  subject?: string;
  callBlocks?: CallBlock[];
  /**
   * When false, all `error`-severity safety rules are downgraded to
   * `warning` so they no longer block save. Used by the Admin "Strict
   * script safety" toggle for workspaces that need a manual override.
   * Structural rules (min_content, subject_required, call_blocks_required)
   * are NEVER downgraded — an empty script is always invalid.
   */
  strictSafety?: boolean;
}

const STRUCTURAL_RULE_IDS = new Set([
  "min_content",
  "subject_required",
  "call_blocks_required",
]);

export function checkGuardrails(
  body: string,
  channel: ScriptChannel,
  guardrails: GuardrailRule[],
  context: GuardrailContext = {},
): GuardrailViolation[] {
  const violations: GuardrailViolation[] = [];
  const strict = context.strictSafety !== false; // default ON

  const pushViolation = (rule: GuardrailRule, matchedText: string, position: number) => {
    // Honour the admin "strict safety" override: downgrade non-structural
    // safety errors to warnings so save is not blocked.
    const effective: GuardrailRule =
      !strict && rule.severity === "error" && !STRUCTURAL_RULE_IDS.has(rule.id)
        ? { ...rule, severity: "warning" }
        : rule;
    violations.push({ rule: effective, matchedText, position });
  };

  for (const rule of guardrails) {
    // ── Structural / length checks (sentinel patterns) ────────────────────
    if (rule.id === "sms_length" && channel === "sms") {
      if (body.length > 160) {
        pushViolation(rule, `${body.length} chars`, 160);
      }
      continue;
    }
    if (rule.pattern === "__SMS_LENGTH__") continue;

    if (rule.pattern === "__MIN_CONTENT__") {
      const stripped = body.replace(/\s+/g, " ").trim();
      if (stripped.length < 30) {
        pushViolation(rule, `${stripped.length} chars`, 0);
      }
      continue;
    }

    if (rule.pattern === "__SUBJECT_REQUIRED__") {
      if (channel === "email" && !(context.subject ?? "").trim()) {
        pushViolation(rule, "missing subject", 0);
      }
      continue;
    }

    if (rule.pattern === "__CALL_BLOCKS_REQUIRED__") {
      if (channel === "call") {
        const blocks = context.callBlocks ?? [];
        const required: CallBlockType[] = ["intro", "permission", "close"];
        const missing = required.filter((t) => {
          const b = blocks.find((bb) => bb.type === t);
          return !b || !b.content.trim();
        });
        if (missing.length > 0) {
          pushViolation(rule, `missing: ${missing.join(", ")}`, 0);
        }
      }
      continue;
    }

    // ── Standard regex content rules ──────────────────────────────────────
    const regex = new RegExp(rule.pattern, "gi");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(body)) !== null) {
      const satisfied = rule.satisfiedBy?.some((v) => body.includes(v));
      if (!satisfied) {
        pushViolation(rule, match[0], match.index);
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
