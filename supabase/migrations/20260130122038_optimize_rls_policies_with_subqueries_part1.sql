/*
  # Optimize RLS Policies with Subqueries - Part 1

  1. Problem
    - RLS policies re-evaluate current_setting() for each row
    - This produces suboptimal query performance at scale
  
  2. Solution
    - Replace direct current_setting() calls with subqueries
    - Use (SELECT current_setting()) pattern
  
  3. Security
    - Maintains same access control with better performance
    - Policies are evaluated once per query instead of per row
*/

-- Optimize attendance_records policies
DROP POLICY IF EXISTS "Employers can view attendance records" ON attendance_records;
CREATE POLICY "Employers can view attendance records"
  ON attendance_records
  FOR SELECT
  TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
      AND ua.role = 'employer'
    )
  );

DROP POLICY IF EXISTS "Employers can insert attendance records" ON attendance_records;
CREATE POLICY "Employers can insert attendance records"
  ON attendance_records
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
      AND ua.role = 'employer'
    )
  );

DROP POLICY IF EXISTS "Employers can update attendance records" ON attendance_records;
CREATE POLICY "Employers can update attendance records"
  ON attendance_records
  FOR UPDATE
  TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
      AND ua.role = 'employer'
    )
  );