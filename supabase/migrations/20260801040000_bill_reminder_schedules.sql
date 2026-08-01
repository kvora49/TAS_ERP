-- Migration for Bill Reminder Schedules (Snooze & Recurring Overdue Intervals)
CREATE TABLE IF NOT EXISTS public.bill_reminder_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    bill_id UUID NOT NULL,
    bill_type VARCHAR(50) NOT NULL DEFAULT 'receivable', -- 'receivable' (sale_bills) or 'payable' (purchases)
    snoozed_until DATE,
    recurring_interval_days INTEGER DEFAULT 2,
    last_reminded_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT bill_reminder_schedules_unq UNIQUE(business_id, bill_id, bill_type)
);

-- Enable RLS
ALTER TABLE public.bill_reminder_schedules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bill_reminder_schedules' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON public.bill_reminder_schedules
      FOR ALL USING (business_id = (SELECT business_id FROM public.users WHERE id = auth.uid()));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_bill_reminder_schedules_biz_bill ON public.bill_reminder_schedules(business_id, bill_id, bill_type);
