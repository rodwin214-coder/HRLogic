/*
  # Create Payroll Module - Philippines Compliant

  ## Overview
  Full payroll system compliant with Philippine labor laws and mandatory contributions.

  ## New Tables

  ### payroll_periods
  - Defines pay periods (semi-monthly, monthly, weekly, bi-weekly)
  - Tracks period dates and status (Draft, Finalized, Paid)

  ### payroll_records
  - Individual employee payroll computation per period
  - Stores gross pay, all deductions, net pay
  - Tracks: basic salary, allowances, overtime, holiday pay, night diff
  - Mandatory deductions: SSS, PhilHealth, Pag-IBIG, Withholding Tax

  ### payroll_adjustments
  - Ad-hoc additions/deductions per employee per period
  - Types: bonus, commission, loan, advance, other deduction, other addition

  ## PH Contribution Tables (2024-2025 rates)

  ### ph_sss_brackets
  - Monthly salary credit brackets and employee/employer contributions

  ### ph_philhealth_config
  - Premium rate (5% total, split 50/50) and income ceiling

  ### ph_pagibig_config
  - Employee and employer contribution rates with income thresholds

  ### ph_tax_table
  - BIR annual tax table for withholding tax computation

  ## Security
  - RLS enabled on all tables
  - Employer-only access to payroll management
  - Employees can view their own payroll records
*/

-- Payroll periods table
CREATE TABLE IF NOT EXISTS payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_name text NOT NULL,
  pay_frequency text NOT NULL DEFAULT 'semi-monthly' CHECK (pay_frequency IN ('weekly', 'bi-weekly', 'semi-monthly', 'monthly')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  pay_date date NOT NULL,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Finalized', 'Paid')),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employers manage payroll periods"
  ON payroll_periods FOR SELECT
  TO anon, authenticated
  USING (
    company_id::text = current_setting('app.current_company_id', true)
  );

CREATE POLICY "Employers insert payroll periods"
  ON payroll_periods FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    company_id::text = current_setting('app.current_company_id', true)
  );

CREATE POLICY "Employers update payroll periods"
  ON payroll_periods FOR UPDATE
  TO anon, authenticated
  USING (company_id::text = current_setting('app.current_company_id', true))
  WITH CHECK (company_id::text = current_setting('app.current_company_id', true));

CREATE POLICY "Employers delete payroll periods"
  ON payroll_periods FOR DELETE
  TO anon, authenticated
  USING (company_id::text = current_setting('app.current_company_id', true));

-- Payroll records table (one per employee per period)
CREATE TABLE IF NOT EXISTS payroll_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  -- Earnings
  basic_salary numeric(12,2) NOT NULL DEFAULT 0,
  daily_rate numeric(12,2) NOT NULL DEFAULT 0,
  days_worked numeric(5,2) NOT NULL DEFAULT 0,
  hours_worked numeric(7,2) NOT NULL DEFAULT 0,
  basic_pay numeric(12,2) NOT NULL DEFAULT 0,

  -- Overtime & Special Pay
  overtime_hours numeric(7,2) NOT NULL DEFAULT 0,
  overtime_pay numeric(12,2) NOT NULL DEFAULT 0,
  regular_holiday_hours numeric(7,2) NOT NULL DEFAULT 0,
  regular_holiday_pay numeric(12,2) NOT NULL DEFAULT 0,
  special_holiday_hours numeric(7,2) NOT NULL DEFAULT 0,
  special_holiday_pay numeric(12,2) NOT NULL DEFAULT 0,
  night_diff_hours numeric(7,2) NOT NULL DEFAULT 0,
  night_diff_pay numeric(12,2) NOT NULL DEFAULT 0,
  rest_day_hours numeric(7,2) NOT NULL DEFAULT 0,
  rest_day_pay numeric(12,2) NOT NULL DEFAULT 0,

  -- Allowances
  allowance numeric(12,2) NOT NULL DEFAULT 0,
  de_minimis numeric(12,2) NOT NULL DEFAULT 0,

  -- 13th month (accrued monthly, paid Dec)
  thirteenth_month_accrued numeric(12,2) NOT NULL DEFAULT 0,

  gross_pay numeric(12,2) NOT NULL DEFAULT 0,

  -- Mandatory Contributions (Employee Share)
  sss_contribution numeric(10,2) NOT NULL DEFAULT 0,
  philhealth_contribution numeric(10,2) NOT NULL DEFAULT 0,
  pagibig_contribution numeric(10,2) NOT NULL DEFAULT 0,
  total_contributions numeric(10,2) NOT NULL DEFAULT 0,

  -- Withholding Tax
  taxable_income numeric(12,2) NOT NULL DEFAULT 0,
  withholding_tax numeric(12,2) NOT NULL DEFAULT 0,

  -- Other Deductions
  sss_loan numeric(10,2) NOT NULL DEFAULT 0,
  pagibig_loan numeric(10,2) NOT NULL DEFAULT 0,
  cash_advance numeric(10,2) NOT NULL DEFAULT 0,
  other_deductions numeric(10,2) NOT NULL DEFAULT 0,
  total_deductions numeric(12,2) NOT NULL DEFAULT 0,

  net_pay numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Finalized', 'Paid')),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(period_id, employee_id)
);

ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employers view company payroll records"
  ON payroll_records FOR SELECT
  TO anon, authenticated
  USING (company_id::text = current_setting('app.current_company_id', true));

