/*
  # Fix Employee RLS to Maintain Company Isolation

  1. Problem
    - The "Allow fetching employee during login" policy is too permissive
    - It allows viewing ANY employee as long as they exist in user_accounts
    - This breaks multi-company data isolation

  2. Solution
    - Drop the overly permissive policy
    - Create a more restrictive policy that checks company_id match
    - During login, we'll ensure the company context is set before fetching employee data

  3. Changes
    - Remove the insecure "Allow fetching employee during login" policy
    - The existing "Users can view employees in their company" policy is sufficient
*/

-- Drop the overly permissive policy that breaks company isolation
DROP POLICY IF EXISTS "Allow fetching employee during login" ON employees;
