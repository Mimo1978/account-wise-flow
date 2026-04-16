import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TalentDocument } from "@/lib/talent-document-types";
import { createSignedDocumentUrl, downloadStoredFile, getDocumentKind } from "@/lib/cv-document-utils";
import { renderAsync } from "docx-preview";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

interface CVNativeRendererProps {
  document: TalentDocument;
  className?: string;
  canvasClassName?: string;
  pageClassName?: string;
  loadingLabel?: string;
  emptyHeightClassName?: string;
  onResolvedOriginalUrl?: (url: string | null) => void;
}

type RenderState =
  | { kind: "loading" }
  | { kind: "pdf"; pages: string[] }
  | { kind: "docx" }
  | { kind: "fallback" }
  | { kind: "error"; message: string };

function revokeUrls(urls: string[]) {
  urls.forEach((url) => URL.revokeObjectURL(url));
}

export function CVNativeRenderer({
  document,
  className,
  canvasClassName,
  pageClassName,
  loadingLabel = "Loading CV...",
  emptyHeightClassName = "h-[400px]",
  onResolvedOriginalUrl,
}: CVNativeRendererProps) {
  const docxContainerRef = useRef<HTMLDivElement | null>(null);
  const [renderState, setRenderState] = useState<RenderState>({ kind: "loading" });
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const renderedPdfPagesRef = useRef<string[]>([]);

  const documentKind = useMemo(() => getDocumentKind(document), [document]);
  const isConverting = document.pdfConversionStatus === "pending" || document.pdfConversionStatus === "converting";

  useEffect(() => {
    let isActive = true;

    const loadOriginalUrl = async () => {
      const url = await createSignedDocumentUrl(document.filePath);
      if (!isActive) return;
      setDownloadUrl(url);
      onResolvedOriginalUrl?.(url);
    };

    loadOriginalUrl();

    return () => {
      isActive = false;
    };
  }, [document.filePath, onResolvedOriginalUrl]);

  useEffect(() => {
    let isCancelled = false;

    const cleanup = () => {
      if (renderedPdfPagesRef.current.length > 0) {
        revokeUrls(renderedPdfPagesRef.current);
        renderedPdfPagesRef.current = [];
      }
      if (docxContainerRef.current) {
        docxContainerRef.current.innerHTML = "";
      }
    };

    const renderPdf = async (blob: Blob) => {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      const pages: string[] = [];

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = window.document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Unable to initialize PDF canvas");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport }).promise;
        pages.push(canvas.toDataURL("image/png"));
      }

      return pages;
    };

    const renderDocx = async (blob: Blob) => {
      const container = docxContainerRef.current;
      if (!container) return false;

      container.innerHTML = "";
      await renderAsync(blob, container, container, {
        className: "cv-docx",
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        ignoreLastRenderedPageBreak: false,
        renderHeaders: true,
        renderFooters: true,
        useBase64URL: true,
      });

      return true;
    };

    const load = async () => {
      cleanup();
      setRenderState({ kind: "loading" });

      const previewPath = document.pdfStoragePath && document.pdfConversionStatus === "done"
        ? document.pdfStoragePath
        : documentKind === "pdf"
          ? document.filePath
          : null;

      try {
        if ((documentKind === "pdf" || previewPath) && previewPath) {
          const stored = await downloadStoredFile(previewPath);
          if (!stored) throw new Error("The CV file could not be found in storage.");
          const pages = await renderPdf(stored.blob);
          if (isCancelled) {
            return;
          }
          renderedPdfPagesRef.current = pages;
          setRenderState({ kind: "pdf", pages });
          return;
        }

        if (documentKind === "docx") {
          const stored = await downloadStoredFile(document.filePath);
          if (!stored) throw new Error("The Word CV file could not be found in storage.");
          await renderDocx(stored.blob);
          if (isCancelled) {
            return;
          }
          setRenderState({ kind: "docx" });
          return;
        }

        if (documentKind === "doc") {
          setRenderState({ kind: "fallback" });
          return;
        }

        setRenderState({ kind: "fallback" });
      } catch (error) {
        if (isCancelled) return;
        console.error("[CVNativeRenderer] Render failed", error);
        setRenderState({
          kind: "error",
          message: error instanceof Error ? error.message : "Unable to render this CV.",
        });
      }
    };

    load();

    return () => {
      isCancelled = true;
      cleanup();
    };
  }, [document.filePath, document.id, document.pdfConversionStatus, document.pdfStoragePath, documentKind]);

  if (renderState.kind === "loading") {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3", emptyHeightClassName, className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{loadingLabel}</p>
        {isConverting && documentKind !== "pdf" && (
          <p className="text-xs text-muted-foreground">Generating a stable PDF preview in the background.</p>
        )}
      </div>
    );
  }

  if (renderState.kind === "pdf") {
    return (
      <div className={cn("w-full space-y-6", className)}>
        {renderState.pages.map((page, index) => (
          <div key={`${document.id}-page-${index + 1}`} className={cn("mx-auto w-full max-w-[860px]", pageClassName)}>
            <img
              src={page}
              alt={`${document.fileName} page ${index + 1}`}
              className={cn("block w-full rounded-md bg-white shadow-[0_4px_32px_rgba(0,0,0,0.18)]", canvasClassName)}
              loading="lazy"
            />
          </div>
        ))}
      </div>
    );
  }

  if (renderState.kind === "docx") {
    return (
      <div className={cn("w-full", className)}>
        <div
          ref={docxContainerRef}
          className="cv-docx-shell mx-auto max-w-[860px] overflow-hidden rounded-md bg-white shadow-[0_4px_32px_rgba(0,0,0,0.18)]"
        />
      </div>
    );
  }

  const showTextFallback = Boolean(document.parsedText);

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 text-center", emptyHeightClassName, className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {renderState.kind === "error" ? <RefreshCw className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {renderState.kind === "error" ? "CV preview needs a fallback" : "Inline preview is not available for this file"}
        </p>
        <p className="max-w-md text-xs text-muted-foreground">
          {renderState.kind === "error"
            ? renderState.message
            : documentKind === "doc"
              ? "Legacy .doc files can be downloaded in their original format."
              : "Open the original file or use extracted text while preview data is prepared."}
        </p>
      </div>

      {showTextFallback && (
        <div className="w-full max-w-4xl rounded-xl border border-border bg-card p-8 text-left shadow-sm">
          <div className="whitespace-pre-wrap text-sm leading-7 text-foreground">{document.parsedText}</div>
        </div>
      )}

      {downloadUrl && (
        <Button variant="outline" size="sm" asChild>
          <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
            <Download className="mr-2 h-4 w-4" />
            Open original CV
          </a>
        </Button>
      )}
    </div>
  );
}