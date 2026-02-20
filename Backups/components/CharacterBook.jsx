import React, { useEffect, useMemo, useState } from 'react';

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
  
  /* ---------- slider color (cold → neutral → hot) ---------- */
const relTempColor = (v) => {
  const t = Math.max(0, Math.min(100, Number(v) || 0));
  // 0: blue, 50: grey, 100: red
  const blue = [37, 99, 235];   // #2563eb
  const grey = [107, 114, 128]; // #6b7280
  const red = [220, 38, 38];    // #dc2626

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
  // Fill to thumb with the temperature color; the rest stays subtle.
  return `linear-gradient(90deg, ${c} 0%, ${c} ${t}%, rgba(0,0,0,0.16) ${t}%, rgba(0,0,0,0.16) 100%)`;
};


  /* ---------- panel wrapper ---------- */
  const panelStyle = (active) => ({
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: active ? 1 : 0,
    transform: active ? 'translateY(0px)' : 'translateY(10px)',
    transition: 'opacity 220ms ease, transform 220ms ease',
    pointerEvents: active ? 'auto' : 'none',
    zIndex: active ? 6 : 4,
  });

  /* ---------- styles ---------- */
  const buttonBase = {
    margin: '10px',
    padding: '14px 28px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    backgroundColor: '#b06500',
    color: 'white',
    fontSize: '1.1rem',
    transition: 'all 0.25s ease',
  };

  const backButton = {
    ...buttonBase,
    backgroundColor: '#7a1e1e',
    boxShadow: '0 0 15px rgba(255,80,80,0.5)',
  };

  const buttonHover = (e) => {
    e.currentTarget.style.transform = 'scale(1.06)';
    e.currentTarget.style.boxShadow = '0 0 18px rgba(255,170,60,0.45)';
  };

  const buttonLeave = (e) => {
    e.currentTarget.style.transform = 'scale(1)';
    const isBack = e.currentTarget.dataset.kind === 'back';
    e.currentTarget.style.boxShadow = isBack ? '0 0 15px rgba(255,80,80,0.5)' : 'none';
  };

  const headerBar = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    padding: '12px 14px',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    background: 'linear-gradient(180deg, rgba(0,0,0,0.42), rgba(0,0,0,0.08))',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(255,255,255,0.12)',
    boxShadow: '0 14px 30px rgba(0,0,0,0.30)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    color: 'rgba(255,245,220,0.92)',
    fontFamily: "Cinzel, 'Trajan Pro', Georgia, serif",
  };

  const tabButtonStyle = (active) => ({
    padding: '7px 10px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.14)',
    background: active ? 'rgba(176,101,0,0.26)' : 'rgba(255,255,255,0.08)',
    color: active ? 'rgba(255,245,220,0.96)' : 'rgba(255,245,220,0.86)',
    cursor: 'pointer',
    fontWeight: 950,
    fontSize: 12,
    letterSpacing: 0.25,
    boxShadow: active ? '0 10px 18px rgba(0,0,0,0.08)' : 'none',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  });

  const cardShell = (bg = 'linear-gradient(180deg, rgba(12,14,20,0.62), rgba(8,10,14,0.72))', fg = 'rgba(255,245,220,0.92)') => ({
    width: 'min(1100px, 94vw)',
    height: 'min(760px, 86vh)',
    borderRadius: 18,
    background: bg,
    border: '1px solid rgba(255,220,160,0.14)',
    backdropFilter: 'blur(10px)',
    fontFamily: "Cinzel, 'Trajan Pro', Georgia, serif",
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
    position: 'relative',
    overflow: 'hidden',
    color: fg,
  });

  const softCard = {
    padding: 14,
    borderRadius: 16,
    background: 'rgba(255,245,220,0.92)',
    color: '#2b1a0f',
    fontFamily: "Cinzel, 'Trajan Pro', Georgia, serif",
    boxShadow: '0 10px 18px rgba(0,0,0,0.08)',
    border: '1px solid rgba(0,0,0,0.06)',
  };

  const smallBtn = (variant = 'gold') => {
    const base = {
      padding: '8px 10px',
      borderRadius: 12,
      border: '1px solid rgba(0,0,0,0.12)',
      cursor: 'pointer',
      fontWeight: 900,
      fontSize: 12,
      letterSpacing: 0.2,
      transition: 'transform 140ms ease, box-shadow 140ms ease, filter 140ms ease',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      background: 'rgba(255,255,255,0.55)',
    };

    if (variant === 'gold') {
      return {
        ...base,
        background: 'linear-gradient(180deg, rgba(176,101,0,0.90), rgba(122,55,0,0.92))',
        color: 'rgba(255,245,220,0.96)',
        border: '1px solid rgba(255,220,160,0.35)',
        textShadow: '0 2px 8px rgba(0,0,0,0.55)',
        boxShadow: '0 12px 26px rgba(0,0,0,0.25)',
      };
    }
    if (variant === 'danger') {
      return {
        ...base,
        background: 'linear-gradient(180deg, rgba(122,30,30,0.92), rgba(90,18,18,0.92))',
        color: 'rgba(255,245,220,0.96)',
        border: '1px solid rgba(255,160,160,0.26)',
        textShadow: '0 2px 8px rgba(0,0,0,0.55)',
        boxShadow: '0 12px 26px rgba(0,0,0,0.22)',
      };
    }
    return base;
  };

  const smallBtnHover = (e) => {
    e.currentTarget.style.transform = 'translateY(-1px)';
    e.currentTarget.style.filter = 'brightness(1.06)';
    e.currentTarget.style.boxShadow = '0 16px 34px rgba(0,0,0,0.26)';
  };

  const smallBtnLeave = (e) => {
    e.currentTarget.style.transform = 'translateY(0px)';
    e.currentTarget.style.filter = 'none';
  };

  const tinyBtn = {
    padding: '4px 8px',
    borderRadius: 8,
    border: '1px solid rgba(0,0,0,0.14)',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: 11,
    letterSpacing: 0.2,
    background: 'rgba(255,255,255,0.65)',
    color: 'rgba(255,245,220,0.92)',
    fontFamily: "Cinzel, 'Trajan Pro', Georgia, serif",
    transition: 'all 120ms ease',
    userSelect: 'none',
    lineHeight: 1,
  };

  const tinyBtnHover = (e) => {
    e.currentTarget.style.transform = 'translateY(-1px)';
    e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.18)';
  };

  const tinyBtnLeave = (e) => {
    e.currentTarget.style.transform = 'translateY(0px)';
    e.currentTarget.style.boxShadow = 'none';
  };

  const fieldLabel = {
    fontSize: 11,
    fontWeight: 900,
    opacity: 0.75,
    marginBottom: 4,
  };

  const inputBase = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.18)',
    outline: 'none',
    fontSize: 13,
    background: 'rgba(255,255,255,0.72)',
    color: 'rgba(255,245,220,0.92)',
    fontFamily: "Cinzel, 'Trajan Pro', Georgia, serif",
  };

  const headerH = 110;

  const bodyArea = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: headerH,
    bottom: 0,
    padding: 18,
    overflowY: 'auto',
  };

  const charGridCard = {
    width: 160,
    padding: 12,
    borderRadius: 14,
    cursor: 'pointer',
    background: 'rgba(255,245,220,0.92)',
    color: '#2b1a0f',
    fontFamily: "Cinzel, 'Trajan Pro', Georgia, serif",
    backdropFilter: 'blur(6px)',
    fontFamily: "Cinzel, 'Trajan Pro', Georgia, serif",
    transition: 'all 0.22s ease',
    boxShadow: '0 6px 18px rgba(0,0,0,0.20)',
    border: '1px solid rgba(0,0,0,0.06)',
    userSelect: 'none',
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

  /* ---------- Relationship value helpers (backward compatible) ---------- */
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
        [fromName]: {
          ...(prev?.[fromName] || {}),
          [toName]: next,
        },
      };
    });
  };

  /* ---------- World NPC Codex (localStorage) ---------- */
  const LS_WORLD_NPCS = 'koa:worldnpcs:v1';

  const [worldNpcs, setWorldNpcs] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_WORLD_NPCS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_WORLD_NPCS, JSON.stringify(worldNpcs));
    } catch {}
  }, [worldNpcs]);

  const newId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const [npcFilterFaction, setNpcFilterFaction] = useState('All');
  const [npcFilterLocation, setNpcFilterLocation] = useState('All');
  const [npcSearch, setNpcSearch] = useState('');

  const factions = useMemo(() => {
    const set = new Set();
    (worldNpcs || []).forEach((n) => {
      const f = (n.faction || '').trim();
      if (f) set.add(f);
    });
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [worldNpcs]);

  const locations = useMemo(() => {
    const set = new Set();
    (worldNpcs || []).forEach((n) => {
      const l = (n.location || '').trim();
      if (l) set.add(l);
    });
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [worldNpcs]);

  const filteredWorldNpcs = useMemo(() => {
    const q = (npcSearch || '').trim().toLowerCase();
    return (worldNpcs || [])
      .filter((n) => (npcFilterFaction === 'All' ? true : (n.faction || '') === npcFilterFaction))
      .filter((n) => (npcFilterLocation === 'All' ? true : (n.location || '') === npcFilterLocation))
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
    setWorldNpcDraft({
      name: npc.name || '',
      faction: npc.faction || '',
      location: npc.location || '',
      bio: npc.bio || '',
    });
    setWorldNpcModalOpen(true);
  };

  const saveWorldNpc = () => {
    const name = (worldNpcDraft.name || '').trim();
    if (!name) {
      alert('NPC needs a name.');
      return;
    }

    if (!editingWorldNpcId) {
      const npc = {
        id: newId(),
        name,
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
            ? {
                ...n,
                name,
                faction: (worldNpcDraft.faction || '').trim(),
                location: (worldNpcDraft.location || '').trim(),
                bio: (worldNpcDraft.bio || '').trim(),
                updatedAt: new Date().toISOString(),
              }
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
  const characters = [
    {
      name: 'William',
      image: '/characters/Will.png',
      synopsis: 'A warlock bound to shadow and fate.',
      age: '22',
      height: "5'11\"",
      class: 'Fiend Warlock',
      lore:
        'Once a frail and broken child, William survived tragedy and entered a dark pact that reshaped his destiny. Haunted by loss and guided by unseen forces, he walks the line between salvation and damnation.',
      goals: 'Protect those he loves and uncover the truth behind his cursed power.',
      npcs: [
        { name: 'Darius Blanc', relation: 'Father', bio: 'A strict man who despised magic. His death during the Oakhaven raid left a scar on William that never healed.' },
        { name: 'Eleanore VanFalen', relation: 'Mother', bio: 'William was told she died in childbirth. The truth is… complicated, and the trail always feels intentionally blurred.' },
        { name: 'Tarzos Spicer', relation: 'Savior / Guardian', bio: 'The one who saved William during the raid, at a devastating cost. Left behind a tarot card: The Fool.' },
        { name: 'Ryken', relation: 'Patron', bio: 'A force of bargain and consequence. Not a creator of William’s split—just the shadow waiting to collect.' },
      ],
    },
    {
      name: 'Cerci',
      image: 'https://i.imgur.com/NgzSIMU.png',
      synopsis: 'A dhampir walking between night and dawn.',
      age: 'Appears early-20s',
      height: "5'6\"",
      class: 'Dhampir Spellblade',
      lore:
        'Having spent decades in isolation and survival, Cerci hides centuries of pain beneath quiet strength. Her bond with William is one of the few anchors keeping her tied to hope.',
      goals: 'Find belonging beyond the shadows of her past.',
      npcs: [
        { name: 'Bingo', relation: 'Circus Companion', bio: 'A familiar face from Cerci’s circus years—part comfort, part reminder that her “past lives” weren’t just survival.' },
        { name: 'The Night Court (Rumor)', relation: 'Unseen Watchers', bio: 'Whispers say someone has been keeping tabs on Cerci for a very long time… and not out of kindness.' },
      ],
    },
    {
      name: 'Fen',
      image: '/characters/Fen.png',
      synopsis: 'A relentless warrior of iron will.',
      age: 'Late-20s',
      height: "6'7\"",
      class: 'Barbarian',
      lore: 'Blunt, fierce, and fiercely loyal, Fen masks deep care with sharp words and unstoppable fury in battle.',
      goals: 'Protect the party at any cost.',
      npcs: [
        { name: 'Warchief Brann', relation: 'Former Leader', bio: 'The one who taught Fen to fight first and ask questions later. Whether he’d be proud or furious… depends on the day.' },
        { name: 'Sister Kaela', relation: 'Old Rival', bio: 'A rival who never let Fen win clean. Somehow, that’s exactly why Fen respects her.' },
      ],
    },
    {
      name: 'Arlis',
      image: arlisImgA,
      synopsis: 'A cunning and graceful adventurer.',
      age: 'Mid-20s',
      height: "5'7\"",
      class: 'Cleric',
      lore: 'A childhood friend thought lost, Arlis carries quiet feelings and a sharp mind. Her path has always curved back toward William.',
      goals: 'Reveal the truth of her heart—and survive the journey.',
      npcs: [
        { name: 'House Ghoth', relation: 'Family', bio: 'A respected family with expectations that never stop. Arlis learned early: appearances are armor.' },
        { name: 'Jasper Delancey', relation: 'Childhood Friend (Cover Story)', bio: 'Their parents think they’re courting. In reality: a mutually useful disguise with complicated edges.' },
      ],
    },
    {
      name: 'Castor',
      image: 'https://i.imgur.com/EFMhZGu.png',
      synopsis: 'Split from Williams mind, he knows more than he lets others on.',
      age: '21',
      height: "5'10\"",
      class: 'Warlock',
      lore: 'Born from fractured identity and dark magic, Castor walks as his own person—protective, intense, and deeply loyal to the few he trusts.',
      goals: 'Protect his friends and prove he deserves to exist.',
      npcs: [
        { name: 'Vykell', relation: 'Mentor (Monster Hunter)', bio: 'Taught Castor how to survive when survival was all he had. Practical lessons, brutal honesty.' },
        { name: "Von'Ghul", relation: 'Brother-in-Arms', bio: 'A wary guardian with a soft spot he pretends doesn’t exist. He’s watching for the darkness to bite.' },
      ],
    },
    {
      name: "Von'Ghul",
      image: 'https://i.imgur.com/91IBamd.png',
      synopsis: 'An older, experienced hunter and mentor.',
      age: 'Late 20',
      height: "6'2\"",
      class: 'Artificer',
      lore: 'Gruff yet quietly compassionate, Von’Ghul watches over the younger adventurers like a wary guardian.',
      goals: 'Unknown.',
      npcs: [{ name: 'The Valkesh', relation: 'Clan', bio: 'The village that VonGhul originally hailed from. He said he left on bad terms, and is now making his way back to redemption.' }],
    },
    {
      name: 'Thryvaris',
      image: '/characters/3V.png',
      synopsis: 'A mysterious mage with that lives in a cave.',
      age: 'Unknown',
      height: "6'1\"",
      class: 'Sorcerer',
      lore: 'Little is known of Thryvaris beyond whispers of forbidden study and impossible power.',
      goals: 'Pursue truths lost to time.',
      npcs: [{ name: 'The Archivist', relation: 'Informant', bio: 'A keeper of forbidden catalogs who sells information like it’s contraband. Because it is.' }],
    },
  ];

  const partyMateNames = useMemo(() => {
    if (!selectedChar) return [];
    return characters.map((c) => c.name).filter((n) => n !== selectedChar.name);
  }, [selectedChar, characters]);

  const showProfileTab = !!selectedChar && (charView === 'detail' || charView === 'relations' || charView === 'npc');
  const showRelationsTab = !!selectedChar && (charView === 'relations' || charView === 'npc' || charView === 'detail');
  const showNpcTab = !!selectedNpc;

  const showWorldNpcTab = charView === 'worldnpcs';

  return (
    <div style={panelStyle(panelType === 'characters')}>
      <div style={cardShell()}>
        {/* Range styling */}
        <style>{`
          .rng {
            width: 100%;
            height: 6px;
            border-radius: 999px;
            background: linear-gradient(90deg, #2563eb 0%, #6b7280 50%, #dc2626 100%);
            outline: none;
            cursor: pointer;
          }
          .rng::-webkit-slider-runnable-track { height: 6px; border-radius: 999px; }
          .rng::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 14px;
            height: 14px;
            border-radius: 999px;
            background: currentColor;
            border: 2px solid rgba(255,255,255,0.8);
            box-shadow: 0 6px 16px rgba(0,0,0,0.25);
            margin-top: -4px;
          }
          .rng::-moz-range-track { height: 6px; border-radius: 999px; background: transparent; }
          .rng::-moz-range-thumb {
            width: 14px;
            height: 14px;
            border-radius: 999px;
            background: currentColor;
            border: 2px solid rgba(255,255,255,0.8);
            box-shadow: 0 6px 16px rgba(0,0,0,0.25);
          }
        `}</style>

        <div style={headerBar}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 26, fontWeight: 950, lineHeight: 1 }}>Character Book</div>
              <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 900, letterSpacing: 1.2, textTransform: 'uppercase' }}>Codex</div>
            </div>

            {/* NAVIGATION SOUND ONLY */}
            <button
			  data-kind="back"
			  style={{ ...backButton, margin: 0 }}
			  onMouseEnter={buttonHover}
			  onMouseLeave={buttonLeave}
			  onMouseDown={navClick}
			  onClick={() => cinematicNav('menu')}
			>
			  Back to Menu
			</button>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* NAV TABS (sound only here) */}
            <span
              style={tabButtonStyle(charView === 'grid')}
              onMouseDown={navClick}
              onClick={() => {
                setCharView('grid');
                setSelectedChar(null);
                setSelectedNpc(null);
              }}
              role="button"
              tabIndex={0}
            >
              Adventurers
            </span>

            <span
              style={tabButtonStyle(charView === 'worldnpcs')}
              onMouseDown={navClick}
              onClick={() => {
                setSelectedChar(null);
                setSelectedNpc(null);
                setCharView('worldnpcs');
              }}
              role="button"
              tabIndex={0}
            >
              World NPCs
            </span>

            {showProfileTab && (
              <span
                style={tabButtonStyle(charView === 'detail')}
                onMouseDown={navClick}
                onClick={() => {
                  setCharView('detail');
                }}
                role="button"
                tabIndex={0}
              >
                Profile
              </span>
            )}

            {showRelationsTab && (
              <span
                style={tabButtonStyle(charView === 'relations')}
                onMouseDown={navClick}
                onClick={() => {
                  setSelectedNpc(null);
                  setCharView('relations');
                }}
                role="button"
                tabIndex={0}
              >
                NPCs
              </span>
            )}

            {showNpcTab && (
              <span
                style={tabButtonStyle(charView === 'npc')}
                onMouseDown={navClick}
                onClick={() => {
                  setCharView('npc');
                }}
                role="button"
                tabIndex={0}
              >
                NPC Bio
              </span>
            )}

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {selectedChar && (
                <button
                  data-kind="back"
                  style={{ ...backButton, margin: 0, padding: '10px 14px' }}
                  onMouseEnter={buttonHover}
                  onMouseLeave={buttonLeave}
                  onMouseDown={navClick}
                  onClick={() => {
                    setSelectedChar(null);
                    setSelectedNpc(null);
                    setCharView('grid');
                  }}
                >
                  Back to Grid
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={bodyArea}>
          {/* GRID */}
          {charView === 'grid' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
              {characters.map((char) => (
                <div
                  key={char.name}
                  style={charGridCard}
                  onMouseDown={navClick} // NAV: grid -> detail
                  onClick={() => {
                    setSelectedChar(char);
                    setSelectedNpc(null);
                    setCharView('detail');
                  }}
                  onMouseEnter={(e) => {
                    setHoveredCharName(char.name);
                    e.currentTarget.style.transform = 'translateY(-4px) scale(1.03)';
                    e.currentTarget.style.boxShadow = '0 14px 28px rgba(0,0,0,0.26)';
                  }}
                  onMouseLeave={(e) => {
                    setHoveredCharName(null);
                    e.currentTarget.style.transform = 'translateY(0px) scale(1)';
                    e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.20)';
                  }}
                >
                  <img src={getCharPortrait(char)} alt={char.name} style={{ width: '100%', height: 190, objectFit: 'cover', borderRadius: 10, marginBottom: 10 }} />
                  <div style={{ fontWeight: 950, fontSize: 16 }}>{char.name}</div>
                  <div style={{ opacity: 0.85, marginTop: 6, fontSize: 12, lineHeight: 1.4 }}>{char.synopsis}</div>
                </div>
              ))}
            </div>
          )}

          {/* WORLD NPCs */}
          {showWorldNpcTab && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              <div style={{ ...softCard, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 950 }}>World NPC Codex</div>
                  <div style={{ fontSize: 12, opacity: 0.82, marginTop: 4 }}>NPCs you meet in the world — not tied to any one player.</div>
                </div>

                {/* ACTION: no nav sound */}
                <button style={smallBtn('gold')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={openAddWorldNpc}>
                  + Add NPC
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 10 }}>
                <div style={softCard}>
                  <div style={fieldLabel}>Faction</div>
                  <select value={npcFilterFaction} onChange={(e) => setNpcFilterFaction(e.target.value)} style={{ ...inputBase, fontWeight: 800 }}>
                    {factions.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={softCard}>
                  <div style={fieldLabel}>Location</div>
                  <select value={npcFilterLocation} onChange={(e) => setNpcFilterLocation(e.target.value)} style={{ ...inputBase, fontWeight: 800 }}>
                    {locations.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={softCard}>
                  <div style={fieldLabel}>Search</div>
                  <input value={npcSearch} onChange={(e) => setNpcSearch(e.target.value)} placeholder="Name, faction, location, bio…" style={inputBase} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
                  Showing <strong>{filteredWorldNpcs.length}</strong> of <strong>{(worldNpcs || []).length}</strong>
                </div>

                {/* ACTION: no nav sound */}
                <button
                  style={{ ...tinyBtn, opacity: 0.9 }}
                  onMouseEnter={tinyBtnHover}
                  onMouseLeave={tinyBtnLeave}
                  onClick={() => {
                    setNpcFilterFaction('All');
                    setNpcFilterLocation('All');
                    setNpcSearch('');
                  }}
                  title="Clear filters"
                >
                  Clear
                </button>
              </div>

              {filteredWorldNpcs.length === 0 ? (
                <div style={{ ...softCard, opacity: 0.9 }}>
                  <div style={{ fontWeight: 950, marginBottom: 6 }}>No NPCs match your filters.</div>
                  <div style={{ lineHeight: 1.6 }}>Try clearing filters, or add your first World NPC.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filteredWorldNpcs.map((n) => (
                    <div key={n.id} style={softCard}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                        <div style={{ fontSize: 16, fontWeight: 950 }}>{n.name}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          {(n.faction || '').trim() ? (
                            <span style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>Faction: {n.faction}</span>
                          ) : (
                            <span style={{ fontSize: 12, fontWeight: 900, opacity: 0.55 }}>Faction: —</span>
                          )}
                          {(n.location || '').trim() ? (
                            <span style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>Location: {n.location}</span>
                          ) : (
                            <span style={{ fontSize: 12, fontWeight: 900, opacity: 0.55 }}>Location: —</span>
                          )}
                        </div>
                      </div>

                      {n.bio ? <div style={{ marginTop: 8, opacity: 0.92, lineHeight: 1.55 }}>{n.bio}</div> : null}

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                        {/* ACTIONS: no nav sound */}
                        <button style={tinyBtn} onMouseEnter={tinyBtnHover} onMouseLeave={tinyBtnLeave} onClick={() => openEditWorldNpc(n)} title="Edit">
                          ✎ Edit
                        </button>

                        <button
                          style={{ ...tinyBtn, borderColor: 'rgba(122,30,30,0.25)', color: '#7a1e1e' }}
                          onMouseEnter={tinyBtnHover}
                          onMouseLeave={tinyBtnLeave}
                          onClick={() => deleteWorldNpc(n.id)}
                          title="Delete"
                        >
                          🗑 Delete
                        </button>
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
              <div style={softCard}>
                <img
                  src={selectedChar.name === 'Arlis' ? (hoveredCharName === 'Arlis' ? (arlisFrame === 0 ? arlisImgA : arlisImgB) : arlisImgA) : selectedChar.image}
                  alt={selectedChar.name}
                  style={{ width: '100%', height: 330, objectFit: 'cover', borderRadius: 14 }}
                  onMouseEnter={() => setHoveredCharName(selectedChar.name)}
                  onMouseLeave={() => setHoveredCharName(null)}
                />
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 22, fontWeight: 950 }}>{selectedChar.name}</div>
                  <div style={{ marginTop: 6, opacity: 0.88, lineHeight: 1.5 }}>{selectedChar.synopsis}</div>

                  <div style={{ height: 1, background: 'rgba(0,0,0,0.10)', margin: '14px 0' }} />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.7 }}>Age</div>
                      <div style={{ fontWeight: 900 }}>{selectedChar.age}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.7 }}>Height</div>
                      <div style={{ fontWeight: 900 }}>{selectedChar.height}</div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.7 }}>Class</div>
                      <div style={{ fontWeight: 900 }}>{selectedChar.class}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={softCard}>
                  <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 8 }}>Lore</div>
                  <div style={{ opacity: 0.92, lineHeight: 1.6 }}>{selectedChar.lore}</div>
                </div>

                <div style={softCard}>
                  <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 8 }}>Current Goals</div>
                  <div style={{ opacity: 0.92, lineHeight: 1.6 }}>{selectedChar.goals}</div>
                </div>

                {/* Party Relationship Tree */}
                <div style={softCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 950 }}>Party Relationship Tree</div>
                      <div style={{ opacity: 0.8, marginTop: 6 }}>How {selectedChar.name} feels about the party.</div>
                    </div>

                    {/* NAV: detail -> relations */}
                    <button
                      style={smallBtn('gold')}
                      onMouseEnter={smallBtnHover}
                      onMouseLeave={smallBtnLeave}
                      onMouseDown={navClick}
                      onClick={() => {
                        setSelectedNpc(null);
                        setCharView('relations');
                      }}
                      title="NPCs are in the NPCs tab"
                    >
                      View NPCs
                    </button>
                  </div>

                  <div style={{ height: 1, background: 'rgba(0,0,0,0.10)', margin: '14px 0' }} />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {partyMateNames.length === 0 ? (
                      <div style={{ opacity: 0.85 }}>No other party members found.</div>
                    ) : (
                      partyMateNames.map((otherName) => {
                        const rel = getRelObj(selectedChar.name, otherName);
                        const value = rel.score;
                        const note = rel.note;
                        const isEditing = rel.editing;

                        return (
                          <div
                            key={otherName}
                            style={{
                              padding: 12,
                              borderRadius: 14,
                              background: 'rgba(255,255,255,0.55)',
                              border: '1px solid rgba(0,0,0,0.06)',
                              boxShadow: '0 10px 18px rgba(0,0,0,0.06)',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                              <div style={{ fontWeight: 950 }}>{otherName}</div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ fontWeight: 950, color: relTempColor(value), fontSize: 13 }}>{value}</div>

                                <button
                                  style={tinyBtn}
                                  onMouseEnter={tinyBtnHover}
                                  onMouseLeave={tinyBtnLeave}
                                  onClick={() => setRelObj(selectedChar.name, otherName, { editing: !isEditing })}
                                  title="Edit note"
                                >
                                  ✎
                                </button>
                              </div>
                            </div>

                            <input
                              className="rng"
                              style={{
                                color: relTempColor(value),
                                accentColor: relTempColor(value),
                                background: relTempTrack(value),
                                marginTop: 10,
                              }}
                              type="range"
                              min={0}
                              max={100}
                              value={value}
                              onChange={(e) => {
                                const next = clamp0100(parseInt(e.target.value, 10) || 0);
                                setRelObj(selectedChar.name, otherName, { score: next });
                              }}
                            />

                            <div style={{ marginTop: 10, opacity: 0.9, lineHeight: 1.45 }}>
                              {isEditing ? (
                                <textarea
                                  value={note || ''}
                                  placeholder={`Write a note about ${otherName}...`}
                                  onChange={(e) => setRelObj(selectedChar.name, otherName, { note: e.target.value })}
                                  onBlur={() => setRelObj(selectedChar.name, otherName, { editing: false })}
                                  rows={2}
                                  style={{
                                    width: '100%',
                                    minHeight: 72,
                                    resize: 'vertical',
                                    borderRadius: 12,
                                    border: '1px solid rgba(0,0,0,0.14)',
                                    padding: 10,
                                    outline: 'none',
                                    background: 'rgba(255,255,255,0.7)',
                                    fontWeight: 700,
                                    fontSize: 12,
                                    boxSizing: 'border-box',
                                  }}
                                />
                              ) : (
                                <div style={{ opacity: note ? 0.95 : 0.6, fontStyle: note ? 'normal' : 'italic', fontSize: 12 }}>
                                  {note ? note : 'No notes yet. Click ✎ to add one.'}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* NPC RELATIONS LIST (tied to character) */}
          {charView === 'relations' && selectedChar && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <div style={{ fontSize: 18, fontWeight: 950 }}>{selectedChar.name} — Family & Related NPCs</div>
                <div style={{ opacity: 0.75, fontWeight: 900, fontSize: 12 }}>{(selectedChar.npcs || []).length} entries</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                {(selectedChar.npcs || []).map((npc) => (
                  <div
                    key={npc.name}
                    style={softCard}
                    onMouseDown={navClick} // NAV: relations -> npc
                    onClick={() => {
                      setSelectedNpc(npc);
                      setCharView('npc');
                    }}
                    role="button"
                    tabIndex={0}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 18px 30px rgba(0,0,0,0.14)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0px)';
                      e.currentTarget.style.boxShadow = '0 10px 18px rgba(0,0,0,0.08)';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 950, fontSize: 16 }}>{npc.name}</div>
                      <div style={{ opacity: 0.85, fontWeight: 900 }}>
                        <em>{npc.relation}</em>
                      </div>
                    </div>
                    <div style={{ marginTop: 8, opacity: 0.92, lineHeight: 1.55 }}>{npc.bio}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NPC DETAIL (tied to character) */}
          {charView === 'npc' && selectedChar && selectedNpc && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              <div style={softCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <div style={{ fontSize: 20, fontWeight: 950 }}>{selectedNpc.name}</div>
                  <div style={{ opacity: 0.85, fontWeight: 900 }}>
                    <em>
                      {selectedNpc.relation} of {selectedChar.name}
                    </em>
                  </div>
                </div>

                <div style={{ height: 1, background: 'rgba(0,0,0,0.10)', margin: '14px 0' }} />
                <div style={{ opacity: 0.92, lineHeight: 1.7 }}>{selectedNpc.bio}</div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                  {/* NAV buttons */}
                  <button
                    style={smallBtn('gold')}
                    onMouseEnter={smallBtnHover}
                    onMouseLeave={smallBtnLeave}
                    onMouseDown={navClick}
                    onClick={() => setCharView('relations')}
                  >
                    Back to NPCs
                  </button>

                  <button
                    style={smallBtn('gold')}
                    onMouseEnter={smallBtnHover}
                    onMouseLeave={smallBtnLeave}
                    onMouseDown={navClick}
                    onClick={() => setCharView('detail')}
                  >
                    Back to {selectedChar.name}
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
              position: 'absolute',
              inset: 0,
              zIndex: 30,
              background: 'rgba(0,0,0,0.60)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setWorldNpcModalOpen(false);
            }}
          >
            <div
              style={{
                width: 'min(640px, 94vw)',
                borderRadius: 18,
                background: 'rgba(255,245,220,0.96)',
                boxShadow: '0 30px 90px rgba(0,0,0,0.65)',
                border: '1px solid rgba(0,0,0,0.12)',
                color: 'rgba(255,245,220,0.92)',
    fontFamily: "Cinzel, 'Trajan Pro', Georgia, serif",
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 'min(580px, 84vh)',
              }}
            >
              <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 950 }}>{editingWorldNpcId ? 'Edit World NPC' : 'Add World NPC'}</div>

                {/* ACTION: no nav sound */}
                <button style={smallBtn('danger')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => setWorldNpcModalOpen(false)}>
                  Close
                </button>
              </div>

              <div style={{ height: 1, background: 'rgba(0,0,0,0.10)' }} />

              <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignContent: 'start' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={fieldLabel}>Name</div>
                  <input
                    value={worldNpcDraft.name}
                    onChange={(e) => setWorldNpcDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="e.g. Captain Rell"
                    style={{ ...inputBase, fontWeight: 800 }}
                  />
                </div>

                <div>
                  <div style={fieldLabel}>Faction</div>
                  <input
                    value={worldNpcDraft.faction}
                    onChange={(e) => setWorldNpcDraft((d) => ({ ...d, faction: e.target.value }))}
                    placeholder="e.g. Church of Amiras"
                    style={inputBase}
                  />
                </div>

                <div>
                  <div style={fieldLabel}>Location</div>
                  <input
                    value={worldNpcDraft.location}
                    onChange={(e) => setWorldNpcDraft((d) => ({ ...d, location: e.target.value }))}
                    placeholder="e.g. Avalon"
                    style={inputBase}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={fieldLabel}>Bio / Notes</div>
                  <textarea
                    value={worldNpcDraft.bio}
                    onChange={(e) => setWorldNpcDraft((d) => ({ ...d, bio: e.target.value }))}
                    placeholder="Short summary, personality, hook, secrets…"
                    rows={5}
                    style={{
                      ...inputBase,
                      resize: 'none',
                      minHeight: 110,
                      maxHeight: 180,
                      lineHeight: 1.5,
                    }}
                  />
                </div>
              </div>

              <div style={{ padding: 12, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                {/* ACTIONS: no nav sound */}
                {editingWorldNpcId && (
                  <button
                    style={smallBtn('danger')}
                    onMouseEnter={smallBtnHover}
                    onMouseLeave={smallBtnLeave}
                    onClick={() => {
                      setWorldNpcModalOpen(false);
                      setEditingWorldNpcId(null);
                    }}
                  >
                    Cancel
                  </button>
                )}

                <button style={smallBtn('gold')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={saveWorldNpc}>
                  {editingWorldNpcId ? 'Save Changes' : 'Add NPC'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
