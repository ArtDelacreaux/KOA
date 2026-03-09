// ===== COMBAT PANEL — with Battle Background Selector =====
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ShellLayout from './ShellLayout';
import styles from './CombatPanel.module.css';
import { createId } from '../domain/ids';
import { repository } from '../repository';
import { STORAGE_KEYS } from '../lib/storageKeys';
import { getCampaignId, getSupabaseClient } from '../lib/supabaseClient';
import { parseCharacterSheetFile } from '../lib/sheetParser';
import { getCharacterAccessEntry } from '../lib/characterAccess';
import useLocalStorageState from '../lib/useLocalStorageState';
import {
  appendDiceLogEntry,
  createDiceLogEntry,
  DICE_BOX_ASSET_PATH,
  DICE_BOX_VIEWPORT_ID,
  DICE_QUICK_NOTATIONS,
  formatDiceBreakdown,
  getDiceOutcomeKind,
  normalizeDiceLog,
  normalizeDiceNotation,
} from '../lib/combatDice';
import {
  DEFAULT_ATTUNEMENT_LIMIT,
  INVENTORY_CATEGORIES,
  INVENTORY_RARITIES,
  defaultBagInventoryState,
  getPersonalInventoryEntry,
  inventoryItemsToEquipmentLines,
  inventoryItemsToEquippedLines,
  lineListsMatchByToken,
  normalizeBagInventoryState,
  syncInventoryItemsFromEquipment,
  upsertPersonalInventoryEntry,
} from '../lib/inventorySync';

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
const POINTERS_KEY = STORAGE_KEYS.combatPointers;
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
const ENCOUNTER_PERSIST_DEBOUNCE_MS = 120;
const COMBAT_MEDIA_BUCKET = 'koa-combat-media';
const BOARD_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
const BOARD_ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const BOARD_STATUS_PRESETS = ['Prone', 'Poisoned', 'Restrained', 'Stunned', 'Invisible', 'Hidden'];
const DRAW_TOOL_PRESETS = [
  { label: 'Black', value: '#000000' },
  { label: 'Gold', value: '#ffd86b' },
  { label: 'Sky', value: '#8bd3ff' },
  { label: 'Coral', value: '#ff7a7a' },
  { label: 'Violet', value: '#c7a2ff' },
  { label: 'White', value: '#ffffff' },
];
const DRAW_TOOL_COLORS = DRAW_TOOL_PRESETS.map(({ value }) => value);
const DEFAULT_DRAW_TOOL_COLOR = DRAW_TOOL_PRESETS[0]?.value || '#000000';
const DRAW_STROKE_SIZES = [4, 8, 14];
const DEFAULT_BOARD_WIDTH = 2048;
const DEFAULT_BOARD_HEIGHT = 1365;
const UPLOADED_MAP_DRAW_MARGIN_CELLS = 4;
const UPLOADED_MAP_DRAW_MARGIN_MIN = 240;
const TOKEN_SCALE_MIN = 0.35;
const TOKEN_SCALE_MAX = 3;
const TOKEN_CROP_OUTPUT_SIZE = 1024;
const DEFAULT_DICE_NOTATION = 'd20';
const DICE_THEME_COLOR = '#d7ae5f';
const DICE_AUTO_HIDE_MS = 5000;
const DICE_OUTCOME_EFFECT_MS = 3200;
const SHARED_POINTER_HOLD_DELAY_MS = 150;
const SHARED_POINTER_UPDATE_THROTTLE_MS = 32;
const SHARED_POINTER_VISIBLE_MS = 900;
const SHARED_POINTER_CLEANUP_INTERVAL_MS = 400;
const SHARED_POINTER_COLORS = ['#ffd86b', '#8bd3ff', '#ff8fb1', '#97f1a8', '#c7a2ff', '#ffbb70'];
const SHARED_POINTER_BROADCAST_EVENT = 'pointer:update';
const SHARED_POINTER_CLEAR_EVENT = 'pointer:clear';
const DICE_CELEBRATION_SPARKS = Object.freeze(
  Array.from({ length: 12 }, (_, idx) => ({
    id: idx,
    left: `${8 + (idx * 7)}%`,
    delayMs: idx * 90,
    durationMs: 1040 + ((idx % 4) * 140),
    rotationDeg: -18 + (idx * 7),
  }))
);
const DEFAULT_BATTLEFIELD = Object.freeze({
  backgroundSrc: BATTLE_BACKGROUNDS[0]?.src || '',
  mediaStoragePath: '',
  mediaMimeType: '',
  mediaWidth: 0,
  mediaHeight: 0,
  mediaUpdatedAt: 0,
  gridEnabled: true,
  gridCellSize: 72,
  gridOffsetX: 0,
  gridOffsetY: 0,
  drawings: [],
  pointers: [],
});
const PROFILE_SYNC_FIELDS = new Set([
  'race',
  'className',
  'role',
  'level',
  'hp',
  'maxHP',
  'ac',
  'speed',
  'initiativeBonus',
  'proficiencyBonus',
  'spellSaveDC',
  'attackModifier',
  'spellAttackModifier',
  'abilities',
  'savingThrows',
  'skills',
  'senses',
  'spellbookEntries',
  'spellList',
  'classFeatures',
  'spellSlots',
  'featureCharges',
  'hideSensitiveStats',
  'weaponActions',
  'equipmentItems',
  'equippedItems',
  'otherPossessions',
  'sourceSheet',
  'sourceSheetFileName',
  'sourceSheetFormat',
  'sheetWarnings',
  'sheetMissingFields',
  'sheetUnknownFields',
  'sheetImportedAt',
]);
const PROFILE_SIMPLE_SYNC_FIELDS = new Set([
  'race',
  'className',
  'role',
  'level',
  'hp',
  'maxHP',
  'ac',
  'speed',
  'initiativeBonus',
  'proficiencyBonus',
  'spellSaveDC',
  'attackModifier',
  'spellAttackModifier',
  'hideSensitiveStats',
  'sourceSheet',
  'sourceSheetFileName',
  'sourceSheetFormat',
  'sheetImportedAt',
]);
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

function hashString(value) {
  const text = String(value || '');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function sharedPointerColor(pointerId) {
  return SHARED_POINTER_COLORS[hashString(pointerId) % SHARED_POINTER_COLORS.length];
}

function normalizeGridCoordinate(value, fallback = null) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed));
}

function normalizeTokenScale(value, fallback = 1) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, TOKEN_SCALE_MIN, TOKEN_SCALE_MAX);
}

function normalizeTokenRotation(value, fallback = 0) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const wrapped = Math.round(parsed) % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

function normalizeAngleDelta(nextAngle, startAngle) {
  let delta = nextAngle - startAngle;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

function pointerAngleFromCenter(centerX, centerY, clientX, clientY) {
  const degrees = (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI + 90;
  return normalizeTokenRotation(degrees, 0);
}

function defaultGridPlacementFor(side, slotIndex) {
  const normalizedSide = side === 'Enemy' ? 'Enemy' : side === 'Ally' ? 'Ally' : 'PC';
  const zeroBased = Math.max(0, toInt(slotIndex, 0));
  const col = 2 + (zeroBased % 10);
  const rowBase = normalizedSide === 'Enemy' ? 2 : normalizedSide === 'Ally' ? 8 : 10;
  const row = rowBase + Math.floor(zeroBased / 10);
  return { gridCol: col, gridRow: row };
}

function nextGridPlacementForCombatantList(combatants, side) {
  const normalizedSide = side === 'Enemy' ? 'Enemy' : side === 'Ally' ? 'Ally' : 'PC';
  const list = Array.isArray(combatants) ? combatants : [];
  const taken = new Set(
    list
      .map((entry) => {
        const col = normalizeGridCoordinate(entry?.gridCol, null);
        const row = normalizeGridCoordinate(entry?.gridRow, null);
        return col == null || row == null ? '' : `${col}:${row}`;
      })
      .filter(Boolean)
  );
  let slot = list.filter((entry) => {
    const entrySide = entry?.side === 'Enemy' ? 'Enemy' : entry?.side === 'Ally' ? 'Ally' : 'PC';
    return entrySide === normalizedSide;
  }).length;
  while (slot < 500) {
    const candidate = defaultGridPlacementFor(normalizedSide, slot);
    const key = `${candidate.gridCol}:${candidate.gridRow}`;
    if (!taken.has(key)) return candidate;
    slot += 1;
  }
  return defaultGridPlacementFor(normalizedSide, 0);
}

function normalizeBattlefield(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    backgroundSrc: cleanText(source.backgroundSrc) || DEFAULT_BATTLEFIELD.backgroundSrc,
    mediaStoragePath: cleanText(source.mediaStoragePath),
    mediaMimeType: cleanText(source.mediaMimeType),
    mediaWidth: Math.max(0, toInt(source.mediaWidth, 0)),
    mediaHeight: Math.max(0, toInt(source.mediaHeight, 0)),
    mediaUpdatedAt: Math.max(0, toInt(source.mediaUpdatedAt, 0)),
    gridEnabled: source.gridEnabled == null ? DEFAULT_BATTLEFIELD.gridEnabled : !!source.gridEnabled,
    gridCellSize: clamp(toInt(source.gridCellSize, DEFAULT_BATTLEFIELD.gridCellSize), 32, 192),
    gridOffsetX: clamp(toInt(source.gridOffsetX, DEFAULT_BATTLEFIELD.gridOffsetX), -2048, 2048),
    gridOffsetY: clamp(toInt(source.gridOffsetY, DEFAULT_BATTLEFIELD.gridOffsetY), -2048, 2048),
    drawings: normalizeBattlefieldDrawings(source.drawings),
    pointers: normalizeBattlefieldPointers(source.pointers),
  };
}

function roundBoardCoordinate(value) {
  return Math.round(Number(value) * 10) / 10;
}

function normalizeBattlefieldDrawingPoint(raw) {
  const x = Array.isArray(raw) ? raw[0] : raw?.x;
  const y = Array.isArray(raw) ? raw[1] : raw?.y;
  const parsedX = Number(x);
  const parsedY = Number(y);
  if (!Number.isFinite(parsedX) || !Number.isFinite(parsedY)) return null;
  return {
    x: roundBoardCoordinate(parsedX),
    y: roundBoardCoordinate(parsedY),
  };
}

function normalizeBattlefieldPointer(raw, index = 0) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    id: cleanText(source.id) || `pointer-${index + 1}`,
    label: cleanText(source.label) || 'Player',
    x: roundBoardCoordinate(source.x ?? 0),
    y: roundBoardCoordinate(source.y ?? 0),
    updatedAt: Math.max(0, toInt(source.updatedAt, 0)),
  };
}

function normalizeBattlefieldPointers(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map((entry, index) => normalizeBattlefieldPointer(entry, index))
    .filter((entry) => entry.id);
}

function battlefieldPointersEqual(a, b) {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (left.length !== right.length) return false;
  return left.every((pointer, index) => {
    const other = right[index];
    return !!other
      && pointer.id === other.id
      && pointer.label === other.label
      && pointer.x === other.x
      && pointer.y === other.y
      && pointer.updatedAt === other.updatedAt;
  });
}

function normalizeBattlefieldDrawing(raw, index = 0) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const points = (Array.isArray(source.points) ? source.points : [])
    .map((point) => normalizeBattlefieldDrawingPoint(point))
    .filter(Boolean);
  if (points.length === 1) {
    points.push({ ...points[0] });
  }
  return {
    id: cleanText(source.id) || `drawing-${index + 1}`,
    color: normalizeDrawColor(source.color),
    size: clamp(toInt(source.size, DRAW_STROKE_SIZES[1]), 2, 24),
    points,
  };
}

function normalizeBattlefieldDrawings(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map((entry, index) => normalizeBattlefieldDrawing(entry, index))
    .filter((entry) => entry.points.length >= 2);
}

function battlefieldDrawingsEqual(a, b) {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (left.length !== right.length) return false;
  return left.every((drawing, index) => {
    const other = right[index];
    if (!other) return false;
    if (drawing.id !== other.id || drawing.color !== other.color || drawing.size !== other.size) return false;
    if (drawing.points.length !== other.points.length) return false;
    return drawing.points.every((point, pointIndex) => {
      const otherPoint = other.points[pointIndex];
      return !!otherPoint && point.x === otherPoint.x && point.y === otherPoint.y;
    });
  });
}

function battlefieldStateEqual(a, b) {
  if (!a || !b) return false;
  return (
    a.backgroundSrc === b.backgroundSrc
    && a.mediaStoragePath === b.mediaStoragePath
    && a.mediaMimeType === b.mediaMimeType
    && a.mediaWidth === b.mediaWidth
    && a.mediaHeight === b.mediaHeight
    && a.mediaUpdatedAt === b.mediaUpdatedAt
    && a.gridEnabled === b.gridEnabled
    && a.gridCellSize === b.gridCellSize
    && a.gridOffsetX === b.gridOffsetX
    && a.gridOffsetY === b.gridOffsetY
    && battlefieldDrawingsEqual(a.drawings, b.drawings)
    && battlefieldPointersEqual(a.pointers, b.pointers)
  );
}

function createBattlefieldSvgPath(points) {
  if (!Array.isArray(points) || !points.length) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
}

function pointToSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (!dx && !dy) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = clamp(
    (((point.x - start.x) * dx) + ((point.y - start.y) * dy)) / ((dx * dx) + (dy * dy)),
    0,
    1
  );
  const projectedX = start.x + (dx * t);
  const projectedY = start.y + (dy * t);
  return Math.hypot(point.x - projectedX, point.y - projectedY);
}

function findDrawingIndexNearPoint(drawings, point, threshold = 14) {
  const list = Array.isArray(drawings) ? drawings : [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const drawing = list[index];
    const points = Array.isArray(drawing?.points) ? drawing.points : [];
    for (let pointIndex = 0; pointIndex < points.length - 1; pointIndex += 1) {
      if (pointToSegmentDistance(point, points[pointIndex], points[pointIndex + 1]) <= threshold) {
        return index;
      }
    }
  }
  return -1;
}

function sanitizeUploadFileName(name) {
  const cleaned = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'battle-map';
}

function buildCombatMediaPath(campaignId, encounterId, fileName) {
  const campaignKey = cleanText(campaignId) || 'main-party';
  const encounterKey = cleanText(encounterId) || 'encounter';
  const safeName = sanitizeUploadFileName(fileName);
  return `${campaignKey}/combat/maps/${encounterKey}/${Date.now()}-${safeName}`;
}

function readImageDimensionsFromFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        width: Math.max(0, toInt(img.naturalWidth, 0)),
        height: Math.max(0, toInt(img.naturalHeight, 0)),
      });
      URL.revokeObjectURL(objectUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to read map image dimensions.'));
    };
    img.src = objectUrl;
  });
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
    'damage',
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
          damage: '',
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
        damage: cleanText(entry.damage ?? entry.dmg ?? entry.effect ?? entry.summary),
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
    damage: '',
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

