/*
  # Optimize RLS Policies with Subqueries - Part 2

  1. Problem
    - Continue optimizing RLS policies with subqueries
  
  2. Solution
    - Optimize companies, custom_field_definitions, and employees policies
  
  3. Security
    - Maintains same access control with better performance
*/

-- Optimize companies policies
DROP POLICY IF EXISTS "Employers can view their company" ON companies;
CREATE POLICY "Employers can view their company"
  ON companies
  FOR SELECT
  TO anon, authenticated
  USING (
    id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
      AND ua.role = 'employer'
    )
  );

DROP POLICY IF EXISTS "Employers can update their company" ON companies;
CREATE POLICY "Employers can update their company"
  ON companies
  FOR UPDATE
  TO anon, authenticated
  USING (
    id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
      AND ua.role = 'employer'
    )
  );

-- Optimize custom_field_definitions policies
DROP POLICY IF EXISTS "Employers can view custom field definitions" ON custom_field_definitions;
CREATE POLICY "Employers can view custom field definitions"
  ON custom_field_definitions
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

DROP POLICY IF EXISTS "Employers can insert custom field definitions" ON custom_field_definitions;
CREATE POLICY "Employers can insert custom field definitions"
  ON custom_field_definitions
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