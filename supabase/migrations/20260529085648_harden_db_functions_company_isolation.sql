/*
  # Harden database functions for company isolation

  ## Issues fixed

  1. upsert_payroll_record — Was SECURITY DEFINER with no caller company validation.
     Any caller could upsert payroll records for any company by supplying any p_company_id.
     Fix: Convert to SECURITY INVOKER so it runs as the caller and is subject to the
     payroll_records RLS policies that already check app.current_company_id.

  2. create_employee_with_account — Accepted p_caller_email as a plain text parameter,
     allowing any caller to impersonate any employer from any company.
     Fix: Ignore p_caller_email parameter and read the caller identity directly from
     current_setting('app.current_user_email') which is set by the session.
     The function remains SECURITY DEFINER to bypass RLS for the insert operations,
     but validates the session-provided email (not the caller-supplied one).

  3. register_employer — Used a global email uniqueness check (across all companies)
     preventing legitimate multi-company accounts. The schema already has a per-company
     unique constraint on (company_id, email). Fix: scope the guard to company_id.
*/

-- ============================================================
-- 1. Convert upsert_payroll_record to SECURITY INVOKER
--    (RLS on payroll_records already enforces company isolation)
-- ============================================================
CREATE OR REPLACE FUNCTION upsert_payroll_record(
  p_company_id uuid,
  p_period_id uuid,
  p_employee_id uuid,
  p_basic_salary numeric DEFAULT 0,
  p_daily_rate numeric DEFAULT 0,
  p_days_worked numeric DEFAULT 0,
  p_hours_worked numeric DEFAULT 0,
  p_basic_pay numeric DEFAULT 0,
  p_absent_days numeric DEFAULT 0,
  p_absent_deduction numeric DEFAULT 0,
  p_late_minutes numeric DEFAULT 0,
  p_late_deduction numeric DEFAULT 0,
  p_undertime_minutes numeric DEFAULT 0,
  p_undertime_deduction numeric DEFAULT 0,
  p_overtime_hours numeric DEFAULT 0,
  p_overtime_pay numeric DEFAULT 0,
  p_regular_holiday_hours numeric DEFAULT 0,
  p_regular_holiday_pay numeric DEFAULT 0,
  p_special_holiday_hours numeric DEFAULT 0,
  p_special_holiday_pay numeric DEFAULT 0,
  p_night_diff_hours numeric DEFAULT 0,
  p_night_diff_pay numeric DEFAULT 0,
  p_rest_day_hours numeric DEFAULT 0,
  p_rest_day_pay numeric DEFAULT 0,
  p_allowance numeric DEFAULT 0,
  p_other_benefits numeric DEFAULT 0,
  p_de_minimis numeric DEFAULT 0,
  p_thirteenth_month_accrued numeric DEFAULT 0,
  p_gross_pay numeric DEFAULT 0,
  p_sss_contribution numeric DEFAULT 0,
  p_philhealth_contribution numeric DEFAULT 0,
  p_pagibig_contribution numeric DEFAULT 0,
  p_total_contributions numeric DEFAULT 0,
  p_taxable_income numeric DEFAULT 0,
  p_withholding_tax numeric DEFAULT 0,
  p_sss_loan numeric DEFAULT 0,
  p_pagibig_loan numeric DEFAULT 0,
  p_cash_advance numeric DEFAULT 0,
  p_other_deductions numeric DEFAULT 0,
  p_total_deductions numeric DEFAULT 0,
  p_net_pay numeric DEFAULT 0,
  p_status text DEFAULT 'Draft',
  p_notes text DEFAULT '',
  p_late_deduction_hrs numeric DEFAULT 0,
  p_employer_contributions_benefit numeric DEFAULT 0
)
RETURNS SETOF payroll_records
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_record payroll_records;
BEGIN
  -- Verify caller belongs to the company they are writing payroll for
  IF NOT EXISTS (
    SELECT 1 FROM user_accounts
    WHERE email = current_setting('app.current_user_email', true)
      AND company_id = p_company_id
      AND role = 'employer'
  ) THEN
    RAISE EXCEPTION 'Permission denied: caller is not an employer of this company';
  END IF;

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

GRANT EXECUTE ON FUNCTION upsert_payroll_record TO anon, authenticated;

-- ============================================================
-- 2. Fix create_employee_with_account — read caller from session, not parameter
--    Keep SECURITY DEFINER so it can INSERT bypassing RLS, but validate via session var.
-- ============================================================
CREATE OR REPLACE FUNCTION create_employee_with_account(
  p_caller_email text,  -- kept for API compatibility but ignored; session var used instead
  p_company_id uuid,
  p_employee_id text,
  p_email text,
  p_first_name text,
  p_last_name text,
  p_role text,
  p_department text,
  p_password_hash text,
  p_phone text DEFAULT NULL,
  p_position text DEFAULT NULL,
  p_shift_id uuid DEFAULT NULL,
  p_date_hired date DEFAULT CURRENT_DATE,
  p_salary numeric DEFAULT 0,
  p_employment_type text DEFAULT 'full-time'
)
RETURNS employees
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_email   text;
  v_caller_role     text;
  v_caller_company  uuid;
  v_new_employee    employees;
