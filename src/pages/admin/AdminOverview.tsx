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
import { NAV_ITEMS } from '@/components/admin/AdminLayout';

interface AdminCard {
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
  adminOnly?: boolean;
  jarvisId?: string;
  accent: string;
}

// Build accent lookup from NAV_ITEMS
const accentByPath: Record<string, string> = {};
NAV_ITEMS.forEach((n) => { accentByPath[n.path] = n.accent; });

const ADMIN_CARDS: AdminCard[] = [
  {
    title: 'Workspace & Roles',
    description: 'Manage user roles and workspace member access.',
    icon: Shield,
    path: '/admin/access',
    adminOnly: true,
    jarvisId: 'admin-workspace-roles',
    accent: accentByPath['/admin/access'] || '#38BDF8',
  },
  {
    title: 'Data Quality & Duplicates',
    description: 'Duplicate detection, completeness stats and merge governance.',
    icon: Database,
    path: '/admin/data-quality',
    jarvisId: 'admin-data-quality',
    accent: accentByPath['/admin/data-quality'] || '#FB923C',
  },
  {
    title: 'Outreach Defaults',
    description: 'Configure scripts, calling hours and channel defaults.',
    icon: Megaphone,
    path: '/admin/outreach',
    jarvisId: 'admin-outreach-defaults',
    accent: accentByPath['/admin/outreach'] || '#F472B6',
  },
  {
    title: 'Integrations',
    description: 'View integration status and external service configuration.',
    icon: Plug,
    path: '/admin/integrations',
    jarvisId: 'admin-integrations',
    accent: '#818CF8',
  },
  {
    title: 'Schema Inventory',
    description: 'Explore public-schema tables, columns & constraints.',
    icon: Database,
    path: '/admin/schema',
    jarvisId: 'admin-schema-inventory',
    accent: accentByPath['/admin/schema'] || '#FBBF24',
  },
  {
    title: 'Jarvis Settings',
    description: 'Configure voice, spotlight and AI assistant behaviour.',
    icon: Bot,
    path: '/admin/jarvis',
    jarvisId: 'admin-jarvis-settings',
    accent: accentByPath['/admin/jarvis-settings'] || '#2DD4BF',
  },
  {
    title: 'Billing & Invoices',
    description: 'Invoice settings, templates and billing configuration.',
    icon: Receipt,
    path: '/admin/billing',
    jarvisId: 'admin-billing-invoices',
    accent: accentByPath['/admin/billing'] || '#A78BFA',
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
              <Card className="h-full transition-colors hover:border-primary/40 overflow-hidden">
                {/* Top accent strip */}
                <div
                  className="h-[3px] w-full"
                  style={{ backgroundColor: card.accent }}
                />
                <CardHeader className="flex flex-row items-start gap-3 pb-2">
                  {/* Icon in soft-coloured circle */}
                  <div
                    className="mt-0.5 rounded-full p-2 shrink-0"
                    style={{ backgroundColor: card.accent + '1A' }}
                  >
                    <Icon className="h-4 w-4" style={{ color: card.accent }} />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-sm font-semibold leading-tight group-hover:text-primary transition-colors">
                      {card.title}
                    </CardTitle>
                    <CardDescription className="text-[11px] leading-snug">
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
