/*
  # Fix Payroll RLS with Atomic DB Functions

  ## Problem
  The Supabase JS client sends each query as a separate HTTP request, meaning
  each query runs in its own DB transaction. `set_config('app.current_company_id')`
  called via RPC sets the value in one transaction; the subsequent INSERT/UPDATE
  runs in a new transaction where current_setting returns '' (empty string).

  The UPDATE policy uses `company_id = current_setting(...)` which evaluates to
  false, causing upsert to fail.

  ## Solution
  Create security-definer functions that set the config and execute the write
  in a single transaction. Also fix INSERT policies to match the same
  current_setting pattern as SELECT/UPDATE/DELETE.

  ## Functions Created
  - `upsert_payroll_period(...)` — creates or updates a payroll period
  - `upsert_payroll_record(...)` — creates or updates a payroll record
  - `update_payroll_period_status(...)` — updates period status
*/

-- Fix INSERT policy for payroll_periods to match other policies
DROP POLICY IF EXISTS "Employers insert payroll periods" ON payroll_periods;
CREATE POLICY "Employers insert payroll periods"
  ON payroll_periods FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (company_id)::text = current_setting('app.current_company_id'::text, true)
  );

-- Fix INSERT policy for payroll_records to match other policies
DROP POLICY IF EXISTS "Employers insert payroll records" ON payroll_records;
CREATE POLICY "Employers insert payroll records"
  ON payroll_records FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (company_id)::text = current_setting('app.current_company_id'::text, true)
  );

-- Atomic function: create a payroll period (sets config + inserts in one transaction)
CREATE OR REPLACE FUNCTION create_payroll_period(
  p_company_id      uuid,
  p_period_name     text,
  p_pay_frequency   text,
  p_period_start    date,
  p_period_end      date,
  p_pay_date        date,
  p_notes           text DEFAULT ''
)
RETURNS payroll_periods
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result payroll_periods;
BEGIN
  PERFORM set_config('app.current_company_id', p_company_id::text, true);
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