function spellLevelDividerLabel(level) {
  if (level == null) return 'Unassigned';
  const n = clamp(toInt(level, 0), 0, 9);
  if (n === 0) return 'Cantrips';
  if (n === 1) return '1st Level';
  if (n === 2) return '2nd Level';
  if (n === 3) return '3rd Level';
  return `${n}th Level`;
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

function uniqueStringListByToken(raw) {
  const seen = new Set();
  return normalizeStringList(raw).filter((item) => {
    const key = tokenKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildEquipableItems(rawWeaponActions, rawEquipmentItems) {
  const weaponNames = normalizeWeaponActions(rawWeaponActions, rawEquipmentItems)
    .map((weapon) => cleanText(weapon.attack))
    .filter(Boolean);
  const equipmentNames = normalizeStringList(rawEquipmentItems);
  return uniqueStringListByToken([...weaponNames, ...equipmentNames]);
}

function normalizeEquippedItems(raw, equipableItems) {
  const normalized = uniqueStringListByToken(raw);
  if (!Array.isArray(equipableItems)) return normalized;

  const canonicalByKey = new Map();
  uniqueStringListByToken(equipableItems).forEach((item) => {
    const key = tokenKey(item);
    if (!key || canonicalByKey.has(key)) return;
    canonicalByKey.set(key, item);
  });

  const seen = new Set();
  const out = [];
  normalized.forEach((item) => {
    const key = tokenKey(item);
    if (!key || seen.has(key)) return;
    const canonical = canonicalByKey.get(key);
    if (!canonical) return;
    seen.add(key);
    out.push(canonical);
  });
  return out;
}

function cleanText(value) {
  return String(value ?? '').trim();
}

function normalizeDrawColor(value, fallback = DEFAULT_DRAW_TOOL_COLOR) {
  const normalized = cleanText(value).toLowerCase();
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : fallback;
}

function normalizeInventoryCategory(value) {
  const normalized = cleanText(value);
  return INVENTORY_CATEGORIES.includes(normalized) ? normalized : 'Gear';
}

function normalizeInventoryRarity(value) {
  const normalized = cleanText(value);
  if (normalized.toLowerCase() === 'epic') return 'Very Rare';
  return INVENTORY_RARITIES.includes(normalized) ? normalized : 'Common';
}

function normalizeOptionalNumber(value) {
  if (value === '' || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeAttunementLimit(value) {
  const parsed = toInt(value, DEFAULT_ATTUNEMENT_LIMIT);
  return clamp(parsed, 1, 99);
}

function countAttunedItems(items) {
  return (Array.isArray(items) ? items : []).reduce((sum, entry) => sum + (entry?.attuned ? 1 : 0), 0);
}

function createSheetInventoryDraft(item = null) {
  const source = item && typeof item === 'object' ? item : {};
  return {
    name: cleanText(source.name),
    qty: source.qty == null || source.qty === '' ? '1' : String(source.qty),
    category: normalizeInventoryCategory(source.category),
    rarity: normalizeInventoryRarity(source.rarity),
    value: source.value == null ? '' : String(source.value),
    weight: source.weight == null ? '' : String(source.weight),
    notes: cleanText(source.notes),
    tags: normalizeStringList(source.tags).join(', '),
    weaponProficiency: cleanText(source.weaponProficiency || source.proficiency),
    weaponHitDc: cleanText(source.weaponHitDc || source.hitDc),
    weaponAttackType: cleanText(source.weaponAttackType || source.attackType),
    weaponReach: cleanText(source.weaponReach || source.reach),
    weaponDamage: cleanText(source.weaponDamage || source.damage),
    weaponDamageType: cleanText(source.weaponDamageType || source.damageType),
    weaponProperties: cleanText(source.weaponProperties || source.properties),
    equipped: !!source.equipped,
    attuned: !!source.attuned,
    hidden: !!source.hidden,
  };
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

function buildD20CheckNotation(modifier) {
  const value = toInt(modifier, null);
  if (value == null) return '';
  if (value > 0) return `d20+${value}`;
  if (value < 0) return `d20${value}`;
  return 'd20';
}

function formatDiceTimestamp(value) {
  const stamp = cleanText(value);
  if (!stamp) return '';
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatWeaponHitDc(value, attackModifier) {
  const text = cleanText(value);
  if (!text) return '--';
  const compact = text.replace(/\s+/g, '');
  if (!/^[+-]\d+$/.test(compact)) return text;
  const attackMod = toInt(attackModifier, null);
  const weaponBonus = toInt(compact, null);
  if (attackMod == null || weaponBonus == null) return text;
  return formatSigned(attackMod + weaponBonus, text);
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

const WEAPON_KEYWORDS = [
  'weapon',
  'sword',
  'axe',
  'bow',
  'crossbow',
  'dagger',
  'mace',
  'spear',
  'staff',
  'whip',
  'hammer',
  'club',
  'flail',
  'rapier',
  'scimitar',
  'javelin',
  'halberd',
  'pike',
  'trident',
  'maul',
  'lance',
  'unarmed',
  'bite',
  'claw',
];

function looksLikeWeaponEquipmentLine(text) {
  const line = cleanText(text).toLowerCase();
  if (!line) return false;
  if (line.includes('|')) return true;
  if (/[+\-]\s*\d+/.test(line)) return true;
  if (/\b\d+d\d+(?:\s*[+\-]\s*\d+)?\b/i.test(line)) return true;
  return WEAPON_KEYWORDS.some((keyword) => line.includes(keyword));
}

function extractDamageNotation(text) {
  const match = String(text || '').match(/\b\d+d\d+(?:\s*[+\-]\s*\d+)?\b/i);
  return match ? cleanText(match[0]).replace(/\s+/g, '') : '';
}

function extractHitOrDcNotation(text) {
  const source = String(text || '');
  const dcMatch = source.match(/\bDC\s*\d+\b/i);
  if (dcMatch) return dcMatch[0].replace(/\s+/g, ' ').toUpperCase();
  const signedMatch = source.match(/[+\-]\s*\d+/);
  if (signedMatch) return signedMatch[0].replace(/\s+/g, '');
  return '';
}

function extractRangeNotation(text) {
  const source = String(text || '');
  const splitRangeMatch = source.match(/\b\d+\s*\/\s*\d+\b/);
  if (splitRangeMatch) return splitRangeMatch[0].replace(/\s+/g, '');
  const explicitRangeMatch = source.match(/\b(?:self|touch|reach|\d+\s*(?:ft|feet|mile|miles|mi))\.?\b/i);
  if (explicitRangeMatch) {
    return explicitRangeMatch[0]
      .replace(/\bfeet\b/i, 'ft')
      .replace(/\bft\b/i, 'ft.')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return '';
}

function parseWeaponActionFromEquipmentLine(line, index) {
  const text = cleanText(line);
  if (!text || !looksLikeWeaponEquipmentLine(text)) return null;

  const parts = text.split('|').map((part) => cleanText(part));
  const hasStructuredParts = parts.length >= 4;
  const attack = hasStructuredParts
    ? cleanText(parts[0])
    : cleanText(text.split(/[,:]/)[0]);
  const range = hasStructuredParts ? cleanText(parts[1]) : extractRangeNotation(text);
  const hitDc = hasStructuredParts ? cleanText(parts[2]) : extractHitOrDcNotation(text);
  const damage = hasStructuredParts ? cleanText(parts[3]) : extractDamageNotation(text);
  const notes = hasStructuredParts ? cleanText(parts.slice(4).join(' | ')) : text;

  if (!attack) return null;
  return {
    id: `weapon-${index}-${tokenKey(attack) || index}`,
    sourceIndex: index,
    attack,
    range,
    hitDc,
    damage,
    notes,
    sourceLine: text,
  };
}

function normalizeWeaponField(value) {
  const text = cleanText(value);
  return text === '--' ? '' : text;
}

function weaponActionId(entry, index) {
  const explicit = cleanText(entry?.id);
  if (explicit) return explicit;
  const attackKey = tokenKey(entry?.attack ?? entry?.name ?? entry?.weapon);
  return `weapon-${index + 1}-${attackKey || 'entry'}`;
}

function normalizeWeaponActionEntries(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const attack = cleanText(entry.attack ?? entry.name ?? entry.weapon);
      if (!attack) return null;
      return {
        id: weaponActionId(entry, index),
        attack,
        range: normalizeWeaponField(entry.range ?? entry.reach),
        hitDc: normalizeWeaponField(entry.hitDc ?? entry.hitDC ?? entry.hit ?? entry.dc),
        damage: normalizeWeaponField(entry.damage ?? entry.dmg),
        notes: cleanText(entry.notes ?? entry.detail),
      };
    })
    .filter(Boolean);
}

function normalizeWeaponActions(raw, fallbackEquipmentItems = []) {
  const normalized = normalizeWeaponActionEntries(raw);
  if (normalized.length || Array.isArray(raw)) return normalized;
  const fallbackLayout = buildEquipmentLayoutRows(fallbackEquipmentItems);
  return normalizeWeaponActionEntries(fallbackLayout.weapons);
}

function buildSpellActionRow(spell, index) {
  const attack = cleanText(spell?.name) || `Spell ${index + 1}`;
  const range = cleanText(spell?.range) || extractRangeNotation(spell?.effect || spell?.notes) || '--';
  const hitDc = cleanText(spell?.saveAtk) || extractHitOrDcNotation(spell?.effect || spell?.notes) || '--';
  const damage =
    cleanText(spell?.damage)
    || extractDamageNotation(`${spell?.effect || ''} ${spell?.notes || ''}`)
    || '--';
  const source = cleanText(spell?.source) || (normalizeSpellLevel(spell?.level, null) === 0 ? 'Cantrip' : '');
  return {
    id: cleanText(spell?.id) || `spell-action-${index}-${tokenKey(attack) || index}`,
    attack,
    range,
    hitDc,
    damage,
    notes: cleanText(spell?.notes || spell?.effect),
    source,
    spell,
  };
}

function buildEquipmentLayoutRows(rawEquipmentItems) {
  const lines = normalizeStringList(rawEquipmentItems);
  const weapons = [];
  const gear = [];

  lines.forEach((line, index) => {
    const parsedWeapon = parseWeaponActionFromEquipmentLine(line, index);
    if (parsedWeapon) {
      weapons.push(parsedWeapon);
      return;
    }
    gear.push(line);
  });

  return { weapons, gear };
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
  const parsedEquipmentItems = normalizeStringList(parsed.equipmentItems || parsed.equipment);
  const parsedEquipmentLayout = buildEquipmentLayoutRows(parsedEquipmentItems);
  const parsedWeaponActions = normalizeWeaponActions(parsed.weaponActions, parsedEquipmentItems);
  const parsedEquipableItems = buildEquipableItems(parsedWeaponActions, parsedEquipmentLayout.gear);
  const parsedEquippedItems = normalizeEquippedItems(combatant.equippedItems, parsedEquipableItems);

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
    weaponActions: parsedWeaponActions,
    equipmentItems: parsedEquipmentLayout.gear,
    equippedItems: parsedEquippedItems,
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
  const parsedEquipmentItems = normalizeStringList(raw?.equipmentItems);
  const hasExplicitWeaponActions = Array.isArray(raw?.weaponActions);
  const separatedEquipmentLayout = buildEquipmentLayoutRows(parsedEquipmentItems);
  const weaponActions = normalizeWeaponActions(raw?.weaponActions, parsedEquipmentItems);
  const equipmentItems = hasExplicitWeaponActions ? parsedEquipmentItems : separatedEquipmentLayout.gear;
  const equipableItems = buildEquipableItems(weaponActions, equipmentItems);
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
    weaponActions,
    equipmentItems,
    equippedItems: normalizeEquippedItems(raw?.equippedItems, equipableItems),
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
    tokenScale: normalizeTokenScale(combatant.tokenScale, 1),
    tokenRotation: normalizeTokenRotation(combatant.tokenRotation, 0),
    gridCol: normalizeGridCoordinate(combatant.gridCol, 0),
    gridRow: normalizeGridCoordinate(combatant.gridRow, 0),
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
    diceLog: [],
    battlefield: normalizeBattlefield(null),
    castorWilliamResourceSync: false,
    sheetProfiles: {},
    updatedAt: Date.now(),
  };
}

function normalize(enc) {
  const base = defaultEncounter();
  const e = { ...base, ...(enc || {}) };
  if (!Array.isArray(e.combatants)) e.combatants = [];
  e.diceLog = normalizeDiceLog(e.diceLog);
  e.battlefield = normalizeBattlefield(e.battlefield);
  const rawProfiles = e.sheetProfiles && typeof e.sheetProfiles === 'object' ? e.sheetProfiles : {};
  e.sheetProfiles = Object.entries(rawProfiles).reduce((acc, [key, value]) => {
    const normalizedKey = cleanText(key);
    if (!normalizedKey) return acc;
    acc[normalizedKey] = normalizeSheetProfile(value);
    return acc;
  }, {});
  const sideCounts = { Enemy: 0, Ally: 0, PC: 0 };
  e.combatants = e.combatants.map((c, i) => {
    const spellbookEntries = normalizeSpellbookEntries(c.spellbookEntries, c.spellList);
    const spellList = normalizeStringList(spellbookEntries.map((entry) => entry.name));
    const rawEquipmentItems = normalizeStringList(c.equipmentItems);
    const hasExplicitWeaponActions = Array.isArray(c.weaponActions);
    const separatedEquipmentLayout = buildEquipmentLayoutRows(rawEquipmentItems);
    const weaponActions = normalizeWeaponActions(c.weaponActions, rawEquipmentItems);
    const equipmentItems = hasExplicitWeaponActions ? rawEquipmentItems : separatedEquipmentLayout.gear;
    const equipableItems = buildEquipableItems(weaponActions, equipmentItems);
    const normalizedSide = c.side === 'Enemy' ? 'Enemy' : c.side === 'Ally' ? 'Ally' : 'PC';
    const slotIndex = sideCounts[normalizedSide];
    sideCounts[normalizedSide] += 1;
    const fallbackGrid = defaultGridPlacementFor(normalizedSide, slotIndex);
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
      weaponActions,
      equipmentItems,
      equippedItems: normalizeEquippedItems(c.equippedItems, equipableItems),
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
      tokenScale: normalizeTokenScale(c.tokenScale, 1),
      tokenRotation: normalizeTokenRotation(c.tokenRotation, 0),
      gridCol: normalizeGridCoordinate(c.gridCol, fallbackGrid.gridCol),
      gridRow: normalizeGridCoordinate(c.gridRow, fallbackGrid.gridRow),
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
function BattlefieldToken({
  c,
  isActive,
  isSelected,
  canRotate = false,
  isRotating = false,
  onHover,
  onContextMenu,
  onPointerDown,
  onRotateHandlePointerDown,
  onDoubleClick,
  rotationOverride = null,
  size = 90,
  flipped = false,
  title,
}) {
  const hp = c.hp === '' ? 0 : toInt(c.hp, 0);
  const max = c.maxHP === '' ? 0 : toInt(c.maxHP, 0);
  const pct = max > 0 ? (hp / max) * 100 : 100;
  const tokenScale = normalizeTokenScale(c.tokenScale, 1);
  const tokenRotation = normalizeTokenRotation(rotationOverride == null ? c.tokenRotation : rotationOverride, 0);
  const displaySize = clamp(Math.round(size * tokenScale), 32, 256);
  const rotateHandleOffset = Math.round(displaySize / 2 + 18);
  const isHidden = Array.isArray(c.status) && c.status.some((entry) => {
    const key = tokenKey(entry);
    return key === tokenKey('Hidden') || key === tokenKey('Invisible');
  });

  const EnemyRender = ENEMY_TYPES.find(e => e.key === c.enemyType)?.Render || GoblinSVG;
  const pcColor = PC_COLORS[c.pcColorIndex % PC_COLORS.length];
  const rootClass = `${styles.tokenRoot} ${c.dead ? styles.tokenDead : ''} ${isSelected || isRotating ? styles.tokenRootActive : ''}`;
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
  const renderedRotation = flipped ? -tokenRotation : tokenRotation;
  const visualTransforms = [];
  if (flipped) visualTransforms.push('scaleX(-1)');
  if (renderedRotation) visualTransforms.push(`rotate(${renderedRotation}deg)`);
  const visualTransform = visualTransforms.length ? visualTransforms.join(' ') : 'none';
  const handleTransforms = ['translate(-50%, -50%)'];
  if (flipped) handleTransforms.push('scaleX(-1)');
  if (renderedRotation) handleTransforms.push(`rotate(${renderedRotation}deg)`);
  handleTransforms.push(`translateY(-${rotateHandleOffset}px)`);
  const handleTransform = handleTransforms.join(' ');

  return (
    <div
      onMouseEnter={onHover}
      onContextMenu={onContextMenu}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onDragStart={(event) => event.preventDefault()}
      title={title || c.name}
      className={rootClass}
      style={{ width: displaySize, height: displaySize }}
    >
      <div className={`${styles.tokenVisual} ${isHidden ? styles.tokenVisualHidden : ''}`}>
        {/* Active turn glow ring */}
        {isActive && (
          <div
            className={styles.tokenActiveRing}
            style={{ width: displaySize + 16, height: displaySize + 16, boxShadow: ringShadow }}
          />
        )}

        {/* Token circle / image */}
        <div
          className={styles.tokenCircle}
          style={{
            width: displaySize,
            height: displaySize,
            border: circleBorder,
            background: circleBg,
            boxShadow: circleShadow,
            transform: visualTransform,
          }}
        >
          {c.customImage ? (
            <img
              src={c.customImage}
              alt={c.name}
              className={styles.tokenImage}
              draggable={false}
            />
          ) : c.side === 'Enemy' ? (
            <EnemyRender size={displaySize * 0.72} />
          ) : (
            <HeroSVG color={pcColor} size={displaySize * 0.72} />
          )}
        </div>

        {/* Dead skull */}
        {c.dead && (
          <div className={styles.tokenDeadSkull} style={{ fontSize: displaySize * 0.35 }}>💀</div>
        )}

        {canRotate && (
          <button
            type="button"
            className={`${styles.tokenRotateHandle} ${isRotating ? styles.tokenRotateHandleVisible : ''}`}
            style={{ transform: handleTransform }}
            onPointerDown={onRotateHandlePointerDown}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Rotate ${c.name}`}
            title={`Rotate ${c.name}`}
          >
            <span className={styles.tokenRotateHandleIcon} aria-hidden="true">↻</span>
          </button>
        )}
      </div>

      {/* Name tag + status */}
      <div
        className={styles.tokenLabelBox}
        style={{ background: labelBg, border: labelBorder, maxWidth: displaySize + 30 }}
      >
        <div
          className={styles.tokenName}
          style={{ color: nameColor, maxWidth: displaySize + 20, textDecoration: c.dead ? 'line-through' : 'none' }}
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
          <div className={styles.tokenConcentration} style={{ maxWidth: displaySize + 20 }}>
            ⚬ {c.concentration}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Battlefield Scene ──────────────────────────────────────────────────────
function BattlefieldScene({
  combatants,
  activeCombatantId,
  selectedId,
  setSelectedId,
  playHover,
  playNav,
  battleBg,
  battlefield,
  battlefieldMediaUrl,
  resetViewRequestToken,
  canMoveCombatant,
  canQuickEditCombatant,
  moveCombatantToCell,
  setCombatantTokenRotation,
  toggleCombatantDead,
  toggleCombatantStatus,
  clearCombatantStatuses,
  removeCombatant,
  openSheetFor,
  drawings,
  canDraw,
  commitDrawing,
  removeDrawing,
  undoDrawing,
  clearDrawings,
  rightRailButtons = null,
  rightRailPanel = null,
  sharedPointers = [],
  canSharePointer = false,
  localSharedPointerId = '',
  localSharedPointerLabel = 'Player',
  setSharedPointer = () => {},
  clearSharedPointer = () => {},
}) {
  const stageRef = useRef(null);
  const contextMenuRef = useRef(null);
  const customDrawColorInputRef = useRef(null);
  const sharedPointerHoldRef = useRef({
    active: false,
    pointerId: null,
    timerId: null,
    clientX: 0,
    clientY: 0,
    lastBroadcastAt: 0,
  });
  const suppressSharedPointerContextMenuUntilRef = useRef(0);
  const [viewState, setViewState] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [fitZoom, setFitZoom] = useState(1);
  const [panState, setPanState] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [dragState, setDragState] = useState(null);
  const [rotateState, setRotateState] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ left: 12, top: 12, ready: false });
  const [boardTool, setBoardTool] = useState('pan');
  const [drawColor, setDrawColor] = useState(DEFAULT_DRAW_TOOL_COLOR);
  const [drawSize, setDrawSize] = useState(DRAW_STROKE_SIZES[1]);
  const [drawDraft, setDrawDraft] = useState(null);
  const [eraseState, setEraseState] = useState(null);
  const [sharedPointerTracking, setSharedPointerTracking] = useState(false);
  const [sharedPointerPreview, setSharedPointerPreview] = useState(null);
  const cellSize = clamp(toInt(battlefield.gridCellSize, DEFAULT_BATTLEFIELD.gridCellSize), 32, 192);
  const uploadedMapWidth = Math.max(0, toInt(battlefield.mediaWidth, 0));
  const uploadedMapHeight = Math.max(0, toInt(battlefield.mediaHeight, 0));
  const hasUploadedMapCanvasOverflow = !!cleanText(battlefield.mediaStoragePath) && uploadedMapWidth > 0 && uploadedMapHeight > 0;
  const boardPaddingX = hasUploadedMapCanvasOverflow
    ? Math.max(cellSize * UPLOADED_MAP_DRAW_MARGIN_CELLS, UPLOADED_MAP_DRAW_MARGIN_MIN)
    : 0;
  const boardPaddingY = hasUploadedMapCanvasOverflow
    ? Math.max(cellSize * UPLOADED_MAP_DRAW_MARGIN_CELLS, UPLOADED_MAP_DRAW_MARGIN_MIN)
    : 0;
  const boardWidth = hasUploadedMapCanvasOverflow
    ? uploadedMapWidth + boardPaddingX
    : Math.max(DEFAULT_BOARD_WIDTH, uploadedMapWidth || DEFAULT_BOARD_WIDTH);
  const boardHeight = hasUploadedMapCanvasOverflow
    ? uploadedMapHeight + boardPaddingY
    : Math.max(DEFAULT_BOARD_HEIGHT, uploadedMapHeight || DEFAULT_BOARD_HEIGHT);
  const gridOffsetX = toInt(battlefield.gridOffsetX, 0);
  const gridOffsetY = toInt(battlefield.gridOffsetY, 0);
  const backgroundUrl = battlefieldMediaUrl || battleBg || '';
  const boardBackdropFallback = 'radial-gradient(circle at 20% 18%, rgba(255, 225, 150, 0.22), rgba(18, 12, 8, 0.92) 58%), linear-gradient(180deg, rgba(56, 32, 18, 0.94), rgba(10, 7, 5, 0.98))';
  const boardBackdropBackground = backgroundUrl
    ? hasUploadedMapCanvasOverflow
      ? `url(${backgroundUrl}) left top / ${uploadedMapWidth}px ${uploadedMapHeight}px no-repeat, ${boardBackdropFallback}`
      : `url(${backgroundUrl}) center/cover no-repeat`
    : boardBackdropFallback;
  const tokenSize = clamp(Math.round(cellSize * 0.8), 48, 96);
  const maxGridCol = Math.max(0, Math.floor((boardWidth - gridOffsetX - 1) / cellSize));
  const maxGridRow = Math.max(0, Math.floor((boardHeight - gridOffsetY - 1) / cellSize));
  const minZoom = Math.max(0.1, fitZoom * 0.25);
  const normalizedDrawings = useMemo(() => normalizeBattlefieldDrawings(drawings), [drawings]);
  const activeDrawColor = normalizeDrawColor(drawColor);
  const usingCustomDrawColor = !DRAW_TOOL_COLORS.includes(activeDrawColor);
  const interactionMode = canDraw ? boardTool : 'pan';

  const fitBoardToStage = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const zoom = clamp(Math.max(rect.width / boardWidth, rect.height / boardHeight), 0.2, 2.25);
    const focusShiftX = hasUploadedMapCanvasOverflow ? (boardPaddingX * zoom) / 2 : 0;
    const focusShiftY = hasUploadedMapCanvasOverflow ? (boardPaddingY * zoom) / 2 : 0;
    setFitZoom(zoom);
    setViewState({
      zoom,
      panX: Math.round((rect.width - boardWidth * zoom) / 2 + focusShiftX),
      panY: Math.round((rect.height - boardHeight * zoom) / 2 + focusShiftY),
    });
  }, [boardHeight, boardPaddingX, boardPaddingY, boardWidth, hasUploadedMapCanvasOverflow]);

  useLayoutEffect(() => {
    fitBoardToStage();
    window.addEventListener('resize', fitBoardToStage);
    return () => window.removeEventListener('resize', fitBoardToStage);
  }, [fitBoardToStage]);

  useEffect(() => {
    if (!resetViewRequestToken) return;
    fitBoardToStage();
  }, [fitBoardToStage, resetViewRequestToken]);

  const clientToBoardPoint = useCallback((clientX, clientY) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - viewState.panX) / viewState.zoom,
      y: (clientY - rect.top - viewState.panY) / viewState.zoom,
    };
  }, [viewState.panX, viewState.panY, viewState.zoom]);

  const boardPointToClientPoint = useCallback((boardPoint) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: rect.left + viewState.panX + boardPoint.x * viewState.zoom,
      y: rect.top + viewState.panY + boardPoint.y * viewState.zoom,
    };
  }, [viewState.panX, viewState.panY, viewState.zoom]);

  const boardPointToCell = useCallback((point) => {
    const col = clamp(Math.floor((point.x - gridOffsetX) / cellSize), 0, maxGridCol);
    const row = clamp(Math.floor((point.y - gridOffsetY) / cellSize), 0, maxGridRow);
    return { col, row };
  }, [cellSize, gridOffsetX, gridOffsetY, maxGridCol, maxGridRow]);

  const cellCenter = useCallback((col, row) => ({
    x: gridOffsetX + (clamp(toInt(col, 0), 0, maxGridCol) * cellSize) + cellSize / 2,
    y: gridOffsetY + (clamp(toInt(row, 0), 0, maxGridRow) * cellSize) + cellSize / 2,
  }), [cellSize, gridOffsetX, gridOffsetY, maxGridCol, maxGridRow]);

  const clampBoardPoint = useCallback((point) => ({
    x: clamp(roundBoardCoordinate(point?.x ?? 0), 0, boardWidth),
    y: clamp(roundBoardCoordinate(point?.y ?? 0), 0, boardHeight),
  }), [boardHeight, boardWidth]);

  const clearSharedPointerHoldTimer = useCallback(() => {
    const holdState = sharedPointerHoldRef.current;
    if (holdState.timerId) {
      window.clearTimeout(holdState.timerId);
      holdState.timerId = null;
    }
  }, []);

  const resolveSharedPointerPoint = useCallback((clientX, clientY) => (
    clampBoardPoint(clientToBoardPoint(clientX, clientY))
  ), [clampBoardPoint, clientToBoardPoint]);

  const updateSharedPointerPreview = useCallback((clientX, clientY) => {
    if (!localSharedPointerId) return null;
    const nextPoint = resolveSharedPointerPoint(clientX, clientY);
    setSharedPointerPreview((prev) => {
      if (
        prev
        && prev.id === localSharedPointerId
        && prev.label === localSharedPointerLabel
        && prev.x === nextPoint.x
        && prev.y === nextPoint.y
      ) {
        return prev;
      }
      return {
        id: localSharedPointerId,
        label: localSharedPointerLabel,
        x: nextPoint.x,
        y: nextPoint.y,
      };
    });
    return nextPoint;
  }, [localSharedPointerId, localSharedPointerLabel, resolveSharedPointerPoint]);

  const pushSharedPointerUpdate = useCallback((clientX, clientY, force = false, resolvedPoint = null) => {
    if (!canSharePointer) return;
    const holdState = sharedPointerHoldRef.current;
    const now = performance.now();
    if (!force && now - holdState.lastBroadcastAt < SHARED_POINTER_UPDATE_THROTTLE_MS) return;
    holdState.lastBroadcastAt = now;
    setSharedPointer(resolvedPoint || resolveSharedPointerPoint(clientX, clientY));
  }, [canSharePointer, resolveSharedPointerPoint, setSharedPointer]);

  const stopSharedPointerTracking = useCallback(({ suppressContextMenu = false } = {}) => {
    const holdState = sharedPointerHoldRef.current;
    const wasActive = holdState.active;
    clearSharedPointerHoldTimer();
    holdState.active = false;
    holdState.pointerId = null;
    holdState.lastBroadcastAt = 0;
    setSharedPointerTracking(false);
    setSharedPointerPreview(null);
    if (wasActive) {
      clearSharedPointer();
      if (suppressContextMenu) {
        suppressSharedPointerContextMenuUntilRef.current = Date.now() + 220;
      }
    }
  }, [clearSharedPointer, clearSharedPointerHoldTimer]);

  useEffect(() => {
    if (canDraw) return;
    setBoardTool('pan');
    setDrawDraft(null);
    setEraseState(null);
  }, [canDraw]);

  useEffect(() => {
    if (canSharePointer) return;
    stopSharedPointerTracking();
  }, [canSharePointer, stopSharedPointerTracking]);

  useEffect(() => {
    setDrawDraft(null);
    setEraseState(null);
  }, [boardTool]);

  useEffect(() => {
    if (boardTool === 'erase' && normalizedDrawings.length === 0) {
      setBoardTool('pan');
    }
  }, [boardTool, normalizedDrawings.length]);

  useEffect(() => {
    if (!sharedPointerTracking) return undefined;
    const onPointerMove = (event) => {
      const holdState = sharedPointerHoldRef.current;
      if (holdState.pointerId !== event.pointerId) return;
      holdState.clientX = event.clientX;
      holdState.clientY = event.clientY;
      if (holdState.active) {
        const resolvedPoint = updateSharedPointerPreview(event.clientX, event.clientY);
        pushSharedPointerUpdate(event.clientX, event.clientY, false, resolvedPoint);
      }
    };
    const finishTracking = (event) => {
      const holdState = sharedPointerHoldRef.current;
      if (holdState.pointerId !== event.pointerId) return;
      stopSharedPointerTracking({ suppressContextMenu: holdState.active });
    };
    const cancelTracking = () => stopSharedPointerTracking();
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', finishTracking);
    window.addEventListener('pointercancel', finishTracking);
    window.addEventListener('blur', cancelTracking);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finishTracking);
      window.removeEventListener('pointercancel', finishTracking);
      window.removeEventListener('blur', cancelTracking);
    };
  }, [pushSharedPointerUpdate, sharedPointerTracking, stopSharedPointerTracking, updateSharedPointerPreview]);

  useEffect(() => {
    if (!sharedPointerTracking) return undefined;
    const rootStyle = document.documentElement?.style;
    const bodyStyle = document.body?.style;
    const previousRootCursor = rootStyle?.cursor ?? '';
    const previousBodyCursor = bodyStyle?.cursor ?? '';
    if (rootStyle) rootStyle.cursor = 'none';
    if (bodyStyle) bodyStyle.cursor = 'none';
    return () => {
      if (rootStyle) rootStyle.cursor = previousRootCursor;
      if (bodyStyle) bodyStyle.cursor = previousBodyCursor;
    };
  }, [sharedPointerTracking]);

  useEffect(() => () => {
    const holdState = sharedPointerHoldRef.current;
    clearSharedPointerHoldTimer();
    if (holdState.active) {
      clearSharedPointer();
    }
  }, [clearSharedPointer, clearSharedPointerHoldTimer]);

  const eraseDrawingAtClientPoint = useCallback((clientX, clientY) => {
    if (!canDraw || normalizedDrawings.length === 0) return false;
    const boardPoint = clampBoardPoint(clientToBoardPoint(clientX, clientY));
    const hitIndex = findDrawingIndexNearPoint(
      normalizedDrawings,
      boardPoint,
      Math.max(drawSize * 1.4, 12)
    );
    if (hitIndex < 0) return false;
    removeDrawing(normalizedDrawings[hitIndex].id);
    return true;
  }, [canDraw, clampBoardPoint, clientToBoardPoint, drawSize, normalizedDrawings, removeDrawing]);

  const openCustomDrawColorPicker = useCallback(() => {
    const input = customDrawColorInputRef.current;
    if (!input) return;
    input.value = activeDrawColor;
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
        return;
      } catch {
        // Fall back to click() for browsers without showPicker support.
      }
    }
    input.click();
  }, [activeDrawColor]);

  useEffect(() => {
    if (!drawDraft) return undefined;
    const onPointerMove = (event) => {
      const nextPoint = clampBoardPoint(clientToBoardPoint(event.clientX, event.clientY));
      setDrawDraft((prev) => {
        if (!prev) return prev;
        const lastPoint = prev.points[prev.points.length - 1];
        if (lastPoint && Math.hypot(nextPoint.x - lastPoint.x, nextPoint.y - lastPoint.y) < 2) {
          return prev;
        }
        const nextPoints = [...prev.points, nextPoint];
        return { ...prev, points: nextPoints.slice(-600) };
      });
    };
    const onPointerUp = () => {
      setDrawDraft((prev) => {
        if (!prev || prev.points.length === 0) return null;
        const points = prev.points.length >= 2 ? prev.points : [...prev.points, { ...prev.points[0] }];
        commitDrawing({ ...prev, points });
        return null;
      });
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
    window.addEventListener('pointercancel', onPointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [clampBoardPoint, clientToBoardPoint, commitDrawing, drawDraft]);

  useEffect(() => {
    if (!eraseState?.active) return undefined;
    const onPointerMove = (event) => {
      eraseDrawingAtClientPoint(event.clientX, event.clientY);
    };
    const onPointerUp = () => {
      setEraseState(null);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
    window.addEventListener('pointercancel', onPointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [eraseDrawingAtClientPoint, eraseState]);

  useEffect(() => {
    if (!panState?.active) return undefined;
    const onPointerMove = (event) => {
      setIsPanning(true);
      setViewState((prev) => ({
        ...prev,
        panX: panState.originX + (event.clientX - panState.startX),
        panY: panState.originY + (event.clientY - panState.startY),
      }));
    };
    const onPointerUp = () => {
      setPanState(null);
      setTimeout(() => setIsPanning(false), 0);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
    window.addEventListener('pointercancel', onPointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [panState]);

  useEffect(() => {
    if (!dragState?.active) return undefined;
    const onPointerMove = (event) => {
      const dx = (event.clientX - dragState.startClientX) / viewState.zoom;
      const dy = (event.clientY - dragState.startClientY) / viewState.zoom;
      const moved = dragState.moved || Math.abs(dx) > 3 || Math.abs(dy) > 3;
      setDragState((prev) => prev ? {
        ...prev,
        moved,
        previewX: prev.originX + dx,
        previewY: prev.originY + dy,
      } : prev);
    };
    const onPointerUp = () => {
      setDragState((prev) => {
        if (!prev) return prev;
        if (prev.moved) {
          const cell = boardPointToCell({ x: prev.previewX, y: prev.previewY });
          moveCombatantToCell(prev.combatantId, cell.col, cell.row);
        } else {
          setSelectedId(prev.combatantId);
        }
        return null;
      });
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
    window.addEventListener('pointercancel', onPointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [boardPointToCell, moveCombatantToCell, setSelectedId, viewState.zoom, dragState]);

  useEffect(() => {
    if (!rotateState?.active) return undefined;
    const onPointerMove = (event) => {
      const pointerAngle = pointerAngleFromCenter(
        rotateState.centerClientX,
        rotateState.centerClientY,
        event.clientX,
        event.clientY
      );
      const nextRotation = normalizeTokenRotation(
        rotateState.startRotation + normalizeAngleDelta(pointerAngle, rotateState.startPointerAngle),
        rotateState.previewRotation
      );
      setRotateState((prev) => {
        if (!prev || prev.previewRotation === nextRotation) return prev;
        return { ...prev, previewRotation: nextRotation };
      });
    };
    const onPointerUp = () => {
      setRotateState((prev) => {
        if (!prev) return prev;
        setCombatantTokenRotation(prev.combatantId, prev.previewRotation);
        return null;
      });
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
    window.addEventListener('pointercancel', onPointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [rotateState, setCombatantTokenRotation]);

  useEffect(() => {
    if (!contextMenu) return undefined;
    const dismiss = () => setContextMenu(null);
    const onKeyDown = (event) => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('pointerdown', dismiss);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [contextMenu]);

  useLayoutEffect(() => {
    if (!contextMenu) {
      setContextMenuPosition({ left: 12, top: 12, ready: false });
      return;
    }
    const placeMenu = () => {
      const menuEl = contextMenuRef.current;
      if (!menuEl) return;
      const menuRect = menuEl.getBoundingClientRect();
      const gutter = 12;
      const desiredLeft = contextMenu.clientX + 10;
      const desiredTop = contextMenu.clientY + 10;
      const left = clamp(desiredLeft, gutter, Math.max(gutter, window.innerWidth - menuRect.width - gutter));
      const top = clamp(desiredTop, gutter, Math.max(gutter, window.innerHeight - menuRect.height - gutter));
      setContextMenuPosition({ left, top, ready: true });
    };
    placeMenu();
    window.addEventListener('resize', placeMenu);
    return () => window.removeEventListener('resize', placeMenu);
  }, [contextMenu]);

  const handleStageWheel = useCallback((event) => {
    event.preventDefault();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const nextZoom = clamp(viewState.zoom + (event.deltaY < 0 ? 0.1 : -0.1), minZoom, 2.25);
    const boardX = (pointerX - viewState.panX) / viewState.zoom;
    const boardY = (pointerY - viewState.panY) / viewState.zoom;
    setViewState({
      zoom: nextZoom,
      panX: pointerX - boardX * nextZoom,
      panY: pointerY - boardY * nextZoom,
    });
  }, [minZoom, viewState.panX, viewState.panY, viewState.zoom]);

  const handleStagePointerDown = useCallback((event) => {
    if (event.button === 2) {
      if (!canSharePointer) return;
      setContextMenu(null);
      setPanState(null);
      setDragState(null);
      setRotateState(null);
      clearSharedPointerHoldTimer();
      sharedPointerHoldRef.current.active = false;
      sharedPointerHoldRef.current.pointerId = event.pointerId;
      sharedPointerHoldRef.current.clientX = event.clientX;
      sharedPointerHoldRef.current.clientY = event.clientY;
      sharedPointerHoldRef.current.lastBroadcastAt = 0;
      sharedPointerHoldRef.current.timerId = window.setTimeout(() => {
        const holdState = sharedPointerHoldRef.current;
        if (holdState.pointerId !== event.pointerId) return;
        holdState.active = true;
        holdState.timerId = null;
        const resolvedPoint = updateSharedPointerPreview(holdState.clientX, holdState.clientY);
        pushSharedPointerUpdate(holdState.clientX, holdState.clientY, true, resolvedPoint);
      }, SHARED_POINTER_HOLD_DELAY_MS);
      setSharedPointerTracking(true);
      return;
    }
    if (event.button !== 0) return;
    setContextMenu(null);
    if (interactionMode === 'draw') {
      event.preventDefault();
      setPanState(null);
      setDragState(null);
      setRotateState(null);
      const startPoint = clampBoardPoint(clientToBoardPoint(event.clientX, event.clientY));
      setDrawDraft({
        id: createId('battle-draw'),
        color: activeDrawColor,
        size: drawSize,
        points: [startPoint],
      });
      return;
    }
    if (interactionMode === 'erase') {
      event.preventDefault();
      setPanState(null);
      setDragState(null);
      setRotateState(null);
      eraseDrawingAtClientPoint(event.clientX, event.clientY);
      setEraseState({ active: true });
      return;
    }
    setPanState({
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewState.panX,
      originY: viewState.panY,
    });
  }, [
    activeDrawColor,
    clampBoardPoint,
    clientToBoardPoint,
    drawSize,
    eraseDrawingAtClientPoint,
    interactionMode,
    viewState.panX,
    viewState.panY,
    canSharePointer,
    clearSharedPointerHoldTimer,
    pushSharedPointerUpdate,
    updateSharedPointerPreview,
  ]);

  const handleStageContextMenu = useCallback((event) => {
    event.preventDefault();
    if (
      sharedPointerHoldRef.current.active
      || Date.now() < suppressSharedPointerContextMenuUntilRef.current
    ) return;
    if (interactionMode !== 'pan') return;
    const point = clientToBoardPoint(event.clientX, event.clientY);
    const cell = boardPointToCell(point);
    setContextMenu({
      type: 'board',
      clientX: event.clientX,
      clientY: event.clientY,
      cell,
    });
  }, [boardPointToCell, clientToBoardPoint, interactionMode]);

  const renderSharedPointerAt = useCallback((pointer) => {
    const stageX = viewState.panX + pointer.x * viewState.zoom;
    const stageY = viewState.panY + pointer.y * viewState.zoom;
    return (
      <div
        key={pointer.id}
        className={styles.sharedCursorAnchor}
        style={{
          left: `${stageX}px`,
          top: `${stageY}px`,
          '--shared-cursor-color': sharedPointerColor(pointer.id),
        }}
      >
        <div className={styles.sharedCursor}>
          <div className={styles.sharedCursorPulse} />
          <div className={styles.sharedCursorIcon} />
          <div className={styles.sharedCursorLabel}>{pointer.label}</div>
        </div>
      </div>
    );
  }, [viewState.panX, viewState.panY, viewState.zoom]);

  const renderedSharedPointers = useMemo(() => {
    if (!sharedPointerPreview) return sharedPointers;
    return [
      ...sharedPointers.filter((pointer) => pointer.id !== sharedPointerPreview.id),
      sharedPointerPreview,
    ];
  }, [sharedPointerPreview, sharedPointers]);

  const renderTokenAt = (combatant) => {
    const dragging = dragState?.combatantId === combatant.id;
    const rotating = rotateState?.combatantId === combatant.id;
    const center = dragging
      ? { x: dragState.previewX, y: dragState.previewY }
      : cellCenter(combatant.gridCol, combatant.gridRow);
    const stageX = viewState.panX + center.x * viewState.zoom;
    const stageY = viewState.panY + center.y * viewState.zoom;
    return (
      <div
        key={combatant.id}
        className={`${styles.boardTokenAnchor} ${dragging ? styles.boardTokenDragging : ''}`}
        style={{
          left: `${stageX}px`,
          top: `${stageY}px`,
          zIndex: dragging ? 30 : (combatant.id === selectedId ? 20 : combatant.id === activeCombatantId ? 16 : 12),
        }}
      >
        <div
          className={styles.boardTokenScale}
          style={{ transform: `scale(${viewState.zoom})` }}
        >
          <BattlefieldToken
            c={combatant}
            isActive={combatant.id === activeCombatantId}
            isSelected={combatant.id === selectedId}
            canRotate={canMoveCombatant(combatant)}
            isRotating={rotating}
            size={tokenSize}
            flipped={(combatant.side || 'Enemy') !== 'Enemy'}
            onHover={playHover}
            onRotateHandlePointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              const centerPoint = cellCenter(combatant.gridCol, combatant.gridRow);
              const centerClientPoint = boardPointToClientPoint(centerPoint);
              const startRotation = normalizeTokenRotation(combatant.tokenRotation, 0);
              setContextMenu(null);
              setPanState(null);
              setDragState(null);
              setSelectedId(combatant.id);
              if (!canMoveCombatant(combatant)) return;
              setRotateState({
                active: true,
                combatantId: combatant.id,
                centerClientX: centerClientPoint.x,
                centerClientY: centerClientPoint.y,
                startPointerAngle: pointerAngleFromCenter(
                  centerClientPoint.x,
                  centerClientPoint.y,
                  event.clientX,
                  event.clientY
                ),
                startRotation,
                previewRotation: startRotation,
              });
            }}
            rotationOverride={rotating ? rotateState.previewRotation : null}
            title={`${combatant.name} — drag to move, hover for rotate handle, double-click to open sheet`}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.stopPropagation();
              const centerPoint = cellCenter(combatant.gridCol, combatant.gridRow);
              setContextMenu(null);
              setRotateState(null);
              setSelectedId(combatant.id);
              if (!canMoveCombatant(combatant)) return;
              setDragState({
                active: true,
                combatantId: combatant.id,
                startClientX: event.clientX,
                startClientY: event.clientY,
                originX: centerPoint.x,
                originY: centerPoint.y,
                previewX: centerPoint.x,
                previewY: centerPoint.y,
                moved: false,
              });
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (
                sharedPointerHoldRef.current.active
                || Date.now() < suppressSharedPointerContextMenuUntilRef.current
              ) return;
              setSelectedId(combatant.id);
              setContextMenu({
                type: 'token',
                clientX: event.clientX,
                clientY: event.clientY,
                combatantId: combatant.id,
              });
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openSheetFor(combatant.id);
            }}
          />
        </div>
      </div>
    );
  };

  const menuCombatant = contextMenu?.type === 'token'
    ? combatants.find((combatant) => combatant.id === contextMenu.combatantId) || null
    : null;
  const menuCombatantStatuses = Array.isArray(menuCombatant?.status)
    ? menuCombatant.status.filter((entry) => cleanText(entry))
    : [];
  const selectedCombatant = selectedId
    ? combatants.find((combatant) => combatant.id === selectedId) || null
    : null;

  const contextMenuNode = contextMenu ? createPortal(
    <div
      ref={contextMenuRef}
      className={styles.boardContextMenu}
      style={{
        left: contextMenuPosition.left,
        top: contextMenuPosition.top,
        visibility: contextMenuPosition.ready ? 'visible' : 'hidden',
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {contextMenu.type === 'board' ? (
        <>
          <div className={styles.boardContextTitle}>Cell {contextMenu.cell.col}, {contextMenu.cell.row}</div>
          {selectedCombatant && canMoveCombatant(selectedCombatant) ? (
            <button
              type="button"
              className={styles.boardContextAction}
              onClick={() => {
                playNav();
                moveCombatantToCell(selectedCombatant.id, contextMenu.cell.col, contextMenu.cell.row);
                setContextMenu(null);
              }}
            >
              Move selected here
            </button>
          ) : (
            <div className={styles.boardContextHint}>Select a token to move it here.</div>
          )}
        </>
      ) : menuCombatant ? (
        <>
          <div className={styles.boardContextTitle}>{menuCombatant.name}</div>
          <button
            type="button"
            className={styles.boardContextAction}
            disabled={!canQuickEditCombatant(menuCombatant)}
            onClick={() => {
              playNav();
              toggleCombatantDead(menuCombatant.id);
              setContextMenu(null);
            }}
          >
            {menuCombatant.dead ? 'Mark alive' : 'Mark dead'}
          </button>
          <div className={styles.boardContextDivider} />
          <div className={styles.boardContextSubtitle}>Conditions</div>
          <div className={styles.boardContextHint}>
            {menuCombatantStatuses.length ? `Active: ${menuCombatantStatuses.join(', ')}` : 'No active conditions.'}
          </div>
          <select
            className={`${styles.input} ${styles.compactInput} ${styles.selectInput} ${styles.boardContextSelect}`}
            defaultValue=""
            disabled={!canQuickEditCombatant(menuCombatant)}
            onChange={(event) => {
              const statusLabel = cleanText(event.target.value);
              if (!statusLabel) return;
              playNav();
              toggleCombatantStatus(menuCombatant.id, statusLabel);
              setContextMenu(null);
            }}
          >
            <option value="">Toggle a condition...</option>
            {BOARD_STATUS_PRESETS.map((statusLabel) => {
              const active = menuCombatantStatuses.some((entry) => tokenKey(entry) === tokenKey(statusLabel));
              return (
                <option key={`${menuCombatant.id}-${statusLabel}`} value={statusLabel}>
                  {active ? `${statusLabel} (active)` : statusLabel}
                </option>
              );
            })}
          </select>
          <button
            type="button"
            className={styles.boardContextAction}
            disabled={!canQuickEditCombatant(menuCombatant)}
            onClick={() => {
              playNav();
              clearCombatantStatuses(menuCombatant.id);
              setContextMenu(null);
            }}
          >
            Clear conditions
          </button>
          <button
            type="button"
            className={`${styles.boardContextAction} ${styles.boardContextDanger}`}
            disabled={!canQuickEditCombatant(menuCombatant)}
            onClick={() => {
              playNav();
              removeCombatant(menuCombatant.id);
              setContextMenu(null);
            }}
          >
            Remove combatant
          </button>
        </>
      ) : null}
    </div>,
    document.body
  ) : null;

  return (
    <div className={styles.sceneRoot}>
      <div
        ref={stageRef}
        className={styles.boardStage}
        onWheel={handleStageWheel}
        onPointerDown={handleStagePointerDown}
        onContextMenu={handleStageContextMenu}
        style={{
          cursor:
            sharedPointerTracking
              ? 'none'
              : drawDraft || eraseState?.active || interactionMode === 'draw' || interactionMode === 'erase'
                ? 'crosshair'
                : dragState || isPanning
                  ? 'grabbing'
                  : 'grab',
        }}
      >
        <div
          className={styles.boardLayer}
          style={{
            width: boardWidth,
            height: boardHeight,
            transform: `translate(${viewState.panX}px, ${viewState.panY}px) scale(${viewState.zoom})`,
          }}
        >
            <div
              className={styles.boardBackdrop}
              style={{
                width: boardWidth,
                height: boardHeight,
                background: boardBackdropBackground,
              }}
            />
          <div className={styles.boardShade} />
          {battlefield.gridEnabled && (
            <div
              className={styles.boardGrid}
              style={{
                width: boardWidth,
                height: boardHeight,
                backgroundSize: `${cellSize}px ${cellSize}px`,
                backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`,
              }}
            />
          )}
          {(normalizedDrawings.length > 0 || drawDraft) && (
            <svg
              className={styles.boardDrawingLayer}
              viewBox={`0 0 ${boardWidth} ${boardHeight}`}
              style={{ width: boardWidth, height: boardHeight }}
              aria-hidden="true"
            >
              {normalizedDrawings.map((drawing) => (
                <path
                  key={drawing.id}
                  d={createBattlefieldSvgPath(drawing.points)}
                  stroke={drawing.color}
                  strokeWidth={drawing.size}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ))}
              {drawDraft && (
                <path
                  d={createBattlefieldSvgPath(drawDraft.points)}
                  stroke={drawDraft.color}
                  strokeWidth={drawDraft.size}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              )}
            </svg>
          )}
        </div>
        <div
          className={styles.boardTokenLayer}
          style={{ pointerEvents: interactionMode === 'pan' ? 'auto' : 'none' }}
        >
          <div className={styles.sharedCursorLayer} aria-hidden="true">
            {renderedSharedPointers.map((pointer) => renderSharedPointerAt(pointer))}
          </div>
          {combatants.map((combatant) => renderTokenAt(combatant))}
        </div>

        {combatants.length === 0 && (
          <div className={styles.sceneEmpty}>
            <div className={styles.sceneEmptyIcon}>Grid</div>
            <div className={styles.sceneEmptyText}>Add combatants to place tokens on the battle map.</div>
          </div>
        )}
      </div>
      <div className={styles.boardToolDock}>
        <div className={styles.boardToolTop}>
          {rightRailPanel}
          <div className={styles.boardToolRail}>
            {rightRailButtons ? (
              <>
                {rightRailButtons}
                <div className={styles.boardToolDivider} />
              </>
            ) : null}
            <button
              type="button"
              className={`${styles.boardToolButton} ${interactionMode === 'pan' ? styles.boardToolButtonActive : ''}`}
              onMouseEnter={playHover}
              onClick={() => {
                playNav();
                setBoardTool('pan');
              }}
              title="Pan and move tokens"
              aria-pressed={interactionMode === 'pan'}
            >
              ✋
            </button>
            <button
              type="button"
              className={`${styles.boardToolButton} ${interactionMode === 'draw' ? styles.boardToolButtonActive : ''}`}
              onMouseEnter={playHover}
              onClick={() => {
                playNav();
                if (!canDraw) return;
                setBoardTool('draw');
              }}
              title="Draw on the map"
              aria-pressed={interactionMode === 'draw'}
              disabled={!canDraw}
            >
              ✎
            </button>
            <button
              type="button"
              className={`${styles.boardToolButton} ${interactionMode === 'erase' ? styles.boardToolButtonActive : ''}`}
              onMouseEnter={playHover}
              onClick={() => {
                playNav();
                if (!canDraw || normalizedDrawings.length === 0) return;
                setBoardTool('erase');
              }}
              title="Erase drawn lines"
              aria-pressed={interactionMode === 'erase'}
              disabled={!canDraw || normalizedDrawings.length === 0}
            >
              ⌫
            </button>
            <div className={styles.boardToolDivider} />
            <button
              type="button"
              className={styles.boardToolButton}
              onMouseEnter={playHover}
              onClick={() => {
                playNav();
                undoDrawing();
                setBoardTool('pan');
              }}
              title="Undo last line"
              disabled={!canDraw || normalizedDrawings.length === 0}
            >
              ↶
            </button>
            <button
              type="button"
              className={`${styles.boardToolButton} ${styles.boardToolButtonDanger}`}
              onMouseEnter={playHover}
              onClick={() => {
                playNav();
                clearDrawings();
                setBoardTool('pan');
              }}
              title="Clear all drawings"
              disabled={!canDraw || normalizedDrawings.length === 0}
            >
              ✕
            </button>
          </div>
        </div>
        {interactionMode === 'draw' && canDraw && (
          <div className={styles.boardToolSettings}>
            <div className={styles.boardToolGroupLabel}>Ink</div>
            <div className={styles.boardToolSwatchRow}>
              {DRAW_TOOL_PRESETS.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.boardColorSwatch} ${activeDrawColor === value ? styles.boardColorSwatchActive : ''}`}
                  style={{ '--board-swatch': value }}
                  onMouseEnter={playHover}
                  onClick={() => {
                    playNav();
                    setDrawColor(value);
                  }}
                  title={`Use ${label} ink`}
                  aria-label={`Use ${label} ink`}
                  aria-pressed={activeDrawColor === value}
                />
              ))}
              <input
                ref={customDrawColorInputRef}
                type="color"
                className={styles.boardColorInput}
                value={activeDrawColor}
                aria-hidden="true"
                tabIndex={-1}
                onChange={(event) => {
                  setDrawColor(normalizeDrawColor(event.target.value));
                }}
              />
              <button
                type="button"
                className={`${styles.boardColorSwatch} ${styles.boardColorSwatchCustom} ${usingCustomDrawColor ? styles.boardColorSwatchActive : ''}`}
                style={{ '--board-custom-preview': activeDrawColor }}
                onMouseEnter={playHover}
                onClick={() => {
                  playNav();
                  openCustomDrawColorPicker();
                }}
                title="Pick custom ink"
                aria-label="Pick custom ink"
                aria-pressed={usingCustomDrawColor}
              />
            </div>
            <div className={styles.boardToolGroupLabel}>Size</div>
            <div className={styles.boardToolSizeRow}>
              {DRAW_STROKE_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`${styles.boardSizeChip} ${drawSize === size ? styles.boardSizeChipActive : ''}`}
                  onMouseEnter={playHover}
                  onClick={() => {
                    playNav();
                    setDrawSize(size);
                  }}
                  aria-pressed={drawSize === size}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {contextMenuNode}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function CombatPanel({
  panelType,
  cinematicNav,
  characters = [],
  characterControllers = {},
  canManageCombat = true,
  canWriteCombat = true,
  audioEnabled = true,
  viewerIdentity = null,
  canControlCharacter = () => true,
  playNav = () => {},
  playHover = () => {},
  sheetPopoutRequestToken = 0,
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

  const assignmentMatchesViewer = useCallback(
    (assignment) => {
      if (!assignment || typeof assignment !== 'object') return false;
      const assignmentUserId = cleanText(assignment.ownerUserId);
      const assignmentEmail = cleanText(assignment.ownerEmail).toLowerCase();
      const assignmentUsername = cleanText(assignment.ownerUsername).toLowerCase();
      if (assignmentUserId && viewerUserId && assignmentUserId === viewerUserId) return true;
      if (assignmentEmail && viewerEmail && assignmentEmail === viewerEmail) return true;
      if (assignmentUsername && viewerUsernameKey && assignmentUsername === viewerUsernameKey) return true;
      return false;
    },
    [viewerEmail, viewerUserId, viewerUsernameKey]
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
      if (sourceIdKey && canManageCombat) return combatant;

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
    [canManageCombat, viewerEmail, viewerUserId, viewerUsername]
  );

  const active = panelType === 'combat';
  const repositorySourceIdRef = useRef(createId('combat-sync'));
  const pointerRepositorySourceIdRef = useRef(createId('combat-pointer-sync'));
  const pointerBroadcastChannelRef = useRef(null);
  const pointerBroadcastConnectedRef = useRef(false);
  const suppressNextPersistRef = useRef(false);
  const persistTimerRef = useRef(null);
  const pendingPersistEncounterRef = useRef(null);
  const suppressCombatToBagSyncRef = useRef(false);
  const suppressBagToCombatSyncRef = useRef(false);

  const [bagInventoryState, setBagInventoryState] = useLocalStorageState(
    STORAGE_KEYS.bag,
    defaultBagInventoryState()
  );
  const normalizedBagInventory = useMemo(
    () => normalizeBagInventoryState(bagInventoryState),
    [bagInventoryState]
  );

  const [encounter, setEncounter] = useState(() => normalize(loadState()) || defaultEncounter());
  const [sharedPointerState, setSharedPointerState] = useState(() => normalizeBattlefieldPointers(repository.readJson(POINTERS_KEY, [])));
  const [selectedId, setSelectedId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState('edit');
  const [listEditorMode, setListEditorMode] = useState('');
  const [listEditorText, setListEditorText] = useState('');
  const [featureRawEditorOpen, setFeatureRawEditorOpen] = useState(false);
  const [featureRawSnapshot, setFeatureRawSnapshot] = useState('');
  const [spellbookDraftEntries, setSpellbookDraftEntries] = useState([]);
  const [activeSpellDraftId, setActiveSpellDraftId] = useState('');
  const [sheetToolsMode, setSheetToolsMode] = useState('resources');
  const [equipmentEditMode, setEquipmentEditMode] = useState('equipment');
  const [spellSearchQuery, setSpellSearchQuery] = useState('');
  const [sheetInventoryModalOpen, setSheetInventoryModalOpen] = useState(false);
  const [sheetInventoryEditorOpen, setSheetInventoryEditorOpen] = useState(false);
  const [sheetInventoryEditingId, setSheetInventoryEditingId] = useState('');
  const [sheetInventoryDraft, setSheetInventoryDraft] = useState(() => createSheetInventoryDraft());
  const [sheetActionDetail, setSheetActionDetail] = useState(null);
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
  const [battlefieldUploadBusy, setBattlefieldUploadBusy] = useState(false);
  const [battlefieldMediaUrl, setBattlefieldMediaUrl] = useState('');
  const [sceneDockOpen, setSceneDockOpen] = useState(false);
  const [initiativeDockOpen, setInitiativeDockOpen] = useState(false);
  const [diceDockOpen, setDiceDockOpen] = useState(false);
  const [diceNotationDraft, setDiceNotationDraft] = useState(DEFAULT_DICE_NOTATION);
  const [diceError, setDiceError] = useState('');
  const [diceRolling, setDiceRolling] = useState(false);
  const [diceActiveEntryId, setDiceActiveEntryId] = useState('');
  const [diceBannerEntry, setDiceBannerEntry] = useState(null);
  const [diceOutcomeEffect, setDiceOutcomeEffect] = useState(null);
  const [battlefieldResetRequestToken, setBattlefieldResetRequestToken] = useState(0);
  const [battlefieldPointerTick, setBattlefieldPointerTick] = useState(0);
  const sharedPointerStateRef = useRef(sharedPointerState);
  const pointerRealtimeEnabled = useMemo(() => !!(getSupabaseClient() && getCampaignId()), []);
  const diceViewportRef = useRef(null);
  const diceBoxRef = useRef(null);
  const diceBoxInitPromiseRef = useRef(null);
  const diceRollQueueRef = useRef(Promise.resolve());
  const diceAutoHideTimerRef = useRef(null);
  const diceBannerTimerRef = useRef(null);
  const diceOutcomeTimerRef = useRef(null);
  const diceOutcomeAudioContextRef = useRef(null);
  const diceOutcomeAudioCleanupRef = useRef(null);
  const diceHydratedLogRef = useRef(false);
  const seenDiceLogIdsRef = useRef(new Set());
  const localDiceLogIdsRef = useRef(new Set());

  useEffect(() => {
    setBagInventoryState((prev) => normalizeBagInventoryState(prev));
    // Normalize persisted shape once for cross-panel inventory sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Image Crop state ────────────────────────────────────────────────────
  const CROP_BOX = 260;
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState('');
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const cropImgRef = useRef(null);
  const cropDragRef = useRef({ dragging: false, sx: 0, sy: 0, ox: 0, oy: 0 });
  const battlefieldFileInputRef = useRef(null);
  const sheetFileInputRef = useRef(null);
  const sheetImportAbortRef = useRef(null);
  const [sheetPopoutOpen, setSheetPopoutOpen] = useState(false);
  const sheetPopoutWindowRef = useRef(null);
  const sheetPopoutRootRef = useRef(null);
  const suppressNextPopoutSessionEndRef = useRef(false);
  const handledSheetPopoutRequestTokenRef = useRef(0);
  const pendingRequestedSheetPopoutTargetRef = useRef('');

  useEffect(() => {
    const anyModalOpen = cropOpen || addModalOpen || restrictedModalOpen || editorOpen || !!listEditorMode || !!sheetInventoryModalOpen || !!sheetActionDetail;
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
      if (sheetActionDetail) {
        setSheetActionDetail(null);
        return;
      }
      if (sheetInventoryModalOpen) {
        setSheetInventoryModalOpen(false);
        setSheetInventoryEditorOpen(false);
        setSheetInventoryEditingId('');
        setSheetInventoryDraft(createSheetInventoryDraft());
        return;
      }
      if (editorOpen) {
        setEditorOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cropOpen, addModalOpen, restrictedModalOpen, sheetActionDetail, sheetInventoryModalOpen, editorOpen, listEditorMode, activeSpellDraftId, featureRawEditorOpen]);

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
      if (event?.meta?.source === 'remote' && pendingPersistEncounterRef.current) return;

      const incoming = normalize(event?.value) || defaultEncounter();
      setEncounter((prev) => {
        if (Object.is(prev, incoming)) return prev;
        suppressNextPersistRef.current = true;
        return incoming;
      });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    sharedPointerStateRef.current = sharedPointerState;
  }, [sharedPointerState]);

  useEffect(() => {
    if (!active || !pointerRealtimeEnabled) {
      pointerBroadcastConnectedRef.current = false;
      pointerBroadcastChannelRef.current = null;
      return undefined;
    }

    const supabase = getSupabaseClient();
    const campaignId = getCampaignId();
    if (!supabase || !campaignId) {
      pointerBroadcastConnectedRef.current = false;
      pointerBroadcastChannelRef.current = null;
      return undefined;
    }

    let effectActive = true;
    const channel = supabase.channel(`koa-combat-pointers:${campaignId}`, {
      config: {
        broadcast: {
          self: false,
          ack: false,
        },
      },
    });

    const applyIncomingPointer = (payload) => {
      const incomingPointer = normalizeBattlefieldPointer(payload?.pointer ?? payload);
      if (!incomingPointer.id) return;
      sharedPointerStateRef.current = normalizeBattlefieldPointers([
        ...sharedPointerStateRef.current.filter((pointer) => (
          pointer.id !== incomingPointer.id
          && incomingPointer.updatedAt - pointer.updatedAt <= SHARED_POINTER_VISIBLE_MS
        )),
        incomingPointer,
      ]);
      setSharedPointerState(sharedPointerStateRef.current);
    };

    const applyIncomingPointerClear = (payload) => {
      const pointerId = cleanText(payload?.id);
      if (!pointerId) return;
      const clearedAt = Math.max(Date.now(), toInt(payload?.updatedAt, 0));
      sharedPointerStateRef.current = sharedPointerStateRef.current.filter((pointer) => (
        pointer.id !== pointerId && clearedAt - pointer.updatedAt <= SHARED_POINTER_VISIBLE_MS
      ));
      setSharedPointerState(sharedPointerStateRef.current);
    };

    pointerBroadcastChannelRef.current = channel;

    channel
      .on('broadcast', { event: SHARED_POINTER_BROADCAST_EVENT }, ({ payload }) => {
        if (!effectActive) return;
        applyIncomingPointer(payload);
      })
      .on('broadcast', { event: SHARED_POINTER_CLEAR_EVENT }, ({ payload }) => {
        if (!effectActive) return;
        applyIncomingPointerClear(payload);
      })
      .subscribe((status) => {
        if (!effectActive) return;
        pointerBroadcastConnectedRef.current = status === 'SUBSCRIBED';
      });

    return () => {
      effectActive = false;
      pointerBroadcastConnectedRef.current = false;
      if (pointerBroadcastChannelRef.current === channel) {
        pointerBroadcastChannelRef.current = null;
      }
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [active, pointerRealtimeEnabled]);

  useEffect(() => {
    const unsubscribe = repository.subscribe(POINTERS_KEY, (event) => {
      if (event?.meta?.sourceId === pointerRepositorySourceIdRef.current) return;
      if (event?.meta?.type && event.meta.type !== 'json' && event.meta.type !== 'remove') return;
      const incoming = normalizeBattlefieldPointers(event?.value);
      sharedPointerStateRef.current = incoming;
      setSharedPointerState(incoming);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!hydrated.current) { hydrated.current = true; return; }
    if (suppressNextPersistRef.current) {
      suppressNextPersistRef.current = false;
      pendingPersistEncounterRef.current = null;
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      return;
    }
    pendingPersistEncounterRef.current = encounter;
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      const pendingEncounter = pendingPersistEncounterRef.current;
      if (!pendingEncounter) return;
      saveState(pendingEncounter, { sourceId: repositorySourceIdRef.current });
    }, ENCOUNTER_PERSIST_DEBOUNCE_MS);
  }, [encounter]);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      const pendingEncounter = pendingPersistEncounterRef.current;
      if (pendingEncounter) {
        saveState(pendingEncounter, { sourceId: repositorySourceIdRef.current });
      }
    };
  }, []);

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
  const selectedTokenScalePercent = selected ? Math.round(normalizeTokenScale(selected.tokenScale, 1) * 100) : 100;
  const selectedTokenRotationDegrees = selected ? normalizeTokenRotation(selected.tokenRotation, 0) : 0;
  const battlefield = useMemo(
    () => normalizeBattlefield(encounter?.battlefield),
    [encounter?.battlefield]
  );
  const battlefieldDrawings = useMemo(
    () => normalizeBattlefieldDrawings(battlefield?.drawings),
    [battlefield?.drawings]
  );
  const battlefieldPointers = sharedPointerState;
  const battleBg = battlefield.backgroundSrc || DEFAULT_BATTLEFIELD.backgroundSrc;
  const canConfigureBattlefield = canManageCombat;
  const battlefieldPointerId = useMemo(
    () => viewerUserId || viewerEmail || viewerUsernameKey || repositorySourceIdRef.current,
    [viewerEmail, viewerUserId, viewerUsernameKey]
  );
  const battlefieldPointerLabel = useMemo(
    () => viewerUsername || viewerEmail || 'Player',
    [viewerEmail, viewerUsername]
  );
  const canShareBattlefieldPointer = !!(active && battlefieldPointerId);
  const visibleBattlefieldPointers = useMemo(() => {
    const now = Date.now();
    return battlefieldPointers.filter((pointer) => now - pointer.updatedAt <= SHARED_POINTER_VISIBLE_MS);
  }, [battlefieldPointerTick, battlefieldPointers]);
  const canBoardMoveCombatant = useCallback(
    (combatant) => !!combatant && canWriteCombat,
    [canWriteCombat]
  );
  const canBoardQuickEditCombatant = useCallback(
    (combatant) => !!combatant && canWriteCombat,
    [canWriteCombat]
  );

  useEffect(() => {
    let cancelled = false;
    const storagePath = cleanText(battlefield.mediaStoragePath);
    if (!storagePath) {
      setBattlefieldMediaUrl('');
      return () => { cancelled = true; };
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setBattlefieldMediaUrl('');
      return () => { cancelled = true; };
    }

    const resolveSignedUrl = async () => {
      const { data, error } = await supabase.storage
        .from(COMBAT_MEDIA_BUCKET)
        .createSignedUrl(storagePath, 60 * 60);
      if (cancelled) return;
      if (error) {
        console.warn('[CombatPanel] Unable to resolve signed map URL.', error);
        setBattlefieldMediaUrl('');
        return;
      }
      setBattlefieldMediaUrl(cleanText(data?.signedUrl));
    };

    resolveSignedUrl();
    return () => { cancelled = true; };
  }, [battlefield.mediaStoragePath, battlefield.mediaUpdatedAt]);

  useEffect(() => {
    if (!battlefieldPointers.length) return undefined;
    const timerId = window.setInterval(() => {
      setBattlefieldPointerTick((tick) => tick + 1);
    }, SHARED_POINTER_CLEANUP_INTERVAL_MS);
    return () => window.clearInterval(timerId);
  }, [battlefieldPointers.length]);

  const updateBattlefieldPointersState = useCallback((builder) => {
    const currentPointers = sharedPointerStateRef.current;
    const builtPointers = typeof builder === 'function' ? builder(currentPointers) : builder;
    if (!Array.isArray(builtPointers)) return null;
    const nextPointers = normalizeBattlefieldPointers(builtPointers);
    if (battlefieldPointersEqual(currentPointers, nextPointers)) return null;
    sharedPointerStateRef.current = nextPointers;
    setSharedPointerState(nextPointers);
    return nextPointers;
  }, []);

  const sendBattlefieldPointerBroadcast = useCallback((event, payload) => {
    const channel = pointerBroadcastChannelRef.current;
    if (!pointerBroadcastConnectedRef.current || !channel) return false;
    channel.send({ type: 'broadcast', event, payload }).catch(() => {});
    return true;
  }, []);

  const setBattlefieldPointersState = useCallback((builder) => {
    const nextPointers = updateBattlefieldPointersState(builder);
    if (!nextPointers) return;
    if (pointerRealtimeEnabled && pointerBroadcastConnectedRef.current) return;
    repository.writeJson(POINTERS_KEY, nextPointers, { sourceId: pointerRepositorySourceIdRef.current });
  }, [pointerRealtimeEnabled, updateBattlefieldPointersState]);

  const clearLocalBattlefieldPointer = useCallback(() => {
    if (!battlefieldPointerId) return;
    const now = Date.now();
    setBattlefieldPointersState((currentPointers) => currentPointers.filter((pointer) => (
      pointer.id !== battlefieldPointerId && now - pointer.updatedAt <= SHARED_POINTER_VISIBLE_MS
    )));
    sendBattlefieldPointerBroadcast(SHARED_POINTER_CLEAR_EVENT, {
      id: battlefieldPointerId,
      updatedAt: now,
    });
  }, [battlefieldPointerId, sendBattlefieldPointerBroadcast, setBattlefieldPointersState]);

  const setLocalBattlefieldPointer = useCallback((point) => {
    if (!canShareBattlefieldPointer || !battlefieldPointerId) return;
    const now = Date.now();
    const nextPointer = normalizeBattlefieldPointer({
      id: battlefieldPointerId,
      label: battlefieldPointerLabel,
      x: point?.x ?? 0,
      y: point?.y ?? 0,
      updatedAt: now,
    });
    setBattlefieldPointersState((currentPointers) => {
      const retainedPointers = currentPointers.filter((pointer) => (
        pointer.id !== battlefieldPointerId && now - pointer.updatedAt <= SHARED_POINTER_VISIBLE_MS
      ));
      return [...retainedPointers, nextPointer];
    });
    sendBattlefieldPointerBroadcast(SHARED_POINTER_BROADCAST_EVENT, {
      pointer: nextPointer,
    });
  }, [battlefieldPointerId, battlefieldPointerLabel, canShareBattlefieldPointer, sendBattlefieldPointerBroadcast, setBattlefieldPointersState]);

  useEffect(() => {
    if (!canShareBattlefieldPointer) {
      clearLocalBattlefieldPointer();
    }
  }, [canShareBattlefieldPointer, clearLocalBattlefieldPointer]);

  useEffect(() => {
    if (!battlefieldPointers.length) return;
    const now = Date.now();
    if (!battlefieldPointers.some((pointer) => now - pointer.updatedAt > SHARED_POINTER_VISIBLE_MS)) return;
    setBattlefieldPointersState((currentPointers) => currentPointers.filter((pointer) => (
      now - pointer.updatedAt <= SHARED_POINTER_VISIBLE_MS
    )));
  }, [battlefieldPointerTick, battlefieldPointers, setBattlefieldPointersState]);

  const resolveCombatantInventoryAssignment = useCallback(
    (combatant) => {
      if (!combatant) return null;
      const linkedCharacter = resolveCharacterForCombatant(combatant);
      return getCharacterAccessEntry(characterControllers, linkedCharacter || combatant);
    },
    [characterControllers, resolveCharacterForCombatant]
  );
  const selectedInventoryOwnerUserId = useMemo(() => {
    if (!selected) return '';
    if ((selected.side || 'Enemy') === 'Enemy') return '';
    const assignment = resolveCombatantInventoryAssignment(selected);
    const assignmentOwnerUserId = cleanText(assignment?.ownerUserId);
    if (assignmentOwnerUserId) return assignmentOwnerUserId;
    const explicitOwnerId = cleanText(selected.createdByUserId);
    if (explicitOwnerId) return explicitOwnerId;
    if (!canManageCombat && viewerUserId && canControlCombatant(selected)) return viewerUserId;
    return '';
  }, [canControlCombatant, canManageCombat, resolveCombatantInventoryAssignment, selected, viewerUserId]);
  const selectedInventoryOwnerLabel = useMemo(() => {
    if (!selected) return '';
    const assignment = resolveCombatantInventoryAssignment(selected);
    const assignmentOwnerLabel = cleanText(assignment?.ownerUsername);
    if (assignmentOwnerLabel) return assignmentOwnerLabel;
    return cleanText(selected.createdByUsername) || viewerUsername || selected.name || 'Player';
  }, [resolveCombatantInventoryAssignment, selected, viewerUsername]);
  const selectedPersonalInventoryEntry = useMemo(
    () => getPersonalInventoryEntry(normalizedBagInventory, selectedInventoryOwnerUserId),
    [normalizedBagInventory, selectedInventoryOwnerUserId]
  );
  const selectedAttunementLimit = useMemo(
    () => normalizeAttunementLimit(selectedPersonalInventoryEntry?.attunementLimit),
    [selectedPersonalInventoryEntry?.attunementLimit]
  );
  const selectedAttunedInventoryItems = useMemo(() => {
    const items = Array.isArray(selectedPersonalInventoryEntry?.items)
      ? [...selectedPersonalInventoryEntry.items]
      : [];
    return items
      .filter((item) => !!item?.attuned)
      .sort((a, b) => cleanText(a?.name).localeCompare(cleanText(b?.name)));
  }, [selectedPersonalInventoryEntry?.items]);
  const selectedAttunementSlots = useMemo(() => (
    Array.from({ length: selectedAttunementLimit }, (_, idx) => cleanText(selectedAttunedInventoryItems[idx]?.name))
  ), [selectedAttunedInventoryItems, selectedAttunementLimit]);
  const selectedAttunedOverflowCount = Math.max(0, selectedAttunedInventoryItems.length - selectedAttunementLimit);
  const selectedPersonalInventoryEquipmentLines = useMemo(
    () => inventoryItemsToEquipmentLines(selectedPersonalInventoryEntry.items),
    [selectedPersonalInventoryEntry.items]
  );
  const selectedPersonalInventoryEquippedLines = useMemo(
    () => inventoryItemsToEquippedLines(selectedPersonalInventoryEntry.items),
    [selectedPersonalInventoryEntry.items]
  );
  const selectedInventoryManagedInPartyHub = useMemo(() => {
    if (!selected) return false;
    return (selected.side || 'Enemy') !== 'Enemy';
  }, [selected?.id, selected?.side]);
  const selectedSensitiveStatsHidden = !!selected?.hideSensitiveStats;
  const selectedRestrictedPortrait = useMemo(() => {
    if (!selected) return '';
    return cleanText(selected.customImage) || tokenImageForCharacter(selected.sourceCharacterId, selected.name) || '';
  }, [selected?.customImage, selected?.sourceCharacterId, selected?.name]);
  const selectedStatusConditions = useMemo(
    () => normalizeStringList(selected?.status),
    [selected?.status]
  );
  const selectedEquipment = useMemo(
    () => normalizeStringList(selected?.equipmentItems),
    [selected?.equipmentItems]
  );
  const selectedWeaponActionRows = useMemo(
    () => normalizeWeaponActions(selected?.weaponActions, selected?.equipmentItems),
    [selected?.weaponActions, selected?.equipmentItems]
  );
  const selectedEquipableItems = useMemo(
    () => buildEquipableItems(selectedWeaponActionRows, selectedEquipment),
    [selectedEquipment, selectedWeaponActionRows]
  );
  const selectedEquippedItems = useMemo(
    () => normalizeEquippedItems(selected?.equippedItems, selectedEquipableItems),
    [selected?.equippedItems, selectedEquipableItems]
  );
  const selectedEquippedItemKeys = useMemo(
    () => new Set(selectedEquippedItems.map((item) => tokenKey(item)).filter(Boolean)),
    [selectedEquippedItems]
  );
  const selectedSensitiveEquipment = useMemo(() => {
    return selectedEquippedItems;
  }, [selectedEquippedItems]);
  const selectedEquippedWeapons = useMemo(() => {
    const seen = new Set();
    const fromWeaponRows = selectedWeaponActionRows
      .map((weapon) => cleanText(weapon.attack))
      .filter((name) => {
        const key = tokenKey(name);
        if (!key || !selectedEquippedItemKeys.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    const fromEquippedItems = selectedEquippedItems.filter((name) => {
      const key = tokenKey(name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return [...fromWeaponRows, ...fromEquippedItems];
  }, [selectedEquippedItemKeys, selectedEquippedItems, selectedWeaponActionRows]);
  const selectedCurrentHp = useMemo(() => {
    if (!selected) return '—';
    return selected.hp === '' || selected.hp == null ? '—' : String(selected.hp);
  }, [selected?.hp]);
  const selectedNotableFeature = useMemo(
    () => cleanText(selected?.notableFeature),
    [selected?.notableFeature]
  );
  const castorWilliamPair = useMemo(() => findCastorWilliamPair(combatants), [combatants]);
  const selectedCastorWilliamRole = useMemo(
    () => castorWilliamSyncRole(selected),
    [selected?.sourceCharacterId, selected?.name]
  );
  const castorWilliamResourceSyncAvailable = !!castorWilliamPair.castor && !!castorWilliamPair.william;
  const castorWilliamResourceSyncEnabled = !!encounter.castorWilliamResourceSync;
  const castorWilliamSyncSwitchTitle = castorWilliamResourceSyncAvailable
    ? 'Mirror HP, spell slots, and feature charges between Castor and William Spicer'
    : 'Add both Castor and William Spicer to enable sync';
  const activeCombatant = combatants[encounter.activeIndex] || null;
  const activeCombatantId = activeCombatant?.id || null;
  const diceLog = useMemo(
    () => normalizeDiceLog(encounter?.diceLog),
    [encounter?.diceLog]
  );
  const diceLogEntries = useMemo(
    () => [...diceLog].reverse(),
    [diceLog]
  );
  const diceRollerUserId = useMemo(
    () => cleanText(viewerIdentity?.userId) || cleanText(viewerIdentity?.email).toLowerCase() || cleanText(viewerIdentity?.username).toLowerCase(),
    [viewerIdentity]
  );
  const diceRollerName = useMemo(
    () => cleanText(viewerIdentity?.username) || cleanText(viewerIdentity?.email) || 'Player',
    [viewerIdentity]
  );
  const appendEncounterDiceLog = useCallback((entry) => {
    if (!entry) return;
    setEncounter((prev) => ({
      ...prev,
      diceLog: appendDiceLogEntry(prev?.diceLog, entry),
      updatedAt: Date.now(),
    }));
  }, []);
  const stopDiceOutcomeAudio = useCallback(() => {
    const cleanup = diceOutcomeAudioCleanupRef.current;
    diceOutcomeAudioCleanupRef.current = null;
    if (typeof cleanup === 'function') {
      try {
        cleanup();
      } catch {}
    }
  }, []);
  const clearDiceOutcomeEffect = useCallback(() => {
    if (diceOutcomeTimerRef.current) {
      clearTimeout(diceOutcomeTimerRef.current);
      diceOutcomeTimerRef.current = null;
    }
    stopDiceOutcomeAudio();
    setDiceOutcomeEffect(null);
  }, [stopDiceOutcomeAudio]);
  const showDiceBanner = useCallback((entry) => {
    if (!entry) return;
    if (diceBannerTimerRef.current) {
      clearTimeout(diceBannerTimerRef.current);
      diceBannerTimerRef.current = null;
    }
    setDiceBannerEntry(entry);
    diceBannerTimerRef.current = setTimeout(() => {
      setDiceBannerEntry(null);
      diceBannerTimerRef.current = null;
    }, DICE_AUTO_HIDE_MS);
  }, []);
  const playDiceOutcomeAudio = useCallback((kind) => {
    if (!audioEnabled || kind !== 'nat1' || typeof window === 'undefined') return;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;

    let audioContext = diceOutcomeAudioContextRef.current;
    if (!audioContext || audioContext.state === 'closed') {
      try {
        audioContext = new AudioContextCtor();
        diceOutcomeAudioContextRef.current = audioContext;
      } catch {
        return;
      }
    }

    const playTone = () => {
      stopDiceOutcomeAudio();

      try {
        const now = audioContext.currentTime + 0.01;
        const master = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        const bass = audioContext.createOscillator();
        const undertone = audioContext.createOscillator();

        master.gain.setValueAtTime(0.0001, now);
        master.gain.linearRampToValueAtTime(0.08, now + 0.24);
        master.gain.exponentialRampToValueAtTime(0.028, now + 1.4);
        master.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(760, now);
        filter.frequency.exponentialRampToValueAtTime(150, now + 2.35);
        filter.Q.setValueAtTime(4.5, now);

        bass.type = 'sawtooth';
        bass.frequency.setValueAtTime(118, now);
        bass.frequency.exponentialRampToValueAtTime(44, now + 2.45);

        undertone.type = 'triangle';
        undertone.frequency.setValueAtTime(61, now);
        undertone.frequency.exponentialRampToValueAtTime(27, now + 2.55);
        undertone.detune.setValueAtTime(-6, now);

        bass.connect(filter);
        undertone.connect(filter);
        filter.connect(master);
        master.connect(audioContext.destination);

        bass.start(now);
        undertone.start(now);
        bass.stop(now + 2.65);
        undertone.stop(now + 2.65);

        const cleanup = () => {
          [bass, undertone].forEach((oscillator) => {
            try {
              oscillator.stop();
            } catch {}
            try {
              oscillator.disconnect();
            } catch {}
          });
          [filter, master].forEach((node) => {
            try {
              node.disconnect();
            } catch {}
          });
        };
        diceOutcomeAudioCleanupRef.current = cleanup;

        window.setTimeout(() => {
          if (diceOutcomeAudioCleanupRef.current === cleanup) {
            stopDiceOutcomeAudio();
          }
        }, 2900);
      } catch {
        stopDiceOutcomeAudio();
      }
    };

    if (audioContext.state === 'suspended') {
      audioContext.resume().then(playTone).catch(() => {});
      return;
    }

    playTone();
  }, [audioEnabled, stopDiceOutcomeAudio]);
  useEffect(() => {
    if (!audioEnabled) {
      stopDiceOutcomeAudio();
    }
  }, [audioEnabled, stopDiceOutcomeAudio]);
  const triggerDiceOutcomeEffect = useCallback((entry) => {
    const kind = getDiceOutcomeKind(entry);
    if (!kind) return;

    if (diceOutcomeTimerRef.current) {
      clearTimeout(diceOutcomeTimerRef.current);
      diceOutcomeTimerRef.current = null;
    }

    setDiceOutcomeEffect({
      key: `${entry.id}-${Date.now()}`,
      kind,
      rolledByName: entry.rolledByName || 'Player',
      total: entry.total,
    });

    if (kind === 'nat1') {
      playDiceOutcomeAudio(kind);
    } else {
      stopDiceOutcomeAudio();
    }

    diceOutcomeTimerRef.current = setTimeout(() => {
      diceOutcomeTimerRef.current = null;
      stopDiceOutcomeAudio();
      setDiceOutcomeEffect(null);
    }, DICE_OUTCOME_EFFECT_MS);
  }, [playDiceOutcomeAudio, stopDiceOutcomeAudio]);
  const ensureDiceBox = useCallback(async () => {
    if (diceBoxRef.current) return diceBoxRef.current;
    if (diceBoxInitPromiseRef.current) return diceBoxInitPromiseRef.current;
    if (!diceViewportRef.current) {
      throw new Error('Dice viewport is not ready yet.');
    }

    setDiceError('');
    diceBoxInitPromiseRef.current = import('@3d-dice/dice-box')
      .then(async ({ default: DiceBox }) => {
        const box = new DiceBox({
          container: `#${DICE_BOX_VIEWPORT_ID}`,
          assetPath: DICE_BOX_ASSET_PATH,
          theme: 'default',
          themeColor: DICE_THEME_COLOR,
          scale: 5,
        });
        await box.init();
        box.hide();
        diceBoxRef.current = box;
        return box;
      })
      .catch((error) => {
        diceBoxInitPromiseRef.current = null;
        diceBoxRef.current = null;
        throw error;
      });

    return diceBoxInitPromiseRef.current;
  }, []);
  const queueDiceAnimation = useCallback(async ({ entryId = '', notation = '', replayResults = null }) => {
    const run = async () => {
      let box;
      try {
        box = await ensureDiceBox();
        if (diceAutoHideTimerRef.current) {
          clearTimeout(diceAutoHideTimerRef.current);
          diceAutoHideTimerRef.current = null;
        }
        clearDiceOutcomeEffect();
        box.show();
        setDiceBannerEntry(null);
        setDiceRolling(true);
        setDiceActiveEntryId(entryId);
        const payload = Array.isArray(replayResults) && replayResults.length > 0
          ? replayResults.map((result) => ({ ...result }))
          : notation;
        const result = await box.roll(payload, { themeColor: DICE_THEME_COLOR, newStartPoint: true });
        diceAutoHideTimerRef.current = setTimeout(() => {
          try {
            box.clear();
            box.hide();
          } catch {}
          diceAutoHideTimerRef.current = null;
        }, DICE_AUTO_HIDE_MS);
        return result;
      } catch (error) {
        console.error('[CombatPanel] Dice roll failed.', error);
        setDiceError('Dice roll failed. Try again.');
        throw error;
      } finally {
        setDiceRolling(false);
        setDiceActiveEntryId('');
      }
    };

    const queued = diceRollQueueRef.current
      .catch(() => {})
      .then(run);
    diceRollQueueRef.current = queued.catch(() => {});
    return queued;
  }, [ensureDiceBox]);
  const handleDiceRollRequest = useCallback(async (rawNotation) => {
    const normalized = normalizeDiceNotation(rawNotation);
    if (!normalized.ok) {
      setDiceError(normalized.error);
      return;
    }

    const { parsed } = normalized;
    setDiceError('');
    setDiceNotationDraft(parsed.displayNotation);
    try {
      const results = await queueDiceAnimation({ notation: parsed.engineNotation });
      const logEntry = createDiceLogEntry({
        notation: parsed.displayNotation,
        modifier: parsed.modifier,
        results,
        rolledByUserId: diceRollerUserId,
        rolledByName: diceRollerName,
      });
      seenDiceLogIdsRef.current.add(logEntry.id);
      localDiceLogIdsRef.current.add(logEntry.id);
      appendEncounterDiceLog(logEntry);
      showDiceBanner(logEntry);
      triggerDiceOutcomeEffect(logEntry);
    } catch {}
  }, [appendEncounterDiceLog, diceRollerName, diceRollerUserId, queueDiceAnimation, showDiceBanner, triggerDiceOutcomeEffect]);
  const handleSheetStatRoll = useCallback((modifier) => {
    const notation = buildD20CheckNotation(modifier);
    if (!notation) return;
    playNav();
    if (!sheetPopoutOpen) {
      setEditorOpen(false);
    }
    handleDiceRollRequest(notation);
  }, [handleDiceRollRequest, playNav, sheetPopoutOpen]);
  useEffect(() => {
    if (!active || !diceDockOpen) return;
    ensureDiceBox().catch((error) => {
      console.error('[CombatPanel] Unable to initialize Dice Box.', error);
      setDiceError('Unable to load the 3D dice renderer.');
    });
  }, [active, diceDockOpen, ensureDiceBox]);
  useEffect(() => {
    if (!active) return;
    const currentIds = new Set(diceLog.map((entry) => entry.id));
    if (!diceHydratedLogRef.current) {
      seenDiceLogIdsRef.current = currentIds;
      diceHydratedLogRef.current = true;
      return;
    }

    diceLog.forEach((entry) => {
      if (seenDiceLogIdsRef.current.has(entry.id)) return;
      seenDiceLogIdsRef.current.add(entry.id);
      if (localDiceLogIdsRef.current.has(entry.id)) {
        localDiceLogIdsRef.current.delete(entry.id);
        return;
      }
      queueDiceAnimation({ entryId: entry.id, replayResults: entry.results })
        .then(() => {
          showDiceBanner(entry);
          triggerDiceOutcomeEffect(entry);
        })
        .catch(() => {});
    });
  }, [active, diceLog, queueDiceAnimation, showDiceBanner, triggerDiceOutcomeEffect]);
  useEffect(() => () => {
    if (diceAutoHideTimerRef.current) {
      clearTimeout(diceAutoHideTimerRef.current);
      diceAutoHideTimerRef.current = null;
    }
    if (diceBannerTimerRef.current) {
      clearTimeout(diceBannerTimerRef.current);
      diceBannerTimerRef.current = null;
    }
    if (diceOutcomeTimerRef.current) {
      clearTimeout(diceOutcomeTimerRef.current);
      diceOutcomeTimerRef.current = null;
    }
    stopDiceOutcomeAudio();
    if (diceOutcomeAudioContextRef.current && typeof diceOutcomeAudioContextRef.current.close === 'function') {
      diceOutcomeAudioContextRef.current.close().catch(() => {});
      diceOutcomeAudioContextRef.current = null;
    }
    diceBoxRef.current?.clear?.();
    diceBoxRef.current?.hide?.();
    diceBoxRef.current = null;
    diceBoxInitPromiseRef.current = null;
    if (diceViewportRef.current) {
      diceViewportRef.current.innerHTML = '';
    }
  }, [stopDiceOutcomeAudio]);
  const selectedSavingThrowRows = useMemo(
    () => normalizeSavingThrowRows(selected?.savingThrows, selected?.abilities, selected?.level),
    [selected?.savingThrows, selected?.abilities, selected?.level]
  );
  const selectedSkillRows = useMemo(
    () => normalizeSkillRows(selected?.skills, selected?.abilities, selected?.level),
    [selected?.skills, selected?.abilities, selected?.level]
  );
  const selectedSenseRows = useMemo(
    () => normalizeSenseRows(selected?.senses),
    [selected?.senses]
  );
  const selectedSpellbookEntries = useMemo(
    () => normalizeSpellbookEntries(selected?.spellbookEntries, selected?.spellList),
    [selected?.spellbookEntries, selected?.spellList]
  );
  const selectedSpellActionRows = useMemo(
    () => selectedSpellbookEntries.map((spell, index) => buildSpellActionRow(spell, index)),
    [selectedSpellbookEntries]
  );
  const selectedSpellActionGroups = useMemo(
    () => groupedSpellbookEntries(selectedSpellbookEntries).map((group) => ({
      key: group.key,
      label: spellLevelDividerLabel(group.level),
      rows: group.entries.map((spell, index) => buildSpellActionRow(spell, index)),
    })),
    [selectedSpellbookEntries]
  );
  const filteredSelectedSpellActionGroups = useMemo(() => {
    const query = cleanText(spellSearchQuery).toLowerCase();
    if (!query) return selectedSpellActionGroups;
    return selectedSpellActionGroups
      .map((group) => {
        const rows = group.rows.filter((spellRow) => {
          const spell = spellRow.spell || {};
          const haystack = [
            spellRow.attack,
            spellRow.range,
            spellRow.hitDc,
            spellRow.damage,
            cleanText(spell.notes),
            cleanText(spell.time),
            cleanText(spell.duration),
          ]
            .join(' ')
            .toLowerCase();
          return haystack.includes(query);
        });
        return { ...group, rows };
      })
      .filter((group) => group.rows.length > 0);
  }, [selectedSpellActionGroups, spellSearchQuery]);
  const hasSpellSearchQuery = !!cleanText(spellSearchQuery);
  const selectedEquippedInventoryWeaponRows = useMemo(() => {
    const items = Array.isArray(selectedPersonalInventoryEntry?.items)
      ? selectedPersonalInventoryEntry.items
      : [];
    const seen = new Set();
    return items
      .map((item, index) => {
        if (!item || !item.equipped) return null;
        const attack = cleanText(item.name);
        const attackKey = tokenKey(attack);
        if (!attack || !attackKey || seen.has(attackKey)) return null;
        const categoryKey = cleanText(item.category).toLowerCase();
        const proficiency = cleanText(item.weaponProficiency || item.proficiency);
        const attackType = cleanText(item.weaponAttackType || item.attackType);
        const range = cleanText(item.weaponReach || item.reach);
        const hitDc = cleanText(item.weaponHitDc || item.hitDc);
        const damage = cleanText(item.weaponDamage || item.damage);
        const damageType = cleanText(item.weaponDamageType || item.damageType);
        const properties = cleanText(item.weaponProperties || item.properties);
        const hasWeaponMetadata = !!(proficiency || attackType || range || hitDc || damage || damageType || properties);
        if (categoryKey !== 'weapon' && !hasWeaponMetadata) return null;
        seen.add(attackKey);
        return {
          id: cleanText(item.id) || `inventory-equip-${index}-${attackKey}`,
          attack,
          range,
          hitDc,
          damage,
          rarity: cleanText(item.rarity),
          category: cleanText(item.category),
          weaponProficiency: proficiency,
          weaponHitDc: hitDc,
          weaponAttackType: attackType,
          weaponReach: range,
          weaponDamage: damage,
          weaponDamageType: damageType,
          weaponProperties: properties,
          weight: cleanText(item.weight),
          value: cleanText(item.value),
          notes: cleanText(item.notes),
          tags: normalizeStringList(item.tags),
          equipped: !!item.equipped,
        };
      })
      .filter(Boolean);
  }, [selectedPersonalInventoryEntry?.items]);
  const isInventoryWeaponActionDetail = sheetActionDetail?.type === 'inventoryWeapon';
  const inventoryWeaponActionPayload = isInventoryWeaponActionDetail && sheetActionDetail?.payload && typeof sheetActionDetail.payload === 'object'
    ? sheetActionDetail.payload
    : null;
  const inventoryWeaponActionTags = isInventoryWeaponActionDetail
    ? normalizeStringList(inventoryWeaponActionPayload?.tags)
    : [];
  const inventoryWeaponActionMeta = isInventoryWeaponActionDetail
    ? [cleanText(inventoryWeaponActionPayload?.category), cleanText(inventoryWeaponActionPayload?.rarity)].filter(Boolean).join(' - ')
    : '';
  const inventoryWeaponActionWeight = isInventoryWeaponActionDetail
    ? cleanText(inventoryWeaponActionPayload?.weight)
    : '';
  const inventoryWeaponActionCost = isInventoryWeaponActionDetail
    ? cleanText(inventoryWeaponActionPayload?.value)
    : '';
  const sheetInventoryItems = useMemo(() => {
    const items = Array.isArray(selectedPersonalInventoryEntry?.items)
      ? [...selectedPersonalInventoryEntry.items]
      : [];
    items.sort((a, b) => {
      const equippedDelta = Number(!!b?.equipped) - Number(!!a?.equipped);
      if (equippedDelta !== 0) return equippedDelta;
      const updatedDelta = new Date(b?.updatedAt || 0) - new Date(a?.updatedAt || 0);
      if (updatedDelta !== 0) return updatedDelta;
      return cleanText(a?.name).localeCompare(cleanText(b?.name));
    });
    return items;
  }, [selectedPersonalInventoryEntry?.items]);
  const isSheetInventoryDraftWeapon = normalizeInventoryCategory(sheetInventoryDraft.category) === 'Weapon';
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
  }, [selected?.hp, selected?.maxHP]);
  const selectedProficiencyBonus = useMemo(() => {
    if (!selected) return null;
    if (selected.proficiencyBonus != null && selected.proficiencyBonus !== '') {
      return toInt(selected.proficiencyBonus, null);
    }
    if (selected.level === '' || selected.level == null) return null;
    return proficiencyBonusFromLevel(selected.level);
  }, [selected?.proficiencyBonus, selected?.level]);
  const allSpellSlots = useMemo(
    () => normalizeSpellSlots(selected?.spellSlots),
    [selected?.spellSlots]
  );
  const visibleSheetSpellSlots = useMemo(
    () => allSpellSlots.filter((slot) => Number(slot.max) > 0),
    [allSpellSlots]
  );
  const allFeatureCharges = useMemo(
    () => normalizeFeatureCharges(selected?.featureCharges),
    [selected?.featureCharges]
  );
  const visibleSheetFeatureCharges = useMemo(
    () => allFeatureCharges.filter((feature) => Number(feature.max) > 0),
    [allFeatureCharges]
  );
  const initiativeDisplayList = useMemo(() => {
    if (!combatants.length) return [];
    const safeActive = clamp(encounter.activeIndex, 0, combatants.length - 1);
    return [...combatants.slice(safeActive), ...combatants.slice(0, safeActive)];
  }, [combatants, encounter.activeIndex]);

  useEffect(() => {
    if (!editorOpen || !selectedId) return;
    setHpAdjustAmount('0');
    setStatusDraft(selected ? selected.status.join(', ') : '');
    setEquipmentEditMode('equipment');
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
    if (!sheetActionDetail) return;
    if (!editorOpen || !selected || editorMode !== 'sheet') {
      setSheetActionDetail(null);
    }
  }, [sheetActionDetail, editorOpen, selected, editorMode]);

  useEffect(() => {
    if (!sheetInventoryModalOpen) return;
    if (!editorOpen || !selected || !selectedInventoryManagedInPartyHub) {
      setSheetInventoryModalOpen(false);
      setSheetInventoryEditorOpen(false);
      setSheetInventoryEditingId('');
      setSheetInventoryDraft(createSheetInventoryDraft());
    }
  }, [sheetInventoryModalOpen, editorOpen, selected, selectedInventoryManagedInPartyHub]);

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

    const screenWidth = Math.max(1024, toInt(window.screen?.availWidth, 1280));
    const screenHeight = Math.max(720, toInt(window.screen?.availHeight, 900));
    const featureString = [
      'popup=yes',
      `width=${screenWidth}`,
      `height=${screenHeight}`,
      'left=0',
      'top=0',
      'resizable=yes',
      'scrollbars=yes',
    ].join(',');
    const popout = window.open('', 'combat-sheet-popout', featureString);
    if (!popout) {
      window.alert('Pop-up blocked. Please allow pop-ups for this site to use Character Sheet pop out.');
      return;
    }

    try {
      try {
        if (typeof popout.moveTo === 'function') popout.moveTo(0, 0);
        if (typeof popout.resizeTo === 'function') popout.resizeTo(screenWidth, screenHeight);
      } catch (_) {}

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
    const pendingTargetId = pendingRequestedSheetPopoutTargetRef.current;
    if (!pendingTargetId) return;
    if (!editorOpen || editorMode !== 'sheet') return;
    if (!selected || cleanText(selected.id) !== pendingTargetId) return;
    pendingRequestedSheetPopoutTargetRef.current = '';
    openSheetPopout();
  }, [editorMode, editorOpen, openSheetPopout, selected]);

  useEffect(() => {
    if (!sheetPopoutOpen) return;
    const popout = sheetPopoutWindowRef.current;
    if (!popout || popout.closed) {
      setSheetPopoutOpen(false);
      sheetPopoutWindowRef.current = null;
      sheetPopoutRootRef.current = null;
      return;
    }
    if (!editorOpen || !selected) {
      closeSheetPopout(true, { suppressSessionEnd: true });
      return;
    }
    popout.document.title = `${selected.name} — ${editorMode === 'sheet' ? 'Character Sheet' : 'Combatant Editor'}`;
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
      const startingGrid = (
        normalizeGridCoordinate(incomingCombatant.gridCol, null) != null
        && normalizeGridCoordinate(incomingCombatant.gridRow, null) != null
      )
        ? {
            gridCol: normalizeGridCoordinate(incomingCombatant.gridCol, 0),
            gridRow: normalizeGridCoordinate(incomingCombatant.gridRow, 0),
          }
        : nextGridPlacementForCombatantList(next.combatants, incomingCombatant.side);
      const profileKey = sheetProfileKey(incomingCombatant.sourceCharacterId, incomingCombatant.name);
      const profile = profileKey ? next.sheetProfiles?.[profileKey] : null;
      const withGrid = { ...incomingCombatant, ...startingGrid };
      const nextCombatant = profile ? applySheetProfileToCombatant(withGrid, profile) : withGrid;
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
      weaponActions: [],
      equipmentItems:[], equippedItems: [], otherPossessions:[],
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
      tokenScale: 1,
      tokenRotation: 0,
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
      weaponActions: [],
      equipmentItems:[], equippedItems: [], otherPossessions:[],
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
      tokenScale: 1,
      tokenRotation: 0,
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

  const setSelectedField = (patchOrBuilder) => {
    if (!selectedId) return;
    setEncounter((prev) => {
      if (!prev || !Array.isArray(prev.combatants)) return prev;
      const activeId = prev.combatants[prev.activeIndex]?.id || null;
      const selectedCombatant = prev.combatants.find((combatant) => combatant.id === selectedId);
      if (!selectedCombatant || !canControlCombatant(selectedCombatant)) return prev;

      const patchCandidate =
        typeof patchOrBuilder === 'function'
          ? patchOrBuilder(selectedCombatant)
          : patchOrBuilder;
      if (!patchCandidate || typeof patchCandidate !== 'object') return prev;
      if (Object.keys(patchCandidate).length === 0) return prev;

      const patch = { ...patchCandidate };
      if (Object.prototype.hasOwnProperty.call(patch, 'equipmentItems')) {
        patch.equipmentItems = normalizeStringList(patch.equipmentItems);
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'weaponActions')) {
        const weaponFallbackItems = Object.prototype.hasOwnProperty.call(patch, 'equipmentItems')
          ? patch.equipmentItems
          : selectedCombatant.equipmentItems;
        patch.weaponActions = normalizeWeaponActions(patch.weaponActions, weaponFallbackItems);
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'equippedItems')) {
        patch.equippedItems = normalizeStringList(patch.equippedItems);
      }

      const patchKeys = Object.keys(patch);
      if (!patchKeys.length) return prev;
      const previousProfileKey = sheetProfileKey(selectedCombatant.sourceCharacterId, selectedCombatant.name);
      const pair = findCastorWilliamPair(prev.combatants);
      const syncRole = castorWilliamSyncRole(selectedCombatant);
      const mirrorTargetId =
        syncRole === 'castor'
          ? pair.william?.id || ''
          : syncRole === 'william'
            ? pair.castor?.id || ''
            : '';
      const mirroredResourcePatch =
        prev.castorWilliamResourceSync && mirrorTargetId
          ? pickCastorWilliamResourcePatch(patch)
          : null;
      const mirroredPatch = mirroredResourcePatch ? cloneCastorWilliamResourcePatch(mirroredResourcePatch) : null;
      const mirroredPatchKeys = mirroredPatch ? Object.keys(mirroredPatch) : [];
      let selectedChanged = false;
      let mirroredChanged = false;

      let nextCombatants = prev.combatants.map((combatant) => {
        if (combatant.id === selectedCombatant.id) {
          const hasSelectedFieldChanges = patchKeys.some((key) => !Object.is(combatant[key], patch[key]));
          if (!hasSelectedFieldChanges) return combatant;
          selectedChanged = true;
          const merged = { ...combatant, ...patch };
          if (
            Object.prototype.hasOwnProperty.call(patch, 'weaponActions')
            || Object.prototype.hasOwnProperty.call(patch, 'equipmentItems')
            || Object.prototype.hasOwnProperty.call(patch, 'equippedItems')
          ) {
            const equipableItems = buildEquipableItems(merged.weaponActions, merged.equipmentItems);
            merged.equippedItems = normalizeEquippedItems(merged.equippedItems, equipableItems);
          }
          return merged;
        }
        if (mirroredPatch && combatant.id === mirrorTargetId) {
          const hasMirrorFieldChanges = mirroredPatchKeys.some((key) => !Object.is(combatant[key], mirroredPatch[key]));
          if (!hasMirrorFieldChanges) return combatant;
          mirroredChanged = true;
          return { ...combatant, ...mirroredPatch };
        }
        return combatant;
      });

      if (!selectedChanged && !mirroredChanged) return prev;

      const next = {
        ...prev,
        combatants: nextCombatants,
      };
      const updatedSelected = nextCombatants.find((combatant) => combatant.id === selectedCombatant.id);
      if (updatedSelected) {
        const nextProfileKey = sheetProfileKey(updatedSelected.sourceCharacterId, updatedSelected.name);
        if (nextProfileKey && (updatedSelected.sourceSheet || prev.sheetProfiles?.[nextProfileKey] || prev.sheetProfiles?.[previousProfileKey])) {
          const nextProfiles = { ...(prev.sheetProfiles || {}) };
          if (previousProfileKey && previousProfileKey !== nextProfileKey) delete nextProfiles[previousProfileKey];
          const patchTouchesProfile = patchKeys.some((key) => PROFILE_SYNC_FIELDS.has(key));
          const patchNeedsFullProfileSync = patchKeys.some(
            (key) => PROFILE_SYNC_FIELDS.has(key) && !PROFILE_SIMPLE_SYNC_FIELDS.has(key)
          );
          const existingProfile = nextProfiles[nextProfileKey] || nextProfiles[previousProfileKey];

          if (!patchTouchesProfile && existingProfile) {
            nextProfiles[nextProfileKey] = existingProfile;
          } else if (!patchNeedsFullProfileSync && existingProfile) {
            nextProfiles[nextProfileKey] = {
              ...existingProfile,
              race: cleanText(updatedSelected.race),
              className: cleanText(updatedSelected.className || updatedSelected.role),
              role: cleanText(updatedSelected.className || updatedSelected.role),
              level: updatedSelected.level === '' || updatedSelected.level == null ? '' : toInt(updatedSelected.level, ''),
              hp: updatedSelected.hp === '' || updatedSelected.hp == null ? '' : toInt(updatedSelected.hp, 0),
              maxHP: updatedSelected.maxHP === '' || updatedSelected.maxHP == null ? '' : toInt(updatedSelected.maxHP, 0),
              ac: updatedSelected.ac === '' || updatedSelected.ac == null ? '' : toInt(updatedSelected.ac, 0),
              speed: updatedSelected.speed === '' || updatedSelected.speed == null ? '' : toInt(updatedSelected.speed, 0),
              initiativeBonus:
                updatedSelected.initiativeBonus == null || updatedSelected.initiativeBonus === ''
                  ? 0
                  : toInt(updatedSelected.initiativeBonus, 0),
              proficiencyBonus:
                updatedSelected.proficiencyBonus == null || updatedSelected.proficiencyBonus === ''
                  ? null
                  : toInt(updatedSelected.proficiencyBonus, null),
              spellSaveDC:
                updatedSelected.spellSaveDC == null || updatedSelected.spellSaveDC === ''
                  ? null
                  : toInt(updatedSelected.spellSaveDC, null),
              attackModifier:
                updatedSelected.attackModifier == null || updatedSelected.attackModifier === ''
                  ? null
                  : toInt(updatedSelected.attackModifier, null),
              spellAttackModifier:
                updatedSelected.spellAttackModifier == null || updatedSelected.spellAttackModifier === ''
                  ? null
                  : toInt(updatedSelected.spellAttackModifier, null),
              hideSensitiveStats: !!updatedSelected.hideSensitiveStats,
              sourceSheet: !!updatedSelected.sourceSheet,
              sourceSheetFileName: cleanText(updatedSelected.sourceSheetFileName),
              sourceSheetFormat: cleanText(updatedSelected.sourceSheetFormat),
              sheetImportedAt: toInt(updatedSelected.sheetImportedAt, 0),
            };
          } else {
            nextProfiles[nextProfileKey] = buildSheetProfileFromCombatant(updatedSelected);
          }
          next.sheetProfiles = nextProfiles;
        }
      }

      if (Object.prototype.hasOwnProperty.call(patch, 'init') || Object.prototype.hasOwnProperty.call(patch, 'side') || Object.prototype.hasOwnProperty.call(patch, 'name')) {
        nextCombatants = sortCombatants(nextCombatants);
        next.combatants = nextCombatants;
        if (nextCombatants.length === 0) next.activeIndex = 0;
        else if (activeId) {
          const idx = nextCombatants.findIndex((combatant) => combatant.id === activeId);
          next.activeIndex = idx >= 0 ? idx : clamp(prev.activeIndex, 0, nextCombatants.length - 1);
        } else {
          next.activeIndex = clamp(prev.activeIndex, 0, nextCombatants.length - 1);
        }
      }
      return next;
    });
  };

  const updateBattlefield = useCallback((patchOrBuilder) => {
    if (!canConfigureBattlefield) return;
    setEncounter((prev) => {
      const next = normalize(prev);
      const current = normalizeBattlefield(next.battlefield);
      const patch = typeof patchOrBuilder === 'function' ? patchOrBuilder(current) : patchOrBuilder;
      if (!patch || typeof patch !== 'object') return prev;
      const merged = normalizeBattlefield({ ...current, ...patch });
      const changed = !battlefieldStateEqual(current, merged);
      if (!changed) return prev;
      next.battlefield = merged;
      return next;
    });
  }, [canConfigureBattlefield]);

  const commitBattlefieldDrawing = useCallback((drawing) => {
    if (!canWriteCombat) return;
    setEncounter((prev) => {
      const next = normalize(prev);
      const currentBattlefield = normalizeBattlefield(next.battlefield);
      const currentDrawings = normalizeBattlefieldDrawings(currentBattlefield.drawings);
      const normalizedDrawing = normalizeBattlefieldDrawing(drawing, currentDrawings.length);
      if (normalizedDrawing.points.length < 2) return prev;
      next.battlefield = {
        ...currentBattlefield,
        drawings: [...currentDrawings, normalizedDrawing],
      };
      return next;
    });
  }, [canWriteCombat]);

  const removeBattlefieldDrawing = useCallback((drawingId) => {
    const id = cleanText(drawingId);
    if (!canWriteCombat || !id) return;
    setEncounter((prev) => {
      const next = normalize(prev);
      const currentBattlefield = normalizeBattlefield(next.battlefield);
      const currentDrawings = normalizeBattlefieldDrawings(currentBattlefield.drawings);
      const nextDrawings = currentDrawings.filter((drawing) => drawing.id !== id);
      if (nextDrawings.length === currentDrawings.length) return prev;
      next.battlefield = {
        ...currentBattlefield,
        drawings: nextDrawings,
      };
      return next;
    });
  }, [canWriteCombat]);

  const undoBattlefieldDrawing = useCallback(() => {
    if (!canWriteCombat) return;
    setEncounter((prev) => {
      const next = normalize(prev);
      const currentBattlefield = normalizeBattlefield(next.battlefield);
      const currentDrawings = normalizeBattlefieldDrawings(currentBattlefield.drawings);
      if (currentDrawings.length === 0) return prev;
      next.battlefield = {
        ...currentBattlefield,
        drawings: currentDrawings.slice(0, -1),
      };
      return next;
    });
  }, [canWriteCombat]);

  const clearBattlefieldDrawings = useCallback(() => {
    if (!canWriteCombat) return;
    setEncounter((prev) => {
      const next = normalize(prev);
      const currentBattlefield = normalizeBattlefield(next.battlefield);
      const currentDrawings = normalizeBattlefieldDrawings(currentBattlefield.drawings);
      if (currentDrawings.length === 0) return prev;
      next.battlefield = {
        ...currentBattlefield,
        drawings: [],
      };
      return next;
    });
  }, [canWriteCombat]);

  const moveCombatantToCell = useCallback((combatantId, nextCol, nextRow) => {
    if (!canWriteCombat) return;
    const safeCol = clamp(normalizeGridCoordinate(nextCol, 0), 0, 400);
    const safeRow = clamp(normalizeGridCoordinate(nextRow, 0), 0, 400);
    setEncounter((prev) => {
      const next = normalize(prev);
      let changed = false;
      next.combatants = next.combatants.map((combatant) => {
        if (combatant.id !== combatantId) return combatant;
        if (!canBoardMoveCombatant(combatant)) return combatant;
        if (combatant.gridCol === safeCol && combatant.gridRow === safeRow) return combatant;
        changed = true;
        return { ...combatant, gridCol: safeCol, gridRow: safeRow };
      });
      return changed ? next : prev;
    });
    setSelectedId(combatantId);
  }, [canBoardMoveCombatant, canWriteCombat]);

  const toggleCombatantDeadViaBoard = useCallback((combatantId) => {
    if (!canWriteCombat) return;
    setEncounter((prev) => {
      const next = normalize(prev);
      let changed = false;
      next.combatants = next.combatants.map((combatant) => {
        if (combatant.id !== combatantId) return combatant;
        if (!canBoardQuickEditCombatant(combatant)) return combatant;
        changed = true;
        return { ...combatant, dead: !combatant.dead };
      });
      return changed ? next : prev;
    });
  }, [canBoardQuickEditCombatant, canWriteCombat]);

  const toggleCombatantStatusViaBoard = useCallback((combatantId, statusLabel) => {
    if (!canWriteCombat) return;
    const label = cleanText(statusLabel);
    if (!label) return;
    const labelKey = tokenKey(label);
    setEncounter((prev) => {
      const next = normalize(prev);
      let changed = false;
      next.combatants = next.combatants.map((combatant) => {
        if (combatant.id !== combatantId) return combatant;
        if (!canBoardQuickEditCombatant(combatant)) return combatant;
        const current = Array.isArray(combatant.status) ? combatant.status : [];
        const hasLabel = current.some((entry) => tokenKey(entry) === labelKey);
        const nextStatus = hasLabel
          ? current.filter((entry) => tokenKey(entry) !== labelKey)
          : [...current, label];
        if (nextStatus.length === current.length && hasLabel === false) return combatant;
        changed = true;
        return { ...combatant, status: nextStatus };
      });
      return changed ? next : prev;
    });
  }, [canBoardQuickEditCombatant, canWriteCombat]);

  const clearCombatantStatusesViaBoard = useCallback((combatantId) => {
    if (!canWriteCombat) return;
    setEncounter((prev) => {
      const next = normalize(prev);
      let changed = false;
      next.combatants = next.combatants.map((combatant) => {
        if (combatant.id !== combatantId) return combatant;
        if (!canBoardQuickEditCombatant(combatant)) return combatant;
        if (!Array.isArray(combatant.status) || combatant.status.length === 0) return combatant;
        changed = true;
        return { ...combatant, status: [] };
      });
      return changed ? next : prev;
    });
  }, [canBoardQuickEditCombatant, canWriteCombat]);

  const removeCombatantViaBoard = useCallback((combatantId) => {
    if (!canWriteCombat) return;
    setEncounter((prev) => {
      const next = normalize(prev);
      const target = next.combatants.find((combatant) => combatant.id === combatantId);
      if (!target || !canBoardQuickEditCombatant(target)) return prev;
      const idx = next.combatants.findIndex((combatant) => combatant.id === combatantId);
      next.combatants = next.combatants.filter((combatant) => combatant.id !== combatantId);
      if (next.combatants.length === 0) next.activeIndex = 0;
      else if (idx >= 0) next.activeIndex = clamp(next.activeIndex, 0, next.combatants.length - 1);
      return next;
    });
    if (selectedId === combatantId) {
      setSelectedId(null);
      setEditorOpen(false);
      setRestrictedModalOpen(false);
    }
  }, [canBoardQuickEditCombatant, canWriteCombat, selectedId]);

  useEffect(() => {
    if (!selected || !selectedCanEdit || !selectedInventoryOwnerUserId) return;
    if ((selected.side || 'Enemy') === 'Enemy') return;
    if (suppressBagToCombatSyncRef.current) return;

    const currentEquipmentLines = normalizeStringList(selected.equipmentItems);
    const currentEquippedLines = normalizeStringList(selected.equippedItems);
    const weaponEquippedKeySet = new Set(
      normalizeWeaponActions(selected.weaponActions, selected.equipmentItems)
        .map((entry) => tokenKey(entry.attack))
        .filter(Boolean)
    );
    const preservedWeaponEquippedLines = currentEquippedLines.filter((line) => (
      weaponEquippedKeySet.has(tokenKey(line))
    ));
    const nextEquippedLines = normalizeStringList([
      ...preservedWeaponEquippedLines,
      ...selectedPersonalInventoryEquippedLines,
    ]);
    const hasPersonalInventoryItems = selectedPersonalInventoryEquipmentLines.length > 0;
    const hasCombatEquipmentItems = currentEquipmentLines.length > 0;
    if (!hasPersonalInventoryItems && hasCombatEquipmentItems) {
      // Non-destructive bootstrap: keep existing combat equipment and let the reverse
      // sync effect seed personal inventory when it's currently empty.
      return;
    }
    if (
      lineListsMatchByToken(currentEquipmentLines, selectedPersonalInventoryEquipmentLines)
      && lineListsMatchByToken(currentEquippedLines, nextEquippedLines)
    ) {
      return;
    }

    suppressCombatToBagSyncRef.current = true;
    setSelectedField({
      equipmentItems: selectedPersonalInventoryEquipmentLines,
      equippedItems: nextEquippedLines,
    });
    const releaseSyncTimer = setTimeout(() => {
      suppressCombatToBagSyncRef.current = false;
    }, 0);
    return () => clearTimeout(releaseSyncTimer);
  }, [
    selected?.equipmentItems,
    selected?.equippedItems,
    selected?.id,
    selected?.side,
    selected?.weaponActions,
    selectedCanEdit,
    selectedInventoryOwnerUserId,
    selectedPersonalInventoryEquipmentLines,
    selectedPersonalInventoryEquippedLines,
  ]);

  useEffect(() => {
    if (!selected || !selectedCanEdit || !selectedInventoryOwnerUserId) return;
    if ((selected.side || 'Enemy') === 'Enemy') return;
    if (suppressCombatToBagSyncRef.current) return;

    const equipmentLines = normalizeStringList(selected.equipmentItems);
    const possessionLines = normalizeStringList(selected.otherPossessions);
    const equippedLines = normalizeStringList(selected.equippedItems);
    const currentItems = selectedPersonalInventoryEntry.items;
    const bootstrapFromOtherPossessions = currentItems.length === 0 && possessionLines.length > 0;
    const inventorySourceLines = bootstrapFromOtherPossessions
      ? normalizeStringList([...equipmentLines, ...possessionLines])
      : equipmentLines;
    const nextItems = syncInventoryItemsFromEquipment(
      inventorySourceLines,
      equippedLines,
      currentItems
    );

    if (
      lineListsMatchByToken(inventoryItemsToEquipmentLines(currentItems), inventoryItemsToEquipmentLines(nextItems))
      && lineListsMatchByToken(inventoryItemsToEquippedLines(currentItems), inventoryItemsToEquippedLines(nextItems))
    ) {
      return;
    }

    suppressBagToCombatSyncRef.current = true;
    setBagInventoryState((prevBag) => upsertPersonalInventoryEntry(
      prevBag,
      selectedInventoryOwnerUserId,
      selectedInventoryOwnerLabel,
      nextItems
    ));
    const releaseSyncTimer = setTimeout(() => {
      suppressBagToCombatSyncRef.current = false;
    }, 0);
    return () => clearTimeout(releaseSyncTimer);
  }, [
    selected?.equipmentItems,
    selected?.equippedItems,
    selected?.otherPossessions,
    selected?.id,
    selected?.side,
    selectedCanEdit,
    selectedInventoryOwnerLabel,
    selectedInventoryOwnerUserId,
    selectedPersonalInventoryEntry.items,
    setBagInventoryState,
  ]);

  const toggleSelectedSensitiveStats = () => {
    setSelectedField((combatant) => ({ hideSensitiveStats: !combatant.hideSensitiveStats }));
  };

  const toggleSelectedEquippedItem = (itemName) => {
    const normalizedName = cleanText(itemName);
    if (!normalizedName) return;
    setSelectedField((combatant) => {
      const equipableItems = buildEquipableItems(combatant.weaponActions, combatant.equipmentItems);
      if (!equipableItems.length) return { equippedItems: [] };
      const current = normalizeEquippedItems(combatant.equippedItems, equipableItems);
      const targetKey = tokenKey(normalizedName);
      if (!targetKey) return {};
      const hasItem = current.some((entry) => tokenKey(entry) === targetKey);
      if (hasItem) {
        return {
          equippedItems: current.filter((entry) => tokenKey(entry) !== targetKey),
        };
      }
      const canonical = equipableItems.find((entry) => tokenKey(entry) === targetKey) || normalizedName;
      return {
        equippedItems: normalizeEquippedItems([...current, canonical], equipableItems),
      };
    });
  };

  const adjustSelectedTempHp = (delta) => {
    setSelectedField((combatant) => {
      const current = Math.max(0, toInt(combatant.tempHP, 0));
      return { tempHP: Math.max(0, current + delta) };
    });
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
    const amount = Math.abs(toInt(hpAdjustAmount, 0));
    if (amount <= 0) return;

    setSelectedField((combatant) => {
      const hp = combatant.hp === '' ? 0 : toInt(combatant.hp, 0);
      const maxHP = combatant.maxHP === '' ? null : toInt(combatant.maxHP, 0);
      const tempHP = toInt(combatant.tempHP, 0);

      if (kind === 'damage') {
        let remaining = amount;
        const absorbedByTemp = Math.min(tempHP, remaining);
        remaining -= absorbedByTemp;
        const nextTempHP = tempHP - absorbedByTemp;
        const nextHP = Math.max(0, hp - remaining);
        return { hp: nextHP, tempHP: nextTempHP };
      }

      const healed = hp + amount;
      const nextHP = maxHP != null && maxHP > 0 ? Math.min(maxHP, healed) : healed;
      return { hp: nextHP };
    });
  };

  const setSpellSlotField = (level, patch) => {
    setSelectedField((combatant) => {
      const slots = normalizeSpellSlots(combatant.spellSlots);
      const nextSlots = slots.map((slot) => {
        if (slot.level !== level) return slot;
        const merged = typeof patch === 'function' ? patch(slot) : { ...slot, ...patch };
        const max = clamp(toInt(merged.max, 0), 0, 20);
        const current = clamp(toInt(merged.current, max), 0, max);
        return { level, max, current };
      });
      return { spellSlots: nextSlots };
    });
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
    setSelectedField((combatant) => {
      const charges = normalizeFeatureCharges(combatant.featureCharges);
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
      return { featureCharges: nextCharges };
    });
  };

  const addFeatureCharge = () => {
    setSelectedField((combatant) => {
      const charges = normalizeFeatureCharges(combatant.featureCharges);
      const id = createId('feature');
      const next = [...charges, { id, name: `Feature ${charges.length + 1}`, max: 0, current: 0 }];
      return { featureCharges: next };
    });
  };

  const removeFeatureCharge = (id) => {
    setSelectedField((combatant) => {
      const charges = normalizeFeatureCharges(combatant.featureCharges);
      return { featureCharges: charges.filter((charge) => charge.id !== id) };
    });
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
    setSelectedField((combatant) => {
      const charges = normalizeFeatureCharges(combatant.featureCharges);
      const next = charges.map((charge) => (charge.id === id ? { ...charge, name: String(rawName || '') } : charge));
      return { featureCharges: next };
    });
  };

  const closeSheetInventoryEditor = useCallback(() => {
    setSheetInventoryEditorOpen(false);
    setSheetInventoryEditingId('');
    setSheetInventoryDraft(createSheetInventoryDraft());
  }, []);

  const closeSheetInventoryModal = useCallback(() => {
    setSheetInventoryModalOpen(false);
    closeSheetInventoryEditor();
  }, [closeSheetInventoryEditor]);

  const openSelectedInventoryModal = useCallback(() => {
    if (!selectedCanEdit || !selectedInventoryOwnerUserId) return;
    setSheetInventoryEditorOpen(false);
    setSheetInventoryEditingId('');
    setSheetInventoryDraft(createSheetInventoryDraft());
    setSheetInventoryModalOpen(true);
  }, [selectedCanEdit, selectedInventoryOwnerUserId]);

  const setSelectedPersonalInventoryAttunementLimit = useCallback((nextValue) => {
    if (!selectedCanEdit || !selectedInventoryOwnerUserId) return;
    const now = new Date().toISOString();
    const nextLimit = normalizeAttunementLimit(nextValue);
    setBagInventoryState((prevBag) => {
      const normalizedBag = normalizeBagInventoryState(prevBag, { now });
      const existingEntry = getPersonalInventoryEntry(normalizedBag, selectedInventoryOwnerUserId);
      const currentItems = Array.isArray(existingEntry?.items) ? existingEntry.items : [];
      if (countAttunedItems(currentItems) > nextLimit) {
        window.alert(`Cannot set attunement slots below current attuned items (${countAttunedItems(currentItems)}).`);
        return prevBag;
      }
      return upsertPersonalInventoryEntry(
        normalizedBag,
        selectedInventoryOwnerUserId,
        cleanText(selectedInventoryOwnerLabel || existingEntry?.username || selected?.name || 'Player'),
        currentItems,
        { now, attunementLimit: nextLimit }
      );
    });
  }, [selected?.name, selectedCanEdit, selectedInventoryOwnerLabel, selectedInventoryOwnerUserId, setBagInventoryState]);

  const updateSelectedPersonalInventoryItems = useCallback((updater) => {
    if (!selectedInventoryOwnerUserId) return;
    const now = new Date().toISOString();
    setBagInventoryState((prevBag) => {
      const normalizedBag = normalizeBagInventoryState(prevBag, { now });
      const existingEntry = getPersonalInventoryEntry(normalizedBag, selectedInventoryOwnerUserId);
      const currentItems = Array.isArray(existingEntry?.items) ? existingEntry.items : [];
      const nextItems = typeof updater === 'function' ? updater(currentItems, now) : currentItems;
      if (!Array.isArray(nextItems)) return prevBag;
      return upsertPersonalInventoryEntry(
        normalizedBag,
        selectedInventoryOwnerUserId,
        cleanText(selectedInventoryOwnerLabel || existingEntry?.username || selected?.name || 'Player'),
        nextItems,
        { now }
      );
    });
  }, [selected?.name, selectedInventoryOwnerLabel, selectedInventoryOwnerUserId, setBagInventoryState]);

  const openSheetInventoryAdd = useCallback(() => {
    if (!selectedCanEdit || !selectedInventoryOwnerUserId) return;
    setSheetInventoryEditingId('');
    setSheetInventoryDraft(createSheetInventoryDraft());
    setSheetInventoryEditorOpen(true);
    setSheetInventoryModalOpen(true);
  }, [selectedCanEdit, selectedInventoryOwnerUserId]);

  const openSheetInventoryEdit = useCallback((item) => {
    if (!selectedCanEdit || !selectedInventoryOwnerUserId || !item) return;
    setSheetInventoryEditingId(cleanText(item.id));
    setSheetInventoryDraft(createSheetInventoryDraft(item));
    setSheetInventoryEditorOpen(true);
    setSheetInventoryModalOpen(true);
  }, [selectedCanEdit, selectedInventoryOwnerUserId]);

  const saveSheetInventoryDraft = useCallback(() => {
    if (!selectedCanEdit || !selectedInventoryOwnerUserId) return;
    const name = cleanText(sheetInventoryDraft.name);
    if (!name) return;
    const qty = clamp(toInt(sheetInventoryDraft.qty, 1), 1, 9999);
    const value = normalizeOptionalNumber(sheetInventoryDraft.value);
    const weight = normalizeOptionalNumber(sheetInventoryDraft.weight);
    const tags = normalizeStringList(sheetInventoryDraft.tags);
    const category = normalizeInventoryCategory(sheetInventoryDraft.category);
    const weaponFields = category === 'Weapon'
      ? {
          weaponProficiency: cleanText(sheetInventoryDraft.weaponProficiency),
          weaponHitDc: cleanText(sheetInventoryDraft.weaponHitDc),
          weaponAttackType: cleanText(sheetInventoryDraft.weaponAttackType),
          weaponReach: cleanText(sheetInventoryDraft.weaponReach),
          weaponDamage: cleanText(sheetInventoryDraft.weaponDamage),
          weaponDamageType: cleanText(sheetInventoryDraft.weaponDamageType),
          weaponProperties: cleanText(sheetInventoryDraft.weaponProperties),
        }
      : {
          weaponProficiency: '',
          weaponHitDc: '',
          weaponAttackType: '',
          weaponReach: '',
          weaponDamage: '',
          weaponDamageType: '',
          weaponProperties: '',
        };
    const sourceItems = Array.isArray(selectedPersonalInventoryEntry?.items)
      ? selectedPersonalInventoryEntry.items
      : [];
    const currentAttunedCount = countAttunedItems(sourceItems);
    const draftAttuned = !!sheetInventoryDraft.attuned;
    if (!sheetInventoryEditingId) {
      if (draftAttuned && currentAttunedCount >= selectedAttunementLimit) {
        window.alert(`Attunement limit reached (${selectedAttunementLimit}). Increase slots or unattune another item.`);
        return;
      }
    } else {
      const targetItem = sourceItems.find((entry) => cleanText(entry.id) === sheetInventoryEditingId);
      const targetWasAttuned = !!targetItem?.attuned;
      const projectedAttunedCount = currentAttunedCount
        + (draftAttuned && !targetWasAttuned ? 1 : 0)
        - (!draftAttuned && targetWasAttuned ? 1 : 0);
      if (projectedAttunedCount > selectedAttunementLimit) {
        window.alert(`Attunement limit reached (${selectedAttunementLimit}). Increase slots or unattune another item.`);
        return;
      }
    }

    updateSelectedPersonalInventoryItems((currentItems, now) => {
      const items = Array.isArray(currentItems) ? currentItems : [];
      const buildItem = (existing = null) => ({
        ...(existing || {}),
        id: cleanText(existing?.id) || createId('bag'),
        name,
        qty,
        category,
        rarity: normalizeInventoryRarity(sheetInventoryDraft.rarity || existing?.rarity),
        value: Number.isFinite(value) ? value : (existing ? normalizeOptionalNumber(existing.value) : null),
        weight: Number.isFinite(weight) ? weight : (existing ? normalizeOptionalNumber(existing.weight) : null),
        notes: cleanText(sheetInventoryDraft.notes),
        tags,
        assignedTo: '',
        ...weaponFields,
        equipped: !!sheetInventoryDraft.equipped,
        attuned: !!sheetInventoryDraft.attuned,
        hidden: !!sheetInventoryDraft.hidden,
        createdAt: cleanText(existing?.createdAt) || now,
        updatedAt: now,
      });
      const nextItems = !sheetInventoryEditingId
        ? [buildItem(null), ...items]
        : items.map((entry) => (
        cleanText(entry.id) === sheetInventoryEditingId
          ? buildItem(entry)
          : entry
        ));
      return nextItems;
    });
    closeSheetInventoryEditor();
  }, [
    closeSheetInventoryEditor,
    selectedAttunementLimit,
    selectedCanEdit,
    selectedPersonalInventoryEntry?.items,
    selectedInventoryOwnerUserId,
    sheetInventoryDraft,
    sheetInventoryEditingId,
    updateSelectedPersonalInventoryItems,
  ]);

  const bumpSheetInventoryQty = useCallback((id, delta) => {
    if (!selectedCanEdit || !selectedInventoryOwnerUserId) return;
    const targetId = cleanText(id);
    if (!targetId) return;
    updateSelectedPersonalInventoryItems((currentItems, now) => (
      currentItems.map((entry) => (
        cleanText(entry.id) === targetId
          ? { ...entry, qty: clamp((toInt(entry.qty, 1) + delta), 1, 9999), updatedAt: now }
          : entry
      ))
    ));
  }, [selectedCanEdit, selectedInventoryOwnerUserId, updateSelectedPersonalInventoryItems]);

  const toggleSheetInventoryEquipped = useCallback((id) => {
    if (!selectedCanEdit || !selectedInventoryOwnerUserId) return;
    const targetId = cleanText(id);
    if (!targetId) return;
    updateSelectedPersonalInventoryItems((currentItems, now) => (
      currentItems.map((entry) => (
        cleanText(entry.id) === targetId
          ? { ...entry, equipped: !entry.equipped, updatedAt: now }
          : entry
      ))
    ));
  }, [selectedCanEdit, selectedInventoryOwnerUserId, updateSelectedPersonalInventoryItems]);

  const toggleSheetInventoryAttuned = useCallback((id) => {
    if (!selectedCanEdit || !selectedInventoryOwnerUserId) return;
    const targetId = cleanText(id);
    if (!targetId) return;
    updateSelectedPersonalInventoryItems((currentItems, now) => {
      const items = Array.isArray(currentItems) ? currentItems : [];
      const target = items.find((entry) => cleanText(entry.id) === targetId);
      if (!target) return items;
      if (!target.attuned && countAttunedItems(items) >= selectedAttunementLimit) {
        window.alert(`Attunement limit reached (${selectedAttunementLimit}). Increase slots or unattune another item.`);
        return items;
      }
      return items.map((entry) => (
        cleanText(entry.id) === targetId
          ? { ...entry, attuned: !entry.attuned, updatedAt: now }
          : entry
      ));
    });
  }, [selectedAttunementLimit, selectedCanEdit, selectedInventoryOwnerUserId, updateSelectedPersonalInventoryItems]);

  const toggleSheetInventoryHidden = useCallback((id) => {
    if (!selectedCanEdit || !selectedInventoryOwnerUserId) return;
    const targetId = cleanText(id);
    if (!targetId) return;
    updateSelectedPersonalInventoryItems((currentItems, now) => (
      currentItems.map((entry) => (
        cleanText(entry.id) === targetId
          ? { ...entry, hidden: !entry.hidden, updatedAt: now }
          : entry
      ))
    ));
  }, [selectedCanEdit, selectedInventoryOwnerUserId, updateSelectedPersonalInventoryItems]);

  const deleteSheetInventoryItem = useCallback((id) => {
    if (!selectedCanEdit || !selectedInventoryOwnerUserId) return;
    const targetId = cleanText(id);
    if (!targetId) return;
    updateSelectedPersonalInventoryItems((currentItems) => (
      currentItems.filter((entry) => cleanText(entry.id) !== targetId)
    ));
    if (sheetInventoryEditingId && sheetInventoryEditingId === targetId) {
      closeSheetInventoryEditor();
    }
  }, [closeSheetInventoryEditor, selectedCanEdit, selectedInventoryOwnerUserId, sheetInventoryEditingId, updateSelectedPersonalInventoryItems]);

  const longRestSelected = () => {
    setStatusDraft('');
    setSelectedField((combatant) => {
      const maxHP = combatant.maxHP === '' ? '' : toInt(combatant.maxHP, 0);
      const nextHP = maxHP === '' ? combatant.hp : maxHP;
      const nextSpellSlots = normalizeSpellSlots(combatant.spellSlots).map((slot) => ({
        ...slot,
        current: slot.max,
      }));
      const nextFeatureCharges = normalizeFeatureCharges(combatant.featureCharges).map((feature) => ({
        ...feature,
        current: feature.max,
      }));

      return {
        hp: nextHP,
        tempHP: 0,
        status: [],
        concentration: '',
        spellSlots: nextSpellSlots,
        featureCharges: nextFeatureCharges,
      };
    });
  };

  const updateSheetActionDetailField = useCallback((field, value) => {
    setSheetActionDetail((prev) => {
      if (!prev || typeof prev !== 'object') return prev;
      const payload = prev.payload && typeof prev.payload === 'object' ? prev.payload : {};
      return {
        ...prev,
        payload: {
          ...payload,
          [field]: value,
        },
      };
    });
  }, []);

  const saveSheetActionDetail = useCallback(() => {
    if (!sheetActionDetail || !selectedCanEdit) return;
    const payload = sheetActionDetail.payload && typeof sheetActionDetail.payload === 'object'
      ? sheetActionDetail.payload
      : {};

    if (sheetActionDetail.type === 'weapon') {
      const attack = cleanText(payload.attack);
      if (!attack) return;
      setSelectedField((combatant) => {
        const currentActions = normalizeWeaponActions(combatant.weaponActions, combatant.equipmentItems);
        const targetId = cleanText(payload.id);
        const nextWeapon = {
          id: targetId || createId('weapon'),
          attack,
          range: cleanText(payload.range),
          hitDc: cleanText(payload.hitDc),
          damage: cleanText(payload.damage),
          notes: cleanText(payload.notes),
        };
        let didUpdate = false;
        const nextActions = currentActions.map((weapon) => {
          if (didUpdate) return weapon;
          const matchesById = !!targetId && cleanText(weapon.id) === targetId;
          const matchesByName = !targetId && cleanText(weapon.attack) === attack;
          if (!matchesById && !matchesByName) return weapon;
          didUpdate = true;
          return {
            ...weapon,
            ...nextWeapon,
          };
        });
        if (!didUpdate) nextActions.push(nextWeapon);
        return { weaponActions: nextActions };
      });
      setSheetActionDetail(null);
      return;
    }

    if (sheetActionDetail.type === 'spell') {
      const targetId = cleanText(payload.id);
      const nextName = cleanText(payload.name);
      if (!nextName) return;
      setSelectedField((combatant) => {
        const currentEntries = normalizeSpellbookEntries(combatant.spellbookEntries, combatant.spellList);
        let didUpdate = false;
        const nextEntries = currentEntries.map((entry) => {
          if (didUpdate) return entry;
          const matchesById = !!targetId && cleanText(entry.id) === targetId;
          const matchesByName = !targetId && cleanText(entry.name) === nextName;
          if (!matchesById && !matchesByName) return entry;
          didUpdate = true;

          const draftDamage = cleanText(payload.damage);
          return {
            ...entry,
            name: nextName,
            range: cleanText(payload.range),
            saveAtk: cleanText(payload.saveAtk),
            damage: draftDamage,
            time: cleanText(payload.time),
            duration: cleanText(payload.duration),
            effect: draftDamage,
            notes: cleanText(payload.notes),
          };
        });
        if (!didUpdate) return {};
        return {
          spellbookEntries: nextEntries,
          spellList: normalizeStringList(nextEntries.map((entry) => entry.name)),
        };
      });
      setSheetActionDetail(null);
    }
  }, [selectedCanEdit, setSelectedField, sheetActionDetail]);

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
    const previousStoragePath = cleanText(battlefield.mediaStoragePath);
    setEncounter((prev) => {
      const next = defaultEncounter();
      const prior = normalize(prev);
      next.sheetProfiles = prior.sheetProfiles || {};
      return next;
    });
    setSelectedId(null);
    setEditorOpen(false);
    setRestrictedModalOpen(false);
    if (previousStoragePath) {
      deleteBattlefieldMedia(previousStoragePath);
    }
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

  const openSheetFor = (id) => {
    openEditorFor(id, 'sheet');
  };

  const setSelectedTokenScalePercent = (nextPercent) => {
    if (!selected || !selectedCanEdit) return;
    const normalizedPercent = clamp(toInt(nextPercent, selectedTokenScalePercent), Math.round(TOKEN_SCALE_MIN * 100), Math.round(TOKEN_SCALE_MAX * 100));
    setSelectedField({ tokenScale: normalizedPercent / 100 });
  };

  const setSelectedTokenRotationDegrees = (nextDegrees) => {
    if (!selected || !selectedCanEdit) return;
    setSelectedField({ tokenRotation: normalizeTokenRotation(nextDegrees, selectedTokenRotationDegrees) });
  };

  const setCombatantTokenRotation = useCallback((combatantId, nextRotation) => {
    const normalizedRotation = normalizeTokenRotation(nextRotation, 0);
    setEncounter((prev) => {
      const next = normalize(prev);
      let changed = false;
      next.combatants = next.combatants.map((combatant) => {
        if (combatant.id !== combatantId) return combatant;
        if (!canBoardMoveCombatant(combatant)) return combatant;
        if (normalizeTokenRotation(combatant.tokenRotation, 0) === normalizedRotation) return combatant;
        changed = true;
        return { ...combatant, tokenRotation: normalizedRotation };
      });
      return changed ? next : prev;
    });
    setSelectedId(combatantId);
  }, [canBoardMoveCombatant]);

  useEffect(() => {
    const requestToken = Math.max(0, toInt(sheetPopoutRequestToken, 0));
    if (requestToken <= 0) return;
    if (requestToken === handledSheetPopoutRequestTokenRef.current) return;
    handledSheetPopoutRequestTokenRef.current = requestToken;
    pendingRequestedSheetPopoutTargetRef.current = '';

    const assignedPlayerCombatants = combatants.filter((entry) => (
      entry
      && (entry.side || 'Enemy') !== 'Enemy'
      && assignmentMatchesViewer(
        getCharacterAccessEntry(characterControllers, resolveCharacterForCombatant(entry) || entry)
      )
    ));

    if (assignedPlayerCombatants.length === 0) {
      window.alert('No character sheet assigned to your account is available in Combat Tracker.');
      return;
    }

    const controllableAssignedCombatants = assignedPlayerCombatants.filter((entry) => canControlCombatant(entry));
    if (controllableAssignedCombatants.length === 0) {
      window.alert('Your assigned character sheet is currently read-only.');
      return;
    }

    const selectedIfAssigned = (
      selected
      && controllableAssignedCombatants.some((entry) => entry.id === selected.id)
    )
      ? selected
      : null;

    const target = selectedIfAssigned || controllableAssignedCombatants[0];

    const targetId = cleanText(target?.id);
    if (!targetId) {
      window.alert('Unable to locate your assigned character sheet.');
      return;
    }

    pendingRequestedSheetPopoutTargetRef.current = targetId;
    openEditorFor(targetId, 'sheet');
  }, [
    assignmentMatchesViewer,
    canControlCombatant,
    characterControllers,
    combatants,
    openEditorFor,
    resolveCharacterForCombatant,
    selected,
    sheetPopoutRequestToken,
  ]);

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
    damage: '',
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
      if (Object.prototype.hasOwnProperty.call(patch, 'damage')) {
        next.damage = String(patch.damage ?? '');
        next.effect = String(patch.damage ?? '');
      }
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

  const deleteBattlefieldMedia = useCallback(async (storagePath) => {
    const targetPath = cleanText(storagePath);
    if (!targetPath) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error } = await supabase.storage.from(COMBAT_MEDIA_BUCKET).remove([targetPath]);
    if (error) {
      console.warn('[CombatPanel] Unable to delete previous battle map.', error);
    }
  }, []);

  const handleBattlefieldMediaUpload = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !canConfigureBattlefield) return;
    if (!BOARD_ALLOWED_IMAGE_TYPES.has(file.type)) {
      window.alert('Battle maps must be PNG, JPG, or WEBP files.');
      return;
    }
    if (file.size > BOARD_UPLOAD_MAX_BYTES) {
      window.alert('Battle maps must be 15 MB or smaller.');
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      window.alert('Supabase storage is not available in this environment.');
      return;
    }

    const campaignId = getCampaignId();
    const nextStoragePath = buildCombatMediaPath(campaignId, encounter.id, file.name);
    const previousStoragePath = cleanText(battlefield.mediaStoragePath);
    setBattlefieldUploadBusy(true);
    try {
      const dimensions = await readImageDimensionsFromFile(file);
      const { error } = await supabase.storage.from(COMBAT_MEDIA_BUCKET).upload(nextStoragePath, file, {
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;

      updateBattlefield({
        mediaStoragePath: nextStoragePath,
        mediaMimeType: file.type,
        mediaWidth: dimensions.width,
        mediaHeight: dimensions.height,
        mediaUpdatedAt: Date.now(),
      });

      if (previousStoragePath && previousStoragePath !== nextStoragePath) {
        deleteBattlefieldMedia(previousStoragePath);
      }
    } catch (error) {
      console.error('[CombatPanel] Battle map upload failed.', error);
      window.alert(error?.message || 'Battle map upload failed.');
    } finally {
      setBattlefieldUploadBusy(false);
    }
  }, [
    battlefield.mediaStoragePath,
    canConfigureBattlefield,
    deleteBattlefieldMedia,
    encounter.id,
    updateBattlefield,
  ]);

  const clearBattlefieldMedia = useCallback(() => {
    if (!canConfigureBattlefield) return;
    const previousStoragePath = cleanText(battlefield.mediaStoragePath);
    updateBattlefield({
      mediaStoragePath: '',
      mediaMimeType: '',
      mediaWidth: 0,
      mediaHeight: 0,
      mediaUpdatedAt: Date.now(),
    });
    if (previousStoragePath) {
      deleteBattlefieldMedia(previousStoragePath);
    }
  }, [battlefield.mediaStoragePath, canConfigureBattlefield, deleteBattlefieldMedia, updateBattlefield]);

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
    const out = TOKEN_CROP_OUTPUT_SIZE;
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
  const PAD    = 0;

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
    && popoutWindow
    && !popoutWindow.closed
    && sheetPopoutRootRef.current
  );
  const sheetPortalHost = isSheetPopoutActive ? sheetPopoutRootRef.current : null;
  const shouldRenderEditorInline = !!(editorOpen && selected && !isSheetPopoutActive);
  const rightRailButtons = (
    <>
      <button
        type="button"
        className={`${styles.boardToolButton} ${initiativeDockOpen ? styles.boardToolButtonActive : ''}`}
        onMouseEnter={playHover}
        onClick={() => {
          playNav();
          setInitiativeDockOpen((open) => !open);
        }}
        title={combatants.length > 0 ? `Initiative order, round ${encounter.round}` : 'Initiative order'}
        aria-label={combatants.length > 0 ? `Toggle initiative order, round ${encounter.round}` : 'Toggle initiative order'}
        aria-expanded={initiativeDockOpen}
        aria-controls="initiative-rail"
      >
        ☰
      </button>
      <button
        type="button"
        className={`${styles.boardToolButton} ${diceDockOpen || diceRolling ? styles.boardToolButtonActive : ''}`}
        onMouseEnter={playHover}
        onClick={() => {
          playNav();
          setDiceDockOpen((open) => !open);
        }}
        title={diceRolling ? 'Dice rolling on the battlefield' : 'Open 3D dice'}
        aria-label={diceRolling ? 'Dice rolling on the battlefield' : 'Toggle 3D dice'}
        aria-expanded={diceDockOpen}
        aria-controls="combat-dice-dock"
      >
        ⚅
      </button>
    </>
  );
  const rightRailPanel = diceDockOpen ? (
    <div id="combat-dice-dock" className={styles.diceDockPanel}>
      <div className={styles.diceDockHeader}>
        <div className={styles.diceDockHeading}>3D Dice</div>
        <div className={styles.diceDockStatus}>
          {diceRolling ? 'Rolling on the battlefield' : 'Shared to everyone in combat'}
        </div>
      </div>
      <form
        className={styles.diceDockForm}
        onSubmit={(event) => {
          event.preventDefault();
          playNav();
          handleDiceRollRequest(diceNotationDraft);
        }}
      >
        <div className={styles.diceInputRow}>
          <input
            type="text"
            inputMode="text"
            className={styles.diceNotationInput}
            value={diceNotationDraft}
            onChange={(event) => {
              setDiceNotationDraft(event.target.value);
              if (diceError) setDiceError('');
            }}
            placeholder="d20 or 2d6+3"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            className={btnClass('gold', 'sm', styles.diceRollAction)}
            onMouseEnter={playHover}
          >
            Roll
          </button>
        </div>
        {diceError ? (
          <div className={styles.diceError}>{diceError}</div>
        ) : (
          <div className={styles.diceHint}>Simple rolls only: d20, 2d6, 2d6+3, 4d8-1.</div>
        )}
        <div className={styles.diceQuickGrid}>
          {DICE_QUICK_NOTATIONS.map((notation) => (
            <button
              key={notation}
              type="button"
              className={styles.diceQuickButton}
              onMouseEnter={playHover}
              onClick={() => {
                playNav();
                setDiceNotationDraft(notation);
                handleDiceRollRequest(notation);
              }}
            >
              {notation}
            </button>
          ))}
        </div>
      </form>
      <div className={styles.diceHistoryLabel}>Recent Rolls</div>
      <div className={`${styles.diceHistoryList} koa-scrollbar-thin`}>
        {diceLogEntries.length === 0 ? (
          <div className={styles.diceHistoryEmpty}>Roll a die to start the shared log.</div>
        ) : (
          diceLogEntries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`${styles.diceHistoryEntry} ${entry.id === diceActiveEntryId ? styles.diceHistoryEntryActive : ''}`}
              onMouseEnter={playHover}
              onClick={() => {
                setDiceNotationDraft(entry.notation);
                if (diceError) setDiceError('');
              }}
            >
              <div className={styles.diceHistoryTop}>
                <span className={styles.diceHistoryNotation}>{entry.notation}</span>
                <span className={styles.diceHistoryTotal}>{entry.total}</span>
              </div>
              <div className={styles.diceHistoryMain}>
                <span className={styles.diceHistoryMeta}>{entry.rolledByName}</span>
                <span className={styles.diceHistoryMeta}>{formatDiceTimestamp(entry.rolledAt)}</span>
              </div>
              <div className={styles.diceHistoryBreakdown}>{formatDiceBreakdown(entry)}</div>
            </button>
          ))
        )}
      </div>
    </div>
  ) : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ShellLayout
      active={active}
      style={{ alignItems: 'stretch', justifyContent: 'stretch', fontFamily: 'var(--koa-font-display)' }}
    >
      <div className={styles.root}>

        <div className={styles.header}>
          <button
            onClick={() => { cinematicNav('menu'); }}
            onMouseEnter={playHover}
            className={styles.returnBtn}
          >
            ← RETURN
          </button>
        </div>

        <div
          className={styles.combatWindow}
          style={{
            left: PAD,
            right: PAD,
            transform: 'none',
            top: PAD,
            bottom: PAD,
          }}
        >
          {/* Vignette overlay */}
          <div className={styles.windowVignette} />

          {diceOutcomeEffect && (
            <div
              key={diceOutcomeEffect.key}
              className={`${styles.diceOutcomeOverlay} ${diceOutcomeEffect.kind === 'nat20' ? styles.diceOutcomeOverlayCelebration : styles.diceOutcomeOverlayOminous}`}
              aria-hidden="true"
            >
              <div className={styles.diceOutcomeVeil} />
              {diceOutcomeEffect.kind === 'nat20' ? (
                <div className={styles.diceOutcomeSparkField}>
                  {DICE_CELEBRATION_SPARKS.map((spark) => (
                    <span
                      key={spark.id}
                      className={styles.diceOutcomeSpark}
                      style={{
                        left: spark.left,
                        animationDelay: `${spark.delayMs}ms`,
                        animationDuration: `${spark.durationMs}ms`,
                        '--dice-spark-rotate': `${spark.rotationDeg}deg`,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className={styles.diceOutcomeRuneField}>
                  <span className={styles.diceOutcomeRune} />
                  <span className={styles.diceOutcomeRune} />
                  <span className={styles.diceOutcomeRune} />
                </div>
              )}
              <div className={styles.diceOutcomeBanner}>
                <div className={styles.diceOutcomeKicker}>
                  {diceOutcomeEffect.kind === 'nat20' ? 'Critical Success' : 'Ominous Omen'}
                </div>
                <div className={styles.diceOutcomeHeadline}>
                  {diceOutcomeEffect.kind === 'nat20' ? 'Natural 20' : 'Natural 1'}
                </div>
                <div className={styles.diceOutcomeMeta}>
                  {diceOutcomeEffect.rolledByName} · Total {diceOutcomeEffect.total}
                </div>
              </div>
            </div>
          )}

          {diceBannerEntry && (
            <div className={styles.diceResultBannerWrap} aria-live="polite">
              <div className={styles.diceResultBanner}>
                <div className={styles.diceResultLabel}>Total</div>
                <div className={styles.diceResultValue}>{diceBannerEntry.total}</div>
                <div className={styles.diceResultMeta}>
                  {diceBannerEntry.rolledByName} · {diceBannerEntry.notation}
                </div>
              </div>
            </div>
          )}

          <div className={styles.sceneDockWrap}>
            {sceneDockOpen && (
              <div className={styles.floatingConfigDock}>
                <input
                  ref={battlefieldFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className={styles.hiddenInput}
                  onChange={handleBattlefieldMediaUpload}
                />
                <div className={styles.controlsRight}>
                  <label className={styles.sceneLabel}>Scene</label>
                  <select
                    value={battleBg || ''}
                    onChange={e => {
                      playNav();
                      updateBattlefield({ backgroundSrc: e.target.value || DEFAULT_BATTLEFIELD.backgroundSrc });
                    }}
                    onMouseEnter={playHover}
                    className={styles.sceneSelect}
                    disabled={!canConfigureBattlefield}
                  >
                    {BATTLE_BACKGROUNDS.map((b, i) => (
                      <option key={i} value={b.src || ''}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                  <button
                    className={btnClass('ghost', 'sm', styles.toolbarActionBtn)}
                    onMouseEnter={playHover}
                    onClick={() => {
                      playNav();
                      battlefieldFileInputRef.current?.click();
                    }}
                    disabled={!canConfigureBattlefield || battlefieldUploadBusy}
                  >
                    {battlefieldUploadBusy ? 'Uploading...' : (battlefield.mediaStoragePath ? 'Replace Map' : 'Upload Map')}
                  </button>
                  <button
                    className={btnClass('ghost', 'sm', styles.toolbarActionBtn)}
                    onMouseEnter={playHover}
                    onClick={() => {
                      playNav();
                      clearBattlefieldMedia();
                    }}
                    disabled={!canConfigureBattlefield || !battlefield.mediaStoragePath}
                  >
                    Clear Map
                  </button>
                  <button
                    className={btnClass('ghost', 'sm', styles.toolbarActionBtn)}
                    onMouseEnter={playHover}
                    onClick={() => {
                      playNav();
                      updateBattlefield((current) => ({ gridEnabled: !current.gridEnabled }));
                    }}
                    disabled={!canConfigureBattlefield}
                  >
                    {battlefield.gridEnabled ? 'Hide Grid' : 'Show Grid'}
                  </button>
                  <label className={styles.sceneLabel}>Cell</label>
                  <input
                    type="number"
                    min="32"
                    max="192"
                    className={styles.toolbarNumberInput}
                    value={battlefield.gridCellSize}
                    onChange={(e) => updateBattlefield({ gridCellSize: clamp(toInt(e.target.value, battlefield.gridCellSize), 32, 192) })}
                    disabled={!canConfigureBattlefield}
                  />
                  <label className={styles.sceneLabel}>Offset</label>
                  <input
                    type="number"
                    min="-2048"
                    max="2048"
                    className={styles.toolbarNumberInput}
                    value={battlefield.gridOffsetX}
                    onChange={(e) => updateBattlefield({ gridOffsetX: clamp(toInt(e.target.value, battlefield.gridOffsetX), -2048, 2048) })}
                    disabled={!canConfigureBattlefield}
                  />
                  <input
                    type="number"
                    min="-2048"
                    max="2048"
                    className={styles.toolbarNumberInput}
                    value={battlefield.gridOffsetY}
                    onChange={(e) => updateBattlefield({ gridOffsetY: clamp(toInt(e.target.value, battlefield.gridOffsetY), -2048, 2048) })}
                    disabled={!canConfigureBattlefield}
                  />
                  <button
                    className={btnClass('ghost', 'sm', styles.toolbarActionBtn)}
                    onMouseEnter={playHover}
                    onClick={() => setBattlefieldResetRequestToken((tick) => tick + 1)}
                  >
                    Reset View
                  </button>
                  {selected ? (
                    <>
                      <label className={styles.sceneLabel}>Token</label>
                      <div className={styles.sceneTokenBadge} title={selected.name}>{selected.name}</div>
                      <label className={styles.sceneLabel}>Size %</label>
                      <input
                        type="number"
                        min={Math.round(TOKEN_SCALE_MIN * 100)}
                        max={Math.round(TOKEN_SCALE_MAX * 100)}
                        step="5"
                        className={styles.toolbarNumberInput}
                        value={selectedTokenScalePercent}
                        onChange={(e) => setSelectedTokenScalePercent(e.target.value)}
                        disabled={!selectedCanEdit}
                      />
                      <label className={styles.sceneLabel}>Rotate</label>
                      <input
                        type="number"
                        min="0"
                        max="359"
                        step="5"
                        className={styles.toolbarNumberInput}
                        value={selectedTokenRotationDegrees}
                        onChange={(e) => setSelectedTokenRotationDegrees(e.target.value)}
                        disabled={!selectedCanEdit}
                      />
                    </>
                  ) : (
                    <div className={styles.sceneDockHint}>Select a token to resize it. Hover a token to grab the rotate handle.</div>
                  )}
                </div>
              </div>
            )}
            <button
              type="button"
              className={btnClass('ghost', 'sm', styles.sceneDockToggle)}
              onMouseEnter={playHover}
              onClick={() => {
                playNav();
                setSceneDockOpen((open) => !open);
              }}
              aria-expanded={sceneDockOpen}
            >
              {sceneDockOpen ? 'Hide Scene' : 'Scene'}
            </button>
          </div>

          <div
          className={styles.mainLayout}
          style={{
            left: PAD,
            right: PAD,
            top: PAD,
            bottom: PAD,
          }}
        >
          <div className={styles.battlefieldWrap}>
            <div className={styles.battlefieldInner}>
              <BattlefieldScene
                combatants={combatants}
                activeCombatantId={activeCombatantId}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                playHover={playHover}
                playNav={playNav}
                battleBg={battleBg}
                battlefield={battlefield}
                battlefieldMediaUrl={battlefieldMediaUrl}
                resetViewRequestToken={battlefieldResetRequestToken}
                canMoveCombatant={canBoardMoveCombatant}
                canQuickEditCombatant={canBoardQuickEditCombatant}
                moveCombatantToCell={moveCombatantToCell}
                setCombatantTokenRotation={setCombatantTokenRotation}
                toggleCombatantDead={toggleCombatantDeadViaBoard}
                toggleCombatantStatus={toggleCombatantStatusViaBoard}
                clearCombatantStatuses={clearCombatantStatusesViaBoard}
                removeCombatant={removeCombatantViaBoard}
                openSheetFor={openSheetFor}
                drawings={battlefieldDrawings}
                canDraw={canWriteCombat}
                commitDrawing={commitBattlefieldDrawing}
                removeDrawing={removeBattlefieldDrawing}
                undoDrawing={undoBattlefieldDrawing}
                clearDrawings={clearBattlefieldDrawings}
                rightRailButtons={rightRailButtons}
                rightRailPanel={rightRailPanel}
                sharedPointers={visibleBattlefieldPointers}
                canSharePointer={canShareBattlefieldPointer}
                localSharedPointerId={battlefieldPointerId}
                localSharedPointerLabel={battlefieldPointerLabel}
                setSharedPointer={setLocalBattlefieldPointer}
                clearSharedPointer={clearLocalBattlefieldPointer}
              />
              <div className={styles.diceCanvasOverlay} aria-hidden="true">
                <div
                  id={DICE_BOX_VIEWPORT_ID}
                  ref={diceViewportRef}
                  className={styles.diceCanvasHost}
                />
              </div>

              {initiativeDockOpen && (
                <div className={styles.initOverlay}>
                  <div id="initiative-rail" className={styles.initStrip}>
                    <div className={styles.initHeaderGrid}>
                      <div className={styles.initHeaderCenter}>
                        <div className={styles.initHeading}>Initiative</div>
                        <div className={styles.initRoundControls}>
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
                        <div className={styles.initSubheading}>
                          {activeCombatant ? `${activeCombatant.name} is active` : 'No combatants are in initiative yet.'}
                        </div>
                      </div>
                    </div>

                    <div className={`${styles.initScroll} koa-scrollbar-thin`}>
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
                            {initiativeDisplayList.map((c, slotIndex) => {
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
                                    <div className={styles.initOrderBadge}>{slotIndex === 0 ? 'NOW' : slotIndex + 1}</div>
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
                    <div className={styles.initButtons}>
                      <button className={btnClass('gold', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); setAddModalOpen(true); }} disabled={!canWriteCombat}>+ Add</button>
                      <button className={btnClass('gold', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); resetEncounter(); }} disabled={!canManageCombat}>Reset</button>
                      <button className={btnClass('danger', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); clearEncounter(); }} disabled={!canManageCombat}>Clear</button>
                    </div>
                  </div>
                </div>
              )}
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
                  <div className={styles.restrictedHeroRow}>
                    <div className={styles.restrictedNameClassStack}>
                      <div className={styles.restrictedNameBlock}>
                        <div className={styles.label}>Name</div>
                        <div className={styles.restrictedNameValue}>{selected.name}</div>
                      </div>
                      <div className={`${styles.restrictedIdentityField} ${styles.restrictedClassField}`}>
                        <div className={styles.label}>Class</div>
                        <div className={styles.restrictedIdentityValue}>{cleanText(selected.className || selected.role) || 'Unclassified'}</div>
                      </div>
                    </div>
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
                    <div className={styles.restrictedSideStack}>
                      <div className={styles.restrictedIdentityField}>
                        <div className={styles.label}>Race</div>
                        <div className={styles.restrictedIdentityValue}>{cleanText(selected.race) || 'Unknown'}</div>
                      </div>
                      <div className={styles.restrictedIdentityField}>
                        <div className={styles.label}>Level</div>
                        <div className={styles.restrictedIdentityValue}>
                          {selected.level === '' || selected.level == null ? '—' : selected.level}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={styles.restrictedHeroHp}>
                    <div className={styles.label}>Current HP</div>
                    <div className={styles.restrictedStatValue}>
                      {selectedSensitiveStatsHidden ? (
                        <span className={styles.restrictedHiddenValue}>Hidden</span>
                      ) : (
                        <span
                          className={`${styles.sheetCurrentHpValue} ${sheetCurrentHpVisual.isCritical ? styles.sheetCurrentHpValueCritical : ''}`}
                          style={sheetCurrentHpVisual.style}
                        >
                          {selectedCurrentHp}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.restrictedStatRow}>
                  <div className={styles.label}>Notable Feature</div>
                  <div className={styles.restrictedStatValue}>
                    {selectedNotableFeature || 'None'}
                  </div>
                </div>

                <div className={styles.restrictedStatsGrid}>
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
                        selectedSensitiveEquipment.length ? (
                          <div className={styles.restrictedEquipPills}>
                            {selectedSensitiveEquipment.map((item) => (
                              <span key={`restricted-equip-${tokenKey(item)}`} className={styles.restrictedEquipPill}>{item}</span>
                            ))}
                          </div>
                        ) : 'None listed'
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
            <div className={`${styles.modalBack} ${isSheetPopoutActive ? styles.popoutModalBack : ''}`}>
            <div className={`${styles.modalCard} ${editorMode === 'sheet' ? styles.sheetManagerModal : styles.editorModal} ${isSheetPopoutActive ? styles.popoutModalCard : ''}`}>
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
                  {editorMode === 'sheet' ? (
                    <>
                      {!sheetPopoutOpen && (
                        <button className={btnClass('ghost', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); openSheetPopout(); }}>
                          Pop Out
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
                      <button className={btnClass('gold', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); setEditorMode('edit'); }}>
                        Edit
                      </button>
                      <button className={btnClass('danger', 'sm', styles.editorCloseButton)} onMouseEnter={playHover} onClick={() => { playNav(); setEditorOpen(false); }}>✕</button>
                    </>
                  ) : (
                    <>
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
                      {selected.sourceSheet && (
                        <button className={btnClass('ghost', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); setEditorMode('sheet'); }}>
                          Character Sheet
                        </button>
                      )}
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
                        <div className={styles.sheetStatusChips}>
                          <div className={`${styles.sheetStatusChip} ${styles.sheetStatusChipAc}`}>
                            <span className={styles.sheetStatusChipLabel}>AC</span>
                            <span className={styles.sheetStatusChipValue}>{selected.ac === '' || selected.ac == null ? '—' : selected.ac}</span>
                          </div>
                          <div className={`${styles.sheetStatusChip} ${styles.sheetStatusChipSpeed}`}>
                            <span className={styles.sheetStatusChipLabel}>Speed</span>
                            <span className={styles.sheetStatusChipValue}>{selected.speed === '' || selected.speed == null ? '—' : `${selected.speed} FT`}</span>
                          </div>
                          <div className={`${styles.sheetStatusChip} ${styles.sheetStatusChipProf}`}>
                            <span className={styles.sheetStatusChipLabel}>Prof</span>
                            <span className={styles.sheetStatusChipValue}>{selectedProficiencyBonus == null ? '—' : formatSigned(selectedProficiencyBonus)}</span>
                          </div>
                          <div className={`${styles.sheetStatusChip} ${styles.sheetStatusChipDc}`}>
                            <span className={styles.sheetStatusChipLabel}>Spell DC</span>
                            <span className={styles.sheetStatusChipValue}>{selected.spellSaveDC == null || selected.spellSaveDC === '' ? '—' : selected.spellSaveDC}</span>
                          </div>
                        </div>
                        {selected.sourceSheetFileName && (
                          <div className={styles.sheetImportMeta}>
                            {selected.sourceSheetFileName}
                            {selected.sourceSheetFormat ? ` (${selected.sourceSheetFormat.toUpperCase()})` : ''}
                          </div>
                        )}
                      </div>
                      <div className={styles.sheetHeroActions}>
                        {selectedInventoryManagedInPartyHub && (
                          <button
                            className={btnClass('ghost', 'sm')}
                            onMouseEnter={playHover}
                            onClick={() => { playNav(); openSelectedInventoryModal(); }}
                            disabled={!selectedCanEdit || !selectedInventoryOwnerUserId}
                          >
                            My Inventory
                          </button>
                        )}
                        <button className={btnClass('ghost', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); setListEditorMode('spellbook'); }} disabled={selectedReadOnly}>Spellbook</button>
                        <button className={btnClass('ghost', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); setListEditorMode('features'); }} disabled={selectedReadOnly}>Class Features</button>
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
                      <div className={`${styles.sheetCard} ${styles.sheetCardPrimary} ${styles.sheetCoreStatsCard}`}>
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

                      <div className={`${styles.sheetCard} ${styles.sheetCardPrimary} ${styles.sheetHpCard}`}>
                        
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
                              <button
                                type="button"
                                className={btnClass('ghost', 'sm', styles.longRestBtn, styles.sheetHpLongRestBtn)}
                                onMouseEnter={playHover}
                                onClick={() => { playNav(); longRestSelected(); }}
                                disabled={selectedReadOnly}
                              >
                                Long Rest
                              </button>
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
                      <div className={`${styles.combatToolsCard} ${styles.sheetToolsCard}`}>
                        <div className={`${styles.toolsHeaderRow} ${styles.sheetToolsToggleRow}`}>
                          <div className={styles.toolsModeToggle}>
                            <button
                              type="button"
                              className={`${styles.toolsModeBtn} ${sheetToolsMode === 'resources' ? styles.toolsModeBtnActive : ''}`}
                              onMouseEnter={playHover}
                              onClick={() => { playNav(); setSheetToolsMode('resources'); }}
                            >
                              Resources
                            </button>
                            <button
                              type="button"
                              className={`${styles.toolsModeBtn} ${sheetToolsMode === 'actions' ? styles.toolsModeBtnActive : ''}`}
                              onMouseEnter={playHover}
                              onClick={() => { playNav(); setSheetToolsMode('actions'); }}
                            >
                              Attack / Spells
                            </button>
                          </div>
                        </div>

                        <div className={styles.sheetToolsModeBody}>
                          {sheetToolsMode === 'resources' ? (
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
                          ) : (
                            <div className={styles.sheetActionsGrid}>
                              <div className={styles.combatToolGroup}>
                                <div className={styles.combatToolGroupHead}>
                                  <div className={styles.label}>Weapons</div>
                                </div>
                                <div className={`${styles.actionsTable} koa-scrollbar-thin`}>
                                  <div className={styles.actionsHeadRow}>
                                    <span>Attack</span>
                                    <span>Range</span>
                                    <span>Hit / DC</span>
                                    <span>Damage</span>
                                  </div>
                                  {selectedEquippedInventoryWeaponRows.length === 0 ? (
                                    <div className={styles.sheetListFallback}>No equipped weapons in inventory.</div>
                                  ) : (
                                    selectedEquippedInventoryWeaponRows.map((weapon) => (
                                      <button
                                        type="button"
                                        key={weapon.id}
                                        className={styles.actionsRowBtn}
                                        onMouseEnter={playHover}
                                        onClick={() => {
                                          playNav();
                                          setSheetActionDetail({
                                            type: 'inventoryWeapon',
                                            payload: { ...weapon },
                                          });
                                        }}
                                      >
                                        <span className={styles.actionsAttackCell}>{weapon.attack}</span>
                                        <span>{cleanText(weapon.range) || '--'}</span>
                                        <span>{formatWeaponHitDc(weapon.hitDc, selected?.attackModifier)}</span>
                                        <span>{cleanText(weapon.damage) || '--'}</span>
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>

                              <div className={styles.combatToolGroup}>
                                <div className={styles.combatToolGroupHead}>
                                  <div className={styles.label}>Spells</div>
                                  <div className={styles.spellSearchWrap}>
                                    <input
                                      className={`${styles.input} ${styles.spellSearchInput}`}
                                      value={spellSearchQuery}
                                      onChange={(e) => setSpellSearchQuery(e.target.value)}
                                      placeholder="Search spells..."
                                      aria-label="Search spells"
                                    />
                                  </div>
                                </div>
                                <div className={`${styles.actionsTable} koa-scrollbar-thin`}>
                                  <div className={styles.actionsHeadRow}>
                                    <span>Attack</span>
                                    <span>Range</span>
                                    <span>Hit / DC</span>
                                    <span>Damage</span>
                                  </div>
                                  {filteredSelectedSpellActionGroups.length === 0 ? (
                                    <div className={styles.sheetListFallback}>
                                      {hasSpellSearchQuery ? 'No spells match your search.' : 'No spellbook entries found.'}
                                    </div>
                                  ) : (
                                    filteredSelectedSpellActionGroups.map((group) => (
                                      <React.Fragment key={`spell-action-group-${group.key}`}>
                                        <div className={styles.actionsLevelDivider}>
                                          <span>{group.label}</span>
                                        </div>
                                        {group.rows.map((spellRow) => (
                                          <button
                                            type="button"
                                            key={spellRow.id}
                                            className={styles.actionsRowBtn}
                                            onMouseEnter={playHover}
                                            onClick={() => {
                                              playNav();
                                              setSheetActionDetail({
                                                type: 'spell',
                                                payload: {
                                                  ...(spellRow.spell || {}),
                                                  id: cleanText(spellRow.spell?.id) || spellRow.id,
                                                  name: cleanText(spellRow.spell?.name) || spellRow.attack,
                                                  range: cleanText(spellRow.spell?.range) || (spellRow.range === '--' ? '' : spellRow.range),
                                                  saveAtk: cleanText(spellRow.spell?.saveAtk) || (spellRow.hitDc === '--' ? '' : spellRow.hitDc),
                                                  damage: spellRow.damage === '--' ? '' : spellRow.damage,
                                                  time: cleanText(spellRow.spell?.time),
                                                  duration: cleanText(spellRow.spell?.duration),
                                                  notes: cleanText(spellRow.spell?.notes),
                                                },
                                              });
                                            }}
                                          >
                                            <span className={styles.actionsAttackCell}>{spellRow.attack}</span>
                                            <span>{spellRow.range}</span>
                                            <span>{spellRow.hitDc}</span>
                                            <span>{spellRow.damage}</span>
                                          </button>
                                        ))}
                                      </React.Fragment>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className={`${styles.sheetCard} ${styles.sheetCardSecondary}`}>
                      <div className={`${styles.sheetCardTitle} ${styles.sheetCardTitleCentered}`}>Skills</div>
                      <div className={styles.sheetStatRows}>
                        {selectedSkillRows.length ? selectedSkillRows.map((skillRow) => {
                          const rollNotation = buildD20CheckNotation(skillRow.bonus);
                          return (
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
                              <button
                                type="button"
                                className={`${styles.sheetStatValue} ${styles.sheetStatValueBtn}`}
                                onMouseEnter={playHover}
                                onClick={() => handleSheetStatRoll(skillRow.bonus)}
                                disabled={!rollNotation}
                                title={rollNotation ? `Roll ${skillRow.skill}: ${rollNotation}` : 'Unable to roll this modifier'}
                                aria-label={rollNotation ? `Roll ${skillRow.skill} check: ${rollNotation}` : `Unable to roll ${skillRow.skill}`}
                              >
                                {formatSigned(skillRow.bonus)}
                              </button>
                            </div>
                          );
                        }) : <div className={styles.sheetListFallback}>No skills parsed.</div>}
                      </div>
                    </div>

                    <div className={`${styles.sheetCard} ${styles.sheetCardSecondary}`}>
                      <div className={`${styles.sheetCardTitle} ${styles.sheetCardTitleCentered}`}>Saving Throws & Senses</div>
                      <div className={styles.sheetSaveSenseGrid}>
                        <div className={styles.sheetSaveSenseBlock}>
                          <div className={styles.sheetSavingThrowGrid}>
                            {selectedSavingThrowRows.map((row) => {
                              const rollNotation = buildD20CheckNotation(row.value);
                              return (
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
                                  <button
                                    type="button"
                                    className={`${styles.sheetStatValue} ${styles.sheetStatValueBtn}`}
                                    onMouseEnter={playHover}
                                    onClick={() => handleSheetStatRoll(row.value)}
                                    disabled={!rollNotation}
                                    title={rollNotation ? `Roll ${row.tag} saving throw: ${rollNotation}` : 'Unable to roll this modifier'}
                                    aria-label={rollNotation ? `Roll ${row.tag} saving throw: ${rollNotation}` : `Unable to roll ${row.tag} saving throw`}
                                  >
                                    {formatSigned(row.value)}
                                  </button>
                                </div>
                              );
                            })}
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
                          <div className={styles.sheetSubTitle}>Equipped Weapons</div>
                          <div className={styles.sheetListBlock}>
                            {selectedEquippedWeapons.length ? selectedEquippedWeapons.join(', ') : <span className={styles.sheetListFallback}>No equipped weapons marked.</span>}
                          </div>
                        </div>
                        <div className={`${styles.sheetSaveSenseBlock} ${styles.sheetSaveSenseTextBlock}`}>
                          <div className={styles.sheetSubTitle}>Attunement</div>
                          <div className={styles.sheetAttunementKicker}>
                            Attuned Items ({selectedAttunedInventoryItems.length}/{selectedAttunementLimit})
                          </div>
                          <div className={styles.sheetAttunementSlots}>
                            {selectedAttunementSlots.map((itemName, idx) => (
                              <div
                                key={`sheet-attunement-slot-${idx + 1}`}
                                className={`${styles.sheetAttunementSlot}${itemName ? ` ${styles.sheetAttunementSlotFilled}` : ''}`}
                              >
                                <span className={styles.sheetAttunementSlotRing} aria-hidden="true" />
                                <span className={styles.sheetAttunementSlotText}>{itemName || 'Empty attunement slot'}</span>
                              </div>
                            ))}
                          </div>
                          {selectedAttunedOverflowCount > 0 && (
                            <div className={styles.sheetListFallback}>
                              {selectedAttunedOverflowCount} attuned item(s) exceed the current slot limit.
                            </div>
                          )}
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
                        <div className={styles.uploadRowLeft}>
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
                        <button
                          className={btnClass('gold', 'sm', styles.importSheetInlineBtn)}
                          onMouseEnter={playHover}
                          onClick={() => { playNav(); triggerSheetImport(selected.id, !!selected.sourceSheet); }}
                          disabled={selectedReadOnly}
                        >
                          {selected.sourceSheet ? 'Import New Sheet' : 'Import Sheet'}
                        </button>
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

                {!selectedInventoryManagedInPartyHub && (
                  <div className={styles.sectionTopGap}>
                    <div className={styles.toolsHeaderRow}>
                      <div className={styles.label}>Inventory</div>
                      <div className={styles.toolsModeToggle}>
                        <button
                          type="button"
                          className={`${styles.toolsModeBtn} ${equipmentEditMode === 'equipment' ? styles.toolsModeBtnActive : ''}`}
                          onMouseEnter={playHover}
                          onClick={() => { playNav(); setEquipmentEditMode('equipment'); }}
                        >
                          Equipment
                        </button>
                        <button
                          type="button"
                          className={`${styles.toolsModeBtn} ${equipmentEditMode === 'equipped' ? styles.toolsModeBtnActive : ''}`}
                          onMouseEnter={playHover}
                          onClick={() => { playNav(); setEquipmentEditMode('equipped'); }}
                        >
                          Mark Equipped
                        </button>
                      </div>
                    </div>
                    {equipmentEditMode === 'equipment' ? (
                      <>
                        <div className={styles.label}>Equipment (one per line)</div>
                        <textarea
                          className={`${styles.input} ${styles.textareaInput}`}
                          value={normalizeStringList(selected.equipmentItems).join('\n')}
                          onChange={(e) => setSelectedField({ equipmentItems: normalizeStringList(e.target.value) })}
                        />
                      </>
                    ) : (
                      <div className={styles.equippedPickerWrap}>
                        <div className={styles.equippedPickerHeading}>Mark Equipped Items</div>
                        {selectedEquipableItems.length ? (
                          <div className={`${styles.equippedPicker} koa-scrollbar-thin`}>
                            {selectedEquipableItems.map((item) => {
                              const itemKey = tokenKey(item);
                              const checked = selectedEquippedItemKeys.has(itemKey);
                              return (
                                <label key={`edit-equip-toggle-${itemKey}`} className={styles.equippedPickerRow}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      playNav();
                                      toggleSelectedEquippedItem(item);
                                    }}
                                  />
                                  <span>{item}</span>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <div className={styles.equippedPickerEmpty}>No equipment lines to mark yet.</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

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

                {!selectedInventoryManagedInPartyHub && (
                  <div className={styles.sectionTopGap}><div className={styles.label}>Other Possessions (one per line)</div>
                    <textarea
                      className={`${styles.input} ${styles.textareaInput}`}
                      value={normalizeStringList(selected.otherPossessions).join('\n')}
                      onChange={(e) => setSelectedField({ otherPossessions: normalizeStringList(e.target.value) })}
                    />
                  </div>
                )}

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

              {sheetInventoryModalOpen && (
                <div className={styles.spellDetailOverlay}>
                  <div className={`${styles.modalCard} ${styles.sheetInventoryModalCard}`}>
                    <div className={styles.modalHeader}>
                      <div className={styles.modalTitle}>My Inventory</div>
                      <button
                        className={btnClass('danger', 'sm')}
                        onMouseEnter={playHover}
                        onClick={() => { playNav(); closeSheetInventoryModal(); }}
                      >
                        Close
                      </button>
                    </div>
                    <div className={styles.sheetInventoryModalBody}>
                      {!sheetInventoryEditorOpen ? (
                        <div className={styles.sheetInventoryListPane}>
                        <div className={styles.sheetInventoryPaneHead}>
                          <div className={styles.label}>Items</div>
                          <button
                            type="button"
                            className={btnClass('ghost', 'sm')}
                            onMouseEnter={playHover}
                            onClick={() => { playNav(); openSheetInventoryAdd(); }}
                            disabled={!selectedCanEdit || !selectedInventoryOwnerUserId}
                          >
                            + Add Item
                          </button>
                        </div>
                        <div className={styles.sheetInventoryAttuneMeta}>
                          <div className={styles.sheetInventoryAttuneMetaLabel}>Attunement Slots</div>
                          <div className={styles.sheetInventoryAttuneMetaControls}>
                            <button
                              type="button"
                              className={btnClass('ghost', 'sm')}
                              onMouseEnter={playHover}
                              onClick={() => setSelectedPersonalInventoryAttunementLimit(selectedAttunementLimit - 1)}
                              disabled={!selectedCanEdit || !selectedInventoryOwnerUserId || selectedAttunementLimit <= 1}
                            >
                              -
                            </button>
                            <input
                              className={`${styles.input} ${styles.sheetInventoryAttuneLimitInput}`}
                              inputMode="numeric"
                              value={selectedAttunementLimit}
                              onChange={(e) => setSelectedPersonalInventoryAttunementLimit(e.target.value)}
                              disabled={!selectedCanEdit || !selectedInventoryOwnerUserId}
                            />
                            <button
                              type="button"
                              className={btnClass('ghost', 'sm')}
                              onMouseEnter={playHover}
                              onClick={() => setSelectedPersonalInventoryAttunementLimit(selectedAttunementLimit + 1)}
                              disabled={!selectedCanEdit || !selectedInventoryOwnerUserId || selectedAttunementLimit >= 99}
                            >
                              +
                            </button>
                            <span className={styles.sheetInventoryAttuneUsage}>
                              {selectedAttunedInventoryItems.length}/{selectedAttunementLimit} attuned
                            </span>
                          </div>
                        </div>
                        <div className={`${styles.sheetInventoryList} koa-scrollbar-thin`}>
                          {sheetInventoryItems.length === 0 ? (
                            <div className={styles.sheetListFallback}>No personal items tracked.</div>
                          ) : (
                            sheetInventoryItems.map((item) => {
                              const isActive = cleanText(item.id) === sheetInventoryEditingId;
                              return (
                                <div
                                  key={`sheet-inventory-item-${item.id}`}
                                  className={`${styles.sheetInventoryRow}${isActive ? ` ${styles.sheetInventoryRowActive}` : ''}`}
                                  onMouseEnter={() => {
                                    if (!selectedCanEdit || !selectedInventoryOwnerUserId) return;
                                    playHover();
                                  }}
                                  onClick={() => {
                                    if (!selectedCanEdit || !selectedInventoryOwnerUserId) return;
                                    playNav();
                                    openSheetInventoryEdit(item);
                                  }}
                                  onKeyDown={(e) => {
                                    if (!selectedCanEdit || !selectedInventoryOwnerUserId) return;
                                    if (e.key !== 'Enter' && e.key !== ' ') return;
                                    e.preventDefault();
                                    openSheetInventoryEdit(item);
                                  }}
                                  role={selectedCanEdit && selectedInventoryOwnerUserId ? 'button' : undefined}
                                  tabIndex={selectedCanEdit && selectedInventoryOwnerUserId ? 0 : -1}
                                >
                                  <div className={styles.sheetInventoryMeta}>
                                    <div className={styles.sheetInventoryNameRow}>
                                      <span className={styles.sheetInventoryName}>{cleanText(item.name) || 'Unnamed Item'}</span>
                                      {item.equipped && <span className={styles.sheetInventoryPill}>Equipped</span>}
                                      {item.attuned && <span className={styles.sheetInventoryPill}>Attuned</span>}
                                      {item.hidden && <span className={styles.sheetInventoryPill}>Hidden</span>}
                                    </div>
                                    <div className={styles.sheetInventorySub}>{cleanText(item.rarity) || 'Common'} - {cleanText(item.category) || 'Gear'}</div>
                                  </div>
                                  <div className={styles.sheetInventoryRowActions} onClick={(e) => e.stopPropagation()}>
                                    <span className={styles.qtyBadge}>x{item.qty ?? 1}</span>
                                    <button type="button" className={btnClass('ghost', 'sm')} onMouseEnter={playHover} onClick={() => bumpSheetInventoryQty(item.id, -1)} disabled={!selectedCanEdit}>-</button>
                                    <button type="button" className={btnClass('ghost', 'sm')} onMouseEnter={playHover} onClick={() => bumpSheetInventoryQty(item.id, 1)} disabled={!selectedCanEdit}>+</button>
                                    <button type="button" className={btnClass('ghost', 'sm')} onMouseEnter={playHover} onClick={() => toggleSheetInventoryEquipped(item.id)} disabled={!selectedCanEdit}>Equip</button>
                                    <button type="button" className={btnClass('ghost', 'sm')} onMouseEnter={playHover} onClick={() => toggleSheetInventoryAttuned(item.id)} disabled={!selectedCanEdit}>Attune</button>
                                    <button type="button" className={btnClass('ghost', 'sm')} onMouseEnter={playHover} onClick={() => toggleSheetInventoryHidden(item.id)} disabled={!selectedCanEdit}>Hide</button>
                                    <button type="button" className={btnClass('danger', 'sm')} onMouseEnter={playHover} onClick={() => deleteSheetInventoryItem(item.id)} disabled={!selectedCanEdit}>Delete</button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                        </div>
                      ) : (
                        <div className={styles.sheetInventoryEditorPane}>
                        <div className={styles.sheetInventoryPaneHead}>
                          <div className={styles.label}>{sheetInventoryEditingId ? 'Edit Item' : 'New Item'}</div>
                          <button
                            type="button"
                            className={btnClass('ghost', 'sm')}
                            onMouseEnter={playHover}
                            onClick={() => { playNav(); closeSheetInventoryEditor(); }}
                          >
                            Back to Items
                          </button>
                        </div>
                        <div className={`${styles.sheetInventoryEditorGrid} koa-scrollbar-thin`}>
                          <div className={styles.sheetInventoryFieldWide}>
                            <div className={styles.label}>Name</div>
                            <input
                              className={styles.input}
                              value={sheetInventoryDraft.name}
                              onChange={(e) => setSheetInventoryDraft((prev) => ({ ...prev, name: e.target.value }))}
                              placeholder="e.g. Longsword +1"
                              disabled={!selectedCanEdit}
                            />
                          </div>
                          <div>
                            <div className={styles.label}>Category</div>
                            <select
                              className={`${styles.input} ${styles.selectInput}`}
                              value={sheetInventoryDraft.category}
                              onChange={(e) => setSheetInventoryDraft((prev) => ({ ...prev, category: e.target.value }))}
                              disabled={!selectedCanEdit}
                            >
                              {INVENTORY_CATEGORIES.map((category) => (
                                <option key={`sheet-inv-category-${category}`} value={category}>{category}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <div className={styles.label}>Rarity</div>
                            <select
                              className={`${styles.input} ${styles.selectInput}`}
                              value={sheetInventoryDraft.rarity}
                              onChange={(e) => setSheetInventoryDraft((prev) => ({ ...prev, rarity: e.target.value }))}
                              disabled={!selectedCanEdit}
                            >
                              {INVENTORY_RARITIES.map((rarity) => (
                                <option key={`sheet-inv-rarity-${rarity}`} value={rarity}>{rarity}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <div className={styles.label}>Qty</div>
                            <input
                              className={styles.input}
                              inputMode="numeric"
                              value={sheetInventoryDraft.qty}
                              onChange={(e) => setSheetInventoryDraft((prev) => ({ ...prev, qty: e.target.value }))}
                              disabled={!selectedCanEdit}
                            />
                          </div>
                          <div>
                            <div className={styles.label}>{isSheetInventoryDraftWeapon ? 'Cost (gp)' : 'Value (gp)'}</div>
                            <input
                              className={styles.input}
                              inputMode="decimal"
                              value={sheetInventoryDraft.value}
                              onChange={(e) => setSheetInventoryDraft((prev) => ({ ...prev, value: e.target.value }))}
                              disabled={!selectedCanEdit}
                            />
                          </div>
                          <div>
                            <div className={styles.label}>Weight (lb)</div>
                            <input
                              className={styles.input}
                              inputMode="decimal"
                              value={sheetInventoryDraft.weight}
                              onChange={(e) => setSheetInventoryDraft((prev) => ({ ...prev, weight: e.target.value }))}
                              disabled={!selectedCanEdit}
                            />
                          </div>

                          {isSheetInventoryDraftWeapon && (
                            <>
                              <div>
                                <div className={styles.label}>Proficient</div>
                                <input className={styles.input} value={sheetInventoryDraft.weaponProficiency} onChange={(e) => setSheetInventoryDraft((prev) => ({ ...prev, weaponProficiency: e.target.value }))} disabled={!selectedCanEdit} />
                              </div>
                              <div>
                                <div className={styles.label}>Hit / DC</div>
                                <input className={styles.input} value={sheetInventoryDraft.weaponHitDc} onChange={(e) => setSheetInventoryDraft((prev) => ({ ...prev, weaponHitDc: e.target.value }))} disabled={!selectedCanEdit} />
                              </div>
                              <div>
                                <div className={styles.label}>Attack Type</div>
                                <input className={styles.input} value={sheetInventoryDraft.weaponAttackType} onChange={(e) => setSheetInventoryDraft((prev) => ({ ...prev, weaponAttackType: e.target.value }))} disabled={!selectedCanEdit} />
                              </div>
                              <div>
                                <div className={styles.label}>Reach</div>
                                <input className={styles.input} value={sheetInventoryDraft.weaponReach} onChange={(e) => setSheetInventoryDraft((prev) => ({ ...prev, weaponReach: e.target.value }))} disabled={!selectedCanEdit} />
                              </div>
                              <div>
                                <div className={styles.label}>Damage</div>
                                <input className={styles.input} value={sheetInventoryDraft.weaponDamage} onChange={(e) => setSheetInventoryDraft((prev) => ({ ...prev, weaponDamage: e.target.value }))} disabled={!selectedCanEdit} />
                              </div>
                              <div>
                                <div className={styles.label}>Damage Type</div>
                                <input className={styles.input} value={sheetInventoryDraft.weaponDamageType} onChange={(e) => setSheetInventoryDraft((prev) => ({ ...prev, weaponDamageType: e.target.value }))} disabled={!selectedCanEdit} />
                              </div>
                              <div className={styles.sheetInventoryFieldWide}>
                                <div className={styles.label}>Properties</div>
                                <input className={styles.input} value={sheetInventoryDraft.weaponProperties} onChange={(e) => setSheetInventoryDraft((prev) => ({ ...prev, weaponProperties: e.target.value }))} disabled={!selectedCanEdit} />
                              </div>
                            </>
                          )}

                          <div className={styles.sheetInventoryFieldWide}>
                            <div className={styles.label}>Notes</div>
                            <textarea
                              className={`${styles.input} ${styles.actionDetailTextarea}`}
                              value={sheetInventoryDraft.notes}
                              onChange={(e) => setSheetInventoryDraft((prev) => ({ ...prev, notes: e.target.value }))}
                              disabled={!selectedCanEdit}
                            />
                          </div>
                          <div className={styles.sheetInventoryFieldWide}>
                            <div className={styles.label}>Tags (comma separated)</div>
                            <input
                              className={styles.input}
                              value={sheetInventoryDraft.tags}
                              onChange={(e) => setSheetInventoryDraft((prev) => ({ ...prev, tags: e.target.value }))}
                              disabled={!selectedCanEdit}
                            />
                          </div>
                          <div className={styles.sheetInventoryFieldWide}>
                            <label className={styles.equippedPickerRow}>
                              <input
                                type="checkbox"
                                checked={!!sheetInventoryDraft.equipped}
                                onChange={(e) => setSheetInventoryDraft((prev) => ({ ...prev, equipped: e.target.checked }))}
                                disabled={!selectedCanEdit}
                              />
                              <span>Equipped</span>
                            </label>
                            <label className={styles.equippedPickerRow}>
                              <input
                                type="checkbox"
                                checked={!!sheetInventoryDraft.attuned}
                                onChange={(e) => setSheetInventoryDraft((prev) => ({ ...prev, attuned: e.target.checked }))}
                                disabled={!selectedCanEdit}
                              />
                              <span>Attuned</span>
                            </label>
                            <label className={styles.equippedPickerRow}>
                              <input
                                type="checkbox"
                                checked={!!sheetInventoryDraft.hidden}
                                onChange={(e) => setSheetInventoryDraft((prev) => ({ ...prev, hidden: e.target.checked }))}
                                disabled={!selectedCanEdit}
                              />
                              <span>Hide From Other Players</span>
                            </label>
                          </div>
                        </div>
                        </div>
                      )}
                    </div>
                    <div className={styles.managerActions}>
                      {!sheetInventoryEditorOpen ? (
                        <button
                          className={btnClass('ghost', 'sm')}
                          onMouseEnter={playHover}
                          onClick={() => { playNav(); closeSheetInventoryModal(); }}
                        >
                          Close
                        </button>
                      ) : (
                        <>
                          <button
                            className={btnClass('ghost', 'sm')}
                            onMouseEnter={playHover}
                            onClick={() => { playNav(); closeSheetInventoryEditor(); }}
                          >
                            Cancel
                          </button>
                          <button
                            className={btnClass('gold', 'sm')}
                            onMouseEnter={playHover}
                            onClick={() => { playNav(); saveSheetInventoryDraft(); }}
                            disabled={!selectedCanEdit || !selectedInventoryOwnerUserId || !cleanText(sheetInventoryDraft.name)}
                          >
                            {sheetInventoryEditingId ? 'Save Changes' : 'Add Item'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {editorMode === 'sheet' && sheetActionDetail && (
                <div className={styles.spellDetailOverlay}>
                  <div className={`${styles.modalCard} ${styles.actionDetailCard}`}>
                    <div className={styles.modalHeader}>
                      <div className={styles.modalTitle}>
                        {sheetActionDetail.type === 'spell' ? 'Spell Details' : 'Weapon Details'}
                      </div>
                      <button
                        className={btnClass('danger', 'sm')}
                        onMouseEnter={playHover}
                        onClick={() => { playNav(); setSheetActionDetail(null); }}
                      >
                        Close
                      </button>
                    </div>
                    <div className={styles.actionDetailBody}>
                      {sheetActionDetail.type === 'spell' ? (
                        <div className={styles.actionDetailGrid}>
                          <div className={styles.actionDetailFieldWide}>
                            <div className={styles.label}>Attack</div>
                            <input
                              className={`${styles.input} ${styles.actionDetailInput}`}
                              value={cleanText(sheetActionDetail.payload?.name)}
                              onChange={(e) => updateSheetActionDetailField('name', e.target.value)}
                              disabled={!selectedCanEdit}
                            />
                          </div>
                          <div>
                            <div className={styles.label}>Range</div>
                            <input
                              className={`${styles.input} ${styles.actionDetailInput}`}
                              value={cleanText(sheetActionDetail.payload?.range)}
                              onChange={(e) => updateSheetActionDetailField('range', e.target.value)}
                              disabled={!selectedCanEdit}
                            />
                          </div>
                          <div>
                            <div className={styles.label}>Hit / DC</div>
                            <input
                              className={`${styles.input} ${styles.actionDetailInput}`}
                              value={cleanText(sheetActionDetail.payload?.saveAtk)}
                              onChange={(e) => updateSheetActionDetailField('saveAtk', e.target.value)}
                              disabled={!selectedCanEdit}
                            />
                          </div>
                          <div>
                            <div className={styles.label}>Damage</div>
                            <input
                              className={`${styles.input} ${styles.actionDetailInput}`}
                              value={cleanText(sheetActionDetail.payload?.damage)}
                              onChange={(e) => updateSheetActionDetailField('damage', e.target.value)}
                              placeholder="2d6+3"
                              disabled={!selectedCanEdit}
                            />
                          </div>
                          <div>
                            <div className={styles.label}>Casting Time</div>
                            <input
                              className={`${styles.input} ${styles.actionDetailInput}`}
                              value={cleanText(sheetActionDetail.payload?.time)}
                              onChange={(e) => updateSheetActionDetailField('time', e.target.value)}
                              disabled={!selectedCanEdit}
                            />
                          </div>
                          <div>
                            <div className={styles.label}>Duration</div>
                            <input
                              className={`${styles.input} ${styles.actionDetailInput}`}
                              value={cleanText(sheetActionDetail.payload?.duration)}
                              onChange={(e) => updateSheetActionDetailField('duration', e.target.value)}
                              disabled={!selectedCanEdit}
                            />
                          </div>
                          <div className={styles.actionDetailFieldWide}>
                            <div className={styles.label}>Notes</div>
                            <textarea
                              className={`${styles.input} ${styles.actionDetailTextarea}`}
                              value={cleanText(sheetActionDetail.payload?.notes)}
                              onChange={(e) => updateSheetActionDetailField('notes', e.target.value)}
                              disabled={!selectedCanEdit}
                            />
                          </div>
                        </div>
                      ) : sheetActionDetail.type === 'inventoryWeapon' ? (
                        <div className={styles.actionDetailGrid}>
                          <div className={styles.actionDetailFieldWide}>
                            <div className={styles.label}>Weapon</div>
                            <div className={styles.actionDetailValue}>
                              <strong>{cleanText(inventoryWeaponActionPayload?.attack) || 'Unnamed Weapon'}</strong>
                              {inventoryWeaponActionMeta && <div>{inventoryWeaponActionMeta}</div>}
                            </div>
                          </div>
                          <div>
                            <div className={styles.label}>Proficient</div>
                            <div className={styles.actionDetailValue}>
                              {cleanText(inventoryWeaponActionPayload?.weaponProficiency) || '--'}
                            </div>
                          </div>
                          <div>
                            <div className={styles.label}>Hit / DC</div>
                            <div className={styles.actionDetailValue}>
                              {formatWeaponHitDc(
                                inventoryWeaponActionPayload?.weaponHitDc || inventoryWeaponActionPayload?.hitDc,
                                selected?.attackModifier
                              )}
                            </div>
                          </div>
                          <div>
                            <div className={styles.label}>Attack Type</div>
                            <div className={styles.actionDetailValue}>
                              {cleanText(inventoryWeaponActionPayload?.weaponAttackType) || '--'}
                            </div>
                          </div>
                          <div>
                            <div className={styles.label}>Reach</div>
                            <div className={styles.actionDetailValue}>
                              {cleanText(inventoryWeaponActionPayload?.weaponReach || inventoryWeaponActionPayload?.range) || '--'}
                            </div>
                          </div>
                          <div>
                            <div className={styles.label}>Damage</div>
                            <div className={styles.actionDetailValue}>
                              {cleanText(inventoryWeaponActionPayload?.weaponDamage || inventoryWeaponActionPayload?.damage) || '--'}
                            </div>
                          </div>
                          <div>
                            <div className={styles.label}>Damage Type</div>
                            <div className={styles.actionDetailValue}>
                              {cleanText(inventoryWeaponActionPayload?.weaponDamageType) || '--'}
                            </div>
                          </div>
                          <div>
                            <div className={styles.label}>Weight</div>
                            <div className={styles.actionDetailValue}>
                              {inventoryWeaponActionWeight
                                ? (/[a-z]/i.test(inventoryWeaponActionWeight) ? inventoryWeaponActionWeight : `${inventoryWeaponActionWeight} lb.`)
                                : '--'}
                            </div>
                          </div>
                          <div>
                            <div className={styles.label}>Cost</div>
                            <div className={styles.actionDetailValue}>
                              {inventoryWeaponActionCost
                                ? (/[a-z]/i.test(inventoryWeaponActionCost) ? inventoryWeaponActionCost : `${inventoryWeaponActionCost} gp`)
                                : '--'}
                            </div>
                          </div>
                          <div className={styles.actionDetailFieldWide}>
                            <div className={styles.label}>Properties</div>
                            <div className={styles.actionDetailValue}>
                              {cleanText(inventoryWeaponActionPayload?.weaponProperties) || '--'}
                            </div>
                          </div>
                          {cleanText(inventoryWeaponActionPayload?.notes) && (
                            <div className={styles.actionDetailFieldWide}>
                              <div className={styles.label}>Notes</div>
                              <div className={styles.actionDetailValue}>{cleanText(inventoryWeaponActionPayload?.notes)}</div>
                            </div>
                          )}
                          {inventoryWeaponActionTags.length > 0 && (
                            <div className={styles.actionDetailFieldWide}>
                              <div className={styles.label}>Tags</div>
                              <div className={styles.actionDetailValue}>{inventoryWeaponActionTags.join(', ')}</div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className={styles.actionDetailGrid}>
                          <div className={styles.actionDetailFieldWide}>
                            <div className={styles.label}>Attack</div>
                            <input
                              className={`${styles.input} ${styles.actionDetailInput}`}
                              value={cleanText(sheetActionDetail.payload?.attack)}
                              onChange={(e) => updateSheetActionDetailField('attack', e.target.value)}
                              disabled={!selectedCanEdit}
                            />
                          </div>
                          <div>
                            <div className={styles.label}>Range</div>
                            <input
                              className={`${styles.input} ${styles.actionDetailInput}`}
                              value={cleanText(sheetActionDetail.payload?.range)}
                              onChange={(e) => updateSheetActionDetailField('range', e.target.value)}
                              disabled={!selectedCanEdit}
                            />
                          </div>
                          <div>
                            <div className={styles.label}>Hit / DC</div>
                            <input
                              className={`${styles.input} ${styles.actionDetailInput}`}
                              value={cleanText(sheetActionDetail.payload?.hitDc)}
                              onChange={(e) => updateSheetActionDetailField('hitDc', e.target.value)}
                              disabled={!selectedCanEdit}
                            />
                          </div>
                          <div>
                            <div className={styles.label}>Damage</div>
                            <input
                              className={`${styles.input} ${styles.actionDetailInput}`}
                              value={cleanText(sheetActionDetail.payload?.damage)}
                              onChange={(e) => updateSheetActionDetailField('damage', e.target.value)}
                              placeholder="1d6+2"
                              disabled={!selectedCanEdit}
                            />
                          </div>
                          <div className={styles.actionDetailFieldWide}>
                            <div className={styles.label}>Notes</div>
                            <textarea
                              className={`${styles.input} ${styles.actionDetailTextarea}`}
                              value={cleanText(sheetActionDetail.payload?.notes)}
                              onChange={(e) => updateSheetActionDetailField('notes', e.target.value)}
                              disabled={!selectedCanEdit}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    {sheetActionDetail.type === 'inventoryWeapon' ? (
                      <div className={styles.managerActions}>
                        <button
                          className={btnClass('gold', 'sm')}
                          onMouseEnter={playHover}
                          onClick={() => { playNav(); setSheetActionDetail(null); }}
                        >
                          Close
                        </button>
                      </div>
                    ) : (
                      <div className={styles.managerActions}>
                        <button
                          className={btnClass('ghost', 'sm')}
                          onMouseEnter={playHover}
                          onClick={() => { playNav(); setSheetActionDetail(null); }}
                        >
                          Cancel
                        </button>
                        <button
                          className={btnClass('gold', 'sm')}
                          onMouseEnter={playHover}
                          onClick={() => { playNav(); saveSheetActionDetail(); }}
                          disabled={!selectedCanEdit}
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                </div>
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
                                    <th>Damage</th>
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
                                      <td>{spell.damage || spell.effect || '—'}</td>
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
                          <div className={styles.label}>Damage</div>
                          <input
                            className={styles.input}
                            value={activeSpellDraft.damage || activeSpellDraft.effect || ''}
                            onChange={(e) => updateSpellbookDraftEntry(activeSpellDraft.id, { damage: e.target.value })}
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
          if (isSheetPopoutActive && sheetPortalHost) {
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
