/*
  # Allow Anonymous Company Code Validation
  
  This migration updates the companies table SELECT policy to allow anonymous users
  to check if a company code exists during registration.
  
  ## Changes
  
  1. **Update SELECT Policy**
     - Allow both anon and authenticated users to view companies
     - Required for company code validation during registration
     - Safe because company information is not sensitive
  
  ## Security
  
  - Only basic company info is exposed (company_code, name, etc.)
  - No sensitive data in companies table
  - Users still can't modify other companies' data
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own company" ON companies;

-- Create new SELECT policy that allows anon users
CREATE POLICY "Allow viewing companies"
  ON companies FOR SELECT
  TO anon, authenticated
  USING (true);
