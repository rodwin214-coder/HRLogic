/*
  # Optimize RLS Policies with Subqueries - Part 3 (attendance_records, requests)

  1. Performance Improvements
    - Replace current_setting() calls with subqueries
    - This prevents re-evaluation for each row, improving query performance at scale
  
  2. Tables Updated
    - attendance_records: All policies optimized
    - requests: All policies optimized
*/

-- ============================================
-- ATTENDANCE_RECORDS TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Employees can insert their own attendance" ON attendance_records;
DROP POLICY IF EXISTS "Employees can update their own attendance" ON attendance_records;
DROP POLICY IF EXISTS "Employers can delete attendance in their company" ON attendance_records;
DROP POLICY IF EXISTS "Employers can insert attendance for their company" ON attendance_records;
DROP POLICY IF EXISTS "Employers can update attendance in their company" ON attendance_records;
DROP POLICY IF EXISTS "Users can view attendance in their company" ON attendance_records;

-- Recreate optimized policies
CREATE POLICY "Users can view attendance in their company"
  ON attendance_records
  FOR SELECT
  TO anon, authenticated
  USING (
    employee_id IN (
      SELECT e.id
      FROM employees e
      WHERE e.company_id IN (
        SELECT ua.company_id
        FROM user_accounts ua
        WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
      )
    )
  );

CREATE POLICY "Employees can insert their own attendance"
  ON attendance_records
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    employee_id IN (
      SELECT ua.employee_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
    )
  );

CREATE POLICY "Employers can insert attendance for their company"
  ON attendance_records
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    employee_id IN (
      SELECT e.id
      FROM employees e
      WHERE e.company_id IN (
        SELECT ua.company_id
        FROM user_accounts ua
        WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
          AND ua.role = 'employer'
      )
    )
  );

CREATE POLICY "Employees can update their own attendance"
  ON attendance_records
  FOR UPDATE
  TO anon, authenticated
  USING (
    employee_id IN (
      SELECT ua.employee_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT ua.employee_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
    )
  );

CREATE POLICY "Employers can update attendance in their company"
  ON attendance_records
  FOR UPDATE
  TO anon, authenticated
  USING (
    employee_id IN (
      SELECT e.id
      FROM employees e
      WHERE e.company_id IN (
        SELECT ua.company_id
        FROM user_accounts ua
        WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
          AND ua.role = 'employer'
      )
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT e.id
      FROM employees e
      WHERE e.company_id IN (
        SELECT ua.company_id
        FROM user_accounts ua
        WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
          AND ua.role = 'employer'
      )
    )
  );

CREATE POLICY "Employers can delete attendance in their company"
  ON attendance_records
  FOR DELETE
  TO anon, authenticated
  USING (
    employee_id IN (
      SELECT e.id
      FROM employees e
      WHERE e.company_id IN (
        SELECT ua.company_id
        FROM user_accounts ua
        WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
          AND ua.role = 'employer'
      )
    )
  );

-- ============================================
-- REQUESTS TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Employees can create their own requests" ON requests;
DROP POLICY IF EXISTS "Employers can delete requests in their company" ON requests;
DROP POLICY IF EXISTS "Employers can update requests in their company" ON requests;
DROP POLICY IF EXISTS "Users can view requests in their company" ON requests;

-- Recreate optimized policies
CREATE POLICY "Users can view requests in their company"
  ON requests
  FOR SELECT
  TO anon, authenticated
  USING (
    employee_id IN (
      SELECT e.id
      FROM employees e
      WHERE e.company_id IN (
        SELECT ua.company_id
        FROM user_accounts ua
        WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
      )
    )
  );

CREATE POLICY "Employees can create their own requests"
  ON requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    employee_id IN (
      SELECT ua.employee_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
    )
  );

CREATE POLICY "Employers can update requests in their company"
  ON requests
  FOR UPDATE
  TO anon, authenticated
  USING (
    employee_id IN (
      SELECT e.id
      FROM employees e
      WHERE e.company_id IN (
        SELECT ua.company_id
        FROM user_accounts ua
        WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
          AND ua.role = 'employer'
      )
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT e.id
      FROM employees e
      WHERE e.company_id IN (
        SELECT ua.company_id
        FROM user_accounts ua
        WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
          AND ua.role = 'employer'
      )
    )
  );

CREATE POLICY "Employers can delete requests in their company"
  ON requests
  FOR DELETE
  TO anon, authenticated
  USING (
    employee_id IN (
      SELECT e.id
      FROM employees e
      WHERE e.company_id IN (
        SELECT ua.company_id
        FROM user_accounts ua
        WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
          AND ua.role = 'employer'
      )
    )
  );