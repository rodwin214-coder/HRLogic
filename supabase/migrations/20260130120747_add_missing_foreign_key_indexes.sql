/*
  # Add Missing Foreign Key Indexes

  1. Performance Improvements
    - Add index on `attendance_records.company_id` for better query performance
    - Add index on `employee_files.company_id` for better query performance
    - Add index on `requests.company_id` for better query performance
    - Add index on `requests.employee_id` for better query performance
    - Add index on `tasks.employee_id` for better query performance

  2. Notes
    - These indexes support foreign key constraints and improve join performance
    - Using IF NOT EXISTS to prevent errors if indexes already exist
*/

-- Add index for attendance_records.company_id
CREATE INDEX IF NOT EXISTS idx_attendance_records_company_id 
  ON attendance_records(company_id);

-- Add index for employee_files.company_id
CREATE INDEX IF NOT EXISTS idx_employee_files_company_id 
  ON employee_files(company_id);

-- Add index for requests.company_id
CREATE INDEX IF NOT EXISTS idx_requests_company_id 
  ON requests(company_id);

-- Add index for requests.employee_id
CREATE INDEX IF NOT EXISTS idx_requests_employee_id 
  ON requests(employee_id);

-- Add index for tasks.employee_id
CREATE INDEX IF NOT EXISTS idx_tasks_employee_id_fk 
  ON tasks(employee_id);