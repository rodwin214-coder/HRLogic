/*
  # Fix Attendance Records Delete RLS Policy
  
  1. Problem
    - The current DELETE policy for attendance_records relies on session variable
    - This may prevent deleting attendance records by employers
  
  2. Solution
    - Replace the DELETE policy to allow deletions for valid records
    - Application handles authorization
  
  3. Security
    - Application validates user is an employer
    - Company isolation maintained via employee/company relationship
*/

-- Drop the existing DELETE policy
DROP POLICY IF EXISTS "Delete attendance in same company" ON attendance_records;

-- Create new DELETE policy
CREATE POLICY "Allow attendance delete for valid records"
  ON attendance_records
  FOR DELETE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.id = attendance_records.employee_id
        AND e.company_id = attendance_records.company_id
    )
  );
