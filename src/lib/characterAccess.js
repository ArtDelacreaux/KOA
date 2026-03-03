function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeAccountEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeCharacterToken(value) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function characterAccessKey(character) {
  const sourceId = normalizeCharacterToken(
    character?.id ??
      character?.sourceCharacterId ??
      character?.characterId
  );
  if (sourceId) return `id:${sourceId}`;

  const sourceName = normalizeCharacterToken(
    character?.name ??
      character?.characterName
  );
  if (sourceName) return `name:${sourceName}`;

  return '';
}

export function normalizeCharacterAccessEntry(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    ownerUserId: normalizeText(source.ownerUserId ?? source.userId),
    ownerEmail: normalizeAccountEmail(source.ownerEmail ?? source.email),
    ownerUsername: normalizeText(source.ownerUsername ?? source.username),
    updatedAt: normalizeText(source.updatedAt),
    updatedByUserId: normalizeText(source.updatedByUserId),
    updatedByEmail: normalizeAccountEmail(source.updatedByEmail),
  };
}

function entryFromUnknown(raw) {
  if (typeof raw === 'string') {
    const ownerEmail = normalizeAccountEmail(raw);
    if (!ownerEmail) return null;
    return normalizeCharacterAccessEntry({ ownerEmail });
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const normalized = normalizeCharacterAccessEntry(raw);
  if (!normalized.ownerUserId && !normalized.ownerEmail && !normalized.ownerUsername) return null;
  return normalized;
}

export function normalizeCharacterAccessMap(rawMap) {
  if (!rawMap || typeof rawMap !== 'object' || Array.isArray(rawMap)) return {};
  const out = {};
  Object.entries(rawMap).forEach(([rawKey, rawValue]) => {
    const key = normalizeText(rawKey);
    if (!key) return;
    const entry = entryFromUnknown(rawValue);
    if (!entry) return;
    out[key] = entry;
  });
  return out;
}

export function getCharacterAccessEntry(accessMap, character) {
  const map = accessMap && typeof accessMap === 'object' ? accessMap : {};
  const key = characterAccessKey(character);
  if (!key) return null;

  const fromCanonical = entryFromUnknown(map[key]);
  if (fromCanonical) return fromCanonical;

  const idLegacy = normalizeCharacterToken(
    character?.id ??
      character?.sourceCharacterId ??
      character?.characterId
  );
  if (idLegacy) {
    const byLegacyId = entryFromUnknown(map[idLegacy]);
    if (byLegacyId) return byLegacyId;
  }

  const nameLegacy = normalizeCharacterToken(
    character?.name ??
      character?.characterName
  );
  if (nameLegacy) {
    const byLegacyName = entryFromUnknown(map[nameLegacy]);
    if (byLegacyName) return byLegacyName;
  }

  return null;
}

export function canUserControlCharacter({
  accessMap,
  character,
  authEnabled,
  isManager,
  userId,
  email,
}) {
  if (!character) return true;
  if (!authEnabled) return true;
  if (isManager) return true;

  const assignment = getCharacterAccessEntry(accessMap, character);
  if (!assignment) return true;

  if (!assignment.ownerUserId && !assignment.ownerEmail) return true;

  const normalizedUserId = normalizeText(userId);
  if (assignment.ownerUserId && normalizedUserId && assignment.ownerUserId === normalizedUserId) return true;

  const normalizedEmail = normalizeAccountEmail(email);
  if (assignment.ownerEmail && normalizedEmail && assignment.ownerEmail === normalizedEmail) return true;

  return false;
}
