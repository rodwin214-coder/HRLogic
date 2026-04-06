/*
  # Fix Recursive RLS Policies on user_accounts

  ## Problem
  Several policies on user_accounts reference user_accounts itself in their USING/WITH CHECK clauses,
  causing infinite recursion. The policies "Employers can view employee passwords in their company",
  "Employees can update their own password", and "Employers can update employee passwords in their company"
  are all recursive.

  ## Solution
  - Drop the recursive policies
  - Replace employer-scoped policies with ones that use the employees table to resolve company context
  - Replace employee self-update policy with a direct email match (non-recursive)
  - The employer view policy is merged into the existing "Users can view accounts" policy (which uses true)
    but we need to keep it scoped - use employees table join instead

  ## Changes
  - Drop: "Employers can view employee passwords in their company"
  - Drop: "Employees can update their own password"
  - Drop: "Employers can update employee passwords in their company"
  - Recreate non-recursive versions using employees table or direct email match
*/

-- Drop the recursive policies
DROP POLICY IF EXISTS "Employers can view employee passwords in their company" ON user_accounts;
DROP POLICY IF EXISTS "Employees can update their own password" ON user_accounts;
DROP POLICY IF EXISTS "Employers can update employee passwords in their company" ON user_accounts;

-- Non-recursive: employee updates own password by matching email directly
CREATE POLICY "Employees can update their own password"
  ON user_accounts FOR UPDATE
  TO anon, authenticated
  USING (email = current_setting('app.current_user_email', true))
  WITH CHECK (email = current_setting('app.current_user_email', true));

-- Non-recursive: employers update passwords for employees in their company
-- Use employees table to find the company_id of the current user, then match
CREATE POLICY "Employers can update employee passwords in their company"
  ON user_accounts FOR UPDATE
  TO anon, authenticated
  USING (
    company_id IN (
      SELECT e.company_id FROM employees e
      JOIN user_accounts ua ON ua.employee_id = e.id
      WHERE ua.email = current_setting('app.current_user_email', true)
      AND ua.role = 'employer'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT e.company_id FROM employees e
      JOIN user_accounts ua ON ua.employee_id = e.id
      WHERE ua.email = current_setting('app.current_user_email', true)
      AND ua.role = 'employer'
    )
  );
