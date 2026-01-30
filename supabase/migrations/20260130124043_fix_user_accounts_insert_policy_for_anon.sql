/*
  # Fix user_accounts INSERT Policy for Anonymous Role

  1. Security Fix
    - Drop the authenticated-only INSERT policy
    - Add INSERT policy that works with the anon role
    - Allows employers to create user accounts for employees in their company
    - Ensures new accounts are scoped to the employer's company

  2. Changes
    - Drop "Employers can create user accounts in their company" policy
    - Add new "Employers can create user accounts" policy for anon role
    - Policy checks that the user is an employer and the new account belongs to their company
*/

-- Drop the existing INSERT policy that only works with authenticated role
DROP POLICY IF EXISTS "Employers can create user accounts in their company" ON user_accounts;

-- Add INSERT policy for anon role (custom auth)
CREATE POLICY "Employers can create user accounts"
  ON user_accounts FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    company_id IN (
      SELECT ua.company_id 
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
      AND ua.role = 'employer'
    )
  );
