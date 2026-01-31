import { Account } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Calendar,
  DollarSign,
  Briefcase,
  Plus,
  ExternalLink,
} from "lucide-react";

interface CompanyEngagementContextProps {
  company: Account;
}

// Mock data for demonstration - in production, this would come from the database
interface Engagement {
  id: string;
  type: "contract" | "project" | "bid" | "renewal";
  title: string;
  status: "active" | "completed" | "pending" | "lost";
  value?: string;
  date?: string;
}

const mockEngagements: Engagement[] = [];

export function CompanyEngagementContext({ company }: CompanyEngagementContextProps) {
  // In production, fetch engagements from database
  const engagements = mockEngagements;

  const getTypeIcon = (type: Engagement["type"]) => {
    switch (type) {
      case "contract":
        return <FileText className="h-4 w-4" />;
      case "project":
        return <Briefcase className="h-4 w-4" />;
      case "bid":
        return <DollarSign className="h-4 w-4" />;
      case "renewal":
        return <Calendar className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: Engagement["status"]) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-600";
      case "completed":
        return "bg-blue-500/10 text-blue-600";
      case "pending":
        return "bg-yellow-500/10 text-yellow-600";
      case "lost":
        return "bg-red-500/10 text-red-600";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (engagements.length === 0) {
    return (
      <div className="space-y-4">
        <div className="p-6 rounded-lg border border-dashed border-border text-center">
          <Briefcase className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">
            No commercial engagements recorded
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Track contracts, projects, and bids for this company
          </p>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Engagement
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="justify-start">
            <FileText className="h-4 w-4 mr-2" />
            Add Contract
          </Button>
          <Button variant="outline" size="sm" className="justify-start">
            <Briefcase className="h-4 w-4 mr-2" />
            Add Project
          </Button>
          <Button variant="outline" size="sm" className="justify-start">
            <DollarSign className="h-4 w-4 mr-2" />
            Add Bid
          </Button>
          <Button variant="outline" size="sm" className="justify-start">
            <Calendar className="h-4 w-4 mr-2" />
            Add Renewal
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Engagement List */}
      <div className="space-y-2">
        {engagements.map((engagement) => (
          <div
            key={engagement.id}
            className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              {getTypeIcon(engagement.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">
                  {engagement.title}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="capitalize">{engagement.type}</span>
                {engagement.date && (
                  <>
                    <span>•</span>
                    <span>{engagement.date}</span>
                  </>
                )}
                {engagement.value && (
                  <>
                    <span>•</span>
                    <span>{engagement.value}</span>
                  </>
                )}
              </div>
            </div>
            <Badge className={getStatusColor(engagement.status)}>
              {engagement.status}
            </Badge>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </div>
        ))}
      </div>

      {/* Add More Button */}
      <Button variant="outline" className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Add Engagement
      </Button>
    </div>
  );
}
