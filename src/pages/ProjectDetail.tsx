import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { PageBackButton } from '@/components/ui/page-back-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useEngagement, useUpdateEngagement, useCreateEngagement } from '@/hooks/use-engagements';
import { useSows } from '@/hooks/use-sows';
import { useInvoices } from '@/hooks/use-invoices';
import {
  useOutreachCampaigns,
  useOutreachTargets,
  useLinkCampaignToEngagement,
  useUnlinkCampaignFromEngagement,
  type OutreachCampaign,
  type OutreachTarget,
} from '@/hooks/use-outreach';
import { CreateSowModal } from '@/components/home/CreateSowModal';
import { CreateInvoiceModal } from '@/components/home/CreateInvoiceModal';
import { ProjectBillingTab } from '@/components/home/ProjectBillingTab';
import { CreateCampaignModal } from '@/components/outreach/CreateCampaignModal';
import { AddTargetsModal } from '@/components/outreach/AddTargetsModal';
import { OutreachTargetRow } from '@/components/outreach/OutreachTargetRow';
import { TargetDetailSheet } from '@/components/outreach/TargetDetailSheet';
import { DocumentList } from '@/components/documents/DocumentList';
import { AddEditDealPanel } from '@/components/crm/AddEditDealPanel';
import {
  ArrowLeft,
  ChevronLeft,
  Briefcase,
  Loader2,
  Plus,
  FileText,
  Receipt,
  Megaphone,
  FolderOpen,
  Calendar,
  LinkIcon,
  Users,
  ExternalLink,
  Unlink,
  ChevronDown,
  ChevronUp,
  Pencil,
  Activity,
  DollarSign,
  UserCircle,
  Search,
  Copy,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DeleteRecordModal } from '@/components/deletion/DeleteRecordModal';
import { DeletionRequestBanner } from '@/components/deletion/DeletionRequestBanner';
import { useDeletionPermission } from '@/hooks/use-deletion';
import { Trash2 as TrashIcon } from 'lucide-react';

const STAGE_LABELS: Record<string, string> = {
  pipeline: 'Pipeline',
  active: 'Active',
  on_hold: 'On Hold',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

const HEALTH_COLORS: Record<string, string> = {
  green: 'bg-success text-success-foreground',
  amber: 'bg-warning text-warning-foreground',
  red: 'bg-destructive text-destructive-foreground',
};

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  sent: 'default',
  paid: 'outline',
  overdue: 'destructive',
  void: 'secondary',
  signed: 'default',
  expired: 'destructive',
};

const CAMPAIGN_STATUS_BADGE: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  archived: 'bg-muted text-muted-foreground',
};

const TYPES = [
  { value: 'consulting', label: 'Consulting' },
  { value: 'recruitment', label: 'Recruitment' },
  { value: 'managed_service', label: 'Managed Service' },
  { value: 'other', label: 'Other' },
];

const STAGES = [
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
];

/* ─── Unified Company Search Hook ─── */
function useCompanySearch(workspaceId: string | undefined, open: boolean) {
  return useQuery({
    queryKey: ['unified-companies-list', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      // Fetch from both tables
      const [nativeRes, crmRes] = await Promise.all([
        supabase.from('companies').select('id, name, industry').eq('team_id', workspaceId).is('deleted_at', null).order('name'),
        supabase.from('crm_companies' as any).select('id, name, industry').is('deleted_at', null).order('name'),
      ]);
      const native = (nativeRes.data ?? []) as unknown as { id: string; name: string; industry: string | null }[];
      const crm = (crmRes.data ?? []) as unknown as { id: string; name: string; industry: string | null }[];
      // Deduplicate by name, prefer native (since engagements FK → companies)
      const seen = new Map<string, typeof native[0]>();
      for (const c of native) seen.set(c.name.toLowerCase(), c);
      for (const c of crm) {
        if (!seen.has(c.name.toLowerCase())) seen.set(c.name.toLowerCase(), c);
      }
      return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!workspaceId && open,
  });
}

/* ─── Resolve CRM company ID from canonical company ID ─── */
function useCrmCompanyId(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ['crm-company-id-for', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      // Find the crm_companies record linked to this canonical company
      const { data } = await supabase
        .from('crm_companies' as any)
        .select('id')
        .eq('source_company_id', companyId)
        .limit(1)
        .maybeSingle();
      return (data as any)?.id as string | null;
    },
    enabled: !!companyId,
  });
}

/* ─── Company Contacts Hook (all contacts for a company) ─── */
function useCompanyContacts(companyId: string | null | undefined) {
  const { data: crmCompanyId } = useCrmCompanyId(companyId);

  return useQuery({
    queryKey: ['company-contacts-list', companyId, crmCompanyId],
    queryFn: async () => {
      if (!companyId) return [];
      type ContactRow = { id: string; first_name: string; last_name: string; job_title: string | null };
      const seen = new Set<string>();
      const results: ContactRow[] = [];

      // 1) Query crm_contacts using the resolved CRM company ID
      if (crmCompanyId) {
        const { data } = await supabase
          .from('crm_contacts')
          .select('id, first_name, last_name, job_title')
          .eq('company_id', crmCompanyId)
          .is('deleted_at', null)
          .order('last_name');
        for (const c of (data || []) as ContactRow[]) {
          if (!seen.has(c.id)) { seen.add(c.id); results.push(c); }
        }
      }

      // 2) Also query canonical contacts table using the canonical company ID
      const { data: nativeData } = await supabase
        .from('contacts')
        .select('id, name, title')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('name');
      for (const c of (nativeData || []) as { id: string; name: string; title: string | null }[]) {
        if (!seen.has(c.id)) {
          const parts = c.name.split(' ');
          const first_name = parts[0] || '';
          const last_name = parts.slice(1).join(' ') || '';
          seen.add(c.id);
          results.push({ id: c.id, first_name, last_name, job_title: c.title });
        }
      }

      return results;
    },
    enabled: !!companyId,
  });
}

