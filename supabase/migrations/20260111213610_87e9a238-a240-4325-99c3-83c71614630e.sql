-- ============================================
-- FOUNDATION MIGRATION: RBAC + Ownership Model
-- Safe & Idempotent - can be run multiple times
-- ============================================

-- 1) CREATE ENUM (idempotent)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'contributor', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) CREATE update_updated_at_column FUNCTION
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3) CREATE user_roles TABLE
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL DEFAULT 'viewer',
    team_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Trigger for user_roles updated_at
DROP TRIGGER IF EXISTS update_user_roles_updated_at ON public.user_roles;
CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) CREATE has_role FUNCTION (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 5) CREATE get_user_role FUNCTION
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'admin' THEN 1 
      WHEN 'manager' THEN 2 
      WHEN 'contributor' THEN 3 
      WHEN 'viewer' THEN 4 
    END
  LIMIT 1
$$;

-- 6) RLS Policies for user_roles (drop first for idempotency)
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- 7) CREATE companies TABLE (fresh since none exists)
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    industry TEXT,
    size TEXT,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_companies_updated_at ON public.companies;
CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8) CREATE contacts TABLE (fresh since none exists)
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    title TEXT,
    department TEXT,
    email TEXT,
    phone TEXT,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_contacts_updated_at ON public.contacts;
CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9) CREATE team member tables
CREATE TABLE IF NOT EXISTS public.company_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (company_id, user_id)
);

ALTER TABLE public.company_team_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.contact_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (contact_id, user_id)
);

ALTER TABLE public.contact_team_members ENABLE ROW LEVEL SECURITY;

-- 10) CREATE can_edit_company FUNCTION (AFTER has_role exists)
CREATE OR REPLACE FUNCTION public.can_edit_company(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'manager')
    OR EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id AND owner_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.company_team_members WHERE company_id = _company_id AND user_id = _user_id)
  )
$$;

-- 11) CREATE can_edit_contact FUNCTION
CREATE OR REPLACE FUNCTION public.can_edit_contact(_user_id UUID, _contact_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'manager')
    OR EXISTS (SELECT 1 FROM public.contacts WHERE id = _contact_id AND owner_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.contact_team_members WHERE contact_id = _contact_id AND user_id = _user_id)
  )
$$;

-- 12) RLS Policies for companies
DROP POLICY IF EXISTS "Anyone can view companies" ON public.companies;
DROP POLICY IF EXISTS "Users with edit permission can update companies" ON public.companies;
DROP POLICY IF EXISTS "Contributors and above can insert companies" ON public.companies;
DROP POLICY IF EXISTS "Admins can delete companies" ON public.companies;

CREATE POLICY "Anyone can view companies" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Users with edit permission can update companies" ON public.companies FOR UPDATE USING (public.can_edit_company(auth.uid(), id));
CREATE POLICY "Contributors and above can insert companies" ON public.companies FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'contributor')
);
CREATE POLICY "Admins can delete companies" ON public.companies FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- 13) RLS Policies for contacts
DROP POLICY IF EXISTS "Anyone can view contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users with edit permission can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Contributors and above can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Admins can delete contacts" ON public.contacts;

CREATE POLICY "Anyone can view contacts" ON public.contacts FOR SELECT USING (true);
CREATE POLICY "Users with edit permission can update contacts" ON public.contacts FOR UPDATE USING (public.can_edit_contact(auth.uid(), id));
CREATE POLICY "Contributors and above can insert contacts" ON public.contacts FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'contributor')
);
CREATE POLICY "Admins can delete contacts" ON public.contacts FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- 14) RLS Policies for team member tables
DROP POLICY IF EXISTS "Anyone can view company team members" ON public.company_team_members;
DROP POLICY IF EXISTS "Company editors can manage team" ON public.company_team_members;
DROP POLICY IF EXISTS "Anyone can view contact team members" ON public.contact_team_members;
DROP POLICY IF EXISTS "Contact editors can manage team" ON public.contact_team_members;

CREATE POLICY "Anyone can view company team members" ON public.company_team_members FOR SELECT USING (true);
CREATE POLICY "Company editors can manage team" ON public.company_team_members FOR ALL USING (public.can_edit_company(auth.uid(), company_id));
CREATE POLICY "Anyone can view contact team members" ON public.contact_team_members FOR SELECT USING (true);
CREATE POLICY "Contact editors can manage team" ON public.contact_team_members FOR ALL USING (public.can_edit_contact(auth.uid(), contact_id));