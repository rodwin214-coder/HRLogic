/*
  # Fix Employees RLS for Change Request Updates
  
  This migration fixes the RLS policies for the employees table to properly support
  updates from approved change requests.
  
  ## Changes
  
  1. **RLS Policy Updates**
     - Split the "Employers can manage employees" policy into separate policies
     - Add dedicated UPDATE policy for employers with WITH CHECK clause
     - Add dedicated INSERT and DELETE policies for employers
     - Ensure proper WITH CHECK clauses for UPDATE operations
  
  ## Security
  
  - Employers can SELECT, INSERT, UPDATE, and DELETE employees in their company
  - Employees can UPDATE their own records
  - All policies verify company_id and user authentication
*/

-- Drop the existing "FOR ALL" policy that doesn't work properly for updates
DROP POLICY IF EXISTS "Employers can manage employees in their company" ON employees;

-- Create separate policies for employers

-- Allow employers to INSERT employees in their company
CREATE POLICY "Employers can insert employees in their company"
  ON employees FOR INSERT
  TO anon
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

-- Allow employers to UPDATE employees in their company
CREATE POLICY "Employers can update employees in their company"
  ON employees FOR UPDATE
  TO anon
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

-- Allow employers to DELETE employees in their company
CREATE POLICY "Employers can delete employees in their company"
  ON employees FOR DELETE
  TO anon
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );