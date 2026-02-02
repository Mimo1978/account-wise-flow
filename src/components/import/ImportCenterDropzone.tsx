import { useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileSpreadsheet,
  ClipboardPaste,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportCenterDropzoneProps {
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadedFile: File | null;
  pastedData: string;
  onPastedDataChange: (data: string) => void;
  onPasteConfirm: () => void;
  isProcessing: boolean;
  allowedFileTypes?: string[];
  showPasteOption?: boolean;
}

export function ImportCenterDropzone({
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  uploadedFile,
  pastedData,
  onPastedDataChange,
  onPasteConfirm,
  isProcessing,
  allowedFileTypes = [".csv", ".xlsx"],
  showPasteOption = true,
}: ImportCenterDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6 py-4">
      {/* File Upload Zone */}
      <div>
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Upload CSV / XLSX
        </h3>
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          className={cn(
            "relative border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer",
            isDragging
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50 hover:bg-muted/50",
            isProcessing && "opacity-50 cursor-wait"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={allowedFileTypes.join(",")}
            onChange={onFileSelect}
            className="hidden"
            disabled={isProcessing}
          />
          <div className="flex flex-col items-center text-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Drop files here</p>
              <p className="text-sm text-muted-foreground">or click to browse</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs">CSV</Badge>
              <Badge variant="outline" className="text-xs">XLSX</Badge>
            </div>
          </div>
        </div>
        {uploadedFile && (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            {uploadedFile.name}
          </div>
        )}
      </div>

      {/* Paste Option */}
      {showPasteOption && (
        <div>
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <ClipboardPaste className="h-4 w-4" />
            Copy / Paste Table
          </h3>
          <Textarea
            placeholder="Paste data from Excel, Google Sheets, or any table... (include headers)"
            value={pastedData}
            onChange={(e) => onPastedDataChange(e.target.value)}
            className="min-h-[120px] font-mono text-sm"
            disabled={isProcessing}
          />
          {pastedData.trim() && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={onPasteConfirm}
              disabled={isProcessing}
            >
              Use Pasted Data
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
