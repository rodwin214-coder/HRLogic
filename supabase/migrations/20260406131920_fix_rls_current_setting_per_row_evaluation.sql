/*
  # Fix RLS per-row evaluation of current_setting()

  ## Summary
  Several RLS policies call `current_setting()` directly in USING/WITH CHECK clauses,
  causing it to be re-evaluated for every row. Wrapping in `(SELECT ...)` causes it to
  be evaluated once per query, improving performance significantly.

  ## Tables Fixed
  - user_accounts: "Employees can update their own password"
  - employee_files: "Employers can delete employee files"
  - notifications: view, update, delete policies
  - notification_settings: view, insert, update, delete policies
*/

-- user_accounts: Employees can update their own password
DROP POLICY IF EXISTS "Employees can update their own password" ON public.user_accounts;
CREATE POLICY "Employees can update their own password"
  ON public.user_accounts FOR UPDATE
  TO anon, authenticated
  USING (email = (SELECT current_setting('app.current_user_email', true)))
  WITH CHECK (email = (SELECT current_setting('app.current_user_email', true)));

-- employee_files: Employers can delete employee files
DROP POLICY IF EXISTS "Employers can delete employee files" ON public.employee_files;
CREATE POLICY "Employers can delete employee files"
  ON public.employee_files FOR DELETE
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM user_accounts ua
    WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
      AND ua.role = 'employer'
      AND ua.company_id = employee_files.company_id
  ));

-- notifications: view
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = (SELECT current_setting('app.current_user_id', true))::uuid);

-- notifications: update
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = (SELECT current_setting('app.current_user_id', true))::uuid);

-- notifications: delete
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE
  USING (user_id = (SELECT current_setting('app.current_user_id', true))::uuid);

-- notification_settings: view
DROP POLICY IF EXISTS "Users can view their own notification settings" ON public.notification_settings;
CREATE POLICY "Users can view their own notification settings"
  ON public.notification_settings FOR SELECT
  USING (user_id = (SELECT current_setting('app.current_user_id', true))::uuid);

-- notification_settings: insert
DROP POLICY IF EXISTS "Users can insert their own notification settings" ON public.notification_settings;
CREATE POLICY "Users can insert their own notification settings"
  ON public.notification_settings FOR INSERT
  WITH CHECK (user_id = (SELECT current_setting('app.current_user_id', true))::uuid);

-- notification_settings: update
DROP POLICY IF EXISTS "Users can update their own notification settings" ON public.notification_settings;
CREATE POLICY "Users can update their own notification settings"
  ON public.notification_settings FOR UPDATE
  USING (user_id = (SELECT current_setting('app.current_user_id', true))::uuid);

-- notification_settings: delete
DROP POLICY IF EXISTS "Users can delete their own notification settings" ON public.notification_settings;
CREATE POLICY "Users can delete their own notification settings"
  ON public.notification_settings FOR DELETE
  USING (user_id = (SELECT current_setting('app.current_user_id', true))::uuid);
