import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PendingRequestsBadge } from '@/components/access/PendingRequestsBadge';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useDemoIndicator } from '@/hooks/use-workspace-mode';
import { DemoBanner } from '@/components/layout/DemoBanner';
import { usePermissions } from '@/hooks/use-permissions';
import { useNewApplicationsCount } from '@/hooks/use-jobs';
import { useEffect, useState, useRef } from 'react';
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
  ChevronDown,
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
  ];

  // These collapse into "More" dropdown below 1280px
  const overflowNavItems = [
    { path: '/jobs', label: 'Jobs', icon: BookOpen, jarvisId: 'nav-jobs', badge: true },
    { path: '/outreach', label: 'Outreach', icon: Megaphone, jarvisId: 'nav-outreach' },
    { path: '/insights', label: 'Analytics', icon: BarChart3, jarvisId: 'nav-analytics' },
  ];

  const NavItem = ({ item }: { item: { path: string; label: string; icon: any; jarvisId: string; badge?: boolean } }) => {
    const active = isActive(item.path);
    return (
      <Link
        to={item.path}
        data-jarvis-id={item.jarvisId}
        className={`relative flex items-center gap-[5px] px-2 py-1.5 text-[12px] rounded-md transition-colors duration-150 whitespace-nowrap shrink-0
          ${active
            ? 'text-[#378ADD]'
            : 'text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.06)]'
          }
        `}
        style={{
          borderBottom: active ? '2px solid #378ADD' : '2px solid transparent',
        }}
        onMouseEnter={(e) => { if (!active) (e.currentTarget.style.borderBottom = '2px solid #378ADD'); }}
        onMouseLeave={(e) => { if (!active) (e.currentTarget.style.borderBottom = '2px solid transparent'); }}
      >
        <item.icon className="w-4 h-4 shrink-0" />
        <span>{item.label}</span>
        {item.badge && item.path === '/jobs' && newAppCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-0.5">
            {newAppCount > 99 ? '99+' : newAppCount}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Product Navigation Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between gap-2">
            {/* Logo */}
            <Link to="/home" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0 min-w-[40px]">
              <div className="w-8 h-8 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold bg-gradient-primary bg-clip-text text-transparent hidden xl-logo:block">
                CLIENT MAPPER
              </span>
              {showBadge && (
                <Badge variant="secondary" className="ml-1 text-xs hidden lg:inline-flex">
                  Demo
                </Badge>
              )}
            </Link>

            {/* Main Navigation */}
            <nav className="hidden md:flex items-center gap-0.5 min-w-0 overflow-hidden">
              {/* Primary nav items - always visible */}
              {navItems.map((item) => (
                <span key={item.path} className="shrink-0">
                  {/* Full labels above 1280px */}
                  <span className="hidden 2lg:inline-flex">
                    <NavButton item={item} />
                  </span>
                  {/* Icon-only below 1280px */}
                  <span className="inline-flex 2lg:hidden">
                    <NavButton item={item} iconOnly />
                  </span>
                </span>
              ))}

              {/* Overflow items - visible above 1024px, hidden into More below */}
              {overflowNavItems.map((item) => (
                <span key={item.path} className="shrink-0 hidden lg:inline-flex">
                  {/* Full labels above 1280px */}
                  <span className="hidden 2lg:inline-flex">
                    <NavButton item={item} />
                  </span>
                  {/* Icon-only below 1280px */}
                  <span className="inline-flex 2lg:hidden">
                    <NavButton item={item} iconOnly />
                  </span>
                </span>
              ))}

              {/* More dropdown - visible below 1024px */}
              <div ref={moreRef} className="relative shrink-0 lg:hidden">
                <Button
                  variant={moreOpen ? 'secondary' : 'ghost'}
                  size="sm"
                  className="gap-1 px-2.5 text-[13px]"
                  onClick={() => setMoreOpen(!moreOpen)}
                >
                  More
                  <ChevronDown className="w-3 h-3" />
                </Button>
                {moreOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-lg border border-border bg-background shadow-lg p-1">
                    {overflowNavItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMoreOpen(false)}
                        className={`flex items-center gap-2 px-3 py-2 text-[13px] rounded-md transition-colors ${
                          isActive(item.path)
                            ? 'bg-secondary text-secondary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                        }`}
                      >
                        <item.icon className="w-3.5 h-3.5" />
                        {item.label}
                        {item.badge && item.path === '/jobs' && newAppCount > 0 && (
                          <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
                            {newAppCount > 99 ? '99+' : newAppCount}
                          </span>
                        )}
                      </Link>
                    ))}
                    {showAdminNav && (
                      <>
                        <div className="h-px bg-border my-1" />
                        <Link
                          to="/admin"
                          onClick={() => setMoreOpen(false)}
                          className={`flex items-center gap-2 px-3 py-2 text-[13px] rounded-md transition-colors ${
                            isActive('/admin')
                              ? 'bg-secondary text-secondary-foreground'
                              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Admin
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Admin Console - only for admin/manager, visible above 1024px */}
              {showAdminNav && (
                <span className="shrink-0 hidden lg:inline-flex">
                  <div className="w-px h-5 bg-border mx-1" />
                  <Link to="/admin">
                    <Button
                      variant={location.pathname.startsWith('/admin') ? 'secondary' : 'ghost'}
                      size="sm"
                      className="gap-1 px-2.5 text-[13px]"
                      data-jarvis-id="nav-admin"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span className="hidden 2lg:inline">Admin</span>
                    </Button>
                  </Link>
                </span>
              )}
            </nav>

            {/* Right Side Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <PendingRequestsBadge />
              
              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 max-w-[180px]">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div className="hidden sm:flex flex-col items-end max-w-[140px]">
                      <span className="text-[11px] leading-tight text-muted-foreground">{timeGreeting}</span>
                      <span className="text-[13px] font-medium leading-tight truncate max-w-[140px]">{displayName}</span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
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
