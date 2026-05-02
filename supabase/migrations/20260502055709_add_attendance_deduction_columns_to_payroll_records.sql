/*
  # Add Attendance Deduction Columns to payroll_records

  ## Overview
  Adds per-period attendance breakdown columns so the payroll engine can
  store computed absence, tardiness, and undertime data alongside the
  existing earnings and deduction columns.

  ## New Columns on payroll_records

  ### Absences
  - `absent_days`       — number of scheduled working days with no attendance record
  - `absent_deduction`  — peso amount deducted for absences (absent_days × daily_rate)

  ### Tardiness (Late)
  - `late_minutes`      — total minutes late across all days in the period
  - `late_deduction`    — peso amount deducted (late_minutes / 480 × daily_rate)

  ### Undertime
  - `undertime_minutes` — total minutes clocked out before shift end
  - `undertime_deduction` — peso amount deducted (undertime_minutes / 480 × daily_rate)

  All new columns default to 0 so existing rows are not affected.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_records' AND column_name = 'absent_days') THEN
    ALTER TABLE payroll_records ADD COLUMN absent_days numeric(5,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_records' AND column_name = 'absent_deduction') THEN
    ALTER TABLE payroll_records ADD COLUMN absent_deduction numeric(12,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_records' AND column_name = 'late_minutes') THEN
    ALTER TABLE payroll_records ADD COLUMN late_minutes numeric(7,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_records' AND column_name = 'late_deduction') THEN
    ALTER TABLE payroll_records ADD COLUMN late_deduction numeric(12,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_records' AND column_name = 'undertime_minutes') THEN
    ALTER TABLE payroll_records ADD COLUMN undertime_minutes numeric(7,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_records' AND column_name = 'undertime_deduction') THEN
    ALTER TABLE payroll_records ADD COLUMN undertime_deduction numeric(12,2) NOT NULL DEFAULT 0;
  END IF;
END $$;
