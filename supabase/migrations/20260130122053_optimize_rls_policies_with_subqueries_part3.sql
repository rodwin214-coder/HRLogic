/*
  # Optimize RLS Policies with Subqueries - Part 3

  1. Problem
    - Continue optimizing RLS policies with subqueries
  
  2. Solution
    - Optimize employees policies
  
  3. Security
    - Maintains same access control with better performance
*/

-- Optimize employees policies
DROP POLICY IF EXISTS "Employers can view employees" ON employees;
CREATE POLICY "Employers can view employees"
  ON employees
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

DROP POLICY IF EXISTS "Employers can insert employees" ON employees;
CREATE POLICY "Employers can insert employees"
  ON employees
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

DROP POLICY IF EXISTS "Employers can update employees" ON employees;
CREATE POLICY "Employers can update employees"
  ON employees
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