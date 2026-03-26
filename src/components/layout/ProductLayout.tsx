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
import { NAV_COLOURS, getNavColour } from '@/lib/nav-colours';
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
    { path: '/crm/deals', label: 'Deals', icon: Database, jarvisId: 'nav-deals' },
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

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  // "More" dropdown state
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [moreOpen]);


  const NavItem = ({ item }: { item: { path: string; label: string; icon: any; jarvisId: string; badge?: boolean } }) => {
    const active = isActive(item.path);
    const dotColour = NAV_COLOURS[item.path] ?? '#94A3B8';
    return (
      <Link
        to={item.path}
        data-jarvis-id={item.jarvisId}
        className={`group/nav relative flex items-center gap-[5px] px-2 py-1.5 text-[12px] rounded-md transition-colors duration-150 whitespace-nowrap shrink-0`}
        style={{
          background: active ? `${dotColour}1F` : undefined,
          color: active ? dotColour : undefined,
          borderBottom: active ? `2px solid ${dotColour}` : '2px solid transparent',
        }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.borderBottom = `2px solid ${dotColour}`;
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            e.currentTarget.style.borderBottom = '2px solid transparent';
            e.currentTarget.style.background = '';
          }
        }}
      >
        <span
          className="shrink-0 rounded-full"
          style={{
            width: 6, height: 6,
            backgroundColor: dotColour,
            opacity: active ? 1 : 0.7,
            transition: 'opacity 150ms',
          }}
        />
        <item.icon className="w-4 h-4 shrink-0" />
        <span style={{ opacity: active ? 1 : 0.5, transition: 'opacity 150ms' }}
          className="group-hover/nav:!opacity-100">{item.label}</span>
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
            <nav className="hidden md:flex items-center gap-0 min-w-0">
              {/* Primary nav items - always visible */}
              {navItems.map((item) => (
                <NavItem key={item.path} item={item} />
              ))}

              {/* Overflow items - visible above 1280px */}
              {overflowNavItems.map((item) => (
                <span key={item.path} className="hidden 2lg:inline-flex">
                  <NavItem item={item} />
                </span>
              ))}

              {/* More dropdown - visible below 1280px */}
              <div ref={moreRef} className="relative shrink-0 2lg:hidden">
                <button
                  onClick={() => setMoreOpen(!moreOpen)}
                  className={`flex items-center gap-[5px] px-2 py-1.5 text-[12px] rounded-md transition-colors duration-150 whitespace-nowrap
                    ${moreOpen || overflowNavItems.some(i => isActive(i.path))
                      ? 'text-[#378ADD]'
                      : 'text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.06)]'
                    }
                  `}
                  style={{
                    borderBottom: overflowNavItems.some(i => isActive(i.path)) ? '2px solid #378ADD' : '2px solid transparent',
                  }}
                >
                  More
                  <ChevronDown className="w-3 h-3" />
                </button>
                {moreOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-lg border border-border bg-[#0F1117] shadow-lg p-1">
                    {overflowNavItems.map((item) => {
                      const dc = NAV_COLOURS[item.path] ?? '#94A3B8';
                      const act = isActive(item.path);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setMoreOpen(false)}
                          className={`flex items-center gap-2 px-3 py-2 text-[12px] rounded-md transition-colors ${
                            act
                              ? ''
                              : 'text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.06)]'
                          }`}
                          style={act ? { color: dc, background: `${dc}1F` } : undefined}
                        >
                          <span className="shrink-0 rounded-full" style={{ width: 6, height: 6, backgroundColor: dc, opacity: act ? 1 : 0.7 }} />
                          <item.icon className="w-4 h-4" />
                          {item.label}
                          {item.badge && item.path === '/jobs' && newAppCount > 0 && (
                            <span className="ml-auto min-w-[16px] h-[16px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-0.5">
                              {newAppCount > 99 ? '99+' : newAppCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                    {showAdminNav && (
                      <>
                        <div className="h-px bg-border my-1" />
                        <Link
                          to="/admin"
                          onClick={() => setMoreOpen(false)}
                          className={`flex items-center gap-2 px-3 py-2 text-[12px] rounded-md transition-colors ${
                            isActive('/admin')
                              ? ''
                              : 'text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.06)]'
                          }`}
                          style={isActive('/admin') ? { color: '#e879f9', background: 'rgba(232,121,249,0.12)' } : undefined}
                        >
                          <span className="shrink-0 rounded-full" style={{ width: 6, height: 6, backgroundColor: '#e879f9', opacity: isActive('/admin') ? 1 : 0.7 }} />
                          <ShieldCheck className="w-4 h-4" />
                          Admin
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Admin Console - visible above 1280px */}
              {showAdminNav && (
                <span className="shrink-0 hidden 2lg:inline-flex items-center">
                  <div className="w-px h-4 bg-border mx-1" />
                  <Link
                    to="/admin"
                    data-jarvis-id="nav-admin"
                    className={`flex items-center gap-[5px] px-2 py-1.5 text-[12px] rounded-md transition-colors duration-150 whitespace-nowrap
                      ${isActive('/admin')
                        ? 'text-[#378ADD]'
                        : 'text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.06)]'
                      }
                    `}
                    style={{
                      borderBottom: isActive('/admin') ? '2px solid #378ADD' : '2px solid transparent',
                    }}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Admin
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
                    <div className="hidden sm:flex flex-col items-end max-w-[160px]">
                      <span className="text-[11px] leading-tight text-muted-foreground">{timeGreeting}</span>
                      <span className="text-[13px] font-medium leading-tight truncate max-w-[160px]">{displayName}</span>
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

      {/* Page accent line */}
      {(() => {
        const accent = getNavColour(location.pathname);
        return accent ? <div style={{ height: 3, backgroundColor: accent }} /> : null;
      })()}

      {/* Page Content */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
};
