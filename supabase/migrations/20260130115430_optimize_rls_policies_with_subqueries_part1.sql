/*
  # Optimize RLS Policies with Subqueries - Part 1 (employees, user_accounts)

  1. Performance Improvements
    - Replace current_setting() calls with subqueries
    - This prevents re-evaluation for each row, improving query performance at scale
  
  2. Tables Updated
    - employees: All policies optimized
    - user_accounts: All policies optimized
*/

-- ============================================
-- EMPLOYEES TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Employees can update own record" ON employees;
DROP POLICY IF EXISTS "Employees can update their own record" ON employees;
DROP POLICY IF EXISTS "Employers can delete employees" ON employees;
DROP POLICY IF EXISTS "Employers can delete employees in their company" ON employees;
DROP POLICY IF EXISTS "Employers can insert employees in their company" ON employees;
DROP POLICY IF EXISTS "Employers can update employees" ON employees;
DROP POLICY IF EXISTS "Employers can update employees in their company" ON employees;
DROP POLICY IF EXISTS "Users can view employees in their company" ON employees;

-- Recreate optimized policies
CREATE POLICY "Users can view employees in their company"
  ON employees
  FOR SELECT
  TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
    )
  );

CREATE POLICY "Employers can insert employees in their company"
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

CREATE POLICY "Employees can update their own record"
  ON employees
  FOR UPDATE
  TO anon, authenticated
  USING (
    id IN (
      SELECT ua.employee_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
    )
  )
  WITH CHECK (
    id IN (
      SELECT ua.employee_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
    )
  );

CREATE POLICY "Employers can update employees in their company"
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
  )
  WITH CHECK (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
        AND ua.role = 'employer'
    )
  );

CREATE POLICY "Employers can delete employees in their company"
  ON employees
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
-- USER_ACCOUNTS TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Employers can delete user accounts in their company" ON user_accounts;
DROP POLICY IF EXISTS "Employers can update accounts in their company" ON user_accounts;
DROP POLICY IF EXISTS "Users can update their own account" ON user_accounts;
DROP POLICY IF EXISTS "Users can view their own account" ON user_accounts;

-- Recreate optimized policies
CREATE POLICY "Users can view their own account"
  ON user_accounts
  FOR SELECT
  TO anon, authenticated
  USING (
    email = (SELECT current_setting('app.current_user_email', true))
  );

CREATE POLICY "Users can update their own account"
  ON user_accounts
  FOR UPDATE
  TO anon, authenticated
  USING (
    email = (SELECT current_setting('app.current_user_email', true))
  )
  WITH CHECK (
    email = (SELECT current_setting('app.current_user_email', true))
  );

CREATE POLICY "Employers can update accounts in their company"
  ON user_accounts
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

CREATE POLICY "Employers can delete user accounts in their company"
  ON user_accounts
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