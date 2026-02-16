import { Link2, Unlink, Lock, Unlock, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface StructureToolbarProps {
  position: { x: number; y: number };
  isLocked: boolean;
  onLink: () => void;
  onUnlink: () => void;
  onToggleLock: () => void;
  onViewProfile: () => void;
}

export const StructureToolbar = ({
  position,
  isLocked,
  onLink,
  onUnlink,
  onToggleLock,
  onViewProfile,
}: StructureToolbarProps) => {
  const actions = [
    { icon: Link2, label: "Link", onClick: onLink },
    { icon: Unlink, label: "Unlink from manager", onClick: onUnlink },
    { icon: isLocked ? Unlock : Lock, label: isLocked ? "Unlock position" : "Lock position", onClick: onToggleLock },
    { icon: Eye, label: "View Profile", onClick: onViewProfile },
  ];

  return (
    <div
      className="absolute z-50 flex items-center gap-1 bg-background border border-border rounded-lg shadow-lg px-1.5 py-1 animate-in fade-in slide-in-from-bottom-2 duration-200"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translate(-50%, -100%) translateY(-12px)",
        pointerEvents: "auto",
      }}
    >
      {actions.map(({ icon: Icon, label, onClick }) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={onClick}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="sr-only">{label}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {label}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
};
