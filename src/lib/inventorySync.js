import { createId } from '../domain/ids';

export const INVENTORY_CATEGORIES = ['Weapon', 'Armor', 'Gear', 'Consumable', 'Loot', 'Quest', 'Magic', 'Misc'];
export const INVENTORY_RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
const TRADE_STATUS_SET = new Set(['pending', 'accepted', 'denied']);

function newBagItemId() {
  return createId('bag');
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeIso(value) {
  const raw = normalizeText(value);
  if (!raw) return '';
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : '';
}

function normalizeOptionalNumber(value) {
  if (value === '' || value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeItemCategory(value) {
  const normalized = normalizeText(value);
  return INVENTORY_CATEGORIES.includes(normalized) ? normalized : 'Gear';
}

function normalizeItemRarity(value) {
  const normalized = normalizeText(value);
  return INVENTORY_RARITIES.includes(normalized) ? normalized : 'Common';
}

function normalizeItemTags(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeText(entry)).filter(Boolean);
  }
  return normalizeText(value)
    .split(',')
    .map((entry) => normalizeText(entry))
    .filter(Boolean);
}

export function inventoryTokenKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function normalizeInventoryItem(rawItem, options = {}) {
  const now = normalizeIso(options.now) || new Date().toISOString();
  const idFactory = typeof options.idFactory === 'function' ? options.idFactory : newBagItemId;
  const source = rawItem && typeof rawItem === 'object' ? rawItem : {};
  const qty = clampInt(Number.parseInt(source.qty, 10) || 1, 1, 9999);
  return {
    id: normalizeText(source.id) || idFactory(),
    name: normalizeText(source.name) || 'Unnamed Item',
    qty,
    category: normalizeItemCategory(source.category),
    rarity: normalizeItemRarity(source.rarity),
    value: normalizeOptionalNumber(source.value),
    weight: normalizeOptionalNumber(source.weight),
    notes: normalizeText(source.notes),
    tags: normalizeItemTags(source.tags),
    assignedTo: normalizeText(source.assignedTo),
    equipped: !!source.equipped,
    createdAt: normalizeIso(source.createdAt) || now,
    updatedAt: normalizeIso(source.updatedAt) || now,
  };
}

export function normalizeInventoryItems(rawItems, options = {}) {
  const now = normalizeIso(options.now) || new Date().toISOString();
  const idFactory = typeof options.idFactory === 'function' ? options.idFactory : newBagItemId;
  const list = Array.isArray(rawItems) ? rawItems : [];
  const seenIds = new Set();
  return list
    .map((entry) => normalizeInventoryItem(entry, { now, idFactory }))
    .map((entry) => {
      let nextId = entry.id;
      while (!nextId || seenIds.has(nextId)) nextId = idFactory();
      seenIds.add(nextId);
      if (nextId === entry.id) return entry;
      return { ...entry, id: nextId };
    });
}

export function normalizePlayerInventories(rawValue, options = {}) {
  const now = normalizeIso(options.now) || new Date().toISOString();
  const idFactory = typeof options.idFactory === 'function' ? options.idFactory : newBagItemId;
  const source = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue) ? rawValue : {};
  const out = {};
  Object.entries(source).forEach(([key, rawEntry]) => {
    const entry = rawEntry && typeof rawEntry === 'object' && !Array.isArray(rawEntry) ? rawEntry : {};
    const userId = normalizeText(key || entry.userId);
    if (!userId) return;
    out[userId] = {
      userId,
      username: normalizeText(entry.username || entry.label),
      updatedAt: normalizeIso(entry.updatedAt) || '',
      items: normalizeInventoryItems(entry.items, { now, idFactory }),
    };
  });
  return out;
}

