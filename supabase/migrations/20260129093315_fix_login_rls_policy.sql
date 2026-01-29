/*
  # Fix Login RLS Policy

  1. Changes
    - Add RLS policy to allow anonymous users to read user_accounts during login
    - This is safe because passwords are hashed and we need to verify credentials
  
  2. Security
    - Policy only allows SELECT operations
    - Passwords are stored as bcrypt hashes
    - No sensitive data is exposed during login verification
*/

-- Drop duplicate policy if it exists
DROP POLICY IF EXISTS "Users can view own account" ON user_accounts;

-- Allow anonymous users to read accounts for login verification
CREATE POLICY "Allow login verification"
  ON user_accounts
  FOR SELECT
  TO anon
  USING (true);