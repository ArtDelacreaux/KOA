import { createLocalAdapter } from './localAdapter';

let hasWarned = false;

function warnFallbackOnce() {
  if (hasWarned) return;
  hasWarned = true;
  console.warn('[repository] Supabase adapter is not implemented yet. Using local adapter fallback.');
}

export function createSupabaseAdapter() {
  const local = createLocalAdapter();
  return {
    name: 'supabase-fallback',
    readJson(key, fallbackValue) {
      warnFallbackOnce();
      return local.readJson(key, fallbackValue);
    },
    writeJson(key, value) {
      warnFallbackOnce();
      local.writeJson(key, value);
    },
    readText(key, fallbackValue = '') {
      warnFallbackOnce();
      return local.readText(key, fallbackValue);
    },
    writeText(key, value) {
      warnFallbackOnce();
      local.writeText(key, value);
    },
    remove(key) {
      warnFallbackOnce();
      local.remove(key);
    },
  };
}
