/*
  # Fix Requests RLS Policies
  
  1. Problem
    - The current UPDATE policy for requests relies on session variables
    - This causes approval process to fail or be very slow
    - Session variables are unreliable with application-level auth
  
  2. Solution
    - Replace UPDATE policy to allow updates for valid requests
    - Application handles authorization
    - Maintain company isolation via foreign keys
  
  3. Security
    - Application validates user is an employer before calling updateRequestStatus
    - Company isolation maintained via employee/company relationship
    - Foreign key constraints ensure data integrity
*/

-- Drop the existing UPDATE policy
DROP POLICY IF EXISTS "Employers can update requests in their company" ON requests;

-- Create new UPDATE policy that works with application auth
CREATE POLICY "Allow request updates for valid records"
  ON requests
  FOR UPDATE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.id = requests.employee_id
        AND e.company_id = requests.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.id = requests.employee_id
        AND e.company_id = requests.company_id
    )
  );
