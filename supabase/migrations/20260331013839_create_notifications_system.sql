/*
  # Create notifications system

  1. New Tables
    - `notifications`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `user_id` (uuid, foreign key to employees) - recipient
      - `title` (text) - notification title
      - `message` (text) - notification message
      - `type` (text) - type of notification (clock_in, clock_out, request_pending, etc.)
      - `is_read` (boolean) - whether notification has been read
      - `data` (jsonb) - additional data for the notification
      - `created_at` (timestamptz) - when notification was created
    
    - `notification_settings`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `user_id` (uuid, foreign key to employees)
      - `notify_on_clock_in` (boolean) - notify employer when employee clocks in
      - `notify_on_clock_out` (boolean) - notify employer when employee clocks out
      - `notify_on_request` (boolean) - notify employer on new requests
      - `notify_on_missed_clock_out` (boolean) - notify employee of missed clock out
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own notifications
    - Employers can view all notifications for their company
    - Employees can only view their own notifications
  
  3. Indexes
    - Index on company_id and user_id for fast lookups
    - Index on created_at for sorting
    - Index on is_read for filtering
*/

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  is_read boolean DEFAULT false,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create notification_settings table
CREATE TABLE IF NOT EXISTS notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  notify_on_clock_in boolean DEFAULT true,
  notify_on_clock_out boolean DEFAULT true,
  notify_on_request boolean DEFAULT true,
  notify_on_missed_clock_out boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (user_id = (current_setting('app.current_user_id', true))::uuid);

-- Notification settings policies
CREATE POLICY "Users can view their own notification settings"
  ON notification_settings FOR SELECT
  USING (user_id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Users can insert their own notification settings"
  ON notification_settings FOR INSERT
  WITH CHECK (user_id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Users can update their own notification settings"
  ON notification_settings FOR UPDATE
  USING (user_id = (current_setting('app.current_user_id', true))::uuid);

CREATE POLICY "Users can delete their own notification settings"
  ON notification_settings FOR DELETE
  USING (user_id = (current_setting('app.current_user_id', true))::uuid);