import { Check, Users, FileText, Link2, Rocket, ChevronRight, AlertCircle, Mail, MessageSquare, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ChannelKey = "email" | "sms" | "call";

export interface ChannelStatus {
  channel: ChannelKey;
  scriptCount: number;
  scriptAssigned: boolean;
}

interface Props {
  activeChannels: ChannelKey[];
  primaryChannel: ChannelKey;
  channelStatus: ChannelStatus[];
  targetCount: number;
  queuedCount: number;
  isLaunching: boolean;
  onAddTargets: () => void;
  onCreateScript: (channel: ChannelKey) => void;
  onAssignScript: (channel: ChannelKey) => void;
  onLaunch: () => void;
}

const CHANNEL_META: Record<ChannelKey, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  email: { label: "Email", icon: Mail },
  sms:   { label: "SMS",   icon: MessageSquare },
  call:  { label: "AI Call", icon: Phone },
};

export function CampaignSetupGuide({
  activeChannels,
  primaryChannel,
  channelStatus,
  targetCount,
  queuedCount,
  isLaunching,
  onAddTargets,
  onCreateScript,
  onAssignScript,
  onLaunch,
}: Props) {
  const channelsList = activeChannels
    .map((c) => channelStatus.find((s) => s.channel === c))
    .filter(Boolean) as ChannelStatus[];

  const allAssigned = channelsList.length > 0 && channelsList.every((c) => c.scriptAssigned);
  const targetsDone = targetCount > 0;

  const completed = (targetsDone ? 1 : 0) + (allAssigned ? 1 : 0);
  const totalForProgress = 2;
  const pct = Math.min(100, Math.round((completed / totalForProgress) * 100));

  const launchBlocked = !allAssigned || queuedCount === 0 || !targetsDone;
  const isMixed = activeChannels.length > 1;
  const channelLabel = (k: ChannelKey) => CHANNEL_META[k].label;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 mb-4" data-jarvis-id="campaign-setup-guide">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Campaign Setup Guide</h3>
          <p className="text-[11px] text-muted-foreground">
            {isMixed
              ? `Multi-touch sequence across ${channelsList.map((c) => CHANNEL_META[c.channel].label).join(" + ")}.`
              : `Single-channel ${channelLabel(activeChannels[0] ?? "email").toLowerCase()} campaign.`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] text-muted-foreground">{completed}/{totalForProgress} ready</p>
          <div className="w-32 h-1.5 rounded-full bg-muted overflow-hidden mt-1">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {/* Step 1 — Targets */}
        <StepCard
          index={1}
          done={targetsDone}
          icon={Users}
          label="Add targets"
          hint={
            targetsDone
              ? `${targetCount} target${targetCount !== 1 ? "s" : ""} added · ${queuedCount} queued.`
              : "Pick candidates or contacts to contact."
          }
        >
          <Button size="sm" variant={targetsDone ? "outline" : "default"} className="h-7 text-xs gap-1" onClick={onAddTargets}>
            {targetsDone ? "Add More" : "Add Targets"}
            <ChevronRight className="w-3 h-3" />
          </Button>
        </StepCard>

        {/* Step 2 — Scripts per channel */}
        <StepCard
          index={2}
          done={allAssigned}
          icon={FileText}
          label={isMixed ? `Prepare ${channelsList.length} scripts` : `Prepare ${channelLabel(activeChannels[0] ?? "email")} script`}
          hint={
            allAssigned
              ? "All channels have a script assigned."
              : "Write and assign one script per active channel."
          }
        >
          <div className="flex flex-col gap-1.5 w-full md:w-[440px]">
            {channelsList.map((c) => {
              const meta = CHANNEL_META[c.channel];
              const Icon = meta.icon;
              const isPrimary = c.channel === primaryChannel;
              return (
                <div key={c.channel} className="flex items-center gap-2 text-xs">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium min-w-[58px]">{meta.label}</span>
                  {isPrimary && isMixed && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-primary/15 text-primary uppercase tracking-wide">1st</span>
                  )}
                  {c.scriptAssigned ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-primary">
                      <Check className="w-3 h-3" /> assigned
                    </span>
                  ) : c.scriptCount === 0 ? (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400">no script yet</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">{c.scriptCount} available</span>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    {c.scriptCount === 0 ? (
                      <Button size="sm" variant="default" className="h-6 text-[11px] px-2 gap-1" onClick={() => onCreateScript(c.channel)}>
                        <FileText className="w-3 h-3" /> Write
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => onCreateScript(c.channel)}>
                          New
                        </Button>
                        <Button
                          size="sm"
                          variant={c.scriptAssigned ? "outline" : "default"}
                          className="h-6 text-[11px] px-2 gap-1"
                          onClick={() => onAssignScript(c.channel)}
                        >
                          <Link2 className="w-3 h-3" />
                          {c.scriptAssigned ? "Change" : "Assign"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </StepCard>

        {/* Step 3 — Launch */}
        <StepCard
          index={3}
          done={false}
          icon={Rocket}
          label="Launch outreach"
          hint={
            launchBlocked
              ? !targetsDone
                ? "Add targets first."
                : !allAssigned
                ? "Assign a script for every active channel first."
                : "No queued targets."
              : isMixed
              ? `Send ${channelsList.map((c) => CHANNEL_META[c.channel].label).join(" + ")} to ${queuedCount} queued target${queuedCount !== 1 ? "s" : ""}.`
              : `Send ${channelLabel(activeChannels[0])} to ${queuedCount} queued target${queuedCount !== 1 ? "s" : ""}.`
          }
        >
          {launchBlocked && (
            <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 mr-2">
              <AlertCircle className="w-3 h-3" />
              <span>blocked</span>
            </div>
          )}
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={onLaunch}
            disabled={launchBlocked || isLaunching}
          >
            <Rocket className="w-3 h-3" />
            {isLaunching ? "Launching…" : `Launch All${queuedCount > 0 ? ` (${queuedCount})` : ""}`}
          </Button>
        </StepCard>
      </div>
    </div>
  );
}

// ─── Step row helper ──────────────────────────────────────────────────────────

function StepCard({
  index,
  done,
  icon: Icon,
  label,
  hint,
  children,
}: {
  index: number;
  done: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 flex flex-col md:flex-row md:items-center gap-3 transition-colors",
        done ? "border-primary/40 bg-primary/5" : "border-border/60 bg-background"
      )}
    >
      <div className="flex items-center gap-2 min-w-0 md:min-w-[260px]">
        <div className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0",
          done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}>
          {done ? <Check className="w-3.5 h-3.5" /> : index}
        </div>
        <Icon className={cn("w-3.5 h-3.5 shrink-0", done ? "text-primary" : "text-muted-foreground")} />
        <div className="min-w-0">
          <p className="text-xs font-medium truncate">{label}</p>
          <p className="text-[11px] text-muted-foreground truncate">{hint}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 md:ml-auto flex-wrap">
        {children}
      </div>
    </div>
  );
}
