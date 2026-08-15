-- =========================================================
-- MIGRATION: 20260815000000_multi_company_memberships.sql
-- Multi-Company Memberships, RLS Isolation & Tenancy Decoupling
-- =========================================================

-- 1. Create company_members join table
CREATE TABLE IF NOT EXISTS public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'staff',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, company_id)
);

-- 2. Performance indexes for active memberships
CREATE INDEX IF NOT EXISTS idx_company_members_user_active 
  ON public.company_members (user_id) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_company_members_company_active 
  ON public.company_members (company_id) 
  WHERE status = 'active';

-- 3. Alias VIEW for companies -> businesses
CREATE OR REPLACE VIEW public.companies AS 
  SELECT * FROM public.businesses;

-- 4. Backfill existing memberships from public.users
INSERT INTO public.company_members (user_id, company_id, role, status, created_at)
SELECT 
  u.id, 
  u.business_id, 
  COALESCE(u.role, 'owner'), 
  'active', 
  COALESCE(u.created_at, NOW())
FROM public.users u
WHERE u.business_id IS NOT NULL 
  AND u.deleted_at IS NULL
ON CONFLICT (user_id, company_id) DO UPDATE 
SET 
  role = EXCLUDED.role,
  status = 'active';

-- 5. Helper STABLE functions for ultra-fast RLS evaluation
CREATE OR REPLACE FUNCTION public.auth_has_business_access(b_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE user_id = auth.uid()
      AND company_id = b_id
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_business_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id 
  FROM public.company_members 
  WHERE user_id = auth.uid() 
    AND status = 'active' 
  ORDER BY created_at ASC 
  LIMIT 1;
$$;

-- 6. Enable Row-Level Security on company_members
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Select policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'company_members' AND policyname = 'members_can_view_their_memberships'
  ) THEN
    CREATE POLICY "members_can_view_their_memberships" ON public.company_members
      FOR SELECT USING (
        user_id = auth.uid() 
        OR public.auth_has_business_access(company_id)
      );
  END IF;

  -- Insert policy (Owner/Admin or self-creation on signup)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'company_members' AND policyname = 'members_insert_policy'
  ) THEN
    CREATE POLICY "members_insert_policy" ON public.company_members
      FOR INSERT WITH CHECK (
        auth.uid() = user_id 
        OR EXISTS (
          SELECT 1 FROM public.company_members cm
          WHERE cm.user_id = auth.uid()
            AND cm.company_id = company_members.company_id
            AND cm.role IN ('owner', 'admin')
            AND cm.status = 'active'
        )
      );
  END IF;

  -- Update policy (Owner/Admin)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'company_members' AND policyname = 'members_update_policy'
  ) THEN
    CREATE POLICY "members_update_policy" ON public.company_members
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.company_members cm
          WHERE cm.user_id = auth.uid()
            AND cm.company_id = company_members.company_id
            AND cm.role IN ('owner', 'admin')
            AND cm.status = 'active'
        )
      );
  END IF;

  -- Delete policy (Owner)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'company_members' AND policyname = 'members_delete_policy'
  ) THEN
    CREATE POLICY "members_delete_policy" ON public.company_members
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.company_members cm
          WHERE cm.user_id = auth.uid()
            AND cm.company_id = company_members.company_id
            AND cm.role = 'owner'
            AND cm.status = 'active'
        )
      );
  END IF;
END
$$;

-- 7. Update triggers on company_members
DROP TRIGGER IF EXISTS tr_company_members_updated_at ON public.company_members;
CREATE TRIGGER tr_company_members_updated_at 
  BEFORE UPDATE ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8. Apply auth_has_business_access across all tenant-scoped tables
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename != 'company_members'
      AND (
        qual LIKE '%public.auth_business_id()%'
        OR qual LIKE '%SELECT business_id FROM users%'
        OR qual LIKE '%SELECT business_id FROM public.users%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR ALL USING (public.auth_has_business_access(business_id))',
      r.policyname, r.schemaname, r.tablename
    );
  END LOOP;
END $$;