BEGIN
  -- Read caller identity from session variable — NOT from the supplied parameter
  v_session_email := current_setting('app.current_user_email', true);

  IF v_session_email IS NULL OR v_session_email = '' THEN
    RAISE EXCEPTION 'No authenticated session found';
  END IF;

  SELECT role, company_id
  INTO v_caller_role, v_caller_company
  FROM user_accounts
  WHERE email = v_session_email
  LIMIT 1;

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Caller not found: %', v_session_email;
  END IF;

  IF v_caller_role != 'employer' THEN
    RAISE EXCEPTION 'Permission denied: caller is not an employer';
  END IF;

  IF v_caller_company != p_company_id THEN
    RAISE EXCEPTION 'Permission denied: company mismatch';
  END IF;

  -- Check for duplicate email in this company
  IF EXISTS (
    SELECT 1 FROM user_accounts
    WHERE email = p_email AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_EMAIL: An employee with this email already exists in your company.';
  END IF;

  -- Insert employee
  INSERT INTO employees (
    company_id, employee_id, email, first_name, last_name,
    role, department, phone, position, shift_id,
    date_hired, salary, employment_type, status
  )
  VALUES (
    p_company_id, p_employee_id, p_email, p_first_name, p_last_name,
    p_role, p_department, p_phone, p_position, p_shift_id,
    p_date_hired, p_salary, p_employment_type, 'active'
  )
  RETURNING * INTO v_new_employee;

  -- Insert user account
  INSERT INTO user_accounts (
    company_id, employee_id, email, password_hash, role
  )
  VALUES (
    p_company_id, v_new_employee.id, p_email, p_password_hash, 'employee'
  );

  RETURN v_new_employee;
END;
$$;

GRANT EXECUTE ON FUNCTION create_employee_with_account TO anon, authenticated;

-- ============================================================
-- 3. Fix register_employer — scope email uniqueness check to company_id, not global
-- ============================================================
CREATE OR REPLACE FUNCTION register_employer(
  p_company_code   text,
  p_company_name   text,
  p_first_name     text,
  p_last_name      text,
  p_email          text,
  p_password_hash  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company        companies;
  v_morning_shift  shifts;
  v_employee       employees;
  v_employee_id    text;
  v_max_num        int;
BEGIN
  -- Guard: company code must be unique
  IF EXISTS (SELECT 1 FROM companies WHERE company_code = p_company_code) THEN
    RAISE EXCEPTION 'DUPLICATE_COMPANY_CODE: Company code already exists. Please choose a different code.';
  END IF;

  -- 1. Create company
  INSERT INTO companies (company_code, name, work_schedule)
  VALUES (p_company_code, p_company_name, 'Monday to Friday')
  RETURNING * INTO v_company;

  -- Guard: email must not already exist within THIS company (after company is created)
  -- (schema constraint is UNIQUE(company_id, email) so global check is not needed)
  IF EXISTS (
    SELECT 1 FROM user_accounts
    WHERE email = p_email AND company_id = v_company.id
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_EMAIL: An account with this email already exists in this company.';
  END IF;

  -- 2. Create default shifts
  INSERT INTO shifts (company_id, name, start_time, end_time)
  VALUES (v_company.id, 'Morning Shift', '09:00', '18:00')
  RETURNING * INTO v_morning_shift;

  INSERT INTO shifts (company_id, name, start_time, end_time)
  VALUES (v_company.id, 'Night Shift', '22:00', '07:00');

  -- 3. Generate sequential employee ID
  SELECT COALESCE(MAX(
    CASE WHEN employee_id ~ '^EMP-[0-9]+$'
         THEN (regexp_replace(employee_id, '^EMP-', ''))::int
         ELSE 0 END
  ), 0)
  INTO v_max_num
  FROM employees
  WHERE company_id = v_company.id;

  v_employee_id := 'EMP-' || lpad((v_max_num + 1)::text, 5, '0');

  -- 4. Create employer's employee record
  INSERT INTO employees (
    company_id, employee_id, email, first_name, last_name,
    department, date_hired, status, employment_type,
    shift_id, work_schedule
  )
  VALUES (
    v_company.id, v_employee_id, p_email, p_first_name, p_last_name,
    'Management', CURRENT_DATE, 'Active', 'full-time',
    v_morning_shift.id, 'Monday to Friday'
  )
  RETURNING * INTO v_employee;

  -- 5. Create salary history
  INSERT INTO salary_history (employee_id, effective_date, basic_salary, allowance, other_benefits)
  VALUES (v_employee.id, CURRENT_DATE, 50000, 0, 0);

  -- 6. Create user account
  INSERT INTO user_accounts (company_id, employee_id, email, password_hash, role)
  VALUES (v_company.id, v_employee.id, p_email, p_password_hash, 'employer');

  -- 7. Create default leave policy
  INSERT INTO leave_policies (
    company_id, base_vacation_days_per_year, base_sick_days_per_year,
    tenure_bonus_enabled, tenure_bonus_years_interval, max_tenure_bonus_days
  )
  VALUES (v_company.id, 15, 10, true, 2, 5);

  RETURN jsonb_build_object(
    'company_id',   v_company.id,
    'employee_id',  v_employee.id,
    'employee_num', v_employee_id,
    'email',        p_email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION register_employer TO anon, authenticated;
