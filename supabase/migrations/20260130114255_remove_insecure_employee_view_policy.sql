/*
  # Remove Insecure Employee View Policy

  1. Changes
    - Drop the "View employees in company" policy that allows viewing employees from ANY company
    - This policy had an OR clause: `company_id IN (SELECT companies.id FROM companies)` which bypasses company isolation
  
  2. Security
    - The remaining "Users can view employees in their company" policy properly enforces company isolation
    - Users can only view employees within their own company

  ## Critical Security Fix
  The dropped policy was allowing users to see employees from all companies, breaking multi-company data isolation.
*/

-- Drop the insecure policy that allows viewing employees from any company
DROP POLICY IF EXISTS "View employees in company" ON employees;