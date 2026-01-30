/*
  # Fix Attendance Records RLS Policies for Multi-Company Isolation

  1. Changes
    - Drop existing attendance policies that don't properly filter by current user's company
    - Add proper RLS policies that ensure users can only see attendance from their own company
  
  2. Security
    - SELECT policy: Users can only view attendance records from employees in their company
    - INSERT policy: Employees can only insert attendance for themselves in their company
    - UPDATE policy: Employees can only update their own attendance records
    - DELETE policy: Employers can only delete attendance from employees in their company
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view attendance" ON attendance_records;
DROP POLICY IF EXISTS "Employees can insert attendance" ON attendance_records;
DROP POLICY IF EXISTS "Employees can update attendance" ON attendance_records;
DROP POLICY IF EXISTS "Employers can delete attendance" ON attendance_records;

-- Create proper RLS policies with company isolation

CREATE POLICY "Users can view attendance in their company"
  ON attendance_records FOR SELECT
  TO anon
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Employees can insert their own attendance"
  ON attendance_records FOR INSERT
  TO anon
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
    AND employee_id IN (
      SELECT employee_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Employers can insert attendance for their company"
  ON attendance_records FOR INSERT
  TO anon
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

CREATE POLICY "Employees can update their own attendance"
  ON attendance_records FOR UPDATE
  TO anon
  USING (
    employee_id IN (
      SELECT employee_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT employee_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Employers can update attendance in their company"
  ON attendance_records FOR UPDATE
  TO anon
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

CREATE POLICY "Employers can delete attendance in their company"
  ON attendance_records FOR DELETE
  TO anon
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );