import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePremiumStatus } from '@/hooks/use-premium';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  User, Moon, Sun, Shield, Bell, Globe, Key, 
  Crown, Sparkles, Mail, Building2, Calendar,
  ChevronLeft
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from '@/components/ui/sonner';

const UserProfile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { tier, isPremium, isProfessionalOrAbove, isStarterOrAbove } = usePremiumStatus();
  const { theme, setTheme } = useTheme();

  const [displayName, setDisplayName] = useState(user?.user_metadata?.full_name || '');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [compactMode, setCompactMode] = useState(false);

  const tierColors: Record<string, string> = {
    free: 'bg-muted text-muted-foreground',
    starter: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    professional: 'bg-primary/10 text-primary',
    premium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  };

  const handleSaveProfile = () => {
    toast.success('Profile settings saved');
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl">
      <div className="mb-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 text-muted-foreground hover:text-foreground -ml-2 mb-2">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Profile & Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account, preferences, and subscription</p>
      </div>

      <div className="grid gap-6">
        {/* User Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Account Information
            </CardTitle>
            <CardDescription>Your personal details and workspace membership</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{displayName || 'User'}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  {user?.email}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Building2 className="w-3.5 h-3.5" />
                  {currentWorkspace?.name || 'No workspace'}
                </p>
              </div>
              <Badge className={tierColors[tier] || tierColors.free}>
                {tier === 'premium' && <Crown className="w-3 h-3 mr-1" />}
                {tier.charAt(0).toUpperCase() + tier.slice(1)}
              </Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input 
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email"
                  value={user?.email || ''}
                  disabled
                  className="opacity-60"
                />
              </div>
            </div>

            <Button onClick={handleSaveProfile} size="sm">
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Appearance Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {theme === 'dark' ? <Moon className="w-5 h-5 text-primary" /> : <Sun className="w-5 h-5 text-primary" />}
              Appearance
            </CardTitle>
            <CardDescription>Customize how Client Mapper looks for you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Dark Mode</p>
                <p className="text-sm text-muted-foreground">Switch between light and dark themes</p>
              </div>
              <Switch
                checked={theme === 'dark'}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Compact Mode</p>
                <p className="text-sm text-muted-foreground">Reduce spacing for denser information display</p>
              </div>
              <Switch
                checked={compactMode}
                onCheckedChange={setCompactMode}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notifications Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Notifications
            </CardTitle>
            <CardDescription>Control how you receive updates and alerts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Email Notifications</p>
                <p className="text-sm text-muted-foreground">Receive updates about your campaigns and contacts</p>
              </div>
              <Switch
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Push Notifications</p>
                <p className="text-sm text-muted-foreground">Browser notifications for real-time alerts</p>
              </div>
              <Switch
                checked={pushNotifications}
                onCheckedChange={setPushNotifications}
              />
            </div>
          </CardContent>
        </Card>

        {/* Subscription Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              Subscription & Plan
            </CardTitle>
            <CardDescription>Your current plan and available features</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {[
                { label: 'Automated Outreach AI', available: isPremium, tier: 'Premium' },
                { label: 'Calendar Auto-Scheduling', available: isPremium, tier: 'Premium' },
                { label: 'AI Response Processing', available: isPremium, tier: 'Premium' },
                { label: 'Advanced Analytics', available: isProfessionalOrAbove, tier: 'Professional' },
                { label: 'CV Export & Branding', available: isProfessionalOrAbove, tier: 'Professional' },
                { label: 'Job Spec Matching', available: isStarterOrAbove, tier: 'Starter' },
                { label: 'Talent Database', available: true, tier: 'Free' },
                { label: 'Company & Contact CRM', available: true, tier: 'Free' },
              ].map((feature) => (
                <div key={feature.label} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-foreground flex items-center gap-2">
                    <Sparkles className={`w-3.5 h-3.5 ${feature.available ? 'text-primary' : 'text-muted-foreground/40'}`} />
                    {feature.label}
                  </span>
                  <Badge variant={feature.available ? 'default' : 'outline'} className="text-[10px]">
                    {feature.available ? 'Active' : `Requires ${feature.tier}`}
                  </Badge>
                </div>
              ))}
            </div>

            {!isPremium && (
              <>
                <Separator />
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <div>
                    <p className="font-medium text-foreground text-sm">Unlock all features</p>
                    <p className="text-xs text-muted-foreground">Upgrade to Premium for full AI automation</p>
                  </div>
                  <Button size="sm" className="gap-1">
                    <Crown className="w-3.5 h-3.5" />
                    Upgrade
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Security Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Security
            </CardTitle>
            <CardDescription>Password and account security settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" size="sm" className="gap-2">
              <Key className="w-4 h-4" />
              Change Password
            </Button>
            <p className="text-xs text-muted-foreground">
              Last sign-in: {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Unknown'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserProfile;
