import { repository } from '../repository';
import { MIGRATION_KEY_SPECS, MIGRATION_SCHEMA_VERSION } from './manifest';

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function readValueBySpec(spec) {
  if (spec.type === 'text') return repository.readText(spec.key, spec.fallback ?? '');
  return repository.readJson(spec.key, spec.fallback);
}

function writeValueBySpec(spec, value) {
  if (spec.type === 'text') {
    repository.writeText(spec.key, typeof value === 'string' ? value : '');
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

  return {
    schemaVersion: MIGRATION_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    source: {
      app: 'tavern-menu',
      adapter: repository.adapterName,
    },
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

  return {
    characters: countArray(payload.characters),
    quests: countArray(payload.quests),
    worldNpcs: countArray(payload.worldNpcs),
    characterNpcBuckets: countKeys(payload.charNpcs),
    bagItems: countArray(bag.items),
    hasRecap: !!String(launcher.recap || '').trim(),
    hasNotes: !!String(launcher.notes || '').trim(),
    hasCampaignBrief: !!String(menuBrief.location || menuBrief.objective || '').trim(),
  };
}

export function formatSnapshotSummary(summary) {
  return [
    `${summary.characters} characters`,
    `${summary.quests} quests`,
    `${summary.worldNpcs} world NPCs`,
    `${summary.bagItems} bag items`,
  ].join(', ');
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

  return parsed;
}

export function applySnapshot(snapshot) {
  const payload = toSafeObject(snapshot?.payload);
  MIGRATION_KEY_SPECS.forEach((spec) => {
    const incoming = hasOwn(payload, spec.id) ? payload[spec.id] : spec.fallback;
    writeValueBySpec(spec, incoming);
  });

  return summarizeSnapshot(snapshot);
}
