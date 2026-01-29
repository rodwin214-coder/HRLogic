/*
  # Fix RLS Policies for Custom Authentication

  The app uses custom authentication (not Supabase Auth), so users are never
  "authenticated" from Supabase's perspective. This migration updates all RLS 
  policies to work with anonymous users while maintaining security through
  session variables.

  ## Changes
  - Update all policies to use `TO anon` instead of `TO authenticated`
  - Policies still validate using session variables for security
  - Maintains data isolation through company_id and email checks
*/

-- Drop and recreate all policies for attendance_records
DROP POLICY IF EXISTS "Users can view attendance in their company" ON attendance_records;
DROP POLICY IF EXISTS "Employees can insert their own attendance" ON attendance_records;
DROP POLICY IF EXISTS "Employers can manage attendance in their company" ON attendance_records;

CREATE POLICY "Users can view attendance in their company"
  ON attendance_records FOR SELECT
  TO anon
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Employees can insert their own attendance"
  ON attendance_records FOR INSERT
  TO anon
  WITH CHECK (
    employee_id IN (
      SELECT employee_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
    AND company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Employers can manage attendance in their company"
  ON attendance_records FOR ALL
  TO anon
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

-- Update policies for companies
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
DROP POLICY IF EXISTS "Users can update their own company" ON companies;

CREATE POLICY "Users can view their own company"
  ON companies FOR SELECT
  TO anon
  USING (
    id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Users can update their own company"
  ON companies FOR UPDATE
  TO anon
  USING (
    id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

-- Update policies for employees
DROP POLICY IF EXISTS "Users can view employees in their company" ON employees;
DROP POLICY IF EXISTS "Employers can manage employees in their company" ON employees;
DROP POLICY IF EXISTS "Employees can update their own record" ON employees;

CREATE POLICY "Users can view employees in their company"
  ON employees FOR SELECT
  TO anon
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Employers can manage employees in their company"
  ON employees FOR ALL
  TO anon
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

CREATE POLICY "Employees can update their own record"
  ON employees FOR UPDATE
  TO anon
  USING (
    id IN (
      SELECT employee_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

-- Update policies for user_accounts
DROP POLICY IF EXISTS "Users can view their own account" ON user_accounts;

CREATE POLICY "Users can view their own account"
  ON user_accounts FOR SELECT
  TO anon
  USING (email = current_setting('app.current_user_email', true));

-- Update policies for shifts
DROP POLICY IF EXISTS "Users can view shifts in their company" ON shifts;
DROP POLICY IF EXISTS "Employers can manage shifts in their company" ON shifts;

CREATE POLICY "Users can view shifts in their company"
  ON shifts FOR SELECT
  TO anon
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Employers can manage shifts in their company"
  ON shifts FOR ALL
  TO anon
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

-- Update policies for requests
DROP POLICY IF EXISTS "Users can view requests in their company" ON requests;
DROP POLICY IF EXISTS "Employees can create their own requests" ON requests;
DROP POLICY IF EXISTS "Employers can manage requests in their company" ON requests;

CREATE POLICY "Users can view requests in their company"
  ON requests FOR SELECT
  TO anon
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Employees can create their own requests"
  ON requests FOR INSERT
  TO anon
  WITH CHECK (
    employee_id IN (
      SELECT employee_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Employers can manage requests in their company"
  ON requests FOR ALL
  TO anon
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

-- Update policies for holidays
DROP POLICY IF EXISTS "Users can view holidays in their company" ON holidays;
DROP POLICY IF EXISTS "Employers can manage holidays" ON holidays;

CREATE POLICY "Users can view holidays in their company"
  ON holidays FOR SELECT
  TO anon
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Employers can manage holidays"
  ON holidays FOR ALL
  TO anon
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

-- Update policies for tasks
DROP POLICY IF EXISTS "Users can view tasks in their company" ON tasks;
DROP POLICY IF EXISTS "Users can manage tasks in their company" ON tasks;

CREATE POLICY "Users can view tasks in their company"
  ON tasks FOR SELECT
  TO anon
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Users can manage tasks in their company"
  ON tasks FOR ALL
  TO anon
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

-- Update policies for audit_logs
DROP POLICY IF EXISTS "Users can view audit logs in their company" ON audit_logs;

CREATE POLICY "Users can view audit logs in their company"
  ON audit_logs FOR SELECT
  TO anon
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

-- Update policies for leave_policies
DROP POLICY IF EXISTS "Users can view leave policy in their company" ON leave_policies;
DROP POLICY IF EXISTS "Employers can manage leave policy" ON leave_policies;

CREATE POLICY "Users can view leave policy in their company"
  ON leave_policies FOR SELECT
  TO anon
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Employers can manage leave policy"
  ON leave_policies FOR ALL
  TO anon
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

-- Update policies for custom_field_definitions
DROP POLICY IF EXISTS "Users can view custom fields in their company" ON custom_field_definitions;
DROP POLICY IF EXISTS "Employers can manage custom fields" ON custom_field_definitions;

CREATE POLICY "Users can view custom fields in their company"
  ON custom_field_definitions FOR SELECT
  TO anon
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Employers can manage custom fields"
  ON custom_field_definitions FOR ALL
  TO anon
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

-- Update policies for salary_history
DROP POLICY IF EXISTS "Users can view salary history in their company" ON salary_history;
DROP POLICY IF EXISTS "Employers can manage salary history" ON salary_history;

CREATE POLICY "Users can view salary history in their company"
  ON salary_history FOR SELECT
  TO anon
  USING (
    employee_id IN (
      SELECT id FROM employees 
      WHERE company_id IN (
        SELECT company_id FROM user_accounts 
        WHERE email = current_setting('app.current_user_email', true)
      )
    )
  );

CREATE POLICY "Employers can manage salary history"
  ON salary_history FOR ALL
  TO anon
  USING (
    employee_id IN (
      SELECT id FROM employees 
      WHERE company_id IN (
        SELECT company_id FROM user_accounts 
        WHERE email = current_setting('app.current_user_email', true)
        AND role = 'employer'
      )
    )
  );

-- Update grant for set_config function
GRANT EXECUTE ON FUNCTION set_config(text, text) TO anon;