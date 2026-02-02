import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  ScanLine,
  FileImage,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OCRUploadStepProps {
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (file: File) => void;
  uploadedFile: File | null;
  onClearFile: () => void;
  isProcessing: boolean;
  onStartOCR: () => void;
  ocrError?: string | null;
}

const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function OCRUploadStep({
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  uploadedFile,
  onClearFile,
  isProcessing,
  onStartOCR,
  ocrError,
}: OCRUploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSelectFile(file);
    }
  };

  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSelectFile(file);
    }
    onDragLeave(e);
  };

  const validateAndSelectFile = (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return; // Invalid type, ignore
    }
    if (file.size > MAX_FILE_SIZE) {
      return; // Too large
    }

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }

    onFileSelect(file);
  };

  const handleClear = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    onClearFile();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getFileIcon = () => {
    if (!uploadedFile) return <FileImage className="h-4 w-4" />;
    if (uploadedFile.type === "application/pdf") {
      return <FileText className="h-4 w-4" />;
    }
    return <FileImage className="h-4 w-4" />;
  };

  return (
    <div className="space-y-4 py-4">
      {/* Warning Banner */}
      <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertDescription className="text-sm">
          <strong>Best Effort OCR:</strong> Results may vary based on image quality. 
          All extracted data will be shown with confidence scores for your review before import.
        </AlertDescription>
      </Alert>

      {/* OCR Upload Zone */}
      <div>
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <ScanLine className="h-4 w-4" />
          Upload Image or PDF
        </h3>
        
        {!uploadedFile ? (
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={handleDropFile}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            className={cn(
              "relative border-2 border-dashed rounded-lg p-8 transition-all cursor-pointer",
              isDragging
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50 hover:bg-muted/50",
              isProcessing && "opacity-50 cursor-wait"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              onChange={handleFileChange}
              className="hidden"
              disabled={isProcessing}
            />
            <div className="flex flex-col items-center text-center gap-3">
              <div className="p-3 rounded-full bg-primary/10">
                <ScanLine className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-medium">Drop image or PDF here</p>
                <p className="text-sm text-muted-foreground">
                  Screenshots, scanned documents, business cards, or table images
                </p>
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                <Badge variant="outline" className="text-xs">PNG</Badge>
                <Badge variant="outline" className="text-xs">JPG</Badge>
                <Badge variant="outline" className="text-xs">WEBP</Badge>
                <Badge variant="outline" className="text-xs">PDF</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Max 10MB</p>
            </div>
          </div>
        ) : (
          <div className="border rounded-lg p-4 space-y-4">
            {/* File info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                {getFileIcon()}
                <span className="font-medium truncate max-w-[300px]">
                  {uploadedFile.name}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {(uploadedFile.size / 1024).toFixed(1)} KB
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={isProcessing}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Image preview */}
            {previewUrl && (
              <div className="relative rounded-md overflow-hidden border bg-muted/30">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-[200px] w-full object-contain"
                />
              </div>
            )}

            {/* OCR Error */}
            {ocrError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{ocrError}</AlertDescription>
              </Alert>
            )}

            {/* Scan button */}
            <Button
              onClick={onStartOCR}
              disabled={isProcessing}
              className="w-full gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Extracting data...
                </>
              ) : (
                <>
                  <ScanLine className="h-4 w-4" />
                  Scan & Extract Data
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="text-sm font-medium mb-2">Tips for best results:</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Use high-resolution images with clear, readable text</li>
          <li>• Tables and structured layouts work best</li>
          <li>• Business cards should be well-lit and flat</li>
          <li>• Avoid blurry or heavily compressed images</li>
        </ul>
      </div>
    </div>
  );
}
