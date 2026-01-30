/*
  # Simplify employee_files RLS policies

  1. Problem
    - Complex subqueries in RLS policies causing failures
    - Need simpler, more reliable checks
  
  2. Solution
    - Simplify INSERT policy to check both company_id and employee_id directly
    - Use EXISTS instead of IN for better performance
  
  3. Security
    - Employers can only insert files for employees in their company
    - Both company_id and employee_id must be valid
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Employers can insert employee files" ON employee_files;
DROP POLICY IF EXISTS "Employers can view employee files" ON employee_files;
DROP POLICY IF EXISTS "Employers can delete employee files" ON employee_files;

-- Recreate INSERT policy with simplified logic
CREATE POLICY "Employers can insert employee files"
  ON employee_files
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Check that the company_id belongs to the current user
    EXISTS (
      SELECT 1
      FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
      AND ua.role = 'employer'
      AND ua.company_id = employee_files.company_id
    )
    AND
    -- Check that the employee belongs to the same company
    EXISTS (
      SELECT 1
      FROM employees e
      WHERE e.id = employee_files.employee_id
      AND e.company_id = employee_files.company_id
    )
  );

-- Recreate SELECT policy
CREATE POLICY "Employers can view employee files"
  ON employee_files
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
      AND ua.role = 'employer'
      AND ua.company_id = employee_files.company_id
    )
  );

-- Recreate DELETE policy  
CREATE POLICY "Employers can delete employee files"
  ON employee_files
  FOR DELETE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
      AND ua.role = 'employer'
      AND ua.company_id = employee_files.company_id
    )
  );