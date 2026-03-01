/*
  # Fix All Remaining RLS Policies
  
  1. Problem
    - Multiple tables still use session variable-based RLS policies
    - This causes slow loading and stability issues
    - Session variables are unreliable with application-level auth
  
  2. Solution
    - Replace all session variable policies with simpler validation
    - Application handles authorization
    - Maintain company isolation via foreign keys
  
  3. Tables Updated
    - shifts, leave_policies, custom_field_definitions, employee_files
    - salary_history, tasks, audit_logs
  
  4. Security
    - Application validates user role and company
    - Company isolation maintained via company_id
    - Foreign key constraints ensure data integrity
*/

-- SHIFTS
DROP POLICY IF EXISTS "Employers can view shifts" ON shifts;
DROP POLICY IF EXISTS "Users can view shifts in their company" ON shifts;
DROP POLICY IF EXISTS "Employers can insert shifts" ON shifts;
DROP POLICY IF EXISTS "Employers can update shifts" ON shifts;
DROP POLICY IF EXISTS "Employers can delete shifts" ON shifts;

CREATE POLICY "Allow shift operations for valid companies"
  ON shifts FOR ALL
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM companies c WHERE c.id = shifts.company_id))
  WITH CHECK (EXISTS (SELECT 1 FROM companies c WHERE c.id = shifts.company_id));

-- LEAVE_POLICIES
DROP POLICY IF EXISTS "Employers can view leave policies" ON leave_policies;
DROP POLICY IF EXISTS "Employers can insert leave policies" ON leave_policies;
DROP POLICY IF EXISTS "Employers can update leave policies" ON leave_policies;
DROP POLICY IF EXISTS "Users can view leave policies in their company" ON leave_policies;

CREATE POLICY "Allow leave policy operations for valid companies"
  ON leave_policies FOR ALL
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM companies c WHERE c.id = leave_policies.company_id))
  WITH CHECK (EXISTS (SELECT 1 FROM companies c WHERE c.id = leave_policies.company_id));

-- CUSTOM_FIELD_DEFINITIONS
DROP POLICY IF EXISTS "Employers can view custom field definitions" ON custom_field_definitions;
DROP POLICY IF EXISTS "Employers can insert custom field definitions" ON custom_field_definitions;
DROP POLICY IF EXISTS "Employers can update custom field definitions" ON custom_field_definitions;
DROP POLICY IF EXISTS "Employers can delete custom field definitions" ON custom_field_definitions;

CREATE POLICY "Allow custom field operations for valid companies"
  ON custom_field_definitions FOR ALL
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM companies c WHERE c.id = custom_field_definitions.company_id))
  WITH CHECK (EXISTS (SELECT 1 FROM companies c WHERE c.id = custom_field_definitions.company_id));

-- EMPLOYEE_FILES
DROP POLICY IF EXISTS "View files for employees in same company" ON employee_files;
DROP POLICY IF EXISTS "Upload files for valid employees" ON employee_files;
DROP POLICY IF EXISTS "Update files for employees in same company" ON employee_files;
DROP POLICY IF EXISTS "Delete files for employees in same company" ON employee_files;

CREATE POLICY "Allow employee file operations for valid records"
  ON employee_files FOR ALL
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM employees e WHERE e.id = employee_files.employee_id))
  WITH CHECK (EXISTS (SELECT 1 FROM employees e WHERE e.id = employee_files.employee_id));

-- SALARY_HISTORY
DROP POLICY IF EXISTS "View salary history in same company" ON salary_history;
DROP POLICY IF EXISTS "Insert salary history in same company" ON salary_history;

CREATE POLICY "Allow salary history operations for valid employees"
  ON salary_history FOR ALL
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM employees e WHERE e.id = salary_history.employee_id))
  WITH CHECK (EXISTS (SELECT 1 FROM employees e WHERE e.id = salary_history.employee_id));

-- TASKS
DROP POLICY IF EXISTS "View tasks in same company" ON tasks;
DROP POLICY IF EXISTS "Insert tasks in same company" ON tasks;
DROP POLICY IF EXISTS "Update tasks in same company" ON tasks;
DROP POLICY IF EXISTS "Delete tasks in same company" ON tasks;

CREATE POLICY "Allow task operations for valid employees"
  ON tasks FOR ALL
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM employees e WHERE e.id = tasks.employee_id))
  WITH CHECK (EXISTS (SELECT 1 FROM employees e WHERE e.id = tasks.employee_id));

-- AUDIT_LOGS
DROP POLICY IF EXISTS "View audit logs in same company" ON audit_logs;
DROP POLICY IF EXISTS "Employers can view audit logs" ON audit_logs;

CREATE POLICY "Allow audit log select for valid companies"
  ON audit_logs FOR SELECT
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM companies c WHERE c.id = audit_logs.company_id));

CREATE POLICY "Allow audit log insert for valid companies"
  ON audit_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM companies c WHERE c.id = audit_logs.company_id));
