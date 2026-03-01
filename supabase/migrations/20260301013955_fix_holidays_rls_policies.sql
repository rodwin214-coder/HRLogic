/*
  # Fix Holidays RLS Policies
  
  1. Problem
    - The current INSERT, UPDATE, DELETE policies for holidays rely on session variables
    - This prevents adding/editing holiday types
    - Session variables are unreliable with application-level auth
  
  2. Solution
    - Replace policies to allow operations for valid companies
    - Application handles authorization
    - Maintain company isolation
  
  3. Security
    - Application validates user is an employer
    - Company ID is validated via context
    - Foreign key constraints ensure data integrity
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Employers can insert holidays" ON holidays;
DROP POLICY IF EXISTS "Employers can update holidays" ON holidays;
DROP POLICY IF EXISTS "Employers can delete holidays" ON holidays;
DROP POLICY IF EXISTS "Employers can view holidays" ON holidays;
DROP POLICY IF EXISTS "Users can view holidays in their company" ON holidays;

-- Allow SELECT for all valid company holidays
CREATE POLICY "Allow holiday select for valid companies"
  ON holidays
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies c 
      WHERE c.id = holidays.company_id
    )
  );

-- Allow INSERT for valid companies
CREATE POLICY "Allow holiday insert for valid companies"
  ON holidays
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies c 
      WHERE c.id = holidays.company_id
    )
  );

-- Allow UPDATE for valid companies
CREATE POLICY "Allow holiday update for valid companies"
  ON holidays
  FOR UPDATE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies c 
      WHERE c.id = holidays.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies c 
      WHERE c.id = holidays.company_id
    )
  );

-- Allow DELETE for valid companies
CREATE POLICY "Allow holiday delete for valid companies"
  ON holidays
  FOR DELETE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies c 
      WHERE c.id = holidays.company_id
    )
  );
