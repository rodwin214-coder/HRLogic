/*
  # Optimize RLS Policies with Subqueries - Part 4 (holidays, tasks, audit_logs)

  1. Performance Improvements
    - Replace current_setting() calls with subqueries
    - This prevents re-evaluation for each row, improving query performance at scale
  
  2. Tables Updated
    - holidays: All policies optimized
    - tasks: All policies optimized
    - audit_logs: All policies optimized
*/

-- ============================================
-- HOLIDAYS TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Employers can delete holidays" ON holidays;
DROP POLICY IF EXISTS "Employers can insert holidays" ON holidays;
DROP POLICY IF EXISTS "Employers can update holidays" ON holidays;
DROP POLICY IF EXISTS "Users can view holidays in their company" ON holidays;

-- Recreate optimized policies
CREATE POLICY "Users can view holidays in their company"
  ON holidays
  FOR SELECT
  TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
    )
  );

CREATE POLICY "Employers can insert holidays"
  ON holidays
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

CREATE POLICY "Employers can update holidays"
  ON holidays
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

CREATE POLICY "Employers can delete holidays"
  ON holidays
  FOR DELETE
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
-- TASKS TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage tasks in their company" ON tasks;
DROP POLICY IF EXISTS "Users can view tasks in their company" ON tasks;

-- Recreate optimized policies
CREATE POLICY "Users can view tasks in their company"
  ON tasks
  FOR SELECT
  TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
    )
  );

CREATE POLICY "Users can manage tasks in their company"
  ON tasks
  FOR ALL
  TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
    )
  );

-- ============================================
-- AUDIT_LOGS TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view audit logs in their company" ON audit_logs;

-- Recreate optimized policies
CREATE POLICY "Users can view audit logs in their company"
  ON audit_logs
  FOR SELECT
  TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
    )
  );