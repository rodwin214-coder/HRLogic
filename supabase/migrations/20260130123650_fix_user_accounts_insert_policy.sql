/*
  # Fix user_accounts INSERT Policy

  1. Security Fix
    - Add secure INSERT policy for user_accounts
    - Allows employers to create user accounts for employees in their company
    - Ensures new accounts are scoped to the employer's company

  2. Changes
    - Add "Employers can create user accounts" INSERT policy
    - Policy checks that the user is an employer and the new account belongs to their company
*/

-- Add INSERT policy for employers to create user accounts in their company
CREATE POLICY "Employers can create user accounts in their company"
  ON user_accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );
