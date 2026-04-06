/*
  # Add Employer Password Management Policies

  1. Changes
    - Add policy to allow employers to view employee passwords in their company
    - Add policy to allow employers to update employee passwords in their company
    - This enables the password management feature in the employee details modal

  2. Security
    - Only employers (role = 'employer') can view/update passwords
    - Employers can only manage passwords for employees in their own company
    - Uses session variables for authentication
*/

CREATE POLICY "Employers can view employee passwords in their company"
  ON user_accounts FOR SELECT
  TO anon, authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

CREATE POLICY "Employers can update employee passwords in their company"
  ON user_accounts FOR UPDATE
  TO anon, authenticated
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
