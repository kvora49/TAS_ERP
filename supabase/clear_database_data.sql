-- ==========================================
-- TAS ERP: Complete Database Data Reset Script
-- ==========================================
-- Purpose: Deletes all stored records/data from `public` (and optionally `auth`) schema
-- while leaving all table structures, columns, foreign keys, RLS policies, 
-- indexes, functions, triggers, and views completely intact.
--
-- Instructions: 
-- Copy and paste this script inside your Supabase Dashboard -> SQL Editor and click "Run".
-- ==========================================

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- 1. Defer foreign key constraint checking during the truncation process
    SET CONSTRAINTS ALL DEFERRED;

    -- 2. Dynamically loop through and truncate every table in the public schema
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename NOT IN ('schema_migrations', '_supabase_migrations', 'spatial_ref_sys')
    ) LOOP
        EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE;';
    END LOOP;

    -- 3. (OPTIONAL) Truncate auth users so user accounts are also reset.
    -- Uncomment the line below if you wish to clear registered user accounts:
    -- EXECUTE 'TRUNCATE TABLE auth.users CASCADE;';

END $$;
