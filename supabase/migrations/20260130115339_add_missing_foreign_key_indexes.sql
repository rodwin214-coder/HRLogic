/*
  # Add Missing Foreign Key Indexes

  1. Performance Improvements
    - Add indexes for all foreign key columns that don't have covering indexes
    - This improves JOIN performance and query execution speed
  
  2. Indexes Added
    - audit_logs: company_id, editor_id, employee_id
    - custom_field_definitions: company_id
    - employee_files: uploaded_by
    - employees: shift_id
    - holidays: company_id
    - salary_history: employee_id
    - shifts: company_id
    - tasks: company_id
    - user_accounts: employee_id
*/

-- Add index for audit_logs foreign keys
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_editor_id ON audit_logs(editor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_employee_id ON audit_logs(employee_id);

-- Add index for custom_field_definitions
CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_company_id ON custom_field_definitions(company_id);

-- Add index for employee_files
CREATE INDEX IF NOT EXISTS idx_employee_files_uploaded_by ON employee_files(uploaded_by);

-- Add index for employees
CREATE INDEX IF NOT EXISTS idx_employees_shift_id ON employees(shift_id);

-- Add index for holidays
CREATE INDEX IF NOT EXISTS idx_holidays_company_id ON holidays(company_id);

-- Add index for salary_history
CREATE INDEX IF NOT EXISTS idx_salary_history_employee_id ON salary_history(employee_id);

-- Add index for shifts
CREATE INDEX IF NOT EXISTS idx_shifts_company_id ON shifts(company_id);

-- Add index for tasks
CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON tasks(company_id);

-- Add index for user_accounts
CREATE INDEX IF NOT EXISTS idx_user_accounts_employee_id ON user_accounts(employee_id);