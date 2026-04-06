/*
  # Remove unused indexes

  ## Summary
  The following indexes have never been used by the query planner and add overhead
  on every INSERT/UPDATE/DELETE without providing any query benefit.

  ## Removed Indexes
  - idx_custom_holiday_types_company_id (custom_holiday_types)
  - idx_audit_logs_editor_id (audit_logs)
  - idx_audit_logs_employee_id (audit_logs)
  - idx_audit_logs_company_id (audit_logs)
  - idx_custom_field_definitions_company_id (custom_field_definitions)
  - idx_employee_files_uploaded_by (employee_files)
  - idx_employees_shift_id (employees)
  - idx_holidays_company_id (holidays)
  - idx_shifts_company_id (shifts)
  - idx_tasks_company_id (tasks)
  - idx_notifications_company_id (notifications)
  - idx_notifications_user_id (notifications)
  - idx_notifications_created_at (notifications)
  - idx_notifications_is_read (notifications)
  - idx_notification_settings_user_id (notification_settings)
  - idx_password_reset_tokens_token (password_reset_tokens)
  - idx_password_reset_tokens_email (password_reset_tokens)
  - idx_password_reset_tokens_expires_at (password_reset_tokens)
*/

DROP INDEX IF EXISTS public.idx_custom_holiday_types_company_id;
DROP INDEX IF EXISTS public.idx_audit_logs_editor_id;
DROP INDEX IF EXISTS public.idx_audit_logs_employee_id;
DROP INDEX IF EXISTS public.idx_audit_logs_company_id;
DROP INDEX IF EXISTS public.idx_custom_field_definitions_company_id;
DROP INDEX IF EXISTS public.idx_employee_files_uploaded_by;
DROP INDEX IF EXISTS public.idx_employees_shift_id;
DROP INDEX IF EXISTS public.idx_holidays_company_id;
DROP INDEX IF EXISTS public.idx_shifts_company_id;
DROP INDEX IF EXISTS public.idx_tasks_company_id;
DROP INDEX IF EXISTS public.idx_notifications_company_id;
DROP INDEX IF EXISTS public.idx_notifications_user_id;
DROP INDEX IF EXISTS public.idx_notifications_created_at;
DROP INDEX IF EXISTS public.idx_notifications_is_read;
DROP INDEX IF EXISTS public.idx_notification_settings_user_id;
DROP INDEX IF EXISTS public.idx_password_reset_tokens_token;
DROP INDEX IF EXISTS public.idx_password_reset_tokens_email;
DROP INDEX IF EXISTS public.idx_password_reset_tokens_expires_at;
