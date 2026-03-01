/*
  # Add Custom Holiday Types Table

  1. New Tables
    - `custom_holiday_types`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `type_name` (text, the custom holiday type name)
      - `created_at` (timestamp)
  
  2. Security
    - Enable RLS on `custom_holiday_types` table
    - Add policy for all users in the same company to read custom types
    - Add policy for employers to insert custom types
    - Add policy for employers to delete custom types
  
  3. Changes
    - Adds ability to persist custom holiday types to the database
    - Custom types are company-specific
    - Ensures unique type names per company
*/

-- Create custom_holiday_types table
CREATE TABLE IF NOT EXISTS custom_holiday_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, type_name)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_custom_holiday_types_company_id ON custom_holiday_types(company_id);

-- Enable RLS
ALTER TABLE custom_holiday_types ENABLE ROW LEVEL SECURITY;

-- Policy for reading custom holiday types (all users in the company)
CREATE POLICY "Users can view custom holiday types in their company"
  ON custom_holiday_types
  FOR SELECT
  TO public
  USING (
    company_id IN (
      SELECT company_id FROM employees WHERE id = current_setting('app.current_employee_id', true)::uuid
    )
  );

-- Policy for inserting custom holiday types (employers only)
CREATE POLICY "Employers can insert custom holiday types"
  ON custom_holiday_types
  FOR INSERT
  TO public
  WITH CHECK (
    company_id IN (
      SELECT e.company_id 
      FROM employees e
      JOIN user_accounts ua ON ua.employee_id = e.id
      WHERE e.id = current_setting('app.current_employee_id', true)::uuid 
      AND ua.role = 'employer'
    )
  );

-- Policy for deleting custom holiday types (employers only)
CREATE POLICY "Employers can delete custom holiday types"
  ON custom_holiday_types
  FOR DELETE
  TO public
  USING (
    company_id IN (
      SELECT e.company_id 
      FROM employees e
      JOIN user_accounts ua ON ua.employee_id = e.id
      WHERE e.id = current_setting('app.current_employee_id', true)::uuid 
      AND ua.role = 'employer'
    )
  );
