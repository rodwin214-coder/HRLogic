/*
  # Multi-Company WorkLogix Schema

  This migration creates the complete multi-tenant database schema for WorkLogix.

  ## New Tables

  ### 1. companies
  - `id` (uuid, primary key)
  - `company_code` (text, unique) - Used for login identification
  - `name` (text)
  - `address` (text)
  - `contact_number` (text)
  - `email` (text)
  - `tin` (text)
  - `logo` (text) - base64 or URL
  - `work_schedule` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. user_accounts
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key)
  - `email` (text)
  - `password_hash` (text)
  - `role` (text) - 'employee' or 'employer'
  - `employee_id` (uuid, foreign key)
  - `created_at` (timestamptz)

  ### 3. employees
  - All employee data with company_id foreign key

  ### 4. shifts, holidays, attendance_records, requests, tasks, etc.
  - All with company_id for data isolation

  ## Security
  - Enable RLS on all tables
  - Policies ensure users can only access data from their company
*/

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_code text UNIQUE NOT NULL,
  name text NOT NULL,
  address text,
  contact_number text,
  email text,
  tin text,
  logo text,
  work_schedule text DEFAULT 'Monday to Friday',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id text NOT NULL,
  email text NOT NULL,
  first_name text NOT NULL,
  middle_name text,
  last_name text NOT NULL,
  address text,
  birthdate date,
  mobile_number text,
  department text,
  tin_number text,
  sss_number text,
  pagibig_number text,
  philhealth_number text,
  date_hired date NOT NULL DEFAULT CURRENT_DATE,
  date_terminated date,
  status text DEFAULT 'Active',
  employment_type text DEFAULT 'Probationary',
  shift_id uuid,
  work_schedule text,
  profile_picture text,
  vacation_leave_adjustment numeric DEFAULT 0,
  sick_leave_adjustment numeric DEFAULT 0,
  custom_fields jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, employee_id),
  UNIQUE(company_id, email)
);

-- Create user_accounts table
CREATE TABLE IF NOT EXISTS user_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('employee', 'employer')),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, email)
);

-- Create shifts table
CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create salary_history table
CREATE TABLE IF NOT EXISTS salary_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  effective_date date NOT NULL,
  basic_salary numeric NOT NULL,
  allowance numeric DEFAULT 0,
  other_benefits numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create attendance_records table
CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  clock_in_time timestamptz NOT NULL,
  clock_in_photo text,
  clock_in_location jsonb,
  clock_out_time timestamptz,
  clock_out_photo text,
  clock_out_location jsonb,
  end_of_day_notes text,
  manual_entry_reason text,
  created_at timestamptz DEFAULT now()
);

-- Create requests table
CREATE TABLE IF NOT EXISTS requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  request_type text NOT NULL,
  status text DEFAULT 'Pending',
  date_filed timestamptz DEFAULT now(),
  leave_type text,
  start_date date,
  end_date date,
  date text,
  hours numeric,
  reason text,
  changes jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create holidays table
CREATE TABLE IF NOT EXISTS holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  date date NOT NULL,
  country text DEFAULT 'PH',
  holiday_type text DEFAULT 'Regular',
  created_at timestamptz DEFAULT now()
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date date NOT NULL,
  status text DEFAULT 'To Do',
  date_created timestamptz DEFAULT now(),
  date_completed timestamptz
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  editor_id uuid NOT NULL REFERENCES employees(id),
  timestamp timestamptz DEFAULT now(),
  changes jsonb NOT NULL
);

-- Create leave_policies table
CREATE TABLE IF NOT EXISTS leave_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid UNIQUE NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  base_vacation_days_per_year numeric DEFAULT 15,
  base_sick_days_per_year numeric DEFAULT 10,
  tenure_bonus_enabled boolean DEFAULT true,
  tenure_bonus_years_interval numeric DEFAULT 2,
  max_tenure_bonus_days numeric DEFAULT 5,
  created_at timestamptz DEFAULT now()
);

-- Create custom_field_definitions table
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  field_type text NOT NULL,
  options jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add foreign key for shift_id after shifts table is created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'employees_shift_id_fkey'
  ) THEN
    ALTER TABLE employees 
    ADD CONSTRAINT employees_shift_id_fkey 
    FOREIGN KEY (shift_id) REFERENCES shifts(id);
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for companies
CREATE POLICY "Users can view their own company"
  ON companies FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Users can update their own company"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

-- RLS Policies for employees
CREATE POLICY "Users can view employees in their company"
  ON employees FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Employers can manage employees in their company"
  ON employees FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

CREATE POLICY "Employees can update their own record"
  ON employees FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT employee_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

-- RLS Policies for user_accounts
CREATE POLICY "Users can view their own account"
  ON user_accounts FOR SELECT
  TO authenticated
  USING (email = current_setting('app.current_user_email', true));

-- RLS Policies for shifts
CREATE POLICY "Users can view shifts in their company"
  ON shifts FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Employers can manage shifts in their company"
  ON shifts FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

-- RLS Policies for attendance_records
CREATE POLICY "Users can view attendance in their company"
  ON attendance_records FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Employees can insert their own attendance"
  ON attendance_records FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id IN (
      SELECT employee_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Employers can manage attendance in their company"
  ON attendance_records FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

-- RLS Policies for requests
CREATE POLICY "Users can view requests in their company"
  ON requests FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Employees can create their own requests"
  ON requests FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id IN (
      SELECT employee_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Employers can manage requests in their company"
  ON requests FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

-- Similar RLS policies for other tables
CREATE POLICY "Users can view holidays in their company"
  ON holidays FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Employers can manage holidays"
  ON holidays FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

CREATE POLICY "Users can view tasks in their company"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Users can manage tasks in their company"
  ON tasks FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Users can view audit logs in their company"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Users can view leave policy in their company"
  ON leave_policies FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Employers can manage leave policy"
  ON leave_policies FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

CREATE POLICY "Users can view custom fields in their company"
  ON custom_field_definitions FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Employers can manage custom fields"
  ON custom_field_definitions FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_accounts 
      WHERE email = current_setting('app.current_user_email', true)
      AND role = 'employer'
    )
  );

CREATE POLICY "Users can view salary history in their company"
  ON salary_history FOR SELECT
  TO authenticated
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
  TO authenticated
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_user_accounts_company_email ON user_accounts(company_id, email);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_company ON attendance_records(company_id);
CREATE INDEX IF NOT EXISTS idx_requests_employee ON requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_requests_company ON requests(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_employee ON tasks(employee_id);
CREATE INDEX IF NOT EXISTS idx_companies_code ON companies(company_code);
