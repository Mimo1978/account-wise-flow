import { Check, Users, FileText, Link2, Rocket, ChevronRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CampaignSetupStep {
  id: "targets" | "script" | "assign" | "launch";
  label: string;
  hint: string;
  done: boolean;
  icon: React.ComponentType<{ className?: string }>;
  ctaLabel: string;
  onCta: () => void;
}

interface Props {
  channel: "email" | "sms" | "call";
  targetCount: number;
  queuedCount: number;
  scriptCount: number;
  scriptAssigned: boolean;
  isLaunching: boolean;
  onAddTargets: () => void;
  onCreateScript: () => void;
  onAssignScript: () => void;
  onLaunch: () => void;
}

export function CampaignSetupGuide({
  channel,
  targetCount,
  queuedCount,
  scriptCount,
  scriptAssigned,
  isLaunching,
  onAddTargets,
  onCreateScript,
  onAssignScript,
  onLaunch,
}: Props) {
  const channelLabel = channel === "email" ? "Email" : channel === "sms" ? "SMS" : "Call";

  const steps: CampaignSetupStep[] = [
    {
      id: "targets",
      label: "Add targets",
      hint:
        targetCount === 0
          ? "Pick candidates or contacts from your talent pool to contact."
          : `${targetCount} target${targetCount !== 1 ? "s" : ""} added.`,
      done: targetCount > 0,
      icon: Users,
      ctaLabel: targetCount === 0 ? "Add Targets" : "Add More",
      onCta: onAddTargets,
    },
    {
      id: "script",
      label: `Write a ${channelLabel.toLowerCase()} script`,
      hint:
        scriptCount === 0
          ? `Build the ${channelLabel} script your AI agent will use.`
          : `${scriptCount} script${scriptCount !== 1 ? "s" : ""} available.`,
      done: scriptCount > 0,
      icon: FileText,
      ctaLabel: scriptCount === 0 ? "New Script" : "Edit Scripts",
      onCta: onCreateScript,
    },
    {
      id: "assign",
      label: `Assign ${channelLabel} script to campaign`,
      hint: scriptAssigned
        ? `${channelLabel} script linked to this campaign.`
        : `Pick which script this campaign should use for ${channelLabel}. Required to launch.`,
      done: scriptAssigned,
      icon: Link2,
      ctaLabel: scriptAssigned ? "Change" : "Assign Script",
      onCta: onAssignScript,
    },
    {
      id: "launch",
      label: "Launch outreach",
      hint:
        queuedCount === 0
          ? "All queued targets will be contacted."
          : `Send ${channelLabel} to ${queuedCount} queued target${queuedCount !== 1 ? "s" : ""}.`,
      done: false,
      icon: Rocket,
      ctaLabel: isLaunching ? "Launching…" : `Launch All${queuedCount > 0 ? ` (${queuedCount})` : ""}`,
      onCta: onLaunch,
    },
  ];

  // Active step = first non-done step
  const activeIdx = steps.findIndex((s) => !s.done);
  const completedCount = steps.filter((s) => s.done).length;
  const totalForProgress = steps.length - 1; // launch is the final action, not "done"
  const pct = Math.min(100, Math.round((completedCount / totalForProgress) * 100));

  const launchBlocked = !scriptAssigned || queuedCount === 0;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 mb-4" data-jarvis-id="campaign-setup-guide">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Campaign Setup Guide</h3>
          <p className="text-[11px] text-muted-foreground">
            Follow these {steps.length} steps to launch your automated {channelLabel.toLowerCase()} campaign.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] text-muted-foreground">
            {completedCount}/{totalForProgress} ready
          </p>
          <div className="w-32 h-1.5 rounded-full bg-muted overflow-hidden mt-1">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = idx === activeIdx;
          const isLaunchStep = step.id === "launch";
          const isDisabled = isLaunchStep && launchBlocked;

          return (
            <div
              key={step.id}
              className={cn(
                "relative rounded-lg border p-3 flex flex-col gap-2 transition-colors",
                step.done
                  ? "border-primary/40 bg-primary/5"
                  : isActive
                  ? "border-primary bg-primary/[0.08] ring-1 ring-primary/30"
                  : "border-border/60 bg-background"
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0",
                    step.done
                      ? "bg-primary text-primary-foreground"
                      : isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {step.done ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                </div>
                <Icon className={cn("w-3.5 h-3.5", isActive ? "text-primary" : "text-muted-foreground")} />
                <span className="text-xs font-medium truncate">{step.label}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug min-h-[28px]">
                {step.hint}
              </p>
              {isLaunchStep && launchBlocked && (
                <div className="flex items-start gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>
                    {!scriptAssigned
                      ? `Assign a ${channelLabel} script first.`
                      : "No queued targets."}
                  </span>
                </div>
              )}
              <Button
                size="sm"
                variant={isActive || isLaunchStep ? "default" : "outline"}
                className="h-7 text-xs gap-1 mt-auto"
                onClick={step.onCta}
                disabled={isLaunchStep && (isDisabled || isLaunching)}
              >
                {step.ctaLabel}
                {!isLaunchStep && <ChevronRight className="w-3 h-3" />}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
