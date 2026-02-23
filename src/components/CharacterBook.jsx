import React, { useEffect, useMemo, useState } from 'react';
import ShellLayout from './ShellLayout';

export default function CharacterBook({
  panelType,
  cinematicNav,

  // shared roster (from TavernMenu)
  characters = [],
  setCharacters = () => {},

  selectedChar,
  setSelectedChar,

  charView,
  setCharView,

  selectedNpc,
  setSelectedNpc,

  relationshipValues,
  setRelationshipValues,

  clamp0100,
  heatColor,

  // navigation-only click (Button.mp3)
  playNav = null,
  // legacy prop name (kept for backwards-compat)
  playClick = null,
}) {
  const navClick = playNav || playClick || (() => {});

  /* ---------- theme (matches MenuPanel) ---------- */
  const THEME = {
    goldA: 'rgba(176,101,0,0.90)',
    goldB: 'rgba(122,55,0,0.92)',
    dangerA: 'rgba(122,30,30,0.92)',
    dangerB: 'rgba(90,18,18,0.92)',

    creamText: 'rgba(255,245,220,0.96)',
    creamSoft: 'rgba(255,245,220,0.72)',

    glassA: 'rgba(255,245,220,0.065)',
    glassB: 'rgba(255,245,220,0.022)',

    line: 'rgba(255,220,160,0.18)',
    lineSoft: 'rgba(255,220,160,0.10)',

    inkBgA: 'rgba(28,18,10,0.22)',
    inkBgB: 'rgba(10,8,6,0.34)',
  };

  const fontStack = "'Cinzel', 'Trajan Pro', 'Times New Roman', serif";

  /* ---------- slider color (cold → neutral → hot) ---------- */
  const relTempColor = (v) => {
    const t = Math.max(0, Math.min(100, Number(v) || 0));
    const blue = [37, 99, 235];
    const grey = [107, 114, 128];
    const red = [220, 38, 38];
    const lerp = (a, b, x) => Math.round(a + (b - a) * x);
    let r, g, b;
    if (t <= 50) {
      const x = t / 50;
      r = lerp(blue[0], grey[0], x);
      g = lerp(blue[1], grey[1], x);
      b = lerp(blue[2], grey[2], x);
    } else {
      const x = (t - 50) / 50;
      r = lerp(grey[0], red[0], x);
      g = lerp(grey[1], red[1], x);
      b = lerp(grey[2], red[2], x);
    }
    return `rgb(${r}, ${g}, ${b})`;
  };

  const relTempTrack = (v) => {
    const t = Math.max(0, Math.min(100, Number(v) || 0));
    const c = relTempColor(t);
    return `linear-gradient(90deg, ${c} 0%, ${c} ${t}%, rgba(255,245,220,0.12) ${t}%, rgba(255,245,220,0.12) 100%)`;
  };

  /* ---------- styles ---------- */
  const cardShell = {
    width: 'min(1100px, 94vw)',
    height: 'min(760px, 86vh)',
    borderRadius: 22,
    background: 'linear-gradient(180deg, rgba(14,10,6,0.88), rgba(8,6,3,0.94))',
    border: `1px solid ${THEME.line}`,
    backdropFilter: 'blur(10px)',
    fontFamily: fontStack,
    boxShadow: '0 22px 60px rgba(0,0,0,0.52)',
    position: 'relative',
    overflow: 'hidden',
    color: THEME.creamText,
  };

  const edgeGlow = {
    position: 'absolute',
    inset: -2,
    borderRadius: 24,
    pointerEvents: 'none',
    background: 'linear-gradient(135deg, rgba(176,101,0,0.34), rgba(255,140,60,0.18), rgba(255,80,80,0.14))',
    filter: 'blur(18px)',
    opacity: 0.46,
    zIndex: 0,
  };

  const headerBar = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    padding: '12px 18px',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    background: `linear-gradient(180deg, rgba(10,8,6,0.72), rgba(10,8,6,0.30))`,
    backdropFilter: 'blur(14px)',
    borderBottom: `1px solid ${THEME.line}`,
    boxShadow: '0 14px 30px rgba(0,0,0,0.35)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    fontFamily: fontStack,
  };

  const tabButtonStyle = (active) => ({
    padding: '7px 10px',
    borderRadius: 999,
    border: active ? `1px solid rgba(255,235,205,0.55)` : `1px solid ${THEME.lineSoft}`,
    background: active
      ? 'linear-gradient(90deg, rgba(176,101,0,0.28), rgba(255,245,220,0.06))'
      : `linear-gradient(180deg, ${THEME.glassA}, ${THEME.glassB})`,
    color: active ? THEME.creamText : THEME.creamSoft,
    cursor: 'pointer',
    fontWeight: 950,
    fontSize: 12,
    letterSpacing: 0.35,
    boxShadow: active ? '0 10px 28px rgba(0,0,0,0.35)' : '0 10px 18px rgba(0,0,0,0.22)',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    fontFamily: fontStack,
    backdropFilter: 'blur(8px)',
    transition: 'all 140ms ease',
  });

  const backButton = {
    padding: '10px 16px',
    borderRadius: 16,
    border: '1px solid rgba(255,160,160,0.22)',
    background: `linear-gradient(180deg, ${THEME.dangerA}, ${THEME.dangerB})`,
    color: THEME.creamText,
    cursor: 'pointer',
    fontWeight: 950,
    fontSize: 13,
    letterSpacing: 0.4,
    boxShadow: '0 14px 34px rgba(0,0,0,0.38)',
    transition: 'transform 140ms ease, filter 140ms ease, box-shadow 140ms ease',
    userSelect: 'none',
    fontFamily: fontStack,
    textShadow: '0 2px 10px rgba(0,0,0,0.55)',
  };

  const goldBtn = {
    padding: '10px 16px',
    borderRadius: 16,
    border: `1px solid ${THEME.line}`,
    background: `linear-gradient(180deg, ${THEME.glassA}, ${THEME.glassB})`,
    backdropFilter: 'blur(12px)',
    color: THEME.creamText,
    cursor: 'pointer',
    fontWeight: 950,
    fontSize: 13,
    letterSpacing: 0.4,
    boxShadow: '0 14px 34px rgba(0,0,0,0.38)',
    transition: 'transform 140ms ease, filter 140ms ease, box-shadow 140ms ease',
    userSelect: 'none',
    fontFamily: fontStack,
    textShadow: '0 2px 10px rgba(0,0,0,0.55)',
  };

  const btnHover = (e) => {
    e.currentTarget.style.transform = 'translateY(-1px)';
    e.currentTarget.style.filter = 'brightness(1.12)';
    e.currentTarget.style.boxShadow = '0 22px 60px rgba(0,0,0,0.55)';
  };

  const btnLeave = (e) => {
    e.currentTarget.style.transform = 'translateY(0px)';
    e.currentTarget.style.filter = 'none';
    e.currentTarget.style.boxShadow = '0 14px 34px rgba(0,0,0,0.38)';
  };

  const btnDown = (e) => {
    e.currentTarget.style.transform = 'translateY(1px) scale(0.99)';
    e.currentTarget.style.filter = 'brightness(0.98)';
  };

  // Content card (dark, like MenuPanel's cardMini but darker for legibility)
  const darkCard = {
    borderRadius: 18,
    border: `1px solid ${THEME.lineSoft}`,
    background: 'linear-gradient(180deg, rgba(30,20,10,0.80), rgba(18,12,6,0.88))',
    padding: 16,
    boxShadow: '0 18px 46px rgba(0,0,0,0.42)',
    fontFamily: fontStack,
    color: THEME.creamText,
  };

  // Slightly brighter card for variety
  const lightCard = {
    ...darkCard,
    background: 'linear-gradient(180deg, rgba(40,26,12,0.82), rgba(24,16,8,0.90))',
    border: `1px solid ${THEME.line}`,
  };

  const fieldLabel = {
    fontSize: 11,
    fontWeight: 950,
    opacity: 0.72,
    marginBottom: 4,
    letterSpacing: 0.45,
    color: THEME.creamSoft,
  };

  const inputBase = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '9px 12px',
    borderRadius: 12,
    border: `1px solid ${THEME.lineSoft}`,
    background: 'rgba(0,0,0,0.22)',
    color: THEME.creamText,
    outline: 'none',
    fontWeight: 850,
    fontSize: 13,
    fontFamily: fontStack,
  };

  const headerH = 114;

  const bodyArea = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: headerH,
    bottom: 0,
    padding: 18,
    overflowY: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(176,101,0,0.45) transparent',
  };

  const charGridCard = {
    padding: 12,
    borderRadius: 18,
    cursor: 'pointer',
    background: 'linear-gradient(180deg, rgba(30,20,10,0.82), rgba(18,12,6,0.90))',
    border: `1px solid ${THEME.lineSoft}`,
    backdropFilter: 'blur(8px)',
    transition: 'all 0.22s ease',
    boxShadow: '0 18px 46px rgba(0,0,0,0.42)',
    userSelect: 'none',
    color: THEME.creamText,
    fontFamily: fontStack,
  };

  const divider = {
    height: 1,
    background: `linear-gradient(90deg, transparent, ${THEME.line}, transparent)`,
    margin: '12px 0',
  };

  const tinyBtn = {
    padding: '5px 10px',
    borderRadius: 10,
    border: `1px solid ${THEME.lineSoft}`,
    cursor: 'pointer',
    fontWeight: 900,
    fontSize: 11,
    letterSpacing: 0.2,
    background: `linear-gradient(180deg, ${THEME.glassA}, ${THEME.glassB})`,
    color: THEME.creamSoft,
    fontFamily: fontStack,
    transition: 'all 120ms ease',
    userSelect: 'none',
    lineHeight: 1,
    backdropFilter: 'blur(8px)',
  };

  const tinyBtnHover = (e) => {
    e.currentTarget.style.transform = 'translateY(-1px)';
    e.currentTarget.style.filter = 'brightness(1.12)';
  };
  const tinyBtnLeave = (e) => {
    e.currentTarget.style.transform = 'translateY(0px)';
    e.currentTarget.style.filter = 'none';
  };

  /* ---------- Arlis hover animation ---------- */
  const [hoveredCharName, setHoveredCharName] = useState(null);
  const [arlisFrame, setArlisFrame] = useState(0);

  useEffect(() => {
    if (hoveredCharName !== 'Arlis Ghoth') {
      setArlisFrame(0);
      return;
    }
    const id = window.setInterval(() => {
      setArlisFrame((f) => (f === 0 ? 1 : 0));
    }, 220);
    return () => window.clearInterval(id);
  }, [hoveredCharName]);

  const arlisImgA = '/characters/Arlis.png';
  const arlisImgB = '/characters/Arlis2.png';

  const getCharPortrait = (char) => {
    if (char.name !== 'Arlis') return char.image;
    if (hoveredCharName !== 'Arlis Ghoth') return arlisImgA;
    return arlisFrame === 0 ? arlisImgA : arlisImgB;
  };

  /* ---------- Relationship value helpers ---------- */
  const getRelObj = (fromName, toName) => {
    const raw = relationshipValues?.[fromName]?.[toName];
    if (raw == null) return { score: 50, note: '', editing: false };
    if (typeof raw === 'number') return { score: raw, note: '', editing: false };
    return {
      score: typeof raw.score === 'number' ? raw.score : 50,
      note: typeof raw.note === 'string' ? raw.note : '',
      editing: !!raw.editing,
    };
  };

  const setRelObj = (fromName, toName, patch) => {
    setRelationshipValues((prev) => {
      const cur = (() => {
        const raw = prev?.[fromName]?.[toName];
        if (raw == null) return { score: 50, note: '', editing: false };
        if (typeof raw === 'number') return { score: raw, note: '', editing: false };
        return {
          score: typeof raw.score === 'number' ? raw.score : 50,
          note: typeof raw.note === 'string' ? raw.note : '',
          editing: !!raw.editing,
        };
      })();
      const next = { ...cur, ...patch };
      return {
        ...prev,
        [fromName]: { ...(prev?.[fromName] || {}), [toName]: next },
      };
    });
  };

  /* ---------- World NPC Codex ---------- */
  const LS_WORLD_NPCS = 'koa:worldnpcs:v1';

  const [worldNpcs, setWorldNpcs] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_WORLD_NPCS);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem(LS_WORLD_NPCS, JSON.stringify(worldNpcs)); } catch {}
  }, [worldNpcs]);

  const newId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const [npcFilterFaction, setNpcFilterFaction] = useState('All');
  const [npcFilterLocation, setNpcFilterLocation] = useState('All');
  const [npcSearch, setNpcSearch] = useState('');

  const factions = useMemo(() => {
    const set = new Set();
    (worldNpcs || []).forEach((n) => { const f = (n.faction || '').trim(); if (f) set.add(f); });
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [worldNpcs]);

  const locations = useMemo(() => {
    const set = new Set();
    (worldNpcs || []).forEach((n) => { const l = (n.location || '').trim(); if (l) set.add(l); });
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [worldNpcs]);

  const filteredWorldNpcs = useMemo(() => {
    const q = (npcSearch || '').trim().toLowerCase();
    return (worldNpcs || [])
      .filter((n) => npcFilterFaction === 'All' || (n.faction || '') === npcFilterFaction)
      .filter((n) => npcFilterLocation === 'All' || (n.location || '') === npcFilterLocation)
      .filter((n) => {
        if (!q) return true;
        const hay = `${n.name || ''} ${n.faction || ''} ${n.location || ''} ${n.bio || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [worldNpcs, npcFilterFaction, npcFilterLocation, npcSearch]);

  const [worldNpcModalOpen, setWorldNpcModalOpen] = useState(false);
  const [editingWorldNpcId, setEditingWorldNpcId] = useState(null);
  const [worldNpcDraft, setWorldNpcDraft] = useState({ name: '', faction: '', location: '', bio: '' });

  const openAddWorldNpc = () => {
    setEditingWorldNpcId(null);
    setWorldNpcDraft({ name: '', faction: '', location: '', bio: '' });
    setWorldNpcModalOpen(true);
  };

  const openEditWorldNpc = (npc) => {
    setEditingWorldNpcId(npc.id);
    setWorldNpcDraft({ name: npc.name || '', faction: npc.faction || '', location: npc.location || '', bio: npc.bio || '' });
    setWorldNpcModalOpen(true);
  };

  const saveWorldNpc = () => {
    const name = (worldNpcDraft.name || '').trim();
    if (!name) { alert('NPC needs a name.'); return; }
    if (!editingWorldNpcId) {
      const npc = {
        id: newId(), name,
        faction: (worldNpcDraft.faction || '').trim(),
        location: (worldNpcDraft.location || '').trim(),
        bio: (worldNpcDraft.bio || '').trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setWorldNpcs((prev) => [npc, ...(prev || [])]);
    } else {
      setWorldNpcs((prev) =>
        (prev || []).map((n) =>
          n.id === editingWorldNpcId
            ? { ...n, name, faction: (worldNpcDraft.faction || '').trim(), location: (worldNpcDraft.location || '').trim(), bio: (worldNpcDraft.bio || '').trim(), updatedAt: new Date().toISOString() }
            : n
        )
      );
    }
    setWorldNpcModalOpen(false);
    setEditingWorldNpcId(null);
  };

  const deleteWorldNpc = (id) => {
    if (!confirm('Delete this NPC?')) return;
    setWorldNpcs((prev) => (prev || []).filter((n) => n.id !== id));
  };
  /* ---------- Data: characters ---------- */
  // NOTE: roster is now provided by TavernMenu via props (`characters`).

  const partyMateNames = useMemo(() => {
    if (!selectedChar) return [];
    return characters.map((c) => c.name).filter((n) => n !== selectedChar.name);
  }, [selectedChar, characters]);

  const showProfileTab = !!selectedChar && (charView === 'detail' || charView === 'relations' || charView === 'npc');
  const showRelationsTab = !!selectedChar && (charView === 'relations' || charView === 'npc' || charView === 'detail');
  const showNpcTab = !!selectedNpc;
  const showWorldNpcTab = charView === 'worldnpcs';

  return (
    <ShellLayout active={panelType === 'characters'}>
      <div style={cardShell}>
        <style>{`
          ::placeholder { color: rgba(255,245,220,0.55); opacity: 1; }
          .cb-rng {
            width: 100%;
            height: 6px;
            border-radius: 999px;
            outline: none;
            cursor: pointer;
            -webkit-appearance: none;
            appearance: none;
          }
          .cb-rng::-webkit-slider-runnable-track { height: 6px; border-radius: 999px; }
          .cb-rng::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 14px; height: 14px;
            border-radius: 999px;
            background: currentColor;
            border: 2px solid rgba(255,255,255,0.8);
            box-shadow: 0 6px 16px rgba(0,0,0,0.35);
            margin-top: -4px;
          }
          .cb-rng::-moz-range-thumb {
            width: 14px; height: 14px;
            border-radius: 999px;
            background: currentColor;
            border: 2px solid rgba(255,255,255,0.8);
            box-shadow: 0 6px 16px rgba(0,0,0,0.35);
          }
          .cb-card-hover:hover {
            transform: translateY(-3px) scale(1.02) !important;
            box-shadow: 0 26px 60px rgba(0,0,0,0.55) !important;
            border-color: rgba(255,220,160,0.30) !important;
          }
          .cb-npc-hover:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 24px 52px rgba(0,0,0,0.52) !important;
            border-color: rgba(255,220,160,0.28) !important;
          }
        `}</style>

        {/* Edge glow */}
        <div style={edgeGlow} />

        {/* Header */}
        <div style={headerBar}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 22, fontWeight: 950, lineHeight: 1, color: THEME.creamText, textShadow: '0 2px 12px rgba(0,0,0,0.65)', letterSpacing: 0.6 }}>Character Book</div>
              <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 950, letterSpacing: 2, textTransform: 'uppercase', color: THEME.creamSoft }}>Codex</div>
            </div>
            <button
              style={backButton}
              onMouseEnter={btnHover}
              onMouseLeave={btnLeave}
              onMouseDown={(e) => { btnDown(e); navClick(); }}
              onClick={() => cinematicNav('menu')}
            >
              ← Back to Menu
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
            <span style={tabButtonStyle(charView === 'grid')} onMouseDown={navClick}
              onClick={() => { setCharView('grid'); setSelectedChar(null); setSelectedNpc(null); }}
              role="button" tabIndex={0}>
              Adventurers
            </span>

            <span style={tabButtonStyle(charView === 'worldnpcs')} onMouseDown={navClick}
              onClick={() => { setSelectedChar(null); setSelectedNpc(null); setCharView('worldnpcs'); }}
              role="button" tabIndex={0}>
              World NPCs
            </span>

            {showProfileTab && (
              <span style={tabButtonStyle(charView === 'detail')} onMouseDown={navClick}
                onClick={() => setCharView('detail')} role="button" tabIndex={0}>
                Profile
              </span>
            )}

            {showRelationsTab && (
              <span style={tabButtonStyle(charView === 'relations')} onMouseDown={navClick}
                onClick={() => { setSelectedNpc(null); setCharView('relations'); }} role="button" tabIndex={0}>
                NPCs
              </span>
            )}

            {showNpcTab && (
              <span style={tabButtonStyle(charView === 'npc')} onMouseDown={navClick}
                onClick={() => setCharView('npc')} role="button" tabIndex={0}>
                NPC Bio
              </span>
            )}

            {selectedChar && (
              <button
                style={{ ...backButton, marginLeft: 'auto', padding: '8px 14px', fontSize: 12 }}
                onMouseEnter={btnHover}
                onMouseLeave={btnLeave}
                onMouseDown={(e) => { btnDown(e); navClick(); }}
                onClick={() => { setSelectedChar(null); setSelectedNpc(null); setCharView('grid'); }}
              >
                Back to Grid
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={bodyArea}>

          {/* GRID */}
          {charView === 'grid' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              {characters.map((char) => (
                <div
                  key={char.name}
                  className="cb-card-hover"
                  style={{ ...charGridCard, transition: 'all 0.22s ease' }}
                  onMouseDown={navClick}
                  onClick={() => { setSelectedChar(char); setSelectedNpc(null); setCharView('detail'); }}
                  onMouseEnter={() => setHoveredCharName(char.name)}
                  onMouseLeave={() => setHoveredCharName(null)}
                >
                  <img src={getCharPortrait(char)} alt={char.name}
                    style={{ width: '100%', height: 'auto', objectFit: 'contain', borderRadius: 12, marginBottom: 10, boxShadow: '0 10px 26px rgba(0,0,0,0.45)', display: 'block' }} />
                  <div style={{ fontWeight: 950, fontSize: 15, color: THEME.creamText, textShadow: '0 2px 10px rgba(0,0,0,0.55)' }}>{char.name}</div>
                  <div style={{ opacity: 0.72, marginTop: 5, fontSize: 11.5, lineHeight: 1.45, color: THEME.creamSoft }}>{char.synopsis}</div>
                </div>
              ))}
            </div>
          )}

          {/* WORLD NPCs */}
          {showWorldNpcTab && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              <div style={{ ...lightCard, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 950, color: THEME.creamText }}>World NPC Codex</div>
                  <div style={{ fontSize: 12, opacity: 0.72, marginTop: 4, color: THEME.creamSoft }}>NPCs you meet in the world — not tied to any one player.</div>
                </div>
                <button style={goldBtn} onMouseEnter={btnHover} onMouseLeave={btnLeave} onMouseDown={btnDown} onClick={openAddWorldNpc}>
                  + Add NPC
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 10 }}>
                {[
                  { label: 'Faction', val: npcFilterFaction, set: setNpcFilterFaction, opts: factions },
                  { label: 'Location', val: npcFilterLocation, set: setNpcFilterLocation, opts: locations },
                ].map(({ label: lbl, val, set, opts }) => (
                  <div key={lbl} style={darkCard}>
                    <div style={fieldLabel}>{lbl}</div>
                    <select value={val} onChange={(e) => set(e.target.value)} style={{ ...inputBase, fontWeight: 850 }}>
                      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
                <div style={darkCard}>
                  <div style={fieldLabel}>Search</div>
                  <input value={npcSearch} onChange={(e) => setNpcSearch(e.target.value)}
                    placeholder="Name, faction, location, bio…" style={inputBase} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: THEME.creamSoft }}>
                  Showing <strong style={{ color: THEME.creamText }}>{filteredWorldNpcs.length}</strong> of <strong style={{ color: THEME.creamText }}>{(worldNpcs || []).length}</strong>
                </div>
                <button style={{ ...tinyBtn, opacity: 0.9 }} onMouseEnter={tinyBtnHover} onMouseLeave={tinyBtnLeave}
                  onClick={() => { setNpcFilterFaction('All'); setNpcFilterLocation('All'); setNpcSearch(''); }}>
                  Clear Filters
                </button>
              </div>

              {filteredWorldNpcs.length === 0 ? (
                <div style={darkCard}>
                  <div style={{ fontWeight: 950, marginBottom: 6 }}>No NPCs match your filters.</div>
                  <div style={{ lineHeight: 1.6, opacity: 0.8 }}>Try clearing filters, or add your first World NPC.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filteredWorldNpcs.map((n) => (
                    <div key={n.id} style={darkCard}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                        <div style={{ fontSize: 15, fontWeight: 950, color: THEME.creamText }}>{n.name}</div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 900, color: (n.faction || '').trim() ? THEME.creamSoft : 'rgba(255,245,220,0.38)' }}>
                            Faction: {(n.faction || '').trim() || '—'}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 900, color: (n.location || '').trim() ? THEME.creamSoft : 'rgba(255,245,220,0.38)' }}>
                            Location: {(n.location || '').trim() || '—'}
                          </span>
                        </div>
                      </div>
                      {n.bio && <div style={{ marginTop: 8, opacity: 0.85, lineHeight: 1.55, fontSize: 13 }}>{n.bio}</div>}
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button style={tinyBtn} onMouseEnter={tinyBtnHover} onMouseLeave={tinyBtnLeave} onClick={() => openEditWorldNpc(n)}>✎ Edit</button>
                        <button style={{ ...tinyBtn, border: '1px solid rgba(255,160,160,0.22)', color: 'rgba(255,160,160,0.85)' }}
                          onMouseEnter={tinyBtnHover} onMouseLeave={tinyBtnLeave} onClick={() => deleteWorldNpc(n.id)}>🗑 Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DETAIL */}
          {charView === 'detail' && selectedChar && (
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
              <div style={darkCard}>
                <img
                  src={selectedChar.name === 'Arlis Ghoth' ? (hoveredCharName === 'Arlis Ghoth' ? (arlisFrame === 0 ? arlisImgA : arlisImgB) : arlisImgA) : selectedChar.image}
                  alt={selectedChar.name}
                  style={{ width: '100%', height: 310, objectFit: 'cover', borderRadius: 14, boxShadow: '0 14px 36px rgba(0,0,0,0.55)' }}
                  onMouseEnter={() => setHoveredCharName(selectedChar.name)}
                  onMouseLeave={() => setHoveredCharName(null)}
                />
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 21, fontWeight: 950, color: THEME.creamText, textShadow: '0 2px 10px rgba(0,0,0,0.55)' }}>{selectedChar.name}</div>
                  <div style={{ marginTop: 6, opacity: 0.78, lineHeight: 1.5, fontSize: 13, color: THEME.creamSoft }}>{selectedChar.synopsis}</div>
                  <div style={divider} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[['Age', selectedChar.age], ['Height', selectedChar.height]].map(([k, v]) => (
                      <div key={k}>
                        <div style={{ fontSize: 11, fontWeight: 950, opacity: 0.65, color: THEME.creamSoft, letterSpacing: 0.4 }}>{k}</div>
                        <div style={{ fontWeight: 900, color: THEME.creamText, marginTop: 2 }}>{v}</div>
                      </div>
                    ))}
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: 11, fontWeight: 950, opacity: 0.65, color: THEME.creamSoft, letterSpacing: 0.4 }}>Class</div>
                      <div style={{ fontWeight: 900, color: THEME.creamText, marginTop: 2 }}>{selectedChar.class}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={darkCard}>
                  <div style={{ fontSize: 16, fontWeight: 950, marginBottom: 8, color: THEME.creamText }}>Lore</div>
                  <div style={{ opacity: 0.85, lineHeight: 1.65, fontSize: 13, color: THEME.creamSoft }}>{selectedChar.lore}</div>
                </div>

                <div style={darkCard}>
                  <div style={{ fontSize: 16, fontWeight: 950, marginBottom: 8, color: THEME.creamText }}>Current Goals</div>
                  <div style={{ opacity: 0.85, lineHeight: 1.65, fontSize: 13, color: THEME.creamSoft }}>{selectedChar.goals}</div>
                </div>

                <div style={darkCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 950, color: THEME.creamText }}>Party Relationship Tree</div>
                      <div style={{ opacity: 0.72, marginTop: 5, fontSize: 12, color: THEME.creamSoft }}>How {selectedChar.name} feels about the party.</div>
                    </div>
                    <button style={goldBtn} onMouseEnter={btnHover} onMouseLeave={btnLeave}
                      onMouseDown={(e) => { btnDown(e); navClick(); }}
                      onClick={() => { setSelectedNpc(null); setCharView('relations'); }}>
                      View NPCs
                    </button>
                  </div>

                  <div style={divider} />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {partyMateNames.length === 0 ? (
                      <div style={{ opacity: 0.72 }}>No other party members found.</div>
                    ) : partyMateNames.map((otherName) => {
                      const rel = getRelObj(selectedChar.name, otherName);
                      const { score: value, note, editing: isEditing } = rel;
                      return (
                        <div key={otherName} style={{
                          padding: 12, borderRadius: 14,
                          background: 'linear-gradient(180deg, rgba(30,20,10,0.82), rgba(18,12,6,0.90))',
                          border: `1px solid ${THEME.lineSoft}`,
                          boxShadow: '0 10px 26px rgba(0,0,0,0.35)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                            <div style={{ fontWeight: 950, fontSize: 13, color: THEME.creamText }}>{otherName}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ fontWeight: 950, color: relTempColor(value), fontSize: 13 }}>{value}</div>
                              <button style={tinyBtn} onMouseEnter={tinyBtnHover} onMouseLeave={tinyBtnLeave}
                                onClick={() => setRelObj(selectedChar.name, otherName, { editing: !isEditing })}>✎</button>
                            </div>
                          </div>

                          <input className="cb-rng"
                            style={{ color: relTempColor(value), accentColor: relTempColor(value), background: relTempTrack(value), marginTop: 10 }}
                            type="range" min={0} max={100} value={value}
                            onChange={(e) => setRelObj(selectedChar.name, otherName, { score: clamp0100(parseInt(e.target.value, 10) || 0) })}
                          />

                          <div style={{ marginTop: 10, opacity: 0.88, lineHeight: 1.45 }}>
                            {isEditing ? (
                              <textarea value={note || ''} placeholder={`Write a note about ${otherName}...`}
                                onChange={(e) => setRelObj(selectedChar.name, otherName, { note: e.target.value })}
                                onBlur={() => setRelObj(selectedChar.name, otherName, { editing: false })}
                                rows={2}
                                style={{ ...inputBase, minHeight: 64, resize: 'vertical', lineHeight: 1.5 }}
                              />
                            ) : (
                              <div style={{ opacity: note ? 0.88 : 0.5, fontStyle: note ? 'normal' : 'italic', fontSize: 12, color: THEME.creamSoft }}>
                                {note || 'No notes yet. Click ✎ to add one.'}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* NPC RELATIONS LIST */}
          {charView === 'relations' && selectedChar && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline', marginBottom: 12 }}>
                <div style={{ fontSize: 17, fontWeight: 950, color: THEME.creamText }}>{selectedChar.name} — Family & Related NPCs</div>
                <div style={{ opacity: 0.65, fontWeight: 900, fontSize: 12, color: THEME.creamSoft }}>{(selectedChar.npcs || []).length} entries</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(selectedChar.npcs || []).map((npc) => (
                  <div key={npc.name} className="cb-npc-hover"
                    style={{ ...darkCard, cursor: 'pointer', transition: 'all 0.2s ease' }}
                    onMouseDown={navClick}
                    onClick={() => { setSelectedNpc(npc); setCharView('npc'); }}
                    role="button" tabIndex={0}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 950, fontSize: 15, color: THEME.creamText }}>{npc.name}</div>
                      <div style={{ opacity: 0.75, fontWeight: 900, fontStyle: 'italic', color: THEME.creamSoft }}>{npc.relation}</div>
                    </div>
                    <div style={{ marginTop: 8, opacity: 0.82, lineHeight: 1.55, fontSize: 13, color: THEME.creamSoft }}>{npc.bio}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NPC DETAIL */}
          {charView === 'npc' && selectedChar && selectedNpc && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              <div style={lightCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <div style={{ fontSize: 19, fontWeight: 950, color: THEME.creamText }}>{selectedNpc.name}</div>
                  <div style={{ opacity: 0.72, fontWeight: 900, fontStyle: 'italic', color: THEME.creamSoft }}>
                    {selectedNpc.relation} of {selectedChar.name}
                  </div>
                </div>
                <div style={divider} />
                <div style={{ opacity: 0.88, lineHeight: 1.7, fontSize: 13.5, color: THEME.creamSoft }}>{selectedNpc.bio}</div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                  <button style={goldBtn} onMouseEnter={btnHover} onMouseLeave={btnLeave}
                    onMouseDown={(e) => { btnDown(e); navClick(); }} onClick={() => setCharView('relations')}>
                    ← Back to NPCs
                  </button>
                  <button style={goldBtn} onMouseEnter={btnHover} onMouseLeave={btnLeave}
                    onMouseDown={(e) => { btnDown(e); navClick(); }} onClick={() => setCharView('detail')}>
                    ← Back to {selectedChar.name}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* WORLD NPC MODAL */}
        {worldNpcModalOpen && (
          <div
            style={{
              position: 'absolute', inset: 0, zIndex: 30,
              background: 'rgba(0,0,0,0.70)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
              backdropFilter: 'blur(4px)',
            }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) setWorldNpcModalOpen(false); }}
          >
            <div style={{
              width: 'min(640px, 94vw)',
              borderRadius: 22,
              background: 'linear-gradient(180deg, rgba(28,20,12,0.97), rgba(14,10,6,0.98))',
              boxShadow: '0 30px 90px rgba(0,0,0,0.75)',
              border: `1px solid ${THEME.line}`,
              color: THEME.creamText,
              fontFamily: fontStack,
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              maxHeight: 'min(580px, 84vh)',
            }}>
              <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderBottom: `1px solid ${THEME.lineSoft}` }}>
                <div style={{ fontSize: 17, fontWeight: 950 }}>{editingWorldNpcId ? 'Edit World NPC' : 'Add World NPC'}</div>
                <button style={{ ...backButton, padding: '8px 14px', fontSize: 12 }}
                  onMouseEnter={btnHover} onMouseLeave={btnLeave} onMouseDown={btnDown}
                  onClick={() => setWorldNpcModalOpen(false)}>
                  Close
                </button>
              </div>

              <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignContent: 'start', overflowY: 'auto' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={fieldLabel}>Name</div>
                  <input value={worldNpcDraft.name} onChange={(e) => setWorldNpcDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="e.g. Captain Rell" style={{ ...inputBase, fontWeight: 900 }} />
                </div>
                <div>
                  <div style={fieldLabel}>Faction</div>
                  <input value={worldNpcDraft.faction} onChange={(e) => setWorldNpcDraft((d) => ({ ...d, faction: e.target.value }))}
                    placeholder="e.g. Church of Amiras" style={inputBase} />
                </div>
                <div>
                  <div style={fieldLabel}>Location</div>
                  <input value={worldNpcDraft.location} onChange={(e) => setWorldNpcDraft((d) => ({ ...d, location: e.target.value }))}
                    placeholder="e.g. Avalon" style={inputBase} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={fieldLabel}>Bio / Notes</div>
                  <textarea value={worldNpcDraft.bio} onChange={(e) => setWorldNpcDraft((d) => ({ ...d, bio: e.target.value }))}
                    placeholder="Short summary, personality, hook, secrets…" rows={5}
                    style={{ ...inputBase, resize: 'none', minHeight: 110, maxHeight: 180, lineHeight: 1.5 }} />
                </div>
              </div>

              <div style={{ padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: `1px solid ${THEME.lineSoft}` }}>
                {editingWorldNpcId && (
                  <button style={{ ...backButton, padding: '10px 16px', fontSize: 13 }}
                    onMouseEnter={btnHover} onMouseLeave={btnLeave} onMouseDown={btnDown}
                    onClick={() => { setWorldNpcModalOpen(false); setEditingWorldNpcId(null); }}>
                    Cancel
                  </button>
                )}
                <button style={goldBtn} onMouseEnter={btnHover} onMouseLeave={btnLeave} onMouseDown={btnDown} onClick={saveWorldNpc}>
                  {editingWorldNpcId ? 'Save Changes' : 'Add NPC'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ShellLayout>
  );
}
