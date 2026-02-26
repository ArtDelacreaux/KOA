// ===== COMBAT PANEL — with Battle Background Selector =====
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ShellLayout from './ShellLayout';
import styles from './CombatPanel.module.css';

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

const LS_KEY = 'koa:combat:v4';
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
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
export default function CombatPanel({ panelType, cinematicNav, characters = [], playNav = () => {}, playHover = () => {} }) {

  // ✅ Adventurers are now derived from the shared Character Book roster (single source of truth)
  const adventurers = useMemo(() => {
    return (characters || [])
      .filter((c) => c && c.combat)
      .map((c) => ({
        name: c.name,
        role: c.role || c.class || '',
        ac: typeof c.ac === 'number' ? c.ac : 0,
        hp: typeof c.hp === 'number' ? c.hp : 0,
        maxHP: typeof c.maxHP === 'number' ? c.maxHP : (typeof c.hp === 'number' ? c.hp : 0),
      }));
  }, [characters]);

  const active = panelType === 'combat';

  const [encounter, setEncounter] = useState(() => normalize(loadState()) || defaultEncounter());
  const [selectedId, setSelectedId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [draft, setDraft] = useState({ name:'', role:'', side:'Enemy', init:'10', hp:'', maxHP:'', ac:'', enemyType:'goblin' });
  const [adventurerPick, setAdventurerPick] = useState(() => adventurers[0]?.name || '');

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

  useEffect(() => {
    const anyModalOpen = cropOpen || addModalOpen || editorOpen;
    if (!anyModalOpen) return;

    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (cropOpen) {
        setCropOpen(false);
        return;
      }
      if (addModalOpen) {
        setAddModalOpen(false);
        return;
      }
      if (editorOpen) {
        setEditorOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cropOpen, addModalOpen, editorOpen]);

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
    if (!hydrated.current) { hydrated.current = true; return; }
    saveState(encounter);
  }, [encounter]);

  const combatants = encounter.combatants;
  const selected = useMemo(() => combatants.find(c => c.id === selectedId) || null, [combatants, selectedId]);
  const activeCombatantId = combatants[encounter.activeIndex]?.id || null;

  const addCombatant = (c) => {
    setEncounter(prev => {
      const next = normalize(prev);
      const activeId = next.combatants[next.activeIndex]?.id || null;
      next.combatants = sortCombatants([...next.combatants, c]);
      if (next.combatants.length === 0) next.activeIndex = 0;
      else if (activeId) {
        const idx = next.combatants.findIndex(x => x.id === activeId);
        next.activeIndex = idx >= 0 ? idx : clamp(next.activeIndex, 0, next.combatants.length - 1);
      } else {
        next.activeIndex = clamp(next.activeIndex, 0, next.combatants.length - 1);
      }
      return next;
    });
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
    const adv = adventurers.find(a => a.name === adventurerPick);
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
      const activeId = next.combatants[next.activeIndex]?.id || null;
      next.combatants = next.combatants.map(x => x.id === selected.id ? { ...x, ...patch } : x);
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

  // image upload — opens crop modal instead of applying directly
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
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
              onClick={() => { playNav(); cinematicNav('menu'); }}
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
                <button
                  className={btnClass('gold')}
                  onMouseEnter={playHover}
                  onClick={() => { playNav(); gotoPrev(); }}
                >
                  ◀ Prev
                </button>
                <div className={styles.roundBadge}>
                  <span className={styles.roundLabel}>Round</span>
                  <span className={styles.roundValue}>{encounter.round}</span>
                </div>
                <button
                  className={btnClass('gold')}
                  onMouseEnter={playHover}
                  onClick={() => { playNav(); gotoNext(); }}
                >
                  Next ▶
                </button>
              </div>

            <div className={styles.controlsRight}>
              <label className={styles.sceneLabel}>Scene</label>
              <select
                value={battleBg || ''}
                onChange={e => { playNav(); setBattleBg(e.target.value || null); }}
                onMouseEnter={playHover}
                className={styles.sceneSelect}
              >
                {BATTLE_BACKGROUNDS.map((b, i) => (
                  <option key={i} value={b.src || ''}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

        {/* ── MAIN LAYOUT — initiative bar above battlefield ── */}
        <div
          className={styles.mainLayout}
          style={{
            left: PAD,
            right: PAD,
            top: PAD + WINDOW_BAR_H + 8,
            bottom: PAD,
          }}
        >
          <div className={styles.glassPanel}>
            {/* ── INITIATIVE STRIP ── */}
            <div className={styles.initStrip}>
              <div className={styles.initHeaderGrid}>
                <div />
                <div className={styles.initHeaderCenter}>
                  <div className={styles.initHeading}>
                    Initiative
                  </div>
                  <div className={styles.initButtons}>
                    <button className={btnClass('gold', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); setAddModalOpen(true); }}>+ Add</button>
                    <button className={btnClass('gold', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); resetEncounter(); }}>Reset</button>
                    <button className={btnClass('danger', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); clearEncounter(); }}>Clear</button>
                  </div>
                </div>
                <div />
              </div>

              <div className={`${styles.initScroll} koa-scrollbar-thin`}>
                {combatants.length === 0 ? (
                  <div className={styles.initEmpty}>
                    Click <b className={styles.initEmptyAdd}>+ Add</b> to begin.
                  </div>
                ) : (
                  <div className={styles.initCardsRow}>
                    {combatants.map(c => {
                      const isActive   = c.id === activeCombatantId;
                      const isSelected = c.id === selectedId;
                      const hp  = c.hp   === '' ? 0 : toInt(c.hp, 0);
                      const max = c.maxHP === '' ? 0 : toInt(c.maxHP, 0);
                      const pct = max > 0 ? (hp / max) * 100 : 100;
                      const hpColor = pct > 50 ? 'rgba(80,200,120,0.80)' : pct > 20 ? 'rgba(230,170,40,0.80)' : 'rgba(220,70,70,0.80)';
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
                            <div className={initClass}>
                              {toInt(c.init,0)}
                            </div>
                            <div className={styles.initNameWrap}>
                              <div className={styles.initName} style={{ textDecoration: c.dead ? 'line-through' : 'none' }}>
                                {c.name}
                              </div>
                              {c.role && <div className={styles.initRole}>{c.role}</div>}
                            </div>
                            <div className={styles.initHp} style={{ color: hpColor }}>
                              {c.hp===''?'—':c.hp}
                            </div>
                            <div className={styles.initActions}>
                              <button title={c.dead ? 'Revive' : 'Mark dead'}
                                onClick={e => { e.stopPropagation(); playNav(); toggleDead(c.id); }}
                                onMouseEnter={playHover}
                                className={iconMiniBtnClass(c.dead ? 'danger' : 'ghost')}>☠</button>
                              <button title="Remove"
                                onClick={e => { e.stopPropagation(); playNav(); removeCombatant(c.id); }}
                                onMouseEnter={playHover}
                                className={iconMiniBtnClass('danger')}>✕</button>
                            </div>
                          </div>

                          <div className={styles.initHpTrack}>
                            <div className={styles.initHpFill} style={{ width:`${clamp(pct,0,100)}%`, background:hpGradient(pct) }}/>
                          </div>

                          {isActive && (
                            <div className={styles.activeTurnTag}>
                              ▶ ACTIVE TURN
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── BATTLEFIELD ── */}
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
              </div>
            </div>
          </div>
        </div>

        {/* ── ADD MODAL ── */}
        {addModalOpen && (
          <div className={styles.modalBack} onMouseDown={e => { if (e.target===e.currentTarget) setAddModalOpen(false); }}>
            <div className={`${styles.modalCard} ${styles.addModal}`}>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitle}>Add Combatants</div>
                <button className={btnClass('danger', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); setAddModalOpen(false); }}>Close</button>
              </div>

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
                  {(() => { const adv = adventurers.find(a => a.name===adventurerPick); return adv ? (
                    <div className={styles.previewCard}>
                      <div className={styles.previewName}>{adv.name}</div>
                      <div>{adv.role} · HP {adv.hp}/{adv.maxHP} · AC {adv.ac}</div>
                    </div>
                  ) : null; })()}
                  <button
                    className={btnClass('gold', 'md', styles.btnFull)}
                    onMouseEnter={playHover}
                    onClick={() => { playNav(); addAdventurer(); }}
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
                  <div className={styles.twoColEqual}>
                    <div><div className={styles.label}>Side</div>
                      <select className={`${styles.input} ${styles.selectInput}`} value={draft.side} onChange={e => setDraft(d => ({ ...d, side:e.target.value }))}>
                        <option value="Enemy">Enemy</option><option value="PC">PC</option><option value="Ally">Ally</option>
                      </select>
                    </div>
                    <div><div className={styles.label}>Role</div>
                      <input className={styles.input} value={draft.role} placeholder="Soldier / Mage" onChange={e => setDraft(d => ({ ...d, role:e.target.value }))}/>
                    </div>
                  </div>
                  {draft.side === 'Enemy' && (
                    <div className={styles.sectionTopGap}>
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
                  >
                    + Add Custom
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── EDITOR MODAL ── */}
        {editorOpen && selected && (
          <div className={styles.modalBack} onMouseDown={e => { if (e.target===e.currentTarget) setEditorOpen(false); }}>
            <div className={`${styles.modalCard} ${styles.editorModal}`}>
              <div className={styles.editorHeader}>
                <div className={styles.editorTitle}>
                  Editing: <span className={styles.editorNameAccent}>{selected.name}</span>
                </div>
                <div className={styles.initActions}>
                  <button className={btnClass('danger', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); setEditorOpen(false); }}>✕</button>
                </div>
              </div>

              <div className={`${styles.editorBody} koa-scrollbar-thin`}>
                {/* Appearance section */}
                <div className={styles.sectionTopGap}>
                  <div className={styles.appearanceTitle}>Appearance</div>
                  <div className={styles.appearanceGrid}>
                    <div>
                      <div className={styles.label}>Custom Image</div>
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
                    </div>
                    {selected.side === 'Enemy' && (
                      <div>
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
                  <input className={styles.input} value={selected.status.join(', ')} placeholder="Poisoned, Grappled, Bless"
                    onChange={e => setSelectedField({ status: String(e.target.value||'').split(',').map(s=>s.trim()).filter(Boolean) })}/>
                </div>
                <div className={styles.sectionTopGap}><div className={styles.label}>Concentration</div>
                  <input className={styles.input} value={selected.concentration} placeholder="Bless / Hold Person / Hex..." onChange={e => setSelectedField({ concentration:e.target.value })}/>
                </div>
                <div className={styles.sectionTopGap}><div className={styles.label}>Notes</div>
                  <textarea className={`${styles.input} ${styles.textareaInput}`} value={selected.notes}
                    placeholder="Tactics, resistances, legendary uses..." onChange={e => setSelectedField({ notes:e.target.value })}/>
                </div>

                <div className={styles.divider}/>
                <div className={styles.actionRow}>
                  <button className={btnClass('danger', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); removeCombatant(selected.id); }}>
                    Remove
                  </button>
                  <button className={btnClass('gold', 'sm')} onMouseEnter={playHover} onClick={() => { playNav(); toggleDead(selected.id); }}>
                    {selected.dead ? 'Revive' : 'Mark dead'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── IMAGE CROP MODAL ── */}
        {cropOpen && (
          <div className={`${styles.modalBack} ${styles.modalBackCrop}`}
            onMouseDown={e => { if (e.target===e.currentTarget) setCropOpen(false); }}>
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
