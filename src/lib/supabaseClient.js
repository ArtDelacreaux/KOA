import { createClient } from "@supabase/supabase-js";

/**
 * Load environment variables (Vite only exposes VITE_* vars)
 */
const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
const DATA_BACKEND = String(import.meta.env.VITE_DATA_BACKEND || "").trim();

/**
 * Debug logs — remove later if you want
 */
console.log("[SUPABASE] URL:", SUPABASE_URL);
console.log("[SUPABASE] KEY LOADED:", !!SUPABASE_ANON_KEY);
console.log("[SUPABASE] BACKEND:", DATA_BACKEND);

/**
 * Singleton client (prevents multiple connections)
 */
let singletonClient = null;

/**
 * Check if Supabase is properly configured
 */
export function isSupabaseConfigured() {
  return DATA_BACKEND === "supabase" && !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
}

/**
 * Campaign ID from env (fallback only for dev)
 */
export function getCampaignId() {
  return (
    String(import.meta.env.VITE_CAMPAIGN_ID || "").trim() ||
    "main-party"
  );
}

/**
 * Get Supabase client instance
 */
export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    console.warn("[SUPABASE] Not configured correctly.");
    return null;
  }

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