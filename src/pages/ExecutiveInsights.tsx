import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  Users, 
  AlertTriangle, 
  TrendingUp, 
  MessageSquare, 
  Bell,
  RefreshCw,
  Building2,
  ChevronRight
} from 'lucide-react';
import { RelationshipCoverageSection } from '@/components/insights/RelationshipCoverageSection';
import { AccountHealthSection } from '@/components/insights/AccountHealthSection';
import { OpportunityIntelligenceSection } from '@/components/insights/OpportunityIntelligenceSection';
import { ConversationIntelligenceSection } from '@/components/insights/ConversationIntelligenceSection';
import { AlertsTriggersSection } from '@/components/insights/AlertsTriggersSection';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const ExecutiveInsights = () => {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch companies for portfolio selector
  const { data: companies } = useQuery({
    queryKey: ['companies-for-insights'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, industry, size')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Trigger refresh of all insight sections
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Executive Insights</h1>
            <p className="text-muted-foreground">
              Relationship intelligence across your portfolio — updated in real-time
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Company/Portfolio Filter */}
            <select 
              className="h-10 px-3 rounded-md border border-input bg-background text-sm"
              value={selectedCompanyId || 'all'}
              onChange={(e) => setSelectedCompanyId(e.target.value === 'all' ? null : e.target.value)}
            >
              <option value="all">All Accounts</option>
              {companies?.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <QuickStatCard 
            label="Accounts Monitored" 
            value={companies?.length || 0} 
            icon={Building2}
            trend="neutral"
          />
          <QuickStatCard 
            label="At-Risk Signals" 
            value={3} 
            icon={AlertTriangle}
            trend="negative"
            trendLabel="+1 this week"
          />
          <QuickStatCard 
            label="Expansion Opportunities" 
            value={7} 
            icon={TrendingUp}
            trend="positive"
            trendLabel="2 high priority"
          />
          <QuickStatCard 
            label="Avg Coverage" 
            value="64%" 
            icon={Users}
            trend="neutral"
          />
          <QuickStatCard 
            label="Upcoming Renewals" 
            value={4} 
            icon={Bell}
            trend="warning"
            trendLabel="Next 90 days"
          />
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="coverage" className="space-y-6">
          <TabsList className="bg-muted/50 p-1 h-auto flex-wrap">
            <TabsTrigger value="coverage" className="gap-2 data-[state=active]:bg-background">
              <BarChart3 className="w-4 h-4" />
              Coverage
            </TabsTrigger>
            <TabsTrigger value="health" className="gap-2 data-[state=active]:bg-background">
              <AlertTriangle className="w-4 h-4" />
              Health & Risk
            </TabsTrigger>
            <TabsTrigger value="opportunities" className="gap-2 data-[state=active]:bg-background">
              <TrendingUp className="w-4 h-4" />
              Opportunities
            </TabsTrigger>
            <TabsTrigger value="conversations" className="gap-2 data-[state=active]:bg-background">
              <MessageSquare className="w-4 h-4" />
              Conversations
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2 data-[state=active]:bg-background">
              <Bell className="w-4 h-4" />
              Alerts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="coverage">
            <RelationshipCoverageSection 
              companyId={selectedCompanyId} 
              isRefreshing={isRefreshing}
            />
          </TabsContent>

          <TabsContent value="health">
            <AccountHealthSection 
              companyId={selectedCompanyId}
              isRefreshing={isRefreshing}
            />
          </TabsContent>

          <TabsContent value="opportunities">
            <OpportunityIntelligenceSection 
              companyId={selectedCompanyId}
              isRefreshing={isRefreshing}
            />
          </TabsContent>

          <TabsContent value="conversations">
            <ConversationIntelligenceSection 
              companyId={selectedCompanyId}
              isRefreshing={isRefreshing}
            />
          </TabsContent>

          <TabsContent value="alerts">
            <AlertsTriggersSection 
              companyId={selectedCompanyId}
              isRefreshing={isRefreshing}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

interface QuickStatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend: 'positive' | 'negative' | 'warning' | 'neutral';
  trendLabel?: string;
}

const QuickStatCard: React.FC<QuickStatCardProps> = ({ 
  label, 
  value, 
  icon: Icon, 
  trend, 
  trendLabel 
}) => {
  const trendColors = {
    positive: 'text-green-600 bg-green-50',
    negative: 'text-red-600 bg-red-50',
    warning: 'text-amber-600 bg-amber-50',
    neutral: 'text-muted-foreground bg-muted/50'
  };

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className={`p-2 rounded-lg ${trendColors[trend]}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold mb-1">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
        {trendLabel && (
          <div className={`text-xs mt-1 ${trend === 'positive' ? 'text-green-600' : trend === 'negative' ? 'text-red-600' : trend === 'warning' ? 'text-amber-600' : 'text-muted-foreground'}`}>
            {trendLabel}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ExecutiveInsights;
