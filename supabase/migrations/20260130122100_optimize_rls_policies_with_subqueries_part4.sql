/*
  # Optimize RLS Policies with Subqueries - Part 4

  1. Problem
    - Continue optimizing RLS policies with subqueries
  
  2. Solution
    - Optimize holidays, leave_policies, and requests policies
  
  3. Security
    - Maintains same access control with better performance
*/

-- Optimize holidays policies
DROP POLICY IF EXISTS "Employers can view holidays" ON holidays;
CREATE POLICY "Employers can view holidays"
  ON holidays
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

DROP POLICY IF EXISTS "Employers can insert holidays" ON holidays;
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

-- Optimize leave_policies policies
DROP POLICY IF EXISTS "Employers can view leave policies" ON leave_policies;
CREATE POLICY "Employers can view leave policies"
  ON leave_policies
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

-- Optimize requests policies
DROP POLICY IF EXISTS "Employers can view requests" ON requests;
CREATE POLICY "Employers can view requests"
  ON requests
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