export const DICE_BOX_ASSET_PATH = '/assets/dice-box/';
export const DICE_BOX_VIEWPORT_ID = 'combat-dice-box';
export const DICE_LOG_LIMIT = 20;
export const DICE_QUICK_NOTATIONS = Object.freeze(['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']);

const ALLOWED_DICE_SIDES = new Set([4, 6, 8, 10, 12, 20, 100]);
const SIMPLE_NOTATION_RE = /^(\d*)d(\d+)([+-]\d+)?$/i;

function cleanText(value) {
  return String(value ?? '').trim();
}

function toFiniteInt(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeModifier(value) {
  const parsed = toFiniteInt(value, 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeDiceNotation(input) {
  const compact = cleanText(input).replace(/\s+/g, '').toLowerCase();
  if (!compact) {
    return { ok: false, error: 'Enter a roll like d20 or 2d6+3.' };
  }

  const match = compact.match(SIMPLE_NOTATION_RE);
  if (!match) {
    return { ok: false, error: 'Use simple notation only, like d20 or 2d6+3.' };
  }

  const qty = match[1] ? toFiniteInt(match[1], 0) : 1;
  const sides = toFiniteInt(match[2], 0);
  const modifier = normalizeModifier(match[3] || 0);

  if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
    return { ok: false, error: 'Roll between 1 and 20 dice at a time.' };
  }

  if (!ALLOWED_DICE_SIDES.has(sides)) {
    return { ok: false, error: 'Use a standard die: d4, d6, d8, d10, d12, d20, or d100.' };
  }

  const modifierText = modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : `${modifier}`;
  const displayNotation = `${qty === 1 ? '' : qty}d${sides}${modifierText}`;
  const engineNotation = `${qty}d${sides}${modifierText}`;

  return {
    ok: true,
    parsed: {
      qty,
      sides,
      modifier,
      displayNotation,
      engineNotation,
    },
  };
}

function sanitizeDiceResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return null;
  const sidesText = cleanText(result.sides);
  const dieType = cleanText(result.dieType) || (sidesText ? `d${sidesText.replace(/^d/i, '')}` : '');
  const numericSides = toFiniteInt(sidesText.replace(/^d/i, ''), 0);
  const value = toFiniteInt(result.value, NaN);
  if (!dieType || !numericSides || !Number.isFinite(value)) return null;

  return {
    rollId: cleanText(result.rollId),
    groupId: cleanText(result.groupId),
    sides: numericSides,
    dieType,
    value,
    data: cleanText(result.data),
    theme: cleanText(result.theme),
    themeColor: cleanText(result.themeColor),
  };
}

export function sanitizeDiceResults(results) {
  if (!Array.isArray(results)) return [];
  return results.map(sanitizeDiceResult).filter(Boolean);
}

export function createDiceLogEntry({ notation, modifier = 0, results = [], rolledByUserId = '', rolledByName = 'Player', rolledAt = '' }) {
  const safeResults = sanitizeDiceResults(results);
  const total = safeResults.reduce((sum, entry) => sum + toFiniteInt(entry.value, 0), 0) + normalizeModifier(modifier);
  return {
    id: cleanText(rolledAt) ? `dice-${rolledAt}-${Math.random().toString(36).slice(2, 8)}` : `dice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    notation: cleanText(notation),
    total,
    modifier: normalizeModifier(modifier),
    results: safeResults,
    rolledByUserId: cleanText(rolledByUserId),
    rolledByName: cleanText(rolledByName) || 'Player',
    rolledAt: cleanText(rolledAt) || new Date().toISOString(),
  };
}

export function normalizeDiceLog(log) {
  if (!Array.isArray(log)) return [];
  return log
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
      const notation = cleanText(entry.notation);
      const rolledAt = cleanText(entry.rolledAt);
      const results = sanitizeDiceResults(entry.results);
      if (!notation || !rolledAt || results.length === 0) return null;
      return {
        id: cleanText(entry.id) || `dice-${rolledAt}-${Math.random().toString(36).slice(2, 8)}`,
        notation,
        total: toFiniteInt(entry.total, results.reduce((sum, die) => sum + toFiniteInt(die.value, 0), 0) + normalizeModifier(entry.modifier)),
        modifier: normalizeModifier(entry.modifier),
        results,
        rolledByUserId: cleanText(entry.rolledByUserId),
        rolledByName: cleanText(entry.rolledByName) || 'Player',
        rolledAt,
      };
    })
    .filter(Boolean)
    .slice(-DICE_LOG_LIMIT);
}

export function appendDiceLogEntry(log, entry) {
  return [...normalizeDiceLog(log), entry].slice(-DICE_LOG_LIMIT);
}

export function getDiceOutcomeKind(entry) {
  const results = sanitizeDiceResults(entry?.results);
  const d20Results = results.filter((die) => toFiniteInt(die.sides, 0) === 20);
  if (d20Results.some((die) => toFiniteInt(die.value, 0) === 20)) return 'nat20';
  if (d20Results.some((die) => toFiniteInt(die.value, 0) === 1)) return 'nat1';
  return '';
}

export function formatDiceBreakdown(entry) {
  const results = sanitizeDiceResults(entry?.results);
  if (results.length === 0) return '';
  const values = results.map((die) => die.value).join(', ');
  const modifier = normalizeModifier(entry?.modifier);
  if (!modifier) return values;
  return `${values} ${modifier > 0 ? '+' : '-'} ${Math.abs(modifier)}`;
}
