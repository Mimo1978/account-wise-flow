import { useState } from 'react';
import { Download } from 'lucide-react';
import { TalentDocument } from '@/lib/talent-document-types';
import { Button } from '@/components/ui/button';
import { CVNativeRenderer } from '@/components/talent/CVNativeRenderer';

interface CVInlineViewerProps {
  document: TalentDocument;
  talentId: string;
}

export function CVInlineViewer({ document }: CVInlineViewerProps) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  return (
    <div className="w-full space-y-6">
      <CVNativeRenderer
        document={document}
        emptyHeightClassName="h-[60vh]"
        loadingLabel="Loading CV..."
        onResolvedOriginalUrl={setDownloadUrl}
      />
      {downloadUrl && (
        <div className="flex justify-end">
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
