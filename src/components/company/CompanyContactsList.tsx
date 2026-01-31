import { useState, useMemo } from "react";
import { Contact } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  ExternalLink,
  Mail,
  Phone,
  Star,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanyContactsListProps {
  contacts: Contact[];
  onContactClick?: (contact: Contact) => void;
}

const getStatusColor = (status: Contact["status"]) => {
  switch (status) {
    case "champion":
      return "bg-accent text-accent-foreground border-accent";
    case "engaged":
      return "bg-primary/10 text-primary border-primary/20";
    case "warm":
      return "bg-secondary text-secondary-foreground border-secondary";
    case "blocker":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "new":
      return "bg-muted text-foreground border-border";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const getSeniorityLabel = (seniority: Contact["seniority"]) => {
  const map: Record<Contact["seniority"], string> = {
    executive: "Exec",
    director: "Dir",
    manager: "Mgr",
    senior: "Sr",
    mid: "Mid",
    junior: "Jr",
  };
  return map[seniority] || seniority;
};

export function CompanyContactsList({ contacts, onContactClick }: CompanyContactsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [seniorityFilter, setSeniorityFilter] = useState<string>("all");

  // Get unique departments
  const departments = useMemo(() => {
    const depts = new Set<string>();
    contacts.forEach((c) => c.department && depts.add(c.department));
    return Array.from(depts).sort();
  }, [contacts]);

  // Filter contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const matchesSearch =
        !searchQuery ||
        contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDepartment =
        departmentFilter === "all" || contact.department === departmentFilter;

      const matchesSeniority =
        seniorityFilter === "all" || contact.seniority === seniorityFilter;

      return matchesSearch && matchesDepartment && matchesSeniority;
    });
  }, [contacts, searchQuery, departmentFilter, seniorityFilter]);

  // Sort by seniority then name
  const sortedContacts = useMemo(() => {
    const seniorityOrder: Record<Contact["seniority"], number> = {
      executive: 1,
      director: 2,
      manager: 3,
      senior: 4,
      mid: 5,
      junior: 6,
    };
    
    return [...filteredContacts].sort((a, b) => {
      const seniorityDiff = seniorityOrder[a.seniority] - seniorityOrder[b.seniority];
      if (seniorityDiff !== 0) return seniorityDiff;
      return a.name.localeCompare(b.name);
    });
  }, [filteredContacts]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Depts</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept} value={dept}>
                {dept}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={seniorityFilter} onValueChange={setSeniorityFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Seniority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="executive">Executive</SelectItem>
            <SelectItem value="director">Director</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="senior">Senior</SelectItem>
            <SelectItem value="mid">Mid-Level</SelectItem>
            <SelectItem value="junior">Junior</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contact Count */}
      <div className="text-xs text-muted-foreground">
        Showing {sortedContacts.length} of {contacts.length} contacts
      </div>

      {/* Contact List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
        {sortedContacts.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            No contacts match your filters
          </div>
        ) : (
          sortedContacts.map((contact) => (
            <div
              key={contact.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border border-border bg-card",
                "hover:bg-muted/50 transition-colors cursor-pointer group"
              )}
              onClick={() => onContactClick?.(contact)}
            >
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={contact.profilePhoto} />
                <AvatarFallback className="text-xs">
                  {contact.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {contact.name}
                  </span>
                  {contact.status === "champion" && (
                    <Star className="h-3.5 w-3.5 text-accent-foreground shrink-0" />
                  )}
                  {contact.status === "blocker" && (
                    <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{contact.title}</span>
                  {contact.department && (
                    <>
                      <span className="text-border">•</span>
                      <span>{contact.department}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant="outline"
                  className={cn("text-xs", getStatusColor(contact.status))}
                >
                  {contact.status}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {getSeniorityLabel(contact.seniority)}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
