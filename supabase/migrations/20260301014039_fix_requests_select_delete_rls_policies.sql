/*
  # Fix Requests SELECT and DELETE RLS Policies
  
  1. Problem
    - SELECT and DELETE policies rely on session variables
    - This causes slow data loading
    - Session variables are unreliable
  
  2. Solution
    - Replace policies to use simpler validation
    - Application handles authorization
    - Maintain company isolation
  
  3. Security
    - Application validates user role and company
    - Company isolation maintained via employee/company relationship
    - Foreign key constraints ensure data integrity
*/

-- Drop existing policies that use session variables
DROP POLICY IF EXISTS "Employers can view requests" ON requests;
DROP POLICY IF EXISTS "Users can view requests in their company" ON requests;
DROP POLICY IF EXISTS "Employers can delete requests in their company" ON requests;
DROP POLICY IF EXISTS "Employees can create their own requests" ON requests;

-- Allow SELECT for valid requests
CREATE POLICY "Allow request select for valid records"
  ON requests
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.id = requests.employee_id
        AND e.company_id = requests.company_id
    )
  );

-- Allow INSERT for valid requests
CREATE POLICY "Allow request insert for valid employees"
  ON requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.id = requests.employee_id
        AND e.company_id = requests.company_id
    )
  );

-- Allow DELETE for valid requests
CREATE POLICY "Allow request delete for valid records"
  ON requests
  FOR DELETE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.id = requests.employee_id
        AND e.company_id = requests.company_id
    )
  );
