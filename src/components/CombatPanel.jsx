// ===== COMBAT PANEL — with Battle Background Selector =====
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ShellLayout from './ShellLayout';
import styles from './CombatPanel.module.css';
import { createId } from '../domain/ids';
import { repository } from '../repository';
import { STORAGE_KEYS } from '../lib/storageKeys';
import { parseCharacterSheetFile } from '../lib/sheetParser';

// ── Battle Backgrounds ────────────────────────────────────────────────────────
import battleback1  from '../assets/Backgrounds/battleback1.png';
import battleback2  from '../assets/Backgrounds/battleback2.png';
import battleback3  from '../assets/Backgrounds/battleback3.png';
import battleback4  from '../assets/Backgrounds/battleback4.png';
import battleback5  from '../assets/Backgrounds/battleback5.png';
import battleback6  from '../assets/Backgrounds/battleback6.png';
import battleback7  from '../assets/Backgrounds/battleback7.png';
import battleback8  from '../assets/Backgrounds/battleback8.png';
import battleback9  from '../assets/Backgrounds/battleback9.png';
import battleback10 from '../assets/Backgrounds/battleback10.png';

const BATTLE_BACKGROUNDS = [
  { label: 'Forest',          src: battleback1  },
  { label: 'Forest 2',        src: battleback6  },
  { label: 'Forest 3',        src: battleback7  },
  { label: 'Snow',            src: battleback2  },
  { label: 'Desert',          src: battleback3  },
  { label: 'Market',          src: battleback4  },
  { label: 'Rocky Cavern',    src: battleback5  },
  { label: 'Cave',            src: battleback8  },
  { label: 'Arena',           src: battleback9  },
  { label: 'Pasture',         src: battleback10 },
];

const LS_KEY = STORAGE_KEYS.combat;
const uid = () => createId('combat');
const toInt = (v, fb = 0) => { const n = parseInt(String(v ?? ''), 10); return Number.isFinite(n) ? n : fb; };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));


// ── SVG silhouettes (inline, no external deps) ────────────────────────────

// Generic adventurer silhouette – facing AWAY (back to viewer)
const HeroSVG = ({ color = '#a0c4ff', size = 100 }) => (
  <svg width={size} height={size * 1.6} viewBox="0 0 60 96" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* cape / cloak */}
    <ellipse cx="30" cy="68" rx="22" ry="28" fill={color} opacity="0.18"/>
    {/* body */}
    <rect x="18" y="38" width="24" height="30" rx="6" fill={color} opacity="0.55"/>
    {/* head (back of helmet) */}
    <circle cx="30" cy="30" r="11" fill={color} opacity="0.70"/>
    {/* helmet crest */}
    <ellipse cx="30" cy="19" rx="4" ry="7" fill={color} opacity="0.45"/>
    {/* left arm */}
    <rect x="8" y="40" width="10" height="22" rx="5" fill={color} opacity="0.50"/>
    {/* right arm / weapon */}
    <rect x="42" y="36" width="10" height="26" rx="5" fill={color} opacity="0.50"/>
    {/* weapon tip */}
    <polygon points="47,10 44,36 50,36" fill={color} opacity="0.70"/>
    {/* legs */}
    <rect x="18" y="66" width="10" height="22" rx="4" fill={color} opacity="0.55"/>
    <rect x="32" y="66" width="10" height="22" rx="4" fill={color} opacity="0.55"/>
  </svg>
);

// Goblin silhouette – facing TOWARD viewer (eyes visible)
const GoblinSVG = ({ size = 80 }) => (
  <svg width={size} height={size * 1.3} viewBox="0 0 60 78" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* body */}
    <ellipse cx="30" cy="52" rx="16" ry="18" fill="#3a5c2a" opacity="0.85"/>
    {/* head */}
    <ellipse cx="30" cy="26" rx="14" ry="16" fill="#4a7a30" opacity="0.90"/>
    {/* ears */}
    <ellipse cx="14" cy="22" rx="5" ry="8" fill="#3a6020" opacity="0.85" transform="rotate(-15 14 22)"/>
    <ellipse cx="46" cy="22" rx="5" ry="8" fill="#3a6020" opacity="0.85" transform="rotate(15 46 22)"/>
    {/* eyes - glowing red */}
    <ellipse cx="23" cy="24" rx="4" ry="5" fill="#cc2222" opacity="0.95"/>
    <ellipse cx="37" cy="24" rx="4" ry="5" fill="#cc2222" opacity="0.95"/>
    <ellipse cx="23" cy="24" rx="2" ry="2.5" fill="#ff4444"/>
    <ellipse cx="37" cy="24" rx="2" ry="2.5" fill="#ff4444"/>
    {/* nose */}
    <ellipse cx="30" cy="31" rx="3" ry="2" fill="#2a4a18" opacity="0.80"/>
    {/* mouth / fangs */}
    <path d="M22 36 Q30 42 38 36" stroke="#1a3010" strokeWidth="1.5" fill="none" opacity="0.80"/>
    <rect x="26" y="36" width="3" height="5" rx="1" fill="#e8e8d0" opacity="0.90"/>
    <rect x="31" y="36" width="3" height="5" rx="1" fill="#e8e8d0" opacity="0.90"/>
    {/* arms */}
    <ellipse cx="10" cy="56" rx="6" ry="14" fill="#3a5c2a" opacity="0.80" transform="rotate(15 10 56)"/>
    <ellipse cx="50" cy="56" rx="6" ry="14" fill="#3a5c2a" opacity="0.80" transform="rotate(-15 50 56)"/>
    {/* claws */}
    <line x1="4"  y1="68" x2="1"  y2="74" stroke="#2a4a1a" strokeWidth="2" strokeLinecap="round"/>
    <line x1="8"  y1="69" x2="6"  y2="75" stroke="#2a4a1a" strokeWidth="2" strokeLinecap="round"/>
    <line x1="12" y1="69" x2="11" y2="75" stroke="#2a4a1a" strokeWidth="2" strokeLinecap="round"/>
    <line x1="48" y1="68" x2="51" y2="74" stroke="#2a4a1a" strokeWidth="2" strokeLinecap="round"/>
    <line x1="52" y1="69" x2="54" y2="75" stroke="#2a4a1a" strokeWidth="2" strokeLinecap="round"/>
    <line x1="56" y1="68" x2="59" y2="74" stroke="#2a4a1a" strokeWidth="2" strokeLinecap="round"/>
    {/* legs */}
    <ellipse cx="22" cy="70" rx="7" ry="10" fill="#3a5c2a" opacity="0.80"/>
    <ellipse cx="38" cy="70" rx="7" ry="10" fill="#3a5c2a" opacity="0.80"/>
  </svg>
);

// Skeleton silhouette – facing viewer
const SkeletonSVG = ({ size = 80 }) => (
  <svg width={size} height={size * 1.4} viewBox="0 0 60 84" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* skull */}
    <ellipse cx="30" cy="18" rx="12" ry="13" fill="#d4c9a8" opacity="0.90"/>
    {/* eye sockets */}
    <ellipse cx="24" cy="16" rx="4" ry="5" fill="#1a1a1a" opacity="0.95"/>
    <ellipse cx="36" cy="16" rx="4" ry="5" fill="#1a1a1a" opacity="0.95"/>
    {/* nasal cavity */}
    <path d="M28 23 L30 28 L32 23" fill="#1a1a1a" opacity="0.80"/>
    {/* teeth */}
    <rect x="23" y="28" width="3" height="4" rx="1" fill="#c8bc95" opacity="0.90"/>
    <rect x="28" y="28" width="3" height="4" rx="1" fill="#c8bc95" opacity="0.90"/>
    <rect x="33" y="28" width="3" height="4" rx="1" fill="#c8bc95" opacity="0.90"/>
    {/* spine/ribcage */}
    <rect x="27" y="32" width="6" height="20" rx="2" fill="#c8bc95" opacity="0.75"/>
    <ellipse cx="30" cy="38" rx="13" ry="7" fill="none" stroke="#c8bc95" strokeWidth="2" opacity="0.65"/>
    <ellipse cx="30" cy="43" rx="11" ry="6" fill="none" stroke="#c8bc95" strokeWidth="1.5" opacity="0.55"/>
    <ellipse cx="30" cy="48" rx="9"  ry="5" fill="none" stroke="#c8bc95" strokeWidth="1.5" opacity="0.50"/>
    {/* arms + weapon */}
    <line x1="17" y1="34" x2="6"  y2="56" stroke="#c8bc95" strokeWidth="3" strokeLinecap="round" opacity="0.80"/>
    <line x1="43" y1="34" x2="54" y2="36" stroke="#c8bc95" strokeWidth="3" strokeLinecap="round" opacity="0.80"/>
    {/* sword in right hand */}
    <rect x="52" y="14" width="4" height="28" rx="1" fill="#8899aa" opacity="0.90"/>
    <rect x="48" y="36" width="12" height="3" rx="1" fill="#6a7a88" opacity="0.90"/>
    {/* pelvis */}
    <ellipse cx="30" cy="54" rx="10" ry="5" fill="#c8bc95" opacity="0.65"/>
    {/* legs */}
    <line x1="23" y1="58" x2="20" y2="76" stroke="#c8bc95" strokeWidth="4" strokeLinecap="round" opacity="0.80"/>
    <line x1="37" y1="58" x2="40" y2="76" stroke="#c8bc95" strokeWidth="4" strokeLinecap="round" opacity="0.80"/>
    {/* feet */}
    <ellipse cx="18" cy="78" rx="6" ry="3" fill="#c8bc95" opacity="0.70"/>
    <ellipse cx="42" cy="78" rx="6" ry="3" fill="#c8bc95" opacity="0.70"/>
  </svg>
);

// Orc silhouette
const OrcSVG = ({ size = 90 }) => (
  <svg width={size} height={size * 1.4} viewBox="0 0 70 98" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* body */}
    <ellipse cx="35" cy="65" rx="22" ry="25" fill="#4a7240" opacity="0.90"/>
    {/* armor plate */}
    <ellipse cx="35" cy="60" rx="18" ry="16" fill="#3a3a3a" opacity="0.65"/>
    {/* head */}
    <ellipse cx="35" cy="30" rx="16" ry="17" fill="#5a8848" opacity="0.90"/>
    {/* brow ridge */}
    <ellipse cx="35" cy="22" rx="14" ry="5" fill="#3a6030" opacity="0.80"/>
    {/* eyes */}
    <ellipse cx="27" cy="27" rx="4" ry="4" fill="#e04020" opacity="0.95"/>
    <ellipse cx="43" cy="27" rx="4" ry="4" fill="#e04020" opacity="0.95"/>
    <ellipse cx="27" cy="27" rx="2" ry="2" fill="#ff6040"/>
    <ellipse cx="43" cy="27" rx="2" ry="2" fill="#ff6040"/>
    {/* tusks */}
    <rect x="29" y="38" width="4" height="9" rx="2" fill="#e8e4c0" opacity="0.90"/>
    <rect x="37" y="38" width="4" height="9" rx="2" fill="#e8e4c0" opacity="0.90"/>
    {/* arms */}
    <ellipse cx="9"  cy="66" rx="8" ry="18" fill="#4a7240" opacity="0.85" transform="rotate(10 9 66)"/>
    <ellipse cx="61" cy="66" rx="8" ry="18" fill="#4a7240" opacity="0.85" transform="rotate(-10 61 66)"/>
    {/* axe */}
    <rect x="58" y="28" width="5" height="36" rx="2" fill="#6a5a40" opacity="0.90"/>
    <ellipse cx="65" cy="30" rx="8" ry="14" fill="#888888" opacity="0.90"/>
    {/* legs */}
    <ellipse cx="24" cy="88" rx="9" ry="13" fill="#3a5c2a" opacity="0.85"/>
    <ellipse cx="46" cy="88" rx="9" ry="13" fill="#3a5c2a" opacity="0.85"/>
  </svg>
);

// Wolf/beast
const WolfSVG = ({ size = 80 }) => (
  <svg width={size * 1.4} height={size} viewBox="0 0 112 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* body */}
    <ellipse cx="60" cy="52" rx="36" ry="20" fill="#5a5060" opacity="0.90"/>
    {/* head */}
    <ellipse cx="22" cy="36" rx="16" ry="14" fill="#6a6070" opacity="0.90"/>
    {/* snout */}
    <ellipse cx="10" cy="42" rx="10" ry="8" fill="#5a5060" opacity="0.85"/>
    {/* ears */}
    <polygon points="14,22 8,6 22,18" fill="#5a5060" opacity="0.90"/>
    <polygon points="28,18 26,4 36,14" fill="#5a5060" opacity="0.90"/>
    {/* eyes */}
    <ellipse cx="16" cy="32" rx="4" ry="3" fill="#ddaa00" opacity="0.95"/>
    <ellipse cx="28" cy="30" rx="3" ry="3" fill="#ddaa00" opacity="0.95"/>
    <ellipse cx="16" cy="32" rx="2" ry="1.5" fill="#ffcc00"/>
    <ellipse cx="28" cy="30" rx="1.5" ry="1.5" fill="#ffcc00"/>
    {/* teeth */}
    <polygon points="4,44 7,52 10,44"  fill="#e8e8e0" opacity="0.90"/>
    <polygon points="10,46 13,54 16,46" fill="#e8e8e0" opacity="0.90"/>
    {/* legs */}
    <rect x="38" y="64" width="8" height="16" rx="4" fill="#4a4050" opacity="0.85"/>
    <rect x="52" y="64" width="8" height="16" rx="4" fill="#4a4050" opacity="0.85"/>
    <rect x="68" y="64" width="8" height="16" rx="4" fill="#4a4050" opacity="0.85"/>
    <rect x="82" y="64" width="8" height="16" rx="4" fill="#4a4050" opacity="0.85"/>
    {/* tail */}
    <path d="M96 50 Q110 30 104 18" stroke="#5a5060" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.85"/>
  </svg>
);

const ENEMY_TYPES = [
  { key: 'goblin',   label: 'Goblin',   Render: GoblinSVG },
  { key: 'skeleton', label: 'Skeleton', Render: SkeletonSVG },
  { key: 'orc',      label: 'Orc',      Render: OrcSVG },
  { key: 'wolf',     label: 'Wolf',     Render: WolfSVG },
];

const PC_COLORS = ['#a0c4ff','#c0a8ff','#ffd6a0','#a0ffcc','#ffb3b3','#ffe4a0','#b3e0ff'];
const SPELL_SLOT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const SPELLBOOK_LEVELS = [0, ...SPELL_SLOT_LEVELS];
const TOKEN_IMAGE_BY_ID = {
  arlis: '/Token/arlis.png',
  castor: '/Token/castor.png',
  cerci: '/Token/cerci.png',
  fen: '/Token/fen.png',
  jasper: '/Token/jasper.png',
  thryvaris: '/Token/thryvaris.png',
  vonghul: '/Token/vonghul.png',
  william: '/Token/will.png',
};
const TOKEN_IMAGE_BY_NAME_KEY = {
  arlisghoth: '/Token/arlis.png',
  castor: '/Token/castor.png',
  cercivondonovon: '/Token/cerci.png',
  fen: '/Token/fen.png',
  jasperdelancey: '/Token/jasper.png',
  thryvarisbria: '/Token/thryvaris.png',
  vonghul: '/Token/vonghul.png',
  williamspicer: '/Token/will.png',
};

const ABILITY_META = [
  { key: 'str', short: 'STR', label: 'Strength' },
  { key: 'dex', short: 'DEX', label: 'Dexterity' },
  { key: 'con', short: 'CON', label: 'Constitution' },
  { key: 'int', short: 'INT', label: 'Intelligence' },
  { key: 'wis', short: 'WIS', label: 'Wisdom' },
  { key: 'cha', short: 'CHA', label: 'Charisma' },
];

const ABILITY_SHORT_BY_WORD = {
  str: 'STR',
  strength: 'STR',
  dex: 'DEX',
  dexterity: 'DEX',
  con: 'CON',
  constitution: 'CON',
  int: 'INT',
  intelligence: 'INT',
  wis: 'WIS',
  wisdom: 'WIS',
  cha: 'CHA',
  charisma: 'CHA',
};

const SKILL_TO_ABILITY = {
  acrobatics: 'DEX',
  'animal handling': 'WIS',
  arcana: 'INT',
  athletics: 'STR',
  deception: 'CHA',
  history: 'INT',
  insight: 'WIS',
  intimidation: 'CHA',
  investigation: 'INT',
  medicine: 'WIS',
  nature: 'INT',
  perception: 'WIS',
  performance: 'CHA',
  persuasion: 'CHA',
  religion: 'INT',
  'sleight of hand': 'DEX',
  stealth: 'DEX',
  survival: 'WIS',
};

function tokenKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function tokenImageForCharacter(id, name) {
  const fromId = TOKEN_IMAGE_BY_ID[tokenKey(id)];
  if (fromId) return fromId;
  return TOKEN_IMAGE_BY_NAME_KEY[tokenKey(name)] || '';
}

function castorWilliamSyncRole(combatant) {
  const sourceKey = tokenKey(combatant?.sourceCharacterId);
  if (sourceKey === 'castor') return 'castor';
  if (sourceKey === 'william' || sourceKey === 'williamspicer') return 'william';
  const nameKey = tokenKey(combatant?.name);
  if (nameKey === 'castor') return 'castor';
  if (nameKey === 'william' || nameKey === 'williamspicer') return 'william';
  return null;
}

function findCastorWilliamPair(combatants) {
  let castor = null;
  let william = null;
  (Array.isArray(combatants) ? combatants : []).forEach((combatant) => {
    const role = castorWilliamSyncRole(combatant);
    if (role === 'castor' && !castor) castor = combatant;
    if (role === 'william' && !william) william = combatant;
  });
  return { castor, william };
}

function resourceSyncPatchFromCombatant(combatant) {
  return {
    hp: combatant?.hp ?? '',
    maxHP: combatant?.maxHP ?? '',
    spellSlots: normalizeSpellSlots(combatant?.spellSlots),
    featureCharges: normalizeFeatureCharges(combatant?.featureCharges),
  };
}

function pickCastorWilliamResourcePatch(patch) {
  if (!patch || typeof patch !== 'object') return null;
  const out = {};
  if (Object.prototype.hasOwnProperty.call(patch, 'hp')) out.hp = patch.hp;
  if (Object.prototype.hasOwnProperty.call(patch, 'maxHP')) out.maxHP = patch.maxHP;
  if (Object.prototype.hasOwnProperty.call(patch, 'spellSlots')) out.spellSlots = normalizeSpellSlots(patch.spellSlots);
  if (Object.prototype.hasOwnProperty.call(patch, 'featureCharges')) out.featureCharges = normalizeFeatureCharges(patch.featureCharges);
  return Object.keys(out).length ? out : null;
}

function cloneCastorWilliamResourcePatch(patch) {
  if (!patch || typeof patch !== 'object') return {};
  const out = {};
  if (Object.prototype.hasOwnProperty.call(patch, 'hp')) out.hp = patch.hp;
  if (Object.prototype.hasOwnProperty.call(patch, 'maxHP')) out.maxHP = patch.maxHP;
  if (Object.prototype.hasOwnProperty.call(patch, 'spellSlots')) {
    out.spellSlots = normalizeSpellSlots(patch.spellSlots).map((slot) => ({ ...slot }));
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'featureCharges')) {
    out.featureCharges = normalizeFeatureCharges(patch.featureCharges).map((feature) => ({ ...feature }));
  }
  return out;
}

function copyHeadStyles(sourceDoc, targetDoc) {
  if (!sourceDoc || !targetDoc) return;
  const styleNodes = sourceDoc.querySelectorAll('link[rel="stylesheet"], style');
  styleNodes.forEach((node) => {
    targetDoc.head.appendChild(node.cloneNode(true));
  });
}

function defaultSpellSlots() {
  return SPELL_SLOT_LEVELS.map((level) => ({ level, max: 0, current: 0 }));
}

function normalizeSpellSlots(raw) {
  const byLevel = new Map();
  if (Array.isArray(raw)) {
    raw.forEach((slot, i) => {
      const level = toInt(slot?.level, i + 1);
      if (level >= 1 && level <= 9) byLevel.set(level, slot || {});
    });
  } else if (raw && typeof raw === 'object') {
    Object.entries(raw).forEach(([levelKey, slot]) => {
      const level = toInt(levelKey, 0);
      if (level >= 1 && level <= 9) byLevel.set(level, slot || {});
    });
  }

  return defaultSpellSlots().map((slot) => {
    const src = byLevel.get(slot.level);
    if (!src) return slot;
    const max = Math.max(0, toInt(src.max ?? src.total, 0));
    const fallbackCurrent = src.current ?? src.remaining ?? max;
    const current = clamp(toInt(fallbackCurrent, max), 0, max);
    return { level: slot.level, max, current };
  });
}

function normalizeFeatureCharges(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry, index) => {
    const fallbackName = `Feature ${index + 1}`;
    const source = entry && typeof entry === 'object' ? entry : {};
    const id = cleanText(source.id) || `feature-${index + 1}`;
    const hasCustomName = Object.prototype.hasOwnProperty.call(source, 'name') || Object.prototype.hasOwnProperty.call(source, 'label');
    const name = hasCustomName ? String(source.name ?? source.label ?? '') : fallbackName;
    const max = clamp(toInt(source.max ?? source.charges, 0), 0, 20);
    const fallbackCurrent = source.current ?? source.remaining ?? max;
    const current = clamp(toInt(fallbackCurrent, max), 0, max);
    return { id, name, max, current };
  });
}

