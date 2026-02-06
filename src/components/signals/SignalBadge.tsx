import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SignalBadgeProps {
  /** Number of signals */
  count: number;
  /** Highest severity among signals */
  maxSeverity?: 'low' | 'med' | 'high';
  /** Optional click handler */
  onClick?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * A small, non-intrusive badge showing signal count.
 * Appears in profile headers to indicate signals exist.
 */
export function SignalBadge({ 
  count, 
  maxSeverity = 'low',
  onClick,
  className 
}: SignalBadgeProps) {
  if (count === 0) return null;

  const severityStyles = {
    low: 'bg-blue-500/10 text-blue-600 border-blue-200 hover:bg-blue-500/20',
    med: 'bg-amber-500/10 text-amber-600 border-amber-200 hover:bg-amber-500/20',
    high: 'bg-orange-500/10 text-orange-600 border-orange-200 hover:bg-orange-500/20',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              'gap-1 cursor-pointer transition-colors',
              severityStyles[maxSeverity],
              className
            )}
            onClick={onClick}
          >
            <AlertCircle className="h-3 w-3" />
            Signals: {count}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{count} signal{count !== 1 ? 's' : ''} to review</p>
          <p className="text-xs text-muted-foreground">Click to view details</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default SignalBadge;
