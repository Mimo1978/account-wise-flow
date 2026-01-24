import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DemoCompany {
  id: string;
  name: string;
  industry: string | null;
  size: string | null;
}

export interface DemoContact {
  id: string;
  name: string;
  title: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  company_id: string | null;
}

export function useDemoWorkspace() {
  const { user } = useAuth();
  const [isDemoUser, setIsDemoUser] = useState<boolean | null>(null);
  const [companies, setCompanies] = useState<DemoCompany[]>([]);
  const [contacts, setContacts] = useState<DemoContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // Check if user is in demo mode and get workspace ID
  useEffect(() => {
    const checkDemoStatus = async () => {
      if (!user) {
        setIsDemoUser(false);
        setIsLoading(false);
        return;
      }
      
      try {
        console.log('[useDemoWorkspace] Checking demo status for user:', user.id);
        
        // First check if user is a demo user
        const { data: isDemoData, error: demoError } = await supabase.rpc('is_demo_user', { _user_id: user.id });
        if (demoError) {
          console.error('[useDemoWorkspace] Error checking demo status:', demoError);
          throw demoError;
        }
        
        console.log('[useDemoWorkspace] Is demo user:', isDemoData);
        setIsDemoUser(!!isDemoData);
        
        // Get the workspace ID
        if (isDemoData) {
          const { data: wsId, error: wsError } = await supabase.rpc('get_current_workspace_id', { _user_id: user.id });
          if (wsError) {
            console.error('[useDemoWorkspace] Error getting workspace ID:', wsError);
          } else {
            console.log('[useDemoWorkspace] Workspace ID:', wsId);
            setWorkspaceId(wsId);
          }
        }
      } catch (error) {
        console.error('[useDemoWorkspace] Failed to check demo status:', error);
        setIsDemoUser(false);
      }
    };
    
    checkDemoStatus();
  }, [user]);

  // Ensure demo data is seeded
  const ensureDemoSeeded = useCallback(async () => {
    if (!workspaceId) return;
    
    console.log('[useDemoWorkspace] Ensuring demo data is seeded for workspace:', workspaceId);
    
    try {
      const { data, error } = await supabase.functions.invoke('workspace-management/seed-demo', {
        body: { workspaceId }
      });
      
      if (error) {
        console.error('[useDemoWorkspace] Error seeding demo:', error);
      } else {
        console.log('[useDemoWorkspace] Seed result:', data);
      }
    } catch (error) {
      console.error('[useDemoWorkspace] Failed to seed demo:', error);
    }
  }, [workspaceId]);

  // Load demo data when user is confirmed as demo user
  const loadDemoData = useCallback(async () => {
    if (!user || isDemoUser !== true) return;
    
    console.log('[useDemoWorkspace] Loading demo data...');
    setIsLoading(true);
    
    try {
      // First ensure data is seeded
      await ensureDemoSeeded();
      
      // Load companies
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, name, industry, size')
        .order('name');
      
      if (companiesError) {
        console.error('[useDemoWorkspace] Error loading companies:', companiesError);
        throw companiesError;
      }
      
      console.log('[useDemoWorkspace] Loaded companies:', companiesData?.length);
      setCompanies(companiesData || []);
      
      // Load contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('id, name, title, department, email, phone, company_id')
        .order('name');
      
      if (contactsError) {
        console.error('[useDemoWorkspace] Error loading contacts:', contactsError);
        throw contactsError;
      }
      
      console.log('[useDemoWorkspace] Loaded contacts:', contactsData?.length);
      setContacts(contactsData || []);
      
    } catch (error) {
      console.error('[useDemoWorkspace] Failed to load demo data:', error);
      toast.error('Failed to load demo data');
    } finally {
      setIsLoading(false);
    }
  }, [user, isDemoUser, ensureDemoSeeded]);

  useEffect(() => {
    if (isDemoUser === true && workspaceId) {
      loadDemoData();
    }
  }, [isDemoUser, workspaceId, loadDemoData]);

  // Reset demo data to default state
  const resetDemoData = useCallback(async () => {
    if (!user) return false;
    
    setIsResetting(true);
    try {
      const { data, error } = await supabase.rpc('reset_demo_data', { 
        _user_id: user.id 
      });
      
      if (error) throw error;
      
      toast.success('Demo data reset successfully');
      
      // Reload data after reset
      await loadDemoData();
      
      return true;
    } catch (error) {
      console.error('Failed to reset demo data:', error);
      toast.error('Failed to reset demo data');
      return false;
    } finally {
      setIsResetting(false);
    }
  }, [user, loadDemoData]);

  // Add a new contact
  const addContact = useCallback(async (contact: Omit<DemoContact, 'id'>) => {
    if (!user) return null;
    
    try {
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          name: contact.name,
          title: contact.title,
          department: contact.department,
          email: contact.email,
          phone: contact.phone,
          company_id: contact.company_id,
          owner_id: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setContacts(prev => [...prev, data]);
      toast.success(`Contact "${contact.name}" added`);
      return data;
    } catch (error) {
      console.error('Failed to add contact:', error);
      toast.error('Failed to add contact');
      return null;
    }
  }, [user]);

  // Update a contact
  const updateContact = useCallback(async (id: string, updates: Partial<DemoContact>) => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      setContacts(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
      return data;
    } catch (error) {
      console.error('Failed to update contact:', error);
      toast.error('Failed to update contact');
      return null;
    }
  }, []);

  // Delete a contact
  const deleteContact = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setContacts(prev => prev.filter(c => c.id !== id));
      toast.success('Contact deleted');
      return true;
    } catch (error) {
      console.error('Failed to delete contact:', error);
      toast.error('Failed to delete contact');
      return false;
    }
  }, []);

  // Add a new company
  const addCompany = useCallback(async (company: Omit<DemoCompany, 'id'>) => {
    if (!user) return null;
    
    try {
      const { data, error } = await supabase
        .from('companies')
        .insert({
          name: company.name,
          industry: company.industry,
          size: company.size,
          owner_id: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setCompanies(prev => [...prev, data]);
      toast.success(`Company "${company.name}" added`);
      return data;
    } catch (error) {
      console.error('Failed to add company:', error);
      toast.error('Failed to add company');
      return null;
    }
  }, [user]);

  // Get contacts for a specific company
  const getCompanyContacts = useCallback((companyId: string) => {
    return contacts.filter(c => c.company_id === companyId);
  }, [contacts]);

  return {
    isDemoUser,
    companies,
    contacts,
    isLoading,
    isResetting,
    loadDemoData,
    resetDemoData,
    addContact,
    updateContact,
    deleteContact,
    addCompany,
    getCompanyContacts,
  };
}