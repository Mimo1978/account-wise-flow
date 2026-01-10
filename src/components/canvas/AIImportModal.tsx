import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Upload, 
  Image, 
  FileText, 
  Camera, 
  X, 
  Sparkles,
  FileImage,
  Building2
} from "lucide-react";

interface AIImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: (extractedData: any) => void;
}

type FilePreview = {
  file: File;
  preview: string;
  type: 'image' | 'pdf' | 'document';
};

export const AIImportModal = ({
  open,
  onOpenChange,
  onImportComplete,
}: AIImportModalProps) => {
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setFiles([]);
    setIsDragging(false);
    onOpenChange(false);
  };

  const getFileType = (file: File): 'image' | 'pdf' | 'document' => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type === 'application/pdf') return 'pdf';
    return 'document';
  };

  const processFiles = useCallback((fileList: FileList | File[]) => {
    const newFiles: FilePreview[] = [];
    
    Array.from(fileList).forEach((file) => {
      const type = getFileType(file);
      let preview = '';
      
      if (type === 'image') {
        preview = URL.createObjectURL(file);
      }
      
      newFiles.push({ file, preview, type });
    });
    
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const handleProcess = () => {
    // This will be connected to AI processing later
    // For now, just acknowledge the files
    if (onImportComplete) {
      onImportComplete({ files: files.map(f => f.file) });
    }
  };

  const getFileIcon = (type: FilePreview['type']) => {
    switch (type) {
      case 'image':
        return <FileImage className="h-8 w-8 text-blue-400" />;
      case 'pdf':
        return <FileText className="h-8 w-8 text-red-400" />;
      default:
        return <FileText className="h-8 w-8 text-muted-foreground" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Import
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto py-4">
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-lg p-8 transition-all cursor-pointer
              ${isDragging 
                ? 'border-primary bg-primary/10' 
                : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-blue-500/10">
                  <Image className="h-6 w-6 text-blue-500" />
                </div>
                <div className="p-3 rounded-full bg-red-500/10">
                  <FileText className="h-6 w-6 text-red-500" />
                </div>
                <div className="p-3 rounded-full bg-purple-500/10">
                  <Building2 className="h-6 w-6 text-purple-500" />
                </div>
                <div className="p-3 rounded-full bg-green-500/10">
                  <Camera className="h-6 w-6 text-green-500" />
                </div>
              </div>
              
              <div>
                <p className="font-medium text-foreground">
                  Drop files here or click to browse
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Supports images, PDFs, screenshots, org charts, and business cards
                </p>
              </div>
            </div>
          </div>

          {/* File Previews */}
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                {files.length} file{files.length > 1 ? 's' : ''} selected
              </p>
              <div className="grid grid-cols-2 gap-3">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="relative group rounded-lg border border-border bg-muted/30 p-3 flex items-center gap-3"
                  >
                    {file.type === 'image' && file.preview ? (
                      <img
                        src={file.preview}
                        alt={file.file.name}
                        className="h-12 w-12 object-cover rounded"
                      />
                    ) : (
                      getFileIcon(file.type)
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {file.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(file.file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="absolute top-1 right-1 p-1 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">AI will extract:</strong> Names, job titles, departments, emails, phone numbers, and reporting relationships from your files. Review and confirm before saving.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleProcess}
            disabled={files.length === 0}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Process with AI
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
