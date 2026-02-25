import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ShellLayout from './ShellLayout';

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
  // Full-panel shell (match WorldLore: header sits at the very top)
  // IMPORTANT: Keep background transparent so we don't darken your global tavern backdrop.
  const cardShell = {
    width: '100%',
    height: '100%',
    borderRadius: 0,
    background: 'transparent',
    border: 'none',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
    fontFamily: fontStack,
    boxShadow: 'none',
    position: 'relative',
    overflow: 'hidden',
    color: THEME.creamText,
  };

  const edgeGlow = {
    position: 'absolute',
    inset: -2,
    borderRadius: 0,
    pointerEvents: 'none',
    background: 'linear-gradient(135deg, rgba(176,101,0,0.34), rgba(255,140,60,0.18), rgba(255,80,80,0.14))',
    filter: 'blur(18px)',
    opacity: 0.18,
    zIndex: 0,
  };

  const headerBar = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    padding: '12px 18px',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
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
  // Space reserved for the header is measured dynamically via headerRef.

  const bodyArea = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: headerH,
    bottom: 0,
    padding: 14,
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

  const [worldNpcModalOpen, setWorldNpcModalOpen] = useState(false);
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
      goals: 'Protect those he loves and uncover the truth behind his cursed power.',
      npcs: [
        { name: 'Darius Blanc', relation: 'Father', bio: 'A strict man who despised magic. His death during the Oakhaven raid left a scar on William that never healed.' },
        { name: 'Eleanore VanFalen', relation: 'Mother', bio: 'William was told she died in childbirth. The truth is… complicated, and the trail always feels intentionally blurred.' },
        { name: 'Tarzos Spicer', relation: 'Savior / Guardian', bio: 'The one who saved William during the raid, at a devastating cost. Left behind a tarot card: The Fool.' },
        { name: 'Ryken', relation: 'Patron', bio: "A force of bargain and consequence. Not a creator of William's split—just the shadow waiting to collect." },
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
        { name: 'Jasper Delancey', relation: 'Childhood Friend (Cover Story)', bio: 'Their parents think they\'re courting. In reality: a mutually useful disguise with complicated edges.' },
      ],
    },
    {
      name: 'Thryvaris Bria',
      image: '/characters/3V.png',
      synopsis: 'A mysterious mage with that lives in a cave.',
      age: "Early 20's", height: "6'1\"",
      class: 'Sorcerer',
      lore: 'Little is known of Thryvaris beyond whispers of forbidden study and impossible power.',
      goals: 'Pursue truths lost to time.',
      npcs: [{ name: 'The Archivist', relation: 'Informant', bio: 'A keeper of forbidden catalogs who sells information like it\'s contraband. Because it is.' }],
    },
    {
      name: 'Fen', image: '/characters/Fen.png',
      synopsis: 'A relentless warrior of iron will.',
      age: 'Late-20s', height: "6'7\"", class: 'Barbarian',
      lore: 'Blunt, fierce, and fiercely loyal, Fen masks deep care with sharp words and unstoppable fury in battle.',
      goals: 'Protect the party at any cost.',
      npcs: [
        { name: 'Warchief Brann', relation: 'Former Leader', bio: 'The one who taught Fen to fight first and ask questions later. Whether he\'d be proud or furious… depends on the day.' },
        { name: 'Sister Kaela', relation: 'Old Rival', bio: 'A rival who never let Fen win clean. Somehow, that\'s exactly why Fen respects her.' },
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
      synopsis: 'A dhampir walking between night and dawn.',
      age: 'Appears early-20s', height: "5'6\"", class: 'Dhampir Spellblade',
      lore: 'Having spent decades in isolation and survival, Cerci hides centuries of pain beneath quiet strength. Her bond with William is one of the few anchors keeping her tied to hope.',
      goals: 'Find belonging beyond the shadows of her past.',
      npcs: [
        { name: 'Bingo', relation: 'Circus Companion', bio: "A familiar face from Cerci's circus years—part comfort, part reminder that her \"past lives\" weren't just survival." },
        { name: 'The Night Court (Rumor)', relation: 'Unseen Watchers', bio: 'Whispers say someone has been keeping tabs on Cerci for a very long time… and not out of kindness.' },
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
      npcs: [],
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

  const importCharacterNpcsIntoWorld = () => {
    const seedsByName = new Map();

    characters.forEach((char) => {
      const owned = getCharacterOwnedNpcs(char);
      owned.forEach((npc) => {
        const name = (npc.name || '').trim();
        if (!name) return;
        const key = name.toLowerCase();
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

    if (!seedsByName.size) return;

    setWorldNpcs((prev) => {
      const next = [...(prev || [])];
      let changed = false;
      seedsByName.forEach((seed, key) => {
        const idx = next.findIndex((n) => ((n.name || '').trim().toLowerCase() === key));
        if (idx < 0) {
          next.push(normalizeWorldNpc({
            ...seed,
            id: newId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }, next.length));
          changed = true;
          return;
        }
        const cur = normalizeWorldNpc(next[idx], idx);
        let rowChanged = false;

        const mergedCharLinks = [...(cur.characterLinks || [])];
        (seed.characterLinks || []).forEach((l) => {
          const li = mergedCharLinks.findIndex((x) => x.characterName === l.characterName);
          if (li < 0) {
            mergedCharLinks.push(l);
            rowChanged = true;
          } else if (!mergedCharLinks[li].relation && l.relation) {
            mergedCharLinks[li] = { ...mergedCharLinks[li], relation: l.relation };
            rowChanged = true;
          }
        });

        const patch = {};
        if (!cur.age && seed.age) { patch.age = seed.age; rowChanged = true; }
        if (!cur.faction && seed.faction) { patch.faction = seed.faction; rowChanged = true; }
        if (!cur.occupation && seed.occupation) { patch.occupation = seed.occupation; rowChanged = true; }
        if (!cur.summary && seed.summary) { patch.summary = seed.summary; rowChanged = true; }
        if (!cur.bio && seed.bio) { patch.bio = seed.bio; rowChanged = true; }
        if (!cur.image && seed.image) { patch.image = seed.image; rowChanged = true; }
        if (rowChanged) {
          next[idx] = {
            ...cur,
            ...patch,
            characterLinks: mergedCharLinks,
            updatedAt: new Date().toISOString(),
          };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  };

  useEffect(() => {
    if (charView === 'worldnpcs') {
      importCharacterNpcsIntoWorld();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charView]);

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
    const worldList = worldNpcs || [];
    const worldNodes = worldList.map((n, idx) => {
      const x = worldList.length
        ? 50 + 38 * Math.cos((-Math.PI / 2) + (2 * Math.PI * idx / Math.max(1, worldList.length)))
        : 50;
      const y = worldList.length
        ? 50 + 34 * Math.sin((-Math.PI / 2) + (2 * Math.PI * idx / Math.max(1, worldList.length)))
        : 50;
      return { id: `world:${n.id}`, type: 'world', label: n.name || 'NPC', x, y };
    });

    const charSet = new Set();
    worldList.forEach((n) => {
      (n.characterLinks || []).forEach((l) => { if (l.characterName) charSet.add(l.characterName); });
    });
    const charList = Array.from(charSet);
    const charNodes = charList.map((name, idx) => {
      const x = charList.length
        ? 50 + 20 * Math.cos((-Math.PI / 2) + (2 * Math.PI * idx / Math.max(1, charList.length)))
        : 50;
      const y = charList.length
        ? 50 + 16 * Math.sin((-Math.PI / 2) + (2 * Math.PI * idx / Math.max(1, charList.length)))
        : 50;
      return { id: `char:${name}`, type: 'character', label: name, x, y };
    });

    const nodes = [...worldNodes, ...charNodes];
    const nodeById = {};
    nodes.forEach((n) => { nodeById[n.id] = n; });

    // Keep lines from visually cutting through unrelated character nodes.
    const charRectsById = {};
    charNodes.forEach((node) => {
      const len = (node.label || '').length;
      const halfW = Math.min(7.6, Math.max(4.9, 2.8 + len * 0.24));
      const halfH = 3.9;
      charRectsById[node.id] = {
        left: node.x - halfW,
        right: node.x + halfW,
        top: node.y - halfH,
        bottom: node.y + halfH,
      };
    });

    const pointInRect = (p, r) =>
      p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;

    const segmentHitsRect = (a, b, rect) => {
      const steps = 36;
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        if (pointInRect(p, rect)) return true;
      }
      return false;
    };

    const routeEdge = (fromId, toId) => {
      const from = nodeById[fromId];
      const to = nodeById[toId];
      if (!from || !to) return [];

      const blockedRects = Object.entries(charRectsById)
        .filter(([id]) => id !== fromId && id !== toId)
        .map(([, rect]) => rect);

      const segmentBlocked = (p1, p2) =>
        blockedRects.some((rect) => segmentHitsRect(p1, p2, rect));

      if (!segmentBlocked(from, to)) return [from, to];

      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      const singleWaypointCandidates = [
        { x: 6, y: midY }, { x: 94, y: midY },
        { x: midX, y: 8 }, { x: midX, y: 92 },
        { x: 6, y: from.y }, { x: 6, y: to.y },
        { x: 94, y: from.y }, { x: 94, y: to.y },
        { x: from.x, y: 8 }, { x: to.x, y: 8 },
        { x: from.x, y: 92 }, { x: to.x, y: 92 },
      ];

      for (const wp of singleWaypointCandidates) {
        if (!segmentBlocked(from, wp) && !segmentBlocked(wp, to)) {
          return [from, wp, to];
        }
      }

      for (const x of [4, 96]) {
        const w1 = { x, y: from.y };
        const w2 = { x, y: to.y };
        if (!segmentBlocked(from, w1) && !segmentBlocked(w1, w2) && !segmentBlocked(w2, to)) {
          return [from, w1, w2, to];
        }
      }

      for (const y of [4, 96]) {
        const w1 = { x: from.x, y };
        const w2 = { x: to.x, y };
        if (!segmentBlocked(from, w1) && !segmentBlocked(w1, w2) && !segmentBlocked(w2, to)) {
          return [from, w1, w2, to];
        }
      }

      return [from, to];
    };

    const edges = [];
    const seen = new Set();

    worldList.forEach((n) => {
      const from = `world:${n.id}`;
      (n.links || []).forEach((l) => {
        const to = `world:${l.targetId}`;
        if (!nodeById[to]) return;
        const key = [from, to].sort().join('::');
        if (seen.has(key)) return;
        seen.add(key);
        edges.push({ from, to, type: 'npc', note: l.note || '', route: routeEdge(from, to) });
      });
      (n.characterLinks || []).forEach((l) => {
        const to = `char:${l.characterName}`;
        if (!nodeById[to]) return;
        const key = `${from}::${to}`;
        if (seen.has(key)) return;
        seen.add(key);
        edges.push({ from, to, type: 'character', note: l.relation || '', route: routeEdge(from, to) });
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
        <div ref={headerRef} style={{
          ...headerBar,
          padding: '44px 36px 16px',
          gap: 12,
          background: 'linear-gradient(180deg, rgba(8,5,2,0.92), rgba(8,5,2,0.78))',
          borderBottom: `1px solid ${THEME.lineSoft}`,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
            position: 'relative',
            zIndex: 1,
          }}>
            <button
              onClick={() => { navClick(); cinematicNav('menu'); }}
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
              style={{
                background: `linear-gradient(180deg, ${THEME.glassA}, ${THEME.glassB})`,
                border: `1px solid ${THEME.line}`,
                color: 'rgba(255,220,160,0.8)',
                padding: '9px 18px',
                borderRadius: 14,
                cursor: 'pointer',
                fontSize: 12,
                letterSpacing: '0.14em',
                fontFamily: fontStack,
                fontWeight: 950,
                backdropFilter: 'blur(10px)',
                transition: 'all 150ms ease',
                boxShadow: '0 10px 28px rgba(0,0,0,0.3)',
                userSelect: 'none',
              }}
            >
              ← RETURN
            </button>

            <div style={{ textAlign: 'center', flex: 1, minWidth: 240 }}>
              <div style={{
                fontSize: 10,
                letterSpacing: '0.38em',
                color: 'rgba(255,220,160,0.45)',
                marginBottom: 10,
                marginTop: -6,
                fontFamily: fontStack,
                textTransform: 'uppercase',
                userSelect: 'none',
              }}>
                ✦ &nbsp; CODEX OF THE PARTY &nbsp; ✦
              </div>
              <div style={{
                margin: 0,
                fontFamily: fontStack,
                fontSize: 'clamp(1.35rem, 2.6vw, 2.05rem)',
                fontWeight: 950,
                color: THEME.creamText,
                letterSpacing: '0.18em',
                textShadow: '0 0 40px rgba(176,101,0,0.5), 0 2px 18px rgba(0,0,0,0.7)',
                lineHeight: 1.05,
              }}>
                CHARACTER BOOK
              </div>
            </div>

            {/* Spacer to balance */}
            <div style={{ width: 120 }} />
          </div>

          {/* Context tabs (only show when applicable) */}

        </div>

        {/* Body */}
        <div style={bodyArea}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>

            {/* Buttons (below header, above content) — NOT sticky, no overlay bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 10,
              flexWrap: 'wrap',
              margin: '6px 0 14px',
            }}>
              {(charView === 'worldnpcs' || showProfileTab) && (
                <button
                  type="button"
                  style={{
                    ...tabButtonStyle(charView !== 'worldnpcs'),
                    padding: '10px 14px',
                    borderRadius: 999,
                    fontSize: 12,
                    letterSpacing: '0.16em',
                    fontWeight: 900,
                    fontFamily: fontStack,
                    cursor: 'pointer',
                    border: charView !== 'worldnpcs'
                      ? '1px solid rgba(255,220,160,0.35)'
                      : '1px solid rgba(255,220,160,0.18)',
                    background: charView !== 'worldnpcs'
                      ? 'linear-gradient(180deg, rgba(8,5,2,0.88), rgba(8,5,2,0.72))'
                      : 'linear-gradient(180deg, rgba(8,5,2,0.75), rgba(8,5,2,0.60))',
                    color: 'rgba(255,245,220,0.92)',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.45)',
                    transition: 'all 150ms ease',
                  }}
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
                  style={{
                    ...tabButtonStyle(charView === 'worldnpcs'),
                    padding: '10px 14px',
                    borderRadius: 999,
                    fontSize: 12,
                    letterSpacing: '0.16em',
                    fontWeight: 900,
                    fontFamily: fontStack,
                    cursor: 'pointer',
                    border: charView !== 'worldnpcs'
                      ? '1px solid rgba(255,220,160,0.35)'
                      : '1px solid rgba(255,220,160,0.18)',
                    background: charView !== 'worldnpcs'
                      ? 'linear-gradient(180deg, rgba(8,5,2,0.88), rgba(8,5,2,0.72))'
                      : 'linear-gradient(180deg, rgba(8,5,2,0.75), rgba(8,5,2,0.60))',
                    color: 'rgba(255,245,220,0.92)',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.45)',
                    transition: 'all 150ms ease',
                  }}
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
                  style={{
                    ...tinyBtn,
                    padding: '10px 14px',
                    borderRadius: 999,
                    opacity: charSongSrc ? 1 : 0.45,
                    cursor: charSongSrc ? 'pointer' : 'not-allowed',
                    fontSize: 12,
                    letterSpacing: '0.08em',
                  }}
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
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      style={{ ...tinyBtn, padding: '10px 14px', opacity: 0.95 }}
                      onMouseEnter={tinyBtnHover}
                      onMouseLeave={tinyBtnLeave}
                      onMouseDown={navClick}
                      onClick={importCharacterNpcsIntoWorld}
                    >
                      Import Character NPCs
                    </button>
                    <button style={goldBtn} onMouseEnter={btnHover} onMouseLeave={btnLeave} onMouseDown={btnDown} onClick={openAddWorldNpc}>
                      + Add NPC
                    </button>
                  </div>
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
                      placeholder="Name, age, faction, occupation, location, summary…" style={inputBase} />
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
                    {filteredWorldNpcs.map((n) => {
                      const linkedChars = (n.characterLinks || []).map((l) =>
                        l.relation ? `${l.characterName} (${l.relation})` : l.characterName
                      );
                      const connectedNames = (n.links || [])
                        .map((l) => worldNpcById[l.targetId]?.name)
                        .filter(Boolean);
                      return (
                        <div key={n.id} className="cb-npc-hover" style={{ ...darkCard, cursor: 'pointer', transition: 'all 0.2s ease' }}
                          onMouseDown={navClick}
                          onClick={() => openEditWorldNpc(n)}
                          role="button" tabIndex={0}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 220 }}>
                              {n.image ? (
                                <img
                                  src={n.image}
                                  alt={n.name || 'NPC'}
                                  style={{
                                    width: 44,
                                    height: 44,
                                    objectFit: 'cover',
                                    borderRadius: 12,
                                    border: `1px solid ${THEME.lineSoft}`,
                                    boxShadow: '0 10px 22px rgba(0,0,0,0.42)',
                                    flex: '0 0 auto',
                                  }}
                                />
                              ) : (
                                <div
                                  aria-hidden
                                  style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 12,
                                    border: `1px solid ${THEME.lineSoft}`,
                                    background: 'linear-gradient(180deg, rgba(30,20,10,0.70), rgba(18,12,6,0.78))',
                                    boxShadow: '0 10px 22px rgba(0,0,0,0.30)',
                                    flex: '0 0 auto',
                                  }}
                                />
                              )}
                              <div style={{ fontSize: 15, fontWeight: 950, color: THEME.creamText }}>{n.name}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                              <span style={{ fontSize: 12, fontWeight: 900, color: (n.faction || '').trim() ? THEME.creamSoft : 'rgba(255,245,220,0.38)' }}>
                                Faction: {(n.faction || '').trim() || '—'}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 900, color: (n.location || '').trim() ? THEME.creamSoft : 'rgba(255,245,220,0.38)' }}>
                                Location: {(n.location || '').trim() || '—'}
                              </span>
                            </div>
                          </div>

                          {(n.summary || n.bio) && (
                            <div style={{ marginTop: 8, opacity: 0.88, lineHeight: 1.55, fontSize: 13 }}>
                              {(n.summary || n.bio || '').trim()}
                            </div>
                          )}

                          <div style={{ marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: 11.5, fontWeight: 900, color: linkedChars.length ? THEME.creamSoft : 'rgba(255,245,220,0.42)' }}>
                              Linked Characters: {linkedChars.length ? linkedChars.join(', ') : 'None'}
                            </span>
                            <span style={{ fontSize: 11.5, fontWeight: 900, color: connectedNames.length ? THEME.creamSoft : 'rgba(255,245,220,0.42)' }}>
                              Connected NPCs: {connectedNames.length ? connectedNames.join(', ') : 'None'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={lightCard}>
                  <div style={{ fontSize: 16, fontWeight: 950, color: THEME.creamText }}>Connection Web (Preview)</div>
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75, color: THEME.creamSoft }}>
                    Gold lines connect NPC-to-NPC links. Blue lines connect NPCs to linked player characters.
                  </div>
                  {connectionWeb.nodes.length === 0 ? (
                    <div style={{ marginTop: 12, opacity: 0.78, lineHeight: 1.6, color: THEME.creamSoft }}>
                      Add NPCs and links to build your relationship web.
                    </div>
                  ) : (
                    <div style={{ marginTop: 12, position: 'relative', height: 360, borderRadius: 14, border: `1px solid ${THEME.lineSoft}`, background: 'linear-gradient(180deg, rgba(8,6,4,0.50), rgba(8,6,4,0.28))', overflow: 'hidden' }}>
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                        {connectionWeb.edges.map((edge, idx) => {
                          const a = connectionWeb.nodeById[edge.from];
                          const b = connectionWeb.nodeById[edge.to];
                          if (!a || !b) return null;
                          const route = Array.isArray(edge.route) && edge.route.length >= 2 ? edge.route : [a, b];
                          const d = route.map((p, pointIdx) => `${pointIdx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                          return (
                            <path
                              key={`${edge.from}-${edge.to}-${idx}`}
                              d={d}
                              fill="none"
                              stroke={edge.type === 'character' ? 'rgba(120,180,255,0.72)' : 'rgba(255,210,120,0.70)'}
                              strokeWidth={edge.type === 'character' ? 0.22 : 0.28}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          );
                        })}
                      </svg>
                      {connectionWeb.nodes.map((node) => (
                        <div
                          key={node.id}
                          title={node.label}
                          style={{
                            position: 'absolute',
                            left: `${node.x}%`,
                            top: `${node.y}%`,
                            transform: 'translate(-50%, -50%)',
                            minWidth: 66,
                            maxWidth: 92,
                            padding: '4px 6px',
                            borderRadius: 999,
                            border: `1px solid ${node.type === 'character' ? 'rgba(120,180,255,0.36)' : THEME.lineSoft}`,
                            background: node.type === 'character'
                              ? 'linear-gradient(180deg, rgba(26,44,72,0.88), rgba(14,26,44,0.90))'
                              : 'linear-gradient(180deg, rgba(42,28,14,0.88), rgba(20,14,8,0.90))',
                            boxShadow: '0 8px 18px rgba(0,0,0,0.42)',
                            color: THEME.creamText,
                            fontSize: 10.5,
                            fontWeight: 900,
                            letterSpacing: 0.2,
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {node.label}
                        </div>
                      ))}
                    </div>
                  )}
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

                      {/* Character Theme Song (start with Von'Ghul) */}
                      {/* Character Theme Song (Von'Ghul for now) */}
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={divider} />
                        <div
                          style={{
                            padding: 12,
                            borderRadius: 14,
                            background: 'linear-gradient(180deg, rgba(30,20,10,0.82), rgba(18,12,6,0.90))',
                            border: `1px solid ${THEME.lineSoft}`,
                            boxShadow: '0 10px 26px rgba(0,0,0,0.35)',
                          }}
                        >
                          {/* Single persistent audio element — lives outside this block, see below */}

                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 950, opacity: 0.65, color: THEME.creamSoft, letterSpacing: 0.4 }}>
                                Theme
                              </div>

                              {charSongSrc ? (
                                <div style={{ fontSize: 12, fontWeight: 900, color: THEME.creamText, marginTop: 2 }}>
                                  {fmtTime(charSongTime)} / {fmtTime(charSongDur)}
                                </div>
                              ) : (
                                <div style={{ fontSize: 12, fontWeight: 900, color: THEME.creamSoft, marginTop: 2, opacity: 0.85 }}>
                                  No theme assigned.
                                </div>
                              )}
                            </div>

                            <button
                              disabled={!charSongSrc}
                              style={{
                                ...tinyBtn,
                                padding: '8px 12px',
                                opacity: charSongSrc ? 1 : 0.45,
                                cursor: charSongSrc ? 'pointer' : 'not-allowed',
                              }}
                              onMouseEnter={(e) => { if (charSongSrc) tinyBtnHover(e); }}
                              onMouseLeave={(e) => { if (charSongSrc) tinyBtnLeave(e); }}
                              onMouseDown={(e) => { if (charSongSrc) navClick(e); }}
                              onClick={(e) => { e.preventDefault(); if (charSongSrc) toggleCharSong(); }}
                            >
                              {charSongOn ? 'Pause' : 'Play'}
                            </button>
                          </div>

                          <input
                            className="cb-rng"
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

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, opacity: charSongSrc ? 1 : 0.55 }}>
                            <div style={{ fontSize: 11, fontWeight: 950, opacity: 0.65, color: THEME.creamSoft, letterSpacing: 0.4 }}>Vol</div>
                            <input
                              className="cb-rng"
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
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 17, fontWeight: 950, color: THEME.creamText }}>{selectedChar.name} — Family & Related NPCs</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ opacity: 0.65, fontWeight: 900, fontSize: 12, color: THEME.creamSoft }}>{selectedCharNpcs.length} entries</div>
                    <button
                      style={{ ...tinyBtn, padding: '7px 12px', opacity: 0.95 }}
                      onMouseEnter={tinyBtnHover}
                      onMouseLeave={tinyBtnLeave}
                      onMouseDown={navClick}
                      onClick={openAddCharNpc}
                    >
                      + Add NPC
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selectedCharNpcs.map((npc) => (
                    <div key={npc.id || npc.name} className="cb-npc-hover"
                      style={{ ...darkCard, cursor: 'pointer', transition: 'all 0.2s ease' }}
                      onMouseDown={navClick}
                      onClick={() => { setSelectedNpc(npc); setCharView('npc'); }}
                      role="button" tabIndex={0}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 240 }}>
                          {npc.image ? (
                            <img
                              src={npc.image}
                              alt={npc.name || 'NPC'}
                              style={{
                                width: 48,
                                height: 48,
                                objectFit: 'cover',
                                borderRadius: 12,
                                border: `1px solid ${THEME.lineSoft}`,
                                boxShadow: '0 10px 24px rgba(0,0,0,0.45)',
                                flex: '0 0 auto',
                              }}
                            />
                          ) : (
                            <div
                              aria-hidden
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 12,
                                border: `1px solid ${THEME.lineSoft}`,
                                background: 'linear-gradient(180deg, rgba(30,20,10,0.72), rgba(18,12,6,0.82))',
                                boxShadow: '0 10px 24px rgba(0,0,0,0.30)',
                                flex: '0 0 auto',
                              }}
                            />
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 950, fontSize: 15, color: THEME.creamText }}>{npc.name}</div>
                            <div style={{ opacity: 0.75, fontWeight: 900, fontStyle: 'italic', color: THEME.creamSoft, marginTop: 2 }}>{npc.relation || 'Relation unknown'}</div>
                          </div>
                        </div>
                        <button
                          style={{ ...tinyBtn, opacity: 0.95 }}
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
                      <div style={{ marginTop: 8, opacity: 0.85, lineHeight: 1.55, fontSize: 13, color: THEME.creamSoft }}>
                        {(npc.summary || npc.bio || '').trim() || 'No synopsis yet. Click Edit to add one.'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* NPC DETAIL */}
            {charView === 'npc' && selectedChar && activeSelectedNpc && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                <div style={lightCard}>
                  <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 14, alignItems: 'start' }}>
                    {activeSelectedNpc.image ? (
                      <img
                        src={activeSelectedNpc.image}
                        alt={activeSelectedNpc.name || 'NPC'}
                        style={{
                          width: 130,
                          height: 130,
                          objectFit: 'cover',
                          borderRadius: 14,
                          border: `1px solid ${THEME.lineSoft}`,
                          boxShadow: '0 14px 30px rgba(0,0,0,0.48)',
                        }}
                      />
                    ) : (
                      <div
                        aria-hidden
                        style={{
                          width: 130,
                          height: 130,
                          borderRadius: 14,
                          border: `1px solid ${THEME.lineSoft}`,
                          background: 'linear-gradient(180deg, rgba(30,20,10,0.72), rgba(18,12,6,0.82))',
                          boxShadow: '0 14px 30px rgba(0,0,0,0.32)',
                        }}
                      />
                    )}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                        <div style={{ fontSize: 19, fontWeight: 950, color: THEME.creamText }}>{activeSelectedNpc.name}</div>
                        <div style={{ opacity: 0.72, fontWeight: 900, fontStyle: 'italic', color: THEME.creamSoft }}>
                          {(activeSelectedNpc.relation || 'Relation unknown')} of {selectedChar.name}
                        </div>
                      </div>
                      <div style={divider} />
                      <div style={{ opacity: 0.90, lineHeight: 1.65, fontSize: 13.5, color: THEME.creamSoft }}>
                        {(activeSelectedNpc.summary || activeSelectedNpc.bio || '').trim() || 'No synopsis yet.'}
                      </div>
                      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr', gap: 4, lineHeight: 1.55, fontSize: 13, color: THEME.creamSoft }}>
                        <div><strong style={{ color: THEME.creamText }}>Age:</strong> {(activeSelectedNpc.age || '').trim() || 'Unknown'}</div>
                        <div><strong style={{ color: THEME.creamText }}>Faction:</strong> {(activeSelectedNpc.faction || '').trim() || 'Unknown'}</div>
                        <div><strong style={{ color: THEME.creamText }}>Occupation:</strong> {(activeSelectedNpc.occupation || '').trim() || 'Unknown'}</div>
                      </div>
                      <div
                        style={{
                          marginTop: 12,
                          borderRadius: 12,
                          border: `1px solid ${THEME.lineSoft}`,
                          background: 'linear-gradient(180deg, rgba(16,11,7,0.50), rgba(8,6,4,0.36))',
                          boxShadow: 'inset 0 1px 0 rgba(255,240,200,0.06)',
                          padding: '10px 12px',
                        }}
                      >
                        <div style={{ fontSize: 11, letterSpacing: 0.35, fontWeight: 900, color: THEME.creamSoft, opacity: 0.74 }}>
                          Lore
                        </div>
                        <div style={{ marginTop: 6, opacity: 0.92, lineHeight: 1.62, fontSize: 13, color: THEME.creamSoft, whiteSpace: 'pre-wrap' }}>
                          {(activeSelectedNpc.bio && activeSelectedNpc.bio.trim() ? activeSelectedNpc.bio : 'No lore yet.')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                    <button
                      style={goldBtn}
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

        {/* CHARACTER NPC MODAL */}
        {charNpcModalOpen && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 32,
              background: 'rgba(0,0,0,0.72)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              backdropFilter: 'blur(4px)',
            }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) closeCharNpcModal(); }}
          >
            <div style={{
              width: 'min(720px, 96vw)',
              borderRadius: 22,
              background: 'linear-gradient(180deg, rgba(28,20,12,0.97), rgba(14,10,6,0.98))',
              boxShadow: '0 30px 90px rgba(0,0,0,0.75)',
              border: `1px solid ${THEME.line}`,
              color: THEME.creamText,
              fontFamily: fontStack,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: 'min(660px, 88vh)',
            }}>
              <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderBottom: `1px solid ${THEME.lineSoft}` }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 950 }}>{editingCharNpcId ? 'Edit Related NPC' : 'Add Related NPC'}</div>
                  <div style={{ fontSize: 11.5, opacity: 0.72, marginTop: 2 }}>{selectedChar?.name || 'Character'} codex entry</div>
                </div>
                <button
                  style={{ ...backButton, padding: '8px 14px', fontSize: 12 }}
                  onMouseEnter={btnHover}
                  onMouseLeave={btnLeave}
                  onMouseDown={btnDown}
                  onClick={closeCharNpcModal}
                >
                  Close
                </button>
              </div>

              <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignContent: 'start', overflowY: 'auto' }}>
                <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '110px 1fr', gap: 12, alignItems: 'center' }}>
                  <div>
                    {charNpcDraft.image ? (
                      <img
                        src={charNpcDraft.image}
                        alt="NPC"
                        style={{
                          width: 110,
                          height: 110,
                          objectFit: 'cover',
                          borderRadius: 14,
                          border: `1px solid ${THEME.lineSoft}`,
                          boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
                          display: 'block',
                        }}
                      />
                    ) : (
                      <div
                        aria-hidden
                        style={{
                          width: 110,
                          height: 110,
                          borderRadius: 14,
                          border: `1px solid ${THEME.lineSoft}`,
                          background: 'linear-gradient(180deg, rgba(30,20,10,0.72), rgba(18,12,6,0.82))',
                          boxShadow: '0 12px 28px rgba(0,0,0,0.32)',
                        }}
                      />
                    )}
                  </div>
                  <div>
                    <div style={fieldLabel}>Thumbnail Image (optional)</div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => onCharNpcImagePick(e.target.files && e.target.files[0])}
                        style={{ ...inputBase, padding: '8px 10px', width: 'auto', flex: '1 1 260px' }}
                      />
                      {charNpcDraft.image && (
                        <button
                          type="button"
                          style={{ ...tinyBtn, opacity: 0.95 }}
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
                  <div style={fieldLabel}>Name</div>
                  <input
                    value={charNpcDraft.name}
                    onChange={(e) => setCharNpcDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="e.g. Captain Rell"
                    style={{ ...inputBase, fontWeight: 900 }}
                  />
                </div>
                <div>
                  <div style={fieldLabel}>Relation</div>
                  <input
                    value={charNpcDraft.relation}
                    onChange={(e) => setCharNpcDraft((d) => ({ ...d, relation: e.target.value }))}
                    placeholder="e.g. Mentor, Parent, Patron"
                    style={inputBase}
                  />
                </div>
                <div>
                  <div style={fieldLabel}>Age</div>
                  <input
                    value={charNpcDraft.age}
                    onChange={(e) => setCharNpcDraft((d) => ({ ...d, age: e.target.value }))}
                    placeholder="e.g. 42"
                    style={inputBase}
                  />
                </div>
                <div>
                  <div style={fieldLabel}>Faction</div>
                  <input
                    value={charNpcDraft.faction}
                    onChange={(e) => setCharNpcDraft((d) => ({ ...d, faction: e.target.value }))}
                    placeholder="e.g. Church of Amiras"
                    style={inputBase}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={fieldLabel}>Occupation</div>
                  <input
                    value={charNpcDraft.occupation}
                    onChange={(e) => setCharNpcDraft((d) => ({ ...d, occupation: e.target.value }))}
                    placeholder="e.g. Captain, Scholar, Merchant"
                    style={inputBase}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={fieldLabel}>Quick Synopsis (shown on cards)</div>
                  <textarea
                    value={charNpcDraft.summary}
                    onChange={(e) => setCharNpcDraft((d) => ({ ...d, summary: e.target.value }))}
                    placeholder="One to two lines for quick reference."
                    rows={3}
                    style={{ ...inputBase, resize: 'vertical', minHeight: 84, lineHeight: 1.5 }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={fieldLabel}>Lore</div>
                  <textarea
                    value={charNpcDraft.bio}
                    onChange={(e) => setCharNpcDraft((d) => ({ ...d, bio: e.target.value }))}
                    placeholder="Long-form lore, history, hooks, secrets..."
                    rows={6}
                    style={{ ...inputBase, resize: 'vertical', minHeight: 140, lineHeight: 1.5 }}
                  />
                </div>
              </div>

              <div style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', gap: 10, borderTop: `1px solid ${THEME.lineSoft}` }}>
                <div>
                  {editingCharNpcId && (
                    <button
                      style={{ ...backButton, padding: '10px 16px', fontSize: 13 }}
                      onMouseEnter={btnHover}
                      onMouseLeave={btnLeave}
                      onMouseDown={btnDown}
                      onClick={deleteCharNpc}
                    >
                      Delete NPC
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    style={{ ...backButton, padding: '10px 16px', fontSize: 13 }}
                    onMouseEnter={btnHover}
                    onMouseLeave={btnLeave}
                    onMouseDown={btnDown}
                    onClick={closeCharNpcModal}
                  >
                    Cancel
                  </button>
                  <button
                    style={goldBtn}
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
            style={{
              position: 'absolute', inset: 0, zIndex: 30,
              background: 'rgba(0,0,0,0.70)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
              backdropFilter: 'blur(4px)',
            }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) setWorldNpcModalOpen(false); }}
          >
            <div style={{
              width: 'min(760px, 96vw)',
              borderRadius: 22,
              background: 'linear-gradient(180deg, rgba(28,20,12,0.97), rgba(14,10,6,0.98))',
              boxShadow: '0 30px 90px rgba(0,0,0,0.75)',
              border: `1px solid ${THEME.line}`,
              color: THEME.creamText,
              fontFamily: fontStack,
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              maxHeight: 'min(760px, 90vh)',
            }}>
              <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderBottom: `1px solid ${THEME.lineSoft}` }}>
                <div style={{ fontSize: 17, fontWeight: 950 }}>{editingWorldNpcId ? 'Edit World NPC' : 'Add World NPC'}</div>
                <button style={{ ...backButton, padding: '8px 14px', fontSize: 12 }}
                  onMouseEnter={btnHover} onMouseLeave={btnLeave} onMouseDown={btnDown}
                  onClick={() => setWorldNpcModalOpen(false)}>
                  Close
                </button>
              </div>
              {worldNpcDraft.image && (
                <div
                  style={{
                    marginTop: 10,
                    paddingLeft: 20, // 👈 move it slightly right
                  }}
                >
                  <img
                    src={worldNpcDraft.image}
                    alt="NPC"
                    style={{
                      width: 110,
                      height: 110,
                      objectFit: 'cover',
                      borderRadius: 14,
                      border: `1px solid ${THEME.lineSoft}`,
                      boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
                      display: 'block',
                    }}
                  />
                </div>
              )}
              <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignContent: 'start', overflowY: 'auto' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={fieldLabel}>Name</div>
                  <input value={worldNpcDraft.name} onChange={(e) => setWorldNpcDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="e.g. Captain Rell" style={{ ...inputBase, fontWeight: 900 }} />
                </div>
                <div>
                  <div style={fieldLabel}>Age</div>
                  <input value={worldNpcDraft.age} onChange={(e) => setWorldNpcDraft((d) => ({ ...d, age: e.target.value }))}
                    placeholder="e.g. 42" style={inputBase} />
                </div>
                <div>
                  <div style={fieldLabel}>Faction</div>
                  <input value={worldNpcDraft.faction} onChange={(e) => setWorldNpcDraft((d) => ({ ...d, faction: e.target.value }))}
                    placeholder="e.g. Church of Amiras" style={inputBase} />
                </div>
                <div>
                  <div style={fieldLabel}>Occupation</div>
                  <input value={worldNpcDraft.occupation} onChange={(e) => setWorldNpcDraft((d) => ({ ...d, occupation: e.target.value }))}
                    placeholder="e.g. Captain, Scholar, Merchant" style={inputBase} />
                </div>
                <div>
                  <div style={fieldLabel}>Location</div>
                  <input value={worldNpcDraft.location} onChange={(e) => setWorldNpcDraft((d) => ({ ...d, location: e.target.value }))}
                    placeholder="e.g. Avalon" style={inputBase} />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={fieldLabel}>Quick Synopsis</div>
                  <textarea value={worldNpcDraft.summary} onChange={(e) => setWorldNpcDraft((d) => ({ ...d, summary: e.target.value }))}
                    placeholder="One or two lines used for quick cards and previews."
                    rows={3}
                    style={{ ...inputBase, resize: 'vertical', minHeight: 80, lineHeight: 1.5 }} />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={fieldLabel}>Image (optional)</div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => onWorldNpcImagePick(e.target.files && e.target.files[0])}
                      style={{ ...inputBase, padding: '8px 10px', width: 'auto', flex: '1 1 260px' }}
                    />
                    {worldNpcDraft.image && (
                      <button
                        type="button"
                        style={{ ...tinyBtn, opacity: 0.95 }}
                        onMouseEnter={tinyBtnHover}
                        onMouseLeave={tinyBtnLeave}
                        onClick={() => setWorldNpcDraft((d) => ({ ...d, image: '' }))}
                      >
                        Remove Image
                      </button>
                    )}
                  </div>

                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={fieldLabel}>Lore</div>
                  <textarea value={worldNpcDraft.bio} onChange={(e) => setWorldNpcDraft((d) => ({ ...d, bio: e.target.value }))}
                    placeholder="Long-form lore, history, hooks, secrets…" rows={5}
                    style={{ ...inputBase, resize: 'none', minHeight: 110, maxHeight: 180, lineHeight: 1.5 }} />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <div style={fieldLabel}>Related Characters</div>
                    <div style={{ fontSize: 11, opacity: 0.72, fontWeight: 900, color: THEME.creamSoft }}>
                      {(worldNpcDraft.characterLinks || []).length} linked
                    </div>
                  </div>
                  <input
                    value={worldNpcCharSearch}
                    onChange={(e) => setWorldNpcCharSearch(e.target.value)}
                    placeholder="Find character..."
                    style={{ ...inputBase, marginTop: 6, fontSize: 12 }}
                  />
                  <div
                    style={{
                      marginTop: 8,
                      borderRadius: 12,
                      border: `1px solid ${THEME.lineSoft}`,
                      background: 'rgba(0,0,0,0.16)',
                      padding: 8,
                    }}
                  >
                    {filteredWorldNpcCharacterNames.length === 0 ? (
                      <div style={{ fontSize: 12, opacity: 0.72, color: THEME.creamSoft, padding: '6px 4px' }}>
                        No matching characters.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, maxHeight: 138, overflowY: 'auto', paddingRight: 2 }}>
                        {filteredWorldNpcCharacterNames.map((charName) => {
                          const checked = (worldNpcDraft.characterLinks || []).some((l) => l.characterName === charName);
                          return (
                            <button
                              key={charName}
                              type="button"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                                width: '100%',
                                padding: '8px 10px',
                                borderRadius: 10,
                                border: checked ? '1px solid rgba(255,220,160,0.45)' : `1px solid ${THEME.lineSoft}`,
                                background: checked
                                  ? 'linear-gradient(180deg, rgba(56,38,18,0.62), rgba(26,18,10,0.72))'
                                  : 'linear-gradient(180deg, rgba(20,14,8,0.54), rgba(12,8,4,0.62))',
                                color: checked ? THEME.creamText : THEME.creamSoft,
                                fontSize: 12,
                                fontWeight: 900,
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                              onMouseDown={navClick}
                              onClick={() => toggleWorldNpcCharacterLink(charName)}
                            >
                              <span style={{
                                width: 13,
                                height: 13,
                                borderRadius: 4,
                                border: checked ? '1px solid rgba(255,220,160,0.65)' : `1px solid ${THEME.lineSoft}`,
                                background: checked ? 'rgba(255,220,160,0.24)' : 'transparent',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                lineHeight: 1,
                                flex: '0 0 auto',
                              }}>
                                {checked ? '✓' : ''}
                              </span>
                              <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {charName}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {(worldNpcDraft.characterLinks || []).length > 0 && (
                    <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
                      {(worldNpcDraft.characterLinks || []).map((link) => (
                        <div key={`char-rel-${link.characterName}`} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 8, alignItems: 'center' }}>
                          <div style={{ fontSize: 11.5, fontWeight: 900, color: THEME.creamSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {link.characterName}
                          </div>
                          <input
                            value={link?.relation || ''}
                            onChange={(e) => setWorldNpcCharacterRelation(link.characterName, e.target.value)}
                            placeholder="Relation (e.g. Mentor)"
                            style={{ ...inputBase, fontSize: 12, paddingTop: 8, paddingBottom: 8 }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <div style={fieldLabel}>Connected NPCs</div>
                    <div style={{ fontSize: 11, opacity: 0.72, fontWeight: 900, color: THEME.creamSoft }}>
                      {(worldNpcDraft.links || []).length} linked
                    </div>
                  </div>
                  {worldNpcConnectionTargets.length === 0 ? (
                    <div style={{ opacity: 0.72, fontSize: 12, color: THEME.creamSoft, lineHeight: 1.5 }}>
                      Add at least one other world NPC to create NPC-to-NPC links.
                    </div>
                  ) : (
                    <>
                      <input
                        value={worldNpcConnectionSearch}
                        onChange={(e) => setWorldNpcConnectionSearch(e.target.value)}
                        placeholder="Find world NPC..."
                        style={{ ...inputBase, marginTop: 6, fontSize: 12 }}
                      />
                      <div
                        style={{
                          marginTop: 8,
                          borderRadius: 12,
                          border: `1px solid ${THEME.lineSoft}`,
                          background: 'rgba(0,0,0,0.16)',
                          padding: 8,
                        }}
                      >
                        {filteredWorldNpcConnectionTargets.length === 0 ? (
                          <div style={{ fontSize: 12, opacity: 0.72, color: THEME.creamSoft, padding: '6px 4px' }}>
                            No matching NPCs.
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, maxHeight: 150, overflowY: 'auto', paddingRight: 2 }}>
                            {filteredWorldNpcConnectionTargets.map((target) => {
                              const link = (worldNpcDraft.links || []).find((l) => String(l.targetId) === String(target.id));
                              const checked = !!link;
                              return (
                                <button
                                  key={target.id}
                                  type="button"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 7,
                                    width: '100%',
                                    padding: '8px 10px',
                                    borderRadius: 10,
                                    border: checked ? '1px solid rgba(255,220,160,0.45)' : `1px solid ${THEME.lineSoft}`,
                                    background: checked
                                      ? 'linear-gradient(180deg, rgba(56,38,18,0.62), rgba(26,18,10,0.72))'
                                      : 'linear-gradient(180deg, rgba(20,14,8,0.54), rgba(12,8,4,0.62))',
                                    color: checked ? THEME.creamText : THEME.creamSoft,
                                    fontSize: 12,
                                    fontWeight: 900,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                  }}
                                  onMouseDown={navClick}
                                  onClick={() => toggleWorldNpcConnection(target.id)}
                                >
                                  <span style={{
                                    width: 13,
                                    height: 13,
                                    borderRadius: 4,
                                    border: checked ? '1px solid rgba(255,220,160,0.65)' : `1px solid ${THEME.lineSoft}`,
                                    background: checked ? 'rgba(255,220,160,0.24)' : 'transparent',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 10,
                                    lineHeight: 1,
                                    flex: '0 0 auto',
                                  }}>
                                    {checked ? '✓' : ''}
                                  </span>
                                  <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                    <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr', gap: 6, maxHeight: 140, overflowY: 'auto', paddingRight: 2 }}>
                      {(worldNpcDraft.links || []).map((link) => (
                        <div key={`npc-note-${link.targetId}`} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 8, alignItems: 'center' }}>
                          <div style={{ fontSize: 11.5, fontWeight: 900, color: THEME.creamSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {worldNpcById[link.targetId]?.name || 'Linked NPC'}
                          </div>
                          <input
                            value={link?.note || ''}
                            onChange={(e) => setWorldNpcConnectionNote(link.targetId, e.target.value)}
                            placeholder="Connection note (optional)"
                            style={{ ...inputBase, fontSize: 12, paddingTop: 8, paddingBottom: 8 }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
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


              {/* WORLD NPC IMAGE CROP */}
              {worldNpcCropOpen && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 40,
                    background: 'rgba(0,0,0,0.72)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 16,
                    backdropFilter: 'blur(4px)',
                  }}
                  onMouseDown={(e) => { if (e.target === e.currentTarget) setWorldNpcCropOpen(false); }}
                >
                  <div style={{
                    width: 'min(720px, 96vw)',
                    borderRadius: 22,
                    background: 'linear-gradient(180deg, rgba(28,20,12,0.97), rgba(14,10,6,0.98))',
                    boxShadow: '0 30px 90px rgba(0,0,0,0.75)',
                    border: `1px solid ${THEME.line}`,
                    color: THEME.creamText,
                    fontFamily: fontStack,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}>
                    <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderBottom: `1px solid ${THEME.lineSoft}` }}>
                      <div style={{ fontSize: 16, fontWeight: 950 }}>Crop Image</div>
                      <button
                        style={{ ...backButton, padding: '8px 14px', fontSize: 12 }}
                        onMouseEnter={btnHover}
                        onMouseLeave={btnLeave}
                        onMouseDown={(e) => { btnDown(e); navClick(); }}
                        onClick={() => setWorldNpcCropOpen(false)}
                      >
                        Close
                      </button>
                    </div>

                    <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, alignItems: 'start' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div
                          style={{
                            width: WORLD_NPC_CROP_BOX,
                            height: WORLD_NPC_CROP_BOX,
                            borderRadius: 18,
                            border: `1px solid ${THEME.lineSoft}`,
                            background: 'linear-gradient(180deg, rgba(10,8,6,0.55), rgba(10,8,6,0.25))',
                            boxShadow: '0 18px 46px rgba(0,0,0,0.55)',
                            overflow: 'hidden',
                            position: 'relative',
                            touchAction: 'none',
                            userSelect: 'none',
                          }}
                          onMouseDown={(e) => {
                            const img = worldNpcCropImgRef.current;
                            if (!img) return;
                            worldNpcCropDragRef.current.dragging = true;
                            worldNpcCropDragRef.current.sx = e.clientX;
                            worldNpcCropDragRef.current.sy = e.clientY;
                            worldNpcCropDragRef.current.ox = worldNpcCropOffset.x;
                            worldNpcCropDragRef.current.oy = worldNpcCropOffset.y;
                            e.preventDefault();
                          }}
                          onMouseMove={(e) => {
                            if (!worldNpcCropDragRef.current.dragging) return;
                            const dx = e.clientX - worldNpcCropDragRef.current.sx;
                            const dy = e.clientY - worldNpcCropDragRef.current.sy;
                            setWorldNpcCropOffset({ x: worldNpcCropDragRef.current.ox + dx, y: worldNpcCropDragRef.current.oy + dy });
                          }}
                          onMouseUp={() => { worldNpcCropDragRef.current.dragging = false; clampCropOffset(); }}
                          onMouseLeave={() => { if (worldNpcCropDragRef.current.dragging) { worldNpcCropDragRef.current.dragging = false; clampCropOffset(); } }}
                        >
                          <img
                            ref={worldNpcCropImgRef}
                            src={worldNpcCropSrc}
                            alt="Crop"
                            onLoad={() => { clampCropOffset(); }}
                            style={{
                              position: 'absolute',
                              left: '50%',
                              top: '50%',
                              transform: `translate(-50%, -50%) translate(${worldNpcCropOffset.x}px, ${worldNpcCropOffset.y}px) scale(${worldNpcCropZoom})`,
                              transformOrigin: 'center center',
                              willChange: 'transform',
                              userSelect: 'none',
                              pointerEvents: 'none',
                              maxWidth: 'none',
                              maxHeight: 'none',
                            }}
                            draggable={false}
                          />

                          {/* subtle corner marks */}
                          <div style={{
                            position: 'absolute',
                            inset: 10,
                            borderRadius: 14,
                            border: '1px dashed rgba(255,220,160,0.18)',
                            pointerEvents: 'none',
                          }} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ ...darkCard, padding: 14 }}>
                          <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.8, marginBottom: 8 }}>Zoom</div>
                          <input
                            className="cb-rng"
                            type="range"
                            min={1}
                            max={2.5}
                            step={0.01}
                            value={worldNpcCropZoom}
                            onChange={(e) => { setWorldNpcCropZoom(parseFloat(e.target.value) || 1); }}
                            onMouseUp={clampCropOffset}
                            onTouchEnd={clampCropOffset}
                            style={{ color: 'rgba(255,220,160,0.9)', accentColor: 'rgba(255,220,160,0.9)', background: 'rgba(255,245,220,0.12)' }}
                          />
                          <div style={{ marginTop: 8, fontSize: 11, opacity: 0.72, color: THEME.creamSoft }}>
                            Drag the image to position it inside the frame.
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button
                            style={{ ...backButton, padding: '10px 16px', fontSize: 13 }}
                            onMouseEnter={btnHover}
                            onMouseLeave={btnLeave}
                            onMouseDown={(e) => { btnDown(e); navClick(); }}
                            onClick={() => setWorldNpcCropOpen(false)}
                          >
                            Cancel
                          </button>
                          <button
                            style={goldBtn}
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
        style={{ display: 'none' }}
      />
    </ShellLayout>
  );
}

