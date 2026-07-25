// Supabase client — direct, no lazy Proxy.
// Values fall back to the project credentials so a stale dev-server
// restart can never leave the client without config.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const FALLBACK_URL = 'https://ittudzdwyqdsolduyhjh.supabase.co';
const FALLBACK_KEY = 'sb_publishable_BLMrVVQWS3ztVAcSFzlrKg_5xscZmZa';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

const SUPABASE_URL =
  (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_SUPABASE_URL) ||
  process.env.SUPABASE_URL ||
  FALLBACK_URL;

const SUPABASE_PUBLISHABLE_KEY =
  (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  FALLBACK_KEY;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: {
    fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
  },
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});
