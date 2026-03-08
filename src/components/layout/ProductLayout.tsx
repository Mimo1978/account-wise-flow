import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PendingRequestsBadge } from '@/components/access/PendingRequestsBadge';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useDemoIndicator } from '@/hooks/use-workspace-mode';
import { DemoBanner } from '@/components/layout/DemoBanner';
import { usePermissions } from '@/hooks/use-permissions';
import { useNewApplicationsCount } from '@/hooks/use-jobs';
import { 
  Sparkles, 
  LayoutDashboard, 
  Database, 
  Users, 
  Building2,
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
  const location = useLocation();
  const navigate = useNavigate();

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
    { path: '/contacts', label: 'Contacts', icon: Users, jarvisId: 'nav-contacts' },
    { path: '/talent', label: 'Talent', icon: Database, jarvisId: 'nav-talent' },
    { path: '/jobs', label: 'Jobs', icon: BookOpen, jarvisId: 'nav-jobs' },
    { path: '/outreach', label: 'Outreach', icon: Megaphone, jarvisId: 'nav-outreach' },
    { path: '/insights', label: 'Insights', icon: BarChart3, jarvisId: 'nav-insights' },
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
              <NavItemsWithBadges navItems={navItems} isActive={isActive} />

              
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
                    <span className="hidden sm:inline text-sm max-w-[150px] truncate">
                      {user?.email}
                    </span>
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
