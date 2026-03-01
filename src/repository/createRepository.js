export function createRepository(adapter) {
  return {
    adapterName: adapter?.name || 'unknown',
    readJson(key, fallbackValue) {
      return adapter.readJson(key, fallbackValue);
    },
    writeJson(key, value) {
      adapter.writeJson(key, value);
    },
    readText(key, fallbackValue = '') {
      return adapter.readText(key, fallbackValue);
    },
    writeText(key, value) {
      adapter.writeText(key, value);
    },
    remove(key) {
      adapter.remove(key);
    },
  };
}
