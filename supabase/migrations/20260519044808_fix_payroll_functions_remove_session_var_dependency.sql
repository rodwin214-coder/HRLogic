/*
  # Fix Payroll Functions: Remove Broken Session Variable Dependency

  ## Problem
  After converting functions to SECURITY INVOKER, they check
  current_setting('app.current_user_email') to verify the caller's company.
  However each supabase.rpc() call is a separate HTTP request / DB connection,
  so session variables set in one call do NOT persist into the next. This causes
  the company-mismatch check to fail with an empty session var, breaking all
  payroll RPC calls.

  ## Fix
  Remove the session-variable-based caller check from payroll functions.
  Data isolation is already enforced by:
    1. The p_company_id parameter scoping all queries (WHERE company_id = p_company_id)
    2. RLS policies on the underlying tables
    3. EXECUTE permission restricted to authenticated role only

  ## Functions Updated
  - get_payroll_adjustments
  - add_payroll_adjustment
  - create_payroll_period
  - update_payroll_period_status
  - delete_payroll_period
  - upsert_payroll_record
*/

-- ============================================================
-- get_payroll_adjustments — remove session var check
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_payroll_adjustments(p_company_id uuid, p_period_id uuid)
  RETURNS TABLE(
    id uuid, company_id uuid, period_id uuid, employee_id uuid,
    adjustment_type text, amount numeric, description text,
    created_at timestamptz
  )
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pa.id, pa.company_id, pa.period_id, pa.employee_id,
    pa.adjustment_type, pa.amount, pa.description, pa.created_at
  FROM payroll_adjustments pa
  WHERE pa.period_id = p_period_id
    AND pa.company_id = p_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_payroll_adjustments(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_payroll_adjustments(uuid, uuid) TO authenticated;

-- ============================================================
-- add_payroll_adjustment — remove session var check
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_payroll_adjustment(
  p_company_id uuid, p_period_id uuid, p_employee_id uuid,
  p_adjustment_type text, p_amount numeric, p_description text DEFAULT ''
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM payroll_periods WHERE id = p_period_id AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Period not found for company';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM employees WHERE id = p_employee_id AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Employee not found for company';
  END IF;

  INSERT INTO payroll_adjustments (
    company_id, period_id, employee_id, adjustment_type, amount, description
  ) VALUES (
    p_company_id, p_period_id, p_employee_id, p_adjustment_type, p_amount, p_description
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_payroll_adjustment(uuid, uuid, uuid, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_payroll_adjustment(uuid, uuid, uuid, text, numeric, text) TO authenticated;

-- ============================================================
-- create_payroll_period — remove session var check
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_payroll_period(
  p_company_id uuid, p_period_name text, p_pay_frequency text,
  p_period_start date, p_period_end date, p_pay_date date, p_notes text DEFAULT ''
)
  RETURNS payroll_periods
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path TO 'public'
AS $$
DECLARE
  v_result payroll_periods;
BEGIN
  INSERT INTO payroll_periods (
    company_id, period_name, pay_frequency,
    period_start, period_end, pay_date, notes, status
  ) VALUES (
    p_company_id, p_period_name, p_pay_frequency,
    p_period_start, p_period_end, p_pay_date, p_notes, 'Draft'
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_payroll_period(uuid, text, text, date, date, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_payroll_period(uuid, text, text, date, date, date, text) TO authenticated;

-- ============================================================
-- update_payroll_period_status — remove session var check
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_payroll_period_status(
  p_period_id uuid, p_company_id uuid, p_status text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path TO 'public'
AS $$
BEGIN
  UPDATE payroll_periods
  SET status = p_status
  WHERE id = p_period_id AND company_id = p_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_payroll_period_status(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_payroll_period_status(uuid, uuid, text) TO authenticated;

-- ============================================================
-- delete_payroll_period — remove session var check
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_payroll_period(p_period_id uuid, p_company_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM payroll_periods WHERE id = p_period_id AND company_id = p_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_payroll_period(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_payroll_period(uuid, uuid) TO authenticated;

-- ============================================================
-- upsert_payroll_record — remove session var check
-- ============================================================
CREATE OR REPLACE FUNCTION public.upsert_payroll_record(
  p_company_id uuid, p_period_id uuid, p_employee_id uuid,
  p_basic_salary numeric DEFAULT 0, p_daily_rate numeric DEFAULT 0,
  p_days_worked numeric DEFAULT 0, p_hours_worked numeric DEFAULT 0,
  p_basic_pay numeric DEFAULT 0, p_absent_days numeric DEFAULT 0,
  p_absent_deduction numeric DEFAULT 0, p_late_minutes numeric DEFAULT 0,
  p_late_deduction numeric DEFAULT 0, p_undertime_minutes numeric DEFAULT 0,
  p_undertime_deduction numeric DEFAULT 0, p_overtime_hours numeric DEFAULT 0,
  p_overtime_pay numeric DEFAULT 0, p_regular_holiday_hours numeric DEFAULT 0,
  p_regular_holiday_pay numeric DEFAULT 0, p_special_holiday_hours numeric DEFAULT 0,
  p_special_holiday_pay numeric DEFAULT 0, p_night_diff_hours numeric DEFAULT 0,
  p_night_diff_pay numeric DEFAULT 0, p_rest_day_hours numeric DEFAULT 0,
  p_rest_day_pay numeric DEFAULT 0, p_allowance numeric DEFAULT 0,
  p_other_benefits numeric DEFAULT 0, p_de_minimis numeric DEFAULT 0,
  p_thirteenth_month_accrued numeric DEFAULT 0, p_gross_pay numeric DEFAULT 0,
  p_sss_contribution numeric DEFAULT 0, p_philhealth_contribution numeric DEFAULT 0,
  p_pagibig_contribution numeric DEFAULT 0, p_total_contributions numeric DEFAULT 0,
  p_taxable_income numeric DEFAULT 0, p_withholding_tax numeric DEFAULT 0,
  p_sss_loan numeric DEFAULT 0, p_pagibig_loan numeric DEFAULT 0,
  p_cash_advance numeric DEFAULT 0, p_other_deductions numeric DEFAULT 0,
  p_total_deductions numeric DEFAULT 0, p_net_pay numeric DEFAULT 0,
  p_status text DEFAULT 'Draft', p_notes text DEFAULT '',
  p_late_deduction_hrs numeric DEFAULT 0,
  p_employer_contributions_benefit numeric DEFAULT 0
)
  RETURNS SETOF payroll_records
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path TO 'public'
AS $$
DECLARE
  v_record payroll_records;
BEGIN
  INSERT INTO payroll_records (
    company_id, period_id, employee_id,
    basic_salary, daily_rate, days_worked, hours_worked, basic_pay,
    absent_days, absent_deduction,
    late_minutes, late_deduction, undertime_minutes, undertime_deduction,
    overtime_hours, overtime_pay,
    regular_holiday_hours, regular_holiday_pay,
    special_holiday_hours, special_holiday_pay,
    night_diff_hours, night_diff_pay,
    rest_day_hours, rest_day_pay,
    allowance, other_benefits, de_minimis, thirteenth_month_accrued, gross_pay,
    sss_contribution, philhealth_contribution, pagibig_contribution, total_contributions,
    taxable_income, withholding_tax,
    sss_loan, pagibig_loan, cash_advance, other_deductions, total_deductions,
    net_pay, status, notes, employer_contributions_benefit, updated_at
  ) VALUES (
    p_company_id, p_period_id, p_employee_id,
    p_basic_salary, p_daily_rate, p_days_worked, p_hours_worked, p_basic_pay,
    p_absent_days, p_absent_deduction,
    p_late_minutes, p_late_deduction, p_undertime_minutes, p_undertime_deduction,
    p_overtime_hours, p_overtime_pay,
    p_regular_holiday_hours, p_regular_holiday_pay,
    p_special_holiday_hours, p_special_holiday_pay,
    p_night_diff_hours, p_night_diff_pay,
    p_rest_day_hours, p_rest_day_pay,
    p_allowance, p_other_benefits, p_de_minimis, p_thirteenth_month_accrued, p_gross_pay,
    p_sss_contribution, p_philhealth_contribution, p_pagibig_contribution, p_total_contributions,
    p_taxable_income, p_withholding_tax,
    p_sss_loan, p_pagibig_loan, p_cash_advance, p_other_deductions, p_total_deductions,
    p_net_pay, p_status, p_notes, p_employer_contributions_benefit, now()
  )
  ON CONFLICT (period_id, employee_id) DO UPDATE SET
    basic_salary                   = EXCLUDED.basic_salary,
    daily_rate                     = EXCLUDED.daily_rate,
    days_worked                    = EXCLUDED.days_worked,
    hours_worked                   = EXCLUDED.hours_worked,
    basic_pay                      = EXCLUDED.basic_pay,
    absent_days                    = EXCLUDED.absent_days,
    absent_deduction               = EXCLUDED.absent_deduction,
    late_minutes                   = EXCLUDED.late_minutes,
    late_deduction                 = EXCLUDED.late_deduction,
    undertime_minutes              = EXCLUDED.undertime_minutes,
    undertime_deduction            = EXCLUDED.undertime_deduction,
    overtime_hours                 = EXCLUDED.overtime_hours,
    overtime_pay                   = EXCLUDED.overtime_pay,
    regular_holiday_hours          = EXCLUDED.regular_holiday_hours,
    regular_holiday_pay            = EXCLUDED.regular_holiday_pay,
    special_holiday_hours          = EXCLUDED.special_holiday_hours,
    special_holiday_pay            = EXCLUDED.special_holiday_pay,
    night_diff_hours               = EXCLUDED.night_diff_hours,
    night_diff_pay                 = EXCLUDED.night_diff_pay,
    rest_day_hours                 = EXCLUDED.rest_day_hours,
    rest_day_pay                   = EXCLUDED.rest_day_pay,
    allowance                      = EXCLUDED.allowance,
    other_benefits                 = EXCLUDED.other_benefits,
    de_minimis                     = EXCLUDED.de_minimis,
    thirteenth_month_accrued       = EXCLUDED.thirteenth_month_accrued,
    gross_pay                      = EXCLUDED.gross_pay,
    sss_contribution               = EXCLUDED.sss_contribution,
    philhealth_contribution        = EXCLUDED.philhealth_contribution,
    pagibig_contribution           = EXCLUDED.pagibig_contribution,
    total_contributions            = EXCLUDED.total_contributions,
    taxable_income                 = EXCLUDED.taxable_income,
    withholding_tax                = EXCLUDED.withholding_tax,
    sss_loan                       = EXCLUDED.sss_loan,
    pagibig_loan                   = EXCLUDED.pagibig_loan,
    cash_advance                   = EXCLUDED.cash_advance,
    other_deductions               = EXCLUDED.other_deductions,
    total_deductions               = EXCLUDED.total_deductions,
    net_pay                        = EXCLUDED.net_pay,
    status                         = EXCLUDED.status,
    notes                          = EXCLUDED.notes,
    employer_contributions_benefit = EXCLUDED.employer_contributions_benefit,
    updated_at                     = now()
  RETURNING * INTO v_record;

  RETURN NEXT v_record;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_payroll_record(
  uuid, uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, text, text, numeric, numeric
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.upsert_payroll_record(
  uuid, uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, text, text, numeric, numeric
) TO authenticated;
