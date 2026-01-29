/*
  # Fix Companies RLS Policies for Public Role

  ## Summary
  Updates the companies table RLS policies to work with the public role since we're using custom authentication instead of Supabase Auth.

  ## Changes
  1. Drop existing RLS policies that require authenticated role
  2. Create new policies that work with public role
  3. Policies check the session variable `app.current_user_email` to verify user identity

  ## Security Notes
  - Users must set the session variable via `set_config` RPC before operations
  - UPDATE policy checks that the user is an employer in the company
  - SELECT policy allows users to view their own company
  - INSERT policy allows company registration
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
DROP POLICY IF EXISTS "Users can update their own company" ON companies;
DROP POLICY IF EXISTS "Allow viewing companies" ON companies;
DROP POLICY IF EXISTS "Allow company registration" ON companies;

-- Create new policies for public role
CREATE POLICY "Users can view their own company"
  ON companies FOR SELECT
  TO public
  USING (
    id IN (
      SELECT user_accounts.company_id
      FROM user_accounts
      WHERE user_accounts.email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Users can update their own company"
  ON companies FOR UPDATE
  TO public
  USING (
    id IN (
      SELECT user_accounts.company_id
      FROM user_accounts
      WHERE user_accounts.email = current_setting('app.current_user_email', true)
      AND user_accounts.role = 'employer'
    )
  );

CREATE POLICY "Allow company registration"
  ON companies FOR INSERT
  TO public
  WITH CHECK (true);