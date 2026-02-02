import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Bookmark } from "lucide-react";

interface SaveSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onSave: (data: { name: string; description?: string; query_string: string; mode: "boolean" }) => void;
  isLoading?: boolean;
}

export function SaveSearchModal({
  open,
  onOpenChange,
  query,
  onSave,
  isLoading,
}: SaveSearchModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSave = () => {
    if (!name.trim()) return;
    
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      query_string: query,
      mode: "boolean",
    });
    
    // Reset form
    setName("");
    setDescription("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setName("");
      setDescription("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-primary" />
            Save Boolean Search
          </DialogTitle>
          <DialogDescription>
            Save this search to quickly rerun it later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Query preview */}
          <div className="rounded-md bg-muted/50 p-3 border">
            <Label className="text-xs text-muted-foreground mb-1 block">Query</Label>
            <code className="text-sm font-mono text-foreground break-all">
              {query}
            </code>
          </div>

          {/* Name input */}
          <div className="space-y-2">
            <Label htmlFor="search-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="search-name"
              placeholder="e.g., Senior Java Contractors - London"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Description input */}
          <div className="space-y-2">
            <Label htmlFor="search-description">
              Description <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Textarea
              id="search-description"
              placeholder="e.g., Q1 Cloud Architects for Project X"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!name.trim() || isLoading}
          >
            {isLoading ? "Saving..." : "Save Search"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
