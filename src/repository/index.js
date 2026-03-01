import { createRepository } from './createRepository';
import { createLocalAdapter } from './adapters/localAdapter';
import { createSupabaseAdapter } from './adapters/supabaseAdapter';

function selectAdapter() {
  // Single switch point for storage backend.
  const backend = String(import.meta.env.VITE_DATA_BACKEND || 'local').toLowerCase();
  if (backend === 'supabase') return createSupabaseAdapter();
  return createLocalAdapter();
}

export const repository = createRepository(selectAdapter());
