import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ShellLayout from './ShellLayout';
import styles from './CharacterBook.module.css';

// Character theme music — one import per character
// Place each MP3 in: src/assets/music/<filename>
import williamTheme from '../assets/music/William.mp3';
import arlisTheme from '../assets/music/Arlis.mp3';
import thryvTheme from '../assets/music/Thryvaris.mp3';
import fenTheme from '../assets/music/Fen.mp3';
import vonghulTheme from '../assets/music/VonGhul.mp3';
import castorTheme from '../assets/music/Castor.mp3';
import cerciTheme from '../assets/music/Cerci.mp3';
import jasperTheme from '../assets/music/Jasper.mp3';
import dmTheme from '../assets/music/Dm.mp3';

// Map character name → imported audio module
const CHAR_MUSIC_MAP = {
  'William Spicer': williamTheme,
  'Arlis Ghoth': arlisTheme,
  'Thryvaris Bria': thryvTheme,
  'Fen': fenTheme,
  "Von'Ghul": vonghulTheme,
  'Castor': castorTheme,
  'Cerci VonDonovon': cerciTheme,
  'Jasper Delancey': jasperTheme,
  'DM': dmTheme,
};

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

  // ambient audio control (tavern music + fire) passed from TavernMenu
  pauseAmbient,
  resumeAmbient,
}) {
  const navClick = playNav || playClick || (() => { });

  /* ---------- header measurement (prevents dead space above content) ---------- */
  const headerRef = useRef(null);
  const [headerH, setHeaderH] = useState(156);
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const measure = () => {
      const h = Math.ceil(el.getBoundingClientRect().height || 0);
      if (h) setHeaderH(h);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [selectedChar, selectedNpc, charView]);

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


  /* ---------- CHARACTER THEME PLAYER ---------- */
  // Single persistent <audio> element — never remounted, src swapped manually.
  const charAudioRef = useRef(null);
  const [charSongOn, setCharSongOn] = useState(false);
  const [charSongTime, setCharSongTime] = useState(0);
  const [charSongDur, setCharSongDur] = useState(0);
  const [charSongVol, setCharSongVol] = useState(0.50);

  // Derive src without useMemo so it never lags a render cycle
  const charSongSrc = selectedChar ? (CHAR_MUSIC_MAP[selectedChar.name] || null) : null;

  const fmtTime = (sec) => {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  // Swap track and auto-play whenever the selected character changes
  useEffect(() => {
    const a = charAudioRef.current;
    if (!a) return;
    a.pause();
    setCharSongOn(false);
    setCharSongTime(0);
    setCharSongDur(0);
    if (!charSongSrc) { a.src = ''; return; }
    a.src = charSongSrc;
    a.volume = charSongVol;
    // Auto-play as soon as enough data is buffered
    const onCanPlay = () => {
      a.play().then(() => setCharSongOn(true)).catch(() => setCharSongOn(false));
      a.removeEventListener('canplay', onCanPlay);
    };
    a.addEventListener('canplay', onCanPlay);
    a.load();
    return () => a.removeEventListener('canplay', onCanPlay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charSongSrc]);

  // Stop when leaving the character book entirely
  useEffect(() => {
    if (panelType !== 'characters') {
      const a = charAudioRef.current;
      if (a) { a.pause(); setCharSongOn(false); }
      // Restore ambient when leaving the character book
      resumeAmbient?.();
    }
  }, [panelType]);

  // Pause/resume ambient based on whether we're viewing a character profile
  useEffect(() => {
    const onProfile = panelType === 'characters' && ['detail', 'relations', 'npc'].includes(charView) && !!selectedChar && !!charSongSrc;
    if (onProfile) {
      pauseAmbient?.();
    } else {
      resumeAmbient?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelType, charView, selectedChar, charSongSrc]);

  // Keep volume in sync
  useEffect(() => {
    const a = charAudioRef.current;
    if (a) a.volume = Math.max(0, Math.min(1, Number(charSongVol) || 0));
  }, [charSongVol]);

  const toggleCharSong = () => {
    const a = charAudioRef.current;
    if (!a || !charSongSrc) return;
    if (a.paused) {
      a.play().then(() => setCharSongOn(true)).catch(() => setCharSongOn(false));
    } else {
      a.pause();
      setCharSongOn(false);
    }
  };

  /* ---------- styles ---------- */

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
  const LS_WORLD_NPC_DEEPLINK = 'koa:worldnpcs:deeplink:v1';
  const normalizeWorldNpc = (npc, idx = 0) => ({
    id: (npc?.id && String(npc.id)) || `worldnpc::${idx}::${npc?.name || 'npc'}`,
    name: npc?.name || '',
    age: npc?.age || '',
    faction: npc?.faction || '',
    occupation: npc?.occupation || '',
    location: npc?.location || '',
    summary: npc?.summary || npc?.bio || '',
    bio: npc?.bio || '',
    image: npc?.image || '',
    characterLinks: Array.isArray(npc?.characterLinks)
      ? npc.characterLinks
        .map((l) => ({
          characterName: (l?.characterName || '').trim(),
          relation: (l?.relation || '').trim(),
        }))
        .filter((l) => l.characterName)
      : [],
    links: Array.isArray(npc?.links)
      ? npc.links
        .map((l) => ({
          targetId: (l?.targetId && String(l.targetId)) || '',
          note: (l?.note || '').trim(),
        }))
        .filter((l) => l.targetId)
      : [],
    createdAt: npc?.createdAt || null,
    updatedAt: npc?.updatedAt || null,
  });

  const [worldNpcs, setWorldNpcs] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_WORLD_NPCS);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map((npc, idx) => normalizeWorldNpc(npc, idx)) : [];
    } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem(LS_WORLD_NPCS, JSON.stringify(worldNpcs)); } catch { }
  }, [worldNpcs]);

  const newId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const [npcFilterFaction, setNpcFilterFaction] = useState('All');
  const [npcFilterLocation, setNpcFilterLocation] = useState('All');
  const [npcSearch, setNpcSearch] = useState('');
  const WORLD_NPC_PAGE_SIZE = 5;
  const [worldNpcListMode, setWorldNpcListMode] = useState('paged'); // paged | all
  const [worldNpcPage, setWorldNpcPage] = useState(1);

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
        const linkedChars = (n.characterLinks || []).map((l) => l.characterName).join(' ');
        const hay = `${n.name || ''} ${n.age || ''} ${n.faction || ''} ${n.occupation || ''} ${n.location || ''} ${n.summary || ''} ${n.bio || ''} ${linkedChars}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [worldNpcs, npcFilterFaction, npcFilterLocation, npcSearch]);

  const worldNpcTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredWorldNpcs.length / WORLD_NPC_PAGE_SIZE)),
    [filteredWorldNpcs.length]
  );

  const visibleWorldNpcs = useMemo(() => {
    if (worldNpcListMode === 'all') return filteredWorldNpcs;
    const start = (worldNpcPage - 1) * WORLD_NPC_PAGE_SIZE;
    return filteredWorldNpcs.slice(start, start + WORLD_NPC_PAGE_SIZE);
  }, [filteredWorldNpcs, worldNpcListMode, worldNpcPage]);

  const worldNpcRangeLabel = useMemo(() => {
    if (!filteredWorldNpcs.length) return 'Showing 0 of 0';
    if (worldNpcListMode === 'all') return `Showing 1-${filteredWorldNpcs.length} of ${filteredWorldNpcs.length}`;
    const start = (worldNpcPage - 1) * WORLD_NPC_PAGE_SIZE + 1;
    const end = Math.min(filteredWorldNpcs.length, worldNpcPage * WORLD_NPC_PAGE_SIZE);
    return `Showing ${start}-${end} of ${filteredWorldNpcs.length}`;
  }, [filteredWorldNpcs.length, worldNpcListMode, worldNpcPage]);

  useEffect(() => {
    setWorldNpcPage(1);
  }, [npcFilterFaction, npcFilterLocation, npcSearch, worldNpcListMode]);

  useEffect(() => {
    setWorldNpcPage((p) => Math.min(Math.max(1, p), worldNpcTotalPages));
  }, [worldNpcTotalPages]);

  const [worldNpcModalOpen, setWorldNpcModalOpen] = useState(false);
  const [connectionWebModalOpen, setConnectionWebModalOpen] = useState(false);
  const [editingWorldNpcId, setEditingWorldNpcId] = useState(null);
  const [worldNpcDraft, setWorldNpcDraft] = useState({
    name: '',
    age: '',
    faction: '',
    occupation: '',
    location: '',
    summary: '',
    bio: '',
    image: '',
    characterLinks: [],
    links: [],
  });
  const [worldNpcCharSearch, setWorldNpcCharSearch] = useState('');
  const [worldNpcConnectionSearch, setWorldNpcConnectionSearch] = useState('');

  // Image cropper (simple, no external libs)
  const [worldNpcCropOpen, setWorldNpcCropOpen] = useState(false);
  const [worldNpcCropSrc, setWorldNpcCropSrc] = useState('');
  const [worldNpcCropZoom, setWorldNpcCropZoom] = useState(1);
  const [worldNpcCropBaseScale, setWorldNpcCropBaseScale] = useState(1);
  const [worldNpcCropOffset, setWorldNpcCropOffset] = useState({ x: 0, y: 0 });
  const worldNpcCropImgRef = useRef(null);
  const worldNpcCropDragRef = useRef({ dragging: false, sx: 0, sy: 0, ox: 0, oy: 0, iw: 0, ih: 0 });
  const WORLD_NPC_CROP_BOX = 260; // px



  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  const clampCropOffset = () => {
    const img = worldNpcCropImgRef.current;
    if (!img) return;
    const iw = img.naturalWidth || 1;
    const ih = img.naturalHeight || 1;
    const base = Math.max(WORLD_NPC_CROP_BOX / iw, WORLD_NPC_CROP_BOX / ih); // cover
    const scale = base * worldNpcCropZoom;
    const rw = iw * scale;
    const rh = ih * scale;
    const maxX = Math.max(0, (rw - WORLD_NPC_CROP_BOX) / 2);
    const maxY = Math.max(0, (rh - WORLD_NPC_CROP_BOX) / 2);
    setWorldNpcCropOffset((o) => ({ x: clamp(o.x, -maxX, maxX), y: clamp(o.y, -maxY, maxY) }));
  };

  const onWorldNpcImagePick = (file) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) { alert('Please choose an image file.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      // Open cropper first (user confirms before it becomes the NPC image)
      setWorldNpcCropSrc(dataUrl);
      setWorldNpcCropZoom(1);
      setWorldNpcCropBaseScale(1);
      setWorldNpcCropOffset({ x: 0, y: 0 });
      setWorldNpcCropOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const applyWorldNpcCrop = () => {
    const img = worldNpcCropImgRef.current;
    if (!img) return;

    const iw = img.naturalWidth || 1;
    const ih = img.naturalHeight || 1;

    const base = Math.max(WORLD_NPC_CROP_BOX / iw, WORLD_NPC_CROP_BOX / ih); // cover
    const scale = base * worldNpcCropZoom;

    const rw = iw * scale;
    const rh = ih * scale;

    const imgLeft = (WORLD_NPC_CROP_BOX / 2) - (rw / 2) + worldNpcCropOffset.x;
    const imgTop = (WORLD_NPC_CROP_BOX / 2) - (rh / 2) + worldNpcCropOffset.y;

    // Source rect in original image coords that maps to the crop box
    let sx = (-imgLeft) / scale;
    let sy = (-imgTop) / scale;
    const sw = WORLD_NPC_CROP_BOX / scale;
    const sh = WORLD_NPC_CROP_BOX / scale;

    // Clamp to bounds
    sx = clamp(sx, 0, Math.max(0, iw - sw));
    sy = clamp(sy, 0, Math.max(0, ih - sh));

    const out = 256;
    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, out, out);

    const dataUrl = canvas.toDataURL('image/png');
    setWorldNpcDraft((d) => ({ ...d, image: dataUrl }));
    setWorldNpcCropOpen(false);
  };

  const openAddWorldNpc = () => {
    setEditingWorldNpcId(null);
    setWorldNpcDraft({
      name: '',
      age: '',
      faction: '',
      occupation: '',
      location: '',
      summary: '',
      bio: '',
      image: '',
      characterLinks: [],
      links: [],
    });
    setWorldNpcCharSearch('');
    setWorldNpcConnectionSearch('');
    setWorldNpcModalOpen(true);
  };

  const openEditWorldNpc = (npc) => {
    const normalized = normalizeWorldNpc(npc, 0);
    setEditingWorldNpcId(normalized.id);
    setWorldNpcDraft({
      name: normalized.name || '',
      age: normalized.age || '',
      faction: normalized.faction || '',
      occupation: normalized.occupation || '',
      location: normalized.location || '',
      summary: normalized.summary || '',
      bio: normalized.bio || '',
      image: normalized.image || '',
      characterLinks: normalized.characterLinks || [],
      links: normalized.links || [],
    });
    setWorldNpcCharSearch('');
    setWorldNpcConnectionSearch('');
    setWorldNpcModalOpen(true);
  };

  const saveWorldNpc = () => {
    const name = (worldNpcDraft.name || '').trim();
    if (!name) { alert('NPC needs a name.'); return; }
    if (!editingWorldNpcId) {
      const npc = {
        id: newId(), name,
        age: (worldNpcDraft.age || '').trim(),
        faction: (worldNpcDraft.faction || '').trim(),
        occupation: (worldNpcDraft.occupation || '').trim(),
        location: (worldNpcDraft.location || '').trim(),
        summary: (worldNpcDraft.summary || '').trim(),
        bio: (worldNpcDraft.bio || '').trim(),
        image: (worldNpcDraft.image || ''),
        characterLinks: (worldNpcDraft.characterLinks || [])
          .map((l) => ({ characterName: (l.characterName || '').trim(), relation: (l.relation || '').trim() }))
          .filter((l) => l.characterName),
        links: (worldNpcDraft.links || [])
          .map((l) => ({ targetId: (l.targetId && String(l.targetId)) || '', note: (l.note || '').trim() }))
          .filter((l) => l.targetId),
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
              age: (worldNpcDraft.age || '').trim(),
              faction: (worldNpcDraft.faction || '').trim(),
              occupation: (worldNpcDraft.occupation || '').trim(),
              location: (worldNpcDraft.location || '').trim(),
              summary: (worldNpcDraft.summary || '').trim(),
              bio: (worldNpcDraft.bio || '').trim(),
              image: (worldNpcDraft.image || ''),
              characterLinks: (worldNpcDraft.characterLinks || [])
                .map((l) => ({ characterName: (l.characterName || '').trim(), relation: (l.relation || '').trim() }))
                .filter((l) => l.characterName),
              links: (worldNpcDraft.links || [])
                .map((l) => ({ targetId: (l.targetId && String(l.targetId)) || '', note: (l.note || '').trim() }))
                .filter((l) => l.targetId),
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
      name: 'William Spicer',
      image: '/characters/Will.png',
      synopsis: 'I will bring down a god.',
      age: '22', height: "5'11\"", class: 'Fiend Warlock',
      lore: 'Once a frail and broken child, William survived tragedy and entered a dark pact that reshaped his destiny. Haunted by loss and guided by unseen forces, he walks the line between salvation and damnation.',
      goals: 'Break the Pact that binds Ryken to him and Arlis.',
      npcs: [
        { name: 'Darius Blanc', relation: 'Father', bio: 'A strict man who despised magic. His death during the Oakhaven raid left a scar on William that never healed.' },
        { name: 'Eleanore VanFalen', relation: 'Mother', bio: 'William was told she died in childbirth. Ryken had promised to uncover his past, but has yet to do so.' },
        { name: 'Tarzos Spicer', relation: 'Savior / Mentor', bio: 'The one man who saved William during the raid, thought to be dead. Now he has reappeared in Williams life as one of the main members of the Velvet Rose.' },
        { name: 'Ryken', relation: 'Patron', bio: "A force of bargain and consequence. The god of misery, his followers believe that misery is a truth that should be spread." },
        { name: 'Liranda', relation: 'The Hag', bio: "At first glance, she was a sweet old lady looking to help. That all changed when she tricked him and split his mind, forever altering his and Castors future." },
      ],
    },
    {
      name: 'Arlis Ghoth',
      image: arlisImgA,
      synopsis: 'A cunning and graceful adventurer.',
      age: '24', height: "5'8\"", class: 'Cleric',
      lore: 'A childhood friend thought lost, Arlis carries quiet feelings and a sharp mind. Her path has always curved back toward William.',
      goals: 'Reveal the truth of her heart—and survive the journey.',
      npcs: [
        { name: 'House Ghoth', relation: 'Family', bio: 'A respected family with expectations that never stop. Arlis learned early: appearances are armor.' },
      ],
    },
    {
      name: 'Thryvaris Bria',
      image: '/characters/3V.png',
      synopsis: 'A mysterious mage with that lives in a cave.',
      age: "Early 20's", height: "6'1\"",
      class: 'Sorcerer',
      lore: 'Little is known of Thryvaris beyond his mysterious paintbrush.',
      goals: 'Live in peace in the mountains',
      npcs: [{ name: 'Mezzarack', relation: 'Professor', bio: 'The man who has lost his family to time. Had a hand in kicking a certain sorcerer out of the academy.' }],
    },
    {
      name: 'Fen', image: '/characters/Fen.png',
      synopsis: 'A 1 armed goliath, that also wields a flail attached. ',
      age: 'Late-20s', height: "6'7\"", class: 'Barbarian',
      lore: 'Exiled from her tribe, Fen walks a lonely path back to redemption.',
      goals: 'Become the new chief of the Uk\'Vahlee',
      npcs: [
        { name: 'Warchief Jovan', relation: 'Leaders of the Uk\'Vahlee', bio: 'Little is known about the Warchief. But the rumors are true that he belives in taking blood no matter the cost.' },
        { name: 'Warchieftess Threna', relation: 'Leaders of the Uk\'Vahlee', bio: 'Banished Fen after her bout with her brother for not obeying tradition.' },
      ],
    },
    {
      name: "Von'Ghul", image: '/characters/Ghuli.png',
      synopsis: 'Selfish, cunning, and brilliant. He makes sure to get the job done.',
      age: "Late 20's", height: "6'2\"", class: 'Artificer',
      lore: 'A half orc inventor that uses his mysterious artifact dubbed as "Stryker". He joined the group with Castor on their way to Avalon.',
      goals: 'Unknown',
      npcs: [
        { name: 'The Valkesh', relation: 'Clan',   bio: 'The village that VonGhul originally hailed from. He said he left on bad terms, and is now making his way back to redemption.' },
        { name: 'Velo',        relation: 'Friend', bio: 'Little is known about the mysterious goblin hailed from Skolak. Von\'Ghul seemed upset at the news of his passing.' },
        { name: 'Steely',        relation: 'Servant', bio: 'The automaton that was handbuilt from the genius himself. Steely has been a loyal protector and sidekick.' }

      ],
    },
    {
      name: 'Castor', image: '/characters/Castor.png',
      synopsis: 'Split from Williams mind, he knows more than he lets others on.',
      age: '21', height: "5'10\"", class: 'Warlock',
      lore: 'Born from fractured identity and dark magic, Castor walks as his own person—protective, intense, and deeply loyal to the few he trusts.',
      goals: 'Protect his friends and prove he deserves to exist.',
      npcs: [
        { name: 'Vykell', relation: 'Mentor', bio: 'Taught Castor how to survive when survival was all he had. Practical lessons, brutal honesty.' },
      ],
    },
    {
      name: 'Cerci VonDonovon',
      image: '/characters/Cerci.png',
      synopsis: 'Once a nimble and agile circus performer, now hero.',
      age: 'Appears early-20s', height: "5'6\"", class: 'Monk, Rougue',
      lore: 'Having spent decades in isolation and survival, Cerci hides decades of pain beneath quiet shadows. Her bond with the party is seemingly the only thing keeping her from returning to a life of solitude and cruelty.',
      goals: 'To end her family bloodline and find solace for the Salvatores.',
      npcs: [
        { name: 'Bingo', relation: 'Ex-Boss', bio: "A familiar face from Cerci's circus years—past comfort, part reminder that her debt will hang over head until fulfilled." },
        { name: 'Von\'Donovons', relation: 'Family', bio: 'An extremely powerful family that resides in the the Forest. Much is to be said of their influence anywhere, but everyone knows that will just get you killed.' },
      ],
    },
    {
      name: 'Jasper Delancey',
      image: '/characters/Jasper.png',
      synopsis: 'A cleric hailing from the Golden Isles.',
      age: '30',
      height: "6'1\"",
      class: 'Cleric',
      lore: 'Joined the Envoy of Avalon entourage much later.',
      goals: 'Unknown',
      npcs: [

      ],
    },
    {
      name: 'DM',
      image: '/characters/DM.png',
      synopsis: 'One Who Rules All',
      age: '??',
      height: '??',
      class: 'Everything',
      lore: 'An omnipotent god that creates and destroys at will. Able to displace time and remove it completely.',
      goals: 'World Destruction',
      npcs: [],
    },
  ];

  const LS_CHAR_NPCS = 'koa:char:npcs:v1';

  const normalizeRelatedNpc = (npc, charName, idx = 0) => ({
    id: (npc?.id && String(npc.id)) || `${charName}::${npc?.name || 'npc'}::${idx}`,
    name: npc?.name || '',
    relation: npc?.relation || '',
    age: npc?.age || '',
    faction: npc?.faction || '',
    occupation: npc?.occupation || '',
    summary: npc?.summary || npc?.bio || '',
    bio: npc?.bio || '',
    image: npc?.image || '',
    source: npc?.source || 'character',
    worldNpcId: npc?.worldNpcId || null,
  });

  const [charNpcByCharacter, setCharNpcByCharacter] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_CHAR_NPCS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try { localStorage.setItem(LS_CHAR_NPCS, JSON.stringify(charNpcByCharacter)); } catch { }
  }, [charNpcByCharacter]);

  const getBaseRelatedNpcs = (char) => {
    if (!char) return [];
    return (char.npcs || []).map((npc, idx) => normalizeRelatedNpc(npc, char.name, idx));
  };

  const getCharacterOwnedNpcs = (char, store = charNpcByCharacter) => {
    if (!char) return [];
    const saved = store?.[char.name];
    if (Array.isArray(saved)) return saved.map((npc, idx) => normalizeRelatedNpc(npc, char.name, idx));
    return getBaseRelatedNpcs(char);
  };

  const worldLinkedNpcsByCharacter = useMemo(() => {
    const map = {};
    (worldNpcs || []).forEach((wNpc, wIdx) => {
      const normalizedWorld = normalizeWorldNpc(wNpc, wIdx);
      (normalizedWorld.characterLinks || []).forEach((link, lIdx) => {
        const charName = (link.characterName || '').trim();
        if (!charName) return;
        const projected = normalizeRelatedNpc({
          id: `worldlink::${normalizedWorld.id}::${charName}::${lIdx}`,
          name: normalizedWorld.name,
          relation: (link.relation || '').trim() || 'Related NPC',
          age: normalizedWorld.age || '',
          faction: normalizedWorld.faction || '',
          occupation: normalizedWorld.occupation || '',
          summary: normalizedWorld.summary || normalizedWorld.bio || '',
          bio: normalizedWorld.bio || '',
          image: normalizedWorld.image || '',
          source: 'world',
          worldNpcId: normalizedWorld.id,
        }, charName, lIdx);
        if (!map[charName]) map[charName] = [];
        map[charName].push(projected);
      });
    });
    return map;
  }, [worldNpcs]);

  const getRelatedNpcsForCharacter = (char, store = charNpcByCharacter) => {
    const owned = getCharacterOwnedNpcs(char, store);
    if (!char) return [];
    const linked = worldLinkedNpcsByCharacter[char.name] || [];
    if (!linked.length) return owned;

    const hasMatch = (candidate) => owned.some((npc) =>
      (candidate.worldNpcId && npc.worldNpcId && candidate.worldNpcId === npc.worldNpcId) ||
      ((candidate.name || '').trim().toLowerCase() && (npc.name || '').trim().toLowerCase() === (candidate.name || '').trim().toLowerCase())
    );

    const merged = [...owned];
    linked.forEach((candidate) => {
      if (!hasMatch(candidate)) merged.push(candidate);
    });
    return merged;
  };

  const selectedCharNpcs = useMemo(
    () => getRelatedNpcsForCharacter(selectedChar),
    [selectedChar, charNpcByCharacter, worldLinkedNpcsByCharacter]
  );

  const activeSelectedNpc = useMemo(() => {
    if (!selectedNpc) return null;
    const isWorldLinked = selectedNpc.source === 'world' || !!selectedNpc.worldNpcId;
    if (!selectedCharNpcs.length) return isWorldLinked ? null : selectedNpc;
    if (selectedNpc.id) {
      const byId = selectedCharNpcs.find((npc) => npc.id === selectedNpc.id);
      if (byId) return byId;
    }
    const byName = selectedCharNpcs.find((npc) => npc.name === selectedNpc.name);
    if (byName) return byName;
    return isWorldLinked ? null : selectedNpc;
  }, [selectedNpc, selectedCharNpcs]);

  useEffect(() => {
    if (charView === 'npc' && selectedChar && !activeSelectedNpc) {
      setSelectedNpc(null);
      setCharView('relations');
    }
  }, [charView, selectedChar, activeSelectedNpc, setSelectedNpc, setCharView]);

  const [charNpcModalOpen, setCharNpcModalOpen] = useState(false);
  const [editingCharNpcId, setEditingCharNpcId] = useState(null);
  const [charNpcDraft, setCharNpcDraft] = useState({
    name: '',
    relation: '',
    age: '',
    faction: '',
    occupation: '',
    summary: '',
    bio: '',
    image: '',
  });

  const closeCharNpcModal = () => {
    setCharNpcModalOpen(false);
    setEditingCharNpcId(null);
  };

  useEffect(() => {
    const anyModalOpen =
      worldNpcCropOpen ||
      charNpcModalOpen ||
      worldNpcModalOpen ||
      connectionWebModalOpen;
    if (!anyModalOpen) return;

    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (worldNpcCropOpen) {
        setWorldNpcCropOpen(false);
        return;
      }
      if (charNpcModalOpen) {
        setCharNpcModalOpen(false);
        setEditingCharNpcId(null);
        return;
      }
      if (worldNpcModalOpen) {
        setWorldNpcModalOpen(false);
        return;
      }
      if (connectionWebModalOpen) {
        setConnectionWebModalOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [worldNpcCropOpen, charNpcModalOpen, worldNpcModalOpen, connectionWebModalOpen]);

  const openAddCharNpc = () => {
    if (!selectedChar) return;
    setEditingCharNpcId(null);
    setCharNpcDraft({ name: '', relation: '', age: '', faction: '', occupation: '', summary: '', bio: '', image: '' });
    setCharNpcModalOpen(true);
  };

  const openEditCharNpc = (npc) => {
    if (!selectedChar || !npc) return;
    const normalized = normalizeRelatedNpc(npc, selectedChar.name, 0);
    setEditingCharNpcId(normalized.id);
    setCharNpcDraft({
      name: normalized.name || '',
      relation: normalized.relation || '',
      age: normalized.age || '',
      faction: normalized.faction || '',
      occupation: normalized.occupation || '',
      summary: normalized.summary || normalized.bio || '',
      bio: normalized.bio || '',
      image: normalized.image || '',
    });
    setCharNpcModalOpen(true);
  };

  const onCharNpcImagePick = (file) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      setCharNpcDraft((d) => ({ ...d, image: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const saveCharNpc = () => {
    if (!selectedChar) return;
    const name = (charNpcDraft.name || '').trim();
    if (!name) {
      alert('NPC needs a name.');
      return;
    }
    const nextNpc = {
      id: editingCharNpcId || newId(),
      name,
      relation: (charNpcDraft.relation || '').trim(),
      age: (charNpcDraft.age || '').trim(),
      faction: (charNpcDraft.faction || '').trim(),
      occupation: (charNpcDraft.occupation || '').trim(),
      summary: (charNpcDraft.summary || '').trim(),
      bio: (charNpcDraft.bio || '').trim(),
      image: charNpcDraft.image || '',
    };

    setCharNpcByCharacter((prev) => {
      const current = getCharacterOwnedNpcs(selectedChar, prev);
      const nextList = editingCharNpcId
        ? current.map((npc) => (npc.id === editingCharNpcId ? nextNpc : npc))
        : [nextNpc, ...current];
      return { ...prev, [selectedChar.name]: nextList };
    });

    setSelectedNpc(nextNpc);
    setCharView('npc');
    closeCharNpcModal();
  };

  const deleteCharNpc = () => {
    if (!selectedChar || !editingCharNpcId) return;
    if (!confirm('Delete this NPC?')) return;

    setCharNpcByCharacter((prev) => {
      const current = getCharacterOwnedNpcs(selectedChar, prev);
      const nextList = current.filter((npc) => npc.id !== editingCharNpcId);
      return { ...prev, [selectedChar.name]: nextList };
    });

    if (selectedNpc?.id === editingCharNpcId) {
      setSelectedNpc(null);
      setCharView('relations');
    }
    closeCharNpcModal();
  };

  const characterNames = useMemo(
    () => characters.map((c) => c.name),
    [characters]
  );

  const toggleWorldNpcCharacterLink = (characterName) => {
    setWorldNpcDraft((d) => {
      const current = Array.isArray(d.characterLinks) ? d.characterLinks : [];
      const exists = current.some((l) => l.characterName === characterName);
      const next = exists
        ? current.filter((l) => l.characterName !== characterName)
        : [...current, { characterName, relation: '' }];
      return { ...d, characterLinks: next };
    });
  };

  const setWorldNpcCharacterRelation = (characterName, relation) => {
    setWorldNpcDraft((d) => {
      const current = Array.isArray(d.characterLinks) ? d.characterLinks : [];
      const next = current.map((l) =>
        l.characterName === characterName ? { ...l, relation } : l
      );
      return { ...d, characterLinks: next };
    });
  };

  const toggleWorldNpcConnection = (targetId) => {
    const target = String(targetId || '');
    if (!target) return;
    setWorldNpcDraft((d) => {
      const current = Array.isArray(d.links) ? d.links : [];
      const exists = current.some((l) => String(l.targetId) === target);
      const next = exists
        ? current.filter((l) => String(l.targetId) !== target)
        : [...current, { targetId: target, note: '' }];
      return { ...d, links: next };
    });
  };

  const setWorldNpcConnectionNote = (targetId, note) => {
    const target = String(targetId || '');
    if (!target) return;
    setWorldNpcDraft((d) => {
      const current = Array.isArray(d.links) ? d.links : [];
      const next = current.map((l) =>
        String(l.targetId) === target ? { ...l, note } : l
      );
      return { ...d, links: next };
    });
  };

  const npcNameKey = (name) => (name || '').trim().toLowerCase();

  const normalizeCharacterLinks = (links) =>
    (Array.isArray(links) ? links : [])
      .map((l) => ({
        characterName: (l?.characterName || '').trim(),
        relation: (l?.relation || '').trim(),
      }))
      .filter((l) => l.characterName);

  const areCharacterLinksEqual = (a, b) => {
    const aa = normalizeCharacterLinks(a);
    const bb = normalizeCharacterLinks(b);
    if (aa.length !== bb.length) return false;
    for (let i = 0; i < aa.length; i += 1) {
      if (aa[i].characterName !== bb[i].characterName) return false;
      if ((aa[i].relation || '') !== (bb[i].relation || '')) return false;
    }
    return true;
  };

  const importCharacterNpcsIntoWorld = () => {
    const seedsByName = new Map();

    characters.forEach((char) => {
      const owned = getCharacterOwnedNpcs(char);
      owned.forEach((npc) => {
        const name = (npc.name || '').trim();
        if (!name) return;
        const key = npcNameKey(name);
        const prev = seedsByName.get(key) || {
          name,
          age: '',
          faction: '',
          occupation: '',
          location: '',
          summary: '',
          bio: '',
          image: '',
          characterLinks: [],
          links: [],
        };
        if (!prev.age && npc.age) prev.age = (npc.age || '').trim();
        if (!prev.faction && npc.faction) prev.faction = (npc.faction || '').trim();
        if (!prev.occupation && npc.occupation) prev.occupation = (npc.occupation || '').trim();
        if (!prev.summary && (npc.summary || npc.bio)) prev.summary = (npc.summary || npc.bio || '').trim();
        if (!prev.bio && npc.bio) prev.bio = (npc.bio || '').trim();
        if (!prev.image && npc.image) prev.image = npc.image;
        if (!prev.characterLinks.some((l) => l.characterName === char.name)) {
          prev.characterLinks.push({
            characterName: char.name,
            relation: (npc.relation || '').trim() || 'Related NPC',
          });
        }
        seedsByName.set(key, prev);
      });
    });

    setWorldNpcs((prev) => {
      const nowIso = new Date().toISOString();
      const next = (prev || []).map((npc, idx) => normalizeWorldNpc(npc, idx));
      let changed = false;

      seedsByName.forEach((seed, key) => {
        const idx = next.findIndex((n) => npcNameKey(n.name) === key);
        if (idx < 0) {
          next.push(normalizeWorldNpc({
            ...seed,
            id: newId(),
            createdAt: nowIso,
            updatedAt: nowIso,
          }, next.length));
          changed = true;
          return;
        }
        const cur = normalizeWorldNpc(next[idx], idx);
        let rowChanged = false;

        const seedCharLinks = normalizeCharacterLinks(seed.characterLinks);
        const curByCharacter = new Map(
          normalizeCharacterLinks(cur.characterLinks).map((l) => [l.characterName, l.relation])
        );
        const syncedCharLinks = seedCharLinks.map((l) => ({
          characterName: l.characterName,
          relation: curByCharacter.get(l.characterName) || l.relation || 'Related NPC',
        }));

        const patch = {};
        if (!cur.age && seed.age) { patch.age = seed.age; rowChanged = true; }
        if (!cur.faction && seed.faction) { patch.faction = seed.faction; rowChanged = true; }
        if (!cur.occupation && seed.occupation) { patch.occupation = seed.occupation; rowChanged = true; }
        if (!cur.summary && seed.summary) { patch.summary = seed.summary; rowChanged = true; }
        if (!cur.bio && seed.bio) { patch.bio = seed.bio; rowChanged = true; }
        if (!cur.image && seed.image) { patch.image = seed.image; rowChanged = true; }
        if (!areCharacterLinksEqual(cur.characterLinks, syncedCharLinks)) {
          patch.characterLinks = syncedCharLinks;
          rowChanged = true;
        }

        if (rowChanged) {
          next[idx] = {
            ...cur,
            ...patch,
            updatedAt: nowIso,
          };
          changed = true;
        }
      });

      // Prune stale imported NPCs: linked world NPC rows whose names are no longer in any character profile list.
      const staleIds = new Set();
      next.forEach((npc, idx) => {
        const normalized = normalizeWorldNpc(npc, idx);
        const hasProfileMatch = seedsByName.has(npcNameKey(normalized.name));
        if (!hasProfileMatch && normalizeCharacterLinks(normalized.characterLinks).length > 0) {
          staleIds.add(String(normalized.id));
        }
      });

      if (staleIds.size > 0) {
        changed = true;
        return next
          .filter((npc) => !staleIds.has(String(npc.id)))
          .map((npc, idx) => {
            const normalized = normalizeWorldNpc(npc, idx);
            const links = Array.isArray(normalized.links) ? normalized.links : [];
            const filteredLinks = links.filter((l) => !staleIds.has(String(l.targetId)));
            if (filteredLinks.length === links.length) return normalized;
            return { ...normalized, links: filteredLinks, updatedAt: nowIso };
          });
      }

      return changed ? next : prev;
    });
  };

  useEffect(() => {
    if (charView === 'worldnpcs') {
      importCharacterNpcsIntoWorld();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charView]);

  useEffect(() => {
    if (charView !== 'worldnpcs') setConnectionWebModalOpen(false);
  }, [charView]);

  useEffect(() => {
    if (charView !== 'worldnpcs') return;
    let payload = null;
    try {
      const raw = localStorage.getItem(LS_WORLD_NPC_DEEPLINK);
      if (!raw) return;
      payload = JSON.parse(raw);
      localStorage.removeItem(LS_WORLD_NPC_DEEPLINK);
    } catch {
      return;
    }

    const incomingFaction = (payload?.faction || '').trim();
    const incomingSearch = (payload?.search || '').trim();
    const safeFaction = incomingFaction && factions.includes(incomingFaction) ? incomingFaction : 'All';

    setNpcFilterLocation('All');
    setNpcFilterFaction(safeFaction);
    setNpcSearch(incomingSearch);
    setWorldNpcListMode('paged');
    setWorldNpcPage(1);
  }, [charView, factions]);

  const worldNpcById = useMemo(() => {
    const out = {};
    (worldNpcs || []).forEach((n, idx) => {
      const normalized = normalizeWorldNpc(n, idx);
      out[normalized.id] = normalized;
    });
    return out;
  }, [worldNpcs]);

  const openNpcEditorFromRelation = (npc) => {
    if (!npc) return;
    if (npc.source === 'world' || npc.worldNpcId) {
      const target = (worldNpcs || []).find((w) => w.id === npc.worldNpcId) || (worldNpcs || []).find((w) => w.id === npc.id);
      if (target) {
        openEditWorldNpc(target);
        return;
      }
    }
    openEditCharNpc(npc);
  };

  const connectionWeb = useMemo(() => {
    const worldList = (worldNpcs || []).map((n, idx) => normalizeWorldNpc(n, idx));
    const charSet = new Set();
    worldList.forEach((n) => {
      (n.characterLinks || []).forEach((l) => {
        const charName = (l.characterName || '').trim();
        if (charName) charSet.add(charName);
      });
    });
    const charList = Array.from(charSet).sort((a, b) => a.localeCompare(b));
    if (!worldList.length && !charList.length) return { nodes: [], edges: [], nodeById: {} };

    const WORLD_TOP = 30;
    const WORLD_BOTTOM = 90;
    const CHAR_Y = 15;
    const MIN_X = 8;
    const MAX_X = 92;

    const hasUnlinked = worldList.some(
      (n) => !(n.characterLinks || []).some((l) => (l.characterName || '').trim())
    );

    const columnKeys = [...charList];
    if (hasUnlinked) columnKeys.push('__unlinked__');
    const columnCount = Math.max(1, columnKeys.length);
    const xAt = (idx) =>
      (columnCount === 1 ? 50 : MIN_X + ((MAX_X - MIN_X) * idx) / (columnCount - 1));

    const columnX = {};
    columnKeys.forEach((key, idx) => {
      columnX[key] = xAt(idx);
    });

    const charNodes = charList.map((name) => ({
      id: `char:${name}`,
      type: 'character',
      label: name,
      x: columnX[name] ?? 50,
      y: CHAR_Y,
    }));

    const buckets = {};
    columnKeys.forEach((key) => {
      buckets[key] = [];
    });
    const charLoad = {};
    charList.forEach((name) => {
      charLoad[name] = 0;
    });

    const sortedWorld = [...worldList].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    sortedWorld.forEach((npc) => {
      const linkedChars = (npc.characterLinks || [])
        .map((l) => (l.characterName || '').trim())
        .filter((name) => charSet.has(name));

      let bucketKey = '__unlinked__';
      if (linkedChars.length > 0) {
        bucketKey = [...linkedChars].sort(
          (a, b) => (charLoad[a] || 0) - (charLoad[b] || 0) || a.localeCompare(b)
        )[0];
        charLoad[bucketKey] = (charLoad[bucketKey] || 0) + 1;
      }
      if (!buckets[bucketKey]) buckets[bucketKey] = [];
      buckets[bucketKey].push(npc);
    });

    const worldNodes = [];
    Object.entries(buckets).forEach(([bucketKey, list]) => {
      const count = list.length;
      if (!count) return;
      list.forEach((npc, idx) => {
        const t = count === 1 ? 0.5 : idx / (count - 1);
        const y = WORLD_TOP + t * (WORLD_BOTTOM - WORLD_TOP);
        const wobble = (idx % 2 === 0 ? -1 : 1) * Math.min(2.4, Math.floor((idx + 1) / 2) * 0.8);
        const x = Math.max(MIN_X, Math.min(MAX_X, (columnX[bucketKey] ?? 50) + wobble));
        worldNodes.push({
          id: `world:${npc.id}`,
          type: 'world',
          label: npc.name || 'NPC',
          x,
          y,
        });
      });
    });

    const nodes = [...worldNodes, ...charNodes];
    const nodeById = {};
    nodes.forEach((n) => {
      nodeById[n.id] = n;
    });

    const hash = (s) => {
      let h = 0;
      for (let i = 0; i < s.length; i += 1) h = ((h * 31) + s.charCodeAt(i)) | 0;
      return h;
    };

    const makePath = (from, to, type, seedKey) => {
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const sign = hash(seedKey) % 2 === 0 ? 1 : -1;
      const bendBase = type === 'character'
        ? Math.min(8, Math.max(2.6, len * 0.14))
        : Math.min(12, Math.max(3.4, len * 0.18));
      const bend = bendBase * sign;
      const cx = midX + nx * bend;
      const cy = type === 'character'
        ? Math.min(midY - 4, from.y - 6 + ny * bend)
        : midY + ny * bend;
      return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
    };

    const edges = [];
    const seenNpcPairs = new Set();

    worldList.forEach((n) => {
      const from = `world:${n.id}`;
      if (!nodeById[from]) return;

      (n.links || []).forEach((l) => {
        const to = `world:${l.targetId}`;
        if (!nodeById[to]) return;
        const pairKey = [from, to].sort().join('::');
        if (seenNpcPairs.has(pairKey)) return;
        seenNpcPairs.add(pairKey);
        edges.push({
          from,
          to,
          type: 'npc',
          note: l.note || '',
          d: makePath(nodeById[from], nodeById[to], 'npc', pairKey),
        });
      });

      (n.characterLinks || []).forEach((l, idx) => {
        const charName = (l.characterName || '').trim();
        if (!charName) return;
        const to = `char:${charName}`;
        if (!nodeById[to]) return;
        const edgeKey = `${from}::${to}::${idx}`;
        edges.push({
          from,
          to,
          type: 'character',
          note: l.relation || '',
          d: makePath(nodeById[from], nodeById[to], 'character', edgeKey),
        });
      });
    });

    return { nodes, edges, nodeById };
  }, [worldNpcs]);

  const worldNpcConnectionTargets = useMemo(
    () => (worldNpcs || []).filter((n) => n.id !== editingWorldNpcId),
    [worldNpcs, editingWorldNpcId]
  );
  const filteredWorldNpcCharacterNames = useMemo(() => {
    const q = (worldNpcCharSearch || '').trim().toLowerCase();
    if (!q) return characterNames;
    return characterNames.filter((name) => (name || '').toLowerCase().includes(q));
  }, [characterNames, worldNpcCharSearch]);
  const filteredWorldNpcConnectionTargets = useMemo(() => {
    const q = (worldNpcConnectionSearch || '').trim().toLowerCase();
    if (!q) return worldNpcConnectionTargets;
    return worldNpcConnectionTargets.filter((target) => (target.name || '').toLowerCase().includes(q));
  }, [worldNpcConnectionTargets, worldNpcConnectionSearch]);

  const partyMateNames = useMemo(() => {
    if (!selectedChar) return [];
    return characters.map((c) => c.name).filter((n) => n !== selectedChar.name);
  }, [selectedChar, characters]);

  const showProfileTab = !!selectedChar && (charView === 'detail' || charView === 'relations' || charView === 'npc');
  const showRelationsTab = !!selectedChar && (charView === 'relations' || charView === 'npc' || charView === 'detail');
  const showNpcTab = !!selectedNpc;
  const showWorldNpcTab = charView === 'worldnpcs';

  return (
    <ShellLayout
      active={panelType === 'characters'}
      style={{ alignItems: 'stretch', justifyContent: 'stretch' }}
    >
      <div className={styles.cardShell}>
        {/* Edge glow */}
        <div className={styles.edgeGlow} />

        {/* Header */}
        <div ref={headerRef} className={`${styles.headerBar} ${styles.headerBarInset}`}>
          <div className={styles.headerTopRow}>
            <button
              onClick={() => { cinematicNav('menu'); }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,220,160,0.45)';
                e.currentTarget.style.color = THEME.creamText;
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = THEME.line;
                e.currentTarget.style.color = 'rgba(255,220,160,0.8)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
              className={styles.returnBtn}
            >
              ← RETURN
            </button>

            <div className={styles.headerCenter}>
              <div className={styles.headerKicker}>
                ✦ &nbsp; CODEX OF THE PARTY &nbsp; ✦
              </div>
              <div className={styles.headerTitleMain}>
                CHARACTER BOOK
              </div>
            </div>

            {/* Spacer to balance */}
            <div className={styles.headerSpacer} />
          </div>

          {/* Context tabs (only show when applicable) */}

        </div>

        {/* Body */}
        <div className={styles.bodyArea} style={{ top: headerH }}>
          <div className={styles.bodyInner}>

            {/* Buttons (below header, above content) — NOT sticky, no overlay bar */}
            <div className={styles.tabRow}>
              {(charView === 'worldnpcs' || showProfileTab) && (
                <button
                  type="button"
                  className={`${styles.tabPill} ${charView !== 'worldnpcs' ? styles.tabPillActive : styles.tabPillInactive}`}
                  onMouseEnter={btnHover}
                  onMouseLeave={btnLeave}
                  onMouseDown={navClick}
                  onClick={() => {
                    if (charView === 'relations') {
                      setSelectedNpc(null);
                      setCharView('detail');
                      return;
                    }
                    if (charView === 'npc') {
                      setCharView('relations');
                      return;
                    }
                    setCharView('grid');
                    setSelectedChar(null);
                    setSelectedNpc(null);
                  }}
                >
                  {charView === 'relations'
                    ? 'Return to Profile'
                    : charView === 'npc'
                      ? 'Return to Family & Related NPCs'
                      : charView === 'worldnpcs'
                        ? 'Return to Codex'
                        : showProfileTab
                          ? 'Return to Codex'
                          : 'Adventurers'}
                </button>
              )}

              {!showProfileTab && charView !== 'worldnpcs' && (
                <button
                  type="button"
                  className={`${styles.tabPill} ${charView !== 'worldnpcs' ? styles.tabPillActive : styles.tabPillInactive}`}
                  onMouseEnter={btnHover}
                  onMouseLeave={btnLeave}
                  onMouseDown={navClick}
                  onClick={() => { setSelectedChar(null); setSelectedNpc(null); setCharView('worldnpcs'); }}
                >
                  World NPCs
                </button>
              )}

              {!!selectedChar && (charView === 'relations' || charView === 'npc') && (
                <button
                  type="button"
                  disabled={!charSongSrc}
                  className={`${styles.tinyBtn} ${styles.themeTinyPill}`}
                  onMouseEnter={(e) => { if (charSongSrc) tinyBtnHover(e); }}
                  onMouseLeave={(e) => { if (charSongSrc) tinyBtnLeave(e); }}
                  onMouseDown={(e) => { if (charSongSrc) navClick(e); }}
                  onClick={(e) => {
                    e.preventDefault();
                    if (charSongSrc) toggleCharSong();
                  }}
                >
                  {charSongSrc ? `Theme: ${charSongOn ? 'Pause' : 'Play'}` : 'No Theme'}
                </button>
              )}
            </div>

            {/* GRID */}
            {charView === 'grid' && (
              <div className={styles.charGrid}>
                {characters.map((char) => (
                  <div
                    key={char.name}
                    className={`${styles.charGridCard} ${styles.cardHover}`}
                    onMouseDown={navClick}
                    onClick={() => { setSelectedChar(char); setSelectedNpc(null); setCharView('detail'); }}
                    onMouseEnter={() => setHoveredCharName(char.name)}
                    onMouseLeave={() => setHoveredCharName(null)}
                  >
                    <img src={getCharPortrait(char)} alt={char.name}
                      className={styles.charCardImage} />
                    <div className={styles.charCardName}>{char.name}</div>
                    <div className={styles.charCardSynopsis}>{char.synopsis}</div>
                  </div>
                ))}
              </div>
            )}

            {/* WORLD NPCs */}
            {showWorldNpcTab && (
              <div className={styles.worldNpcStack}>
                <div className={`${styles.lightCard} ${styles.worldNpcHeader}`}>
                  <div>
                    <div className={styles.worldNpcTitle}>World NPC Codex</div>
                    <div className={styles.worldNpcSubtitle}>NPCs you meet in the world — not tied to any one player.</div>
                  </div>
                  <div className={styles.worldNpcActions}>
                    <button
                      className={`${styles.tinyBtn} ${styles.worldNpcActionBtn}`}
                      onMouseEnter={tinyBtnHover}
                      onMouseLeave={tinyBtnLeave}
                      onMouseDown={navClick}
                      onClick={() => setConnectionWebModalOpen(true)}
                    >
                      Connection Web
                    </button>
                    <button
                      className={`${styles.tinyBtn} ${styles.worldNpcActionBtn}`}
                      onMouseEnter={tinyBtnHover}
                      onMouseLeave={tinyBtnLeave}
                      onMouseDown={navClick}
                      onClick={importCharacterNpcsIntoWorld}
                    >
                      Import Character NPCs
                    </button>
                    <button className={styles.goldBtn} onMouseEnter={btnHover} onMouseLeave={btnLeave} onMouseDown={btnDown} onClick={openAddWorldNpc}>
                      + Add NPC
                    </button>
                  </div>
                </div>

                <div className={styles.worldNpcFilterGrid}>
                  {[
                    { label: 'Faction', val: npcFilterFaction, set: setNpcFilterFaction, opts: factions },
                    { label: 'Location', val: npcFilterLocation, set: setNpcFilterLocation, opts: locations },
                  ].map(({ label: lbl, val, set, opts }) => (
                    <div key={lbl} className={styles.darkCard}>
                      <div className={styles.fieldLabel}>{lbl}</div>
                      <select value={val} onChange={(e) => set(e.target.value)} className={styles.inputBase}>
                        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                  <div className={styles.darkCard}>
                    <div className={styles.fieldLabel}>Search</div>
                    <input value={npcSearch} onChange={(e) => setNpcSearch(e.target.value)}
                      placeholder="Name, age, faction, occupation, location, summary…" className={styles.inputBase} />
                  </div>
                </div>

                <div className={styles.worldNpcRangeRow}>
                  <div className={styles.worldNpcRangeText}>
                    {worldNpcRangeLabel} <strong className={styles.textCreamStrong}>filtered</strong> (total <strong className={styles.textCreamStrong}>{(worldNpcs || []).length}</strong>)
                  </div>
                  <div className={styles.worldNpcControls}>
                    <button
                      className={styles.worldNpcControlBtn}
                      onMouseEnter={tinyBtnHover}
                      onMouseLeave={tinyBtnLeave}
                      onMouseDown={navClick}
                      onClick={() => setWorldNpcListMode((m) => (m === 'paged' ? 'all' : 'paged'))}
                    >
                      {worldNpcListMode === 'paged' ? 'Show All (Scroll)' : 'Show 5 Per Page'}
                    </button>
                    {worldNpcListMode === 'paged' && filteredWorldNpcs.length > WORLD_NPC_PAGE_SIZE && (
                      <>
                        <button
                          className={`${styles.worldNpcControlBtn} ${styles.worldNpcControlBtnCompact}`}
                          disabled={worldNpcPage <= 1}
                          onMouseEnter={(e) => { if (worldNpcPage > 1) tinyBtnHover(e); }}
                          onMouseLeave={(e) => { if (worldNpcPage > 1) tinyBtnLeave(e); }}
                          onMouseDown={(e) => { if (worldNpcPage > 1) navClick(e); }}
                          onClick={() => setWorldNpcPage((p) => Math.max(1, p - 1))}
                        >
                          Prev
                        </button>
                        <div className={styles.worldNpcPageLabel}>
                          Page {worldNpcPage}/{worldNpcTotalPages}
                        </div>
                        <button
                          className={`${styles.worldNpcControlBtn} ${styles.worldNpcControlBtnCompact}`}
                          disabled={worldNpcPage >= worldNpcTotalPages}
                          onMouseEnter={(e) => { if (worldNpcPage < worldNpcTotalPages) tinyBtnHover(e); }}
                          onMouseLeave={(e) => { if (worldNpcPage < worldNpcTotalPages) tinyBtnLeave(e); }}
                          onMouseDown={(e) => { if (worldNpcPage < worldNpcTotalPages) navClick(e); }}
                          onClick={() => setWorldNpcPage((p) => Math.min(worldNpcTotalPages, p + 1))}
                        >
                          Next
                        </button>
                      </>
                    )}
                    <button className={styles.worldNpcControlBtn} onMouseEnter={tinyBtnHover} onMouseLeave={tinyBtnLeave}
                      onClick={() => { setNpcFilterFaction('All'); setNpcFilterLocation('All'); setNpcSearch(''); }}>
                      Clear Filters
                    </button>
                  </div>
                </div>

                {filteredWorldNpcs.length === 0 ? (
                  <div className={styles.darkCard}>
                    <div className={styles.emptyStateTitle}>No NPCs match your filters.</div>
                    <div className={styles.emptyStateText}>Try clearing filters, or add your first World NPC.</div>
                  </div>
                ) : (
                  <div
                    className={styles.worldNpcList}
                    style={{
                      maxHeight: worldNpcListMode === 'all' ? 520 : 'none',
                      overflowY: worldNpcListMode === 'all' ? 'auto' : 'visible',
                      paddingRight: worldNpcListMode === 'all' ? 4 : 0,
                    }}
                  >
                    {visibleWorldNpcs.map((n) => {
                      const linkedChars = (n.characterLinks || []).map((l) =>
                        l.relation ? `${l.characterName} (${l.relation})` : l.characterName
                      );
                      const connectedNames = (n.links || [])
                        .map((l) => worldNpcById[l.targetId]?.name)
                        .filter(Boolean);
                      return (
                        <div
                          key={n.id}
                          className={`${styles.darkCard} ${styles.npcHover} ${styles.npcCardClickable}`}
                          onMouseDown={navClick}
                          onClick={() => openEditWorldNpc(n)}
                          role="button"
                          tabIndex={0}
                        >
                          <div className={styles.npcTopRow}>
                            <div className={styles.npcLeftGroup}>
                              {n.image ? (
                                <img
                                  src={n.image}
                                  alt={n.name || 'NPC'}
                                  className={styles.npcThumb44}
                                />
                              ) : (
                                <div
                                  aria-hidden
                                  className={styles.npcThumb44Empty}
                                />
                              )}
                              <div className={styles.npcName}>{n.name}</div>
                            </div>
                            <div className={styles.npcMetaRow}>
                              <span className={`${styles.npcMetaText} ${(n.faction || '').trim() ? styles.textCreamSoft : styles.textCreamMuted38}`}>
                                Faction: {(n.faction || '').trim() || '—'}
                              </span>
                              <span className={`${styles.npcMetaText} ${(n.location || '').trim() ? styles.textCreamSoft : styles.textCreamMuted38}`}>
                                Location: {(n.location || '').trim() || '—'}
                              </span>
                            </div>
                          </div>

                          {(n.summary || n.bio) && (
                            <div className={styles.npcSummary}>
                              {(n.summary || n.bio || '').trim()}
                            </div>
                          )}

                          <div className={styles.npcLinksRow}>
                            <span className={`${styles.npcLinksText} ${linkedChars.length ? styles.textCreamSoft : styles.textCreamMuted42}`}>
                              Linked Characters: {linkedChars.length ? linkedChars.join(', ') : 'None'}
                            </span>
                            <span className={`${styles.npcLinksText} ${connectedNames.length ? styles.textCreamSoft : styles.textCreamMuted42}`}>
                              Connected NPCs: {connectedNames.length ? connectedNames.join(', ') : 'None'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            )}

            {/* DETAIL */}
            {charView === 'detail' && selectedChar && (
              <div className={styles.detailGrid}>
                <div className={styles.darkCard}>
                  <img
                    src={selectedChar.name === 'Arlis' ? (hoveredCharName === 'Arlis' ? (arlisFrame === 0 ? arlisImgA : arlisImgB) : arlisImgA) : selectedChar.image}
                    alt={selectedChar.name}
                    className={styles.detailPortrait}
                    onMouseEnter={() => setHoveredCharName(selectedChar.name)}
                    onMouseLeave={() => setHoveredCharName(null)}
                  />
                  <div className={styles.detailHeader}>
                    <div className={styles.detailName}>{selectedChar.name}</div>
                    <div className={styles.detailSynopsis}>{selectedChar.synopsis}</div>
                    <div className={styles.divider} />
                    <div className={styles.detailStatsGrid}>
                      {[['Age', selectedChar.age], ['Height', selectedChar.height]].map(([k, v]) => (
                        <div key={k}>
                          <div className={styles.statLabel}>{k}</div>
                          <div className={styles.statValue}>{v}</div>
                        </div>
                      ))}
                      <div className={styles.fullSpan}>
                        <div className={styles.statLabel}>Class</div>
                        <div className={styles.statValue}>{selectedChar.class}</div>
                      </div>

                      {/* Character Theme Song (start with Von'Ghul) */}
                      {/* Character Theme Song (Von'Ghul for now) */}
                      <div className={styles.fullSpan}>
                        <div className={styles.divider} />
                        <div className={styles.themeCard}>
                          {/* Single persistent audio element — lives outside this block, see below */}

                          <div className={styles.themeHeaderRow}>
                            <div>
                              <div className={styles.themeLabel}>
                                Theme
                              </div>

                              {charSongSrc ? (
                                <div className={styles.themeValue}>
                                  {fmtTime(charSongTime)} / {fmtTime(charSongDur)}
                                </div>
                              ) : (
                                <div className={styles.themeValueMuted}>
                                  No theme assigned.
                                </div>
                              )}
                            </div>

                            <button
                              disabled={!charSongSrc}
                              className={`${styles.tinyBtn} ${styles.themePlayBtn}`}
                              onMouseEnter={(e) => { if (charSongSrc) tinyBtnHover(e); }}
                              onMouseLeave={(e) => { if (charSongSrc) tinyBtnLeave(e); }}
                              onMouseDown={(e) => { if (charSongSrc) navClick(e); }}
                              onClick={(e) => { e.preventDefault(); if (charSongSrc) toggleCharSong(); }}
                            >
                              {charSongOn ? 'Pause' : 'Play'}
                            </button>
                          </div>

                          <input
                            className={styles.rng}
                            type="range"
                            min={0}
                            max={Math.max(1, Math.floor(charSongDur || 1))}
                            value={Math.min(charSongTime, charSongDur || 0)}
                            disabled={!charSongSrc}
                            onChange={(e) => {
                              const a = charAudioRef.current;
                              if (!a) return;
                              const t = Number(e.target.value) || 0;
                              a.currentTime = t;
                              setCharSongTime(t);
                            }}
                            style={{
                              color: THEME.creamText,
                              accentColor: THEME.creamText,
                              background: `linear-gradient(90deg, rgba(255,245,220,0.75) 0%, rgba(255,245,220,0.75) ${(Math.min(charSongTime, charSongDur || 0) / Math.max(1, charSongDur || 1)) * 100}%, rgba(255,245,220,0.14) ${(Math.min(charSongTime, charSongDur || 0) / Math.max(1, charSongDur || 1)) * 100}%, rgba(255,245,220,0.14) 100%)`,
                              marginTop: 10,
                              opacity: charSongSrc ? 1 : 0.55,
                            }}
                          />

                          <div className={`${styles.themeVolumeRow} ${charSongSrc ? '' : styles.themeVolumeRowMuted}`}>
                            <div className={styles.themeLabel}>Vol</div>
                            <input
                              className={styles.rng}
                              type="range"
                              min={0}
                              max={1}
                              step={0.01}
                              value={charSongVol}
                              disabled={!charSongSrc}
                              onChange={(e) => setCharSongVol(parseFloat(e.target.value))}
                              style={{
                                color: THEME.creamText,
                                accentColor: THEME.creamText,
                                background: `linear-gradient(90deg, rgba(255,245,220,0.75) 0%, rgba(255,245,220,0.75) ${Math.round((Number(charSongVol) || 0) * 100)}%, rgba(255,245,220,0.14) ${Math.round((Number(charSongVol) || 0) * 100)}%, rgba(255,245,220,0.14) 100%)`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.rightColStack}>
                  <div className={styles.darkCard}>
                    <div className={styles.sectionTitle}>Lore</div>
                    <div className={styles.sectionBody}>{selectedChar.lore}</div>
                  </div>

                  <div className={styles.darkCard}>
                    <div className={styles.sectionTitle}>Current Goals</div>
                    <div className={styles.sectionBody}>{selectedChar.goals}</div>
                  </div>

                  <div className={styles.darkCard}>
                    <div className={styles.partyHeader}>
                      <div>
                        <div className={styles.partyTitle}>Party Relationship Tree</div>
                        <div className={styles.partySubtitle}>How {selectedChar.name} feels about the party.</div>
                      </div>
                      <button className={styles.goldBtn} onMouseEnter={btnHover} onMouseLeave={btnLeave}
                        onMouseDown={(e) => { btnDown(e); navClick(); }}
                        onClick={() => { setSelectedNpc(null); setCharView('relations'); }}>
                        View NPCs
                      </button>
                    </div>

                    <div className={styles.divider} />

                    <div className={styles.partyGrid}>
                      {partyMateNames.length === 0 ? (
                        <div className={styles.noPartyText}>No other party members found.</div>
                      ) : partyMateNames.map((otherName) => {
                        const rel = getRelObj(selectedChar.name, otherName);
                        const { score: value, note, editing: isEditing } = rel;
                        return (
                          <div key={otherName} className={styles.relationCard}>
                            <div className={styles.relationTopRow}>
                              <div className={styles.relationName}>{otherName}</div>
                              <div className={styles.relationValueRow}>
                                <div className={styles.relationValue} style={{ color: relTempColor(value) }}>{value}</div>
                                <button className={styles.tinyBtn} onMouseEnter={tinyBtnHover} onMouseLeave={tinyBtnLeave}
                                  onClick={() => setRelObj(selectedChar.name, otherName, { editing: !isEditing })}>✎</button>
                              </div>
                            </div>

                            <input className={styles.rng}
                              style={{ color: relTempColor(value), accentColor: relTempColor(value), background: relTempTrack(value), marginTop: 10 }}
                              type="range" min={0} max={100} value={value}
                              onChange={(e) => setRelObj(selectedChar.name, otherName, { score: clamp0100(parseInt(e.target.value, 10) || 0) })}
                            />

                            <div className={`${styles.relationNoteWrap} ${styles.relationNoteWrapSoft}`}>
                              {isEditing ? (
                                <textarea value={note || ''} placeholder={`Write a note about ${otherName}...`}
                                  onChange={(e) => setRelObj(selectedChar.name, otherName, { note: e.target.value })}
                                  onBlur={() => setRelObj(selectedChar.name, otherName, { editing: false })}
                                  rows={2}
                                  className={`${styles.inputBase} ${styles.relationTextarea}`}
                                />
                              ) : (
                                <div className={`${styles.relationNoteText} ${note ? styles.relationNoteTextHas : styles.relationNoteTextEmpty}`}>
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
                <div className={styles.relationsHeader}>
                  <div className={styles.relationsTitle}>{selectedChar.name} — Family & Related NPCs</div>
                  <div className={styles.relationsMeta}>
                    <div className={styles.relationsCount}>{selectedCharNpcs.length} entries</div>
                    <button
                      className={`${styles.tinyBtn} ${styles.tinyBtnWide}`}
                      onMouseEnter={tinyBtnHover}
                      onMouseLeave={tinyBtnLeave}
                      onMouseDown={navClick}
                      onClick={openAddCharNpc}
                    >
                      + Add NPC
                    </button>
                  </div>
                </div>

                <div className={styles.npcListColumn}>
                  {selectedCharNpcs.map((npc) => (
                    <div
                      key={npc.id || npc.name}
                      className={`${styles.darkCard} ${styles.npcHover} ${styles.npcCardClickable}`}
                      onMouseDown={navClick}
                      onClick={() => { setSelectedNpc(npc); setCharView('npc'); }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className={styles.npcCardHeader}>
                        <div className={styles.npcCardLeft}>
                          {npc.image ? (
                            <img
                              src={npc.image}
                              alt={npc.name || 'NPC'}
                              className={styles.npcThumb48}
                            />
                          ) : (
                            <div
                              aria-hidden
                              className={styles.npcThumb48Empty}
                            />
                          )}
                          <div className={styles.npcTextWrap}>
                            <div className={styles.npcName}>{npc.name}</div>
                            <div className={styles.npcRelationText}>{npc.relation || 'Relation unknown'}</div>
                          </div>
                        </div>
                        <button
                          className={`${styles.tinyBtn} ${styles.tinyBtnSoft}`}
                          onMouseEnter={tinyBtnHover}
                          onMouseLeave={tinyBtnLeave}
                          onMouseDown={navClick}
                          onClick={(e) => {
                            e.stopPropagation();
                            openNpcEditorFromRelation(npc);
                          }}
                        >
                          Edit
                        </button>
                      </div>
                      <div className={styles.npcSummaryText}>
                        {(npc.summary || npc.bio || '').trim() || 'No synopsis yet. Click Edit to add one.'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* NPC DETAIL */}
            {charView === 'npc' && selectedChar && activeSelectedNpc && (
              <div className={styles.npcDetailStack}>
                <div className={styles.lightCard}>
                  <div className={styles.npcDetailGrid}>
                    {activeSelectedNpc.image ? (
                      <img
                        src={activeSelectedNpc.image}
                        alt={activeSelectedNpc.name || 'NPC'}
                        className={styles.npcDetailThumb130}
                      />
                    ) : (
                      <div
                        aria-hidden
                        className={styles.npcDetailThumb130Empty}
                      />
                    )}
                    <div>
                      <div className={styles.npcDetailTopRow}>
                        <div className={styles.npcDetailName}>{activeSelectedNpc.name}</div>
                        <div className={styles.npcDetailRelation}>
                          {(activeSelectedNpc.relation || 'Relation unknown')} of {selectedChar.name}
                        </div>
                      </div>
                      <div className={styles.divider} />
                      <div className={styles.npcDetailSummary}>
                        {(activeSelectedNpc.summary || activeSelectedNpc.bio || '').trim() || 'No synopsis yet.'}
                      </div>
                      <div className={styles.npcDetailFacts}>
                        <div><strong className={styles.npcDetailFactStrong}>Age:</strong> {(activeSelectedNpc.age || '').trim() || 'Unknown'}</div>
                        <div><strong className={styles.npcDetailFactStrong}>Faction:</strong> {(activeSelectedNpc.faction || '').trim() || 'Unknown'}</div>
                        <div><strong className={styles.npcDetailFactStrong}>Occupation:</strong> {(activeSelectedNpc.occupation || '').trim() || 'Unknown'}</div>
                      </div>
                      <div className={styles.npcLoreCard}>
                        <div className={styles.npcLoreLabel}>
                          Lore
                        </div>
                        <div className={styles.npcLoreBody}>
                          {(activeSelectedNpc.bio && activeSelectedNpc.bio.trim() ? activeSelectedNpc.bio : 'No lore yet.')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={styles.npcDetailActions}>
                    <button
                      className={styles.goldBtn}
                      onMouseEnter={btnHover}
                      onMouseLeave={btnLeave}
                      onMouseDown={(e) => { btnDown(e); navClick(); }}
                      onClick={() => openNpcEditorFromRelation(activeSelectedNpc)}
                    >
                      View / Edit NPC
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CONNECTION WEB MODAL */}
        {connectionWebModalOpen && (
          <div
            className={`${styles.modalOverlay} ${styles.modalZ31}`}
            onMouseDown={(e) => { if (e.target === e.currentTarget) setConnectionWebModalOpen(false); }}
          >
            <div className={`${styles.modalShell} ${styles.modalShellConn}`}>
              <div className={styles.modalHeader}>
                <div>
                  <div className={styles.connTitle}>Connection Web</div>
                  <div className={styles.connSubtitle}>
                    Gold lines connect NPC-to-NPC links. Blue lines connect NPCs to linked player characters.
                  </div>
                </div>
                <button
                  className={`${styles.backButton} ${styles.backButtonSm}`}
                  onMouseEnter={btnHover}
                  onMouseLeave={btnLeave}
                  onMouseDown={btnDown}
                  onClick={() => setConnectionWebModalOpen(false)}
                >
                  Close
                </button>
              </div>

              <div className={styles.modalBodyPad}>
                {connectionWeb.nodes.length === 0 ? (
                  <div className={`${styles.darkCard} ${styles.darkCardInfo}`}>
                    Add NPCs and links to build your relationship web.
                  </div>
                ) : (
                  <div className={styles.connCanvas}>
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.connSvg}>
                      {connectionWeb.edges.map((edge, idx) => {
                        if (!edge.d) return null;
                        return (
                          <path
                            key={`${edge.from}-${edge.to}-${idx}`}
                            d={edge.d}
                            fill="none"
                            stroke={edge.type === 'character' ? 'rgba(120,180,255,0.72)' : 'rgba(255,210,120,0.70)'}
                            strokeWidth={edge.type === 'character' ? 0.24 : 0.30}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity={edge.type === 'character' ? 0.86 : 0.74}
                          />
                        );
                      })}
                    </svg>

                    {connectionWeb.nodes.map((node) => (
                      <div
                        key={node.id}
                        title={node.label}
                        className={styles.connNode}
                        style={{
                          left: `${node.x}%`,
                          top: `${node.y}%`,
                          border: `1px solid ${node.type === 'character' ? 'rgba(120,180,255,0.36)' : THEME.lineSoft}`,
                          background: node.type === 'character'
                            ? 'linear-gradient(180deg, rgba(26,44,72,0.90), rgba(14,26,44,0.92))'
                            : 'linear-gradient(180deg, rgba(42,28,14,0.90), rgba(20,14,8,0.92))',
                        }}
                      >
                        {node.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CHARACTER NPC MODAL */}
        {charNpcModalOpen && (
          <div
            className={`${styles.modalOverlay} ${styles.modalZ32}`}
            onMouseDown={(e) => { if (e.target === e.currentTarget) closeCharNpcModal(); }}
          >
            <div className={`${styles.modalShell} ${styles.modalShellChar}`}>
              <div className={styles.modalHeader}>
                <div>
                  <div className={styles.modalTitle17}>{editingCharNpcId ? 'Edit Related NPC' : 'Add Related NPC'}</div>
                  <div className={styles.modalSub11}>{selectedChar?.name || 'Character'} codex entry</div>
                </div>
                <button
                  className={`${styles.backButton} ${styles.backButtonSm}`}
                  onMouseEnter={btnHover}
                  onMouseLeave={btnLeave}
                  onMouseDown={btnDown}
                  onClick={closeCharNpcModal}
                >
                  Close
                </button>
              </div>

              <div className={styles.modalFormGrid}>
                <div className={styles.modalMediaRow}>
                  <div>
                    {charNpcDraft.image ? (
                      <img
                        src={charNpcDraft.image}
                        alt="NPC"
                        className={styles.thumb110}
                      />
                    ) : (
                      <div
                        aria-hidden
                        className={styles.thumb110Empty}
                      />
                    )}
                  </div>
                  <div>
                    <div className={styles.fieldLabel}>Thumbnail Image (optional)</div>
                    <div className={styles.inlineWrap}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => onCharNpcImagePick(e.target.files && e.target.files[0])}
                        className={`${styles.inputBase} ${styles.fileInput}`}
                      />
                      {charNpcDraft.image && (
                        <button
                          type="button"
                          className={`${styles.tinyBtn} ${styles.tinyBtnSoft}`}
                          onMouseEnter={tinyBtnHover}
                          onMouseLeave={tinyBtnLeave}
                          onClick={() => setCharNpcDraft((d) => ({ ...d, image: '' }))}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <div className={styles.fieldLabel}>Name</div>
                  <input
                    value={charNpcDraft.name}
                    onChange={(e) => setCharNpcDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="e.g. Captain Rell"
                    className={`${styles.inputBase} ${styles.inputStrong}`}
                  />
                </div>
                <div>
                  <div className={styles.fieldLabel}>Relation</div>
                  <input
                    value={charNpcDraft.relation}
                    onChange={(e) => setCharNpcDraft((d) => ({ ...d, relation: e.target.value }))}
                    placeholder="e.g. Mentor, Parent, Patron"
                    className={styles.inputBase}
                  />
                </div>
                <div>
                  <div className={styles.fieldLabel}>Age</div>
                  <input
                    value={charNpcDraft.age}
                    onChange={(e) => setCharNpcDraft((d) => ({ ...d, age: e.target.value }))}
                    placeholder="e.g. 42"
                    className={styles.inputBase}
                  />
                </div>
                <div>
                  <div className={styles.fieldLabel}>Faction</div>
                  <input
                    value={charNpcDraft.faction}
                    onChange={(e) => setCharNpcDraft((d) => ({ ...d, faction: e.target.value }))}
                    placeholder="e.g. Church of Amiras"
                    className={styles.inputBase}
                  />
                </div>
                <div className={styles.fullSpan}>
                  <div className={styles.fieldLabel}>Occupation</div>
                  <input
                    value={charNpcDraft.occupation}
                    onChange={(e) => setCharNpcDraft((d) => ({ ...d, occupation: e.target.value }))}
                    placeholder="e.g. Captain, Scholar, Merchant"
                    className={styles.inputBase}
                  />
                </div>

                <div className={styles.fullSpan}>
                  <div className={styles.fieldLabel}>Quick Synopsis (shown on cards)</div>
                  <textarea
                    value={charNpcDraft.summary}
                    onChange={(e) => setCharNpcDraft((d) => ({ ...d, summary: e.target.value }))}
                    placeholder="One to two lines for quick reference."
                    rows={3}
                    className={`${styles.inputBase} ${styles.textareaSummary}`}
                  />
                </div>

                <div className={styles.fullSpan}>
                  <div className={styles.fieldLabel}>Lore</div>
                  <textarea
                    value={charNpcDraft.bio}
                    onChange={(e) => setCharNpcDraft((d) => ({ ...d, bio: e.target.value }))}
                    placeholder="Long-form lore, history, hooks, secrets..."
                    rows={6}
                    className={`${styles.inputBase} ${styles.textareaLore}`}
                  />
                </div>
              </div>

              <div className={`${styles.modalFooter} ${styles.modalFooterBetween}`}>
                <div>
                  {editingCharNpcId && (
                    <button
                      className={styles.backButton}
                      onMouseEnter={btnHover}
                      onMouseLeave={btnLeave}
                      onMouseDown={btnDown}
                      onClick={deleteCharNpc}
                    >
                      Delete NPC
                    </button>
                  )}
                </div>
                <div className={styles.actionsRow}>
                  <button
                    className={styles.backButton}
                    onMouseEnter={btnHover}
                    onMouseLeave={btnLeave}
                    onMouseDown={btnDown}
                    onClick={closeCharNpcModal}
                  >
                    Cancel
                  </button>
                  <button
                    className={styles.goldBtn}
                    onMouseEnter={btnHover}
                    onMouseLeave={btnLeave}
                    onMouseDown={btnDown}
                    onClick={saveCharNpc}
                  >
                    {editingCharNpcId ? 'Save Changes' : 'Add NPC'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* WORLD NPC MODAL */}
        {worldNpcModalOpen && (
          <div
            className={`${styles.modalOverlay} ${styles.modalOverlaySoft} ${styles.modalZ30}`}
            onMouseDown={(e) => { if (e.target === e.currentTarget) setWorldNpcModalOpen(false); }}
          >
            <div className={`${styles.modalShell} ${styles.modalShellWorld}`}>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitle17}>{editingWorldNpcId ? 'Edit World NPC' : 'Add World NPC'}</div>
                <button className={`${styles.backButton} ${styles.backButtonSm}`}
                  onMouseEnter={btnHover} onMouseLeave={btnLeave} onMouseDown={btnDown}
                  onClick={() => setWorldNpcModalOpen(false)}>
                  Close
                </button>
              </div>
              {worldNpcDraft.image && (
                <div className={styles.worldImagePreviewWrap}>
                  <img
                    src={worldNpcDraft.image}
                    alt="NPC"
                    className={styles.thumb110}
                  />
                </div>
              )}
              <div className={styles.modalFormGrid}>
                <div className={styles.fullSpan}>
                  <div className={styles.fieldLabel}>Name</div>
                  <input value={worldNpcDraft.name} onChange={(e) => setWorldNpcDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="e.g. Captain Rell" className={`${styles.inputBase} ${styles.inputStrong}`} />
                </div>
                <div>
                  <div className={styles.fieldLabel}>Age</div>
                  <input value={worldNpcDraft.age} onChange={(e) => setWorldNpcDraft((d) => ({ ...d, age: e.target.value }))}
                    placeholder="e.g. 42" className={styles.inputBase} />
                </div>
                <div>
                  <div className={styles.fieldLabel}>Faction</div>
                  <input value={worldNpcDraft.faction} onChange={(e) => setWorldNpcDraft((d) => ({ ...d, faction: e.target.value }))}
                    placeholder="e.g. Church of Amiras" className={styles.inputBase} />
                </div>
                <div>
                  <div className={styles.fieldLabel}>Occupation</div>
                  <input value={worldNpcDraft.occupation} onChange={(e) => setWorldNpcDraft((d) => ({ ...d, occupation: e.target.value }))}
                    placeholder="e.g. Captain, Scholar, Merchant" className={styles.inputBase} />
                </div>
                <div>
                  <div className={styles.fieldLabel}>Location</div>
                  <input value={worldNpcDraft.location} onChange={(e) => setWorldNpcDraft((d) => ({ ...d, location: e.target.value }))}
                    placeholder="e.g. Avalon" className={styles.inputBase} />
                </div>

                <div className={styles.fullSpan}>
                  <div className={styles.fieldLabel}>Quick Synopsis</div>
                  <textarea value={worldNpcDraft.summary} onChange={(e) => setWorldNpcDraft((d) => ({ ...d, summary: e.target.value }))}
                    placeholder="One or two lines used for quick cards and previews."
                    rows={3}
                    className={`${styles.inputBase} ${styles.textareaWorldSummary}`} />
                </div>

                <div className={styles.fullSpan}>
                  <div className={styles.fieldLabel}>Image (optional)</div>
                  <div className={styles.inlineWrap}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => onWorldNpcImagePick(e.target.files && e.target.files[0])}
                      className={`${styles.inputBase} ${styles.fileInput}`}
                    />
                    {worldNpcDraft.image && (
                      <button
                        type="button"
                        className={`${styles.tinyBtn} ${styles.tinyBtnSoft}`}
                        onMouseEnter={tinyBtnHover}
                        onMouseLeave={tinyBtnLeave}
                        onClick={() => setWorldNpcDraft((d) => ({ ...d, image: '' }))}
                      >
                        Remove Image
                      </button>
                    )}
                  </div>

                </div>

                <div className={styles.fullSpan}>
                  <div className={styles.fieldLabel}>Lore</div>
                  <textarea value={worldNpcDraft.bio} onChange={(e) => setWorldNpcDraft((d) => ({ ...d, bio: e.target.value }))}
                    placeholder="Long-form lore, history, hooks, secrets…" rows={5}
                    className={`${styles.inputBase} ${styles.textareaWorldLore}`} />
                </div>

                <div className={styles.fullSpan}>
                  <div className={styles.pickerHeader}>
                    <div className={styles.fieldLabel}>Related Characters</div>
                    <div className={styles.pickerCount}>
                      {(worldNpcDraft.characterLinks || []).length} linked
                    </div>
                  </div>
                  <input
                    value={worldNpcCharSearch}
                    onChange={(e) => setWorldNpcCharSearch(e.target.value)}
                    placeholder="Find character..."
                    className={`${styles.inputBase} ${styles.inputSearch}`}
                  />
                  <div className={styles.pickerBox}>
                    {filteredWorldNpcCharacterNames.length === 0 ? (
                      <div className={styles.pickerEmpty}>
                        No matching characters.
                      </div>
                    ) : (
                      <div className={`${styles.pickerGrid} ${styles.pickerGridChars}`}>
                        {filteredWorldNpcCharacterNames.map((charName) => {
                          const checked = (worldNpcDraft.characterLinks || []).some((l) => l.characterName === charName);
                          return (
                            <button
                              key={charName}
                              type="button"
                              className={`${styles.pickerButton} ${checked ? styles.pickerButtonChecked : styles.pickerButtonUnchecked}`}
                              onMouseDown={navClick}
                              onClick={() => toggleWorldNpcCharacterLink(charName)}
                            >
                              <span className={`${styles.pickerCheck} ${checked ? styles.pickerCheckChecked : styles.pickerCheckUnchecked}`}>
                                {checked ? '✓' : ''}
                              </span>
                              <span className={styles.ellipsisText}>
                                {charName}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {(worldNpcDraft.characterLinks || []).length > 0 && (
                    <div className={styles.linkNotesGrid}>
                      {(worldNpcDraft.characterLinks || []).map((link) => (
                        <div key={`char-rel-${link.characterName}`} className={styles.linkNoteRow}>
                          <div className={styles.linkNoteLabel}>
                            {link.characterName}
                          </div>
                          <input
                            value={link?.relation || ''}
                            onChange={(e) => setWorldNpcCharacterRelation(link.characterName, e.target.value)}
                            placeholder="Relation (e.g. Mentor)"
                            className={`${styles.inputBase} ${styles.inputCompact}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={styles.fullSpan}>
                  <div className={styles.pickerHeader}>
                    <div className={styles.fieldLabel}>Connected NPCs</div>
                    <div className={styles.pickerCount}>
                      {(worldNpcDraft.links || []).length} linked
                    </div>
                  </div>
                  {worldNpcConnectionTargets.length === 0 ? (
                    <div className={styles.pickerInfo}>
                      Add at least one other world NPC to create NPC-to-NPC links.
                    </div>
                  ) : (
                    <>
                      <input
                        value={worldNpcConnectionSearch}
                        onChange={(e) => setWorldNpcConnectionSearch(e.target.value)}
                        placeholder="Find world NPC..."
                        className={`${styles.inputBase} ${styles.inputSearch}`}
                      />
                      <div className={styles.pickerBox}>
                        {filteredWorldNpcConnectionTargets.length === 0 ? (
                          <div className={styles.pickerEmpty}>
                            No matching NPCs.
                          </div>
                        ) : (
                          <div className={`${styles.pickerGrid} ${styles.pickerGridNpcs}`}>
                            {filteredWorldNpcConnectionTargets.map((target) => {
                              const link = (worldNpcDraft.links || []).find((l) => String(l.targetId) === String(target.id));
                              const checked = !!link;
                              return (
                                <button
                                  key={target.id}
                                  type="button"
                                  className={`${styles.pickerButton} ${checked ? styles.pickerButtonChecked : styles.pickerButtonUnchecked}`}
                                  onMouseDown={navClick}
                                  onClick={() => toggleWorldNpcConnection(target.id)}
                                >
                                  <span className={`${styles.pickerCheck} ${checked ? styles.pickerCheckChecked : styles.pickerCheckUnchecked}`}>
                                    {checked ? '✓' : ''}
                                  </span>
                                  <span className={styles.ellipsisText}>
                                    {target.name || 'Unnamed NPC'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  {(worldNpcDraft.links || []).length > 0 && (
                    <div className={`${styles.linkNotesGrid} ${styles.linkNotesGridScrollable}`}>
                      {(worldNpcDraft.links || []).map((link) => (
                        <div key={`npc-note-${link.targetId}`} className={styles.linkNoteRow}>
                          <div className={styles.linkNoteLabel}>
                            {worldNpcById[link.targetId]?.name || 'Linked NPC'}
                          </div>
                          <input
                            value={link?.note || ''}
                            onChange={(e) => setWorldNpcConnectionNote(link.targetId, e.target.value)}
                            placeholder="Connection note (optional)"
                            className={`${styles.inputBase} ${styles.inputCompact}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className={`${styles.modalFooter} ${styles.modalFooterEnd}`}>
                {editingWorldNpcId && (
                  <button className={styles.backButton}
                    onMouseEnter={btnHover} onMouseLeave={btnLeave} onMouseDown={btnDown}
                    onClick={() => { setWorldNpcModalOpen(false); setEditingWorldNpcId(null); }}>
                    Cancel
                  </button>
                )}
                <button className={styles.goldBtn} onMouseEnter={btnHover} onMouseLeave={btnLeave} onMouseDown={btnDown} onClick={saveWorldNpc}>
                  {editingWorldNpcId ? 'Save Changes' : 'Add NPC'}
                </button>
              </div>


              {/* WORLD NPC IMAGE CROP */}
              {worldNpcCropOpen && (
                <div
                  className={`${styles.modalOverlay} ${styles.modalZ40}`}
                  onMouseDown={(e) => { if (e.target === e.currentTarget) setWorldNpcCropOpen(false); }}
                >
                  <div className={`${styles.modalShell} ${styles.modalShellCrop}`}>
                    <div className={styles.modalHeader}>
                      <div className={styles.modalTitle16}>Crop Image</div>
                      <button
                        className={`${styles.backButton} ${styles.backButtonSm}`}
                        onMouseEnter={btnHover}
                        onMouseLeave={btnLeave}
                        onMouseDown={(e) => { btnDown(e); navClick(); }}
                        onClick={() => setWorldNpcCropOpen(false)}
                      >
                        Close
                      </button>
                    </div>

                    <div className={styles.cropMainGrid}>
                      <div className={styles.cropCenter}>
                        <div
                          className={styles.cropFrame}
                          style={{
                            width: WORLD_NPC_CROP_BOX,
                            height: WORLD_NPC_CROP_BOX,
                          }}
                          onPointerDown={(e) => {
                            const img = worldNpcCropImgRef.current;
                            if (!img) return;
                            e.currentTarget.setPointerCapture(e.pointerId);
                            worldNpcCropDragRef.current.dragging = true;
                            worldNpcCropDragRef.current.sx = e.clientX;
                            worldNpcCropDragRef.current.sy = e.clientY;
                            worldNpcCropDragRef.current.ox = worldNpcCropOffset.x;
                            worldNpcCropDragRef.current.oy = worldNpcCropOffset.y;
                            e.preventDefault();
                          }}
                          onPointerMove={(e) => {
                            if (!worldNpcCropDragRef.current.dragging) return;
                            const img = worldNpcCropImgRef.current;
                            if (!img) return;
                            const dx = e.clientX - worldNpcCropDragRef.current.sx;
                            const dy = e.clientY - worldNpcCropDragRef.current.sy;
                            const iw = img.naturalWidth || 1;
                            const ih = img.naturalHeight || 1;
                            const base = Math.max(WORLD_NPC_CROP_BOX / iw, WORLD_NPC_CROP_BOX / ih);
                            const scale = base * worldNpcCropZoom;
                            const rw = iw * scale;
                            const rh = ih * scale;
                            const maxX = Math.max(0, (rw - WORLD_NPC_CROP_BOX) / 2);
                            const maxY = Math.max(0, (rh - WORLD_NPC_CROP_BOX) / 2);
                            setWorldNpcCropOffset({
                              x: clamp(worldNpcCropDragRef.current.ox + dx, -maxX, maxX),
                              y: clamp(worldNpcCropDragRef.current.oy + dy, -maxY, maxY),
                            });
                          }}
                          onPointerUp={(e) => {
                            if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
                            worldNpcCropDragRef.current.dragging = false;
                            clampCropOffset();
                          }}
                          onPointerCancel={(e) => {
                            if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
                            worldNpcCropDragRef.current.dragging = false;
                            clampCropOffset();
                          }}
                        >
                          <img
                            ref={worldNpcCropImgRef}
                            src={worldNpcCropSrc}
                            alt="Crop"
                            onLoad={() => {
                              const img = worldNpcCropImgRef.current;
                              if (img) {
                                const iw = img.naturalWidth || 1;
                                const ih = img.naturalHeight || 1;
                                setWorldNpcCropBaseScale(Math.max(WORLD_NPC_CROP_BOX / iw, WORLD_NPC_CROP_BOX / ih));
                              }
                              clampCropOffset();
                            }}
                            className={styles.cropImage}
                            style={{
                              transform: `translate(-50%, -50%) translate(${worldNpcCropOffset.x}px, ${worldNpcCropOffset.y}px) scale(${worldNpcCropBaseScale * worldNpcCropZoom})`,
                            }}
                            draggable={false}
                          />

                          {/* subtle corner marks */}
                          <div className={styles.cropGuide} />
                        </div>
                      </div>

                      <div className={styles.cropSide}>
                        <div className={`${styles.darkCard} ${styles.darkCardPad14}`}>
                          <div className={styles.zoomTitle}>Zoom</div>
                          <input
                            className={`${styles.rng} ${styles.cropZoomRng}`}
                            type="range"
                            min={1}
                            max={2.5}
                            step={0.01}
                            value={worldNpcCropZoom}
                            onChange={(e) => { setWorldNpcCropZoom(parseFloat(e.target.value) || 1); }}
                            onMouseUp={clampCropOffset}
                            onTouchEnd={clampCropOffset}
                          />
                          <div className={styles.zoomHint}>
                            Drag the image to position it inside the frame.
                          </div>
                        </div>

                        <div className={styles.cropActionRow}>
                          <button
                            className={styles.backButton}
                            onMouseEnter={btnHover}
                            onMouseLeave={btnLeave}
                            onMouseDown={(e) => { btnDown(e); navClick(); }}
                            onClick={() => setWorldNpcCropOpen(false)}
                          >
                            Cancel
                          </button>
                          <button
                            className={styles.goldBtn}
                            onMouseEnter={btnHover}
                            onMouseLeave={btnLeave}
                            onMouseDown={(e) => { btnDown(e); navClick(); }}
                            onClick={applyWorldNpcCrop}
                          >
                            Use Cropped Image
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Persistent audio element — outside all conditionals so it never unmounts */}
      <audio
        ref={charAudioRef}
        preload="auto"
        onLoadedMetadata={(e) => setCharSongDur(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setCharSongTime(e.currentTarget.currentTime || 0)}
        onEnded={() => setCharSongOn(false)}
        onError={() => setCharSongOn(false)}
        className={styles.hiddenAudio}
      />
    </ShellLayout>
  );
}


