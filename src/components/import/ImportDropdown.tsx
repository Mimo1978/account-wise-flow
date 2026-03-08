import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileSpreadsheet,
  ClipboardPaste,
  ScanLine,
  ChevronDown,
  FileText,
  Sparkles,
} from "lucide-react";
import { EntityType, getEntityLabel, ImportMethod } from "./ImportCenterTypes";

// Extended import methods including smart import
export type ExtendedImportMethod = ImportMethod | "smart";

interface ImportDropdownProps {
  entityType: EntityType;
  onImportClick: (method: ImportMethod) => void;
  onSmartImportClick?: () => void;
  disabled?: boolean;
}

export function ImportDropdown({
  entityType,
  onImportClick,
  onSmartImportClick,
  disabled = false,
}: ImportDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={disabled} data-jarvis-id={`${entityType}-import-button`}>
          <Upload className="h-4 w-4" />
          Import
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {/* Bulk Import Section */}
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Bulk Import
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onImportClick("file")}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Upload CSV / Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onImportClick("paste")}>
          <ClipboardPaste className="h-4 w-4 mr-2" />
          Copy / Paste Table
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* AI-Powered Import Section */}
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          AI-Powered Import
        </DropdownMenuLabel>
        {onSmartImportClick && (
          <DropdownMenuItem onClick={onSmartImportClick}>
            <FileText className="h-4 w-4 mr-2" />
            Word Document
            <Badge variant="outline" className="ml-auto text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              AI
            </Badge>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onImportClick("ocr")}>
          <ScanLine className="h-4 w-4 mr-2" />
          Scan Image / PDF
          <Badge variant="outline" className="ml-auto text-xs">
            Beta
          </Badge>
        </DropdownMenuItem>
        {onSmartImportClick && (
          <DropdownMenuItem onClick={onSmartImportClick}>
            <Sparkles className="h-4 w-4 mr-2" />
            Smart Import (Any file)
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
