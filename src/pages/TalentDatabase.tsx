import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { mockTalents, roleTypeOptions } from "@/lib/mock-talent";
import { Talent, TalentAvailability, TalentDataQuality, TalentStatus } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  AlertCircle,
  CheckCircle2,
  MapPin,
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
    console.log("Add talent clicked");
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredTalents.map((t) => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const isAllSelected = filteredTalents.length > 0 && selectedIds.size === filteredTalents.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < filteredTalents.length;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      return format(new Date(dateStr), "MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  const getDataQualityBadge = (quality: TalentDataQuality) => {
    if (quality === "parsed") {
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Parsed
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 gap-1">
        <AlertCircle className="h-3 w-3" />
        Needs Review
      </Badge>
    );
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
                  {selectedIds.size > 0 && ` • ${selectedIds.size} selected`}
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

        {/* Table - Summary View for Wide Screens */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[1200px]">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[40px]">
                    <Checkbox 
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                      className={isSomeSelected ? "opacity-50" : ""}
                    />
                  </TableHead>
                  <TableHead className="font-semibold w-[120px]">Data Quality</TableHead>
                  <TableHead className="font-semibold min-w-[180px]">Name</TableHead>
                  <TableHead className="font-semibold min-w-[140px]">Primary Role</TableHead>
                  <TableHead className="font-semibold w-[100px]">Seniority</TableHead>
                  <TableHead className="font-semibold min-w-[200px]">Top Skills</TableHead>
                  <TableHead className="font-semibold w-[110px]">Availability</TableHead>
                  <TableHead className="font-semibold min-w-[130px]">Location</TableHead>
                  <TableHead className="font-semibold w-[90px]">Status</TableHead>
                  <TableHead className="font-semibold w-[110px]">Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTalents.map((talent) => (
                  <TableRow
                    key={talent.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleRowClick(talent)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox 
                        checked={selectedIds.has(talent.id)}
                        onCheckedChange={(checked) => handleSelectOne(talent.id, !!checked)}
                        aria-label={`Select ${talent.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      {getDataQualityBadge(talent.dataQuality)}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        <span className="truncate">{talent.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{talent.roleType}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {seniorityLabels[talent.seniority] || talent.seniority}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
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
                          <Badge variant="secondary" className="text-xs font-normal">
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
                      <div className="flex items-center gap-1 text-muted-foreground text-sm">
                        {talent.location ? (
                          <>
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{talent.location}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[talent.status]}>
                        {statusLabels[talent.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(talent.lastUpdated)}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredTalents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No talent found matching your criteria
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 text-sm text-muted-foreground">
          Showing {filteredTalents.length} of {mockTalents.length} candidates
        </div>
      </div>

      {/* Talent Detail Side Panel Dialog */}
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
                {/* Status Row */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={availabilityColors[selectedTalent.availability]}>
                    {availabilityLabels[selectedTalent.availability]}
                  </Badge>
                  <Badge className={statusColors[selectedTalent.status]}>
                    {statusLabels[selectedTalent.status]}
                  </Badge>
                  {getDataQualityBadge(selectedTalent.dataQuality)}
                </div>

                {/* Seniority & Rate */}
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {seniorityLabels[selectedTalent.seniority]}
                  </span>
                  {selectedTalent.rate && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="font-medium text-green-500">
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
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {selectedTalent.location}
                    </div>
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

                {/* Last Updated */}
                <div className="pt-2 border-t text-xs text-muted-foreground">
                  Last updated: {formatDate(selectedTalent.lastUpdated)}
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}