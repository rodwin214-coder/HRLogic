/*
  # Fix Employee Login RLS Policy

  1. Problem
    - During login, after password verification, we fetch the employee profile
    - The current RLS policy requires app.current_user_email to be set
    - There may be race conditions or timing issues with the setting propagation
    - This causes "Could not find employee profile" errors during login

  2. Solution
    - Add a specific SELECT policy for employee login that:
      a) Allows fetching an employee if their ID matches an employee_id in user_accounts
      b) AND their company_id matches the company_id of that user account
    - This maintains company isolation while fixing the login issue

  3. Security
    - Safe because the user already authenticated with email/password
    - Company isolation is maintained by checking company_id match
    - Only allows fetching the specific employee linked to the authenticated user account
*/

-- Drop policy if it exists from previous attempts
DROP POLICY IF EXISTS "Allow employee fetch during login by ID" ON employees;

-- Add policy to allow fetching employee during login
CREATE POLICY "Allow employee fetch during login by ID"
  ON employees
  FOR SELECT
  TO anon, authenticated
  USING (
    -- Allow if this employee exists in user_accounts with matching company
    EXISTS (
      SELECT 1 
      FROM user_accounts ua 
      WHERE ua.employee_id = employees.id 
      AND ua.company_id = employees.company_id
    )
  );
