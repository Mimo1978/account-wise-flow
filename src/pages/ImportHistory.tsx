import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageBackButton } from "@/components/ui/page-back-button";
import { CMOrbital } from "@/components/ui/CMLoader";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, Clock, AlertCircle,
  FileStack, Users, ChevronRight, RefreshCw, Square, PauseCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportBatch {
  id: string;
  created_at: string;
  status: string;
  total_files: number;
  processed_files: number;
  success_count: number;
  fail_count: number;
  completed_at: string | null;
  source: string;
}

export default function ImportHistory() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [triggering, setTriggering] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [summary, setSummary] = useState({
    importedCandidates: 0,
    importSessions: 0,
    failedFiles: 0,
  });
  const [activeBatchStats, setActiveBatchStats] = useState({
    started: 0,
    completed: 0,
    created: 0,
    failed: 0,
    processing: 0,
    queued: 0,
  });

  const fetchBatches = useCallback(async () => {
    if (!currentWorkspace?.id) return;

    const [batchesResult, importedResult, failedResult] = await Promise.all([
      supabase
        .from("cv_import_batches")
        .select("id, created_at, status, total_files, processed_files, success_count, fail_count, completed_at, source", { count: "exact" })
        .eq("tenant_id", currentWorkspace.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("candidates")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", currentWorkspace.id)
        .in("source", ["cv_import", "import"]),
      supabase
        .from("cv_import_items")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", currentWorkspace.id)
        .eq("status", "failed"),
    ]);

    const batchRows = (batchesResult.data as ImportBatch[]) || [];
    setBatches(batchRows);
    setSummary({
      importedCandidates: importedResult.count || 0,
      importSessions: batchesResult.count || 0,
      failedFiles: failedResult.count || 0,
    });

    const currentActiveBatch = batchRows.find(b => b.status === "processing" || b.status === "queued");

    if (currentActiveBatch) {
      const { data: activeItems } = await supabase
        .from("cv_import_items")
        .select("status, candidate_id")
        .eq("batch_id", currentActiveBatch.id);

      const stats = (activeItems || []).reduce(
        (acc, item) => {
          if (item.status !== "queued") acc.started += 1;
          if (item.status !== "queued" && item.status !== "processing") acc.completed += 1;
          if (item.status === "processing") acc.processing += 1;
          if (item.status === "queued") acc.queued += 1;
          if (item.status === "failed") acc.failed += 1;
          if (item.status === "parsed" || item.status === "merged" || Boolean(item.candidate_id)) acc.created += 1;
          return acc;
        },
        { started: 0, completed: 0, created: 0, failed: 0, processing: 0, queued: 0 }
      );

      setActiveBatchStats(stats);
    } else {
      setActiveBatchStats({ started: 0, completed: 0, created: 0, failed: 0, processing: 0, queued: 0 });
    }

    setIsLoading(false);
    setLastRefresh(new Date());
  }, [currentWorkspace?.id]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  useEffect(() => {
    const hasActive = batches.some(b => b.status === "processing" || b.status === "queued");
    if (!hasActive) return;
    const interval = setInterval(fetchBatches, 3000);
    return () => clearInterval(interval);
  }, [batches, fetchBatches]);

  const triggerProcessing = async (batchId: string) => {
    setTriggering(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/cv-batch-import/${batchId}/restart`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
        }
      );
      const result = await response.json();
      if (result.success) {
        toast.success("Processing started — candidates will appear in Talent shortly");
        await fetchBatches();
      } else {
        toast.error(result.error || "Failed to start processing");
        setTriggering(false);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to start processing");
      setTriggering(false);
    }
  };

  const activeBatch = batches.find(b => b.status === "processing" || b.status === "queued");
  const isBatchProcessing = activeBatch?.status === "processing";
  const activeProgressCount = activeBatchStats.started || activeBatch?.processed_files || 0;
  const activeProgressPct = activeBatch
    ? Math.round((activeProgressCount / Math.max(activeBatch.total_files, 1)) * 100)
    : 0;

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="container mx-auto px-6 py-8 max-w-5xl space-y-6">

        <div className="flex items-start justify-between gap-6">

          <div>
            <PageBackButton fallback="/talent" className="mb-3" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Import Progress</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Live status of all your CV imports
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}
            </span>
            <Button variant="outline" size="sm" onClick={fetchBatches} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button onClick={() => navigate("/import/cvs")} className="gap-1.5">
              + Import more CVs
            </Button>
          </div>

        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Imported candidates",
              value: summary.importedCandidates.toLocaleString(),
              color: "text-green-600",
              sub: "candidate profiles created from CVs",
            },
            {
              label: "Import sessions",
              value: summary.importSessions.toLocaleString(),
              color: "text-foreground",
              sub: "CV upload batches started",
            },
            {
              label: "Failed files",
              value: summary.failedFiles.toLocaleString(),
              color: summary.failedFiles > 0 ? "text-red-500" : "text-muted-foreground",
              sub: "CVs that need review",
            },
          ].map(k => (
            <Card key={k.label}>
              <CardContent className="pt-6">
                <div className="text-xs font-medium text-muted-foreground mb-1">{k.label}</div>
                <div className={cn("text-3xl font-bold", k.color)}>{k.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{k.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {activeBatch && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6">

            <div className="space-y-5">
              <div className="space-y-4">

                <div className="flex items-start gap-3">
                  <CMOrbital size={48} />

                  <div className="flex-1 min-w-0">

                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-foreground">Import running in background</span>
                      <span className="text-xs text-muted-foreground">
                        Started {formatDistanceToNow(new Date(activeBatch.created_at), { addSuffix: true })}
                      </span>
                    </div>

                  <div className="space-y-2 mt-3">

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {activeProgressCount.toLocaleString()} of {activeBatch.total_files.toLocaleString()} files started
                      </span>
                      <span className="font-medium text-foreground">{activeProgressPct}%</span>
                    </div>

                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${activeProgressPct}%` }}
                      />
                    </div>

                  </div>

                  {activeBatchStats.completed === 0 && (
                    <div className={cn(
                      "mt-3 p-3 rounded-lg flex items-center justify-between gap-3",
                      isBatchProcessing || triggering
                        ? "bg-primary/10 border border-primary/20"
                        : "bg-amber-500/10 border border-amber-500/20"
                    )}>
                      <div>
                        {isBatchProcessing || triggering ? (
                          <>
                            <p className="text-xs font-medium text-primary">Processing active</p>
                            <p className="text-xs text-muted-foreground">The import is running in the background — progress will update automatically</p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-medium text-amber-600">Processing appears stuck</p>
                            <p className="text-xs text-muted-foreground">Files are uploaded but processing hasn't started yet</p>
                          </>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => triggerProcessing(activeBatch.id)}
                        disabled={isBatchProcessing || triggering}
                        className={cn(
                          "gap-1.5 font-medium flex-shrink-0",
                          isBatchProcessing || triggering
                            ? "bg-primary/20 text-primary cursor-wait"
                            : "bg-amber-500 hover:bg-amber-400 text-black"
                        )}
                      >
                        {isBatchProcessing || triggering ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            Processing…
                          </>
                        ) : "Restart processing"}
                      </Button>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-sm mt-3 flex-wrap">
                    <span className="text-green-600 font-medium">
                      ✓ {activeBatchStats.created.toLocaleString()} candidates created
                    </span>
                    <span className="text-foreground font-medium">
                      {activeBatchStats.processing.toLocaleString()} processing now
                    </span>
                    {activeBatchStats.failed > 0 && (
                      <span className="text-red-400 font-medium">
                        ✗ {activeBatchStats.failed.toLocaleString()} failed
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      {activeBatchStats.queued > 0
                        ? `${activeBatchStats.queued.toLocaleString()} waiting`
                        : activeBatchStats.processing > 0
                          ? "Finishing current files..."
                          : "Finalising..."}
                    </span>
                  </div>

                </div>

              </div>

            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <Button onClick={() => navigate("/talent")} variant="outline" className="gap-1.5">
                <Users className="h-4 w-4" />
                View candidates so far
              </Button>

              <p className="text-xs text-muted-foreground max-w-md">
                You can close this tab — processing continues automatically. Come back to check progress.
              </p>

            </div>
          </div>
            </CardContent>
          </Card>
        )}

        {batches.filter(b => b.status !== "processing" && b.status !== "queued").length > 0 && (
          <div className="space-y-3">

            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Completed imports
            </h2>

            <div className="space-y-2">
              {batches
                .filter(b => b.status !== "processing" && b.status !== "queued")
                .map(batch => {
                  const pct = Math.round((batch.success_count / Math.max(batch.total_files, 1)) * 100);
                  return (
                    <Card key={batch.id} className="hover:bg-muted/30 transition-colors">
                      <CardContent className="py-4 flex items-center gap-4">

                      <div className="flex-shrink-0">
                        {batch.status === "completed" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                        {batch.status === "partial" && <AlertCircle className="h-5 w-5 text-yellow-500" />}
                        {batch.status === "failed" && <XCircle className="h-5 w-5 text-red-500" />}
                        {batch.status === "queued" && <Clock className="h-5 w-5 text-muted-foreground" />}
                      </div>

                      <div className="flex-1 min-w-0">

                        <div className="flex items-center gap-2 text-sm mb-2">
                          <span className="font-medium text-foreground">
                            {batch.total_files.toLocaleString()} CVs
                          </span>
                          ·
                          <span className="text-muted-foreground">
                            {format(new Date(batch.created_at), "dd MMM yyyy 'at' HH:mm")}
                          </span>
                        </div>

                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full transition-all",
                              pct === 100 ? "bg-green-500" : pct > 50 ? "bg-yellow-500" : "bg-red-500"
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                      </div>

                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-green-600 font-medium">{batch.success_count.toLocaleString()} imported</span>
                        {batch.fail_count > 0 && (
                          <span className="text-red-400">{batch.fail_count} failed</span>
                        )}
                        <span className="text-muted-foreground">{pct}% success rate</span>
                      </div>

                      <Button onClick={() => navigate(`/imports/${batch.id}/review`)} variant="ghost" size="sm" className="flex-shrink-0">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </CardContent>
                    </Card>
                  );
                })}
            </div>

          </div>
        )}

        {!isLoading && batches.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
            <FileStack className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No imports yet</h3>
            <p className="text-sm text-muted-foreground mb-6">Go to Talent → Import → Bulk import to add your CVs</p>
            <Button onClick={() => navigate("/import/cvs")}>Start importing CVs</Button>
          </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
