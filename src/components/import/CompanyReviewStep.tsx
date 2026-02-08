import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  Search,
  Plus,
  Link2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ParsedRow } from "./ImportCenterTypes";

export type ReviewDecision = "create" | "match" | "skip";

export interface CompanyReviewItem {
  id: string;
  name: string;
  headquarters?: string;
  industry?: string;
  regions?: string[];
  switchboard?: string;
  notes?: string;
  rawData: Record<string, any>;
  decision: ReviewDecision;
  matchedCompanyId?: string;
  matchedCompanyName?: string;
  duplicateSuggestions: DuplicateSuggestion[];
  isValid: boolean;
  errors: string[];
}

export interface DuplicateSuggestion {
  id: string;
  name: string;
  headquarters?: string;
  industry?: string;
  similarity: number; // 0-1
}

interface CompanyReviewStepProps {
  reviewItems: CompanyReviewItem[];
  onDecisionChange: (id: string, decision: ReviewDecision, matchedCompanyId?: string) => void;
  onBulkAction: (action: "create-all" | "skip-all") => void;
  isLoading?: boolean;
}

export function CompanyReviewStep({
  reviewItems,
  onDecisionChange,
  onBulkAction,
  isLoading = false,
}: CompanyReviewStepProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [searchFilters, setSearchFilters] = useState<Record<string, string>>({});

  // Stats
  const stats = useMemo(() => {
    const createCount = reviewItems.filter((i) => i.decision === "create").length;
    const matchCount = reviewItems.filter((i) => i.decision === "match").length;
    const skipCount = reviewItems.filter((i) => i.decision === "skip").length;
    const validCount = reviewItems.filter((i) => i.isValid).length;
    const invalidCount = reviewItems.filter((i) => !i.isValid).length;
    const hasDuplicates = reviewItems.filter((i) => i.duplicateSuggestions.length > 0).length;
    
    return { createCount, matchCount, skipCount, validCount, invalidCount, hasDuplicates };
  }, [reviewItems]);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleMatchSelection = (itemId: string, companyId: string, companyName: string) => {
    onDecisionChange(itemId, "match", companyId);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground">Checking for duplicates...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      {/* Summary Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="text-sm">{stats.validCount} valid</span>
          </div>
          {stats.invalidCount > 0 && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm">{stats.invalidCount} with errors</span>
            </div>
          )}
      {stats.hasDuplicates > 0 && (
            <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10">
              {stats.hasDuplicates} possible duplicates
            </Badge>
          )}
        </div>
        
        {/* Summary of decisions */}
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="default">{stats.createCount} to create</Badge>
          {stats.matchCount > 0 && (
            <Badge variant="secondary">{stats.matchCount} to match</Badge>
          )}
          {stats.skipCount > 0 && (
            <Badge variant="outline">{stats.skipCount} skipped</Badge>
          )}
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="flex items-center gap-2 pb-2 border-b">
        <span className="text-sm text-muted-foreground">Bulk actions:</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onBulkAction("create-all")}
          className="gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Create All as New
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onBulkAction("skip-all")}
          className="gap-1 text-muted-foreground"
        >
          <XCircle className="h-3.5 w-3.5" />
          Skip All
        </Button>
      </div>

      {/* Review Cards */}
      <ScrollArea className="h-[340px] pr-2">
        <div className="space-y-3">
          {reviewItems.map((item) => (
            <CompanyReviewCard
              key={item.id}
              item={item}
              isExpanded={expandedItems.has(item.id)}
              onToggleExpand={() => toggleExpand(item.id)}
              onDecisionChange={(decision, matchId) => 
                onDecisionChange(item.id, decision, matchId)
              }
              searchFilter={searchFilters[item.id] || ""}
              onSearchFilterChange={(value) => 
                setSearchFilters((prev) => ({ ...prev, [item.id]: value }))
              }
            />
          ))}
        </div>
      </ScrollArea>

      {/* Validation Warning */}
      {stats.invalidCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span>
            {stats.invalidCount} companies cannot be imported due to missing Company Name. 
            Please go back and verify your column mapping.
          </span>
        </div>
      )}
    </div>
  );
}

interface CompanyReviewCardProps {
  item: CompanyReviewItem;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDecisionChange: (decision: ReviewDecision, matchedCompanyId?: string) => void;
  searchFilter: string;
  onSearchFilterChange: (value: string) => void;
}

