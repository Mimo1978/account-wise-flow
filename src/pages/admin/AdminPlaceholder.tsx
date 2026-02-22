import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';

interface AdminPlaceholderProps {
  title: string;
  description?: string;
}

export default function AdminPlaceholder({ title, description }: AdminPlaceholderProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Construction className="w-10 h-10 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Coming Soon</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            This section is planned for a future release. Stay tuned.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
