import { useState, useEffect } from 'react';
import { Loader2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { TalentDocument } from '@/lib/talent-document-types';

interface Props {
  document: TalentDocument;
  talentId: string;
}

export function CVInlineViewer({ document }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isPDF = document.pdfStoragePath != null
    || document.fileName?.toLowerCase().endsWith('.pdf')
    || document.fileType?.toLowerCase().includes('pdf');

  useEffect(() => {
    setLoading(true);
    setUrl(null);
    // Use converted PDF path first, fall back to original
    const path = document.pdfStoragePath || document.filePath;
    if (!path) { setLoading(false); return; }
    supabase.storage
      .from('talent-documents')
      .createSignedUrl(path, 3600)
      .then(({ data }) => { setUrl(data?.signedUrl || null); })
      .finally(() => setLoading(false));
  }, [document.id, document.pdfStoragePath, document.filePath]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '12px' }}>
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'hsl(var(--muted-foreground))' }} />
      <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '14px' }}>
        Loading CV...
      </p>
    </div>
  );

  // PDF (original or converted) — render natively in iframe
  if (isPDF && url) return (
    <iframe
      src={url}
      style={{ width: '100%', height: '100%', minHeight: '1100px', border: 'none', borderRadius: '4px', background: 'white' }}
      title="CV Preview"
    />
  );

  // DOCX with extracted text — white document panel
  const text = document.parsedText || '';
  if (text) return (
    <div style={{
      width: '100%', maxWidth: '860px',
      minHeight: '1100px', background: 'white',
      boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
      padding: '72px 80px',
      fontFamily: '"Calibri","Arial",sans-serif',
      fontSize: '11pt', lineHeight: '1.6', color: '#1a1a1a',
    }}>
      {text.split('\n').map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} style={{ height: '6px' }} />;
        const isHeader = t === t.toUpperCase()
          && t.length > 2 && t.length < 60
          && /[A-Z]{2,}/.test(t) && !/^\d/.test(t);
        const isBullet = /^[•\-\*·]/.test(t);
        if (isHeader) return (
          <p key={i} style={{ fontWeight: 700, fontSize: '10pt',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            borderBottom: '1.5px solid #1a1a1a',
            paddingBottom: '3px', marginTop: '22px',
            marginBottom: '10px' }}>
            {t}
          </p>
        );
        if (isBullet) return (
          <p key={i} style={{ paddingLeft: '20px',
            marginBottom: '3px', fontSize: '10.5pt' }}>
            {t}
          </p>
        );
        return (
          <p key={i} style={{ marginBottom: '3px',
            fontSize: '10.5pt' }}>
            {t}
          </p>
        );
      })}
    </div>
  );

  // Nothing — download prompt
  return (
    <div style={{ display: 'flex', alignItems: 'center',
                   justifyContent: 'center', height: '60vh',
                   flexDirection: 'column', gap: '12px' }}>
      <FileText style={{ width: 48, height: 48, color: 'hsl(var(--muted-foreground))' }} />
      <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '14px' }}>
        Preview not available — download to view
      </p>
    </div>
  );
}
