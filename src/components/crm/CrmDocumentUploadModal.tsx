import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCrmDocument, uploadCrmDocument, DOC_TYPE_LABELS } from "@/hooks/use-crm-documents";
import { useCrmDeals } from "@/hooks/use-crm-deals";
import { toast } from "@/hooks/use-toast";
import type { CrmDocumentType } from "@/types/crm";
import { Upload, Loader2 } from "lucide-react";

const ACCEPTED = ".pdf,.docx,.xlsx,.png,.jpg,.jpeg";
const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const DOC_TYPES: CrmDocumentType[] = ["sow", "contract", "proposal", "nda", "invoice", "other"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDealId?: string;
  defaultCompanyId?: string;
}

export function CrmDocumentUploadModal({ open, onOpenChange, defaultDealId, defaultCompanyId }: Props) {
  const createDoc = useCreateCrmDocument();
  const { data: deals = [] } = useCrmDeals();

  const [form, setForm] = useState({
    type: "sow" as CrmDocumentType,
    title: "",
    deal_id: defaultDealId || "",
    version: "1",
  });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!file) e.file = "File is required";
    else if (file.size > MAX_SIZE) e.file = "File must be under 50MB";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleUpload = async () => {
    if (!validate() || !file) return;
    setUploading(true);
    try {
      const companyId = defaultCompanyId || (form.deal_id ? deals.find(d => d.id === form.deal_id)?.company_id : null) || "unlinked";
      const dealId = form.deal_id || "general";
      const ext = file.name.split(".").pop() || "bin";
      const safeName = form.title.replace(/[^a-zA-Z0-9_-]/g, "_");
      const storagePath = `${companyId}/${dealId}/${form.type}_${safeName}_v${form.version}.${ext}`;

      await uploadCrmDocument(file, storagePath);

      await createDoc.mutateAsync({
        type: form.type,
        title: form.title,
        deal_id: form.deal_id || null,
        company_id: (defaultCompanyId || deals.find(d => d.id === form.deal_id)?.company_id) || null,
        file_url: storagePath,
        version: parseInt(form.version) || 1,
        status: "draft",
      } as any);

      toast({ title: "Document uploaded" });
      onOpenChange(false);
      setForm({ type: "sow", title: "", deal_id: defaultDealId || "", version: "1" });
      setFile(null);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Document Type *</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as CrmDocumentType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover z-[9999]">
                {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
          </div>
          <div>
            <Label>Link to Deal</Label>
            <Select value={form.deal_id} onValueChange={v => setForm(f => ({ ...f, deal_id: v === "_none" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Select deal" /></SelectTrigger>
              <SelectContent className="bg-popover z-[9999]">
                <SelectItem value="_none">None</SelectItem>
                {deals.map(d => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Version</Label>
            <Input type="number" min="1" value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} />
          </div>
          <div>
            <Label>Upload File *</Label>
            <div className="mt-1">
              <label className="flex items-center gap-2 cursor-pointer border border-dashed rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {file ? file.name : "Click to select file (PDF, DOCX, XLSX, PNG, JPG)"}
                </span>
                <input
                  type="file"
                  accept={ACCEPTED}
                  className="hidden"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
            {errors.file && <p className="text-xs text-destructive mt-1">{errors.file}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleUpload} disabled={uploading}>
            {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Uploading…</> : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
