import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Account, Contact } from "@/lib/types";
import { mockAccount, mockAccounts } from "@/lib/mock-data";

interface UseCompanyCanvasOptions {
  fallbackToMock?: boolean;
}

interface UseCompanyCanvasReturn {
  account: Account | null;
  accounts: Account[];
  isLoading: boolean;
  error: Error | null;
  setAccount: (account: Account) => void;
  switchCompany: (newAccount: Account) => void;
  isUsingMockData: boolean;
}

/**
 * Hook for loading company data on the Canvas page
 * Supports both URL-based company loading and workspace-based loading
 */
export function useCompanyCanvas(options: UseCompanyCanvasOptions = {}): UseCompanyCanvasReturn {
  const { fallbackToMock = true } = options;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentWorkspace, isInDemoWorkspace } = useWorkspace();
  
  const companyId = searchParams.get("company");
  const companyIds = searchParams.get("companies");
  
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isUsingMockData, setIsUsingMockData] = useState(false);

  // Fetch single company by ID
  const { data: companyData, isLoading: companyLoading, error: companyError } = useQuery({
    queryKey: ['canvas-company', companyId, currentWorkspace?.id],
    queryFn: async () => {
      if (!companyId || !currentWorkspace?.id) return null;
      
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();
      
      if (error) {
        console.error('Error fetching company for canvas:', error);
        return null;
      }
      
      // Fetch contacts for this company
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', companyId);
      
      if (contactsError) {
        console.error('Error fetching contacts:', contactsError);
      }
      
      // Transform to Account format
      const account: Account = {
        id: data.id,
        name: data.name,
        industry: data.industry || 'Other',
        size: data.size || 'Unknown',
        ceoContactId: data.ceo_contact_id || null,
        contacts: (contacts || []).map((c: any): Contact => ({
          id: c.id,
          name: c.name,
          title: c.title || '',
          department: c.department || '',
          seniority: 'mid',
          email: c.email || '',
          phone: c.phone || '',
          status: 'new',
          engagementScore: 50,
          managerId: c.manager_id || null,
        })),
        lastUpdated: data.updated_at,
        engagementScore: 50,
      };
      
      return account;
    },
    enabled: !!companyId && !!currentWorkspace?.id,
  });

  // Fetch all workspace companies for switching
  const { data: workspaceCompanies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['canvas-companies', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('team_id', currentWorkspace.id)
        .order('name');
      
      if (error) {
        console.error('Error fetching companies:', error);
        return [];
      }
      
      return (data || []).map((company: any): Account => ({
        id: company.id,
        name: company.name,
        industry: company.industry || 'Other',
        size: company.size || 'Unknown',
        contacts: [],
        lastUpdated: company.updated_at,
        engagementScore: 50,
      }));
    },
    enabled: !!currentWorkspace?.id,
  });

  // Handle setting the account when data loads
  useEffect(() => {
    if (companyData) {
      setSelectedAccount(companyData);
      setIsUsingMockData(false);
    } else if (!companyId && fallbackToMock && isInDemoWorkspace) {
      // Only use mock data in demo workspace when no company is specified
      setSelectedAccount(mockAccount);
      setIsUsingMockData(true);
    } else if (!companyId && workspaceCompanies.length > 0 && !companyLoading) {
      // Default to first company in workspace if no specific company requested
      // Navigate to that company's canvas
      navigate(`/canvas?company=${workspaceCompanies[0].id}`, { replace: true });
    }
  }, [companyData, companyId, fallbackToMock, isInDemoWorkspace, workspaceCompanies, companyLoading, navigate]);

  const switchCompany = (newAccount: Account) => {
    navigate(`/canvas?company=${newAccount.id}`);
    setSelectedAccount(newAccount);
  };

  // Combine real companies with mock for demo
  const allAccounts = isUsingMockData 
    ? mockAccounts 
    : workspaceCompanies;

  return {
    account: selectedAccount,
    accounts: allAccounts,
    isLoading: companyLoading || companiesLoading,
    error: companyError as Error | null,
    setAccount: setSelectedAccount,
    switchCompany,
    isUsingMockData,
  };
}
