import React, { useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, AlertCircle, Info } from 'lucide-react';
import { SignalItem } from './SignalItem';
import type { TalentSignal, JobMatchSignal, SignalSeverity } from '@/lib/signal-types';
import { cn } from '@/lib/utils';

interface SignalsSectionProps {
  /** General talent signals */
  signals?: (TalentSignal | JobMatchSignal)[];
  /** Section title override */
  title?: string;
  /** Whether to start collapsed */
  defaultOpen?: boolean;
  /** Handler for dismissing signals */
  onDismiss?: (signalId: string) => void;
  /** Handler for opening CV viewer */
  onOpenCV?: (documentId: string, position: number) => void;
  /** Additional class names */
  className?: string;
}

/**
 * Collapsible section showing all signals for a talent/match.
 * Designed to be non-intrusive but informative.
 */
export function SignalsSection({
  signals = [],
  title = 'Signals',
  defaultOpen = false,
  onDismiss,
  onOpenCV,
  className,
}: SignalsSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Filter out dismissed signals
  const activeSignals = signals.filter(s => {
    if ('is_dismissed' in s) {
      return !s.is_dismissed;
    }
    return true;
  });

  if (activeSignals.length === 0) return null;

  // Calculate max severity for header badge
  const maxSeverity: SignalSeverity = activeSignals.reduce((max, s) => {
    const order: SignalSeverity[] = ['low', 'med', 'high'];
    return order.indexOf(s.severity) > order.indexOf(max) ? s.severity : max;
  }, 'low' as SignalSeverity);

  const severityHeaderColors = {
    low: 'border-blue-200 bg-blue-50/50',
    med: 'border-amber-200 bg-amber-50/50',
    high: 'border-orange-200 bg-orange-50/50',
  };

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn('rounded-lg border', severityHeaderColors[maxSeverity], className)}
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full flex items-center justify-between p-4 h-auto hover:bg-transparent"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted/80">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="font-medium">{title}</span>
            <Badge variant="secondary" className="ml-1">
              {activeSignals.length}
            </Badge>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-4 pb-4 space-y-3">
          {/* Advisory notice */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              These signals are advisory only. They highlight areas to explore during conversations
              and are not definitive assessments.
            </span>
          </div>

          {/* Signal list */}
          <div className="space-y-2">
            {activeSignals.map((signal) => (
              <SignalItem
                key={signal.id}
                type={signal.signal_type}
                severity={signal.severity}
                title={signal.title}
                description={signal.description}
                evidence={signal.evidence}
                isDismissed={'is_dismissed' in signal ? signal.is_dismissed : false}
                onDismiss={onDismiss ? () => onDismiss(signal.id) : undefined}
                onOpenCV={onOpenCV}
              />
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default SignalsSection;
