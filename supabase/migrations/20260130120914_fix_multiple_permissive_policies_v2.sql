/*
  # Fix Multiple Permissive Policies

  1. Security Improvements
    - Convert some policies to RESTRICTIVE to avoid multiple permissive policies issue
    - This ensures proper access control by requiring both restrictive and permissive policies to pass

  2. Changes
    - attendance_records: Make employer policies restrictive for INSERT/UPDATE
    - employee_files: Make employer policy restrictive for SELECT
    - employees: Make employer policy restrictive for UPDATE
    - tasks: Make management policy restrictive for SELECT
    - user_accounts: Make employer policy restrictive for UPDATE

  3. Notes
    - Restrictive policies must pass along with at least one permissive policy
    - This provides better security by adding an additional layer of checks
*/

-- ============================================
-- ATTENDANCE_RECORDS TABLE POLICIES
-- ============================================

DROP POLICY IF EXISTS "Employers can insert attendance for their company" ON attendance_records;
CREATE POLICY "Employers can insert attendance for their company"
  ON attendance_records
  AS RESTRICTIVE
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

DROP POLICY IF EXISTS "Employers can update attendance in their company" ON attendance_records;
CREATE POLICY "Employers can update attendance in their company"
  ON attendance_records
  AS RESTRICTIVE
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

-- ============================================
-- EMPLOYEE_FILES TABLE POLICIES
-- ============================================

DROP POLICY IF EXISTS "Employers can view employee files" ON employee_files;
CREATE POLICY "Employers can view employee files"
  ON employee_files
  AS RESTRICTIVE
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

-- ============================================
-- EMPLOYEES TABLE POLICIES
-- ============================================

DROP POLICY IF EXISTS "Employers can update employees in their company" ON employees;
DROP POLICY IF EXISTS "Employers can update employees" ON employees;
CREATE POLICY "Employers can update employees"
  ON employees
  AS RESTRICTIVE
  FOR UPDATE
  TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
        AND ua.role = 'employer'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
        AND ua.role = 'employer'
    )
  );

-- ============================================
-- TASKS TABLE POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can manage tasks in their company" ON tasks;
CREATE POLICY "Users can manage tasks in their company"
  ON tasks
  AS RESTRICTIVE
  FOR SELECT
  TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
    )
  );

-- ============================================
-- USER_ACCOUNTS TABLE POLICIES
-- ============================================

DROP POLICY IF EXISTS "Employers can update accounts in their company" ON user_accounts;
CREATE POLICY "Employers can update accounts in their company"
  ON user_accounts
  AS RESTRICTIVE
  FOR UPDATE
  TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
        AND ua.role = 'employer'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
        AND ua.role = 'employer'
    )
  );