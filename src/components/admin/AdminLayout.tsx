import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { usePermissions, AppRole } from '@/hooks/use-permissions';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  LayoutDashboard,
  Shield,
  Database,
  Megaphone,
  Plug,
  Palette,
  Receipt,
  Sparkles,
  Mail,
  Phone,
  Mic,
  Settings2,
} from 'lucide-react';
import type { AdminSection } from './AdminRouteGuard';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  section: AdminSection;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', path: '/admin/overview', icon: LayoutDashboard, section: 'overview' },
  { label: 'Workspace & Roles', path: '/admin/access', icon: Shield, section: 'access' },
  { label: 'Data Governance', path: '/admin/governance', icon: Shield, section: 'governance' },
  { label: 'Data Quality', path: '/admin/data-quality', icon: Database, section: 'data-quality' },
  { label: 'Outreach Defaults', path: '/admin/outreach', icon: Megaphone, section: 'outreach' },
  { label: 'Billing & Invoices', path: '/admin/billing', icon: Receipt, section: 'integrations' },
  { label: 'Schema Inventory', path: '/admin/schema', icon: Database, section: 'schema' },
  { label: 'Jarvis AI Guide', path: '/admin/jarvis-guide', icon: Sparkles, section: 'integrations' },
  { label: 'Jarvis Settings', path: '/admin/jarvis-settings', icon: Settings2, section: 'integrations' },
  { label: 'Email Guide', path: '/admin/email-guide', icon: Mail, section: 'integrations' },
  { label: 'SMS Guide', path: '/admin/sms-guide', icon: Phone, section: 'integrations' },
  { label: 'AI Calling Guide', path: '/admin/ai-calling-guide', icon: Mic, section: 'integrations' },
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
  workspace: ['admin', 'manager'],
  integrations: ['admin', 'manager'],
  access: ['admin'],
};

function canAccess(role: AppRole, section: AdminSection): boolean {
  if (!role) return false;
  return (SECTION_ACCESS_ROLES[section] ?? ['admin']).includes(role);
}

const BREADCRUMB_LABELS: Record<string, string> = {
  '/admin': 'Overview',
  '/admin/overview': 'Overview',
  '/admin/access': 'Workspace & Roles',
  '/admin/roles': 'Workspace & Roles',
  '/admin/governance': 'Data Governance',
  '/admin/data-quality': 'Data Quality',
  '/admin/outreach': 'Outreach Defaults',
  '/admin/schema': 'Schema Inventory',
  
  '/admin/billing': 'Billing & Invoices',
  '/admin/jarvis-guide': 'Jarvis AI Guide',
  '/admin/jarvis-settings': 'Jarvis Settings',
  '/admin/email-guide': 'Email Guide',
  '/admin/sms-guide': 'SMS Guide',
  '/admin/ai-calling-guide': 'AI Calling Guide',
};

function AdminBreadcrumb() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const isOverview = path === '/admin' || path === '/admin/overview';

  if (isOverview) return null;

  const pageLabel = BREADCRUMB_LABELS[path] || path.split('/').pop()?.replace(/-/g, ' ') || '';

  return (
    <div className="flex items-center gap-2 mb-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="gap-1 text-muted-foreground hover:text-foreground -ml-2"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </Button>
      <span className="text-xs text-muted-foreground">·</span>
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link to="/admin" className="hover:text-foreground transition-colors">
          Admin Console
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground font-medium capitalize">{pageLabel}</span>
      </nav>
    </div>
  );
}

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { role } = usePermissions();
  const { currentWorkspace } = useWorkspace();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/admin/overview') return location.pathname === '/admin/overview' || location.pathname === '/admin';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div className="flex h-[calc(100vh-57px)] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 border-r border-border bg-muted/30 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Admin Console</p>
          <p className="text-sm font-medium truncate mt-1">{currentWorkspace?.name || 'Workspace'}</p>
          {role && (
            <Badge variant="outline" className="mt-1.5 text-[10px]">
              {ROLE_LABELS[role] ?? role}
            </Badge>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            if (!canAccess(role, item.section)) return null;
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
          <AdminBreadcrumb />
          {children}
        </div>
      </main>
    </div>
  );
}
