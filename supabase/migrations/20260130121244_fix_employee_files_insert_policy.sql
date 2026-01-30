/*
  # Fix employee_files INSERT policy

  1. Problem
    - The INSERT policy only checks employee_id relationship
    - It should check both company_id and that the employee belongs to the company
  
  2. Solution
    - Update the INSERT policy to check company_id matches employer's company
    - Keep the employee_id validation as well
  
  3. Security
    - Employers can only insert files for employees in their company
    - Both company_id and employee_id must be valid and match
*/

DROP POLICY IF EXISTS "Employers can insert employee files" ON employee_files;

CREATE POLICY "Employers can insert employee files"
  ON employee_files
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
      AND ua.role = 'employer'
    )
    AND
    employee_id IN (
      SELECT e.id
      FROM employees e
      WHERE e.company_id = company_id
    )
  );