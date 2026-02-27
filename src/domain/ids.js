export function createId(prefix = '') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    const id = crypto.randomUUID();
    return prefix ? `${prefix}_${id}` : id;
  }

  const fallback = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  return prefix ? `${prefix}_${fallback}` : fallback;
}
