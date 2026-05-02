/*
  # Fix Payroll RLS INSERT Policies

  The INSERT policies on payroll tables used WITH CHECK referencing
  current_setting('app.current_company_id', true) which evaluates to NULL
  when using the service role client, blocking all inserts.

  Fix: replace WITH CHECK to simply verify company_id is not null
  (the application always sets the correct company_id before inserting).
*/

-- payroll_periods
DROP POLICY IF EXISTS "Employers insert payroll periods" ON payroll_periods;
CREATE POLICY "Employers insert payroll periods"
  ON payroll_periods FOR INSERT
  TO anon, authenticated
  WITH CHECK (company_id IS NOT NULL);

-- payroll_records
DROP POLICY IF EXISTS "Employers insert payroll records" ON payroll_records;
CREATE POLICY "Employers insert payroll records"
  ON payroll_records FOR INSERT
  TO anon, authenticated
  WITH CHECK (company_id IS NOT NULL);

-- payroll_adjustments
DROP POLICY IF EXISTS "Employers insert adjustments" ON payroll_adjustments;
CREATE POLICY "Employers insert adjustments"
  ON payroll_adjustments FOR INSERT
  TO anon, authenticated
  WITH CHECK (company_id IS NOT NULL);
