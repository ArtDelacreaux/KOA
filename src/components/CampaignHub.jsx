import React, { useEffect, useState, useMemo } from 'react';
import ShellLayout from './ShellLayout';
import styles from './CampaignHub.module.css';

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

  const tabButtonClass = (active) =>
    `${styles.tabButton} ${active ? styles.tabButtonActive : ''}`;

  const smallBtnClass = (variant = 'gold', extraClass = '') => {
    const variantClass =
      variant === 'danger'
        ? styles.btnDanger
        : variant === 'ghost'
          ? styles.btnGhost
          : styles.btnGold;
    return `${styles.smallBtn} ${variantClass}${extraClass ? ` ${extraClass}` : ''}`;
  };

  const smallBtnHover = () => {
    playHover();
  };

  const pillClass = (type) => {
    if (type === 'Main') return `${styles.pill} ${styles.pillMain}`;
    if (type === 'Personal') return `${styles.pill} ${styles.pillPersonal}`;
    return `${styles.pill} ${styles.pillSide}`;
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
      <div className={`${styles.scrollWrap} ${styles.glassText}`}>
        <div className={styles.headerSticky}>
          <div className={styles.headerRow}>
            <button
              onClick={() => { playNav(); cinematicNav('menu'); }}
              className={smallBtnClass('ghost', styles.returnBtn)}
              onMouseEnter={smallBtnHover}
            >
              ← RETURN
            </button>

            <div className={styles.headerTitleWrap}>
              <div className={styles.headerKicker}>✦ &nbsp; THE ENVOY'S CIRCLE &nbsp; ✦</div>
              <h1 className={styles.headerTitle}>PARTY HUB</h1>
            </div>

            <div className={styles.headerSpacer} />
          </div>
          <div className={styles.headerPad} />
        </div>

        <div className={styles.bodyContent}>
          <div className={styles.actionRow}>
            {(campaignTab === 'quests' || campaignTab === 'inventory') && (
              <button
                type="button"
                onMouseEnter={smallBtnHover}
                onClick={campaignTab === 'quests' ? openAddQuest : invOpenAdd}
                className={smallBtnClass('gold', styles.actionAddBtn)}
              >
                {campaignTab === 'quests' ? '+ Add Quest' : '+ Add Item'}
              </button>
            )}
          </div>

          <div className={styles.tabRow}>
            {[
              { key: 'launcher', label: 'Hub' },
              { key: 'quests', label: 'Quest Board' },
              { key: 'inventory', label: 'Party Inventory' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onMouseEnter={smallBtnHover}
                onClick={() => setCampaignTab(key)}
                className={tabButtonClass(campaignTab === key)}
              >
                {label}
              </button>
            ))}
          </div>
          {/* ========== HUB ========== */}
          {campaignTab === 'launcher' && (
            <div className={styles.launcherGrid}>
              <div className={styles.softCard}>
                <div className={styles.cardHeaderRow}>
                  <div>
                    <div className={styles.cardTitle}>Quick Launch</div>
                    <div className={styles.cardSub}>Don't forget your character sheet!</div>
                  </div>
                  <span className={styles.playersPill}>Players</span>
                </div>

                <div className={styles.sectionDivider} />

                <div className={styles.toolGrid}>
                  <div className={styles.toolCard} onMouseEnter={() => playHover()}>
                    <div className={styles.iconRow}>
                      <div className={styles.toolIcon}>🎬</div>
                      <div>
                        <div className={styles.toolTitle}>Watch Party</div>
                        <div className={styles.toolSub}>Music / Videos / Friends</div>
                      </div>
                    </div>
                    <div className={styles.toolActions}>
                      <button className={smallBtnClass('gold')} onMouseEnter={smallBtnHover} onClick={() => openTool('watch')}>Open Room</button>
                    </div>
                  </div>

                  <div className={styles.toolCard} onMouseEnter={() => playHover()}>
                    <div className={styles.iconRow}>
                      <div className={styles.toolIcon}>🗺️</div>
                      <div>
                        <div className={styles.toolTitle}>Owlbear Table</div>
                        <div className={styles.toolSub}>Maps / tokens / encounters</div>
                      </div>
                    </div>
                    <div className={styles.toolActions}>
                      <button className={smallBtnClass('gold')} onMouseEnter={smallBtnHover} onClick={() => openTool('owlbear')}>Open Room</button>
                    </div>
                  </div>
                </div>

                <div className={`${styles.softCard} ${styles.nestedCard}`}>
                  <div className={styles.blockTitle}>Recap</div>
                  <div className={styles.blockSub}>Write what happened last session</div>
                  <textarea
                    value={launcherState.recap || ''}
                    onChange={(e) => setLauncherState((s) => ({ ...s, recap: e.target.value }))}
                    placeholder="Last time, the party…"
                    rows={5}
                    className={`${styles.inputBase} ${styles.textarea}`}
                  />
                </div>
              </div>

              <div className={styles.stackCol}>
                <div className={styles.softCard}>
                  <div className={styles.iconRow}>
                    <div className={styles.toolIcon}>⏱️</div>
                    <div>
                      <div className={styles.blockTitle}>Session Timer</div>
                      <div className={styles.blockSub}>Track how long you've been playing.</div>
                    </div>
                  </div>
                  <div className={styles.timerValue}>{fmtElapsed(launcherState.elapsedMs)}</div>
                  <div className={styles.timerActions}>
                    <button
                      className={smallBtnClass(launcherState.timerRunning ? 'danger' : 'gold')}
                      onMouseEnter={smallBtnHover}
                      onClick={() => setLauncherState((s) => ({ ...s, timerRunning: !s.timerRunning, lastTick: Date.now() }))}
                    >
                      {launcherState.timerRunning ? 'Pause' : 'Start'}
                    </button>
                    <button
                      className={smallBtnClass('danger')}
                      onMouseEnter={smallBtnHover}
                      onClick={() => setLauncherState((s) => ({ ...s, timerRunning: false, elapsedMs: 0, lastTick: Date.now() }))}
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className={styles.softCard}>
                  <div className={styles.iconRow}>
                    <div className={styles.toolIcon}>📝</div>
                    <div>
                      <div className={styles.blockTitle}>Session Notes</div>
                      <div className={styles.blockSub}>Saved locally. Great for improvised names.</div>
                    </div>
                  </div>
                  <textarea
                    value={launcherState.notes || ''}
                    onChange={(e) => setLauncherState((s) => ({ ...s, notes: e.target.value }))}
                    placeholder={`• NPC:\n• Hook:\n• Loot:\n• Reminder:`}
                    rows={10}
                    className={`${styles.inputBase} ${styles.textarea}`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========== QUEST BOARD ========== */}
          {campaignTab === 'quests' && (
            <div className={styles.questGrid}>
              <div>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionHeaderTitle}>Active Quests</div>
                  <div className={styles.sectionHeaderCount}>{activeQuests.length} active</div>
                </div>
                <div className={styles.listCol}>
                  {activeQuests.length === 0 ? (
                    <div className={`${styles.softCard} ${styles.softCardMuted}`}>
                      <div className={styles.blockTitle}>No active quests.</div>
                      <div className={styles.bodyCopy}>Hit <strong>+ Add Quest</strong> to start tracking hooks.</div>
                    </div>
                  ) : (
                    activeQuests.map((q) => (
                      <div key={q.id} className={styles.softCard} onMouseEnter={() => playHover()}>
                        <div className={styles.questRow}>
                          <div className={styles.questBody}>
                            <div className={styles.questTitleRow}>
                              <div className={styles.questTitle}>{q.title}</div>
                              <span className={pillClass(q.type)}>{q.type}</span>
                            </div>
                            {(q.giver || q.location) && (
                              <div className={styles.questMeta}>
                                {q.giver && <div><strong>Giver:</strong> {q.giver}</div>}
                                {q.location && <div><strong>Location:</strong> {q.location}</div>}
                              </div>
                            )}
                            {q.description && <div className={styles.questDesc}>{q.description}</div>}
                          </div>
                          <div className={styles.actionsRow}>
                            <button className={smallBtnClass('gold')} onMouseEnter={smallBtnHover} onClick={() => openEditQuest(q)}>Edit</button>
                            <button className={smallBtnClass('gold')} onMouseEnter={smallBtnHover} onClick={() => completeQuest(q.id)}>Complete</button>
                            <button className={smallBtnClass('danger')} onMouseEnter={smallBtnHover} onClick={() => deleteQuest(q.id)}>Delete</button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionHeaderTitle}>Completed</div>
                  <div className={styles.sectionHeaderCount}>{completedQuests.length} done</div>
                </div>
                <div className={styles.listCol}>
                  {completedQuests.length === 0 ? (
                    <div className={`${styles.softCard} ${styles.softCardMuted}`}>
                      <div className={styles.blockTitle}>Nothing completed yet.</div>
                      <div className={styles.bodyCopy}>Completed quests appear here.</div>
                    </div>
                  ) : (
                    completedQuests.map((q) => (
                      <div key={q.id} className={`${styles.softCard} ${styles.completedCard}`} onMouseEnter={() => playHover()}>
                        <div className={styles.questRow}>
                          <div className={styles.questBody}>
                            <div className={styles.questTitleRow}>
                              <div className={`${styles.questTitle} ${styles.questTitleDone}`}>{q.title}</div>
                              <span className={pillClass(q.type)}>{q.type}</span>
                            </div>
                            {(q.giver || q.location) && (
                              <div className={`${styles.questMeta} ${styles.questMetaMuted}`}>
                                {q.giver && <div><strong>Giver:</strong> {q.giver}</div>}
                                {q.location && <div><strong>Location:</strong> {q.location}</div>}
                              </div>
                            )}
                            {q.description && <div className={`${styles.questDesc} ${styles.questMetaMuted}`}>{q.description}</div>}
                          </div>
                          <div className={styles.actionsRow}>
                            <button className={smallBtnClass('gold')} onMouseEnter={smallBtnHover} onClick={() => reopenQuest(q.id)}>Reopen</button>
                            <button className={smallBtnClass('danger')} onMouseEnter={smallBtnHover} onClick={() => deleteQuest(q.id)}>Delete</button>
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
            <div className={styles.inventoryGrid}>
              <div className={styles.inventoryControls}>
                <div className={styles.softCard}>
                  <div className={styles.cardHeaderRow}>
                    <div>
                      <div className={styles.cardTitle}>Bag of Holding</div>
                      <div className={styles.cardSub}>Shared party inventory — loot, gold totals, quest items, and artifacts.</div>
                    </div>
                  </div>
                  <div className={styles.sectionDivider} />

                  <div className={styles.filtersGrid}>
                    <div>
                      <div className={styles.inputLabel}>Search</div>
                      <input value={invQuery} onChange={(e) => setInvQuery(e.target.value)} placeholder="name, notes…" className={styles.inputBase} />
                    </div>
                    <div>
                      <div className={styles.inputLabel}>Category</div>
                      <select value={invCat} onChange={(e) => setInvCat(e.target.value)} className={styles.inputBase}>
                        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className={styles.inputLabel}>Rarity</div>
                      <select value={invRar} onChange={(e) => setInvRar(e.target.value)} className={styles.inputBase}>
                        {RARITIES.map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className={styles.inputLabel}>Sort</div>
                      <select value={invSort} onChange={(e) => setInvSort(e.target.value)} className={styles.inputBase}>
                        <option value="name">Name</option>
                        <option value="qty">Quantity</option>
                        <option value="value">Value</option>
                        <option value="updated">Recently Updated</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.controlsFooter}>
                    <button className={smallBtnClass('gold', styles.addItemBtn)} onMouseEnter={smallBtnHover} onClick={invOpenAdd}>
                      + Add Item
                    </button>
                  </div>
                </div>

                <div className={`${styles.softCard} ${styles.currencyCard}`}>
                  <div className={styles.cardHeaderRow}>
                    <div>
                      <div className={styles.currencyTitle}>Currency</div>
                      <div className={styles.currencySub}>PP / GP / SP / CP</div>
                    </div>
                  </div>
                  <div className={`${styles.sectionDivider} ${styles.sectionDividerTight}`} />
                  <div className={styles.currencyGrid}>
                    {['pp', 'gp', 'sp', 'cp'].map((k) => (
                      <div key={k}>
                        <div className={styles.tinyLabel}>{k.toUpperCase()}</div>
                        <input value={bag.currency?.[k] ?? 0} onChange={(e) => invSetCurrency(k, e.target.value)} className={styles.tinyInput} />
                      </div>
                    ))}
                  </div>
                  <div className={styles.currencyDanger}>
                    <button className={smallBtnClass('ghost', styles.fullWidthBtn)} onMouseEnter={smallBtnHover} onClick={() => setDangerOpen((v) => !v)}>
                      {dangerOpen ? 'Hide Danger' : 'Danger Zone'}
                    </button>
                    {dangerOpen && (
                      <div className={styles.dangerBox}>
                        <div className={styles.dangerTitle}>Clear Bag</div>
                        <div className={styles.dangerBody}>This removes <strong>all</strong> items and currency.</div>
                        <button
                          className={smallBtnClass('danger', styles.fullWidthBtn)}
                          onMouseEnter={smallBtnHover}
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

              {invFilteredItems.length === 0 ? (
                <div className={`${styles.softCard} ${styles.inventoryEmpty}`}>
                  <div className={styles.inventoryEmptyTitle}>Bag is empty.</div>
                  <div className={styles.bodyCopy}>Hit <strong>+ Add Item</strong> to start tracking loot.</div>
                </div>
              ) : (
                <div className={styles.listCol}>
                  {invFilteredItems.map((it) => (
                    <div
                      key={it.id}
                      className={`${styles.softCard} ${styles.inventoryItemCard}`}
                      style={{ '--ch-rarity-bg': rarityBadge(it.rarity) }}
                      onMouseEnter={() => playHover()}
                    >
                      <div className={styles.questRow}>
                        <div className={styles.itemBody}>
                          <div className={styles.questTitleRow}>
                            <div className={styles.itemTitle}>{it.name}</div>
                            {it.equipped && <span className={`${styles.pill} ${styles.pillMain} ${styles.pillTiny}`}>Equipped</span>}
                            <span className={styles.itemMetaInline}>{it.rarity} · {it.category}</span>
                          </div>
                          {it.notes && <div className={styles.itemNotes}>{it.notes}</div>}
                          <div className={styles.itemStats}>
                            {it.assignedTo && <span>👤 {it.assignedTo}</span>}
                            {it.value != null && <span>💰 {it.value} gp</span>}
                            {it.weight != null && <span>⚖️ {it.weight} lb</span>}
                          </div>
                        </div>
                        <div className={styles.actionsRow}>
                          <span className={styles.qtyBadge}>×{it.qty ?? 1}</span>
                          <button className={smallBtnClass('ghost')} onMouseEnter={smallBtnHover} onClick={() => invBumpQty(it.id, -1)} title="-1">−</button>
                          <button className={smallBtnClass('ghost')} onMouseEnter={smallBtnHover} onClick={() => invBumpQty(it.id, +1)} title="+1">+</button>
                          <button className={smallBtnClass('ghost')} onMouseEnter={smallBtnHover} onClick={() => invToggleEquipped(it.id)}>Equip</button>
                          <button className={smallBtnClass('gold')} onMouseEnter={smallBtnHover} onClick={() => invOpenEdit(it)}>Edit</button>
                          <button className={smallBtnClass('danger')} onMouseEnter={smallBtnHover} onClick={() => invDeleteItem(it.id)}>Delete</button>
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
          <div
            className={styles.modalOverlay}
            onMouseDown={(e) => { if (e.target === e.currentTarget) setQuestModalOpen(false); }}
          >
            <div className={`${styles.modalCard} ${styles.questModal}`}>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitle}>{editingQuestId ? 'Edit Quest' : 'Add Quest'}</div>
                <button className={smallBtnClass('danger')} onMouseEnter={smallBtnHover} onClick={() => setQuestModalOpen(false)}>Close</button>
              </div>
              <div className={styles.sectionDivider} />
              <div className={styles.modalBody}>
                {[['Title *', 'title', 'text', 'e.g. Find Allies for the Kingdom of Avalon'], ['Quest Giver', 'giver', 'text', 'e.g. Bartrem'], ['Location', 'location', 'text', 'e.g. Qonza']].map(([lbl, key, type, ph]) => (
                  <div key={key}>
                    <div className={styles.inputLabel}>{lbl}</div>
                    <input type={type} value={questDraft[key] || ''} onChange={(e) => setQuestDraft((d) => ({ ...d, [key]: e.target.value }))} placeholder={ph} className={styles.inputBase} />
                  </div>
                ))}
                <div>
                  <div className={styles.inputLabel}>Type</div>
                  <select value={questDraft.type || 'Side'} onChange={(e) => setQuestDraft((d) => ({ ...d, type: e.target.value }))} className={styles.inputBase}>
                    {['Main', 'Side', 'Personal'].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <div className={styles.inputLabel}>Description</div>
                  <textarea value={questDraft.description || ''} onChange={(e) => setQuestDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Who do we need to rob?" rows={4} className={`${styles.inputBase} ${styles.textarea} ${styles.noResize}`} />
                </div>
              </div>
              <div className={styles.sectionDivider} />
              <div className={styles.modalFooter}>
                <button className={smallBtnClass('ghost')} onMouseEnter={smallBtnHover} onClick={() => setQuestModalOpen(false)}>Cancel</button>
                <button className={smallBtnClass('gold')} onMouseEnter={smallBtnHover} onClick={saveQuest}>{editingQuestId ? 'Save Changes' : 'Add Quest'}</button>
              </div>
            </div>
          </div>
        )}

        {/* ========== INVENTORY MODAL ========== */}
        {invModalOpen && (
          <div
            className={`${styles.modalOverlay} ${styles.modalOverlayTop}`}
            onMouseDown={(e) => { if (e.target === e.currentTarget) setInvModalOpen(false); }}
          >
            <div className={`${styles.modalCard} ${styles.inventoryModal}`}>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitle}>{invEditingId ? 'Edit Item' : 'Add Item'}</div>
                <button className={smallBtnClass('danger')} onMouseEnter={smallBtnHover} onClick={() => setInvModalOpen(false)}>Close</button>
              </div>
              <div className={styles.sectionDivider} />
              <div className={styles.inventoryModalBody}>
                <div className={styles.fullCol}>
                  <div className={styles.inputLabel}>Name</div>
                  <input value={invDraft.name} onChange={(e) => setInvDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Longsword +1" className={styles.inputBase} />
                </div>
                <div>
                  <div className={styles.inputLabel}>Category</div>
                  <select value={invDraft.category} onChange={(e) => setInvDraft((d) => ({ ...d, category: e.target.value }))} className={styles.inputBase}>
                    {CATEGORIES.filter((c) => c !== 'All').map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <div className={styles.inputLabel}>Rarity</div>
                  <select value={invDraft.rarity} onChange={(e) => setInvDraft((d) => ({ ...d, rarity: e.target.value }))} className={styles.inputBase}>
                    {RARITIES.filter((r) => r !== 'All').map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <div className={styles.inputLabel}>Qty</div>
                  <input type="number" min={1} max={9999} value={invDraft.qty} onChange={(e) => setInvDraft((d) => ({ ...d, qty: e.target.value }))} className={styles.inputBase} />
                </div>
                <div>
                  <div className={styles.inputLabel}>Value (gp)</div>
                  <input type="number" min={0} value={invDraft.value} onChange={(e) => setInvDraft((d) => ({ ...d, value: e.target.value }))} placeholder="0" className={styles.inputBase} />
                </div>
                <div>
                  <div className={styles.inputLabel}>Weight (lb)</div>
                  <input type="number" min={0} value={invDraft.weight} onChange={(e) => setInvDraft((d) => ({ ...d, weight: e.target.value }))} placeholder="0" className={styles.inputBase} />
                </div>
                <div>
                  <div className={styles.inputLabel}>Assigned To</div>
                  <input value={invDraft.assignedTo} onChange={(e) => setInvDraft((d) => ({ ...d, assignedTo: e.target.value }))} placeholder="Player name" className={styles.inputBase} />
                </div>
                <div className={styles.fullCol}>
                  <div className={styles.inputLabel}>Notes</div>
                  <textarea value={invDraft.notes} onChange={(e) => setInvDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Description, effects, flavor text…" rows={3} className={`${styles.inputBase} ${styles.textarea} ${styles.noResize}`} />
                </div>
                <div className={styles.fullCol}>
                  <div className={styles.inputLabel}>Tags (comma-separated)</div>
                  <input value={invDraft.tags} onChange={(e) => setInvDraft((d) => ({ ...d, tags: e.target.value }))} placeholder="magic, cursed, party-loot" className={styles.inputBase} />
                </div>
                <div className={styles.fullCol}>
                  <div className={styles.checkboxRow}>
                    <input type="checkbox" id="inv-equipped" checked={!!invDraft.equipped} onChange={(e) => setInvDraft((d) => ({ ...d, equipped: e.target.checked }))} />
                    <label htmlFor="inv-equipped" className={styles.checkboxLabel}>Equipped</label>
                  </div>
                </div>
              </div>
              <div className={styles.sectionDivider} />
              <div className={styles.modalFooter}>
                <button className={smallBtnClass('ghost')} onMouseEnter={smallBtnHover} onClick={() => setInvModalOpen(false)}>Cancel</button>
                <button className={smallBtnClass('gold')} onMouseEnter={smallBtnHover} onClick={invSaveDraft}>{invEditingId ? 'Save Changes' : 'Add Item'}</button>
              </div>
            </div>
          </div>
        )}

      </div>{/* end scrollable wrapper */}
    </ShellLayout>
  );
}
