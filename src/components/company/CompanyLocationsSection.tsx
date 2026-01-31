import { CompanyLocation } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Building2, Users, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanyLocationsSectionProps {
  locations: CompanyLocation[];
}

const getLocationTypeColor = (type: CompanyLocation["type"]) => {
  switch (type) {
    case "headquarters":
      return "bg-primary/10 text-primary border-primary/20";
    case "regional":
      return "bg-accent text-accent-foreground border-accent/20";
    case "branch":
      return "bg-secondary text-secondary-foreground border-border";
    case "satellite":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const getLocationTypeLabel = (type: CompanyLocation["type"]) => {
  switch (type) {
    case "headquarters":
      return "HQ";
    case "regional":
      return "Regional";
    case "branch":
      return "Branch";
    case "satellite":
      return "Satellite";
    default:
      return type;
  }
};

export function CompanyLocationsSection({ locations }: CompanyLocationsSectionProps) {
  if (!locations || locations.length === 0) {
    return (
      <div className="p-6 rounded-lg border border-dashed border-border text-center">
        <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          No office locations added
        </p>
        <Button variant="outline" size="sm" className="mt-3">
          Add Location
        </Button>
      </div>
    );
  }

  // Group by country
  const groupedLocations = locations.reduce((acc, loc) => {
    if (!acc[loc.country]) {
      acc[loc.country] = [];
    }
    acc[loc.country].push(loc);
    return acc;
  }, {} as Record<string, CompanyLocation[]>);

  const countries = Object.keys(groupedLocations).sort();

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg border border-border bg-card text-center">
          <Globe className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
          <span className="text-xl font-bold block">{countries.length}</span>
          <span className="text-xs text-muted-foreground">Countries</span>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card text-center">
          <Building2 className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
          <span className="text-xl font-bold block">{locations.length}</span>
          <span className="text-xs text-muted-foreground">Offices</span>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card text-center">
          <Users className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
          <span className="text-xl font-bold block">
            {locations.reduce((sum, loc) => sum + (loc.employeeCount || 0), 0).toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">Employees</span>
        </div>
      </div>

      {/* Locations List */}
      <div className="space-y-3">
        {countries.map((country) => (
          <div key={country} className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {country}
            </div>
            <div className="grid gap-2 pl-5">
              {groupedLocations[country].map((location) => (
                <div
                  key={location.id}
                  className={cn(
                    "p-3 rounded-lg border bg-card transition-colors hover:bg-muted/50",
                    location.type === "headquarters" && "border-primary/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{location.city}</span>
                        <Badge
                          variant="outline"
                          className={cn("text-xs", getLocationTypeColor(location.type))}
                        >
                          {getLocationTypeLabel(location.type)}
                        </Badge>
                      </div>
                      {location.address && (
                        <p className="text-xs text-muted-foreground truncate">
                          {location.address}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {location.switchboard && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{location.switchboard}</span>
                        </div>
                      )}
                      {location.employeeCount && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Users className="h-3 w-3" />
                          <span>{location.employeeCount.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
