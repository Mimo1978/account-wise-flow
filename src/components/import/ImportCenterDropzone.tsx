import { useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileSpreadsheet,
  ClipboardPaste,
  CheckCircle2,
  FileText,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EntityType, getEntityLabel } from "./ImportCenterTypes";

interface ImportCenterDropzoneProps {
  entityType: EntityType;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadedFile: File | null;
  onClearFile?: () => void;
  pastedData: string;
  onPastedDataChange: (data: string) => void;
  onPasteConfirm: () => void;
  isProcessing: boolean;
  allowedFileTypes?: string[];
  showPasteOption?: boolean;
}

export function ImportCenterDropzone({
  entityType,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  uploadedFile,
  onClearFile,
  pastedData,
  onPastedDataChange,
  onPasteConfirm,
  isProcessing,
  allowedFileTypes = [".csv", ".xlsx"],
  showPasteOption = true,
}: ImportCenterDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4 py-4">
      {/* Unified Drop Zone - Matching Smart Import style */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !isProcessing && !uploadedFile && fileInputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 transition-all",
          !uploadedFile && "cursor-pointer",
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
        
        {uploadedFile ? (
          <div className="flex flex-col items-center text-center gap-3">
            <div className="p-4 rounded-full bg-primary/10">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="font-medium">{uploadedFile.name}</span>
              {onClearFile && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearFile();
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {(uploadedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center gap-3">
            <div className="p-4 rounded-full bg-primary/10">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-lg font-medium">Drop files here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <Badge variant="outline" className="text-xs">
                <FileSpreadsheet className="h-3 w-3 mr-1" />
                CSV
              </Badge>
              <Badge variant="outline" className="text-xs">
                <FileSpreadsheet className="h-3 w-3 mr-1" />
                Excel
              </Badge>
            </div>
          </div>
        )}
      </div>

      {/* Import Mode Info - Matching Smart Import style */}
      <div className="bg-muted/30 rounded-lg p-3 border border-muted">
        <p className="text-sm text-muted-foreground">
          <strong>Import mode:</strong> Import {getEntityLabel(entityType, true).toLowerCase()} from spreadsheet data. 
          Map columns in the next step.
        </p>
      </div>

      {/* Paste Option */}
      {showPasteOption && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ClipboardPaste className="h-4 w-4" />
            Or paste table data
          </div>
          <Textarea
            placeholder="Paste data from Excel, Google Sheets, or any table... (include headers)"
            value={pastedData}
            onChange={(e) => onPastedDataChange(e.target.value)}
            className="min-h-[100px] font-mono text-sm resize-none"
            disabled={isProcessing}
          />
          {pastedData.trim() && (
            <Button
              size="sm"
              variant="outline"
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
