/**
 * Shared deal lifecycle utilities.
 * Encodes the relationship between deal stages and project requirements.
 */

export type BadgeSeverity = 'grey' | 'amber' | 'red';

/** Returns the severity for a "No project" badge based on deal stage */
export function getProjectBadgeSeverity(stage: string): BadgeSeverity {
  if (stage === 'won') return 'red';
  if (stage === 'negotiation') return 'amber';
  return 'grey'; // lead, qualified, proposal
}

/** Returns the severity for a "No contact" badge based on deal stage */
export function getContactBadgeSeverity(stage: string): BadgeSeverity {
  if (stage === 'won') return 'red';
  if (stage === 'negotiation') return 'amber';
  return 'grey'; // lead, qualified, proposal
}

/** Auto-populate probability from stage */
export function defaultProbabilityForStage(stage: string): number {
  const map: Record<string, number> = {
    lead: 10,
    qualified: 25,
    proposal: 50,
    negotiation: 75,
    won: 100,
    lost: 0,
  };
  return map[stage] ?? 10;
}

/** Badge styling classes per severity */
export const BADGE_SEVERITY_STYLES: Record<BadgeSeverity, string> = {
  grey: 'border-muted-foreground/30 text-muted-foreground bg-muted/50',
  amber: 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10',
  red: 'border-red-500/40 text-red-600 dark:text-red-400 bg-red-500/10',
};

/** Badge styling for dark theme (Command Centre) */
export const BADGE_SEVERITY_STYLES_DARK: Record<BadgeSeverity, { border: string; text: string; bg: string }> = {
  grey: { border: 'rgba(148,163,184,0.3)', text: '#94A3B8', bg: 'rgba(148,163,184,0.1)' },
  amber: { border: 'rgba(245,158,11,0.4)', text: '#FBBF24', bg: 'rgba(245,158,11,0.1)' },
  red: { border: 'rgba(239,68,68,0.4)', text: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
};

export type ActionSeverity = 'critical' | 'warning' | 'info';

export interface ActionRequiredItem {
  id: string;
  severity: ActionSeverity;
  label: string;
  recordName: string;
  onClick: () => void;
  daysInState: number;
  icon: React.ElementType;
}
