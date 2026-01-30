/*
  # Optimize RLS Policies with Subqueries - Part 2 (shifts, salary_history)

  1. Performance Improvements
    - Replace current_setting() calls with subqueries
    - This prevents re-evaluation for each row, improving query performance at scale
  
  2. Tables Updated
    - shifts: All policies optimized
    - salary_history: All policies optimized
*/

-- ============================================
-- SHIFTS TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Employers can delete shifts" ON shifts;
DROP POLICY IF EXISTS "Employers can manage shifts in their company" ON shifts;
DROP POLICY IF EXISTS "Employers can update shifts" ON shifts;
DROP POLICY IF EXISTS "Users can view shifts in their company" ON shifts;

-- Recreate optimized policies
CREATE POLICY "Users can view shifts in their company"
  ON shifts
  FOR SELECT
  TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
    )
  );

CREATE POLICY "Employers can manage shifts in their company"
  ON shifts
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

CREATE POLICY "Employers can update shifts"
  ON shifts
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

CREATE POLICY "Employers can delete shifts"
  ON shifts
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
-- SALARY_HISTORY TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Employers can add salary records" ON salary_history;
DROP POLICY IF EXISTS "Employers can delete salary" ON salary_history;
DROP POLICY IF EXISTS "Employers can manage salary history" ON salary_history;
DROP POLICY IF EXISTS "Employers can update salary" ON salary_history;
DROP POLICY IF EXISTS "Users can view salary history in their company" ON salary_history;
DROP POLICY IF EXISTS "View salary via employee access" ON salary_history;

-- Recreate optimized policies
CREATE POLICY "Users can view salary history in their company"
  ON salary_history
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

CREATE POLICY "Employers can add salary records"
  ON salary_history
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

CREATE POLICY "Employers can update salary"
  ON salary_history
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

CREATE POLICY "Employers can delete salary"
  ON salary_history
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