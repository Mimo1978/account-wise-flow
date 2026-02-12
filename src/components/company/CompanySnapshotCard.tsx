import { Account } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Globe,
  Phone,
  MapPin,
  TrendingUp,
  Users,
  Calendar,
  Shield,
  Sparkles,
  Edit2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

interface CompanySnapshotCardProps {
  company: Account;
  contactCount?: number;
  onEdit?: () => void;
}

const getRelationshipStatusConfig = (status?: string) => {
  switch (status) {
    case "active":
      return { label: "Active", className: "bg-accent text-accent-foreground border-accent/30" };
    case "warm":
      return { label: "Warm", className: "bg-primary/10 text-primary border-primary/30" };
    case "cooling":
      return { label: "Cooling", className: "bg-secondary text-secondary-foreground border-border" };
    case "dormant":
      return { label: "Dormant", className: "bg-muted text-muted-foreground border-border" };
    default:
      // Derive from engagement score if no explicit status
      return { label: "—", className: "bg-muted text-muted-foreground border-border" };
  }
};

const getDataQualityConfig = (quality?: string) => {
  switch (quality) {
    case "complete":
      return { label: "Complete", className: "text-accent-foreground" };
    case "partial":
      return { label: "Partial", className: "text-secondary-foreground" };
    case "minimal":
      return { label: "Minimal", className: "text-muted-foreground" };
    default:
      return { label: "Unknown", className: "text-muted-foreground" };
  }
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "—";
  try {
    // Handle relative dates like "4 days ago"
    if (dateString.includes("day") || dateString.includes("hour")) {
      return dateString;
    }
    return format(parseISO(dateString), "MMM d, yyyy");
  } catch {
    return dateString;
  }
};

export function CompanySnapshotCard({ company, contactCount, onEdit }: CompanySnapshotCardProps) {
  const relationshipStatus = getRelationshipStatusConfig(company.relationshipStatus);
  const dataQuality = getDataQualityConfig(company.dataQuality);

  return (
    <div className="space-y-4">
      {/* Company Header Card */}
      <div className="p-4 rounded-xl border border-border bg-card">
        <div className="flex items-start gap-4">
          {/* Logo / Avatar */}
          <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            {company.logo ? (
              <img src={company.logo} alt={company.name} className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <Building2 className="h-7 w-7 text-primary" />
            )}
          </div>

          {/* Company Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold truncate">{company.name}</h2>
                <p className="text-sm text-muted-foreground">{company.industry}</p>
              </div>
              <Badge
                variant="outline"
                className={cn("shrink-0", relationshipStatus.className)}
              >
                {relationshipStatus.label}
              </Badge>
            </div>

            {/* Quick Info Row */}
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
              {company.headquarters && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{company.headquarters}</span>
                </div>
              )}
              {company.size && (
                <div className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  <span>{company.size}</span>
                </div>
              )}
              {company.website && (
                <div className="flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[150px]">{company.website.replace(/^https?:\/\//, '')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <TrendingUp className="h-3 w-3" />
            Engagement
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{company.engagementScore}</span>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
        </div>

        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Users className="h-3 w-3" />
            Contacts
          </div>
          <span className="text-2xl font-bold">{contactCount ?? company.contacts.length}</span>
        </div>

        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Calendar className="h-3 w-3" />
            Last Activity
          </div>
          <span className="text-sm font-medium truncate block">
            {formatDate(company.lastInteraction || company.lastUpdated)}
          </span>
        </div>

        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Shield className="h-3 w-3" />
            Account Lead
          </div>
          <span className="text-sm font-medium truncate block">
            {company.accountManager?.name || "Unassigned"}
          </span>
        </div>
      </div>

      {/* Regions */}
      {company.regions && company.regions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Regions:</span>
          {company.regions.map((region) => (
            <Badge key={region} variant="secondary" className="text-xs">
              {region}
            </Badge>
          ))}
        </div>
      )}

      {/* AI Summary */}
      {company.aiSummary && (
        <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
          <div className="flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">AI Relationship Summary</p>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}>
                  <Edit2 className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {company.aiSummary}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Switchboard */}
      {company.switchboard && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Switchboard:</span>
          <span className="text-sm text-muted-foreground">{company.switchboard}</span>
        </div>
      )}
    </div>
  );
}
