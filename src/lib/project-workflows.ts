export interface WorkflowStage {
  id: string;
  label: string;
  description: string;
  colour: string;
  icon: string;
}

export interface StageChecklist {
  label: string;
  hint?: string;
}

export const PROJECT_WORKFLOWS: Record<string, WorkflowStage[]> = {
  consulting: [
    { id: 'rfp', label: 'RFP / Brief', description: 'Received client brief or RFP', colour: '#6366F1', icon: 'FileText' },
    { id: 'proposal', label: 'Proposal', description: 'Writing and submitting proposal', colour: '#F59E0B', icon: 'PenTool' },
    { id: 'negotiation', label: 'Negotiation', description: 'Terms, pricing, scope alignment', colour: '#F97316', icon: 'MessageSquare' },
    { id: 'sow', label: 'SOW Signed', description: 'Statement of Work executed', colour: '#10B981', icon: 'CheckSquare' },
    { id: 'delivery', label: 'In Delivery', description: 'Active project delivery', colour: '#3B82F6', icon: 'Briefcase' },
    { id: 'review', label: 'Client Review', description: 'Awaiting client sign-off', colour: '#8B5CF6', icon: 'Eye' },
    { id: 'complete', label: 'Complete', description: 'Project closed and invoiced', colour: '#059669', icon: 'Award' },
  ],
  recruitment: [
    { id: 'brief', label: 'Brief Received', description: 'Client requirement confirmed', colour: '#6366F1', icon: 'Inbox' },
    { id: 'spec', label: 'Spec Written', description: 'Job specification approved', colour: '#F59E0B', icon: 'FileText' },
    { id: 'search', label: 'Search Live', description: 'Actively sourcing candidates', colour: '#F97316', icon: 'Search' },
    { id: 'shortlist', label: 'Shortlisted', description: 'Candidates shortlisted and sent', colour: '#3B82F6', icon: 'Users' },
    { id: 'interview_1', label: '1st Stage', description: 'First interviews in progress', colour: '#8B5CF6', icon: 'Calendar' },
    { id: 'interview_2', label: '2nd Stage', description: 'Second round interviews', colour: '#EC4899', icon: 'Calendar' },
    { id: 'offer', label: 'Offer Stage', description: 'Offer made, awaiting response', colour: '#F97316', icon: 'Gift' },
    { id: 'placed', label: 'Placed', description: 'Candidate accepted and placed', colour: '#10B981', icon: 'CheckCircle' },
    { id: 'invoiced', label: 'Invoiced', description: 'Placement fee invoiced', colour: '#059669', icon: 'DollarSign' },
  ],
  technology: [
    { id: 'scoping', label: 'Scoping', description: 'Requirements gathering', colour: '#6366F1', icon: 'Target' },
    { id: 'design', label: 'Design', description: 'Architecture and design phase', colour: '#F59E0B', icon: 'Layers' },
    { id: 'build', label: 'Build', description: 'Active development', colour: '#3B82F6', icon: 'Code' },
    { id: 'testing', label: 'Testing', description: 'QA and UAT', colour: '#8B5CF6', icon: 'CheckSquare' },
    { id: 'deployment', label: 'Deployment', description: 'Go-live and handover', colour: '#10B981', icon: 'Rocket' },
    { id: 'support', label: 'Support', description: 'Post-launch support period', colour: '#06B6D4', icon: 'Headphones' },
    { id: 'complete', label: 'Complete', description: 'Project closed', colour: '#059669', icon: 'Award' },
  ],
  legal: [
    { id: 'instruction', label: 'Instruction', description: 'Client instruction received', colour: '#6366F1', icon: 'FileText' },
    { id: 'review', label: 'Review', description: 'Document review phase', colour: '#F59E0B', icon: 'Eye' },
    { id: 'drafting', label: 'Drafting', description: 'Document drafting', colour: '#F97316', icon: 'PenTool' },
    { id: 'negotiation', label: 'Negotiation', description: 'Counter-party negotiation', colour: '#EC4899', icon: 'MessageSquare' },
    { id: 'execution', label: 'Execution', description: 'Signing and execution', colour: '#10B981', icon: 'CheckSquare' },
    { id: 'complete', label: 'Complete', description: 'Matter closed', colour: '#059669', icon: 'Award' },
  ],
  other: [
    { id: 'planning', label: 'Planning', description: 'Initial planning', colour: '#6366F1', icon: 'Target' },
    { id: 'active', label: 'Active', description: 'In progress', colour: '#3B82F6', icon: 'Play' },
    { id: 'review', label: 'Review', description: 'Under review', colour: '#8B5CF6', icon: 'Eye' },
    { id: 'complete', label: 'Complete', description: 'Completed', colour: '#059669', icon: 'Award' },
  ],
};

/** Get workflow stages for a project type (case-insensitive, defaults to 'other') */
export function getWorkflowStages(projectType: string | null | undefined): WorkflowStage[] {
  const key = (projectType || 'other').toLowerCase();
  return PROJECT_WORKFLOWS[key] || PROJECT_WORKFLOWS.other;
}

/** Get checklist items for a stage transition */
export function getTransitionChecklist(projectType: string, fromStage: string, toStage: string): StageChecklist[] {
  const key = `${projectType.toLowerCase()}:${fromStage}->${toStage}`;
  const checklists: Record<string, StageChecklist[]> = {
    'recruitment:search->shortlist': [
      { label: 'Job posted to at least one board' },
      { label: 'Internal search completed' },
      { label: 'At least 3 candidates shortlisted' },
    ],
    'recruitment:shortlist->interview_1': [
      { label: 'CVs sent to client' },
      { label: 'Client has confirmed which candidates to interview' },
      { label: 'Interview dates agreed' },
    ],
    'consulting:proposal->negotiation': [
      { label: 'Proposal document uploaded' },
      { label: 'Proposal sent to client' },
      { label: 'Client has acknowledged receipt' },
    ],
    'consulting:negotiation->sow': [
      { label: 'SOW document drafted' },
      { label: 'SOW signed by client' },
      { label: 'Invoice schedule agreed' },
    ],
    'technology:scoping->design': [
      { label: 'Requirements document signed off' },
      { label: 'Stakeholders identified' },
    ],
    'technology:build->testing': [
      { label: 'All features developed' },
      { label: 'Code review completed' },
    ],
    'technology:testing->deployment': [
      { label: 'All tests passing' },
      { label: 'UAT sign-off received' },
    ],
    'legal:drafting->negotiation': [
      { label: 'Draft sent to counter-party' },
      { label: 'Internal review completed' },
    ],
  };
  return checklists[key] || [];
}

/** Get the index of a stage within a workflow */
export function getStageIndex(projectType: string | null | undefined, stageId: string): number {
  const stages = getWorkflowStages(projectType);
  return stages.findIndex(s => s.id === stageId);
}

/** Determine stage state relative to current */
export type StageState = 'completed' | 'current' | 'upcoming';

export function getStageState(
  stageId: string,
  currentStage: string | null | undefined,
  completedStages: Array<{ stage: string; completed_at: string }> | null | undefined,
  projectType: string | null | undefined,
): StageState {
  if (completedStages?.some(c => c.stage === stageId)) return 'completed';
  if (stageId === currentStage) return 'current';
  return 'upcoming';
}