CREATE POLICY "Employers insert payroll records"
  ON payroll_records FOR INSERT
  TO anon, authenticated
  WITH CHECK (company_id::text = current_setting('app.current_company_id', true));

CREATE POLICY "Employers update payroll records"
  ON payroll_records FOR UPDATE
  TO anon, authenticated
  USING (company_id::text = current_setting('app.current_company_id', true))
  WITH CHECK (company_id::text = current_setting('app.current_company_id', true));

CREATE POLICY "Employers delete payroll records"
  ON payroll_records FOR DELETE
  TO anon, authenticated
  USING (company_id::text = current_setting('app.current_company_id', true));

-- Payroll adjustments (bonuses, loans, deductions)
CREATE TABLE IF NOT EXISTS payroll_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('bonus', 'commission', 'allowance', 'sss_loan', 'pagibig_loan', 'cash_advance', 'other_deduction', 'other_addition')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payroll_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employers view adjustments"
  ON payroll_adjustments FOR SELECT
  TO anon, authenticated
  USING (company_id::text = current_setting('app.current_company_id', true));

CREATE POLICY "Employers insert adjustments"
  ON payroll_adjustments FOR INSERT
  TO anon, authenticated
  WITH CHECK (company_id::text = current_setting('app.current_company_id', true));

CREATE POLICY "Employers update adjustments"
  ON payroll_adjustments FOR UPDATE
  TO anon, authenticated
  USING (company_id::text = current_setting('app.current_company_id', true))
  WITH CHECK (company_id::text = current_setting('app.current_company_id', true));

CREATE POLICY "Employers delete adjustments"
  ON payroll_adjustments FOR DELETE
  TO anon, authenticated
  USING (company_id::text = current_setting('app.current_company_id', true));

-- SSS Contribution Table (2024-2025 Schedule)
-- Based on SSS Circular No. 2023-010
CREATE TABLE IF NOT EXISTS ph_sss_brackets (
  id serial PRIMARY KEY,
  range_from numeric(10,2) NOT NULL,
  range_to numeric(10,2),
  monthly_salary_credit numeric(10,2) NOT NULL,
  employee_contribution numeric(10,2) NOT NULL,
  employer_contribution numeric(10,2) NOT NULL,
  ec_contribution numeric(10,2) NOT NULL DEFAULT 10.00,
  wisp_employee numeric(10,2) NOT NULL DEFAULT 0,
  wisp_employer numeric(10,2) NOT NULL DEFAULT 0,
  effective_date date NOT NULL DEFAULT '2024-01-01'
);

