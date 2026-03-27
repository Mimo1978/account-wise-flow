import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Talent } from "@/lib/types";

interface CandidateEditFormProps {
  candidate: Talent;
  onSave: () => void;
  onCancel: () => void;
}

export function CandidateEditForm({ candidate, onSave, onCancel }: CandidateEditFormProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: candidate.name || "",
    title: candidate.roleType || "",
    email: candidate.email || "",
    phone: candidate.phone || "",
    location: candidate.location || "",
    availability: candidate.availability || "available",
    seniority: candidate.seniority || "mid",
    linkedin: candidate.linkedIn || "",
    skills: candidate.skills?.join(", ") || "",
    notes: candidate.headline || "",
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("candidates")
      .update({
        name: form.name.trim(),
        current_title: form.title.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        location: form.location.trim() || null,
        availability_status: form.availability,
        linkedin_url: form.linkedin.trim() || null,
        skills: form.skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        headline: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", candidate.id);

    setSaving(false);

    if (!error) {
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["candidate", candidate.id] });
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      onSave();
    } else {
      toast.error("Failed to save changes");
    }
  };

  return (
    <div className="space-y-5 py-6">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" value={form.name} onChange={(e) => update("name", e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Current Title / Role Type</Label>
        <Input id="title" value={form.title} onChange={(e) => update("title", e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input id="location" value={form.location} onChange={(e) => update("location", e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Availability</Label>
          <Select value={form.availability} onValueChange={(v) => update("availability", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="unavailable">Unavailable</SelectItem>
              <SelectItem value="open_to_opportunities">Open to Opportunities</SelectItem>
              <SelectItem value="interviewing">Interviewing</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Seniority</Label>
          <Select value={form.seniority} onValueChange={(v) => update("seniority", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="junior">Junior</SelectItem>
              <SelectItem value="mid">Mid-Level</SelectItem>
              <SelectItem value="senior">Senior</SelectItem>
              <SelectItem value="lead">Lead</SelectItem>
              <SelectItem value="director">Director</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="linkedin">LinkedIn URL</Label>
        <Input id="linkedin" value={form.linkedin} onChange={(e) => update("linkedin", e.target.value)} placeholder="https://linkedin.com/in/..." />
      </div>

      <div className="space-y-2">
        <Label htmlFor="skills">Skills (comma-separated)</Label>
        <Input id="skills" value={form.skills} onChange={(e) => update("skills", e.target.value)} placeholder="React, TypeScript, Node.js" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Headline / Bio</Label>
        <Textarea id="notes" value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={3} />
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
