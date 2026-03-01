const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

const ABILITY_ALIASES = {
  str: ['str', 'strength'],
  dex: ['dex', 'dexterity'],
  con: ['con', 'constitution'],
  int: ['int', 'intelligence'],
  wis: ['wis', 'wisdom'],
  cha: ['cha', 'charisma'],
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function cleanText(value) {
  return String(value == null ? '' : value).trim();
}

function toInt(value, fallback = null) {
  if (value == null || value === '') return fallback;
  const asString = String(value).replace(/,/g, '').trim();
  if (!asString) return fallback;
  const parsed = Number.parseInt(asString, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toSpeed(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Math.max(0, value);
  const match = String(value).match(/-?\d+/);
  if (!match) return null;
  return Math.max(0, Number.parseInt(match[0], 10));
}

function toList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item)).filter(Boolean);
  }
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => cleanText(item) ? `${cleanText(key)} ${cleanText(item)}` : cleanText(key))
      .filter(Boolean);
  }
  const text = cleanText(value);
  if (!text) return [];
  return text
    .split(/[\n,;|]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeStringList(value) {
  return uniqueKeepOrder(toList(value).map((item) => cleanText(item)).filter(Boolean));
}

function toFreeText(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item)).filter(Boolean).join(', ');
  }
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, val]) => `${key}: ${cleanText(val)}`)
      .filter((line) => !line.endsWith(':'))
      .join(', ');
  }
  return cleanText(value);
}

function decodeLatin1(bytes) {
  try {
    return new TextDecoder('iso-8859-1').decode(bytes);
  } catch {
    let out = '';
    for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i] & 0xff);
    return out;
  }
}

function binaryStringToBytes(value) {
  const out = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) out[i] = value.charCodeAt(i) & 0xff;
  return out;
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  const error = new Error('Import cancelled by user.');
  error.name = 'AbortError';
  throw error;
}

async function nextTick() {
  await Promise.resolve();
}

function emitProgress(onProgress, progress, stage) {
  if (typeof onProgress !== 'function') return;
  onProgress({
    progress: clamp(Math.round(progress), 0, 100),
    stage: stage || '',
  });
}

function getFileExtension(file) {
  const name = String(file?.name || '').toLowerCase();
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1) : '';
}

