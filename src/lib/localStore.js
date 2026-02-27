export function readJson(key, fallbackValue) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallbackValue;
    const parsed = JSON.parse(raw);
    return parsed ?? fallbackValue;
  } catch {
    return fallbackValue;
  }
}

export function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function readText(key, fallbackValue = '') {
  try {
    const raw = localStorage.getItem(key);
    return raw ?? fallbackValue;
  } catch {
    return fallbackValue;
  }
}

export function writeText(key, value) {
  try {
    localStorage.setItem(key, String(value ?? ''));
  } catch {}
}

export function removeStoredItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}
