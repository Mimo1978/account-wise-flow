import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Users, 
  Target,
  Sparkles,
  ArrowUpRight,
  Building2,
  ChevronRight,
  Lightbulb
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface OpportunityIntelligenceSectionProps {
  companyId: string | null;
  isRefreshing: boolean;
}

interface Opportunity {
  id: string;
  type: 'expansion' | 'cross-sell' | 'relationship';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  rationale: string;
  suggestedOutreach: string;
  companyName: string;
  companyId: string;
  targetRole?: string;
}

export const OpportunityIntelligenceSection: React.FC<OpportunityIntelligenceSectionProps> = ({ 
  companyId,
  isRefreshing 
}) => {
  // Fetch opportunity data
  const { data: opportunities, isLoading } = useQuery({
    queryKey: ['opportunities', companyId],
    queryFn: async () => {
      // Get companies and their contacts for analysis
      let query = supabase
        .from('companies')
        .select(`
          id,
          name,
          industry,
          contacts:contacts(id, name, title, department)
        `);

      if (companyId) {
        query = query.eq('id', companyId);
      }

      const { data: companies, error } = await query.limit(20);
      if (error) throw error;

      // Generate opportunities based on data patterns
      const opps: Opportunity[] = [];
      
      companies?.forEach(company => {
        const contacts = Array.isArray(company.contacts) ? company.contacts : [];
        const departments = [...new Set(contacts.map(c => c.department).filter(Boolean))] as string[];
        
        // Find departments with contacts but no senior sponsor
        const deptWithNoSenior = departments.filter(dept => {
          const deptContacts = contacts.filter(c => c.department === dept);
          const seniorTitles = ['VP', 'Director', 'Head', 'Chief', 'President'];
          return !deptContacts.some(c => 
            seniorTitles.some(title => c.title?.toLowerCase().includes(title.toLowerCase()))
          );
        });

        deptWithNoSenior.forEach(dept => {
          opps.push({
            id: `expand-${company.id}-${dept}`,
            type: 'expansion',
            priority: 'high',
            title: `Expand into ${dept}`,
            description: `Active contacts in ${dept} without senior sponsorship`,
            rationale: 'You have operational relationships but no executive sponsor. This creates risk and limits strategic influence.',
            suggestedOutreach: `Request an introduction to the ${dept} leadership through your existing contacts`,
            companyName: company.name,
            companyId: company.id,
            targetRole: `VP/Director of ${dept}`
          });
        });

        // Find companies with good coverage where cross-sell might work
        if (contacts.length >= 5 && departments.length >= 2) {
          const uncoveredDepts = ['Finance', 'Operations', 'IT', 'HR', 'Sales', 'Marketing']
            .filter(d => !departments.some(existing => 
              (existing as string)?.toLowerCase().includes(d.toLowerCase())
            ));

          if (uncoveredDepts.length > 0) {
            opps.push({
              id: `crosssell-${company.id}`,
              type: 'cross-sell',
              priority: 'medium',
              title: `Cross-sell opportunity`,
              description: `Strong presence but no coverage in ${uncoveredDepts.slice(0, 2).join(', ')}`,
              rationale: 'Existing relationships provide warm introduction paths to adjacent departments.',
              suggestedOutreach: 'Leverage your champions to map stakeholders in uncovered departments',
              companyName: company.name,
              companyId: company.id,
              targetRole: uncoveredDepts[0] + ' leadership'
            });
          }
        }

        // Identify relationship strengthening opportunities
        const seniorContacts = contacts.filter(c => {
          const seniorTitles = ['VP', 'Director', 'Head', 'Chief'];
          return seniorTitles.some(title => c.title?.toLowerCase().includes(title.toLowerCase()));
        });

        if (seniorContacts.length === 1 && contacts.length > 3) {
          opps.push({
            id: `strengthen-${company.id}`,
            type: 'relationship',
            priority: 'high',
            title: 'Deepen executive relationships',
            description: 'Single senior contact with broad operational coverage',
            rationale: 'Your current executive sponsor could introduce you to peer executives, reducing dependency risk.',
            suggestedOutreach: `Ask ${seniorContacts[0].name} for introductions to their executive peers`,
            companyName: company.name,
            companyId: company.id,
            targetRole: 'Peer executives'
          });
        }
      });

      // Sort by priority
      return opps.sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.priority] - order[b.priority];
      });
    }
  });

  if (isLoading || isRefreshing) {
    return <OpportunityLoadingSkeleton />;
  }

  const highPriority = opportunities?.filter(o => o.priority === 'high') || [];
  const mediumPriority = opportunities?.filter(o => o.priority === 'medium') || [];

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{highPriority.length}</div>
                <div className="text-sm text-muted-foreground">High Priority</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{mediumPriority.length}</div>
                <div className="text-sm text-muted-foreground">Medium Priority</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{opportunities?.length || 0}</div>
                <div className="text-sm text-muted-foreground">Total Opportunities</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Who to Meet Next */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Who to Meet Next
          </CardTitle>
          <CardDescription>
            Role-based recommendations based on your current coverage gaps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {opportunities?.slice(0, 5).map((opp) => (
              <div 
                key={opp.id}
                className="flex items-start gap-4 p-4 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all"
              >
                <div className={`p-2 rounded-lg ${
                  opp.priority === 'high' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  {opp.type === 'expansion' ? <ArrowUpRight className="w-4 h-4" /> :
                   opp.type === 'cross-sell' ? <TrendingUp className="w-4 h-4" /> :
                   <Users className="w-4 h-4" />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{opp.title}</h4>
                    <Badge 
                      variant={opp.priority === 'high' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {opp.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{opp.description}</p>
                  
                  {opp.targetRole && (
                    <div className="flex items-center gap-2 text-sm">
                      <Target className="w-3 h-3 text-primary" />
                      <span className="font-medium">{opp.targetRole}</span>
                      <span className="text-muted-foreground">at</span>
                      <Link 
                        to={`/canvas?company=${opp.companyId}`}
                        className="text-primary hover:underline"
                      >
                        {opp.companyName}
                      </Link>
                    </div>
                  )}

                  <div className="mt-3 p-3 rounded-md bg-muted/50 border border-border/50">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium mb-1">Why pursue this</p>
                        <p className="text-sm text-muted-foreground">{opp.rationale}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Link to={`/canvas?company=${opp.companyId}`}>
                  <Button variant="ghost" size="sm">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            ))}

            {(!opportunities || opportunities.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No opportunities identified yet.</p>
                <p className="text-sm mt-1">Add more contacts and notes to enable analysis.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const OpportunityLoadingSkeleton = () => (
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
            <div className="flex items-start gap-3">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-full mb-3" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  </div>
);
