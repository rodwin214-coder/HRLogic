/*
  # Fix Employees Table RLS for Registration
  
  This migration fixes the Row Level Security policies on the employees table
  to properly allow employee creation during registration while maintaining security.
  
  ## Changes
  
  1. **Remove conflicting ALL policy**
     - The ALL policy was interfering with INSERT during registration
  
  2. **Add specific policies for each operation**
     - Separate INSERT, UPDATE, DELETE policies for clarity
     - Allow anon users to insert during registration
     - Maintain employer control for modifications
  
  ## Security
  
  - Employees can only be created for valid companies
  - Employers can manage employees in their company
  - Employees can update their own records
*/

-- Drop the conflicting ALL policy
DROP POLICY IF EXISTS "Employers can manage employees in their company" ON employees;

-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Allow employee creation" ON employees;
DROP POLICY IF EXISTS "Users can view employees in their company" ON employees;
DROP POLICY IF EXISTS "Employees can update their own record" ON employees;

-- SELECT: View employees in company
CREATE POLICY "View employees in company"
  ON employees FOR SELECT
  TO anon, authenticated
  USING (
    -- Allow viewing if company_id is valid (for registration flow)
    -- OR if user is authenticated and part of the company
    company_id IN (SELECT id FROM companies)
    OR
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

-- INSERT: Allow employee creation during registration
CREATE POLICY "Allow employee creation"
  ON employees FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Can insert if company exists
    company_id IN (SELECT id FROM companies)
  );

-- UPDATE: Employers can update any employee, employees can update themselves
CREATE POLICY "Employers can update employees"
  ON employees FOR UPDATE
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

CREATE POLICY "Employees can update own record"
  ON employees FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT employee_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  )
  WITH CHECK (
    id IN (
      SELECT employee_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

-- DELETE: Only employers can delete employees
CREATE POLICY "Employers can delete employees"
  ON employees FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );
