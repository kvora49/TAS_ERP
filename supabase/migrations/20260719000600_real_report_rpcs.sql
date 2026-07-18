-- Real implementation of get_balance_sheet() RPC
-- Aggregates real data from all Phase tables

CREATE OR REPLACE FUNCTION get_balance_sheet(p_business_id UUID, p_as_on_date DATE)
RETURNS JSON AS $$
DECLARE
  v_trade_receivables NUMERIC := 0;
  v_cash_and_bank NUMERIC := 0;
  v_finished_stock NUMERIC := 0;
  v_raw_material_stock NUMERIC := 0;
  v_trade_payables NUMERIC := 0;
  v_outstanding_advances_given NUMERIC := 0;
  v_outstanding_advances_received NUMERIC := 0;
  v_net_profit NUMERIC := 0;
  v_revenue NUMERIC := 0;
  v_expenses NUMERIC := 0;
  v_salary NUMERIC := 0;
BEGIN
  -- Trade Receivables: unpaid + partial sale bills outstanding
  SELECT COALESCE(SUM(outstanding_amount), 0)
    INTO v_trade_receivables
    FROM sale_bills
   WHERE business_id = p_business_id
     AND payment_status != 'paid'
     AND bill_date <= p_as_on_date;

  -- Finished Stock valuation
  SELECT COALESCE(SUM(p.current_stock * p.cost_price), 0)
    INTO v_finished_stock
    FROM products p
   WHERE p.business_id = p_business_id;

  -- Raw Material stock valuation (using current_stock × purchase_price)
  SELECT COALESCE(SUM(rm.current_stock * rm.purchase_price), 0)
    INTO v_raw_material_stock
    FROM raw_materials rm
   WHERE rm.business_id = p_business_id;

  -- Cash & Bank: net of received payments - paid payments up to as_on_date
  SELECT COALESCE(SUM(CASE WHEN direction = 'received' THEN amount ELSE -amount END), 0)
    INTO v_cash_and_bank
    FROM payments
   WHERE business_id = p_business_id
     AND payment_mode IN ('cash','bank_transfer','upi','neft','rtgs')
     AND payment_date <= p_as_on_date
     AND status = 'completed';

  -- Trade Payables: unpaid purchases outstanding
  SELECT COALESCE(SUM(rmp.grand_total - COALESCE(rmp.paid_amount, 0)), 0)
    INTO v_trade_payables
    FROM raw_material_purchases rmp
   WHERE rmp.business_id = p_business_id
     AND rmp.payment_status != 'paid'
     AND rmp.purchase_date <= p_as_on_date;

  -- Advances given (unsettled, to suppliers/workers)
  SELECT COALESCE(SUM(remaining_amount), 0)
    INTO v_outstanding_advances_given
    FROM advance_payments ap
    JOIN payments pay ON ap.payment_id = pay.id
   WHERE ap.business_id = p_business_id
     AND ap.is_settled = false
     AND pay.direction = 'paid'
     AND pay.payment_date <= p_as_on_date;

  -- Advances received (unsettled, from customers)
  SELECT COALESCE(SUM(remaining_amount), 0)
    INTO v_outstanding_advances_received
    FROM advance_payments ap
    JOIN payments pay ON ap.payment_id = pay.id
   WHERE ap.business_id = p_business_id
     AND ap.is_settled = false
     AND pay.direction = 'received'
     AND pay.payment_date <= p_as_on_date;

  -- Net profit as retained earnings proxy
  SELECT COALESCE(SUM(grand_total), 0) INTO v_revenue
    FROM sale_bills WHERE business_id = p_business_id AND bill_date <= p_as_on_date;

  SELECT COALESCE(SUM(grand_total), 0) INTO v_expenses
    FROM raw_material_purchases WHERE business_id = p_business_id AND purchase_date <= p_as_on_date;

  SELECT COALESCE(SUM(amount + gst_amount), 0) INTO v_salary
    FROM expenses WHERE business_id = p_business_id AND expense_date <= p_as_on_date;

  v_net_profit := v_revenue - v_expenses - v_salary;

  RETURN json_build_object(
    'as_on_date', p_as_on_date,
    'assets', json_build_object(
      'current', json_build_object(
        'inventories', json_build_object(
          'finished_stock', v_finished_stock,
          'raw_material_stock', v_raw_material_stock,
          'total', v_finished_stock + v_raw_material_stock
        ),
        'trade_receivables', v_trade_receivables,
        'cash_and_bank', v_cash_and_bank,
        'advances_given', v_outstanding_advances_given,
        'total_current', v_finished_stock + v_raw_material_stock + v_trade_receivables + v_cash_and_bank + v_outstanding_advances_given
      ),
      'total_assets', v_finished_stock + v_raw_material_stock + v_trade_receivables + v_cash_and_bank + v_outstanding_advances_given
    ),
    'liabilities', json_build_object(
      'current', json_build_object(
        'trade_payables', v_trade_payables,
        'advances_received', v_outstanding_advances_received,
        'total_current', v_trade_payables + v_outstanding_advances_received
      ),
      'total_liabilities', v_trade_payables + v_outstanding_advances_received
    ),
    'equity', json_build_object(
      'retained_earnings', v_net_profit,
      'total_equity', v_net_profit
    ),
    'identity_check', json_build_object(
      'total_assets', v_finished_stock + v_raw_material_stock + v_trade_receivables + v_cash_and_bank + v_outstanding_advances_given,
      'total_liabilities_equity', v_trade_payables + v_outstanding_advances_received + v_net_profit
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Real implementation of get_profit_loss() RPC
CREATE OR REPLACE FUNCTION get_profit_loss(p_business_id UUID, p_from DATE, p_to DATE)
RETURNS JSON AS $$
DECLARE
  v_sales_revenue NUMERIC := 0;
  v_misc_income NUMERIC := 0;
  v_raw_material NUMERIC := 0;
  v_job_work_wages NUMERIC := 0;
  v_salary NUMERIC := 0;
  v_expenses JSON;
  v_total_expenses NUMERIC := 0;
  v_bad_debts NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(grand_total), 0) INTO v_sales_revenue
    FROM sale_bills WHERE business_id = p_business_id AND bill_date BETWEEN p_from AND p_to;

  SELECT COALESCE(SUM(amount), 0) INTO v_misc_income
    FROM misc_income WHERE business_id = p_business_id AND income_date BETWEEN p_from AND p_to;

  SELECT COALESCE(SUM(grand_total), 0) INTO v_raw_material
    FROM raw_material_purchases WHERE business_id = p_business_id AND purchase_date BETWEEN p_from AND p_to;

  SELECT COALESCE(SUM(amount_due), 0) INTO v_job_work_wages
    FROM job_work_entries WHERE business_id = p_business_id AND entry_date BETWEEN p_from AND p_to;

  SELECT COALESCE(SUM(net_salary), 0) INTO v_salary
    FROM salary_entries WHERE business_id = p_business_id AND payment_date BETWEEN p_from AND p_to;

  -- Expenses grouped by type
  SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) INTO v_expenses
    FROM (
      SELECT et.name as expense_type, SUM(ex.amount + ex.gst_amount) as total
        FROM expenses ex
        JOIN expense_types et ON ex.expense_type_id = et.id
       WHERE ex.business_id = p_business_id
         AND ex.expense_date BETWEEN p_from AND p_to
       GROUP BY et.name
    ) e;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_expenses
    FROM expenses WHERE business_id = p_business_id AND expense_date BETWEEN p_from AND p_to;

  SELECT COALESCE(SUM(amount), 0) INTO v_bad_debts
    FROM write_offs WHERE business_id = p_business_id
      AND write_off_type = 'loss'
      AND reversed_at IS NULL
      AND written_off_at::DATE BETWEEN p_from AND p_to;

  RETURN json_build_object(
    'from', p_from, 'to', p_to,
    'income', json_build_object(
      'sales_revenue', v_sales_revenue,
      'misc_income', v_misc_income,
      'total', v_sales_revenue + v_misc_income
    ),
    'cogs', json_build_object(
      'raw_material', v_raw_material,
      'job_work_wages', v_job_work_wages,
      'total', v_raw_material + v_job_work_wages
    ),
    'gross_profit', (v_sales_revenue + v_misc_income) - (v_raw_material + v_job_work_wages),
    'expenses', json_build_object(
      'breakdown', v_expenses,
      'salary', v_salary,
      'bad_debts', v_bad_debts,
      'total', v_total_expenses + v_salary + v_bad_debts
    ),
    'operating_profit', (v_sales_revenue + v_misc_income) - (v_raw_material + v_job_work_wages) - v_total_expenses - v_salary,
    'net_profit', (v_sales_revenue + v_misc_income) - (v_raw_material + v_job_work_wages) - v_total_expenses - v_salary - v_bad_debts
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Real implementation of get_gst_summary() RPC
CREATE OR REPLACE FUNCTION get_gst_summary(p_business_id UUID, p_from DATE, p_to DATE)
RETURNS JSON AS $$
DECLARE
  v_output_tax JSON;
  v_input_tax JSON;
  v_total_output NUMERIC := 0;
  v_total_input NUMERIC := 0;
  v_credit_note_adjustment NUMERIC := 0;
  v_debit_note_adjustment NUMERIC := 0;
BEGIN
  -- Output GST by rate from sale_bills
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_output_tax
    FROM (
      SELECT
        sbi.gst_percent,
        SUM(sbi.taxable_amount) as taxable,
        SUM(sbi.gst_amount) as total_gst,
        SUM(sbi.gst_amount / 2) as cgst,
        SUM(sbi.gst_amount / 2) as sgst,
        0::NUMERIC as igst
      FROM sale_bill_items sbi
      JOIN sale_bills sb ON sbi.bill_id = sb.id
      WHERE sb.business_id = p_business_id
        AND sb.bill_date BETWEEN p_from AND p_to
      GROUP BY sbi.gst_percent
      ORDER BY sbi.gst_percent
    ) t;

  SELECT COALESCE(SUM(gst_amount), 0) INTO v_total_output
    FROM sale_bills WHERE business_id = p_business_id AND bill_date BETWEEN p_from AND p_to;

  -- Input GST by rate from raw_material_purchases
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_input_tax
    FROM (
      SELECT
        rmpi.gst_percent,
        SUM(rmpi.taxable_amount) as taxable,
        SUM(rmpi.gst_amount) as total_gst,
        SUM(rmpi.gst_amount / 2) as cgst,
        SUM(rmpi.gst_amount / 2) as sgst,
        0::NUMERIC as igst
      FROM raw_material_purchase_items rmpi
      JOIN raw_material_purchases rmp ON rmpi.purchase_id = rmp.id
      WHERE rmp.business_id = p_business_id
        AND rmp.purchase_date BETWEEN p_from AND p_to
      GROUP BY rmpi.gst_percent
      ORDER BY rmpi.gst_percent
    ) t;

  SELECT COALESCE(SUM(gst_amount), 0) INTO v_total_input
    FROM raw_material_purchases WHERE business_id = p_business_id AND purchase_date BETWEEN p_from AND p_to;

  -- Credit note adjustments (reduce output tax)
  SELECT COALESCE(SUM(gst_amount), 0) INTO v_credit_note_adjustment
    FROM credit_notes WHERE business_id = p_business_id
      AND issue_date BETWEEN p_from AND p_to
      AND status != 'cancelled';

  RETURN json_build_object(
    'from', p_from, 'to', p_to,
    'output_tax', json_build_object(
      'rows', v_output_tax,
      'total', v_total_output,
      'credit_note_adjustment', -v_credit_note_adjustment
    ),
    'input_tax', json_build_object(
      'rows', v_input_tax,
      'total', v_total_input
    ),
    'summary', json_build_object(
      'total_output_gst', v_total_output,
      'total_input_gst', v_total_input,
      'adjustments', -v_credit_note_adjustment,
      'net_gst_payable', v_total_output - v_total_input - v_credit_note_adjustment
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
