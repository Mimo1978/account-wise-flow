import { useState } from "react";
import { PhoneNumber, PhoneLabel } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Phone, Plus, Star, Trash2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhoneInlineEditorProps {
  phoneNumbers: PhoneNumber[];
  legacyPhone?: string;
  onSave: (phones: PhoneNumber[]) => void;
}

const phoneLabelOptions: PhoneLabel[] = ["Work", "Mobile", "Desk", "Home", "Private", "Other"];

const labelColors: Record<PhoneLabel, string> = {
  Work: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Mobile: "bg-green-500/20 text-green-400 border-green-500/30",
  Desk: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  Home: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Private: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Other: "bg-muted text-muted-foreground border-muted-foreground/30",
};

export const PhoneInlineEditor = ({
  phoneNumbers,
  legacyPhone,
  onSave,
}: PhoneInlineEditorProps) => {
  const [open, setOpen] = useState(false);
  const [phones, setPhones] = useState<PhoneNumber[]>(() => {
    if (phoneNumbers && phoneNumbers.length > 0) {
      return phoneNumbers;
    }
    // Convert legacy phone to new format
    if (legacyPhone) {
      return [{ value: legacyPhone, label: "Work" as PhoneLabel, preferred: true }];
    }
    return [];
  });

  const [newPhone, setNewPhone] = useState("");
  const [newLabel, setNewLabel] = useState<PhoneLabel>("Mobile");

  const preferredPhone = phones.find((p) => p.preferred) || phones[0];
  const additionalCount = phones.length > 1 ? phones.length - 1 : 0;

  const handleAddPhone = () => {
    if (!newPhone.trim()) return;
    const newPhoneEntry: PhoneNumber = {
      value: newPhone.trim(),
      label: newLabel,
      preferred: phones.length === 0,
    };
    setPhones([...phones, newPhoneEntry]);
    setNewPhone("");
    setNewLabel("Mobile");
  };

  const handleRemovePhone = (index: number) => {
    const updated = phones.filter((_, i) => i !== index);
    // If we removed the preferred, make first one preferred
    if (phones[index].preferred && updated.length > 0) {
      updated[0].preferred = true;
    }
    setPhones(updated);
  };

  const handleSetPreferred = (index: number) => {
    setPhones(
      phones.map((p, i) => ({
        ...p,
        preferred: i === index,
      }))
    );
  };

  const handleUpdateLabel = (index: number, label: PhoneLabel) => {
    setPhones(
      phones.map((p, i) => (i === index ? { ...p, label } : p))
    );
  };

  const handleSave = () => {
    onSave(phones);
    setOpen(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset to original on cancel
      if (phoneNumbers && phoneNumbers.length > 0) {
        setPhones(phoneNumbers);
      } else if (legacyPhone) {
        setPhones([{ value: legacyPhone, label: "Work", preferred: true }]);
      } else {
        setPhones([]);
      }
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
          {preferredPhone ? (
            <>
              <span className="text-muted-foreground truncate min-w-[100px] max-w-[160px]">
                {preferredPhone.value}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-1 py-0 h-4 font-normal",
                  labelColors[preferredPhone.label]
                )}
              >
                {preferredPhone.label}
              </Badge>
              {additionalCount > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1 py-0 h-4 bg-muted text-muted-foreground"
                >
                  +{additionalCount}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
            </>
          ) : (
            <span className="text-muted-foreground italic">—</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm flex items-center gap-1.5">
              <Phone className="h-4 w-4" />
              Phone Numbers
            </h4>
            <span className="text-xs text-muted-foreground">
              {phones.length} number{phones.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Existing phones */}
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {phones.map((phone, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 rounded-md bg-muted/30 border border-border"
              >
                <button
                  onClick={() => handleSetPreferred(index)}
                  className={cn(
                    "shrink-0 transition-colors",
                    phone.preferred
                      ? "text-yellow-500"
                      : "text-muted-foreground hover:text-yellow-500"
                  )}
                  title={phone.preferred ? "Preferred" : "Set as preferred"}
                >
                  <Star
                    className="h-4 w-4"
                    fill={phone.preferred ? "currentColor" : "none"}
                  />
                </button>
                <span className="text-sm flex-1 truncate">{phone.value}</span>
                <Select
                  value={phone.label}
                  onValueChange={(v) => handleUpdateLabel(index, v as PhoneLabel)}
                >
                  <SelectTrigger className="h-6 text-xs w-20 px-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {phoneLabelOptions.map((label) => (
                      <SelectItem key={label} value={label} className="text-xs">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  onClick={() => handleRemovePhone(index)}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Add new phone */}
          <div className="space-y-2 pt-2 border-t border-border">
            <Label className="text-xs text-muted-foreground">Add number</Label>
            <div className="flex gap-2">
              <Input
                placeholder="+1 (555) 000-0000"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="h-8 text-sm flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddPhone();
                  }
                }}
              />
              <Select
                value={newLabel}
                onValueChange={(v) => setNewLabel(v as PhoneLabel)}
              >
                <SelectTrigger className="h-8 text-xs w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {phoneLabelOptions.map((label) => (
                    <SelectItem key={label} value={label} className="text-xs">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={handleAddPhone}
                disabled={!newPhone.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Save button */}
          <Button size="sm" className="w-full" onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