function parseHpPair(value) {
  if (value == null) return { current: null, max: null };
  if (typeof value === 'number') return { current: value, max: value };

  if (typeof value === 'string') {
    const pairMatch = value.match(/(-?\d+)\s*\/\s*(-?\d+)/);
    if (pairMatch) {
      return {
        current: Number.parseInt(pairMatch[1], 10),
        max: Number.parseInt(pairMatch[2], 10),
      };
    }
    const single = toInt(value, null);
    if (single != null) return { current: single, max: single };
    return { current: null, max: null };
  }

  if (typeof value === 'object') {
    const current = toInt(
      value.current ?? value.hp ?? value.value ?? value.now ?? value.hitPoints,
      null
    );
    const max = toInt(
      value.max ?? value.maximum ?? value.total ?? value.maxHp ?? value.maxHP,
      current
    );
    return { current, max };
  }

  return { current: null, max: null };
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function findValueByAliases(root, aliases, maxDepth = 6) {
  const wanted = new Set(aliases.map(normalizeKey));
  const seen = new Set();
  const queue = [{ value: root, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    const node = current.value;
    if (!node || typeof node !== 'object') continue;
    if (seen.has(node)) continue;
    seen.add(node);

    if (Array.isArray(node)) {
      if (current.depth >= maxDepth) continue;
      node.forEach((item) => {
        if (item && typeof item === 'object') {
          queue.push({ value: item, depth: current.depth + 1 });
        }
      });
      continue;
    }

    const entries = Object.entries(node);
    for (let i = 0; i < entries.length; i += 1) {
      const [key, value] = entries[i];
      if (wanted.has(normalizeKey(key))) {
        return value;
      }
    }

    if (current.depth >= maxDepth) continue;
    entries.forEach(([, value]) => {
      if (value && typeof value === 'object') {
        queue.push({ value, depth: current.depth + 1 });
      }
    });
  }

  return undefined;
}

function parseAbilities(primarySource, rootFallback) {
  const out = { str: null, dex: null, con: null, int: null, wis: null, cha: null };
  const source = isObject(primarySource) ? primarySource : null;
  const root = rootFallback || {};

  ABILITY_KEYS.forEach((key) => {
    const aliases = ABILITY_ALIASES[key];
    let raw;
    if (source) {
      raw = findValueByAliases(source, aliases, 2);
    }
    if (raw == null) {
      raw = findValueByAliases(root, aliases, 6);
    }
    out[key] = toInt(raw, null);
  });

  return out;
}

function parseJsonSheet(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }

  if (!isObject(parsed)) {
    throw new Error('JSON sheet must be an object at the root level.');
  }

  const root =
    (isObject(parsed.character) && parsed.character) ||
    (isObject(parsed.data?.character) && parsed.data.character) ||
    (isObject(parsed.sheet) && parsed.sheet) ||
    (isObject(parsed.data) && parsed.data) ||
    parsed;

  const name = cleanText(findValueByAliases(root, ['name', 'characterName', 'character_name']));
  const race = cleanText(findValueByAliases(root, ['race', 'ancestry']));
  const className = cleanText(findValueByAliases(root, ['class', 'className', 'characterClass']));
  const level = toInt(findValueByAliases(root, ['level', 'characterLevel', 'lvl']), null);

  const hpPair = parseHpPair(
    findValueByAliases(root, ['hp', 'hitPoints', 'hit_points', 'health', 'vitals'])
  );
  const hpCurrent = toInt(
    findValueByAliases(root, ['currentHp', 'current_hp', 'hpCurrent', 'hp_now']),
    hpPair.current
  );
  const hpMax = toInt(
    findValueByAliases(root, ['maxHp', 'max_hp', 'hpMax', 'hp_total', 'maxHitPoints']),
    hpPair.max
  );

  const ac = toInt(findValueByAliases(root, ['ac', 'armorClass', 'armor_class']), null);
  const initiativeBonus = toInt(
    findValueByAliases(root, ['initiative', 'initiativeBonus', 'initiative_bonus']),
    null
  );
  const speed = toSpeed(findValueByAliases(root, ['speed', 'movement', 'walkSpeed']));
  const proficiencyBonus = toInt(
    findValueByAliases(root, ['proficiencyBonus', 'proficiency_bonus', 'profBonus', 'pb']),
    null
  );
  const spellSaveDC = toInt(
    findValueByAliases(root, ['spellSaveDC', 'spell_save_dc', 'saveDC', 'spellDc']),
    null
  );
  const attackModifier = toInt(
    findValueByAliases(root, ['attackModifier', 'attack_bonus', 'attackBonus', 'toHitBonus']),
    null
  );
  const spellAttackModifier = toInt(
    findValueByAliases(root, ['spellAttackModifier', 'spellAttackBonus', 'spell_attack_bonus', 'spellAtkBonus']),
    null
  );

  const abilitySource =
    findValueByAliases(root, ['attributes', 'abilityScores', 'ability_scores', 'stats', 'abilities']) ||
    null;
  const abilities = parseAbilities(abilitySource, root);

  const rawSpellbookEntries = findValueByAliases(
    root,
    ['spellbookEntries', 'spellEntries', 'spellsDetailed', 'spellDetails']
  );
  const rawSpellListValue = findValueByAliases(root, ['spells', 'spellList', 'spellbook']);
  const spellbookEntriesFromList = Array.isArray(rawSpellListValue) && rawSpellListValue.some((item) => isObject(item))
    ? normalizeSpellbookEntries(rawSpellListValue)
    : [];
  const spellbookEntries = rawSpellbookEntries != null
    ? normalizeSpellbookEntries(rawSpellbookEntries)
    : spellbookEntriesFromList;
  const spellList = spellbookEntries.length
    ? normalizeStringList(spellbookEntries.map((entry) => entry.name))
    : normalizeStringList(rawSpellListValue);
  const spellSlots = findValueByAliases(root, ['spellSlots', 'spell_slots', 'slotsByLevel', 'spellSlotLevels']);
  const savingThrows = normalizeStringList(
    findValueByAliases(root, ['savingThrows', 'saving_throws', 'saves', 'savingthrows'])
  );
  const skills = normalizeStringList(findValueByAliases(root, ['skills', 'skillList', 'skillBonuses']));
  const senses = normalizeStringList(
    findValueByAliases(root, ['senses', 'senseTypes', 'passiveSenses', 'passive'])
  );
  const abilitiesText = toFreeText(
    findValueByAliases(root, ['abilitiesText', 'features', 'traits', 'specialAbilities'])
  );
  const featureChargesRaw = findValueByAliases(
    root,
    ['featureCharges', 'feature_charges', 'classFeatureCharges', 'traitUses']
  );
  const featureCharges = mergeFeatureCharges([], Array.isArray(featureChargesRaw) ? featureChargesRaw : []);
  const equipmentRaw = findValueByAliases(root, ['equipment', 'inventory', 'gear', 'items']);
  const equipment = toFreeText(
    equipmentRaw
  );
  const equipmentItems = normalizeStringList(equipmentRaw || equipment);
  const otherPossessionsFromJson = normalizeStringList(
    findValueByAliases(root, ['otherPossessions', 'other_possessions', 'possessions', 'miscItems', 'treasure'])
  );

  const knownTopLevel = new Set(
    [
      'name',
      'charactername',
      'charactername',
      'race',
      'ancestry',
      'class',
      'classname',
      'characterclass',
      'level',
      'characterlevel',
      'lvl',
      'hp',
      'hitpoints',
      'hitpoints',
      'health',
      'vitals',
      'currenthp',
      'currenthp',
      'hpcurrent',
      'hpnow',
      'maxhp',
      'maxhp',
      'hptotal',
      'maxhitpoints',
      'ac',
      'armorclass',
      'initiative',
      'initiativebonus',
      'speed',
      'movement',
      'walkspeed',
      'proficiencybonus',
      'proficiency_bonus',
      'profbonus',
      'pb',
      'spellsavedc',
      'spell_save_dc',
      'savedc',
      'spelldc',
      'attackmodifier',
      'attackbonus',
      'attack_bonus',
      'tohitbonus',
      'spellattackmodifier',
      'spellattackbonus',
      'spell_attack_bonus',
      'spellatkbonus',
      'attributes',
      'abilityscores',
      'stats',
      'abilities',
      'spells',
      'spelllist',
      'spellbook',
      'spellbookentries',
      'spellentries',
      'spellsdetailed',
      'spelldetails',
      'spellslots',
      'spell_slots',
      'slotsbylevel',
      'spellslotlevels',
      'featurecharges',
      'feature_charges',
      'classfeaturecharges',
      'traituses',
      'abilitiestext',
      'features',
      'traits',
      'specialabilities',
      'savingthrows',
      'saving_throws',
      'saves',
      'skills',
      'skilllist',
      'skillbonuses',
      'senses',
      'sensetypes',
      'passivesenses',
      'passive',
      'equipment',
      'inventory',
      'gear',
      'items',
      'otherpossessions',
      'other_possessions',
      'possessions',
      'miscitems',
      'treasure',
      'character',
      'sheet',
      'data',
    ].map(normalizeKey)
  );

  const unknownFields = Object.keys(root)
    .filter((key) => !knownTopLevel.has(normalizeKey(key)))
    .sort((a, b) => a.localeCompare(b));

  return {
    parsed: {
      name,
      race,
      className,
      level,
      hpCurrent,
      hpMax,
      ac,
      initiativeBonus,
      speed,
      proficiencyBonus,
      spellSaveDC,
      attackModifier,
      spellAttackModifier,
      abilities,
      spellList,
      spellbookEntries,
      spellSlots: mergeSpellSlots([], Array.isArray(spellSlots) ? spellSlots : []),
      featureCharges,
      savingThrows,
      skills,
      senses,
      abilitiesText,
      equipment,
      equipmentItems,
      otherPossessions: otherPossessionsFromJson,
    },
    unknownFields,
  };
}

function detectSectionLabel(line) {
  const normalized = normalizeKey(line.split(':')[0]);
  if (['spells', 'spelllist', 'spellbook'].includes(normalized)) return 'spells';

  const headerText = line.replace(/=/g, '').trim();
  const headerNormalized = headerText.replace(/\s+/g, ' ').toLowerCase();
  if (/^cantrips?$/i.test(headerNormalized)) return 'spells';
  if (/^\d+(?:st|nd|rd|th)?\s+level\b/i.test(headerNormalized)) return 'spells';
  if (['abilities', 'features', 'traits', 'specialabilities'].includes(normalized)) return 'abilities';
  if (['equipment', 'inventory', 'gear', 'items'].includes(normalized)) return 'equipment';
  if (['otherpossessions', 'possessions', 'miscitems', 'treasure'].includes(normalized)) return 'otherPossessions';
  if (['savingthrows', 'saves'].includes(normalized)) return 'savingThrows';
  if (['skills', 'skillbonuses'].includes(normalized)) return 'skills';
  if (['senses', 'sensetypes', 'passivesenses'].includes(normalized)) return 'senses';
  return '';
}

function parseAttributesInline(text, out) {
  ABILITY_KEYS.forEach((abilityKey) => {
    const aliases = ABILITY_ALIASES[abilityKey];
    for (let i = 0; i < aliases.length; i += 1) {
      const alias = aliases[i];
      const pattern = new RegExp(`\\b${alias}\\b\\s*[:=]?\\s*(-?\\d+)`, 'i');
      const match = text.match(pattern);
      if (match) {
        out[abilityKey] = Number.parseInt(match[1], 10);
        break;
      }
    }
  });
}

async function parseTextSheet(text, signal, onProgress) {
  const lines = String(text || '').split(/\r?\n/);
  const fields = {
    name: '',
    race: '',
    className: '',
    level: null,
    hpCurrent: null,
    hpMax: null,
    ac: null,
    initiativeBonus: null,
    speed: null,
    proficiencyBonus: null,
    spellSaveDC: null,
    attackModifier: null,
    spellAttackModifier: null,
    abilities: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
    spellList: [],
    spellbookEntries: [],
    spellSlots: [],
    savingThrows: [],
    skills: [],
    senses: [],
    abilitiesText: '',
    featureCharges: [],
    equipment: '',
    equipmentItems: [],
    otherPossessions: [],
  };
  const sections = {
    spells: [],
    abilities: [],
    equipment: [],
    otherPossessions: [],
    savingThrows: [],
    skills: [],
    senses: [],
  };

  let activeSection = '';
  let hpFromText = { current: null, max: null };

  for (let i = 0; i < lines.length; i += 1) {
    if (i % 120 === 0) {
      throwIfAborted(signal);
      const span = lines.length > 0 ? i / lines.length : 0;
      emitProgress(onProgress, 45 + span * 35, 'parsing');
      await nextTick();
    }

    const rawLine = lines[i];
    const line = cleanText(rawLine);
    if (!line) {
      activeSection = '';
      continue;
    }

    const sectionLabel = detectSectionLabel(line);
    if (sectionLabel) {
      activeSection = sectionLabel;
      const parts = line.split(':');
      const afterColon = cleanText(parts.slice(1).join(':'));
      if (afterColon) sections[activeSection].push(afterColon);
      continue;
    }

    if (activeSection) {
      if (/^[a-z][a-z0-9 _/-]{1,40}\s*:/i.test(line)) {
        activeSection = '';
      } else {
        sections[activeSection].push(line.replace(/^[-*]\s*/, ''));
        continue;
      }
    }

    const lower = line.toLowerCase();
    const split = line.split(':');
    const left = cleanText(split[0]).toLowerCase();
    const right = cleanText(split.slice(1).join(':'));

    if (left === 'name' && !fields.name) {
      fields.name = right;
      continue;
    }
    if (left === 'race' && !fields.race) {
      fields.race = right;
      continue;
    }
    if ((left === 'class' || left === 'role') && !fields.className) {
      fields.className = right;
      continue;
    }
    if (left === 'level' && fields.level == null) {
      fields.level = toInt(right, null);
      continue;
    }
    if ((left === 'armor class' || left === 'ac') && fields.ac == null) {
      fields.ac = toInt(right, null);
      continue;
    }
    if ((left === 'initiative' || left === 'initiative bonus') && fields.initiativeBonus == null) {
      fields.initiativeBonus = toInt(right, null);
      continue;
    }
    if ((left === 'speed' || left === 'movement') && fields.speed == null) {
      fields.speed = toSpeed(right);
      continue;
    }
    if ((left === 'proficiency bonus' || left === 'prof bonus' || left === 'proficiency') && fields.proficiencyBonus == null) {
      fields.proficiencyBonus = toInt(right, null);
      continue;
    }
    if ((left === 'spell save dc' || left === 'save dc') && fields.spellSaveDC == null) {
      fields.spellSaveDC = toInt(right, null);
      continue;
    }
    if (
      (left === 'spell attack bonus' || left === 'spell attack modifier' || left === 'spell attack mod' || left === 'spell attack') &&
      fields.spellAttackModifier == null
    ) {
      fields.spellAttackModifier = toInt(right, null);
      continue;
    }
    if ((left === 'attack modifier' || left === 'attack bonus' || left === 'to hit bonus' || left === 'attack mod') && fields.attackModifier == null) {
      fields.attackModifier = toInt(right, null);
      continue;
    }
    if ((left === 'saving throws' || left === 'saves') && right) {
      fields.savingThrows = normalizeStringList(right);
      continue;
    }
    if (left === 'skills' && right) {
      fields.skills = normalizeStringList(right);
      continue;
    }
    if ((left === 'senses' || left === 'sense types') && right) {
      fields.senses = normalizeStringList(right);
      continue;
    }
    if ((left === 'hp' || left === 'hit points') && (fields.hpCurrent == null || fields.hpMax == null)) {
      hpFromText = parseHpPair(right || line);
      if (fields.hpCurrent == null) fields.hpCurrent = hpFromText.current;
      if (fields.hpMax == null) fields.hpMax = hpFromText.max;
      continue;
    }

    if (!fields.race || !fields.className || fields.level == null) {
      const rcl = line.match(/^([A-Za-z' -]+)\s+([A-Za-z' -]+)\s+(\d{1,2})$/);
      if (rcl && (!fields.race || !fields.className || fields.level == null)) {
        if (!fields.race) fields.race = cleanText(rcl[1]);
        if (!fields.className) fields.className = cleanText(rcl[2]);
        if (fields.level == null) fields.level = toInt(rcl[3], null);
      }
    }

    parseAttributesInline(line, fields.abilities);

    if (!fields.name && !line.includes(':') && i <= 3) {
      fields.name = line;
    }

    if (lower.includes('hp') && (fields.hpCurrent == null || fields.hpMax == null)) {
      hpFromText = parseHpPair(line);
      if (fields.hpCurrent == null) fields.hpCurrent = hpFromText.current;
      if (fields.hpMax == null) fields.hpMax = hpFromText.max;
    }

    if (fields.proficiencyBonus == null) {
      const profMatch = line.match(/\bproficiency\s*bonus\b\s*[:=]?\s*([+-]?\d+)/i);
      if (profMatch) fields.proficiencyBonus = toInt(profMatch[1], null);
    }
    if (fields.spellSaveDC == null) {
      const spellDcMatch = line.match(/\b(?:spell\s*)?save\s*dc\b\s*[:=]?\s*(\d+)/i);
      if (spellDcMatch) fields.spellSaveDC = toInt(spellDcMatch[1], null);
    }
    if (fields.spellAttackModifier == null) {
      const spellAtkMatch = line.match(/\bspell\s*attack(?:\s*(?:bonus|modifier|mod))?\b\s*[:=]?\s*([+-]?\d+)/i);
      if (spellAtkMatch) fields.spellAttackModifier = toInt(spellAtkMatch[1], null);
    }
    if (fields.attackModifier == null) {
      const attackMatch = line.match(/\battack(?:\s*(?:bonus|modifier|mod))?\b\s*[:=]?\s*([+-]?\d+)/i);
      if (attackMatch) fields.attackModifier = toInt(attackMatch[1], null);
    }
  }

  fields.spellList = sanitizeSpellEntries(sections.spells);
  fields.spellbookEntries = extractSpellbookEntriesFromTextLines(sections.spells);
  if (!fields.spellbookEntries.length) {
    fields.spellbookEntries = buildSpellbookEntriesFromSpellList(fields.spellList);
  } else if (!fields.spellList.length) {
    fields.spellList = normalizeStringList(fields.spellbookEntries.map((entry) => entry.name));
  }
  fields.spellSlots = mergeSpellSlots(
    extractSpellSlotsFromLines(lines),
    extractSpellSlotsFromLines(sections.spells)
  );
  fields.savingThrows = normalizeStringList([...fields.savingThrows, ...sections.savingThrows]);
  fields.skills = normalizeStringList([...fields.skills, ...sections.skills]);
  fields.senses = normalizeStringList([...fields.senses, ...sections.senses]);
  fields.abilitiesText = cleanText(sections.abilities.join('\n'));
  fields.featureCharges = mergeFeatureCharges(
    extractFeatureChargesFromLines(lines),
    extractFeatureChargesFromLines(sections.abilities)
  );
  fields.equipmentItems = normalizeStringList(sections.equipment.join('\n'));
  fields.otherPossessions = normalizeStringList(sections.otherPossessions.join('\n'));
  fields.equipment = cleanText(fields.equipmentItems.join(', '));

  return {
    parsed: fields,
    unknownFields: [],
  };
}

async function inflatePdfStream(bytes) {
  if (typeof DecompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
    const inflated = await new Response(stream).arrayBuffer();
    return new Uint8Array(inflated);
  } catch {
    return null;
  }
}

function decodePdfLiteral(raw) {
  let out = '';
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    i += 1;
    if (i >= raw.length) break;
    const esc = raw[i];
    if (esc === 'n') { out += '\n'; continue; }
    if (esc === 'r') { out += '\r'; continue; }
    if (esc === 't') { out += '\t'; continue; }
    if (esc === 'b') { out += '\b'; continue; }
    if (esc === 'f') { out += '\f'; continue; }
    if (esc === '\\' || esc === '(' || esc === ')') { out += esc; continue; }
    if (esc === '\r') {
      if (raw[i + 1] === '\n') i += 1;
      continue;
    }
    if (esc === '\n') continue;
    if (/[0-7]/.test(esc)) {
      let octal = esc;
      if (/[0-7]/.test(raw[i + 1] || '')) { octal += raw[i + 1]; i += 1; }
      if (/[0-7]/.test(raw[i + 1] || '')) { octal += raw[i + 1]; i += 1; }
      out += String.fromCharCode(Number.parseInt(octal, 8));
      continue;
    }
    out += esc;
  }
  return out;
}

