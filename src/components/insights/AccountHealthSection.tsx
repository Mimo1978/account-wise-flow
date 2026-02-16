import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  TrendingDown,
  ChevronRight,
  Lightbulb,
  Info,
  Building2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface AccountHealthSectionProps {
  companyId: string | null;
  isRefreshing: boolean;
}

interface HealthSignal {
  id: string;
  type: 'risk' | 'warning' | 'positive';
  title: string;
  description: string;
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
  suggestedAction: string;
  companyName: string;
  companyId: string;
}

export const AccountHealthSection: React.FC<AccountHealthSectionProps> = ({ 
  companyId,
  isRefreshing 
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Fetch health signals via AI analysis
  const { data: healthSignals, isLoading, refetch } = useQuery({
    queryKey: ['account-health', companyId],
    queryFn: async () => {
      // Get companies and their data for analysis
      let query = supabase
        .from('companies')
        .select(`
          id,
          name,
          industry,
          contacts:contacts(id, name, title, department, email, updated_at),
          notes:notes(id, content, created_at, pinned)
        `);

      if (companyId) {
        query = query.eq('id', companyId);
      }

      const { data: companies, error } = await query.limit(20);
      if (error) throw error;

      // Generate health signals based on data patterns
      const signals: HealthSignal[] = [];
      
      companies?.forEach(company => {
        const contacts = Array.isArray(company.contacts) ? company.contacts : [];
        const notes = Array.isArray(company.notes) ? company.notes : [];
        
        // Check for engagement recency
        const lastContactUpdate = contacts.length > 0 
          ? new Date(Math.max(...contacts.map(c => new Date(c.updated_at).getTime())))
          : null;
        const daysSinceUpdate = lastContactUpdate 
          ? Math.floor((Date.now() - lastContactUpdate.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        if (daysSinceUpdate && daysSinceUpdate > 60) {
          signals.push({
            id: `stale-${company.id}`,
            type: 'warning',
            title: 'Low Recent Engagement',
            description: `No contact updates in ${daysSinceUpdate} days`,
            explanation: 'Extended periods without engagement often precede account churn. Regular touchpoints maintain relationship health.',
            confidence: 'high',
            suggestedAction: 'Schedule a check-in call with your primary contact',
            companyName: company.name,
            companyId: company.id
          });
        }

        // Check for single-threaded risk
        const seniorTitles = ['CEO', 'CFO', 'CTO', 'VP', 'Director', 'Head'];
        const seniorContacts = contacts.filter((c: any) => 
          seniorTitles.some(title => c.title?.toLowerCase().includes(title.toLowerCase()))
        );
        
        if (contacts.length > 3 && seniorContacts.length <= 1) {
          signals.push({
            id: `single-thread-${company.id}`,
            type: 'risk',
            title: 'Single-Threaded Relationship',
            description: 'Only one senior stakeholder mapped',
            explanation: 'Relationships dependent on a single executive are fragile. If they leave or change roles, you lose access.',
            confidence: 'high',
            suggestedAction: 'Identify and connect with additional decision-makers',
            companyName: company.name,
            companyId: company.id
          });
        }

        // Check for no executive access
        if (contacts.length > 0 && seniorContacts.length === 0) {
          signals.push({
            id: `no-exec-${company.id}`,
            type: 'risk',
            title: 'No Executive Access',
            description: 'No C-level or VP contacts mapped',
            explanation: 'Strategic decisions happen at the executive level. Without access, you may be blindsided by changes.',
            confidence: 'high',
            suggestedAction: 'Request an executive introduction from your current contacts',
            companyName: company.name,
            companyId: company.id
          });
        }

        // Positive signal for well-covered accounts
        if (seniorContacts.length >= 3 && contacts.length >= 8) {
          signals.push({
            id: `healthy-${company.id}`,
            type: 'positive',
            title: 'Strong Relationship Coverage',
            description: 'Multiple senior stakeholders engaged',
            explanation: 'Multi-threaded relationships are resilient. You have broad organizational access.',
            confidence: 'high',
            suggestedAction: 'Maintain regular engagement across all contacts',
            companyName: company.name,
            companyId: company.id
          });
        }
      });

      // Sort by severity
      return signals.sort((a, b) => {
        const order = { risk: 0, warning: 1, positive: 2 };
        return order[a.type] - order[b.type];
      });
    }
  });

  const runAIAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-insights-analysis', {
        body: { companyId, analysisType: 'health' }
      });
      
      if (error) throw error;
      toast.success('Analysis complete');
      refetch();
    } catch (err) {
      toast.error('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoading || isRefreshing) {
    return <HealthLoadingSkeleton />;
  }

  const riskSignals = healthSignals?.filter(s => s.type === 'risk') || [];
  const warningSignals = healthSignals?.filter(s => s.type === 'warning') || [];
  const positiveSignals = healthSignals?.filter(s => s.type === 'positive') || [];

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className={riskSignals.length > 0 ? 'border-red-200 bg-red-50/30' : 'border-green-200 bg-green-50/30'}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${riskSignals.length > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                {riskSignals.length > 0 ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
              </div>
              <div>
                <div className="text-2xl font-bold">{riskSignals.length}</div>
                <div className="text-sm text-muted-foreground">Critical Risks</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={warningSignals.length > 0 ? 'border-amber-200 bg-amber-50/30' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${warningSignals.length > 0 ? 'bg-amber-100 text-amber-600' : 'bg-muted text-muted-foreground'}`}>
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{warningSignals.length}</div>
                <div className="text-sm text-muted-foreground">Warnings</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 text-green-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{positiveSignals.length}</div>
                <div className="text-sm text-muted-foreground">Healthy Accounts</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Signal List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Health Signals</CardTitle>
            <CardDescription>
              AI-generated insights with explanations and recommended actions
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={runAIAnalysis}
            disabled={isAnalyzing}
          >
            <Lightbulb className={`w-4 h-4 mr-2 ${isAnalyzing ? 'animate-pulse' : ''}`} />
            {isAnalyzing ? 'Analyzing...' : 'Deep Analysis'}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {healthSignals?.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}

            {(!healthSignals || healthSignals.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No health signals detected.</p>
                <p className="text-sm mt-1">Add more account data to enable analysis.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

interface SignalCardProps {
  signal: HealthSignal;
}

const SignalCard: React.FC<SignalCardProps> = ({ signal }) => {
  const [expanded, setExpanded] = useState(false);
  
  const typeStyles = {
    risk: 'border-red-200 bg-red-50/50',
    warning: 'border-amber-200 bg-amber-50/50',
    positive: 'border-green-200 bg-green-50/50'
  };

  const iconStyles = {
    risk: 'bg-red-100 text-red-600',
    warning: 'bg-amber-100 text-amber-600',
    positive: 'bg-green-100 text-green-600'
  };

  const icons = {
    risk: AlertTriangle,
    warning: Clock,
    positive: CheckCircle2
  };

  const Icon = icons[signal.type];

  const confidenceColors = {
    high: 'bg-primary/10 text-primary',
    medium: 'bg-muted text-muted-foreground',
    low: 'bg-muted/50 text-muted-foreground'
  };

  return (
    <div className={`p-4 rounded-lg border ${typeStyles[signal.type]} transition-all`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${iconStyles[signal.type]}`}>
          <Icon className="w-4 h-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium">{signal.title}</h4>
            <Badge variant="outline" className={`text-xs ${confidenceColors[signal.confidence]}`}>
              {signal.confidence} confidence
            </Badge>
          </div>
          
          <p className="text-sm text-muted-foreground mb-2">{signal.description}</p>
          
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-3 h-3 text-muted-foreground" />
            <Link 
              to={`/canvas?company=${signal.companyId}`}
              className="text-primary hover:underline"
            >
              {signal.companyName}
            </Link>
          </div>

          {expanded && (
            <div className="mt-4 space-y-3 border-t border-border/50 pt-3">
              <div>
                <div className="flex items-center gap-1 text-sm font-medium mb-1">
                  <Info className="w-3 h-3" />
                  Why this matters
                </div>
                <p className="text-sm text-muted-foreground">{signal.explanation}</p>
              </div>
              <div>
                <div className="flex items-center gap-1 text-sm font-medium mb-1">
                  <Lightbulb className="w-3 h-3" />
                  Suggested action
                </div>
                <p className="text-sm text-muted-foreground">{signal.suggestedAction}</p>
              </div>
            </div>
          )}
        </div>

        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Less' : 'Details'}
        </Button>
      </div>
    </div>
  );
};

const HealthLoadingSkeleton = () => (
  <div className="space-y-6">
    <div className="grid md:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div>
                <Skeleton className="h-8 w-12 mb-1" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-64 mt-2" />
      </CardHeader>
      <CardContent>
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 rounded-lg border border-border/50 mb-3">
            <div className="flex items-start gap-3">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-5 w-40 mb-2" />
                <Skeleton className="h-4 w-60 mb-2" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  </div>
);
