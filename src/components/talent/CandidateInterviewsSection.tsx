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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, MoreVertical, Edit2, Trash2, Calendar, User, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type InterviewStage = "screening" | "first" | "second" | "final" | "offer" | "rejected" | "withdrawn";
type InterviewOutcome = "pending" | "passed" | "failed" | "hold" | "cancelled";

interface CandidateInterview {
  id: string;
  candidate_id: string;
  stage: InterviewStage;
  scheduled_at: string | null;
  completed_at: string | null;
  interviewer: string | null;
  outcome: InterviewOutcome;
  next_action: string | null;
  notes: string | null;
  created_at: string;
}

interface CandidateInterviewsSectionProps {
  candidateId: string;
  canEdit: boolean;
  canDelete: boolean;
}

const stageLabels: Record<InterviewStage, string> = {
  screening: "Screening",
  first: "1st Round",
  second: "2nd Round",
  final: "Final",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const stageColors: Record<InterviewStage, string> = {
  screening: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  first: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  second: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  final: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  offer: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  withdrawn: "bg-muted text-muted-foreground border-muted",
};

const outcomeLabels: Record<InterviewOutcome, string> = {
  pending: "Pending",
  passed: "Passed",
  failed: "Failed",
  hold: "On Hold",
  cancelled: "Cancelled",
};

const outcomeIcons: Record<InterviewOutcome, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5" />,
  passed: <CheckCircle className="h-3.5 w-3.5 text-green-500" />,
  failed: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  hold: <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />,
  cancelled: <XCircle className="h-3.5 w-3.5 text-muted-foreground" />,
};

export function CandidateInterviewsSection({
  candidateId,
  canEdit,
  canDelete,
}: CandidateInterviewsSectionProps) {
  const { currentWorkspace } = useWorkspace();
  const [interviews, setInterviews] = useState<CandidateInterview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingInterview, setEditingInterview] = useState<CandidateInterview | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CandidateInterview | null>(null);

  // Form state
  const [stage, setStage] = useState<InterviewStage>("screening");
  const [scheduledAt, setScheduledAt] = useState("");
  const [interviewer, setInterviewer] = useState("");
  const [outcome, setOutcome] = useState<InterviewOutcome>("pending");
  const [nextAction, setNextAction] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchInterviews();
  }, [candidateId]);

  const fetchInterviews = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("candidate_interviews")
        .select("*")
        .eq("candidate_id", candidateId)
        .order("scheduled_at", { ascending: false, nullsFirst: false });

      if (error) throw error;
      setInterviews((data || []) as CandidateInterview[]);
    } catch (err) {
      console.error("Error fetching interviews:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    try {
      const { error } = await supabase.from("candidate_interviews").insert({
        candidate_id: candidateId,
        stage,
        scheduled_at: scheduledAt || null,
        interviewer: interviewer.trim() || null,
        outcome,
        next_action: nextAction.trim() || null,
        notes: notes.trim() || null,
        team_id: currentWorkspace?.id,
      });

      if (error) throw error;

      toast.success("Interview added");
      setShowAddModal(false);
      resetForm();
      fetchInterviews();
    } catch (err: any) {
      toast.error(err.message || "Failed to add interview");
    }
  };

  const handleUpdate = async () => {
    if (!editingInterview) return;

    try {
      const { error } = await supabase
        .from("candidate_interviews")
        .update({
          stage,
          scheduled_at: scheduledAt || null,
          interviewer: interviewer.trim() || null,
          outcome,
          next_action: nextAction.trim() || null,
          notes: notes.trim() || null,
          completed_at: outcome !== "pending" ? new Date().toISOString() : null,
        })
        .eq("id", editingInterview.id);

      if (error) throw error;

      toast.success("Interview updated");
      setEditingInterview(null);
      resetForm();
      fetchInterviews();
    } catch (err: any) {
      toast.error(err.message || "Failed to update interview");
    }
  };

  const handleDelete = async (interview: CandidateInterview) => {
    try {
      const { error } = await supabase
        .from("candidate_interviews")
        .delete()
        .eq("id", interview.id);

      if (error) throw error;

      toast.success("Interview deleted");
      setDeleteConfirm(null);
      fetchInterviews();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete interview");
    }
  };

  const resetForm = () => {
    setStage("screening");
    setScheduledAt("");
    setInterviewer("");
    setOutcome("pending");
    setNextAction("");
    setNotes("");
  };

  const openEditModal = (interview: CandidateInterview) => {
    setStage(interview.stage);
    setScheduledAt(interview.scheduled_at ? interview.scheduled_at.slice(0, 16) : "");
    setInterviewer(interview.interviewer || "");
    setOutcome(interview.outcome);
    setNextAction(interview.next_action || "");
    setNotes(interview.notes || "");
    setEditingInterview(interview);
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading interviews...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Add Button */}
      {canEdit && (
        <Button variant="outline" size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Interview
        </Button>
      )}

      {/* Interviews Table/List */}
      {interviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">No interviews recorded yet.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stage</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Interviewer</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Next Action</TableHead>
                {(canEdit || canDelete) && <TableHead className="w-10"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {interviews.map((interview) => (
                <TableRow key={interview.id}>
                  <TableCell>
                    <Badge className={stageColors[interview.stage]}>
                      {stageLabels[interview.stage]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {interview.scheduled_at
                      ? format(new Date(interview.scheduled_at), "MMM d, yyyy h:mm a")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {interview.interviewer || "—"}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 text-sm">
                      {outcomeIcons[interview.outcome]}
                      {outcomeLabels[interview.outcome]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {interview.next_action || "—"}
                  </TableCell>
                  {(canEdit || canDelete) && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canEdit && (
                            <DropdownMenuItem onClick={() => openEditModal(interview)}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteConfirm(interview)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog
        open={showAddModal || !!editingInterview}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddModal(false);
            setEditingInterview(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingInterview ? "Edit Interview" : "Add Interview"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Stage</label>
                <Select value={stage} onValueChange={(v: InterviewStage) => setStage(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(stageLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Outcome</label>
                <Select value={outcome} onValueChange={(v: InterviewOutcome) => setOutcome(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(outcomeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Scheduled Date/Time</label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Interviewer</label>
              <Input
                placeholder="Interviewer name"
                value={interviewer}
                onChange={(e) => setInterviewer(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Next Action</label>
              <Input
                placeholder="Next steps..."
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Notes</label>
              <Textarea
                placeholder="Interview notes..."
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
                setEditingInterview(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={editingInterview ? handleUpdate : handleAdd}>
              {editingInterview ? "Save Changes" : "Add Interview"}
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
            <AlertDialogTitle>Delete Interview</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this interview record? This action cannot be undone.
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