function decodePdfHex(raw) {
  const compact = raw.replace(/\s+/g, '');
  if (!compact) return '';
  const padded = compact.length % 2 === 0 ? compact : `${compact}0`;
  const bytes = new Uint8Array(padded.length / 2);
  for (let i = 0; i < padded.length; i += 2) {
    const byte = Number.parseInt(padded.slice(i, i + 2), 16);
    bytes[i / 2] = Number.isFinite(byte) ? byte : 0;
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let out = '';
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      const code = (bytes[i] << 8) | bytes[i + 1];
      out += String.fromCharCode(code);
    }
    return out;
  }
  return decodeLatin1(bytes);
}

function readPdfStringToken(text, startAt) {
  let i = startAt;
  while (i < text.length && /\s/.test(text[i])) i += 1;
  if (i >= text.length) return { value: '', nextIndex: i };

  if (text[i] === '(') {
    let depth = 1;
    let raw = '';
    for (i += 1; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === '\\') {
        raw += ch;
        if (i + 1 < text.length) {
          raw += text[i + 1];
          i += 1;
        }
        continue;
      }
      if (ch === '(') {
        depth += 1;
        raw += ch;
        continue;
      }
      if (ch === ')') {
        depth -= 1;
        if (depth === 0) {
          return { value: cleanText(decodePdfLiteral(raw)), nextIndex: i + 1 };
        }
        raw += ch;
        continue;
      }
      raw += ch;
    }
    return { value: cleanText(decodePdfLiteral(raw)), nextIndex: i };
  }

  if (text[i] === '<' && text[i + 1] !== '<') {
    let raw = '';
    for (i += 1; i < text.length && text[i] !== '>'; i += 1) raw += text[i];
    return { value: cleanText(decodePdfHex(raw)), nextIndex: i + 1 };
  }

  let raw = '';
  while (i < text.length && !/\s|\/|>/.test(text[i])) {
    raw += text[i];
    i += 1;
  }
  return { value: cleanText(raw), nextIndex: i };
}

function fieldKeyName(rawFieldName) {
  return normalizeKey(String(rawFieldName || '').replace(/\d+$/g, ''));
}

function parseClassLevelText(raw) {
  const text = cleanText(raw);
  if (!text) return { className: '', level: null };
  const allNumbers = Array.from(text.matchAll(/\d+/g)).map((m) => Number.parseInt(m[0], 10));
  const level = allNumbers.length > 0 ? allNumbers.reduce((sum, n) => sum + n, 0) : null;
  const className = cleanText(
    text
      .replace(/\d+/g, ' ')
      .replace(/\s+\/\s+/g, ' / ')
      .replace(/\s+/g, ' ')
      .trim()
  );
  return { className, level };
}