export function normalizeTradeRequests(rawValue, options = {}) {
  const now = normalizeIso(options.now) || new Date().toISOString();
  const list = Array.isArray(rawValue) ? rawValue : [];
  return list
    .map((rawRequest) => {
      const request = rawRequest && typeof rawRequest === 'object' ? rawRequest : {};
      const statusRaw = normalizeText(request.status).toLowerCase();
      const status = TRADE_STATUS_SET.has(statusRaw) ? statusRaw : 'pending';
      return {
        id: normalizeText(request.id) || createId('trade'),
        status,
        requestedAt: normalizeIso(request.requestedAt) || now,
        requesterUserId: normalizeText(request.requesterUserId),
        requesterUsername: normalizeText(request.requesterUsername || request.requesterLabel),
        requesterEmail: normalizeEmail(request.requesterEmail),
        targetOwnerUserId: normalizeText(request.targetOwnerUserId),
        targetOwnerUsername: normalizeText(request.targetOwnerUsername),
        partyItemId: normalizeText(request.partyItemId),
        partyItemName: normalizeText(request.partyItemName),
        partyItemCategory: normalizeItemCategory(request.partyItemCategory || request.category),
        partyItemRarity: normalizeItemRarity(request.partyItemRarity || request.rarity),
        requestedQty: clampInt(Number.parseInt(request.requestedQty, 10) || 1, 1, 9999),
        offerItemId: normalizeText(request.offerItemId),
        offerItemName: normalizeText(request.offerItemName),
        offerQty: Math.max(0, Number.parseInt(request.offerQty, 10) || 0),
        note: normalizeText(request.note),
        decidedAt: normalizeIso(request.decidedAt) || '',
        decidedByUserId: normalizeText(request.decidedByUserId),
        decidedByUsername: normalizeText(request.decidedByUsername),
        decisionNote: normalizeText(request.decisionNote),
      };
    })
    .filter((request) => !!request.partyItemId)
    .sort((a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0));
}

export function defaultBagInventoryState() {
  return {
    currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
    items: [],
    playerInventories: {},
    tradeRequests: [],
    ownerUserId: '',
    ownerEmail: '',
    ownerUsername: '',
    ownerUpdatedAt: '',
    ownerUpdatedByUserId: '',
    ownerUpdatedByUsername: '',
  };
}

export function normalizeBagInventoryState(rawBag, options = {}) {
  const now = normalizeIso(options.now) || new Date().toISOString();
  const idFactory = typeof options.idFactory === 'function' ? options.idFactory : newBagItemId;
  const source = rawBag && typeof rawBag === 'object' ? rawBag : {};
  return {
    currency: {
      pp: Math.max(0, Number.parseInt(source?.currency?.pp, 10) || 0),
      gp: Math.max(0, Number.parseInt(source?.currency?.gp, 10) || 0),
      sp: Math.max(0, Number.parseInt(source?.currency?.sp, 10) || 0),
      cp: Math.max(0, Number.parseInt(source?.currency?.cp, 10) || 0),
    },
    items: normalizeInventoryItems(source.items, { now, idFactory }),
    playerInventories: normalizePlayerInventories(source.playerInventories, { now, idFactory }),
    tradeRequests: normalizeTradeRequests(source.tradeRequests, { now }),
    ownerUserId: normalizeText(source.ownerUserId),
    ownerEmail: normalizeEmail(source.ownerEmail),
    ownerUsername: normalizeText(source.ownerUsername),
    ownerUpdatedAt: normalizeText(source.ownerUpdatedAt),
    ownerUpdatedByUserId: normalizeText(source.ownerUpdatedByUserId),
    ownerUpdatedByUsername: normalizeText(source.ownerUpdatedByUsername),
  };
}

export function getPersonalInventoryEntry(bagState, userId) {
  const normalizedBag = normalizeBagInventoryState(bagState);
  const normalizedUserId = normalizeText(userId);
  if (!normalizedUserId) return { userId: '', username: '', updatedAt: '', items: [] };
  const entry = normalizedBag.playerInventories[normalizedUserId];
  if (entry && Array.isArray(entry.items)) return entry;
  return {
    userId: normalizedUserId,
    username: '',
    updatedAt: '',
    items: [],
  };
}

export function upsertPersonalInventoryEntry(bagState, userId, username, items, options = {}) {
  const now = normalizeIso(options.now) || new Date().toISOString();
  const normalizedBag = normalizeBagInventoryState(bagState, { now });
  const normalizedUserId = normalizeText(userId);
  if (!normalizedUserId) return normalizedBag;
  const existing = normalizedBag.playerInventories[normalizedUserId] || {
    userId: normalizedUserId,
    username: '',
    items: [],
    updatedAt: '',
  };
  normalizedBag.playerInventories = {
    ...normalizedBag.playerInventories,
    [normalizedUserId]: {
      ...existing,
      userId: normalizedUserId,
      username: normalizeText(username || existing.username),
      updatedAt: now,
      items: normalizeInventoryItems(items, { now }),
    },
  };
  return normalizedBag;
}

