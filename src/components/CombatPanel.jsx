import React, { useEffect, useMemo, useRef, useState } from 'react';
import ShellLayout from './ShellLayout';

const LS_KEY = 'koa:combat:v4';
const fontStack = "Cinzel, 'Trajan Pro', Georgia, serif";
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const toInt = (v, fb = 0) => { const n = parseInt(String(v ?? ''), 10); return Number.isFinite(n) ? n : fb; };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const ADVENTURERS = [
  { name: 'William Spicer',   role: 'Fiend Warlock',      ac: 15, hp: 40, maxHP: 40 },
  { name: 'Arlis Ghoth',      role: 'Cleric',              ac: 17, hp: 38, maxHP: 38 },
  { name: 'Thryvaris Bria',   role: 'Sorcerer',            ac: 14, hp: 32, maxHP: 32 },
  { name: 'Fen',              role: 'Barbarian',           ac: 16, hp: 58, maxHP: 58 },
  { name: "Von'Ghul",         role: 'Artificer',           ac: 18, hp: 44, maxHP: 44 },
  { name: 'Castor',           role: 'Warlock',             ac: 15, hp: 36, maxHP: 36 },
  { name: 'Cerci VonDonovon', role: 'Dhampir Spellblade',  ac: 16, hp: 42, maxHP: 42 },
];

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

function loadState() {
  try { const raw = localStorage.getItem(LS_KEY); if (!raw) return null; return JSON.parse(raw); }
  catch { return null; }
}
function saveState(state) { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {} }

function defaultEncounter() {
  return { id: uid(), name: 'Encounter', round: 1, activeIndex: 0, combatants: [], updatedAt: Date.now() };
}

function normalize(enc) {
  const base = defaultEncounter();
  const e = { ...base, ...(enc || {}) };
  if (!Array.isArray(e.combatants)) e.combatants = [];
  e.combatants = e.combatants.map((c, i) => ({
    id: c.id || uid(),
    name: c.name || 'Unknown',
    role: c.role || '',
    side: c.side || 'Enemy',
    init: toInt(c.init, 10),
    maxHP: c.maxHP === '' || c.maxHP == null ? '' : toInt(c.maxHP, 0),
    hp: c.hp === '' || c.hp == null ? '' : toInt(c.hp, 0),
    tempHP: toInt(c.tempHP, 0),
    ac: c.ac === '' || c.ac == null ? '' : toInt(c.ac, 0),
    status: Array.isArray(c.status) ? c.status : String(c.status || '').split(',').map(s => s.trim()).filter(Boolean),
    concentration: c.concentration || '',
    notes: c.notes || '',
    dead: !!c.dead,
    // battlefield appearance
    enemyType: c.enemyType || 'goblin',
    customImage: c.customImage || '',
    pcColorIndex: c.pcColorIndex != null ? c.pcColorIndex : (i % PC_COLORS.length),
  }));
  e.round = toInt(e.round, 1);
  e.activeIndex = toInt(e.activeIndex, 0);
  e.updatedAt = Date.now();
  return e;
}

function sideRank(side) { if (side === 'PC') return 0; if (side === 'Ally') return 1; return 2; }

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

