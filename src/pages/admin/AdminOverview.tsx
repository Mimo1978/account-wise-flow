import { Link } from 'react-router-dom';
import { usePermissions } from '@/hooks/use-permissions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Database,
  FileCheck,
  History,
  Settings,
  Shield,
  Megaphone,
  LifeBuoy,
  Download,
  GitBranch,
  Radio,
  Palette,
  BarChart3,
} from 'lucide-react';

interface AdminCard {
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
  adminOnly?: boolean;
}

const QUICK_ACTIONS: AdminCard[] = [
  {
    title: 'Change Requests',
    description: 'Review pending data-change and merge requests.',
    icon: FileCheck,
    path: '/admin/governance/requests',
  },
  {
    title: 'Audit Log',
    description: 'Browse the full audit trail for your workspace.',
    icon: History,
    path: '/admin/governance/audit',
  },
  {
    title: 'Data Quality',
    description: 'Duplicate detection, validation and cleanup tools.',
    icon: Database,
    path: '/admin/data-quality',
  },
  {
    title: 'Org Chart',
    description: 'Validate org-chart integrity and request repairs.',
    icon: GitBranch,
    path: '/admin/org-chart',
  },
  {
    title: 'Outreach Controls',
    description: 'Campaigns, scripts, calling hours and safety defaults.',
    icon: Megaphone,
    path: '/admin/outreach',
  },
  {
    title: 'Signals',
    description: 'Configure signal rules and alert triggers.',
    icon: Radio,
    path: '/admin/signals',
  },
];

const SYSTEM_CARDS: AdminCard[] = [
  {
    title: 'Schema Inventory',
    description: 'Explore public-schema tables, columns & constraints.',
    icon: Database,
    path: '/admin/schema',
    adminOnly: true,
  },
  {
    title: 'Roles & Permissions',
    description: 'Manage user roles for this workspace.',
    icon: Shield,
    path: '/admin/access',
  },
  {
    title: 'Workspace Settings',
    description: 'General workspace configuration.',
    icon: Settings,
    path: '/workspace-settings',
  },
  {
    title: 'Branding',
    description: 'Customise logos, colours and export templates.',
    icon: Palette,
    path: '/admin/workspace/branding',
  },
  {
    title: 'Diagnostics & Support',
    description: 'System status, connectivity checks and export tools.',
    icon: LifeBuoy,
    path: '/admin/support',
  },
];

function CardGrid({ cards, role }: { cards: AdminCard[]; role: string | null }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {cards.map((card) => {
        if (card.adminOnly && role !== 'admin') return null;
        const Icon = card.icon;
        return (
          <Link key={card.path + card.title} to={card.path} className="group">
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardHeader className="flex flex-row items-start gap-3 pb-2">
                <div className="mt-0.5 rounded-md bg-primary/10 p-2">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-sm font-semibold leading-tight group-hover:text-primary transition-colors">
                    {card.title}
                  </CardTitle>
                  <CardDescription className="text-xs leading-snug">
                    {card.description}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

export default function AdminOverview() {
  const { role } = usePermissions();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Console</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Central hub for workspace governance, data quality and system tools.
        </p>
      </div>

      {/* Quick Actions */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Quick Actions
        </h2>
        <CardGrid cards={QUICK_ACTIONS} role={role} />
      </section>

      {/* System */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          System
        </h2>
        <CardGrid cards={SYSTEM_CARDS} role={role} />
      </section>

      {/* Advanced link */}
      {role === 'admin' && (
        <div className="pt-2 border-t border-border">
          <Link
            to="/admin/advanced"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Advanced (Experimental) →
          </Link>
        </div>
      )}
    </div>
  );
}
