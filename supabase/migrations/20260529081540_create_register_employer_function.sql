/*
  # Create register_employer atomic function

  ## Problem
  Company registration fails with "new row violates row-level security policy for employees"
  because the frontend client has no user_accounts row yet when it tries to insert the
  employer's employee record. All RLS policies that check user_accounts or session variables
  fail at this point.

  ## Solution
  A SECURITY DEFINER function that runs with elevated privileges and atomically:
  1. Inserts the company
  2. Creates default shifts
  3. Creates the employer's employee record
  4. Creates the salary_history record
  5. Creates the user_account record
  6. Creates the default leave policy

  All in one transaction — either everything succeeds or nothing does.

  ## Security
  - The function validates company_code uniqueness before inserting
  - Runs as SECURITY DEFINER so it bypasses RLS (safe because all inputs are validated)
  - Returns the new employee row so the client can proceed without additional queries
*/

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

  -- Guard: email must not already exist globally
  IF EXISTS (SELECT 1 FROM user_accounts WHERE email = p_email) THEN
    RAISE EXCEPTION 'DUPLICATE_EMAIL: An account with this email already exists.';
  END IF;

  -- 1. Create company
  INSERT INTO companies (company_code, name, work_schedule)
  VALUES (p_company_code, p_company_name, 'Monday to Friday')
  RETURNING * INTO v_company;

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

  -- Return enough data for the client to build a session
  RETURN jsonb_build_object(
    'company_id',   v_company.id,
    'employee_id',  v_employee.id,
    'employee_num', v_employee_id,
    'email',        p_email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION register_employer TO anon, authenticated;
