import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Loader2, Users, GitMerge, ExternalLink, AlertTriangle, Search, Download, Mail, Briefcase, Building2, FolderTree, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useWorkspaceSettings, DataQualityRules } from '@/hooks/use-workspace-settings';
import { usePermissions } from '@/hooks/use-permissions';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { DuplicateDetectionPanel } from '@/components/contact/DuplicateDetectionPanel';
import type { Contact } from '@/lib/types';

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

interface CompletenessStats {
  total: number;
  missingEmail: number;
  missingTitle: number;
  missingDepartment: number;
  missingCompany: number;
}

type MissingField = 'email' | 'title';

export default function AdminDataQuality() {
  const { currentWorkspace } = useWorkspace();
  const { settings, isLoading: settingsLoading, updateSettings, isUpdating } = useWorkspaceSettings();
  const { role } = usePermissions();
  const navigate = useNavigate();

  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [recentMerges, setRecentMerges] = useState<RecentMerge[]>([]);
  const [loading, setLoading] = useState(true);
  const [completeness, setCompleteness] = useState<CompletenessStats>({ total: 0, missingEmail: 0, missingTitle: 0, missingDepartment: 0, missingCompany: 0 });
  const [exporting, setExporting] = useState<MissingField | null>(null);

  // Duplicate panel state
  const [dupPanelOpen, setDupPanelOpen] = useState(false);
  const [allContacts, setAllContacts] = useState<(Contact & { _companyName?: string; _companyId?: string })[]>([]);

  // Policy state derived from settings
  const dqRules: DataQualityRules = (settings as any)?.data_quality_rules ?? {
    require_manager_approval_for_merge: true,
    auto_suggest_canonical: true,
    block_cross_company_merge_for_non_managers: true,
  };

  const isAdminOrManager = role === 'admin' || role === 'manager';

  const fetchData = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);

    try {
      // Fetch contacts for duplicate detection and completeness stats
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name, email, title, department, company_id, phone, seniority, location, status, verification_status, notes, owner_id, team_id, created_at, updated_at, deleted_at, manager_id, email_private')
        .eq('team_id', currentWorkspace.id)
        .is('deleted_at', null);

      const contactList = contacts ?? [];

      // Completeness stats
      const total = contactList.length;
      setCompleteness({
        total,
        missingEmail: contactList.filter(c => !c.email).length,
        missingTitle: contactList.filter(c => !c.title).length,
        missingDepartment: contactList.filter(c => !c.department).length,
        missingCompany: contactList.filter(c => !c.company_id).length,
      });

      // Store contacts for duplicate panel
      setAllContacts(contactList as any);

      // Group by lowercase name for duplicates
      const groups = new Map<string, DuplicateGroup>();
      contactList.forEach((c) => {
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

  const handlePolicyToggle = (key: keyof DataQualityRules, checked: boolean) => {
    const updated = { ...dqRules, [key]: checked };
    updateSettings({ data_quality_rules: updated } as any);
  };

  const pct = (num: number, denom: number) => denom === 0 ? 0 : Math.round((num / denom) * 100);

  // CSV export helper
  const exportMissingCSV = async (field: MissingField) => {
    if (!currentWorkspace?.id) return;
    setExporting(field);

    try {
      const columnFilter = field === 'email' ? 'email' : 'title';
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name, email, title, department, company_id')
        .eq('team_id', currentWorkspace.id)
        .is('deleted_at', null)
        .is(columnFilter, null);

      if (!contacts?.length) {
        toast.info(`No contacts missing ${field}`);
        setExporting(null);
        return;
      }

      const headers = ['id', 'name', 'email', 'title', 'department', 'company_id'];
      const rows = contacts.map(c =>
        headers.map(h => {
          const val = (c as any)[h];
          return val == null ? '' : String(val).replace(/"/g, '""');
        }).join(',')
      );
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts_missing_${field}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${contacts.length} contacts missing ${field}`);
    } catch (err) {
      toast.error('Export failed');
      console.error(err);
    } finally {
      setExporting(null);
    }
  };

  const totalDuplicateContacts = duplicateGroups.reduce((sum, g) => sum + g.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Data Quality Control Center</h1>
          <p className="text-muted-foreground text-sm">Monitor data completeness, manage duplicates, and enforce merge governance.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </Button>
      </div>

      {/* Data Completeness */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data Completeness</CardTitle>
          <CardDescription>Percentage of active contacts missing key fields.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {([
                { label: 'Missing Email', icon: Mail, value: completeness.missingEmail, color: 'text-red-500' },
                { label: 'Missing Title', icon: Briefcase, value: completeness.missingTitle, color: 'text-amber-500' },
                { label: 'Missing Department', icon: FolderTree, value: completeness.missingDepartment, color: 'text-amber-500' },
                { label: 'Missing Company', icon: Building2, value: completeness.missingCompany, color: 'text-red-500' },
              ] as const).map(({ label, icon: Icon, value, color }) => (
                <div key={label} className="rounded-lg border border-border p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold">{pct(value, completeness.total)}%</span>
                    <span className="text-xs text-muted-foreground">({value}/{completeness.total})</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${value / completeness.total > 0.3 ? 'bg-red-500' : value / completeness.total > 0.1 ? 'bg-amber-500' : 'bg-green-500'}`}
                      style={{ width: `${pct(value, completeness.total)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Fix Helpers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bulk Fix Helpers</CardTitle>
          <CardDescription>Export lists of contacts with missing data for offline correction.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportMissingCSV('email')}
              disabled={exporting !== null || loading}
              className="gap-1.5"
            >
              {exporting === 'email' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export Missing Emails (CSV)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportMissingCSV('title')}
              disabled={exporting !== null || loading}
              className="gap-1.5"
            >
              {exporting === 'title' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export Missing Titles (CSV)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Duplicate stats + launch */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Duplicate Groups</CardDescription>
            <CardTitle className="text-3xl">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : duplicateGroups.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Contacts sharing the same name</p>
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
            <p className="text-xs text-muted-foreground">Total contacts in duplicate groups</p>
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
            <p className="text-xs text-muted-foreground">Merges recorded in audit log</p>
          </CardContent>
        </Card>
      </div>

      {/* Duplicate Manager Launch */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Duplicate Manager</CardTitle>
            <CardDescription>Open the full duplicate detection and resolution panel.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDupPanelOpen(true)}
              disabled={loading || allContacts.length === 0}
              className="gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              Open Duplicate Panel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/contacts')}
              className="gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Contacts
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : duplicateGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No duplicates detected.</p>
          ) : (
            <div className="space-y-2">
              {duplicateGroups.slice(0, 10).map((group, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-md border border-border">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{group.name}</span>
                  </div>
                  <Badge variant="secondary">{group.count} contacts</Badge>
                </div>
              ))}
              {duplicateGroups.length > 10 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{duplicateGroups.length - 10} more groups
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Duplicate Policy Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Duplicate Policy Settings</CardTitle>
          <CardDescription>Control how duplicates are detected and resolved across the workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {([
            {
              key: 'auto_suggest_canonical' as const,
              label: 'Auto-suggest canonical contact',
              description: 'Automatically score and suggest the best contact to keep when duplicates are found.',
            },
            {
              key: 'require_manager_approval_for_merge' as const,
              label: 'Require manager approval for merges',
              description: 'Contributors must submit a change request instead of merging directly.',
            },
            {
              key: 'block_cross_company_merge_for_non_managers' as const,
              label: 'Block cross-company merge for non-managers',
              description: 'Prevent contributors from merging contacts that belong to different companies.',
            },
          ]).map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between">
              <div className="space-y-0.5 flex-1 mr-4">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <Switch
                checked={dqRules[key]}
                onCheckedChange={(checked) => handlePolicyToggle(key, checked)}
                disabled={!isAdminOrManager || isUpdating || settingsLoading}
              />
            </div>
          ))}
          {!isAdminOrManager && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Only admins and managers can change policy settings.
            </p>
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
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : recentMerges.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No merges recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {recentMerges.map((merge) => (
                <div key={merge.id} className="flex items-center justify-between px-3 py-2 rounded-md border border-border">
                  <div className="flex items-center gap-2">
                    <GitMerge className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Contact merged</p>
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

      {/* Duplicate Detection Panel (Sheet) */}
      <DuplicateDetectionPanel
        contacts={allContacts}
        open={dupPanelOpen}
        onOpenChange={setDupPanelOpen}
      />
    </div>
  );
}
