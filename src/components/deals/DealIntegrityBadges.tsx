import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  contactId?: string | null;
  projectId?: string | null;
  compact?: boolean;
}

export function DealIntegrityBadges({ contactId, projectId, compact }: Props) {
  const missing = [];
  if (!contactId) missing.push('contact');
  if (!projectId) missing.push('project');
  if (missing.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {!contactId && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10 gap-0.5 cursor-help">
              <AlertTriangle className="w-2.5 h-2.5" />
              {!compact && '! No contact'}
              {compact && '!'}
            </Badge>
          </TooltipTrigger>
          <TooltipContent><p className="text-xs">No contact assigned to this deal</p></TooltipContent>
        </Tooltip>
      )}
      {!projectId && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10 gap-0.5 cursor-help">
              <AlertTriangle className="w-2.5 h-2.5" />
              {!compact && '! No project'}
              {compact && '!'}
            </Badge>
          </TooltipTrigger>
          <TooltipContent><p className="text-xs">No project linked to this deal</p></TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
