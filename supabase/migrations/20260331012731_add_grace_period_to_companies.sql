/*
  # Add grace period setting to companies

  1. Changes
    - Add `grace_period_minutes` column to `companies` table
      - Stores the number of minutes after shift start time that is still considered "on time"
      - Default: 5 minutes
      - Allows employers to configure late tolerance
    
  2. Notes
    - If employee clocks in within grace period after shift start, status = "On Time"
    - If employee clocks in after grace period expires, status = "Late"
    - Grace period provides flexibility for minor delays
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'grace_period_minutes'
  ) THEN
    ALTER TABLE companies ADD COLUMN grace_period_minutes integer DEFAULT 5;
  END IF;
END $$;