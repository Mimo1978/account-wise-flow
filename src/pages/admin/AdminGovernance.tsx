import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  useDeletionRequests,
  useRecycleBin,
  useReviewDeletionRequest,
  useRestoreRecord,
  usePurgeRecord,
  useDeletionPermission,
} from "@/hooks/use-deletion";
import { DeleteRecordModal } from "@/components/deletion/DeleteRecordModal";
import {
  Check, X, Eye, Loader2, RotateCcw, Trash2, ShieldAlert,
  FileText, Clock, AlertTriangle, Download,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const TYPE_LABELS: Record<string, string> = {
  crm_projects: "Project",
  crm_deals: "Deal",
  crm_companies: "Company",
  crm_contacts: "Contact",
  crm_invoices: "Invoice",
  crm_documents: "Document",
  companies: "Company",
  contacts: "Contact",
  jobs: "Job",
  engagements: "Project",
  candidates: "Candidate",
};

export default function AdminGovernance() {
  const { currentWorkspace } = useWorkspace();
  const perm = useDeletionPermission();
  const { data: requests = [], isLoading: reqLoading } = useDeletionRequests(currentWorkspace?.id);
  const { data: recycleBin = [], isLoading: binLoading } = useRecycleBin(currentWorkspace?.id);
  const reviewRequest = useReviewDeletionRequest();
  const restoreRecord = useRestoreRecord();
  const purgeRecord = usePurgeRecord();

  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [purgeTarget, setPurgeTarget] = useState<any>(null);
  const [confirmPurgeText, setConfirmPurgeText] = useState("");
  const [tab, setTab] = useState("requests");
  const [selectedBinIds, setSelectedBinIds] = useState<Set<string>>(new Set());
  const [bulkPurging, setBulkPurging] = useState(false);
  const [showBulkPurge, setShowBulkPurge] = useState(false);
  const [bulkPurgeConfirmText, setBulkPurgeConfirmText] = useState("");

  const pendingRequests = useMemo(() => requests.filter((r: any) => r.status === "pending"), [requests]);

  const handleApprove = async (req: any) => {
    await reviewRequest.mutateAsync({
      requestId: req.id,
      action: "approved",
      recordType: req.record_type,
      recordId: req.record_id,
    });
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    await reviewRequest.mutateAsync({
      requestId: rejectTarget.id,
      action: "rejected",
      notes: rejectNotes.trim() || undefined,
      recordType: rejectTarget.record_type,
      recordId: rejectTarget.record_id,
    });
    setRejectTarget(null);
    setRejectNotes("");
  };

  const handleRestore = async (item: any) => {
    await restoreRecord.mutateAsync({
      recordType: item.record_type,
      recordId: item.id,
    });
  };

  const handlePurge = async () => {
    if (!purgeTarget || confirmPurgeText !== "DELETE") return;
    await purgeRecord.mutateAsync({
      recordType: purgeTarget.record_type,
      recordId: purgeTarget.id,
    });
    setPurgeTarget(null);
    setConfirmPurgeText("");
  };

  const handleBulkPurge = async () => {
    if (bulkPurgeConfirmText !== "DELETE" || selectedBinIds.size === 0) return;
    setBulkPurging(true);
    try {
      const items = recycleBin.filter((item: any) => selectedBinIds.has(`${item.record_type}-${item.id}`));
      for (const item of items) {
        await purgeRecord.mutateAsync({
          recordType: item.record_type,
          recordId: item.id,
        });
      }
      toast.success(`${items.length} record(s) permanently purged`);
      setSelectedBinIds(new Set());
    } catch (err: any) {
      toast.error("Purge failed: " + (err.message || "Unknown error"));
    } finally {
      setBulkPurging(false);
      setShowBulkPurge(false);
      setBulkPurgeConfirmText("");
    }
  };

  const isAllBinSelected = recycleBin.length > 0 && selectedBinIds.size === recycleBin.length;
  const isSomeBinSelected = selectedBinIds.size > 0 && selectedBinIds.size < recycleBin.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Governance</h1>
        <p className="text-muted-foreground text-sm">
          Manage deletion requests, recover deleted records, and audit data changes.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="requests" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Deletion Requests
            {pendingRequests.length > 0 && (
              <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-[10px]">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="recycle" className="gap-1.5">
            <RotateCcw className="h-4 w-4" />
            Recycle Bin ({recycleBin.length})
          </TabsTrigger>
        </TabsList>

        {/* DELETION REQUESTS TAB */}
        <TabsContent value="requests">
          <Card>
            <CardContent className="p-0">
              {reqLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : requests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No deletion requests.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Record</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-36">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.record_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {TYPE_LABELS[r.record_type] || r.record_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{r.reason}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(r.requested_at), "dd MMM yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[r.status] || ""} variant="secondary">
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {r.status === "pending" && perm.canReviewRequests && (
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Approve"
                                disabled={reviewRequest.isPending}
                                onClick={() => handleApprove(r)}
                              >
                                <Check className="w-4 h-4 text-green-600" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Reject"
                                onClick={() => {
                                  setRejectTarget(r);
                                  setRejectNotes("");
                                }}
                              >
                                <X className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                          {r.status !== "pending" && (
                            <span className="text-xs text-muted-foreground">
                              {r.review_notes || "—"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* RECYCLE BIN TAB */}
        <TabsContent value="recycle">
          <Card>
            <CardContent className="p-0">
              {selectedBinIds.size > 0 && perm.canPurge && (
                <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-destructive/5">
                  <span className="text-sm font-medium">{selectedBinIds.size} selected</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => { setShowBulkPurge(true); setBulkPurgeConfirmText(""); }}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Purge Selected
                  </Button>
                </div>
              )}
              {binLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : recycleBin.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Recycle bin is empty.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={isAllBinSelected}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedBinIds(new Set(recycleBin.map((item: any) => `${item.record_type}-${item.id}`)));
                            } else {
                              setSelectedBinIds(new Set());
                            }
                          }}
                          className={isSomeBinSelected ? "opacity-50" : ""}
                        />
                      </TableHead>
                      <TableHead>Record</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Deleted</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Purges in</TableHead>
                      <TableHead className="w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recycleBin.map((item: any) => {
                      const purgeDate = item.deletion_scheduled_purge_at
                        ? new Date(item.deletion_scheduled_purge_at)
                        : null;
                      const daysLeft = purgeDate
                        ? Math.max(0, Math.ceil((purgeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                        : null;

                      const rowKey = `${item.record_type}-${item.id}`;
                      return (
                        <TableRow key={rowKey}>
                          <TableCell>
                            <Checkbox
                              checked={selectedBinIds.has(rowKey)}
                              onCheckedChange={(checked) => {
                                const next = new Set(selectedBinIds);
                                if (checked) next.add(rowKey); else next.delete(rowKey);
                                setSelectedBinIds(next);
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{item.display_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {TYPE_LABELS[item.record_type] || item.record_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(item.deleted_at), "dd MMM yyyy")}
                          </TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">
                            {item.deletion_reason || "—"}
                          </TableCell>
                          <TableCell>
                            {daysLeft !== null && (
                              <span
                                className={
                                  daysLeft <= 3
                                    ? "text-destructive font-semibold"
                                    : "text-muted-foreground"
                                }
                              >
                                {daysLeft} days
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {perm.canRestore && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  disabled={restoreRecord.isPending}
                                  onClick={() => handleRestore(item)}
                                >
                                  <RotateCcw className="h-3 w-3 mr-1" />
                                  Restore
                                </Button>
                              )}
                              {perm.canPurge && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setPurgeTarget(item);
                                    setConfirmPurgeText("");
                                  }}
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Purge
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reject dialog */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Deletion Request</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Rejecting the request to delete{" "}
                  <strong>{rejectTarget?.record_name}</strong>.
                </p>
                <div className="space-y-1">
                  <Label className="text-sm">Rejection reason (optional)</Label>
                  <Textarea
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    placeholder="Why is this request being rejected?"
                    rows={2}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleReject} disabled={reviewRequest.isPending}>
              {reviewRequest.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Reject
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Purge confirmation dialog */}
      <AlertDialog open={!!purgeTarget} onOpenChange={(o) => !o && setPurgeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Permanently Purge Record
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will <strong>permanently delete</strong>{" "}
                  <span className="font-semibold text-foreground">
                    {purgeTarget?.display_name}
                  </span>{" "}
                  and all linked data. This cannot be undone.
                </p>
                <div className="space-y-1">
                  <Label className="text-sm">
                    Type <span className="font-mono font-bold">DELETE</span> to confirm:
                  </Label>
                  <Input
                    value={confirmPurgeText}
                    onChange={(e) => setConfirmPurgeText(e.target.value)}
                    placeholder="DELETE"
                    className="font-mono"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handlePurge}
              disabled={confirmPurgeText !== "DELETE" || purgeRecord.isPending}
            >
              {purgeRecord.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Purge Permanently
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Purge confirmation dialog */}
      <AlertDialog open={showBulkPurge} onOpenChange={(o) => { if (!o) setShowBulkPurge(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Permanently Purge {selectedBinIds.size} Record{selectedBinIds.size !== 1 ? "s" : ""}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will <strong>permanently delete</strong> all {selectedBinIds.size} selected records
                  and their linked data. This cannot be undone.
                </p>
                <div className="space-y-1">
                  <Label className="text-sm">
                    Type <span className="font-mono font-bold">DELETE</span> to confirm:
                  </Label>
                  <Input
                    value={bulkPurgeConfirmText}
                    onChange={(e) => setBulkPurgeConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="font-mono"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkPurging}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleBulkPurge}
              disabled={bulkPurgeConfirmText !== "DELETE" || bulkPurging}
            >
              {bulkPurging && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Purge {selectedBinIds.size} Permanently
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
