/*
  # Remove Unused Indexes

  1. Performance Optimization
    - Remove indexes that are not being used by any queries
    - This reduces storage overhead and improves write performance
  
  2. Indexes Removed
    - idx_employees_email: Not used by queries
    - idx_attendance_company: Not used by queries
    - idx_requests_employee: Not used by queries
    - idx_requests_company: Not used by queries
    - idx_tasks_employee: Not used by queries
    - idx_employee_files_company_id: Not used by queries
    - idx_employee_files_uploaded_at: Not used by queries
  
  3. Note
    - These indexes may have been created speculatively but aren't utilized by the query planner
    - If query patterns change in the future, they can be recreated
*/

-- Remove unused indexes
DROP INDEX IF EXISTS idx_employees_email;
DROP INDEX IF EXISTS idx_attendance_company;
DROP INDEX IF EXISTS idx_requests_employee;
DROP INDEX IF EXISTS idx_requests_company;
DROP INDEX IF EXISTS idx_tasks_employee;
DROP INDEX IF EXISTS idx_employee_files_company_id;
DROP INDEX IF EXISTS idx_employee_files_uploaded_at;