function normalizeSpellLevel(raw, fallback = null) {
  if (raw == null || raw === '') return fallback;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.trunc(raw);
    return n >= 0 && n <= 9 ? n : fallback;
  }
  const text = String(raw).trim().toLowerCase();
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

function normalizeSpellPrepared(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'boolean') return raw ? 'P' : '';
  const text = String(raw).trim().toUpperCase();
  if (!text) return '';
  if (['TRUE', 'YES', 'Y', '1'].includes(text)) return 'P';
  if (['FALSE', 'NO', 'N', '0'].includes(text)) return '';
  if (text === 'AP') return 'A';
  return text.length === 1 ? text : text.slice(0, 10);
}

function spellEntryId(entry, index) {
  const explicit = cleanText(entry?.id);
  if (explicit) return explicit;
  const nameKey = tokenKey(entry?.name);
  return `spell-${index + 1}-${nameKey || 'entry'}`;
}

const SPELL_UNASSIGNED_NOISE_WORDS = new Set([
  'a',
  'an',
  'and',
  'arcana',
  'are',
  'as',
  'at',
  'attack',
  'attacks',
  'bonus',
  'can',
  'check',
  'class',
  'cleric',
  'con',
  'dc',
  'dex',
  'from',
  'have',
  'if',
  'in',
  'int',
  'is',
  'it',
  'level',
  'levels',
  'list',
  'modifier',
  'of',
  'or',
  'paladin',
  'proficiency',
  'save',
  'saving',
  'spell',
  'spells',
  'slot',
  'slots',
  'str',
  'the',
  'their',
  'them',
  'this',
  'to',
  'use',
  'warlock',
  'when',
  'while',
  'with',
  'wis',
  'you',
  'your',
]);

function isBareSpellbookEntry(entry) {
  if (!entry || typeof entry !== 'object') return true;
  return [
    'source',
    'saveAtk',
    'effect',
    'time',
    'range',
    'components',
    'duration',
    'prepared',
    'notes',
  ].every((key) => cleanText(entry[key]) === '');
}

function isLikelyUnassignedSpellNoiseName(name) {
  const compact = cleanText(name).replace(/\s+/g, ' ').trim();
  if (!compact) return true;
  const words = compact.split(' ').filter(Boolean);
  if (words.length === 1) return SPELL_UNASSIGNED_NOISE_WORDS.has(tokenKey(words[0]));
  if (words.length >= 6) {
    return /\b(?:you|your|from|when|while|until|within|spell|spells|list|ability|modifier|attack|save|saving|throw|bonus|proficiency)\b/i.test(compact);
  }
  return /[.!?]$/.test(compact);
}

function stripLikelySpellbookNoise(entries) {
  const list = Array.isArray(entries) ? entries.filter(Boolean) : [];
  if (!list.length) return [];

  const bareUnassigned = list.filter((entry) => normalizeSpellLevel(entry?.level, null) == null && isBareSpellbookEntry(entry));
  const shouldDropAllBareUnassigned = list.length >= 80 && (bareUnassigned.length / list.length) >= 0.9;
  if (shouldDropAllBareUnassigned) {
    return list.filter((entry) => !(normalizeSpellLevel(entry?.level, null) == null && isBareSpellbookEntry(entry)));
  }

  return list.filter((entry) => {
    if (normalizeSpellLevel(entry?.level, null) != null) return true;
    if (!isBareSpellbookEntry(entry)) return true;
    return !isLikelyUnassignedSpellNoiseName(entry?.name);
  });
}

function normalizeSpellbookEntries(raw, fallbackSpellList = []) {
  const list = Array.isArray(raw) ? raw : [];
  const normalized = list
    .map((entry, index) => {
      if (entry == null) return null;
      if (typeof entry === 'string') {
        const name = cleanText(entry);
        if (!name) return null;
        return {
          id: spellEntryId({ name }, index),
          name,
          level: null,
          source: '',
          saveAtk: '',
          effect: '',
          time: '',
          range: '',
          components: '',
          duration: '',
          prepared: '',
          notes: '',
        };
      }
      if (!entry || typeof entry !== 'object') return null;
      const name = cleanText(entry.name ?? entry.spell ?? entry.title ?? entry.label);
      if (!name) return null;
      return {
        id: spellEntryId(entry, index),
        name,
        level: normalizeSpellLevel(
          entry.level ?? entry.spellLevel ?? entry.levelIndex ?? entry.circle ?? entry.slotLevel,
          null
        ),
        source: cleanText(entry.source ?? entry.origin ?? entry.class),
        saveAtk: cleanText(
          entry.saveAtk ??
          entry.saveAttack ??
          entry.save ??
          entry.attack ??
          entry.atk ??
          entry.saveHit ??
          entry.saveOrHit
        ),
        effect: cleanText(entry.effect ?? entry.summary ?? ''),
        time: cleanText(entry.time ?? entry.castingTime ?? entry.castTime),
        range: cleanText(entry.range ?? entry.distance),
        components: cleanText(entry.components ?? entry.comp),
        duration: cleanText(entry.duration),
        prepared: normalizeSpellPrepared(entry.prepared ?? entry.prep),
        notes: cleanText(entry.notes ?? entry.description),
      };
    })
    .filter(Boolean);

  const filteredNormalized = stripLikelySpellbookNoise(normalized);
  if (filteredNormalized.length) return filteredNormalized;

  const fallbackEntries = normalizeStringList(fallbackSpellList).map((name, index) => ({
    id: spellEntryId({ name }, index),
    name,
    level: null,
    source: '',
    saveAtk: '',
    effect: '',
    time: '',
    range: '',
    components: '',
    duration: '',
    prepared: '',
    notes: '',
  }));
  return stripLikelySpellbookNoise(fallbackEntries);
}

function groupedSpellbookEntries(entries) {
  const byLevel = new Map(SPELLBOOK_LEVELS.map((level) => [level, []]));
  const unassigned = [];
  normalizeSpellbookEntries(entries).forEach((entry) => {
    const level = normalizeSpellLevel(entry.level, null);
    if (level == null || !byLevel.has(level)) {
      unassigned.push(entry);
      return;
    }
    byLevel.get(level).push(entry);
  });

  const groups = SPELLBOOK_LEVELS
    .map((level) => ({
      key: `level-${level}`,
      level,
      label: level === 0 ? 'Cantrips' : `${spellLevelLabel(level)} Level`,
      entries: byLevel.get(level),
    }))
    .filter((group) => group.entries.length > 0);

  if (unassigned.length > 0) {
    groups.push({
      key: 'level-unassigned',
      level: null,
      label: 'Unassigned',
      entries: unassigned,
    });
  }

  return groups;
}

function spellLevelLabel(level) {
  const n = clamp(toInt(level, 1), 1, 9);
  if (n === 1) return '1ST';
  if (n === 2) return '2ND';
  if (n === 3) return '3RD';
  return `${n}TH`;
}

function parseStatusText(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeStringList(raw) {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item || '').trim()).filter(Boolean);
  }
  const text = String(raw || '').trim();
  if (!text) return [];
  return text
    .split(/[\r\n,;]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanText(value) {
  return String(value ?? '').trim();
}

function defaultAbilities() {
  return { str: null, dex: null, con: null, int: null, wis: null, cha: null };
}

function normalizeAbilities(raw) {
  const out = defaultAbilities();
  if (!raw || typeof raw !== 'object') return out;
  ABILITY_META.forEach(({ key }) => {
    const value = raw[key];
    if (value == null || value === '') {
      out[key] = null;
      return;
    }
    const parsed = toInt(value, null);
    out[key] = parsed == null ? null : parsed;
  });
  return out;
}

function formatSigned(value, empty = '—') {
  if (value == null || value === '') return empty;
  const n = toInt(value, null);
  if (n == null) return empty;
  return n >= 0 ? `+${n}` : `${n}`;
}

function abilityModifier(score) {
  if (score == null || score === '') return null;
  return Math.floor((toInt(score, 10) - 10) / 2);
}

function proficiencyBonusFromLevel(level) {
  const n = toInt(level, 0);
  if (!n || n < 1) return 0;
  const clamped = clamp(n, 1, 20);
  return 2 + Math.floor((clamped - 1) / 4);
}

function abilityKeyFromShort(short) {
  const match = ABILITY_META.find((meta) => meta.short === short);
  return match ? match.key : '';
}

function inferProficiencyTier(totalBonus, baseBonus, proficiencyBonus, allowExpertise = true) {
  if (totalBonus == null || baseBonus == null) return 0;
  const delta = toInt(totalBonus, 0) - toInt(baseBonus, 0);
  if (delta <= 0) return 0;
  if (proficiencyBonus > 0) {
    if (allowExpertise && delta >= (proficiencyBonus * 2) - 1) return 2;
    if (delta >= Math.max(1, proficiencyBonus - 1)) return 1;
    return 0;
  }
  return 1;
}

function extractBonusValue(text) {
  const source = String(text || '');
  const signedMatch = source.match(/[-+]\s*\d+/);
  if (signedMatch) {
    return toInt(signedMatch[0].replace(/\s+/g, ''), null);
  }
  const unsignedMatch = source.match(/\b\d+\b/);
  if (unsignedMatch) return toInt(unsignedMatch[0], null);
  return null;
}

function inferAbilityShort(text, fallback = '') {
  const lowered = String(text || '').toLowerCase();
  if (!lowered) return fallback;
  const keys = Object.keys(ABILITY_SHORT_BY_WORD);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const pattern = new RegExp(`\\b${key}\\b`, 'i');
    if (pattern.test(lowered)) return ABILITY_SHORT_BY_WORD[key];
  }
  return fallback;
}

function normalizeFeatureList(raw) {
  if (Array.isArray(raw)) return normalizeStringList(raw);
  const text = cleanText(raw);
  if (!text) return [];
  if (text.includes('\n')) return normalizeStringList(text.split(/\r?\n/g));
  return normalizeStringList(text.split(/[;]+/g));
}

function parseFeatureSections(rawFeatures) {
  const lines = normalizeStringList(rawFeatures);
  const groups = [];
  const headingPattern = /^={2,}\s*(.+?)\s*={2,}$/;
  let activeGroup = { title: 'Features', entries: [] };

  lines.forEach((line) => {
    const match = line.match(headingPattern);
    if (match) {
      if (activeGroup.entries.length > 0) groups.push(activeGroup);
      activeGroup = { title: cleanText(match[1]) || 'Features', entries: [] };
      return;
    }
    activeGroup.entries.push(line);
  });

  if (activeGroup.entries.length > 0) groups.push(activeGroup);
  if (!groups.length && lines.length) groups.push({ title: 'Features', entries: lines });
  return groups;
}

function normalizeSavingThrowRows(rawSavingThrows, abilityScores, level) {
  const fallbackByAbility = {};
  ABILITY_META.forEach(({ key, short }) => {
    fallbackByAbility[short] = abilityModifier(abilityScores?.[key]);
  });
  const proficiencyBonus = proficiencyBonusFromLevel(level);

  const parsedByAbility = {};
  normalizeStringList(rawSavingThrows).forEach((line) => {
    const ability = inferAbilityShort(line, '');
    if (!ability) return;
    const value = extractBonusValue(line);
    if (value == null) return;
    parsedByAbility[ability] = value;
  });

  return ABILITY_META.map(({ short }) => ({
    tag: short,
    value: parsedByAbility[short] ?? fallbackByAbility[short],
    proficiencyTier: inferProficiencyTier(
      parsedByAbility[short] ?? fallbackByAbility[short],
      fallbackByAbility[short],
      proficiencyBonus,
      false
    ),
  }));
}