const PDF_SAVING_THROW_FIELDS = [
  { label: 'Strength', aliases: ['ST Strength', 'ST Strength3'] },
  { label: 'Dexterity', aliases: ['ST Dexterity', 'ST Dexterity3'] },
  { label: 'Constitution', aliases: ['ST Constitution', 'ST Constitution3'] },
  { label: 'Intelligence', aliases: ['ST Intelligence', 'ST Intelligence3'] },
  { label: 'Wisdom', aliases: ['ST Wisdom', 'ST Wisdom3'] },
  { label: 'Charisma', aliases: ['ST Charisma', 'ST Charisma3'] },
];

const PDF_SKILL_FIELDS = [
  { name: 'Acrobatics', bonus: ['Acrobatics', 'Acrobatics3'], ability: ['AcrobaticsMod', 'AcrobaticsMod3'] },
  { name: 'Animal Handling', bonus: ['Animal', 'Animal3'], ability: ['AnimalMod', 'AnimalMod3'] },
  { name: 'Arcana', bonus: ['Arcana', 'Arcana3'], ability: ['ArcanaMod', 'ArcanaMod3'] },
  { name: 'Athletics', bonus: ['Athletics', 'Athletics3'], ability: ['AthleticsMod', 'AthleticsMod3'] },
  { name: 'Deception', bonus: ['Deception', 'Deception3'], ability: ['DeceptionMod', 'DeceptionMod3'] },
  { name: 'History', bonus: ['History', 'History3'], ability: ['HistoryMod', 'HistoryMod3'] },
  { name: 'Insight', bonus: ['Insight', 'Insight3'], ability: ['InsightMod', 'InsightMod3'] },
  { name: 'Intimidation', bonus: ['Intimidation', 'Intimidation3'], ability: ['IntimidationMod', 'IntimidationMod3'] },
  { name: 'Investigation', bonus: ['Investigation', 'Investigation3'], ability: ['InvestigationMod', 'InvestigationMod3'] },
  { name: 'Medicine', bonus: ['Medicine', 'Medicine3'], ability: ['MedicineMod', 'MedicineMod3'] },
  { name: 'Nature', bonus: ['Nature', 'Nature3'], ability: ['NatureMod', 'NatureMod3'] },
  { name: 'Perception', bonus: ['Perception', 'Perception3'], ability: ['PerceptionMod', 'PerceptionMod3'] },
  { name: 'Performance', bonus: ['Performance', 'Performance3'], ability: ['PerformanceMod', 'PerformanceMod3'] },
  { name: 'Persuasion', bonus: ['Persuasion', 'Persuasion3'], ability: ['PersuasionMod', 'PersuasionMod3'] },
  { name: 'Religion', bonus: ['Religion', 'Religion3'], ability: ['ReligionMod', 'ReligionMod3'] },
  { name: 'Sleight of Hand', bonus: ['SleightofHand', 'SleightofHand3'], ability: ['SleightofHandMod', 'SleightofHandMod3'] },
  { name: 'Stealth', bonus: ['Stealth', 'Stealth3'], ability: ['StealthMod', 'StealthMod3'] },
  { name: 'Survival', bonus: ['Survival', 'Survival3'], ability: ['SurvivalMod', 'SurvivalMod3'] },
];

const PDF_FORM_FIELD_LOOKAHEAD = 20000;

function looksLikeObjectRefValue(raw) {
  return /^\d+\s+\d+\s+R$/i.test(cleanText(raw));
}

function sanitizeSpellEntries(lines) {
  const out = [];
  const cleaned = normalizeStringList(lines);
  cleaned.forEach((line) => {
    line
      .split(/[\n,;]+/g)
      .map((item) => cleanText(item))
      .filter(Boolean)
      .forEach((token) => {
        const low = token.toLowerCase();
        if (token.length < 3) return;
        if (!/[a-z]/i.test(token)) return;
        if (spellLevelFromText(token) != null) return;
        if (spellSlotsFromText(token) != null) return;
        if (/^(str|dex|con|int|wis|cha)\s*-?\+?\d*$/i.test(token)) return;
        if (/^\+?-?\d+(?:\s*\/\s*\d+)?$/.test(token)) return;
        if (/^(warlock|paladin|pact|slots?|at will|always prepared)$/i.test(token)) return;
        if (/\b(?:str|dex|con|int|wis|cha)\s*\d+\b/i.test(token)) return;
        if (/\b(?:warlock|paladin)\b/i.test(low) && token.split(/\s+/).length === 1) return;
        out.push(token.replace(/\s+/g, ' ').trim());
      });
  });
  return uniqueKeepOrder(out);
}

function normalizeSpellLevel(raw, fallback = null) {
  if (raw == null || raw === '') return fallback;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.trunc(raw);
    return n >= 0 && n <= 9 ? n : fallback;
  }

  const text = cleanText(raw).toLowerCase();
  if (!text) return fallback;
  if (text.includes('cantrip')) return 0;
  const withLevel = text.match(/\b([0-9])(?:st|nd|rd|th)?\s*level\b/i);
  if (withLevel) {
    const parsed = toInt(withLevel[1], fallback);
    return parsed != null && parsed >= 0 && parsed <= 9 ? parsed : fallback;
  }
  if (/^[0-9]$/.test(text)) {
    const parsed = toInt(text, fallback);
    return parsed != null && parsed >= 0 && parsed <= 9 ? parsed : fallback;
  }
  return fallback;
}

function sanitizeSpellCell(value) {
  const compact = cleanText(value);
  if (!compact) return '';
  if (/^[-–—=]+$/i.test(compact)) return '';
  if (compact === '--') return '';
  return compact;
}

function normalizeSpellPrepared(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'boolean') return value ? 'P' : '';
  const compact = cleanText(value).toUpperCase();
  if (!compact) return '';
  if (['TRUE', 'YES', 'Y', '1'].includes(compact)) return 'P';
  if (['FALSE', 'NO', 'N', '0'].includes(compact)) return '';
  if (compact === 'AP') return 'A';
  if (compact.length === 1) return compact;
  return compact.slice(0, 10);
}

function normalizeSpellbookEntry(raw, index = 0) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const name = cleanText(raw);
    if (!name) return null;
    return {
      name,
      level: normalizeSpellLevel(null, null),
      source: '',
      saveAtk: '',
      time: '',
      range: '',
      components: '',
      duration: '',
      prepared: '',
      notes: '',
      index,
    };
  }
  if (!isObject(raw)) return null;

  const name = cleanText(raw.name ?? raw.spell ?? raw.title ?? raw.label);
  if (!name) return null;

  let level = normalizeSpellLevel(
    raw.level ?? raw.spellLevel ?? raw.levelIndex ?? raw.circle ?? raw.slotLevel,
    null
  );
  const source = sanitizeSpellCell(raw.source ?? raw.origin ?? raw.class);
  if (level == null) level = normalizeSpellLevel(source, null);
  if (level == null) level = normalizeSpellLevel(name, null);

  return {
    name,
    level,
    source,
    saveAtk: sanitizeSpellCell(
      raw.saveAtk ??
      raw.saveAttack ??
      raw.save ??
      raw.attack ??
      raw.atk ??
      raw.saveHit ??
      raw.saveOrHit
    ),
    time: sanitizeSpellCell(raw.time ?? raw.castingTime ?? raw.castTime),
    range: sanitizeSpellCell(raw.range ?? raw.distance),
    components: sanitizeSpellCell(raw.components ?? raw.comp),
    duration: sanitizeSpellCell(raw.duration),
    prepared: normalizeSpellPrepared(raw.prepared ?? raw.prep),
    notes: sanitizeSpellCell(raw.notes ?? raw.description),
    index: toInt(raw.index, index),
  };
}

function buildSpellbookEntriesFromSpellList(spellList) {
  return normalizeStringList(spellList).map((name, index) => ({
    name,
    level: null,
    source: '',
    saveAtk: '',
    time: '',
    range: '',
    components: '',
    duration: '',
    prepared: '',
    notes: '',
    index,
  }));
}

function normalizeSpellbookEntries(raw, fallbackSpellList = []) {
  const items = Array.isArray(raw) ? raw : [];
  const normalized = items
    .map((entry, index) => normalizeSpellbookEntry(entry, index))
    .filter(Boolean);
  if (normalized.length > 0) return normalized;
  return buildSpellbookEntriesFromSpellList(fallbackSpellList);
}

function extractSpellbookEntriesFromTextLines(lines) {
  const rows = Array.isArray(lines)
    ? lines
        .flatMap((line) => String(line == null ? '' : line).split(/\r?\n/g))
        .map((line) => cleanText(line))
    : [];

  let activeLevel = null;
  const entries = [];
  rows.forEach((row) => {
    if (!row) return;
    const level = spellLevelFromText(row);
    if (level != null) {
      activeLevel = level;
      return;
    }
    const names = sanitizeSpellEntries([row]);
    names.forEach((name) => {
      entries.push({
        name,
        level: activeLevel,
      });
    });
  });

  return normalizeSpellbookEntries(entries);
}

