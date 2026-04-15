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
  FileStack, Users, ChevronRight, RefreshCw
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

  const fetchBatches = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    const { data } = await supabase
      .from("cv_import_batches")
      .select("id, created_at, status, total_files, processed_files, success_count, fail_count, completed_at, source")
      .eq("tenant_id", currentWorkspace.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setBatches(data as ImportBatch[]);
    setIsLoading(false);
    setLastRefresh(new Date());
  }, [currentWorkspace?.id]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  // Auto-refresh every 8 seconds if any batch is still processing
  useEffect(() => {
    const hasActive = batches.some(b => b.status === "processing" || b.status === "queued");
    if (!hasActive) return;
    const interval = setInterval(fetchBatches, 8000);
    return () => clearInterval(interval);
  }, [batches, fetchBatches]);

  const triggerProcessing = async (batchId: string) => {
    setTriggering(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/cv-batch-import/${batchId}/complete-upload`,
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
        fetchBatches();
      } else {
        toast.error(result.error || "Failed to start processing");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to start processing");
    } finally {
      setTriggering(false);
    }
  };

  const activeBatch = batches.find(b => b.status === "processing" || b.status === "queued");
  const totalImported = batches.reduce((s, b) => s + (b.success_count || 0), 0);
  const totalFailed = batches.reduce((s, b) => s + (b.fail_count || 0), 0);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="container mx-auto px-6 py-8 max-w-5xl space-y-6">

        {/* Header */}
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

        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total imported", value: totalImported.toLocaleString(), color: "text-green-600", sub: "candidates created" },
            { label: "Total batches", value: batches.length.toString(), color: "text-foreground", sub: "import sessions" },
            { label: "Failed", value: totalFailed.toLocaleString(), color: totalFailed > 0 ? "text-red-500" : "text-muted-foreground", sub: "could not parse" },
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

        {/* Active batch — live progress card */}
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

                  {/* Progress bar */}
                  <div className="space-y-2 mt-3">

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {activeBatch.processed_files.toLocaleString()} of {activeBatch.total_files.toLocaleString()} processed
                      </span>
                      <span className="font-medium text-foreground">{Math.round((activeBatch.processed_files / Math.max(activeBatch.total_files, 1)) * 100)}%</span>
                    </div>

                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${Math.round((activeBatch.processed_files / Math.max(activeBatch.total_files, 1)) * 100)}%` }}
                      />
                    </div>

                  </div>

                  {activeBatch.processed_files === 0 && activeBatch.status === "processing" && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-amber-600">Processing appears stuck</p>
                        <p className="text-xs text-muted-foreground">Files are uploaded but processing hasn't started yet</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => triggerProcessing(activeBatch.id)}
                        disabled={triggering}
                        className="gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-medium flex-shrink-0"
                      >
                        {triggering ? "Starting..." : "Start processing"}
                      </Button>
                    </div>
                  )}

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-sm mt-3">
                    <span className="text-green-600 font-medium">
                      ✓ {activeBatch.success_count.toLocaleString()} candidates created
                    </span>
                    {activeBatch.fail_count > 0 && (
                      <span className="text-red-400 font-medium">
                        ✗ {activeBatch.fail_count} failed
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      {activeBatch.total_files - activeBatch.processed_files > 0
                        ? `${(activeBatch.total_files - activeBatch.processed_files).toLocaleString()} remaining`
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

        {/* Past batches */}
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

                      {/* Status icon */}
                      <div className="flex-shrink-0">
                        {batch.status === "completed" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                        {batch.status === "partial" && <AlertCircle className="h-5 w-5 text-yellow-500" />}
                        {batch.status === "failed" && <XCircle className="h-5 w-5 text-red-500" />}
                        {batch.status === "queued" && <Clock className="h-5 w-5 text-muted-foreground" />}
                      </div>

                      {/* Info */}
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

                        {/* Mini progress bar */}
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

                      {/* Results */}
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

        {/* Empty state */}
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
