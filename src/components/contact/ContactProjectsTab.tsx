import { Contact } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Briefcase, 
  Building2, 
  Calendar, 
  User, 
  ArrowRight,
  Plus,
  Target,
  Clock,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

interface ContactProjectsTabProps {
  contact: Contact;
  companyName: string;
}

interface Placement {
  id: string;
  candidateName: string;
  roleName: string;
  companyName: string;
  status: "active" | "completed" | "ending-soon";
  startDate: string;
  endDate?: string;
}

interface Bid {
  id: string;
  name: string;
  companyName: string;
  status: "open" | "submitted" | "won" | "lost";
  dueDate?: string;
  value?: string;
}

interface Project {
  id: string;
  name: string;
  companyName: string;
  status: "active" | "completed" | "on-hold";
  role: string;
}

const placementStatusConfig = {
  "active": { label: "Active", className: "bg-green-500/20 text-green-400 border-green-500/30" },
  "completed": { label: "Completed", className: "bg-muted text-muted-foreground border-border" },
  "ending-soon": { label: "Ending Soon", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
};

const bidStatusConfig = {
  "open": { label: "Open", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  "submitted": { label: "Submitted", className: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  "won": { label: "Won", className: "bg-green-500/20 text-green-400 border-green-500/30" },
  "lost": { label: "Lost", className: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export function ContactProjectsTab({ contact, companyName }: ContactProjectsTabProps) {
  // Mock data - in real app, this would come from database
  const placements: Placement[] = [
    {
      id: "1",
      candidateName: "James Morrison",
      roleName: "Senior DevOps Engineer",
      companyName: companyName,
      status: "active",
      startDate: "2024-09-01",
      endDate: "2025-03-01",
    },
    {
      id: "2",
      candidateName: "Emily Chen",
      roleName: "Cloud Architect",
      companyName: companyName,
      status: "ending-soon",
      startDate: "2024-06-15",
      endDate: "2025-02-15",
    },
  ];

  const bids: Bid[] = [
    {
      id: "1",
      name: "Cloud Migration Phase 2",
      companyName: companyName,
      status: "submitted",
      dueDate: "2025-02-28",
      value: "$450,000",
    },
    {
      id: "2",
      name: "Security Assessment Q2",
      companyName: companyName,
      status: "open",
      dueDate: "2025-03-15",
      value: "$120,000",
    },
  ];

  const projects: Project[] = [
    {
      id: "1",
      name: "Cloud Infrastructure Modernization",
      companyName: companyName,
      status: "active",
      role: "Sponsor",
    },
  ];

  const handleViewDetails = (type: string, id: string) => {
    toast.info(`Opening ${type} details`);
  };

  return (
    <div className="space-y-6">
      {/* Active Placements */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Placements ({placements.length})
          </h3>
          <Button size="sm" variant="outline">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Placement
          </Button>
        </div>

        {placements.length === 0 ? (
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No placements linked to this contact.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {placements.map((placement) => {
              const statusInfo = placementStatusConfig[placement.status];
              return (
                <Card key={placement.id} className="hover:border-primary/20 transition-colors cursor-pointer" onClick={() => handleViewDetails("placement", placement.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{placement.candidateName}</p>
                        <p className="text-xs text-muted-foreground">{placement.roleName}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className={statusInfo.className}>
                            {statusInfo.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {placement.startDate} - {placement.endDate || "Ongoing"}
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Open Bids / Proposals */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Bids & Proposals ({bids.length})
          </h3>
          <Button size="sm" variant="outline">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Bid
          </Button>
        </div>

        {bids.length === 0 ? (
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No active bids or proposals.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {bids.map((bid) => {
              const statusInfo = bidStatusConfig[bid.status];
              return (
                <Card key={bid.id} className="hover:border-primary/20 transition-colors cursor-pointer" onClick={() => handleViewDetails("bid", bid.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{bid.name}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className={statusInfo.className}>
                            {statusInfo.label}
                          </Badge>
                          {bid.value && (
                            <span className="text-xs font-medium text-primary">{bid.value}</span>
                          )}
                          {bid.dueDate && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Due: {bid.dueDate}
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Related Projects */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            Projects ({projects.length})
          </h3>
        </div>

        {projects.length === 0 ? (
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No projects linked to this contact.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <Card key={project.id} className="hover:border-primary/20 transition-colors cursor-pointer" onClick={() => handleViewDetails("project", project.id)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{project.name}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {project.role}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {project.companyName}
                        </span>
                        {project.status === "active" && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
