import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && publishableKey);

// The publishable key is intentionally safe for browser use. Database access
// is protected by Supabase Row Level Security, which we configure next.
export const supabase = isSupabaseConfigured
  ? createClient(url!, publishableKey!)
  : null;