// ── Battlefield Token ──────────────────────────────────────────────────────
function BattlefieldToken({ c, isActive, isSelected, onClick, onHover, size = 90, flipped = false }) {
  const hp = c.hp === '' ? 0 : toInt(c.hp, 0);
  const max = c.maxHP === '' ? 0 : toInt(c.maxHP, 0);
  const pct = max > 0 ? (hp / max) * 100 : 100;

  const EnemyRender = ENEMY_TYPES.find(e => e.key === c.enemyType)?.Render || GoblinSVG;
  const pcColor = PC_COLORS[c.pcColorIndex % PC_COLORS.length];

  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      title={`${c.name} — Click to edit`}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        cursor: 'pointer', userSelect: 'none',
        opacity: c.dead ? 0.30 : 1,
        filter: c.dead ? 'grayscale(0.9)' : 'none',
        transition: 'opacity 300ms, filter 300ms',
        position: 'relative',
      }}
    >
      {/* Active turn glow ring */}
      {isActive && (
        <div style={{
          position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)',
          width: size + 16, height: size + 16, borderRadius: '50%',
          background: 'transparent',
          boxShadow: c.side === 'Enemy'
            ? '0 0 0 3px rgba(220,60,60,0.90), 0 0 22px rgba(220,60,60,0.55)'
            : '0 0 0 3px rgba(255,210,80,0.90), 0 0 22px rgba(255,210,80,0.45)',
          borderRadius: 999,
          animation: 'pulse 1.6s ease-in-out infinite',
          zIndex: 1,
        }} />
      )}

      {/* Token circle / image */}
      <div style={{
        width: size, height: size, borderRadius: '50%', overflow: 'hidden',
        border: isSelected
          ? '3px solid rgba(255,210,80,0.95)'
          : isActive
          ? '3px solid rgba(255,255,255,0.55)'
          : `2px solid ${c.side === 'Enemy' ? 'rgba(200,60,60,0.45)' : 'rgba(80,160,120,0.45)'}`,
        background: c.side === 'Enemy'
          ? 'radial-gradient(circle at 40% 35%, rgba(60,20,20,0.95), rgba(20,8,8,0.98))'
          : 'radial-gradient(circle at 40% 35%, rgba(20,30,50,0.95), rgba(8,12,22,0.98))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: c.side === 'Enemy'
          ? '0 6px 20px rgba(0,0,0,0.75), inset 0 0 20px rgba(180,40,40,0.15)'
          : '0 6px 20px rgba(0,0,0,0.75), inset 0 0 20px rgba(60,120,200,0.12)',
        position: 'relative', zIndex: 2,
        transform: flipped ? 'scaleX(-1)' : 'none',
        flexShrink: 0,
      }}>
        {c.customImage ? (
          <img src={c.customImage} alt={c.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover',
              transform: flipped ? 'scaleX(-1)' : 'none' }} />
        ) : c.side === 'Enemy' ? (
          <EnemyRender size={size * 0.72} />
        ) : (
          <HeroSVG color={pcColor} size={size * 0.72} />
        )}
      </div>

      {/* Name tag + status */}
      <div style={{
        background: isActive ? 'rgba(255,210,80,0.18)' : 'rgba(0,0,0,0.68)',
        border: `1px solid ${isActive ? 'rgba(255,210,80,0.40)' : 'rgba(255,255,255,0.10)'}`,
        backdropFilter: 'blur(10px)',
        borderRadius: 8, padding: '3px 8px 4px', zIndex: 3,
        maxWidth: size + 30, textAlign: 'center',
      }}>
        <div style={{
          color: c.dead ? 'rgba(200,150,150,0.70)' : 'var(--koa-cream)',
          fontWeight: 950, fontSize: 10, whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: size + 20,
          textDecoration: c.dead ? 'line-through' : 'none',
        }}>{c.name}</div>
        {/* HP bar */}
        <div style={{ height: 2, borderRadius: 999, background: 'rgba(255,255,255,0.10)', marginTop: 2, overflow: 'hidden', width: '100%' }}>
          <div style={{ height: '100%', width: `${clamp(pct, 0, 100)}%`, background: hpGradient(pct), borderRadius: 999 }} />
        </div>
        {/* Status badges */}
        {c.status && c.status.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center', marginTop: 3 }}>
            {c.status.slice(0, 4).map(s => (
              <span key={s} style={{
                fontSize: 8, fontWeight: 950, letterSpacing: '0.06em',
                padding: '1px 4px', borderRadius: 4,
                background: 'rgba(180,120,20,0.35)',
                border: '1px solid rgba(255,200,80,0.30)',
                color: 'rgba(255,220,120,0.92)',
                whiteSpace: 'nowrap',
              }}>{s}</span>
            ))}
            {c.status.length > 4 && (
              <span style={{ fontSize: 8, color: 'rgba(255,220,120,0.60)', fontWeight: 900 }}>+{c.status.length - 4}</span>
            )}
          </div>
        )}
        {/* Concentration indicator */}
        {c.concentration && (
          <div style={{
            marginTop: 2, fontSize: 8, fontWeight: 950, letterSpacing: '0.06em',
            color: 'rgba(160,200,255,0.85)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: size + 20,
          }}>⚬ {c.concentration}</div>
        )}
      </div>

      {/* Dead skull */}
      {c.dead && (
        <div style={{
          position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
          fontSize: size * 0.35, zIndex: 5, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.80))',
        }}>💀</div>
      )}
    </div>
  );
}

