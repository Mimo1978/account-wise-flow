import { useState, useMemo } from "react";
import { Check, ChevronRight, ArrowRight, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getWorkflowStages, getStageIndex, type WorkflowStage } from "@/lib/project-workflows";
import { useProjectStageEvents, useAdvanceProjectStage } from "@/hooks/use-project-workflow";
import { StageTransitionPanel } from "./StageTransitionPanel";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

interface CompletedStageEntry {
  stage: string;
  completed_at: string;
}

interface Props {
  projectId: string;
  projectType: string | null | undefined;
  workflowStage: string | null | undefined;
  workflowCompletedStages: CompletedStageEntry[] | null | undefined;
  workflowStartedAt: string | null | undefined;
  workspaceId: string;
  compact?: boolean;
  onStageAdvanced?: () => void;
}

export function ProjectWorkflowTracker({
  projectId,
  projectType,
  workflowStage,
  workflowCompletedStages,
  workflowStartedAt,
  workspaceId,
  compact = false,
  onStageAdvanced,
}: Props) {
  const stages = getWorkflowStages(projectType);
  const { data: stageEvents = [] } = useProjectStageEvents(projectId);
  const advanceMut = useAdvanceProjectStage();
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [targetStage, setTargetStage] = useState<WorkflowStage | null>(null);

  const completedStages = useMemo(() => workflowCompletedStages ?? [], [workflowCompletedStages]);
  const completedSet = useMemo(() => new Set(completedStages.map(c => c.stage)), [completedStages]);
  const currentIdx = workflowStage ? stages.findIndex(s => s.id === workflowStage) : -1;
  const nextStage = currentIdx >= 0 && currentIdx < stages.length - 1 ? stages[currentIdx + 1] : null;

  // Duration in current stage
  const currentEvent = stageEvents.find(e => e.stage_name === workflowStage && !e.stage_completed_at);
  const daysInStage = currentEvent ? differenceInDays(new Date(), new Date(currentEvent.stage_entered_at)) : 0;

  const handleNodeClick = (stage: WorkflowStage, idx: number) => {
    if (stage.id === workflowStage) {
      // Current stage — open transition to next
      if (nextStage) {
        setTargetStage(nextStage);
        setTransitionOpen(true);
      }
    } else if (idx > currentIdx && !completedSet.has(stage.id)) {
      // Future stage — allow jumping forward
      setTargetStage(stage);
      setTransitionOpen(true);
    }
    // Completed stages show tooltip only
  };

  const handleStartTracking = () => {
    if (stages.length > 0) {
      setTargetStage(stages[0]);
      setTransitionOpen(true);
    }
  };

  const getCompletionInfo = (stageId: string) => {
    const entry = completedStages.find(c => c.stage === stageId);
    const event = stageEvents.find(e => e.stage_name === stageId && e.stage_completed_at);
    return {
      date: entry?.completed_at ? format(new Date(entry.completed_at), "dd MMM") : null,
      notes: event?.notes,
    };
  };

  if (!workflowStage) {
    return (
      <div
        className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center"
        data-jarvis-id="project-workflow-tracker"
      >
        <p className="text-sm text-muted-foreground mb-3">
          Set your starting stage to begin tracking this project →
        </p>
        <div className="flex items-center justify-center gap-1 mb-4 overflow-x-auto pb-2">
          {stages.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div
                className="w-3 h-3 rounded-full border-2 border-muted-foreground/30"
                style={{ borderColor: s.colour + '40' }}
              />
              {i < stages.length - 1 && (
                <div className="w-6 h-[2px] bg-muted-foreground/20" />
              )}
            </div>
          ))}
        </div>
        <Button size="sm" variant="default" onClick={handleStartTracking} className="gap-1.5">
          <Play className="w-3.5 h-3.5" /> Start Tracking
        </Button>
        <StageTransitionPanel
          open={transitionOpen}
          onOpenChange={setTransitionOpen}
          projectId={projectId}
          projectType={projectType || "other"}
          currentStage={null}
          targetStage={targetStage}
          completedStages={completedStages}
          workspaceId={workspaceId}
          onAdvanced={onStageAdvanced}
        />
      </div>
    );
  }

  return (
    <div data-jarvis-id="project-workflow-tracker">
      {/* Stage Track */}
      <div className="rounded-xl border border-border bg-card p-4 overflow-x-auto">
        <TooltipProvider delayDuration={200}>
          <div className="flex items-center min-w-max gap-0">
            {stages.map((stage, idx) => {
              const isCompleted = completedSet.has(stage.id);
              const isCurrent = stage.id === workflowStage;
              const isUpcoming = !isCompleted && !isCurrent;
              const info = isCompleted ? getCompletionInfo(stage.id) : null;

              return (
                <div key={stage.id} className="flex items-center" data-jarvis-id={`project-stage-${stage.id}`}>
                  {/* Node */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleNodeClick(stage, idx)}
                        className={cn(
                          "relative flex flex-col items-center gap-1.5 transition-all duration-200 group",
                          (isCurrent || (!isCompleted && idx > currentIdx)) && "cursor-pointer",
                          isCompleted && "cursor-default",
                        )}
                      >
                        {/* Circle */}
                        <div
                          className={cn(
                            "relative rounded-full flex items-center justify-center transition-all duration-300",
                            compact ? "w-7 h-7" : "w-9 h-9",
                            isCompleted && "shadow-sm",
                            isCurrent && "shadow-lg",
                            isUpcoming && "border-2 border-dashed",
                          )}
                          style={{
                            backgroundColor: isCompleted || isCurrent ? stage.colour : 'transparent',
                            borderColor: isUpcoming ? stage.colour + '40' : 'transparent',
                          }}
                        >
                          {isCompleted && <Check className={cn("text-white", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />}
                          {isCurrent && (
                            <>
                              <div className={cn("rounded-full bg-white", compact ? "w-2.5 h-2.5" : "w-3 h-3")} />
                              <div
                                className="absolute inset-0 rounded-full animate-ping opacity-30"
                                style={{ backgroundColor: stage.colour }}
                              />
                              <div
                                className="absolute -inset-1 rounded-full animate-pulse opacity-20"
                                style={{ backgroundColor: stage.colour }}
                              />
                            </>
                          )}
                          {isUpcoming && (
                            <div
                              className={cn("rounded-full", compact ? "w-2 h-2" : "w-2.5 h-2.5")}
                              style={{ backgroundColor: stage.colour + '30' }}
                            />
                          )}
                        </div>

                        {/* Label */}
                        <span
                          className={cn(
                            "text-[10px] font-medium whitespace-nowrap max-w-[70px] truncate",
                            isCurrent && "font-bold",
                            isUpcoming && "text-muted-foreground/60",
                            isCompleted && "text-muted-foreground",
                          )}
                          style={{ color: isCurrent ? stage.colour : undefined }}
                        >
                          {stage.label}
                        </span>

                        {/* Date for completed */}
                        {isCompleted && info?.date && !compact && (
                          <span className="text-[9px] text-muted-foreground">{info.date}</span>
                        )}
                        {isCurrent && !compact && (
                          <span className="text-[9px] font-semibold" style={{ color: stage.colour }}>ACTIVE</span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px]">
                      <p className="font-semibold text-xs">{stage.label}</p>
                      <p className="text-xs text-muted-foreground">{stage.description}</p>
                      {isCompleted && info?.date && <p className="text-xs mt-1">✓ Completed {info.date}</p>}
                      {isCompleted && info?.notes && <p className="text-xs text-muted-foreground italic mt-1">{info.notes}</p>}
                      {isCurrent && <p className="text-xs mt-1">In this stage for {daysInStage} day{daysInStage !== 1 ? 's' : ''}</p>}
                      {isUpcoming && idx > currentIdx && <p className="text-xs mt-1 text-primary">Click to advance here</p>}
                    </TooltipContent>
                  </Tooltip>

                  {/* Connector line */}
                  {idx < stages.length - 1 && (
                    <div
                      className={cn("h-[2px] transition-all", compact ? "w-6" : "w-10")}
                      style={{
                        backgroundColor:
                          isCompleted
                            ? stage.colour
                            : isCurrent
                              ? `${stage.colour}50`
                              : 'hsl(var(--border))',
                        ...(isUpcoming && !isCurrent
                          ? { backgroundImage: `repeating-linear-gradient(90deg, hsl(var(--border)) 0px, hsl(var(--border)) 4px, transparent 4px, transparent 8px)`, backgroundColor: 'transparent' }
                          : {}),
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      </div>

      {/* Stage info bar */}
      {!compact && (
        <div className="flex items-center justify-between mt-3 px-1">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {workflowStage && (
              <span>
                In <strong className="text-foreground" data-jarvis-id="project-current-stage">
                  {stages.find(s => s.id === workflowStage)?.label}
                </strong> for {daysInStage} day{daysInStage !== 1 ? 's' : ''}
              </span>
            )}
            {nextStage && (
              <span>
                Next: <strong>{nextStage.label}</strong>
              </span>
            )}
          </div>
          {nextStage && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1 text-primary hover:text-primary"
              onClick={() => { setTargetStage(nextStage); setTransitionOpen(true); }}
              data-jarvis-id="project-advance-stage-btn"
            >
              Advance Stage <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      )}

      <StageTransitionPanel
        open={transitionOpen}
        onOpenChange={setTransitionOpen}
        projectId={projectId}
        projectType={projectType || "other"}
        currentStage={workflowStage}
        targetStage={targetStage}
        completedStages={completedStages}
        workspaceId={workspaceId}
        onAdvanced={onStageAdvanced}
      />
    </div>
  );
}
