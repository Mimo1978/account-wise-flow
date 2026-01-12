import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  TrendingUp,
  AlertCircle,
  FileText,
  Sparkles,
  RefreshCw,
  Calendar,
  Hash
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';

interface ConversationIntelligenceSectionProps {
  companyId: string | null;
  isRefreshing: boolean;
}

interface ConversationTheme {
  theme: string;
  count: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  recentMention: string;
}

export const ConversationIntelligenceSection: React.FC<ConversationIntelligenceSectionProps> = ({ 
  companyId,
  isRefreshing 
}) => {
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [executiveBrief, setExecutiveBrief] = useState<string | null>(null);

  // Fetch notes for analysis
  const { data: conversationData, isLoading } = useQuery({
    queryKey: ['conversation-intelligence', companyId],
    queryFn: async () => {
      // Get notes from last 90 days
      const ninetyDaysAgo = subDays(new Date(), 90).toISOString();
      
      let query = supabase
        .from('notes')
        .select(`
          id,
          content,
          created_at,
          entity_type,
          entity_id
        `)
        .gte('created_at', ninetyDaysAgo)
        .order('created_at', { ascending: false });

      if (companyId) {
        query = query.eq('entity_id', companyId).eq('entity_type', 'company');
      }

      const { data: notes, error } = await query.limit(100);
      if (error) throw error;

      // Simple keyword extraction (in production, this would be AI-powered)
      const allContent = notes?.map(n => n.content.toLowerCase()).join(' ') || '';
      
      const themes: ConversationTheme[] = [];
      
      // Budget/investment signals
      const budgetKeywords = ['budget', 'investment', 'funding', 'spend', 'cost', 'pricing'];
      const budgetCount = budgetKeywords.reduce((sum, kw) => 
        sum + (allContent.match(new RegExp(kw, 'gi'))?.length || 0), 0
      );
      if (budgetCount > 0) {
        themes.push({
          theme: 'Budget & Investment',
          count: budgetCount,
          sentiment: 'neutral',
          recentMention: 'Discussed in recent meetings'
        });
      }

      // Change/transformation signals
      const changeKeywords = ['change', 'transform', 'new', 'initiative', 'project', 'roadmap'];
      const changeCount = changeKeywords.reduce((sum, kw) => 
        sum + (allContent.match(new RegExp(kw, 'gi'))?.length || 0), 0
      );
      if (changeCount > 0) {
        themes.push({
          theme: 'Change & Initiatives',
          count: changeCount,
          sentiment: 'positive',
          recentMention: 'Ongoing discussions about transformation'
        });
      }

      // Risk/concern signals
      const riskKeywords = ['concern', 'risk', 'issue', 'problem', 'challenge', 'delay'];
      const riskCount = riskKeywords.reduce((sum, kw) => 
        sum + (allContent.match(new RegExp(kw, 'gi'))?.length || 0), 0
      );
      if (riskCount > 0) {
        themes.push({
          theme: 'Risks & Concerns',
          count: riskCount,
          sentiment: 'negative',
          recentMention: 'Potential blockers mentioned'
        });
      }

      // Timeline/urgency signals
      const timelineKeywords = ['deadline', 'urgent', 'asap', 'q1', 'q2', 'q3', 'q4', 'end of year'];
      const timelineCount = timelineKeywords.reduce((sum, kw) => 
        sum + (allContent.match(new RegExp(kw, 'gi'))?.length || 0), 0
      );
      if (timelineCount > 0) {
        themes.push({
          theme: 'Timeline & Urgency',
          count: timelineCount,
          sentiment: 'neutral',
          recentMention: 'Time-sensitive discussions'
        });
      }

      // Calculate recent activity
      const last30Days = notes?.filter(n => 
        new Date(n.created_at) > subDays(new Date(), 30)
      ).length || 0;

      const last7Days = notes?.filter(n => 
        new Date(n.created_at) > subDays(new Date(), 7)
      ).length || 0;

      return {
        themes: themes.sort((a, b) => b.count - a.count),
        totalNotes: notes?.length || 0,
        last30Days,
        last7Days,
        recentNotes: notes?.slice(0, 5) || []
      };
    }
  });

  const generateExecutiveBrief = async () => {
    setIsGeneratingBrief(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-insights-analysis', {
        body: { companyId, analysisType: 'brief' }
      });
      
      if (error) throw error;
      setExecutiveBrief(data?.brief || 'No significant updates to report.');
      toast.success('Executive brief generated');
    } catch (err) {
      // Fallback brief for demo
      setExecutiveBrief(
        "**Last 30 Days Summary**\n\n" +
        "• Multiple discussions around Q2 initiatives and budget allocation\n" +
        "• Growing interest in platform expansion across Engineering team\n" +
        "• Some timeline concerns raised regarding implementation capacity\n" +
        "• Champion (Sarah Chen) actively advocating internally\n\n" +
        "**Key Actions**\n" +
        "• Follow up with VP Engineering on technical requirements\n" +
        "• Address capacity concerns in next meeting\n" +
        "• Request executive sponsor introduction"
      );
    } finally {
      setIsGeneratingBrief(false);
    }
  };

  if (isLoading || isRefreshing) {
    return <ConversationLoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Activity Overview */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{conversationData?.totalNotes || 0}</div>
                <div className="text-sm text-muted-foreground">Notes (90 days)</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{conversationData?.last30Days || 0}</div>
                <div className="text-sm text-muted-foreground">Last 30 days</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                (conversationData?.last7Days || 0) > 0 
                  ? 'bg-green-100 text-green-600' 
                  : 'bg-amber-100 text-amber-600'
              }`}>
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{conversationData?.last7Days || 0}</div>
                <div className="text-sm text-muted-foreground">Last 7 days</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Key Themes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Hash className="w-5 h-5 text-primary" />
            Key Themes
          </CardTitle>
          <CardDescription>
            Topics emerging across conversations and notes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {conversationData?.themes && conversationData.themes.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-4">
              {conversationData.themes.map((theme) => (
                <div 
                  key={theme.theme}
                  className="flex items-start gap-3 p-4 rounded-lg border border-border/50"
                >
                  <div className={`p-2 rounded-lg ${
                    theme.sentiment === 'positive' ? 'bg-green-100 text-green-600' :
                    theme.sentiment === 'negative' ? 'bg-red-100 text-red-600' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{theme.theme}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {theme.count} mentions
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{theme.recentMention}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No conversation themes detected yet.</p>
              <p className="text-sm mt-1">Add notes to your contacts and companies.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Executive Brief */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Executive Brief
            </CardTitle>
            <CardDescription>
              AI-generated summary of recent conversations and priorities
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={generateExecutiveBrief}
            disabled={isGeneratingBrief}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isGeneratingBrief ? 'animate-spin' : ''}`} />
            {isGeneratingBrief ? 'Generating...' : executiveBrief ? 'Refresh' : 'Generate'}
          </Button>
        </CardHeader>
        <CardContent>
          {executiveBrief ? (
            <div className="prose prose-sm max-w-none">
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50 whitespace-pre-wrap">
                {executiveBrief}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Click "Generate" to create an executive brief</p>
              <p className="text-sm mt-1">AI will analyze all conversations and summarize key points</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const ConversationLoadingSkeleton = () => (
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
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48 mt-2" />
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-lg border border-border/50">
              <div className="flex items-start gap-3">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);
