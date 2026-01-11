import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { mockTalents, roleTypeOptions } from "@/lib/mock-talent";
import { Talent, TalentAvailability } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Plus,
  ArrowLeft,
  Users,
  Phone,
  Mail,
  FileText,
  ExternalLink,
  Briefcase,
  DollarSign,
} from "lucide-react";

const availabilityColors: Record<TalentAvailability, string> = {
  available: "bg-green-500/20 text-green-400 border-green-500/30",
  interviewing: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  deployed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const availabilityLabels: Record<TalentAvailability, string> = {
  available: "Available",
  interviewing: "Interviewing",
  deployed: "Deployed",
};

const seniorityLabels: Record<string, string> = {
  executive: "Executive",
  director: "Director",
  manager: "Manager",
  senior: "Senior",
  mid: "Mid-Level",
  junior: "Junior",
};

export default function TalentDatabase() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");
  const [roleTypeFilter, setRoleTypeFilter] = useState<string>("all");
  const [selectedTalent, setSelectedTalent] = useState<Talent | null>(null);

  // Get unique role types from data
  const roleTypes = useMemo(() => {
    const types = new Set(mockTalents.map((t) => t.roleType));
    return Array.from(types).sort();
  }, []);

  // Filter talents
  const filteredTalents = useMemo(() => {
    return mockTalents.filter((talent) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        talent.name.toLowerCase().includes(searchLower) ||
        talent.roleType.toLowerCase().includes(searchLower) ||
        talent.skills.some((skill) =>
          skill.toLowerCase().includes(searchLower)
        );

      const matchesAvailability =
        availabilityFilter === "all" || talent.availability === availabilityFilter;

      const matchesRoleType =
        roleTypeFilter === "all" || talent.roleType === roleTypeFilter;

      return matchesSearch && matchesAvailability && matchesRoleType;
    });
  }, [searchQuery, availabilityFilter, roleTypeFilter]);

  const handleRowClick = (talent: Talent) => {
    setSelectedTalent(talent);
  };

  const handleAddTalent = () => {
    // Placeholder for add talent functionality
    console.log("Add talent clicked");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Talent Database
                </h1>
                <p className="text-sm text-muted-foreground">
                  {filteredTalents.length} candidates & contractors
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="default" 
                size="sm"
                onClick={handleAddTalent}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Talent
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="relative flex-1 min-w-[250px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, skill, or role type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Availability" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Availability</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="interviewing">Interviewing</SelectItem>
              <SelectItem value="deployed">Deployed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roleTypeFilter} onValueChange={setRoleTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Role Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Role Types</SelectItem>
              {roleTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Role Type</TableHead>
                <TableHead className="font-semibold">Seniority</TableHead>
                <TableHead className="font-semibold">Skills</TableHead>
                <TableHead className="font-semibold">Availability</TableHead>
                <TableHead className="font-semibold">Rate</TableHead>
                <TableHead className="font-semibold">Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTalents.map((talent) => (
                <TableRow
                  key={talent.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleRowClick(talent)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div>{talent.name}</div>
                        <div className="text-xs text-muted-foreground">{talent.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      <Briefcase className="h-3 w-3 mr-1" />
                      {talent.roleType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {seniorityLabels[talent.seniority] || talent.seniority}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {talent.skills.slice(0, 3).map((skill) => (
                        <Badge 
                          key={skill} 
                          variant="outline" 
                          className="text-xs font-normal"
                        >
                          {skill}
                        </Badge>
                      ))}
                      {talent.skills.length > 3 && (
                        <Badge variant="outline" className="text-xs font-normal">
                          +{talent.skills.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={availabilityColors[talent.availability]}>
                      {availabilityLabels[talent.availability]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {talent.rate ? (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <DollarSign className="h-3 w-3" />
                        <span>{talent.rate.replace("$", "")}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {talent.location || "—"}
                  </TableCell>
                </TableRow>
              ))}
              {filteredTalents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No talent found matching your criteria
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer */}
        <div className="mt-4 text-sm text-muted-foreground">
          Showing {filteredTalents.length} of {mockTalents.length} candidates
        </div>
      </div>

      {/* Talent Detail Dialog */}
      <Dialog open={!!selectedTalent} onOpenChange={(open) => !open && setSelectedTalent(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div>{selectedTalent?.name}</div>
                <div className="text-sm font-normal text-muted-foreground">
                  {selectedTalent?.roleType}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            {selectedTalent && (
              <div className="space-y-6 py-4">
                {/* Status & Rate Row */}
                <div className="flex items-center gap-3">
                  <Badge className={availabilityColors[selectedTalent.availability]}>
                    {availabilityLabels[selectedTalent.availability]}
                  </Badge>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-sm text-muted-foreground">
                    {seniorityLabels[selectedTalent.seniority]}
                  </span>
                  {selectedTalent.rate && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-sm font-medium text-green-500">
                        {selectedTalent.rate}
                      </span>
                    </>
                  )}
                </div>

                {/* Contact Info */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Contact</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a 
                        href={`mailto:${selectedTalent.email}`}
                        className="text-primary hover:underline"
                      >
                        {selectedTalent.email}
                      </a>
                    </div>
                    {selectedTalent.phoneNumbers?.map((phone, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{phone.value}</span>
                        <Badge variant="outline" className="text-xs">
                          {phone.label}
                        </Badge>
                        {phone.preferred && (
                          <Badge variant="secondary" className="text-xs">
                            Preferred
                          </Badge>
                        )}
                      </div>
                    ))}
                    {selectedTalent.linkedIn && (
                      <div className="flex items-center gap-2 text-sm">
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        <a 
                          href={selectedTalent.linkedIn}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          LinkedIn Profile
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Location */}
                {selectedTalent.location && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Location</Label>
                    <div className="text-sm">{selectedTalent.location}</div>
                  </div>
                )}

                {/* Skills */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Skills</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTalent.skills.map((skill) => (
                      <Badge key={skill} variant="secondary" className="font-normal">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                {selectedTalent.notes && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Notes</Label>
                    <div className="text-sm bg-muted/50 rounded-lg p-3">
                      {selectedTalent.notes}
                    </div>
                  </div>
                )}

                {/* CV Upload Placeholder */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">CV / Resume</Label>
                  <Button variant="outline" className="w-full justify-start gap-2" disabled>
                    <FileText className="h-4 w-4" />
                    {selectedTalent.cvUrl ? "View CV" : "Upload CV (Coming Soon)"}
                  </Button>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
