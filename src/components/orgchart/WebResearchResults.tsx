import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
  XCircle,
} from "lucide-react";
import type {
  WebResearchPerson,
  WebResearchResult,
  WebResearchConfidence,
} from "@/lib/web-research-types";
import { CONFIDENCE_CONFIG, SOURCE_TYPE_LABELS } from "@/lib/web-research-types";

interface WebResearchResultsProps {
  result: WebResearchResult;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  isProcessing?: boolean;
}

export function WebResearchResults({
  result,
  selectedIds,
  onSelectionChange,
  isProcessing,
}: WebResearchResultsProps) {
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);
  const [filterConfidence, setFilterConfidence] = useState<WebResearchConfidence | "all">("all");

  // Filter people by confidence
  const filteredPeople = result.people.filter((p) =>
    filterConfidence === "all" ? true : p.confidence === filterConfidence
  );

  // Group by confidence
  const groupedByConfidence = {
    high: result.people.filter((p) => p.confidence === "high"),
    medium: result.people.filter((p) => p.confidence === "medium"),
    low: result.people.filter((p) => p.confidence === "low"),
  };

  // Selection helpers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(new Set(filteredPeople.map((p) => p.id)));
    } else {
      onSelectionChange(new Set());
    }
  };

  const handleSelectPerson = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    onSelectionChange(newSet);
  };

  const handleSelectByConfidence = (confidence: WebResearchConfidence, checked: boolean) => {
    const newSet = new Set(selectedIds);
    groupedByConfidence[confidence].forEach((p) => {
      if (checked) {
        newSet.add(p.id);
      } else {
        newSet.delete(p.id);
      }
    });
    onSelectionChange(newSet);
  };

  const allSelected = filteredPeople.length > 0 && filteredPeople.every((p) => selectedIds.has(p.id));
  const someSelected = filteredPeople.some((p) => selectedIds.has(p.id)) && !allSelected;

  return (
    <div className="space-y-4">
      {/* Stats Header */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="Total Found"
          value={result.stats.totalFound}
          icon={User}
        />
        <StatCard
          label="High Confidence"
          value={result.stats.highConfidence}
          icon={ShieldCheck}
          variant="success"
          onSelect={() => handleSelectByConfidence("high", true)}
          onDeselect={() => handleSelectByConfidence("high", false)}
          selectedCount={groupedByConfidence.high.filter((p) => selectedIds.has(p.id)).length}
        />
        <StatCard
          label="Medium"
          value={result.stats.mediumConfidence}
          icon={ShieldAlert}
          variant="warning"
          onSelect={() => handleSelectByConfidence("medium", true)}
          onDeselect={() => handleSelectByConfidence("medium", false)}
          selectedCount={groupedByConfidence.medium.filter((p) => selectedIds.has(p.id)).length}
        />
        <StatCard
          label="Low Confidence"
          value={result.stats.lowConfidence}
          icon={ShieldAlert}
          variant="danger"
          onSelect={() => handleSelectByConfidence("low", true)}
          onDeselect={() => handleSelectByConfidence("low", false)}
          selectedCount={groupedByConfidence.low.filter((p) => selectedIds.has(p.id)).length}
        />
      </div>

      {/* Confidence Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter:</span>
        {(["all", "high", "medium", "low"] as const).map((conf) => (
          <Badge
            key={conf}
            variant={filterConfidence === conf ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilterConfidence(conf)}
          >
            {conf === "all" ? "All" : `${conf.charAt(0).toUpperCase()}${conf.slice(1)}`}
          </Badge>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Checkbox
            checked={allSelected}
            ref={(el) => {
              if (el) (el as any).indeterminate = someSelected;
            }}
            onCheckedChange={handleSelectAll}
          />
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} of {result.people.length} selected
          </span>
        </div>
      </div>

      {/* People List */}
      <ScrollArea className="h-[400px] border rounded-lg">
        <div className="p-2 space-y-2">
          {filteredPeople.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No results match the current filter
            </div>
          ) : (
            filteredPeople.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                selected={selectedIds.has(person.id)}
                onSelectChange={(checked) => handleSelectPerson(person.id, checked)}
                expanded={expandedPersonId === person.id}
                onExpandToggle={() =>
                  setExpandedPersonId(expandedPersonId === person.id ? null : person.id)
                }
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Warnings */}
      {result.warnings && result.warnings.length > 0 && (
        <div className="p-3 bg-muted/50 rounded-lg border text-sm text-muted-foreground space-y-1">
          {result.warnings.map((warning, idx) => (
            <p key={idx} className="flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              {warning}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  icon: Icon,
  variant = "default",
  onSelect,
  onDeselect,
  selectedCount,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  variant?: "default" | "success" | "warning" | "danger";
  onSelect?: () => void;
  onDeselect?: () => void;
  selectedCount?: number;
}) {
  const colors = {
    default: "text-muted-foreground",
    success: "text-green-600 dark:text-green-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-red-600 dark:text-red-400",
  };

  return (
    <div className="p-3 rounded-lg border bg-card">
      <div className="flex items-center justify-between">
        <Icon className={cn("h-4 w-4", colors[variant])} />
        {onSelect && value > 0 && (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={onSelect}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Select all {label}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={onDeselect}
                >
                  <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Deselect all {label}</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {selectedCount !== undefined && selectedCount > 0 && (
        <Badge variant="secondary" className="mt-1 text-xs">
          {selectedCount} selected
        </Badge>
      )}
    </div>
  );
}

// Person Card Component
function PersonCard({
  person,
  selected,
  onSelectChange,
  expanded,
  onExpandToggle,
}: {
  person: WebResearchPerson;
  selected: boolean;
  onSelectChange: (checked: boolean) => void;
  expanded: boolean;
  onExpandToggle: () => void;
}) {
  const confidenceConfig = CONFIDENCE_CONFIG[person.confidence];

  return (
    <div
      className={cn(
        "rounded-lg border-2 transition-all",
        selected ? "border-primary bg-primary/5" : "border-border",
        // Placeholder styling - dashed border for unverified
        person.placeholder && "border-dashed"
      )}
    >
      {/* Main Row */}
      <div className="flex items-center gap-3 p-3">
        <Checkbox
          checked={selected}
          onCheckedChange={onSelectChange}
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{person.name}</span>
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                confidenceConfig.color,
                confidenceConfig.bgColor,
                confidenceConfig.borderColor
              )}
            >
              {person.confidence}
            </Badge>
            {person.placeholder && (
              <Badge variant="outline" className="text-xs border-dashed">
                Unverified
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {person.title}
            {person.department && ` · ${person.department}`}
            {person.location && ` · ${person.location}`}
          </p>
          {person.reportsTo && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Reports to: {person.reportsTo}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            <Link2 className="h-3 w-3 mr-1" />
            {person.sources.length}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onExpandToggle}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Expanded Evidence */}
      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-border mt-0">
          <div className="pt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Evidence Sources
            </p>
            {person.sources.map((source, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-2 rounded bg-muted/50 text-sm"
              >
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{source.title}</span>
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      {SOURCE_TYPE_LABELS[source.sourceType as keyof typeof SOURCE_TYPE_LABELS] || source.sourceType}
                    </Badge>
                  </div>
                  {source.excerpt && (
                    <p className="text-muted-foreground text-xs mt-1 line-clamp-2">
                      "{source.excerpt}"
                    </p>
                  )}
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    View Source
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Loading State Component
export function WebResearchLoading({ companyName }: { companyName: string }) {
  const [progress, setProgress] = useState(0);

  // Simulate progress
  useState(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return prev;
        }
        return prev + Math.random() * 15;
      });
    }, 500);
    return () => clearInterval(interval);
  });

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Loader2 className="h-10 w-10 text-primary animate-spin" />
      <div className="text-center space-y-2">
        <p className="font-medium">Researching {companyName}...</p>
        <p className="text-sm text-muted-foreground">
          Searching public sources for leadership information
        </p>
      </div>
      <div className="w-64">
        <Progress value={progress} className="h-2" />
      </div>
      <p className="text-xs text-muted-foreground">
        This may take a few moments
      </p>
    </div>
  );
}
