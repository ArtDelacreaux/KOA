import { createSnapshotHash, hashValue } from './hash';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cleanText(value) {
  return String(value ?? '').trim();
}

function keyText(value) {
  return cleanText(value).toLowerCase().replace(/\s+/g, ' ');
}

function toIso(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function timestampFrom(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : 0;
}

function richnessScore(value) {
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + richnessScore(item), 0) + value.length;
  if (!value || typeof value !== 'object') return cleanText(value) ? 1 : 0;
  return Object.values(value).reduce((sum, item) => sum + richnessScore(item), 0);
}

function pickPreferred(a, b, aTs, bTs) {
  if (bTs > aTs) return b;
  if (aTs > bTs) return a;
  return richnessScore(b) > richnessScore(a) ? b : a;
}

function uniqueBy(items, keyFn) {
  const map = new Map();
  items.forEach((item, idx) => {
    const key = keyFn(item, idx) || `idx:${idx}`;
    if (!map.has(key)) map.set(key, item);
  });
  return Array.from(map.values());
}

function dedupeQuestRows(rawQuests) {
  const map = new Map();
  let duplicatesRemoved = 0;

  asArray(rawQuests).forEach((raw) => {
    const q = asObject(raw);
    const normalized = {
      ...q,
      id: cleanText(q.id),
      title: cleanText(q.title),
      type: cleanText(q.type || 'Side'),
      giver: cleanText(q.giver),
      location: cleanText(q.location),
      description: cleanText(q.description),
      status: cleanText(q.status || 'active'),
      createdAt: toIso(q.createdAt) || null,
      updatedAt: toIso(q.updatedAt) || null,
    };

    const fallbackSig = hashValue({
      title: normalized.title,
      type: normalized.type,
      giver: normalized.giver,
      location: normalized.location,
      description: normalized.description,
      status: normalized.status,
    });
    const upsertKey = normalized.id ? `id:${keyText(normalized.id)}` : `sig:${fallbackSig}`;
    const existing = map.get(upsertKey);
    if (!existing) {
      map.set(upsertKey, normalized);
      return;
    }

    duplicatesRemoved += 1;
    const chosen = pickPreferred(
      existing,
      normalized,
      timestampFrom(existing.updatedAt || existing.createdAt),
      timestampFrom(normalized.updatedAt || normalized.createdAt)
    );
    map.set(upsertKey, { ...existing, ...normalized, ...chosen });
  });

  return {
    rows: Array.from(map.entries())
      .map(([upsertKey, payload]) => ({ upsert_key: `quest:${upsertKey}`, payload }))
      .sort((a, b) => a.upsert_key.localeCompare(b.upsert_key)),
    duplicatesRemoved,
  };
}

function normalizeCharacterNpc(rawNpc) {
  const npc = asObject(rawNpc);
  return {
    ...npc,
    id: cleanText(npc.id),
    name: cleanText(npc.name),
    relation: cleanText(npc.relation),
    age: cleanText(npc.age),
    faction: cleanText(npc.faction),
    occupation: cleanText(npc.occupation),
    summary: cleanText(npc.summary || npc.bio),
    bio: cleanText(npc.bio),
    image: cleanText(npc.image),
    source: cleanText(npc.source || 'character'),
    worldNpcId: cleanText(npc.worldNpcId),
  };
}

function mergeCharacterNpc(a, b) {
  const out = { ...a };
  const secondary = b;
  ['name', 'relation', 'age', 'faction', 'occupation', 'summary', 'bio', 'image', 'source', 'worldNpcId'].forEach((field) => {
    if (!cleanText(out[field]) && cleanText(secondary[field])) out[field] = secondary[field];
  });
  if (!cleanText(out.id) && cleanText(secondary.id)) out.id = secondary.id;
  return out;
}

function dedupeCharacters(rawCharacters) {
  const map = new Map();
  let duplicatesRemoved = 0;

  asArray(rawCharacters).forEach((raw, idx) => {
    const c = asObject(raw);
    const normalized = {
      ...c,
      id: cleanText(c.id),
      name: cleanText(c.name),
      npcs: uniqueBy(asArray(c.npcs).map(normalizeCharacterNpc), (npc) => {
        if (cleanText(npc.id)) return `id:${keyText(npc.id)}`;
        return `name:${keyText(npc.name)}::rel:${keyText(npc.relation)}`;
      }),
    };

    const upsertKey = normalized.id
      ? `id:${keyText(normalized.id)}`
      : `name:${keyText(normalized.name) || `character-${idx}`}`;
    const existing = map.get(upsertKey);
    if (!existing) {
      map.set(upsertKey, normalized);
      return;
    }

    duplicatesRemoved += 1;
    const mergedNpcList = uniqueBy(
      [...asArray(existing.npcs), ...asArray(normalized.npcs)].map(normalizeCharacterNpc),
      (npc) => {
        if (cleanText(npc.id)) return `id:${keyText(npc.id)}`;
        return `name:${keyText(npc.name)}::rel:${keyText(npc.relation)}`;
      }
    );
    const chosen = pickPreferred(existing, normalized, 0, 0);
    map.set(upsertKey, { ...existing, ...normalized, ...chosen, npcs: mergedNpcList });
  });

  return {
    rows: Array.from(map.entries())
      .map(([upsertKey, payload]) => ({
        upsert_key: `character:${upsertKey}`,
        source_id: cleanText(payload.id) || null,
        name_key: keyText(payload.name) || null,
        payload,
      }))
      .sort((a, b) => a.upsert_key.localeCompare(b.upsert_key)),
    duplicatesRemoved,
  };
}

function normalizeWorldNpc(rawNpc) {
  const npc = asObject(rawNpc);
  const characterLinks = uniqueBy(
    asArray(npc.characterLinks)
      .map((l) => ({
        characterName: cleanText(l?.characterName),
        relation: cleanText(l?.relation),
      }))
      .filter((l) => l.characterName),
    (l) => `${keyText(l.characterName)}::${keyText(l.relation)}`
  );

  const links = uniqueBy(
    asArray(npc.links)
      .map((l) => ({
        targetId: cleanText(l?.targetId),
        note: cleanText(l?.note),
      }))
      .filter((l) => l.targetId),
    (l) => `${keyText(l.targetId)}::${keyText(l.note)}`
  );

  return {
    ...npc,
    id: cleanText(npc.id),
    name: cleanText(npc.name),
    age: cleanText(npc.age),
    faction: cleanText(npc.faction),
    occupation: cleanText(npc.occupation),
    location: cleanText(npc.location),
    summary: cleanText(npc.summary || npc.bio),
    bio: cleanText(npc.bio),
    image: cleanText(npc.image),
    characterLinks,
    links,
    createdAt: toIso(npc.createdAt) || null,
    updatedAt: toIso(npc.updatedAt) || null,
  };
}

function mergeWorldNpc(a, b) {
  const preferred = pickPreferred(
    a,
    b,
    timestampFrom(a.updatedAt || a.createdAt),
    timestampFrom(b.updatedAt || b.createdAt)
  );
  const secondary = preferred === a ? b : a;
  const out = { ...preferred };

  ['name', 'age', 'faction', 'occupation', 'location', 'summary', 'bio', 'image'].forEach((field) => {
    if (!cleanText(out[field]) && cleanText(secondary[field])) out[field] = secondary[field];
  });

  out.characterLinks = uniqueBy(
    [...asArray(a.characterLinks), ...asArray(b.characterLinks)],
    (l) => `${keyText(l?.characterName)}::${keyText(l?.relation)}`
  );
  out.links = uniqueBy(
    [...asArray(a.links), ...asArray(b.links)],
    (l) => `${keyText(l?.targetId)}::${keyText(l?.note)}`
  );

  if (!out.createdAt) out.createdAt = a.createdAt || b.createdAt || null;
  const latestTs = Math.max(timestampFrom(a.updatedAt), timestampFrom(b.updatedAt));
  out.updatedAt = latestTs ? new Date(latestTs).toISOString() : out.updatedAt || null;
  if (!cleanText(out.id) && cleanText(secondary.id)) out.id = secondary.id;
  return out;
}

