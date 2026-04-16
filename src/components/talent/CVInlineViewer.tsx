import { useState, useEffect } from 'react';
import { Loader2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { TalentDocument } from '@/lib/talent-document-types';

interface CVInlineViewerProps {
  document: TalentDocument;
  talentId: string;
}

export function CVInlineViewer({ document, talentId }: CVInlineViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const getBucketCandidates = (path?: string | null) => {
    if (!path) return ['candidate_cvs', 'cv-uploads'] as const;
    const normalized = path.toLowerCase();
    if (normalized.startsWith('cv-uploads/')) return ['cv-uploads', 'candidate_cvs'] as const;
    if (normalized.startsWith('candidate_cvs/')) return ['candidate_cvs', 'cv-uploads'] as const;
    return ['candidate_cvs', 'cv-uploads'] as const;
  };

  const normalizePath = (path?: string | null) => path?.replace(/^candidate_cvs\//i, '').replace(/^cv-uploads\//i, '') || null;

  const isPDF = document.fileName?.toLowerCase().endsWith('.pdf') ||
                document.fileType?.toLowerCase().includes('pdf');

  useEffect(() => {
    let cancelled = false;

    const loadSignedUrl = async () => {
      setLoading(true);
      setPdfUrl(null);
      const preferredPath = document.pdfStoragePath || document.filePath;
      const normalizedPath = normalizePath(preferredPath);
      if (!normalizedPath) {
        if (!cancelled) setLoading(false);
        return;
      }

      for (const bucket of getBucketCandidates(preferredPath)) {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(normalizedPath, 3600);
        if (!error && data?.signedUrl) {
          if (!cancelled) {
            setPdfUrl(data.signedUrl);
            setLoading(false);
          }
          return;
        }
      }

      if (!cancelled) setLoading(false);
    };

    loadSignedUrl();
    return () => {
      cancelled = true;
    };
  }, [document.id, document.filePath, document.pdfStoragePath, talentId]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '12px' }}>
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#6b7280' }} />
      <p style={{ color: '#6b7280', fontSize: '14px' }}>Loading CV...</p>
    </div>
  );

  if (pdfUrl) return (
    <iframe
      src={isPDF || document.pdfStoragePath ? pdfUrl : `https://docs.google.com/viewer?url=${encodeURIComponent(pdfUrl)}&embedded=true`}
      style={{ width: '100%', maxWidth: '860px', height: '3000px', border: 'none', background: 'white', display: 'block', boxShadow: '0 4px 32px rgba(0,0,0,0.5)' }}
      title="CV Preview"
    />
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', flexDirection: 'column', gap: '12px' }}>
      <FileText style={{ width: 48, height: 48, color: '#374151' }} />
      <p style={{ color: '#6b7280', fontSize: '14px' }}>CV preview not available</p>
    </div>
  );
}
