import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

let singletonClient = null;

export function isSupabaseConfigured() {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getCampaignId() {
  return String(import.meta.env.VITE_CAMPAIGN_ID || 'main-party').trim() || 'main-party';
}

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  if (singletonClient) return singletonClient;

  singletonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return singletonClient;
}
