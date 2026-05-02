/*
  # Add employer_shoulders_contributions to companies

  ## Summary
  Adds a boolean flag to the companies table that controls whether the employer
  shoulders mandatory government contributions (SSS, PhilHealth, Pag-IBIG) on
  behalf of the employee. When enabled, contributions are still computed and
  recorded for reporting purposes but are NOT deducted from the employee's net pay.

  ## Changes
  - `companies`: new column `employer_shoulders_contributions boolean DEFAULT false`
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'employer_shoulders_contributions'
  ) THEN
    ALTER TABLE companies ADD COLUMN employer_shoulders_contributions boolean DEFAULT false;
  END IF;
END $$;
