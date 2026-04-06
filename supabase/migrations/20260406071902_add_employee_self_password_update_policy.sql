/*
  # Add Employee Self Password Update Policy

  1. Changes
    - Add policy to allow employees to update their own password
    - This enables the change password feature in the employee dashboard

  2. Security
    - Employees can only update their own password
    - Uses session variables for authentication
*/

CREATE POLICY "Employees can update their own password"
  ON user_accounts FOR UPDATE
  TO anon, authenticated
  USING (
    employee_id IN (
      SELECT employee_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT employee_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );
