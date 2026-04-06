/*
  # Fix Recursive RLS Policies on user_accounts - v2

  ## Problem
  The employer update policy added in the previous migration still has potential
  recursion via the JOIN to user_accounts. We need a truly non-recursive approach.

  ## Solution
  Create a security definer function that reads user context without triggering RLS,
  then use that function in the policy.

  ## Changes
  - Create get_current_user_company_id() and get_current_user_role() security definer functions
  - Drop and recreate the employer update policy using these functions
  - These functions bypass RLS to safely look up the current user's context
*/

-- Helper function: get current user's company_id without triggering RLS
CREATE OR REPLACE FUNCTION get_current_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM user_accounts
  WHERE email = current_setting('app.current_user_email', true)
  LIMIT 1;
$$;

-- Helper function: get current user's role without triggering RLS
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM user_accounts
  WHERE email = current_setting('app.current_user_email', true)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_current_user_company_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_role() TO anon, authenticated;

-- Drop the still-recursive employer update policy from previous migration
DROP POLICY IF EXISTS "Employers can update employee passwords in their company" ON user_accounts;

-- Non-recursive version using security definer functions
CREATE POLICY "Employers can update employee passwords in their company"
  ON user_accounts FOR UPDATE
  TO anon, authenticated
  USING (
    company_id = get_current_user_company_id()
    AND get_current_user_role() = 'employer'
  )
  WITH CHECK (
    company_id = get_current_user_company_id()
    AND get_current_user_role() = 'employer'
  );
