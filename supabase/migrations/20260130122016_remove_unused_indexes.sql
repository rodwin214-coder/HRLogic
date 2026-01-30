/*
  # Remove Unused Indexes

  1. Problem
    - Several indexes are not being used
    - Unused indexes consume storage and slow down writes
  
  2. Solution
    - Remove unused indexes
  
  3. Security
    - Improves write performance
    - Reduces storage overhead
*/

-- Remove unused indexes
DROP INDEX IF EXISTS idx_attendance_records_company_id;
DROP INDEX IF EXISTS idx_employee_files_company_id;
DROP INDEX IF EXISTS idx_requests_company_id;
DROP INDEX IF EXISTS idx_requests_employee_id;
DROP INDEX IF EXISTS idx_tasks_employee_id_fk;