import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Mail, Pencil, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface PrivateEmailEditorProps {
  privateEmail?: string;
  onSave: (email: string | undefined) => void;
}

export const PrivateEmailEditor = ({
  privateEmail,
  onSave,
}: PrivateEmailEditorProps) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(privateEmail || "");
  const [error, setError] = useState("");

  const validateEmail = (value: string): boolean => {
    if (!value.trim()) return true; // Empty is valid (optional field)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value.trim());
  };

  const handleSave = () => {
    const trimmedEmail = email.trim();
    
    if (trimmedEmail && !validateEmail(trimmedEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    if (trimmedEmail.length > 255) {
      setError("Email must be less than 255 characters");
      return;
    }

    onSave(trimmedEmail || undefined);
    setError("");
    setOpen(false);
  };

  const handleRemove = () => {
    setEmail("");
    onSave(undefined);
    setOpen(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset to original on cancel
      setEmail(privateEmail || "");
      setError("");
    }
    setOpen(isOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1.5 text-left hover:bg-muted/50 rounded px-1.5 py-0.5 -mx-1.5 transition-colors group w-full"
          data-quality-action
        >
          {privateEmail ? (
            <>
              <Mail className="h-3 w-3 text-muted-foreground/70 shrink-0" />
              <span className="text-muted-foreground/70 truncate max-w-[160px]">
                {privateEmail}
              </span>
              <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0" />
            </>
          ) : (
            <span className="text-muted-foreground/50 italic flex items-center gap-1.5">
              <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span>—</span>
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm flex items-center gap-1.5">
              <Mail className="h-4 w-4" />
              Private Email
            </h4>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Personal email address (optional)
            </Label>
            <Input
              type="email"
              placeholder="personal@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              className={cn(
                "h-9 text-sm",
                error && "border-destructive focus-visible:ring-destructive"
              )}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={handleSave}>
              Save
            </Button>
            {privateEmail && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleRemove}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
