/*
  # Add helper functions for RLS

  Creates helper functions to support Row Level Security policies.
*/

-- Create a function to set config (for RLS context)
CREATE OR REPLACE FUNCTION set_config(setting_name text, setting_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config(setting_name, setting_value, false);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION set_config(text, text) TO authenticated;
