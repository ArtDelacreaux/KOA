import React, { useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react';

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

    // hover ok
    playHover = () => {},

    // NEW: navigation SFX (FlipPage) used only for returning to menu
    playNav = () => {},
  } = props;

  /* =========================
     Shared styles
  ========================= */
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

  const softCard = {
    padding: 14,
    borderRadius: 16,
    background: 'rgba(255,245,220,0.92)',
    color: '#2b1a0f',
    fontFamily: "Cinzel, 'Trajan Pro', Georgia, serif",
    boxShadow: '0 10px 18px rgba(0,0,0,0.08)',
    border: '1px solid rgba(0,0,0,0.06)',
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

  const buttonBase = {
    padding: '14px 28px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    backgroundColor: '#b06500',
    color: 'white',
    fontSize: '1.05rem',
    transition: 'all 0.25s ease',
    userSelect: 'none',
  };

  const backButton = {
    ...buttonBase,
    backgroundColor: '#7a1e1e',
    boxShadow: '0 0 15px rgba(255,80,80,0.5)',
    margin: 0,
  };

  const buttonHover = (e) => {
    playHover();
    e.currentTarget.style.transform = 'scale(1.06)';
    e.currentTarget.style.boxShadow = '0 0 18px rgba(255,170,60,0.45)';
  };

  const buttonLeave = (e) => {
    e.currentTarget.style.transform = 'scale(1)';
    const isBack = e.currentTarget.dataset.kind === 'back';
    e.currentTarget.style.boxShadow = isBack ? '0 0 15px rgba(255,80,80,0.5)' : 'none';
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
    if (variant === 'ghost') {
      return {
        ...base,
        background: 'rgba(255,255,255,0.45)',
        color: 'rgba(255,245,220,0.92)',
    fontFamily: "Cinzel, 'Trajan Pro', Georgia, serif",
        border: '1px solid rgba(0,0,0,0.10)',
        boxShadow: 'none',
      };
    }
    return base;
  };

  const smallBtnHover = (e) => {
    playHover();
    e.currentTarget.style.transform = 'translateY(-1px)';
    e.currentTarget.style.filter = 'brightness(1.06)';
    e.currentTarget.style.boxShadow = '0 16px 34px rgba(0,0,0,0.26)';
  };

  const smallBtnLeave = (e) => {
    e.currentTarget.style.transform = 'translateY(0px)';
    e.currentTarget.style.filter = 'none';
  };

  const pill = (type) => {
    const map = {
      Main: { bg: 'rgba(30,58,138,0.14)', bd: 'rgba(30,58,138,0.28)', fg: '#1e3a8a' },
      Side: { bg: 'rgba(176,101,0,0.14)', bd: 'rgba(176,101,0,0.28)', fg: '#7a3f00' },
      Urgent: { bg: 'rgba(122,30,30,0.14)', bd: 'rgba(122,30,30,0.28)', fg: '#7a1e1e' },
    };
    const c = map[type] || map.Side;
    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      borderRadius: 999,
      border: `1px solid ${c.bd}`,
      background: c.bg,
      color: c.fg,
      fontWeight: 900,
      fontSize: 12,
      letterSpacing: 0.2,
      userSelect: 'none',
      boxShadow: type === 'Urgent' ? '0 0 18px rgba(122,30,30,0.18)' : 'none',
    };
  };

  /* =========================
     Header measurement
  ========================= */
  const headerRef = useRef(null);
  const [headerH, setHeaderH] = useState(110);

  useLayoutEffect(() => {
    if (!headerRef.current) return;
    const el = headerRef.current;

    const measure = () => setHeaderH(el.offsetHeight);
    measure();

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    window.addEventListener('resize', measure);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [panelType, campaignTab, questModalOpen, (quests || []).length]);

  const bodyArea = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: headerH,
    bottom: 0,
    padding: 18,
    overflowY: 'auto',
  };

  /* =========================
     Quests helpers
  ========================= */
  const activeQuests = useMemo(() => (quests || []).filter((q) => q.status === 'active'), [quests]);
  const completedQuests = useMemo(() => (quests || []).filter((q) => q.status === 'completed'), [quests]);

  const newId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const openAddQuest = () => {
    setEditingQuestId(null);
    setQuestDraft({ title: '', type: 'Side', giver: '', location: '', description: '' });
    setQuestModalOpen(true);
  };

  const openEditQuest = (q) => {
    setEditingQuestId(q.id);
    setQuestDraft({
      title: q.title || '',
      type: q.type || 'Side',
      giver: q.giver || '',
      location: q.location || '',
      description: q.description || '',
    });
    setQuestModalOpen(true);
  };

  const saveQuest = () => {
    const title = (questDraft.title || '').trim();
    if (!title) {
      alert('Quest needs a title.');
      return;
    }

    if (!editingQuestId) {
      const q = {
        id: newId(),
        title,
        type: questDraft.type || 'Side',
        giver: (questDraft.giver || '').trim(),
        location: (questDraft.location || '').trim(),
        description: (questDraft.description || '').trim(),
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setQuests((prev) => [q, ...(prev || [])]);
    } else {
      setQuests((prev) =>
        (prev || []).map((q) =>
          q.id === editingQuestId
            ? {
                ...q,
                title,
                type: questDraft.type || q.type,
                giver: (questDraft.giver || '').trim(),
                location: (questDraft.location || '').trim(),
                description: (questDraft.description || '').trim(),
                updatedAt: new Date().toISOString(),
              }
            : q
        )
      );
    }

    setQuestModalOpen(false);
    setEditingQuestId(null);
  };

  const deleteQuest = (id) => {
    if (!confirm('Delete this quest?')) return;
    setQuests((prev) => (prev || []).filter((q) => q.id !== id));
  };

  const completeQuest = (id) => {
    setQuests((prev) =>
      (prev || []).map((q) => (q.id === id ? { ...q, status: 'completed', updatedAt: new Date().toISOString() } : q))
    );
  };

  const reopenQuest = (id) => {
    setQuests((prev) =>
      (prev || []).map((q) => (q.id === id ? { ...q, status: 'active', updatedAt: new Date().toISOString() } : q))
    );
  };

  // Escape closes modal
  useEffect(() => {
    if (!questModalOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setQuestModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [questModalOpen, setQuestModalOpen]);

  /* =========================
     Player Hub Launcher (timer + recap)
  ========================= */
  const LS_LAUNCH_KEY = 'koa:launcher:v1';

  const [launcherState, setLauncherState] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_LAUNCH_KEY);
      return raw
        ? JSON.parse(raw)
        : {
            watchUrl: 'https://w2g.tv/en/room/?room_id=h2rq2xmdrlzdlyolcu',
            owlbearUrl: 'https://owlbear.rodeo/room/TQbSmbFAE6l4/TheFatedSoul',
            recap: '',
            notes: '',
            timerRunning: false,
            elapsedMs: 0,
            lastTick: Date.now(),
          };
    } catch {
      return {
        watchUrl: 'https://w2g.tv/en/room/?room_id=h2rq2xmdrlzdlyolcu',
        owlbearUrl: 'https://owlbear.rodeo/room/TQbSmbFAE6l4/TheFatedSoul',
        recap: '',
        notes: '',
        timerRunning: false,
        elapsedMs: 0,
        lastTick: Date.now(),
      };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_LAUNCH_KEY, JSON.stringify(launcherState));
    } catch {}
  }, [launcherState]);

  useEffect(() => {
    if (!launcherState.timerRunning) return;

    const id = window.setInterval(() => {
      setLauncherState((s) => {
        const now = Date.now();
        const delta = Math.max(0, now - (s.lastTick || now));
        return { ...s, elapsedMs: (s.elapsedMs || 0) + delta, lastTick: now };
      });
    }, 250);

    return () => window.clearInterval(id);
  }, [launcherState.timerRunning]);

  const fmtElapsed = (ms) => {
    const total = Math.floor((ms || 0) / 1000);
    const h = String(Math.floor(total / 3600)).padStart(2, '0');
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const openTool = (kind) => {
    const url = kind === 'watch' ? launcherState.watchUrl : launcherState.owlbearUrl;
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  /* =========================
     INVENTORY (Bag of Holding) — localStorage
  ========================= */
  const LS_BAG_KEY = 'koa:bagofholding:v1';

  const clampInt = (n, min, max) => Math.max(min, Math.min(max, n));
  const bagNewId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const CATEGORIES = ['All', 'Weapon', 'Armor', 'Gear', 'Consumable', 'Loot', 'Quest', 'Magic', 'Misc'];
  const RARITIES = ['All', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

  const rarityBadge = (rarity) => {
    const r = (rarity || 'Common').toLowerCase();
    const map = {
      common: 'rgba(255,255,255,0.16)',
      uncommon: 'rgba(110,231,183,0.18)',
      rare: 'rgba(96,165,250,0.18)',
      epic: 'rgba(216,180,254,0.18)',
      legendary: 'rgba(251,191,36,0.20)',
    };
    return map[r] || map.common;
  };

  // more compact inventory inputs
  const invInput = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 9px',
    borderRadius: 12,
    border: '1px solid rgba(0,0,0,0.16)',
    outline: 'none',
    fontSize: 13,
    background: 'rgba(255,255,255,0.70)',
    color: 'rgba(255,245,220,0.92)',
    fontFamily: "Cinzel, 'Trajan Pro', Georgia, serif",
  };

  const invTinyInput = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '6px 8px',
    borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.16)',
    outline: 'none',
    fontSize: 12,
    fontWeight: 900,
    background: 'rgba(255,255,255,0.72)',
    color: 'rgba(255,245,220,0.92)',
    fontFamily: "Cinzel, 'Trajan Pro', Georgia, serif",
  };

  const invLabel = { fontSize: 11, fontWeight: 900, opacity: 0.75, marginBottom: 4 };
  const invTinyLabel = { fontSize: 10, fontWeight: 950, opacity: 0.70, marginBottom: 4, letterSpacing: 0.2 };

  const [bag, setBag] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_BAG_KEY);
      if (!raw) return { currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [] };
      const parsed = JSON.parse(raw);
      return {
        currency: {
          pp: parsed?.currency?.pp ?? 0,
          gp: parsed?.currency?.gp ?? 0,
          sp: parsed?.currency?.sp ?? 0,
          cp: parsed?.currency?.cp ?? 0,
        },
        items: Array.isArray(parsed?.items) ? parsed.items : [],
      };
    } catch {
      return { currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [] };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_BAG_KEY, JSON.stringify(bag));
    } catch {}
  }, [bag]);

  const [invQuery, setInvQuery] = useState('');
  const [invCat, setInvCat] = useState('All');
  const [invRar, setInvRar] = useState('All');
  const [invSort, setInvSort] = useState('name'); // name | qty | value | updated

  const [invModalOpen, setInvModalOpen] = useState(false);
  const [invEditingId, setInvEditingId] = useState(null);
  const [dangerOpen, setDangerOpen] = useState(false);

  const invEmptyDraft = {
    name: '',
    qty: 1,
    category: 'Gear',
    rarity: 'Common',
    value: '',
    weight: '',
    notes: '',
    tags: '',
    assignedTo: '',
    equipped: false,
  };
  const [invDraft, setInvDraft] = useState(invEmptyDraft);

  const invOpenAdd = () => {
    setInvEditingId(null);
    setInvDraft(invEmptyDraft);
    setInvModalOpen(true);
  };

  const invOpenEdit = (item) => {
    setInvEditingId(item.id);
    setInvDraft({
      name: item.name || '',
      qty: typeof item.qty === 'number' ? item.qty : 1,
      category: item.category || 'Gear',
      rarity: item.rarity || 'Common',
      value: item.value ?? '',
      weight: item.weight ?? '',
      notes: item.notes || '',
      tags: Array.isArray(item.tags) ? item.tags.join(', ') : '',
      assignedTo: item.assignedTo || '',
      equipped: !!item.equipped,
    });
    setInvModalOpen(true);
  };

  const invSaveDraft = () => {
    const name = (invDraft.name || '').trim();
    if (!name) {
      alert('Item needs a name.');
      return;
    }

    const qty = clampInt(parseInt(invDraft.qty, 10) || 1, 1, 9999);
    const value = invDraft.value === '' ? null : Number(invDraft.value);
    const weight = invDraft.weight === '' ? null : Number(invDraft.weight);

    const tags = (invDraft.tags || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const now = new Date().toISOString();

    setBag((prev) => {
      const items = prev.items || [];

      if (!invEditingId) {
        const item = {
          id: bagNewId(),
          name,
          qty,
          category: invDraft.category || 'Gear',
          rarity: invDraft.rarity || 'Common',
          value: Number.isFinite(value) ? value : null,
          weight: Number.isFinite(weight) ? weight : null,
          notes: (invDraft.notes || '').trim(),
          tags,
          assignedTo: (invDraft.assignedTo || '').trim(),
          equipped: !!invDraft.equipped,
          createdAt: now,
          updatedAt: now,
        };
        return { ...prev, items: [item, ...items] };
      }

      return {
        ...prev,
        items: items.map((it) =>
          it.id === invEditingId
            ? {
                ...it,
                name,
                qty,
                category: invDraft.category || it.category || 'Gear',
                rarity: invDraft.rarity || it.rarity || 'Common',
                value: Number.isFinite(value) ? value : null,
                weight: Number.isFinite(weight) ? weight : null,
                notes: (invDraft.notes || '').trim(),
                tags,
                assignedTo: (invDraft.assignedTo || '').trim(),
                equipped: !!invDraft.equipped,
                updatedAt: now,
              }
            : it
        ),
      };
    });

    setInvModalOpen(false);
    setInvEditingId(null);
  };

  const invDeleteItem = (id) => {
    if (!confirm('Delete this item?')) return;
    setBag((prev) => ({ ...prev, items: (prev.items || []).filter((it) => it.id !== id) }));
  };

  const invBumpQty = (id, delta) => {
    setBag((prev) => {
      const now = new Date().toISOString();
      const items = (prev.items || []).map((it) => {
        if (it.id !== id) return it;
        const nextQty = clampInt((it.qty || 1) + delta, 1, 9999);
        return { ...it, qty: nextQty, updatedAt: now };
      });
      return { ...prev, items };
    });
  };

  const invToggleEquipped = (id) => {
    setBag((prev) => {
      const now = new Date().toISOString();
      const items = (prev.items || []).map((it) => (it.id === id ? { ...it, equipped: !it.equipped, updatedAt: now } : it));
      return { ...prev, items };
    });
  };

  const invSetCurrency = (key, value) => {
    setBag((prev) => ({
      ...prev,
      currency: {
        ...(prev.currency || { pp: 0, gp: 0, sp: 0, cp: 0 }),
        [key]: clampInt(parseInt(value, 10) || 0, 0, 9999999),
      },
    }));
  };

  const invFilteredItems = useMemo(() => {
    const q = (invQuery || '').trim().toLowerCase();
    let items = [...(bag.items || [])];

    if (invCat !== 'All') items = items.filter((it) => (it.category || '') === invCat);
    if (invRar !== 'All') items = items.filter((it) => (it.rarity || '') === invRar);

    if (q) {
      items = items.filter((it) => {
        const hay = `${it.name || ''} ${(it.notes || '')} ${(it.assignedTo || '')} ${(it.category || '')} ${(it.rarity || '')} ${(it.tags || []).join(' ')}`.toLowerCase();
        return hay.includes(q);
      });
    }

    items.sort((a, b) => {
      if (invSort === 'qty') return (b.qty || 0) - (a.qty || 0);
      if (invSort === 'value') return (Number(b.value) || 0) - (Number(a.value) || 0);
      if (invSort === 'updated') return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      return (a.name || '').localeCompare(b.name || '');
    });

    return items;
  }, [bag.items, invQuery, invCat, invRar, invSort]);

  const invTotals = useMemo(() => {
    const items = bag.items || [];
    const unique = items.length;
    const totalQty = items.reduce((sum, it) => sum + (it.qty || 0), 0);
    const totalValue = items.reduce((sum, it) => sum + (Number(it.value) || 0) * (it.qty || 1), 0);
    const totalWeight = items.reduce((sum, it) => sum + (Number(it.weight) || 0) * (it.qty || 1), 0);
    return { unique, totalQty, totalValue, totalWeight };
  }, [bag.items]);

  // Escape closes inventory modal too
  useEffect(() => {
    if (!invModalOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setInvModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [invModalOpen]);

  /* =========================
     RENDER
  ========================= */
  return (
    <div style={panelStyle(panelType === 'campaign')}>
      <div style={cardShell()}>
        {/* HEADER */}
        <div ref={headerRef} style={headerBar}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 26, fontWeight: 950, lineHeight: 1 }}>Party Hub</div>
              <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 900, letterSpacing: 1.2, textTransform: 'uppercase' }}>Tonight’s Table</div>
            </div>

            {/* ✅ FlipPage only here */}
            <button
              data-kind="back"
              style={backButton}
              onMouseEnter={buttonHover}
              onMouseLeave={buttonLeave}
              onClick={() => {
                playNav();
                cinematicNav('menu');
              }}
            >
              Back to Menu
            </button>
          </div>

          {/* Tabs are silent */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={tabButtonStyle(campaignTab === 'launcher')} onMouseEnter={() => playHover()} onClick={() => setCampaignTab('launcher')} role="button" tabIndex={0}>
              Hub
            </span>
            <span style={tabButtonStyle(campaignTab === 'quests')} onMouseEnter={() => playHover()} onClick={() => setCampaignTab('quests')} role="button" tabIndex={0}>
              Quest Board
            </span>
            <span style={tabButtonStyle(campaignTab === 'inventory')} onMouseEnter={() => playHover()} onClick={() => setCampaignTab('inventory')} role="button" tabIndex={0}>
              Party Inventory
            </span>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {campaignTab === 'quests' && (
                <button style={smallBtn('gold')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={openAddQuest}>
                  + Add Quest
                </button>
              )}
            </div>
          </div>
        </div>

        {/* BODY */}
        <div style={bodyArea}>
          {/* ========== HUB ========== */}
          {campaignTab === 'launcher' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 14, alignItems: 'start' }}>
              {/* LEFT */}
              <div style={softCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 950 }}>Quick Launch</div>
                    <div style={{ opacity: 0.82, marginTop: 6, lineHeight: 1.5 }}>Open the table tools. Start the vibe. Begin the chaos.</div>
                  </div>

                  <span
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: 'rgba(176,101,0,0.12)',
                      border: '1px solid rgba(176,101,0,0.18)',
                      fontSize: 12,
                      fontWeight: 900,
                      opacity: 0.92,
                      userSelect: 'none',
                    }}
                  >
                    Players
                  </span>
                </div>

                <div style={{ height: 1, background: 'rgba(0,0,0,0.10)', margin: '14px 0' }} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 16,
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.62), rgba(255,255,255,0.50))',
                      border: '1px solid rgba(0,0,0,0.06)',
                      boxShadow: '0 10px 18px rgba(0,0,0,0.08)',
                    }}
                    onMouseEnter={() => playHover()}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontSize: 22 }}>🎬</div>
                      <div>
                        <div style={{ fontWeight: 950, fontSize: 14 }}>Watch Party</div>
                        <div style={{ fontSize: 12, opacity: 0.78 }}>Music / ambience / cinematic clips</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button style={smallBtn('gold')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => openTool('watch')}>
                        Open Room
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: 14,
                      borderRadius: 16,
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.62), rgba(255,255,255,0.50))',
                      border: '1px solid rgba(0,0,0,0.06)',
                      boxShadow: '0 10px 18px rgba(0,0,0,0.08)',
                    }}
                    onMouseEnter={() => playHover()}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontSize: 22 }}>🗺️</div>
                      <div>
                        <div style={{ fontWeight: 950, fontSize: 14 }}>Owlbear Table</div>
                        <div style={{ fontSize: 12, opacity: 0.78 }}>Maps / tokens / encounters</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button style={smallBtn('gold')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => openTool('owlbear')}>
                        Open Room
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 14, ...softCard }}>
                  <div style={{ fontWeight: 950 }}>Recap</div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6, lineHeight: 1.6 }}>
                    Write what happened last session so nobody “forgets” (again).
                  </div>

                  <textarea
                    value={launcherState.recap || ''}
                    onChange={(e) => setLauncherState((s) => ({ ...s, recap: e.target.value }))}
                    placeholder={`• Last time on Knights of Avalon...\n• Key choices:\n• Big reveals:\n• Next goal:`}
                    rows={6}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      marginTop: 10,
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid rgba(0,0,0,0.16)',
                      outline: 'none',
                      fontSize: 13,
                      lineHeight: 1.5,
                      background: 'rgba(255,255,255,0.70)',
                      color: 'rgba(255,245,220,0.92)',
    fontFamily: "Cinzel, 'Trajan Pro', Georgia, serif",
                      resize: 'none',
                    }}
                  />
                </div>
              </div>

              {/* RIGHT */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={softCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontSize: 22 }}>⏱️</div>
                      <div>
                        <div style={{ fontWeight: 950 }}>Session Timer</div>
                        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>For pacing, breaks, and snack diplomacy.</div>
                      </div>
                    </div>

                    <div style={{ fontWeight: 950, fontSize: 16, letterSpacing: 0.6 }}>{fmtElapsed(launcherState.elapsedMs)}</div>
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      style={smallBtn('gold')}
                      onMouseEnter={smallBtnHover}
                      onMouseLeave={smallBtnLeave}
                      onClick={() =>
                        setLauncherState((s) => ({
                          ...s,
                          timerRunning: !s.timerRunning,
                          lastTick: Date.now(),
                        }))
                      }
                    >
                      {launcherState.timerRunning ? 'Pause' : 'Start'}
                    </button>

                    <button
                      style={smallBtn('danger')}
                      onMouseEnter={smallBtnHover}
                      onMouseLeave={smallBtnLeave}
                      onClick={() =>
                        setLauncherState((s) => ({
                          ...s,
                          timerRunning: false,
                          elapsedMs: 0,
                          lastTick: Date.now(),
                        }))
                      }
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div style={softCard}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ fontSize: 22 }}>📝</div>
                    <div>
                      <div style={{ fontWeight: 950 }}>Session Notes</div>
                      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>Saved locally. Great for improvised names.</div>
                    </div>
                  </div>

                  <textarea
                    value={launcherState.notes || ''}
                    onChange={(e) => setLauncherState((s) => ({ ...s, notes: e.target.value }))}
                    placeholder={`• NPC:\n• Hook:\n• Loot:\n• Reminder:`}
                    rows={10}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      marginTop: 12,
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid rgba(0,0,0,0.16)',
                      outline: 'none',
                      fontSize: 13,
                      lineHeight: 1.5,
                      background: 'rgba(255,255,255,0.70)',
                      color: 'rgba(255,245,220,0.92)',
    fontFamily: "Cinzel, 'Trajan Pro', Georgia, serif",
                      resize: 'none',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========== QUEST BOARD ========== */}
          {campaignTab === 'quests' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 18, fontWeight: 950 }}>Active Quests</div>
                  <div style={{ opacity: 0.75, fontWeight: 900, fontSize: 12 }}>{activeQuests.length} active</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activeQuests.length === 0 ? (
                    <div style={{ ...softCard, opacity: 0.85 }}>
                      <div style={{ fontWeight: 950, marginBottom: 6 }}>No active quests.</div>
                      <div style={{ lineHeight: 1.55 }}>
                        Hit <strong>+ Add Quest</strong> to start tracking hooks.
                      </div>
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
                                {q.giver && (
                                  <div>
                                    <strong>Giver:</strong> {q.giver}
                                  </div>
                                )}
                                {q.location && (
                                  <div>
                                    <strong>Location:</strong> {q.location}
                                  </div>
                                )}
                              </div>
                            )}

                            {q.description && <div style={{ marginTop: 10, opacity: 0.9, lineHeight: 1.55 }}>{q.description}</div>}
                          </div>

                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button style={smallBtn('gold')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => openEditQuest(q)}>
                              Edit
                            </button>
                            <button style={smallBtn('gold')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => completeQuest(q.id)}>
                              Complete
                            </button>
                            <button style={smallBtn('danger')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => deleteQuest(q.id)}>
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 18, fontWeight: 950 }}>Completed</div>
                  <div style={{ opacity: 0.75, fontWeight: 900, fontSize: 12 }}>{completedQuests.length} done</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {completedQuests.length === 0 ? (
                    <div style={{ ...softCard, opacity: 0.85 }}>
                      <div style={{ fontWeight: 950, marginBottom: 6 }}>Nothing completed yet.</div>
                      <div style={{ lineHeight: 1.55 }}>Completed quests appear here.</div>
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
                                {q.giver && (
                                  <div>
                                    <strong>Giver:</strong> {q.giver}
                                  </div>
                                )}
                                {q.location && (
                                  <div>
                                    <strong>Location:</strong> {q.location}
                                  </div>
                                )}
                              </div>
                            )}

                            {q.description && <div style={{ marginTop: 10, opacity: 0.85, lineHeight: 1.55 }}>{q.description}</div>}
                          </div>

                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button style={smallBtn('gold')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => reopenQuest(q.id)}>
                              Reopen
                            </button>
                            <button style={smallBtn('danger')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => deleteQuest(q.id)}>
                              Delete
                            </button>
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
              {/* TOP: controls + currency (compact) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 12, alignItems: 'start' }}>
                {/* LEFT: title + filters + add button (compact) */}
                <div style={softCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 950 }}>Bag of Holding</div>
                      <div style={{ opacity: 0.82, marginTop: 6, lineHeight: 1.5 }}>
                        Shared party inventory — loot, gold totals, quest items, and artifacts.
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>Unique: {invTotals.unique}</span>
                      <span style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>Total Qty: {invTotals.totalQty}</span>
                      <span style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }} title="Value × qty (if value is filled in)">
                        Total Value: {invTotals.totalValue}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }} title="Weight × qty (optional)">
                        Total Weight: {Math.round(invTotals.totalWeight * 100) / 100}
                      </span>
                    </div>
                  </div>

                  {/* Filters moved UP (right under title) */}
                  <div style={{ height: 1, background: 'rgba(0,0,0,0.10)', margin: '12px 0' }} />

                  <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.85fr 0.85fr 0.85fr', gap: 10, alignItems: 'end' }}>
                    <div>
                      <div style={invLabel}>Search</div>
                      <input value={invQuery} onChange={(e) => setInvQuery(e.target.value)} placeholder="Name, notes, tags, assigned…" style={invInput} />
                    </div>

                    <div>
                      <div style={invLabel}>Category</div>
                      <select value={invCat} onChange={(e) => setInvCat(e.target.value)} style={{ ...invInput, fontWeight: 800 }}>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div style={invLabel}>Rarity</div>
                      <select value={invRar} onChange={(e) => setInvRar(e.target.value)} style={{ ...invInput, fontWeight: 800 }}>
                        {RARITIES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div style={invLabel}>Sort</div>
                      <select value={invSort} onChange={(e) => setInvSort(e.target.value)} style={{ ...invInput, fontWeight: 800 }}>
                        <option value="name">Name</option>
                        <option value="qty">Quantity</option>
                        <option value="value">Value</option>
                        <option value="updated">Recently Updated</option>
                      </select>
                    </div>
                  </div>

                  {/* Small, visible Add button (NOT huge, NOT full width) */}
                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                    <button style={{ ...smallBtn('gold'), padding: '10px 14px', borderRadius: 14, fontSize: 13 }} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={invOpenAdd}>
                      + Add Item
                    </button>
                  </div>
                </div>

                {/* RIGHT: currency compact */}
                <div style={{ ...softCard, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 950 }}>Currency</div>
                      <div style={{ fontSize: 11, opacity: 0.78, marginTop: 2 }}>PP / GP / SP / CP</div>
                    </div>
                  </div>

                  <div style={{ height: 1, background: 'rgba(0,0,0,0.10)', margin: '10px 0' }} />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={invTinyLabel}>PP</div>
                      <input value={bag.currency?.pp ?? 0} onChange={(e) => invSetCurrency('pp', e.target.value)} style={invTinyInput} />
                    </div>
                    <div>
                      <div style={invTinyLabel}>GP</div>
                      <input value={bag.currency?.gp ?? 0} onChange={(e) => invSetCurrency('gp', e.target.value)} style={invTinyInput} />
                    </div>
                    <div>
                      <div style={invTinyLabel}>SP</div>
                      <input value={bag.currency?.sp ?? 0} onChange={(e) => invSetCurrency('sp', e.target.value)} style={invTinyInput} />
                    </div>
                    <div>
                      <div style={invTinyLabel}>CP</div>
                      <input value={bag.currency?.cp ?? 0} onChange={(e) => invSetCurrency('cp', e.target.value)} style={invTinyInput} />
                    </div>
                  </div>

                  {/* Guarded danger zone */}
                  <div style={{ marginTop: 10 }}>
                    <button style={{ ...smallBtn('ghost'), width: '100%' }} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => setDangerOpen((v) => !v)}>
                      {dangerOpen ? 'Hide Danger' : 'Danger Zone'}
                    </button>

                    {dangerOpen && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: 10,
                          borderRadius: 14,
                          border: '1px solid rgba(122,30,30,0.22)',
                          background: 'rgba(122,30,30,0.08)',
                        }}
                      >
                        <div style={{ fontWeight: 950, color: '#7a1e1e', fontSize: 12 }}>Clear Bag</div>
                        <div style={{ fontSize: 11, opacity: 0.86, marginTop: 6, lineHeight: 1.5 }}>
                          This removes <strong>all</strong> items and currency.
                        </div>

                        <button
                          style={{ ...smallBtn('danger'), width: '100%', marginTop: 8 }}
                          onMouseEnter={smallBtnHover}
                          onMouseLeave={smallBtnLeave}
                          onClick={() => {
                            const ok = confirm('Clear the entire Bag of Holding? This cannot be undone.');
                            if (!ok) return;
                            setBag({ currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [] });
                            setDangerOpen(false);
                          }}
                        >
                          Clear Bag Forever
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Item list */}
              {invFilteredItems.length === 0 ? (
                <div style={{ ...softCard, opacity: 0.9 }}>
                  <div style={{ fontWeight: 950, marginBottom: 6 }}>No items found.</div>
                  <div style={{ lineHeight: 1.6 }}>Click <strong>+ Add Item</strong> above, or clear your filters.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {invFilteredItems.map((it) => (
                    <div key={it.id} style={softCard} onMouseEnter={() => playHover()}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                        <div style={{ minWidth: 260 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 16, fontWeight: 950 }}>{it.name}</div>

                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 900,
                                padding: '4px 8px',
                                borderRadius: 999,
                                background: 'rgba(255,255,255,0.50)',
                                border: '1px solid rgba(0,0,0,0.10)',
                                opacity: 0.92,
                              }}
                            >
                              {it.category || 'Misc'}
                            </span>

                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 900,
                                padding: '4px 8px',
                                borderRadius: 999,
                                background: rarityBadge(it.rarity),
                                border: '1px solid rgba(0,0,0,0.10)',
                                opacity: 0.92,
                              }}
                            >
                              {it.rarity || 'Common'}
                            </span>

                            {it.equipped ? (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 950,
                                  padding: '4px 8px',
                                  borderRadius: 999,
                                  background: 'rgba(16,185,129,0.14)',
                                  border: '1px solid rgba(16,185,129,0.22)',
                                  opacity: 0.95,
                                }}
                              >
                                Equipped
                              </span>
                            ) : null}
                          </div>

                          {(it.assignedTo || '').trim() ? (
                            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
                              Assigned to: <span style={{ opacity: 0.9 }}>{it.assignedTo}</span>
                            </div>
                          ) : null}

                          {(it.value != null || it.weight != null) && (
                            <div style={{ marginTop: 8, opacity: 0.85, fontSize: 12, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                              {it.value != null ? <span>Value: {it.value}</span> : null}
                              {it.weight != null ? <span>Weight: {it.weight}</span> : null}
                            </div>
                          )}

                          {it.notes ? <div style={{ marginTop: 8, opacity: 0.9, lineHeight: 1.55 }}>{it.notes}</div> : null}

                          {Array.isArray(it.tags) && it.tags.length ? (
                            <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {it.tags.map((t) => (
                                <span
                                  key={t}
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 900,
                                    padding: '4px 8px',
                                    borderRadius: 999,
                                    background: 'rgba(0,0,0,0.06)',
                                    border: '1px solid rgba(0,0,0,0.08)',
                                    opacity: 0.9,
                                  }}
                                >
                                  #{t}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <div style={{ fontWeight: 950, opacity: 0.9 }}>Qty: {it.qty ?? 1}</div>

                          <button style={smallBtn('ghost')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => invBumpQty(it.id, -1)} title="-1">
                            −
                          </button>
                          <button style={smallBtn('ghost')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => invBumpQty(it.id, +1)} title="+1">
                            +
                          </button>

                          <button style={smallBtn('ghost')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => invToggleEquipped(it.id)} title="Toggle equipped">
                            Equip
                          </button>

                          <button style={smallBtn('gold')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => invOpenEdit(it)}>
                            Edit
                          </button>
                          <button style={smallBtn('danger')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => invDeleteItem(it.id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========== QUEST MODAL ========== */}
        {questModalOpen && (
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
              if (e.target === e.currentTarget) setQuestModalOpen(false);
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
                maxHeight: 'min(560px, 82vh)',
              }}
            >
              <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 950 }}>{editingQuestId ? 'Edit Quest' : 'Add Quest'}</div>

                <button style={smallBtn('danger')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => setQuestModalOpen(false)}>
                  Close
                </button>
              </div>

              <div style={{ height: 1, background: 'rgba(0,0,0,0.10)' }} />

              <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignContent: 'start' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.75, marginBottom: 4 }}>Title</div>
                  <input
                    value={questDraft.title}
                    onChange={(e) => setQuestDraft((d) => ({ ...d, title: e.target.value }))}
                    placeholder="e.g. Save the Burning Village"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid rgba(0,0,0,0.18)',
                      outline: 'none',
                      fontSize: 13,
                      fontWeight: 700,
                      background: 'rgba(255,255,255,0.72)',
                      color: 'rgba(255,245,220,0.92)',
    fontFamily: "Cinzel, 'Trajan Pro', Georgia, serif",
                    }}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.75, marginBottom: 4 }}>Type</div>
                  <select
                    value={questDraft.type}
                    onChange={(e) => setQuestDraft((d) => ({ ...d, type: e.target.value }))}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid rgba(0,0,0,0.18)',
                      outline: 'none',
                      fontSize: 13,
                      fontWeight: 800,
                      background: 'rgba(255,255,255,0.72)',
                      color: 'rgba(255,245,220,0.92)',
    fontFamily: "Cinzel, 'Trajan Pro', Georgia, serif",
                      lineHeight: 1.2,
                    }}
                  >
                    <option value="Main">Main</option>
                    <option value="Side">Side</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.75, marginBottom: 4 }}>Quest Giver</div>
                  <input
                    value={questDraft.giver || ''}
                    onChange={(e) => setQuestDraft((d) => ({ ...d, giver: e.target.value }))}
                    placeholder="Azdeal"
                    style={{
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
                    }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.75, marginBottom: 4 }}>Location</div>
                  <input
                    value={questDraft.location || ''}
                    onChange={(e) => setQuestDraft((d) => ({ ...d, location: e.target.value }))}
                    placeholder="Metlos"
                    style={{
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
                    }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.75, marginBottom: 4 }}>Description</div>
                  <textarea
                    value={questDraft.description}
                    onChange={(e) => setQuestDraft((d) => ({ ...d, description: e.target.value }))}
                    placeholder="Short summary or hook"
                    rows={4}
                    style={{
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
                      resize: 'none',
                      minHeight: 92,
                      maxHeight: 120,
                    }}
                  />
                </div>
              </div>

              <div style={{ padding: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <button style={smallBtn('gold')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={saveQuest}>
                  {editingQuestId ? 'Save Changes' : 'Add Quest'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========== INVENTORY MODAL ========== */}
        {invModalOpen && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 35,
              background: 'rgba(0,0,0,0.60)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setInvModalOpen(false);
            }}
          >
            <div
              style={{
                width: 'min(720px, 95vw)',
                borderRadius: 18,
                background: 'rgba(255,245,220,0.96)',
                boxShadow: '0 30px 90px rgba(0,0,0,0.65)',
                border: '1px solid rgba(0,0,0,0.12)',
                color: 'rgba(255,245,220,0.92)',
    fontFamily: "Cinzel, 'Trajan Pro', Georgia, serif",
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 'min(620px, 86vh)',
              }}
            >
              <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 950 }}>{invEditingId ? 'Edit Item' : 'Add Item'}</div>

                <button style={smallBtn('danger')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={() => setInvModalOpen(false)}>
                  Close
                </button>
              </div>

              <div style={{ height: 1, background: 'rgba(0,0,0,0.10)' }} />

              <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: 10, alignContent: 'start' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={invLabel}>Name</div>
                  <input value={invDraft.name} onChange={(e) => setInvDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Potion of Healing" style={invInput} />
                </div>

                <div>
                  <div style={invLabel}>Qty</div>
                  <input value={invDraft.qty} onChange={(e) => setInvDraft((d) => ({ ...d, qty: e.target.value }))} style={invInput} inputMode="numeric" placeholder="1" />
                </div>

                <div>
                  <div style={invLabel}>Category</div>
                  <select value={invDraft.category} onChange={(e) => setInvDraft((d) => ({ ...d, category: e.target.value }))} style={{ ...invInput, fontWeight: 800 }}>
                    {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={invLabel}>Rarity</div>
                  <select value={invDraft.rarity} onChange={(e) => setInvDraft((d) => ({ ...d, rarity: e.target.value }))} style={{ ...invInput, fontWeight: 800 }}>
                    {RARITIES.filter((r) => r !== 'All').map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={invLabel}>Value</div>
                  <input value={invDraft.value} onChange={(e) => setInvDraft((d) => ({ ...d, value: e.target.value }))} style={invInput} placeholder="optional" />
                </div>

                <div>
                  <div style={invLabel}>Weight</div>
                  <input value={invDraft.weight} onChange={(e) => setInvDraft((d) => ({ ...d, weight: e.target.value }))} style={invInput} placeholder="optional" />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={invLabel}>Assigned To</div>
                  <input value={invDraft.assignedTo} onChange={(e) => setInvDraft((d) => ({ ...d, assignedTo: e.target.value }))} style={invInput} placeholder="e.g. Fen / William / Party / Unassigned" />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={invLabel}>Tags (comma separated)</div>
                  <input value={invDraft.tags} onChange={(e) => setInvDraft((d) => ({ ...d, tags: e.target.value }))} style={invInput} placeholder="healing, potion, consumable" />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={invLabel}>Notes</div>
                  <textarea
                    value={invDraft.notes}
                    onChange={(e) => setInvDraft((d) => ({ ...d, notes: e.target.value }))}
                    rows={4}
                    style={{ ...invInput, resize: 'none', lineHeight: 1.5 }}
                    placeholder="Short description, effects, who it belongs to…"
                  />
                </div>

                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', userSelect: 'none', fontWeight: 900, opacity: 0.9 }}>
                    <input type="checkbox" checked={!!invDraft.equipped} onChange={(e) => setInvDraft((d) => ({ ...d, equipped: e.target.checked }))} />
                    Equipped
                  </label>
                </div>
              </div>

              <div style={{ padding: 12, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                {invEditingId && (
                  <button
                    style={smallBtn('ghost')}
                    onMouseEnter={smallBtnHover}
                    onMouseLeave={smallBtnLeave}
                    onClick={() => {
                      setInvModalOpen(false);
                      setInvEditingId(null);
                    }}
                  >
                    Cancel
                  </button>
                )}

                <button style={smallBtn('gold')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onClick={invSaveDraft}>
                  {invEditingId ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
