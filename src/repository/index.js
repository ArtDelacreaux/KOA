import { createRepository } from './createRepository';
import { createLocalAdapter } from './adapters/localAdapter';
import { createSupabaseAdapter } from './adapters/supabaseAdapter';

function selectAdapter(backend) {
  // Single switch point for storage backend.
  if (backend === 'supabase') return createSupabaseAdapter();
  return createLocalAdapter();
}

export const dataBackend = String(import.meta.env.VITE_DATA_BACKEND || 'local').toLowerCase();
export const isSupabaseBackend = dataBackend === 'supabase';
export const repository = createRepository(selectAdapter(dataBackend));
