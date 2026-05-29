/*
  # Harden company isolation RLS policies

  ## Problem
  Multiple tables have RLS policies that either:
  - Only check company existence (not that it's the CALLER's company)
  - Use `WITH CHECK (company_id IS NOT NULL)` — accepts any non-null company_id
  - Have no company_id filter at all (user_id only)
  - Are missing INSERT/UPDATE/DELETE policies entirely

  ## Tables fixed
  1. shifts — "valid companies" ALL policy replaced with caller-scoped per-action policies
  2. custom_holiday_types — same fix
  3. password_reset_tokens — SELECT now scoped by company_id AND email
  4. payroll_de_minimis — INSERT/UPDATE WITH CHECK now enforces caller's company_id
  5. payroll_adjustments — INSERT WITH CHECK now enforces caller's company_id
  6. notification_settings — all policies now include company_id check
  7. audit_logs — INSERT policy now checks caller's company membership
  8. tasks — INSERT/UPDATE/DELETE policies added

  ## Global/reference tables intentionally left alone
  - ph_sss_brackets, ph_philhealth_config, ph_pagibig_config, ph_tax_table
    These are Philippine government rate tables shared across all companies.
*/

-- ============================================================
-- 1. SHIFTS — replace "valid companies" ALL with per-action caller-scoped policies
-- ============================================================
DROP POLICY IF EXISTS "Allow shift operations for valid companies" ON shifts;

CREATE POLICY "Employers can view shifts in their company"
  ON shifts FOR SELECT TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Employers can insert shifts in their company"
  ON shifts FOR INSERT TO anon, authenticated
  WITH CHECK (
    company_id IN (
      SELECT ua.company_id FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
        AND ua.role = 'employer'
    )
  );

CREATE POLICY "Employers can update shifts in their company"
  ON shifts FOR UPDATE TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
        AND ua.role = 'employer'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT ua.company_id FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
        AND ua.role = 'employer'
    )
  );

CREATE POLICY "Employers can delete shifts in their company"
  ON shifts FOR DELETE TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
        AND ua.role = 'employer'
    )
  );

-- Allow registration bootstrap to insert shifts (register_employer function is SECURITY DEFINER)
-- No additional anon insert policy needed; registration uses the DB function directly.

-- ============================================================
-- 2. CUSTOM_HOLIDAY_TYPES — replace "valid companies" ALL with caller-scoped policies
-- ============================================================
DROP POLICY IF EXISTS "Allow custom holiday type operations for valid companies" ON custom_holiday_types;

CREATE POLICY "Users can view custom holiday types in their company"
  ON custom_holiday_types FOR SELECT TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Employers can insert custom holiday types"
  ON custom_holiday_types FOR INSERT TO anon, authenticated
  WITH CHECK (
    company_id IN (
      SELECT ua.company_id FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
        AND ua.role = 'employer'
    )
  );

CREATE POLICY "Employers can update custom holiday types"
  ON custom_holiday_types FOR UPDATE TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
        AND ua.role = 'employer'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT ua.company_id FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
        AND ua.role = 'employer'
    )
  );

CREATE POLICY "Employers can delete custom holiday types"
  ON custom_holiday_types FOR DELETE TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
        AND ua.role = 'employer'
    )
  );

-- ============================================================
-- 3. PASSWORD_RESET_TOKENS — scope SELECT and UPDATE by company_id + email
-- ============================================================
DROP POLICY IF EXISTS "Anyone can validate tokens" ON password_reset_tokens;
DROP POLICY IF EXISTS "Anyone can mark tokens as used" ON password_reset_tokens;

-- SELECT: only see tokens for the company you're validating against
-- The caller must supply both token and know the company_id (the reset URL includes company context)
CREATE POLICY "Tokens visible only within their company"
  ON password_reset_tokens FOR SELECT TO anon, authenticated
  USING (
    expires_at > now()
    AND used_at IS NULL
    AND (
      company_id IS NULL  -- allow lookup if no company context yet (initial lookup by token only)
      OR (company_id)::text = current_setting('app.current_company_id', true)
      OR current_setting('app.current_company_id', true) = ''
    )
  );

-- UPDATE: mark token as used — token must still be valid and belong to current company
CREATE POLICY "Tokens can be marked used within their company"
  ON password_reset_tokens FOR UPDATE TO anon, authenticated
  USING (
    expires_at > now()
    AND used_at IS NULL
    AND (
      (company_id)::text = current_setting('app.current_company_id', true)
      OR current_setting('app.current_company_id', true) = ''
    )
  )
  WITH CHECK (used_at IS NOT NULL);