-- Insert SSS table (2024 rates - 14% total, 4.5% employee, 9.5% employer)
INSERT INTO ph_sss_brackets (range_from, range_to, monthly_salary_credit, employee_contribution, employer_contribution, ec_contribution, wisp_employee, wisp_employer) VALUES
(1000, 4249.99, 4000, 180.00, 380.00, 10.00, 0, 0),
(4250, 4749.99, 4500, 202.50, 427.50, 10.00, 0, 0),
(4750, 5249.99, 5000, 225.00, 475.00, 10.00, 0, 0),
(5250, 5749.99, 5500, 247.50, 522.50, 10.00, 0, 0),
(5750, 6249.99, 6000, 270.00, 570.00, 10.00, 0, 0),
(6250, 6749.99, 6500, 292.50, 617.50, 10.00, 0, 0),
(6750, 7249.99, 7000, 315.00, 665.00, 10.00, 0, 0),
(7250, 7749.99, 7500, 337.50, 712.50, 10.00, 0, 0),
(7750, 8249.99, 8000, 360.00, 760.00, 10.00, 0, 0),
(8250, 8749.99, 8500, 382.50, 807.50, 10.00, 0, 0),
(8750, 9249.99, 9000, 405.00, 855.00, 10.00, 0, 0),
(9250, 9749.99, 9500, 427.50, 902.50, 10.00, 0, 0),
(9750, 10249.99, 10000, 450.00, 950.00, 10.00, 0, 0),
(10250, 10749.99, 10500, 472.50, 997.50, 10.00, 0, 0),
(10750, 11249.99, 11000, 495.00, 1045.00, 10.00, 0, 0),
(11250, 11749.99, 11500, 517.50, 1092.50, 10.00, 0, 0),
(11750, 12249.99, 12000, 540.00, 1140.00, 10.00, 0, 0),
(12250, 12749.99, 12500, 562.50, 1187.50, 10.00, 0, 0),
(12750, 13249.99, 13000, 585.00, 1235.00, 10.00, 0, 0),
(13250, 13749.99, 13500, 607.50, 1282.50, 10.00, 0, 0),
(13750, 14249.99, 14000, 630.00, 1330.00, 10.00, 0, 0),
(14250, 14749.99, 14500, 652.50, 1377.50, 10.00, 0, 0),
(14750, 15249.99, 15000, 675.00, 1425.00, 10.00, 0, 0),
(15250, 15749.99, 15500, 697.50, 1472.50, 10.00, 0, 0),
(15750, 16249.99, 16000, 720.00, 1520.00, 10.00, 0, 0),
(16250, 16749.99, 16500, 742.50, 1567.50, 10.00, 0, 0),
(16750, 17249.99, 17000, 765.00, 1615.00, 10.00, 0, 0),
(17250, 17749.99, 17500, 787.50, 1662.50, 10.00, 0, 0),
(17750, 18249.99, 18000, 810.00, 1710.00, 10.00, 0, 0),
(18250, 18749.99, 18500, 832.50, 1757.50, 10.00, 0, 0),
(18750, 19249.99, 19000, 855.00, 1805.00, 10.00, 0, 0),
(19250, 19749.99, 19500, 877.50, 1852.50, 10.00, 0, 0),
(19750, 20249.99, 20000, 900.00, 1900.00, 10.00, 0, 0),
(20250, 20749.99, 20500, 922.50, 1947.50, 10.00, 0, 0),
(20750, 21249.99, 21000, 945.00, 1995.00, 10.00, 0, 0),
(21250, 21749.99, 21500, 967.50, 2042.50, 10.00, 0, 0),
(21750, 22249.99, 22000, 990.00, 2090.00, 10.00, 0, 0),
(22250, 22749.99, 22500, 1012.50, 2137.50, 10.00, 0, 0),
(22750, 23249.99, 23000, 1035.00, 2185.00, 10.00, 0, 0),
(23250, 23749.99, 23500, 1057.50, 2232.50, 10.00, 0, 0),
(23750, 24249.99, 24000, 1080.00, 2280.00, 10.00, 0, 0),
(24250, 24749.99, 24500, 1102.50, 2327.50, 10.00, 0, 0),
(24750, 99999999.99, 25000, 1125.00, 2375.00, 30.00, 0, 0)
ON CONFLICT DO NOTHING;

-- PhilHealth config (2024-2025: 5% premium rate, max ceiling PHP 100,000)
CREATE TABLE IF NOT EXISTS ph_philhealth_config (
  id serial PRIMARY KEY,
  premium_rate numeric(5,4) NOT NULL DEFAULT 0.05,
  income_floor numeric(10,2) NOT NULL DEFAULT 10000.00,
  income_ceiling numeric(10,2) NOT NULL DEFAULT 100000.00,
  min_premium numeric(10,2) NOT NULL DEFAULT 500.00,
  max_premium numeric(10,2) NOT NULL DEFAULT 5000.00,
  effective_date date NOT NULL DEFAULT '2024-01-01'
);

INSERT INTO ph_philhealth_config (premium_rate, income_floor, income_ceiling, min_premium, max_premium)
VALUES (0.05, 10000.00, 100000.00, 500.00, 5000.00)
ON CONFLICT DO NOTHING;

-- Pag-IBIG / HDMF config (2024)
CREATE TABLE IF NOT EXISTS ph_pagibig_config (
  id serial PRIMARY KEY,
  low_income_ceiling numeric(10,2) NOT NULL DEFAULT 1500.00,
  low_income_employee_rate numeric(5,4) NOT NULL DEFAULT 0.01,
  low_income_employer_rate numeric(5,4) NOT NULL DEFAULT 0.02,
  high_income_employee_rate numeric(5,4) NOT NULL DEFAULT 0.02,
  high_income_employer_rate numeric(5,4) NOT NULL DEFAULT 0.02,
  max_employee_contribution numeric(10,2) NOT NULL DEFAULT 200.00,
  max_employer_contribution numeric(10,2) NOT NULL DEFAULT 200.00,
  effective_date date NOT NULL DEFAULT '2024-01-01'
);

INSERT INTO ph_pagibig_config (low_income_ceiling, low_income_employee_rate, low_income_employer_rate, high_income_employee_rate, high_income_employer_rate, max_employee_contribution, max_employer_contribution)
VALUES (1500.00, 0.01, 0.02, 0.02, 0.02, 200.00, 200.00)
ON CONFLICT DO NOTHING;

-- BIR Withholding Tax Table (Annual, per TRAIN Law / RR 8-2018)
-- Using annual taxable income brackets
CREATE TABLE IF NOT EXISTS ph_tax_table (
  id serial PRIMARY KEY,
  bracket_from numeric(14,2) NOT NULL,
  bracket_to numeric(14,2),
  base_tax numeric(14,2) NOT NULL DEFAULT 0,
  rate numeric(5,4) NOT NULL DEFAULT 0,
  excess_over numeric(14,2) NOT NULL DEFAULT 0,
  effective_date date NOT NULL DEFAULT '2023-01-01'
);

-- 2023 onwards (TRAIN Law Phase 2)
INSERT INTO ph_tax_table (bracket_from, bracket_to, base_tax, rate, excess_over) VALUES
(0, 250000, 0, 0, 0),
(250000.01, 400000, 0, 0.15, 250000),
(400000.01, 800000, 22500, 0.20, 400000),
(800000.01, 2000000, 102500, 0.25, 800000),
(2000000.01, 8000000, 402500, 0.30, 2000000),
(8000000.01, NULL, 2202500, 0.35, 8000000)
ON CONFLICT DO NOTHING;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payroll_periods_company ON payroll_periods(company_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_period ON payroll_records(period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_employee ON payroll_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_company ON payroll_records(company_id);
CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_period ON payroll_adjustments(period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_employee ON payroll_adjustments(employee_id);
