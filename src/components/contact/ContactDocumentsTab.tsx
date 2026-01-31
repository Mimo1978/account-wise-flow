import { Contact } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Download, 
  Eye, 
  Upload, 
  File, 
  FileSpreadsheet,
  FilePen,
  Folder,
  Plus
} from "lucide-react";
import { toast } from "sonner";

interface ContactDocumentsTabProps {
  contact: Contact;
}

interface Document {
  id: string;
  name: string;
  type: "cv" | "job_spec" | "proposal" | "bid" | "contract" | "nda" | "sow" | "other";
  dateAdded: string;
  linkedProject?: string;
  size: string;
}

const documentTypeConfig = {
  cv: { label: "CV", icon: FileText, className: "text-blue-500" },
  job_spec: { label: "Job Spec", icon: FilePen, className: "text-purple-500" },
  proposal: { label: "Proposal", icon: FileSpreadsheet, className: "text-green-500" },
  bid: { label: "Bid", icon: File, className: "text-amber-500" },
  contract: { label: "Contract", icon: FileText, className: "text-red-500" },
  nda: { label: "NDA", icon: FileText, className: "text-pink-500" },
  sow: { label: "SOW", icon: FileText, className: "text-cyan-500" },
  other: { label: "Other", icon: File, className: "text-muted-foreground" },
};

export function ContactDocumentsTab({ contact }: ContactDocumentsTabProps) {
  // Mock documents - in real app, this would come from the database
  const documents: Document[] = [
    { 
      id: "1", 
      name: "Q1 2025 Proposal - Cloud Migration.pdf", 
      type: "proposal", 
      dateAdded: "2025-01-20", 
      linkedProject: "Cloud Infrastructure Modernization",
      size: "2.4 MB"
    },
    { 
      id: "2", 
      name: "Master Service Agreement.pdf", 
      type: "contract", 
      dateAdded: "2024-11-15",
      size: "1.1 MB"
    },
    { 
      id: "3", 
      name: "NDA - Signed.pdf", 
      type: "nda", 
      dateAdded: "2024-10-01",
      size: "245 KB"
    },
    { 
      id: "4", 
      name: "Technical Requirements Spec.docx", 
      type: "job_spec", 
      dateAdded: "2025-01-18",
      linkedProject: "API Integration Project",
      size: "890 KB"
    },
  ];

  const handleDownload = (doc: Document) => {
    toast.success(`Downloading ${doc.name}`);
  };

  const handlePreview = (doc: Document) => {
    toast.info(`Opening preview for ${doc.name}`);
  };

  const handleUpload = () => {
    toast.info("Upload document feature coming soon");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Documents & Attachments</h3>
        <Button size="sm" onClick={handleUpload}>
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          Upload
        </Button>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed border-border">
          <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            No documents attached to this contact yet.
          </p>
          <Button size="sm" variant="outline" onClick={handleUpload}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Document
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => {
            const typeConfig = documentTypeConfig[doc.type];
            const Icon = typeConfig.icon;
            
            return (
              <div 
                key={doc.id}
                className="bg-card rounded-lg p-4 border border-border hover:border-primary/20 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg bg-muted ${typeConfig.className}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {typeConfig.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{doc.size}</span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">{doc.dateAdded}</span>
                        </div>
                        {doc.linkedProject && (
                          <p className="text-xs text-primary mt-1.5">
                            Linked to: {doc.linkedProject}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0"
                          onClick={() => handlePreview(doc)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0"
                          onClick={() => handleDownload(doc)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Document Categories Summary */}
      <div className="pt-4 border-t border-border">
        <h4 className="text-sm font-medium mb-3">By Category</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(documentTypeConfig).slice(0, 4).map(([key, config]) => {
            const Icon = config.icon;
            const count = documents.filter(d => d.type === key).length;
            return (
              <div 
                key={key}
                className="bg-muted/50 rounded-lg p-3 text-center"
              >
                <Icon className={`h-5 w-5 mx-auto mb-1 ${config.className}`} />
                <p className="text-xs text-muted-foreground">{config.label}</p>
                <p className="text-lg font-semibold">{count}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