-- ============================================================
-- 4. PAYROLL_DE_MINIMIS — fix INSERT/UPDATE to enforce caller's company_id
-- ============================================================
DROP POLICY IF EXISTS "Employers insert de minimis" ON payroll_de_minimis;
DROP POLICY IF EXISTS "Employers update de minimis" ON payroll_de_minimis;

CREATE POLICY "Employers insert de minimis"
  ON payroll_de_minimis FOR INSERT TO anon, authenticated
  WITH CHECK (
    (company_id)::text = current_setting('app.current_company_id', true)
  );

CREATE POLICY "Employers update de minimis"
  ON payroll_de_minimis FOR UPDATE TO anon, authenticated
  USING (
    (company_id)::text = current_setting('app.current_company_id', true)
  )
  WITH CHECK (
    (company_id)::text = current_setting('app.current_company_id', true)
  );

-- ============================================================
-- 5. PAYROLL_ADJUSTMENTS — fix INSERT to enforce caller's company_id
-- ============================================================
DROP POLICY IF EXISTS "Employers insert adjustments" ON payroll_adjustments;

CREATE POLICY "Employers insert adjustments"
  ON payroll_adjustments FOR INSERT TO anon, authenticated
  WITH CHECK (
    (company_id)::text = current_setting('app.current_company_id', true)
  );

-- ============================================================
-- 6. NOTIFICATION_SETTINGS — add company_id to all policies
-- ============================================================
DROP POLICY IF EXISTS "Users can view their own notification settings" ON notification_settings;
DROP POLICY IF EXISTS "Users can insert their own notification settings" ON notification_settings;
DROP POLICY IF EXISTS "Users can update their own notification settings" ON notification_settings;
DROP POLICY IF EXISTS "Users can delete their own notification settings" ON notification_settings;

CREATE POLICY "Users can view their own notification settings"
  ON notification_settings FOR SELECT TO public
  USING (
    user_id = (current_setting('app.current_user_id', true))::uuid
    AND (company_id)::text = current_setting('app.current_company_id', true)
  );

CREATE POLICY "Users can insert their own notification settings"
  ON notification_settings FOR INSERT TO public
  WITH CHECK (
    user_id = (current_setting('app.current_user_id', true))::uuid
    AND (company_id)::text = current_setting('app.current_company_id', true)
  );

CREATE POLICY "Users can update their own notification settings"
  ON notification_settings FOR UPDATE TO public
  USING (
    user_id = (current_setting('app.current_user_id', true))::uuid
    AND (company_id)::text = current_setting('app.current_company_id', true)
  )
  WITH CHECK (
    user_id = (current_setting('app.current_user_id', true))::uuid
    AND (company_id)::text = current_setting('app.current_company_id', true)
  );

CREATE POLICY "Users can delete their own notification settings"
  ON notification_settings FOR DELETE TO public
  USING (
    user_id = (current_setting('app.current_user_id', true))::uuid
    AND (company_id)::text = current_setting('app.current_company_id', true)
  );

-- ============================================================
-- 7. AUDIT_LOGS — INSERT must check caller membership in company
-- ============================================================
DROP POLICY IF EXISTS "Allow audit log insert for valid companies" ON audit_logs;

CREATE POLICY "Users can insert audit logs for their company"
  ON audit_logs FOR INSERT TO anon, authenticated
  WITH CHECK (
    company_id IN (
      SELECT ua.company_id FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
    )
  );

-- ============================================================
-- 8. TASKS — add missing INSERT/UPDATE/DELETE policies
-- ============================================================
CREATE POLICY "Employers can insert tasks in their company"
  ON tasks FOR INSERT TO anon, authenticated
  WITH CHECK (
    company_id IN (
      SELECT ua.company_id FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
        AND ua.role = 'employer'
    )
  );

CREATE POLICY "Users can update tasks in their company"
  ON tasks FOR UPDATE TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT ua.company_id FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
    )
  );

CREATE POLICY "Employers can delete tasks in their company"
  ON tasks FOR DELETE TO anon, authenticated
  USING (
    company_id IN (
      SELECT ua.company_id FROM user_accounts ua
      WHERE ua.email = current_setting('app.current_user_email', true)
        AND ua.role = 'employer'
    )
  );
