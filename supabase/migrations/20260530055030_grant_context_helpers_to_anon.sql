/*
  # Grant EXECUTE on context helper functions to anon role

  ## Problem
  get_current_user_company_id() and get_current_user_role() are called inside
  RLS policies on multiple tables. The app uses the `anon` Supabase role (no
  Supabase Auth), but only `authenticated` and `service_role` had EXECUTE
  permission on these functions. Any RLS policy that calls them would fail
  with "permission denied for function get_current_user_company_id" when
  accessed by an unauthenticated (anon) client.

  ## Fix
  Grant EXECUTE to `anon` on both functions. No logic is changed.
*/

GRANT EXECUTE ON FUNCTION get_current_user_company_id() TO anon;
GRANT EXECUTE ON FUNCTION get_current_user_role() TO anon;
