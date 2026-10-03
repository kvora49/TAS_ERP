-- Replaces repeated JS historical paid-amount adjustments with SUM/CTEs, reducing
-- edge/serverless CPU. Include recorded write-off reversals and legacy worker
-- allocations, preserving the same invoice paid-at-cutoff numeric contract.
CREATE OR REPLACE FUNCTION public.report_paid_at(
 p_business_id uuid,p_bill_id uuid,p_bill_type text,p_current_paid numeric,p_to date
) RETURNS numeric LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
WITH later_payments AS (
 SELECT COALESCE(SUM(a.allocated_amount),0) amount
 FROM public.payment_allocations a JOIN public.payments p ON p.id=a.payment_id AND p.business_id=p_business_id
 WHERE a.business_id=p_business_id AND a.bill_id=p_bill_id AND a.bill_type=p_bill_type
 AND p.status IN ('completed','success') AND GREATEST(p.payment_date,a.created_at::date)>p_to
), writeoff_delta AS (
 SELECT COALESCE(SUM(
  CASE WHEN w.written_off_at::date<=p_to AND (w.reversed_at IS NULL OR w.reversed_at::date>p_to) THEN w.amount ELSE 0 END
  - CASE WHEN w.reversed_at IS NULL THEN w.amount ELSE 0 END
 ),0) amount
 FROM public.write_offs w WHERE w.business_id=p_business_id AND w.bill_id=p_bill_id AND w.bill_type=p_bill_type
), later_worker_payments AS (
 SELECT COALESCE(SUM(a.amount_applied),0) amount
 FROM public.job_work_payment_entries a JOIN public.job_work_payments p ON p.id=a.payment_id AND p.business_id=p_business_id
 WHERE p_bill_type='job_work_entry' AND a.business_id=p_business_id AND a.stage_entry_id=p_bill_id
 AND p.status='success' AND GREATEST(p.payment_date,a.created_at::date)>p_to
)
SELECT GREATEST(0,COALESCE(p_current_paid,0)-(SELECT amount FROM later_payments)+(SELECT amount FROM writeoff_delta)-(SELECT amount FROM later_worker_payments));
$$;

-- Copy only recorded linked source fields, never reconstruct missing tax splits.
UPDATE public.credit_notes n SET
 taxable_amount=COALESCE(n.taxable_amount,r.taxable_amount),cgst=COALESCE(n.cgst,r.cgst),
 sgst=COALESCE(n.sgst,r.sgst),igst=COALESCE(n.igst,r.igst)
FROM public.sales_returns r WHERE n.return_id=r.id AND n.business_id=r.business_id
 AND (n.taxable_amount IS NULL OR n.cgst IS NULL OR n.sgst IS NULL OR n.igst IS NULL);
UPDATE public.debit_notes n SET
 taxable_amount=COALESCE(n.taxable_amount,r.taxable_after_discount),cgst=COALESCE(n.cgst,r.cgst),
 sgst=COALESCE(n.sgst,r.sgst),igst=COALESCE(n.igst,r.igst)
FROM public.purchase_returns r WHERE n.related_purchase_return_id=r.id AND n.business_id=r.business_id
 AND (n.taxable_amount IS NULL OR n.cgst IS NULL OR n.sgst IS NULL OR n.igst IS NULL);
