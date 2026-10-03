-- Shared read-only projections replace repeated route-level fetch/filter/reduce work.
-- Aggregate in PostgreSQL to reduce edge/serverless CPU and transfer. STABLE describes
-- snapshot semantics, not a cross-request result cache. RLS runs as the caller.
CREATE OR REPLACE FUNCTION public.report_account_movements(p_business_id uuid)
RETURNS TABLE(id uuid, account_id uuid, entry_date date, signed_amount numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT p.id, p.bank_account_id, p.payment_date,
    CASE WHEN p.direction = 'received' THEN p.amount ELSE -p.amount END
  FROM public.payments p
  WHERE p.business_id = p_business_id AND p.status IN ('completed', 'success')
    AND p.direction IN ('received', 'paid') AND p.bank_account_id IS NOT NULL
  UNION ALL
  SELECT e.id, e.paid_from_account_id, e.expense_date, -(e.amount + COALESCE(e.gst_amount, 0))
  FROM public.expenses e WHERE e.business_id = p_business_id AND e.paid_from_account_id IS NOT NULL
  UNION ALL
  SELECT s.id, s.bank_account_id, s.payment_date, -s.net_salary
  FROM public.salary_entries s WHERE s.business_id = p_business_id AND s.bank_account_id IS NOT NULL
  UNION ALL
  SELECT m.id, m.received_in_account_id, m.income_date, m.amount
  FROM public.misc_income m WHERE m.business_id = p_business_id AND m.received_in_account_id IS NOT NULL
  UNION ALL
  SELECT j.id, NULLIF(to_jsonb(j)->>'bank_account_id', '')::uuid, j.payment_date, -j.paid_amount
  FROM public.job_work_payments j WHERE j.business_id = p_business_id AND j.status = 'success'
    AND NULLIF(to_jsonb(j)->>'bank_account_id', '') IS NOT NULL
$$;

-- Roll back known posted allocations made after the requested cutoff, rather than
-- using a current paid_amount unchanged in historical outstanding reports.
CREATE OR REPLACE FUNCTION public.report_paid_at(
  p_business_id uuid, p_bill_id uuid, p_bill_type text, p_current_paid numeric, p_to date
) RETURNS numeric LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT GREATEST(0, COALESCE(p_current_paid, 0) - COALESCE(SUM(a.allocated_amount), 0))
  FROM public.payment_allocations a JOIN public.payments p ON p.id = a.payment_id
  WHERE p.business_id = p_business_id AND a.business_id = p_business_id
    AND a.bill_id = p_bill_id AND a.bill_type = p_bill_type
    AND p.status IN ('completed', 'success')
    AND GREATEST(p.payment_date, a.created_at::date) > p_to
$$;