function mergeSpellbookEntries(base, overlay) {
  const baseEntries = normalizeSpellbookEntries(base);
  const overlayEntries = normalizeSpellbookEntries(overlay);
  if (!overlayEntries.length) return baseEntries;
  if (!baseEntries.length) return overlayEntries;

  const levelHintsByName = new Map();
  baseEntries.forEach((entry) => {
    const key = normalizeKey(entry.name);
    if (!key) return;
    const bucket = levelHintsByName.get(key) || [];
    bucket.push(entry.level);
    levelHintsByName.set(key, bucket);
  });

  const mergedOverlay = overlayEntries.map((entry) => {
    if (entry.level != null) return entry;
    const key = normalizeKey(entry.name);
    const bucket = key ? levelHintsByName.get(key) : null;
    if (!bucket || bucket.length === 0) return entry;
    const hintedLevel = bucket.shift();
    if (hintedLevel == null) return entry;
    return { ...entry, level: hintedLevel };
  });

  const overlayCounts = new Map();
  mergedOverlay.forEach((entry) => {
    const key = normalizeKey(entry.name);
    if (!key) return;
    overlayCounts.set(key, (overlayCounts.get(key) || 0) + 1);
  });

  const extras = [];
  baseEntries.forEach((entry) => {
    const key = normalizeKey(entry.name);
    if (!key) return;
    const remaining = overlayCounts.get(key) || 0;
    if (remaining > 0) {
      overlayCounts.set(key, remaining - 1);
      return;
    }
    extras.push(entry);
  });

  return [...mergedOverlay, ...extras];
}

function normalizeFeatureChargeName(raw) {
  const compact = cleanText(raw).replace(/\s+/g, ' ');
  if (!compact) return '';
  let name = compact.replace(/^[-*|•\s]+/, '').trim();
  if (name.includes('•')) name = cleanText(name.split('•')[0]);
  // Strip common trailing source references (e.g. "PHB-2024 195", "EFotA 10").
  name = name.replace(/\s*[•]\s*[^|]+$/g, '').trim();
  name = name.replace(/\s+[A-Z][A-Za-z0-9]*(?:-\d{4})?\s+\d+\s*$/g, '').trim();
  name = name.replace(/:\s*\+?\d+\s*\/\s*(?:short|long|other)\s*rest\b.*$/i, '').trim();
  name = name.replace(/\s+\+?\d+\s*\/\s*(?:short|long|other)\s*rest\b.*$/i, '').trim();
  name = name.replace(/\|\s*\d+\s*\/.*$/i, '').trim();
  name = name.replace(/[:\-–]\s*$/g, '').trim();
  name = name.replace(/\s{2,}/g, ' ').trim();
  return name;
}

const IGNORED_FEATURE_CHARGE_NAMES = new Set([
  'steeldefender',
]);

const STANDARD_ACTION_NAME_KEYS = new Set([
  'action',
  'actions',
  'bonusaction',
  'bonusactions',
  'reaction',
  'reactions',
  'standardaction',
  'standardactions',
  'longrest',
  'shortrest',
  'other',
  'special',
  'attack',
  'castaspell',
  'dash',
  'disengage',
  'dodge',
  'help',
  'hide',
  'ready',
  'search',
  'useanobject',
  'improvise',
  'grapple',
  'shove',
  'opportunityattack',
  'twoweaponfighting',
]);

function shouldIgnoreFeatureChargeName(name) {
  const key = normalizeKey(name);
  const canonicalKey = key.replace(/^\d+/, '').replace(/\d+$/, '');
  if (!key) return false;
  if (IGNORED_FEATURE_CHARGE_NAMES.has(key)) return true;
  if (key.startsWith('steeldefender')) return true;
  if (STANDARD_ACTION_NAME_KEYS.has(canonicalKey)) return true;
  if (/^(?:standard)?(?:bonus)?actions?$/.test(canonicalKey)) return true;
  return false;
}

function looksLikeFeatureHeading(line) {
  const compact = cleanText(line).replace(/\s+/g, ' ');
  const name = normalizeFeatureChargeName(compact);
  if (!name) return false;
  if (shouldIgnoreFeatureChargeName(name)) return false;
  if (name.length < 3 || name.length > 88) return false;
  if (/[.!?]$/.test(compact)) return false;
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 10) return false;
  const hasSentenceCue =
    /\b(?:you|when|while|if|as|can|gain|take|regain|restore|restoring|target)\b/i.test(compact) &&
    /[.,;]/.test(compact);
  if (hasSentenceCue) return false;
  const hasHeadingMarker = /^[-*]/.test(compact);
  const hasSourceMarker = /[•]|[A-Z][A-Za-z0-9]*(?:-\d{4})?\s+\d+\b/.test(compact);
  const titleishCount = words.filter((word) => /^[A-Z][A-Za-z'/-]*$/.test(word)).length;
  const titleish = titleishCount >= Math.max(1, Math.ceil(words.length * 0.5));
  return hasHeadingMarker || hasSourceMarker || (titleish && words.length <= 6);
}

function extractFeatureChargeMax(text) {
  const compact = cleanText(text).replace(/\s+/g, ' ');
  if (!compact) return null;
  const patterns = [
    /\b\+?\s*([0-9]{1,2})\s*\/\s*(?:short|long|sr|lr)\b/i,
    /\byou can use this (?:trait|feature|ability|action|energy)\s+\+?\s*([0-9]{1,2})\s*time(?:s|\(s\))?\b/i,
    /\byou can take this (?:reaction|bonus action)\s+\+?\s*([0-9]{1,2})\s*time(?:s|\(s\))?\b/i,
    /\b\+?\s*([0-9]{1,2})\s*time(?:s|\(s\))?\s+per\s+(?:short|long)\s+rest\b/i,
    /\b\+?\s*([0-9]{1,2})\s+uses?\b/i,
  ];
  for (let i = 0; i < patterns.length; i += 1) {
    const match = compact.match(patterns[i]);
    if (!match) continue;
    return clamp(toInt(match[1], 0), 0, 20);
  }
  return null;
}

function normalizeFeatureChargeEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry, index) => {
      const source = entry && typeof entry === 'object' ? entry : {};
      const rawName = source.name ?? source.label ?? source.title ?? '';
      const name = normalizeFeatureChargeName(rawName);
      const max = clamp(toInt(source.max ?? source.charges ?? source.uses, 0), 0, 20);
      const fallbackCurrent = source.current ?? source.remaining ?? max;
      const current = clamp(toInt(fallbackCurrent, max), 0, max);
      const id = cleanText(source.id) || `feature-${index + 1}`;
      if (!name || max <= 0) return null;
      if (shouldIgnoreFeatureChargeName(name)) return null;
      return { id, name, max, current };
    })
    .filter(Boolean);
}

function mergeFeatureCharges(base, overlay) {
  const byKey = new Map();
  const read = (items) => {
    normalizeFeatureChargeEntries(items).forEach((entry, index) => {
      const key = normalizeKey(entry.name) || entry.id || `feature-${index + 1}`;
      byKey.set(key, entry);
    });
  };
  read(base);
  read(overlay);
  return Array.from(byKey.values());
}

function extractFeatureChargesFromLines(lines) {
  const entries = [];
  const parts = Array.isArray(lines)
    ? lines
        .flatMap((line) => String(line == null ? '' : line).split(/\r?\n/g))
        .map((line) => cleanText(line))
    : [];
  let activeName = '';
  let linesSinceActiveName = Number.POSITIVE_INFINITY;

  parts.forEach((line) => {
    if (!line) {
      linesSinceActiveName += 1;
      if (linesSinceActiveName > 20) activeName = '';
      return;
    }
    if (looksLikeFeatureHeading(line)) {
      activeName = normalizeFeatureChargeName(line);
      linesSinceActiveName = 0;
    } else {
      linesSinceActiveName += 1;
      if (linesSinceActiveName > 20) activeName = '';
    }

    const max = extractFeatureChargeMax(line);
    if (max == null || max <= 0) return;

    const inlineSource = line.includes('|') ? line.split('|')[0] : line;
    const inlineName = looksLikeFeatureHeading(inlineSource) ? normalizeFeatureChargeName(inlineSource) : '';
    const name = inlineName || activeName;
    if (!name) return;
    if (shouldIgnoreFeatureChargeName(name)) return;
    entries.push({ id: `feature-${entries.length + 1}`, name, max, current: max });

    if (inlineName) {
      activeName = inlineName;
      linesSinceActiveName = 0;
    }
  });

  return mergeFeatureCharges([], entries);
}

