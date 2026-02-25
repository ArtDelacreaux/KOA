import React, { useEffect, useRef, useState, useMemo } from 'react';
import ShellLayout from './ShellLayout';

// ─── Theme (matches WorldLore / CharacterBook) ────────────────────────────────
const THEME = {
  creamText: 'rgba(255,245,220,0.96)',
  creamSoft: 'rgba(255,245,220,0.82)',
  glassA:    'rgba(255,245,220,0.065)',
  glassB:    'rgba(255,245,220,0.022)',
  line:      'rgba(255,220,160,0.18)',
  lineSoft:  'rgba(255,220,160,0.10)',
  textShadow: '0 1px 6px rgba(0,0,0,0.85), 0 2px 16px rgba(0,0,0,0.65)',
  textShadowSoft: '0 1px 4px rgba(0,0,0,0.75)',
};
const fontStack = "'Cinzel', 'Trajan Pro', 'Times New Roman', serif";

export default function CampaignHub(props) {
  const {
    panelType,
    cinematicNav,
    campaignTab,
    setCampaignTab,

    quests,
    setQuests,
    questModalOpen,
    setQuestModalOpen,
    editingQuestId,
    setEditingQuestId,
    questDraft,
    setQuestDraft,

    playHover = () => {},
    playNav   = () => {},
  } = props;

  /* =========================
     Panel visibility style
  ========================= */
  const panelStyle = {
    position: 'absolute',
    inset: 0,
    opacity: panelType === 'campaign' ? 1 : 0,
    transform: panelType === 'campaign' ? 'translateY(0px)' : 'translateY(10px)',
    transition: 'opacity 220ms ease, transform 220ms ease',
    pointerEvents: panelType === 'campaign' ? 'auto' : 'none',
    zIndex: panelType === 'campaign' ? 6 : 4,
    overflowY: 'auto',
  };

  /* =========================
     Shared styles
  ========================= */

  const softCard = {
    padding: 14,
    borderRadius: 16,
    background: `linear-gradient(180deg, ${THEME.glassA}, ${THEME.glassB})`,
    color: THEME.creamText,
    fontFamily: fontStack,
    boxShadow: '0 18px 46px rgba(0,0,0,0.42)',
    border: `1px solid ${THEME.line}`,
    backdropFilter: 'blur(10px)',
    textShadow: THEME.textShadow,
  };

  const tabButtonStyle = (active) => ({
    padding: '7px 12px',
    borderRadius: 999,
    border: active ? `1px solid ${THEME.line}` : '1px solid rgba(255,255,255,0.10)',
    background: active ? 'rgba(176,101,0,0.26)' : 'rgba(255,255,255,0.06)',
    color: active ? THEME.creamText : THEME.creamSoft,
    cursor: 'pointer',
    fontWeight: 950,
    fontSize: 12,
    letterSpacing: '0.14em',
    fontFamily: fontStack,
    boxShadow: active ? '0 10px 18px rgba(0,0,0,0.10)' : 'none',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    transition: 'all 150ms ease',
    textShadow: THEME.textShadow,
  });

  const smallBtn = (variant = 'gold') => {
    const base = {
      padding: '8px 10px',
      borderRadius: 12,
      border: `1px solid ${THEME.line}`,
      cursor: 'pointer',
      fontWeight: 900,
      fontSize: 12,
      letterSpacing: 0.2,
      fontFamily: fontStack,
      transition: 'transform 140ms ease, box-shadow 140ms ease, filter 140ms ease',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      background: `linear-gradient(180deg, ${THEME.glassA}, ${THEME.glassB})`,
      color: THEME.creamText,
      textShadow: THEME.textShadow,
    };
    if (variant === 'gold') return { ...base, background: 'linear-gradient(180deg, rgba(176,101,0,0.90), rgba(122,55,0,0.92))', color: THEME.creamText, border: `1px solid ${THEME.line}`, textShadow: '0 2px 8px rgba(0,0,0,0.55)', boxShadow: '0 12px 26px rgba(0,0,0,0.25)' };
    if (variant === 'danger') return { ...base, background: 'linear-gradient(180deg, rgba(122,30,30,0.92), rgba(90,18,18,0.92))', color: THEME.creamText, border: '1px solid rgba(255,160,160,0.26)', textShadow: '0 2px 8px rgba(0,0,0,0.55)', boxShadow: '0 12px 26px rgba(0,0,0,0.22)' };
    if (variant === 'ghost') return { ...base, background: 'rgba(255,245,220,0.06)', color: THEME.creamText, border: `1px solid ${THEME.line}`, boxShadow: 'none', textShadow: THEME.textShadow };
    return base;
  };

  const smallBtnHover = (e) => { playHover(); e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.filter = 'brightness(1.06)'; e.currentTarget.style.boxShadow = '0 16px 34px rgba(0,0,0,0.26)'; };
  const smallBtnLeave = (e) => { e.currentTarget.style.transform = 'translateY(0px)'; e.currentTarget.style.filter = 'none'; };

  const pill = (type) => {
    const map = {
      Main:   { bg: 'rgba(96,165,250,0.18)',  bd: 'rgba(96,165,250,0.35)',  fg: 'rgba(186,230,255,0.95)' },
      Side:   { bg: 'rgba(251,191,36,0.16)',   bd: 'rgba(251,191,36,0.35)',  fg: 'rgba(253,230,138,0.96)' },
      Personal: { bg: 'rgba(248,113,113,0.16)',   bd: 'rgba(248,113,113,0.35)',  fg: 'rgba(254,202,202,0.95)' },
    };
    const c = map[type] || map.Side;
    return { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, border: `1px solid ${c.bd}`, background: c.bg, color: c.fg, fontWeight: 900, fontSize: 12, letterSpacing: 0.2, userSelect: 'none', boxShadow: type === 'Personal' ? '0 0 18px rgba(122,30,30,0.18)' : 'none' };
  };

  /* =========================
     Quests helpers
  ========================= */
  const activeQuests    = useMemo(() => (quests || []).filter((q) => q.status === 'active'),    [quests]);
  const completedQuests = useMemo(() => (quests || []).filter((q) => q.status === 'completed'), [quests]);

  const newId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const openAddQuest = () => {
    setEditingQuestId(null);
    setQuestDraft({ title: '', type: 'Side', giver: '', location: '', description: '' });
    setQuestModalOpen(true);
  };

  const openEditQuest = (q) => {
    setEditingQuestId(q.id);
    setQuestDraft({ title: q.title || '', type: q.type || 'Side', giver: q.giver || '', location: q.location || '', description: q.description || '' });
    setQuestModalOpen(true);
  };

  const saveQuest = () => {
    const title = (questDraft.title || '').trim();
    if (!title) { alert('Quest needs a title.'); return; }
    if (!editingQuestId) {
      const q = { id: newId(), title, type: questDraft.type || 'Side', giver: (questDraft.giver || '').trim(), location: (questDraft.location || '').trim(), description: (questDraft.description || '').trim(), status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      setQuests((prev) => [q, ...(prev || [])]);
    } else {
      setQuests((prev) => (prev || []).map((q) => q.id === editingQuestId ? { ...q, title, type: questDraft.type || q.type, giver: (questDraft.giver || '').trim(), location: (questDraft.location || '').trim(), description: (questDraft.description || '').trim(), updatedAt: new Date().toISOString() } : q));
    }
    setQuestModalOpen(false);
    setEditingQuestId(null);
  };

  const deleteQuest   = (id) => { if (!confirm('Delete this quest?')) return; setQuests((prev) => (prev || []).filter((q) => q.id !== id)); };
  const completeQuest = (id) => { setQuests((prev) => (prev || []).map((q) => (q.id === id ? { ...q, status: 'completed', updatedAt: new Date().toISOString() } : q))); };
  const reopenQuest   = (id) => { setQuests((prev) => (prev || []).map((q) => (q.id === id ? { ...q, status: 'active',    updatedAt: new Date().toISOString() } : q))); };

  useEffect(() => {
    if (!questModalOpen) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') setQuestModalOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [questModalOpen, setQuestModalOpen]);

  /* =========================
     Player Hub Launcher
  ========================= */
  const LS_LAUNCH_KEY = 'koa:launcher:v1';
  const [launcherState, setLauncherState] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_LAUNCH_KEY);
      return raw ? JSON.parse(raw) : { watchUrl: 'https://w2g.tv/en/room/?room_id=h2rq2xmdrlzdlyolcu', owlbearUrl: 'https://owlbear.rodeo/room/TQbSmbFAE6l4/TheFatedSoul', recap: '', notes: '', timerRunning: false, elapsedMs: 0, lastTick: Date.now() };
    } catch {
      return { watchUrl: 'https://w2g.tv/en/room/?room_id=h2rq2xmdrlzdlyolcu', owlbearUrl: 'https://owlbear.rodeo/room/TQbSmbFAE6l4/TheFatedSoul', recap: '', notes: '', timerRunning: false, elapsedMs: 0, lastTick: Date.now() };
    }
  });

  useEffect(() => { try { localStorage.setItem(LS_LAUNCH_KEY, JSON.stringify(launcherState)); } catch {} }, [launcherState]);

  useEffect(() => {
    if (!launcherState.timerRunning) return;
    const id = window.setInterval(() => {
      setLauncherState((s) => { const now = Date.now(); const delta = Math.max(0, now - (s.lastTick || now)); return { ...s, elapsedMs: (s.elapsedMs || 0) + delta, lastTick: now }; });
    }, 250);
    return () => window.clearInterval(id);
  }, [launcherState.timerRunning]);

  const fmtElapsed = (ms) => { const total = Math.floor((ms || 0) / 1000); const h = String(Math.floor(total / 3600)).padStart(2, '0'); const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0'); const s = String(total % 60).padStart(2, '0'); return `${h}:${m}:${s}`; };
  const openTool = (kind) => { const url = kind === 'watch' ? launcherState.watchUrl : launcherState.owlbearUrl; if (!url) return; window.open(url, '_blank', 'noopener,noreferrer'); };

  /* =========================
     INVENTORY (Bag of Holding)
  ========================= */
  const LS_BAG_KEY = 'koa:bagofholding:v1';
  const clampInt = (n, min, max) => Math.max(min, Math.min(max, n));
  const bagNewId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const CATEGORIES = ['All', 'Weapon', 'Armor', 'Gear', 'Consumable', 'Loot', 'Quest', 'Magic', 'Misc'];
  const RARITIES   = ['All', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

  const rarityBadge = (rarity) => {
    const r = (rarity || 'Common').toLowerCase();
    const map = { common: 'rgba(255,255,255,0.16)', uncommon: 'rgba(110,231,183,0.18)', rare: 'rgba(96,165,250,0.18)', epic: 'rgba(216,180,254,0.18)', legendary: 'rgba(251,191,36,0.20)' };
    return map[r] || map.common;
  };

  const invInput     = { width: '100%', boxSizing: 'border-box', padding: '8px 9px', borderRadius: 12, border: `1px solid ${THEME.lineSoft}`, outline: 'none', fontSize: 13, background: 'rgba(0,0,0,0.28)', color: THEME.creamText, fontFamily: fontStack };
  const invTinyInput = { width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 10, border: `1px solid ${THEME.lineSoft}`, outline: 'none', fontSize: 12, fontWeight: 900, background: 'rgba(0,0,0,0.28)', color: THEME.creamText, fontFamily: fontStack };
  const invLabel     = { fontSize: 11, fontWeight: 900, color: THEME.creamSoft, marginBottom: 4, textShadow: THEME.textShadowSoft };
  const invTinyLabel = { fontSize: 10, fontWeight: 950, color: THEME.creamSoft, marginBottom: 4, letterSpacing: 0.2, textShadow: THEME.textShadowSoft };

  const [bag, setBag] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_BAG_KEY);
      if (!raw) return { currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [] };
      const parsed = JSON.parse(raw);
      return { currency: { pp: parsed?.currency?.pp ?? 0, gp: parsed?.currency?.gp ?? 0, sp: parsed?.currency?.sp ?? 0, cp: parsed?.currency?.cp ?? 0 }, items: Array.isArray(parsed?.items) ? parsed.items : [] };
    } catch { return { currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [] }; }
  });

  useEffect(() => { try { localStorage.setItem(LS_BAG_KEY, JSON.stringify(bag)); } catch {} }, [bag]);

  const [invQuery, setInvQuery] = useState('');
  const [invCat,   setInvCat]   = useState('All');
  const [invRar,   setInvRar]   = useState('All');
  const [invSort,  setInvSort]  = useState('name');

  const [invModalOpen, setInvModalOpen] = useState(false);
  const [invEditingId, setInvEditingId] = useState(null);
  const [dangerOpen,   setDangerOpen]   = useState(false);

  const invEmptyDraft = { name: '', qty: 1, category: 'Gear', rarity: 'Common', value: '', weight: '', notes: '', tags: '', assignedTo: '', equipped: false };
  const [invDraft, setInvDraft] = useState(invEmptyDraft);

  const invOpenAdd  = () => { setInvEditingId(null); setInvDraft(invEmptyDraft); setInvModalOpen(true); };
  const invOpenEdit = (item) => {
    setInvEditingId(item.id);
    setInvDraft({ name: item.name || '', qty: typeof item.qty === 'number' ? item.qty : 1, category: item.category || 'Gear', rarity: item.rarity || 'Common', value: item.value ?? '', weight: item.weight ?? '', notes: item.notes || '', tags: Array.isArray(item.tags) ? item.tags.join(', ') : '', assignedTo: item.assignedTo || '', equipped: !!item.equipped });
    setInvModalOpen(true);
  };

  const invSaveDraft = () => {
    const name = (invDraft.name || '').trim();
    if (!name) { alert('Item needs a name.'); return; }
    const qty    = clampInt(parseInt(invDraft.qty, 10) || 1, 1, 9999);
    const value  = invDraft.value  === '' ? null : Number(invDraft.value);
    const weight = invDraft.weight === '' ? null : Number(invDraft.weight);
    const tags   = (invDraft.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
    const now    = new Date().toISOString();

    setBag((prev) => {
      const items = prev.items || [];
      if (!invEditingId) {
        const item = { id: bagNewId(), name, qty, category: invDraft.category || 'Gear', rarity: invDraft.rarity || 'Common', value: Number.isFinite(value) ? value : null, weight: Number.isFinite(weight) ? weight : null, notes: (invDraft.notes || '').trim(), tags, assignedTo: (invDraft.assignedTo || '').trim(), equipped: !!invDraft.equipped, createdAt: now, updatedAt: now };
        return { ...prev, items: [item, ...items] };
      } else {
        return { ...prev, items: items.map((it) => it.id === invEditingId ? { ...it, name, qty, category: invDraft.category || it.category, rarity: invDraft.rarity || it.rarity, value: Number.isFinite(value) ? value : it.value, weight: Number.isFinite(weight) ? weight : it.weight, notes: (invDraft.notes || '').trim(), tags, assignedTo: (invDraft.assignedTo || '').trim(), equipped: !!invDraft.equipped, updatedAt: now } : it) };
      }
    });
    setInvModalOpen(false);
    setInvEditingId(null);
  };

  const invDeleteItem     = (id) => { if (!confirm('Delete this item?')) return; setBag((prev) => ({ ...prev, items: (prev.items || []).filter((it) => it.id !== id) })); };
  const invBumpQty        = (id, delta) => { setBag((prev) => ({ ...prev, items: (prev.items || []).map((it) => it.id === id ? { ...it, qty: clampInt((it.qty || 1) + delta, 1, 9999) } : it) })); };
  const invToggleEquipped = (id) => { setBag((prev) => ({ ...prev, items: (prev.items || []).map((it) => it.id === id ? { ...it, equipped: !it.equipped } : it) })); };
  const invSetCurrency    = (key, val) => { const n = parseInt(val, 10); setBag((prev) => ({ ...prev, currency: { ...prev.currency, [key]: isNaN(n) ? 0 : Math.max(0, n) } })); };

  const invFilteredItems = useMemo(() => {
    let items = [...(bag.items || [])];
    const q = (invQuery || '').toLowerCase().trim();
    if (q)           items = items.filter((it) => (it.name || '').toLowerCase().includes(q) || (it.notes || '').toLowerCase().includes(q) || (it.assignedTo || '').toLowerCase().includes(q));
    if (invCat !== 'All') items = items.filter((it) => (it.category || '') === invCat);
    if (invRar !== 'All') items = items.filter((it) => (it.rarity   || '') === invRar);
    if (invSort === 'qty')     items.sort((a, b) => (b.qty || 0) - (a.qty || 0));
    else if (invSort === 'value')   items.sort((a, b) => (b.value || 0) - (a.value || 0));
    else if (invSort === 'updated') items.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    else items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return items;
  }, [bag.items, invQuery, invCat, invRar, invSort]);

  /* =========================
     RENDER
  ========================= */
  return (
    <ShellLayout active={panelType === 'campaign'}>
      <style>{`
        .ch-scrollbar::-webkit-scrollbar { width: 6px; }
        .ch-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .ch-scrollbar::-webkit-scrollbar-thumb { background: rgba(176,101,0,0.4); border-radius: 999px; }
        .ch-scrollbar input::placeholder,
        .ch-scrollbar textarea::placeholder { color: rgba(255,245,220,0.42); opacity: 1; }
        .ch-modal input::placeholder,
        .ch-modal textarea::placeholder { color: rgba(255,245,220,0.42); opacity: 1; }
        .ch-glass-text { text-shadow: 0 1px 6px rgba(0,0,0,0.85), 0 2px 16px rgba(0,0,0,0.65); }
        .ch-glass-text * { text-shadow: inherit; }
        .ch-glass-text input, .ch-glass-text textarea, .ch-glass-text select { text-shadow: none; }
        .ch-modal, .ch-modal * { text-shadow: 0 1px 4px rgba(0,0,0,0.6) !important; }
      `}</style>

      <div
        className="ch-scrollbar ch-glass-text"
        style={{
          width: '100%',
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '0 0 40px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(176,101,0,0.4) transparent',
          position: 'relative',
        }}
      >

        {/* ── PAGE HEADER (WorldLore style) ── */}
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          padding: '44px 36px 0',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(180deg, rgba(8,5,2,0.96) 80%, transparent)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderBottom: `1px solid ${THEME.lineSoft}`,
        }}>

          {/* Top row: back | title | spacer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

            {/* ← RETURN button */}
            <button
              onClick={() => { playNav(); cinematicNav('menu'); }}
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
                fontWeight: 900,
                backdropFilter: 'blur(10px)',
                transition: 'all 150ms ease',
                boxShadow: '0 10px 28px rgba(0,0,0,0.3)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,220,160,0.45)'; e.currentTarget.style.color = THEME.creamText; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = THEME.line; e.currentTarget.style.color = 'rgba(255,220,160,0.8)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              ← RETURN
            </button>

            {/* Centered title block */}
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{
                fontSize: 10,
                letterSpacing: '0.38em',
                color: 'rgba(255,220,160,0.45)',
                marginBottom: 10,
                fontFamily: fontStack,
                textTransform: 'uppercase',
              }}>
                ✦ &nbsp; THE ENVOY'S CIRCLE &nbsp; ✦
              </div>
              <h1 style={{
                margin: 0,
                fontFamily: fontStack,
                fontSize: 'clamp(1.4rem, 3vw, 2.2rem)',
                fontWeight: 900,
                color: THEME.creamText,
                letterSpacing: '0.18em',
                textShadow: '0 0 40px rgba(176,101,0,0.5), 0 2px 18px rgba(0,0,0,0.7)',
              }}>
                PARTY HUB
              </h1>
            </div>

            {/* Right spacer (mirrors back button width) */}
            <div style={{ width: 110 }} />
          </div>

          {/* Bottom padding so header doesn't feel cramped */}
          <div style={{ paddingBottom: 16 }} />
        </div>

        {/* ── BODY CONTENT ── */}
        <div style={{ padding: '16px 36px 0', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100, margin: '0 auto' }}>
			{/* Row 2 — Action button on its own row, fixed height so content never jumps */}
          <div style={{ display: 'flex', justifyContent: 'center', height: 38, marginTop: -8 }}>
            {(campaignTab === 'quests' || campaignTab === 'inventory') && (
              <button
                type="button"
                onMouseEnter={(e) => { playHover(); e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.filter = 'brightness(1.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0px)'; e.currentTarget.style.filter = 'none'; }}
                onClick={campaignTab === 'quests' ? openAddQuest : invOpenAdd}
                style={{
                  padding: '8px 22px',
                  borderRadius: 999,
                  fontSize: 12,
                  letterSpacing: '0.16em',
                  fontWeight: 900,
                  fontFamily: fontStack,
                  cursor: 'pointer',
                  border: `1px solid ${THEME.line}`,
                  background: 'linear-gradient(180deg, rgba(176,101,0,0.90), rgba(122,55,0,0.92))',
                  color: THEME.creamText,
                  boxShadow: '0 12px 26px rgba(0,0,0,0.35)',
                  transition: 'all 150ms ease',
                  textShadow: '0 2px 8px rgba(0,0,0,0.55)',
                }}
              >
                {campaignTab === 'quests' ? '+ Add Quest' : '+ Add Item'}
              </button>
            )}
          </div>
          {/* Row 1 — Nav tabs, always the same 3, never shift */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
            {[
              { key: 'launcher',  label: 'Hub' },
              { key: 'quests',    label: 'Quest Board' },
              { key: 'inventory', label: 'Party Inventory' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onMouseEnter={(e) => { playHover(); e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.filter = 'brightness(1.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0px)'; e.currentTarget.style.filter = 'none'; }}
                onClick={() => setCampaignTab(key)}
                style={{
                  padding: '10px 18px',
                  borderRadius: 999,
                  fontSize: 12,
                  letterSpacing: '0.16em',
                  fontWeight: 900,
                  fontFamily: fontStack,
                  cursor: 'pointer',
                  border: campaignTab === key ? `1px solid ${THEME.line}` : '1px solid rgba(255,220,160,0.12)',
                  background: campaignTab === key ? 'linear-gradient(180deg, rgba(8,5,2,0.92), rgba(8,5,2,0.78))' : 'linear-gradient(180deg, rgba(8,5,2,0.68), rgba(8,5,2,0.52))',
                  color: campaignTab === key ? THEME.creamText : THEME.creamSoft,
                  boxShadow: campaignTab === key ? '0 12px 30px rgba(0,0,0,0.50)' : '0 6px 18px rgba(0,0,0,0.30)',
                  transition: 'all 150ms ease',
                }}
              >
                {label}
              </button>
            ))}
          </div>
       {/* ========== HUB ========== */}
          {campaignTab === 'launcher' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 14, alignItems: 'start' }}>
              {/* LEFT */}
              <div style={softCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 950 }}>Quick Launch</div>
                    <div style={{ fontSize: 15, fontWeight: 550, opacity: 0.82, marginTop: 6, lineHeight: 1.5 }}>Don't forget your character sheet!</div>
                  </div>
                  <span style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(176,101,0,0.12)', border: '1px solid rgba(176,101,0,0.18)', fontSize: 12, fontWeight: 900, opacity: 0.92, userSelect: 'none' }}>
                    Players
                  </span>
                </div>

                <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,220,160,0.15), transparent)', margin: '14px 0' }} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {/* Watch Party */}
                  <div style={{ padding: 14, borderRadius: 16, background: `linear-gradient(180deg, ${THEME.glassA}, ${THEME.glassB})`, border: `1px solid ${THEME.line}`, boxShadow: '0 10px 24px rgba(0,0,0,0.32)', backdropFilter: 'blur(10px)', color: THEME.creamText }} onMouseEnter={() => playHover()}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontSize: 22 }}>🎬</div>
                      <div>
                        <div style={{ fontWeight: 950, fontSize: 14 }}>Watch Party</div>
                        <div style={{ fontWeight: 550, fontSize: 12, opacity: 0.78 }}>Music / Videos / Friends</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button style={smallBtn('gold')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => openTool('watch')}>Open Room</button>
                    </div>
                  </div>

                  {/* Owlbear */}
                  <div style={{ padding: 14, borderRadius: 16, background: `linear-gradient(180deg, ${THEME.glassA}, ${THEME.glassB})`, border: `1px solid ${THEME.line}`, boxShadow: '0 10px 24px rgba(0,0,0,0.32)', backdropFilter: 'blur(10px)', color: THEME.creamText }} onMouseEnter={() => playHover()}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontSize: 22 }}>🗺️</div>
                      <div>
                        <div style={{ fontWeight: 950, fontSize: 14 }}>Owlbear Table</div>
                        <div style={{ fontWeight: 550,fontSize: 12, opacity: 0.78 }}>Maps / tokens / encounters</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button style={smallBtn('gold')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => openTool('owlbear')}>Open Room</button>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 14, ...softCard }}>
                  <div style={{ fontWeight: 950 }}>Recap</div>
                  <div style={{ fontWeight: 550,fontSize: 12, opacity: 0.8, marginTop: 6, lineHeight: 1.6 }}>Write what happened last session</div>
                  <textarea
                    value={launcherState.recap || ''}
                    onChange={(e) => setLauncherState((s) => ({ ...s, recap: e.target.value }))}
                    placeholder="Last time, the party…"
                    rows={5}
                    style={{ width: '100%', boxSizing: 'border-box', marginTop: 12, padding: '10px 12px', borderRadius: 12, border: `1px solid ${THEME.lineSoft}`, outline: 'none', fontSize: 13, lineHeight: 1.5, background: 'rgba(0,0,0,0.28)', color: THEME.creamText, fontFamily: fontStack, resize: 'none' }}
                  />
                </div>
              </div>

              {/* RIGHT */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Session Timer */}
                <div style={softCard}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ fontSize: 22 }}>⏱️</div>
                    <div>
                      <div style={{ fontWeight: 950 }}>Session Timer</div>
                      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>Track how long you've been playing.</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, fontFamily: "'Courier New', monospace", fontSize: 32, fontWeight: 900, letterSpacing: 4, textAlign: 'center' }}>
                    {fmtElapsed(launcherState.elapsedMs)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                    <button
                      style={smallBtn(launcherState.timerRunning ? 'danger' : 'gold')}
                      onMouseEnter={smallBtnHover}
                      onMouseLeave={smallBtnLeave}
                      onClick={() => setLauncherState((s) => ({ ...s, timerRunning: !s.timerRunning, lastTick: Date.now() }))}
                    >
                      {launcherState.timerRunning ? 'Pause' : 'Start'}
                    </button>
                    <button
                      style={smallBtn('danger')}
                      onMouseEnter={smallBtnHover}
                      onMouseLeave={smallBtnLeave}
                      onClick={() => setLauncherState((s) => ({ ...s, timerRunning: false, elapsedMs: 0, lastTick: Date.now() }))}
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Session Notes */}
                <div style={softCard}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ fontSize: 22 }}>📝</div>
                    <div>
                      <div style={{ fontWeight: 950 }}>Session Notes</div>
                      <div style={{ fontWeight: 550, fontSize: 12, opacity: 0.8, marginTop: 2 }}>Saved locally. Great for improvised names.</div>
                    </div>
                  </div>
                  <textarea
                    value={launcherState.notes || ''}
                    onChange={(e) => setLauncherState((s) => ({ ...s, notes: e.target.value }))}
                    placeholder={`• NPC:\n• Hook:\n• Loot:\n• Reminder:`}
                    rows={10}
                    style={{ width: '100%', boxSizing: 'border-box', marginTop: 12, padding: '10px 12px', borderRadius: 12, border: `1px solid ${THEME.lineSoft}`, outline: 'none', fontSize: 13, lineHeight: 1.5, background: 'rgba(0,0,0,0.28)', color: THEME.creamText, fontFamily: fontStack, resize: 'none' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========== QUEST BOARD ========== */}
          {campaignTab === 'quests' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
              {/* Active */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 18, fontWeight: 950, color: THEME.creamText, textShadow: '0 2px 12px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,1)' }}>Active Quests</div>
                  <div style={{ fontWeight: 900, fontSize: 12, color: THEME.creamText, textShadow: '0 1px 6px rgba(0,0,0,0.9)', opacity: 0.9 }}>{activeQuests.length} active</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activeQuests.length === 0 ? (
                    <div style={{ ...softCard, opacity: 0.85 }}>
                      <div style={{ fontWeight: 950, marginBottom: 6 }}>No active quests.</div>
                      <div style={{ fontWeight: 550, lineHeight: 1.55 }}>Hit <strong>+ Add Quest</strong> to start tracking hooks.</div>
                    </div>
                  ) : (
                    activeQuests.map((q) => (
                      <div key={q.id} style={softCard} onMouseEnter={() => playHover()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                          <div style={{ minWidth: 220 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <div style={{ fontSize: 16, fontWeight: 950 }}>{q.title}</div>
                              <span style={pill(q.type)}>{q.type}</span>
                            </div>
                            {(q.giver || q.location) && (
                              <div style={{ marginTop: 8, opacity: 0.9, lineHeight: 1.55, fontSize: 13 }}>
                                {q.giver    && <div><strong>Giver:</strong> {q.giver}</div>}
                                {q.location && <div><strong>Location:</strong> {q.location}</div>}
                              </div>
                            )}
                            {q.description && <div style={{ marginTop: 10, opacity: 0.9, lineHeight: 1.55 }}>{q.description}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button style={smallBtn('gold')}   onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => openEditQuest(q)}>Edit</button>
                            <button style={smallBtn('gold')}   onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => completeQuest(q.id)}>Complete</button>
                            <button style={smallBtn('danger')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => deleteQuest(q.id)}>Delete</button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Completed */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 18, fontWeight: 950, color: THEME.creamText, textShadow: '0 2px 12px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,1)' }}>Completed</div>
                  <div style={{ fontWeight: 900, fontSize: 12, color: THEME.creamText, textShadow: '0 1px 6px rgba(0,0,0,0.9)', opacity: 0.9 }}>{completedQuests.length} done</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {completedQuests.length === 0 ? (
                    <div style={{ ...softCard, opacity: 0.85 }}>
                      <div style={{ fontWeight: 950, marginBottom: 6 }}>Nothing completed yet.</div>
                      <div style={{ fontWeight: 550,lineHeight: 1.55 }}>Completed quests appear here.</div>
                    </div>
                  ) : (
                    completedQuests.map((q) => (
                      <div key={q.id} style={{ ...softCard, opacity: 0.92 }} onMouseEnter={() => playHover()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                          <div style={{ minWidth: 220 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <div style={{ fontSize: 16, fontWeight: 950, textDecoration: 'line-through', textDecorationThickness: 2 }}>{q.title}</div>
                              <span style={pill(q.type)}>{q.type}</span>
                            </div>
                            {(q.giver || q.location) && (
                              <div style={{ marginTop: 8, opacity: 0.85, lineHeight: 1.55, fontSize: 13 }}>
                                {q.giver    && <div><strong>Giver:</strong> {q.giver}</div>}
                                {q.location && <div><strong>Location:</strong> {q.location}</div>}
                              </div>
                            )}
                            {q.description && <div style={{ marginTop: 10, opacity: 0.85, lineHeight: 1.55 }}>{q.description}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button style={smallBtn('gold')}   onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => reopenQuest(q.id)}>Reopen</button>
                            <button style={smallBtn('danger')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => deleteQuest(q.id)}>Delete</button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========== INVENTORY (Bag of Holding) ========== */}
          {campaignTab === 'inventory' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, alignItems: 'start' }}>
              {/* Controls row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 12, alignItems: 'start' }}>
                <div style={softCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 950 }}>Bag of Holding</div>
                      <div style={{ fontWeight: 550, opacity: 0.82, marginTop: 6, lineHeight: 1.5 }}>Shared party inventory — loot, gold totals, quest items, and artifacts.</div>
                    </div>
                  </div>
                  <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,220,160,0.15), transparent)', margin: '14px 0' }} />

                  {/* Filters */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={invLabel}>Search</div>
                      <input value={invQuery} onChange={(e) => setInvQuery(e.target.value)} placeholder="name, notes…" style={invInput} />
                    </div>
                    <div>
                      <div style={invLabel}>Category</div>
                      <select value={invCat} onChange={(e) => setInvCat(e.target.value)} style={invInput}>
                        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={invLabel}>Rarity</div>
                      <select value={invRar} onChange={(e) => setInvRar(e.target.value)} style={invInput}>
                        {RARITIES.map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={invLabel}>Sort</div>
                      <select value={invSort} onChange={(e) => setInvSort(e.target.value)} style={invInput}>
                        <option value="name">Name</option>
                        <option value="qty">Quantity</option>
                        <option value="value">Value</option>
                        <option value="updated">Recently Updated</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                    <button style={{ ...smallBtn('gold'), padding: '10px 14px', borderRadius: 14, fontSize: 13 }} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={invOpenAdd}>
                      + Add Item
                    </button>
                  </div>
                </div>

                {/* Currency */}
                <div style={{ ...softCard, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 950 }}>Currency</div>
                      <div style={{ fontSize: 11, opacity: 0.78, marginTop: 2 }}>PP / GP / SP / CP</div>
                    </div>
                  </div>
                  <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,220,160,0.15), transparent)', margin: '10px 0' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {['pp','gp','sp','cp'].map((k) => (
                      <div key={k}>
                        <div style={invTinyLabel}>{k.toUpperCase()}</div>
                        <input value={bag.currency?.[k] ?? 0} onChange={(e) => invSetCurrency(k, e.target.value)} style={invTinyInput} />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <button style={{ ...smallBtn('ghost'), width: '100%' }} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => setDangerOpen((v) => !v)}>
                      {dangerOpen ? 'Hide Danger' : 'Danger Zone'}
                    </button>
                    {dangerOpen && (
                      <div style={{ marginTop: 8, padding: 10, borderRadius: 14, border: '1px solid rgba(248,113,113,0.28)', background: 'rgba(122,30,30,0.14)' }}>
                        <div style={{ fontWeight: 950, color: 'rgba(252,165,165,0.92)', fontSize: 12 }}>Clear Bag</div>
                        <div style={{ fontSize: 11, color: THEME.creamSoft, marginTop: 6, lineHeight: 1.5 }}>This removes <strong>all</strong> items and currency.</div>
                        <button style={{ ...smallBtn('danger'), width: '100%', marginTop: 8 }} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => { const ok = confirm('Clear the entire Bag of Holding? This cannot be undone.'); if (!ok) return; setBag({ currency: { pp:0,gp:0,sp:0,cp:0 }, items:[] }); setDangerOpen(false); }}>
                          Clear Bag Forever
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Item list */}
              {invFilteredItems.length === 0 ? (
                <div style={{ ...softCard, opacity: 0.85, textAlign: 'center', padding: 28 }}>
                  <div style={{ fontWeight: 950, fontSize: 16, marginBottom: 8 }}>Bag is empty.</div>
                  <div style={{ lineHeight: 1.55 }}>Hit <strong>+ Add Item</strong> to start tracking loot.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {invFilteredItems.map((it) => (
                    <div key={it.id} style={{ ...softCard, background: `${rarityBadge(it.rarity)}, linear-gradient(180deg, ${THEME.glassA}, ${THEME.glassB})` }} onMouseEnter={() => playHover()}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 220 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 15, fontWeight: 950 }}>{it.name}</div>
                            {it.equipped && <span style={{ ...pill('Main'), fontSize: 10, padding: '2px 8px' }}>Equipped</span>}
                            <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 900 }}>{it.rarity} · {it.category}</span>
                          </div>
                          {it.notes && <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>{it.notes}</div>}
                          <div style={{ marginTop: 6, display: 'flex', gap: 12, fontSize: 12, opacity: 0.75 }}>
                            {it.assignedTo && <span>👤 {it.assignedTo}</span>}
                            {it.value  != null && <span>💰 {it.value} gp</span>}
                            {it.weight != null && <span>⚖️ {it.weight} lb</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 950, fontSize: 14, minWidth: 24, textAlign: 'center' }}>×{it.qty ?? 1}</span>
                          <button style={smallBtn('ghost')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => invBumpQty(it.id, -1)} title="-1">−</button>
                          <button style={smallBtn('ghost')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => invBumpQty(it.id, +1)} title="+1">+</button>
                          <button style={smallBtn('ghost')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => invToggleEquipped(it.id)}>Equip</button>
                          <button style={smallBtn('gold')}  onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => invOpenEdit(it)}>Edit</button>
                          <button style={smallBtn('danger')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => invDeleteItem(it.id)}>Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>{/* end body content */}

        {/* ========== QUEST MODAL ========== */}
        {questModalOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.60)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) setQuestModalOpen(false); }}>
            <div className="ch-modal" style={{ width: 'min(640px, 94vw)', borderRadius: 18, background: `linear-gradient(180deg, rgba(14,10,6,0.97), rgba(8,6,4,0.98))`, boxShadow: '0 30px 90px rgba(0,0,0,0.75)', border: `1px solid ${THEME.line}`, color: THEME.creamText, fontFamily: fontStack, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'min(560px, 82vh)' }}>
              <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 950 }}>{editingQuestId ? 'Edit Quest' : 'Add Quest'}</div>
                <button style={smallBtn('danger')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => setQuestModalOpen(false)}>Close</button>
              </div>
              <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,220,160,0.15), transparent)' }} />
              <div style={{ padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[['Title *', 'title', 'text', 'e.g. Retrieve the stolen signet ring'], ['Quest Giver', 'giver', 'text', 'e.g. Lord Harwick'], ['Location', 'location', 'text', 'e.g. The Thornwall Keep']].map(([lbl, key, type, ph]) => (
                  <div key={key}>
                    <div style={invLabel}>{lbl}</div>
                    <input type={type} value={questDraft[key] || ''} onChange={(e) => setQuestDraft((d) => ({ ...d, [key]: e.target.value }))} placeholder={ph} style={invInput} />
                  </div>
                ))}
                <div>
                  <div style={invLabel}>Type</div>
                  <select value={questDraft.type || 'Side'} onChange={(e) => setQuestDraft((d) => ({ ...d, type: e.target.value }))} style={invInput}>
                    {['Main', 'Side', 'Personal'].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <div style={invLabel}>Description</div>
                  <textarea value={questDraft.description || ''} onChange={(e) => setQuestDraft((d) => ({ ...d, description: e.target.value }))} placeholder="What's the hook? What's at stake?" rows={4} style={{ ...invInput, resize: 'none' }} />
                </div>
              </div>
              <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,220,160,0.15), transparent)' }} />
              <div style={{ padding: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button style={smallBtn('ghost')}  onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => setQuestModalOpen(false)}>Cancel</button>
                <button style={smallBtn('gold')}   onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={saveQuest}>{editingQuestId ? 'Save Changes' : 'Add Quest'}</button>
              </div>
            </div>
          </div>
        )}

        {/* ========== INVENTORY MODAL ========== */}
        {invModalOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 35, background: 'rgba(0,0,0,0.60)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) setInvModalOpen(false); }}>
            <div className="ch-modal" style={{ width: 'min(720px, 95vw)', borderRadius: 18, background: `linear-gradient(180deg, rgba(14,10,6,0.97), rgba(8,6,4,0.98))`, boxShadow: '0 30px 90px rgba(0,0,0,0.75)', border: `1px solid ${THEME.line}`, color: THEME.creamText, fontFamily: fontStack, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'min(620px, 86vh)' }}>
              <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 950 }}>{invEditingId ? 'Edit Item' : 'Add Item'}</div>
                <button style={smallBtn('danger')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => setInvModalOpen(false)}>Close</button>
              </div>
              <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,220,160,0.15), transparent)' }} />
              <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: 10, alignContent: 'start', overflowY: 'auto' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={invLabel}>Name</div>
                  <input value={invDraft.name} onChange={(e) => setInvDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Longsword +1" style={invInput} />
                </div>
                <div>
                  <div style={invLabel}>Category</div>
                  <select value={invDraft.category} onChange={(e) => setInvDraft((d) => ({ ...d, category: e.target.value }))} style={invInput}>
                    {CATEGORIES.filter((c) => c !== 'All').map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <div style={invLabel}>Rarity</div>
                  <select value={invDraft.rarity} onChange={(e) => setInvDraft((d) => ({ ...d, rarity: e.target.value }))} style={invInput}>
                    {RARITIES.filter((r) => r !== 'All').map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <div style={invLabel}>Qty</div>
                  <input type="number" min={1} max={9999} value={invDraft.qty} onChange={(e) => setInvDraft((d) => ({ ...d, qty: e.target.value }))} style={invInput} />
                </div>
                <div>
                  <div style={invLabel}>Value (gp)</div>
                  <input type="number" min={0} value={invDraft.value} onChange={(e) => setInvDraft((d) => ({ ...d, value: e.target.value }))} placeholder="0" style={invInput} />
                </div>
                <div>
                  <div style={invLabel}>Weight (lb)</div>
                  <input type="number" min={0} value={invDraft.weight} onChange={(e) => setInvDraft((d) => ({ ...d, weight: e.target.value }))} placeholder="0" style={invInput} />
                </div>
                <div>
                  <div style={invLabel}>Assigned To</div>
                  <input value={invDraft.assignedTo} onChange={(e) => setInvDraft((d) => ({ ...d, assignedTo: e.target.value }))} placeholder="Player name" style={invInput} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={invLabel}>Notes</div>
                  <textarea value={invDraft.notes} onChange={(e) => setInvDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Description, effects, flavor text…" rows={3} style={{ ...invInput, resize: 'none' }} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={invLabel}>Tags (comma-separated)</div>
                  <input value={invDraft.tags} onChange={(e) => setInvDraft((d) => ({ ...d, tags: e.target.value }))} placeholder="magic, cursed, party-loot" style={invInput} />
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" id="inv-equipped" checked={!!invDraft.equipped} onChange={(e) => setInvDraft((d) => ({ ...d, equipped: e.target.checked }))} />
                  <label htmlFor="inv-equipped" style={{ fontWeight: 900, fontSize: 13, cursor: 'pointer', color: THEME.creamText }}>Equipped</label>
                </div>
              </div>
              <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,220,160,0.15), transparent)' }} />
              <div style={{ padding: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button style={smallBtn('ghost')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => setInvModalOpen(false)}>Cancel</button>
                <button style={smallBtn('gold')}  onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={invSaveDraft}>{invEditingId ? 'Save Changes' : 'Add Item'}</button>
              </div>
            </div>
          </div>
        )}

      </div>{/* end scrollable wrapper */}
    </ShellLayout>
  );
}