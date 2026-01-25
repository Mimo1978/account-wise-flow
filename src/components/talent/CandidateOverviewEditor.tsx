import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, Save, X } from "lucide-react";
import { toast } from "sonner";

interface CandidateOverviewEditorProps {
  candidateId: string;
  initialOverview: string;
  canEdit: boolean;
}

export function CandidateOverviewEditor({
  candidateId,
  initialOverview,
  canEdit,
}: CandidateOverviewEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [overview, setOverview] = useState(initialOverview);
  const [editedOverview, setEditedOverview] = useState(initialOverview);

  const handleSave = async () => {
    // In a real implementation, this would update the candidate's aiOverview field
    // For now, we'll just update local state and show a success message
    setOverview(editedOverview);
    setIsEditing(false);
    toast.success("Overview updated");
  };

  const handleCancel = () => {
    setEditedOverview(overview);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="space-y-3">
        <Textarea
          value={editedOverview}
          onChange={(e) => setEditedOverview(e.target.value)}
          className="min-h-[120px] resize-none"
          placeholder="Enter AI-generated candidate overview..."
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
        {overview}
      </p>
      {canEdit && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsEditing(true)}
        >
          <Edit2 className="h-4 w-4 mr-2" />
          Edit Overview
        </Button>
      )}
    </div>
  );
}