function spellLevelFromText(text) {
  const compact = cleanText(text).replace(/=+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!compact) return null;
  if (/^cantrips?$/i.test(compact)) return 0;
  const match = compact.match(/\b([1-9])(?:st|nd|rd|th)?\s+level\b/i);
  return match ? toInt(match[1], null) : null;
}

function spellSlotsFromText(text) {
  const compact = cleanText(text).replace(/\s+/g, ' ').trim();
  if (!compact) return null;
  const match = compact.match(/\b([0-9]{1,2})\s*(?:slots?|pact)\b/i);
  return match ? Math.max(0, toInt(match[1], 0)) : null;
}

function extractSpellSlotsFromLines(lines) {
  const out = [];
  let activeLevel = null;

  lines.forEach((line) => {
    const compact = cleanText(line);
    if (!compact) return;

    const level = spellLevelFromText(compact);
    if (level != null) {
      activeLevel = level;
    }

    const slots = spellSlotsFromText(compact);
    if (slots != null && activeLevel != null && activeLevel >= 1 && activeLevel <= 9) {
      out.push({ level: activeLevel, max: slots, current: slots });
    }
  });

  return out;
}

function mergeSpellSlots(base, overlay) {
  const byLevel = new Map();
  const read = (items) => {
    if (!Array.isArray(items)) return;
    items.forEach((slot) => {
      const level = toInt(slot?.level, 0);
      if (level < 1 || level > 9) return;
      const max = Math.max(0, toInt(slot?.max ?? slot?.total, 0));
      const fallbackCurrent = slot?.current ?? slot?.remaining ?? max;
      const current = clamp(toInt(fallbackCurrent, max), 0, max);
      byLevel.set(level, { level, max, current });
    });
  };

  read(base);
  read(overlay);
  return Array.from(byLevel.values()).sort((a, b) => a.level - b.level);
}

function parsePdfFormFieldPairs(binaryText) {
  const pairs = [];
  let idx = 0;
  while (idx < binaryText.length) {
    const tIdx = binaryText.indexOf('/T', idx);
    if (tIdx < 0) break;
    const after = binaryText[tIdx + 2] || '';
    if (/[A-Za-z]/.test(after)) {
      idx = tIdx + 2;
      continue;
    }

    const field = readPdfStringToken(binaryText, tIdx + 2);
    if (!field.value) {
      idx = tIdx + 2;
      continue;
    }

    const tail = binaryText.slice(
      field.nextIndex,
      Math.min(binaryText.length, field.nextIndex + PDF_FORM_FIELD_LOOKAHEAD)
    );
    let value = '';
    const vIdx = tail.indexOf('/V');
    const dvIdx = tail.indexOf('/DV');
    if (vIdx >= 0) {
      const token = readPdfStringToken(tail, vIdx + 2);
      value = token.value;
      if (/^\d+$/.test(value) && /^\s+\d+\s+R\b/.test(tail.slice(token.nextIndex, token.nextIndex + 18))) {
        value = '';
      }
    } else if (dvIdx >= 0) {
      const token = readPdfStringToken(tail, dvIdx + 3);
      value = token.value;
      if (/^\d+$/.test(value) && /^\s+\d+\s+R\b/.test(tail.slice(token.nextIndex, token.nextIndex + 18))) {
        value = '';
      }
    }

    pairs.push({ field: field.value, value: cleanText(value) });
    idx = field.nextIndex;
  }
  return pairs;
}

