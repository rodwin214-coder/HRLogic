/*
  # Optimize RLS Policies with Subqueries - Part 5 (leave_policies, custom_field_definitions, employee_files)

  1. Performance Improvements
    - Replace current_setting() calls with subqueries
    - This prevents re-evaluation for each row, improving query performance at scale
  
  2. Tables Updated
    - leave_policies: All policies optimized
    - custom_field_definitions: All policies optimized
    - employee_files: All policies optimized
*/

-- ============================================
-- LEAVE_POLICIES TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Employers can delete leave policy" ON leave_policies;
DROP POLICY IF EXISTS "Employers can manage leave policy" ON leave_policies;
DROP POLICY IF EXISTS "Employers can update leave policy" ON leave_policies;
DROP POLICY IF EXISTS "Users can view leave policy in their company" ON leave_policies;
DROP POLICY IF EXISTS "View company leave policy" ON leave_policies;

-- Recreate optimized policies
CREATE POLICY "Users can view leave policy in their company"
  ON leave_policies
  FOR SELECT
  TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
    )
  );

CREATE POLICY "Employers can manage leave policy"
  ON leave_policies
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

CREATE POLICY "Employers can update leave policy"
  ON leave_policies
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

CREATE POLICY "Employers can delete leave policy"
  ON leave_policies
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
-- CUSTOM_FIELD_DEFINITIONS TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Employers can delete custom fields" ON custom_field_definitions;
DROP POLICY IF EXISTS "Employers can insert custom fields" ON custom_field_definitions;
DROP POLICY IF EXISTS "Employers can update custom fields" ON custom_field_definitions;
DROP POLICY IF EXISTS "Users can view custom fields in their company" ON custom_field_definitions;

-- Recreate optimized policies
CREATE POLICY "Users can view custom fields in their company"
  ON custom_field_definitions
  FOR SELECT
  TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
    )
  );

CREATE POLICY "Employers can insert custom fields"
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

CREATE POLICY "Employers can update custom fields"
  ON custom_field_definitions
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

CREATE POLICY "Employers can delete custom fields"
  ON custom_field_definitions
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
-- EMPLOYEE_FILES TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Employees can view their own files" ON employee_files;
DROP POLICY IF EXISTS "Employers can delete employee files" ON employee_files;
DROP POLICY IF EXISTS "Employers can insert employee files" ON employee_files;
DROP POLICY IF EXISTS "Employers can update employee files" ON employee_files;
DROP POLICY IF EXISTS "Employers can view employee files" ON employee_files;

-- Recreate optimized policies
CREATE POLICY "Employees can view their own files"
  ON employee_files
  FOR SELECT
  TO anon, authenticated
  USING (
    employee_id IN (
      SELECT ua.employee_id
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
    )
  );

CREATE POLICY "Employers can view employee files"
  ON employee_files
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

CREATE POLICY "Employers can insert employee files"
  ON employee_files
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

CREATE POLICY "Employers can update employee files"
  ON employee_files
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

CREATE POLICY "Employers can delete employee files"
  ON employee_files
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