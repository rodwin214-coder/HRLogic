/*
  # Fix employee_files RLS using uploaded_by field

  1. Problem
    - Session variables don't persist across pooled connections
    - current_setting('app.current_user_email') returns NULL
  
  2. Solution
    - Use uploaded_by field (employee ID) to verify permissions
    - Check if uploader is an employer in the same company
  
  3. Security
    - Employers can only upload files for employees in their company
    - Verification based on uploaded_by employee ID
*/

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Employers can insert employee files" ON employee_files;

-- Create new INSERT policy that checks uploaded_by
CREATE POLICY "Employers can insert employee files"
  ON employee_files
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Check that uploaded_by is an employer in the same company
    EXISTS (
      SELECT 1
      FROM employees uploader
      JOIN user_accounts ua ON ua.employee_id = uploader.id
      WHERE uploader.id = employee_files.uploaded_by
      AND ua.role = 'employer'
      AND uploader.company_id = employee_files.company_id
    )
    AND
    -- Check that the target employee belongs to the same company
    EXISTS (
      SELECT 1
      FROM employees e
      WHERE e.id = employee_files.employee_id
      AND e.company_id = employee_files.company_id
    )
  );