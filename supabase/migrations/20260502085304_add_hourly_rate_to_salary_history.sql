/*
  # Add hourly_rate override to salary_history

  ## Summary
  Adds an optional `hourly_rate` column to `salary_history`. When set, it
  overrides the DOLE-formula-derived hourly rate used in payroll computation.
  When NULL (default), the system continues to compute the rate automatically
  from basic salary.

  ## Changes
  - `salary_history`: new nullable column `hourly_rate numeric DEFAULT NULL`
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'salary_history' AND column_name = 'hourly_rate'
  ) THEN
    ALTER TABLE salary_history ADD COLUMN hourly_rate numeric DEFAULT NULL;
  END IF;
END $$;
