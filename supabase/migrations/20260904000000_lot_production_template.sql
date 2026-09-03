-- Migration: Add template_id to production_lots and backfill from templates
-- Date: 2026-09-04

DO $$
BEGIN
  -- 1. Add template_id column to production_lots if not exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'production_lots' 
      AND column_name = 'template_id'
  ) THEN
    ALTER TABLE public.production_lots 
    ADD COLUMN template_id UUID REFERENCES public.production_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Create index on production_lots(template_id) for fast lookups
CREATE INDEX IF NOT EXISTS idx_production_lots_template_id 
ON public.production_lots(template_id);

-- 3. Backfill existing production_lots with their company's default template
-- If no default template exists, backfill with the earliest created template for that business
UPDATE public.production_lots pl
SET template_id = sub.id
FROM (
  SELECT DISTINCT ON (business_id) id, business_id
  FROM public.production_templates
  WHERE deleted_at IS NULL
  ORDER BY business_id, is_default DESC, created_at ASC
) sub
WHERE pl.template_id IS NULL
  AND pl.business_id = sub.business_id;
