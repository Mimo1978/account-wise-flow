import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  Calendar,
  AlertTriangle,
  Clock,
  UserMinus,
  FileWarning,
  ChevronRight,
  CheckCircle2,
  Building2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { format, addDays, differenceInDays } from 'date-fns';

interface AlertsTriggersSectionProps {
  companyId: string | null;
  isRefreshing: boolean;
}

interface Alert {
  id: string;
  type: 'renewal' | 'quiet' | 'departure' | 'expiry';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  dueDate?: Date;
  daysRemaining?: number;
  companyName: string;
  companyId: string;
  actionLabel: string;
  actionPath: string;
}

export const AlertsTriggersSection: React.FC<AlertsTriggersSectionProps> = ({ 
  companyId,
  isRefreshing 
}) => {
  // Generate alerts based on data patterns
  const { data: alerts, isLoading } = useQuery({
    queryKey: ['alerts-triggers', companyId],
    queryFn: async () => {
      // Get companies and contacts for analysis
      let query = supabase
        .from('companies')
        .select(`
          id,
          name,
          updated_at,
          contacts:contacts(id, name, title, updated_at)
        `);

      if (companyId) {
        query = query.eq('id', companyId);
      }

      const { data: companies, error } = await query.limit(50);
      if (error) throw error;

      const alertsList: Alert[] = [];

      companies?.forEach(company => {
        const contacts = company.contacts || [];
        
        // Check for quiet accounts (no updates in 60+ days)
        const lastUpdate = contacts.length > 0 
          ? new Date(Math.max(...contacts.map(c => new Date(c.updated_at).getTime())))
          : new Date(company.updated_at);
        
        const daysSinceUpdate = differenceInDays(new Date(), lastUpdate);

        if (daysSinceUpdate > 90) {
          alertsList.push({
            id: `quiet-${company.id}`,
            type: 'quiet',
            severity: 'critical',
            title: 'Account Going Dark',
            description: `No engagement in ${daysSinceUpdate} days`,
            companyName: company.name,
            companyId: company.id,
            actionLabel: 'Review Account',
            actionPath: `/canvas?company=${company.id}`
          });
        } else if (daysSinceUpdate > 60) {
          alertsList.push({
            id: `quiet-${company.id}`,
            type: 'quiet',
            severity: 'warning',
            title: 'Low Engagement',
            description: `No updates in ${daysSinceUpdate} days`,
            companyName: company.name,
            companyId: company.id,
            actionLabel: 'Schedule Check-in',
            actionPath: `/canvas?company=${company.id}`
          });
        }

        // Mock renewal alerts (in production, this would come from contract data)
        // Simulate some accounts having upcoming renewals
        if (company.name.length % 3 === 0) {
          const daysToRenewal = 30 + (company.name.length * 2);
          if (daysToRenewal <= 90) {
            alertsList.push({
              id: `renewal-${company.id}`,
              type: 'renewal',
              severity: daysToRenewal <= 30 ? 'critical' : 'warning',
              title: 'Renewal Approaching',
              description: `Contract renewal in ${daysToRenewal} days`,
              dueDate: addDays(new Date(), daysToRenewal),
              daysRemaining: daysToRenewal,
              companyName: company.name,
              companyId: company.id,
              actionLabel: 'Review Coverage',
              actionPath: `/canvas?company=${company.id}`
            });
          }
        }

        // Check for single-threaded risk with senior contacts
        const seniorContacts = contacts.filter(c => {
          const titles = ['CEO', 'CFO', 'CTO', 'VP', 'Director'];
          return titles.some(t => c.title?.toLowerCase().includes(t.toLowerCase()));
        });

        if (seniorContacts.length === 1 && contacts.length > 5) {
          alertsList.push({
            id: `departure-risk-${company.id}`,
            type: 'departure',
            severity: 'warning',
            title: 'Key Person Dependency',
            description: `Only ${seniorContacts[0].name} at executive level`,
            companyName: company.name,
            companyId: company.id,
            actionLabel: 'Expand Relationships',
            actionPath: `/canvas?company=${company.id}`
          });
        }
      });

      // Sort by severity
      return alertsList.sort((a, b) => {
        const order = { critical: 0, warning: 1, info: 2 };
        return order[a.severity] - order[b.severity];
      });
    }
  });

  if (isLoading || isRefreshing) {
    return <AlertsLoadingSkeleton />;
  }

  const criticalAlerts = alerts?.filter(a => a.severity === 'critical') || [];
  const warningAlerts = alerts?.filter(a => a.severity === 'warning') || [];

  return (
    <div className="space-y-6">
      {/* Alert Summary */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className={criticalAlerts.length > 0 ? 'border-red-200 bg-red-50/30' : 'border-green-200 bg-green-50/30'}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                criticalAlerts.length > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
              }`}>
                {criticalAlerts.length > 0 ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
              </div>
              <div>
                <div className="text-2xl font-bold">{criticalAlerts.length}</div>
                <div className="text-sm text-muted-foreground">Critical Alerts</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={warningAlerts.length > 0 ? 'border-amber-200 bg-amber-50/30' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                warningAlerts.length > 0 ? 'bg-amber-100 text-amber-600' : 'bg-muted text-muted-foreground'
              }`}>
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{warningAlerts.length}</div>
                <div className="text-sm text-muted-foreground">Warnings</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{alerts?.length || 0}</div>
                <div className="text-sm text-muted-foreground">Total Alerts</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Renewal Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Upcoming Renewals
          </CardTitle>
          <CardDescription>
            Contracts and renewals requiring attention in the next 90 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alerts?.filter(a => a.type === 'renewal').length > 0 ? (
            <div className="space-y-3">
              {alerts.filter(a => a.type === 'renewal').map((alert) => (
                <div 
                  key={alert.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border ${
                    alert.severity === 'critical' 
                      ? 'border-red-200 bg-red-50/30' 
                      : 'border-amber-200 bg-amber-50/30'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${
                    alert.severity === 'critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    <Calendar className="w-4 h-4" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <Link 
                        to={alert.actionPath}
                        className="font-medium hover:text-primary"
                      >
                        {alert.companyName}
                      </Link>
                    </div>
                    <p className="text-sm text-muted-foreground">{alert.description}</p>
                  </div>
                  
                  <div className="text-right">
                    <div className={`text-lg font-bold ${
                      alert.severity === 'critical' ? 'text-red-600' : 'text-amber-600'
                    }`}>
                      {alert.daysRemaining} days
                    </div>
                    {alert.dueDate && (
                      <div className="text-xs text-muted-foreground">
                        {format(alert.dueDate, 'MMM d, yyyy')}
                      </div>
                    )}
                  </div>

                  <Link to={alert.actionPath}>
                    <Button variant="outline" size="sm">
                      {alert.actionLabel}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No renewals in the next 90 days</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Active Alerts</CardTitle>
          <CardDescription>
            Actionable items requiring your attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alerts && alerts.length > 0 ? (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <AlertRow key={alert.id} alert={alert} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No alerts at this time</p>
              <p className="text-sm mt-1">Your portfolio looks healthy</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

interface AlertRowProps {
  alert: Alert;
}

const AlertRow: React.FC<AlertRowProps> = ({ alert }) => {
  const icons = {
    renewal: Calendar,
    quiet: Clock,
    departure: UserMinus,
    expiry: FileWarning
  };

  const Icon = icons[alert.type];

  const severityStyles = {
    critical: 'border-red-200 bg-red-50/50',
    warning: 'border-amber-200 bg-amber-50/50',
    info: 'border-blue-200 bg-blue-50/50'
  };

  const iconStyles = {
    critical: 'bg-red-100 text-red-600',
    warning: 'bg-amber-100 text-amber-600',
    info: 'bg-blue-100 text-blue-600'
  };

  return (
    <div className={`flex items-center gap-4 p-4 rounded-lg border ${severityStyles[alert.severity]}`}>
      <div className={`p-2 rounded-lg ${iconStyles[alert.severity]}`}>
        <Icon className="w-4 h-4" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-medium">{alert.title}</h4>
          <Badge 
            variant="outline" 
            className={`text-xs ${
              alert.severity === 'critical' ? 'border-red-300 text-red-600' :
              alert.severity === 'warning' ? 'border-amber-300 text-amber-600' :
              'border-blue-300 text-blue-600'
            }`}
          >
            {alert.severity}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{alert.description}</p>
        <div className="flex items-center gap-1 text-sm mt-1">
          <Building2 className="w-3 h-3 text-muted-foreground" />
          <Link 
            to={alert.actionPath}
            className="text-primary hover:underline"
          >
            {alert.companyName}
          </Link>
        </div>
      </div>

      <Link to={alert.actionPath}>
        <Button variant="ghost" size="sm">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </Link>
    </div>
  );
};

const AlertsLoadingSkeleton = () => (
  <div className="space-y-6">
    <div className="grid md:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div>
                <Skeleton className="h-8 w-12 mb-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64 mt-2" />
      </CardHeader>
      <CardContent>
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 rounded-lg border border-border/50 mb-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-5 w-40 mb-2" />
                <Skeleton className="h-4 w-60" />
              </div>
              <Skeleton className="w-20 h-8" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  </div>
);
