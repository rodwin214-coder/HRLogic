/*
  # Add holiday type to overtime requests

  1. Changes
    - Add `holiday_type` column to `requests` table
      - Stores the type of holiday when overtime is filed as holiday pay
      - Values: 'Regular', 'Special', or NULL for non-holiday overtime
    
  2. Notes
    - This allows employees to specify if overtime was worked on a holiday
    - The holiday type (Regular vs Special) affects pay calculation
    - Nullable field since not all overtime requests are for holiday pay
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'holiday_type'
  ) THEN
    ALTER TABLE requests ADD COLUMN holiday_type text;
  END IF;
END $$;