-- Migration to align report RPC return structures with frontend UI expectations

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
  -- Trade Receivables
  SELECT COALESCE(SUM(grand_total - paid_amount), 0) INTO v_trade_receivables
    FROM sale_bills WHERE business_id = p_business_id AND payment_status != 'paid' AND bill_date <= p_as_on_date;

  -- Finished Stock
  SELECT COALESCE(SUM(total_value), 0) INTO v_finished_stock
    FROM finished_stock WHERE business_id = p_business_id AND deleted_at IS NULL;

  -- Raw Material
  SELECT COALESCE(SUM(stock_value), 0) INTO v_raw_material_stock
    FROM raw_material_current_stock WHERE business_id = p_business_id;

  -- Cash & Bank
  SELECT COALESCE(SUM(CASE WHEN direction = 'received' THEN amount ELSE -amount END), 0) INTO v_cash_and_bank
    FROM payments WHERE business_id = p_business_id AND payment_mode IN ('cash','bank_transfer','upi','neft','rtgs') AND payment_date <= p_as_on_date AND status = 'completed';

  -- Trade Payables
  SELECT COALESCE(SUM(rmp.grand_total - COALESCE(rmp.paid_amount, 0)), 0) INTO v_trade_payables
    FROM raw_material_purchases rmp WHERE rmp.business_id = p_business_id AND rmp.payment_status != 'paid' AND rmp.invoice_date <= p_as_on_date;

  -- Advances given
  SELECT COALESCE(SUM(remaining_amount), 0) INTO v_outstanding_advances_given
    FROM advance_payments ap JOIN payments pay ON ap.payment_id = pay.id
    WHERE ap.business_id = p_business_id AND ap.is_settled = false AND pay.direction = 'paid' AND pay.payment_date <= p_as_on_date;

  -- Advances received
  SELECT COALESCE(SUM(remaining_amount), 0) INTO v_outstanding_advances_received
    FROM advance_payments ap JOIN payments pay ON ap.payment_id = pay.id
    WHERE ap.business_id = p_business_id AND ap.is_settled = false AND pay.direction = 'received' AND pay.payment_date <= p_as_on_date;

  -- Net Profit
  SELECT COALESCE(SUM(grand_total), 0) INTO v_revenue
    FROM sale_bills WHERE business_id = p_business_id AND bill_date <= p_as_on_date;
  SELECT COALESCE(SUM(grand_total), 0) INTO v_expenses
    FROM raw_material_purchases WHERE business_id = p_business_id AND invoice_date <= p_as_on_date;
  SELECT COALESCE(SUM(amount + gst_amount), 0) INTO v_salary
    FROM expenses WHERE business_id = p_business_id AND expense_date <= p_as_on_date;

  v_net_profit := v_revenue - v_expenses - v_salary;

  RETURN json_build_object(
    'assets', json_build_object(
      'cash_and_bank', v_cash_and_bank,
      'trade_receivables', v_trade_receivables,
      'finished_stock', v_finished_stock,
      'raw_material_stock', v_raw_material_stock,
      'advances_given', v_outstanding_advances_given
    ),
    'liabilities', json_build_object(
      'trade_payables', v_trade_payables,
      'advances_received', v_outstanding_advances_received
    ),
    'equity', json_build_object(
      'retained_earnings', v_net_profit
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION get_profit_loss(p_business_id UUID, p_from DATE, p_to DATE)
RETURNS JSON AS $$
DECLARE
  v_sales_revenue NUMERIC := 0;
  v_misc_income NUMERIC := 0;
  v_raw_material NUMERIC := 0;
  v_job_work_wages NUMERIC := 0;
  v_salary NUMERIC := 0;
  v_expenses_breakdown JSON;
  v_total_expenses NUMERIC := 0;
  v_bad_debts NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(grand_total), 0) INTO v_sales_revenue
    FROM sale_bills WHERE business_id = p_business_id AND bill_date BETWEEN p_from AND p_to;

  SELECT COALESCE(SUM(amount), 0) INTO v_misc_income
    FROM misc_income WHERE business_id = p_business_id AND income_date BETWEEN p_from AND p_to;

  SELECT COALESCE(SUM(grand_total), 0) INTO v_raw_material
    FROM raw_material_purchases WHERE business_id = p_business_id AND invoice_date BETWEEN p_from AND p_to;

  SELECT COALESCE(SUM(total_job_work_amount), 0) INTO v_job_work_wages
    FROM stage_entries WHERE business_id = p_business_id AND entry_date BETWEEN p_from AND p_to;

  SELECT COALESCE(SUM(net_salary), 0) INTO v_salary
    FROM salary_entries WHERE business_id = p_business_id AND payment_date BETWEEN p_from AND p_to;

  -- Build flat key-value pairs for expenses
  SELECT COALESCE(json_object_agg(expense_type, total), '{}'::json) INTO v_expenses_breakdown
    FROM (
      SELECT et.name as expense_type, SUM(ex.amount + ex.gst_amount) as total
        FROM expenses ex
        JOIN expense_types et ON ex.expense_type_id = et.id
       WHERE ex.business_id = p_business_id
         AND ex.expense_date BETWEEN p_from AND p_to
       GROUP BY et.name
    ) e;

  SELECT COALESCE(SUM(amount + gst_amount), 0) INTO v_total_expenses
    FROM expenses WHERE business_id = p_business_id AND expense_date BETWEEN p_from AND p_to;

  SELECT COALESCE(SUM(amount), 0) INTO v_bad_debts
    FROM write_offs WHERE business_id = p_business_id
      AND write_off_type = 'loss'
      AND reversed_at IS NULL
      AND written_off_at::DATE BETWEEN p_from AND p_to;

  RETURN json_build_object(
    'from', p_from, 'to', p_to,
    'income', json_build_object(
      'revenue', v_sales_revenue,
      'misc_income', v_misc_income,
      'total', v_sales_revenue + v_misc_income
    ),
    'cogs', v_raw_material + v_job_work_wages,
    'gross_profit', (v_sales_revenue + v_misc_income) - (v_raw_material + v_job_work_wages),
    'expenses', json_build_object(
      'breakdown', v_expenses_breakdown,
      'total', v_total_expenses
    ),
    'salary', v_salary,
    'bad_debts', v_bad_debts,
    'operating_profit', (v_sales_revenue + v_misc_income) - (v_raw_material + v_job_work_wages) - v_total_expenses - v_salary,
    'net_profit', (v_sales_revenue + v_misc_income) - (v_raw_material + v_job_work_wages) - v_total_expenses - v_salary - v_bad_debts
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION get_gst_summary(p_business_id UUID, p_from DATE, p_to DATE)
RETURNS JSON AS $$
DECLARE
  v_sales JSON;
  v_purchases JSON;
  v_taxable_sales NUMERIC := 0;
  v_taxable_purchases NUMERIC := 0;
  v_total_output NUMERIC := 0;
  v_total_input NUMERIC := 0;
  v_credit_note_adjustment NUMERIC := 0;
BEGIN
  -- Sales/Output list of transactions
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_sales
    FROM (
      SELECT
        sb.bill_number as number,
        sb.bill_date as date,
        p.name as party,
        COALESCE(sb.taxable_amount, 0) as taxable,
        COALESCE(sb.cgst + sb.sgst + sb.igst, 0) as gst,
        COALESCE(sb.grand_total, 0) as total
      FROM sale_bills sb
      LEFT JOIN parties p ON sb.party_id = p.id
      WHERE sb.business_id = p_business_id
        AND sb.bill_date BETWEEN p_from AND p_to
      ORDER BY sb.bill_date DESC, sb.bill_number DESC
    ) t;

  -- Purchases/Input list of transactions
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_purchases
    FROM (
      SELECT
        rmp.purchase_number as number,
        rmp.invoice_date as date,
        p.name as party,
        COALESCE(rmp.total_taxable_value, 0) as taxable,
        COALESCE(rmp.total_gst_amount, 0) as gst,
        COALESCE(rmp.grand_total, 0) as total
      FROM raw_material_purchases rmp
      LEFT JOIN parties p ON rmp.supplier_id = p.id
      WHERE rmp.business_id = p_business_id
        AND rmp.invoice_date BETWEEN p_from AND p_to
      ORDER BY rmp.invoice_date DESC, rmp.purchase_number DESC
    ) t;

  SELECT COALESCE(SUM(taxable_amount), 0), COALESCE(SUM(cgst + sgst + igst), 0)
    INTO v_taxable_sales, v_total_output
    FROM sale_bills WHERE business_id = p_business_id AND bill_date BETWEEN p_from AND p_to;

  SELECT COALESCE(SUM(total_taxable_value), 0), COALESCE(SUM(total_gst_amount), 0)
    INTO v_taxable_purchases, v_total_input
    FROM raw_material_purchases WHERE business_id = p_business_id AND invoice_date BETWEEN p_from AND p_to;

  SELECT COALESCE(SUM(gst_amount), 0) INTO v_credit_note_adjustment
    FROM credit_notes WHERE business_id = p_business_id AND issue_date BETWEEN p_from AND p_to AND status != 'cancelled';

  RETURN json_build_object(
    'from', p_from, 'to', p_to,
    'sales', v_sales,
    'purchases', v_purchases,
    'summary', json_build_object(
      'net_taxable_sales', v_taxable_sales,
      'total_output_gst', v_total_output,
      'net_taxable_purchases', v_taxable_purchases,
      'total_input_gst', v_total_input,
      'net_gst_payable', v_total_output - v_total_input - v_credit_note_adjustment
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
