import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: any;
}

export function EditContactModal({ open, onOpenChange, contact }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    title: "",
    department: "",
    email: "",
    email_private: "",
    phone: "",
    location: "",
    seniority: "",
    notes: "",
  });

  useEffect(() => {
    if (open && contact) {
      setForm({
        name: contact.name || "",
        title: contact.title || "",
        department: contact.department || "",
        email: contact.email || "",
        email_private: contact.email_private || "",
        phone: contact.phone || "",
        location: contact.location || "",
        seniority: contact.seniority || "",
        notes: contact.notes || "",
      });
    }
  }, [open, contact]);

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("contacts")
        .update({
          name: form.name.trim(),
          title: form.title.trim() || null,
          department: form.department.trim() || null,
          email: form.email.trim() || null,
          email_private: form.email_private.trim() || null,
          phone: form.phone.trim() || null,
          location: form.location.trim() || null,
          seniority: form.seniority.trim() || null,
          notes: form.notes.trim() || null,
        })
        .eq("id", contact.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-detail", contact.id] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["all-contacts"] });
      toast.success("Contact updated");
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to update contact"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Name *</Label>
            <Input id="edit-name" value={form.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-title">Job Title</Label>
              <Input id="edit-title" value={form.title} onChange={(e) => update("title", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-dept">Department</Label>
              <Input id="edit-dept" value={form.department} onChange={(e) => update("department", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Work Email</Label>
              <Input id="edit-email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email-private">Personal Email</Label>
              <Input id="edit-email-private" type="email" value={form.email_private} onChange={(e) => update("email_private", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input id="edit-phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-location">Location</Label>
              <Input id="edit-location" value={form.location} onChange={(e) => update("location", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-seniority">Seniority</Label>
            <Input id="edit-seniority" value={form.seniority} onChange={(e) => update("seniority", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea id="edit-notes" value={form.notes} onChange={(e) => update("notes", e.target.value)} className="min-h-[80px] resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.name.trim() || mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
