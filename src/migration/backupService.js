import { repository } from '../repository';
import { MIGRATION_KEY_SPECS, MIGRATION_SCHEMA_VERSION } from './manifest';
import { createSnapshotHash } from './hash';
import { buildSupabaseImportPlan } from './importStrategy';

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function stripLauncherPrivateFields(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const out = { ...value };
  if (hasOwn(out, 'notes')) delete out.notes;
  return out;
}

function readValueBySpec(spec) {
  if (spec.type === 'text') return repository.readText(spec.key, spec.fallback ?? '');
  const value = repository.readJson(spec.key, spec.fallback);
  if (spec.id === 'launcher') return stripLauncherPrivateFields(value);
  return value;
}

function writeValueBySpec(spec, value) {
  if (spec.type === 'text') {
    repository.writeText(spec.key, typeof value === 'string' ? value : '');
    return;
  }
  if (spec.id === 'launcher') {
    repository.writeJson(spec.key, stripLauncherPrivateFields(value ?? spec.fallback));
    return;
  }
  repository.writeJson(spec.key, value ?? spec.fallback);
}

function toSafeObject(value) {
  return value && typeof value === 'object' ? value : {};
}

export function buildMigrationSnapshot() {
  const payload = {};
  MIGRATION_KEY_SPECS.forEach((spec) => {
    payload[spec.id] = readValueBySpec(spec);
  });

  const source = {
    app: 'tavern-menu',
    adapter: repository.adapterName,
  };
  const snapshotHash = createSnapshotHash({
    schemaVersion: MIGRATION_SCHEMA_VERSION,
    source,
    payload,
  });

  return {
    schemaVersion: MIGRATION_SCHEMA_VERSION,
    snapshotHash,
    exportedAt: new Date().toISOString(),
    source,
    payload,
  };
}

export function summarizeSnapshot(snapshot) {
  const payload = toSafeObject(snapshot?.payload);
  const bag = toSafeObject(payload.bag);
  const launcher = toSafeObject(payload.launcher);
  const menuBrief = toSafeObject(payload.menuCampaignBrief);

  const countArray = (value) => (Array.isArray(value) ? value.length : 0);
  const countKeys = (value) => {
    const obj = toSafeObject(value);
    return Object.keys(obj).length;
  };

  const worldLorePayload = toSafeObject(payload.worldLore);
  const worldLoreCount =
    countArray(worldLorePayload.maps) +
    countArray(worldLorePayload.scenes) +
    countArray(worldLorePayload.locations) +
    countArray(worldLorePayload.factions);

  return {
    characters: countArray(payload.characters),
    quests: countArray(payload.quests),
    worldNpcs: countArray(payload.worldNpcs),
    worldLore: worldLoreCount,
    characterNpcBuckets: countKeys(payload.charNpcs),
    bagItems: countArray(bag.items),
    hasRecap: !!String(launcher.recap || '').trim(),
    hasNotes: !!String(payload.launcherNotes || launcher.notes || '').trim(),
    hasCampaignBrief: !!String(menuBrief.location || menuBrief.objective || '').trim(),
  };
}

export function formatSnapshotSummary(summary) {
  const items = [
    `${summary.characters} characters`,
    `${summary.quests} quests`,
    `${summary.worldNpcs} world NPCs`,
  ];
  if (summary.worldLore != null) {
    items.push(`${summary.worldLore} lore entries`);
  }
  items.push(`${summary.bagItems} bag items`);
  return items.join(', ');
}

export function downloadSnapshotFile(snapshot, options = {}) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = options.filename || `tavern-menu-backup-${stamp}.json`;
  const json = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  return filename;
}

export async function parseSnapshotFile(file) {
  if (!file) throw new Error('No backup file selected.');
  const text = await file.text();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Backup file is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Backup file format is invalid.');
  }

  if (!hasOwn(parsed, 'payload') || typeof parsed.payload !== 'object' || parsed.payload === null) {
    throw new Error('Backup file is missing payload data.');
  }

  const normalized = {
    ...parsed,
    schemaVersion: Number.parseInt(parsed.schemaVersion, 10) || MIGRATION_SCHEMA_VERSION,
    source: toSafeObject(parsed.source),
    payload: toSafeObject(parsed.payload),
  };

  const fallbackHash = createSnapshotHash({
    schemaVersion: normalized.schemaVersion,
    source: normalized.source,
    payload: normalized.payload,
  });
  const incomingHash = typeof parsed.snapshotHash === 'string' ? parsed.snapshotHash.trim() : '';

  return {
    ...normalized,
    snapshotHash: incomingHash || fallbackHash,
  };
}

export function applySnapshot(snapshot) {
  const payload = toSafeObject(snapshot?.payload);
  const legacyLauncherNotes = String(toSafeObject(payload.launcher).notes || '');

  MIGRATION_KEY_SPECS.forEach((spec) => {
    let incoming = hasOwn(payload, spec.id) ? payload[spec.id] : spec.fallback;
    if (spec.id === 'launcherNotes' && !hasOwn(payload, spec.id) && legacyLauncherNotes) {
      incoming = legacyLauncherNotes;
    }
    writeValueBySpec(spec, incoming);
  });

  return summarizeSnapshot(snapshot);
}

export function buildSnapshotImportPlan(snapshot, options = {}) {
  return buildSupabaseImportPlan(snapshot, options);
}
