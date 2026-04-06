/*
  # Add missing foreign key indexes

  ## Summary
  Several tables have foreign key constraints without covering indexes,
  causing suboptimal query performance on JOINs and lookups.

  ## New Indexes
  - attendance_records.company_id
  - employee_files.company_id
  - password_reset_tokens.company_id
  - password_reset_tokens.employee_id
  - requests.company_id
  - requests.employee_id
  - tasks.employee_id
*/

CREATE INDEX IF NOT EXISTS idx_attendance_records_company_id ON public.attendance_records (company_id);
CREATE INDEX IF NOT EXISTS idx_employee_files_company_id ON public.employee_files (company_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_company_id ON public.password_reset_tokens (company_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_employee_id ON public.password_reset_tokens (employee_id);
CREATE INDEX IF NOT EXISTS idx_requests_company_id ON public.requests (company_id);
CREATE INDEX IF NOT EXISTS idx_requests_employee_id ON public.requests (employee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_employee_id ON public.tasks (employee_id);
