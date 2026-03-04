import { STORAGE_KEYS } from '../../lib/storageKeys';
import { getCampaignId, getSupabaseClient, isSupabaseConfigured } from '../../lib/supabaseClient';
import { MIGRATION_KEY_SPECS } from '../../migration/manifest';
import { createLocalAdapter } from './localAdapter';

const QUEUE_STORAGE_KEY = 'koa:supabase:queue:v1';
const RETRY_BASE_MS = 900;
const RETRY_MAX_MS = 15000;
// Keep remote state snappy even when realtime subscriptions are unavailable.
const REMOTE_POLL_MS = 1000;

const PRIVATE_KEYS = new Set([STORAGE_KEYS.launcherNotes].filter(Boolean));
const LOCAL_ONLY_KEYS = new Set([STORAGE_KEYS.worldNpcDeepLink].filter(Boolean));

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function clampRetryMs(attempts) {
  const base = RETRY_BASE_MS * Math.pow(2, Math.max(0, attempts - 1));
  return Math.max(RETRY_BASE_MS, Math.min(RETRY_MAX_MS, base));
}

function normalizeText(value) {
  return String(value ?? '');
}

function queueKey(scope, key) {
  return `${scope}:${key}`;
}

function scopePriority(scope) {
  if (scope === 'shared') return 0;
  if (scope === 'private') return 1;
  return 2;
}

function normalizeErrorMessage(err) {
  if (!err) return 'Unknown sync error.';
  if (typeof err === 'string') return err;
  const parts = [];
  if (typeof err.message === 'string' && err.message.trim()) parts.push(err.message.trim());
  if (typeof err.details === 'string' && err.details.trim()) parts.push(err.details.trim());
  if (typeof err.hint === 'string' && err.hint.trim()) parts.push(`Hint: ${err.hint.trim()}`);
  if (typeof err.code === 'string' && err.code.trim()) parts.push(`Code: ${err.code.trim()}`);
  if (parts.length) return parts.join(' | ');
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown sync error.';
  }
}

function isPermissionLikeError(err) {
  const text = normalizeErrorMessage(err).toLowerCase();
  return (
    text.includes('row-level security') ||
    text.includes('permission denied') ||
    text.includes('not invited') ||
    text.includes('campaign_members') ||
    text.includes('42501')
  );
}

function sanitizeValueForTransport(type, value) {
  if (type === 'text') return normalizeText(value);
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function normalizePayload(stored) {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    return { type: 'json', value: stored };
  }

  if (stored.type === 'text') {
    return { type: 'text', value: normalizeText(stored.value) };
  }

  if (stored.type === 'json' && hasOwn(stored, 'value')) {
    return { type: 'json', value: stored.value };
  }

  return { type: 'json', value: stored };
}

function toSeedLauncherValue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const out = { ...value };
  if (hasOwn(out, 'notes')) delete out.notes;
  return out;
}

function toSnapshotPayloadObject(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return {};
  const payload = snapshot.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  return payload;
}

