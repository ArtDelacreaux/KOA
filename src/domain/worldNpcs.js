import { STORAGE_KEYS } from '../lib/storageKeys';
import { repository } from '../repository';

export function normalizeText(value) {
  return (value || '').toString().trim().toLowerCase();
}

export function normalizeWorldNpc(npc, idx = 0) {
  return {
    id: (npc?.id && String(npc.id)) || `worldnpc::${idx}::${npc?.name || 'npc'}`,
    name: (npc?.name || '').trim(),
    age: (npc?.age || '').trim(),
    faction: (npc?.faction || '').trim(),
    occupation: (npc?.occupation || '').trim(),
    location: (npc?.location || '').trim(),
    summary: (npc?.summary || npc?.bio || '').trim(),
    bio: (npc?.bio || '').trim(),
    image: npc?.image || '',
    characterLinks: Array.isArray(npc?.characterLinks)
      ? npc.characterLinks
          .map((l, linkIndex) => ({
            characterName: (l?.characterName || '').trim(),
            relation: (l?.relation || '').trim(),
            linkIndex,
          }))
          .filter((l) => l.characterName)
      : [],
    links: Array.isArray(npc?.links)
      ? npc.links
          .map((l) => ({
            targetId: (l?.targetId && String(l.targetId)) || '',
            note: (l?.note || '').trim(),
          }))
          .filter((l) => l.targetId)
      : [],
    createdAt: npc?.createdAt || null,
    updatedAt: npc?.updatedAt || null,
  };
}

export function normalizeRelatedNpc(npc, charName, idx = 0) {
  return {
    id: (npc?.id && String(npc.id)) || `${charName}::${npc?.name || 'npc'}::${idx}`,
    name: (npc?.name || '').trim(),
    relation: (npc?.relation || '').trim(),
    age: (npc?.age || '').trim(),
    faction: (npc?.faction || '').trim(),
    occupation: (npc?.occupation || '').trim(),
    summary: (npc?.summary || npc?.bio || '').trim(),
    bio: (npc?.bio || '').trim(),
    image: npc?.image || '',
    source: npc?.source || 'character',
    worldNpcId: npc?.worldNpcId || null,
  };
}

export function readWorldNpcsRaw() {
  const parsed = repository.readJson(STORAGE_KEYS.worldNpcs, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function readWorldNpcsNormalized() {
  return readWorldNpcsRaw().map((npc, idx) => normalizeWorldNpc(npc, idx));
}

export function writeWorldNpcs(value) {
  repository.writeJson(STORAGE_KEYS.worldNpcs, value);
}

export function readCharacterNpcStore() {
  const parsed = repository.readJson(STORAGE_KEYS.charNpcs, {});
  return parsed && typeof parsed === 'object' ? parsed : {};
}

export function writeCharacterNpcStore(value) {
  repository.writeJson(STORAGE_KEYS.charNpcs, value);
}

export function setWorldNpcDeepLink(payload) {
  repository.writeJson(STORAGE_KEYS.worldNpcDeepLink, payload);
}

export function consumeWorldNpcDeepLink() {
  const payload = repository.readJson(STORAGE_KEYS.worldNpcDeepLink, null);
  repository.remove(STORAGE_KEYS.worldNpcDeepLink);
  return payload;
}
