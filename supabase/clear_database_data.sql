-- ==========================================
-- TAS ERP: Complete Database Data Reset Script
-- ==========================================
-- Purpose: Deletes all stored records/data from both `public` and `auth` schemas
-- while leaving all table structures, columns, foreign keys, RLS policies, 
-- indexes, functions, and triggers completely intact.
--
-- Instructions: Run this script inside your Supabase Dashboard -> SQL Editor.
-- ==========================================

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- Disable foreign key constraints temporarily
    SET CONSTRAINTS ALL DEFERRED;

    -- 1. Truncate all tables in the public schema
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename NOT IN ('schema_migrations', '_supabase_migrations', 'spatial_ref_sys')
    ) LOOP
        EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE;';
    END LOOP;

    -- 2. Truncate auth users so old login credentials/emails can be re-registered
    EXECUTE 'TRUNCATE TABLE auth.users CASCADE;';

END $$;