function CompanyReviewCard({
  item,
  isExpanded,
  onToggleExpand,
  onDecisionChange,
  searchFilter,
  onSearchFilterChange,
}: CompanyReviewCardProps) {
  const hasDuplicates = item.duplicateSuggestions.length > 0;

  return (
    <Card 
      className={cn(
        "p-4 transition-all",
        !item.isValid && "border-destructive/50 bg-destructive/5",
        item.decision === "skip" && "opacity-60",
        hasDuplicates && item.decision === "create" && "border-warning/50 bg-warning/5"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Company Icon */}
        <div className={cn(
          "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
          item.isValid ? "bg-primary/10" : "bg-destructive/10"
        )}>
          <Building2 className={cn(
            "h-5 w-5",
            item.isValid ? "text-primary" : "text-destructive"
          )} />
        </div>

        {/* Company Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-foreground truncate">
              {item.name || <span className="text-destructive italic">No Name</span>}
            </h4>
            {hasDuplicates && item.decision !== "match" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-warning border-warning/30 text-xs">
                    Possible duplicate
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Similar companies found in your database</p>
                </TooltipContent>
              </Tooltip>
            )}
            {!item.isValid && (
              <Badge variant="destructive" className="text-xs">
                Missing required data
              </Badge>
            )}
          </div>
          
          {/* Details */}
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
            {item.headquarters && <span>{item.headquarters}</span>}
            {item.industry && <span>{item.headquarters ? "• " : ""}{item.industry}</span>}
            {item.regions && item.regions.length > 0 && (
              <span>{(item.headquarters || item.industry) ? "• " : ""}{item.regions.slice(0, 2).join(", ")}</span>
            )}
          </div>

          {/* Errors */}
          {!item.isValid && item.errors.length > 0 && (
            <div className="mt-2 text-sm text-destructive">
              {item.errors.map((err, i) => (
                <div key={i} className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {err}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Decision Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <RadioGroup
            value={item.decision}
            onValueChange={(value) => onDecisionChange(value as ReviewDecision)}
            className="flex items-center gap-1"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center">
                  <RadioGroupItem
                    value="create"
                    id={`${item.id}-create`}
                    className="peer sr-only"
                    disabled={!item.isValid}
                  />
                  <Label
                    htmlFor={`${item.id}-create`}
                    className={cn(
                      "px-3 py-1.5 rounded-l-md border cursor-pointer text-sm transition-colors",
                      "peer-disabled:opacity-50 peer-disabled:cursor-not-allowed",
                      item.decision === "create"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:bg-muted"
                    )}
                  >
                    <Plus className="h-3.5 w-3.5 inline mr-1" />
                    Create
                  </Label>
                </div>
              </TooltipTrigger>
              <TooltipContent>Create as new company</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center">
                  <RadioGroupItem
                    value="match"
                    id={`${item.id}-match`}
                    className="peer sr-only"
                    disabled={!item.isValid}
                  />
                  <Label
                    htmlFor={`${item.id}-match`}
                    className={cn(
                      "px-3 py-1.5 border-y cursor-pointer text-sm transition-colors",
                      "peer-disabled:opacity-50 peer-disabled:cursor-not-allowed",
                      item.decision === "match"
                        ? "bg-secondary text-secondary-foreground border-secondary"
                        : "bg-background border-border hover:bg-muted"
                    )}
                    onClick={() => {
                      if (item.isValid && item.decision !== "match") {
                        onToggleExpand();
                      }
                    }}
                  >
                    <Link2 className="h-3.5 w-3.5 inline mr-1" />
                    Match
                  </Label>
                </div>
              </TooltipTrigger>
              <TooltipContent>Match to existing company</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center">
                  <RadioGroupItem
                    value="skip"
                    id={`${item.id}-skip`}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={`${item.id}-skip`}
                    className={cn(
                      "px-3 py-1.5 rounded-r-md border cursor-pointer text-sm transition-colors",
                      item.decision === "skip"
                        ? "bg-muted text-muted-foreground border-muted"
                        : "bg-background border-border hover:bg-muted"
                    )}
                  >
                    <XCircle className="h-3.5 w-3.5 inline mr-1" />
                    Skip
                  </Label>
                </div>
              </TooltipTrigger>
              <TooltipContent>Skip this row</TooltipContent>
            </Tooltip>
          </RadioGroup>

          {/* Expand button for match */}
          {item.decision === "match" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpand}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Expanded Match Selection */}
      {isExpanded && item.decision === "match" && (
        <div className="mt-4 pt-4 border-t space-y-3">
          <div className="text-sm font-medium">Select existing company to match:</div>
          
          {/* Duplicate Suggestions */}
          {item.duplicateSuggestions.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Suggested matches:</Label>
              {item.duplicateSuggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  onClick={() => onDecisionChange("match", suggestion.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2 rounded-lg border text-left transition-colors",
                    item.matchedCompanyId === suggestion.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{suggestion.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {suggestion.headquarters || suggestion.industry || "No details"}
                    </div>
                  </div>
                  <Badge 
                    variant={suggestion.similarity > 0.8 ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {Math.round(suggestion.similarity * 100)}% match
                  </Badge>
                  {item.matchedCompanyId === suggestion.id && (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Search for other companies */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for another company..."
              value={searchFilter}
              onChange={(e) => onSearchFilterChange(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>

          {!item.matchedCompanyId && (
            <p className="text-xs text-muted-foreground">
              Please select a company to match, or choose "Create" to add as new.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
