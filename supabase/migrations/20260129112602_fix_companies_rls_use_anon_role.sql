/*
  # Fix Companies RLS to Use Anon Role

  ## Summary
  Updates the companies table RLS policies to use the anon role to match other tables, since users connect with the anon key.

  ## Changes
  1. Drop public role policies
  2. Create anon role policies that work with session variables

  ## Security Notes
  - Policies use session variable `app.current_user_email` for user identification
  - Consistent with other tables in the system
*/

-- Drop existing public policies
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
DROP POLICY IF EXISTS "Users can update their own company" ON companies;
DROP POLICY IF EXISTS "Allow company registration" ON companies;

-- Create anon role policies
CREATE POLICY "Users can view their own company"
  ON companies FOR SELECT
  TO anon
  USING (
    id IN (
      SELECT user_accounts.company_id
      FROM user_accounts
      WHERE user_accounts.email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Users can update their own company"
  ON companies FOR UPDATE
  TO anon
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
  TO anon
  WITH CHECK (true);