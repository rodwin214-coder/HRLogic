/*
  # Add other_benefits column to payroll_records

  ## Summary
  Adds a dedicated `other_benefits` column to `payroll_records` so that
  the "Other Benefits" salary component is tracked separately from `de_minimis`
  and is properly included in gross pay.

  ## Changes
  - `payroll_records`: new column `other_benefits numeric DEFAULT 0`
  - Drops old `upsert_payroll_record` overloads and recreates with new parameter
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_records' AND column_name = 'other_benefits'
  ) THEN
    ALTER TABLE payroll_records ADD COLUMN other_benefits numeric DEFAULT 0;
  END IF;
END $$;

-- Drop all overloads of the old function
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT oid::regprocedure::text AS sig
    FROM pg_proc
    WHERE proname = 'upsert_payroll_record'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END $$;

-- Recreate upsert function with other_benefits parameter
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
  p_other_benefits           numeric DEFAULT 0,
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
    allowance, other_benefits, de_minimis, thirteenth_month_accrued, gross_pay,
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
    p_allowance, p_other_benefits, p_de_minimis, p_thirteenth_month_accrued, p_gross_pay,
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
    other_benefits           = EXCLUDED.other_benefits,
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

GRANT EXECUTE ON FUNCTION upsert_payroll_record TO anon, authenticated;
