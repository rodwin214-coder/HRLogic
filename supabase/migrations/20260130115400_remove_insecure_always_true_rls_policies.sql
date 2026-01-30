/*
  # Remove Insecure Always-True RLS Policies

  1. Security Fixes
    - Remove RLS policies with "true" checks that bypass security
    - These policies were initially created for registration but are too permissive
    - The registration flow already works without these policies due to other policies in place
  
  2. Policies Removed
    - companies: "Allow company registration" (INSERT)
    - companies: "Allow updating companies" (UPDATE)
    - employees: "Allow employee creation" (INSERT)
    - leave_policies: "Allow leave policy creation" (INSERT)
    - user_accounts: "Allow account creation" (INSERT)
  
  3. Security Impact
    - Registration still works through proper company-scoped policies
    - Prevents unauthorized data creation/modification
*/

-- Remove insecure policies from companies table
DROP POLICY IF EXISTS "Allow company registration" ON companies;
DROP POLICY IF EXISTS "Allow updating companies" ON companies;

-- Remove insecure policy from employees table
DROP POLICY IF EXISTS "Allow employee creation" ON employees;

-- Remove insecure policy from leave_policies table
DROP POLICY IF EXISTS "Allow leave policy creation" ON leave_policies;

-- Remove insecure policy from user_accounts table
DROP POLICY IF EXISTS "Allow account creation" ON user_accounts;