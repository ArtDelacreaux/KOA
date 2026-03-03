function createListenerMap() {
  return new Map();
}

function notify(listenersByKey, key, payload) {
  const set = listenersByKey.get(key);
  if (set) {
    set.forEach((listener) => {
      try {
        listener(payload);
      } catch {}
    });
  }

  const anySet = listenersByKey.get('*');
  if (anySet) {
    anySet.forEach((listener) => {
      try {
        listener(payload);
      } catch {}
    });
  }
}

export function createRepository(adapter) {
  const listenersByKey = createListenerMap();

  const emit = (key, value, meta = {}) => {
    notify(listenersByKey, key, {
      key,
      value,
      meta,
    });
  };

  if (typeof adapter?.setChangeHandler === 'function') {
    adapter.setChangeHandler((key, value, meta = {}) => {
      emit(key, value, meta);
    });
  }

  return {
    get adapterName() {
      return adapter?.name || 'unknown';
    },
    readJson(key, fallbackValue) {
      return adapter.readJson(key, fallbackValue);
    },
    writeJson(key, value, options = {}) {
      adapter.writeJson(key, value, options);
      emit(key, value, { source: 'local', type: 'json', ...options });
    },
    readText(key, fallbackValue = '') {
      return adapter.readText(key, fallbackValue);
    },
    writeText(key, value, options = {}) {
      adapter.writeText(key, value, options);
      emit(key, value, { source: 'local', type: 'text', ...options });
    },
    remove(key, options = {}) {
      adapter.remove(key, options);
      emit(key, undefined, { source: 'local', type: 'remove', ...options });
    },
    subscribe(key, listener) {
      if (typeof listener !== 'function') return () => {};
      const scopeKey = key || '*';
      if (!listenersByKey.has(scopeKey)) {
        listenersByKey.set(scopeKey, new Set());
      }
      const set = listenersByKey.get(scopeKey);
      set.add(listener);
      return () => {
        set.delete(listener);
        if (set.size === 0) listenersByKey.delete(scopeKey);
      };
    },
    async configureSupabaseSession(config) {
      if (typeof adapter?.configureSession !== 'function') return null;
      return adapter.configureSession(config);
    },
    async clearSupabaseSession() {
      if (typeof adapter?.clearSession !== 'function') return null;
      return adapter.clearSession();
    },
    getCloudStatus() {
      if (typeof adapter?.getCloudStatus !== 'function') {
        return { enabled: false };
      }
      return adapter.getCloudStatus();
    },
    async seedCampaignFromSnapshot(snapshot) {
      if (typeof adapter?.seedCampaignFromSnapshot !== 'function') {
        throw new Error('Cloud seeding is not available for this backend.');
      }
      return adapter.seedCampaignFromSnapshot(snapshot);
    },
    async flushPendingWrites() {
      if (typeof adapter?.flushPendingWrites !== 'function') return null;
      return adapter.flushPendingWrites();
    },
  };
}
