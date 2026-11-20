import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function normalizeSupabaseUrl(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'https://your-project-id.supabase.co') {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);

const isValidConfig =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  supabaseAnonKey !== 'your-anon-public-key';

export const supabase: SupabaseClient | null = isValidConfig
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

export const isSupabaseConfigured = Boolean(supabase);
