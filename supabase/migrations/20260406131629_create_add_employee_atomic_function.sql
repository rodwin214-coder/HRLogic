/*
  # Create atomic employee + user_account creation function

  ## Problem
  The client-side code calls `set_config` to set `app.current_user_email` and then
  runs a separate INSERT for `user_accounts`. Because Supabase uses a connection pool,
  these two operations may land on different sessions, causing `get_current_user_role()`
  to return NULL and the RLS INSERT policy to silently reject the user_account insert.

  ## Solution
  Create a SECURITY DEFINER function that:
  1. Verifies the caller is an employer for the given company
  2. Creates the employee record
  3. Creates the user_account record
  All within a single atomic transaction, bypassing the per-session config issue.

  ## New Functions
  - `create_employee_with_account(...)` - atomically creates employee + user_account,
    returns the new employee row. Caller must pass their email for validation.
*/

CREATE OR REPLACE FUNCTION create_employee_with_account(
  p_caller_email text,
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
  v_caller_role text;
  v_caller_company_id uuid;
  v_new_employee employees;
BEGIN
  -- Verify caller exists and is an employer for this company
  SELECT role, company_id
  INTO v_caller_role, v_caller_company_id
  FROM user_accounts
  WHERE email = p_caller_email
  LIMIT 1;

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Caller not found: %', p_caller_email;
  END IF;

  IF v_caller_role != 'employer' THEN
    RAISE EXCEPTION 'Permission denied: caller is not an employer';
  END IF;

  IF v_caller_company_id != p_company_id THEN
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
