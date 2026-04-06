/*
  # Fix multiple permissive policies

  ## Summary
  Several tables have two permissive policies for the same role+action combination.
  PostgreSQL evaluates all permissive policies with OR logic, meaning both are checked
  per row. This creates redundancy, confusion, and potential security gaps.

  The fix is to remove the broad "Allow ... for valid companies/employees" ALL-action
  catch-all policies and keep only the specific, purpose-built policies that already
  provide proper access control via current_user_email checks.

  ## Tables Fixed
  - audit_logs: remove broad "Allow audit log select for valid companies"
  - companies: consolidate into single SELECT policy; "Users can view their company" is
    a superset of "Employers can view their company", so remove the employer-only one
  - custom_field_definitions: remove broad ALL policy
  - employee_files: remove broad ALL policy
  - employees: remove broad "Allow employee select for valid companies" (keep login-by-ID
    and add a proper company-scoped SELECT)
  - leave_policies: remove broad ALL policy
  - salary_history: remove broad ALL policy; consolidate duplicate SELECT policies
  - tasks: remove broad ALL policy; consolidate duplicate SELECT policies
  - user_accounts: consolidate duplicate UPDATE policies
*/

-- ==================== audit_logs ====================
-- Remove the broad catch-all SELECT (keeps "Users can view audit logs in their company")
DROP POLICY IF EXISTS "Allow audit log select for valid companies" ON public.audit_logs;

-- ==================== companies ====================
-- "Users can view their company" already covers what "Employers can view their company"
-- covers, so drop the narrower employer-only one
DROP POLICY IF EXISTS "Employers can view their company" ON public.companies;

-- ==================== custom_field_definitions ====================
-- Remove the broad ALL policy; specific per-action policies already handle access
DROP POLICY IF EXISTS "Allow custom field operations for valid companies" ON public.custom_field_definitions;

-- ==================== employee_files ====================
-- Remove the broad ALL policy; specific per-action policies already handle access
DROP POLICY IF EXISTS "Allow employee file operations for valid records" ON public.employee_files;

-- ==================== employees ====================
-- The broad "Allow employee select for valid companies" allows anyone who can see
-- ANY company to see ALL employees in it. Replace with the proper scoped policy.
DROP POLICY IF EXISTS "Allow employee select for valid companies" ON public.employees;
-- "Allow employee fetch during login by ID" is kept for the login flow.
-- Add a proper employee-scoped SELECT for logged-in users
DROP POLICY IF EXISTS "Employees and employers can view company employees" ON public.employees;
CREATE POLICY "Employees and employers can view company employees"
  ON public.employees FOR SELECT
  TO anon, authenticated
  USING (company_id IN (
    SELECT ua.company_id FROM user_accounts ua
    WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
  ));

-- ==================== leave_policies ====================
-- Remove the broad ALL policy; specific per-action policies already handle access
DROP POLICY IF EXISTS "Allow leave policy operations for valid companies" ON public.leave_policies;

-- ==================== salary_history ====================
-- Remove the broad ALL policy; specific per-action policies already handle access
DROP POLICY IF EXISTS "Allow salary history operations for valid employees" ON public.salary_history;
-- "Users can view salary history in their company" is a superset of
-- "Employers can view salary history", so drop the employer-only one
DROP POLICY IF EXISTS "Employers can view salary history" ON public.salary_history;

-- ==================== tasks ====================
-- Remove the broad ALL policy; specific per-action policies already handle access
DROP POLICY IF EXISTS "Allow task operations for valid employees" ON public.tasks;
-- "Users can view tasks in their company" and "Users can manage tasks in their company"
-- have identical definitions; keep one and drop the other
DROP POLICY IF EXISTS "Users can manage tasks in their company" ON public.tasks;

-- ==================== user_accounts ====================
-- "Employers can update accounts in their company" and
-- "Employers can update employee passwords in their company" have identical definitions;
-- keep one and drop the duplicate
DROP POLICY IF EXISTS "Employers can update employee passwords in their company" ON public.user_accounts;
