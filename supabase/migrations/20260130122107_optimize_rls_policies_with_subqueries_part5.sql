/*
  # Optimize RLS Policies with Subqueries - Part 5

  1. Problem
    - Continue optimizing RLS policies with subqueries
  
  2. Solution
    - Optimize remaining policies for shifts, salary_history, and tasks
  
  3. Security
    - Maintains same access control with better performance
*/

-- Optimize shifts policies
DROP POLICY IF EXISTS "Employers can view shifts" ON shifts;
CREATE POLICY "Employers can view shifts"
  ON shifts
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

DROP POLICY IF EXISTS "Employers can insert shifts" ON shifts;
CREATE POLICY "Employers can insert shifts"
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

-- Optimize salary_history policies
DROP POLICY IF EXISTS "Employers can view salary history" ON salary_history;
CREATE POLICY "Employers can view salary history"
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
        AND ua.role = 'employer'
      )
    )
  );

-- Optimize tasks policies
DROP POLICY IF EXISTS "Employers can view tasks" ON tasks;
CREATE POLICY "Employers can view tasks"
  ON tasks
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