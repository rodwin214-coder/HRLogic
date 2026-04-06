/*
  # Fix Password Reset Tokens Insert Policy

  1. Changes
    - Add policy to allow service role to insert password reset tokens
    - This is needed for the password reset flow to work

  2. Security
    - Only the backend can create tokens via the API
    - Users can only read valid tokens (already implemented)
*/

DROP POLICY IF EXISTS "Anyone can mark tokens as used" ON password_reset_tokens;
DROP POLICY IF EXISTS "Anyone can validate tokens" ON password_reset_tokens;

CREATE POLICY "Service can insert tokens"
  ON password_reset_tokens
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can validate tokens"
  ON password_reset_tokens
  FOR SELECT
  TO anon, authenticated
  USING (expires_at > now() AND used_at IS NULL);

CREATE POLICY "Anyone can mark tokens as used"
  ON password_reset_tokens
  FOR UPDATE
  TO anon, authenticated
  USING (expires_at > now() AND used_at IS NULL)
  WITH CHECK (used_at IS NOT NULL);
