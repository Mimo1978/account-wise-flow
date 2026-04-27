import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search, Mail, MessageSquare, PhoneCall, Sparkles, Check } from "lucide-react";
import type { ScriptChannel, CallBlock } from "@/lib/script-types";
import { cn } from "@/lib/utils";

/**
 * A ready-made template the user can click to apply (or apply + edit).
 * Templates use BOTH:
 *   • {{variable}}  — auto-resolved from CRM/job/agency data
 *   • [SQUARE_BRACKETS] — human-fill placeholders (e.g. [DAY], [TIME WINDOW])
 *   • (pause)  — natural pause markers for AI Voice agents
 */
export interface ReadyTemplate {
  id: string;
  name: string;
  /** Short helpful description shown on the card */
  description: string;
  /** What this template is FOR — drives audience copy. */
  audience:
    | "candidate"
    | "client_contact"
    | "account_manager"
    | "warm_lead"
    | "cold_outreach";
  /** Channel — drives which fields get populated */
  channel: ScriptChannel;
  /** Used when channel = email */
  subject?: string;
  /** Used when channel = email | sms */
  body?: string;
  /** Used when channel = call */
  call_blocks?: CallBlock[];
}

const AUDIENCE_LABELS: Record<ReadyTemplate["audience"], string> = {
  candidate: "Candidate / Talent",
  client_contact: "Client Contact",
  account_manager: "Account Manager",
  warm_lead: "Warm Lead",
  cold_outreach: "Cold Outreach",
};

