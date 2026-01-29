/*
  # Add Helper Functions for RLS
  
  This migration adds utility functions needed for Row Level Security.
  
  ## New Functions
  
  1. **set_config**
     - Allows setting session configuration variables
     - Used to set current user email for RLS policies
     - Security definer function for proper access control
  
  ## Security
  
  - Function runs with definer privileges
  - Required for RLS context setting
*/

-- Create or replace the set_config helper function
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
