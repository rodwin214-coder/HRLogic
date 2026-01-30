/*
  # Fix set_config Function Search Path

  1. Security Improvements
    - Set explicit search_path for set_config function to prevent search path attacks
    - This ensures the function always uses the correct schema

  2. Changes
    - Add SET search_path to the set_config function definition

  3. Notes
    - Functions with SECURITY DEFINER should have an explicit search_path
    - This prevents malicious users from manipulating the search path
*/

-- Drop and recreate the set_config function with explicit search_path
DROP FUNCTION IF EXISTS set_config(text, text);

CREATE OR REPLACE FUNCTION set_config(setting_name text, setting_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM set_config(setting_name, setting_value, false);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION set_config(text, text) TO authenticated, anon;