/*
  # Add Termination Reason to Employees

  This migration adds a termination_reason field to the employees table to capture
  why an employee was terminated.

  ## Changes
  - Add `termination_reason` column to `employees` table (text, optional)
  
  ## Notes
  - This field will only be populated when an employee is terminated
  - Existing terminated employees will have NULL for this field
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'termination_reason'
  ) THEN
    ALTER TABLE employees ADD COLUMN termination_reason text;
  END IF;
END $$;