function dedupeWorldNpcs(rawWorldNpcs) {
  const map = new Map();
  let duplicatesRemoved = 0;

  asArray(rawWorldNpcs).forEach((raw, idx) => {
    const normalized = normalizeWorldNpc(raw);
    const upsertKey = normalized.id
      ? `id:${keyText(normalized.id)}`
      : `name:${keyText(normalized.name) || `worldnpc-${idx}`}`;

    const existing = map.get(upsertKey);
    if (!existing) {
      map.set(upsertKey, normalized);
      return;
    }

    duplicatesRemoved += 1;
    map.set(upsertKey, mergeWorldNpc(existing, normalized));
  });

  return {
    rows: Array.from(map.entries())
      .map(([upsertKey, payload]) => ({
        upsert_key: `world_npc:${upsertKey}`,
        source_id: cleanText(payload.id) || null,
        name_key: keyText(payload.name) || null,
        payload,
      }))
      .sort((a, b) => a.upsert_key.localeCompare(b.upsert_key)),
    duplicatesRemoved,
  };
}

function dedupeCharNpcs(rawCharNpcs) {
  const map = new Map();
  let duplicatesRemoved = 0;

  Object.entries(asObject(rawCharNpcs)).forEach(([characterName, npcList]) => {
    const character = cleanText(characterName);
    const characterNameKey = keyText(character);
    asArray(npcList).forEach((rawNpc, idx) => {
      const npc = normalizeCharacterNpc(rawNpc);
      const npcKey = cleanText(npc.id)
        ? `id:${keyText(npc.id)}`
        : `name:${keyText(npc.name) || `npc-${idx}`}::rel:${keyText(npc.relation)}`;
      const upsertKey = `char_npc:${characterNameKey}::${npcKey}`;
      const existing = map.get(upsertKey);
      if (!existing) {
        map.set(upsertKey, { characterName: character, characterNameKey, npc });
        return;
      }

      duplicatesRemoved += 1;
      map.set(upsertKey, {
        ...existing,
        npc: mergeCharacterNpc(existing.npc, npc),
      });
    });
  });

  return {
    rows: Array.from(map.entries())
      .map(([upsertKey, row]) => ({
        upsert_key: upsertKey,
        character_name: row.characterName,
        character_name_key: row.characterNameKey,
        source_id: cleanText(row.npc.id) || null,
        npc_name_key: keyText(row.npc.name) || null,
        payload: row.npc,
      }))
      .sort((a, b) => a.upsert_key.localeCompare(b.upsert_key)),
    duplicatesRemoved,
  };
}

