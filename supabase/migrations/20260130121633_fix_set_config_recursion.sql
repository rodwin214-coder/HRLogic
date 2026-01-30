/*
  # Fix set_config function recursion

  1. Problem
    - The set_config function was calling itself recursively
    - Should call the built-in pg_catalog.set_config instead
  
  2. Solution
    - Use pg_catalog.set_config to avoid recursion
  
  3. Security
    - Maintains security definer privileges
*/

-- Drop and recreate the set_config function with correct implementation
DROP FUNCTION IF EXISTS set_config(text, text);

CREATE OR REPLACE FUNCTION set_config(setting_name text, setting_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM pg_catalog.set_config(setting_name, setting_value, false);
END;
$$;

-- Grant execute permission to both anon and authenticated users
GRANT EXECUTE ON FUNCTION set_config(text, text) TO anon, authenticated;