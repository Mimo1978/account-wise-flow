import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronRight, History, Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: 'create' | 'update' | 'delete';
  changed_by: string | null;
  changed_at: string;
  diff: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    fields_changed?: string[];
  };
  context: Record<string, unknown>;
}

interface AuditHistorySectionProps {
  entityType: 'companies' | 'contacts';
  entityId: string;
}

const actionIcons = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
};

const actionColors = {
  create: 'bg-green-500/20 text-green-400',
  update: 'bg-blue-500/20 text-blue-400',
  delete: 'bg-red-500/20 text-red-400',
};

function formatFieldName(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/id$/i, 'ID')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function AuditLogEntry({ log }: { log: AuditLog }) {
  const Icon = actionIcons[log.action];
  const colorClass = actionColors[log.action];

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className={`p-1.5 rounded-md ${colorClass}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs capitalize">
            {log.action}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {format(new Date(log.changed_at), 'MMM d, yyyy h:mm a')}
          </span>
        </div>
        
        {log.diff.fields_changed && log.diff.fields_changed.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {log.action === 'create' && (
              <span>Record created</span>
            )}
            {log.action === 'update' && (
              <span>
                Changed: {log.diff.fields_changed.map(formatFieldName).join(', ')}
              </span>
            )}
            {log.action === 'delete' && (
              <span>Record deleted</span>
            )}
          </div>
        )}

        {log.action === 'update' && log.diff.before && log.diff.after && (
          <div className="mt-2 text-xs space-y-1">
            {log.diff.fields_changed?.slice(0, 3).map((field) => (
              <div key={field} className="flex items-center gap-2">
                <span className="text-muted-foreground">{formatFieldName(field)}:</span>
                <span className="line-through text-muted-foreground/60">
                  {String(log.diff.before?.[field] ?? '—').slice(0, 30)}
                </span>
                <span>→</span>
                <span className="text-foreground">
                  {String(log.diff.after?.[field] ?? '—').slice(0, 30)}
                </span>
              </div>
            ))}
            {(log.diff.fields_changed?.length ?? 0) > 3 && (
              <span className="text-muted-foreground">
                +{(log.diff.fields_changed?.length ?? 0) - 3} more fields
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function AuditHistorySection({ entityType, entityId }: AuditHistorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [allLogs, setAllLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);

  useEffect(() => {
    if (isExpanded && logs.length === 0) {
      fetchLogs();
    }
  }, [isExpanded, entityType, entityId]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('changed_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching audit logs:', error);
      } else {
        setLogs((data as AuditLog[]) || []);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('changed_at', { ascending: false });

      if (error) {
        console.error('Error fetching all audit logs:', error);
      } else {
        setAllLogs((data as AuditLog[]) || []);
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleViewAll = () => {
    fetchAllLogs();
    setShowAllModal(true);
  };

  return (
    <>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-muted/50 rounded-md transition-colors">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Audit History</span>
          {logs.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {logs.length}
            </Badge>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No audit history available
            </p>
          ) : (
            <>
              <div className="space-y-2">
                {logs.map((log) => (
                  <AuditLogEntry key={log.id} log={log} />
                ))}
              </div>
              {logs.length >= 10 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-2"
                  onClick={handleViewAll}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View All History
                </Button>
              )}
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={showAllModal} onOpenChange={setShowAllModal}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Full Audit History
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-2">
              {allLogs.map((log) => (
                <AuditLogEntry key={log.id} log={log} />
              ))}
              {allLogs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No audit history available
                </p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
