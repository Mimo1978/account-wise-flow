import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface ToolbarAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "outline" | "ghost" | "secondary" | "destructive" | "link";
  isActive?: boolean;
  priority: "critical" | "secondary"; // critical = always visible, secondary = can overflow
  hideLabel?: boolean; // For icon-only buttons
}

interface ResponsiveToolbarProps {
  leftContent?: React.ReactNode;
  actions: ToolbarAction[];
  className?: string;
}

export const ResponsiveToolbar: React.FC<ResponsiveToolbarProps> = ({
  leftContent,
  actions,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [overflowIndex, setOverflowIndex] = useState<number | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Separate actions by priority
  const criticalActions = actions.filter((a) => a.priority === "critical");
  const secondaryActions = actions.filter((a) => a.priority === "secondary");

  const checkOverflow = useCallback(() => {
    if (!containerRef.current || !actionsRef.current || isChecking) return;

    setIsChecking(true);
    
    // Reset to show all items first
    setOverflowIndex(null);

    requestAnimationFrame(() => {
      const container = containerRef.current;
      const actionsContainer = actionsRef.current;
      
      if (!container || !actionsContainer) {
        setIsChecking(false);
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const actionButtons = actionsContainer.querySelectorAll('[data-toolbar-action]');
      
      // Check if we're overflowing
      if (actionsContainer.scrollWidth > actionsContainer.clientWidth + 2) {
        // Find where to cut off secondary actions
        let cutoffIndex = 0;
        const secondaryButtons = actionsContainer.querySelectorAll('[data-toolbar-secondary]');
        
        for (let i = secondaryButtons.length - 1; i >= 0; i--) {
          const btn = secondaryButtons[i] as HTMLElement;
          const rect = btn.getBoundingClientRect();
          
          // If button is within bounds with some buffer for the "More" button
          if (rect.right < containerRect.right - 100) {
            cutoffIndex = i + 1;
            break;
          }
        }
        
        setOverflowIndex(cutoffIndex);
      }
      
      setIsChecking(false);
    });
  }, [isChecking]);

  useEffect(() => {
    checkOverflow();
    
    const resizeObserver = new ResizeObserver(() => {
      checkOverflow();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener("resize", checkOverflow);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", checkOverflow);
    };
  }, [checkOverflow, actions]);

  // Determine which secondary actions are visible vs overflow
  const visibleSecondaryActions = overflowIndex !== null 
    ? secondaryActions.slice(0, overflowIndex)
    : secondaryActions;
  
  const overflowActions = overflowIndex !== null 
    ? secondaryActions.slice(overflowIndex)
    : [];

  const renderAction = (action: ToolbarAction, isInMenu = false) => {
    if (isInMenu) {
      return (
        <DropdownMenuItem
          key={action.id}
          onClick={action.onClick}
          className="gap-2 cursor-pointer"
        >
          {action.icon}
          <span>{action.label}</span>
        </DropdownMenuItem>
      );
    }

    return (
      <Button
        key={action.id}
        variant={action.isActive ? "default" : (action.variant || "outline")}
        size="sm"
        className={cn("gap-2 shrink-0", action.hideLabel && "px-2")}
        onClick={action.onClick}
        data-toolbar-action
        data-toolbar-secondary={action.priority === "secondary" ? "true" : undefined}
      >
        {action.icon}
        {!action.hideLabel && <span className="hidden sm:inline">{action.label}</span>}
        {action.hideLabel && <span className="sr-only">{action.label}</span>}
      </Button>
    );
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        "flex items-center justify-between gap-3 min-w-0 w-full",
        className
      )}
    >
      {/* Left content - flexible but can shrink */}
      <div className="flex items-center gap-4 min-w-0 shrink overflow-hidden">
        {leftContent}
      </div>

      {/* Right actions container */}
      <div 
        ref={actionsRef}
        className="flex items-center gap-2 shrink-0 ml-auto"
      >
        {/* Secondary actions (can overflow) */}
        {visibleSecondaryActions.map((action) => renderAction(action))}

        {/* Overflow menu - only show if there are overflow items */}
        {overflowActions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="px-2">
                <MoreHorizontal className="w-4 h-4" />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {overflowActions.map((action) => renderAction(action, true))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Separator before critical actions if there are any secondary visible */}
        {(visibleSecondaryActions.length > 0 || overflowActions.length > 0) && criticalActions.length > 0 && (
          <div className="h-6 w-px bg-border shrink-0" />
        )}

        {/* Critical actions (always visible) */}
        {criticalActions.map((action) => renderAction(action))}
      </div>
    </div>
  );
};
