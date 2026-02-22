import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Building2, Megaphone, FileCheck, Loader2 } from 'lucide-react';

interface Counts {
  contacts: number | null;
  companies: number | null;
  campaigns: number | null;
  pendingRequests: number | null;
}

export default function AdminOverview() {
  const { currentWorkspace } = useWorkspace();
  const [counts, setCounts] = useState<Counts>({
    contacts: null, companies: null, campaigns: null, pendingRequests: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentWorkspace?.id) return;
    const wid = currentWorkspace.id;

    async function fetchCounts() {
      setLoading(true);
      const [contactsRes, companiesRes, campaignsRes, requestsRes] = await Promise.all([
        supabase.from('contacts').select('id', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('companies').select('id', { count: 'exact', head: true }),
        supabase.from('outreach_campaigns').select('id', { count: 'exact', head: true }).eq('workspace_id', wid).neq('status', 'archived'),
        supabase.from('data_change_requests').select('id', { count: 'exact', head: true }).eq('workspace_id', wid).eq('status', 'pending'),
      ]);

      setCounts({
        contacts: contactsRes.count ?? 0,
        companies: companiesRes.count ?? 0,
        campaigns: campaignsRes.count ?? 0,
        pendingRequests: requestsRes.count ?? 0,
      });
      setLoading(false);
    }

    fetchCounts();
  }, [currentWorkspace?.id]);

  const cards = [
    { label: 'Contacts', value: counts.contacts, icon: Users, color: 'text-blue-500' },
    { label: 'Companies', value: counts.companies, icon: Building2, color: 'text-emerald-500' },
    { label: 'Active Campaigns', value: counts.campaigns, icon: Megaphone, color: 'text-violet-500' },
    { label: 'Pending Approvals', value: counts.pendingRequests, icon: FileCheck, color: 'text-amber-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground text-sm">Workspace health at a glance.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
