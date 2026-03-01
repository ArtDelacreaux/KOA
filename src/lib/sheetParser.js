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

  const abilitySource =
    findValueByAliases(root, ['attributes', 'abilityScores', 'ability_scores', 'stats', 'abilities']) ||
    null;
  const abilities = parseAbilities(abilitySource, root);

  const spellList = normalizeStringList(findValueByAliases(root, ['spells', 'spellList', 'spellbook']));
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
      'attributes',
      'abilityscores',
      'stats',
      'abilities',
      'spells',
      'spelllist',
      'spellbook',
      'spellslots',
      'spell_slots',
      'slotsbylevel',
      'spellslotlevels',
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
      abilities,
      spellList,
      spellSlots: mergeSpellSlots([], Array.isArray(spellSlots) ? spellSlots : []),
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
    abilities: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
    spellList: [],
    spellSlots: [],
    savingThrows: [],
    skills: [],
    senses: [],
    abilitiesText: '',
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
  }

  fields.spellList = sanitizeSpellEntries(sections.spells);
  fields.spellSlots = mergeSpellSlots(
    extractSpellSlotsFromLines(lines),
    extractSpellSlotsFromLines(sections.spells)
  );
  fields.savingThrows = normalizeStringList([...fields.savingThrows, ...sections.savingThrows]);
  fields.skills = normalizeStringList([...fields.skills, ...sections.skills]);
  fields.senses = normalizeStringList([...fields.senses, ...sections.senses]);
  fields.abilitiesText = cleanText(sections.abilities.join('\n'));
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
  const match = compact.match(/\b([0-9]{1,2})\s*slots?\b/i);
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

    const tail = binaryText.slice(field.nextIndex, Math.min(binaryText.length, field.nextIndex + 2200));
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
    byField.set(key, cleanText(pair.value));
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

  const abilities = {
    str: toInt(findValue('STR', 'STR3'), null),
    dex: toInt(findValue('DEX', 'DEX3'), null),
    con: toInt(findValue('CON', 'CON3'), null),
    int: toInt(findValue('INT', 'INT3'), null),
    wis: toInt(findValue('WIS', 'WIS3'), null),
    cha: toInt(findValue('CHA', 'CHA3', 'Cha'), null),
  };

  const featureLines = [];
  const equipmentLines = [];
  const otherPossessionsLines = [];
  const spellLines = [];
  const spellSlotHintLines = [];
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

  for (const [field, value] of byField.entries()) {
    const cleanValue = cleanText(value);
    if (!cleanValue) continue;
    if (looksLikeObjectRefValue(cleanValue)) continue;
    const key = fieldKeyName(field);
    if (key.startsWith('featurestraits')) featureLines.push(cleanValue);
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
      /\b(?:cantrips?|slots?|[1-9](?:st|nd|rd|th)?\s+level)\b/i.test(cleanValue)
    ) {
      spellSlotHintLines.push(cleanValue);
    }
  }

  const normalizedOtherPossessions = uniqueKeepOrder(otherPossessionsLines);
  const otherPossessionKeys = new Set(normalizedOtherPossessions.map((item) => normalizeKey(item)).filter(Boolean));
  const normalizedEquipment = uniqueKeepOrder(equipmentLines).filter((item) => !otherPossessionKeys.has(normalizeKey(item)));
  const normalizedSaves = uniqueKeepOrder(savingThrows);
  const normalizedSkills = uniqueKeepOrder(skills);
  const normalizedSenses = uniqueKeepOrder(senses);
  const normalizedSpellList = sanitizeSpellEntries(spellLines);
  const normalizedSpellSlots = mergeSpellSlots(
    extractSpellSlotsFromLines(spellLines),
    extractSpellSlotsFromLines(spellSlotHintLines)
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
      abilities,
      spellList: normalizedSpellList,
      spellSlots: normalizedSpellSlots,
      savingThrows: normalizedSaves,
      skills: normalizedSkills,
      senses: normalizedSenses,
      abilitiesText: cleanText(featureLines.join('\n\n')),
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
    'abilitiesText',
    'equipment',
  ];
  keys.forEach((key) => {
    out[key] = keepOverlay(key) ? overlay[key] : base[key];
  });
  out.spellList = keepOverlay('spellList') ? overlay.spellList : (base?.spellList || []);
  out.spellSlots = mergeSpellSlots(base?.spellSlots, overlay?.spellSlots);
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
