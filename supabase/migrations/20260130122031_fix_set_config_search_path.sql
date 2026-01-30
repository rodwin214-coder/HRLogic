/*
  # Fix set_config Function Search Path

  1. Problem
    - Function has a role mutable search_path
    - This is a security risk
  
  2. Solution
    - Set search_path explicitly in function definition
  
  3. Security
    - Prevents search_path manipulation attacks
*/

-- Drop and recreate with explicit search_path
DROP FUNCTION IF EXISTS set_config(text, text);

CREATE OR REPLACE FUNCTION set_config(setting_name text, setting_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM pg_catalog.set_config(setting_name, setting_value, false);
END;
$$;

-- Grant execute permission to both anon and authenticated users
GRANT EXECUTE ON FUNCTION set_config(text, text) TO anon, authenticated;