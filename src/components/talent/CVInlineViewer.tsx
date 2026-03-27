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

  const isPDF = document.fileName?.toLowerCase().endsWith('.pdf') ||
                document.fileType?.toLowerCase().includes('pdf');

  useEffect(() => {
    setLoading(true);
    setPdfUrl(null);
    const path = (document as any).pdf_storage_path || document.filePath;
    if (!path) { setLoading(false); return; }
    supabase.storage
      .from('talent-documents')
      .createSignedUrl(path, 3600)
      .then(({ data }) => { setPdfUrl(data?.signedUrl || null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [document.id]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '12px' }}>
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#6b7280' }} />
      <p style={{ color: '#6b7280', fontSize: '14px' }}>Loading CV...</p>
    </div>
  );

  if (pdfUrl) return (
    <iframe
      src={pdfUrl}
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
