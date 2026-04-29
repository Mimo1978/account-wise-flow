import { Calendar, UserCheck, Clock, DollarSign, FileText, CalendarCheck, Briefcase, Lightbulb } from "lucide-react";
import type { CallBlock } from "@/lib/script-types";

/**
 * Goal-oriented ready-made conversational templates for AI-voice / human call scripts.
 * Each template returns a full set of CallBlocks (intro → permission → questions → close)
 * written in a turn-by-turn, AI-agent-friendly conversational style with merge-tags.
 *
 * Buttons are colour-coded so the user can quickly recognise the goal at a glance.
 */
export interface CallGoalTemplate {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Tailwind classes — colour-coded per goal so they are easy to scan. */
  colorClass: string;
  build: () => CallBlock[];
}

const mkId = (suffix: string) => `block-${Date.now()}-${suffix}-${Math.random().toString(36).slice(2, 6)}`;

export const CALL_GOAL_TEMPLATES: CallGoalTemplate[] = [
  {
    id: "book-meeting",
    label: "Book a meeting",
    description: "Set up a discovery / intro meeting with the user to discuss the opportunity.",
    icon: Calendar,
    colorClass:
      "bg-blue-500/15 text-blue-300 border-blue-500/40 hover:bg-blue-500/25 hover:border-blue-400",
    build: () => [
      {
        id: mkId("intro"),
        type: "intro",
        title: "Introduction",
        content:
          "Hi {{candidate.first_name}}, this is {{recruiter.name}} from {{agency.name}}. Have I caught you at an okay time for a quick two-minute chat?",
      },
      {
        id: mkId("perm"),
        type: "permission",
        title: "Reason for the call",
        content:
          "Brilliant. I'm reaching out because I'd love to set up a short meeting between you and {{recruiter.name}} to walk you through an opportunity I think will genuinely interest you. Would you be open to that?",
        branches: [
          { id: "yes", label: "Yes / interested", response: "Move to availability check" },
          { id: "no", label: "Not right now", response: "Offer to email details and try again later" },
        ],
      },
      {
        id: mkId("avail"),
        type: "questions",
        title: "Check availability",
        content:
          "Great. The meeting will be about 20 minutes, by phone or video — whichever you prefer. What does the rest of your week look like? I have a couple of slots free, would mornings or afternoons work better for you?",
      },
      {
        id: mkId("close"),
        type: "close",
        title: "Confirm & close",
        content:
          "Perfect — I'll send a calendar invite to your email with a short agenda so you know what to expect. Could you confirm the best email address for the invite? Thanks {{candidate.first_name}}, looking forward to it.",
      },
    ],
  },
  {
    id: "book-interview",
    label: "Book an interview",
    description: "Arrange an interview for a specific job (uses linked job title / company).",
    icon: UserCheck,
    colorClass:
      "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25 hover:border-emerald-400",
    build: () => [
      {
        id: mkId("intro"),
        type: "intro",
        title: "Introduction",
        content:
          "Hi {{candidate.first_name}}, this is {{recruiter.name}} from {{agency.name}} — do you have two minutes to talk through some good news on the {{job.title}} role at {{job.company}}?",
      },
      {
        id: mkId("perm"),
        type: "permission",
        title: "Reason for the call",
        content:
          "{{job.company}} would like to invite you to interview for the {{job.title}} position. Are you still keen to move forward?",
        branches: [
          { id: "yes", label: "Yes — keen", response: "Discuss interview format and availability" },
          { id: "no", label: "Withdrawing", response: "Thank politely and update record" },
        ],
      },
      {
        id: mkId("avail"),
        type: "questions",
        title: "Interview format & availability",
        content:
          "The interview will be roughly {{job.interview_duration}} minutes, with {{job.interviewer_name}}. It can be done by video or onsite. What does your diary look like over the next few days — any times that absolutely don't work?",
      },
      {
        id: mkId("close"),
        type: "close",
        title: "Confirm & next steps",
        content:
          "Perfect. I'll lock that in and send you a confirmation email with the joining link, the interviewer's profile and a short prep guide. Anything specific you'd like me to find out beforehand?",
      },
    ],
  },
  {
    id: "availability",
    label: "Check availability",
    description: "Find out when the candidate is next available to talk / interview.",
    icon: CalendarCheck,
    colorClass:
      "bg-cyan-500/15 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/25 hover:border-cyan-400",
    build: () => [
      {
        id: mkId("intro"),
        type: "intro",
        title: "Introduction",
        content:
          "Hi {{candidate.first_name}}, it's {{recruiter.name}} from {{agency.name}} — sorry to call out of the blue, are you free to talk for a minute?",
      },
      {
        id: mkId("perm"),
        type: "permission",
        title: "Reason for the call",
        content:
          "I'm trying to line up a quick conversation with {{recruiter.name}} about a role that fits your background. I just need to grab a couple of times that work for you — is that okay?",
      },
      {
        id: mkId("avail"),
        type: "questions",
        title: "Availability",
        content:
          "When are you typically free to take a 15-minute call — mornings, lunchtimes or evenings? And which days this week or next would work best for you?",
      },
      {
        id: mkId("close"),
        type: "close",
        title: "Close",
        content:
          "Brilliant, I've noted those down. I'll send a calendar invite shortly to confirm. Could I just double-check the best mobile number and email to use? Thanks {{candidate.first_name}}.",
      },
    ],
  },
  {
    id: "rates-salary",
    label: "Rate / salary expectations",
    description: "Ask about current package and target rate or salary.",
    icon: DollarSign,
    colorClass:
      "bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25 hover:border-amber-400",
    build: () => [
      {
        id: mkId("intro"),
        type: "intro",
        title: "Introduction",
        content:
          "Hi {{candidate.first_name}}, {{recruiter.name}} here from {{agency.name}}. Quick one — do you have a couple of minutes?",
      },
      {
        id: mkId("perm"),
        type: "permission",
        title: "Reason for the call",
        content:
          "I'm shortlisting for a {{job.title}} role at {{job.company}} and before I put you forward I just want to make sure we're aligned on package. Happy to talk numbers briefly?",
      },
      {
        id: mkId("rate"),
        type: "questions",
        title: "Rate / salary discovery",
        content:
          "Could you share what you're on currently — base, bonus and any benefits? And what would your target be to make a move worthwhile? For contract roles, what's your day rate expectation, inside or outside IR35?",
      },
      {
        id: mkId("close"),
        type: "close",
        title: "Close",
        content:
          "Thanks for being open about that — really helpful. I'll come back to you within 24 hours to confirm whether we're aligned and what the next step looks like. Speak soon.",
      },
    ],
  },
  {
    id: "notice-period",
    label: "Notice period",
    description: "Confirm contractual notice period and earliest start date.",
    icon: Clock,
    colorClass:
      "bg-violet-500/15 text-violet-300 border-violet-500/40 hover:bg-violet-500/25 hover:border-violet-400",
    build: () => [
      {
        id: mkId("intro"),
        type: "intro",
        title: "Introduction",
        content:
          "Hi {{candidate.first_name}}, this is {{recruiter.name}} at {{agency.name}}. Have you got a quick moment?",
      },
      {
        id: mkId("perm"),
        type: "permission",
        title: "Reason for the call",
        content:
          "I'd like to put you forward for the {{job.title}} role at {{job.company}}, and the client will ask about your availability — can I check a couple of details with you?",
      },
      {
        id: mkId("notice"),
        type: "questions",
        title: "Notice & start date",
        content:
          "What's your contractual notice period at the moment? Is there any flexibility on that — for example garden leave or buy-out? And realistically, what's the earliest start date you could commit to?",
      },
      {
        id: mkId("close"),
        type: "close",
        title: "Close",
        content:
          "Thanks {{candidate.first_name}} — that gives me what I need. I'll feed that back to the client and come back to you with the next step. Have a great day.",
      },
    ],
  },
  {
    id: "request-cv",
    label: "Request updated CV",
    description: "Politely ask for an updated CV before submission.",
    icon: FileText,
    colorClass:
      "bg-rose-500/15 text-rose-300 border-rose-500/40 hover:bg-rose-500/25 hover:border-rose-400",
    build: () => [
      {
        id: mkId("intro"),
        type: "intro",
        title: "Introduction",
        content:
          "Hi {{candidate.first_name}}, it's {{recruiter.name}} from {{agency.name}}. Have you got a quick minute?",
      },
      {
        id: mkId("perm"),
        type: "permission",
        title: "Reason for the call",
        content:
          "I'm preparing your profile for the {{job.title}} role at {{job.company}} and I want to make sure you're presented in the best possible light. Could I ask a small favour?",
      },
      {
        id: mkId("cv"),
        type: "questions",
        title: "Request CV",
        content:
          "Would you be able to send me an updated copy of your CV — ideally in Word format — including your most recent role, key achievements and any certifications? If easier, you can email it to {{recruiter.email}}.",
      },
      {
        id: mkId("close"),
        type: "close",
        title: "Close",
        content:
          "Brilliant, thank you. As soon as that arrives I'll review it and come back to you with submission confirmation and timelines. Really appreciate it {{candidate.first_name}}.",
      },
    ],
  },
  {
    id: "qualify-opportunity",
    label: "Qualify opportunity",
    description: "Open conversation to qualify interest and motivation in any opportunity.",
    icon: Briefcase,
    colorClass:
      "bg-indigo-500/15 text-indigo-300 border-indigo-500/40 hover:bg-indigo-500/25 hover:border-indigo-400",
    build: () => [
      {
        id: mkId("intro"),
        type: "intro",
        title: "Introduction",
        content:
          "Hi {{candidate.first_name}}, this is {{recruiter.name}} from {{agency.name}}. Got a couple of minutes for a quick chat?",
      },
      {
        id: mkId("perm"),
        type: "permission",
        title: "Reason for the call",
        content:
          "I came across your background and thought of an opportunity that looks like a strong fit. Would you be open to hearing a little more about it?",
      },
      {
        id: mkId("qual"),
        type: "questions",
        title: "Qualifying questions",
        content:
          "Before I share the details, can I ask — are you actively looking right now or just open to the right thing? What's most important to you in your next move — money, progression, tech, flexibility? And is there anywhere you definitely wouldn't consider?",
      },
      {
        id: mkId("close"),
        type: "close",
        title: "Close",
        content:
          "Really helpful, thank you. I'll pull together a one-pager on the role and email it across so you can review in your own time. Speak soon {{candidate.first_name}}.",
      },
    ],
  },
  {
    id: "pitch-proposal",
    label: "Pitch proposal / product",
    description: "Introduce a product, proposal or investment and gauge interest.",
    icon: Lightbulb,
    colorClass:
      "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40 hover:bg-fuchsia-500/25 hover:border-fuchsia-400",
    build: () => [
      {
        id: mkId("intro"),
        type: "intro",
        title: "Introduction",
        content:
          "Hi {{candidate.first_name}}, this is {{recruiter.name}} from {{agency.name}}. Have I caught you at an okay time?",
      },
      {
        id: mkId("perm"),
        type: "permission",
        title: "Reason for the call",
        content:
          "I'm reaching out because I think there's something genuinely worth your time — it's a proposal that's helped people in a similar position to you. Mind if I take 60 seconds to explain?",
      },
      {
        id: mkId("discover"),
        type: "questions",
        title: "Discovery",
        content:
          "Before I dive in — what's currently working well for you in this area, and where do you feel there's room to improve? That way I can tailor what I share to what's actually useful.",
      },
      {
        id: mkId("close"),
        type: "close",
        title: "Close",
        content:
          "Great — based on that, the natural next step would be a 20-minute follow-up where I can show you exactly how it works. Would later this week or early next suit you better?",
      },
    ],
  },
];

interface Props {
  /** Called with a fresh array of blocks built from the chosen template. */
  onApply: (blocks: CallBlock[], template: CallGoalTemplate) => void;
  className?: string;
}

export function CallGoalTemplates({ onApply, className }: Props) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs font-medium text-foreground">Quick goal templates</p>
          <p className="text-[11px] text-muted-foreground">
            One click to load a ready-made AI-friendly script — then edit to make it your own.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CALL_GOAL_TEMPLATES.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onApply(t.build(), t)}
              title={t.description}
              className={
                "inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-full border transition-colors " +
                t.colorClass
              }
            >
              <Icon className="w-3 h-3" />
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}