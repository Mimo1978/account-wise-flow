import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from './use-permissions';

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AccessRequest {
  id: string;
  entity_type: 'company' | 'contact';
  entity_id: string;
  requested_by: string;
  requested_at: string;
  status: AccessRequestStatus;
  decided_by: string | null;
  decided_at: string | null;
  message: string | null;
  rejection_reason: string | null;
}

interface UseAccessRequestsResult {
  pendingCount: number;
  pendingRequests: AccessRequest[];
  myRequests: AccessRequest[];
  isLoading: boolean;
  createRequest: (entityType: 'company' | 'contact', entityId: string, message?: string) => Promise<boolean>;
  approveRequest: (requestId: string) => Promise<boolean>;
  rejectRequest: (requestId: string, reason?: string) => Promise<boolean>;
  refetch: () => Promise<void>;
  hasRequestedAccess: (entityType: 'company' | 'contact', entityId: string) => boolean;
}

export function useAccessRequests(): UseAccessRequestsResult {
  const { userId } = usePermissions();
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([]);
  const [myRequests, setMyRequests] = useState<AccessRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      // Get pending count for approvers
      const { data: countData } = await supabase.rpc('get_pending_requests_count', {
        _user_id: userId
      });
      setPendingCount(countData || 0);

      // Get pending requests this user can approve
      const { data: pendingData } = await supabase
        .from('access_requests')
        .select('*')
        .eq('status', 'pending')
        .order('requested_at', { ascending: false });
      
      setPendingRequests((pendingData || []) as AccessRequest[]);

      // Get user's own requests
      const { data: myData } = await supabase
        .from('access_requests')
        .select('*')
        .eq('requested_by', userId)
        .order('requested_at', { ascending: false });
      
      setMyRequests((myData || []) as AccessRequest[]);
    } catch (err) {
      console.error('Error fetching access requests:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createRequest = async (
    entityType: 'company' | 'contact',
    entityId: string,
    message?: string
  ): Promise<boolean> => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from('access_requests')
        .insert({
          entity_type: entityType,
          entity_id: entityId,
          requested_by: userId,
          message: message || null
        });

      if (error) throw error;
      await fetchData();
      return true;
    } catch (err) {
      console.error('Error creating access request:', err);
      return false;
    }
  };

  const approveRequest = async (requestId: string): Promise<boolean> => {
    if (!userId) return false;

    try {
      // Get the request first
      const { data: request } = await supabase
        .from('access_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (!request) throw new Error('Request not found');

      // Update request status
      const { error: updateError } = await supabase
        .from('access_requests')
        .update({
          status: 'approved' as AccessRequestStatus,
          decided_by: userId,
          decided_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Add requester to team members table
      if (request.entity_type === 'company') {
        const { error: teamError } = await supabase
          .from('company_team_members')
          .insert({
            company_id: request.entity_id,
            user_id: request.requested_by
          });
        if (teamError && !teamError.message.includes('duplicate')) throw teamError;
      } else if (request.entity_type === 'contact') {
        const { error: teamError } = await supabase
          .from('contact_team_members')
          .insert({
            contact_id: request.entity_id,
            user_id: request.requested_by
          });
        if (teamError && !teamError.message.includes('duplicate')) throw teamError;
      }

      await fetchData();
      return true;
    } catch (err) {
      console.error('Error approving access request:', err);
      return false;
    }
  };

  const rejectRequest = async (requestId: string, reason?: string): Promise<boolean> => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from('access_requests')
        .update({
          status: 'rejected' as AccessRequestStatus,
          decided_by: userId,
          decided_at: new Date().toISOString(),
          rejection_reason: reason || null
        })
        .eq('id', requestId);

      if (error) throw error;
      await fetchData();
      return true;
    } catch (err) {
      console.error('Error rejecting access request:', err);
      return false;
    }
  };

  const hasRequestedAccess = (entityType: 'company' | 'contact', entityId: string): boolean => {
    return myRequests.some(
      r => r.entity_type === entityType && r.entity_id === entityId && r.status === 'pending'
    );
  };

  return {
    pendingCount,
    pendingRequests,
    myRequests,
    isLoading,
    createRequest,
    approveRequest,
    rejectRequest,
    refetch: fetchData,
    hasRequestedAccess
  };
}
