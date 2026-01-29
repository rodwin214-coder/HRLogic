/*
  # Fix RLS Policies for Holidays Table

  ## Changes Made
  1. Drop the problematic "FOR ALL" policy that lacks proper WITH CHECK clause
  2. Create separate, explicit policies for each operation:
     - SELECT: All authenticated users can view holidays in their company
     - INSERT: Employers can create holidays for their company
     - UPDATE: Employers can update holidays in their company
     - DELETE: Employers can delete holidays in their company

  ## Security
  - Each policy properly validates user role and company membership
  - INSERT policy includes WITH CHECK to ensure data integrity
  - All policies use proper session variable checks for security
*/

-- Drop the existing "FOR ALL" policy that's causing issues
DROP POLICY IF EXISTS "Employers can manage holidays" ON holidays;

-- Keep the existing SELECT policy as it's already correct
-- "Users can view holidays in their company" already exists

-- Create INSERT policy for employers
CREATE POLICY "Employers can insert holidays"
  ON holidays
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
CREATE POLICY "Employers can update holidays"
  ON holidays
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
CREATE POLICY "Employers can delete holidays"
  ON holidays
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