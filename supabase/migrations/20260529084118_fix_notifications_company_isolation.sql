/*
  # Fix notifications company isolation

  ## Problem
  The notifications SELECT/UPDATE/DELETE policies only filter by user_id, not company_id.
  This allows notifications from other companies to appear if user_id values collide or
  if the session variable is set to a user that exists in multiple companies.

  ## Solution
  Add company_id check to all notification policies so users only ever see/modify
  notifications belonging to their own company.
*/

-- SELECT: must match both user_id AND company_id
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
  ON notifications
  FOR SELECT
  TO public
  USING (
    user_id = (current_setting('app.current_user_id', true))::uuid
    AND company_id = (current_setting('app.current_company_id', true))::uuid
  );

-- UPDATE: must match both user_id AND company_id
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  TO public
  USING (
    user_id = (current_setting('app.current_user_id', true))::uuid
    AND company_id = (current_setting('app.current_company_id', true))::uuid
  )
  WITH CHECK (
    user_id = (current_setting('app.current_user_id', true))::uuid
    AND company_id = (current_setting('app.current_company_id', true))::uuid
  );

-- DELETE: must match both user_id AND company_id
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
CREATE POLICY "Users can delete their own notifications"
  ON notifications
  FOR DELETE
  TO public
  USING (
    user_id = (current_setting('app.current_user_id', true))::uuid
    AND company_id = (current_setting('app.current_company_id', true))::uuid
  );
