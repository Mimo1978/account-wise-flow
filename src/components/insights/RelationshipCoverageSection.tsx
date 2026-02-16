import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  Building2, 
  AlertCircle, 
  ChevronRight,
  UserCheck,
  UserX,
  Network
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface RelationshipCoverageSectionProps {
  companyId: string | null;
  isRefreshing: boolean;
}

export const RelationshipCoverageSection: React.FC<RelationshipCoverageSectionProps> = ({ 
  companyId,
  isRefreshing 
}) => {
  // Fetch coverage data
  const { data: coverageData, isLoading } = useQuery({
    queryKey: ['relationship-coverage', companyId],
    queryFn: async () => {
      // Get companies with their contacts
      let companiesQuery = supabase
        .from('companies')
        .select(`
          id,
          name,
          industry,
          contacts:contacts(id, name, title, department)
        `);

      if (companyId) {
        companiesQuery = companiesQuery.eq('id', companyId);
      }

      const { data: companies, error } = await companiesQuery;
      if (error) throw error;

      // Calculate coverage metrics for each company
      return companies?.map(company => {
        const contacts = Array.isArray(company.contacts) ? company.contacts : [];
        const departments = [...new Set(contacts.map((c: any) => c.department).filter(Boolean))];
        const seniorTitles = ['CEO', 'CFO', 'CTO', 'COO', 'VP', 'Director', 'Head', 'President', 'Chief'];
        const seniorContacts = contacts.filter((c: any) => 
          seniorTitles.some(title => c.title?.toLowerCase().includes(title.toLowerCase()))
        );
        
        // Mock org chart coverage percentage (would be calculated from actual org data)
        const coveragePercent = Math.min(100, Math.round((contacts.length / 10) * 100));
        
        return {
          id: company.id,
          name: company.name,
          industry: company.industry,
          totalContacts: contacts.length,
          seniorContacts: seniorContacts.length,
          departments: departments.length,
          coveragePercent,
          singleThreaded: seniorContacts.length <= 1,
          missingSenior: seniorContacts.length === 0
        };
      }) || [];
    }
  });

  if (isLoading || isRefreshing) {
    return <CoverageLoadingSkeleton />;
  }

  // Calculate aggregate stats
  const avgCoverage = coverageData?.length 
    ? Math.round(coverageData.reduce((sum, c) => sum + c.coveragePercent, 0) / coverageData.length)
    : 0;
  
  const singleThreadedAccounts = coverageData?.filter(c => c.singleThreaded).length || 0;
  const missingSeniorAccounts = coverageData?.filter(c => c.missingSenior).length || 0;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Org Coverage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold">{avgCoverage}%</span>
              <span className="text-sm text-muted-foreground mb-1">mapped</span>
            </div>
            <Progress value={avgCoverage} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className={singleThreadedAccounts > 0 ? 'border-amber-200 bg-amber-50/30' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              Single-Threaded Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold">{singleThreadedAccounts}</span>
              <span className="text-sm text-muted-foreground mb-1">accounts</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Only one senior contact — high dependency risk
            </p>
          </CardContent>
        </Card>

        <Card className={missingSeniorAccounts > 0 ? 'border-red-200 bg-red-50/30' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserX className="w-4 h-4 text-red-500" />
              Missing Senior Stakeholders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold">{missingSeniorAccounts}</span>
              <span className="text-sm text-muted-foreground mb-1">accounts</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              No executive-level contacts mapped
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Account-by-Account Coverage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account Coverage Breakdown</CardTitle>
          <CardDescription>
            Visual summary of relationship penetration across your portfolio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {coverageData?.map((account) => (
              <div 
                key={account.id} 
                className="flex items-center gap-4 p-4 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium truncate">{account.name}</h4>
                    {account.singleThreaded && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs">
                        Single-threaded
                      </Badge>
                    )}
                    {account.missingSenior && (
                      <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50 text-xs">
                        No exec access
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {account.totalContacts} contacts
                    </span>
                    <span className="flex items-center gap-1">
                      <UserCheck className="w-3 h-3" />
                      {account.seniorContacts} senior
                    </span>
                    <span className="flex items-center gap-1">
                      <Network className="w-3 h-3" />
                      {account.departments} depts
                    </span>
                  </div>
                </div>
                
                <div className="w-32">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Coverage</span>
                    <span className="font-medium">{account.coveragePercent}%</span>
                  </div>
                  <Progress value={account.coveragePercent} className="h-2" />
                </div>

                <Link to={`/canvas?company=${account.id}`}>
                  <Button variant="ghost" size="sm">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            ))}

            {(!coverageData || coverageData.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No accounts to analyze yet.</p>
                <Link to="/companies">
                  <Button variant="link" className="mt-2">Add your first company</Button>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const CoverageLoadingSkeleton = () => (
  <div className="space-y-6">
    <div className="grid md:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-2 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </CardHeader>
      <CardContent>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4 mb-2">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-5 w-40 mb-2" />
              <Skeleton className="h-4 w-60" />
            </div>
            <Skeleton className="w-32 h-8" />
          </div>
        ))}
      </CardContent>
    </Card>
  </div>
);
