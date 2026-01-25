import { useParams, useNavigate, Link } from "react-router-dom";
import { useImportReview, ImportEntity, ImportEntityType } from "@/hooks/use-import-review";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  FileUser,
  Users,
  Network,
  StickyNote,
  CheckCheck,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EntityEditForm } from "@/components/import/EntityEditForm";
import { useState } from "react";

const entityTypeConfig: Record<ImportEntityType, { label: string; icon: React.ReactNode; color: string }> = {
  candidate: { label: "Candidate", icon: <FileUser className="h-4 w-4" />, color: "text-blue-500" },
  contact: { label: "Contact", icon: <Users className="h-4 w-4" />, color: "text-green-500" },
  org_node: { label: "Org Node", icon: <Network className="h-4 w-4" />, color: "text-purple-500" },
  note: { label: "Note", icon: <StickyNote className="h-4 w-4" />, color: "text-amber-500" },
};

const statusConfig = {
  pending_review: { label: "Pending", color: "bg-muted text-muted-foreground", icon: <Clock className="h-3.5 w-3.5" /> },
  approved: { label: "Approved", color: "bg-green-500/20 text-green-400", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  rejected: { label: "Rejected", color: "bg-red-500/20 text-red-400", icon: <XCircle className="h-3.5 w-3.5" /> },
  needs_input: { label: "Needs Input", color: "bg-yellow-500/20 text-yellow-400", icon: <AlertCircle className="h-3.5 w-3.5" /> },
};

export default function ImportReview() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const [isApprovingAll, setIsApprovingAll] = useState(false);

  const {
    isLoading,
    batch,
    entities,
    selectedEntity,
    setSelectedEntity,
    statusCounts,
    updateEntity,
    approveEntity,
    rejectEntity,
    approveAll,
  } = useImportReview(batchId);

  const handleApproveAll = async () => {
    setIsApprovingAll(true);
    await approveAll();
    setIsApprovingAll(false);
  };

  const getEntityName = (entity: ImportEntity): string => {
    const data = entity.edited_json || entity.extracted_json;
    return (data as any).personal?.full_name 
      || (data as any).name 
      || (data as any).full_name 
      || "Unknown";
  };

  const getRecordLink = (entity: ImportEntity): string | null => {
    if (!entity.created_record_id) return null;
    
    switch (entity.created_record_type) {
      case "candidate":
        return `/talent?id=${entity.created_record_id}`;
      case "contact":
        return `/contacts?id=${entity.created_record_id}`;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="border-b p-4">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex-1 flex">
          <div className="w-80 border-r p-4 space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
          <div className="flex-1 p-6">
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Import Not Found</h2>
          <p className="text-muted-foreground">This import batch doesn't exist or you don't have access.</p>
          <Button onClick={() => navigate("/talent")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Talent
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-lg font-semibold">Review Imported Data</h1>
              <p className="text-sm text-muted-foreground">
                {statusCounts.total} entities from {batch.total_files} file(s)
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Status summary badges */}
            <div className="flex items-center gap-2 text-sm">
              {statusCounts.pending > 0 && (
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {statusCounts.pending} pending
                </Badge>
              )}
              {statusCounts.approved > 0 && (
                <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-500 border-green-500/30">
                  <CheckCircle2 className="h-3 w-3" />
                  {statusCounts.approved} approved
                </Badge>
              )}
              {statusCounts.needsInput > 0 && (
                <Badge variant="outline" className="gap-1 bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                  <AlertCircle className="h-3 w-3" />
                  {statusCounts.needsInput} need input
                </Badge>
              )}
            </div>
            
            {statusCounts.pending > 0 && (
              <Button onClick={handleApproveAll} disabled={isApprovingAll}>
                {isApprovingAll ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCheck className="h-4 w-4 mr-2" />
                )}
                Accept All
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Entity list sidebar */}
        <div className="w-80 border-r flex flex-col">
          <div className="p-3 border-b bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Extracted Entities
            </p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {entities.map((entity) => {
                const typeConfig = entityTypeConfig[entity.entity_type];
                const status = statusConfig[entity.status];
                const isSelected = selectedEntity?.id === entity.id;
                const name = getEntityName(entity);
                const recordLink = getRecordLink(entity);

                return (
                  <button
                    key={entity.id}
                    onClick={() => setSelectedEntity(entity)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-all",
                      isSelected
                        ? "bg-primary/10 border-primary/30"
                        : "bg-card hover:bg-muted/50 border-transparent"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("mt-0.5", typeConfig.color)}>
                        {typeConfig.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{name}</span>
                          {entity.confidence >= 0.8 && (
                            <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={cn("text-xs", status.color)}>
                            {status.icon}
                            <span className="ml-1">{status.label}</span>
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {typeConfig.label}
                          </span>
                        </div>
                        {entity.file_name && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {entity.file_name}
                          </p>
                        )}
                        {recordLink && entity.status === "approved" && (
                          <Link
                            to={recordLink}
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open {entity.created_record_type}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

              {entities.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileUser className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No entities extracted yet</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Entity detail/edit panel */}
        <div className="flex-1 overflow-auto">
          {selectedEntity ? (
            <EntityEditForm
              entity={selectedEntity}
              onUpdate={updateEntity}
              onApprove={approveEntity}
              onReject={rejectEntity}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileUser className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select an entity to review</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
