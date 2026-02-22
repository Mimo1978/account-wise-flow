import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePermissions, AppRole } from '@/hooks/use-permissions';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  Shield,
  FileCheck,
  History,
  Database,
  GitBranch,
  Megaphone,
  Radio,
  LifeBuoy,
} from 'lucide-react';
import type { AdminSection } from './AdminRouteGuard';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  section: AdminSection;
  children?: NavItem[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', path: '/admin/overview', icon: LayoutDashboard, section: 'overview' },
  {
    label: 'Workspace & Access', path: '/admin/access', icon: Shield, section: 'access',
    children: [
      { label: 'Access (Roles)', path: '/admin/access', icon: Shield, section: 'access' },
    ],
  },
  {
    label: 'Governance', path: '/admin/governance/requests', icon: FileCheck, section: 'governance',
    children: [
      { label: 'Requests', path: '/admin/governance/requests', icon: FileCheck, section: 'governance' },
      { label: 'Audit Log', path: '/admin/governance/audit', icon: History, section: 'governance' },
    ],
  },
  { label: 'Data Quality', path: '/admin/data-quality', icon: Database, section: 'data-quality' },
  { label: 'Org Chart', path: '/admin/org-chart', icon: GitBranch, section: 'orgchart' },
  {
    label: 'Outreach', path: '/admin/outreach/settings', icon: Megaphone, section: 'outreach',
    children: [
      { label: 'Settings', path: '/admin/outreach/settings', icon: Megaphone, section: 'outreach' },
      { label: 'Scripts', path: '/admin/outreach/scripts', icon: Megaphone, section: 'outreach' },
    ],
  },
  { label: 'Signals', path: '/admin/signals', icon: Radio, section: 'signals' },
  { label: 'Schema', path: '/admin/schema', icon: Database, section: 'schema' },
  { label: 'Support', path: '/admin/support', icon: LifeBuoy, section: 'support' },
];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  contributor: 'Contributor',
  viewer: 'Viewer',
};

const SECTION_ACCESS_ROLES: Record<AdminSection, AppRole[]> = {
  overview: ['admin', 'manager', 'contributor', 'viewer'],
  schema: ['admin', 'manager', 'contributor', 'viewer'],
  support: ['admin', 'manager', 'contributor', 'viewer'],
  'data-quality': ['admin', 'manager', 'contributor'],
  outreach: ['admin', 'manager', 'contributor'],
  orgchart: ['admin', 'manager', 'contributor'],
  signals: ['admin', 'manager', 'contributor'],
  governance: ['admin', 'manager'],
  access: ['admin'],
};

function canAccess(role: AppRole, section: AdminSection): boolean {
  if (!role) return false;
  return (SECTION_ACCESS_ROLES[section] ?? ['admin']).includes(role);
}

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { role } = usePermissions();
  const { currentWorkspace } = useWorkspace();
  const location = useLocation();

  const isActive = (path: string) => {
    // Exact match for overview
    if (path === '/admin/overview') return location.pathname === '/admin/overview' || location.pathname === '/admin';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div className="flex h-[calc(100vh-57px)] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 border-r border-border bg-muted/30 flex flex-col shrink-0">
        {/* Workspace header */}
        <div className="px-4 py-4 border-b border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Admin Console</p>
          <p className="text-sm font-medium truncate mt-1">{currentWorkspace?.name || 'Workspace'}</p>
          {role && (
            <Badge variant="outline" className="mt-1.5 text-[10px]">
              {ROLE_LABELS[role] ?? role}
            </Badge>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            if (!canAccess(role, item.section)) return null;

            if (item.children) {
              return (
                <div key={item.label} className="space-y-0.5">
                  <div className="px-2 pt-3 pb-1">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                      {item.label}
                    </span>
                  </div>
                  {item.children.map((child) => {
                    if (!canAccess(role, child.section)) return null;
                    return (
                      <Link
                        key={child.path}
                        to={child.path}
                        className={cn(
                          'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
                          isActive(child.path)
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                      >
                        <child.icon className="w-4 h-4 shrink-0" />
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
                  isActive(item.path)
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
