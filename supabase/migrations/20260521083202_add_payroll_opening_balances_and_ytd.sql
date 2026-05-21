/*
  # Payroll Opening Balances and YTD Support

  ## Summary
  Adds support for year-to-date (YTD) payroll tracking and opening balances, 
  enabling cumulative payroll reports, BIR 2316 generation, and employment certifications.

  ## New Tables
  - `payroll_opening_balances` — stores per-employee, per-year opening balances
    (earnings and deductions from before the system start date, e.g. manually keyed from previous payroll system)

  ## Modified Tables
  - `payroll_records` — adds YTD snapshot columns computed at the time of payroll generation:
    - `ytd_gross_pay`
    - `ytd_taxable_income`
    - `ytd_withholding_tax`
    - `ytd_sss`
    - `ytd_philhealth`
    - `ytd_pagibig`
    - `ytd_net_pay`
    - `ytd_thirteenth_month`
    - `ytd_basic_pay`

  ## Security
  - RLS enabled on new table
  - Employers can manage opening balances for their company
*/

-- ── Opening Balances ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_opening_balances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id     uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year            integer NOT NULL,

  -- Cumulative earnings from Jan 1 up to system start date
  ob_basic_pay          numeric(12,2) NOT NULL DEFAULT 0,
  ob_gross_pay          numeric(12,2) NOT NULL DEFAULT 0,
  ob_taxable_income     numeric(12,2) NOT NULL DEFAULT 0,
  ob_withholding_tax    numeric(12,2) NOT NULL DEFAULT 0,
  ob_sss                numeric(12,2) NOT NULL DEFAULT 0,
  ob_philhealth         numeric(12,2) NOT NULL DEFAULT 0,
  ob_pagibig            numeric(12,2) NOT NULL DEFAULT 0,
  ob_net_pay            numeric(12,2) NOT NULL DEFAULT 0,
  ob_thirteenth_month   numeric(12,2) NOT NULL DEFAULT 0,

  notes           text DEFAULT '',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),

  UNIQUE (company_id, employee_id, year)
);

ALTER TABLE payroll_opening_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employers view opening balances"
  ON payroll_opening_balances FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT e.company_id FROM employees e
      JOIN user_accounts ua ON ua.employee_id = e.id
      WHERE ua.email = current_setting('app.current_user_email', true)
        AND ua.role = 'employer'
    )
  );

CREATE POLICY "Employers insert opening balances"
  ON payroll_opening_balances FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT e.company_id FROM employees e
      JOIN user_accounts ua ON ua.employee_id = e.id
      WHERE ua.email = current_setting('app.current_user_email', true)
        AND ua.role = 'employer'
    )
  );

CREATE POLICY "Employers update opening balances"
  ON payroll_opening_balances FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT e.company_id FROM employees e
      JOIN user_accounts ua ON ua.employee_id = e.id
      WHERE ua.email = current_setting('app.current_user_email', true)
        AND ua.role = 'employer'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT e.company_id FROM employees e
      JOIN user_accounts ua ON ua.employee_id = e.id
      WHERE ua.email = current_setting('app.current_user_email', true)
        AND ua.role = 'employer'
    )
  );

CREATE POLICY "Employers delete opening balances"
  ON payroll_opening_balances FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT e.company_id FROM employees e
      JOIN user_accounts ua ON ua.employee_id = e.id
      WHERE ua.email = current_setting('app.current_user_email', true)
        AND ua.role = 'employer'
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payroll_opening_balances_company
  ON payroll_opening_balances (company_id);
CREATE INDEX IF NOT EXISTS idx_payroll_opening_balances_employee_year
  ON payroll_opening_balances (employee_id, year);

-- ── YTD snapshot columns on payroll_records ─────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll_records' AND column_name='ytd_gross_pay') THEN
    ALTER TABLE payroll_records ADD COLUMN ytd_gross_pay numeric(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll_records' AND column_name='ytd_basic_pay') THEN
    ALTER TABLE payroll_records ADD COLUMN ytd_basic_pay numeric(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll_records' AND column_name='ytd_taxable_income') THEN
    ALTER TABLE payroll_records ADD COLUMN ytd_taxable_income numeric(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll_records' AND column_name='ytd_withholding_tax') THEN
    ALTER TABLE payroll_records ADD COLUMN ytd_withholding_tax numeric(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll_records' AND column_name='ytd_sss') THEN
    ALTER TABLE payroll_records ADD COLUMN ytd_sss numeric(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll_records' AND column_name='ytd_philhealth') THEN
    ALTER TABLE payroll_records ADD COLUMN ytd_philhealth numeric(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll_records' AND column_name='ytd_pagibig') THEN
    ALTER TABLE payroll_records ADD COLUMN ytd_pagibig numeric(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll_records' AND column_name='ytd_net_pay') THEN
    ALTER TABLE payroll_records ADD COLUMN ytd_net_pay numeric(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll_records' AND column_name='ytd_thirteenth_month') THEN
    ALTER TABLE payroll_records ADD COLUMN ytd_thirteenth_month numeric(12,2) DEFAULT 0;
  END IF;
END $$;
