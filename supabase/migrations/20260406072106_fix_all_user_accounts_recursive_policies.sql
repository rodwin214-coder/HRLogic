/*
  # Fix All Remaining Recursive Policies on user_accounts

  ## Problem
  The following existing policies on user_accounts also self-reference user_accounts
  causing infinite recursion in some query paths:
  - "Employers can create user accounts" 
  - "Employers can delete user accounts in their company"
  - "Employers can update accounts in their company"

  ## Solution
  Replace all self-referencing policies with ones using the security definer
  functions created in the previous migration.
*/

-- Drop the remaining recursive policies
DROP POLICY IF EXISTS "Employers can create user accounts" ON user_accounts;
DROP POLICY IF EXISTS "Employers can delete user accounts in their company" ON user_accounts;
DROP POLICY IF EXISTS "Employers can update accounts in their company" ON user_accounts;

-- Recreate using security definer functions (non-recursive)
CREATE POLICY "Employers can create user accounts"
  ON user_accounts FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    company_id = get_current_user_company_id()
    AND get_current_user_role() = 'employer'
  );

CREATE POLICY "Employers can delete user accounts in their company"
  ON user_accounts FOR DELETE
  TO anon, authenticated
  USING (
    company_id = get_current_user_company_id()
    AND get_current_user_role() = 'employer'
  );

CREATE POLICY "Employers can update accounts in their company"
  ON user_accounts FOR UPDATE
  TO anon, authenticated
  USING (
    company_id = get_current_user_company_id()
    AND get_current_user_role() = 'employer'
  )
  WITH CHECK (
    company_id = get_current_user_company_id()
    AND get_current_user_role() = 'employer'
  );
