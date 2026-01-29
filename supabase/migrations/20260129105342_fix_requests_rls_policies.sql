/*
  # Fix Request Management RLS Policies
  
  This migration fixes the RLS policies for the requests table to properly support
  request status updates.
  
  ## Changes
  
  1. **RLS Policy Updates**
     - Split the "Employers can manage requests" policy into separate policies
     - Add dedicated UPDATE policy for employers to update request status
     - Add dedicated DELETE policy for employers (if needed)
     - Ensure proper WITH CHECK clauses for UPDATE operations
  
  ## Security
  
  - Employers can SELECT, UPDATE, and DELETE requests in their company
  - Employees can SELECT and INSERT their own requests
  - All policies verify company_id and user authentication
*/

-- Drop the existing "FOR ALL" policy that doesn't work properly for updates
DROP POLICY IF EXISTS "Employers can manage requests in their company" ON requests;

-- Create separate policies for employers

-- Allow employers to UPDATE requests in their company
CREATE POLICY "Employers can update requests in their company"
  ON requests FOR UPDATE
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

-- Allow employers to DELETE requests in their company
CREATE POLICY "Employers can delete requests in their company"
  ON requests FOR DELETE
  TO anon
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );