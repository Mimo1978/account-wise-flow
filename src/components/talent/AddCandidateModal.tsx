import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface AddCandidateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const seniorityOptions = [
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid-Level" },
  { value: "senior", label: "Senior" },
  { value: "manager", label: "Manager" },
  { value: "director", label: "Director" },
  { value: "executive", label: "Executive" },
];

const availabilityOptions = [
  { value: "available", label: "Available" },
  { value: "interviewing", label: "Interviewing" },
  { value: "deployed", label: "On Project" },
];

export function AddCandidateModal({ open, onOpenChange, onSuccess }: AddCandidateModalProps) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentTitle, setCurrentTitle] = useState("");
  const [currentCompany, setCurrentCompany] = useState("");
  const [location, setLocation] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [headline, setHeadline] = useState("");
  const [seniority, setSeniority] = useState("mid");
  const [availabilityStatus, setAvailabilityStatus] = useState("available");
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setCurrentTitle("");
    setCurrentCompany("");
    setLocation("");
    setLinkedinUrl("");
    setHeadline("");
    setSeniority("mid");
    setAvailabilityStatus("available");
    setSkillInput("");
    setSkills([]);
    setNotes("");
  };

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkill();
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Candidate name is required");
      return;
    }
    if (!currentWorkspace?.id) {
      toast.error("No workspace selected");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.from("candidates").insert({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        current_title: currentTitle.trim() || null,
        current_company: currentCompany.trim() || null,
        location: location.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
        headline: headline.trim() || null,
        availability_status: availabilityStatus,
        status: "active",
        source: "manual",
        skills: { primary_skills: skills },
        tenant_id: currentWorkspace.id,
        owner_id: user?.id || null,
      }).select("id").single();

      if (error) throw error;

      // If there are notes, save them too
      if (notes.trim() && data?.id) {
        await supabase.from("candidate_notes").insert({
          candidate_id: data.id,
          body: notes.trim(),
          owner_id: user?.id || null,
          team_id: currentWorkspace.id,
          visibility: "team",
        });
      }

      toast.success("Candidate added successfully");
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error("[AddCandidateModal] Error saving candidate:", err);
      toast.error(err.message || "Failed to add candidate");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Candidate</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Name - required */}
          <div className="grid gap-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Smith" />
          </div>

          {/* Role & Company */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="title">Job Title / Role</Label>
              <Input id="title" value={currentTitle} onChange={(e) => setCurrentTitle(e.target.value)} placeholder="e.g. Data Engineer" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company">Current Company</Label>
              <Input id="company" value={currentCompany} onChange={(e) => setCurrentCompany(e.target.value)} placeholder="e.g. Acme Corp" />
            </div>
          </div>

          {/* Seniority & Availability */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Seniority</Label>
              <Select value={seniority} onValueChange={setSeniority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {seniorityOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Availability</Label>
              <Select value={availabilityStatus} onValueChange={setAvailabilityStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availabilityOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contact info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <PhoneInput id="phone" value={phone} onChange={setPhone} />
            </div>
          </div>

          {/* Location & LinkedIn */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. New York, NY" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="linkedin">LinkedIn URL</Label>
              <Input id="linkedin" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." />
            </div>
          </div>

          {/* Headline */}
          <div className="grid gap-2">
            <Label htmlFor="headline">Headline / Summary</Label>
            <Input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Brief professional headline" />
          </div>

          {/* Skills */}
          <div className="grid gap-2">
            <Label>Skills</Label>
            <div className="flex gap-2">
              <Input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleSkillKeyDown}
                placeholder="Type a skill and press Enter"
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={addSkill}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="gap-1 pr-1">
                    {skill}
                    <button onClick={() => removeSkill(skill)} className="ml-0.5 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any initial notes about this candidate..." rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Add Candidate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