function parseInventoryLine(line) {
  const raw = normalizeText(line);
  if (!raw) return { name: '', qty: 0 };
  const xSuffix = raw.match(/^(.*?)(?:\s*[x\u00d7]\s*(\d+))$/i);
  if (xSuffix && normalizeText(xSuffix[1])) {
    return {
      name: normalizeText(xSuffix[1]),
      qty: Math.max(1, Number.parseInt(xSuffix[2], 10) || 1),
    };
  }
  const parenSuffix = raw.match(/^(.*?)\s*\(\s*[x\u00d7]\s*(\d+)\s*\)$/i);
  if (parenSuffix && normalizeText(parenSuffix[1])) {
    return {
      name: normalizeText(parenSuffix[1]),
      qty: Math.max(1, Number.parseInt(parenSuffix[2], 10) || 1),
    };
  }
  return { name: raw, qty: 1 };
}

function normalizeLineList(rawLines) {
  return (Array.isArray(rawLines) ? rawLines : [])
    .map((entry) => normalizeText(entry))
    .filter(Boolean);
}

function buildLineFromItem(item) {
  const normalizedItem = normalizeInventoryItem(item);
  if (normalizedItem.qty > 1) return `${normalizedItem.name} x${normalizedItem.qty}`;
  return normalizedItem.name;
}

export function inventoryItemsToEquipmentLines(items) {
  return normalizeInventoryItems(items).map((entry) => buildLineFromItem(entry));
}

export function inventoryItemsToEquippedLines(items) {
  return normalizeInventoryItems(items)
    .filter((entry) => entry.equipped)
    .map((entry) => buildLineFromItem(entry));
}

export function syncInventoryItemsFromEquipment(equipmentLines, equippedLines, previousItems, options = {}) {
  const now = normalizeIso(options.now) || new Date().toISOString();
  const prevList = normalizeInventoryItems(previousItems, { now });
  const prevByName = new Map();
  prevList.forEach((entry) => {
    const key = inventoryTokenKey(entry.name);
    if (!key || prevByName.has(key)) return;
    prevByName.set(key, entry);
  });

  const equipment = normalizeLineList(equipmentLines);
  const equippedKeySet = new Set(
    normalizeLineList(equippedLines)
      .map((line) => parseInventoryLine(line))
      .map((entry) => inventoryTokenKey(entry.name))
      .filter(Boolean)
  );
  const aggregateOrder = [];
  const aggregateByKey = new Map();

  equipment.forEach((line) => {
    const parsed = parseInventoryLine(line);
    if (!parsed.name) return;
    const key = inventoryTokenKey(parsed.name);
    if (!key) return;
    if (!aggregateByKey.has(key)) {
      aggregateOrder.push(key);
      aggregateByKey.set(key, {
        name: parsed.name,
        qty: parsed.qty,
      });
      return;
    }
    const existing = aggregateByKey.get(key);
    existing.qty += parsed.qty;
  });

  return aggregateOrder.map((key) => {
    const aggregate = aggregateByKey.get(key);
    const previous = prevByName.get(key);
    return normalizeInventoryItem({
      ...(previous || {}),
      name: aggregate.name,
      qty: aggregate.qty,
      equipped: equippedKeySet.has(key),
      updatedAt: now,
      createdAt: normalizeIso(previous?.createdAt) || now,
      category: previous?.category || 'Gear',
      rarity: previous?.rarity || 'Common',
    }, { now });
  });
}

export function lineListsMatchByToken(a, b) {
  const normalizeForCompare = (lines) => normalizeLineList(lines).map((line) => {
    const parsed = parseInventoryLine(line);
    return `${inventoryTokenKey(parsed.name)}::${Math.max(1, parsed.qty)}`;
  });
  const left = normalizeForCompare(a);
  const right = normalizeForCompare(b);
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}
