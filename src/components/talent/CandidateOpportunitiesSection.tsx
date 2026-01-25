import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Plus, MoreVertical, Edit2, Trash2, Building2, Target, Calendar, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type OpportunityStatus = "submitted" | "shortlisted" | "interviewing" | "offered" | "placed" | "dropped" | "rejected";

interface CandidateOpportunity {
  id: string;
  candidate_id: string;
  company_id: string | null;
  project_name: string | null;
  role_name: string;
  status: OpportunityStatus;
  rate: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
}

interface CandidateOpportunitiesSectionProps {
  candidateId: string;
  canEdit: boolean;
  canDelete: boolean;
}

const statusLabels: Record<OpportunityStatus, string> = {
  submitted: "Submitted",
  shortlisted: "Shortlisted",
  interviewing: "Interviewing",
  offered: "Offered",
  placed: "Placed",
  dropped: "Dropped",
  rejected: "Rejected",
};

const statusColors: Record<OpportunityStatus, string> = {
  submitted: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  shortlisted: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  interviewing: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  offered: "bg-green-500/20 text-green-400 border-green-500/30",
  placed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  dropped: "bg-muted text-muted-foreground border-muted",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
};

export function CandidateOpportunitiesSection({
  candidateId,
  canEdit,
  canDelete,
}: CandidateOpportunitiesSectionProps) {
  const { currentWorkspace } = useWorkspace();
  const [opportunities, setOpportunities] = useState<CandidateOpportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<CandidateOpportunity | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CandidateOpportunity | null>(null);

  // Form state
  const [projectName, setProjectName] = useState("");
  const [roleName, setRoleName] = useState("");
  const [status, setStatus] = useState<OpportunityStatus>("submitted");
  const [rate, setRate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchOpportunities();
  }, [candidateId]);

  const fetchOpportunities = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("candidate_opportunities")
        .select("*")
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOpportunities((data || []) as CandidateOpportunity[]);
    } catch (err) {
      console.error("Error fetching opportunities:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!roleName.trim()) {
      toast.error("Role name is required");
      return;
    }

    try {
      const { error } = await supabase.from("candidate_opportunities").insert({
        candidate_id: candidateId,
        project_name: projectName.trim() || null,
        role_name: roleName.trim(),
        status,
        rate: rate.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        notes: notes.trim() || null,
        team_id: currentWorkspace?.id,
      });

      if (error) throw error;

      toast.success("Opportunity added");
      setShowAddModal(false);
      resetForm();
      fetchOpportunities();
    } catch (err: any) {
      toast.error(err.message || "Failed to add opportunity");
    }
  };

  const handleUpdate = async () => {
    if (!editingOpportunity || !roleName.trim()) return;

    try {
      const { error } = await supabase
        .from("candidate_opportunities")
        .update({
          project_name: projectName.trim() || null,
          role_name: roleName.trim(),
          status,
          rate: rate.trim() || null,
          start_date: startDate || null,
          end_date: endDate || null,
          notes: notes.trim() || null,
        })
        .eq("id", editingOpportunity.id);

      if (error) throw error;

      toast.success("Opportunity updated");
      setEditingOpportunity(null);
      resetForm();
      fetchOpportunities();
    } catch (err: any) {
      toast.error(err.message || "Failed to update opportunity");
    }
  };

  const handleDelete = async (opportunity: CandidateOpportunity) => {
    try {
      const { error } = await supabase
        .from("candidate_opportunities")
        .delete()
        .eq("id", opportunity.id);

      if (error) throw error;

      toast.success("Opportunity deleted");
      setDeleteConfirm(null);
      fetchOpportunities();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete opportunity");
    }
  };

  const resetForm = () => {
    setProjectName("");
    setRoleName("");
    setStatus("submitted");
    setRate("");
    setStartDate("");
    setEndDate("");
    setNotes("");
  };

  const openEditModal = (opportunity: CandidateOpportunity) => {
    setProjectName(opportunity.project_name || "");
    setRoleName(opportunity.role_name);
    setStatus(opportunity.status);
    setRate(opportunity.rate || "");
    setStartDate(opportunity.start_date || "");
    setEndDate(opportunity.end_date || "");
    setNotes(opportunity.notes || "");
    setEditingOpportunity(opportunity);
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading opportunities...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Add Button */}
      {canEdit && (
        <Button variant="outline" size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Opportunity
        </Button>
      )}

      {/* Opportunities List */}
      {opportunities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No opportunities or projects linked yet.</p>
      ) : (
        <div className="space-y-3">
          {opportunities.map((opp) => (
            <div
              key={opp.id}
              className="p-4 rounded-lg border border-border bg-muted/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm">{opp.role_name}</h4>
                    <Badge className={statusColors[opp.status]}>
                      {statusLabels[opp.status]}
                    </Badge>
                  </div>
                  {opp.project_name && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {opp.project_name}
                    </p>
                  )}
                </div>
                {(canEdit || canDelete) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canEdit && (
                        <DropdownMenuItem onClick={() => openEditModal(opp)}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                      )}
                      {canDelete && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteConfirm(opp)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Details */}
              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
                {opp.rate && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {opp.rate}
                  </span>
                )}
                {opp.start_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(opp.start_date), "MMM d, yyyy")}
                    {opp.end_date && ` - ${format(new Date(opp.end_date), "MMM d, yyyy")}`}
                  </span>
                )}
              </div>

              {opp.notes && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {opp.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog
        open={showAddModal || !!editingOpportunity}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddModal(false);
            setEditingOpportunity(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOpportunity ? "Edit Opportunity" : "Add Opportunity"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Role Name *</label>
              <Input
                placeholder="e.g. Senior Data Engineer"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Project / Company Name</label>
              <Input
                placeholder="e.g. LSEG Data Migration"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={status} onValueChange={(v: OpportunityStatus) => setStatus(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Rate</label>
                <Input
                  placeholder="e.g. £650/day"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Notes</label>
              <Textarea
                placeholder="Additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                setEditingOpportunity(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={editingOpportunity ? handleUpdate : handleAdd}>
              {editingOpportunity ? "Save Changes" : "Add Opportunity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Opportunity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this opportunity? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
