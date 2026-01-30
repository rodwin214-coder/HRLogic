/*
  # Grant set_config permission to anon role

  1. Problem
    - The set_config function was only granted to authenticated role
    - Custom auth system uses anon role for all requests
  
  2. Solution
    - Grant execute permission to anon role
  
  3. Security
    - Required for RLS to work with custom authentication
*/

-- Grant execute permission to anon users
GRANT EXECUTE ON FUNCTION set_config(text, text) TO anon;