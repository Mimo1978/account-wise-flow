import { useNavigate } from 'react-router-dom';
import { FileText, FileCheck2, FileMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DocsColumnCellProps {
  talentId: string;
  talentName: string;
  docCount: number;
  hasPrimaryCV: boolean;
  isLoading?: boolean;
}

export function DocsColumnCell({
  talentId,
  talentName,
  docCount,
  hasPrimaryCV,
  isLoading,
}: DocsColumnCellProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  // No documents - show subtle indicator
  if (docCount === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 text-muted-foreground/50">
            <FileMinus className="h-4 w-4" />
            <span className="text-xs">None</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">
          <p>No documents attached</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  const tooltipText = hasPrimaryCV
    ? `${docCount} document${docCount > 1 ? 's' : ''} (includes CV)`
    : `${docCount} document${docCount > 1 ? 's' : ''}`;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Navigate to candidate profile with query param to auto-expand CV section
    navigate(`/talent/${talentId}?section=cv`);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-7 px-2.5 gap-1.5 text-xs font-medium',
            hasPrimaryCV 
              ? 'text-primary hover:text-primary hover:bg-primary/10 border border-primary/20' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            'focus-visible:ring-2 focus-visible:ring-primary/50',
            'transition-colors duration-150 cursor-pointer rounded-md'
          )}
          onClick={handleClick}
        >
          <FileCheck2 className={cn("h-3.5 w-3.5", hasPrimaryCV && "text-primary")} />
          <span>{docCount}</span>
          {hasPrimaryCV && (
            <Badge 
              variant="secondary" 
              className="h-4 px-1.5 text-[10px] font-semibold bg-primary/15 text-primary border-0"
            >
              CV
            </Badge>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" className="text-xs">
        <p className="font-medium">{tooltipText}</p>
        <p className="text-muted-foreground mt-0.5">Click to view documents</p>
      </TooltipContent>
    </Tooltip>
  );
}

// Compact inline indicator for the name column
interface DocsInlineIndicatorProps {
  docCount: number;
  hasPrimaryCV: boolean;
  isLoading?: boolean;
}

export function DocsInlineIndicator({
  docCount,
  hasPrimaryCV,
  isLoading,
}: DocsInlineIndicatorProps) {
  if (isLoading || docCount === 0) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div 
          className={cn(
            "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium",
            hasPrimaryCV 
              ? "bg-primary/15 text-primary" 
              : "bg-muted text-muted-foreground"
          )}
        >
          <FileText className="h-3 w-3" />
          {docCount > 1 && <span>{docCount}</span>}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {hasPrimaryCV 
          ? `CV + ${docCount - 1} other document${docCount > 2 ? 's' : ''}`
          : `${docCount} document${docCount > 1 ? 's' : ''}`
        }
      </TooltipContent>
    </Tooltip>
  );
}