function dedupeInventoryItems(rawBag) {
  const bag = asObject(rawBag);
  const map = new Map();
  let duplicatesRemoved = 0;

  asArray(bag.items).forEach((raw, idx) => {
    const item = asObject(raw);
    const normalized = {
      ...item,
      id: cleanText(item.id),
      name: cleanText(item.name),
      category: cleanText(item.category),
      rarity: cleanText(item.rarity),
      notes: cleanText(item.notes),
      assignedTo: cleanText(item.assignedTo),
      qty: Math.max(1, Number.parseInt(item.qty, 10) || 1),
      createdAt: toIso(item.createdAt) || null,
      updatedAt: toIso(item.updatedAt) || null,
    };

    const signature = hashValue({
      name: normalized.name,
      category: normalized.category,
      rarity: normalized.rarity,
      notes: normalized.notes,
      assignedTo: normalized.assignedTo,
      value: normalized.value ?? null,
      weight: normalized.weight ?? null,
      equipped: !!normalized.equipped,
    });
    const upsertKey = normalized.id ? `id:${keyText(normalized.id)}` : `sig:${signature}`;
    const existing = map.get(upsertKey);
    if (!existing) {
      map.set(upsertKey, normalized);
      return;
    }

    duplicatesRemoved += 1;
    const merged = { ...existing, ...normalized };
    if (!cleanText(existing.id) && !cleanText(normalized.id)) {
      merged.qty = (existing.qty || 0) + (normalized.qty || 0);
    } else {
      merged.qty = Math.max(existing.qty || 1, normalized.qty || 1);
    }
    map.set(upsertKey, merged);
  });

  const currency = {
    pp: Math.max(0, Number.parseInt(bag?.currency?.pp, 10) || 0),
    gp: Math.max(0, Number.parseInt(bag?.currency?.gp, 10) || 0),
    sp: Math.max(0, Number.parseInt(bag?.currency?.sp, 10) || 0),
    cp: Math.max(0, Number.parseInt(bag?.currency?.cp, 10) || 0),
  };

  return {
    itemRows: Array.from(map.entries())
      .map(([upsertKey, payload]) => ({
        upsert_key: `inventory_item:${upsertKey}`,
        source_id: cleanText(payload.id) || null,
        name_key: keyText(payload.name) || null,
        payload,
      }))
      .sort((a, b) => a.upsert_key.localeCompare(b.upsert_key)),
    currencyRow: {
      upsert_key: 'inventory_currency:party',
      payload: currency,
    },
    duplicatesRemoved,
  };
}

function dedupeRelationships(rawRelationships) {
  const out = [];
  Object.entries(asObject(rawRelationships)).forEach(([fromName, toMap]) => {
    Object.entries(asObject(toMap)).forEach(([toName, rawValue]) => {
      const rel = asObject(rawValue);
      const upsertKey = `relationship:${keyText(fromName)}::${keyText(toName)}`;
      const scoreRaw = Number.parseInt(rel.score, 10);
      out.push({
        upsert_key: upsertKey,
        from_name: cleanText(fromName),
        to_name: cleanText(toName),
        from_name_key: keyText(fromName),
        to_name_key: keyText(toName),
        payload: {
          score: Number.isFinite(scoreRaw) ? Math.max(0, Math.min(100, scoreRaw)) : 50,
          note: cleanText(rel.note),
        },
      });
    });
  });
  return out.sort((a, b) => a.upsert_key.localeCompare(b.upsert_key));
}

function dedupeCombat(rawCombat) {
  const combat = asObject(rawCombat);
  const combatants = asArray(combat.combatants);
  const map = new Map();
  let duplicatesRemoved = 0;

  combatants.forEach((raw, idx) => {
    const c = asObject(raw);
    const normalized = {
      ...c,
      id: cleanText(c.id),
      name: cleanText(c.name),
      side: cleanText(c.side || 'Enemy'),
      sourceCharacterId: cleanText(c.sourceCharacterId),
    };
    const sig = hashValue({
      name: normalized.name,
      side: normalized.side,
      sourceCharacterId: normalized.sourceCharacterId,
      init: normalized.init ?? null,
    });
    const upsertKey = normalized.id ? `id:${keyText(normalized.id)}` : `sig:${sig}`;
    const existing = map.get(upsertKey);
    if (!existing) {
      map.set(upsertKey, normalized);
      return;
    }
    duplicatesRemoved += 1;
    map.set(upsertKey, pickPreferred(existing, normalized, 0, 0));
  });

  const encounterRow = Object.keys(combat).length
    ? {
        upsert_key: 'combat_encounter:active',
        payload: { ...combat, combatants: undefined },
      }
    : null;

  const combatantRows = Array.from(map.entries())
    .map(([upsertKey, payload]) => ({
      upsert_key: `combat_combatant:${upsertKey}`,
      source_id: cleanText(payload.id) || null,
      name_key: keyText(payload.name) || null,
      payload,
    }))
    .sort((a, b) => a.upsert_key.localeCompare(b.upsert_key));

  return { encounterRow, combatantRows, duplicatesRemoved };
}

