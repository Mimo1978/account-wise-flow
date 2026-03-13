import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PendingRequestsBadge } from '@/components/access/PendingRequestsBadge';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useDemoIndicator } from '@/hooks/use-workspace-mode';
import { DemoBanner } from '@/components/layout/DemoBanner';
import { usePermissions } from '@/hooks/use-permissions';
import { useNewApplicationsCount } from '@/hooks/use-jobs';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Sparkles, 
  LayoutDashboard, 
  Database, 
  Users, 
  Building2,
  FileText,
  BookOpen,
  LogOut,
  User,
  BarChart3,
  Briefcase,
  Megaphone,
  ShieldCheck,
  Home,
  Moon,
  Sun,
  Receipt,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface ProductLayoutProps {
  children: React.ReactNode;
}

export const ProductLayout: React.FC<ProductLayoutProps> = ({ children }) => {
  const { user, signOut } = useAuth();
  const { currentWorkspace, isInDemoWorkspace } = useWorkspace();
  const { showBanner, showBadge, bannerVariant } = useDemoIndicator();
  const { isAdmin, isManager, isLoading: permLoading } = usePermissions();
  const { theme, setTheme } = useTheme();

  // Fetch preferred_name for nav display
  const [displayName, setDisplayName] = useState('');
  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles' as any)
      .select('first_name, preferred_name')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const pn = (data as any).preferred_name;
          const fn = (data as any).first_name;
          setDisplayName(pn || fn || user.email || '');
        } else {
          setDisplayName(user.user_metadata?.first_name || user.email || '');
        }
      });
  }, [user]);

  const timeGreeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  })();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: newAppCount = 0 } = useNewApplicationsCount();

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };
  const showAdminNav = !permLoading && (isAdmin || isManager);

  const navItems = [
    { path: '/home', label: 'Home', icon: Home, jarvisId: 'nav-home' },
    { path: '/projects', label: 'Projects', icon: Briefcase, jarvisId: 'nav-projects' },
    { path: '/canvas', label: 'Canvas', icon: LayoutDashboard, jarvisId: 'nav-canvas' },
    { path: '/companies', label: 'Companies', icon: Building2, jarvisId: 'nav-companies' },
    { path: '/deals', label: 'Deals', icon: Database, jarvisId: 'nav-deals' },
    { path: '/documents', label: 'Documents', icon: FileText, jarvisId: 'nav-documents' },
    { path: '/accounts', label: 'Accounts', icon: Receipt, jarvisId: 'nav-accounts' },
    { path: '/contacts', label: 'Contacts', icon: Users, jarvisId: 'nav-contacts' },
    { path: '/talent', label: 'Talent', icon: Database, jarvisId: 'nav-talent' },
    { path: '/jobs', label: 'Jobs', icon: BookOpen, jarvisId: 'nav-jobs' },
    { path: '/outreach', label: 'Outreach', icon: Megaphone, jarvisId: 'nav-outreach' },
    { path: '/insights', label: 'Analytics', icon: BarChart3, jarvisId: 'nav-analytics' },
  ];

  const aiNavItems: typeof navItems = [];

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Product Navigation Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/home" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                CLIENT MAPPER
              </span>
              {showBadge && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  Demo
                </Badge>
              )}
            </Link>

            {/* Main Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActive(item.path) ? 'secondary' : 'ghost'}
                    size="sm"
                    className="gap-2 relative"
                    data-jarvis-id={item.jarvisId}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                    {item.path === '/jobs' && newAppCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
                        {newAppCount > 99 ? '99+' : newAppCount}
                      </span>
                    )}
                  </Button>
                </Link>
              ))}

              
              {/* AI Tools - visual separator */}
              <div className="w-px h-6 bg-border mx-2" />
              
              {aiNavItems.map((item) => (
                <Link key={item.label} to={item.path}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Button>
                </Link>
              ))}

              {/* Admin Console - only for admin/manager */}
              {showAdminNav && (
                <>
                  <div className="w-px h-6 bg-border mx-2" />
                  <Link to="/admin">
                    <Button
                      variant={location.pathname.startsWith('/admin') ? 'secondary' : 'ghost'}
                      size="sm"
                      className="gap-2"
                      data-jarvis-id="nav-admin"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Admin
                    </Button>
                  </Link>
                </>
              )}
            </nav>

            {/* Right Side Actions */}
            <div className="flex items-center gap-3">
              <PendingRequestsBadge />
              
              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div className="hidden sm:flex flex-col items-end max-w-[150px]">
                      <span className="text-[11px] leading-tight text-muted-foreground">{timeGreeting}</span>
                      <span className="text-[13px] font-medium leading-tight truncate">{displayName}</span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium truncate">{user?.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {currentWorkspace?.name || 'No workspace'}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link to="/profile" className="flex items-center">
                        <User className="w-4 h-4 mr-2" />
                        Profile & Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link to="/workspace-settings" className="flex items-center">
                        <Building2 className="w-4 h-4 mr-2" />
                        Workspace Settings
                      </Link>
                    </DropdownMenuItem>
                    {showAdminNav && (
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link to="/admin" className="flex items-center">
                          <ShieldCheck className="w-4 h-4 mr-2" />
                          Admin Console
                        </Link>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />

                  {/* Dark Mode Toggle inline */}
                  <DropdownMenuItem
                    className="cursor-pointer flex items-center justify-between"
                    onSelect={(e) => {
                      e.preventDefault();
                      setTheme(theme === 'dark' ? 'light' : 'dark');
                    }}
                  >
                    <span className="flex items-center">
                      {theme === 'dark' ? (
                        <Sun className="w-4 h-4 mr-2" />
                      ) : (
                        <Moon className="w-4 h-4 mr-2" />
                      )}
                      {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Demo Mode Banner - Only shown when in demo */}
      {showBanner && (
        <DemoBanner variant={bannerVariant} />
      )}

      {/* Page Content */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
};