const AUDIENCE_COLORS: Record<ReadyTemplate["audience"], string> = {
  candidate: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  client_contact: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  account_manager: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  warm_lead: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  cold_outreach: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

const CHANNEL_ICON = {
  email: Mail,
  sms: MessageSquare,
  call: PhoneCall,
} as const;

/* ──────────────────────────────────────────────────────────────────────────
 * READY-TO-USE TEMPLATES
 * Word-for-word, with (pause) markers and [HUMAN FIELD] placeholders.
 * The agent voice/persona is implied by {{agent.name}} and the integration
 * layer auto-introduces the configured voice when the call begins.
 * ────────────────────────────────────────────────────────────────────────── */

function block(
  id: string,
  type: CallBlock["type"],
  title: string,
  content: string,
  branches?: CallBlock["branches"],
): CallBlock {
  return { id, type, title, content, branches };
}

export const READY_TEMPLATES: ReadyTemplate[] = [
  // ── AI CALL — book a meeting with a CLIENT CONTACT ─────────────────────
  {
    id: "call-client-meeting-book",
    name: "AI Call · Book intro meeting with client",
    description:
      "Polite, word-for-word script for an AI agent calling a client contact to book a 15-minute discovery meeting on behalf of {{agency.name}}.",
    audience: "client_contact",
    channel: "call",
    call_blocks: [
      block(
        "intro",
        "intro",
        "Introduction",
        "Hi, is this {{contact.first_name}}? (pause) Hi {{contact.first_name}}, my name is {{agent.name}} — I'm calling on behalf of {{agency.name}}. (pause) I know I've called out of the blue, so I'll keep this very brief — is now an okay moment to take a quick call?",
        [
          { id: "ok", label: "Yes / quick call", response: "Continue to permission" },
          { id: "busy", label: "Busy", response: "Offer call back later — capture preferred time" },
        ],
      ),
      block(
        "permission",
        "permission",
        "Reason for calling",
        "Thank you. (pause) The reason for my call is that we work with companies similar to {{contact.company}} on [WHAT YOUR FIRM DOES — e.g. talent strategy, contract delivery, leadership search], and I'd love to introduce {{agency.name}} to you with a 15-minute discovery call. (pause) Would that be something you'd be open to?",
        [
          { id: "yes", label: "Yes / interested", response: "Move to scheduling" },
          { id: "maybe", label: "Maybe / send info", response: "Offer to email a one-pager and follow up" },
          { id: "no", label: "No", response: "Thank politely and close" },
        ],
      ),
      block(
        "questions",
        "questions",
        "Suggest a meeting time",
        "Wonderful. (pause) I have availability on [DAY 1] at [TIME WINDOW] or [DAY 2] at [TIME WINDOW] — would either of those work for you, or shall I propose another time?",
      ),
      block(
        "branching",
        "branching",
        "Confirm + email follow-up",
        "Perfect — I'll send a calendar invite to [EMAIL ON FILE / please confirm best email]. (pause) The meeting will be hosted by [HUMAN OWNER NAME] from {{agency.name}}, and I'll include a short agenda so you know exactly what to expect.",
      ),
      block(
        "close",
        "close",
        "Close",
        "Thank you so much for your time today, {{contact.first_name}}. (pause) You'll receive the invite within the next few minutes. Have a wonderful rest of your day. (pause) Goodbye.",
      ),
    ],
  },

  // ── AI CALL — re-engage a warm account-manager contact ─────────────────
  {
    id: "call-account-manager-reengage",
    name: "AI Call · Re-engage existing account contact",
    description:
      "Friendly check-in script for an AI agent calling a contact your account manager already knows — purpose: book a catch-up.",
    audience: "account_manager",
    channel: "call",
    call_blocks: [
      block(
        "intro",
        "intro",
        "Warm intro",
        "Hi {{contact.first_name}}, this is {{agent.name}} calling from {{agency.name}}. (pause) [HUMAN OWNER NAME] asked me to give you a quick courtesy call to see how things are going on your side — is now a good moment for a quick chat?",
      ),
      block(
        "permission",
        "permission",
        "Purpose",
        "Lovely. (pause) [HUMAN OWNER NAME] wanted to suggest a brief 20-minute catch-up to share what we've been working on with [SIMILAR COMPANY / SECTOR] and to hear how things are evolving at {{contact.company}}. (pause) Would you be open to that?",
      ),
      block(
        "questions",
        "questions",
        "Pick a slot",
        "Brilliant. (pause) [HUMAN OWNER NAME] has [DAY 1] at [TIME] or [DAY 2] at [TIME] free this week — does either of those suit you?",
      ),
      block(
        "close",
        "close",
        "Close",
        "Perfect. (pause) I'll get the invite over to you in the next few minutes. Thank you so much for your time, {{contact.first_name}} — speak soon. (pause) Goodbye.",
      ),
    ],
  },

  // ── AI CALL — talent / candidate role pitch ────────────────────────────
  {
    id: "call-candidate-role-pitch",
    name: "AI Call · Candidate role pitch + book screening",
    description:
      "Word-for-word script for an AI agent calling a talent prospect about a specific role and booking a screening call with the recruiter.",
    audience: "candidate",
    channel: "call",
    call_blocks: [
      block(
        "intro",
        "intro",
        "Introduction",
        "Hi, am I speaking with {{candidate.first_name}}? (pause) Hi — my name is {{agent.name}} from {{agency.name}}. I work with [HUMAN RECRUITER NAME] on the [SECTOR / DESK] desk. (pause) I've got a quick role I think might be of interest — do you have two minutes?",
      ),
      block(
        "permission",
        "permission",
        "The role",
        "Brilliant. (pause) The role is a {{job.type}} {{job.title}} position based in {{job.location}}, paying around {{job.rate}}. (pause) Given your background as {{candidate.current_title}}, I thought it could be a strong match — does that sound like something worth exploring?",
      ),
      block(
        "questions",
        "questions",
        "Quick qualifiers",
        "Great. (pause) Just a couple of quick questions — what's your current notice period? (pause) And are you open to [ON-SITE / HYBRID / REMOTE] working?",
      ),
      block(
        "branching",
        "branching",
        "Book screening",
        "Perfect. (pause) I'd love to book you in for a 20-minute screening call with [HUMAN RECRUITER NAME]. (pause) They have [DAY 1] at [TIME] or [DAY 2] at [TIME] — which works best?",
      ),
      block(
        "close",
        "close",
        "Close",
        "Excellent — I'll send a calendar invite to your email and a text confirmation. (pause) Thanks so much {{candidate.first_name}}, speak soon. (pause) Goodbye.",
      ),
    ],
  },

  // ── EMAIL — book client meeting ────────────────────────────────────────
  {
    id: "email-client-intro-meeting",
    name: "Email · Intro meeting request to client",
    description:
      "Concise email proposing a 15-minute discovery meeting between {{agency.name}} and a target client contact.",
    audience: "client_contact",
    channel: "email",
    subject: "Quick intro — {{agency.name}} & {{contact.company}}",
    body: `Hi {{contact.first_name}},

I hope this finds you well. I'm reaching out from {{agency.name}} — we partner with companies similar to {{contact.company}} on [WHAT YOUR FIRM DOES].

Would you be open to a brief 15-minute discovery call to share what we've been working on and to hear what's on your roadmap?

I have availability on [DAY 1] at [TIME] or [DAY 2] at [TIME] — happy to work around your calendar.

Best regards,
[HUMAN OWNER NAME]
{{agency.name}}`,
  },

  // ── EMAIL — candidate role pitch ───────────────────────────────────────
  {
    id: "email-candidate-role-pitch",
    name: "Email · Candidate role pitch",
    description: "Personalised role pitch to a candidate with a clear next step.",
    audience: "candidate",
    channel: "email",
    subject: "{{job.title}} opportunity — thought of you",
    body: `Hi {{candidate.first_name}},

I came across your background as {{candidate.current_title}} at {{candidate.current_company}} and wanted to reach out about a {{job.type}} {{job.title}} role we're working on with [HIRING COMPANY OR "a leading client in {{job.location}}"].

The headline details:
• Location: {{job.location}}
• Rate / Package: {{job.rate}}
• Type: {{job.type}}

If this looks interesting, I'd love to schedule a quick 15-minute call this week — would [DAY] at [TIME] work?

Best,
[HUMAN RECRUITER NAME]
{{agency.name}}`,
  },

  // ── SMS — quick client intro ───────────────────────────────────────────
  {
    id: "sms-client-intro",
    name: "SMS · Quick client intro",
    description: "Short, polite SMS opener to a client contact.",
    audience: "client_contact",
    channel: "sms",
    body: "Hi {{contact.first_name}}, [HUMAN OWNER NAME] from {{agency.name}}. Would you be open to a quick 15-min intro call this week? Reply STOP to opt out.",
  },

  // ── SMS — candidate nudge ──────────────────────────────────────────────
  {
    id: "sms-candidate-nudge",
    name: "SMS · Candidate role nudge",
    description: "Friendly SMS to a candidate about an active role.",
    audience: "candidate",
    channel: "sms",
    body: "Hi {{candidate.first_name}}, it's [HUMAN RECRUITER NAME] at {{agency.name}}. I have a {{job.title}} role in {{job.location}} that may suit you — worth a 5-min chat? Reply STOP to opt out.",
  },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** The currently selected channel — we filter templates to it by default */
  channel: ScriptChannel;
  /** Apply the template directly into the modal */
  onApply: (tpl: ReadyTemplate, mode: "use" | "edit") => void;
}

export function ScriptTemplateLibrary({ open, onOpenChange, channel, onApply }: Props) {
  const [query, setQuery] = useState("");
  const [showAllChannels, setShowAllChannels] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return READY_TEMPLATES.filter((t) => {
      if (!showAllChannels && t.channel !== channel) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        AUDIENCE_LABELS[t.audience].toLowerCase().includes(q)
      );
    });
  }, [query, showAllChannels, channel]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 gap-0 z-[10001]">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/50 shrink-0">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Ready-made templates
          </DialogTitle>
          <DialogDescription className="text-xs">
            Click <strong>Use</strong> to drop the template straight into your script, or <strong>Use & edit</strong> to
            tweak the wording. Square-bracket fields like <code className="text-[11px]">[DAY]</code> are placeholders
            you fill in. <code className="text-[11px]">(pause)</code> markers are natural breath-points the AI voice will respect.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-3 border-b border-border/50 shrink-0 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates by name, audience or purpose…"
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant={showAllChannels ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => setShowAllChannels((v) => !v)}
          >
            {showAllChannels ? "Showing all channels" : `Only ${channel}`}
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4 space-y-3">
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">
                No templates match. Try clearing the search or toggling channel filter.
              </p>
            )}
            {filtered.map((tpl) => {
              const Icon = CHANNEL_ICON[tpl.channel];
              return (
                <div
                  key={tpl.id}
                  className="rounded-lg border border-border/60 bg-card p-3 space-y-2 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium">{tpl.name}</span>
                        <Badge className={cn("text-[10px]", AUDIENCE_COLORS[tpl.audience])}>
                          {AUDIENCE_LABELS[tpl.audience]}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">{tpl.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] gap-1"
                        onClick={() => onApply(tpl, "edit")}
                        title="Apply this template and stay in the editor to tweak it"
                      >
                        Use & edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-[11px] gap-1"
                        onClick={() => onApply(tpl, "use")}
                        title="Apply this template ready to save"
                      >
                        <Check className="w-3 h-3" /> Use
                      </Button>
                    </div>
                  </div>
                  {/* Mini preview */}
                  <div className="rounded-md bg-muted/40 border border-border/40 p-2 max-h-32 overflow-hidden">
                    {tpl.channel === "email" && (
                      <>
                        <p className="text-[10px] text-muted-foreground">Subject</p>
                        <p className="text-xs font-medium truncate">{tpl.subject}</p>
                        <p className="text-[10px] text-muted-foreground mt-1.5">Body</p>
                        <pre className="text-[11px] whitespace-pre-wrap font-sans text-muted-foreground line-clamp-3">
                          {tpl.body}
                        </pre>
                      </>
                    )}
                    {tpl.channel === "sms" && (
                      <pre className="text-[11px] whitespace-pre-wrap font-sans text-muted-foreground">
                        {tpl.body}
                      </pre>
                    )}
                    {tpl.channel === "call" && (
                      <pre className="text-[11px] whitespace-pre-wrap font-sans text-muted-foreground line-clamp-3">
                        {tpl.call_blocks?.[0]?.content}
                      </pre>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}