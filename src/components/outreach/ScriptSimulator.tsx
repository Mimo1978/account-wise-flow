import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronRight, ChevronDown, User, Briefcase, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  resolveTemplate,
  DEFAULT_SIMULATOR_CONTEXT,
  SimulatorContext,
  ScriptChannel,
  CallBlock,
  checkGuardrails,
  DEFAULT_GUARDRAILS,
} from "@/lib/script-types";
import { cn } from "@/lib/utils";

interface Props {
  body: string;
  callBlocks?: CallBlock[];
  subject?: string;
  channel: ScriptChannel;
  agencyName?: string;
}

export function ScriptSimulator({ body, callBlocks, subject, channel, agencyName }: Props) {
  const [ctx, setCtx] = useState<SimulatorContext>(() => ({
    ...DEFAULT_SIMULATOR_CONTEXT,
    agency: { name: agencyName || DEFAULT_SIMULATOR_CONTEXT.agency.name },
  }));
  // Keep simulator agency in sync when the agency input above the modal changes
  useEffect(() => {
    if (agencyName == null) return;
    setCtx((prev) => ({ ...prev, agency: { name: agencyName || prev.agency.name } }));
  }, [agencyName]);
  const [activeCallBlock, setActiveCallBlock] = useState<string | null>(
    callBlocks?.[0]?.id ?? null
  );

  const update = (path: string, value: string) => {
    setCtx((prev) => {
      const parts = path.split(".");
      if (parts.length === 2) {
        const [section, field] = parts;
        return {
          ...prev,
          [section]: {
            ...(prev[section as keyof SimulatorContext] as Record<string, string>),
            [field]: value,
          },
        } as SimulatorContext;
      }
      return prev;
    });
  };

  const resolvedSubject = subject ? resolveTemplate(subject, ctx) : "";
  const resolvedBody = channel !== "call" ? resolveTemplate(body, ctx) : "";
  const resolvedBlocks = callBlocks?.map((b) => ({
    ...b,
    resolved: resolveTemplate(b.content, ctx),
    branches: b.branches?.map((br) => ({
      ...br,
      resolved: resolveTemplate(br.response, ctx),
    })),
  }));

  // Check any unresolved placeholders
  const unresolvedRegex = /\{\{[^}]+\}\}/g;
  const unresolvedVars = new Set<string>();
  const effectiveText = channel === "call"
    ? (resolvedBlocks ?? []).map((b) => b.resolved).join("\n")
    : resolvedBody;
  const matches = effectiveText.match(unresolvedRegex) ?? [];
  matches.forEach((m) => unresolvedVars.add(m));

  // Re-run guardrails on the resolved body
  const violations = checkGuardrails(effectiveText, channel, DEFAULT_GUARDRAILS);

  return (
    <div className="flex gap-4 h-full py-4 min-h-0">
      {/* Left: context editor */}
      <div className="w-[260px] shrink-0 flex flex-col gap-0">
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
          Sample Context
        </p>
        <ScrollArea className="flex-1 pr-1">
          <div className="space-y-3">
            <ContextSection title="Candidate" icon={<User className="w-3 h-3" />}>
              <CtxField label="First Name" value={ctx.candidate.first_name} onChange={(v) => update("candidate.first_name", v)} />
              <CtxField label="Full Name" value={ctx.candidate.full_name} onChange={(v) => update("candidate.full_name", v)} />
              <CtxField label="Title" value={ctx.candidate.current_title} onChange={(v) => update("candidate.current_title", v)} />
              <CtxField label="Company" value={ctx.candidate.current_company} onChange={(v) => update("candidate.current_company", v)} />
              <CtxField label="Location" value={ctx.candidate.location} onChange={(v) => update("candidate.location", v)} />
              <CtxField label="Skills" value={ctx.candidate.skills} onChange={(v) => update("candidate.skills", v)} />
              <CtxField label="Availability" value={ctx.candidate.availability} onChange={(v) => update("candidate.availability", v)} />
            </ContextSection>

            <ContextSection title="Job" icon={<Briefcase className="w-3 h-3" />}>
              <CtxField label="Title" value={ctx.job.title} onChange={(v) => update("job.title", v)} />
              <CtxField label="Company" value={ctx.job.company} onChange={(v) => update("job.company", v)} />
              <CtxField label="Location" value={ctx.job.location} onChange={(v) => update("job.location", v)} />
              <CtxField label="Rate" value={ctx.job.rate} onChange={(v) => update("job.rate", v)} />
              <CtxField label="Type" value={ctx.job.type} onChange={(v) => update("job.type", v)} />
            </ContextSection>

            <ContextSection title="Recruiter">
              <CtxField label="Name" value={ctx.recruiter.name} onChange={(v) => update("recruiter.name", v)} />
              <CtxField label="Phone" value={ctx.recruiter.phone} onChange={(v) => update("recruiter.phone", v)} />
            </ContextSection>

            <ContextSection title="Agency">
              <CtxField label="Name" value={ctx.agency?.name ?? ""} onChange={(v) => update("agency.name", v)} />
            </ContextSection>

            <ContextSection title="Campaign">
              <CtxField label="Name" value={ctx.campaign.name} onChange={(v) => update("campaign.name", v)} />
            </ContextSection>
          </div>
        </ScrollArea>
      </div>

      <Separator orientation="vertical" className="h-full" />

      {/* Right: rendered output */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Rendered Output
          </p>
          <div className="flex items-center gap-2">
            {unresolvedVars.size > 0 && (
              <Badge variant="outline" className="gap-1 text-xs border-amber-500 text-amber-600">
                <AlertTriangle className="w-3 h-3" />
                {unresolvedVars.size} unresolved
              </Badge>
            )}
            {violations.length > 0 && (
              <Badge variant="outline" className="gap-1 text-xs border-destructive text-destructive">
                <AlertTriangle className="w-3 h-3" />
                {violations.length} guardrail{violations.length > 1 ? "s" : ""}
              </Badge>
            )}
            {unresolvedVars.size === 0 && violations.length === 0 && (
              <Badge variant="outline" className="gap-1 text-xs border-green-500 text-green-600">
                <CheckCircle2 className="w-3 h-3" /> All clear
              </Badge>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 pr-1">
          {channel === "email" && (
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
              {resolvedSubject && (
                <div className="px-4 py-2.5 border-b border-border/40 bg-muted/30">
                  <p className="text-xs text-muted-foreground">Subject</p>
                  <p className="text-sm font-medium mt-0.5">{resolvedSubject}</p>
                </div>
              )}
              <div className="px-4 py-4">
                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                  {renderHighlighted(resolvedBody, unresolvedVars)}
                </pre>
              </div>
            </div>
          )}

          {channel === "sms" && (
            <div className="max-w-xs">
              <div className="bg-primary text-primary-foreground rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed">
                <pre className="whitespace-pre-wrap font-sans">
                  {renderHighlighted(resolvedBody, unresolvedVars)}
                </pre>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {resolvedBody.length} characters
                {resolvedBody.length > 160 && (
                  <span className="text-destructive ml-1">— will split into multiple SMS</span>
                )}
              </p>
            </div>
          )}

          {channel === "call" && resolvedBlocks && (
            <div className="space-y-2">
              {resolvedBlocks.map((block, idx) => (
                <div
                  key={block.id}
                  className={cn(
                    "rounded-lg border overflow-hidden cursor-pointer transition-colors",
                    activeCallBlock === block.id
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/50 bg-card hover:border-border"
                  )}
                >
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 text-left"
                    onClick={() =>
                      setActiveCallBlock((p) => (p === block.id ? null : block.id))
                    }
                  >
                    <span className="w-5 h-5 rounded-full bg-muted text-[10px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-medium flex-1">{block.title}</span>
                    {activeCallBlock === block.id ? (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </button>
                  {activeCallBlock === block.id && (
                    <div className="px-4 pb-3 pt-1 border-t border-border/40 space-y-3">
                      <div className="bg-muted/40 rounded p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 font-semibold">
                          Recruiter says:
                        </p>
                        <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                          {renderHighlighted(block.resolved, unresolvedVars)}
                        </pre>
                      </div>
                      {block.branches && block.branches.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
                            If candidate says:
                          </p>
                          {block.branches.map((br) => (
                            <div
                              key={br.id}
                              className="flex items-start gap-2 text-xs rounded border border-border/40 px-2 py-1.5"
                            >
                              <span className="font-medium text-foreground shrink-0 pt-px">
                                "{br.label}"
                              </span>
                              <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                              <span className="text-muted-foreground">{br.resolved || br.response}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Violations */}
          {violations.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Guardrail hits on rendered output
              </p>
              {violations.map((v, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded border px-3 py-2 text-xs flex items-start gap-2",
                    v.rule.severity === "error"
                      ? "border-destructive/40 bg-destructive/5 text-destructive"
                      : "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400"
                  )}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  <span>
                    <span className="font-medium">{v.rule.label}: </span>
                    matched <code className="bg-muted px-1 rounded">"{v.matchedText}"</code>
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ContextSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 w-full"
        onClick={() => setOpen((p) => !p)}
      >
        {icon}
        {title}
        {open ? <ChevronDown className="w-3 h-3 ml-auto" /> : <ChevronRight className="w-3 h-3 ml-auto" />}
      </button>
      {open && <div className="space-y-1.5">{children}</div>}
    </div>
  );
}

function CtxField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-[10px] w-20 shrink-0 text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 text-[11px] px-2 flex-1"
      />
    </div>
  );
}

function renderHighlighted(text: string, unresolved: Set<string>): React.ReactNode {
  if (unresolved.size === 0) return text;
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  return parts.map((part, i) =>
    unresolved.has(part) ? (
      <span key={i} className="bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 rounded px-0.5">
        {part}
      </span>
    ) : (
      part
    )
  );
}
