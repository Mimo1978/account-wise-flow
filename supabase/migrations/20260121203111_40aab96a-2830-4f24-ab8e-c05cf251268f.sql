-- =============================================================
-- DEMO DATA STRATEGY - Complete Implementation
-- Modes: public_demo (no login), demo (authenticated sandbox), production
-- =============================================================

-- 1. Add workspace_mode enum if not exists
DO $$ BEGIN
  CREATE TYPE public.workspace_mode AS ENUM ('public_demo', 'demo', 'production');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Add workspace_mode column to teams if not exists
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS workspace_mode public.workspace_mode NOT NULL DEFAULT 'production';

-- 3. Update existing teams based on is_demo flag
UPDATE public.teams SET workspace_mode = 'demo' WHERE is_demo = true AND workspace_mode = 'production';

-- 4. Create the public demo workspace first (before seeding)
INSERT INTO public.teams (id, name, type, is_demo, workspace_mode, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Public Demo Workspace',
  'demo',
  true,
  'public_demo',
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  name = 'Public Demo Workspace',
  workspace_mode = 'public_demo',
  is_demo = true;

-- 5. Seed Demo Data Function - creates consistent demo data
-- Note: We disable the audit trigger during seeding to avoid FK issues
CREATE OR REPLACE FUNCTION public.seed_demo_workspace(workspace_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  company1_id uuid;
  company2_id uuid;
  company3_id uuid;
BEGIN
  -- Verify workspace exists
  IF NOT EXISTS (SELECT 1 FROM public.teams WHERE id = workspace_uuid) THEN
    RAISE EXCEPTION 'Workspace % does not exist', workspace_uuid;
  END IF;

  -- Delete existing demo data for this workspace
  DELETE FROM public.notes WHERE team_id = workspace_uuid;
  DELETE FROM public.contacts WHERE team_id = workspace_uuid;
  DELETE FROM public.companies WHERE team_id = workspace_uuid;

  -- Create demo companies (these will bypass audit trigger since we use SECURITY DEFINER)
  INSERT INTO public.companies (id, name, industry, size, team_id, created_at, updated_at)
  VALUES (
    gen_random_uuid(), 'Acme Corporation', 'Enterprise Software', '5000+ employees', workspace_uuid, now(), now()
  ) RETURNING id INTO company1_id;

  INSERT INTO public.companies (id, name, industry, size, team_id, created_at, updated_at)
  VALUES (
    gen_random_uuid(), 'TechForward Inc', 'Software', '500-1000 employees', workspace_uuid, now(), now()
  ) RETURNING id INTO company2_id;

  INSERT INTO public.companies (id, name, industry, size, team_id, created_at, updated_at)
  VALUES (
    gen_random_uuid(), 'Global Dynamics', 'Consulting', '10000+ employees', workspace_uuid, now(), now()
  ) RETURNING id INTO company3_id;

  -- Seed contacts for Acme Corporation (~50 contacts)
  INSERT INTO public.contacts (name, title, department, email, phone, company_id, team_id, created_at, updated_at) VALUES
  ('Robert Morrison', 'CEO', 'Executive', 'robert.morrison@acmecorp.com', '+1 (555) 100-0001', company1_id, workspace_uuid, now(), now()),
  ('Jennifer Liu', 'CFO', 'Executive', 'jennifer.liu@acmecorp.com', '+1 (555) 100-0002', company1_id, workspace_uuid, now(), now()),
  ('Marcus Thompson', 'COO', 'Executive', 'marcus.thompson@acmecorp.com', '+1 (555) 100-0003', company1_id, workspace_uuid, now(), now()),
  ('Sarah Chen', 'CTO', 'Executive', 'sarah.chen@acmecorp.com', '+1 (555) 100-0004', company1_id, workspace_uuid, now(), now()),
  ('David Rodriguez', 'CMO', 'Executive', 'david.rodriguez@acmecorp.com', '+1 (555) 100-0005', company1_id, workspace_uuid, now(), now()),
  ('Rachel Kim', 'Head of Engineering', 'Technology', 'rachel.kim@acmecorp.com', '+1 (555) 200-0001', company1_id, workspace_uuid, now(), now()),
  ('James Wilson', 'Engineering Manager', 'Technology', 'james.wilson@acmecorp.com', '+1 (555) 200-0002', company1_id, workspace_uuid, now(), now()),
  ('Emily Foster', 'Senior Developer', 'Technology', 'emily.foster@acmecorp.com', '+1 (555) 200-0003', company1_id, workspace_uuid, now(), now()),
  ('Daniel Park', 'Developer', 'Technology', 'daniel.park@acmecorp.com', '+1 (555) 200-0004', company1_id, workspace_uuid, now(), now()),
  ('Sophia Martinez', 'Junior Developer', 'Technology', 'sophia.martinez@acmecorp.com', '+1 (555) 200-0005', company1_id, workspace_uuid, now(), now()),
  ('Michael Roberts', 'QA Lead', 'Technology', 'michael.roberts@acmecorp.com', '+1 (555) 200-0006', company1_id, workspace_uuid, now(), now()),
  ('Amanda Lee', 'QA Engineer', 'Technology', 'amanda.lee@acmecorp.com', '+1 (555) 200-0007', company1_id, workspace_uuid, now(), now()),
  ('Kevin Zhang', 'DevOps Engineer', 'Technology', 'kevin.zhang@acmecorp.com', '+1 (555) 200-0008', company1_id, workspace_uuid, now(), now()),
  ('Lisa Anderson', 'Solutions Architect', 'Technology', 'lisa.anderson@acmecorp.com', '+1 (555) 200-0009', company1_id, workspace_uuid, now(), now()),
  ('Christopher Brown', 'IT Support Manager', 'Technology', 'christopher.brown@acmecorp.com', '+1 (555) 200-0010', company1_id, workspace_uuid, now(), now()),
  ('Nicole Taylor', 'IT Support Analyst', 'Technology', 'nicole.taylor@acmecorp.com', '+1 (555) 200-0011', company1_id, workspace_uuid, now(), now()),
  ('Brian Hughes', 'Security Engineer', 'Technology', 'brian.hughes@acmecorp.com', '+1 (555) 200-0012', company1_id, workspace_uuid, now(), now()),
  ('Jessica White', 'Data Engineer', 'Technology', 'jessica.white@acmecorp.com', '+1 (555) 200-0013', company1_id, workspace_uuid, now(), now()),
  ('Ryan Cooper', 'Frontend Developer', 'Technology', 'ryan.cooper@acmecorp.com', '+1 (555) 200-0014', company1_id, workspace_uuid, now(), now()),
  ('Ashley Garcia', 'Backend Developer', 'Technology', 'ashley.garcia@acmecorp.com', '+1 (555) 200-0015', company1_id, workspace_uuid, now(), now()),
  ('Thomas Wright', 'Finance Director', 'Finance', 'thomas.wright@acmecorp.com', '+1 (555) 300-0001', company1_id, workspace_uuid, now(), now()),
  ('Patricia Green', 'Senior Accountant', 'Finance', 'patricia.green@acmecorp.com', '+1 (555) 300-0002', company1_id, workspace_uuid, now(), now()),
  ('Brian Mitchell', 'AP/AR Manager', 'Finance', 'brian.mitchell@acmecorp.com', '+1 (555) 300-0003', company1_id, workspace_uuid, now(), now()),
  ('Laura Stevens', 'Financial Analyst', 'Finance', 'laura.stevens@acmecorp.com', '+1 (555) 300-0004', company1_id, workspace_uuid, now(), now()),
  ('Mark Davis', 'Controller', 'Finance', 'mark.davis@acmecorp.com', '+1 (555) 300-0005', company1_id, workspace_uuid, now(), now()),
  ('Rebecca Johnson', 'Procurement Director', 'Procurement', 'rebecca.johnson@acmecorp.com', '+1 (555) 400-0001', company1_id, workspace_uuid, now(), now()),
  ('Steven Davis', 'Procurement Specialist', 'Procurement', 'steven.davis@acmecorp.com', '+1 (555) 400-0002', company1_id, workspace_uuid, now(), now()),
  ('Nancy Wilson', 'Vendor Manager', 'Procurement', 'nancy.wilson@acmecorp.com', '+1 (555) 400-0003', company1_id, workspace_uuid, now(), now()),
  ('Angela White', 'Head of Risk', 'Risk & Compliance', 'angela.white@acmecorp.com', '+1 (555) 500-0001', company1_id, workspace_uuid, now(), now()),
  ('Gregory Harris', 'Risk Manager', 'Risk & Compliance', 'gregory.harris@acmecorp.com', '+1 (555) 500-0002', company1_id, workspace_uuid, now(), now()),
  ('Michelle Clark', 'Compliance Analyst', 'Risk & Compliance', 'michelle.clark@acmecorp.com', '+1 (555) 500-0003', company1_id, workspace_uuid, now(), now()),
  ('Jonathan Lewis', 'Ops Manager', 'Operations', 'jonathan.lewis@acmecorp.com', '+1 (555) 600-0001', company1_id, workspace_uuid, now(), now()),
  ('Samantha Hill', 'Ops Analyst', 'Operations', 'samantha.hill@acmecorp.com', '+1 (555) 600-0002', company1_id, workspace_uuid, now(), now()),
  ('Andrew Scott', 'Ops Coordinator', 'Operations', 'andrew.scott@acmecorp.com', '+1 (555) 600-0003', company1_id, workspace_uuid, now(), now()),
  ('Catherine Adams', 'VP Sales', 'Sales', 'catherine.adams@acmecorp.com', '+1 (555) 700-0001', company1_id, workspace_uuid, now(), now()),
  ('Peter Hall', 'Sales Director', 'Sales', 'peter.hall@acmecorp.com', '+1 (555) 700-0002', company1_id, workspace_uuid, now(), now()),
  ('Diane Baker', 'Account Executive', 'Sales', 'diane.baker@acmecorp.com', '+1 (555) 700-0003', company1_id, workspace_uuid, now(), now()),
  ('Edward Nelson', 'Account Executive', 'Sales', 'edward.nelson@acmecorp.com', '+1 (555) 700-0004', company1_id, workspace_uuid, now(), now()),
  ('Sandra Moore', 'SDR Manager', 'Sales', 'sandra.moore@acmecorp.com', '+1 (555) 700-0005', company1_id, workspace_uuid, now(), now()),
  ('Christine Young', 'Marketing Director', 'Marketing', 'christine.young@acmecorp.com', '+1 (555) 800-0001', company1_id, workspace_uuid, now(), now()),
  ('George King', 'Content Manager', 'Marketing', 'george.king@acmecorp.com', '+1 (555) 800-0002', company1_id, workspace_uuid, now(), now()),
  ('Heather Scott', 'Digital Marketing Specialist', 'Marketing', 'heather.scott@acmecorp.com', '+1 (555) 800-0003', company1_id, workspace_uuid, now(), now()),
  ('William Allen', 'HR Director', 'Human Resources', 'william.allen@acmecorp.com', '+1 (555) 900-0001', company1_id, workspace_uuid, now(), now()),
  ('Kimberly Wright', 'HR Manager', 'Human Resources', 'kimberly.wright@acmecorp.com', '+1 (555) 900-0002', company1_id, workspace_uuid, now(), now()),
  ('Timothy Campbell', 'Recruiter', 'Human Resources', 'timothy.campbell@acmecorp.com', '+1 (555) 900-0003', company1_id, workspace_uuid, now(), now()),
  ('Barbara Morgan', 'General Counsel', 'Legal', 'barbara.morgan@acmecorp.com', '+1 (555) 950-0001', company1_id, workspace_uuid, now(), now()),
  ('Jason Phillips', 'Legal Counsel', 'Legal', 'jason.phillips@acmecorp.com', '+1 (555) 950-0002', company1_id, workspace_uuid, now(), now()),
  ('Victoria Evans', 'Paralegal', 'Legal', 'victoria.evans@acmecorp.com', '+1 (555) 950-0003', company1_id, workspace_uuid, now(), now());

  -- Seed contacts for TechForward Inc
  INSERT INTO public.contacts (name, title, department, email, phone, company_id, team_id, created_at, updated_at) VALUES
  ('Michael Chang', 'CEO', 'Executive', 'michael.chang@techforward.com', '+1 (555) 111-0001', company2_id, workspace_uuid, now(), now()),
  ('Laura Bennett', 'CTO', 'Executive', 'laura.bennett@techforward.com', '+1 (555) 111-0002', company2_id, workspace_uuid, now(), now()),
  ('David Kim', 'VP Engineering', 'Technology', 'david.kim@techforward.com', '+1 (555) 111-0003', company2_id, workspace_uuid, now(), now()),
  ('Emily Ross', 'Product Manager', 'Product', 'emily.ross@techforward.com', '+1 (555) 111-0004', company2_id, workspace_uuid, now(), now()),
  ('Nathan Brooks', 'Head of Sales', 'Sales', 'nathan.brooks@techforward.com', '+1 (555) 111-0005', company2_id, workspace_uuid, now(), now()),
  ('Olivia Turner', 'CFO', 'Executive', 'olivia.turner@techforward.com', '+1 (555) 111-0006', company2_id, workspace_uuid, now(), now()),
  ('Lucas Wright', 'Senior Developer', 'Technology', 'lucas.wright@techforward.com', '+1 (555) 111-0007', company2_id, workspace_uuid, now(), now()),
  ('Mia Johnson', 'UX Designer', 'Product', 'mia.johnson@techforward.com', '+1 (555) 111-0008', company2_id, workspace_uuid, now(), now()),
  ('Ethan Williams', 'DevOps Lead', 'Technology', 'ethan.williams@techforward.com', '+1 (555) 111-0009', company2_id, workspace_uuid, now(), now()),
  ('Ava Brown', 'Marketing Director', 'Marketing', 'ava.brown@techforward.com', '+1 (555) 111-0010', company2_id, workspace_uuid, now(), now()),
  ('Noah Davis', 'Data Scientist', 'Technology', 'noah.davis@techforward.com', '+1 (555) 111-0011', company2_id, workspace_uuid, now(), now()),
  ('Isabella Garcia', 'Account Executive', 'Sales', 'isabella.garcia@techforward.com', '+1 (555) 111-0012', company2_id, workspace_uuid, now(), now()),
  ('Mason Martinez', 'Backend Engineer', 'Technology', 'mason.martinez@techforward.com', '+1 (555) 111-0013', company2_id, workspace_uuid, now(), now()),
  ('Sophia Anderson', 'HR Manager', 'Human Resources', 'sophia.anderson@techforward.com', '+1 (555) 111-0014', company2_id, workspace_uuid, now(), now()),
  ('Jacob Thomas', 'Frontend Developer', 'Technology', 'jacob.thomas@techforward.com', '+1 (555) 111-0015', company2_id, workspace_uuid, now(), now()),
  ('Charlotte Jackson', 'Customer Success', 'Sales', 'charlotte.jackson@techforward.com', '+1 (555) 111-0016', company2_id, workspace_uuid, now(), now()),
  ('Alexander White', 'QA Engineer', 'Technology', 'alexander.white@techforward.com', '+1 (555) 111-0017', company2_id, workspace_uuid, now(), now()),
  ('Amelia Harris', 'Product Designer', 'Product', 'amelia.harris@techforward.com', '+1 (555) 111-0018', company2_id, workspace_uuid, now(), now()),
  ('Benjamin Clark', 'SRE', 'Technology', 'benjamin.clark@techforward.com', '+1 (555) 111-0019', company2_id, workspace_uuid, now(), now()),
  ('Harper Lewis', 'Content Strategist', 'Marketing', 'harper.lewis@techforward.com', '+1 (555) 111-0020', company2_id, workspace_uuid, now(), now());

  -- Seed contacts for Global Dynamics
  INSERT INTO public.contacts (name, title, department, email, phone, company_id, team_id, created_at, updated_at) VALUES
  ('Patricia Hayes', 'CEO', 'Executive', 'patricia.hayes@globaldynamics.com', '+1 (555) 222-0001', company3_id, workspace_uuid, now(), now()),
  ('Richard Torres', 'CFO', 'Executive', 'richard.torres@globaldynamics.com', '+1 (555) 222-0002', company3_id, workspace_uuid, now(), now()),
  ('Amanda Foster', 'CTO', 'Executive', 'amanda.foster@globaldynamics.com', '+1 (555) 222-0003', company3_id, workspace_uuid, now(), now()),
  ('James Cooper', 'Procurement Director', 'Procurement', 'james.cooper@globaldynamics.com', '+1 (555) 222-0004', company3_id, workspace_uuid, now(), now()),
  ('Michelle Wang', 'Senior Consultant', 'Consulting', 'michelle.wang@globaldynamics.com', '+1 (555) 222-0005', company3_id, workspace_uuid, now(), now()),
  ('Robert Black', 'Managing Partner', 'Executive', 'robert.black@globaldynamics.com', '+1 (555) 222-0006', company3_id, workspace_uuid, now(), now()),
  ('Jennifer Mills', 'Partner', 'Consulting', 'jennifer.mills@globaldynamics.com', '+1 (555) 222-0007', company3_id, workspace_uuid, now(), now()),
  ('Thomas Reed', 'IT Director', 'Technology', 'thomas.reed@globaldynamics.com', '+1 (555) 222-0008', company3_id, workspace_uuid, now(), now()),
  ('Susan Clark', 'Finance Manager', 'Finance', 'susan.clark@globaldynamics.com', '+1 (555) 222-0009', company3_id, workspace_uuid, now(), now()),
  ('Daniel Green', 'Senior Consultant', 'Consulting', 'daniel.green@globaldynamics.com', '+1 (555) 222-0010', company3_id, workspace_uuid, now(), now()),
  ('Elizabeth Brown', 'Principal', 'Consulting', 'elizabeth.brown@globaldynamics.com', '+1 (555) 222-0011', company3_id, workspace_uuid, now(), now()),
  ('Matthew Wilson', 'Associate', 'Consulting', 'matthew.wilson@globaldynamics.com', '+1 (555) 222-0012', company3_id, workspace_uuid, now(), now()),
  ('Sarah Jones', 'Associate', 'Consulting', 'sarah.jones@globaldynamics.com', '+1 (555) 222-0013', company3_id, workspace_uuid, now(), now()),
  ('Christopher Lee', 'Analyst', 'Consulting', 'christopher.lee@globaldynamics.com', '+1 (555) 222-0014', company3_id, workspace_uuid, now(), now()),
  ('Lauren Miller', 'Analyst', 'Consulting', 'lauren.miller@globaldynamics.com', '+1 (555) 222-0015', company3_id, workspace_uuid, now(), now()),
  ('Andrew Taylor', 'HR Director', 'Human Resources', 'andrew.taylor@globaldynamics.com', '+1 (555) 222-0016', company3_id, workspace_uuid, now(), now()),
  ('Rachel Moore', 'Talent Acquisition', 'Human Resources', 'rachel.moore@globaldynamics.com', '+1 (555) 222-0017', company3_id, workspace_uuid, now(), now()),
  ('Jonathan White', 'General Counsel', 'Legal', 'jonathan.white@globaldynamics.com', '+1 (555) 222-0018', company3_id, workspace_uuid, now(), now()),
  ('Michelle Davis', 'Legal Counsel', 'Legal', 'michelle.davis@globaldynamics.com', '+1 (555) 222-0019', company3_id, workspace_uuid, now(), now()),
  ('Kevin Thompson', 'VP Operations', 'Operations', 'kevin.thompson@globaldynamics.com', '+1 (555) 222-0020', company3_id, workspace_uuid, now(), now()),
  ('Amanda Roberts', 'Ops Manager', 'Operations', 'amanda.roberts@globaldynamics.com', '+1 (555) 222-0021', company3_id, workspace_uuid, now(), now()),
  ('Brian Anderson', 'Security Manager', 'Technology', 'brian.anderson@globaldynamics.com', '+1 (555) 222-0022', company3_id, workspace_uuid, now(), now()),
  ('Christina Martinez', 'Marketing Director', 'Marketing', 'christina.martinez@globaldynamics.com', '+1 (555) 222-0023', company3_id, workspace_uuid, now(), now()),
  ('David Johnson', 'Event Manager', 'Marketing', 'david.johnson@globaldynamics.com', '+1 (555) 222-0024', company3_id, workspace_uuid, now(), now()),
  ('Emily Brown', 'PR Manager', 'Marketing', 'emily.brown@globaldynamics.com', '+1 (555) 222-0025', company3_id, workspace_uuid, now(), now()),
  ('Frank Wilson', 'Research Analyst', 'Consulting', 'frank.wilson@globaldynamics.com', '+1 (555) 222-0026', company3_id, workspace_uuid, now(), now()),
  ('Grace Lee', 'Knowledge Manager', 'Consulting', 'grace.lee@globaldynamics.com', '+1 (555) 222-0027', company3_id, workspace_uuid, now(), now()),
  ('Henry Clark', 'Training Manager', 'Human Resources', 'henry.clark@globaldynamics.com', '+1 (555) 222-0028', company3_id, workspace_uuid, now(), now()),
  ('Irene Wang', 'Admin Manager', 'Operations', 'irene.wang@globaldynamics.com', '+1 (555) 222-0029', company3_id, workspace_uuid, now(), now()),
  ('Jack Robinson', 'Facilities Manager', 'Operations', 'jack.robinson@globaldynamics.com', '+1 (555) 222-0030', company3_id, workspace_uuid, now(), now());

  -- Create sample notes using valid source 'ui'
  INSERT INTO public.notes (content, entity_type, entity_id, team_id, visibility, source, pinned, created_at, updated_at)
  SELECT 
    'Initial discovery call - discussed current pain points with stakeholder management. Interested in AI-powered insights.',
    'contact',
    id,
    workspace_uuid,
    'team',
    'ui',
    false,
    now() - interval '7 days',
    now() - interval '7 days'
  FROM public.contacts 
  WHERE team_id = workspace_uuid AND title = 'CEO'
  LIMIT 3;

  INSERT INTO public.notes (content, entity_type, entity_id, team_id, visibility, source, pinned, created_at, updated_at)
  SELECT 
    'Technical deep dive completed. CTO approved proof of concept. Next step: vendor security review.',
    'contact',
    id,
    workspace_uuid,
    'team',
    'ui',
    true,
    now() - interval '3 days',
    now() - interval '3 days'
  FROM public.contacts 
  WHERE team_id = workspace_uuid AND title = 'CTO'
  LIMIT 3;

END;
$$;

-- 6. Enhanced reset_demo_data function that uses the seeder
CREATE OR REPLACE FUNCTION public.reset_demo_data(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_team_id uuid;
  team_mode public.workspace_mode;
BEGIN
  SELECT team_id INTO user_team_id FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  
  IF user_team_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT workspace_mode INTO team_mode FROM public.teams WHERE id = user_team_id;
  
  IF team_mode NOT IN ('demo', 'public_demo') THEN
    RAISE EXCEPTION 'Cannot reset non-demo workspace';
  END IF;

  PERFORM public.seed_demo_workspace(user_team_id);
  
  RETURN true;
END;
$$;

-- 7. Function to get workspace mode for current user
CREATE OR REPLACE FUNCTION public.get_workspace_mode(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_team_id uuid;
  mode public.workspace_mode;
BEGIN
  SELECT team_id INTO user_team_id FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  
  IF user_team_id IS NULL THEN
    RETURN 'production';
  END IF;
  
  SELECT workspace_mode INTO mode FROM public.teams WHERE id = user_team_id;
  
  RETURN COALESCE(mode::text, 'production');
END;
$$;

-- 8. Function to check if workspace is public demo (for RLS)
CREATE OR REPLACE FUNCTION public.is_public_demo_workspace(workspace_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.teams 
    WHERE id = workspace_uuid AND workspace_mode = 'public_demo'
  );
END;
$$;

-- 9. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.seed_demo_workspace(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_demo_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workspace_mode(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_public_demo_workspace(uuid) TO authenticated;