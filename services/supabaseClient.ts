import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper to set the current user email for RLS
export const setCurrentUserEmail = async (email: string) => {
  await supabase.rpc('set_config', {
    setting_name: 'app.current_user_email',
    setting_value: email,
  });
};
