/*
  # Fix Salary History INSERT RLS Policy

  1. Changes
    - Drop the insecure "Allow salary creation" policy that has WITH CHECK (true)
    - Add a secure policy that only allows employers to add salary records for employees in their company
  
  2. Security
    - Only employers from the same company can add salary records
    - Must verify the employee belongs to the employer's company
*/

-- Drop the insecure policy
DROP POLICY IF EXISTS "Allow salary creation" ON salary_history;

-- Add a secure policy for INSERT
CREATE POLICY "Employers can add salary records"
  ON salary_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id IN (
      SELECT e.id
      FROM employees e
      JOIN user_accounts ua ON ua.company_id = e.company_id
      WHERE ua.email = current_setting('app.current_user_email', true)
        AND ua.role = 'employer'
    )
  );