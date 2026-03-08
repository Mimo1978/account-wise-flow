import { Link } from 'react-router-dom';
import { usePermissions } from '@/hooks/use-permissions';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Database,
  Shield,
  Megaphone,
  Plug,
  Bot,
  Receipt,
} from 'lucide-react';

interface AdminCard {
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
  adminOnly?: boolean;
  jarvisId?: string;
}

const ADMIN_CARDS: AdminCard[] = [
  {
    title: 'Workspace & Roles',
    description: 'Manage user roles and workspace member access.',
    icon: Shield,
    path: '/admin/access',
    adminOnly: true,
    jarvisId: 'admin-workspace-roles',
  },
  {
    title: 'Data Quality & Duplicates',
    description: 'Duplicate detection, completeness stats and merge governance.',
    icon: Database,
    path: '/admin/data-quality',
    jarvisId: 'admin-data-quality',
  },
  {
    title: 'Outreach Defaults',
    description: 'Configure scripts, calling hours and channel defaults.',
    icon: Megaphone,
    path: '/admin/outreach',
    jarvisId: 'admin-outreach-defaults',
  },
  {
    title: 'Integrations',
    description: 'View integration status and external service configuration.',
    icon: Plug,
    path: '/admin/integrations',
    jarvisId: 'admin-integrations',
  },
  {
    title: 'Schema Inventory',
    description: 'Explore public-schema tables, columns & constraints.',
    icon: Database,
    path: '/admin/schema',
    jarvisId: 'admin-schema-inventory',
  },
  {
    title: 'Jarvis Settings',
    description: 'Configure voice, spotlight and AI assistant behaviour.',
    icon: Bot,
    path: '/admin/jarvis',
    jarvisId: 'admin-jarvis-settings',
  },
  {
    title: 'Billing & Invoices',
    description: 'Invoice settings, templates and billing configuration.',
    icon: Receipt,
    path: '/admin/billing',
    jarvisId: 'admin-billing-invoices',
  },
];

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ADMIN_CARDS.map((card) => {
          if (card.adminOnly && role !== 'admin') return null;
          const Icon = card.icon;
          return (
            <Link key={card.path + card.title} to={card.path} className="group" data-jarvis-id={card.jarvisId}>
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
    </div>
  );
}
