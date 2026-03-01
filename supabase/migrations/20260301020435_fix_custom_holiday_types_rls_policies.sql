/*
  # Fix Custom Holiday Types RLS Policies

  1. Changes
    - Drop existing policies that use incorrect session variable
    - Create new policies using correct session variable (app.current_user_email)
    - Follow the same pattern as other tables in the system
  
  2. Security
    - Ensure all users in company can read custom holiday types
    - Only employers can insert/delete custom holiday types
*/

-- Drop existing incorrect policies
DROP POLICY IF EXISTS "Users can view custom holiday types in their company" ON custom_holiday_types;
DROP POLICY IF EXISTS "Employers can insert custom holiday types" ON custom_holiday_types;
DROP POLICY IF EXISTS "Employers can delete custom holiday types" ON custom_holiday_types;

-- Policy for reading custom holiday types (all users in the company)
CREATE POLICY "Users can view custom holiday types in their company"
  ON custom_holiday_types
  FOR SELECT
  TO public
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

-- Policy for inserting custom holiday types (employers only)
CREATE POLICY "Employers can insert custom holiday types"
  ON custom_holiday_types
  FOR INSERT
  TO public
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

-- Policy for deleting custom holiday types (employers only)
CREATE POLICY "Employers can delete custom holiday types"
  ON custom_holiday_types
  FOR DELETE
  TO public
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );
