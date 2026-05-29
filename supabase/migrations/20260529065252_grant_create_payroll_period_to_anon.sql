/*
  # Grant create_payroll_period to anon role

  The function already exists with correct search_path and SECURITY DEFINER.
  The anon role was missing EXECUTE, causing "permission denied" when the app
  calls it via the anon key (which is used for all client-side DB calls).
*/

GRANT EXECUTE ON FUNCTION create_payroll_period(uuid, text, text, date, date, date, text) TO anon;
