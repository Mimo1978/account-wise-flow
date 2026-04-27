import { CMSectionLoader } from "@/components/ui/CMLoader";
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/ui/SectionCard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useEngagements } from '@/hooks/use-engagements';
import { CreateEngagementModal } from '@/components/home/CreateEngagementModal';
import { Plus, Briefcase, Loader2, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';

const STAGE_LABELS: Record<string, string> = {
  pipeline: 'Pipeline',
  active: 'Active',
  on_hold: 'On Hold',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

const HEALTH_COLORS: Record<string, string> = {
  green: 'bg-success',
  amber: 'bg-warning',
  red: 'bg-destructive',
};

const TYPE_COLORS: Record<string, string> = {
  recruitment: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  contractor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  permanent: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  consulting: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  managed_service: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  other: 'bg-muted text-muted-foreground border-border',
};
const ProjectsList = () => {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { data: engagements = [], isLoading } = useEngagements(currentWorkspace?.id);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="h-full overflow-y-auto overflow-x-auto bg-background">
      <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#F8FAFC' }}>Projects</h1>
            <p className="text-sm mt-1 text-muted-foreground">
              {currentWorkspace?.name ?? 'Workspace'} · All engagements
            </p>
          </div>
        </div>

        <SectionCard
          accentColor="#7B5FD4"
          title="All Projects"
          icon={<Briefcase className="w-4 h-4" />}
          headerRight={
            <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-500 text-white" onClick={() => setCreateOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> + Create Project
            </Button>
          }
        >
          {isLoading ? (
            <CMSectionLoader />
          ) : engagements.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-muted">
                <Briefcase className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold" style={{ color: '#F8FAFC' }}>No projects yet</h3>
              <p className="text-xs mt-1 max-w-sm text-muted-foreground">
                Create a project to track placements, engagements and deliverables.
              </p>
              <Button size="sm" className="gap-1.5 mt-4 bg-blue-600 hover:bg-blue-500 text-white" onClick={() => setCreateOpen(true)}>
                <Plus className="w-3.5 h-3.5" /> + Create Project
              </Button>
            </div>
          ) : (
            <TooltipProvider>
              <div className="rounded-lg overflow-hidden border border-border">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contact</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stage</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Health</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {engagements.map((eng, index) => {
                        const hasNoCompany = !eng.company_id || !eng.companies?.name;
                        const contactName = eng.primary_contact
                          ? `${eng.primary_contact.first_name} ${eng.primary_contact.last_name}`
                          : null;

                        return (
                          <tr
                            key={eng.id}
                            className="cursor-pointer"
                            style={{
                              borderBottom: '1px solid rgba(45,55,72,0.5)',
                              background: index % 2 === 1 ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                              transition: 'background 0.1s ease',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = index % 2 === 1 ? 'rgba(255, 255, 255, 0.04)' : 'transparent'; }}
                            onClick={() => navigate(`/projects/${eng.id}`)}
                          >
                            <td className="px-4 py-3 font-medium">
                              <div className="flex items-center gap-1.5">
                                {hasNoCompany && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
                                    </TooltipTrigger>
                                    <TooltipContent>No company assigned</TooltipContent>
                                  </Tooltip>
                                )}
                                <span
                                  className="text-primary hover:underline cursor-pointer text-sm font-medium"
                                  onClick={(e) => { e.stopPropagation(); navigate(`/projects/${eng.id}`); }}
                                >
                                  {eng.name || 'Untitled project'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {eng.companies?.name ? (
                                <span className="text-primary hover:underline cursor-pointer text-sm" onClick={(e) => { e.stopPropagation(); navigate(`/companies/${eng.company_id}`); }}>
                                  {eng.companies.name}
                                </span>
                              ) : (
                                <span className="text-warning text-sm">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {contactName ? (
                                <span className="text-primary hover:underline cursor-pointer text-sm" onClick={(e) => { e.stopPropagation(); navigate(`/crm/contacts/${eng.contact_id}`); }}>
                                  {contactName}
                                </span>
                              ) : (
                                <span className="text-warning text-sm">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="secondary" className={`text-xs capitalize border ${TYPE_COLORS[eng.engagement_type] ?? 'bg-muted text-muted-foreground border-border'}`}>{eng.engagement_type.replace('_', ' ')}</Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="text-xs">{STAGE_LABELS[eng.stage] ?? eng.stage}</Badge>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-block w-2.5 h-2.5 rounded-full ${HEALTH_COLORS[eng.health] ?? 'bg-muted'}`} />
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {format(new Date(eng.updated_at), 'dd MMM yyyy')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </TooltipProvider>
          )}
        </SectionCard>

        <CreateEngagementModal open={createOpen} onOpenChange={setCreateOpen} />
      </div>
    </div>
  );
};

export default ProjectsList;
