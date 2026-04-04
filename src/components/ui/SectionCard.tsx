import type { ReactNode } from "react";

interface SectionCardProps {
  accentColor: string;
  title: string;
  icon?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionCard({
  accentColor,
  title,
  icon,
  headerRight,
  children,
  className = "",
}: SectionCardProps) {
  return (
    <div
      className={`rounded-xl overflow-hidden bg-card border ${className}`}
      style={{
        borderLeft: `4px solid ${accentColor}`,
      }}
    >
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          {icon && (
            <span className="shrink-0 text-muted-foreground">
              {icon}
            </span>
          )}
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
            {title}
          </h2>
        </div>
        {headerRight && (
          <div className="flex items-center gap-2">{headerRight}</div>
        )}
      </div>
      <div className="px-6 pb-5">{children}</div>
    </div>
  );
}
