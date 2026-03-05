import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEmailTemplates, useCreateEmailTemplate, useUpdateEmailTemplate, useDeleteEmailTemplate, EmailTemplate } from "@/hooks/use-email-templates";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import { Plus, Pencil, Trash2, ChevronLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { TipTapEditor } from "@/components/communications/TipTapEditor";

export default function EmailTemplatesSettings() {
  const navigate = useNavigate();
  const { data: templates = [], isLoading } = useEmailTemplates();
  const createMut = useCreateEmailTemplate();
  const updateMut = useUpdateEmailTemplate();
  const deleteMut = useDeleteEmailTemplate();

  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");

  const openCreate = () => {
    setEditing(null);
    setName("");
    setSubject("");
    setBodyHtml("");
    setPanelOpen(true);
  };

  const openEdit = (t: EmailTemplate) => {
    setEditing(t);
    setName(t.name);
    setSubject(t.subject);
    setBodyHtml(t.body_html);
    setPanelOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !subject.trim()) {
      toast.error("Name and Subject are required");
      return;
    }
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, name, subject, body_html: bodyHtml });
      } else {
        await createMut.mutateAsync({ name, subject, body_html: bodyHtml });
      }
      toast.success("Template saved");
      setPanelOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Template deleted");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const mergeTags = ["{{first_name}}", "{{last_name}}", "{{company_name}}", "{{invoice_number}}", "{{deal_value}}"];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 text-muted-foreground hover:text-foreground -ml-2 mb-2">
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          <h1 className="text-2xl font-bold">Email Templates</h1>
          <p className="text-muted-foreground text-sm mt-1">Create reusable email templates with merge tags.</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> New Template</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template Name</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              ) : templates.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No templates yet</TableCell></TableRow>
              ) : (
                templates.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-[200px]">{t.subject}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit Template" : "New Template"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Follow-up email" />
            </div>
            <div>
              <Label>Subject *</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Following up on our conversation, {{first_name}}" />
              <p className="text-xs text-muted-foreground mt-1">
                Available tags: {mergeTags.join(", ")}
              </p>
            </div>
            <div>
              <Label>Body</Label>
              <div className="flex gap-1 flex-wrap mb-2">
                {mergeTags.map(tag => (
                  <Button
                    key={tag}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setBodyHtml(prev => prev + tag)}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
              <TipTapEditor content={bodyHtml} onChange={setBodyHtml} />
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>Save</Button>
              <Button variant="outline" onClick={() => setPanelOpen(false)}>Cancel</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