function mapPdfFormPairsToParsed(pairs) {
  const byField = new Map();
  pairs.forEach((pair) => {
    const key = cleanText(pair.field);
    if (!key) return;
    const nextValue = cleanText(pair.value);
    const existingValue = cleanText(byField.get(key));
    if (!existingValue) {
      byField.set(key, nextValue);
      return;
    }
    if (!nextValue) {
      return;
    }

    const normalizedField = fieldKeyName(key);
    const shouldMergeMultiChunk =
      normalizedField.startsWith('featurestraits') ||
      normalizedField.startsWith('actions') ||
      normalizedField.startsWith('spells');

    if (!shouldMergeMultiChunk) {
      return;
    }
    if (existingValue === nextValue) {
      return;
    }
    byField.set(key, `${existingValue}\n${nextValue}`);
  });

  const findValue = (...aliases) => {
    for (let i = 0; i < aliases.length; i += 1) {
      const alias = aliases[i];
      const direct = byField.get(alias);
      if (cleanText(direct)) return cleanText(direct);
    }
    const wanted = aliases.map((a) => fieldKeyName(a));
    for (const [key, value] of byField.entries()) {
      const normalized = fieldKeyName(key);
      if (wanted.includes(normalized) && cleanText(value)) return cleanText(value);
    }
    return '';
  };

  const name = findValue('CharacterName', 'CharacterName3');
  const race = findValue('RACE', 'RACE3');
  const classRaw = findValue('CLASS  LEVEL', 'CLASS  LEVEL3');
  const classLevel = parseClassLevelText(classRaw);
  const ac = toInt(findValue('AC', 'AC3'), null);
  const initiativeBonus = toInt(findValue('Init', 'Init3'), null);
  const speed = toSpeed(findValue('Speed', 'Speed3'));
  const hpMax = toInt(findValue('MaxHP', 'MaxHP3'), null);
  const hpCurrent = toInt(findValue('CurrentHP', 'CurrentHP3'), hpMax);
  const proficiencyBonus = toInt(findValue('ProfBonus', 'ProficiencyBonus', 'PB'), null);
  const spellSaveDC = toInt(findValue('spellSaveDC0', 'spellSaveDC', 'SpellSaveDC', 'SaveDC'), null);
  const spellAttackModifier = toInt(findValue('spellAtkBonus0', 'spellAtkBonus', 'SpellAtkBonus', 'spellAttackBonus'), null);

  const abilities = {
    str: toInt(findValue('STR', 'STR3'), null),
    dex: toInt(findValue('DEX', 'DEX3'), null),
    con: toInt(findValue('CON', 'CON3'), null),
    int: toInt(findValue('INT', 'INT3'), null),
    wis: toInt(findValue('WIS', 'WIS3'), null),
    cha: toInt(findValue('CHA', 'CHA3', 'Cha'), null),
  };

  const featureLines = [];
  const featureChargeHintLines = [];
  const equipmentLines = [];
  const otherPossessionsLines = [];
  const spellLines = [];
  const spellSlotHintLines = [];
  const spellRowsByIndex = new Map();
  const senses = [];

  const savingThrows = PDF_SAVING_THROW_FIELDS
    .map(({ label, aliases }) => {
      const value = cleanText(findValue(...aliases));
      return value ? `${label} ${value}` : '';
    })
    .filter(Boolean);

  const skills = PDF_SKILL_FIELDS
    .map(({ name, bonus, ability }) => {
      const bonusValue = cleanText(findValue(...bonus));
      if (!bonusValue) return '';
      const abilityValue = cleanText(findValue(...ability));
      if (!abilityValue) return `${name} ${bonusValue}`;
      return `${name} ${bonusValue} (${abilityValue.toUpperCase()})`;
    })
    .filter(Boolean);

  for (let i = 1; i <= 3; i += 1) {
    const customName = cleanText(findValue(`CustomSkill${i}`, `CustomSkill${i}3`));
    const customBonus = cleanText(findValue(`Custom Skill Bonus ${i}`, `Custom Skill Bonus ${i}3`));
    if (customName && customBonus) skills.push(`${customName} ${customBonus}`);
    else if (customName) skills.push(customName);
  }

  const passiveSenseSpecs = [
    { label: 'Passive Perception', aliases: ['Passive1', 'Passive13'] },
    { label: 'Passive Insight', aliases: ['Passive2', 'Passive23'] },
    { label: 'Passive Investigation', aliases: ['Passive3', 'Passive33'] },
  ];
  passiveSenseSpecs.forEach(({ label, aliases }) => {
    const value = cleanText(findValue(...aliases));
    if (value) senses.push(`${label} ${value}`);
  });
  const additionalSenses = cleanText(findValue('AdditionalSenses', 'AdditionalSenses3'));
  if (additionalSenses && !looksLikeObjectRefValue(additionalSenses)) {
    normalizeStringList(additionalSenses).forEach((line) => senses.push(line));
  }

  let activeSpellLevel = null;
  pairs.forEach(({ field, value }) => {
    const fieldName = cleanText(field);
    if (!fieldName) return;
    const cleanedValue = cleanText(value);

    if (/^spellHeader\d+$/i.test(fieldName)) {
      const headerLevel = spellLevelFromText(cleanedValue);
      if (headerLevel != null) activeSpellLevel = headerLevel;
      return;
    }

    const spellRowMatch = fieldName.match(
      /^spell(name|source|savehit|castingtime|range|components|duration|prepared|notes)(\d+)$/i
    );
    if (!spellRowMatch) return;

    const rowPart = spellRowMatch[1].toLowerCase();
    const rowIndex = toInt(spellRowMatch[2], null);
    if (rowIndex == null || rowIndex < 0) return;

    const row = spellRowsByIndex.get(rowIndex) || { index: rowIndex, level: activeSpellLevel };
    if (row.level == null && activeSpellLevel != null) row.level = activeSpellLevel;

    const fieldMap = {
      name: 'name',
      source: 'source',
      savehit: 'saveAtk',
      castingtime: 'time',
      range: 'range',
      components: 'components',
      duration: 'duration',
      prepared: 'prepared',
      notes: 'notes',
    };
    const targetField = fieldMap[rowPart];
    if (!targetField) return;

    const nextValue = targetField === 'prepared'
      ? normalizeSpellPrepared(cleanedValue)
      : sanitizeSpellCell(cleanedValue);
    if (!cleanText(row[targetField]) || cleanText(row[targetField]) === '--') {
      row[targetField] = nextValue;
    }
    spellRowsByIndex.set(rowIndex, row);
  });

  for (const [field, value] of byField.entries()) {
    const cleanValue = cleanText(value);
    if (!cleanValue) continue;
    if (looksLikeObjectRefValue(cleanValue)) continue;
    const key = fieldKeyName(field);
    if (key.startsWith('featurestraits')) featureLines.push(cleanValue);
    if (
      /(feature|trait|ability|action|classfeature)/i.test(key) &&
      (extractFeatureChargeMax(cleanValue) != null || /\|\s*\d+\s*\//.test(cleanValue))
    ) {
      featureChargeHintLines.push(cleanValue);
    }
    if (key.startsWith('eqname')) {
      if (
        !['--', '-', '0'].includes(cleanValue) &&
        /[a-z]/i.test(cleanValue) &&
        !/^\d+(?:\.\d+)?(?:\s*(?:lb|lbs|gp|sp|cp|pp))?$/i.test(cleanValue)
      ) {
        equipmentLines.push(cleanValue);
      }
    }
    if (key.startsWith('attunedname') || key.startsWith('treasure')) {
      if (!['--', '-', '0'].includes(cleanValue) && /[a-z]/i.test(cleanValue)) {
        otherPossessionsLines.push(cleanValue);
      }
    }
    if (key.startsWith('spells')) spellLines.push(cleanValue);
    if (/^spellname/i.test(key)) spellLines.push(cleanValue);
    if (
      /(spell|source)/i.test(key) &&
      /\b(?:cantrips?|slots?|pact|[1-9](?:st|nd|rd|th)?\s+level)\b/i.test(cleanValue)
    ) {
      spellSlotHintLines.push(cleanValue);
    }
  }

  const normalizedSpellbookEntries = normalizeSpellbookEntries(
    Array.from(spellRowsByIndex.values())
      .sort((a, b) => (a.index || 0) - (b.index || 0))
      .map((row) => ({
        ...row,
        name: cleanText(row.name),
      }))
      .filter((row) => cleanText(row.name))
  );

  const weaponAttackCandidates = [];
  for (const [field, value] of byField.entries()) {
    const key = fieldKeyName(field);
    const match = key.match(/^wpn(\d+)atkbonus$/i);
    if (!match) continue;
    const parsedValue = toInt(value, null);
    if (parsedValue == null) continue;
    weaponAttackCandidates.push({ slot: toInt(match[1], 0), value: parsedValue });
  }
  weaponAttackCandidates.sort((a, b) => a.slot - b.slot);
  const attackModifier = weaponAttackCandidates.length > 0
    ? weaponAttackCandidates[0].value
    : toInt(findValue('AttackBonus', 'AtkBonus', 'AttackModifier', 'ToHitBonus'), null);

  const normalizedOtherPossessions = uniqueKeepOrder(otherPossessionsLines);
  const otherPossessionKeys = new Set(normalizedOtherPossessions.map((item) => normalizeKey(item)).filter(Boolean));
  const normalizedEquipment = uniqueKeepOrder(equipmentLines).filter((item) => !otherPossessionKeys.has(normalizeKey(item)));
  const normalizedSaves = uniqueKeepOrder(savingThrows);
  const normalizedSkills = uniqueKeepOrder(skills);
  const normalizedSenses = uniqueKeepOrder(senses);
  const normalizedSpellList = normalizedSpellbookEntries.length
    ? normalizeStringList(normalizedSpellbookEntries.map((entry) => entry.name))
    : sanitizeSpellEntries(spellLines);
  const normalizedSpellSlots = mergeSpellSlots(
    extractSpellSlotsFromLines(spellLines),
    extractSpellSlotsFromLines(spellSlotHintLines)
  );
  const normalizedFeatureCharges = mergeFeatureCharges(
    extractFeatureChargesFromLines(featureLines),
    extractFeatureChargesFromLines(featureChargeHintLines)
  );

  return {
    parsed: {
      name,
      race,
      className: classLevel.className || classRaw || '',
      level: classLevel.level,
      hpCurrent,
      hpMax,
      ac,
      initiativeBonus,
      speed,
      proficiencyBonus,
      spellSaveDC,
      attackModifier,
      spellAttackModifier,
      abilities,
      spellList: normalizedSpellList,
      spellbookEntries: normalizedSpellbookEntries,
      spellSlots: normalizedSpellSlots,
      savingThrows: normalizedSaves,
      skills: normalizedSkills,
      senses: normalizedSenses,
      abilitiesText: cleanText(featureLines.join('\n\n')),
      featureCharges: normalizedFeatureCharges,
      equipment: cleanText(normalizedEquipment.join(', ')),
      equipmentItems: normalizedEquipment,
      otherPossessions: normalizedOtherPossessions,
    },
    fieldCount: byField.size,
  };
}

function mergeParsedData(base, overlay) {
  const out = {
    ...base,
    ...overlay,
    abilities: { ...(base?.abilities || {}), ...(overlay?.abilities || {}) },
  };

  const keepOverlay = (key) => {
    const value = overlay?.[key];
    if (Array.isArray(value)) return value.length > 0;
    return value != null && value !== '';
  };

  const keys = [
    'name',
    'race',
    'className',
    'level',
    'hpCurrent',
    'hpMax',
    'ac',
    'initiativeBonus',
    'speed',
    'proficiencyBonus',
    'spellSaveDC',
    'attackModifier',
    'spellAttackModifier',
    'abilitiesText',
    'equipment',
  ];
  keys.forEach((key) => {
    out[key] = keepOverlay(key) ? overlay[key] : base[key];
  });
  const mergedSpellList = keepOverlay('spellList') ? overlay.spellList : (base?.spellList || []);
  out.spellbookEntries = mergeSpellbookEntries(base?.spellbookEntries, overlay?.spellbookEntries);
  if (!out.spellbookEntries.length) {
    out.spellbookEntries = buildSpellbookEntriesFromSpellList(mergedSpellList);
  }
  out.spellList = out.spellbookEntries.length
    ? normalizeStringList(out.spellbookEntries.map((entry) => entry.name))
    : normalizeStringList(mergedSpellList);
  out.spellSlots = mergeSpellSlots(base?.spellSlots, overlay?.spellSlots);
  out.featureCharges = mergeFeatureCharges(base?.featureCharges, overlay?.featureCharges);
  out.savingThrows = keepOverlay('savingThrows') ? overlay.savingThrows : (base?.savingThrows || []);
  out.skills = keepOverlay('skills') ? overlay.skills : (base?.skills || []);
  out.senses = keepOverlay('senses') ? overlay.senses : (base?.senses || []);
  out.equipmentItems = keepOverlay('equipmentItems') ? overlay.equipmentItems : (base?.equipmentItems || []);
  out.otherPossessions = keepOverlay('otherPossessions') ? overlay.otherPossessions : (base?.otherPossessions || []);

  ABILITY_KEYS.forEach((abilityKey) => {
    const fromOverlay = overlay?.abilities?.[abilityKey];
    const fromBase = base?.abilities?.[abilityKey];
    out.abilities[abilityKey] = fromOverlay != null ? fromOverlay : fromBase;
  });

  out.spellbookEntries = normalizeSpellbookEntries(out.spellbookEntries, out.spellList);
  out.spellList = normalizeStringList(out.spellList);
  out.savingThrows = normalizeStringList(out.savingThrows);
  out.skills = normalizeStringList(out.skills);
  out.senses = normalizeStringList(out.senses);
  out.equipmentItems = normalizeStringList(out.equipmentItems || out.equipment);
  out.otherPossessions = normalizeStringList(out.otherPossessions);
  if (!cleanText(out.equipment)) out.equipment = out.equipmentItems.join(', ');

  return out;
}

function uniqueKeepOrder(values) {
  const seen = new Set();
  const out = [];
  values.forEach((value) => {
    const key = normalizeKey(value);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(value);
  });
  return out;
}

function collectPdfStrings(text) {
  const out = [];
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(') {
      let depth = 1;
      let raw = '';
      for (i += 1; i < text.length; i += 1) {
        const cur = text[i];
        if (cur === '\\') {
          raw += cur;
          if (i + 1 < text.length) {
            raw += text[i + 1];
            i += 1;
          }
          continue;
        }
        if (cur === '(') {
          depth += 1;
          raw += cur;
          continue;
        }
        if (cur === ')') {
          depth -= 1;
          if (depth === 0) break;
          raw += cur;
          continue;
        }
        raw += cur;
      }
      const decoded = cleanText(decodePdfLiteral(raw));
      if (decoded) out.push(decoded);
      continue;
    }

    if (ch === '<' && text[i + 1] !== '<') {
      let raw = '';
      for (i += 1; i < text.length && text[i] !== '>'; i += 1) raw += text[i];
      const decoded = cleanText(decodePdfHex(raw));
      if (decoded) out.push(decoded);
    }
  }
  return out;
}

