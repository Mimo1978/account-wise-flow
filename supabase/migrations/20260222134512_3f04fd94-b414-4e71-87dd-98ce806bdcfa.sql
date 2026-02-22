
-- 1. Add soft delete column to contacts
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- 2. Create index for efficient filtering of active contacts
CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at ON public.contacts (deleted_at) WHERE deleted_at IS NULL;

-- 3. Create data_change_requests table for governance
CREATE TABLE public.data_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL CHECK (request_type IN ('merge', 'retire', 'delete')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'applied')),
  requested_by uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid,
  decided_at timestamptz,
  applied_at timestamptz,
  canonical_contact_id uuid REFERENCES public.contacts(id),
  duplicate_contact_ids uuid[] NOT NULL DEFAULT '{}',
  company_id uuid REFERENCES public.companies(id),
  workspace_id uuid NOT NULL REFERENCES public.teams(id),
  reason text,
  rejection_reason text,
  merge_data jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE public.data_change_requests ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for data_change_requests
-- Anyone authenticated can view requests in their workspace
CREATE POLICY "Users can view workspace change requests"
ON public.data_change_requests
FOR SELECT
TO authenticated
USING (
  public.check_demo_isolation(workspace_id, auth.uid())
  AND (
    workspace_id = public.get_user_team_id(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- Any authenticated user can create a request in their workspace
CREATE POLICY "Users can create change requests"
ON public.data_change_requests
FOR INSERT
TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND public.can_insert_with_team(auth.uid(), workspace_id)
);

-- Only admin/manager can update (approve/reject/apply)
CREATE POLICY "Admin and manager can update change requests"
ON public.data_change_requests
FOR UPDATE
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  AND public.check_demo_isolation(workspace_id, auth.uid())
  AND (
    workspace_id = public.get_user_team_id(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- 6. Trigger for updated_at
CREATE TRIGGER update_data_change_requests_updated_at
BEFORE UPDATE ON public.data_change_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
