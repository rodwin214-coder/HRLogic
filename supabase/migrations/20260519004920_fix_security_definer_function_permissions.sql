/*
  # Fix SECURITY DEFINER Function Permissions

  ## Summary
  Revokes public/anon execute access from all SECURITY DEFINER functions that
  should only be callable by authenticated (employer) users. This prevents
  anonymous users from invoking privileged database operations via the REST API.

  ## Changes

  ### Payroll Functions — revoke anon, keep authenticated
  - create_payroll_period
  - update_payroll_period_status
  - delete_payroll_period
  - upsert_payroll_record
  - get_payroll_adjustments
  - add_payroll_adjustment

  ### Employee Function — revoke anon, keep authenticated
  - create_employee_with_account (called via edge function by authenticated employer)

  ### Helper Functions — restrict to authenticated only
  - get_current_user_company_id
  - get_current_user_role

  ### set_config — intentionally kept accessible to anon
  The login flow runs as anon before credentials are verified and must call
  set_config to set app.current_user_email and app.current_company_id for
  RLS policies to function. No change is made to this function.

  ## Security Impact
  Anonymous users can no longer invoke any payroll or employee management
  functions directly via the REST API.
*/

-- Revoke anon from payroll period functions
REVOKE EXECUTE ON FUNCTION public.create_payroll_period(p_company_id uuid, p_period_name text, p_pay_frequency text, p_period_start date, p_period_end date, p_pay_date date, p_notes text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_payroll_period_status(p_period_id uuid, p_company_id uuid, p_status text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_payroll_period(p_period_id uuid, p_company_id uuid) FROM anon;

-- Revoke anon from payroll record functions
REVOKE EXECUTE ON FUNCTION public.get_payroll_adjustments(p_company_id uuid, p_period_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_payroll_adjustment(p_company_id uuid, p_period_id uuid, p_employee_id uuid, p_adjustment_type text, p_amount numeric, p_description text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_payroll_record(
  p_company_id uuid, p_period_id uuid, p_employee_id uuid,
  p_basic_salary numeric, p_daily_rate numeric, p_days_worked numeric, p_hours_worked numeric,
  p_basic_pay numeric, p_absent_days numeric, p_absent_deduction numeric,
  p_late_minutes numeric, p_late_deduction numeric, p_undertime_minutes numeric, p_undertime_deduction numeric,
  p_overtime_hours numeric, p_overtime_pay numeric,
  p_regular_holiday_hours numeric, p_regular_holiday_pay numeric,
  p_special_holiday_hours numeric, p_special_holiday_pay numeric,
  p_night_diff_hours numeric, p_night_diff_pay numeric,
  p_rest_day_hours numeric, p_rest_day_pay numeric,
  p_allowance numeric, p_other_benefits numeric, p_de_minimis numeric,
  p_thirteenth_month_accrued numeric,
  p_gross_pay numeric, p_sss_contribution numeric, p_philhealth_contribution numeric,
  p_pagibig_contribution numeric, p_total_contributions numeric, p_taxable_income numeric,
  p_withholding_tax numeric, p_sss_loan numeric, p_pagibig_loan numeric,
  p_cash_advance numeric, p_other_deductions numeric, p_total_deductions numeric,
  p_net_pay numeric, p_status text, p_notes text,
  p_late_deduction_hrs numeric, p_employer_contributions_benefit numeric
) FROM anon;

-- Revoke anon from employee management function
REVOKE EXECUTE ON FUNCTION public.create_employee_with_account(
  p_caller_email text, p_company_id uuid, p_employee_id text, p_email text,
  p_first_name text, p_last_name text, p_role text, p_department text,
  p_password_hash text, p_phone text, p_position text, p_shift_id uuid,
  p_date_hired date, p_salary numeric, p_employment_type text
) FROM anon;

-- Revoke anon from internal helper functions
REVOKE EXECUTE ON FUNCTION public.get_current_user_company_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_current_user_role() FROM anon;

-- Ensure authenticated role retains access to all functions it legitimately needs
GRANT EXECUTE ON FUNCTION public.create_payroll_period(p_company_id uuid, p_period_name text, p_pay_frequency text, p_period_start date, p_period_end date, p_pay_date date, p_notes text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_payroll_period_status(p_period_id uuid, p_company_id uuid, p_status text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_payroll_period(p_period_id uuid, p_company_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payroll_adjustments(p_company_id uuid, p_period_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_payroll_adjustment(p_company_id uuid, p_period_id uuid, p_employee_id uuid, p_adjustment_type text, p_amount numeric, p_description text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_payroll_record(
  p_company_id uuid, p_period_id uuid, p_employee_id uuid,
  p_basic_salary numeric, p_daily_rate numeric, p_days_worked numeric, p_hours_worked numeric,
  p_basic_pay numeric, p_absent_days numeric, p_absent_deduction numeric,
  p_late_minutes numeric, p_late_deduction numeric, p_undertime_minutes numeric, p_undertime_deduction numeric,
  p_overtime_hours numeric, p_overtime_pay numeric,
  p_regular_holiday_hours numeric, p_regular_holiday_pay numeric,
  p_special_holiday_hours numeric, p_special_holiday_pay numeric,
  p_night_diff_hours numeric, p_night_diff_pay numeric,
  p_rest_day_hours numeric, p_rest_day_pay numeric,
  p_allowance numeric, p_other_benefits numeric, p_de_minimis numeric,
  p_thirteenth_month_accrued numeric,
  p_gross_pay numeric, p_sss_contribution numeric, p_philhealth_contribution numeric,
  p_pagibig_contribution numeric, p_total_contributions numeric, p_taxable_income numeric,
  p_withholding_tax numeric, p_sss_loan numeric, p_pagibig_loan numeric,
  p_cash_advance numeric, p_other_deductions numeric, p_total_deductions numeric,
  p_net_pay numeric, p_status text, p_notes text,
  p_late_deduction_hrs numeric, p_employer_contributions_benefit numeric
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_employee_with_account(
  p_caller_email text, p_company_id uuid, p_employee_id text, p_email text,
  p_first_name text, p_last_name text, p_role text, p_department text,
  p_password_hash text, p_phone text, p_position text, p_shift_id uuid,
  p_date_hired date, p_salary numeric, p_employment_type text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;
