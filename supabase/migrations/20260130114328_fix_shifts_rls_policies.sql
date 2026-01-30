/*
  # Fix Shifts RLS Policies for Multi-Company Isolation

  1. Changes
    - Drop insecure "Allow viewing shifts" policy that allows viewing shifts from any company
    - Drop insecure "Allow shift creation" policy that has no company check
    - Keep only the properly scoped "Users can view shifts in their company" policy
    - Keep properly scoped employer policies for managing shifts
  
  2. Security
    - SELECT policy: Users can only view shifts from their company
    - INSERT policy: Employers can only create shifts for their company
    - UPDATE/DELETE policies: Employers can only modify shifts in their company
*/

-- Drop insecure policies
DROP POLICY IF EXISTS "Allow viewing shifts" ON shifts;
DROP POLICY IF EXISTS "Allow shift creation" ON shifts;

-- The remaining policies already provide proper company isolation:
-- - "Users can view shifts in their company" (SELECT)
-- - "Employers can manage shifts in their company" (ALL)
-- - "Employers can update shifts" (UPDATE)
-- - "Employers can delete shifts" (DELETE)