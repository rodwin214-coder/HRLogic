/*
  # Create employee_files table

  1. New Tables
    - `employee_files`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `employee_id` (uuid, foreign key to employees)
      - `file_name` (text) - original file name
      - `file_type` (text) - MIME type
      - `file_size` (bigint) - file size in bytes
      - `file_data` (text) - base64 encoded file data
      - `description` (text, optional) - file description
      - `uploaded_by` (uuid, foreign key to employees) - who uploaded the file
      - `uploaded_at` (timestamptz) - when file was uploaded
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `employee_files` table
    - Add policy for employers to manage files
    - Add policy for employees to view their own files
*/

CREATE TABLE IF NOT EXISTS employee_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  file_data text NOT NULL,
  description text,
  uploaded_by uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE employee_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employers can manage all employee files"
  ON employee_files
  FOR ALL
  USING (
    company_id IN (
      SELECT e.company_id
      FROM employees e
      INNER JOIN user_accounts ua ON ua.employee_id = e.id
      WHERE ua.email = current_setting('app.current_user_email', true)
      AND ua.role = 'employer'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT e.company_id
      FROM employees e
      INNER JOIN user_accounts ua ON ua.employee_id = e.id
      WHERE ua.email = current_setting('app.current_user_email', true)
      AND ua.role = 'employer'
    )
  );

CREATE POLICY "Employees can view their own files"
  ON employee_files
  FOR SELECT
  USING (
    employee_id IN (
      SELECT e.id
      FROM employees e
      INNER JOIN user_accounts ua ON ua.employee_id = e.id
      WHERE ua.email = current_setting('app.current_user_email', true)
    )
  );

CREATE INDEX IF NOT EXISTS idx_employee_files_company_id ON employee_files(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_files_employee_id ON employee_files(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_files_uploaded_at ON employee_files(uploaded_at DESC);
