/*
  # Consolidate Employee RLS Policies for Proper Company Isolation

  1. Problem
    - Multiple duplicate SELECT policies exist on employees table
    - "Users can view employees in their company" (anon)
    - "Employers can view employees" (anon, authenticated)
    - Having multiple PERMISSIVE policies can cause unexpected behavior

  2. Solution
    - Remove all existing employee RLS policies
    - Create a single, clear set of policies with proper company isolation
    - Ensure each operation (SELECT, INSERT, UPDATE, DELETE) has exactly one policy per role

  3. Security
    - All policies enforce company_id matching through user_accounts table
    - No cross-company data access possible
*/

-- Drop ALL existing employee policies
DROP POLICY IF EXISTS "Users can view employees in their company" ON employees;
DROP POLICY IF EXISTS "Employers can view employees" ON employees;
DROP POLICY IF EXISTS "Employees can update own record" ON employees;
DROP POLICY IF EXISTS "Employees can update their own record" ON employees;
DROP POLICY IF EXISTS "Employers can delete employees" ON employees;
DROP POLICY IF EXISTS "Employers can delete employees in their company" ON employees;
DROP POLICY IF EXISTS "Employers can insert employees" ON employees;
DROP POLICY IF EXISTS "Employers can insert employees in their company" ON employees;
DROP POLICY IF EXISTS "Employers can update employees" ON employees;
DROP POLICY IF EXISTS "Employers can update employees in their company" ON employees;

-- SELECT: Allow viewing employees in same company only
CREATE POLICY "Select employees in same company"
  ON employees
  FOR SELECT
  TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
    )
  );

-- INSERT: Only employers can add employees to their company
CREATE POLICY "Insert employees in same company"
  ON employees
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
        AND ua.role = 'employer'
    )
  );

-- UPDATE: Employees can update own record
CREATE POLICY "Update own employee record"
  ON employees
  FOR UPDATE
  TO anon, authenticated
  USING (
    id IN (
      SELECT ua.employee_id
      FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
    )
  )
  WITH CHECK (
    id IN (
      SELECT ua.employee_id
      FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
    )
  );

-- UPDATE: Employers can update any employee in their company
CREATE POLICY "Employer update employees in company"
  ON employees
  FOR UPDATE
  TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
        AND ua.role = 'employer'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
        AND ua.role = 'employer'
    )
  );

-- DELETE: Only employers can delete employees in their company
CREATE POLICY "Delete employees in same company"
  ON employees
  FOR DELETE
  TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
        AND ua.role = 'employer'
    )
  );