function filterReadablePdfText(values) {
  return values.filter((value) => {
    const text = cleanText(value);
    if (text.length < 2) return false;
    if (/^[-+0-9\s.,/()%]+$/.test(text)) return false;
    const printable = text.replace(/[ -~\n\r\t]/g, '').length;
    return printable / text.length < 0.15;
  });
}

async function extractPdfText(arrayBuffer, signal, onProgress) {
  const bytes = new Uint8Array(arrayBuffer);
  const binary = decodeLatin1(bytes);
  const extracted = [];
  let cursor = 0;
  let streamCount = 0;

  while (cursor < binary.length) {
    throwIfAborted(signal);
    const streamIdx = binary.indexOf('stream', cursor);
    if (streamIdx < 0) break;
    let dataStart = streamIdx + 6;
    if (binary[dataStart] === '\r' && binary[dataStart + 1] === '\n') dataStart += 2;
    else if (binary[dataStart] === '\n') dataStart += 1;
    else {
      cursor = dataStart;
      continue;
    }

    const endIdx = binary.indexOf('endstream', dataStart);
    if (endIdx < 0) break;

    const dictStart = binary.lastIndexOf('<<', streamIdx);
    const dictEnd = dictStart >= 0 ? binary.indexOf('>>', dictStart) : -1;
    const dict = dictStart >= 0 && dictEnd >= 0 && dictEnd < streamIdx
      ? binary.slice(dictStart, dictEnd + 2)
      : '';

    const rawSlice = binary.slice(dataStart, endIdx);
    let streamText = rawSlice;
    if (/\/FlateDecode\b/i.test(dict)) {
      const inflated = await inflatePdfStream(binaryStringToBytes(rawSlice));
      if (inflated) streamText = decodeLatin1(inflated);
    }

    const strings = collectPdfStrings(streamText);
    const readable = filterReadablePdfText(strings);
    if (readable.length) extracted.push(readable.join('\n'));
    streamCount += 1;
    if (streamCount % 8 === 0) await nextTick();
    emitProgress(onProgress, 30 + Math.min(48, streamCount), 'extracting-text');
    cursor = endIdx + 9;
  }

  let text = cleanText(extracted.join('\n'));
  if (!text) {
    const fallbackStrings = filterReadablePdfText(collectPdfStrings(binary));
    text = cleanText(fallbackStrings.join('\n'));
  }
  if (!text) {
    throw new Error('Could not extract readable text from this PDF.');
  }
  return text;
}

function buildValidation(parsed, unknownFields) {
  const missingFields = [];
  if (!parsed.name) missingFields.push('Name');
  if (!parsed.race) missingFields.push('Race');
  if (!parsed.className) missingFields.push('Class');
  if (parsed.level == null) missingFields.push('Level');
  if (parsed.hpCurrent == null) missingFields.push('HP (current)');
  if (parsed.hpMax == null) missingFields.push('HP (max)');
  if (parsed.ac == null) missingFields.push('Armor Class');
  if (parsed.initiativeBonus == null) missingFields.push('Initiative Bonus');
  if (parsed.speed == null) missingFields.push('Speed');
  ABILITY_KEYS.forEach((abilityKey) => {
    if (parsed.abilities?.[abilityKey] == null) {
      missingFields.push(abilityKey.toUpperCase());
    }
  });

  const warnings = [];
  if (!parsed.spellList?.length && !parsed.abilitiesText) {
    warnings.push('No spell list or abilities text was detected.');
  }
  const hasEquipment =
    !!cleanText(parsed.equipment) ||
    normalizeStringList(parsed.equipmentItems).length > 0 ||
    normalizeStringList(parsed.otherPossessions).length > 0;
  if (!hasEquipment) {
    warnings.push('No inventory/equipment summary was detected.');
  }
  if (!normalizeStringList(parsed.savingThrows).length) {
    warnings.push('No saving throws were detected.');
  }
  if (!normalizeStringList(parsed.skills).length) {
    warnings.push('No skills were detected.');
  }
  if (!normalizeStringList(parsed.senses).length) {
    warnings.push('No senses were detected.');
  }
  if (parsed.hpCurrent != null && parsed.hpMax != null && parsed.hpCurrent > parsed.hpMax) {
    warnings.push('Current HP is greater than max HP. Please verify values.');
  }
  if (unknownFields.length > 0) {
    warnings.push(`Unrecognized fields: ${unknownFields.join(', ')}`);
  }

  return {
    missingFields,
    unknownFields,
    warnings,
    hasIssues: missingFields.length > 0 || unknownFields.length > 0,
  };
}

export async function parseCharacterSheetFile(file, options = {}) {
  const { signal, onProgress } = options;
  if (!file) throw new Error('No file selected.');

  const extension = getFileExtension(file);
  emitProgress(onProgress, 5, 'validating');
  throwIfAborted(signal);

  if (!['json', 'txt', 'pdf'].includes(extension)) {
    throw new Error(
      `Unsupported format "${extension || 'unknown'}". Supported formats: .json, .txt, .pdf`
    );
  }

  emitProgress(onProgress, 18, 'reading');
  await nextTick();
  throwIfAborted(signal);

  emitProgress(onProgress, 45, 'parsing');
  let parsedResult;
  if (extension === 'json') {
    const text = await file.text();
    throwIfAborted(signal);
    if (!cleanText(text)) throw new Error('The selected file is empty.');
    parsedResult = parseJsonSheet(text);
  } else if (extension === 'pdf') {
    const data = await file.arrayBuffer();
    throwIfAborted(signal);
    if (!data || data.byteLength === 0) throw new Error('The selected PDF is empty.');
    emitProgress(onProgress, 30, 'extracting-text');
    const extractedText = await extractPdfText(data, signal, onProgress);
    emitProgress(onProgress, 76, 'parsing');
    const textParsed = await parseTextSheet(extractedText, signal, ({ progress = 76, stage = 'parsing' }) => {
      const mapped = 76 + ((progress - 45) / 35) * 12;
      emitProgress(onProgress, Number.isFinite(mapped) ? mapped : progress, stage);
    });
    emitProgress(onProgress, 82, 'parsing-form-fields');
    const formPairs = parsePdfFormFieldPairs(decodeLatin1(new Uint8Array(data)));
    const formParsed = mapPdfFormPairsToParsed(formPairs);
    parsedResult = {
      parsed: mergeParsedData(textParsed.parsed, formParsed.parsed),
      unknownFields: [],
    };
  } else {
    const text = await file.text();
    throwIfAborted(signal);
    if (!cleanText(text)) throw new Error('The selected file is empty.');
    parsedResult = await parseTextSheet(text, signal, onProgress);
  }

  emitProgress(onProgress, 88, 'validating');
  throwIfAborted(signal);
  const validation = buildValidation(parsedResult.parsed, parsedResult.unknownFields || []);

  emitProgress(onProgress, 100, 'complete');
  return {
    format: extension,
    sourceFileName: file.name || '',
    parsed: parsedResult.parsed,
    validation,
  };
}
