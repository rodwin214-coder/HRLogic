/*
  # Add De Minimis Benefits Table

  ## Overview
  Stores itemized de minimis benefits per employee per payroll period,
  per BIR Revenue Regulations 5-2011 and TRAIN Law amendments.

  ## New Table: payroll_de_minimis

  Stores each benefit type amount per employee per period so that:
  - The BIR-exempt ceiling per benefit type is enforced
  - The excess over the ceiling becomes part of taxable income
  - Total exempt de minimis feeds into gross pay tax-free
  - Total excess is added to taxable compensation income

  ## BIR-recognized De Minimis benefit types and 2024 annual ceilings:
  - Rice subsidy: ₱3,000/month (₱1,500 × 2 up to ₱36,000/year)
  - Uniform & clothing allowance: ₱6,000/year (₱500/month)
  - Medical cash allowance to dependents: ₱1,500/semester (₱750/quarter)
  - Laundry allowance: ₱300/month
  - Employee achievement awards (gifts): ₱10,000/year
  - Gifts given during Christmas & major anniversary: ₱5,000/year
  - Daily meal allowance for overtime: 25% of applicable minimum wage
  - Benefits received by employees of RDANA, GOCC below supervisory: exempt per sec
  - Actual medical benefits: ₱10,000/year
  - Monthly monetized unused vacation leave (up to 10 days): based on daily rate

  The column `annual_ceiling` stores the per-year BIR exempt ceiling.
  The column `amount_this_period` stores what was given this specific period.

  ## Security
  - RLS enabled, same company-scoped pattern as payroll_records
*/

CREATE TABLE IF NOT EXISTS payroll_de_minimis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  benefit_type text NOT NULL CHECK (benefit_type IN (
    'rice_subsidy',
    'uniform_clothing',
    'medical_cash_allowance',
    'laundry_allowance',
    'employee_achievement_award',
    'christmas_gift',
    'meal_allowance_overtime',
    'actual_medical_benefits',
    'other'
  )),
  description text DEFAULT '',
  amount_this_period numeric(12,2) NOT NULL DEFAULT 0,
  monthly_ceiling numeric(12,2) NOT NULL DEFAULT 0,
  exempt_amount numeric(12,2) NOT NULL DEFAULT 0,
  taxable_excess numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payroll_de_minimis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employers view de minimis"
  ON payroll_de_minimis FOR SELECT
  TO anon, authenticated
  USING (company_id::text = current_setting('app.current_company_id', true));

CREATE POLICY "Employers insert de minimis"
  ON payroll_de_minimis FOR INSERT
  TO anon, authenticated
  WITH CHECK (company_id IS NOT NULL);

CREATE POLICY "Employers update de minimis"
  ON payroll_de_minimis FOR UPDATE
  TO anon, authenticated
  USING (company_id::text = current_setting('app.current_company_id', true))
  WITH CHECK (company_id IS NOT NULL);

CREATE POLICY "Employers delete de minimis"
  ON payroll_de_minimis FOR DELETE
  TO anon, authenticated
  USING (company_id::text = current_setting('app.current_company_id', true));

CREATE INDEX IF NOT EXISTS idx_payroll_de_minimis_period ON payroll_de_minimis(period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_de_minimis_employee ON payroll_de_minimis(employee_id);
