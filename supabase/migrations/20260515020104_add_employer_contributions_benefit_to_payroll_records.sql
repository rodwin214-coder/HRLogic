/*
  # Add employer_contributions_benefit to payroll_records

  ## Summary
  When a company shoulders employee government contributions, the contribution
  amount is added to gross pay as a benefit (so it appears as a positive line
  item) and then deducted normally, leaving net pay = gross - tax only.

  ## Changes
  - `payroll_records`: new column `employer_contributions_benefit numeric DEFAULT 0`
    Stores the total SSS + PhilHealth + Pag-IBIG that the employer covers on
    behalf of the employee. Added to gross pay; contributions still deducted
    normally so they cancel out.

  ## Upsert function
  Recreated `upsert_payroll_record` with the new parameter so records persist
  the benefit amount correctly.
*/

-- Add column if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_records' AND column_name = 'employer_contributions_benefit'
  ) THEN
    ALTER TABLE payroll_records ADD COLUMN employer_contributions_benefit numeric(12,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Recreate upsert function with the new parameter
CREATE OR REPLACE FUNCTION upsert_payroll_record(
  p_company_id                   uuid,
  p_period_id                    uuid,
  p_employee_id                  uuid,
  p_basic_salary                 numeric DEFAULT 0,
  p_daily_rate                   numeric DEFAULT 0,
  p_days_worked                  numeric DEFAULT 0,
  p_hours_worked                 numeric DEFAULT 0,
  p_basic_pay                    numeric DEFAULT 0,
  p_absent_days                  numeric DEFAULT 0,
  p_absent_deduction             numeric DEFAULT 0,
  p_late_minutes                 numeric DEFAULT 0,
  p_late_deduction               numeric DEFAULT 0,
  p_undertime_minutes            numeric DEFAULT 0,
  p_undertime_deduction          numeric DEFAULT 0,
  p_overtime_hours               numeric DEFAULT 0,
  p_overtime_pay                 numeric DEFAULT 0,
  p_regular_holiday_hours        numeric DEFAULT 0,
  p_regular_holiday_pay          numeric DEFAULT 0,
  p_special_holiday_hours        numeric DEFAULT 0,
  p_special_holiday_pay          numeric DEFAULT 0,
  p_night_diff_hours             numeric DEFAULT 0,
  p_night_diff_pay               numeric DEFAULT 0,
  p_rest_day_hours               numeric DEFAULT 0,
  p_rest_day_pay                 numeric DEFAULT 0,
  p_allowance                    numeric DEFAULT 0,
  p_other_benefits               numeric DEFAULT 0,
  p_de_minimis                   numeric DEFAULT 0,
  p_thirteenth_month_accrued     numeric DEFAULT 0,
  p_gross_pay                    numeric DEFAULT 0,
  p_sss_contribution             numeric DEFAULT 0,
  p_philhealth_contribution      numeric DEFAULT 0,
  p_pagibig_contribution         numeric DEFAULT 0,
  p_total_contributions          numeric DEFAULT 0,
  p_taxable_income               numeric DEFAULT 0,
  p_withholding_tax              numeric DEFAULT 0,
  p_sss_loan                     numeric DEFAULT 0,
  p_pagibig_loan                 numeric DEFAULT 0,
  p_cash_advance                 numeric DEFAULT 0,
  p_other_deductions             numeric DEFAULT 0,
  p_total_deductions             numeric DEFAULT 0,
  p_net_pay                      numeric DEFAULT 0,
  p_notes                        text    DEFAULT '',
  p_late_deduction_hrs           numeric DEFAULT 0,
  p_employer_contributions_benefit numeric DEFAULT 0
)
RETURNS SETOF payroll_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    net_pay, notes, employer_contributions_benefit, updated_at
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
    p_net_pay, p_notes, p_employer_contributions_benefit, now()
  )
  ON CONFLICT (period_id, employee_id) DO UPDATE SET
    basic_salary                  = EXCLUDED.basic_salary,
    daily_rate                    = EXCLUDED.daily_rate,
    days_worked                   = EXCLUDED.days_worked,
    hours_worked                  = EXCLUDED.hours_worked,
    basic_pay                     = EXCLUDED.basic_pay,
    absent_days                   = EXCLUDED.absent_days,
    absent_deduction              = EXCLUDED.absent_deduction,
    late_minutes                  = EXCLUDED.late_minutes,
    late_deduction                = EXCLUDED.late_deduction,
    undertime_minutes             = EXCLUDED.undertime_minutes,
    undertime_deduction           = EXCLUDED.undertime_deduction,
    overtime_hours                = EXCLUDED.overtime_hours,
    overtime_pay                  = EXCLUDED.overtime_pay,
    regular_holiday_hours         = EXCLUDED.regular_holiday_hours,
    regular_holiday_pay           = EXCLUDED.regular_holiday_pay,
    special_holiday_hours         = EXCLUDED.special_holiday_hours,
    special_holiday_pay           = EXCLUDED.special_holiday_pay,
    night_diff_hours              = EXCLUDED.night_diff_hours,
    night_diff_pay                = EXCLUDED.night_diff_pay,
    rest_day_hours                = EXCLUDED.rest_day_hours,
    rest_day_pay                  = EXCLUDED.rest_day_pay,
    allowance                     = EXCLUDED.allowance,
    other_benefits                = EXCLUDED.other_benefits,
    de_minimis                    = EXCLUDED.de_minimis,
    thirteenth_month_accrued      = EXCLUDED.thirteenth_month_accrued,
    gross_pay                     = EXCLUDED.gross_pay,
    sss_contribution              = EXCLUDED.sss_contribution,
    philhealth_contribution       = EXCLUDED.philhealth_contribution,
    pagibig_contribution          = EXCLUDED.pagibig_contribution,
    total_contributions           = EXCLUDED.total_contributions,
    taxable_income                = EXCLUDED.taxable_income,
    withholding_tax               = EXCLUDED.withholding_tax,
    sss_loan                      = EXCLUDED.sss_loan,
    pagibig_loan                  = EXCLUDED.pagibig_loan,
    cash_advance                  = EXCLUDED.cash_advance,
    other_deductions              = EXCLUDED.other_deductions,
    total_deductions              = EXCLUDED.total_deductions,
    net_pay                       = EXCLUDED.net_pay,
    notes                         = EXCLUDED.notes,
    employer_contributions_benefit = EXCLUDED.employer_contributions_benefit,
    updated_at                    = now()
  RETURNING * INTO v_record;
  RETURN NEXT v_record;
END;
$$;
