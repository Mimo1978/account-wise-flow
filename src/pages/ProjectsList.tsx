import { useNavigate } from 'react-router-dom';
import { PageBackButton } from '@/components/ui/page-back-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useEngagements } from '@/hooks/use-engagements';
import { CreateEngagementModal } from '@/components/home/CreateEngagementModal';
import { Plus, Briefcase, Loader2 } from 'lucide-react';
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

const ProjectsList = () => {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { data: engagements = [], isLoading } = useEngagements(currentWorkspace?.id);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6">
      <PageBackButton fallback="/home" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {currentWorkspace?.name ?? 'Workspace'} &middot; All engagements
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="w-3.5 h-3.5" />
          Create Project
        </Button>
      </div>

      {isLoading ? (
        <Card className="border border-border rounded-xl">
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : engagements.length === 0 ? (
        <Card className="flex flex-col items-center justify-center text-center p-12 border border-border rounded-xl">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
            <Briefcase className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No projects yet</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Create a project to track placements, engagements and deliverables.
          </p>
          <Button size="sm" className="gap-1.5 mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            Create Project
          </Button>
        </Card>
      ) : (
        <Card className="border border-border rounded-xl overflow-hidden" style={{ borderLeft: '4px solid hsl(142 71% 45%)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stage</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Health</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Updated</th>
                </tr>
              </thead>
              <tbody>
                {engagements.map((eng) => (
                  <tr
                    key={eng.id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/projects/${eng.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{eng.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs capitalize">{eng.engagement_type.replace('_', ' ')}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">{STAGE_LABELS[eng.stage] ?? eng.stage}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${HEALTH_COLORS[eng.health] ?? 'bg-muted'}`} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{eng.companies?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {format(new Date(eng.updated_at), 'dd MMM yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <CreateEngagementModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
};

export default ProjectsList;
