/*
  # Fix RLS Policies for Custom Field Definitions

  ## Changes Made
  1. Drop the problematic "FOR ALL" policy that lacks proper WITH CHECK clause
  2. Create separate, explicit policies for each operation:
     - SELECT: All authenticated users can view custom fields in their company
     - INSERT: Employers can create custom fields for their company
     - UPDATE: Employers can update custom fields in their company
     - DELETE: Employers can delete custom fields in their company

  ## Security
  - Each policy properly validates user role and company membership
  - INSERT policy includes WITH CHECK to ensure data integrity
  - All policies use proper session variable checks for security
*/

-- Drop the existing "FOR ALL" policy that's causing issues
DROP POLICY IF EXISTS "Employers can manage custom fields" ON custom_field_definitions;

-- Keep the existing SELECT policy as it's already correct
-- "Users can view custom fields in their company" already exists

-- Create INSERT policy for employers
CREATE POLICY "Employers can insert custom fields"
  ON custom_field_definitions
  FOR INSERT
  TO anon
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

-- Create UPDATE policy for employers
CREATE POLICY "Employers can update custom fields"
  ON custom_field_definitions
  FOR UPDATE
  TO anon
  USING (
    company_id IN (
      SELECT company_id 
      FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

-- Create DELETE policy for employers
CREATE POLICY "Employers can delete custom fields"
  ON custom_field_definitions
  FOR DELETE
  TO anon
  USING (
    company_id IN (
      SELECT company_id 
      FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );