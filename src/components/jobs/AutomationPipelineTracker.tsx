import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  CheckCircle2, Play, Circle, XCircle, Loader2, ChevronDown, ChevronUp,
  FileCheck, Users, Globe, Send, MessageSquare, Calendar, TrendingUp, HelpCircle,
  RotateCcw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const db = supabase as any;

interface PipelineStep {
  number: number;
  name: string;
  label: string;
  icon: React.ElementType;
  description: string;
  gate?: string;
}

const PIPELINE_STEPS: PipelineStep[] = [
  { number: 1, name: 'spec_approval', label: 'Spec', icon: FileCheck, description: 'Job spec approved by recruiter', gate: undefined },
  { number: 2, name: 'shortlist', label: 'Shortlist', icon: Users, description: 'AI search + cascade shortlist', gate: 'User must approve shortlist' },
  { number: 3, name: 'posting', label: 'Posted', icon: Globe, description: 'Posted to connected job boards' },
  { number: 4, name: 'outreach', label: 'Outreach', icon: Send, description: 'Personalised messages to candidates', gate: 'User must approve templates' },
  { number: 5, name: 'responses', label: 'Replies', icon: MessageSquare, description: 'AI reads and triages candidate replies' },
  { number: 6, name: 'meetings', label: 'Meetings', icon: Calendar, description: 'Auto-book interviews into diary' },
  { number: 7, name: 'pipeline', label: 'Pipeline', icon: TrendingUp, description: 'Update deal stage and project' },
];

type StepStatus = 'complete' | 'running' | 'pending' | 'failed';

function getStepStatus(stepNum: number, currentStep: number, stepsCompleted: number[], stepsFailed: number[], pipelineStatus: string): StepStatus {
  if (stepsFailed.includes(stepNum)) return 'failed';
  if (stepsCompleted.includes(stepNum)) return 'complete';
  if (stepNum === currentStep && pipelineStatus === 'running') return 'running';
  return 'pending';
}

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'complete': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    case 'running': return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
    case 'failed': return <XCircle className="w-4 h-4 text-destructive" />;
    default: return <Circle className="w-4 h-4 text-muted-foreground/40" />;
  }
}

function StepConnector({ status }: { status: StepStatus }) {
  const color = status === 'complete' ? 'bg-emerald-500' : status === 'running' ? 'bg-primary animate-pulse' : 'bg-border';
  return <div className={`h-0.5 flex-1 ${color} transition-colors`} />;
}

interface Props {
  jobId: string;
  workspaceId: string;
  automationEnabled: boolean;
  specApproved?: boolean;
  shortlistLocked?: boolean;
}