/* ─── Contact Search Hook ─── */
function useContactSearch(searchTerm: string, enabled: boolean, companyId?: string | null) {
  return useQuery({
    queryKey: ['crm-contacts-search', searchTerm, companyId],
    queryFn: async () => {
      if (!searchTerm.trim()) return [];
      let results: { id: string; first_name: string; last_name: string; job_title: string | null; fromCompany?: boolean }[] = [];
      if (companyId) {
        const { data } = await supabase
          .from('crm_contacts')
          .select('id, first_name, last_name, job_title')
          .eq('company_id', companyId)
          .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`)
          .is('deleted_at', null)
          .limit(8);
        results = ((data || []) as typeof results).map(c => ({ ...c, fromCompany: true }));
      }
      if (results.length < 5) {
        const existingIds = results.map(r => r.id);
        const { data } = await supabase
          .from('crm_contacts')
          .select('id, first_name, last_name, job_title')
          .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`)
          .is('deleted_at', null)
          .limit(8);
        const extras = ((data || []) as typeof results).filter(c => !existingIds.includes(c.id)).map(c => ({ ...c, fromCompany: false }));
        results = [...results, ...extras].slice(0, 10);
      }
      return results;
    },
    enabled: enabled && searchTerm.length > 1,
  });
}

/* ─── Inline Contact Picker ─── */
function InlineContactPicker({
  label,
  icon,
  contactId,
  engagementId,
  fieldName,
  companyId,
}: {
  label: string;
  icon: React.ReactNode;
  contactId?: string | null;
  engagementId: string;
  fieldName: 'contact_id' | 'hiring_manager_id';
  companyId?: string | null;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searching, setSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [quickCreating, setQuickCreating] = useState(false);
  const [newFirst, setNewFirst] = useState('');
  const [newLast, setNewLast] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const { data: contact } = useQuery({
    queryKey: ['engagement-contact-detail', contactId],
    queryFn: async () => {
      if (!contactId) return null;
      const { data, error } = await supabase
        .from('crm_contacts')
        .select('id, first_name, last_name, job_title')
        .eq('id', contactId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!contactId,
  });

  // All contacts for the assigned company
  const { data: companyContacts = [] } = useCompanyContacts(companyId);
  const { data: searchResults = [] } = useContactSearch(searchTerm, searching && searchTerm.length > 1, companyId);

  // Filter company contacts by search term for the browse list
  const filteredCompanyContacts = companyContacts.filter(c => {
    if (!searchTerm.trim()) return true;
    const full = `${c.first_name} ${c.last_name} ${c.job_title || ''}`.toLowerCase();
    return full.includes(searchTerm.toLowerCase());
  });

  const assignContact = async (id: string) => {
    const { error } = await supabase.from('engagements').update({ [fieldName]: id } as any).eq('id', engagementId);
    if (error) {
      toast.error('Failed to assign contact');
    } else {
      queryClient.invalidateQueries({ queryKey: ['engagement'] });
      queryClient.invalidateQueries({ queryKey: ['engagements'] });
      queryClient.invalidateQueries({ queryKey: ['engagement-contact-detail'] });
      toast.success(`${label} assigned`);
    }
    setSearching(false);
    setSearchTerm('');
    setQuickCreating(false);
  };

  const removeContact = async () => {
    const { error } = await supabase.from('engagements').update({ [fieldName]: null } as any).eq('id', engagementId);
    if (error) {
      toast.error('Failed to remove contact');
    } else {
      queryClient.invalidateQueries({ queryKey: ['engagement'] });
      queryClient.invalidateQueries({ queryKey: ['engagements'] });
      queryClient.invalidateQueries({ queryKey: ['engagement-contact-detail'] });
      toast.success(`${label} removed`);
    }
  };

  const quickCreateAndAssign = async () => {
    if (!newFirst.trim() || !newLast.trim()) {
      toast.error('First and last name are required');
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('crm_contacts')
        .insert({
          first_name: newFirst.trim(),
          last_name: newLast.trim(),
          job_title: newTitle.trim() || null,
          company_id: companyId || null,
        } as any)
        .select('id')
        .single();
      if (error) throw error;
      const newId = (data as any).id;
      queryClient.invalidateQueries({ queryKey: ['company-contacts-list'] });
      queryClient.invalidateQueries({ queryKey: ['company-contact-count'] });
      await assignContact(newId);
      toast.success('Contact created and assigned');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create contact');
    } finally {
      setCreating(false);
      setNewFirst('');
      setNewLast('');
      setNewTitle('');
      setQuickCreating(false);
    }
  };

  const initials = contact ? `${contact.first_name?.[0] ?? ''}${contact.last_name?.[0] ?? ''}`.toUpperCase() : '';

  const contactCountLabel = companyId
    ? `${companyContacts.length} contact${companyContacts.length !== 1 ? 's' : ''} at this company`
    : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {contact ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                {initials}
              </div>
              <div>
                <button
                  onClick={() => navigate(`/contacts/${contact.id}`)}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {contact.first_name} {contact.last_name}
                </button>
                {contact.job_title && (
                  <p className="text-xs text-muted-foreground">{contact.job_title}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSearching(true)}>Change</Button>
              <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={removeContact}>Remove</Button>
            </div>
          </div>
        ) : searching ? null : (
          <div>
            {!companyId ? (
              <div className="text-xs text-muted-foreground italic">Assign a company first to browse contacts</div>
            ) : (
              <div className="space-y-1.5">
                <Badge variant="outline" className="text-xs text-warning border-warning/30 bg-warning/10">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Not assigned
                </Badge>
                <p className="text-xs text-muted-foreground">
                  <Users className="w-3 h-3 inline mr-1" />
                  {contactCountLabel}
                </p>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setSearching(true)}>
                  <UserCircle className="w-3.5 h-3.5" /> Assign {label}
                </Button>
              </div>
            )}
          </div>
        )}
        {searching && (
          <div className="mt-2 space-y-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                autoFocus
                placeholder={companyId ? "Filter company contacts or search all…" : "Search contacts…"}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="h-8 text-sm pl-8"
                onKeyDown={e => { if (e.key === 'Escape') { setSearching(false); setSearchTerm(''); } }}
              />
            </div>
            {companyId && contactCountLabel && (
              <p className="text-xs text-muted-foreground px-1">
                <Users className="w-3 h-3 inline mr-1" />
                {contactCountLabel}
              </p>
            )}
            <div className="max-h-48 overflow-y-auto border border-border rounded-md">
              {/* Show company contacts first if company assigned */}
              {companyId && filteredCompanyContacts.length > 0 && (
                <>
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 border-b border-border">
                    Company contacts
                  </div>
                  {filteredCompanyContacts.map(c => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                      onClick={() => assignContact(c.id)}
                    >
                      {c.first_name} {c.last_name}
                      {c.job_title && <span className="text-muted-foreground ml-1">· {c.job_title}</span>}
                    </button>
                  ))}
                </>
              )}
              {/* Show broader search results if user is typing */}
              {searchTerm.length > 1 && searchResults.filter(r => !companyContacts.find(cc => cc.id === r.id)).length > 0 && (
                <>
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 border-b border-t border-border">
                    All contacts
                  </div>
                  {searchResults.filter(r => !companyContacts.find(cc => cc.id === r.id)).map(c => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                      onClick={() => assignContact(c.id)}
                    >
                      {c.first_name} {c.last_name}
                      {c.job_title && <span className="text-muted-foreground ml-1">· {c.job_title}</span>}
                    </button>
                  ))}
                </>
              )}
              {/* No results at all */}
              {companyId && filteredCompanyContacts.length === 0 && (searchTerm.length <= 1 || searchResults.length === 0) && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  {companyContacts.length === 0
                    ? 'No contacts at this company yet'
                    : 'No matching contacts found'}
                </div>
              )}
              {!companyId && searchResults.length === 0 && searchTerm.length > 1 && (
                <p className="text-xs text-muted-foreground px-3 py-2">No contacts found</p>
              )}
            </div>
            {/* Quick create */}
            {!quickCreating ? (
              <Button variant="ghost" size="sm" className="text-xs gap-1 w-full justify-start text-primary" onClick={() => setQuickCreating(true)}>
                <Plus className="w-3.5 h-3.5" /> Add new contact{companyId ? ' to this company' : ''}
              </Button>
            ) : (
              <div className="border border-border rounded-md p-2.5 space-y-2 bg-muted/30">
                <p className="text-xs font-medium">Quick add contact{companyId ? ' (linked to company)' : ''}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="First name *" value={newFirst} onChange={e => setNewFirst(e.target.value)} className="h-7 text-xs" />
                  <Input placeholder="Last name *" value={newLast} onChange={e => setNewLast(e.target.value)} className="h-7 text-xs" />
                </div>
                <Input placeholder="Job title" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="h-7 text-xs" />
                <div className="flex gap-2">
                  <Button size="sm" className="text-xs h-7 flex-1" onClick={quickCreateAndAssign} disabled={creating || !newFirst.trim() || !newLast.trim()}>
                    {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Create & Assign'}
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setQuickCreating(false)}>Cancel</Button>
                </div>
              </div>
            )}
            <Button variant="ghost" size="sm" className="text-xs w-full" onClick={() => { setSearching(false); setSearchTerm(''); setQuickCreating(false); }}>
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Inline Company Assigner ─── */
function InlineCompanyAssigner({ engagementId, workspaceId }: { engagementId: string; workspaceId: string }) {
  const queryClient = useQueryClient();
  const [searching, setSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { data: companies = [] } = useCompanySearch(workspaceId, searching);

  const filtered = companies.filter(c => !searchTerm.trim() || c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const assign = async (companyId: string) => {
    const { error } = await supabase.from('engagements').update({ company_id: companyId } as any).eq('id', engagementId);
    if (error) {
      toast.error('Failed to assign company');
    } else {
      queryClient.invalidateQueries({ queryKey: ['engagement'] });
      queryClient.invalidateQueries({ queryKey: ['engagements'] });
      toast.success('Company assigned');
    }
    setSearching(false);
    setSearchTerm('');
  };

  return searching ? (
    <div className="space-y-1 mt-1">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          autoFocus
          placeholder="Search companies…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="h-8 text-sm pl-8"
          onKeyDown={e => { if (e.key === 'Escape') { setSearching(false); setSearchTerm(''); } }}
        />
      </div>
      <div className="max-h-40 overflow-y-auto border border-border rounded-md">
        {filtered.map(c => (
          <button
            key={c.id}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            onClick={() => assign(c.id)}
          >
            {c.name}
            {c.industry && <span className="text-muted-foreground ml-1 text-xs">· {c.industry}</span>}
          </button>
        ))}
        {filtered.length === 0 && <p className="text-xs text-muted-foreground px-3 py-2">No companies found</p>}
      </div>
    </div>
  ) : (
    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setSearching(true)}>
      <Building2 className="w-3.5 h-3.5" /> Assign Company
    </Button>
  );
}

/* ─── Company Card with remove + contact count ─── */
function CompanyCard({ engagementId, companyId, companyName, workspaceId }: {
  engagementId: string;
  companyId: string | null;
  companyName?: string | null;
  workspaceId: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: crmCompanyId } = useCrmCompanyId(companyId);

  // Count contacts for this company
  const { data: contactCount } = useQuery({
    queryKey: ['company-contact-count', companyId, crmCompanyId],
    queryFn: async () => {
      if (!companyId) return 0;
      const promises: Promise<{ count: number | null }>[] = [
        supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('deleted_at', null) as any,
      ];
      if (crmCompanyId) {
        promises.push(
          supabase.from('crm_contacts').select('id', { count: 'exact', head: true }).eq('company_id', crmCompanyId).is('deleted_at', null) as any,
        );
      }
      const results = await Promise.all(promises);
      return Math.max(...results.map(r => r.count ?? 0));
    },
    enabled: !!companyId,
  });

  const removeCompany = async () => {
    const { error } = await supabase.from('engagements').update({ company_id: null } as any).eq('id', engagementId);
    if (error) {
      toast.error('Failed to remove company');
    } else {
      queryClient.invalidateQueries({ queryKey: ['engagement'] });
      queryClient.invalidateQueries({ queryKey: ['engagements'] });
      toast.success('Company removed');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Building2 className="w-4 h-4" /> Company
        </CardTitle>
      </CardHeader>
      <CardContent>
        {companyName && companyId ? (
          <div>
            <div className="flex items-center justify-between">
              <div>
                <p
                  className="text-sm font-medium text-primary cursor-pointer hover:underline"
                  onClick={() => navigate(`/companies/${companyId}`)}
                >
                  {companyName}
                </p>
                {contactCount !== undefined && contactCount > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <Users className="w-3 h-3 inline mr-1" />
                    {contactCount} contact{contactCount !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={removeCompany}>Remove</Button>
            </div>
          </div>
        ) : (
          <InlineCompanyAssigner engagementId={engagementId} workspaceId={workspaceId} />
        )}
      </CardContent>
    </Card>
  );
}

function DuplicateProjectModal({
  open,
  onOpenChange,
  engagement,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  engagement: any;
}) {
  const navigate = useNavigate();
  const createMutation = useCreateEngagement();
  const [name, setName] = useState('');
  const [copyDetails, setCopyDetails] = useState(true);
  const [copyCompany, setCopyCompany] = useState(true);
  const [copyContact, setCopyContact] = useState(true);
  const [copyType, setCopyType] = useState(true);

  useEffect(() => {
    if (open) {
      setName(`${engagement.name} — Copy`);
      setCopyDetails(true);
      setCopyCompany(true);
      setCopyContact(true);
      setCopyType(true);
    }
  }, [open, engagement]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const input: any = {
        workspace_id: engagement.workspace_id,
        name: name.trim(),
        engagement_type: copyType ? engagement.engagement_type : 'consulting',
        stage: 'pipeline',
        health: 'green',
        forecast_value: copyDetails ? engagement.forecast_value : 0,
        currency: copyDetails ? engagement.currency : 'GBP',
        description: copyDetails ? engagement.description : null,
        company_id: copyCompany ? engagement.company_id : null,
        contact_id: copyContact ? engagement.contact_id : null,
        hiring_manager_id: copyContact ? (engagement.hiring_manager_id ?? null) : null,
      };
      const result = await createMutation.mutateAsync(input);
      toast.success("Project duplicated. You're now viewing the copy.");
      onOpenChange(false);
      navigate(`/projects/${result.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to duplicate project');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Copy className="w-4 h-4" /> Duplicate Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>New project name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-3">
            <Label className="text-muted-foreground text-xs font-medium">Copy these elements:</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={copyDetails} onCheckedChange={(v) => setCopyDetails(!!v)} />
                Project details & description
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={copyCompany} onCheckedChange={(v) => setCopyCompany(!!v)} />
                Company
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={copyContact} onCheckedChange={(v) => setCopyContact(!!v)} />
                Primary contact & hiring manager
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={copyType} onCheckedChange={(v) => setCopyType(!!v)} />
                Project type (stage → Pipeline)
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Edit Engagement Modal ─── */
function EditEngagementModal({
  open,
  onOpenChange,
  engagement,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  engagement: any;
}) {
  const { currentWorkspace } = useWorkspace();
  const updateMutation = useUpdateEngagement();

  const [name, setName] = useState(engagement.name);
  const [companyId, setCompanyId] = useState(engagement.company_id || '');
  const [engagementType, setEngagementType] = useState(engagement.engagement_type);
  const [stage, setStage] = useState(engagement.stage);
  const [health, setHealth] = useState(engagement.health || 'green');
  const [forecastValue, setForecastValue] = useState(engagement.forecast_value?.toString() || '');
  const [currency, setCurrency] = useState(engagement.currency || 'GBP');
  const [description, setDescription] = useState(engagement.description || '');
  const [startDate, setStartDate] = useState(engagement.start_date || '');
  const [endDate, setEndDate] = useState(engagement.end_date || '');

  useEffect(() => {
    if (open) {
      setName(engagement.name);
      setCompanyId(engagement.company_id || '');
      setEngagementType(engagement.engagement_type);
      setStage(engagement.stage);
      setHealth(engagement.health || 'green');
      setForecastValue(engagement.forecast_value?.toString() || '');
      setCurrency(engagement.currency || 'GBP');
      setDescription(engagement.description || '');
      setStartDate(engagement.start_date || '');
      setEndDate(engagement.end_date || '');
    }
  }, [open, engagement]);

  const { data: companies = [] } = useCompanySearch(currentWorkspace?.id, open);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await updateMutation.mutateAsync({
        id: engagement.id,
        name: name.trim(),
        company_id: companyId || null,
        engagement_type: engagementType,
        stage,
        health,
        forecast_value: forecastValue ? parseInt(forecastValue) : 0,
        currency,
        description: description.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
      });
      toast.success('Project updated');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update project');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Project Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Company</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={engagementType} onValueChange={setEngagementType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Health</Label>
              <Select value={health} onValueChange={setHealth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="amber">Amber</SelectItem>
                  <SelectItem value="red">Red</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Forecast Value</Label>
            <Input type="number" value={forecastValue} onChange={(e) => setForecastValue(e.target.value)} placeholder="0" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Recent Activity Section ─── */
function RecentActivitySection({ engagementId, companyId }: { engagementId: string; companyId: string | null }) {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['project-activity', engagementId],
    queryFn: async () => {
      const { data: auditData } = await supabase
        .from('audit_log')
        .select('*')
        .eq('entity_id', engagementId)
        .order('changed_at', { ascending: false })
        .limit(10);

      const items: { id: string; action: string; entity_type: string; changed_at: string; summary: string }[] = [];
      if (auditData) {
        auditData.forEach((a: any) => {
          items.push({
            id: a.id,
            action: a.action,
            entity_type: a.entity_type,
            changed_at: a.changed_at,
            summary: `${a.action} on ${a.entity_type}`,
          });
        });
      }
      return items;
    },
    enabled: !!engagementId,
  });

  if (isLoading) return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;

  if (activities.length === 0) {
    return (
      <Card className="mt-4">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" /> Recent Activity</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No activity logged yet. Changes to this project, contracts, invoices, and files will appear here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" /> Recent Activity</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.map((a) => (
            <div key={a.id} className="flex items-start gap-3 text-sm">
              <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-foreground capitalize">{a.summary}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(a.changed_at), 'dd MMM yyyy HH:mm')}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Originating Deal Card ─── */
function OriginatingDealCard({ engagementId }: { engagementId: string }) {
  const navigate = useNavigate();
  const { data: originatingDeal, isLoading } = useQuery({
    queryKey: ['originating-deal', engagementId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_deals')
        .select('id, title, value, stage, currency')
        .eq('engagement_id', engagementId)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; title: string; value: number; stage: string; currency: string } | null;
    },
    enabled: !!engagementId,
  });

  if (isLoading || !originatingDeal) return null;

  const cs = originatingDeal.currency === 'GBP' ? '£' : originatingDeal.currency === 'USD' ? '$' : '€';
  const STAGE_COLORS: Record<string, string> = {
    lead: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    qualified: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    proposal: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    negotiation: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    won: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    lost: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <DollarSign className="w-4 h-4" /> Originating Deal
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-foreground">{originatingDeal.title}</p>
            <span className="text-sm font-semibold text-foreground">{cs}{originatingDeal.value.toLocaleString()}</span>
            <Badge variant="secondary" className={`text-xs capitalize ${STAGE_COLORS[originatingDeal.stage] || ''}`}>
              {originatingDeal.stage}
            </Badge>
          </div>
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => navigate(`/crm/deals/${originatingDeal.id}`)}>
            View Deal <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Link Existing Campaign Modal ─── */
function LinkCampaignModal({
  open,
  onOpenChange,
  engagementId,
  campaigns,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  engagementId: string;
  campaigns: OutreachCampaign[];
}) {
  const { mutateAsync, isPending } = useLinkCampaignToEngagement();
  const unlinked = campaigns.filter((c) => !c.engagement_id);
  const [search, setSearch] = useState('');

  const filtered = unlinked.filter((c) =>
    !search.trim() || c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleLink = async (campaignId: string) => {
    await mutateAsync({ campaignId, engagementId });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link Existing Campaign</DialogTitle>
        </DialogHeader>
        {unlinked.length === 0 ? (
          <div className="py-8 text-center">
            <Megaphone className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">All campaigns are already linked to projects.</p>
          </div>
        ) : (
          <>
            {unlinked.length > 5 && (
              <input
                type="text"
                placeholder="Search campaigns..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm mb-2"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            )}
            <ScrollArea className="max-h-72">
              <div className="space-y-2 p-1">
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleLink(c.id)}
                    disabled={isPending}
                    className="w-full text-left rounded-lg border border-border/50 p-3 hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{c.name}</span>
                      <Badge className={`text-[10px] capitalize ${CAMPAIGN_STATUS_BADGE[c.status]}`}>
                        {c.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.target_count} targets · {c.channel}
                    </p>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No matching campaigns.</p>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Campaign Card (expandable with targets) ─── */
function CampaignCard({
  campaign,
  engagementId,
  onOpenInOutreach,
}: {
  campaign: OutreachCampaign;
  engagementId: string;
  onOpenInOutreach: (id: string) => void;
}) {
  const navigate = useNavigate();
  const { mutateAsync: unlinkCampaign, isPending: unlinking } = useUnlinkCampaignFromEngagement();
  const [expanded, setExpanded] = useState(false);
  const [addTargetsOpen, setAddTargetsOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<OutreachTarget | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: targets = [] } = useOutreachTargets(
    expanded ? { campaignId: campaign.id } : {}
  );

  const contacted = targets.filter((t) => t.state !== 'queued').length;
  const booked = targets.filter((t) => t.state === 'booked' || t.state === 'converted').length;

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-foreground truncate">{campaign.name}</h3>
                <Badge className={`text-[10px] capitalize ${CAMPAIGN_STATUS_BADGE[campaign.status]}`}>
                  {campaign.status}
                </Badge>
                <Badge variant="outline" className="text-[10px] capitalize">{campaign.channel}</Badge>
              </div>
              {campaign.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{campaign.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs h-7"
                onClick={() => onOpenInOutreach(campaign.id)}
              >
                <ExternalLink className="w-3 h-3" />
                Open in Outreach
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 text-xs h-7 text-muted-foreground hover:text-destructive"
                onClick={() => unlinkCampaign(campaign.id)}
                disabled={unlinking}
                title="Unlink campaign from project"
              >
                <Unlink className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-6 mt-3 pt-3 border-t border-border/40">
            <div className="text-center">
              <p className="text-lg font-bold">{campaign.target_count}</p>
              <p className="text-[10px] text-muted-foreground">Targets</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{campaign.contacted_count}</p>
              <p className="text-[10px] text-muted-foreground">Contacted</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{campaign.response_count}</p>
              <p className="text-[10px] text-muted-foreground">Responses</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">
                {campaign.target_count > 0 ? Math.round((campaign.response_count / campaign.target_count) * 100) : 0}%
              </p>
              <p className="text-[10px] text-muted-foreground">Conversion</p>
            </div>
            <div className="ml-auto">
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 text-xs h-7"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? 'Hide' : 'Show'} Targets
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </CardContent>

        {/* Expanded targets section */}
        {expanded && (
          <div className="border-t border-border/40 bg-muted/10 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Targets</p>
              <Button size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setAddTargetsOpen(true)}>
                <Users className="w-3 h-3" />
                Add Targets
              </Button>
            </div>
            {targets.length === 0 ? (
              <div className="text-center py-6">
                <Users className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No targets yet. Add candidates or contacts.</p>
              </div>
            ) : (
              <div className="rounded-lg overflow-hidden border border-border/30">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-medium">Name</TableHead>
                      <TableHead className="text-xs font-medium">State</TableHead>
                      <TableHead className="text-xs font-medium hidden lg:table-cell">Last Contact</TableHead>
                      <TableHead className="text-xs font-medium w-[200px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {targets.map((target) => (
                      <OutreachTargetRow
                        key={target.id}
                        target={target}
                        onOpen={(t) => {
                          setSelectedTarget(t);
                          setDetailOpen(true);
                        }}
                        selected={false}
                        onSelectChange={() => {}}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </Card>

      <AddTargetsModal
        open={addTargetsOpen}
        onOpenChange={setAddTargetsOpen}
        campaignId={campaign.id}
      />
      <TargetDetailSheet
        target={selectedTarget}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
}

/* ─── Project Outreach Tab ─── */
function ProjectOutreachTab({ engagementId }: { engagementId: string }) {
  const navigate = useNavigate();
  const { data: linkedCampaigns = [], isLoading } = useOutreachCampaigns(engagementId);
  const { data: allCampaigns = [] } = useOutreachCampaigns();

  const [createOpen, setCreateOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Campaigns ({linkedCampaigns.length})
        </h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setLinkOpen(true)}>
            <LinkIcon className="w-3.5 h-3.5" />
            Link Existing
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            Create Campaign
          </Button>
        </div>
      </div>

      {linkedCampaigns.length === 0 ? (
        <Card className="flex flex-col items-center justify-center text-center p-10">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <Megaphone className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No Outreach Campaigns</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Create or link outreach campaigns to manage targets, scripts, and actions directly from this project.
          </p>
          <div className="flex items-center gap-3 mt-5">
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              Create Campaign
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setLinkOpen(true)}>
              <LinkIcon className="w-3.5 h-3.5" />
              Link Existing
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {linkedCampaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              engagementId={engagementId}
              onOpenInOutreach={(cId) => navigate(`/outreach?campaignId=${cId}&fromProject=${engagementId}`)}
            />
          ))}
        </div>
      )}

      <CreateCampaignModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        engagementId={engagementId}
      />
      <LinkCampaignModal
        open={linkOpen}
        onOpenChange={setLinkOpen}
        engagementId={engagementId}
        campaigns={allCampaigns}
      />
    </>
  );
}

/* ─── Jobs Tab (recruitment projects) ─── */
function ProjectJobsTab({ engagementId }: { engagementId: string }) {
  const navigate = useNavigate();
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['project-jobs', engagementId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('jobs')
        .select('id, title, status, location') as any)
        .eq('engagement_id', engagementId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as { id: string; title: string; status: string; location: string | null }[];
    },
    enabled: !!engagementId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const JOB_STATUS_BADGE: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    active: 'default',
    draft: 'secondary',
    closed: 'destructive',
    filled: 'outline',
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Linked Jobs ({jobs.length})
        </h3>
        <Button size="sm" className="gap-1.5" onClick={() => navigate(`/jobs/new?engagement_id=${engagementId}`)}>
          <Plus className="w-3.5 h-3.5" />
          New Job
        </Button>
      </div>

      {jobs.length === 0 ? (
        <Card className="flex flex-col items-center justify-center text-center p-8">
          <Briefcase className="w-8 h-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No jobs linked to this project yet.</p>
          <Button size="sm" className="gap-1.5 mt-3" onClick={() => navigate(`/jobs/new?engagement_id=${engagementId}`)}>
            <Plus className="w-3.5 h-3.5" /> New Job
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Location</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/jobs/${job.id}`)}>
                    <td className="px-4 py-3 font-medium text-foreground">{job.title}</td>
                    <td className="px-4 py-3">
                      <Badge variant={JOB_STATUS_BADGE[job.status] ?? 'secondary'} className="text-xs capitalize">{job.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{job.location || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={() => navigate(`/jobs/${job.id}`)}>
                        View <ExternalLink className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

/* ─── Main Component ─── */
const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'overview';
  const { currentWorkspace } = useWorkspace();
  const { data: engagement, isLoading } = useEngagement(id, currentWorkspace?.id);

  // Fetch SOWs & invoices for this engagement
  const { data: allSows = [] } = useSows(currentWorkspace?.id);
  const { data: allInvoices = [] } = useInvoices(currentWorkspace?.id);

  const [sowOpen, setSowOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [dealPanelOpen, setDealPanelOpen] = useState(false);
  const [dealDefaults, setDealDefaults] = useState<any>(null);
  const perm = useDeletionPermission();

  const engSows = useMemo(() => {
    if (!engagement) return [];
    return allSows.filter(
      (s) => s.engagement_id === engagement.id || (!s.engagement_id && s.company_id === engagement.company_id)
    );
  }, [allSows, engagement]);

  const engInvoices = useMemo(() => {
    if (!engagement) return [];
    return allInvoices.filter((inv) => inv.engagement_id === engagement.id);
  }, [allInvoices, engagement]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-6 py-16 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!engagement) {
    return (
      <div className="container mx-auto px-6 py-16 max-w-xl text-center space-y-4">
        <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mx-auto">
          <Briefcase className="w-7 h-7 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Project not found</h2>
        <p className="text-sm text-muted-foreground">This project may have been deleted or you don't have access.</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/projects')} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </Button>
      </div>
    );
  }

  const hiringManagerLabel = engagement.engagement_type === 'recruitment' ? 'Hiring Manager' : 'Key Stakeholder';

  return (
    <div className="h-full overflow-y-auto overflow-x-auto bg-background">
      <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <PageBackButton fallback="/projects" />
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{engagement.name}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs capitalize">{engagement.engagement_type.replace('_', ' ')}</Badge>
            <Badge variant="outline" className="text-xs">{STAGE_LABELS[engagement.stage] ?? engagement.stage}</Badge>
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${HEALTH_COLORS[engagement.health]?.split(' ')[0] ?? 'bg-muted'}`} />
            {engagement.companies?.name ? (
              <span
                className="text-sm text-primary cursor-pointer hover:underline font-medium"
                onClick={() => navigate(`/companies/${engagement.company_id}`)}
              >
                {engagement.companies.name}
              </span>
            ) : (
              <Badge variant="outline" className="text-xs text-warning border-warning/30 bg-warning/10">
                <AlertTriangle className="w-3 h-3 mr-1" />
                No company
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">· Updated {format(new Date(engagement.updated_at), 'dd MMM yyyy')}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setDealDefaults({
                title: engagement.name,
                company_id: engagement.company_id || null,
              });
              setDealPanelOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            Create deal
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
            <Pencil className="w-4 h-4" />
            Edit
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setDuplicateOpen(true)}>
            <Copy className="w-4 h-4" />
            Duplicate
          </Button>
          {perm.canSeeDeleteOption && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive gap-1.5"
              onClick={() => setDeleteOpen(true)}
            >
              <TrashIcon className="w-4 h-4" />
              {perm.canDeleteDirectly ? "Delete" : "Request Deletion"}
            </Button>
          )}
        </div>
      </div>

      <DeletionRequestBanner recordType="engagements" recordId={id!} />

      {/* Tabs */}
      {(() => {
        const engType = engagement.engagement_type;
        const allTabs = [
          { value: 'overview', label: 'Overview', always: true },
          { value: 'contracts', label: 'Contracts', types: ['consulting', 'managed_service'] },
          { value: 'billing', label: 'Billing', always: true },
          { value: 'outreach', label: 'Outreach', types: ['recruitment', 'managed_service'] },
          { value: 'jobs', label: 'Jobs', types: ['recruitment'] },
          { value: 'files', label: 'Files', always: true },
        ];
        const visibleTabs = allTabs.filter(t => t.always || t.types?.includes(engType));
        const resolvedDefault = visibleTabs.some(t => t.value === defaultTab) ? defaultTab : 'overview';

        return (
          <Tabs defaultValue={resolvedDefault} className="space-y-4">
            <TabsList>
              {visibleTabs.map(t => (
                <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
              ))}
            </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          {/* Originating Deal */}
          <OriginatingDealCard engagementId={engagement.id} />

          {/* Company + Contacts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {/* Company Card */}
            <CompanyCard engagementId={engagement.id} companyId={engagement.company_id} companyName={engagement.companies?.name} workspaceId={currentWorkspace?.id ?? ''} />

            {/* Primary Contact */}
            <InlineContactPicker
              label="Primary Contact"
              icon={<UserCircle className="w-4 h-4" />}
              contactId={engagement.contact_id}
              engagementId={engagement.id}
              fieldName="contact_id"
              companyId={engagement.company_id}
            />

            {/* Hiring Manager / Key Stakeholder */}
            <InlineContactPicker
              label={hiringManagerLabel}
              icon={<Users className="w-4 h-4" />}
              contactId={engagement.hiring_manager_id}
              engagementId={engagement.id}
              fieldName="hiring_manager_id"
              companyId={engagement.company_id}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Stage</CardTitle></CardHeader>
              <CardContent><Badge variant="outline">{STAGE_LABELS[engagement.stage] ?? engagement.stage}</Badge></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Forecast Value</CardTitle></CardHeader>
              <CardContent>
                <p className="text-lg font-semibold text-foreground">
                  {engagement.forecast_value > 0 ? `${engagement.currency} ${engagement.forecast_value.toLocaleString()}` : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Dates</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Start: {engagement.start_date ? format(new Date(engagement.start_date), 'dd MMM yyyy') : '—'}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  End: {engagement.end_date ? format(new Date(engagement.end_date), 'dd MMM yyyy') : '—'}
                </p>
              </CardContent>
            </Card>
          </div>
          {engagement.description && (
            <Card className="mt-4">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Description</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{engagement.description}</p></CardContent>
            </Card>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <Card className="p-4 text-center">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contracts</p>
              <p className="text-xl font-bold text-foreground mt-1">{engSows.length}</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Invoices</p>
              <p className="text-xl font-bold text-foreground mt-1">{engInvoices.length}</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Billed</p>
              <p className="text-xl font-bold text-foreground mt-1">
                {engInvoices.length > 0
                  ? `£${engInvoices.reduce((s, i) => s + i.amount, 0).toLocaleString()}`
                  : '—'}
              </p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contract Value</p>
              <p className="text-xl font-bold text-foreground mt-1">
                {engSows.length > 0
                  ? `£${engSows.reduce((s, sw) => s + sw.value, 0).toLocaleString()}`
                  : '—'}
              </p>
            </Card>
          </div>

          {/* Recent Activity */}
          <RecentActivitySection engagementId={engagement.id} companyId={engagement.company_id} />
        </TabsContent>

        {/* Contracts Tab */}
        <TabsContent value="contracts">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">SOWs & Contracts</h3>
            <Button size="sm" className="gap-1.5" onClick={() => setSowOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              Add SOW
            </Button>
          </div>
          {engSows.length === 0 ? (
            <Card className="flex flex-col items-center justify-center text-center p-8">
              <FileText className="w-8 h-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No contracts linked to this project yet.</p>
              <Button size="sm" className="gap-1.5 mt-3" onClick={() => setSowOpen(true)}>
                <Plus className="w-3.5 h-3.5" /> Add SOW
              </Button>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ref</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Billing</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Value</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">End Date</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Renewal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {engSows.map((sow) => (
                      <tr key={sow.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{sow.sow_ref || '—'}</td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_BADGE_VARIANT[sow.status] ?? 'secondary'} className="text-xs capitalize">{sow.status}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs capitalize">{sow.billing_model.replace('_', ' ')}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {sow.value > 0 ? `${sow.currency} ${sow.value.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {sow.end_date ? format(new Date(sow.end_date), 'dd MMM yyyy') : '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {sow.renewal_date ? format(new Date(sow.renewal_date), 'dd MMM yyyy') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing">
          <ProjectBillingTab
            engagementId={engagement.id}
            companyId={engagement.company_id ?? ''}
            workspaceId={currentWorkspace?.id ?? ''}
          />
        </TabsContent>

        {/* Outreach Tab */}
        <TabsContent value="outreach">
          <ProjectOutreachTab engagementId={engagement.id} />
        </TabsContent>

        {/* Jobs Tab (recruitment only) */}
        <TabsContent value="jobs">
          <ProjectJobsTab engagementId={engagement.id} />
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files">
          <DocumentList
            entityType="engagement"
            entityId={engagement.id}
            entityName={engagement.name}
            canEdit={true}
            showCategoryBreakdown={true}
          />
        </TabsContent>
          </Tabs>
        );
      })()}

      {/* Modals */}
      <CreateSowModal open={sowOpen} onOpenChange={setSowOpen} />
      <CreateInvoiceModal open={invoiceOpen} onOpenChange={setInvoiceOpen} />
      <EditEngagementModal open={editOpen} onOpenChange={setEditOpen} engagement={engagement} />
      <DuplicateProjectModal open={duplicateOpen} onOpenChange={setDuplicateOpen} engagement={engagement} />
      <DeleteRecordModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        recordType="engagements"
        recordId={engagement.id}
        recordName={engagement.name}
        onDeleted={() => navigate("/projects")}
      />
      <AddEditDealPanel
        open={dealPanelOpen}
        onOpenChange={setDealPanelOpen}
        defaultValues={dealDefaults}
      />
    </div>
    </div>
  );
};

export default ProjectDetail;