// ── Battlefield Scene ──────────────────────────────────────────────────────
function BattlefieldScene({ combatants, activeCombatantId, selectedId, openEditorFor, playHover, playNav }) {
  const pcs    = combatants.filter(c => c.side === 'PC' || c.side === 'Ally');
  const enemies = combatants.filter(c => c.side === 'Enemy');

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: 14,
      background: 'linear-gradient(180deg, rgba(8,6,4,0.30) 0%, rgba(0,0,0,0) 40%)',
    }}>
      {/* Ground plane perspective lines */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }} viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice">
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
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2, flexDirection: 'column', gap: 10,
          color: 'rgba(255,245,220,0.40)', fontWeight: 900, textAlign: 'center',
        }}>
          <div style={{ fontSize: 44, opacity: 0.3 }}>⚔️</div>
          <div style={{ fontSize: 13 }}>Add combatants to see the battlefield</div>
        </div>
      )}

      {/* ENEMIES — upper half, facing toward us, spread horizontally */}
      {enemies.length > 0 && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '6%',
          display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
          gap: Math.max(8, 60 - enemies.length * 6),
          flexWrap: 'wrap', padding: '0 40px', zIndex: 3,
        }}>
          {enemies.map((c, i) => {
            const scale = 0.72 + (enemies.length <= 2 ? 0.22 : enemies.length <= 4 ? 0.12 : 0);
            const tokenSize = Math.round(74 * scale);
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
        <div style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
          zIndex: 4, color: 'rgba(255,210,80,0.22)', fontWeight: 950, fontSize: 28, letterSpacing: 6,
          textShadow: '0 0 20px rgba(255,180,40,0.30)', userSelect: 'none', pointerEvents: 'none',
        }}>VS</div>
      )}

      {/* PCs — lower half, facing away (backs shown), larger (closer) */}
      {pcs.length > 0 && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: '10%',
          display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
          gap: Math.max(10, 64 - pcs.length * 6),
          flexWrap: 'wrap', padding: '0 40px', zIndex: 3,
        }}>
          {pcs.map((c, i) => {
            const scale = 0.85 + (pcs.length <= 2 ? 0.28 : pcs.length <= 4 ? 0.14 : 0);
            const tokenSize = Math.round(88 * scale);
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

      {/* Pulse keyframe injected once */}
      <style>{`
        @keyframes pulse {
          0%,100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function CombatPanel({ panelType, cinematicNav, playNav = () => {}, playHover = () => {} }) {
  const active = panelType === 'combat';

  const [encounter, setEncounter] = useState(() => normalize(loadState()) || defaultEncounter());
  const [selectedId, setSelectedId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [draft, setDraft] = useState({ name:'', role:'', side:'Enemy', init:'10', hp:'', maxHP:'', ac:'', enemyType:'goblin' });
  const [adventurerPick, setAdventurerPick] = useState(ADVENTURERS[0]?.name || '');
  const [adventurerSide, setAdventurerSide] = useState('PC');

  const hydrated = useRef(false);
  useEffect(() => {
    if (!hydrated.current) { hydrated.current = true; return; }
    saveState(encounter);
  }, [encounter]);

  const combatants = encounter.combatants;
  const selected = useMemo(() => combatants.find(c => c.id === selectedId) || null, [combatants, selectedId]);
  const activeCombatantId = combatants[encounter.activeIndex]?.id || null;
  // pcDock removed — bottom cards replaced by battlefield tokens

  const sortByInitiative = () => {
    setEncounter(prev => {
      const next = normalize(prev);
      next.combatants = [...next.combatants].sort((a, b) => {
        const di = toInt(b.init,0) - toInt(a.init,0);
        if (di !== 0) return di;
        const sr = sideRank(a.side) - sideRank(b.side);
        if (sr !== 0) return sr;
        return String(a.name).localeCompare(String(b.name));
      });
      next.activeIndex = clamp(next.activeIndex, 0, Math.max(0, next.combatants.length - 1));
      return next;
    });
  };

  const addCombatant = (c) => {
    setEncounter(prev => { const next = normalize(prev); next.combatants = [...next.combatants, c]; return next; });
    setSelectedId(c.id);
  };

  const addFromDraft = () => {
    const name = String(draft.name || '').trim();
    if (!name) return;
    addCombatant({
      id: uid(), name, role: String(draft.role||'').trim(), side: draft.side||'Enemy',
      init: toInt(draft.init,10),
      hp: draft.hp==='' ? '' : toInt(draft.hp,0),
      maxHP: draft.maxHP==='' ? '' : toInt(draft.maxHP,0),
      ac: draft.ac==='' ? '' : toInt(draft.ac,0),
      tempHP:0, status:[], concentration:'', notes:'', dead:false,
      enemyType: draft.enemyType || 'goblin', customImage:'',
      pcColorIndex: combatants.length % PC_COLORS.length,
    });
    setDraft(d => ({ ...d, name:'', role:'' }));
  };

  const addAdventurer = () => {
    const adv = ADVENTURERS.find(a => a.name === adventurerPick);
    if (!adv) return;
    const existingNames = new Set(combatants.map(x => x.name));
    addCombatant({
      id: uid(), name: uniqueName(existingNames, adv.name), role: adv.role,
      side: adventurerSide, init:10, hp: adv.hp, maxHP: adv.maxHP, ac: adv.ac,
      tempHP:0, status:[], concentration:'', notes:'', dead:false,
      enemyType:'goblin', customImage:'',
      pcColorIndex: combatants.length % PC_COLORS.length,
    });
  };

  const removeCombatant = (id) => {
    setEncounter(prev => {
      const next = normalize(prev);
      const idx = next.combatants.findIndex(x => x.id === id);
      next.combatants = next.combatants.filter(x => x.id !== id);
      if (next.combatants.length === 0) next.activeIndex = 0;
      else if (idx >= 0) next.activeIndex = clamp(next.activeIndex, 0, next.combatants.length - 1);
      return next;
    });
    if (selectedId === id) { setSelectedId(null); setEditorOpen(false); }
  };

  const toggleDead = (id) => {
    setEncounter(prev => {
      const next = normalize(prev);
      next.combatants = next.combatants.map(x => x.id === id ? { ...x, dead: !x.dead } : x);
      return next;
    });
  };

  const gotoNext = () => {
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
    if (!selected) return;
    setEncounter(prev => {
      const next = normalize(prev);
      next.combatants = next.combatants.map(x => x.id === selected.id ? { ...x, ...patch } : x);
      return next;
    });
  };

  const bumpHP = (delta) => {
    if (!selected) return;
    const cur = selected.hp==='' ? 0 : toInt(selected.hp,0);
    const max = selected.maxHP==='' ? null : toInt(selected.maxHP,0);
    let nxt = cur + delta;
    if (max != null) nxt = clamp(nxt, 0, max); else nxt = Math.max(0, nxt);
    setSelectedField({ hp: nxt });
  };

  const resetEncounter = () => {
    setEncounter(prev => {
      const next = normalize(prev);
      next.round=1; next.activeIndex=0;
      next.combatants = next.combatants.map(x => ({ ...x, dead:false, status:[], concentration:'', tempHP:0, notes:'' }));
      return next;
    });
  };

  const clearEncounter = () => { setEncounter(defaultEncounter()); setSelectedId(null); setEditorOpen(false); };
  const openEditorFor = (id) => { setSelectedId(id); setEditorOpen(true); };

  // image upload helper
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    const reader = new FileReader();
    reader.onload = (ev) => setSelectedField({ customImage: ev.target.result });
    reader.readAsDataURL(file);
  };

  // ── Dimensions ─────────────────────────────────────────────────────────────
  const HUD_H  = 60;
  const PAD    = 14;

  // ── Shared micro-styles ────────────────────────────────────────────────────
  const inp = {
    width:'100%', boxSizing:'border-box', padding:'8px 10px', borderRadius:10,
    border:'1px solid rgba(255,220,160,0.14)', background:'rgba(0,0,0,0.42)',
    color:'var(--koa-cream)', outline:'none', fontFamily:fontStack, fontSize:13,
  };
  const lbl = {
    color:'rgba(255,220,160,0.60)', fontSize:10, fontWeight:950,
    letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:5, userSelect:'none',
  };
  const btn = (v='gold') => ({
    height:40, padding:'0 14px', borderRadius:12, border:'1px solid rgba(255,220,160,0.20)',
    background: v==='danger'
      ? 'linear-gradient(180deg,var(--koa-danger-a),var(--koa-danger-b))'
      : 'linear-gradient(180deg,var(--koa-gold-a),var(--koa-gold-b))',
    color:'var(--koa-cream)', fontWeight:950, cursor:'pointer', boxShadow:'0 6px 18px rgba(0,0,0,0.40)',
    textShadow:'0 2px 6px rgba(0,0,0,0.55)', userSelect:'none', whiteSpace:'nowrap',
    fontFamily:fontStack, fontSize:13, letterSpacing:0.3,
  });
  const sBtn = (v='gold') => ({
    height:28, padding:'0 9px', borderRadius:8, border:'1px solid rgba(255,220,160,0.14)',
    background: v==='danger'
      ? 'linear-gradient(180deg,var(--koa-danger-a),var(--koa-danger-b))'
      : 'linear-gradient(180deg,rgba(160,90,0,0.82),rgba(110,50,0,0.90))',
    color:'var(--koa-cream)', fontWeight:950, fontSize:11, cursor:'pointer',
    userSelect:'none', whiteSpace:'nowrap', fontFamily:fontStack,
  });
  const glass = {
    borderRadius:16, border:'1px solid rgba(255,220,160,0.11)',
    background:'linear-gradient(180deg,rgba(8,6,4,0.74),rgba(4,3,2,0.56))',
    backdropFilter:'blur(12px)', boxShadow:'0 16px 40px rgba(0,0,0,0.52)',
  };
  const modalBack = {
    position:'absolute', inset:0, background:'rgba(0,0,0,0.68)',
    display:'flex', alignItems:'center', justifyContent:'center', padding:14, zIndex:20,
  };
  const divider = {
    height:1, background:'linear-gradient(to right,transparent,rgba(255,220,160,0.13),transparent)',
    margin:'12px 0',
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ShellLayout active={active} style={{ fontFamily:fontStack }}>
      <div style={{
        width:'min(1680px,99vw)', height:'min(1040px,96vh)', borderRadius:18,
        overflow:'hidden', position:'relative', border:'1px solid var(--koa-line-strong)',
        boxShadow:'0 26px 70px rgba(0,0,0,0.64)', background:'var(--koa-shell-bg)', fontFamily:fontStack,
      }}>
        {/* Vignette overlay */}
        <div style={{
          position:'absolute', inset:0, pointerEvents:'none',
          background:'radial-gradient(1000px 580px at 32% 20%,rgba(255,245,220,0.05),transparent 60%),linear-gradient(180deg,rgba(0,0,0,0.45),rgba(0,0,0,0.78))',
        }}/>

        {/* ── HEADER ── */}
        <div style={{
          position:'absolute', left:PAD, right:PAD, top:PAD, height:HUD_H,
          display:'grid', gridTemplateColumns:'200px 1fr 200px', alignItems:'center', gap:10,
          padding:'0 14px', borderRadius:16, border:'1px solid rgba(255,220,160,0.09)',
          background:'linear-gradient(180deg,rgba(18,14,10,0.85),rgba(10,8,6,0.65))',
          backdropFilter:'blur(12px)', boxShadow:'0 12px 26px rgba(0,0,0,0.42)', zIndex:8,
        }}>
          <div style={{ userSelect:'none' }}>
            <div style={{ color:'var(--koa-cream)', fontWeight:950, fontSize:16, letterSpacing:0.4 }}>Combat Tracker</div>
            <div style={{ color:'rgba(255,220,160,0.52)', fontWeight:900, fontSize:10, letterSpacing:'0.20em', textTransform:'uppercase', marginTop:2 }}>
              Initiative • HP • Status
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            <div style={{
              height:40, padding:'0 16px', borderRadius:999, border:'1px solid rgba(255,220,160,0.12)',
              background:'rgba(0,0,0,0.28)', color:'var(--koa-cream)',
              display:'inline-flex', alignItems:'center', gap:10, userSelect:'none',
            }}>
              <span style={{ color:'rgba(255,220,160,0.65)', fontSize:10, textTransform:'uppercase', letterSpacing:'0.18em' }}>Round</span>
              <span style={{ fontSize:20, fontWeight:950 }}>{encounter.round}</span>
            </div>
            <button style={btn('gold')} onMouseEnter={playHover} onClick={() => { playNav(); gotoPrev(); }}>◀ Prev</button>
            <button style={btn('gold')} onMouseEnter={playHover} onClick={() => { playNav(); gotoNext(); }}>Next ▶</button>
            <button style={btn('gold')} onMouseEnter={playHover} onClick={() => { playNav(); sortByInitiative(); }}>Sort</button>
            <button style={btn('danger')} onMouseEnter={playHover} onClick={() => { playNav(); cinematicNav('menu'); }}>Back</button>
          </div>
          <div/>
        </div>

        {/* ── MAIN LAYOUT — battlefield fills all space below header ── */}
        <div style={{
          position:'absolute', left:PAD, right:PAD,
          top: PAD + HUD_H + 10,
          bottom: PAD,
          display:'grid', gridTemplateColumns:'250px 1fr', gap:12, zIndex:4, minHeight:0,
        }}>

          {/* ── LEFT: Initiative list ── */}
          <div style={{ ...glass, overflow:'hidden', display:'flex', flexDirection:'column' }}>
            {/* Header — nowrap to prevent button cutoff */}
            <div style={{
              padding:'8px 8px', flexShrink:0,
              borderBottom:'1px solid rgba(255,220,160,0.08)',
              display:'flex', alignItems:'center', justifyContent:'space-between', gap:5,
              flexWrap:'nowrap',
            }}>
              <div style={{ color:'rgba(255,245,220,0.78)', fontWeight:950, fontSize:11, letterSpacing:'0.10em', textTransform:'uppercase', userSelect:'none', whiteSpace:'nowrap' }}>
                Initiative
              </div>
              {/* Buttons in a row that won't wrap or clip */}
              <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                <button style={sBtn('gold')}   onMouseEnter={playHover} onClick={() => { playNav(); setAddModalOpen(true); }}>+ Add</button>
                <button style={sBtn('gold')}   onMouseEnter={playHover} onClick={() => { playNav(); resetEncounter(); }}>Reset</button>
                <button style={sBtn('danger')} onMouseEnter={playHover} onClick={() => { playNav(); clearEncounter(); }}>Clear</button>
              </div>
            </div>

            {/* Rows */}
            <div style={{ flex:1, overflowY:'auto', padding:'5px 6px', display:'flex', flexDirection:'column', gap:3 }}>
              {combatants.length === 0 ? (
                <div style={{ color:'rgba(255,245,220,0.40)', fontWeight:900, fontSize:12, lineHeight:1.9, padding:'10px 6px' }}>
                  Click <b style={{ color:'rgba(255,220,160,0.72)' }}>+ Add</b> to begin.
                </div>
              ) : combatants.map(c => {
                const isActive   = c.id === activeCombatantId;
                const isSelected = c.id === selectedId;
                const hp  = c.hp   === '' ? 0 : toInt(c.hp, 0);
                const max = c.maxHP === '' ? 0 : toInt(c.maxHP, 0);
                const pct = max > 0 ? (hp / max) * 100 : 100;

                return (
                  <div key={c.id}
                    onClick={() => openEditorFor(c.id)}
                    onMouseEnter={playHover}
                    style={{
                      borderRadius:9,
                      border:`1px solid ${isActive ? 'rgba(255,210,130,0.38)' : isSelected ? 'rgba(255,210,130,0.16)' : 'rgba(255,255,255,0.05)'}`,
                      background: isActive ? 'rgba(176,101,0,0.12)' : 'rgba(255,255,255,0.022)',
                      padding:'6px 7px', cursor:'pointer', opacity: c.dead ? 0.38 : 1,
                      display:'flex', alignItems:'center', gap:7,
                    }}
                  >
                    <div style={{
                      width:24, height:24, borderRadius:7, flexShrink:0,
                      background: sideBg(c.side),
                      display:'flex', alignItems:'center', justifyContent:'center',
                      color:'#fff', fontWeight:950, fontSize:11,
                      border:'1px solid rgba(255,255,255,0.10)',
                    }}>{c.init}</div>

                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:4 }}>
                        <div style={{
                          color: c.dead ? 'rgba(255,180,180,0.48)' : 'var(--koa-cream)',
                          fontWeight:950, fontSize:12,
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                          textDecoration: c.dead ? 'line-through' : 'none',
                        }}>
                          {isActive && <span style={{ color:'rgba(255,220,100,0.95)', fontSize:9, marginRight:4 }}>▶</span>}
                          {c.name}
                        </div>
                        <span style={{ fontSize:10, color:'rgba(255,245,220,0.40)', fontWeight:900, flexShrink:0 }}>
                          {c.hp==='' ? '—' : c.hp}{max ? `/${max}` : ''}
                        </span>
                      </div>
                      <div style={{ marginTop:4, height:2, borderRadius:999, background:'rgba(255,255,255,0.07)', overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${clamp(pct,0,100)}%`, background:hpGradient(pct), borderRadius:999, transition:'width 280ms ease' }}/>
                      </div>
                    </div>

                    <div style={{ display:'flex', gap:3, flexShrink:0 }}>
                      <button title={c.dead?'Revive':'Mark dead'}
                        onClick={e => { e.stopPropagation(); playNav(); toggleDead(c.id); }}
                        style={{ width:20, height:20, borderRadius:5, border:'none', padding:0,
                          background: c.dead ? 'rgba(160,40,40,0.50)' : 'rgba(255,255,255,0.07)',
                          color:'rgba(255,220,160,0.62)', cursor:'pointer', fontSize:10,
                          display:'flex', alignItems:'center', justifyContent:'center' }}>☠</button>
                      <button title="Remove"
                        onClick={e => { e.stopPropagation(); playNav(); removeCombatant(c.id); }}
                        style={{ width:20, height:20, borderRadius:5, border:'none', padding:0,
                          background:'rgba(255,255,255,0.07)', color:'rgba(255,220,160,0.62)',
                          cursor:'pointer', fontSize:10,
                          display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── CENTER: Visual Battlefield ── */}
          <div style={{ ...glass, overflow:'hidden', position:'relative' }}>
            <BattlefieldScene
              combatants={combatants}
              activeCombatantId={activeCombatantId}
              selectedId={selectedId}
              openEditorFor={openEditorFor}
              playHover={playHover}
              playNav={playNav}
            />
          </div>
        </div>

        {/* ── ADD MODAL ── */}
        {addModalOpen && (
          <div style={modalBack} onMouseDown={e => { if (e.target===e.currentTarget) setAddModalOpen(false); }}>
            <div style={{
              width:'min(840px,96vw)', maxHeight:'90vh', borderRadius:18, overflow:'hidden',
              border:'1px solid rgba(255,220,160,0.15)',
              background:'linear-gradient(180deg,rgba(10,8,6,0.97),rgba(4,3,2,0.90))',
              backdropFilter:'blur(18px)', boxShadow:'0 28px 72px rgba(0,0,0,0.78)',
              display:'flex', flexDirection:'column',
            }}>
              <div style={{ padding:'0 16px', height:52, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid rgba(255,220,160,0.09)' }}>
                <div style={{ color:'var(--koa-cream)', fontWeight:950, letterSpacing:0.4, userSelect:'none' }}>Add Combatants</div>
                <button style={sBtn('danger')} onMouseEnter={playHover} onClick={() => { playNav(); setAddModalOpen(false); }}>Close</button>
              </div>

              <div style={{ padding:20, overflowY:'auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:26 }}>
                {/* Add Adventurer */}
                <div>
                  <div style={{ color:'rgba(255,245,220,0.84)', fontWeight:950, fontSize:13, marginBottom:14, paddingBottom:8, borderBottom:'1px solid rgba(255,220,160,0.09)' }}>Add Adventurer</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 85px', gap:10, marginBottom:12 }}>
                    <div><div style={lbl}>Adventurer</div>
                      <select style={{ ...inp, cursor:'pointer' }} value={adventurerPick} onChange={e => setAdventurerPick(e.target.value)}>
                        {ADVENTURERS.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                      </select>
                    </div>
                    <div><div style={lbl}>Side</div>
                      <select style={{ ...inp, cursor:'pointer' }} value={adventurerSide} onChange={e => setAdventurerSide(e.target.value)}>
                        <option value="PC">PC</option><option value="Ally">Ally</option>
                      </select>
                    </div>
                  </div>
                  {(() => { const adv = ADVENTURERS.find(a => a.name===adventurerPick); return adv ? (
                    <div style={{ padding:'9px 12px', borderRadius:10, border:'1px solid rgba(255,220,160,0.10)', background:'rgba(0,0,0,0.28)', marginBottom:14, fontSize:12, color:'rgba(255,245,220,0.68)', fontWeight:900, lineHeight:1.7 }}>
                      <div style={{ color:'var(--koa-cream)', fontWeight:950 }}>{adv.name}</div>
                      <div>{adv.role} · HP {adv.hp}/{adv.maxHP} · AC {adv.ac}</div>
                    </div>
                  ) : null; })()}
                  <button style={{ ...btn('gold'), width:'100%' }} onMouseEnter={playHover} onClick={() => { playNav(); addAdventurer(); }}>+ Add Adventurer</button>
                </div>

                {/* Add Custom */}
                <div>
                  <div style={{ color:'rgba(255,245,220,0.84)', fontWeight:950, fontSize:13, marginBottom:14, paddingBottom:8, borderBottom:'1px solid rgba(255,220,160,0.09)' }}>Add Custom (Enemies / Extras)</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 65px', gap:10, marginBottom:10 }}>
                    <div><div style={lbl}>Name</div>
                      <input style={inp} value={draft.name} placeholder="Goblin / Skeleton #2"
                        onChange={e => setDraft(d => ({ ...d, name:e.target.value }))}
                        onKeyDown={e => { if (e.key==='Enter') addFromDraft(); }}/>
                    </div>
                    <div><div style={lbl}>Init</div>
                      <input style={inp} value={draft.init} onChange={e => setDraft(d => ({ ...d, init:e.target.value }))}/>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
                    <div><div style={lbl}>Side</div>
                      <select style={{ ...inp, cursor:'pointer' }} value={draft.side} onChange={e => setDraft(d => ({ ...d, side:e.target.value }))}>
                        <option value="Enemy">Enemy</option><option value="PC">PC</option><option value="Ally">Ally</option>
                      </select>
                    </div>
                    <div><div style={lbl}>HP</div>
                      <input style={inp} value={draft.hp} onChange={e => setDraft(d => ({ ...d, hp:e.target.value }))}/>
                    </div>
                    <div><div style={lbl}>Max HP</div>
                      <input style={inp} value={draft.maxHP} onChange={e => setDraft(d => ({ ...d, maxHP:e.target.value }))}/>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                    <div><div style={lbl}>AC</div>
                      <input style={inp} value={draft.ac} onChange={e => setDraft(d => ({ ...d, ac:e.target.value }))}/>
                    </div>
                    <div><div style={lbl}>Role</div>
                      <input style={inp} value={draft.role} placeholder="Scout / Brute…" onChange={e => setDraft(d => ({ ...d, role:e.target.value }))}/>
                    </div>
                  </div>
                  {/* Enemy type picker (only shown for Enemy side) */}
                  {draft.side === 'Enemy' && (
                    <div style={{ marginBottom:14 }}>
                      <div style={lbl}>Enemy Type</div>
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        {ENEMY_TYPES.map(et => (
                          <button key={et.key}
                            onClick={() => setDraft(d => ({ ...d, enemyType:et.key }))}
                            style={{
                              padding:'4px 10px', borderRadius:8, cursor:'pointer', fontFamily:fontStack,
                              fontSize:11, fontWeight:950,
                              border:`1px solid ${draft.enemyType===et.key ? 'rgba(255,210,80,0.60)' : 'rgba(255,255,255,0.10)'}`,
                              background: draft.enemyType===et.key ? 'rgba(176,101,0,0.30)' : 'rgba(255,255,255,0.05)',
                              color: draft.enemyType===et.key ? 'rgba(255,220,140,0.95)' : 'rgba(255,245,220,0.65)',
                            }}>{et.label}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button style={{ ...btn('gold'), width:'100%' }} onMouseEnter={playHover} onClick={() => { playNav(); addFromDraft(); }}>+ Add Custom</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── EDITOR MODAL ── */}
        {editorOpen && selected && (
          <div style={modalBack} onMouseDown={e => { if (e.target===e.currentTarget) setEditorOpen(false); }}>
            <div style={{
              width:'min(960px,96vw)', maxHeight:'90vh', borderRadius:18, overflow:'hidden',
              border:'1px solid rgba(255,220,160,0.15)',
              background:'linear-gradient(180deg,rgba(8,6,4,0.97),rgba(4,3,2,0.88))',
              backdropFilter:'blur(14px)', boxShadow:'0 26px 70px rgba(0,0,0,0.76)',
              display:'grid', gridTemplateRows:'52px 1fr',
            }}>
              <div style={{ padding:'0 14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, borderBottom:'1px solid rgba(255,220,160,0.09)' }}>
                <div style={{ color:'var(--koa-cream)', fontWeight:950, userSelect:'none' }}>
                  Editing: <span style={{ color:'rgba(255,220,160,0.88)' }}>{selected.name}</span>
                </div>
                <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                  {[-10,-5,-1,+1,+5].map(d => (
                    <button key={d} style={sBtn('gold')} onMouseEnter={playHover} onClick={() => { playNav(); bumpHP(d); }}>
                      {d>0?`+${d}`:d}
                    </button>
                  ))}
                  <div style={{ width:1, height:20, background:'rgba(255,220,160,0.15)', margin:'0 2px' }}/>       
                  <button style={sBtn('danger')} onMouseEnter={playHover} onClick={() => { playNav(); setEditorOpen(false); }}>✕</button>
                </div>
              </div>

              <div style={{ padding:14, overflowY:'auto' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div><div style={lbl}>Name</div><input style={inp} value={selected.name} onChange={e => setSelectedField({ name:e.target.value })}/></div>
                  <div><div style={lbl}>Role / Class</div><input style={inp} value={selected.role} onChange={e => setSelectedField({ role:e.target.value })}/></div>
                  <div><div style={lbl}>Side</div>
                    <select style={{ ...inp, cursor:'pointer' }} value={selected.side} onChange={e => setSelectedField({ side:e.target.value })}>
                      <option value="Enemy">Enemy</option><option value="PC">PC</option><option value="Ally">Ally</option>
                    </select>
                  </div>
                  <div><div style={lbl}>Initiative</div><input style={inp} value={selected.init} onChange={e => setSelectedField({ init:toInt(e.target.value,0) })}/></div>
                  <div><div style={lbl}>HP</div><input style={inp} value={selected.hp} onChange={e => setSelectedField({ hp:e.target.value===''?'':toInt(e.target.value,0) })}/></div>
                  <div><div style={lbl}>Max HP</div><input style={inp} value={selected.maxHP} onChange={e => setSelectedField({ maxHP:e.target.value===''?'':toInt(e.target.value,0) })}/></div>
                  <div><div style={lbl}>Temp HP</div><input style={inp} value={selected.tempHP} onChange={e => setSelectedField({ tempHP:toInt(e.target.value,0) })}/></div>
                  <div><div style={lbl}>AC</div><input style={inp} value={selected.ac} onChange={e => setSelectedField({ ac:e.target.value===''?'':toInt(e.target.value,0) })}/></div>
                </div>

                <div style={divider}/>

                {/* Appearance section */}
                <div style={{ marginBottom:10 }}>
                  <div style={{ color:'rgba(255,245,220,0.80)', fontWeight:950, fontSize:12, marginBottom:10, letterSpacing:0.3 }}>Appearance</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    {selected.side === 'Enemy' && (
                      <div>
                        <div style={lbl}>Enemy Type</div>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                          {ENEMY_TYPES.map(et => (
                            <button key={et.key}
                              onClick={() => setSelectedField({ enemyType:et.key, customImage:'' })}
                              style={{
                                padding:'3px 9px', borderRadius:7, cursor:'pointer', fontFamily:fontStack, fontSize:11, fontWeight:950,
                                border:`1px solid ${selected.enemyType===et.key ? 'rgba(255,210,80,0.60)' : 'rgba(255,255,255,0.10)'}`,
                                background: selected.enemyType===et.key ? 'rgba(176,101,0,0.30)' : 'rgba(255,255,255,0.05)',
                                color: selected.enemyType===et.key ? 'rgba(255,220,140,0.95)' : 'rgba(255,245,220,0.60)',
                              }}>{et.label}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <div style={lbl}>Custom Image</div>
                      <label style={{
                        display:'inline-block', padding:'5px 12px', borderRadius:8,
                        background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,220,160,0.14)',
                        color:'rgba(255,245,220,0.75)', fontSize:11, fontWeight:950, cursor:'pointer',
                        fontFamily:fontStack, userSelect:'none',
                      }}>
                        Upload Image
                        <input type="file" accept="image/*" style={{ display:'none' }} onChange={handleImageUpload}/>
                      </label>
                      {selected.customImage && (
                        <button onClick={() => setSelectedField({ customImage:'' })}
                          style={{ marginLeft:8, padding:'5px 10px', borderRadius:8, border:'none',
                            background:'rgba(180,40,40,0.40)', color:'rgba(255,200,200,0.90)',
                            cursor:'pointer', fontSize:11, fontFamily:fontStack }}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div style={divider}/>

                <div><div style={lbl}>Status (comma separated)</div>
                  <input style={inp} value={selected.status.join(', ')} placeholder="Poisoned, Grappled, Bless"
                    onChange={e => setSelectedField({ status: String(e.target.value||'').split(',').map(s=>s.trim()).filter(Boolean) })}/>
                </div>
                <div style={{ marginTop:10 }}><div style={lbl}>Concentration</div>
                  <input style={inp} value={selected.concentration} placeholder="Bless / Hold Person / Hex..." onChange={e => setSelectedField({ concentration:e.target.value })}/>
                </div>
                <div style={{ marginTop:10 }}><div style={lbl}>Notes</div>
                  <textarea style={{ ...inp, minHeight:130, resize:'vertical' }} value={selected.notes}
                    placeholder="Tactics, resistances, legendary uses..." onChange={e => setSelectedField({ notes:e.target.value })}/>
                </div>

                <div style={divider}/>
                <div style={{ display:'flex', gap:10 }}>
				<button style={sBtn('danger')} onMouseEnter={playHover} onClick={() => { playNav(); removeCombatant(selected.id); }}>
                    Remove
                  </button>
                  <button style={sBtn('gold')} onMouseEnter={playHover} onClick={() => { playNav(); toggleDead(selected.id); }}>
                    {selected.dead ? 'Revive' : 'Mark Dead'}
                  </button>
				  <div style={{ width:1, height:20, background:'rgba(255,220,160,0.15)', margin:'0 2px' }}/>
				  <button style={sBtn('gold')} onMouseEnter={playHover} onClick={() => { playNav(); setEditorOpen(false); }}>
                    ✓ Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ShellLayout>
  );
}
