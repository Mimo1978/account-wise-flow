import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
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

  if (docCount === 0) {
    return <span className="text-muted-foreground text-sm">—</span>;
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
            'h-6 px-2 gap-1.5 text-xs font-normal',
            'text-primary hover:text-primary hover:bg-primary/10',
            'focus-visible:ring-2 focus-visible:ring-primary/50',
            'transition-colors duration-150 cursor-pointer'
          )}
          onClick={handleClick}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>{docCount}</span>
          {hasPrimaryCV && <Badge variant="secondary" className="h-4 px-1 text-xs">CV</Badge>}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" className="text-xs">
        <p>{tooltipText}</p>
        <p className="text-muted-foreground mt-1">Click to view documents</p>
      </TooltipContent>
    </Tooltip>
  );
}
