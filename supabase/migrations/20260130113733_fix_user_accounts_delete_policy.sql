/*
  # Fix User Accounts Delete and Update Policies

  1. Changes
    - Add DELETE policy for user_accounts table to allow employers to delete employee accounts
    - Add UPDATE policy for user_accounts table to allow password changes
  
  2. Security
    - DELETE policy: Only employers can delete user accounts in their company
    - UPDATE policy: Users can update their own password, employers can update employees' passwords in their company
*/

-- Add DELETE policy for user_accounts
CREATE POLICY "Employers can delete user accounts in their company"
  ON user_accounts FOR DELETE
  TO anon
  USING (
    employee_id IN (
      SELECT id FROM employees 
      WHERE company_id IN (
        SELECT company_id FROM user_accounts 
        WHERE email = current_setting('app.current_user_email', true)
        AND role = 'employer'
      )
    )
  );

-- Add UPDATE policy for user_accounts
CREATE POLICY "Users can update their own account"
  ON user_accounts FOR UPDATE
  TO anon
  USING (email = current_setting('app.current_user_email', true))
  WITH CHECK (email = current_setting('app.current_user_email', true));

CREATE POLICY "Employers can update accounts in their company"
  ON user_accounts FOR UPDATE
  TO anon
  USING (
    employee_id IN (
      SELECT id FROM employees 
      WHERE company_id IN (
        SELECT company_id FROM user_accounts 
        WHERE email = current_setting('app.current_user_email', true)
        AND role = 'employer'
      )
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT id FROM employees 
      WHERE company_id IN (
        SELECT company_id FROM user_accounts 
        WHERE email = current_setting('app.current_user_email', true)
        AND role = 'employer'
      )
    )
  );