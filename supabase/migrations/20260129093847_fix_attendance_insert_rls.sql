/*
  # Fix Attendance Records INSERT Policy

  The current INSERT policy for attendance_records only checks employee_id,
  but doesn't validate the company_id. This causes RLS violations when
  employees try to clock in.

  ## Changes
  - Drop the existing INSERT policy for attendance_records
  - Create a new INSERT policy that validates both employee_id and company_id
*/

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Employees can insert their own attendance" ON attendance_records;

-- Create new INSERT policy that validates both employee_id and company_id
CREATE POLICY "Employees can insert their own attendance"
  ON attendance_records FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id IN (
      SELECT employee_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
    AND company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );