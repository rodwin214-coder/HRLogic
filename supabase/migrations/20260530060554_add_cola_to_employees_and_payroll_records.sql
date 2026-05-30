/*
  # Add COLA (Cost of Living Allowance) support

  ## Summary
  Adds a daily-rate COLA field per employee and a computed COLA amount per payroll record.

  ## Changes

  ### employees table
  - `cola_daily_rate` (numeric, default 0): PHP amount paid per day of actual presence.
    Stored at the employee level, scoped to company via the existing employee.company_id FK.
    Zero by default — employees with no COLA configured are unaffected.

  ### payroll_records table
  - `cola` (numeric, default 0): Computed COLA amount for the period.
    Formula: cola_daily_rate × days_present (= daysWorked from attendance analysis).
    Added to gross_pay as a non-taxable daily presence allowance.

  ## Security
  No new tables — both columns inherit all existing RLS policies on their respective tables.
  No cross-company leaks are introduced.
*/

-- Add cola_daily_rate to employees
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'cola_daily_rate'
  ) THEN
    ALTER TABLE employees ADD COLUMN cola_daily_rate numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add cola to payroll_records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_records' AND column_name = 'cola'
  ) THEN
    ALTER TABLE payroll_records ADD COLUMN cola numeric NOT NULL DEFAULT 0;
  END IF;
END $$;