export function AutomationPipelineTracker({ jobId, workspaceId, automationEnabled, specApproved, shortlistLocked }: Props) {
  const qc = useQueryClient();
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const { data: pipeline } = useQuery({
    queryKey: ['automation-pipeline', jobId],
    queryFn: async () => {
      const { data, error } = await db
        .from('automation_pipelines')
        .select('*')
        .eq('job_id', jobId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  const { data: steps = [] } = useQuery({
    queryKey: ['automation-steps', pipeline?.id],
    enabled: !!pipeline?.id,
    queryFn: async () => {
      const { data, error } = await db
        .from('automation_steps')
        .select('*')
        .eq('pipeline_id', pipeline.id)
        .order('step_number', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Derive status from pipeline data or job fields
  const currentStep = pipeline?.current_step || 0;
  const pipelineStatus = pipeline?.status || 'idle';
  const stepsCompleted: number[] = [];
  const stepsFailed: number[] = [];

  if (pipeline) {
    (pipeline.steps_completed || []).forEach((s: number) => stepsCompleted.push(s));
    (pipeline.steps_failed || []).forEach((s: number) => stepsFailed.push(s));
  } else {
    // Infer from job fields
    if (specApproved) stepsCompleted.push(1);
    if (shortlistLocked) stepsCompleted.push(2);
  }

  const handleToggleAutomation = useCallback(async (enabled: boolean) => {
    await db.from('jobs').update({ automation_enabled: enabled }).eq('id', jobId);
    qc.invalidateQueries({ queryKey: ['jobs', jobId] });
    toast.success(enabled ? 'Auto-advance enabled' : 'Auto-advance disabled');
  }, [jobId, qc]);

  const handleRunStep = useCallback(async (stepNum: number) => {
    // Ensure pipeline exists
    let pipelineId = pipeline?.id;
    if (!pipelineId) {
      const { data, error } = await db
        .from('automation_pipelines')
        .insert({ workspace_id: workspaceId, job_id: jobId, status: 'running', current_step: stepNum, started_at: new Date().toISOString() })
        .select('id')
        .single();
      if (error) { toast.error(error.message); return; }
      pipelineId = data.id;
    } else {
      await db.from('automation_pipelines').update({ current_step: stepNum, status: 'running' }).eq('id', pipelineId);
    }

    // Create or update the step
    await db.from('automation_steps').upsert({
      pipeline_id: pipelineId,
      step_number: stepNum,
      step_name: PIPELINE_STEPS[stepNum - 1].name,
      status: 'running',
      started_at: new Date().toISOString(),
    }, { onConflict: 'pipeline_id,step_number' });

    qc.invalidateQueries({ queryKey: ['automation-pipeline', jobId] });
    qc.invalidateQueries({ queryKey: ['automation-steps', pipelineId] });
    toast.info(`Step ${stepNum} triggered — ${PIPELINE_STEPS[stepNum - 1].label}`);
  }, [pipeline, jobId, workspaceId, qc]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Play className="w-4 h-4 text-primary" />
            Automation Pipeline
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="auto-advance" className="text-xs text-muted-foreground">Auto-advance</Label>
            <Switch
              id="auto-advance"
              checked={automationEnabled}
              onCheckedChange={handleToggleAutomation}
              className="scale-90"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Horizontal step track */}
        <div className="flex items-center gap-0">
          {PIPELINE_STEPS.map((s, idx) => {
            const status = getStepStatus(s.number, currentStep, stepsCompleted, stepsFailed, pipelineStatus);
            const isExpanded = expandedStep === s.number;
            const stepData = steps.find((st: any) => st.step_number === s.number);

            return (
              <div key={s.number} className="flex items-center flex-1 min-w-0">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="flex flex-col items-center gap-1 group cursor-pointer min-w-0"
                        onClick={() => setExpandedStep(isExpanded ? null : s.number)}
                      >
                        <StepIcon status={status} />
                        <span className={`text-[10px] font-medium truncate max-w-[60px] ${
                          status === 'complete' ? 'text-emerald-600 dark:text-emerald-400' :
                          status === 'running' ? 'text-primary' :
                          status === 'failed' ? 'text-destructive' :
                          'text-muted-foreground'
                        }`}>
                          {s.number} {s.label}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs max-w-[200px]">
                      <p className="font-medium">{s.label}</p>
                      <p className="text-muted-foreground">{s.description}</p>
                      {s.gate && <p className="text-amber-600 mt-1">⚠ {s.gate}</p>}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {idx < PIPELINE_STEPS.length - 1 && (
                  <StepConnector status={status === 'complete' ? 'complete' : 'pending'} />
                )}
              </div>
            );
          })}
        </div>

        {/* Expanded step detail */}
        {expandedStep && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-xs">
            {(() => {
              const s = PIPELINE_STEPS[expandedStep - 1];
              const status = getStepStatus(s.number, currentStep, stepsCompleted, stepsFailed, pipelineStatus);
              const stepData = steps.find((st: any) => st.step_number === s.number);
              return (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <s.icon className="w-4 h-4 text-primary" />
                      <span className="font-medium text-foreground">Step {s.number} — {s.label}</span>
                      <Badge variant="outline" className={`text-[10px] ${
                        status === 'complete' ? 'border-emerald-500/30 text-emerald-600' :
                        status === 'running' ? 'border-primary/30 text-primary' :
                        status === 'failed' ? 'border-destructive/30 text-destructive' :
                        ''
                      }`}>
                        {status}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      {status === 'pending' && (
                        <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={() => handleRunStep(s.number)}>
                          <Play className="w-3 h-3" /> Run Step
                        </Button>
                      )}
                      {status === 'failed' && (
                        <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={() => handleRunStep(s.number)}>
                          <RotateCcw className="w-3 h-3" /> Retry
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-muted-foreground">{s.description}</p>
                  {s.gate && <p className="text-amber-600">⚠ Gate: {s.gate}</p>}
                  {stepData?.error_message && (
                    <p className="text-destructive">Error: {stepData.error_message}</p>
                  )}
                  {stepData?.started_at && (
                    <p className="text-muted-foreground">Started: {new Date(stepData.started_at).toLocaleString()}</p>
                  )}
                  {stepData?.completed_at && (
                    <p className="text-muted-foreground">Completed: {new Date(stepData.completed_at).toLocaleString()}</p>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
