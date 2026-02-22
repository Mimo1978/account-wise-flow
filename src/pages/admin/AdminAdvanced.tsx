import { AdminSettingsPanel } from '@/components/admin/AdminSettingsPanel';
import { Badge } from '@/components/ui/badge';
import { FlaskConical } from 'lucide-react';

export default function AdminAdvanced() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FlaskConical className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Advanced
            <Badge variant="outline" className="ml-2 text-xs align-middle">Experimental</Badge>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            These settings are not yet fully wired into the product. Changes may not have visible effect.
          </p>
        </div>
      </div>

      <AdminSettingsPanel />
    </div>
  );
}
