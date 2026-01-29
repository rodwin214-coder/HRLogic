/*
  # Add Attendance Status Tracking

  1. Changes
    - Add `status` column to `attendance_records` table
    - Status indicates if employee clocked in "On Time" or "Late"
    - Only applies to the first clock-in of the day

  2. Notes
    - Status is calculated based on employee's shift start time
    - NULL status means it's not the first clock-in (subsequent sessions)
*/

-- Add status column to attendance_records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_records' AND column_name = 'status'
  ) THEN
    ALTER TABLE attendance_records ADD COLUMN status text;
  END IF;
END $$;