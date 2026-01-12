-- Create access request status enum
CREATE TYPE public.access_request_status AS ENUM ('pending', 'approved', 'rejected');

-- Create access_requests table
CREATE TABLE public.access_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('company', 'contact')),
  entity_id UUID NOT NULL,
  requested_by UUID NOT NULL,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status access_request_status NOT NULL DEFAULT 'pending',
  decided_by UUID,
  decided_at TIMESTAMP WITH TIME ZONE,
  message TEXT,
  rejection_reason TEXT
);

-- Enable RLS
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own requests
CREATE POLICY "Users can view their own requests"
ON public.access_requests
FOR SELECT
USING (auth.uid() = requested_by);

-- Policy: Approvers can view pending requests for entities they can approve
-- Approvers: Admin (all), Owner of entity, Team members with edit rights, Manager for same team
CREATE OR REPLACE FUNCTION public.can_approve_request(_user_id UUID, _entity_type TEXT, _entity_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_role app_role;
  _user_team_id UUID;
  _entity_owner_id UUID;
  _entity_team_id UUID;
BEGIN
  _user_role := public.get_user_role(_user_id);
  
  -- Admin can approve any request
  IF _user_role = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  _user_team_id := public.get_user_team_id(_user_id);
  
  -- Get entity owner and team
  IF _entity_type = 'company' THEN
    SELECT owner_id, team_id INTO _entity_owner_id, _entity_team_id 
    FROM public.companies WHERE id = _entity_id;
    
    -- Owner can approve
    IF _entity_owner_id = _user_id THEN
      RETURN TRUE;
    END IF;
    
    -- Team member with edit rights can approve
    IF EXISTS (
      SELECT 1 FROM public.company_team_members 
      WHERE company_id = _entity_id AND user_id = _user_id
    ) AND public.can_edit_company(_user_id, _entity_id) THEN
      RETURN TRUE;
    END IF;
    
  ELSIF _entity_type = 'contact' THEN
    SELECT owner_id, team_id INTO _entity_owner_id, _entity_team_id 
    FROM public.contacts WHERE id = _entity_id;
    
    -- Owner can approve
    IF _entity_owner_id = _user_id THEN
      RETURN TRUE;
    END IF;
    
    -- Team member with edit rights can approve
    IF EXISTS (
      SELECT 1 FROM public.contact_team_members 
      WHERE contact_id = _entity_id AND user_id = _user_id
    ) AND public.can_edit_contact(_user_id, _entity_id) THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  -- Manager can approve for their team
  IF _user_role = 'manager' AND (_entity_team_id IS NULL OR _entity_team_id = _user_team_id) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Policy: Approvers can view requests they can approve
CREATE POLICY "Approvers can view requests"
ON public.access_requests
FOR SELECT
USING (can_approve_request(auth.uid(), entity_type, entity_id));

-- Policy: Authenticated users can insert their own requests
CREATE POLICY "Users can create their own requests"
ON public.access_requests
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND requested_by = auth.uid()
  AND status = 'pending'
);

-- Policy: Approvers can update requests (approve/reject)
CREATE POLICY "Approvers can update requests"
ON public.access_requests
FOR UPDATE
USING (can_approve_request(auth.uid(), entity_type, entity_id));

-- Policy: Only admins can delete requests
CREATE POLICY "Admins can delete requests"
ON public.access_requests
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Function to count pending requests for current user (as approver)
CREATE OR REPLACE FUNCTION public.get_pending_requests_count(_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count INTEGER;
BEGIN
  SELECT COUNT(*) INTO _count
  FROM public.access_requests ar
  WHERE ar.status = 'pending'
    AND can_approve_request(_user_id, ar.entity_type, ar.entity_id);
  RETURN COALESCE(_count, 0);
END;
$$;

-- Add audit triggers for access_requests
CREATE TRIGGER audit_access_requests_insert
AFTER INSERT ON public.access_requests
FOR EACH ROW
EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_access_requests_update
AFTER UPDATE ON public.access_requests
FOR EACH ROW
EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_access_requests_delete
AFTER DELETE ON public.access_requests
FOR EACH ROW
EXECUTE FUNCTION public.audit_trigger_func();