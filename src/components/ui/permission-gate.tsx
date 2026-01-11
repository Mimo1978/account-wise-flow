import { ReactNode } from "react";
import { usePermissions, AppRole, getPermissionTooltip } from "@/hooks/use-permissions";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type PermissionAction = "edit" | "insert" | "delete";

interface PermissionGateProps {
  action: PermissionAction;
  children: ReactNode;
  /** If true, renders children even when disabled (useful for buttons that should show but be disabled) */
  showDisabled?: boolean;
  /** Custom tooltip message override */
  customTooltip?: string;
  /** Custom check - if provided, overrides default permission check */
  allowed?: boolean;
}

/**
 * Wraps children with permission checking.
 * Shows a tooltip when the user lacks permission.
 */
export function PermissionGate({
  action,
  children,
  showDisabled = true,
  customTooltip,
  allowed,
}: PermissionGateProps) {
  const { role, isLoading, canEdit, canInsert, canDelete } = usePermissions();

  // Determine if action is allowed
  const isAllowed = allowed !== undefined ? allowed : (() => {
    switch (action) {
      case "edit":
        return canEdit;
      case "insert":
        return canInsert;
      case "delete":
        return canDelete;
      default:
        return false;
    }
  })();

  // Get tooltip message
  const tooltipMessage = customTooltip || getPermissionTooltip(action, role);

  // If loading, show children as-is (or could show skeleton)
  if (isLoading) {
    return <>{children}</>;
  }

  // If allowed, render children normally
  if (isAllowed) {
    return <>{children}</>;
  }

  // If not allowed and showDisabled is false, don't render
  if (!showDisabled) {
    return null;
  }

  // Wrap in tooltip and pass disabled state to children
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="text-sm">
          {tooltipMessage || `You don't have permission (Role: ${role || 'none'}). Contact your Admin.`}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Hook to get disabled props for form controls based on permissions
 */
export function usePermissionDisabled(action: PermissionAction): {
  disabled: boolean;
  role: AppRole;
  tooltipMessage: string | null;
} {
  const { role, canEdit, canInsert, canDelete } = usePermissions();

  const isAllowed = (() => {
    switch (action) {
      case "edit":
        return canEdit;
      case "insert":
        return canInsert;
      case "delete":
        return canDelete;
      default:
        return false;
    }
  })();

  return {
    disabled: !isAllowed,
    role,
    tooltipMessage: getPermissionTooltip(action, role),
  };
}

/**
 * Formats a permission denied message with the user's role
 */
export function formatPermissionDenied(role: AppRole): string {
  if (!role) {
    return "Please sign in to perform this action";
  }
  return `You don't have permission (Role: ${role}). Contact your Admin.`;
}
