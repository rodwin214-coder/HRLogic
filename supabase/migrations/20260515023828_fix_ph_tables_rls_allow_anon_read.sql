/*
  # Fix PH reference tables RLS to allow anon reads

  The app uses a custom auth system (not Supabase Auth) so the Supabase client
  always operates as the 'anon' role. The previous migration only added policies
  for 'authenticated'. These tables contain public government rate data so anon
  SELECT is safe.
*/

CREATE POLICY "Anon users can read SSS brackets"
  ON ph_sss_brackets FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon users can read PhilHealth config"
  ON ph_philhealth_config FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon users can read Pag-IBIG config"
  ON ph_pagibig_config FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon users can read tax table"
  ON ph_tax_table FOR SELECT
  TO anon
  USING (true);
