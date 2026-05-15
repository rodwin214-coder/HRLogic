/*
  # Fix RLS on PH government contribution/tax tables

  ## Problem
  RLS is enabled on ph_sss_brackets, ph_philhealth_config, ph_pagibig_config,
  and ph_tax_table but no SELECT policies exist. This causes all queries to
  return empty results, making contributions and withholding tax compute as 0.

  ## Fix
  Add public SELECT policies so authenticated users (the app) can read these
  reference tables. They contain only government-published rate schedules —
  no private data — so read access is safe for all authenticated users.
*/

CREATE POLICY "Authenticated users can read SSS brackets"
  ON ph_sss_brackets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read PhilHealth config"
  ON ph_philhealth_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read Pag-IBIG config"
  ON ph_pagibig_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read tax table"
  ON ph_tax_table FOR SELECT
  TO authenticated
  USING (true);
