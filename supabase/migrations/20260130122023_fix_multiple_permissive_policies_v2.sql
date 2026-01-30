/*
  # Fix Multiple Permissive Policies

  1. Problem
    - Multiple permissive policies for the same role/action
    - employee_files has two SELECT policies for anon/authenticated
    - user_accounts has two SELECT policies for anon
  
  2. Solution
    - Consolidate policies using OR conditions
  
  3. Security
    - Maintains same access control with better performance
*/

-- Fix employee_files SELECT policies
DROP POLICY IF EXISTS "Employees can view their own files" ON employee_files;
DROP POLICY IF EXISTS "Employers can view employee files" ON employee_files;

CREATE POLICY "Users can view employee files"
  ON employee_files
  FOR SELECT
  TO anon, authenticated
  USING (
    -- Employers can view all files in their company
    EXISTS (
      SELECT 1
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
      AND ua.role = 'employer'
      AND ua.company_id = employee_files.company_id
    )
    OR
    -- Employees can view their own files
    EXISTS (
      SELECT 1
      FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
      AND ua.employee_id = employee_files.employee_id
    )
  );

-- Fix user_accounts SELECT policies
DROP POLICY IF EXISTS "Allow login verification" ON user_accounts;
DROP POLICY IF EXISTS "Users can view their own account" ON user_accounts;

CREATE POLICY "Users can view accounts"
  ON user_accounts
  FOR SELECT
  TO anon, authenticated
  USING (
    -- Anyone can read for login verification (email/password matching)
    true
  );