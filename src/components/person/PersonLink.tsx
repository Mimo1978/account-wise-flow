import { Link } from "react-router-dom";
import { usePersonRoute, buildPersonProfileUrl } from "@/hooks/use-person-identity";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

interface PersonLinkProps {
  personIdentityId?: string | null;
  /** Fallback display name if identity hasn't loaded yet */
  name?: string | null;
  /** Where the user came from — preserves contextual back navigation */
  from?: string;
  fromLabel?: string;
  /** Visual variant — default is plain link styling */
  variant?: "link" | "button";
  className?: string;
  /** Show the icon before the label (button variant only) */
  showIcon?: boolean;
  /** Optional override label (e.g. "View profile"). Defaults to source-aware label. */
  label?: string;
}

/**
 * Canonical, source-aware profile link for any person.
 * Resolves to /talent, /contacts, or /crm/contacts based on which records
 * exist, with priority Talent → Contact → CRM Contact.
 *
 * Renders the supplied `name` immediately; the route is resolved in the
 * background so the link works as soon as data arrives without flicker.
 */
export function PersonLink({
  personIdentityId,
  name,
  from,
  fromLabel,
  variant = "link",
  className,
  showIcon = false,
  label,
}: PersonLinkProps) {
  const { data: route } = usePersonRoute(personIdentityId);
  const { url, label: defaultLabel } = buildPersonProfileUrl(route);
  const resolvedLabel = label ?? name ?? defaultLabel;

  // No identity / no profile — render plain text (per CRM read-only fallback memory)
  if (!url) {
    return (
      <span className={cn("text-foreground/90", className)} title="No linked profile">
        {resolvedLabel}
      </span>
    );
  }

  const baseClass =
    variant === "button"
      ? "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/60 bg-card hover:bg-[hsl(var(--primary)/0.08)] hover:border-primary/40 text-xs font-medium transition-colors"
      : "text-foreground hover:text-primary hover:underline transition-colors";

  return (
    <Link
      to={url}
      state={from ? { from, fromLabel: fromLabel ?? "Back" } : undefined}
      className={cn(baseClass, className)}
      title={defaultLabel}
    >
      {showIcon && variant === "button" && <ExternalLink className="w-3 h-3" />}
      {resolvedLabel}
    </Link>
  );
}
