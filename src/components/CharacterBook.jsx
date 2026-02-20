import React, { useEffect, useMemo, useState } from 'react';
import ShellLayout from './ShellLayout';

export default function CharacterBook({
  panelType,
  cinematicNav,

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
    if (hoveredCharName !== 'Arlis') {
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
    if (hoveredCharName !== 'Arlis') return arlisImgA;
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

  /* ---------- Editable character data (lore, goals, npcs) ---------- */
  const LS_CHAR_DATA = 'koa:chardata:v1';

  const [charData, setCharData] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_CHAR_DATA);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    try { localStorage.setItem(LS_CHAR_DATA, JSON.stringify(charData)); } catch {}
  }, [charData]);

  const getCharField = (charName, field, fallback = '') => {
    return charData?.[charName]?.[field] ?? fallback;
  };

  const setCharField = (charName, field, value) => {
    setCharData((prev) => ({
      ...prev,
      [charName]: { ...(prev?.[charName] || {}), [field]: value },
    }));
  };

  // Per-character NPCs (overrides static list if set)
  const getCharNpcs = (charName, staticNpcs) => {
    if (charData?.[charName]?.npcs !== undefined) return charData[charName].npcs;
    return staticNpcs || [];
  };

  const setCharNpcs = (charName, npcs) => {
    setCharData((prev) => ({
      ...prev,
      [charName]: { ...(prev?.[charName] || {}), npcs },
    }));
  };

  // Edit mode for lore/goals on detail page
  const [detailEditMode, setDetailEditMode] = useState(false);

  // World NPC detail view
  const [viewingWorldNpc, setViewingWorldNpc] = useState(null);

  // NPC add form state
  const [npcAddOpen, setNpcAddOpen] = useState(false);
  const [npcEditMode, setNpcEditMode] = useState(false);
  const [npcAddDraft, setNpcAddDraft] = useState({ name: '', relation: '', bio: '', image: '' });

  const addCharNpc = (charName, staticNpcs) => {
    const name = (npcAddDraft.name || '').trim();
    if (!name) return;
    const current = getCharNpcs(charName, staticNpcs);
    setCharNpcs(charName, [...current, {
      id: newId(),
      name,
      relation: (npcAddDraft.relation || '').trim(),
      bio: (npcAddDraft.bio || '').trim(),
      image: npcAddDraft.image || '',
    }]);
    setNpcAddDraft({ name: '', relation: '', bio: '', image: '' });
    setNpcAddOpen(false);
  };

  const deleteCharNpc = (charName, staticNpcs, npcToDelete) => {
    // Migrate static NPCs into charData if not yet stored, assigning IDs to any that lack them
    const current = getCharNpcs(charName, staticNpcs).map((n) => ({
      ...n,
      id: n.id || newId(),
    }));
    const targetId = typeof npcToDelete === 'string' ? npcToDelete : (npcToDelete?.id || null);
    let next;
    if (targetId) {
      next = current.filter((n) => n.id !== targetId);
    } else {
      // Last resort: filter by name match
      const targetName = npcToDelete?.name || '';
      next = current.filter((n) => n.name !== targetName);
    }
    setCharNpcs(charName, next);
  };

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
  const [worldNpcDraft, setWorldNpcDraft] = useState({ name: '', faction: '', location: '', summary: '', bio: '', image: '' });

  const openAddWorldNpc = () => {
    setEditingWorldNpcId(null);
    setWorldNpcDraft({ name: '', faction: '', location: '', summary: '', bio: '', image: '' });
    setWorldNpcModalOpen(true);
  };

  const openEditWorldNpc = (npc) => {
    setEditingWorldNpcId(npc.id);
    setWorldNpcDraft({ name: npc.name || '', faction: npc.faction || '', location: npc.location || '', summary: npc.summary || '', bio: npc.bio || '', image: npc.image || '' });
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
        summary: (worldNpcDraft.summary || '').trim(),
        bio: (worldNpcDraft.bio || '').trim(),
        image: worldNpcDraft.image || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setWorldNpcs((prev) => [npc, ...(prev || [])]);
    } else {
      const updated = { faction: (worldNpcDraft.faction || '').trim(), location: (worldNpcDraft.location || '').trim(), summary: (worldNpcDraft.summary || '').trim(), bio: (worldNpcDraft.bio || '').trim(), image: worldNpcDraft.image || '', updatedAt: new Date().toISOString() };
      setWorldNpcs((prev) =>
        (prev || []).map((n) =>
          n.id === editingWorldNpcId ? { ...n, name, ...updated } : n
        )
      );
      // Update the detail view if we're currently viewing this NPC
      if (viewingWorldNpc?.id === editingWorldNpcId) {
        setViewingWorldNpc((prev) => ({ ...prev, name, ...updated }));
      }
    }
    setWorldNpcModalOpen(false);
    setEditingWorldNpcId(null);
  };

  const deleteWorldNpc = (id) => {
    if (!confirm('Delete this NPC?')) return;
    setWorldNpcs((prev) => (prev || []).filter((n) => n.id !== id));
  };

  /* ---------- Data: characters ---------- */
  const characters = [
    {
      name: 'William',
      image: '/characters/Will.png',
      synopsis: 'A warlock bound to shadow and fate.',
      age: '22', height: "5'11\"", class: 'Warlock, Paladin',
      lore: 'Once a frail and broken child, William survived tragedy and entered a dark pact that reshaped his destiny. Haunted by loss and guided by unseen forces, he walks the line between salvation and damnation.',
      goals: 'Protect those he loves and uncover the truth behind his cursed power.',
      npcs: [
        { name: 'Darius Blanc', relation: 'Father', bio: 'A strict man who despised magic. His death during the Oakhaven raid left a scar on William that never healed.' },
        { name: 'Eleanore VanFalen', relation: 'Mother', bio: 'William was told she died in childbirth. The truth is… complicated, and the trail always feels intentionally blurred.' },
        { name: 'Tarzos Spicer', relation: 'Savior / Guardian', bio: 'The one who saved William during the raid, at a devastating cost. Left behind a tarot card: The Fool.' },
        { name: 'Ryken', relation: 'Patron', bio: "A force of bargain and consequence. Not a creator of William's split—just the shadow waiting to collect." },
      ],
    },
    {
      name: 'Cerci', image: '/characters/Cerci.png',
      synopsis: 'A dhampir walking between right and wrong.',
      age: 'Appears early-20s', height: "5'6\"", class: 'Monk, Rougue',
      lore: 'Having spent decades in isolation and survival, Cerci hides centuries of pain beneath quiet strength. Her bond with this group is one of the few anchors keeping her tied to hope.',
      goals: 'Unknown',
      npcs: [
        { name: 'Bingo', relation: 'Ex-Boss', bio: "A familiar face from Cerci's circus years—part, part reminder that she still lives in fear of a debt made many years ago." },
        { name: 'The Fed Fang', relation: 'Old Gang', bio: 'It is said Cerci used to be a part of this gang before she met the group. They have shown nothing but ruthlessness and cruelty among the people.' },
      ],
    },
    {
      name: 'Fen', image: '/characters/Fen.png',
      synopsis: 'A relentless warrior of iron will.',
      age: 'Late-20s', height: "6'7\"", class: 'Barbarian',
      lore: 'Blunt, fierce, and stubborn, Fen masks deep care with fumbled words and unstoppable fury in battle.',
      goals: 'Protect the party at any cost.',
      npcs: [
        { name: 'UkValee', relation: 'Former Tribe', bio: 'The innermost and feared tribe in the world spear. Fen was outcasted after she failed to meet cruel traditions.' },
        { name: 'Idysis', relation: 'Folk Tale Legend', bio: 'A man told to the strongest tribe in the world spear as the bogeyman. Even the ghosts fear him.' },
      ],
    },
    {
      name: 'Arlis', image: arlisImgA,
      synopsis: 'A cunning and graceful adventurer.',
      age: 'Mid-20s', height: "5'7\"", class: 'Cleric',
      lore: 'A childhood friend thought lost, Arlis carries strong feelings and a sharp mind. Her path has always curved back toward William.',
      goals: 'Stop the blight, and rid herself and William of their pact.',
      npcs: [
        { name: 'House Ghoth', relation: 'Family', bio: 'A respected family that adopted her with expectations that never stop. Arlis learned early: appearances are armor.' },
      ],
    },
    {
      name: 'Castor', image: 'https://i.imgur.com/EFMhZGu.png',
      synopsis: 'Split from Williams mind, he knows more than he lets others on.',
      age: '21', height: "5'10\"", class: 'Warlock',
      lore: 'Born from fractured identity and dark magic, Castor now walks as his own person. Whimsical, kind, and deeply loyal to the few he trusts.',
      goals: 'Protect his friends and prove he deserves to exist.',
      npcs: [
        { name: 'Vykell', relation: 'Mentor?', bio: 'Taught Castor how to survive when survival was all he had. Practical lessons in the swamp and dropped him off in Notriq.' },
      ],
    },
    {
      name: "Von'Ghul", image: '/characters/Ghuli.png',
      synopsis: 'Selfish, cunning, and brilliant. He makes sure to get the job done.',
      age: "Late 20's", height: "6'2\"", class: 'Artificer',
      lore: 'A half orc inventor that uses his mysterious artifact dubbed as "Stryker". He joined the group with Castor on their way to Avalon.',
      goals: 'Unknown',
      npcs: [{ name: 'The Valkesh', relation: 'Clan', bio: 'The village that VonGhul originally hailed from. He said he left on bad terms, and is now making his way back to redemption.' }],
    },
    {
      name: 'Jasper Delaney',
      image: '/characters/Jasper.png',
      synopsis: 'A cleric hailing from the Golden Isles.',
      age: '31',
      height: "6'2\"",
      class: 'Cleric',
      lore: 'Joined the group after they already arrived in Avalon, was previously in the war as a combat healer.',
      goals: 'Unknown',
      npcs: [],
    },
    {
      name: 'Thryvaris', image: '/characters/3V.png',
      synopsis: 'A mysterious mage with that lives in a cave.',
      age: 'Unknown', height: "6'1\"", class: 'Sorcerer',
      lore: 'Little is known of Thryvaris beyond his departure from the University and his love for painting.',
      goals: 'To live without worry.',
      npcs: [{ name: 'Mezzerack', relation: 'Ex-Professor', bio: 'A man that was part of the Avalon University, who had a hand in ousting Thryvaris.' }],
    },
  ];

  const partyMateNames = useMemo(() => {
    if (!selectedChar) return [];
    return characters.map((c) => c.name).filter((n) => n !== selectedChar.name);
  }, [selectedChar, characters]);

  const showProfileTab = !!selectedChar && (charView === 'detail' || charView === 'relations' || charView === 'npc');
  const showRelationsTab = !!selectedChar && (charView === 'relations' || charView === 'npc' || charView === 'detail');
  const showNpcTab = !!selectedNpc;
  const showWorldNpcTab = charView === 'worldnpcs' || charView === 'worldnpcdetail';

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

            <span style={tabButtonStyle(charView === 'worldnpcs' || charView === 'worldnpcdetail')} onMouseDown={navClick}
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
                onClick={() => { setSelectedNpc(null); setCharView('relations'); setNpcEditMode(false); setNpcAddOpen(false); }} role="button" tabIndex={0}>
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
                  onClick={() => { setSelectedChar(char); setSelectedNpc(null); setCharView('detail'); setDetailEditMode(false); }}
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

          {/* WORLD NPCs LIST */}
          {charView === 'worldnpcs' && (
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
                    <div key={n.id} className="cb-npc-hover" style={{ ...darkCard, cursor: 'pointer', transition: 'all 0.2s ease' }}
                      onClick={() => { setViewingWorldNpc(n); setCharView('worldnpcdetail'); }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        {/* Portrait thumbnail */}
                        <div style={{
                          width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                          border: `1px solid ${THEME.lineSoft}`,
                          background: n.image ? `url(${n.image}) center/cover` : 'rgba(0,0,0,0.30)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
                        }}>
                          {!n.image && <span style={{ opacity: 0.35, fontSize: 18 }}>👤</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontSize: 15, fontWeight: 950, color: THEME.creamText }}>{n.name}</div>
                              {n.summary && <div style={{ fontSize: 12, opacity: 0.72, marginTop: 3, color: THEME.creamSoft, fontStyle: 'italic' }}>{n.summary}</div>}
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                              <span style={{ fontSize: 12, fontWeight: 900, color: (n.faction || '').trim() ? THEME.creamSoft : 'rgba(255,245,220,0.38)' }}>
                                {(n.faction || '').trim() || '—'}
                              </span>
                              <span style={{ fontSize: 11, opacity: 0.45, color: THEME.creamSoft }}>·</span>
                              <span style={{ fontSize: 12, fontWeight: 900, color: (n.location || '').trim() ? THEME.creamSoft : 'rgba(255,245,220,0.38)' }}>
                                {(n.location || '').trim() || '—'}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
                            <button style={tinyBtn} onMouseEnter={tinyBtnHover} onMouseLeave={tinyBtnLeave} onClick={() => openEditWorldNpc(n)}>✎ Edit</button>
                            <button style={{ ...tinyBtn, border: '1px solid rgba(255,160,160,0.22)', color: 'rgba(255,160,160,0.85)' }}
                              onMouseEnter={tinyBtnHover} onMouseLeave={tinyBtnLeave} onClick={() => deleteWorldNpc(n.id)}>🗑 Delete</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* WORLD NPC DETAIL — rendered inline only when that view is active */}
          {charView === 'worldnpcdetail' && viewingWorldNpc && (
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'start' }}>
              {/* Left: portrait + meta */}
              <div style={darkCard}>
                <div style={{
                  width: '100%', aspectRatio: '1', borderRadius: 14,
                  background: viewingWorldNpc.image ? `url(${viewingWorldNpc.image}) center/cover` : 'rgba(0,0,0,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${THEME.lineSoft}`,
                  boxShadow: '0 14px 36px rgba(0,0,0,0.55)',
                  marginBottom: 14, overflow: 'hidden',
                }}>
                  {!viewingWorldNpc.image && <span style={{ opacity: 0.25, fontSize: 52 }}>👤</span>}
                </div>
                <div style={{ fontSize: 19, fontWeight: 950, color: THEME.creamText, textShadow: '0 2px 10px rgba(0,0,0,0.55)' }}>{viewingWorldNpc.name}</div>
                {viewingWorldNpc.summary && <div style={{ marginTop: 5, opacity: 0.75, fontStyle: 'italic', fontSize: 12, color: THEME.creamSoft, lineHeight: 1.5 }}>{viewingWorldNpc.summary}</div>}
                <div style={divider} />
                {[['Faction', viewingWorldNpc.faction], ['Location', viewingWorldNpc.location]].map(([k, v]) => v ? (
                  <div key={k} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 950, opacity: 0.60, color: THEME.creamSoft, letterSpacing: 0.45 }}>{k}</div>
                    <div style={{ fontWeight: 900, color: THEME.creamText, marginTop: 2, fontSize: 13 }}>{v}</div>
                  </div>
                ) : null)}
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <button style={{ ...tinyBtn, flex: 1, textAlign: 'center', justifyContent: 'center' }} onMouseEnter={tinyBtnHover} onMouseLeave={tinyBtnLeave}
                    onClick={() => openEditWorldNpc(viewingWorldNpc)}>✎ Edit</button>
                </div>
              </div>

              {/* Right: bio */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={lightCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ fontSize: 16, fontWeight: 950, color: THEME.creamText }}>Bio & Notes</div>
                    <button style={{ ...backButton, padding: '8px 14px', fontSize: 12 }}
                      onMouseEnter={btnHover} onMouseLeave={btnLeave} onMouseDown={btnDown}
                      onClick={() => { setCharView('worldnpcs'); setViewingWorldNpc(null); }}>
                      ← Back to Codex
                    </button>
                  </div>
                  <div style={divider} />
                  {viewingWorldNpc.bio
                    ? <div style={{ opacity: 0.88, lineHeight: 1.75, fontSize: 13.5, color: THEME.creamSoft }}>{viewingWorldNpc.bio}</div>
                    : <div style={{ opacity: 0.45, fontStyle: 'italic', fontSize: 13 }}>No bio written yet. Click Edit to add one.</div>
                  }
                </div>
              </div>
            </div>
          )}

          {/* DETAIL */}
          {charView === 'detail' && selectedChar && (
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
              <div style={darkCard}>
                <img
                  src={selectedChar.name === 'Arlis' ? (hoveredCharName === 'Arlis' ? (arlisFrame === 0 ? arlisImgA : arlisImgB) : arlisImgA) : selectedChar.image}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 16, fontWeight: 950, color: THEME.creamText }}>Lore</div>
                    <button
                      style={{ ...tinyBtn, padding: '5px 11px', fontSize: 11, background: detailEditMode ? 'linear-gradient(180deg,rgba(176,101,0,0.50),rgba(122,55,0,0.55))' : undefined, border: detailEditMode ? `1px solid ${THEME.line}` : undefined }}
                      onMouseEnter={tinyBtnHover} onMouseLeave={tinyBtnLeave}
                      onClick={() => setDetailEditMode((v) => !v)}
                    >
                      {detailEditMode ? '✓ Done' : '✎ Edit'}
                    </button>
                  </div>
                  {detailEditMode ? (
                    <textarea
                      value={getCharField(selectedChar.name, 'lore', selectedChar.lore)}
                      onChange={(e) => setCharField(selectedChar.name, 'lore', e.target.value)}
                      placeholder="Write character lore…"
                      rows={4}
                      style={{ ...inputBase, resize: 'vertical', lineHeight: 1.65, minHeight: 80 }}
                    />
                  ) : (
                    <div style={{ opacity: 0.85, lineHeight: 1.65, fontSize: 13, color: THEME.creamSoft }}>
                      {getCharField(selectedChar.name, 'lore', selectedChar.lore) || <em style={{ opacity: 0.5 }}>No lore written yet.</em>}
                    </div>
                  )}
                </div>

                <div style={darkCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 16, fontWeight: 950, color: THEME.creamText }}>Current Goals</div>
                  </div>
                  {detailEditMode ? (
                    <textarea
                      value={getCharField(selectedChar.name, 'goals', selectedChar.goals)}
                      onChange={(e) => setCharField(selectedChar.name, 'goals', e.target.value)}
                      placeholder="Write character goals…"
                      rows={2}
                      style={{ ...inputBase, resize: 'vertical', lineHeight: 1.65, minHeight: 52 }}
                    />
                  ) : (
                    <div style={{ opacity: 0.85, lineHeight: 1.65, fontSize: 13, color: THEME.creamSoft }}>
                      {getCharField(selectedChar.name, 'goals', selectedChar.goals) || <em style={{ opacity: 0.5 }}>No goals written yet.</em>}
                    </div>
                  )}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 950, color: THEME.creamText }}>{selectedChar.name} — Family & Related NPCs</div>
                  <div style={{ opacity: 0.65, fontWeight: 900, fontSize: 12, color: THEME.creamSoft, marginTop: 2 }}>
                    {getCharNpcs(selectedChar.name, selectedChar.npcs).length} entries
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {/* Edit mode toggle */}
                  <button
                    style={{
                      ...tinyBtn, padding: '7px 14px', fontSize: 12,
                      background: npcEditMode
                        ? 'linear-gradient(180deg, rgba(122,30,30,0.72), rgba(90,18,18,0.78))'
                        : undefined,
                      border: npcEditMode ? '1px solid rgba(255,160,160,0.28)' : `1px solid ${THEME.lineSoft}`,
                      color: npcEditMode ? 'rgba(255,210,210,0.92)' : THEME.creamSoft,
                    }}
                    onMouseEnter={tinyBtnHover} onMouseLeave={tinyBtnLeave}
                    onClick={() => { setNpcEditMode((v) => !v); setNpcAddOpen(false); }}
                  >
                    {npcEditMode ? '✓ Done Editing' : '✎ Edit'}
                  </button>
                  {/* Add NPC — hidden in edit mode */}
                  {!npcEditMode && (
                    <button
                      style={{ ...tinyBtn, padding: '7px 14px', fontSize: 12, border: npcAddOpen ? '1px solid rgba(255,160,160,0.30)' : `1px solid ${THEME.line}` }}
                      onMouseEnter={tinyBtnHover} onMouseLeave={tinyBtnLeave}
                      onClick={() => { setNpcAddOpen((v) => !v); setNpcAddDraft({ name: '', relation: '', bio: '', image: '' }); }}
                    >
                      {npcAddOpen ? '✕ Cancel' : '+ Add NPC'}
                    </button>
                  )}
                </div>
              </div>

              {/* Inline add form */}
              {npcAddOpen && (
                <div style={{ ...darkCard, marginBottom: 12, border: `1px solid ${THEME.line}` }}>
                  {/* Portrait upload row */}
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: 12, flexShrink: 0,
                      border: `1px solid ${THEME.lineSoft}`,
                      background: npcAddDraft.image ? `url(${npcAddDraft.image}) center/cover` : 'rgba(0,0,0,0.28)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    }}>
                      {!npcAddDraft.image && <span style={{ opacity: 0.35, fontSize: 20 }}>👤</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={fieldLabel}>Portrait (optional)</div>
                      <label style={{
                        display: 'inline-flex', alignItems: 'center', gap: 7,
                        marginTop: 5, padding: '7px 12px', borderRadius: 10,
                        border: `1px solid ${THEME.lineSoft}`, background: 'rgba(255,245,220,0.05)',
                        color: THEME.creamSoft, fontSize: 12, fontWeight: 900,
                        cursor: 'pointer', fontFamily: fontStack,
                      }}>
                        📂 Upload
                        <input type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (ev) => setNpcAddDraft((d) => ({ ...d, image: ev.target.result }));
                            reader.readAsDataURL(file);
                          }} />
                      </label>
                      {npcAddDraft.image && (
                        <button onClick={() => setNpcAddDraft((d) => ({ ...d, image: '' }))}
                          style={{ display: 'block', marginTop: 5, background: 'none', border: 'none', color: 'rgba(255,160,160,0.70)', fontSize: 11, cursor: 'pointer', fontFamily: fontStack }}>
                          ✕ Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <div style={fieldLabel}>Name</div>
                      <input value={npcAddDraft.name} onChange={(e) => setNpcAddDraft((d) => ({ ...d, name: e.target.value }))}
                        placeholder="e.g. Lord Edric" style={inputBase} />
                    </div>
                    <div>
                      <div style={fieldLabel}>Relation</div>
                      <input value={npcAddDraft.relation} onChange={(e) => setNpcAddDraft((d) => ({ ...d, relation: e.target.value }))}
                        placeholder="e.g. Mentor" style={inputBase} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={fieldLabel}>Bio</div>
                      <textarea value={npcAddDraft.bio} onChange={(e) => setNpcAddDraft((d) => ({ ...d, bio: e.target.value }))}
                        placeholder="Short summary…" rows={3}
                        style={{ ...inputBase, resize: 'none', lineHeight: 1.5 }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button style={goldBtn} onMouseEnter={btnHover} onMouseLeave={btnLeave} onMouseDown={btnDown}
                      onClick={() => addCharNpc(selectedChar.name, selectedChar.npcs)}>
                      Add NPC
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {getCharNpcs(selectedChar.name, selectedChar.npcs).map((npc, idx) => (
                  <div key={npc.id || npc.name || idx}
                    style={{ ...darkCard, transition: 'all 0.2s ease', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    {/* Portrait thumbnail if present */}
                    {npc.image && (
                      <div style={{
                        width: 46, height: 46, borderRadius: 10, flexShrink: 0,
                        background: `url(${npc.image}) center/cover`,
                        border: `1px solid ${THEME.lineSoft}`,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
                      }} />
                    )}
                    {/* Main content — clickable to open bio (only when not in edit mode) */}
                    <div
                      style={{ flex: 1, minWidth: 0, cursor: npcEditMode ? 'default' : 'pointer' }}
                      onClick={() => { if (!npcEditMode) { setSelectedNpc(npc); setCharView('npc'); } }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 950, fontSize: 15, color: THEME.creamText }}>{npc.name}</div>
                        <div style={{ opacity: 0.75, fontWeight: 900, fontStyle: 'italic', color: THEME.creamSoft }}>{npc.relation}</div>
                      </div>
                      <div style={{ marginTop: 6, opacity: 0.82, lineHeight: 1.55, fontSize: 13, color: THEME.creamSoft }}>{npc.bio}</div>
                    </div>
                    {/* Delete — only shown in edit mode */}
                    {npcEditMode && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteCharNpc(selectedChar.name, selectedChar.npcs, npc); }}
                        style={{
                          flexShrink: 0, alignSelf: 'center',
                          background: 'linear-gradient(180deg, rgba(122,30,30,0.82), rgba(90,18,18,0.88))',
                          border: '1px solid rgba(255,160,160,0.22)',
                          borderRadius: 10, cursor: 'pointer',
                          color: 'rgba(255,210,210,0.92)',
                          fontSize: 11, fontWeight: 900,
                          padding: '6px 12px', lineHeight: 1,
                          fontFamily: fontStack,
                          letterSpacing: 0.3,
                          transition: 'all 120ms ease',
                          boxShadow: '0 4px 14px rgba(0,0,0,0.30)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.15)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
                      >Remove</button>
                    )}
                  </div>
                ))}
                {getCharNpcs(selectedChar.name, selectedChar.npcs).length === 0 && (
                  <div style={{ ...darkCard, opacity: 0.7, textAlign: 'center' }}>
                    No NPCs yet. Hit <strong>+ Add NPC</strong> above.
                  </div>
                )}
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
              maxHeight: 'min(680px, 90vh)',
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
                {/* Portrait upload */}
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  {/* Preview */}
                  <div style={{
                    width: 80, height: 80, borderRadius: 14, flexShrink: 0,
                    border: `1px solid ${THEME.lineSoft}`,
                    background: worldNpcDraft.image ? `url(${worldNpcDraft.image}) center/cover` : 'rgba(0,0,0,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                    {!worldNpcDraft.image && <span style={{ opacity: 0.4, fontSize: 22 }}>👤</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={fieldLabel}>Portrait (optional)</div>
                    <label style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      marginTop: 6, padding: '8px 12px', borderRadius: 12,
                      border: `1px solid ${THEME.lineSoft}`,
                      background: 'rgba(255,245,220,0.06)',
                      color: THEME.creamSoft, fontSize: 12, fontWeight: 900,
                      cursor: 'pointer', fontFamily: fontStack,
                    }}>
                      📂 Upload Image
                      <input type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => setWorldNpcDraft((d) => ({ ...d, image: ev.target.result }));
                          reader.readAsDataURL(file);
                        }} />
                    </label>
                    {worldNpcDraft.image && (
                      <button onClick={() => setWorldNpcDraft((d) => ({ ...d, image: '' }))}
                        style={{ display: 'block', marginTop: 6, background: 'none', border: 'none', color: 'rgba(255,160,160,0.75)', fontSize: 11, cursor: 'pointer', fontFamily: fontStack }}>
                        ✕ Remove
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={fieldLabel}>Name</div>
                  <input value={worldNpcDraft.name} onChange={(e) => setWorldNpcDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="e.g. Captain Rell" style={{ ...inputBase, fontWeight: 900 }} />
                </div>
                <div>
                  <div style={fieldLabel}>Faction</div>
                  <input value={worldNpcDraft.faction} onChange={(e) => setWorldNpcDraft((d) => ({ ...d, faction: e.target.value }))}
                    placeholder="e.g. Church of Amira" style={inputBase} />
                </div>
                <div>
                  <div style={fieldLabel}>Location</div>
                  <input value={worldNpcDraft.location} onChange={(e) => setWorldNpcDraft((d) => ({ ...d, location: e.target.value }))}
                    placeholder="e.g. Avalon" style={inputBase} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={fieldLabel}>Short Summary <span style={{ opacity: 0.5, fontWeight: 700 }}>— shown in codex list</span></div>
                  <input value={worldNpcDraft.summary} onChange={(e) => setWorldNpcDraft((d) => ({ ...d, summary: e.target.value }))}
                    placeholder="e.g. A grizzled harbor captain with a dark secret" style={inputBase} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={fieldLabel}>Bio / Notes</div>
                  <textarea value={worldNpcDraft.bio} onChange={(e) => setWorldNpcDraft((d) => ({ ...d, bio: e.target.value }))}
                    placeholder="Short summary, personality, hook, secrets…" rows={4}
                    style={{ ...inputBase, resize: 'none', minHeight: 90, maxHeight: 160, lineHeight: 1.5 }} />
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