export function buildSupabaseImportPlan(snapshot, options = {}) {
  const source = asObject(snapshot?.source);
  const payload = asObject(snapshot?.payload);
  const schemaVersion = Number.parseInt(snapshot?.schemaVersion, 10) || 1;

  const characters = dedupeCharacters(payload.characters);
  const quests = dedupeQuestRows(payload.quests);
  const worldNpcs = dedupeWorldNpcs(payload.worldNpcs);
  const charNpcs = dedupeCharNpcs(payload.charNpcs);
  const inventory = dedupeInventoryItems(payload.bag);
  const relationships = dedupeRelationships(payload.relationships);
  const combat = dedupeCombat(payload.combat);

  const launcherRow = {
    upsert_key: 'launcher_state:party',
    payload: asObject(payload.launcher),
  };
  const menuMetaRow = {
    upsert_key: 'menu_meta:party',
    payload: {
      campaignBrief: asObject(payload.menuCampaignBrief),
      notes: {
        characters: cleanText(payload.menuNoteCharacters),
        video: cleanText(payload.menuNoteVideo),
        lore: cleanText(payload.menuNoteLore),
      },
    },
  };

  const normalizedForHash = {
    schemaVersion,
    characters: characters.rows,
    quests: quests.rows,
    worldNpcs: worldNpcs.rows,
    charNpcs: charNpcs.rows,
    inventoryItems: inventory.itemRows,
    inventoryCurrency: inventory.currencyRow,
    relationships,
    launcherRow,
    menuMetaRow,
    combatEncounter: combat.encounterRow,
    combatCombatants: combat.combatantRows,
  };

  const snapshotHash = cleanText(snapshot?.snapshotHash) || createSnapshotHash(normalizedForHash);
  const importId = options.importId || `imp_${snapshotHash.replace(/^snap_/, '')}`;

  const dedupeSummary = {
    characters: characters.duplicatesRemoved,
    quests: quests.duplicatesRemoved,
    worldNpcs: worldNpcs.duplicatesRemoved,
    charNpcs: charNpcs.duplicatesRemoved,
    inventoryItems: inventory.duplicatesRemoved,
    combatants: combat.duplicatesRemoved,
    total:
      characters.duplicatesRemoved +
      quests.duplicatesRemoved +
      worldNpcs.duplicatesRemoved +
      charNpcs.duplicatesRemoved +
      inventory.duplicatesRemoved +
      combat.duplicatesRemoved,
  };

  return {
    importId,
    snapshotHash,
    schemaVersion,
    exportedAt: cleanText(snapshot?.exportedAt) || null,
    source: {
      app: cleanText(source.app) || 'tavern-menu',
      adapter: cleanText(source.adapter) || 'unknown',
    },
    dedupeSummary,
    tables: {
      import_log: [
        {
          import_id: importId,
          snapshot_hash: snapshotHash,
          schema_version: schemaVersion,
          exported_at: cleanText(snapshot?.exportedAt) || null,
          source_app: cleanText(source.app) || 'tavern-menu',
          source_adapter: cleanText(source.adapter) || 'unknown',
          dedupe_summary: dedupeSummary,
        },
      ],
      characters: characters.rows,
      quests: quests.rows,
      world_npcs: worldNpcs.rows,
      character_npcs: charNpcs.rows,
      inventory_items: inventory.itemRows,
      inventory_currency: [inventory.currencyRow],
      relationships,
      launcher_state: [launcherRow],
      menu_meta: [menuMetaRow],
      combat_encounters: combat.encounterRow ? [combat.encounterRow] : [],
      combat_combatants: combat.combatantRows,
    },
  };
}
