import { STORAGE_KEYS } from '../../lib/storageKeys';
import { getCampaignId, getSupabaseClient, isSupabaseConfigured } from '../../lib/supabaseClient';
import { MIGRATION_KEY_SPECS } from '../../migration/manifest';
import { createLocalAdapter } from './localAdapter';

const QUEUE_STORAGE_KEY = 'koa:supabase:queue:v1';
const RETRY_BASE_MS = 900;
const RETRY_MAX_MS = 15000;
// Keep remote state snappy even when realtime subscriptions are unavailable.
const REMOTE_POLL_MS = 30000;
const VISIBILITY_PULL_COOLDOWN_MS = 5000;
const LOCAL_WRITE_PULL_GUARD_MS = 2200;
const DEFAULT_FLUSH_DELAY_MS = 10;
const DEBOUNCED_SHARED_WRITE_MS = 600;
const SYNC_DEBUG_ENABLED = !!import.meta.env.DEV;

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

function shouldDebounceSharedWrite(key) {
  if (key === STORAGE_KEYS.launcher) return true;
  if (key === STORAGE_KEYS.launcherNotes) return true;
  if (key === STORAGE_KEYS.menuCampaignBrief) return true;
  if (String(key || '').startsWith(STORAGE_KEYS.menuNotePrefix)) return true;
  return false;
}

function writeDebounceMsForKey(scope, key, mode = 'upsert') {
  if (mode !== 'upsert') return 0;
  if (scope === 'local' || scope === 'private') return 0;
  return shouldDebounceSharedWrite(key) ? DEBOUNCED_SHARED_WRITE_MS : 0;
}

function toFiniteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
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
  let lastVisibilityPullAtMs = 0;
  let onlineListenerBound = false;
  let visibilityListenerBound = false;

  const pendingQueue = new Map();
  const lastSeenRemoteUpdatedAt = new Map();
  const suppressPullUntilByKey = new Map();
  const minExpectedRemoteStampByKey = new Map();
  const debugCounters = {
    pullReadsWhileConnected: 0,
    fallbackPollRuns: 0,
    writesPerKey: {},
    coalescedWriteSkips: 0,
  };
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

  function bumpDebugCounter(counterKey, amount = 1) {
    if (!SYNC_DEBUG_ENABLED) return;
    if (!Object.prototype.hasOwnProperty.call(debugCounters, counterKey)) return;
    debugCounters[counterKey] = toFiniteNumber(debugCounters[counterKey], 0) + amount;
    publishDebugSnapshot();
  }

  function bumpWriteCounter(key) {
    if (!SYNC_DEBUG_ENABLED) return;
    const normalizedKey = normalizeText(key);
    if (!normalizedKey) return;
    debugCounters.writesPerKey[normalizedKey] = toFiniteNumber(debugCounters.writesPerKey[normalizedKey], 0) + 1;
    publishDebugSnapshot();
  }

  function getDebugSnapshot() {
    if (!SYNC_DEBUG_ENABLED) return null;
    return {
      pullReadsWhileConnected: debugCounters.pullReadsWhileConnected,
      fallbackPollRuns: debugCounters.fallbackPollRuns,
      writesPerKey: { ...debugCounters.writesPerKey },
      coalescedWriteSkips: debugCounters.coalescedWriteSkips,
    };
  }

  function publishDebugSnapshot() {
    if (!SYNC_DEBUG_ENABLED || typeof window === 'undefined') return;
    window.__koaSupabaseSyncDebug = getDebugSnapshot();
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
      readyAt: toFiniteNumber(item.readyAt, Date.now()),
    }));
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(serializable));
    } catch {}
    updateStatus({ queueSize: serializable.length });
    publishDebugSnapshot();
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
          readyAt: toFiniteNumber(item.readyAt, Date.now()),
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
    }, Math.max(0, toFiniteNumber(delayMs, DEFAULT_FLUSH_DELAY_MS)));
  }

  function bindOnlineListener() {
    if (onlineListenerBound || typeof window === 'undefined') return;
    onlineListenerBound = true;
    window.addEventListener('online', () => {
      scheduleFlush(DEFAULT_FLUSH_DELAY_MS);
    });
  }

  function bindVisibilityListener() {
    if (visibilityListenerBound || typeof document === 'undefined') return;
    visibilityListenerBound = true;
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState !== 'visible') return;
      scheduleFlush(DEFAULT_FLUSH_DELAY_MS);
      if (!status.ready || !supabase || !campaignId || (!userId && !sharedReadOnly)) return;
      if (status.connected) return;
      const now = Date.now();
      if (now - lastVisibilityPullAtMs < VISIBILITY_PULL_COOLDOWN_MS) return;
      lastVisibilityPullAtMs = now;
      try {
        await loadRemoteDocuments('focus');
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

  function markLocalWriteBarrier(scope, key, ttlMs = LOCAL_WRITE_PULL_GUARD_MS) {
    if (scope === 'local') return;
    const id = queueKey(scope, key);
    suppressPullUntilByKey.set(id, Date.now() + Math.max(0, ttlMs));
  }

  function shouldIgnoreRemoteApply(scope, key, reason) {
    const id = queueKey(scope, key);
    if (pendingQueue.has(id)) return true;
    if (reason !== 'pull') return false;
    const holdUntil = suppressPullUntilByKey.get(id) || 0;
    if (!holdUntil) return false;
    if (holdUntil <= Date.now()) {
      suppressPullUntilByKey.delete(id);
      return false;
    }
    return true;
  }

  function enqueue(scope, key, mode, type, value) {
    if (scope === 'local') return;
    const debounceMs = writeDebounceMsForKey(scope, key, mode);
    const now = Date.now();
    const id = queueKey(scope, key);
    pendingQueue.set(id, {
      scope,
      key,
      mode,
      type,
      value,
      enqueuedAt: new Date(now).toISOString(),
      attempts: 0,
      readyAt: now + debounceMs,
    });
    markLocalWriteBarrier(scope, key);
    persistQueue();
    scheduleFlush(Math.max(DEFAULT_FLUSH_DELAY_MS, debounceMs));
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
    stopPolling();
    updateStatus({ connected: false });
  }

  function stopPolling() {
    if (!remotePollTimer) return;
    clearInterval(remotePollTimer);
    remotePollTimer = null;
  }

  function startPolling() {
    if (remotePollTimer) return;
    remotePollTimer = setInterval(async () => {
      if (!status.ready || !supabase || !campaignId || (!userId && !sharedReadOnly)) return;
      if (status.connected) {
        stopPolling();
        return;
      }
      bumpDebugCounter('fallbackPollRuns');
      try {
        await loadRemoteDocuments('fallback-poll');
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

  function updateConnectedState() {
    const connected = sharedSubscribed || privateSubscribed;
    updateStatus({ connected });
    if (connected) stopPolling();
    else if (status.ready) startPolling();
  }

  function applyRemoteRow(scope, row, reason) {
    const key = normalizeText(row?.doc_key);
    if (!key) return;

    const ownScope = getScope(key);
    if (ownScope !== scope) return;
    if (shouldIgnoreRemoteApply(scope, key, reason)) return;

    const remoteStamp = normalizeText(row?.updated_at);
    const stampKey = queueKey(scope, key);
    const minExpectedStamp = minExpectedRemoteStampByKey.get(stampKey) || '';
    if (minExpectedStamp) {
      if (!remoteStamp || remoteStamp < minExpectedStamp) return;
      minExpectedRemoteStampByKey.delete(stampKey);
    }
    if (remoteStamp && lastSeenRemoteUpdatedAt.get(stampKey) === remoteStamp) return;
    if (remoteStamp) lastSeenRemoteUpdatedAt.set(stampKey, remoteStamp);

    const payload = normalizePayload(row?.payload);
    writeLocalValue(key, payload.type, payload.value);
    emitRemoteChange(key, payload.value, { type: payload.type, reason });
  }

  function applyRemoteDelete(scope, row, reason) {
    const key = normalizeText(row?.doc_key);
    if (!key) return;
    if (shouldIgnoreRemoteApply(scope, key, reason)) return;
    lastSeenRemoteUpdatedAt.delete(queueKey(scope, key));
    removeLocalValue(key);
    emitRemoteChange(key, undefined, { type: 'remove', reason });
  }

  async function loadRemoteDocuments(reason = 'manual') {
    if (!supabase || !campaignId || (!userId && !sharedReadOnly)) return;
    if (status.connected) bumpDebugCounter('pullReadsWhileConnected');

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
          updateConnectedState();
          if (userId) scheduleFlush(50);
          return;
        }
        if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
          sharedSubscribed = false;
          updateConnectedState();
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
          updateConnectedState();
          scheduleFlush(50);
          return;
        }
        if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
          privateSubscribed = false;
          updateConnectedState();
        }
      });
  }

  async function sendOperation(op) {
    if (!supabase) throw new Error('Supabase client is unavailable.');
    if (!campaignId || !userId) throw new Error('Supabase session is not configured.');

    const isPrivate = op.scope === 'private';
    const table = isPrivate ? 'private_docs' : 'shared_docs';
    bumpWriteCounter(op.key);
    publishDebugSnapshot();

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
    const rowUpdatedAt = new Date().toISOString();

    const row = {
      campaign_id: campaignId,
      doc_key: op.key,
      payload,
      updated_by: userId,
      updated_at: rowUpdatedAt,
    };
    if (isPrivate) row.user_id = userId;
    minExpectedRemoteStampByKey.set(queueKey(op.scope, op.key), rowUpdatedAt);

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
    let earliestReadyAt = Number.POSITIVE_INFINITY;
    let wroteAny = false;

    for (let i = 0; i < ops.length; i += 1) {
      const op = ops[i];
      const nowMs = Date.now();
      const readyAt = toFiniteNumber(op.readyAt, 0);
      if (readyAt > nowMs) {
        earliestReadyAt = Math.min(earliestReadyAt, readyAt);
        bumpDebugCounter('coalescedWriteSkips');
        continue;
      }
      const id = queueKey(op.scope, op.key);
      try {
        await sendOperation(op);
        pendingQueue.delete(id);
        markLocalWriteBarrier(op.scope, op.key);
        wroteAny = true;
      } catch (err) {
        let effectiveError = err;
        if (isPermissionLikeError(err)) {
          try {
            await supabase.rpc('claim_campaign_membership', { p_campaign_id: campaignId });
            await sendOperation(op);
            pendingQueue.delete(id);
            markLocalWriteBarrier(op.scope, op.key);
            wroteAny = true;
            continue;
          } catch (retryErr) {
            effectiveError = retryErr;
          }
        }

        const attempts = (op.attempts || 0) + 1;
        maxAttempts = Math.max(maxAttempts, attempts);
        pendingQueue.set(id, { ...op, attempts, readyAt: Date.now() });
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

    if (pendingQueue.size > 0) {
      const delayMs = Number.isFinite(earliestReadyAt)
        ? Math.max(DEFAULT_FLUSH_DELAY_MS, earliestReadyAt - Date.now())
        : DEFAULT_FLUSH_DELAY_MS;
      scheduleFlush(delayMs);
    }

    if (wroteAny) {
      updateStatus({
        lastSyncError: '',
        lastSyncAt: new Date().toISOString(),
      });
    }
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
  publishDebugSnapshot();

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
    },
    readText(key, fallbackValue = '') {
      return local.readText(key, fallbackValue);
    },
    writeText(key, value) {
      const normalized = normalizeText(value);
      local.writeText(key, normalized);
      const scope = getScope(key);
      enqueue(scope, key, 'upsert', 'text', normalized);
    },
    remove(key) {
      local.remove(key);
      const scope = getScope(key);
      enqueue(scope, key, 'remove', 'json', null);
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
        await loadRemoteDocuments('configure');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to pull cloud data.';
        updateStatus({ lastSyncError: msg });
      }

      startRealtime();
      updateStatus({ ready: true });
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
      const next = {
        ...status,
        queueSize: pendingQueue.size,
      };
      if (SYNC_DEBUG_ENABLED) next.debug = getDebugSnapshot();
      return next;
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
        await loadRemoteDocuments('seed-refresh');
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
