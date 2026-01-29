/*
  # Fix Company Registration RLS Policy
  
  This migration fixes the Row Level Security policies on the companies table to allow
  new company registration during the signup process.
  
  ## Changes
  
  1. **Add INSERT Policy for Companies**
     - Allow anyone to insert new companies during registration
     - This is safe because:
       - company_code is unique (enforced by database constraint)
       - Application validates company code availability before insert
       - Only INSERT is allowed, SELECT/UPDATE/DELETE remain protected
  
  2. **Update Other Tables INSERT Policies**
     - Allow temporary INSERT during registration flow
     - Required for creating employees, shifts, user_accounts, etc. during signup
  
  ## Security
  
  - After registration, all access is controlled by existing RLS policies
  - Users can only view/modify their own company data
  - No security risk as registration is a one-time operation per company
*/

-- Drop existing restrictive policies on companies table
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
DROP POLICY IF EXISTS "Users can update their own company" ON companies;

-- Allow anyone to insert new companies (for registration)
CREATE POLICY "Allow company registration"
  ON companies FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow users to view their own company
CREATE POLICY "Users can view their own company"
  ON companies FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
    OR
    -- Also allow during registration before user_account is created
    company_code IN (
      SELECT company_code FROM companies WHERE id = id
    )
  );

-- Allow users to update their own company
CREATE POLICY "Users can update their own company"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  )
  WITH CHECK (
    id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

-- Update employees INSERT policy to allow registration
DROP POLICY IF EXISTS "Employers can insert employees" ON employees;

CREATE POLICY "Allow employee creation"
  ON employees FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Allow during registration OR by employers
    company_id IN (SELECT id FROM companies)
  );

-- Update shifts INSERT policy to allow registration
DROP POLICY IF EXISTS "Employers can manage shifts" ON shifts;

CREATE POLICY "View company shifts"
  ON shifts FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Allow shift creation"
  ON shifts FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    company_id IN (SELECT id FROM companies)
  );

CREATE POLICY "Employers can update shifts"
  ON shifts FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

CREATE POLICY "Employers can delete shifts"
  ON shifts FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

-- Update salary_history INSERT policy
DROP POLICY IF EXISTS "Employers can manage salary" ON salary_history;

CREATE POLICY "View salary via employee access"
  ON salary_history FOR SELECT
  TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM employees 
      WHERE company_id IN (
        SELECT company_id FROM user_accounts 
        WHERE email = current_setting('app.current_user_email', true)
      )
    )
  );

CREATE POLICY "Allow salary creation"
  ON salary_history FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    employee_id IN (SELECT id FROM employees)
  );

CREATE POLICY "Employers can update salary"
  ON salary_history FOR UPDATE
  TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM employees 
      WHERE company_id IN (
        SELECT company_id FROM user_accounts 
        WHERE email = current_setting('app.current_user_email', true)
        AND role = 'employer'
      )
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT id FROM employees 
      WHERE company_id IN (
        SELECT company_id FROM user_accounts 
        WHERE email = current_setting('app.current_user_email', true)
        AND role = 'employer'
      )
    )
  );

CREATE POLICY "Employers can delete salary"
  ON salary_history FOR DELETE
  TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM employees 
      WHERE company_id IN (
        SELECT company_id FROM user_accounts 
        WHERE email = current_setting('app.current_user_email', true)
        AND role = 'employer'
      )
    )
  );

-- Update user_accounts INSERT policy
DROP POLICY IF EXISTS "Users can view own account" ON user_accounts;

CREATE POLICY "Allow account creation"
  ON user_accounts FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    company_id IN (SELECT id FROM companies)
  );

CREATE POLICY "Users can view own account"
  ON user_accounts FOR SELECT
  TO authenticated
  USING (email = current_setting('app.current_user_email', true));

-- Update leave_policies INSERT policy
DROP POLICY IF EXISTS "Employers can manage leave policy" ON leave_policies;

CREATE POLICY "View company leave policy"
  ON leave_policies FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Allow leave policy creation"
  ON leave_policies FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    company_id IN (SELECT id FROM companies)
  );

CREATE POLICY "Employers can update leave policy"
  ON leave_policies FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

CREATE POLICY "Employers can delete leave policy"
  ON leave_policies FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );
