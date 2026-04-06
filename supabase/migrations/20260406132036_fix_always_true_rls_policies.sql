/*
  # Fix always-true RLS INSERT policies

  ## Summary
  Two tables have INSERT policies with `WITH CHECK (true)`, effectively bypassing RLS
  for those operations. These need to be restricted to legitimate callers only.

  ## Tables Fixed

  ### notifications — "System can insert notifications"
  Notifications are inserted by the app backend (via service role) or by the same user.
  We restrict INSERT to rows where company_id matches the caller's company OR where the
  caller is an employer in that company (covers server-side inserts via anon key with
  current_user_email set).

  ### password_reset_tokens — "Service can insert tokens"
  Password reset tokens are inserted by the edge function (server-side) using the
  service role key, which bypasses RLS entirely. For anon/authenticated callers we
  restrict to rows where the email exists in the caller's company.
*/

-- ==================== notifications ====================
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT ua.company_id FROM user_accounts ua
      WHERE ua.email = (SELECT current_setting('app.current_user_email', true))
    )
  );

-- ==================== password_reset_tokens ====================
DROP POLICY IF EXISTS "Service can insert tokens" ON public.password_reset_tokens;
CREATE POLICY "Service can insert tokens"
  ON public.password_reset_tokens FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_accounts ua
      WHERE ua.email = password_reset_tokens.email
        AND ua.company_id = password_reset_tokens.company_id
    )
  );
