/*
  # Remove Unused Indexes

  1. Performance Improvements
    - Remove unused index `idx_salary_history_employee_id` from salary_history table
    - Remove unused index `idx_audit_logs_company_id` from audit_logs table
    - Remove unused index `idx_audit_logs_editor_id` from audit_logs table
    - Remove unused index `idx_audit_logs_employee_id` from audit_logs table
    - Remove unused index `idx_custom_field_definitions_company_id` from custom_field_definitions table
    - Remove unused index `idx_employee_files_uploaded_by` from employee_files table
    - Remove unused index `idx_employees_shift_id` from employees table
    - Remove unused index `idx_holidays_company_id` from holidays table
    - Remove unused index `idx_shifts_company_id` from shifts table
    - Remove unused index `idx_tasks_company_id` from tasks table
    - Remove unused index `idx_user_accounts_employee_id` from user_accounts table

  2. Notes
    - Removing unused indexes reduces storage overhead and improves write performance
    - Using IF EXISTS to prevent errors if indexes don't exist
*/

-- Remove unused indexes
DROP INDEX IF EXISTS idx_salary_history_employee_id;
DROP INDEX IF EXISTS idx_audit_logs_company_id;
DROP INDEX IF EXISTS idx_audit_logs_editor_id;
DROP INDEX IF EXISTS idx_audit_logs_employee_id;
DROP INDEX IF EXISTS idx_custom_field_definitions_company_id;
DROP INDEX IF EXISTS idx_employee_files_uploaded_by;
DROP INDEX IF EXISTS idx_employees_shift_id;
DROP INDEX IF EXISTS idx_holidays_company_id;
DROP INDEX IF EXISTS idx_shifts_company_id;
DROP INDEX IF EXISTS idx_tasks_company_id;
DROP INDEX IF EXISTS idx_user_accounts_employee_id;