import { useState } from "react";
import { cn } from "@/lib/utils";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ModalContainerProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  isExpanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
  showExpandControl?: boolean;
  className?: string;
}

/**
 * Reusable modal container with fixed header/footer and scrollable content body.
 * Supports expand/collapse functionality for long-form configuration modals.
 *
 * ARCHITECTURE GUIDELINES:
 * - Use this component inside DialogContent for complex wizard/config modals
 * - Header and footer are always visible (fixed/sticky)
 * - Middle content scrolls independently via flex-1 + min-h-0 + overflow-y-auto
 * - Expand control provides near full-screen mode for dense forms
 *
 * MODAL SCROLL PATTERN:
 * All modals in the app should follow this structure for proper scroll behavior:
 * ```tsx
 * <DialogContent className="max-h-[90vh] flex flex-col overflow-hidden">
 *   <DialogHeader className="flex-shrink-0">...</DialogHeader>
 *   <ScrollArea className="flex-1 -mx-6 px-6">
 *     <div className="pb-4">...scrollable content...</div>
 *   </ScrollArea>
 *   <DialogFooter className="flex-shrink-0 border-t pt-4">...</DialogFooter>
 * </DialogContent>
 * ```
 *
 * Or use ModalContainer for complex AI/wizard flows:
 * ```tsx
 * <ModalContainer
 *   header={<DialogHeader>...</DialogHeader>}
 *   footer={<div>Actions</div>}
 *   showExpandControl
 * >
 *   <div>Scrollable content</div>
 * </ModalContainer>
 * ```
 */
export function ModalContainer({
  children,
  header,
  footer,
  isExpanded = false,
  onExpandChange,
  showExpandControl = false,
  className,
}: ModalContainerProps) {
  const [expanded, setExpanded] = useState(isExpanded);

  const handleToggleExpand = () => {
    const newState = !expanded;
    setExpanded(newState);
    onExpandChange?.(newState);
  };

  return (
    <div
      className={cn(
        "flex flex-col h-screen max-h-[90vh] transition-all duration-200",
        expanded && "fixed inset-0 m-0 h-screen max-h-screen z-50 rounded-none bg-background",
        className
      )}
    >
      {/* Fixed Header */}
      {header && (
        <div className="relative flex-shrink-0 border-b bg-background">
          {/* Expand/Collapse Control - Top Right */}
          {showExpandControl && (
            <div className="absolute right-4 top-4 z-10">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleExpand}
                className="h-8 w-8 p-0"
                title={expanded ? "Collapse" : "Expand"}
              >
                {expanded ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
          {header}
        </div>
      )}

      {/* Scrollable Content Body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {children}
      </div>

      {/* Fixed Footer */}
      {footer && (
        <div className="flex-shrink-0 border-t bg-background">
          {footer}
        </div>
      )}
    </div>
  );
}
