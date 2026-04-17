import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileWarning, RefreshCw, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildFailedImportSummary, classifyImportError } from "@/lib/cv-import-report";
import { cn } from "@/lib/utils";

export interface FailedReviewFileItem {
  id: string;
  file_name: string;
  file_size_bytes: number;
  status: string;
  error_message: string | null;
  completed_at: string | null;
}

interface FailedFilesReviewPanelProps {
  failedItems: FailedReviewFileItem[];
  totalFiles: number;
  isCreatingRetryBatch: boolean;
  onCreateRetryBatch: (itemIds: string[]) => Promise<void>;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FailedFilesReviewPanel({
  failedItems,
  totalFiles,
  isCreatingRetryBatch,
  onCreateRetryBatch,
}: FailedFilesReviewPanelProps) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const groupedIssues = useMemo(() => buildFailedImportSummary(failedItems), [failedItems]);

  const filteredItems = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return failedItems;

    return failedItems.filter((item) => {
      const insight = classifyImportError(item.error_message);
      return [
        item.file_name,
        item.error_message || "",
        insight.category,
        insight.title,
        insight.detail,
      ].some((value) => value.toLowerCase().includes(search));
    });
  }, [failedItems, query]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filteredIds = filteredItems.map((item) => item.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedSet.has(id));
  const failureRate = totalFiles > 0 ? Math.round((failedItems.length / totalFiles) * 100) : 0;

  const toggleOne = (itemId: string, checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(itemId) ? current : [...current, itemId];
      }
      return current.filter((id) => id !== itemId);
    });
  };

  const toggleAllFiltered = (checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...filteredIds]));
      }
      const filteredSet = new Set(filteredIds);
      return current.filter((id) => !filteredSet.has(id));
    });
  };

  if (failedItems.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-14 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">No failed files in this run</h3>
          <p className="mt-1 text-sm text-muted-foreground">Everything in this batch either completed or is still processing.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Files needing review</div>
            <div className="mt-2 text-3xl font-bold text-destructive">{failedItems.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">Each one includes a clear reason and next action.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Issue patterns</div>
            <div className="mt-2 text-3xl font-bold text-foreground">{groupedIssues.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">Grouped so teams can see whether this is one repeat problem or many small ones.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>Failure rate</span>
              <span>{failureRate}%</span>
            </div>
            <Progress value={failureRate} className="mt-3 h-2" />
            <p className="mt-3 text-xs text-muted-foreground">{selectedIds.length} selected to move into a brand new retry run.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileWarning className="h-4 w-4 text-primary" />
            Failure report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {groupedIssues.slice(0, 4).map((group) => (
            <div key={group.fingerprint} className="rounded-lg border border-border/60 bg-background/70 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                  {group.count} affected
                </Badge>
                <span className="text-sm font-medium text-foreground">{group.title}</span>
                <span className="text-xs text-muted-foreground">{group.category}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{group.detail}</p>
              <p className="mt-2 text-xs font-medium text-foreground">Next action: {group.nextAction}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-base">Review and reprocess</CardTitle>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-[260px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search file, issue, or message"
                  className="pl-9"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => toggleAllFiltered(true)}>
                  Select visible
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedIds([])}>
                  Clear
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="gap-2"
                  disabled={selectedIds.length === 0 || isCreatingRetryBatch}
                  onClick={() => onCreateRetryBatch(selectedIds)}
                >
                  {isCreatingRetryBatch ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Reprocess selected in new batch
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={(checked) => toggleAllFiltered(Boolean(checked))}
                      aria-label="Select all visible failed files"
                    />
                  </TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Problem</TableHead>
                  <TableHead>Recommended action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredItems.map((item) => {
                  const insight = classifyImportError(item.error_message);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedSet.has(item.id)}
                          onCheckedChange={(checked) => toggleOne(item.id, Boolean(checked))}
                          aria-label={`Select ${item.file_name}`}
                        />
                      </TableCell>

                      <TableCell className="min-w-[260px]">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{item.file_name}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatFileSize(item.file_size_bytes)}</span>
                            {item.completed_at && <span>Failed at {new Date(item.completed_at).toLocaleString()}</span>}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="min-w-[320px]">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "border-border/60",
                                insight.severity === "high" && "border-destructive/30 bg-destructive/10 text-destructive",
                                insight.severity === "medium" && "bg-secondary text-secondary-foreground",
                                insight.severity === "low" && "bg-muted text-muted-foreground",
                              )}
                            >
                              {insight.category}
                            </Badge>
                            <span className="text-sm font-medium text-foreground">{insight.title}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{insight.detail}</p>
                          {item.error_message && (
                            <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                              Raw message: {item.error_message}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="min-w-[260px]">
                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-foreground">
                            <AlertTriangle className="h-4 w-4 text-primary" />
                            Suggested next step
                          </div>
                          <p className="text-sm text-muted-foreground">{insight.nextAction}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}