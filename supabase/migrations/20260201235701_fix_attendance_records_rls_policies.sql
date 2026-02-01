/*
  # Fix Attendance Records RLS Policies

  1. Problem
    - RESTRICTIVE policy "Employers can insert attendance for their company" is blocking inserts
    - Multiple duplicate policies exist (both PERMISSIVE and RESTRICTIVE)
    - RESTRICTIVE policies require ALL to pass, which can cause unexpected failures

  2. Solution
    - Remove ALL existing attendance_records policies
    - Create clean, consolidated PERMISSIVE policies
    - Ensure proper company isolation through employee_id and company_id checks

  3. Security
    - Employees can only manage their own attendance
    - Employers can manage all attendance for employees in their company
    - All policies enforce company boundaries
*/

-- Drop ALL existing attendance_records policies
DROP POLICY IF EXISTS "Employees can insert their own attendance" ON attendance_records;
DROP POLICY IF EXISTS "Employees can update their own attendance" ON attendance_records;
DROP POLICY IF EXISTS "Employers can delete attendance in their company" ON attendance_records;
DROP POLICY IF EXISTS "Employers can insert attendance for their company" ON attendance_records;
DROP POLICY IF EXISTS "Employers can insert attendance records" ON attendance_records;
DROP POLICY IF EXISTS "Employers can update attendance in their company" ON attendance_records;
DROP POLICY IF EXISTS "Employers can update attendance records" ON attendance_records;
DROP POLICY IF EXISTS "Employers can view attendance records" ON attendance_records;
DROP POLICY IF EXISTS "Users can view attendance in their company" ON attendance_records;

-- SELECT: View attendance records in same company
CREATE POLICY "Select attendance in same company"
  ON attendance_records
  FOR SELECT
  TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
    )
  );

-- INSERT: Employees can clock in/out for themselves
CREATE POLICY "Insert own attendance"
  ON attendance_records
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    employee_id IN (
      SELECT ua.employee_id
      FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
    )
    AND company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
    )
  );

-- INSERT: Employers can add attendance for any employee in their company
CREATE POLICY "Employer insert attendance in company"
  ON attendance_records
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
        AND ua.role = 'employer'
    )
    AND employee_id IN (
      SELECT e.id
      FROM employees e
      WHERE e.company_id IN (
        SELECT ua.company_id
        FROM user_accounts ua
        WHERE ua.email = current_setting('app.current_user_email', true)
          AND ua.role = 'employer'
      )
    )
  );

-- UPDATE: Employees can update their own attendance
CREATE POLICY "Update own attendance"
  ON attendance_records
  FOR UPDATE
  TO anon, authenticated
  USING (
    employee_id IN (
      SELECT ua.employee_id
      FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT ua.employee_id
      FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
    )
  );

-- UPDATE: Employers can update attendance for employees in their company
CREATE POLICY "Employer update attendance in company"
  ON attendance_records
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

-- DELETE: Only employers can delete attendance in their company
CREATE POLICY "Delete attendance in same company"
  ON attendance_records
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