-- Atomic function: upsert a payroll record
CREATE OR REPLACE FUNCTION upsert_payroll_record(
  p_company_id               uuid,
  p_period_id                uuid,
  p_employee_id              uuid,
  p_basic_salary             numeric,
  p_daily_rate               numeric,
  p_days_worked              numeric,
  p_hours_worked             numeric,
  p_basic_pay                numeric,
  p_absent_days              numeric DEFAULT 0,
  p_absent_deduction         numeric DEFAULT 0,
  p_late_minutes             numeric DEFAULT 0,
  p_late_deduction           numeric DEFAULT 0,
  p_undertime_minutes        numeric DEFAULT 0,
  p_undertime_deduction      numeric DEFAULT 0,
  p_overtime_hours           numeric DEFAULT 0,
  p_overtime_pay             numeric DEFAULT 0,
  p_regular_holiday_hours    numeric DEFAULT 0,
  p_regular_holiday_pay      numeric DEFAULT 0,
  p_special_holiday_hours    numeric DEFAULT 0,
  p_special_holiday_pay      numeric DEFAULT 0,
  p_night_diff_hours         numeric DEFAULT 0,
  p_night_diff_pay           numeric DEFAULT 0,
  p_rest_day_hours           numeric DEFAULT 0,
  p_rest_day_pay             numeric DEFAULT 0,
  p_allowance                numeric DEFAULT 0,
  p_de_minimis               numeric DEFAULT 0,
  p_thirteenth_month_accrued numeric DEFAULT 0,
  p_gross_pay                numeric DEFAULT 0,
  p_sss_contribution         numeric DEFAULT 0,
  p_philhealth_contribution  numeric DEFAULT 0,
  p_pagibig_contribution     numeric DEFAULT 0,
  p_total_contributions      numeric DEFAULT 0,
  p_taxable_income           numeric DEFAULT 0,
  p_withholding_tax          numeric DEFAULT 0,
  p_sss_loan                 numeric DEFAULT 0,
  p_pagibig_loan             numeric DEFAULT 0,
  p_cash_advance             numeric DEFAULT 0,
  p_other_deductions         numeric DEFAULT 0,
  p_total_deductions         numeric DEFAULT 0,
  p_net_pay                  numeric DEFAULT 0,
  p_status                   text    DEFAULT 'Draft',
  p_notes                    text    DEFAULT ''
)
RETURNS payroll_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result payroll_records;
BEGIN
  PERFORM set_config('app.current_company_id', p_company_id::text, true);
  INSERT INTO payroll_records (
    company_id, period_id, employee_id,
    basic_salary, daily_rate, days_worked, hours_worked, basic_pay,
    absent_days, absent_deduction, late_minutes, late_deduction,
    undertime_minutes, undertime_deduction,
    overtime_hours, overtime_pay,
    regular_holiday_hours, regular_holiday_pay,
    special_holiday_hours, special_holiday_pay,
    night_diff_hours, night_diff_pay,
    rest_day_hours, rest_day_pay,
    allowance, de_minimis, thirteenth_month_accrued, gross_pay,
    sss_contribution, philhealth_contribution, pagibig_contribution,
    total_contributions, taxable_income, withholding_tax,
    sss_loan, pagibig_loan, cash_advance, other_deductions,
    total_deductions, net_pay, status, notes
  ) VALUES (
    p_company_id, p_period_id, p_employee_id,
    p_basic_salary, p_daily_rate, p_days_worked, p_hours_worked, p_basic_pay,
    p_absent_days, p_absent_deduction, p_late_minutes, p_late_deduction,
    p_undertime_minutes, p_undertime_deduction,
    p_overtime_hours, p_overtime_pay,
    p_regular_holiday_hours, p_regular_holiday_pay,
    p_special_holiday_hours, p_special_holiday_pay,
    p_night_diff_hours, p_night_diff_pay,
    p_rest_day_hours, p_rest_day_pay,
    p_allowance, p_de_minimis, p_thirteenth_month_accrued, p_gross_pay,
    p_sss_contribution, p_philhealth_contribution, p_pagibig_contribution,
    p_total_contributions, p_taxable_income, p_withholding_tax,
    p_sss_loan, p_pagibig_loan, p_cash_advance, p_other_deductions,
    p_total_deductions, p_net_pay, p_status, p_notes
  )
  ON CONFLICT (period_id, employee_id) DO UPDATE SET
    basic_salary             = EXCLUDED.basic_salary,
    daily_rate               = EXCLUDED.daily_rate,
    days_worked              = EXCLUDED.days_worked,
    hours_worked             = EXCLUDED.hours_worked,
    basic_pay                = EXCLUDED.basic_pay,
    absent_days              = EXCLUDED.absent_days,
    absent_deduction         = EXCLUDED.absent_deduction,
    late_minutes             = EXCLUDED.late_minutes,
    late_deduction           = EXCLUDED.late_deduction,
    undertime_minutes        = EXCLUDED.undertime_minutes,
    undertime_deduction      = EXCLUDED.undertime_deduction,
    overtime_hours           = EXCLUDED.overtime_hours,
    overtime_pay             = EXCLUDED.overtime_pay,
    regular_holiday_hours    = EXCLUDED.regular_holiday_hours,
    regular_holiday_pay      = EXCLUDED.regular_holiday_pay,
    special_holiday_hours    = EXCLUDED.special_holiday_hours,
    special_holiday_pay      = EXCLUDED.special_holiday_pay,
    night_diff_hours         = EXCLUDED.night_diff_hours,
    night_diff_pay           = EXCLUDED.night_diff_pay,
    rest_day_hours           = EXCLUDED.rest_day_hours,
    rest_day_pay             = EXCLUDED.rest_day_pay,
    allowance                = EXCLUDED.allowance,
    de_minimis               = EXCLUDED.de_minimis,
    thirteenth_month_accrued = EXCLUDED.thirteenth_month_accrued,
    gross_pay                = EXCLUDED.gross_pay,
    sss_contribution         = EXCLUDED.sss_contribution,
    philhealth_contribution  = EXCLUDED.philhealth_contribution,
    pagibig_contribution     = EXCLUDED.pagibig_contribution,
    total_contributions      = EXCLUDED.total_contributions,
    taxable_income           = EXCLUDED.taxable_income,
    withholding_tax          = EXCLUDED.withholding_tax,
    sss_loan                 = EXCLUDED.sss_loan,
    pagibig_loan             = EXCLUDED.pagibig_loan,
    cash_advance             = EXCLUDED.cash_advance,
    other_deductions         = EXCLUDED.other_deductions,
    total_deductions         = EXCLUDED.total_deductions,
    net_pay                  = EXCLUDED.net_pay,
    status                   = EXCLUDED.status,
    notes                    = EXCLUDED.notes,
    updated_at               = now()
  RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

-- Atomic function: update period status
CREATE OR REPLACE FUNCTION update_payroll_period_status(
  p_period_id  uuid,
  p_company_id uuid,
  p_status     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.current_company_id', p_company_id::text, true);
  UPDATE payroll_periods
  SET status = p_status
  WHERE id = p_period_id AND company_id = p_company_id;
END;
$$;

-- Atomic function: delete payroll period
CREATE OR REPLACE FUNCTION delete_payroll_period(
  p_period_id  uuid,
  p_company_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.current_company_id', p_company_id::text, true);
  DELETE FROM payroll_periods WHERE id = p_period_id AND company_id = p_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_payroll_period TO anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_payroll_record TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_payroll_period_status TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_payroll_period TO anon, authenticated;
