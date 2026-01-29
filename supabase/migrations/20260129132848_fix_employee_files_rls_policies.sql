/*
  # Fix employee_files RLS policies

  1. Changes
    - Drop the existing catch-all policy
    - Create separate policies for SELECT, INSERT, UPDATE, and DELETE operations
    - Ensure employers can manage all files in their company
    - Ensure employees can view their own files

  2. Security
    - Employers: Full access to all employee files in their company
    - Employees: Read-only access to their own files
*/

DROP POLICY IF EXISTS "Employers can manage all employee files" ON employee_files;
DROP POLICY IF EXISTS "Employees can view their own files" ON employee_files;

CREATE POLICY "Employers can view employee files"
  ON employee_files
  FOR SELECT
  USING (
    company_id IN (
      SELECT e.company_id
      FROM employees e
      INNER JOIN user_accounts ua ON ua.employee_id = e.id
      WHERE ua.email = current_setting('app.current_user_email', true)
      AND ua.role = 'employer'
    )
  );

CREATE POLICY "Employers can insert employee files"
  ON employee_files
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT e.company_id
      FROM employees e
      INNER JOIN user_accounts ua ON ua.employee_id = e.id
      WHERE ua.email = current_setting('app.current_user_email', true)
      AND ua.role = 'employer'
    )
  );

CREATE POLICY "Employers can update employee files"
  ON employee_files
  FOR UPDATE
  USING (
    company_id IN (
      SELECT e.company_id
      FROM employees e
      INNER JOIN user_accounts ua ON ua.employee_id = e.id
      WHERE ua.email = current_setting('app.current_user_email', true)
      AND ua.role = 'employer'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT e.company_id
      FROM employees e
      INNER JOIN user_accounts ua ON ua.employee_id = e.id
      WHERE ua.email = current_setting('app.current_user_email', true)
      AND ua.role = 'employer'
    )
  );

CREATE POLICY "Employers can delete employee files"
  ON employee_files
  FOR DELETE
  USING (
    company_id IN (
      SELECT e.company_id
      FROM employees e
      INNER JOIN user_accounts ua ON ua.employee_id = e.id
      WHERE ua.email = current_setting('app.current_user_email', true)
      AND ua.role = 'employer'
    )
  );

CREATE POLICY "Employees can view their own files"
  ON employee_files
  FOR SELECT
  USING (
    employee_id IN (
      SELECT e.id
      FROM employees e
      INNER JOIN user_accounts ua ON ua.employee_id = e.id
      WHERE ua.email = current_setting('app.current_user_email', true)
    )
  );
