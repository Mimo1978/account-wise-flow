import { useEffect, useRef, useState } from 'react';
import { Loader2, FileText, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { TalentDocument } from '@/lib/talent-document-types';
import { Button } from '@/components/ui/button';

interface CVInlineViewerProps {
  document: TalentDocument;
  talentId: string;
}

export function CVInlineViewer({ document, talentId }: CVInlineViewerProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const objectUrlRef = useRef<string | null>(null);

  const getBucketCandidates = (path?: string | null) => {
    if (!path) return ['candidate_cvs', 'cv-uploads', 'talent-documents'] as const;
    const normalized = path.toLowerCase();
    if (normalized.startsWith('cv-uploads/')) return ['cv-uploads', 'candidate_cvs', 'talent-documents'] as const;
    if (normalized.startsWith('candidate_cvs/')) return ['candidate_cvs', 'cv-uploads', 'talent-documents'] as const;
    if (normalized.startsWith('talent-documents/')) return ['talent-documents', 'cv-uploads', 'candidate_cvs'] as const;
    return ['candidate_cvs', 'cv-uploads', 'talent-documents'] as const;
  };

  const normalizePath = (path?: string | null) => path
    ?.replace(/^candidate_cvs\//i, '')
    .replace(/^cv-uploads\//i, '')
    .replace(/^talent-documents\//i, '') || null;

  const isPDF = document.fileName?.toLowerCase().endsWith('.pdf') ||
                document.fileType?.toLowerCase().includes('pdf') ||
                document.filePath?.toLowerCase().endsWith('.pdf') ||
                document.pdfStoragePath?.toLowerCase().endsWith('.pdf');
  const isConverting = document.pdfConversionStatus === 'pending' || document.pdfConversionStatus === 'converting';

  const replacePreviewUrl = (nextUrl: string | null) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    objectUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
  };

  useEffect(() => {
    let cancelled = false;

    const loadViewerAssets = async () => {
      setLoading(true);
      replacePreviewUrl(null);
      setDownloadUrl(null);

      const previewPath = document.pdfStoragePath || (isPDF ? document.filePath : null);

      if (previewPath) {
        const normalizedPreviewPath = normalizePath(previewPath);

        if (normalizedPreviewPath) {
          for (const bucket of getBucketCandidates(previewPath)) {
            const { data, error } = await supabase.storage.from(bucket).download(normalizedPreviewPath);

            if (!error && data) {
              if (!cancelled) {
                replacePreviewUrl(URL.createObjectURL(data));
              }
              break;
            }
          }
        }
      }

      const normalizedOriginalPath = normalizePath(document.filePath);

      if (normalizedOriginalPath) {
        for (const bucket of getBucketCandidates(document.filePath)) {
          const { data, error } = await supabase.storage.from(bucket).createSignedUrl(normalizedOriginalPath, 3600);

          if (!error && data?.signedUrl) {
            if (!cancelled) {
              setDownloadUrl(data.signedUrl);
            }
            break;
          }
        }
      }

      if (!cancelled) {
        setLoading(false);
      }
    };

    loadViewerAssets();

    return () => {
      cancelled = true;
    };
  }, [document.filePath, document.id, document.pdfStoragePath, isPDF, talentId]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  if (loading) return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Loading CV...</p>
    </div>
  );

  if (previewUrl) return (
    <iframe
      src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=1`}
      style={{ width: '100%', maxWidth: '860px', height: '3000px', border: 'none', background: 'white', display: 'block', boxShadow: '0 4px 32px rgba(0,0,0,0.5)' }}
      title="CV Preview"
    />
  );

  if (document.parsedText) {
    return (
      <div className="w-full max-w-4xl rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="whitespace-pre-wrap text-sm leading-7 text-foreground">
          {document.parsedText}
        </div>
        {downloadUrl && (
          <div className="mt-6 flex justify-end">
            <Button variant="outline" size="sm" asChild>
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                <Download className="mr-2 h-4 w-4" />
                Open original CV
              </a>
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (isConverting) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-foreground">Preparing CV preview...</p>
        <p className="text-xs text-muted-foreground">The file is attached; the preview is still being generated.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[400px] flex-col items-center justify-center gap-3 text-center">
      <FileText className="h-12 w-12 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Inline preview is not available for this file yet.</p>
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