export function createSupabaseAdapter() {
  const local = createLocalAdapter();

  let supabase = getSupabaseClient();
  let campaignId = getCampaignId();
  let userId = '';
  let role = 'member';
  let sharedReadOnly = false;

  let changeHandler = () => {};
  let queueFlushTimer = null;
  let isFlushing = false;
  let sharedChannel = null;
  let privateChannel = null;
  let sharedSubscribed = false;
  let privateSubscribed = false;
  let remotePollTimer = null;
  let onlineListenerBound = false;
  let visibilityListenerBound = false;

  const pendingQueue = new Map();
  const lastSeenRemoteUpdatedAt = new Map();
  const status = {
    enabled: true,
    configured: isSupabaseConfigured(),
    ready: false,
    connected: false,
    queueSize: 0,
    role: 'member',
    campaignId,
    userId: '',
    lastSyncError: '',
    lastSyncAt: '',
  };

  function updateStatus(partial) {
    Object.assign(status, partial || {});
  }

  function getScope(key) {
    if (LOCAL_ONLY_KEYS.has(key)) return 'local';
    if (PRIVATE_KEYS.has(key)) return 'private';
    return 'shared';
  }

  function persistQueue() {
    const serializable = Array.from(pendingQueue.values()).map((item) => ({
      scope: item.scope,
      key: item.key,
      mode: item.mode,
      type: item.type,
      value: item.value,
      enqueuedAt: item.enqueuedAt,
      attempts: item.attempts || 0,
    }));
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(serializable));
    } catch {}
    updateStatus({ queueSize: serializable.length });
  }

  function loadQueue() {
    let parsed = [];
    try {
      const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
      parsed = raw ? JSON.parse(raw) : [];
    } catch {
      parsed = [];
    }
    pendingQueue.clear();
    if (Array.isArray(parsed)) {
      parsed.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const key = normalizeText(item.key);
        const scope = normalizeText(item.scope) || 'shared';
        if (!key) return;
        const id = queueKey(scope, key);
        pendingQueue.set(id, {
          scope,
          key,
          mode: item.mode === 'remove' ? 'remove' : 'upsert',
          type: item.type === 'text' ? 'text' : 'json',
          value: item.value,
          enqueuedAt: item.enqueuedAt || new Date().toISOString(),
          attempts: Math.max(0, Number.parseInt(item.attempts, 10) || 0),
        });
      });
    }
    persistQueue();
  }

  function scheduleFlush(delayMs = 0) {
    if (queueFlushTimer) {
      clearTimeout(queueFlushTimer);
      queueFlushTimer = null;
    }
    queueFlushTimer = setTimeout(() => {
      queueFlushTimer = null;
      flushPendingWrites();
    }, Math.max(0, delayMs));
  }

  function bindOnlineListener() {
    if (onlineListenerBound || typeof window === 'undefined') return;
    onlineListenerBound = true;
    window.addEventListener('online', () => {
      scheduleFlush(10);
    });
  }

  function bindVisibilityListener() {
    if (visibilityListenerBound || typeof document === 'undefined') return;
    visibilityListenerBound = true;
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState !== 'visible') return;
      scheduleFlush(10);
      if (!status.ready || !supabase || !campaignId || (!userId && !sharedReadOnly)) return;
      try {
        await loadRemoteDocuments();
        updateStatus({
          lastSyncError: '',
          lastSyncAt: new Date().toISOString(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Refresh sync failed.';
        updateStatus({ lastSyncError: msg });
      }
    });
  }

  function emitRemoteChange(key, value, meta = {}) {
    try {
      changeHandler(key, value, { source: 'remote', ...meta });
    } catch {}
  }

  function writeLocalValue(key, type, value) {
    if (type === 'text') {
      local.writeText(key, normalizeText(value));
      return;
    }
    local.writeJson(key, value);
  }

  function removeLocalValue(key) {
    local.remove(key);
  }

  function enqueue(scope, key, mode, type, value) {
    if (scope === 'local') return;
    const id = queueKey(scope, key);
    pendingQueue.set(id, {
      scope,
      key,
      mode,
      type,
      value,
      enqueuedAt: new Date().toISOString(),
      attempts: 0,
    });
    persistQueue();
  }

  function teardownRealtime() {
    if (!supabase) return;
    sharedSubscribed = false;
    privateSubscribed = false;
    if (sharedChannel) {
      try {
        supabase.removeChannel(sharedChannel);
      } catch {}
      sharedChannel = null;
    }
    if (privateChannel) {
      try {
        supabase.removeChannel(privateChannel);
      } catch {}
      privateChannel = null;
    }
    updateStatus({ connected: false });
  }

  function stopPolling() {
    if (!remotePollTimer) return;
    clearInterval(remotePollTimer);
    remotePollTimer = null;
  }

  function startPolling() {
    stopPolling();
    remotePollTimer = setInterval(async () => {
      if (status.connected) return;
      if (!status.ready || !supabase || !campaignId || (!userId && !sharedReadOnly)) return;
      try {
        await loadRemoteDocuments();
        updateStatus({
          lastSyncError: '',
          lastSyncAt: new Date().toISOString(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Background sync failed.';
        updateStatus({ lastSyncError: msg });
      }
    }, REMOTE_POLL_MS);
  }

  function applyRemoteRow(scope, row, reason) {
    const key = normalizeText(row?.doc_key);
    if (!key) return;

    const ownScope = getScope(key);
    if (ownScope !== scope) return;

    const remoteStamp = normalizeText(row?.updated_at);
    const stampKey = queueKey(scope, key);
    if (remoteStamp && lastSeenRemoteUpdatedAt.get(stampKey) === remoteStamp) return;
    if (remoteStamp) lastSeenRemoteUpdatedAt.set(stampKey, remoteStamp);

    const payload = normalizePayload(row?.payload);
    writeLocalValue(key, payload.type, payload.value);
    emitRemoteChange(key, payload.value, { type: payload.type, reason });
  }

  function applyRemoteDelete(scope, row, reason) {
    const key = normalizeText(row?.doc_key);
    if (!key) return;
    lastSeenRemoteUpdatedAt.delete(queueKey(scope, key));
    removeLocalValue(key);
    emitRemoteChange(key, undefined, { type: 'remove', reason });
  }

  async function loadRemoteDocuments() {
    if (!supabase || !campaignId || (!userId && !sharedReadOnly)) return;

    const [sharedRes, privateRes] = await Promise.all([
      supabase
        .from('shared_docs')
        .select('doc_key,payload,updated_at')
        .eq('campaign_id', campaignId),
      userId
        ? supabase
            .from('private_docs')
            .select('doc_key,payload,updated_at,user_id')
            .eq('campaign_id', campaignId)
            .eq('user_id', userId)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (sharedRes.error) throw sharedRes.error;
    if (privateRes.error) throw privateRes.error;

    (sharedRes.data || []).forEach((row) => applyRemoteRow('shared', row, 'pull'));
    (privateRes.data || []).forEach((row) => applyRemoteRow('private', row, 'pull'));
  }

  function startRealtime() {
    if (!supabase || !campaignId || (!userId && !sharedReadOnly)) return;
    teardownRealtime();
    sharedSubscribed = false;
    privateSubscribed = false;

    sharedChannel = supabase
      .channel(`koa-shared:${campaignId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shared_docs', filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            applyRemoteDelete('shared', payload.old, 'realtime');
            return;
          }
          applyRemoteRow('shared', payload.new, 'realtime');
        }
      )
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') {
          sharedSubscribed = true;
          updateStatus({ connected: sharedSubscribed || privateSubscribed });
          if (userId) scheduleFlush(50);
          return;
        }
        if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
          sharedSubscribed = false;
          updateStatus({ connected: sharedSubscribed || privateSubscribed });
        }
      });

    if (!userId) return;

    privateChannel = supabase
      .channel(`koa-private:${campaignId}:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'private_docs', filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
          if (normalizeText(row?.user_id) !== normalizeText(userId)) return;
          if (payload.eventType === 'DELETE') {
            applyRemoteDelete('private', row, 'realtime');
            return;
          }
          applyRemoteRow('private', row, 'realtime');
        }
      )
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') {
          privateSubscribed = true;
          updateStatus({ connected: sharedSubscribed || privateSubscribed });
          scheduleFlush(50);
          return;
        }
        if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
          privateSubscribed = false;
          updateStatus({ connected: sharedSubscribed || privateSubscribed });
        }
      });
  }

  async function sendOperation(op) {
    if (!supabase) throw new Error('Supabase client is unavailable.');
    if (!campaignId || !userId) throw new Error('Supabase session is not configured.');

    const isPrivate = op.scope === 'private';
    const table = isPrivate ? 'private_docs' : 'shared_docs';

    if (op.mode === 'remove') {
      let query = supabase.from(table).delete().eq('campaign_id', campaignId).eq('doc_key', op.key);
      if (isPrivate) query = query.eq('user_id', userId);
      const { error } = await query;
      if (error) throw error;
      return;
    }

    const payload = {
      type: op.type === 'text' ? 'text' : 'json',
      value: sanitizeValueForTransport(op.type, op.value),
    };

    const row = {
      campaign_id: campaignId,
      doc_key: op.key,
      payload,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };
    if (isPrivate) row.user_id = userId;

    const { error } = await supabase.from(table).upsert(row, {
      onConflict: isPrivate ? 'campaign_id,user_id,doc_key' : 'campaign_id,doc_key',
    });
    if (error) throw error;
  }

  async function flushPendingWrites() {
    if (!supabase || !status.ready || !campaignId || !userId) return;
    if (isFlushing) return;
    if (pendingQueue.size === 0) return;

    isFlushing = true;
    const ops = Array.from(pendingQueue.values()).sort((a, b) => {
      const scopeDiff = scopePriority(a.scope) - scopePriority(b.scope);
      if (scopeDiff !== 0) return scopeDiff;
      return a.enqueuedAt.localeCompare(b.enqueuedAt);
    });

    let maxAttempts = 0;
    let failureMessage = '';

    for (let i = 0; i < ops.length; i += 1) {
      const op = ops[i];
      const id = queueKey(op.scope, op.key);
      try {
        await sendOperation(op);
        pendingQueue.delete(id);
      } catch (err) {
        let effectiveError = err;
        if (isPermissionLikeError(err)) {
          try {
            await supabase.rpc('claim_campaign_membership', { p_campaign_id: campaignId });
            await sendOperation(op);
            pendingQueue.delete(id);
            continue;
          } catch (retryErr) {
            effectiveError = retryErr;
          }
        }

        const attempts = (op.attempts || 0) + 1;
        maxAttempts = Math.max(maxAttempts, attempts);
        pendingQueue.set(id, { ...op, attempts });
        if (!failureMessage) {
          failureMessage = `[${op.scope}:${op.key}] ${normalizeErrorMessage(effectiveError)}`;
        }
      }
    }
    persistQueue();

    if (failureMessage) {
      updateStatus({ lastSyncError: failureMessage });
      isFlushing = false;
      scheduleFlush(clampRetryMs(maxAttempts || 1));
      return;
    }

    updateStatus({
      lastSyncError: '',
      lastSyncAt: new Date().toISOString(),
    });
    isFlushing = false;
  }

  function buildSharedSeedDocsFromSnapshot(snapshot) {
    const payload = toSnapshotPayloadObject(snapshot);
    const docs = {};

    MIGRATION_KEY_SPECS.forEach((spec) => {
      if (!spec?.key) return;
      const scope = getScope(spec.key);
      if (scope !== 'shared') return;

      const incoming = hasOwn(payload, spec.id) ? payload[spec.id] : spec.fallback;
      const value = spec.key === STORAGE_KEYS.launcher ? toSeedLauncherValue(incoming) : incoming;
      docs[spec.key] = {
        type: spec.type === 'text' ? 'text' : 'json',
        value,
      };
    });

    return docs;
  }

  loadQueue();
  bindOnlineListener();
  bindVisibilityListener();

  return {
    name: 'supabase',
    setChangeHandler(handler) {
      changeHandler = typeof handler === 'function' ? handler : () => {};
    },
    readJson(key, fallbackValue) {
      return local.readJson(key, fallbackValue);
    },
    writeJson(key, value) {
      local.writeJson(key, value);
      const scope = getScope(key);
      enqueue(scope, key, 'upsert', 'json', value);
      scheduleFlush(10);
    },
    readText(key, fallbackValue = '') {
      return local.readText(key, fallbackValue);
    },
    writeText(key, value) {
      const normalized = normalizeText(value);
      local.writeText(key, normalized);
      const scope = getScope(key);
      enqueue(scope, key, 'upsert', 'text', normalized);
      scheduleFlush(10);
    },
    remove(key) {
      local.remove(key);
      const scope = getScope(key);
      enqueue(scope, key, 'remove', 'json', null);
      scheduleFlush(10);
    },
    async configureSession(config = {}) {
      supabase = getSupabaseClient();
      if (!supabase) {
        updateStatus({
          configured: false,
          ready: false,
          connected: false,
          lastSyncError: 'Missing Supabase env configuration.',
        });
        throw new Error('Missing Supabase configuration.');
      }

      campaignId = normalizeText(config.campaignId) || getCampaignId();
      userId = normalizeText(config.userId);
      role = normalizeText(config.role) || 'member';
      sharedReadOnly = !!config.readOnlyShared;
      updateStatus({
        configured: true,
        ready: false,
        role,
        campaignId,
        userId,
        lastSyncError: '',
      });

      teardownRealtime();
      stopPolling();

      if (!campaignId || (!userId && !sharedReadOnly)) {
        updateStatus({ ready: false });
        return this.getCloudStatus();
      }

      try {
        await loadRemoteDocuments();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to pull cloud data.';
        updateStatus({ lastSyncError: msg });
      }

      startRealtime();
      updateStatus({ ready: true });
      startPolling();
      if (userId) await flushPendingWrites();
      return this.getCloudStatus();
    },
    async clearSession() {
      teardownRealtime();
      stopPolling();
      userId = '';
      role = 'member';
      sharedReadOnly = false;
      updateStatus({
        ready: false,
        connected: false,
        role: 'member',
        userId: '',
      });
      return this.getCloudStatus();
    },
    getCloudStatus() {
      return {
        ...status,
        queueSize: pendingQueue.size,
      };
    },
    async seedCampaignFromSnapshot(snapshot) {
      if (!supabase || !campaignId || !userId) {
        throw new Error('Cannot seed cloud before auth session is ready.');
      }
      const docs = buildSharedSeedDocsFromSnapshot(snapshot);
      const { data, error } = await supabase.rpc('seed_campaign_once', {
        p_campaign_id: campaignId,
        p_docs: docs,
      });
      if (error) throw new Error(error.message || 'Cloud seed failed.');

      try {
        await loadRemoteDocuments();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Cloud seeded but pull refresh failed.';
        updateStatus({ lastSyncError: msg });
      }

      return data;
    },
    async flushPendingWrites() {
      await flushPendingWrites();
      return this.getCloudStatus();
    },
  };
}
