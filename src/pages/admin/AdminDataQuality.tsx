import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Loader2, Users, GitMerge, ExternalLink, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useWorkspaceSettings } from '@/hooks/use-workspace-settings';
import { usePermissions } from '@/hooks/use-permissions';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface DuplicateGroup {
  name: string;
  company_id: string | null;
  count: number;
}

interface RecentMerge {
  id: string;
  entity_id: string;
  changed_by: string | null;
  changed_at: string;
  diff: Record<string, unknown>;
  context: Record<string, unknown>;
}

export default function AdminDataQuality() {
  const { currentWorkspace } = useWorkspace();
  const { settings, isLoading: settingsLoading, updateSettings, isUpdating } = useWorkspaceSettings();
  const { role } = usePermissions();
  const navigate = useNavigate();

  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [recentMerges, setRecentMerges] = useState<RecentMerge[]>([]);
  const [loading, setLoading] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);

  const isAdmin = role === 'admin';

  useEffect(() => {
    if (settings) {
      const rules = (settings as any).data_quality_rules as { require_manager_approval_for_merge?: boolean } | undefined;
      setRequireApproval(rules?.require_manager_approval_for_merge ?? false);
    }
  }, [settings]);

  const fetchData = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);

    try {
      // Fetch potential duplicates: contacts with same name in same workspace
      const { data: contacts } = await supabase
        .from('contacts')
        .select('name, company_id')
        .eq('team_id', currentWorkspace.id)
        .is('deleted_at', null);

      // Group by lowercase name
      const groups = new Map<string, DuplicateGroup>();
      (contacts ?? []).forEach((c) => {
        const key = c.name.toLowerCase().trim();
        const existing = groups.get(key);
        if (existing) {
          existing.count++;
        } else {
          groups.set(key, { name: c.name, company_id: c.company_id, count: 1 });
        }
      });

      const dupes = Array.from(groups.values())
        .filter((g) => g.count > 1)
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      setDuplicateGroups(dupes);

      // Fetch recent merges from audit_log
      const { data: merges } = await supabase
        .from('audit_log')
        .select('id, entity_id, changed_by, changed_at, diff, context')
        .eq('workspace_id', currentWorkspace.id)
        .eq('entity_type', 'contact')
        .eq('action', 'merge')
        .order('changed_at', { ascending: false })
        .limit(10);

      setRecentMerges((merges ?? []) as unknown as RecentMerge[]);
    } catch (err) {
      console.error('Failed to fetch data quality info:', err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggle = (checked: boolean) => {
    setRequireApproval(checked);
    updateSettings({ data_quality_rules: { require_manager_approval_for_merge: checked } } as any);
  };

  const totalDuplicateContacts = duplicateGroups.reduce((sum, g) => sum + g.count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Quality</h1>
        <p className="text-muted-foreground text-sm">Duplicate detection overview and merge governance.</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Duplicate Groups</CardDescription>
            <CardTitle className="text-3xl">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : duplicateGroups.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Contacts sharing the same name
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Affected Contacts</CardDescription>
            <CardTitle className="text-3xl">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : totalDuplicateContacts}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Total contacts in duplicate groups
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recent Merges</CardDescription>
            <CardTitle className="text-3xl">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : recentMerges.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Merges recorded in audit log
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Merge governance toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Merge Governance</CardTitle>
          <CardDescription>Control how duplicate merges are processed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Require manager approval for merges</p>
              <p className="text-xs text-muted-foreground">
                When enabled, contributors must submit a change request instead of merging directly.
              </p>
            </div>
            <Switch
              checked={requireApproval}
              onCheckedChange={handleToggle}
              disabled={!isAdmin || isUpdating || settingsLoading}
            />
          </div>
          {!isAdmin && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Only admins can change governance settings.
            </p>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Duplicate groups */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Top Duplicate Groups</CardTitle>
            <CardDescription>Contacts that share the same name within your workspace.</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/contacts')}
            className="gap-1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Contacts
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : duplicateGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No duplicates detected.</p>
          ) : (
            <div className="space-y-2">
              {duplicateGroups.map((group, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3 py-2 rounded-md border border-border"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{group.name}</span>
                  </div>
                  <Badge variant="secondary">{group.count} contacts</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent merges */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Merges</CardTitle>
          <CardDescription>Merge actions recorded in the audit log.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : recentMerges.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No merges recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {recentMerges.map((merge) => (
                <div
                  key={merge.id}
                  className="flex items-center justify-between px-3 py-2 rounded-md border border-border"
                >
                  <div className="flex items-center gap-2">
                    <GitMerge className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        Contact merged
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(merge.changed_at), 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {merge.changed_by?.slice(0, 8) ?? 'system'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
