import { Link } from 'react-router-dom';
import { usePermissions } from '@/hooks/use-permissions';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Database,
  Shield,
  Megaphone,
  Plug,
} from 'lucide-react';

interface AdminCard {
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
  adminOnly?: boolean;
}

const ADMIN_CARDS: AdminCard[] = [
  {
    title: 'Workspace & Roles',
    description: 'Manage user roles and workspace member access.',
    icon: Shield,
    path: '/admin/access',
    adminOnly: true,
  },
  {
    title: 'Data Quality & Duplicates',
    description: 'Duplicate detection, completeness stats and merge governance.',
    icon: Database,
    path: '/admin/data-quality',
  },
  {
    title: 'Outreach Defaults',
    description: 'Configure scripts, calling hours and channel defaults.',
    icon: Megaphone,
    path: '/admin/outreach',
  },
  {
    title: 'Integrations',
    description: 'View integration status and external service configuration.',
    icon: Plug,
    path: '/admin/integrations',
  },
  {
    title: 'Schema Inventory',
    description: 'Explore public-schema tables, columns & constraints.',
    icon: Database,
    path: '/admin/schema',
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
    </div>
  );
}
