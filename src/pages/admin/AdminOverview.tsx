import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Building2, Megaphone, Target, FileCheck, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Counts {
  contacts: number | null;
  companies: number | null;
  campaigns: number | null;
  targets: number | null;
  pendingRequests: number | null;
}

export default function AdminOverview() {
  const { currentWorkspace } = useWorkspace();
  const [counts, setCounts] = useState<Counts>({
    contacts: null, companies: null, campaigns: null, targets: null, pendingRequests: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentWorkspace?.id) return;
    const wid = currentWorkspace.id;

    async function fetchCounts() {
      setLoading(true);
      setError(null);
      try {
        const [contactsRes, companiesRes, campaignsRes, targetsRes, requestsRes] = await Promise.all([
          supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('team_id', wid).is('deleted_at', null),
          supabase.from('companies').select('id', { count: 'exact', head: true }).eq('team_id', wid),
          supabase.from('outreach_campaigns').select('id', { count: 'exact', head: true }).eq('workspace_id', wid),
          supabase.from('outreach_targets').select('id', { count: 'exact', head: true }).eq('workspace_id', wid),
          supabase.from('data_change_requests').select('id', { count: 'exact', head: true }).eq('workspace_id', wid).eq('status', 'pending'),
        ]);

        const firstError = [contactsRes, companiesRes, campaignsRes, targetsRes, requestsRes].find(r => r.error);
        if (firstError?.error) {
          setError(firstError.error.message);
        }

        setCounts({
          contacts: contactsRes.count ?? 0,
          companies: companiesRes.count ?? 0,
          campaigns: campaignsRes.count ?? 0,
          targets: targetsRes.count ?? 0,
          pendingRequests: requestsRes.count ?? 0,
        });
      } catch (e: any) {
        setError(e.message ?? 'Failed to load metrics');
      } finally {
        setLoading(false);
      }
    }

    fetchCounts();
  }, [currentWorkspace?.id]);

  const cards = [
    { label: 'Contacts', value: counts.contacts, icon: Users, color: 'text-blue-500' },
    { label: 'Companies', value: counts.companies, icon: Building2, color: 'text-emerald-500' },
    { label: 'Campaigns', value: counts.campaigns, icon: Megaphone, color: 'text-violet-500' },
    { label: 'Targets', value: counts.targets, icon: Target, color: 'text-orange-500' },
    { label: 'Pending Approvals', value: counts.pendingRequests, icon: FileCheck, color: 'text-amber-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground text-sm">Workspace health at a glance.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={cn('w-4 h-4', c.color)} />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              ) : (
                <p className="text-2xl font-bold">{c.value?.toLocaleString() ?? '—'}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
