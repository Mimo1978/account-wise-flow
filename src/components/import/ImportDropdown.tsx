import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
} from "lucide-react";
import { EntityType, getEntityLabel, ImportMethod } from "./ImportCenterTypes";

interface ImportDropdownProps {
  entityType: EntityType;
  onImportClick: (method: ImportMethod) => void;
  disabled?: boolean;
}

export function ImportDropdown({
  entityType,
  onImportClick,
  disabled = false,
}: ImportDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={disabled}>
          <Upload className="h-4 w-4" />
          Import
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => onImportClick("file")}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Upload CSV / XLSX
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onImportClick("file")}>
          <Upload className="h-4 w-4 mr-2" />
          Drag & Drop Files
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onImportClick("paste")}>
          <ClipboardPaste className="h-4 w-4 mr-2" />
          Copy / Paste Table
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onImportClick("ocr")}>
          <ScanLine className="h-4 w-4 mr-2" />
          Scan Image / PDF (OCR)
          <Badge variant="outline" className="ml-auto text-xs">
            Beta
          </Badge>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
