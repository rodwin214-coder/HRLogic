import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
  global: {
    fetch: (url, options = {}) => {
      return fetch(url, {
        ...options,
        signal: AbortSignal.timeout(10000),
      });
    },
  },
});

// Helper to set the current user email for RLS with retry logic
export const setCurrentUserEmail = async (email: string, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await supabase.rpc('set_config', {
        setting_name: 'app.current_user_email',
        setting_value: email,
      });
      return;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};
