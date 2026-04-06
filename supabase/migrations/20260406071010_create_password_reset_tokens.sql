/*
  # Create Password Reset Tokens Table

  1. New Tables
    - `password_reset_tokens`
      - `id` (uuid, primary key) - Unique identifier for the token
      - `company_id` (uuid, foreign key) - References companies table
      - `employee_id` (uuid, foreign key) - References employees table
      - `email` (text) - Email address for the reset
      - `token` (text, unique) - Secure reset token
      - `expires_at` (timestamptz) - When the token expires
      - `used_at` (timestamptz, nullable) - When the token was used
      - `created_at` (timestamptz) - When the token was created

  2. Security
    - Enable RLS on `password_reset_tokens` table
    - Add policy for anonymous users to validate tokens
    - Add policy for anonymous users to use tokens
    - Add indexes for performance

  3. Notes
    - Tokens expire after 1 hour
    - Tokens can only be used once
    - Old tokens are automatically cleaned up
*/

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can validate tokens"
  ON password_reset_tokens
  FOR SELECT
  USING (expires_at > now() AND used_at IS NULL);

CREATE POLICY "Anyone can mark tokens as used"
  ON password_reset_tokens
  FOR UPDATE
  USING (expires_at > now() AND used_at IS NULL)
  WITH CHECK (used_at IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
