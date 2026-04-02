import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { format } from "date-fns";
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
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  FileStack,
  AlertCircle,
} from "lucide-react";

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

const statusConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  queued: { label: "Queued", icon: <Clock className="h-3.5 w-3.5" />, className: "bg-muted text-muted-foreground" },
  processing: { label: "Processing", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, className: "bg-blue-500/20 text-blue-400" },
  completed: { label: "Completed", icon: <CheckCircle2 className="h-3.5 w-3.5" />, className: "bg-green-500/20 text-green-400" },
  partial: { label: "Partial", icon: <AlertCircle className="h-3.5 w-3.5" />, className: "bg-yellow-500/20 text-yellow-400" },
  failed: { label: "Failed", icon: <XCircle className="h-3.5 w-3.5" />, className: "bg-red-500/20 text-red-400" },
};

export default function ImportHistory() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentWorkspace?.id) return;

    const fetchBatches = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("cv_import_batches")
        .select("id, created_at, status, total_files, processed_files, success_count, fail_count, completed_at, source")
        .eq("tenant_id", currentWorkspace.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && data) {
        setBatches(data as ImportBatch[]);
      }
      setIsLoading(false);
    };

    fetchBatches();
  }, [currentWorkspace?.id]);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="container mx-auto px-6 py-8 max-w-5xl space-y-6">
        <div>
         <h1 className="text-2xl font-bold tracking-tight text-foreground">Import History</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All CV and contact imports
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="font-semibold">Files</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Results</TableHead>
                <TableHead className="font-semibold w-[140px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading…
                  </TableCell>
                </TableRow>
              ) : batches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <FileStack className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">No imports yet</p>
                    <p className="text-xs mt-1">Go to Talent → Import to add CVs.</p>
                  </TableCell>
                </TableRow>
              ) : (
                batches.map((batch) => {
                  const cfg = statusConfig[batch.status] || statusConfig.queued;
                  return (
                    <TableRow key={batch.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div>
                          <span className="font-medium text-sm">
                            {format(new Date(batch.created_at), "dd MMM yyyy")}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {format(new Date(batch.created_at), "HH:mm")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {batch.total_files} file{batch.total_files !== 1 ? "s" : ""}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`gap-1 ${cfg.className}`}>
                          {cfg.icon}
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          {batch.success_count > 0 && (
                            <span className="text-green-500">{batch.success_count} parsed</span>
                          )}
                          {batch.fail_count > 0 && (
                            <span className="text-red-400">{batch.fail_count} failed</span>
                          )}
                          {batch.processed_files < batch.total_files && (
                            <span className="text-muted-foreground">
                              {batch.processed_files}/{batch.total_files} processed
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                       <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => navigate(`/imports/${batch.id}/review`)}
                        >
                          Review →
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
