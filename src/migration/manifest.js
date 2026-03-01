import { STORAGE_KEYS, menuNoteKey } from '../lib/storageKeys';

export const MIGRATION_SCHEMA_VERSION = 1;

export const MIGRATION_KEY_SPECS = [
  { id: 'characters', key: STORAGE_KEYS.characters, type: 'json', fallback: [] },
  { id: 'quests', key: STORAGE_KEYS.quests, type: 'json', fallback: [] },
  { id: 'relationships', key: STORAGE_KEYS.relationships, type: 'json', fallback: {} },
  { id: 'launcher', key: STORAGE_KEYS.launcher, type: 'json', fallback: {} },
  { id: 'bag', key: STORAGE_KEYS.bag, type: 'json', fallback: { currency: {}, items: [] } },
  { id: 'worldNpcs', key: STORAGE_KEYS.worldNpcs, type: 'json', fallback: [] },
  { id: 'charNpcs', key: STORAGE_KEYS.charNpcs, type: 'json', fallback: {} },
  { id: 'combat', key: STORAGE_KEYS.combat, type: 'json', fallback: null },
  { id: 'menuCampaignBrief', key: STORAGE_KEYS.menuCampaignBrief, type: 'json', fallback: {} },
  { id: 'menuNoteCharacters', key: menuNoteKey('characters'), type: 'text', fallback: '' },
  { id: 'menuNoteVideo', key: menuNoteKey('video'), type: 'text', fallback: '' },
  { id: 'menuNoteLore', key: menuNoteKey('lore'), type: 'text', fallback: '' },
  // world lore (mirrors the default gallery, user edits are stored here)
  { id: 'worldLore', key: STORAGE_KEYS.worldLore, type: 'json', fallback: { maps: [], scenes: [], locations: [], factions: [] } },
];
