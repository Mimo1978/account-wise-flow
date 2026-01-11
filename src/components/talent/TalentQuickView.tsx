import { Talent, TalentAvailability, TalentStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Mail,
  Phone,
  FileText,
  Tags,
  Clock,
  X,
  Copy,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface TalentQuickViewProps {
  talent: Talent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewFull: () => void;
  trigger: React.ReactNode;
}

const availabilityColors: Record<TalentAvailability, string> = {
  available: "bg-green-500/20 text-green-400 border-green-500/30",
  interviewing: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  deployed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const availabilityLabels: Record<TalentAvailability, string> = {
  available: "Available",
  interviewing: "Interviewing",
  deployed: "On Project",
};

const statusColors: Record<TalentStatus, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  new: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "on-hold": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  archived: "bg-muted text-muted-foreground border-muted",
};

const statusLabels: Record<TalentStatus, string> = {
  active: "Active",
  new: "New",
  "on-hold": "On Hold",
  archived: "Archived",
};

export const TalentQuickView = ({
  talent,
  open,
  onOpenChange,
  onViewFull,
  trigger,
}: TalentQuickViewProps) => {
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      return format(new Date(dateStr), "MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  // Mock last contacted - in real app this would come from activities
  const lastContacted = talent.lastUpdated;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-80 p-0"
      >
        {/* Header */}
        <div className="p-4 pb-3 border-b border-border">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-sm truncate">{talent.name}</h4>
              <p className="text-xs text-muted-foreground truncate">
                {talent.roleType}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mr-1 -mt-1 shrink-0"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Status Badges */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge
              className={cn(
                "text-xs font-medium",
                availabilityColors[talent.availability]
              )}
            >
              {availabilityLabels[talent.availability]}
            </Badge>
            <Badge className={cn("text-xs", statusColors[talent.status])}>
              {statusLabels[talent.status]}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[360px] overflow-y-auto">
          {/* Email(s) */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Mail className="h-3 w-3" />
              Email
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 group">
                <a
                  href={`mailto:${talent.email}`}
                  className="text-sm text-primary hover:underline truncate"
                >
                  {talent.email}
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(talent.email, "Email");
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Phone(s) */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Phone className="h-3 w-3" />
              Phone
            </div>
            <div className="space-y-1.5">
              {talent.phoneNumbers && talent.phoneNumbers.length > 0 ? (
                talent.phoneNumbers.map((phone, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm truncate">{phone.value}</span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {phone.label}
                      </Badge>
                      {phone.preferred && (
                        <Badge
                          variant="secondary"
                          className="text-xs shrink-0"
                        >
                          ★
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(phone.value, "Phone");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-between gap-2 group">
                  <span className="text-sm">{talent.phone || "—"}</span>
                  {talent.phone && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(talent.phone, "Phone");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Notes Preview */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <FileText className="h-3 w-3" />
              Notes
            </div>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {talent.notes || talent.aiOverview || "No notes available"}
            </p>
          </div>

          <Separator />

          {/* Tags / Skills */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Tags className="h-3 w-3" />
              Skills
            </div>
            <div className="flex flex-wrap gap-1">
              {talent.skills.slice(0, 5).map((skill) => (
                <Badge
                  key={skill}
                  variant="outline"
                  className="text-xs font-normal"
                >
                  {skill}
                </Badge>
              ))}
              {talent.skills.length > 5 && (
                <Badge variant="secondary" className="text-xs font-normal">
                  +{talent.skills.length - 5}
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* Last Contacted */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Clock className="h-3 w-3" />
              Last Updated
            </div>
            <p className="text-sm text-muted-foreground">
              {formatDate(lastContacted)}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-muted/30">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => {
              onOpenChange(false);
              onViewFull();
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View Full Profile
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
