import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  TrendingDown, 
  UserX, 
  Repeat, 
  AlertTriangle,
  Zap,
  X,
} from 'lucide-react';
import { EvidencePill } from '@/components/evidence/EvidencePill';
import type { SignalType, SignalSeverity } from '@/lib/signal-types';
import type { EvidenceSnippet } from '@/lib/evidence-types';
import { cn } from '@/lib/utils';
import { SEVERITY_COLORS, SIGNAL_TYPE_LABELS } from '@/lib/signal-types';

interface SignalItemProps {
  /** Signal type */
  type: SignalType;
  /** Severity level */
  severity: SignalSeverity;
  /** Short title */
  title: string;
  /** Explanation text */
  description: string;
  /** Evidence snippets */
  evidence?: EvidenceSnippet[];
  /** Whether signal is dismissed */
  isDismissed?: boolean;
  /** Handler for dismiss action */
  onDismiss?: () => void;
  /** Handler for opening CV at position */
  onOpenCV?: (documentId: string, position: number) => void;
  /** Additional class names */
  className?: string;
}

const SIGNAL_ICONS: Record<SignalType, React.ElementType> = {
  short_tenure: Clock,
  unexplained_gap: TrendingDown,
  role_mismatch: UserX,
  contract_hopping: Repeat,
  skill_gap: Zap,
  recency_concern: AlertTriangle,
};

/**
 * Individual signal item with severity indicator, explanation, and evidence link.
 */
export function SignalItem({
  type,
  severity,
  title,
  description,
  evidence = [],
  isDismissed = false,
  onDismiss,
  onOpenCV,
  className,
}: SignalItemProps) {
  const Icon = SIGNAL_ICONS[type] || AlertTriangle;
  const colors = SEVERITY_COLORS[severity];

  if (isDismissed) return null;

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border',
        colors.border,
        colors.bg,
        className
      )}
    >
      {/* Severity dot */}
      <div className="flex flex-col items-center gap-1 pt-0.5">
        <div
          className={cn(
            'h-2.5 w-2.5 rounded-full',
            severity === 'high' && 'bg-orange-500',
            severity === 'med' && 'bg-amber-500',
            severity === 'low' && 'bg-blue-500'
          )}
        />
        <Icon className={cn('h-4 w-4', colors.text)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{title}</span>
              <Badge 
                variant="outline" 
                className={cn('text-[10px] px-1.5 py-0', colors.text, colors.border)}
              >
                {SIGNAL_TYPE_LABELS[type]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {evidence.length > 0 && (
              <EvidencePill
                evidence={evidence}
                onOpenCV={onOpenCV}
                size="sm"
              />
            )}
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                onClick={onDismiss}
                title="Dismiss signal"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignalItem;
