-- 20260727110000_rls_stable_function.sql
-- Performance Optimization: STABLE function for RLS tenant isolation

-- 1. Create STABLE function to retrieve authenticated user's business_id
-- SQL STABLE functions are evaluated once per query/statement, preventing subquery execution per row.
CREATE OR REPLACE FUNCTION public.auth_business_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT business_id FROM public.users WHERE id = auth.uid() AND deleted_at IS NULL LIMIT 1;
$$;

-- 2. Bulk replace RLS policies using inline subqueries with auth_business_id()
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        qual LIKE '%SELECT business_id FROM users WHERE id = auth.uid()%'
        OR qual LIKE '%SELECT business_id FROM public.users WHERE id = auth.uid()%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR ALL USING (business_id = public.auth_business_id())',
      r.policyname, r.schemaname, r.tablename
    );
  END LOOP;
END $$;
