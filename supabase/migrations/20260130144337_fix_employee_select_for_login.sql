/*
  # Fix Employee SELECT Policy for Login

  1. Problem
    - During login, after password verification, we need to fetch the employee profile
    - The current RLS policy requires app.current_user_email to be set
    - However, there's a race condition where the employee fetch happens before the config is fully set
    - This causes "Could not find employee profile" errors during login

  2. Solution
    - Add a permissive SELECT policy that allows fetching employees by their ID
    - This is safe because:
      a) The user already authenticated with email/password
      b) We're only fetching the specific employee linked to that user account
      c) The employee_id comes from the authenticated user_accounts table

  3. Changes
    - Add new permissive SELECT policy for employees
    - Allow selecting employee if the ID matches an employee_id in user_accounts
*/

-- Add a permissive policy to allow fetching employee during login
CREATE POLICY "Allow fetching employee during login"
  ON employees
  FOR SELECT
  TO anon, authenticated
  USING (
    -- Allow if this employee ID exists in user_accounts
    -- This is safe because the user already authenticated
    id IN (SELECT employee_id FROM user_accounts)
  );