function normalizeSkillRows(rawSkills, abilityScores, level) {
  const rows = [];
  const proficiencyBonus = proficiencyBonusFromLevel(level);
  normalizeStringList(rawSkills).forEach((line, index) => {
    if (!/[a-z]/i.test(line)) return;
    const compact = line.replace(/\s+/g, ' ').trim();
    if (!compact) return;

    const bonus = extractBonusValue(compact);
    const abilityInParens = compact.match(/\(([A-Za-z]{3,})\)/);
    let ability = inferAbilityShort(abilityInParens ? abilityInParens[1] : compact, '');

    let skillName = '';
    const lowered = compact.toLowerCase();
    const knownNames = Object.keys(SKILL_TO_ABILITY);
    for (let i = 0; i < knownNames.length; i += 1) {
      const known = knownNames[i];
      if (lowered.includes(known)) {
        skillName = known
          .split(' ')
          .map((token) => token[0].toUpperCase() + token.slice(1))
          .join(' ');
        if (!ability) ability = SKILL_TO_ABILITY[known];
        break;
      }
    }

    if (!skillName) {
      skillName = compact
        .replace(/\([^)]*\)/g, '')
        .replace(/[-+]\s*\d+/g, '')
        .replace(/\b(?:str|dex|con|int|wis|cha)\b/gi, '')
        .replace(/\b(?:strength|dexterity|constitution|intelligence|wisdom|charisma)\b/gi, '')
        .replace(/[,:]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    if (!skillName || !/[a-z]/i.test(skillName)) return;

    if (!ability) {
      const fallbackAbility = Object.entries(SKILL_TO_ABILITY).find(([name]) => name === skillName.toLowerCase());
      ability = fallbackAbility?.[1] || '';
    }

    const abilityKey = abilityKeyFromShort(ability);
    const baseBonus = abilityKey ? abilityModifier(abilityScores?.[abilityKey]) : null;
    let resolvedBonus = bonus;
    if (resolvedBonus == null && ability) {
      const meta = ABILITY_META.find((item) => item.short === ability);
      resolvedBonus = meta ? abilityModifier(abilityScores?.[meta.key]) : null;
    }

    rows.push({
      id: `${skillName}-${index}`,
      skill: skillName,
      ability: ability || '—',
      bonus: resolvedBonus,
      proficiencyTier: inferProficiencyTier(resolvedBonus, baseBonus, proficiencyBonus, true),
    });
  });
  return rows;
}

function normalizeSenseRows(rawSenses) {
  return normalizeStringList(rawSenses)
    .filter((line) => /[a-z]/i.test(line))
    .map((line, index) => {
      const compact = line.replace(/\s+/g, ' ').trim();
      const trailingValue = compact.match(/(-?\d+)\s*$/);
      if (trailingValue) {
        const value = toInt(trailingValue[1], null);
        const label = compact.slice(0, trailingValue.index).trim() || compact;
        return { id: `${label}-${index}`, label, value };
      }
      return { id: `${compact}-${index}`, label: compact, value: null };
    });
}

function buildSheetPatch(combatant, parsedResult) {
  const parsed = parsedResult?.parsed || {};
  const mergedAbilities = normalizeAbilities(parsed.abilities || combatant.abilities);
  const className = cleanText(parsed.className || combatant.className || combatant.role);
  const level = parsed.level == null ? combatant.level : toInt(parsed.level, '');
  const hpMax =
    parsed.hpMax == null
      ? combatant.maxHP
      : Math.max(0, toInt(parsed.hpMax, combatant.maxHP === '' ? 0 : combatant.maxHP || 0));
  const hpCurrentRaw =
    parsed.hpCurrent == null
      ? combatant.hp
      : Math.max(0, toInt(parsed.hpCurrent, combatant.hp === '' ? 0 : combatant.hp || 0));
  const hpCurrent = hpMax === '' ? hpCurrentRaw : Math.min(hpCurrentRaw, hpMax);
  const initiativeBonus =
    parsed.initiativeBonus == null ? toInt(combatant.initiativeBonus, 0) : toInt(parsed.initiativeBonus, 0);
  const proficiencyBonus =
    parsed.proficiencyBonus == null ? toInt(combatant.proficiencyBonus, null) : toInt(parsed.proficiencyBonus, null);
  const spellSaveDC =
    parsed.spellSaveDC == null ? toInt(combatant.spellSaveDC, null) : toInt(parsed.spellSaveDC, null);
  const attackModifier =
    parsed.attackModifier == null ? toInt(combatant.attackModifier, null) : toInt(parsed.attackModifier, null);
  const spellAttackModifier =
    parsed.spellAttackModifier == null ? toInt(combatant.spellAttackModifier, null) : toInt(parsed.spellAttackModifier, null);
  const importedSpellSlots = normalizeSpellSlots(parsed.spellSlots);
  const hasImportedSpellSlots = importedSpellSlots.some((slot) => slot.max > 0);
  const importedFeatureCharges = normalizeFeatureCharges(parsed.featureCharges);
  const hasParsedFeatureCharges = Array.isArray(parsed.featureCharges);
  const normalizedSpellbookEntries = normalizeSpellbookEntries(parsed.spellbookEntries, parsed.spellList);
  const normalizedSpellList = normalizeStringList(normalizedSpellbookEntries.map((entry) => entry.name));

  return {
    name: cleanText(parsed.name) || combatant.name,
    race: cleanText(parsed.race) || cleanText(combatant.race),
    className,
    role: className || combatant.role,
    level: level === '' ? '' : level,
    hp: hpCurrent,
    maxHP: hpMax,
    ac: parsed.ac == null ? combatant.ac : Math.max(0, toInt(parsed.ac, 0)),
    speed: parsed.speed == null ? combatant.speed : Math.max(0, toInt(parsed.speed, 0)),
    initiativeBonus,
    proficiencyBonus,
    spellSaveDC,
    attackModifier,
    spellAttackModifier,
    abilities: mergedAbilities,
    savingThrows: normalizeStringList(parsed.savingThrows),
    skills: normalizeStringList(parsed.skills).filter((line) => /[a-z]/i.test(line)),
    senses: normalizeStringList(parsed.senses),
    spellbookEntries: normalizedSpellbookEntries,
    spellList: normalizedSpellList,
    spellSlots: hasImportedSpellSlots ? importedSpellSlots : normalizeSpellSlots(combatant.spellSlots),
    classFeatures: normalizeFeatureList(parsed.classFeatures || parsed.abilitiesText),
    featureCharges: hasParsedFeatureCharges ? importedFeatureCharges : normalizeFeatureCharges(combatant.featureCharges),
    equipmentItems: normalizeStringList(parsed.equipmentItems || parsed.equipment),
    otherPossessions: normalizeStringList(parsed.otherPossessions),
    sourceSheet: true,
    sourceSheetFileName: cleanText(parsedResult?.sourceFileName) || cleanText(combatant.sourceSheetFileName),
    sourceSheetFormat: cleanText(parsedResult?.format) || cleanText(combatant.sourceSheetFormat),
    sheetWarnings: normalizeStringList(parsedResult?.validation?.warnings),
    sheetMissingFields: normalizeStringList(parsedResult?.validation?.missingFields),
    sheetUnknownFields: normalizeStringList(parsedResult?.validation?.unknownFields),
    sheetImportedAt: Date.now(),
  };
}

function sheetProfileKey(sourceCharacterId, name) {
  const sourceKey = tokenKey(sourceCharacterId);
  if (sourceKey) return `char:${sourceKey}`;
  const nameKey = tokenKey(name);
  if (nameKey) return `name:${nameKey}`;
  return '';
}

function normalizeSheetProfile(raw) {
  const className = cleanText(raw?.className || raw?.role);
  const spellbookEntries = normalizeSpellbookEntries(raw?.spellbookEntries, raw?.spellList);
  const spellList = normalizeStringList(spellbookEntries.map((entry) => entry.name));
  return {
    race: cleanText(raw?.race),
    className,
    role: className,
    level: raw?.level === '' || raw?.level == null ? '' : toInt(raw.level, ''),
    hp: raw?.hp === '' || raw?.hp == null ? '' : toInt(raw.hp, 0),
    maxHP: raw?.maxHP === '' || raw?.maxHP == null ? '' : toInt(raw.maxHP, 0),
    ac: raw?.ac === '' || raw?.ac == null ? '' : toInt(raw.ac, 0),
    speed: raw?.speed === '' || raw?.speed == null ? '' : toInt(raw.speed, 0),
    initiativeBonus: raw?.initiativeBonus == null || raw?.initiativeBonus === '' ? 0 : toInt(raw.initiativeBonus, 0),
    proficiencyBonus: raw?.proficiencyBonus == null || raw?.proficiencyBonus === '' ? null : toInt(raw.proficiencyBonus, null),
    spellSaveDC: raw?.spellSaveDC == null || raw?.spellSaveDC === '' ? null : toInt(raw.spellSaveDC, null),
    attackModifier: raw?.attackModifier == null || raw?.attackModifier === '' ? null : toInt(raw.attackModifier, null),
    spellAttackModifier: raw?.spellAttackModifier == null || raw?.spellAttackModifier === '' ? null : toInt(raw.spellAttackModifier, null),
    abilities: normalizeAbilities(raw?.abilities),
    savingThrows: normalizeStringList(raw?.savingThrows),
    skills: normalizeStringList(raw?.skills).filter((line) => /[a-z]/i.test(line)),
    senses: normalizeStringList(raw?.senses),
    spellbookEntries,
    spellList,
    classFeatures: normalizeFeatureList(raw?.classFeatures),
    spellSlots: normalizeSpellSlots(raw?.spellSlots),
    featureCharges: normalizeFeatureCharges(raw?.featureCharges),
    hideSensitiveStats: !!raw?.hideSensitiveStats,
    equipmentItems: normalizeStringList(raw?.equipmentItems),
    otherPossessions: normalizeStringList(raw?.otherPossessions),
    sourceSheet: !!raw?.sourceSheet,
    sourceSheetFileName: cleanText(raw?.sourceSheetFileName),
    sourceSheetFormat: cleanText(raw?.sourceSheetFormat),
    sheetWarnings: normalizeStringList(raw?.sheetWarnings),
    sheetMissingFields: normalizeStringList(raw?.sheetMissingFields),
    sheetUnknownFields: normalizeStringList(raw?.sheetUnknownFields),
    sheetImportedAt: toInt(raw?.sheetImportedAt, 0),
  };
}

function buildSheetProfileFromCombatant(combatant) {
  return normalizeSheetProfile(combatant);
}

function applySheetProfileToCombatant(combatant, profile) {
  if (!profile || typeof profile !== 'object') return combatant;
  const normalized = normalizeSheetProfile(profile);
  return {
    ...combatant,
    ...normalized,
    name: combatant.name,
    sourceCharacterId: combatant.sourceCharacterId || '',
    side: combatant.side || 'Enemy',
    init: toInt(combatant.init, 10),
    tempHP: toInt(combatant.tempHP, 0),
    status: Array.isArray(combatant.status) ? combatant.status : [],
    concentration: combatant.concentration || '',
    notes: combatant.notes || '',
    dead: !!combatant.dead,
    enemyType: combatant.enemyType || 'goblin',
    customImage: combatant.customImage || '',
    pcColorIndex: combatant.pcColorIndex != null ? combatant.pcColorIndex : 0,
  };
}

function loadState() {
  return repository.readJson(LS_KEY, null);
}
function saveState(state, options = {}) { repository.writeJson(LS_KEY, state, options); }

function defaultEncounter() {
  return {
    id: uid(),
    name: 'Encounter',
    round: 1,
    activeIndex: 0,
    combatants: [],
    castorWilliamResourceSync: false,
    sheetProfiles: {},
    updatedAt: Date.now(),
  };
}

function normalize(enc) {
  const base = defaultEncounter();
  const e = { ...base, ...(enc || {}) };
  if (!Array.isArray(e.combatants)) e.combatants = [];
  const rawProfiles = e.sheetProfiles && typeof e.sheetProfiles === 'object' ? e.sheetProfiles : {};
  e.sheetProfiles = Object.entries(rawProfiles).reduce((acc, [key, value]) => {
    const normalizedKey = cleanText(key);
    if (!normalizedKey) return acc;
    acc[normalizedKey] = normalizeSheetProfile(value);
    return acc;
  }, {});
  e.combatants = e.combatants.map((c, i) => {
    const spellbookEntries = normalizeSpellbookEntries(c.spellbookEntries, c.spellList);
    const spellList = normalizeStringList(spellbookEntries.map((entry) => entry.name));
    return {
      sourceCharacterId: c.sourceCharacterId || '',
      createdByUserId: cleanText(c.createdByUserId),
      createdByEmail: cleanText(c.createdByEmail).toLowerCase(),
      createdByUsername: cleanText(c.createdByUsername),
      id: c.id || uid(),
      name: c.name || 'Unknown',
      role: c.role || '',
      race: c.race || '',
      className: c.className || c.role || '',
      level: c.level === '' || c.level == null ? '' : toInt(c.level, ''),
      side: c.side || 'Enemy',
      init: toInt(c.init, 10),
      initiativeBonus: c.initiativeBonus == null || c.initiativeBonus === '' ? 0 : toInt(c.initiativeBonus, 0),
      proficiencyBonus: c.proficiencyBonus == null || c.proficiencyBonus === '' ? null : toInt(c.proficiencyBonus, null),
      spellSaveDC: c.spellSaveDC == null || c.spellSaveDC === '' ? null : toInt(c.spellSaveDC, null),
      attackModifier: c.attackModifier == null || c.attackModifier === '' ? null : toInt(c.attackModifier, null),
      spellAttackModifier: c.spellAttackModifier == null || c.spellAttackModifier === '' ? null : toInt(c.spellAttackModifier, null),
      maxHP: c.maxHP === '' || c.maxHP == null ? '' : toInt(c.maxHP, 0),
      hp: c.hp === '' || c.hp == null ? '' : toInt(c.hp, 0),
      tempHP: toInt(c.tempHP, 0),
      ac: c.ac === '' || c.ac == null ? '' : toInt(c.ac, 0),
      speed: c.speed === '' || c.speed == null ? '' : toInt(c.speed, 0),
      abilities: normalizeAbilities(c.abilities),
      savingThrows: normalizeStringList(c.savingThrows),
      skills: normalizeStringList(c.skills).filter((line) => /[a-z]/i.test(line)),
      senses: normalizeStringList(c.senses),
      spellbookEntries,
      spellList,
      classFeatures: normalizeFeatureList(c.classFeatures),
      status: Array.isArray(c.status) ? c.status : String(c.status || '').split(',').map(s => s.trim()).filter(Boolean),
      concentration: c.concentration || '',
      notes: c.notes || '',
      hideSensitiveStats: !!c.hideSensitiveStats,
      notableFeature: cleanText(c.notableFeature),
      spellSlots: normalizeSpellSlots(c.spellSlots),
      featureCharges: normalizeFeatureCharges(c.featureCharges),
      equipmentItems: normalizeStringList(c.equipmentItems),
      otherPossessions: normalizeStringList(c.otherPossessions),
      sourceSheet: !!c.sourceSheet,
      sourceSheetFileName: c.sourceSheetFileName || '',
      sourceSheetFormat: c.sourceSheetFormat || '',
      sheetWarnings: normalizeStringList(c.sheetWarnings),
      sheetMissingFields: normalizeStringList(c.sheetMissingFields),
      sheetUnknownFields: normalizeStringList(c.sheetUnknownFields),
      sheetImportedAt: toInt(c.sheetImportedAt, 0),
      dead: !!c.dead,
      enemyType: c.enemyType || 'goblin',
      customImage: c.customImage || ((c.side || 'Enemy') === 'Enemy' ? '' : tokenImageForCharacter(c.sourceCharacterId, c.name)),
      pcColorIndex: c.pcColorIndex != null ? c.pcColorIndex : (i % PC_COLORS.length),
    };
  });
  e.round = toInt(e.round, 1);
  e.activeIndex = toInt(e.activeIndex, 0);
  e.castorWilliamResourceSync = !!e.castorWilliamResourceSync;
  e.updatedAt = toInt(e.updatedAt, Date.now());
  return e;
}

function sideRank(side) { if (side === 'PC') return 0; if (side === 'Ally') return 1; return 2; }

function sortCombatants(list) {
  return [...list].sort((a, b) => {
    const di = toInt(b.init, 0) - toInt(a.init, 0);
    if (di !== 0) return di;
    const sr = sideRank(a.side) - sideRank(b.side);
    if (sr !== 0) return sr;
    return String(a.name).localeCompare(String(b.name));
  });
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function uniqueName(existingNames, desired) {
  if (!existingNames.has(desired)) return desired;
  let i = 2; while (existingNames.has(`${desired} (${i})`)) i++;
  return `${desired} (${i})`;
}

const sideBg = (side) =>
  side === 'PC'    ? 'linear-gradient(180deg,rgba(40,130,90,0.92),rgba(15,75,52,0.96))'
  : side === 'Ally'? 'linear-gradient(180deg,rgba(70,95,160,0.92),rgba(45,60,120,0.96))'
  :                  'linear-gradient(180deg,rgba(140,35,35,0.92),rgba(100,20,20,0.96))';

const sideAccent = (side) =>
  side === 'PC' ? 'rgba(40,160,100,0.70)' : side === 'Ally' ? 'rgba(80,110,200,0.70)' : 'rgba(180,50,50,0.70)';

const hpGradient = (pct) =>
  pct > 60 ? 'linear-gradient(90deg,rgba(40,160,90,0.90),rgba(60,200,110,0.85))'
  : pct > 30 ? 'linear-gradient(90deg,rgba(190,130,20,0.90),rgba(230,170,30,0.85))'
  : 'linear-gradient(90deg,rgba(180,40,40,0.90),rgba(220,60,60,0.85))';

// ── Crop Image helper ─────────────────────────────────────────────────────
function CropImage({ src, imgRef, cropBox, zoom, offset, onLoad }) {
  if (!src) return null;
  const img = imgRef.current;
  const iw = img?.naturalWidth || 1;
  const ih = img?.naturalHeight || 1;
  const base = Math.max(cropBox / iw, cropBox / ih);
  const scale = base * zoom;
  const rw = iw * scale;
  const rh = ih * scale;
  const left = (cropBox / 2) - (rw / 2) + offset.x;
  const top  = (cropBox / 2) - (rh / 2) + offset.y;
  return (
    <img
      ref={imgRef}
      src={src}
      alt="crop"
      onLoad={onLoad}
      draggable={false}
      style={{ position: 'absolute', left, top, width: rw, height: rh, pointerEvents: 'none', userSelect: 'none' }}
    />
  );
}

// ── Battlefield Token ──────────────────────────────────────────────────────
function BattlefieldToken({ c, isActive, isSelected, onClick, onHover, size = 90, flipped = false }) {
  const hp = c.hp === '' ? 0 : toInt(c.hp, 0);
  const max = c.maxHP === '' ? 0 : toInt(c.maxHP, 0);
  const pct = max > 0 ? (hp / max) * 100 : 100;

  const EnemyRender = ENEMY_TYPES.find(e => e.key === c.enemyType)?.Render || GoblinSVG;
  const pcColor = PC_COLORS[c.pcColorIndex % PC_COLORS.length];
  const rootClass = `${styles.tokenRoot} ${c.dead ? styles.tokenDead : ''}`;
  const ringShadow = c.side === 'Enemy'
    ? '0 0 0 3px rgba(220,60,60,0.90), 0 0 22px rgba(220,60,60,0.55)'
    : '0 0 0 3px rgba(255,210,80,0.90), 0 0 22px rgba(255,210,80,0.45)';
  const circleBorder = isSelected
    ? '3px solid rgba(255,210,80,0.95)'
    : isActive
    ? '3px solid rgba(255,255,255,0.55)'
    : `2px solid ${c.side === 'Enemy' ? 'rgba(200,60,60,0.45)' : 'rgba(80,160,120,0.45)'}`;
  const circleBg = c.side === 'Enemy'
    ? 'radial-gradient(circle at 40% 35%, rgba(60,20,20,0.95), rgba(20,8,8,0.98))'
    : 'radial-gradient(circle at 40% 35%, rgba(20,30,50,0.95), rgba(8,12,22,0.98))';
  const circleShadow = c.side === 'Enemy'
    ? '0 6px 20px rgba(0,0,0,0.75), inset 0 0 20px rgba(180,40,40,0.15)'
    : '0 6px 20px rgba(0,0,0,0.75), inset 0 0 20px rgba(60,120,200,0.12)';
  const labelBg = isActive ? 'rgba(255,210,80,0.18)' : 'rgba(0,0,0,0.68)';
  const labelBorder = `1px solid ${isActive ? 'rgba(255,210,80,0.40)' : 'rgba(255,255,255,0.10)'}`;
  const nameColor = c.dead ? 'rgba(200,150,150,0.70)' : 'var(--koa-cream)';

  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      title={`${c.name} — Click to edit`}
      className={rootClass}
    >
      {/* Active turn glow ring */}
      {isActive && (
        <div
          className={styles.tokenActiveRing}
          style={{ width: size + 16, height: size + 16, boxShadow: ringShadow }}
        />
      )}

      {/* Token circle / image */}
      <div
        className={styles.tokenCircle}
        style={{
          width: size,
          height: size,
          border: circleBorder,
          background: circleBg,
          boxShadow: circleShadow,
          transform: flipped ? 'scaleX(-1)' : 'none',
        }}
      >
        {c.customImage ? (
          <img
            src={c.customImage}
            alt={c.name}
            className={styles.tokenImage}
            style={{ transform: flipped ? 'scaleX(-1)' : 'none' }}
          />
        ) : c.side === 'Enemy' ? (
          <EnemyRender size={size * 0.72} />
        ) : (
          <HeroSVG color={pcColor} size={size * 0.72} />
        )}
      </div>

      {/* Name tag + status */}
      <div
        className={styles.tokenLabelBox}
        style={{ background: labelBg, border: labelBorder, maxWidth: size + 30 }}
      >
        <div
          className={styles.tokenName}
          style={{ color: nameColor, maxWidth: size + 20, textDecoration: c.dead ? 'line-through' : 'none' }}
        >
          {c.name}
        </div>
        {/* HP bar */}
        <div className={styles.tokenHpTrack}>
          <div className={styles.tokenHpFill} style={{ width: `${clamp(pct, 0, 100)}%`, background: hpGradient(pct) }} />
        </div>
        {/* Status badges */}
        {c.status && c.status.length > 0 && (
          <div className={styles.tokenStatusRow}>
            {c.status.slice(0, 4).map(s => (
              <span key={s} className={styles.tokenStatusBadge}>{s}</span>
            ))}
            {c.status.length > 4 && (
              <span className={styles.tokenStatusMore}>+{c.status.length - 4}</span>
            )}
          </div>
        )}
        {/* Concentration indicator */}
        {c.concentration && (
          <div className={styles.tokenConcentration} style={{ maxWidth: size + 20 }}>
            ⚬ {c.concentration}
          </div>
        )}
      </div>

      {/* Dead skull */}
      {c.dead && (
        <div className={styles.tokenDeadSkull} style={{ fontSize: size * 0.35 }}>💀</div>
      )}
    </div>
  );
}

// ── Battlefield Scene ──────────────────────────────────────────────────────
function BattlefieldScene({ combatants, activeCombatantId, selectedId, openEditorFor, playHover, playNav, battleBg }) {
  const pcs    = combatants.filter(c => c.side === 'PC' || c.side === 'Ally');
  const enemies = combatants.filter(c => c.side === 'Enemy');
  const bgStyle = {
    background: battleBg
      ? `url(${battleBg}) center/cover no-repeat`
      : 'linear-gradient(180deg, rgba(8,6,4,0.30) 0%, rgba(0,0,0,0) 40%)',
  };
  const enemyGap = Math.max(6, 48 - enemies.length * 4);
  const pcGap = Math.max(8, 52 - pcs.length * 5);

  return (
    <div className={styles.sceneRoot} style={bgStyle}>

      {/* Dark overlay to keep tokens readable over bright backgrounds */}
      {battleBg && (
        <div className={styles.sceneOverlay} />
      )}

      {/* Ground plane perspective lines */}
      <svg className={styles.sceneSvg} viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice">
        {/* Horizon fog */}
        <defs>
          <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="rgba(20,30,10,0.0)"/>
            <stop offset="55%"  stopColor="rgba(15,25,8,0.28)"/>
            <stop offset="100%" stopColor="rgba(8,12,4,0.72)"/>
          </linearGradient>
          <linearGradient id="fogGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%"  stopColor="rgba(60,80,30,0.0)"/>
            <stop offset="100%" stopColor="rgba(60,80,40,0.22)"/>
          </linearGradient>
          <radialGradient id="glowR" cx="50%" cy="50%">
            <stop offset="0%"  stopColor="rgba(220,60,40,0.22)"/>
            <stop offset="100%" stopColor="rgba(0,0,0,0)"/>
          </radialGradient>
          <radialGradient id="glowB" cx="50%" cy="50%">
            <stop offset="0%"  stopColor="rgba(60,100,220,0.14)"/>
            <stop offset="100%" stopColor="rgba(0,0,0,0)"/>
          </radialGradient>
        </defs>

        {/* Ground fill */}
        <rect x="0" y="240" width="800" height="260" fill="url(#groundGrad)"/>
        {/* Perspective grid lines converging to vanishing point */}
        {[-4,-2,0,2,4].map(i => (
          <line key={i} x1={400 + i * 600} y1={500} x2={400} y2={240}
            stroke="rgba(120,160,60,0.08)" strokeWidth="1"/>
        ))}
        {/* Horizontal lines */}
        {[0,1,2,3,4].map(i => {
          const y = 260 + i * 50; const spread = 30 + i * 60;
          return <line key={i} x1={400 - spread * 4} y1={y} x2={400 + spread * 4} y2={y}
            stroke="rgba(120,160,60,0.06)" strokeWidth="1"/>;
        })}

        {/* Enemy side ambient red glow */}
        {enemies.length > 0 && <ellipse cx="400" cy="280" rx="280" ry="80" fill="url(#glowR)" opacity="0.7"/>}
        {/* PC side ambient blue glow */}
        {pcs.length > 0 && <ellipse cx="400" cy="440" rx="260" ry="60" fill="url(#glowB)" opacity="0.7"/>}

        {/* Bottom fog */}
        <rect x="0" y="360" width="800" height="140" fill="url(#fogGrad)" opacity="0.5"/>

        {/* Dividing battle line */}
        <line x1="100" y1="348" x2="700" y2="348" stroke="rgba(200,160,60,0.12)" strokeWidth="1" strokeDasharray="6 8"/>
      </svg>

      {/* Empty state */}
      {combatants.length === 0 && (
        <div className={styles.sceneEmpty}>
          <div className={styles.sceneEmptyIcon}>⚔️</div>
          <div className={styles.sceneEmptyText}>Add combatants to see the battlefield</div>
        </div>
      )}

      {/* ENEMIES — upper half, facing toward us, spread horizontally */}
      {enemies.length > 0 && (
        <div className={styles.sceneEnemiesRow} style={{ gap: enemyGap }}>
          {enemies.map((c, i) => {
            const scale = 0.68 + (enemies.length <= 2 ? 0.18 : enemies.length <= 4 ? 0.08 : 0);
            const tokenSize = Math.round(108 * scale);
            return (
              <BattlefieldToken
                key={c.id} c={c}
                isActive={c.id === activeCombatantId}
                isSelected={c.id === selectedId}
                size={tokenSize}
                flipped={false}
                onClick={() => { playNav(); openEditorFor(c.id); }}
                onHover={playHover}
              />
            );
          })}
        </div>
      )}

      {/* VS divider label */}
      {pcs.length > 0 && enemies.length > 0 && (
        <div className={styles.sceneVs}>VS</div>
      )}

      {/* PCs — lower half, facing away (backs shown), larger (closer) */}
      {pcs.length > 0 && (
        <div className={styles.scenePcsRow} style={{ gap: pcGap }}>
          {pcs.map((c, i) => {
            const scale = 0.80 + (pcs.length <= 2 ? 0.22 : pcs.length <= 4 ? 0.10 : 0);
            const tokenSize = Math.round(132 * scale);
            return (
              <BattlefieldToken
                key={c.id} c={c}
                isActive={c.id === activeCombatantId}
                isSelected={c.id === selectedId}
                size={tokenSize}
                flipped={true}
                onClick={() => { playNav(); openEditorFor(c.id); }}
                onHover={playHover}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function CombatPanel({
  panelType,
  cinematicNav,
  characters = [],
  canManageCombat = true,
  canWriteCombat = true,
  viewerIdentity = null,
  canControlCharacter = () => true,
  playNav = () => {},
  playHover = () => {},
}) {

  // ✅ Adventurers are now derived from the shared Character Book roster (single source of truth)
  const adventurers = useMemo(() => {
    return (characters || [])
      .filter((c) => c && c.combat !== false)
      .map((c) => ({
        id: c.id || '',
        name: c.name,
        role: c.role || c.class || '',
        ac: typeof c.ac === 'number' ? c.ac : 0,
        hp: typeof c.hp === 'number' ? c.hp : 0,
        maxHP: typeof c.maxHP === 'number' ? c.maxHP : (typeof c.hp === 'number' ? c.hp : 0),
      }));
  }, [characters]);

  const characterById = useMemo(() => {
    const out = {};
    (characters || []).forEach((character) => {
      const idKey = tokenKey(character?.id);
      if (idKey) out[idKey] = character;
    });
    return out;
  }, [characters]);

  const characterByName = useMemo(() => {
    const out = {};
    (characters || []).forEach((character) => {
      const nameKey = tokenKey(character?.name);
      if (nameKey) out[nameKey] = character;
    });
    return out;
  }, [characters]);

  const viewerUserId = useMemo(
    () => cleanText(viewerIdentity?.userId),
    [viewerIdentity]
  );
  const viewerEmail = useMemo(
    () => cleanText(viewerIdentity?.email).toLowerCase(),
    [viewerIdentity]
  );
  const viewerUsername = useMemo(
    () => cleanText(viewerIdentity?.username),
    [viewerIdentity]
  );
  const viewerUsernameKey = useMemo(
    () => viewerUsername.toLowerCase(),
    [viewerUsername]
  );

  const resolveCharacterForCombatant = useCallback(
    (combatant) => {
      if (!combatant) return null;
      const idKey = tokenKey(combatant.sourceCharacterId);
      if (idKey && characterById[idKey]) return characterById[idKey];
      if ((combatant.side || 'Enemy') === 'Enemy') return null;
      const nameKey = tokenKey(combatant.name);
      if (nameKey && characterByName[nameKey]) return characterByName[nameKey];
      return null;
    },
    [characterById, characterByName]
  );

  const canControlUnlinkedCombatant = useCallback(
    (combatant) => {
      if (!combatant || !canWriteCombat) return false;
      if (canManageCombat) return true;

      const ownerUserId = cleanText(combatant.createdByUserId);
      const ownerEmail = cleanText(combatant.createdByEmail).toLowerCase();
      const ownerUsername = cleanText(combatant.createdByUsername);
      const ownerUsernameKey = ownerUsername.toLowerCase();
      const hasOwner = !!(ownerUserId || ownerEmail || ownerUsername);
      if (!hasOwner) return true;

      if (ownerUserId && viewerUserId && ownerUserId === viewerUserId) return true;
      if (ownerEmail && viewerEmail && ownerEmail === viewerEmail) return true;
      if (ownerUsernameKey && viewerUsernameKey && ownerUsernameKey === viewerUsernameKey) return true;
      return false;
    },
    [canManageCombat, canWriteCombat, viewerEmail, viewerUserId, viewerUsernameKey]
  );

  const canControlCombatant = useCallback(
    (combatant) => {
      if (!combatant) return false;
      const linkedCharacter = resolveCharacterForCombatant(combatant);
      if (linkedCharacter) return canControlCharacter(linkedCharacter);
      return canControlUnlinkedCombatant(combatant);
    },
    [canControlCharacter, canControlUnlinkedCombatant, resolveCharacterForCombatant]
  );

  const canRemoveCombatant = useCallback(
    (combatant) => {
      if (!combatant || !canWriteCombat) return false;
      if (canManageCombat) return true;
      const linkedCharacter = resolveCharacterForCombatant(combatant);
      if (linkedCharacter) return canControlCharacter(linkedCharacter);
      return canControlUnlinkedCombatant(combatant);
    },
    [
      canControlCharacter,
      canControlUnlinkedCombatant,
      canManageCombat,
      canWriteCombat,
      resolveCharacterForCombatant,
    ]
  );

  const stampCombatantCreator = useCallback(
    (combatant) => {
      if (!combatant || typeof combatant !== 'object') return combatant;
      const sourceIdKey = tokenKey(combatant.sourceCharacterId);
      if (sourceIdKey) return combatant;

      const hasCreator = !!(
        cleanText(combatant.createdByUserId)
        || cleanText(combatant.createdByEmail)
        || cleanText(combatant.createdByUsername)
      );
      if (hasCreator) return combatant;

      return {
        ...combatant,
        createdByUserId: viewerUserId,
        createdByEmail: viewerEmail,
        createdByUsername: viewerUsername,
      };
    },
    [viewerEmail, viewerUserId, viewerUsername]
  );

  const active = panelType === 'combat';
  const repositorySourceIdRef = useRef(createId('combat-sync'));
  const suppressNextPersistRef = useRef(false);

  const [encounter, setEncounter] = useState(() => normalize(loadState()) || defaultEncounter());
  const [selectedId, setSelectedId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState('edit');
  const [listEditorMode, setListEditorMode] = useState('');
  const [listEditorText, setListEditorText] = useState('');
  const [featureRawEditorOpen, setFeatureRawEditorOpen] = useState(false);
  const [featureRawSnapshot, setFeatureRawSnapshot] = useState('');
  const [spellbookDraftEntries, setSpellbookDraftEntries] = useState([]);
  const [activeSpellDraftId, setActiveSpellDraftId] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [restrictedModalOpen, setRestrictedModalOpen] = useState(false);
  const [draft, setDraft] = useState({ name:'', side:'Enemy', init:'10', hp:'', maxHP:'', ac:'', enemyType:'goblin' });
  const [adventurerPick, setAdventurerPick] = useState(() => adventurers[0]?.name || '');
  const [hpAdjustAmount, setHpAdjustAmount] = useState('0');
  const [statusDraft, setStatusDraft] = useState('');
  const [sheetImportState, setSheetImportState] = useState({
    running: false,
    progress: 0,
    stage: '',
    targetId: '',
    message: '',
    error: '',
  });
  const [initSlideDirection, setInitSlideDirection] = useState('next');
  const [initSlideTick, setInitSlideTick] = useState(0);

  // ── Battle Background state ─────────────────────────────────────────────
  const [battleBg, setBattleBg] = useState(null);

  // ── Image Crop state ────────────────────────────────────────────────────
  const CROP_BOX = 260;
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState('');
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const cropImgRef = useRef(null);
  const cropDragRef = useRef({ dragging: false, sx: 0, sy: 0, ox: 0, oy: 0 });
  const sheetFileInputRef = useRef(null);
  const sheetImportAbortRef = useRef(null);
  const [sheetPopoutOpen, setSheetPopoutOpen] = useState(false);
  const sheetPopoutWindowRef = useRef(null);
  const sheetPopoutRootRef = useRef(null);
  const suppressNextPopoutSessionEndRef = useRef(false);

  useEffect(() => {
    const anyModalOpen = cropOpen || addModalOpen || restrictedModalOpen || editorOpen || !!listEditorMode;
    if (!anyModalOpen) return;

    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (listEditorMode) {
        if (listEditorMode === 'spellbook' && activeSpellDraftId) {
          setActiveSpellDraftId('');
          return;
        }
        if (listEditorMode === 'features' && featureRawEditorOpen) {
          setFeatureRawEditorOpen(false);
          return;
        }
        setListEditorMode('');
        return;
      }
      if (cropOpen) {
        setCropOpen(false);
        return;
      }
      if (addModalOpen) {
        setAddModalOpen(false);
        return;
      }
      if (restrictedModalOpen) {
        setRestrictedModalOpen(false);
        return;
      }
      if (editorOpen) {
        setEditorOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cropOpen, addModalOpen, restrictedModalOpen, editorOpen, listEditorMode, activeSpellDraftId, featureRawEditorOpen]);

  // Header measurement (prevents overlap with content below)
  const headerRef = useRef(null);
  const [headerH, setHeaderH] = useState(108);
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    let rafId = 0;
    const measure = () => {
      const h = Math.ceil(el.getBoundingClientRect().height || 0);
      if (!h) return;
      setHeaderH((prev) => (prev === h ? prev : h));
    };
    const scheduleMeasure = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('resize', scheduleMeasure);

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(scheduleMeasure);
      ro.observe(el);
    }

    if (document.fonts?.ready) {
      document.fonts.ready.then(scheduleMeasure).catch(() => {});
    }

    return () => {
      window.removeEventListener('resize', scheduleMeasure);
      if (ro) ro.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // ensure pick stays valid if roster changes
  useEffect(() => {
    if (!adventurers.length) return;
    const ok = adventurers.some((a) => a.name === adventurerPick);
    if (!ok) setAdventurerPick(adventurers[0].name);
  }, [adventurers, adventurerPick]);
  const [adventurerSide, setAdventurerSide] = useState('PC');

  const hydrated = useRef(false);
  useEffect(() => {
    const unsubscribe = repository.subscribe(LS_KEY, (event) => {
      if (event?.meta?.sourceId === repositorySourceIdRef.current) return;
      if (event?.meta?.type && event.meta.type !== 'json' && event.meta.type !== 'remove') return;

      const incoming = normalize(event?.value) || defaultEncounter();
      setEncounter((prev) => {
        try {
          if (JSON.stringify(prev) === JSON.stringify(incoming)) return prev;
        } catch {}
        suppressNextPersistRef.current = true;
        return incoming;
      });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const incoming = normalize(loadState()) || defaultEncounter();
      setEncounter((prev) => {
        try {
          if (JSON.stringify(prev) === JSON.stringify(incoming)) return prev;
        } catch {}
        suppressNextPersistRef.current = true;
        return incoming;
      });
    }, 1200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!hydrated.current) { hydrated.current = true; return; }
    if (suppressNextPersistRef.current) {
      suppressNextPersistRef.current = false;
      return;
    }
    saveState(encounter, { sourceId: repositorySourceIdRef.current });
  }, [encounter]);

  const combatants = encounter.combatants;
  const selected = useMemo(() => combatants.find(c => c.id === selectedId) || null, [combatants, selectedId]);
  const selectedCanEdit = useMemo(
    () => (selected ? canControlCombatant(selected) : false),
    [canControlCombatant, selected]
  );
  const selectedCanRemove = useMemo(
    () => (selected ? canRemoveCombatant(selected) : false),
    [canRemoveCombatant, selected]
  );
  const selectedReadOnly = !!selected && !selectedCanEdit;
  const selectedSensitiveStatsHidden = !!selected?.hideSensitiveStats;
  const selectedRestrictedPortrait = useMemo(() => {
    if (!selected) return '';
    return cleanText(selected.customImage) || tokenImageForCharacter(selected.sourceCharacterId, selected.name) || '';
  }, [selected]);
  const selectedStatusConditions = useMemo(
    () => normalizeStringList(selected?.status),
    [selected]
  );
  const selectedEquipment = useMemo(
    () => normalizeStringList(selected?.equipmentItems),
    [selected]
  );
  const selectedCurrentHp = useMemo(() => {
    if (!selected) return '—';
    return selected.hp === '' || selected.hp == null ? '—' : String(selected.hp);
  }, [selected]);
  const selectedNotableFeature = useMemo(
    () => cleanText(selected?.notableFeature),
    [selected]
  );
  const castorWilliamPair = useMemo(() => findCastorWilliamPair(combatants), [combatants]);
  const selectedCastorWilliamRole = useMemo(() => castorWilliamSyncRole(selected), [selected]);
  const castorWilliamResourceSyncAvailable = !!castorWilliamPair.castor && !!castorWilliamPair.william;
  const castorWilliamResourceSyncEnabled = !!encounter.castorWilliamResourceSync;
  const castorWilliamSyncSwitchTitle = castorWilliamResourceSyncAvailable
    ? 'Mirror HP, spell slots, and feature charges between Castor and William Spicer'
    : 'Add both Castor and William Spicer to enable sync';
  const activeCombatantId = combatants[encounter.activeIndex]?.id || null;
  const selectedSavingThrowRows = useMemo(
    () => normalizeSavingThrowRows(selected?.savingThrows, selected?.abilities, selected?.level),
    [selected]
  );
  const selectedSkillRows = useMemo(
    () => normalizeSkillRows(selected?.skills, selected?.abilities, selected?.level),
    [selected]
  );
  const selectedSenseRows = useMemo(
    () => normalizeSenseRows(selected?.senses),
    [selected]
  );
  const selectedSpellbookEntries = useMemo(
    () => normalizeSpellbookEntries(selected?.spellbookEntries, selected?.spellList),
    [selected]
  );
  const spellbookDraftGroups = useMemo(
    () => groupedSpellbookEntries(spellbookDraftEntries),
    [spellbookDraftEntries]
  );
  const activeSpellDraft = useMemo(
    () => spellbookDraftEntries.find((entry) => entry.id === activeSpellDraftId) || null,
    [spellbookDraftEntries, activeSpellDraftId]
  );
  const featureDraftSections = useMemo(
    () => (listEditorMode === 'features' ? parseFeatureSections(listEditorText) : []),
    [listEditorMode, listEditorText]
  );
  const sheetCurrentHpVisual = useMemo(() => {
    if (!selected) return { style: undefined, isCritical: false };
    const maxHp = selected.maxHP === '' ? null : Math.max(0, toInt(selected.maxHP, 0));
    const currentHp = selected.hp === '' ? null : Math.max(0, toInt(selected.hp, 0));
    if (maxHp == null || maxHp <= 0 || currentHp == null) return { style: undefined, isCritical: false };

    const ratio = clamp(currentHp / maxHp, 0, 1);
    if (ratio > 0.5) return { style: undefined, isCritical: false };

    // 0 at half HP, 1 at 0 HP: progressively deeper red as HP drops.
    const critical = clamp((0.5 - ratio) / 0.5, 0, 1);
    const hue = 6 - (critical * 6);
    const saturation = 82 + (critical * 8);
    const lightness = 56 - (critical * 26);
    const glow = 0.18 + (critical * 0.3);
    const style = {
      color: `hsl(${hue} ${saturation}% ${lightness}%)`,
      textShadow: `0 0 10px rgba(220, 38, 38, ${glow})`,
    };
    if (ratio <= 0.2) {
      const pulseProgress = clamp((0.2 - ratio) / 0.2, 0, 1);
      const pulseDurationMs = Math.round(1200 - (pulseProgress * 780));
      style['--hp-critical-pulse-ms'] = `${pulseDurationMs}ms`;
      return { style, isCritical: true };
    }
    return { style, isCritical: false };
  }, [selected]);
  const selectedProficiencyBonus = useMemo(() => {
    if (!selected) return null;
    if (selected.proficiencyBonus != null && selected.proficiencyBonus !== '') {
      return toInt(selected.proficiencyBonus, null);
    }
    if (selected.level === '' || selected.level == null) return null;
    return proficiencyBonusFromLevel(selected.level);
  }, [selected]);
  const allSpellSlots = useMemo(
    () => normalizeSpellSlots(selected?.spellSlots),
    [selected]
  );
  const visibleSheetSpellSlots = useMemo(
    () => allSpellSlots.filter((slot) => Number(slot.max) > 0),
    [allSpellSlots]
  );
  const allFeatureCharges = useMemo(
    () => normalizeFeatureCharges(selected?.featureCharges),
    [selected]
  );
  const visibleSheetFeatureCharges = useMemo(
    () => allFeatureCharges.filter((feature) => Number(feature.max) > 0),
    [allFeatureCharges]
  );
  const initiativeSlots = useMemo(() => {
    if (!combatants.length) return [null, null, null];
    const safeActive = clamp(encounter.activeIndex, 0, combatants.length - 1);
    const getByOffset = (offset) => {
      const idx = (safeActive + offset + combatants.length) % combatants.length;
      return combatants[idx];
    };
    if (combatants.length === 1) return [null, getByOffset(0), null];
    if (combatants.length === 2) return [getByOffset(-1), getByOffset(0), null];
    return [getByOffset(-1), getByOffset(0), getByOffset(1)];
  }, [combatants, encounter.activeIndex]);

  useEffect(() => {
    if (!editorOpen || !selectedId) return;
    setHpAdjustAmount('0');
    setStatusDraft(selected ? selected.status.join(', ') : '');
  }, [editorOpen, selectedId]);

  useEffect(() => {
    if (!restrictedModalOpen) return;
    if (!selected || !selectedReadOnly) {
      setRestrictedModalOpen(false);
    }
  }, [restrictedModalOpen, selected, selectedReadOnly]);

  useEffect(() => {
    if (!listEditorMode || !selected) return;
    if (listEditorMode === 'spellbook') {
      setSpellbookDraftEntries(selectedSpellbookEntries);
      setActiveSpellDraftId('');
      setFeatureRawEditorOpen(false);
      setFeatureRawSnapshot('');
      return;
    }
    if (listEditorMode === 'features') {
      setListEditorText(normalizeStringList(selected.classFeatures).join('\n'));
      setActiveSpellDraftId('');
      setFeatureRawEditorOpen(false);
      setFeatureRawSnapshot('');
    }
  }, [listEditorMode, selected, selectedSpellbookEntries]);

  useEffect(() => {
    return () => {
      if (sheetImportAbortRef.current) sheetImportAbortRef.current.abort();
    };
  }, []);

  const closeSheetPopout = (closeWindow = true, { suppressSessionEnd = false } = {}) => {
    const popout = sheetPopoutWindowRef.current;
    const host = sheetPopoutRootRef.current;

    if (closeWindow && popout && !popout.closed) {
      if (suppressSessionEnd) suppressNextPopoutSessionEndRef.current = true;
      try { popout.close(); } catch (_) {}
    }

    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
    sheetPopoutRootRef.current = null;
    sheetPopoutWindowRef.current = null;
    setSheetPopoutOpen(false);
  };

  const openSheetPopout = () => {
    if (!editorOpen || !selected || editorMode !== 'sheet') return;
    const existing = sheetPopoutWindowRef.current;
    if (existing && !existing.closed) {
      existing.focus();
      return;
    }

    const popout = window.open('', 'combat-sheet-popout', 'popup=yes,width=1180,height=900,resizable=yes,scrollbars=yes');
    if (!popout) {
      window.alert('Pop-up blocked. Please allow pop-ups for this site to use Character Sheet pop out.');
      return;
    }

    try {
      popout.document.head.innerHTML = '';
      const metaCharset = popout.document.createElement('meta');
      metaCharset.setAttribute('charset', 'utf-8');
      popout.document.head.appendChild(metaCharset);
      const metaViewport = popout.document.createElement('meta');
      metaViewport.setAttribute('name', 'viewport');
      metaViewport.setAttribute('content', 'width=device-width, initial-scale=1');
      popout.document.head.appendChild(metaViewport);
      copyHeadStyles(document, popout.document);

      popout.document.body.innerHTML = '';
      popout.document.body.style.margin = '0';
      popout.document.body.style.background = 'transparent';

      const host = popout.document.createElement('div');
      host.id = 'combat-sheet-popout-root';
      host.style.position = 'fixed';
      host.style.inset = '0';
      popout.document.body.appendChild(host);

      popout.addEventListener('beforeunload', () => {
        const suppressSessionEnd = suppressNextPopoutSessionEndRef.current;
        suppressNextPopoutSessionEndRef.current = false;
        sheetPopoutRootRef.current = null;
        sheetPopoutWindowRef.current = null;
        setSheetPopoutOpen(false);
        if (!suppressSessionEnd) {
          setEditorOpen(false);
          setListEditorMode('');
          setActiveSpellDraftId('');
          setFeatureRawEditorOpen(false);
        }
      }, { once: true });

      sheetPopoutWindowRef.current = popout;
      sheetPopoutRootRef.current = host;
      setSheetPopoutOpen(true);
      popout.document.title = `${selected.name} — Character Sheet`;
      popout.focus();
    } catch (_) {
      try { popout.close(); } catch (err) {}
      sheetPopoutRootRef.current = null;
      sheetPopoutWindowRef.current = null;
      setSheetPopoutOpen(false);
      window.alert('Unable to open the sheet pop-out window. Please try again.');
    }
  };

  useEffect(() => {
    if (!sheetPopoutOpen) return;
    const popout = sheetPopoutWindowRef.current;
    if (!popout || popout.closed) {
      setSheetPopoutOpen(false);
      sheetPopoutWindowRef.current = null;
      sheetPopoutRootRef.current = null;
      return;
    }
    if (!editorOpen || !selected || editorMode !== 'sheet') {
      closeSheetPopout(true, { suppressSessionEnd: true });
      return;
    }
    popout.document.title = `${selected.name} — Character Sheet`;
  }, [sheetPopoutOpen, editorOpen, selected, editorMode]);

  useEffect(() => {
    if (!sheetPopoutOpen) return;
    const popout = sheetPopoutWindowRef.current;
    if (!popout || popout.closed) return;

    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (listEditorMode) {
        if (listEditorMode === 'spellbook' && activeSpellDraftId) {
          setActiveSpellDraftId('');
          return;
        }
        if (listEditorMode === 'features' && featureRawEditorOpen) {
          setFeatureRawEditorOpen(false);
          return;
        }
        setListEditorMode('');
        return;
      }
      if (editorOpen) setEditorOpen(false);
    };

    popout.addEventListener('keydown', onKeyDown);
    return () => popout.removeEventListener('keydown', onKeyDown);
  }, [sheetPopoutOpen, listEditorMode, activeSpellDraftId, featureRawEditorOpen, editorOpen]);

  useEffect(() => {
    return () => {
      closeSheetPopout(true, { suppressSessionEnd: true });
    };
  }, []);

  const toggleCastorWilliamResourceSync = () => {
    if (!canManageCombat) return;
    setEncounter((prev) => {
      const next = normalize(prev);
      const enabling = !next.castorWilliamResourceSync;
      next.castorWilliamResourceSync = enabling;
      if (!enabling) return next;

      const pair = findCastorWilliamPair(next.combatants);
      if (!pair.castor || !pair.william) return next;
      const source =
        selectedId === pair.william.id
          ? pair.william
          : selectedId === pair.castor.id
            ? pair.castor
            : pair.castor;
      const syncPatch = resourceSyncPatchFromCombatant(source);
      next.combatants = next.combatants.map((combatant) => {
        if (combatant.id !== pair.castor.id && combatant.id !== pair.william.id) return combatant;
        return { ...combatant, ...cloneCastorWilliamResourcePatch(syncPatch) };
      });
      return next;
    });
  };

  const addCombatant = (c) => {
    if (!canWriteCombat) return;
    const incomingCombatant = stampCombatantCreator(c);
    setEncounter(prev => {
      const next = normalize(prev);
      const profileKey = sheetProfileKey(incomingCombatant.sourceCharacterId, incomingCombatant.name);
      const profile = profileKey ? next.sheetProfiles?.[profileKey] : null;
      const nextCombatant = profile ? applySheetProfileToCombatant(incomingCombatant, profile) : incomingCombatant;
      const activeId = next.combatants[next.activeIndex]?.id || null;
      next.combatants = sortCombatants([...next.combatants, nextCombatant]);
      if (next.combatants.length === 0) next.activeIndex = 0;
      else if (activeId) {
        const idx = next.combatants.findIndex(x => x.id === activeId);
        next.activeIndex = idx >= 0 ? idx : clamp(next.activeIndex, 0, next.combatants.length - 1);
      } else {
        next.activeIndex = clamp(next.activeIndex, 0, next.combatants.length - 1);
      }
      return next;
    });
    setSelectedId(incomingCombatant.id);
  };

  const addFromDraft = () => {
    if (!canWriteCombat) return;
    const name = String(draft.name || '').trim();
    if (!name) return;
    addCombatant({
      id: uid(), name, role: '', side: draft.side||'Enemy',
      init: toInt(draft.init,10),
      initiativeBonus: 0,
      proficiencyBonus: null,
      spellSaveDC: null,
      attackModifier: null,
      spellAttackModifier: null,
      hp: draft.hp==='' ? '' : toInt(draft.hp,0),
      maxHP: draft.maxHP==='' ? '' : toInt(draft.maxHP,0),
      ac: draft.ac==='' ? '' : toInt(draft.ac,0),
      speed: '',
      race: '',
      className: '',
      level: '',
      abilities: defaultAbilities(),
      savingThrows: [],
      skills: [],
      senses: [],
      spellbookEntries: [],
      spellList: [],
      classFeatures: [],
      tempHP:0, status:[], concentration:'', notes:'', spellSlots: defaultSpellSlots(), featureCharges: [], dead:false,
      hideSensitiveStats: false,
      notableFeature: '',
      equipmentItems:[], otherPossessions:[],
      sourceSheet: false,
      sourceSheetFileName: '',
      sourceSheetFormat: '',
      sheetWarnings: [],
      sheetMissingFields: [],
      sheetUnknownFields: [],
      sheetImportedAt: 0,
      enemyType: draft.enemyType || 'goblin', customImage:'',
      sourceCharacterId:'',
      pcColorIndex: combatants.length % PC_COLORS.length,
    });
    setDraft(d => ({ ...d, name:'' }));
  };

  const addAdventurer = () => {
    if (!canWriteCombat) return;
    const adv = adventurers.find(a => a.name === adventurerPick);
    if (!adv) return;
    const existingNames = new Set(combatants.map(x => x.name));
    addCombatant({
      id: uid(), name: uniqueName(existingNames, adv.name), role: adv.role,
      side: adventurerSide, init:10, hp: adv.hp, maxHP: adv.maxHP, ac: adv.ac,
      initiativeBonus: 0,
      proficiencyBonus: null,
      spellSaveDC: null,
      attackModifier: null,
      spellAttackModifier: null,
      speed: '',
      race: '',
      className: adv.role || '',
      level: '',
      abilities: defaultAbilities(),
      savingThrows: [],
      skills: [],
      senses: [],
      spellbookEntries: [],
      spellList: [],
      classFeatures: [],
      tempHP:0, status:[], concentration:'', notes:'', spellSlots: defaultSpellSlots(), featureCharges: [], dead:false,
      hideSensitiveStats: false,
      notableFeature: '',
      equipmentItems:[], otherPossessions:[],
      sourceSheet: false,
      sourceSheetFileName: '',
      sourceSheetFormat: '',
      sheetWarnings: [],
      sheetMissingFields: [],
      sheetUnknownFields: [],
      sheetImportedAt: 0,
      enemyType:'goblin', customImage: tokenImageForCharacter(adv.id, adv.name),
      sourceCharacterId: adv.id || '',
      pcColorIndex: combatants.length % PC_COLORS.length,
    });
  };

  const removeCombatant = (id) => {
    const target = combatants.find((combatant) => combatant.id === id);
    if (!target || !canRemoveCombatant(target)) return;
    setEncounter(prev => {
      const next = normalize(prev);
      const idx = next.combatants.findIndex(x => x.id === id);
      next.combatants = next.combatants.filter(x => x.id !== id);
      if (next.combatants.length === 0) next.activeIndex = 0;
      else if (idx >= 0) next.activeIndex = clamp(next.activeIndex, 0, next.combatants.length - 1);
      return next;
    });
    if (selectedId === id) {
      setSelectedId(null);
      setEditorOpen(false);
      setRestrictedModalOpen(false);
    }
  };

  const toggleDead = (id) => {
    const target = combatants.find((combatant) => combatant.id === id);
    if (!target || !canControlCombatant(target)) return;
    setEncounter(prev => {
      const next = normalize(prev);
      next.combatants = next.combatants.map(x => x.id === id ? { ...x, dead: !x.dead } : x);
      return next;
    });
  };

  const gotoNext = () => {
    if (!canWriteCombat) return;
    setInitSlideDirection('next');
    setInitSlideTick((t) => t + 1);
    setEncounter(prev => {
      const next = normalize(prev);
      if (next.combatants.length === 0) return next;
      const i = next.activeIndex + 1;
      if (i >= next.combatants.length) { next.round = toInt(next.round,1)+1; next.activeIndex=0; }
      else next.activeIndex = i;
      return next;
    });
  };

  const gotoPrev = () => {
    if (!canWriteCombat) return;
    setInitSlideDirection('prev');
    setInitSlideTick((t) => t + 1);
    setEncounter(prev => {
      const next = normalize(prev);
      if (next.combatants.length === 0) return next;
      const i = next.activeIndex - 1;
      if (i < 0) { next.round = Math.max(1,toInt(next.round,1)-1); next.activeIndex = Math.max(0,next.combatants.length-1); }
      else next.activeIndex = i;
      return next;
    });
  };

  const setSelectedField = (patch) => {
    if (!selected || !selectedCanEdit) return;
    setEncounter(prev => {
      const next = normalize(prev);
      const previousProfileKey = sheetProfileKey(selected.sourceCharacterId, selected.name);
      const activeId = next.combatants[next.activeIndex]?.id || null;
      const pair = findCastorWilliamPair(next.combatants);
      const syncRole = castorWilliamSyncRole(selected);
      const mirrorTargetId =
        syncRole === 'castor'
          ? pair.william?.id || ''
          : syncRole === 'william'
            ? pair.castor?.id || ''
            : '';
      const mirroredResourcePatch =
        next.castorWilliamResourceSync && mirrorTargetId
          ? pickCastorWilliamResourcePatch(patch)
          : null;
      next.combatants = next.combatants.map((combatant) => {
        if (combatant.id === selected.id) return { ...combatant, ...patch };
        if (mirroredResourcePatch && combatant.id === mirrorTargetId) {
          return { ...combatant, ...cloneCastorWilliamResourcePatch(mirroredResourcePatch) };
        }
        return combatant;
      });
      const updatedSelected = next.combatants.find((x) => x.id === selected.id);
      if (updatedSelected) {
        const nextProfileKey = sheetProfileKey(updatedSelected.sourceCharacterId, updatedSelected.name);
        if (nextProfileKey && (updatedSelected.sourceSheet || next.sheetProfiles?.[nextProfileKey] || next.sheetProfiles?.[previousProfileKey])) {
          const nextProfiles = { ...(next.sheetProfiles || {}) };
          if (previousProfileKey && previousProfileKey !== nextProfileKey) delete nextProfiles[previousProfileKey];
          nextProfiles[nextProfileKey] = buildSheetProfileFromCombatant(updatedSelected);
          next.sheetProfiles = nextProfiles;
        }
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'init') || Object.prototype.hasOwnProperty.call(patch, 'side') || Object.prototype.hasOwnProperty.call(patch, 'name')) {
        next.combatants = sortCombatants(next.combatants);
        if (next.combatants.length === 0) next.activeIndex = 0;
        else if (activeId) {
          const idx = next.combatants.findIndex(x => x.id === activeId);
          next.activeIndex = idx >= 0 ? idx : clamp(next.activeIndex, 0, next.combatants.length - 1);
        } else {
          next.activeIndex = clamp(next.activeIndex, 0, next.combatants.length - 1);
        }
      }
      return next;
    });
  };

  const toggleSelectedSensitiveStats = () => {
    if (!selected || !selectedCanEdit) return;
    setSelectedField({ hideSensitiveStats: !selected.hideSensitiveStats });
  };

  const adjustSelectedTempHp = (delta) => {
    if (!selected) return;
    const current = Math.max(0, toInt(selected.tempHP, 0));
    setSelectedField({ tempHP: Math.max(0, current + delta) });
  };

  const updateSelectedTempHp = (raw) => {
    if (!selected) return;
    const text = String(raw ?? '').trim();
    if (!text) {
      setSelectedField({ tempHP: 0 });
      return;
    }
    setSelectedField({ tempHP: Math.max(0, toInt(text, 0)) });
  };

  const applyHpAdjustment = (kind) => {
    if (!selected) return;
    const amount = Math.abs(toInt(hpAdjustAmount, 0));
    if (amount <= 0) return;

    const hp = selected.hp === '' ? 0 : toInt(selected.hp, 0);
    const maxHP = selected.maxHP === '' ? null : toInt(selected.maxHP, 0);
    const tempHP = toInt(selected.tempHP, 0);

    if (kind === 'damage') {
      let remaining = amount;
      const absorbedByTemp = Math.min(tempHP, remaining);
      remaining -= absorbedByTemp;
      const nextTempHP = tempHP - absorbedByTemp;
      const nextHP = Math.max(0, hp - remaining);
      setSelectedField({ hp: nextHP, tempHP: nextTempHP });
      return;
    }

    const healed = hp + amount;
    const nextHP = maxHP != null && maxHP > 0 ? Math.min(maxHP, healed) : healed;
    setSelectedField({ hp: nextHP });
  };

  const setSpellSlotField = (level, patch) => {
    if (!selected) return;
    const slots = normalizeSpellSlots(selected.spellSlots);
    const nextSlots = slots.map((slot) => {
      if (slot.level !== level) return slot;
      const merged = typeof patch === 'function' ? patch(slot) : { ...slot, ...patch };
      const max = clamp(toInt(merged.max, 0), 0, 20);
      const current = clamp(toInt(merged.current, max), 0, max);
      return { level, max, current };
    });
    setSelectedField({ spellSlots: nextSlots });
  };

  const nudgeSpellSlotMax = (level, delta) => {
    setSpellSlotField(level, (slot) => ({ ...slot, max: slot.max + delta }));
  };

  const setSpellSlotsFromBox = (level, boxIndex) => {
    setSpellSlotField(level, (slot) => {
      const clickedValue = boxIndex + 1;
      const nextCurrent = clickedValue === slot.current ? clickedValue - 1 : clickedValue;
      return { ...slot, current: nextCurrent };
    });
  };

  const setFeatureChargeField = (id, patch) => {
    if (!selected) return;
    const charges = normalizeFeatureCharges(selected.featureCharges);
    const nextCharges = charges.map((charge) => {
      if (charge.id !== id) return charge;
      const merged = typeof patch === 'function' ? patch(charge) : { ...charge, ...patch };
      return {
        id: charge.id,
        name: cleanText(merged.name) || charge.name,
        max: clamp(toInt(merged.max, charge.max), 0, 20),
        current: clamp(toInt(merged.current, charge.current), 0, clamp(toInt(merged.max, charge.max), 0, 20)),
      };
    });
    setSelectedField({ featureCharges: nextCharges });
  };

  const addFeatureCharge = () => {
    if (!selected) return;
    const charges = normalizeFeatureCharges(selected.featureCharges);
    const id = createId('feature');
    const next = [...charges, { id, name: `Feature ${charges.length + 1}`, max: 0, current: 0 }];
    setSelectedField({ featureCharges: next });
  };

  const removeFeatureCharge = (id) => {
    if (!selected) return;
    const charges = normalizeFeatureCharges(selected.featureCharges);
    setSelectedField({ featureCharges: charges.filter((charge) => charge.id !== id) });
  };

  const nudgeFeatureChargeMax = (id, delta) => {
    setFeatureChargeField(id, (charge) => ({ ...charge, max: charge.max + delta }));
  };

  const setFeatureChargesFromBox = (id, boxIndex) => {
    setFeatureChargeField(id, (charge) => {
      const clickedValue = boxIndex + 1;
      const nextCurrent = clickedValue === charge.current ? clickedValue - 1 : clickedValue;
      return { ...charge, current: nextCurrent };
    });
  };

  const updateFeatureChargeName = (id, rawName) => {
    if (!selected) return;
    const charges = normalizeFeatureCharges(selected.featureCharges);
    const next = charges.map((charge) => (charge.id === id ? { ...charge, name: String(rawName || '') } : charge));
    setSelectedField({ featureCharges: next });
  };

  const longRestSelected = () => {
    if (!selected) return;
    const maxHP = selected.maxHP === '' ? '' : toInt(selected.maxHP, 0);
    const nextHP = maxHP === '' ? selected.hp : maxHP;
    const nextSpellSlots = normalizeSpellSlots(selected.spellSlots).map((slot) => ({
      ...slot,
      current: slot.max,
    }));
    const nextFeatureCharges = normalizeFeatureCharges(selected.featureCharges).map((feature) => ({
      ...feature,
      current: feature.max,
    }));

    setStatusDraft('');
    setSelectedField({
      hp: nextHP,
      tempHP: 0,
      status: [],
      concentration: '',
      spellSlots: nextSpellSlots,
      featureCharges: nextFeatureCharges,
    });
  };

  const resetEncounter = () => {
    if (!canManageCombat) return;
    setEncounter(prev => {
      const next = normalize(prev);
      next.round=1; next.activeIndex=0;
      next.combatants = next.combatants.map(x => ({ ...x, dead:false, status:[], concentration:'', tempHP:0, notes:'' }));
      return next;
    });
  };

  const clearEncounter = () => {
    if (!canManageCombat) return;
    setEncounter((prev) => {
      const next = defaultEncounter();
      const prior = normalize(prev);
      next.sheetProfiles = prior.sheetProfiles || {};
      return next;
    });
    setSelectedId(null);
    setEditorOpen(false);
    setRestrictedModalOpen(false);
  };
  const openEditorFor = (id, forceMode = '') => {
    const target = combatants.find((c) => c.id === id);
    if (!target) return;
    setSelectedId(id);
    if (!canControlCombatant(target)) {
      setEditorOpen(false);
      setListEditorMode('');
      setActiveSpellDraftId('');
      setFeatureRawEditorOpen(false);
      setRestrictedModalOpen(true);
      return;
    }
    setRestrictedModalOpen(false);
    setEditorMode(forceMode || (target?.sourceSheet ? 'sheet' : 'edit'));
    setEditorOpen(true);
  };

  const triggerSheetImport = (targetId, replacing = false) => {
    const target = combatants.find((c) => c.id === targetId);
    if (!target || !canControlCombatant(target)) return;
    if (replacing && target.sourceSheet) {
      const ok = window.confirm(`Replace imported sheet for ${target.name}?`);
      if (!ok) return;
    }
    setSheetImportState({
      running: false,
      progress: 0,
      stage: '',
      targetId: target.id,
      message: '',
      error: '',
    });
    if (sheetFileInputRef.current) {
      sheetFileInputRef.current.value = '';
      sheetFileInputRef.current.click();
    }
  };

  const cancelSheetImport = () => {
    if (sheetImportAbortRef.current) sheetImportAbortRef.current.abort();
  };

  const handleSheetFilePick = async (event) => {
    const file = event.target.files?.[0];
    const targetId = sheetImportState.targetId || selectedId;
    if (!file || !targetId) return;

    const target = combatants.find((c) => c.id === targetId);
    if (!target || !canControlCombatant(target)) return;

    if (sheetImportAbortRef.current) sheetImportAbortRef.current.abort();
    const controller = new AbortController();
    sheetImportAbortRef.current = controller;
    setSheetImportState((prev) => ({
      ...prev,
      running: true,
      progress: 5,
      stage: 'starting',
      message: '',
      error: '',
      targetId,
    }));

    try {
      const parsedResult = await parseCharacterSheetFile(file, {
        signal: controller.signal,
        onProgress: ({ progress, stage }) => {
          setSheetImportState((prev) => ({
            ...prev,
            running: true,
            progress: Number.isFinite(progress) ? progress : prev.progress,
            stage: stage || prev.stage,
          }));
        },
      });

      setEncounter((prev) => {
        const next = normalize(prev);
        let updatedCombatant = null;
        next.combatants = next.combatants.map((combatant) => {
          if (combatant.id !== targetId) return combatant;
          updatedCombatant = { ...combatant, ...buildSheetPatch(combatant, parsedResult) };
          return updatedCombatant;
        });
        if (updatedCombatant) {
          const key = sheetProfileKey(updatedCombatant.sourceCharacterId, updatedCombatant.name);
          if (key) {
            next.sheetProfiles = {
              ...(next.sheetProfiles || {}),
              [key]: buildSheetProfileFromCombatant(updatedCombatant),
            };
          }
        }
        return next;
      });

      setSelectedId(targetId);
      setEditorOpen(true);
      setEditorMode('sheet');
      setSheetImportState((prev) => ({
        ...prev,
        running: false,
        progress: 100,
        stage: 'complete',
        message: `Imported sheet for ${parsedResult.parsed?.name || target.name}.`,
        error: '',
      }));
    } catch (error) {
      if (error?.name === 'AbortError') {
        setSheetImportState((prev) => ({
          ...prev,
          running: false,
          message: '',
          error: 'Import cancelled.',
        }));
      } else {
        setSheetImportState((prev) => ({
          ...prev,
          running: false,
          message: '',
          error: error?.message || 'Import failed.',
        }));
      }
    } finally {
      sheetImportAbortRef.current = null;
      event.target.value = '';
    }
  };

  const createSpellbookDraftEntry = (level = null) => ({
    id: createId('spell'),
    name: '',
    level,
    source: '',
    saveAtk: '',
    effect: '',
    time: '',
    range: '',
    components: '',
    duration: '',
    prepared: '',
    notes: '',
  });

  const addSpellbookDraftEntry = (level = null) => {
    if (!selectedCanEdit) return;
    const entry = createSpellbookDraftEntry(level);
    setSpellbookDraftEntries((prev) => [...prev, entry]);
    setActiveSpellDraftId(entry.id);
  };

  const updateSpellbookDraftEntry = (id, patch) => {
    if (!selectedCanEdit) return;
    setSpellbookDraftEntries((prev) => prev.map((entry) => {
      if (entry.id !== id) return entry;
      const next = { ...entry, ...patch };
      if (Object.prototype.hasOwnProperty.call(patch, 'name')) next.name = String(patch.name ?? '');
      if (Object.prototype.hasOwnProperty.call(patch, 'source')) next.source = String(patch.source ?? '');
      if (Object.prototype.hasOwnProperty.call(patch, 'saveAtk')) next.saveAtk = String(patch.saveAtk ?? '');
      if (Object.prototype.hasOwnProperty.call(patch, 'effect')) next.effect = String(patch.effect ?? '');
      if (Object.prototype.hasOwnProperty.call(patch, 'time')) next.time = String(patch.time ?? '');
      if (Object.prototype.hasOwnProperty.call(patch, 'range')) next.range = String(patch.range ?? '');
      if (Object.prototype.hasOwnProperty.call(patch, 'components')) next.components = String(patch.components ?? '');
      if (Object.prototype.hasOwnProperty.call(patch, 'duration')) next.duration = String(patch.duration ?? '');
      if (Object.prototype.hasOwnProperty.call(patch, 'notes')) next.notes = String(patch.notes ?? '');
      if (Object.prototype.hasOwnProperty.call(patch, 'prepared')) next.prepared = normalizeSpellPrepared(patch.prepared);
      if (Object.prototype.hasOwnProperty.call(patch, 'level')) next.level = normalizeSpellLevel(patch.level, null);
      return next;
    }));
  };

  const removeSpellbookDraftEntry = (id) => {
    if (!selectedCanEdit) return;
    setSpellbookDraftEntries((prev) => prev.filter((entry) => entry.id !== id));
    setActiveSpellDraftId((prev) => (prev === id ? '' : prev));
  };

  const saveListEditor = () => {
    if (!selected || !listEditorMode || !selectedCanEdit) return;
    if (listEditorMode === 'spellbook') {
      const normalizedEntries = normalizeSpellbookEntries(spellbookDraftEntries);
      const spellList = normalizeStringList(normalizedEntries.map((entry) => entry.name));
      setSelectedField({ spellbookEntries: normalizedEntries, spellList });
      setActiveSpellDraftId('');
    } else if (listEditorMode === 'features') {
      setSelectedField({ classFeatures: normalizeStringList(listEditorText) });
    }
    setListEditorMode('');
  };

  // image upload — opens crop modal instead of applying directly
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !selected || !selectedCanEdit) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCropSrc(ev.target.result);
      setCropZoom(1);
      setCropOffset({ x: 0, y: 0 });
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
    // reset input so same file can be re-picked
    e.target.value = '';
  };

  const clampCropOffset = (zoom = cropZoom) => {
    const img = cropImgRef.current;
    if (!img) return;
    const iw = img.naturalWidth || 1;
    const ih = img.naturalHeight || 1;
    const base = Math.max(CROP_BOX / iw, CROP_BOX / ih);
    const scale = base * zoom;
    const rw = iw * scale;
    const rh = ih * scale;
    const maxX = Math.max(0, (rw - CROP_BOX) / 2);
    const maxY = Math.max(0, (rh - CROP_BOX) / 2);
    setCropOffset(o => ({ x: clamp(o.x, -maxX, maxX), y: clamp(o.y, -maxY, maxY) }));
  };

  const applyCrop = () => {
    const img = cropImgRef.current;
    if (!img) return;
    const iw = img.naturalWidth || 1;
    const ih = img.naturalHeight || 1;
    const base = Math.max(CROP_BOX / iw, CROP_BOX / ih);
    const scale = base * cropZoom;
    const rw = iw * scale;
    const rh = ih * scale;
    const imgLeft = (CROP_BOX / 2) - (rw / 2) + cropOffset.x;
    const imgTop  = (CROP_BOX / 2) - (rh / 2) + cropOffset.y;
    let sx = (-imgLeft) / scale;
    let sy = (-imgTop)  / scale;
    const sw = CROP_BOX / scale;
    const sh = CROP_BOX / scale;
    sx = clamp(sx, 0, Math.max(0, iw - sw));
    sy = clamp(sy, 0, Math.max(0, ih - sh));
    const out = 256;
    const canvas = document.createElement('canvas');
    canvas.width = out; canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, out, out);
    setSelectedField({ customImage: canvas.toDataURL('image/png') });
    setCropOpen(false);
  };

  // ── Dimensions ─────────────────────────────────────────────────────────────
  const HUD_GAP = 10;
  const WINDOW_BAR_H = 40;
  const PAD    = 14;
  const WINDOW_MAX_W = 1560;

  // ── Shared class helpers ────────────────────────────────────────────────────
  const btnClass = (variant = 'gold', size = 'md', extra = '') => {
    const variantClass = variant === 'danger' ? styles.btnDanger : variant === 'ghost' ? styles.btnGhost : styles.btnGold;
    const sizeClass = size === 'sm' ? styles.btnSmall : '';
    return [styles.btnBase, variantClass, sizeClass, extra].filter(Boolean).join(' ');
  };
  const iconMiniBtnClass = (variant = 'ghost') => [styles.btnIconMini, variant === 'danger' ? styles.btnIconDanger : styles.btnIconGhost].join(' ');
  const enemyTypeBtnClass = (activeType) => [styles.enemyTypeBtn, activeType ? styles.enemyTypeBtnActive : ''].filter(Boolean).join(' ');
  const sheetImportStageLabel = sheetImportState.stage
    ? sheetImportState.stage.replace(/[-_]/g, ' ').toUpperCase()
    : 'IMPORTING';
  const selectedSheetIssues = useMemo(() => {
    if (!selected) return [];
    return [
      ...normalizeStringList(selected.sheetMissingFields).map((line) => ({ kind: 'Missing Fields', text: line })),
      ...normalizeStringList(selected.sheetWarnings).map((line) => ({ kind: 'Warning', text: line })),
    ];
  }, [selected]);
  const popoutWindow = sheetPopoutWindowRef.current;
  const isSheetPopoutActive = !!(
    sheetPopoutOpen
    && editorOpen
    && selected
    && editorMode === 'sheet'
    && popoutWindow
    && !popoutWindow.closed
    && sheetPopoutRootRef.current
  );
  const sheetPortalHost = isSheetPopoutActive ? sheetPopoutRootRef.current : null;
  const shouldRenderEditorInline = !!(editorOpen && selected && !(editorMode === 'sheet' && isSheetPopoutActive));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ShellLayout
      active={active}
      style={{ alignItems: 'stretch', justifyContent: 'stretch', fontFamily: 'var(--koa-font-display)' }}
    >
      <div className={styles.root}>

        {/* ── HEADER ── */}
        <div ref={headerRef} className={styles.header}>
          <div className={styles.headerRow}>
            <button
              onClick={() => { cinematicNav('menu'); }}
              onMouseEnter={playHover}
              className={styles.returnBtn}
            >
              ← RETURN
            </button>

            <div className={styles.titleWrap}>
              <div className={styles.titleKicker}>
                ✦ &nbsp; BATTLEFIELD COMMAND &nbsp; ✦
              </div>
              <div className={styles.titleMain}>
                COMBAT TRACKER
              </div>
            </div>

            <div className={styles.headerSpacer} />
          </div>
        </div>

        {/* ── COMBAT WINDOW (separate from header) ── */}
        <div
          className={styles.combatWindow}
          style={{
            width: `min(${WINDOW_MAX_W}px, calc(100% - ${PAD * 2}px))`,
            top: headerH + HUD_GAP,
            bottom: PAD,
          }}
        >
          {/* Vignette overlay */}
          <div className={styles.windowVignette} />

          {/* ── WINDOW CONTROLS (moved out of top header) ── */}
          <div
            className={styles.windowControls}
            style={{
              left: PAD,
              right: PAD,
              top: PAD,
              height: WINDOW_BAR_H,
            }}
          >
            <div />

            <div className={styles.windowControlsCenter}>
                {canManageCombat && (
                  <button
                    className={btnClass('gold')}
                    onMouseEnter={playHover}
                    onClick={() => { playNav(); gotoPrev(); }}
                    disabled={!canWriteCombat}
                  >
                    ◀ Prev
                  </button>
                )}
                <div className={styles.roundBadge}>
                  <span className={styles.roundLabel}>Round</span>
                  <span className={styles.roundValue}>{encounter.round}</span>
                </div>
                {canManageCombat && (
                  <button
                    className={btnClass('gold')}
                    onMouseEnter={playHover}
                    onClick={() => { playNav(); gotoNext(); }}
                    disabled={!canWriteCombat}
                  >
                    Next ▶
                  </button>
                )}
              </div>

            <div className={styles.controlsRight}>
              <label className={styles.sceneLabel}>Scene</label>
              <select
                value={battleBg || ''}
                onChange={e => {
                  if (!canWriteCombat) return;
                  playNav();
                  setBattleBg(e.target.value || null);
                }}
                onMouseEnter={playHover}
                className={styles.sceneSelect}
                disabled={!canWriteCombat}
              >
                {BATTLE_BACKGROUNDS.map((b, i) => (
                  <option key={i} value={b.src || ''}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

        {/* ── MAIN LAYOUT ── */}
        <div
          className={styles.mainLayout}
          style={{
            left: PAD,
            right: PAD,
            top: PAD + WINDOW_BAR_H + 8,
            bottom: PAD,
          }}
        >
          <div className={styles.battlefieldWrap}>
            <div className={styles.battlefieldInner}>
              <BattlefieldScene
                combatants={combatants}
                activeCombatantId={activeCombatantId}
                selectedId={selectedId}
                openEditorFor={openEditorFor}
                playHover={playHover}
                playNav={playNav}
                battleBg={battleBg}
              />

              <div className={styles.initOverlay}>
                <div className={styles.initStrip}>
                  <div className={styles.initHeaderGrid}>
                    <div />
                    <div className={styles.initHeaderCenter}>
                      <div className={styles.initHeading}>Initiative</div>
                      <div className={styles.initButtons}>
                        <button className={btnClass('gold', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); setAddModalOpen(true); }} disabled={!canWriteCombat}>+ Add</button>
                        <button className={btnClass('gold', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); resetEncounter(); }} disabled={!canManageCombat}>Reset</button>
                        <button className={btnClass('danger', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); clearEncounter(); }} disabled={!canManageCombat}>Clear</button>
                      </div>
                    </div>
                    <div />
                  </div>

                  <div className={styles.initScroll}>
                    {combatants.length === 0 ? (
                      <div className={styles.initEmpty}>
                        Click <b className={styles.initEmptyAdd}>+ Add</b> to begin.
                      </div>
                    ) : (
                      <div className={styles.initCardsViewport}>
                        <div
                          key={`${activeCombatantId || 'none'}-${initSlideTick}`}
                          className={`${styles.initCardsRow} ${
                            initSlideDirection === 'next' ? styles.initCardsRowNext : styles.initCardsRowPrev
                          }`}
                        >
                          {initiativeSlots.map((c, slotIndex) => {
                            if (!c) {
                              return <div key={`slot-empty-${slotIndex}`} className={styles.initCardGhost} />;
                            }
                            const isActive = c.id === activeCombatantId;
                            const isSelected = c.id === selectedId;
                            const hp = c.hp === '' ? 0 : toInt(c.hp, 0);
                            const max = c.maxHP === '' ? 0 : toInt(c.maxHP, 0);
                            const pct = max > 0 ? (hp / max) * 100 : 100;
                            const hpColor =
                              pct > 50
                                ? 'rgba(80,200,120,0.80)'
                                : pct > 20
                                  ? 'rgba(230,170,40,0.80)'
                                  : 'rgba(220,70,70,0.80)';
                            const cardClass = [
                              styles.initCard,
                              isActive ? styles.initCardActive : '',
                              !isActive && isSelected ? styles.initCardSelected : '',
                              c.dead ? styles.initCardDead : '',
                            ].filter(Boolean).join(' ');
                            const initClass = [styles.initValue, isActive ? styles.initValueActive : ''].filter(Boolean).join(' ');

                            return (
                              <div
                                key={c.id}
                                onClick={() => openEditorFor(c.id)}
                                onMouseEnter={playHover}
                                className={cardClass}
                              >
                                <div className={styles.initCardTop}>
                                  <div className={styles.sideDot} style={{ background: sideAccent(c.side), boxShadow: `0 0 6px ${sideAccent(c.side)}` }} />
                                  <div className={initClass}>{toInt(c.init, 0)}</div>
                                  <div className={styles.initNameWrap}>
                                    <div className={styles.initName} style={{ textDecoration: c.dead ? 'line-through' : 'none' }}>
                                      {c.name}
                                    </div>
                                    {c.role && <div className={styles.initRole}>{c.role}</div>}
                                  </div>
                                  <div className={styles.initHp} style={{ color: hpColor }}>
                                    {c.hp === '' ? '—' : c.hp}
                                  </div>
                                  <div className={styles.initActions}>
                                    <button
                                      title={c.dead ? 'Revive' : 'Mark dead'}
                                      onClick={(e) => { e.stopPropagation(); playNav(); toggleDead(c.id); }}
                                      onMouseEnter={playHover}
                                      className={iconMiniBtnClass(c.dead ? 'danger' : 'ghost')}
                                      disabled={!canControlCombatant(c)}
                                    >
                                      ☠
                                    </button>
                                    <button
                                      title="Remove"
                                      onClick={(e) => { e.stopPropagation(); playNav(); removeCombatant(c.id); }}
                                      onMouseEnter={playHover}
                                      className={iconMiniBtnClass('danger')}
                                      disabled={!canRemoveCombatant(c)}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>

                                <div className={styles.initHpTrack}>
                                  <div className={styles.initHpFill} style={{ width: `${clamp(pct, 0, 100)}%`, background: hpGradient(pct) }} />
                                </div>

                                {isActive && <div className={styles.activeTurnTag}>▶ ACTIVE TURN</div>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <input
          ref={sheetFileInputRef}
          type="file"
          accept=".pdf,.json,.txt"
          className={styles.hiddenInput}
          onChange={handleSheetFilePick}
          aria-label="Import character sheet"
        />

        {/* ── ADD MODAL ── */}
        {addModalOpen && (
          <div className={styles.modalBack}>
            <div className={`${styles.modalCard} ${styles.addModal}`}>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitle}>Add Combatants</div>
                <button className={btnClass('danger', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); setAddModalOpen(false); }}>Close</button>
              </div>

              {!canWriteCombat && (
                <div className={styles.lockedHint}>
                  Read-only. You do not have permission to modify combat.
                </div>
              )}
              <fieldset className={styles.editorFieldset} disabled={!canWriteCombat}>
              <div className={`${styles.addModalBody} koa-scrollbar-thin`}>
                {/* Add Adventurer */}
                <div>
                  <div className={styles.addSectionTitle}>Add Adventurer</div>
                  <div className={styles.twoCol}>
                    <div><div className={styles.label}>Adventurer</div>
                      <select className={`${styles.input} ${styles.selectInput}`} value={adventurerPick} onChange={e => setAdventurerPick(e.target.value)}>
                        {adventurers.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                      </select>
                    </div>
                    <div><div className={styles.label}>Side</div>
                      <select className={`${styles.input} ${styles.selectInput}`} value={adventurerSide} onChange={e => setAdventurerSide(e.target.value)}>
                        <option value="PC">PC</option><option value="Ally">Ally</option>
                      </select>
                    </div>
                  </div>
                  {(() => {
                    const adv = adventurers.find(a => a.name === adventurerPick);
                    if (!adv) return null;
                    const tokenSrc = tokenImageForCharacter(adv.id, adv.name);
                    return (
                      <div className={styles.previewCard}>
                        <div className={styles.previewName}>{adv.name}</div>
                        <div>{adv.role} · HP {adv.hp}/{adv.maxHP} · AC {adv.ac}</div>
                        {tokenSrc && (
                          <div className={styles.sectionTopGap}>
                            <div className={styles.label}>Token</div>
                            <div className={styles.tokenPreview}>
                              <img src={tokenSrc} alt={`${adv.name} token`} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <button
                    className={btnClass('gold', 'md', styles.btnFull)}
                    onMouseEnter={playHover}
                    onClick={() => { playNav(); addAdventurer(); }}
                    disabled={!canWriteCombat}
                  >
                    + Add Adventurer
                  </button>
                </div>

                {/* Add Custom */}
                <div>
                  <div className={styles.addSectionTitle}>Add Custom (Enemies / Extras)</div>
                  <div className={styles.nameInitGrid}>
                    <div><div className={styles.label}>Name</div>
                      <input className={styles.input} value={draft.name} placeholder="Goblin / Skeleton #2"
                        onChange={e => setDraft(d => ({ ...d, name:e.target.value }))}/>
                    </div>
                    <div><div className={styles.label}>Init</div>
                      <input className={styles.input} value={draft.init} onChange={e => setDraft(d => ({ ...d, init:e.target.value }))}/>
                    </div>
                  </div>
                  <div className={styles.threeCol}>
                    <div><div className={styles.label}>HP</div><input className={styles.input} value={draft.hp} onChange={e => setDraft(d => ({ ...d, hp:e.target.value }))}/></div>
                    <div><div className={styles.label}>Max HP</div><input className={styles.input} value={draft.maxHP} onChange={e => setDraft(d => ({ ...d, maxHP:e.target.value }))}/></div>
                    <div><div className={styles.label}>AC</div><input className={styles.input} value={draft.ac} onChange={e => setDraft(d => ({ ...d, ac:e.target.value }))}/></div>
                  </div>
                  <div className={styles.sideOnlyRow}><div className={styles.label}>Side</div>
                    <select className={`${styles.input} ${styles.selectInput}`} value={draft.side} onChange={e => setDraft(d => ({ ...d, side:e.target.value }))}>
                      <option value="Enemy">Enemy</option><option value="PC">PC</option><option value="Ally">Ally</option>
                    </select>
                  </div>
                  {draft.side === 'Enemy' && (
                    <div className={`${styles.sectionTopGap} ${styles.addCustomEnemyTypeSection}`}>
                      <div className={styles.label}>Enemy Type</div>
                      <div className={styles.enemyTypeRow}>
                        {ENEMY_TYPES.map(et => (
                          <button key={et.key}
                            onClick={() => setDraft(d => ({ ...d, enemyType:et.key }))}
                            onMouseEnter={playHover}
                            className={enemyTypeBtnClass(draft.enemyType===et.key)}>{et.label}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    className={btnClass('gold', 'md', styles.btnFull)}
                    onMouseEnter={playHover}
                    onClick={() => { playNav(); addFromDraft(); }}
                    disabled={!canWriteCombat}
                  >
                    + Add Custom
                  </button>
                </div>
              </div>
              </fieldset>
            </div>
          </div>
        )}

        {restrictedModalOpen && selected && selectedReadOnly && (
          <div className={styles.modalBack}>
            <div className={`${styles.modalCard} ${styles.restrictedModal}`}>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitle}>Combatant Details</div>
                <button
                  className={btnClass('danger', 'sm')}
                  onMouseEnter={playHover}
                  onClick={() => { playNav(); setRestrictedModalOpen(false); }}
                >
                  Close
                </button>
              </div>
              <div className={`${styles.restrictedModalBody} koa-scrollbar-thin`}>
                <div className={styles.restrictedProfileTop}>
                  <div className={styles.restrictedPortraitWrap}>
                    {selectedRestrictedPortrait ? (
                      <img
                        className={styles.restrictedPortraitImg}
                        src={selectedRestrictedPortrait}
                        alt={`${selected.name} portrait`}
                      />
                    ) : (
                      <div className={styles.restrictedPortraitFallback}>{initials(selected.name)}</div>
                    )}
                  </div>
                  <div className={styles.restrictedNameBlock}>
                    <div className={styles.label}>Name</div>
                    <div className={styles.restrictedNameValue}>{selected.name}</div>
                  </div>
                </div>

                <div className={styles.restrictedIdentityGrid}>
                  <div className={styles.restrictedIdentityField}>
                    <div className={styles.label}>Race</div>
                    <div className={styles.restrictedIdentityValue}>{cleanText(selected.race) || 'Unknown'}</div>
                  </div>
                  <div className={styles.restrictedIdentityField}>
                    <div className={styles.label}>Class</div>
                    <div className={styles.restrictedIdentityValue}>{cleanText(selected.className || selected.role) || 'Unclassified'}</div>
                  </div>
                  <div className={styles.restrictedIdentityField}>
                    <div className={styles.label}>Level</div>
                    <div className={styles.restrictedIdentityValue}>
                      {selected.level === '' || selected.level == null ? '—' : selected.level}
                    </div>
                  </div>
                </div>

                <div className={styles.restrictedStatRow}>
                  <div className={styles.label}>Notable Feature</div>
                  <div className={styles.restrictedStatValue}>
                    {selectedNotableFeature || 'None'}
                  </div>
                </div>

                {selectedSensitiveStatsHidden && (
                  <div className={styles.restrictedHiddenHint}>
                    Sensitive combat stats are owner-hidden and redacted.
                  </div>
                )}

                <div className={styles.restrictedStatsGrid}>
                  <div className={styles.restrictedStatRow}>
                    <div className={styles.label}>Current HP</div>
                    <div className={styles.restrictedStatValue}>
                      {selectedSensitiveStatsHidden ? (
                        <span className={styles.restrictedHiddenValue}>Hidden</span>
                      ) : (
                        selectedCurrentHp
                      )}
                    </div>
                  </div>
                  <div className={styles.restrictedStatRow}>
                    <div className={styles.label}>Status Conditions</div>
                    <div className={styles.restrictedStatValue}>
                      {selectedSensitiveStatsHidden ? (
                        <span className={styles.restrictedHiddenValue}>Hidden</span>
                      ) : (
                        selectedStatusConditions.length ? selectedStatusConditions.join(', ') : 'None'
                      )}
                    </div>
                  </div>
                  <div className={styles.restrictedStatRow}>
                    <div className={styles.label}>Concentration</div>
                    <div className={styles.restrictedStatValue}>
                      {selectedSensitiveStatsHidden ? (
                        <span className={styles.restrictedHiddenValue}>Hidden</span>
                      ) : (
                        cleanText(selected.concentration) || 'None'
                      )}
                    </div>
                  </div>
                  <div className={styles.restrictedStatRow}>
                    <div className={styles.label}>Equipped Items</div>
                    <div className={styles.restrictedStatValue}>
                      {selectedSensitiveStatsHidden ? (
                        <span className={styles.restrictedHiddenValue}>Hidden</span>
                      ) : (
                        selectedEquipment.length ? selectedEquipment.join(', ') : 'None listed'
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── EDITOR MODAL ── */}
        {(() => {
          if (!editorOpen || !selected) return null;
          const editorModal = (
            <>
            <div className={styles.modalBack}>
            <div className={`${styles.modalCard} ${editorMode === 'sheet' ? styles.sheetManagerModal : styles.editorModal}`}>
              <div className={styles.editorHeader}>
                <div className={styles.editorTitle}>
                  {editorMode === 'sheet' ? 'Character Sheet:' : 'Editing:'} <span className={styles.editorNameAccent}>{selected.name}</span>
                </div>
                <div className={`${styles.editorHeaderActions} ${editorMode === 'sheet' ? styles.sheetHeaderActions : ''}`}>
                  {selectedCastorWilliamRole && (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={castorWilliamResourceSyncEnabled}
                      aria-label="Sync Castor and William Spicer resources"
                      title={castorWilliamSyncSwitchTitle}
                      className={`${styles.castorWilliamSyncToggle} ${
                        castorWilliamResourceSyncEnabled ? styles.castorWilliamSyncToggleOn : ''
                      }`}
                      onMouseEnter={playHover}
                      onClick={() => { playNav(); toggleCastorWilliamResourceSync(); }}
                      disabled={
                        (!castorWilliamResourceSyncAvailable && !castorWilliamResourceSyncEnabled)
                        || !canManageCombat
                        || selectedReadOnly
                      }
                    >
                      <span className={styles.castorWilliamSyncToggleLabel}>Castor + William Sync</span>
                      <span className={styles.castorWilliamSyncToggleTrack}>
                        <span className={styles.castorWilliamSyncToggleThumb} />
                      </span>
                    </button>
                  )}
                  {selectedCanEdit && (
                    <button
                      type="button"
                      className={btnClass(
                        selectedSensitiveStatsHidden ? 'gold' : 'ghost',
                        'sm',
                        selectedSensitiveStatsHidden ? styles.visibilityToggleOn : ''
                      )}
                      onMouseEnter={playHover}
                      onClick={() => { playNav(); toggleSelectedSensitiveStats(); }}
                      title={
                        selectedSensitiveStatsHidden
                          ? 'Sensitive stats are hidden from players who cannot control this combatant.'
                          : 'Show sensitive stats in restricted details when unauthorized players inspect this combatant.'
                      }
                    >
                      {selectedSensitiveStatsHidden ? 'Stats Hidden' : 'Hide Stats'}
                    </button>
                  )}
                  {editorMode === 'sheet' ? (
                    <>
                      <button className={btnClass('gold', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); setEditorMode('edit'); }}>
                        Edit
                      </button>
                      {!sheetPopoutOpen && (
                        <button className={btnClass('ghost', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); openSheetPopout(); }}>
                          Pop Out
                        </button>
                      )}
                      <button className={btnClass('ghost', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); setListEditorMode('spellbook'); }} disabled={selectedReadOnly}>Spellbook</button>
                      <button className={btnClass('ghost', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); setListEditorMode('features'); }} disabled={selectedReadOnly}>Class Features</button>
                      <button className={btnClass('ghost', 'sm', styles.longRestBtn)} onMouseEnter={playHover} onClick={() => { playNav(); longRestSelected(); }} disabled={selectedReadOnly}>Long Rest</button>
                      <button className={btnClass('danger', 'sm', styles.editorCloseButton)} onMouseEnter={playHover} onClick={() => { playNav(); setEditorOpen(false); }}>✕</button>
                    </>
                  ) : (
                    <>
                      {selected.sourceSheet && (
                        <button className={btnClass('ghost', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); setEditorMode('sheet'); }}>
                          Character Sheet
                        </button>
                      )}
                      <button className={btnClass('gold', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); triggerSheetImport(selected.id, !!selected.sourceSheet); }} disabled={selectedReadOnly}>
                        {selected.sourceSheet ? 'Import New Sheet' : 'Import Sheet'}
                      </button>
                      <button className={btnClass('danger', 'sm', styles.editorCloseButton)} onMouseEnter={playHover} onClick={() => { playNav(); setEditorOpen(false); }}>✕</button>
                    </>
                  )}
                </div>
              </div>

              {editorMode === 'sheet' && (
                <fieldset className={styles.editorFieldset} aria-disabled={selectedReadOnly}>
                {selectedReadOnly && (
                  <div className={styles.lockedHint}>
                    Read-only. You can only edit combatants assigned to you or custom combatants you own.
                  </div>
                )}
                <div className={`${styles.sheetView} koa-scrollbar-thin`}>
                  <div className={styles.sheetTopRow}>
                    <div className={styles.sheetHero}>
                      <div className={styles.sheetIdentity}>
                        <div className={styles.sheetName}>{selected.name}</div>
                        <div className={styles.sheetMeta}>
                          {[cleanText(selected.race) || 'Unknown', cleanText(selected.className || selected.role) || 'Unclassified', selected.level === '' || selected.level == null ? 'Level —' : `Level ${selected.level}`].join(' • ')}
                        </div>
                        {selected.sourceSheetFileName && (
                          <div className={styles.sheetImportMeta}>
                            {selected.sourceSheetFileName}
                            {selected.sourceSheetFormat ? ` (${selected.sourceSheetFormat.toUpperCase()})` : ''}
                          </div>
                        )}
                      </div>
                      {selected.customImage && (
                        <div className={styles.sheetHeroPortrait}>
                          <img
                            className={styles.sheetHeroPortraitImg}
                            src={selected.customImage}
                            alt={`${selected.name} portrait`}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {(selectedSheetIssues.length > 0 || sheetImportState.error) && (
                    <div className={styles.sheetIssues}>
                      {sheetImportState.error && sheetImportState.targetId === selected.id && (
                        <div className={styles.sheetIssueBlock}>
                          <div className={styles.sheetIssueLabel}>Import Error</div>
                          <div className={styles.sheetIssueText}>{sheetImportState.error}</div>
                        </div>
                      )}
                      {selectedSheetIssues.slice(0, 6).map((issue, idx) => (
                        <div key={`${issue.kind}-${idx}`} className={styles.sheetIssueBlock}>
                          <div className={styles.sheetIssueLabel}>{issue.kind}</div>
                          <div className={styles.sheetIssueText}>{issue.text}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className={styles.sheetSectionGrid}>
                    <div className={`${styles.sheetCoreVitalsRow} ${styles.sheetCardFull}`}>
                      <div className={`${styles.sheetCard} ${styles.sheetCoreStatsCard}`}>
                        <div className={`${styles.sheetCardTitle} ${styles.sheetCardTitleCentered}`}>Stats</div>
                        <div className={`${styles.sheetAbilityChipGrid} ${styles.sheetAbilityChipGridCompact}`}>
                          {ABILITY_META.map((ability) => {
                            const score = selected.abilities?.[ability.key];
                            const mod = abilityModifier(score);
                            return (
                              <div key={ability.key} className={styles.sheetAbilityChip}>
                                <div className={styles.sheetAbilityChipLabel}>{ability.label}</div>
                                <div className={styles.sheetAbilityChipMod}>{formatSigned(mod)}</div>
                                <div className={styles.sheetAbilityChipScore}>{score == null ? '—' : score}</div>
                              </div>
                            );
                          })}
                        </div>
                        <div className={styles.sheetCoreStatsCombat}>
                          
                          <div className={`${styles.sheetStatsGrid} ${styles.sheetStatsGridRow}`}>
                            <div><span>Armor Class</span><b>{selected.ac === '' ? '—' : selected.ac}</b></div>
                            <div><span>Initiative</span><b>{formatSigned(selected.initiativeBonus)}</b></div>
                            <div><span>Speed</span><b>{selected.speed === '' ? '—' : `${selected.speed} FT`}</b></div>
                          </div>
                        </div>
                      </div>

                      <div className={`${styles.sheetCard} ${styles.sheetHpCard}`}>
                        
                        <div className={styles.sheetHpCardBody}>
                          <div className={`${styles.sheetHeroVitalsRow} ${styles.sheetHpVitalsLayout}`}>
                            <div className={`${styles.sheetHeroHpGroup} ${styles.sheetHpDisplayGroup}`}>
                              <span className={styles.sheetHeroVitalsLabel}>HP</span>
                              <span className={`${styles.sheetHeroVitalsValue} ${styles.sheetHeroVitalsValueMain}`}>
                                <span
                                  className={`${styles.sheetCurrentHpValue} ${sheetCurrentHpVisual.isCritical ? styles.sheetCurrentHpValueCritical : ''}`}
                                  style={sheetCurrentHpVisual.style}
                                >
                                  {selected.hp === '' ? '—' : selected.hp}
                                </span>
                                <span className={styles.sheetHpDivider}> / </span>
                                <span className={styles.sheetMaxHpValue}>{selected.maxHP === '' ? '—' : selected.maxHP}</span>
                              </span>
                            </div>
                            <div className={styles.sheetHpControlStack}>
                              <div className={`${styles.sheetHeroTempGroup} ${styles.sheetHpTempGroup}`}>
                                <span className={styles.sheetHeroVitalsLabel}>Temp HP</span>
                                <div className={styles.sheetHeroTempControls}>
                                  <input className={`${styles.input} ${styles.tempAdjustInput}`} inputMode="numeric" maxLength={4} value={selected.tempHP} onChange={(e) => updateSelectedTempHp(e.target.value)} />
                                </div>
                              </div>

                              <div className={`${styles.sheetToolsAdjustRow} ${styles.sheetHpAdjustRowCompact}`}>
                                <button className={btnClass('danger', 'sm', styles.toolMiniBtn)} onMouseEnter={playHover} onClick={() => { playNav(); applyHpAdjustment('damage'); }}>- HP</button>
                                <div className={styles.sheetToolsAdjustInputWrap}>
                                  <input
                                    className={`${styles.input} ${styles.compactInput} ${styles.sheetToolsAdjustInput}`}
                                    inputMode="numeric"
                                    maxLength={4}
                                    value={hpAdjustAmount}
                                    onChange={(e) => setHpAdjustAmount(e.target.value)}
                                  />
                                </div>
                                <button className={btnClass('gold', 'sm', styles.toolMiniBtn)} onMouseEnter={playHover} onClick={() => { playNav(); applyHpAdjustment('heal'); }}>+ HP</button>
                              </div>
                            </div>
                          </div>

                          <div className={styles.sheetHpMetaGrid}>
                            <div className={styles.sheetHpMetaItem}>
                              <span className={styles.sheetHpMetaLabel}>Proficiency</span>
                              <span className={styles.sheetHpMetaValue}>
                                {selectedProficiencyBonus == null ? '—' : formatSigned(selectedProficiencyBonus)}
                              </span>
                            </div>
                            <div className={styles.sheetHpMetaItem}>
                              <span className={styles.sheetHpMetaLabel}>Spell Save DC</span>
                              <span className={styles.sheetHpMetaValue}>
                                {selected.spellSaveDC == null || selected.spellSaveDC === '' ? '—' : selected.spellSaveDC}
                              </span>
                            </div>
                            <div className={styles.sheetHpMetaItem}>
                              <span className={styles.sheetHpMetaLabel}>Attack Mod</span>
                              <span className={styles.sheetHpMetaValue}>
                                {selected.attackModifier == null || selected.attackModifier === '' ? '—' : formatSigned(selected.attackModifier)}
                              </span>
                            </div>
                            <div className={styles.sheetHpMetaItem}>
                              <span className={styles.sheetHpMetaLabel}>Spell Attack</span>
                              <span className={styles.sheetHpMetaValue}>
                                {selected.spellAttackModifier == null || selected.spellAttackModifier === '' ? '—' : formatSigned(selected.spellAttackModifier)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={`${styles.sectionTopGap} ${styles.sheetCardFull}`}>
                      <div className={styles.combatToolsCard}>
                        <div className={styles.toolsTitle}>Combat Tools</div>
                        <div className={styles.sheetToolsResourceGrid}>
                          <div className={styles.combatToolGroup}>
                            <div className={styles.label}>Feature Charges</div>
                            <div className={styles.spellSlotsReadGrid}>
                              {visibleSheetFeatureCharges.length === 0 ? (
                                <div className={styles.sheetListFallback}>No feature charges set.</div>
                              ) : (
                                visibleSheetFeatureCharges.map((feature) => {
                                  const shownBoxes = Math.max(feature.max, 0);
                                  return (
                                    <div key={`sheet-feature-${feature.id}`} className={`${styles.spellSlotsReadRow} ${styles.featureChargesReadRow}`}>
                                      <span className={styles.spellSlotsReadLevel}>{feature.name || 'Feature'}</span>
                                      <div className={styles.spellSlotsReadBoxes}>
                                        {Array.from({ length: shownBoxes }).map((_, i) => (
                                          <button
                                            type="button"
                                            key={`sheet-feature-box-${feature.id}-${i}`}
                                            className={`${styles.slotBox} ${styles.spellSlotsReadBtn} ${
                                              i < feature.current ? styles.slotBoxActive : styles.slotBoxInactive
                                            }`}
                                            onMouseEnter={playHover}
                                            onClick={() => { playNav(); setFeatureChargesFromBox(feature.id, i); }}
                                            aria-label={`${feature.name || 'Feature'} charge ${i + 1}`}
                                            title={`${feature.name || 'Feature'} charge ${i + 1}`}
                                          />
                                        ))}
                                      </div>
                                      <span className={styles.spellSlotsReadCount}>{feature.current}/{feature.max}</span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          <div className={styles.combatToolGroup}>
                            <div className={styles.label}>Spell Slots</div>
                            <div className={styles.spellSlotsReadGrid}>
                              {visibleSheetSpellSlots.length === 0 ? (
                                <div className={styles.sheetListFallback}>No spell slots set.</div>
                              ) : (
                                visibleSheetSpellSlots.map((slot) => {
                                  const shownBoxes = Math.max(slot.max, 0);
                                  return (
                                    <div key={`sheet-slot-${slot.level}`} className={styles.spellSlotsReadRow}>
                                      <span className={styles.spellSlotsReadLevel}>{spellLevelLabel(slot.level)} Level</span>
                                      <div className={styles.spellSlotsReadBoxes}>
                                        {Array.from({ length: shownBoxes }).map((_, i) => (
                                          <button
                                            type="button"
                                            key={`sheet-slot-box-${slot.level}-${i}`}
                                            className={`${styles.slotBox} ${styles.spellSlotsReadBtn} ${
                                              i < slot.current ? styles.slotBoxActive : styles.slotBoxInactive
                                            }`}
                                            onMouseEnter={playHover}
                                            onClick={() => { playNav(); setSpellSlotsFromBox(slot.level, i); }}
                                            aria-label={`${spellLevelLabel(slot.level)} level slot ${i + 1}`}
                                            title={`${spellLevelLabel(slot.level)} level slot ${i + 1}`}
                                          />
                                        ))}
                                      </div>
                                      <span className={styles.spellSlotsReadCount}>{slot.current}/{slot.max}</span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={styles.sheetCard}>
                      <div className={`${styles.sheetCardTitle} ${styles.sheetCardTitleCentered}`}>Skills</div>
                      <div className={styles.sheetStatRows}>
                        {selectedSkillRows.length ? selectedSkillRows.map((skillRow) => (
                          <div
                            key={skillRow.id}
                            className={`${styles.sheetStatRow} ${
                              skillRow.proficiencyTier === 2 ? styles.sheetStatRowExpert : skillRow.proficiencyTier === 1 ? styles.sheetStatRowProficient : ''
                            }`}
                          >
                            <div className={styles.sheetStatMain}>
                              <span
                                className={`${styles.sheetStatTag} ${
                                  skillRow.proficiencyTier === 2 ? styles.sheetStatTagExpert : skillRow.proficiencyTier === 1 ? styles.sheetStatTagProficient : ''
                                }`}
                              >
                                {skillRow.ability}
                              </span>
                              <span className={styles.sheetStatLabel}>{skillRow.skill}</span>
                            </div>
                            <span className={styles.sheetStatValue}>{formatSigned(skillRow.bonus)}</span>
                          </div>
                        )) : <div className={styles.sheetListFallback}>No skills parsed.</div>}
                      </div>
                    </div>

                    <div className={styles.sheetCard}>
                      <div className={`${styles.sheetCardTitle} ${styles.sheetCardTitleCentered}`}>Saving Throws & Senses</div>
                      <div className={styles.sheetSaveSenseGrid}>
                        <div className={styles.sheetSaveSenseBlock}>
                          <div className={styles.sheetSavingThrowGrid}>
                            {selectedSavingThrowRows.map((row) => (
                              <div
                                key={row.tag}
                                className={`${styles.sheetStatRow} ${styles.sheetSavingThrowRow} ${
                                  row.proficiencyTier === 2 ? styles.sheetStatRowExpert : row.proficiencyTier === 1 ? styles.sheetStatRowProficient : ''
                                }`}
                              >
                                <div className={styles.sheetStatMain}>
                                  <span
                                    className={`${styles.sheetStatTag} ${
                                      row.proficiencyTier === 2 ? styles.sheetStatTagExpert : row.proficiencyTier === 1 ? styles.sheetStatTagProficient : ''
                                    }`}
                                  >
                                    {row.tag}
                                  </span>
                                </div>
                                <span className={styles.sheetStatValue}>{formatSigned(row.value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className={styles.sheetSaveSenseBlock}>
                          <div className={styles.sheetStatRows}>
                            {selectedSenseRows.length ? selectedSenseRows.map((sense) => (
                              <div key={sense.id} className={styles.sheetStatRow}>
                                <div className={styles.sheetStatMain}><span className={styles.sheetStatLabel}>{sense.label}</span></div>
                                <span className={styles.sheetStatValue}>{sense.value == null ? '—' : sense.value}</span>
                              </div>
                            )) : <div className={styles.sheetListFallback}>No senses parsed.</div>}
                          </div>
                        </div>
                        <div className={`${styles.sheetSaveSenseBlock} ${styles.sheetSaveSenseTextBlock}`}>
                          <div className={styles.sheetSubTitle}>Equipment</div>
                          <div className={styles.sheetListBlock}>
                            {normalizeStringList(selected.equipmentItems).length ? normalizeStringList(selected.equipmentItems).join(', ') : <span className={styles.sheetListFallback}>No equipment parsed.</span>}
                          </div>
                        </div>
                        <div className={`${styles.sheetSaveSenseBlock} ${styles.sheetSaveSenseTextBlock}`}>
                          <div className={styles.sheetSubTitle}>Other Possessions</div>
                          <div className={styles.sheetListBlock}>
                            {normalizeStringList(selected.otherPossessions).length ? normalizeStringList(selected.otherPossessions).join(', ') : <span className={styles.sheetListFallback}>No other possessions parsed.</span>}
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
                </fieldset>
              )}

              {editorMode !== 'sheet' && (
              <fieldset className={styles.editorFieldset} disabled={selectedReadOnly}>
              {selectedReadOnly && (
                <div className={styles.lockedHint}>
                  Read-only. You can only edit combatants assigned to you or custom combatants you own.
                </div>
              )}
              <div className={`${styles.editorBody} koa-scrollbar-thin`}>
                
                {/* Appearance section */}
                <div className={styles.sectionTopGap}>
                  <div className={styles.appearanceHeaderRow}>
                    <div className={styles.appearanceTitle}>Appearance</div>
                  </div>
                  
                  <div className={styles.appearanceGrid}>
                    <div className={styles.appearanceCol}>
                      <div className={styles.uploadRow}>
                        {/* Preview circle */}
                        {selected.customImage && (
                          <div className={styles.tokenPreview}>
                            <img src={selected.customImage} alt="token preview" />
                          </div>
                        )}
                        <label className={styles.uploadLabel}>
                          {selected.customImage ? 'Replace Image' : 'Upload & Crop'}
                          <input type="file" accept="image/*" className={styles.hiddenInput} onChange={handleImageUpload}/>
                        </label>
                        {selected.customImage && (
                          <button onClick={() => setSelectedField({ customImage:'' })}
                            onMouseEnter={playHover}
                            className={btnClass('danger', 'sm', styles.btnTiny)}>
                            Remove
                          </button>
                        )}
                      </div>
                      {selected.side === 'Enemy' && (
                        <div className={styles.sectionTopGap}>
                          <div className={styles.label}>Enemy Type</div>
                          <div className={styles.enemyTypeRow}>
                            {ENEMY_TYPES.map(et => (
                              <button key={et.key}
                                onClick={() => setSelectedField({ enemyType:et.key, customImage:'' })}
                                onMouseEnter={playHover}
                                className={enemyTypeBtnClass(selected.enemyType===et.key)}>{et.label}</button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className={`${styles.sectionTopGap} ${styles.editToolsGrid}`}>
                  <div className={`${styles.combatToolsCard} ${styles.featureChargesCard}`}>
                    <div className={styles.toolsTitle}>Feature Charges</div>
                    <div className={`${styles.featureChargesGrid} koa-scrollbar-thin`}>
                      {allFeatureCharges.length === 0 ? (
                        <div className={styles.sheetListFallback}>No feature charges added.</div>
                      ) : (
                        allFeatureCharges.map((feature) => (
                          <div key={feature.id} className={styles.featureChargeRow}>
                            <input
                              className={`${styles.input} ${styles.featureChargeNameInput}`}
                              value={feature.name}
                              placeholder="Feature name"
                              onChange={(e) => updateFeatureChargeName(feature.id, e.target.value)}
                            />
                            <div className={styles.featureChargeControls}>
                              <button
                                type="button"
                                className={btnClass('ghost', 'sm', styles.toolMiniBtn)}
                                onMouseEnter={playHover}
                                onClick={() => { playNav(); nudgeFeatureChargeMax(feature.id, -1); }}
                              >
                                -
                              </button>
                              <button
                                type="button"
                                className={btnClass('gold', 'sm', styles.toolMiniBtn)}
                                onMouseEnter={playHover}
                                onClick={() => { playNav(); nudgeFeatureChargeMax(feature.id, 1); }}
                              >
                                +
                              </button>
                              <span className={styles.spellSlotsEditCount}>{feature.max}</span>
                              <button
                                type="button"
                                className={btnClass('danger', 'sm', styles.toolMiniBtn)}
                                onMouseEnter={playHover}
                                onClick={() => { playNav(); removeFeatureCharge(feature.id); }}
                                title="Delete feature"
                              >
                                X
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <button
                      type="button"
                      className={btnClass('ghost', 'sm', styles.featureChargeAddBtn)}
                      onMouseEnter={playHover}
                      onClick={() => { playNav(); addFeatureCharge(); }}
                    >
                      + Add Feature
                    </button>
                  </div>

                  <div className={`${styles.combatToolsCard} ${styles.spellSlotsEditCard}`}>
                    <div className={styles.toolsTitle}>Spell Slots</div>
                    <div className={`${styles.spellSlotsEditGrid} koa-scrollbar-thin`}>
                      {SPELL_SLOT_LEVELS.map((level) => {
                        const slot = allSpellSlots.find((entry) => entry.level === level) || { level, max: 0, current: 0 };
                        return (
                          <div key={`edit-slot-${level}`} className={styles.spellSlotsEditRow}>
                            <div className={styles.spellSlotsEditLevel} title={`${spellLevelLabel(level)} Level`}>{level}</div>
                            <div className={styles.spellSlotsTrack}>
                              <div className={styles.spellSlotsEditActions}>
                                <button type="button" className={btnClass('ghost', 'sm', styles.toolMiniBtn)} onMouseEnter={playHover} onClick={() => { playNav(); nudgeSpellSlotMax(level, -1); }}>
                                  -
                                </button>
                                <button type="button" className={btnClass('gold', 'sm', styles.toolMiniBtn)} onMouseEnter={playHover} onClick={() => { playNav(); nudgeSpellSlotMax(level, 1); }}>
                                  +
                                </button>
                              </div>
                              <span className={styles.spellSlotsEditCount}>{slot.max}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className={styles.sectionTopGap}>
                  <div className={styles.label}>Equipment (one per line)</div>
                  <textarea
                    className={`${styles.input} ${styles.textareaInput}`}
                    value={normalizeStringList(selected.equipmentItems).join('\n')}
                    onChange={(e) => setSelectedField({ equipmentItems: normalizeStringList(e.target.value) })}
                  />
                </div>

                <div className={styles.divider}/>

                <div className={styles.fieldGrid2}>
                  <div><div className={styles.label}>Name</div><input className={styles.input} value={selected.name} onChange={e => setSelectedField({ name:e.target.value })}/></div>
                  <div><div className={styles.label}>Role / Class</div><input className={styles.input} value={selected.role} onChange={e => setSelectedField({ role:e.target.value })}/></div>
                </div>
                <div className={styles.compactFields}>
                  <div className={styles.compactSideField}><div className={styles.label}>Side</div>
                    <select className={`${styles.input} ${styles.compactInput} ${styles.selectInput}`} value={selected.side} onChange={e => setSelectedField({ side:e.target.value })}>
                      <option value="Enemy">Enemy</option><option value="PC">PC</option><option value="Ally">Ally</option>
                    </select>
                  </div>
                  <div className={styles.compactStatField}><div className={styles.label}>Initiative</div><input className={`${styles.input} ${styles.compactInput}`} inputMode="numeric" maxLength={5} value={selected.init} onChange={e => setSelectedField({ init:toInt(e.target.value,0) })}/></div>
                  <div className={styles.compactStatField}><div className={styles.label}>HP</div><input className={`${styles.input} ${styles.compactInput}`} inputMode="numeric" maxLength={5} value={selected.hp} onChange={e => setSelectedField({ hp:e.target.value===''?'':toInt(e.target.value,0) })}/></div>
                  <div className={styles.compactStatField}><div className={styles.label}>Max HP</div><input className={`${styles.input} ${styles.compactInput}`} inputMode="numeric" maxLength={5} value={selected.maxHP} onChange={e => setSelectedField({ maxHP:e.target.value===''?'':toInt(e.target.value,0) })}/></div>
                  <div className={styles.compactStatField}><div className={styles.label}>Temp HP</div><input className={`${styles.input} ${styles.compactInput}`} inputMode="numeric" maxLength={5} value={selected.tempHP} onChange={e => setSelectedField({ tempHP:toInt(e.target.value,0) })}/></div>
                  <div className={styles.compactStatField}><div className={styles.label}>AC</div><input className={`${styles.input} ${styles.compactInput}`} inputMode="numeric" maxLength={5} value={selected.ac} onChange={e => setSelectedField({ ac:e.target.value===''?'':toInt(e.target.value,0) })}/></div>
                </div>

                <div className={styles.divider}/>

                <div><div className={styles.label}>Status (comma separated)</div>
                  <input
                    className={styles.input}
                    value={statusDraft}
                    placeholder="Poisoned, Grappled, Bless"
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setStatusDraft(nextValue);
                      setSelectedField({ status: parseStatusText(nextValue) });
                    }}
                  />
                </div>
                <div className={styles.sectionTopGap}><div className={styles.label}>Concentration</div>
                  <input className={styles.input} value={selected.concentration} placeholder="Bless / Hold Person / Hex..." onChange={e => setSelectedField({ concentration:e.target.value })}/>
                </div>
                <div className={styles.sectionTopGap}><div className={styles.label}>Notable Feature</div>
                  <textarea className={`${styles.input} ${styles.textareaInput}`} value={selected.notableFeature || ''}
                    placeholder="Visible clue or detail others should notice right now..."
                    onChange={e => setSelectedField({ notableFeature:e.target.value })}/>
                </div>
                <div className={styles.sectionTopGap}><div className={styles.label}>Notes</div>
                  <textarea className={`${styles.input} ${styles.textareaInput}`} value={selected.notes}
                    placeholder="Tactics, resistances, legendary uses..." onChange={e => setSelectedField({ notes:e.target.value })}/>
                </div>

                <div className={styles.sectionTopGap}><div className={styles.label}>Other Possessions (one per line)</div>
                  <textarea
                    className={`${styles.input} ${styles.textareaInput}`}
                    value={normalizeStringList(selected.otherPossessions).join('\n')}
                    onChange={(e) => setSelectedField({ otherPossessions: normalizeStringList(e.target.value) })}
                  />
                </div>

                <div className={styles.divider}/>
                <div className={styles.actionRow}>
                  <button className={btnClass('danger', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); removeCombatant(selected.id); }} disabled={!selectedCanRemove}>
                    Remove
                  </button>
                  <button className={btnClass('gold', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); toggleDead(selected.id); }} disabled={!selectedCanEdit}>
                    {selected.dead ? 'Revive' : 'Mark dead'}
                  </button>
                </div>
              </div>
              </fieldset>
              )}
            </div>
          </div>

        {sheetImportState.running && editorOpen && selected && sheetImportState.targetId === selected.id && (
          <div className={styles.modalBack}>
            <div className={`${styles.modalCard} ${styles.sheetManagerModal}`}>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitle}>Importing Character Sheet</div>
                <button className={btnClass('danger', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); cancelSheetImport(); }}>
                  Cancel
                </button>
              </div>
              <div className={styles.managerBody}>
                <div className={styles.managerHint}>{sheetImportStageLabel} • {sheetImportState.progress}%</div>
                <div className={styles.importProgressTrack}>
                  <div className={styles.importProgressFill} style={{ width: `${sheetImportState.progress}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {editorOpen && selected && listEditorMode && (
          <div className={styles.modalBack}>
            <div className={`${styles.modalCard} ${styles.sheetManagerModal}`}>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitle}>{listEditorMode === 'spellbook' ? 'Spellbook' : 'Class Features'}</div>
                <div className={styles.modalHeaderActions}>
                  {listEditorMode === 'features' && (
                    <button
                      type="button"
                      className={btnClass('ghost', 'sm')}
                      onMouseEnter={playHover}
                      onClick={() => {
                        playNav();
                        setFeatureRawSnapshot(listEditorText);
                        setFeatureRawEditorOpen(true);
                      }}
                    >
                      Edit Raw
                    </button>
                  )}
                  <button className={btnClass('danger', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); setActiveSpellDraftId(''); setFeatureRawEditorOpen(false); setListEditorMode(''); }}>
                    Close
                  </button>
                </div>
              </div>
              <div className={`${styles.managerBody} ${
                listEditorMode === 'spellbook'
                  ? styles.managerBodySpellbook
                  : listEditorMode === 'features'
                    ? styles.managerBodyFeatures
                    : ''
              }`}>
                {listEditorMode === 'spellbook' ? (
                  <div className={styles.spellbookManager}>
                    <div className={styles.spellbookToolbar}>
                      <div className={styles.managerHint}>Spells are grouped by level. Click a row to edit details.</div>
                      <button
                        type="button"
                        className={btnClass('ghost', 'sm')}
                        onMouseEnter={playHover}
                        onClick={() => { playNav(); addSpellbookDraftEntry(null); }}
                      >
                        + Add Spell
                      </button>
                    </div>
                    <div className={`${styles.spellbookGroups} koa-scrollbar-thin`}>
                      {spellbookDraftGroups.length === 0 ? (
                        <div className={styles.sheetListFallback}>No spells yet. Add one to get started.</div>
                      ) : (
                        spellbookDraftGroups.map((group) => (
                          <div key={group.key} className={styles.spellbookGroup}>
                            <div className={styles.spellbookGroupHead}>
                              <div className={styles.spellbookGroupTitle}>{group.label}</div>
                              <div className={styles.spellbookGroupActions}>
                                <span className={styles.spellbookGroupCount}>{group.entries.length}</span>
                                <button
                                  type="button"
                                  className={btnClass('ghost', 'sm')}
                                  onMouseEnter={playHover}
                                  onClick={() => { playNav(); addSpellbookDraftEntry(group.level); }}
                                >
                                  + Spell
                                </button>
                              </div>
                            </div>
                            <div className={styles.spellbookTableWrap}>
                              <table className={styles.spellbookTable}>
                                <thead>
                                  <tr>
                                    <th>Prep</th>
                                    <th>Spell</th>
                                    <th>Source</th>
                                    <th>Save/Atk</th>
                                    <th>Effect</th>
                                    <th>Time</th>
                                    <th>Range</th>
                                    <th>Duration</th>
                                    <th />
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.entries.map((spell) => (
                                    <tr
                                      key={spell.id}
                                      className={spell.id === activeSpellDraftId ? styles.spellbookRowActive : ''}
                                      onClick={() => setActiveSpellDraftId(spell.id)}
                                    >
                                      <td>{spell.prepared || '—'}</td>
                                      <td className={styles.spellbookNameCell}>{spell.name || 'Untitled Spell'}</td>
                                      <td>{spell.source || '—'}</td>
                                      <td>{spell.saveAtk || '—'}</td>
                                      <td>{spell.effect || '—'}</td>
                                      <td>{spell.time || '—'}</td>
                                      <td>{spell.range || '—'}</td>
                                      <td>{spell.duration || '—'}</td>
                                      <td className={styles.spellbookRowActions}>
                                        <button
                                          type="button"
                                          className={btnClass('ghost', 'sm', styles.spellbookRowBtn)}
                                          onMouseEnter={playHover}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            playNav();
                                            setActiveSpellDraftId(spell.id);
                                          }}
                                          title="Edit spell"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          className={btnClass('danger', 'sm', styles.spellbookRowBtn)}
                                          onMouseEnter={playHover}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            playNav();
                                            removeSpellbookDraftEntry(spell.id);
                                          }}
                                          title="Delete spell"
                                        >
                                          X
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={styles.managerHint}>Feature Groups</div>
                    <div className={`${styles.featureBlocks} koa-scrollbar-thin`}>
                      {featureDraftSections.length === 0 ? (
                        <div className={styles.sheetListFallback}>No class features parsed.</div>
                      ) : (
                        featureDraftSections.map((group, index) => (
                          <div key={`${group.title}-${index}`} className={styles.featureBlock}>
                            <div className={styles.featureBlockTitle}>{group.title}</div>
                            <div className={styles.featureBlockBody}>
                              {group.entries.map((entry, entryIndex) => (
                                <div key={`${group.title}-${index}-${entryIndex}`} className={styles.featureBlockLine}>
                                  {entry}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className={styles.managerActions}>
                <button className={btnClass('ghost', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); setActiveSpellDraftId(''); setFeatureRawEditorOpen(false); setListEditorMode(''); }}>
                  Cancel
                </button>
                <button className={btnClass('gold', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); saveListEditor(); }}>
                  Save
                </button>
              </div>

              {listEditorMode === 'spellbook' && activeSpellDraft && (
                <div className={styles.spellDetailOverlay}>
                  <div className={`${styles.modalCard} ${styles.spellDetailCard}`}>
                    <div className={styles.modalHeader}>
                      <div className={styles.modalTitle}>Spell Details</div>
                      <button
                        className={btnClass('danger', 'sm')}
                        onMouseEnter={playHover}
                        onClick={() => { playNav(); setActiveSpellDraftId(''); }}
                      >
                        Close
                      </button>
                    </div>
                    <div className={styles.spellDetailBody}>
                      <div className={styles.spellDetailGrid}>
                        <div className={styles.spellDetailFieldWide}>
                          <div className={styles.label}>Spell Name</div>
                          <input
                            className={styles.input}
                            value={activeSpellDraft.name}
                            onChange={(e) => updateSpellbookDraftEntry(activeSpellDraft.id, { name: e.target.value })}
                          />
                        </div>
                        <div>
                          <div className={styles.label}>Level</div>
                          <select
                            className={`${styles.input} ${styles.selectInput}`}
                            value={activeSpellDraft.level == null ? '' : String(activeSpellDraft.level)}
                            onChange={(e) => updateSpellbookDraftEntry(activeSpellDraft.id, { level: e.target.value === '' ? null : e.target.value })}
                          >
                            <option value="">Unassigned</option>
                            <option value="0">Cantrip</option>
                            {SPELL_SLOT_LEVELS.map((level) => (
                              <option key={`spell-detail-level-${level}`} value={String(level)}>{spellLevelLabel(level)} Level</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div className={styles.label}>Prepared</div>
                          <select
                            className={`${styles.input} ${styles.selectInput}`}
                            value={activeSpellDraft.prepared || ''}
                            onChange={(e) => updateSpellbookDraftEntry(activeSpellDraft.id, { prepared: e.target.value })}
                          >
                            <option value="">None</option>
                            <option value="O">O</option>
                            <option value="P">P</option>
                            <option value="A">Always</option>
                          </select>
                        </div>
                        <div className={styles.spellDetailFieldWide}>
                          <div className={styles.label}>Source</div>
                          <input
                            className={styles.input}
                            value={activeSpellDraft.source}
                            onChange={(e) => updateSpellbookDraftEntry(activeSpellDraft.id, { source: e.target.value })}
                          />
                        </div>
                        <div>
                          <div className={styles.label}>Save/Atk</div>
                          <input
                            className={styles.input}
                            value={activeSpellDraft.saveAtk}
                            onChange={(e) => updateSpellbookDraftEntry(activeSpellDraft.id, { saveAtk: e.target.value })}
                          />
                        </div>
                        <div>
                          <div className={styles.label}>Effect</div>
                          <input
                            className={styles.input}
                            value={activeSpellDraft.effect || ''}
                            onChange={(e) => updateSpellbookDraftEntry(activeSpellDraft.id, { effect: e.target.value })}
                          />
                        </div>
                        <div>
                          <div className={styles.label}>Time</div>
                          <input
                            className={styles.input}
                            value={activeSpellDraft.time}
                            onChange={(e) => updateSpellbookDraftEntry(activeSpellDraft.id, { time: e.target.value })}
                          />
                        </div>
                        <div>
                          <div className={styles.label}>Range</div>
                          <input
                            className={styles.input}
                            value={activeSpellDraft.range}
                            onChange={(e) => updateSpellbookDraftEntry(activeSpellDraft.id, { range: e.target.value })}
                          />
                        </div>
                        <div>
                          <div className={styles.label}>Components</div>
                          <input
                            className={styles.input}
                            value={activeSpellDraft.components}
                            onChange={(e) => updateSpellbookDraftEntry(activeSpellDraft.id, { components: e.target.value })}
                          />
                        </div>
                        <div>
                          <div className={styles.label}>Duration</div>
                          <input
                            className={styles.input}
                            value={activeSpellDraft.duration}
                            onChange={(e) => updateSpellbookDraftEntry(activeSpellDraft.id, { duration: e.target.value })}
                          />
                        </div>
                        <div className={styles.spellDetailFieldWide}>
                          <div className={styles.label}>Notes</div>
                          <textarea
                            className={`${styles.input} ${styles.spellDetailTextarea}`}
                            value={activeSpellDraft.notes}
                            onChange={(e) => updateSpellbookDraftEntry(activeSpellDraft.id, { notes: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                    <div className={styles.managerActions}>
                      <button
                        className={btnClass('danger', 'sm')}
                        onMouseEnter={playHover}
                        onClick={() => { playNav(); removeSpellbookDraftEntry(activeSpellDraft.id); }}
                      >
                        Delete
                      </button>
                      <button
                        className={btnClass('gold', 'sm')}
                        onMouseEnter={playHover}
                        onClick={() => { playNav(); setActiveSpellDraftId(''); }}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {listEditorMode === 'features' && featureRawEditorOpen && (
                <div className={styles.featureRawOverlay}>
                  <div className={`${styles.modalCard} ${styles.featureRawCard}`}>
                    <div className={styles.modalHeader}>
                      <div className={styles.modalTitle}>Edit Raw Class Features</div>
                      <button
                        className={btnClass('danger', 'sm')}
                        onMouseEnter={playHover}
                        onClick={() => { playNav(); setFeatureRawEditorOpen(false); }}
                      >
                        Close
                      </button>
                    </div>
                    <div className={styles.featureRawBody}>
                      <div className={styles.managerHint}>One feature line per row. Section dividers use `=== TITLE ===`.</div>
                      <textarea
                        className={`${styles.input} ${styles.managerTextarea} ${styles.featureRawTextarea}`}
                        value={listEditorText}
                        onChange={(e) => setListEditorText(e.target.value)}
                      />
                    </div>
                    <div className={styles.managerActions}>
                      <button
                        className={btnClass('ghost', 'sm')}
                        onMouseEnter={playHover}
                        onClick={() => {
                          playNav();
                          setListEditorText(featureRawSnapshot);
                          setFeatureRawEditorOpen(false);
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className={btnClass('gold', 'sm')}
                        onMouseEnter={playHover}
                        onClick={() => { playNav(); setFeatureRawEditorOpen(false); }}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </div>
        )}
          </>
          );
          if (editorMode === 'sheet' && isSheetPopoutActive && sheetPortalHost) {
            return createPortal(editorModal, sheetPortalHost);
          }
          if (!shouldRenderEditorInline) return null;
          return editorModal;
        })()}

        {/* ── IMAGE CROP MODAL ── */}
        {cropOpen && (
          <div className={`${styles.modalBack} ${styles.modalBackCrop}`}>
            <div className={styles.cropModal}>
              {/* Header */}
              <div className={`${styles.modalHeader} ${styles.modalHeaderCrop}`}>
                <div className={`${styles.modalTitle} ${styles.modalTitleCrop}`}>Crop Token Image</div>
                <button className={btnClass('danger', 'sm')} onMouseEnter={playHover} onClick={() => setCropOpen(false)}>✕ Cancel</button>
              </div>

              {/* Body */}
              <div className={styles.cropBody}>

                {/* Crop canvas */}
                <div className={styles.cropCanvasWrap}>
                  <div
                    className={styles.cropCircle}
                    style={{ width: CROP_BOX, height: CROP_BOX }}
                    onMouseDown={e => {
                      cropDragRef.current = { dragging:true, sx:e.clientX, sy:e.clientY, ox:cropOffset.x, oy:cropOffset.y };
                      e.preventDefault();
                    }}
                    onMouseMove={e => {
                      if (!cropDragRef.current.dragging) return;
                      const dx = e.clientX - cropDragRef.current.sx;
                      const dy = e.clientY - cropDragRef.current.sy;
                      setCropOffset({ x: cropDragRef.current.ox + dx, y: cropDragRef.current.oy + dy });
                    }}
                    onMouseUp={() => { cropDragRef.current.dragging = false; clampCropOffset(); }}
                    onMouseLeave={() => { if (cropDragRef.current.dragging) { cropDragRef.current.dragging = false; clampCropOffset(); } }}
                    onWheel={e => {
                      e.preventDefault();
                      const next = clamp(cropZoom + (e.deltaY < 0 ? 0.08 : -0.08), 0.5, 4);
                      setCropZoom(next);
                      clampCropOffset(next);
                    }}
                  >
                    <CropImage
                      src={cropSrc}
                      imgRef={cropImgRef}
                      cropBox={CROP_BOX}
                      zoom={cropZoom}
                      offset={cropOffset}
                      onLoad={() => clampCropOffset()}
                    />
                  </div>
                </div>

                {/* Controls */}
                <div className={styles.cropControls}>
                  <div>
                    <div className={styles.label}>Zoom</div>
                    <input type="range" min="0.5" max="4" step="0.01"
                      value={cropZoom}
                      onChange={e => { const z = parseFloat(e.target.value); setCropZoom(z); clampCropOffset(z); }}
                      className={styles.rangeInput}
                    />
                    <div className={styles.zoomPercent}>
                      {Math.round(cropZoom * 100)}%
                    </div>
                  </div>

                  <div className={styles.cropHint}>
                    Drag to reposition.<br/>Scroll or use slider to zoom.
                  </div>

                  <button className={btnClass('gold', 'md', styles.btnFull)}
                    onMouseEnter={playHover}
                    onClick={() => { playNav(); applyCrop(); }}>
                    ✓ Apply Crop
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </ShellLayout>
  );
}
