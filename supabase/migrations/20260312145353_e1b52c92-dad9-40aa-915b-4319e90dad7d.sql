
-- Add soft-delete columns to tables that don't have them yet
ALTER TABLE public.crm_projects ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.crm_projects ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;
ALTER TABLE public.crm_projects ADD COLUMN IF NOT EXISTS deletion_reason text DEFAULT NULL;
ALTER TABLE public.crm_projects ADD COLUMN IF NOT EXISTS deletion_scheduled_purge_at timestamptz DEFAULT NULL;

ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS deletion_reason text DEFAULT NULL;
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS deletion_scheduled_purge_at timestamptz DEFAULT NULL;

ALTER TABLE public.crm_invoices ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.crm_invoices ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;
ALTER TABLE public.crm_invoices ADD COLUMN IF NOT EXISTS deletion_reason text DEFAULT NULL;
ALTER TABLE public.crm_invoices ADD COLUMN IF NOT EXISTS deletion_scheduled_purge_at timestamptz DEFAULT NULL;

ALTER TABLE public.crm_documents ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.crm_documents ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;
ALTER TABLE public.crm_documents ADD COLUMN IF NOT EXISTS deletion_reason text DEFAULT NULL;
ALTER TABLE public.crm_documents ADD COLUMN IF NOT EXISTS deletion_scheduled_purge_at timestamptz DEFAULT NULL;

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS deletion_reason text DEFAULT NULL;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS deletion_scheduled_purge_at timestamptz DEFAULT NULL;

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS deletion_reason text DEFAULT NULL;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS deletion_scheduled_purge_at timestamptz DEFAULT NULL;

-- Add deleted_by/reason/purge columns to tables that already have deleted_at
ALTER TABLE public.crm_companies ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;
ALTER TABLE public.crm_companies ADD COLUMN IF NOT EXISTS deletion_reason text DEFAULT NULL;
ALTER TABLE public.crm_companies ADD COLUMN IF NOT EXISTS deletion_scheduled_purge_at timestamptz DEFAULT NULL;

ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS deletion_reason text DEFAULT NULL;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS deletion_scheduled_purge_at timestamptz DEFAULT NULL;

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS deletion_reason text DEFAULT NULL;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS deletion_scheduled_purge_at timestamptz DEFAULT NULL;

-- Create deletion_requests table
CREATE TABLE IF NOT EXISTS public.deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  record_type text NOT NULL,
  record_id uuid NOT NULL,
  record_name text NOT NULL,
  requested_by uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid DEFAULT NULL,
  reviewed_at timestamptz DEFAULT NULL,
  review_notes text DEFAULT NULL,
  scheduled_purge_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read deletion requests in workspace"
  ON public.deletion_requests FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert deletion requests"
  ON public.deletion_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Admin/manager can update deletion requests"
  ON public.deletion_requests FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  );

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text DEFAULT NULL,
  link text DEFAULT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);
