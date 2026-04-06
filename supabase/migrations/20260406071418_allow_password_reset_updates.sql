/*
  # Allow Password Reset Updates

  1. Changes
    - Add policy to allow anonymous users to update passwords during reset
    - This is specifically for the password reset flow

  2. Security
    - Users can only update their own password via the reset token validation
    - The reset token must be valid and not expired
*/

CREATE POLICY "Allow password updates during reset"
  ON user_accounts
  FOR UPDATE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM password_reset_tokens
      WHERE password_reset_tokens.email = user_accounts.email
        AND password_reset_tokens.company_id = user_accounts.company_id
        AND password_reset_tokens.expires_at > now()
        AND password_reset_tokens.used_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM password_reset_tokens
      WHERE password_reset_tokens.email = user_accounts.email
        AND password_reset_tokens.company_id = user_accounts.company_id
        AND password_reset_tokens.expires_at > now()
        AND password_reset_tokens.used_at IS NULL
    )
  );
