import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PendingRequestsBadge } from '@/components/access/PendingRequestsBadge';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Sparkles, 
  LayoutDashboard, 
  Database, 
  Users, 
  Building2,
  Brain,
  BookOpen,
  LogOut,
  User,
  BarChart3
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ProductLayoutProps {
  children: React.ReactNode;
}

export const ProductLayout: React.FC<ProductLayoutProps> = ({ children }) => {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/canvas', label: 'Canvas', icon: LayoutDashboard },
    { path: '/contacts', label: 'Database', icon: Database },
    { path: '/talent', label: 'Talent', icon: Users },
    { path: '/insights', label: 'Insights', icon: BarChart3 },
  ];

  const aiNavItems = [
    { path: '/canvas', label: 'Knowledge', icon: BookOpen, hash: '#knowledge' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background">
      {/* Product Navigation Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/canvas" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                CLIENT MAPPER
              </span>
            </Link>

            {/* Main Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActive(item.path) ? 'secondary' : 'ghost'}
                    size="sm"
                    className="gap-2"
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
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
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium truncate">{user?.email}</p>
                    <p className="text-xs text-muted-foreground">Workspace</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link to="/canvas" className="flex items-center">
                      <User className="w-4 h-4 mr-2" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link to="/canvas" className="flex items-center">
                      <Building2 className="w-4 h-4 mr-2" />
                      Workspace Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Page Content */}
      {children}
    </div>
  );
};
