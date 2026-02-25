import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Building2, Briefcase, CalendarClock, FileText } from 'lucide-react';
import { format } from 'date-fns';
import type { Sow } from '@/hooks/use-sows';

interface Props {
  sow: Sow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'destructive'> = {
  draft: 'secondary',
  signed: 'default',
  expired: 'destructive',
};

export function SowDetailSheet({ sow, open, onOpenChange }: Props) {
  if (!sow) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-muted-foreground" />
            {sow.sow_ref || 'SOW Details'}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_BADGE[sow.status] ?? 'secondary'} className="capitalize">
              {sow.status}
            </Badge>
            <Badge variant="outline" className="capitalize text-xs">
              {sow.billing_model.replace('_', ' ')}
            </Badge>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Company</p>
              <p className="font-medium text-foreground">{sow.companies?.name ?? '—'}</p>
            </div>

            {sow.engagements?.name && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Project</p>
                <p className="font-medium text-foreground">{sow.engagements.name}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Value</p>
                <p className="font-medium text-foreground">
                  {sow.value > 0 ? `${sow.currency} ${sow.value.toLocaleString()}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Start Date</p>
                <p className="font-medium text-foreground">
                  {sow.start_date ? format(new Date(sow.start_date), 'dd MMM yyyy') : '—'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">End Date</p>
                <p className="font-medium text-foreground">
                  {sow.end_date ? format(new Date(sow.end_date), 'dd MMM yyyy') : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Renewal Date</p>
                <p className="font-medium text-foreground">
                  {sow.renewal_date ? format(new Date(sow.renewal_date), 'dd MMM yyyy') : '—'}
                </p>
              </div>
            </div>

            {sow.notes && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                <p className="text-foreground whitespace-pre-wrap">{sow.notes}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-border">
            {sow.engagement_id && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/projects/${sow.engagement_id}`} className="gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" />
                  Open Project
                </Link>
              </Button>
            )}
            {sow.company_id && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/companies" className="gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  Open Company
                </Link>
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
