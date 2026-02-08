import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ModalContainer } from "@/components/ui/modal-container";
import { cn } from "@/lib/utils";
import {
  Globe,
  Search,
  AlertTriangle,
  Building2,
  MapPin,
  Users,
  ChevronRight,
} from "lucide-react";
import type {
  WebResearchConfig,
  WebResearchFocusArea,
  WebResearchDepth,
} from "@/lib/web-research-types";
import { FOCUS_AREA_LABELS, DEPTH_LABELS } from "@/lib/web-research-types";

interface WebResearchConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName: string;
  companyId?: string;
  onStartResearch: (config: WebResearchConfig) => void;
}

// Common regions
const REGION_OPTIONS = [
  "United Kingdom",
  "United States",
  "EMEA",
  "APAC",
  "Germany",
  "France",
  "Singapore",
  "Hong Kong",
  "Australia",
];

export function WebResearchConfigModal({
  open,
  onOpenChange,
  companyName,
  companyId,
  onStartResearch,
}: WebResearchConfigModalProps) {
  // Configuration state
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [customRegion, setCustomRegion] = useState("");
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<WebResearchFocusArea[]>(["all"]);
  const [depth, setDepth] = useState<WebResearchDepth>("leadership_only");
  const [seedPersonName, setSeedPersonName] = useState("");
  const [seedPersonTitle, setSeedPersonTitle] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  const handleRegionToggle = (region: string) => {
    setSelectedRegions((prev) =>
      prev.includes(region)
        ? prev.filter((r) => r !== region)
        : [...prev, region]
    );
  };

  const handleAddCustomRegion = () => {
    if (customRegion.trim() && !selectedRegions.includes(customRegion.trim())) {
      setSelectedRegions((prev) => [...prev, customRegion.trim()]);
      setCustomRegion("");
    }
  };

  const handleFocusAreaToggle = (area: WebResearchFocusArea) => {
    if (area === "all") {
      setSelectedFocusAreas(["all"]);
    } else {
      setSelectedFocusAreas((prev) => {
        const newAreas = prev.filter((a) => a !== "all");
        if (newAreas.includes(area)) {
          const filtered = newAreas.filter((a) => a !== area);
          return filtered.length === 0 ? ["all"] : filtered;
        }
        return [...newAreas, area];
      });
    }
  };

  const handleStartResearch = () => {
    const config: WebResearchConfig = {
      companyName,
      companyId,
      regions: selectedRegions.length > 0 ? selectedRegions : ["United Kingdom"],
      focusAreas: selectedFocusAreas,
      depth,
      seedPerson: seedPersonName.trim()
        ? { name: seedPersonName.trim(), title: seedPersonTitle.trim() }
        : undefined,
    };
    onStartResearch(config);
  };

  const canStart = acknowledged;

  const header = (
    <DialogHeader className="relative">
      <div className="flex items-center gap-2 pr-12">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Globe className="h-5 w-5 text-primary" />
        </div>
        <div>
          <DialogTitle className="flex items-center gap-2">
            AI Research Assistant
            <Badge variant="secondary" className="text-xs font-normal">
              Beta
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Discover leadership structure from public sources
          </DialogDescription>
        </div>
      </div>
    </DialogHeader>
  );

  const footer = (
    <div className="flex items-center justify-between p-6">
      <Button variant="outline" onClick={() => onOpenChange(false)}>
        Cancel
      </Button>
      <Button
        onClick={handleStartResearch}
        disabled={!canStart}
        className="gap-2"
      >
        <Search className="h-4 w-4" />
        Start Research
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );

  const contentBody = (
    <div className="space-y-6 p-6">
      {/* Target Company */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          Target Company
        </Label>
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="font-medium">{companyName}</p>
        </div>
      </div>

      <Separator />

      {/* Region Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          Geographic Focus
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <p className="text-sm text-muted-foreground">
          Focus the search on specific regions or offices
        </p>
        <div className="flex flex-wrap gap-2">
          {REGION_OPTIONS.map((region) => (
            <Badge
              key={region}
              variant={selectedRegions.includes(region) ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-colors",
                selectedRegions.includes(region)
                  ? "bg-primary hover:bg-primary/90"
                  : "hover:bg-muted"
              )}
              onClick={() => handleRegionToggle(region)}
            >
              {region}
            </Badge>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Add custom region..."
            value={customRegion}
            onChange={(e) => setCustomRegion(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleAddCustomRegion()}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddCustomRegion}
            disabled={!customRegion.trim()}
          >
            Add
          </Button>
        </div>
      </div>

      <Separator />

      {/* Focus Area */}
      <div className="space-y-3">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          Department Focus
        </Label>
        <p className="text-sm text-muted-foreground">
          Focus on specific departments or search all areas
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(FOCUS_AREA_LABELS) as [WebResearchFocusArea, string][]).map(
            ([key, label]) => (
              <div
                key={key}
                className={cn(
                  "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors",
                  selectedFocusAreas.includes(key)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
                onClick={() => handleFocusAreaToggle(key)}
              >
                <Checkbox
                  checked={selectedFocusAreas.includes(key)}
                  className="pointer-events-none"
                />
                <span className="text-sm">{label}</span>
              </div>
            )
          )}
        </div>
      </div>

      <Separator />

      {/* Search Depth */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Search Depth</Label>
        <RadioGroup
          value={depth}
          onValueChange={(value) => setDepth(value as WebResearchDepth)}
          className="space-y-2"
        >
          {(Object.entries(DEPTH_LABELS) as [WebResearchDepth, { label: string; description: string }][]).map(
            ([key, { label, description }]) => (
              <div
                key={key}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  depth === key
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
                onClick={() => setDepth(key)}
              >
                <RadioGroupItem value={key} id={key} className="mt-0.5" />
                <div>
                  <Label htmlFor={key} className="cursor-pointer font-medium">
                    {label}
                  </Label>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
            )
          )}
        </RadioGroup>
      </div>

      <Separator />

      {/* Seed Person (Optional) */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          Known Leader
          <span className="text-muted-foreground font-normal ml-2">(optional)</span>
        </Label>
        <p className="text-sm text-muted-foreground">
          Start from a known person to improve discovery accuracy
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input
              placeholder="e.g., John Smith"
              value={seedPersonName}
              onChange={(e) => setSeedPersonName(e.target.value)}
            />
            <span className="text-xs text-muted-foreground mt-1">Name</span>
          </div>
          <div>
            <Input
              placeholder="e.g., CEO"
              value={seedPersonTitle}
              onChange={(e) => setSeedPersonTitle(e.target.value)}
            />
            <span className="text-xs text-muted-foreground mt-1">Title</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Important Disclaimer */}
      <Alert className="border-destructive/30 bg-destructive/5">
        <AlertTriangle className="h-4 w-4 text-destructive/80" />
        <AlertDescription className="text-destructive/80">
          <strong className="block mb-1">Important: Advisory Results Only</strong>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Results are suggestions based on public information</li>
            <li>All contacts require your confirmation before saving</li>
            <li>Email addresses and phone numbers are never guessed</li>
            <li>No data from private or gated platforms</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Acknowledgement */}
      <div
        className={cn(
          "flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors",
          acknowledged
            ? "border-primary bg-primary/5"
            : "border-dashed border-muted-foreground/30"
        )}
        onClick={() => setAcknowledged(!acknowledged)}
      >
        <Checkbox
          id="acknowledge"
          checked={acknowledged}
          className="mt-0.5"
        />
        <Label htmlFor="acknowledge" className="cursor-pointer text-sm leading-relaxed">
          I understand that results are suggestions requiring manual verification,
          and I will review all findings before saving to my CRM.
        </Label>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <ModalContainer
          header={header}
          footer={footer}
          showExpandControl
        >
          {contentBody}
        </ModalContainer>
      </DialogContent>
    </Dialog>
  );
}
