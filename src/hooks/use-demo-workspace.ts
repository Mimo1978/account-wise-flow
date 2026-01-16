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

  // Check if user is in demo mode
  useEffect(() => {
    const checkDemoStatus = async () => {
      if (!user) {
        setIsDemoUser(false);
        setIsLoading(false);
        return;
      }
      
      try {
        const { data, error } = await supabase.rpc('is_demo_user', { _user_id: user.id });
        if (error) throw error;
        setIsDemoUser(!!data);
      } catch (error) {
        console.error('Failed to check demo status:', error);
        setIsDemoUser(false);
      }
    };
    
    checkDemoStatus();
  }, [user]);

  // Load demo data when user is confirmed as demo user
  const loadDemoData = useCallback(async () => {
    if (!user || isDemoUser !== true) return;
    
    setIsLoading(true);
    try {
      // Load companies
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, name, industry, size')
        .order('name');
      
      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);
      
      // Load contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('id, name, title, department, email, phone, company_id')
        .order('name');
      
      if (contactsError) throw contactsError;
      setContacts(contactsData || []);
      
    } catch (error) {
      console.error('Failed to load demo data:', error);
      toast.error('Failed to load demo data');
    } finally {
      setIsLoading(false);
    }
  }, [user, isDemoUser]);

  useEffect(() => {
    if (isDemoUser === true) {
      loadDemoData();
    }
  }, [isDemoUser, loadDemoData]);

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