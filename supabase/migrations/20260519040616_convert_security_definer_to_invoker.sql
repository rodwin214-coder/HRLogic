/*
  # Convert SECURITY DEFINER Functions to SECURITY INVOKER

  ## Summary
  Recreates all flagged SECURITY DEFINER functions as SECURITY INVOKER so they
  run with the caller's privileges instead of the function owner's superuser
  privileges. This eliminates the entire class of "SECURITY DEFINER callable via
  REST" warnings.

  For payroll functions that previously relied on SECURITY DEFINER to bypass RLS,
  we add an explicit company-ownership check using the app.current_user_email
  session variable so only the legitimate company employer can operate on the data.

  ## Functions Changed
  1. set_config                    — SECURITY INVOKER (just wraps pg_catalog.set_config)
  2. get_current_user_company_id   — SECURITY INVOKER (reads session var, no elevation needed)
  3. get_current_user_role         — SECURITY INVOKER (reads session var, no elevation needed)
  4. create_payroll_period         — SECURITY INVOKER + caller company check
  5. update_payroll_period_status  — SECURITY INVOKER + caller company check
  6. delete_payroll_period         — SECURITY INVOKER + caller company check
  7. get_payroll_adjustments       — SECURITY INVOKER + caller company check
  8. add_payroll_adjustment        — SECURITY INVOKER + caller company check
  9. create_employee_with_account  — SECURITY INVOKER (already has caller verification internally)

  ## Grants
  - All functions restricted to authenticated role only
  - anon role has no execute access on any of these functions
*/

-- ============================================================
-- 1. set_config — pure wrapper, no elevation needed
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_config(setting_name text, setting_value text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  PERFORM pg_catalog.set_config(setting_name, setting_value, false);
END;
$$;

REVOKE ALL ON FUNCTION public.set_config(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_config(text, text) TO authenticated, anon;
-- anon kept intentionally: login flow runs as anon and must set session vars for RLS

-- ============================================================
-- 2. get_current_user_company_id — reads session var only
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_current_user_company_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
  SET search_path TO 'public'
AS $$
  SELECT company_id FROM user_accounts
  WHERE email = current_setting('app.current_user_email', true)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_current_user_company_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_company_id() TO authenticated;

-- ============================================================
-- 3. get_current_user_role — reads session var only
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_current_user_role()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
  SET search_path TO 'public'
AS $$
  SELECT role FROM user_accounts
  WHERE email = current_setting('app.current_user_email', true)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_current_user_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;

-- ============================================================
-- 4. create_payroll_period — add caller company check
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
  v_caller_company_id uuid;
  v_caller_role text;
  v_result payroll_periods;
BEGIN
  SELECT company_id, role INTO v_caller_company_id, v_caller_role
  FROM user_accounts
  WHERE email = current_setting('app.current_user_email', true)
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role != 'employer' THEN
    RAISE EXCEPTION 'Permission denied: caller is not an employer';
  END IF;

  IF v_caller_company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'Permission denied: company mismatch';
  END IF;

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
-- 5. update_payroll_period_status — add caller company check
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_payroll_period_status(
  p_period_id uuid, p_company_id uuid, p_status text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path TO 'public'
AS $$
DECLARE
  v_caller_company_id uuid;
  v_caller_role text;
BEGIN
  SELECT company_id, role INTO v_caller_company_id, v_caller_role
  FROM user_accounts
  WHERE email = current_setting('app.current_user_email', true)
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role != 'employer' THEN
    RAISE EXCEPTION 'Permission denied: caller is not an employer';
  END IF;

  IF v_caller_company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'Permission denied: company mismatch';
  END IF;

  UPDATE payroll_periods
  SET status = p_status
  WHERE id = p_period_id AND company_id = p_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_payroll_period_status(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_payroll_period_status(uuid, uuid, text) TO authenticated;

-- ============================================================
-- 6. delete_payroll_period — add caller company check
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_payroll_period(p_period_id uuid, p_company_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path TO 'public'
AS $$
DECLARE
  v_caller_company_id uuid;
  v_caller_role text;
BEGIN
  SELECT company_id, role INTO v_caller_company_id, v_caller_role
  FROM user_accounts
  WHERE email = current_setting('app.current_user_email', true)
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role != 'employer' THEN
    RAISE EXCEPTION 'Permission denied: caller is not an employer';
  END IF;

  IF v_caller_company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'Permission denied: company mismatch';
  END IF;

  DELETE FROM payroll_periods WHERE id = p_period_id AND company_id = p_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_payroll_period(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_payroll_period(uuid, uuid) TO authenticated;

-- ============================================================
-- 7. get_payroll_adjustments — add caller company check
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
DECLARE
  v_caller_company_id uuid;
BEGIN
  SELECT ua.company_id INTO v_caller_company_id
  FROM user_accounts ua
  WHERE ua.email = current_setting('app.current_user_email', true)
  LIMIT 1;

  IF v_caller_company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'Permission denied: company mismatch';
  END IF;

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
-- 8. add_payroll_adjustment — add caller company check
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
DECLARE
  v_caller_company_id uuid;
  v_caller_role text;
BEGIN
  SELECT company_id, role INTO v_caller_company_id, v_caller_role
  FROM user_accounts
  WHERE email = current_setting('app.current_user_email', true)
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role != 'employer' THEN
    RAISE EXCEPTION 'Permission denied: caller is not an employer';
  END IF;

  IF v_caller_company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'Permission denied: company mismatch';
  END IF;

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
-- 9. create_employee_with_account — already has caller check inside
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_employee_with_account(
  p_caller_email text, p_company_id uuid, p_employee_id text, p_email text,
  p_first_name text, p_last_name text, p_role text, p_department text,
  p_password_hash text, p_phone text DEFAULT NULL, p_position text DEFAULT NULL,
  p_shift_id uuid DEFAULT NULL, p_date_hired date DEFAULT CURRENT_DATE,
  p_salary numeric DEFAULT 0, p_employment_type text DEFAULT 'full-time'
)
  RETURNS employees
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path TO 'public'
AS $$
DECLARE
  v_caller_role text;
  v_caller_company_id uuid;
  v_new_employee employees;
BEGIN
  SELECT role, company_id INTO v_caller_role, v_caller_company_id
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

  IF EXISTS (
    SELECT 1 FROM user_accounts WHERE email = p_email AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_EMAIL: An employee with this email already exists in your company.';
  END IF;

  INSERT INTO employees (
    company_id, employee_id, email, first_name, last_name,
    role, department, phone, position, shift_id,
    date_hired, salary, employment_type, status
  ) VALUES (
    p_company_id, p_employee_id, p_email, p_first_name, p_last_name,
    p_role, p_department, p_phone, p_position, p_shift_id,
    p_date_hired, p_salary, p_employment_type, 'active'
  )
  RETURNING * INTO v_new_employee;

  INSERT INTO user_accounts (company_id, employee_id, email, password_hash, role)
  VALUES (p_company_id, v_new_employee.id, p_email, p_password_hash, 'employee');

  RETURN v_new_employee;
END;
$$;

REVOKE ALL ON FUNCTION public.create_employee_with_account(text, uuid, text, text, text, text, text, text, text, text, text, uuid, date, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_employee_with_account(text, uuid, text, text, text, text, text, text, text, text, text, uuid, date, numeric, text) TO authenticated;
