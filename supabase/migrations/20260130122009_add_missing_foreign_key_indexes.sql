/*
  # Add Missing Foreign Key Indexes

  1. Problem
    - Multiple tables have foreign keys without covering indexes
    - This leads to suboptimal query performance
  
  2. Solution
    - Add indexes for all unindexed foreign keys
  
  3. Security
    - Improves query performance
    - Prevents table scans on JOIN operations
*/

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_editor_id ON audit_logs(editor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_employee_id ON audit_logs(employee_id);

-- Custom field definitions indexes
CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_company_id ON custom_field_definitions(company_id);

-- Employee files indexes
CREATE INDEX IF NOT EXISTS idx_employee_files_uploaded_by ON employee_files(uploaded_by);

-- Employees indexes
CREATE INDEX IF NOT EXISTS idx_employees_shift_id ON employees(shift_id);

-- Holidays indexes
CREATE INDEX IF NOT EXISTS idx_holidays_company_id ON holidays(company_id);

-- Salary history indexes
CREATE INDEX IF NOT EXISTS idx_salary_history_employee_id ON salary_history(employee_id);

-- Shifts indexes
CREATE INDEX IF NOT EXISTS idx_shifts_company_id ON shifts(company_id);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON tasks(company_id);

-- User accounts indexes
CREATE INDEX IF NOT EXISTS idx_user_accounts_employee_id ON user_accounts(employee_id);