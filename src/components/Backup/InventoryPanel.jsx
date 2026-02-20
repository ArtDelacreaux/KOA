import React, { useEffect, useMemo, useState } from 'react';
import ShellLayout from './ShellLayout';

export default function InventoryPanel({
  panelType,
  cinematicNav,

  playClick = () => {},

  // Optional: you can override these if you want
  storageKey = 'koa:bagofholding:v1',
}) {
  /* ---------------- panel wrapper ---------------- */

  /* ---------------- styles ---------------- */
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
    margin: 0,
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

  const cardShell = (bg = 'rgba(10, 8, 6, 0.70)', fg = 'rgba(255,245,220,0.95)') => ({
    width: 'min(1100px, 94vw)',
    height: 'min(760px, 86vh)',
    borderRadius: 18,
    background: bg,
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
    color: 'rgba(255,245,220,0.95)',
    background: 'linear-gradient(180deg, rgba(20,16,12,0.72), rgba(12,10,8,0.62))',
    backdropFilter: 'blur(8px)',
    borderBottom: '1px solid rgba(255,220,160,0.12)',
    boxShadow: '0 10px 18px rgba(0,0,0,0.22)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  };

  const bodyArea = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 110,
    bottom: 0,
    padding: 14,
    overflow: 'auto',
  };

  const softCard = {
    padding: 14,
    borderRadius: 16,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,220,160,0.10)',
    boxShadow: '0 10px 18px rgba(0,0,0,0.22)',
  };

  const smallBtn = (variant = 'gold') => {
    const base = {
      padding: '8px 10px',
      borderRadius: 12,
      border: '1px solid rgba(255,220,160,0.18)',
      cursor: 'pointer',
      fontWeight: 900,
      fontSize: 12,
      letterSpacing: 0.2,
      transition: 'transform 140ms ease, box-shadow 140ms ease, filter 140ms ease',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      background: 'rgba(255,255,255,0.10)',
      color: 'rgba(255,245,220,0.96)',
    };

    if (variant === 'gold') {
      return {
        ...base,
        background: 'linear-gradient(180deg, rgba(176,101,0,0.86), rgba(122,55,0,0.90))',
        border: '1px solid rgba(255,220,160,0.22)',
        boxShadow: '0 12px 26px rgba(0,0,0,0.35)',
        textShadow: '0 2px 8px rgba(0,0,0,0.55)',
      };
    }
    if (variant === 'danger') {
      return {
        ...base,
        background: 'linear-gradient(180deg, rgba(122,30,30,0.92), rgba(90,18,18,0.92))',
        border: '1px solid rgba(255,160,160,0.22)',
        boxShadow: '0 12px 26px rgba(0,0,0,0.35)',
        textShadow: '0 2px 8px rgba(0,0,0,0.55)',
      };
    }
    if (variant === 'ghost') {
      return {
        ...base,
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,220,160,0.16)',
        boxShadow: 'none',
      };
    }
    return base;
  };

  const smallBtnHover = (e) => {
    e.currentTarget.style.transform = 'translateY(-1px)';
    e.currentTarget.style.filter = 'brightness(1.06)';
    e.currentTarget.style.boxShadow = '0 16px 34px rgba(0,0,0,0.40)';
  };

  const smallBtnLeave = (e) => {
    e.currentTarget.style.transform = 'translateY(0px)';
    e.currentTarget.style.filter = 'none';
  };

  const inputBase = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,220,160,0.18)',
    outline: 'none',
    fontSize: 13,
    background: 'rgba(0,0,0,0.28)',
    color: 'rgba(255,245,220,0.95)',
  };

  const label = { fontSize: 11, fontWeight: 900, opacity: 0.8, marginBottom: 6, letterSpacing: 0.4 };

  /* ---------------- helpers ---------------- */
  const clampInt = (n, min, max) => Math.max(min, Math.min(max, n));
  const newId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const CATEGORIES = ['All', 'Weapon', 'Armor', 'Gear', 'Consumable', 'Loot', 'Quest', 'Magic', 'Misc'];
  const RARITIES = ['All', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

  const rarityBadge = (rarity) => {
    const r = (rarity || 'Common').toLowerCase();
    const map = {
      common: 'rgba(255,255,255,0.12)',
      uncommon: 'rgba(110,231,183,0.16)',
      rare: 'rgba(96,165,250,0.16)',
      epic: 'rgba(216,180,254,0.16)',
      legendary: 'rgba(251,191,36,0.18)',
    };
    return map[r] || map.common;
  };

  /* ---------------- load/save ---------------- */
  const [bag, setBag] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        return {
          currency: { gp: 0, sp: 0, cp: 0 },
          items: [],
        };
      }
      const parsed = JSON.parse(raw);
      return {
        currency: parsed?.currency || { gp: 0, sp: 0, cp: 0 },
        items: Array.isArray(parsed?.items) ? parsed.items : [],
      };
    } catch {
      return { currency: { gp: 0, sp: 0, cp: 0 }, items: [] };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(bag));
    } catch {}
  }, [bag, storageKey]);

  /* ---------------- UI state ---------------- */
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');
  const [rar, setRar] = useState('All');
  const [sort, setSort] = useState('name'); // name | qty | value | updated
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const emptyDraft = {
    name: '',
    qty: 1,
    category: 'Gear',
    rarity: 'Common',
    weight: '',
    value: '',
    notes: '',
    tags: '',
    equipped: false,
  };
  const [draft, setDraft] = useState(emptyDraft);

  const openAdd = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setDraft({
      name: item.name || '',
      qty: typeof item.qty === 'number' ? item.qty : 1,
      category: item.category || 'Gear',
      rarity: item.rarity || 'Common',
      weight: item.weight ?? '',
      value: item.value ?? '',
      notes: item.notes || '',
      tags: Array.isArray(item.tags) ? item.tags.join(', ') : '',
      equipped: !!item.equipped,
    });
    setModalOpen(true);
  };

  const saveDraft = () => {
    const name = (draft.name || '').trim();
    if (!name) {
      alert('Item needs a name.');
      return;
    }

    const qty = clampInt(parseInt(draft.qty, 10) || 1, 1, 9999);
    const weight = draft.weight === '' ? null : Number(draft.weight);
    const value = draft.value === '' ? null : Number(draft.value);

    const tags = (draft.tags || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const now = new Date().toISOString();

    setBag((prev) => {
      const items = prev.items || [];
      if (!editingId) {
        const item = {
          id: newId(),
          name,
          qty,
          category: draft.category || 'Gear',
          rarity: draft.rarity || 'Common',
          weight: Number.isFinite(weight) ? weight : null,
          value: Number.isFinite(value) ? value : null,
          notes: (draft.notes || '').trim(),
          tags,
          equipped: !!draft.equipped,
          createdAt: now,
          updatedAt: now,
        };
        return { ...prev, items: [item, ...items] };
      }

      return {
        ...prev,
        items: items.map((it) =>
          it.id === editingId
            ? {
                ...it,
                name,
                qty,
                category: draft.category || it.category || 'Gear',
                rarity: draft.rarity || it.rarity || 'Common',
                weight: Number.isFinite(weight) ? weight : null,
                value: Number.isFinite(value) ? value : null,
                notes: (draft.notes || '').trim(),
                tags,
                equipped: !!draft.equipped,
                updatedAt: now,
              }
            : it
        ),
      };
    });

    setModalOpen(false);
    setEditingId(null);
  };

  const deleteItem = (id) => {
    if (!confirm('Delete this item?')) return;
    setBag((prev) => ({ ...prev, items: (prev.items || []).filter((it) => it.id !== id) }));
  };

  const bumpQty = (id, delta) => {
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

  const toggleEquipped = (id) => {
    setBag((prev) => {
      const now = new Date().toISOString();
      const items = (prev.items || []).map((it) => (it.id === id ? { ...it, equipped: !it.equipped, updatedAt: now } : it));
      return { ...prev, items };
    });
  };

  const setCurrency = (key, value) => {
    setBag((prev) => ({
      ...prev,
      currency: {
        ...(prev.currency || { gp: 0, sp: 0, cp: 0 }),
        [key]: clampInt(parseInt(value, 10) || 0, 0, 9999999),
      },
    }));
  };

  /* ---------------- derived ---------------- */
  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    let items = [...(bag.items || [])];

    if (cat !== 'All') items = items.filter((it) => (it.category || '') === cat);
    if (rar !== 'All') items = items.filter((it) => (it.rarity || '') === rar);

    if (q) {
      items = items.filter((it) => {
        const hay = `${it.name || ''} ${(it.notes || '')} ${(it.category || '')} ${(it.rarity || '')} ${(it.tags || []).join(' ')}`.toLowerCase();
        return hay.includes(q);
      });
    }

    items.sort((a, b) => {
      if (sort === 'qty') return (b.qty || 0) - (a.qty || 0);
      if (sort === 'value') return (Number(b.value) || 0) - (Number(a.value) || 0);
      if (sort === 'updated') return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      return (a.name || '').localeCompare(b.name || '');
    });

    return items;
  }, [bag.items, query, cat, rar, sort]);

  const totals = useMemo(() => {
    const items = bag.items || [];
    const totalItems = items.reduce((sum, it) => sum + (it.qty || 0), 0);
    const unique = items.length;
    const totalValue = items.reduce((sum, it) => sum + (Number(it.value) || 0) * (it.qty || 1), 0);
    const totalWeight = items.reduce((sum, it) => sum + (Number(it.weight) || 0) * (it.qty || 1), 0);
    return { totalItems, unique, totalValue, totalWeight };
  }, [bag.items]);

  /* ---------------- render ---------------- */
  const isActive = panelType === 'inventory';

  return (
    <ShellLayout active={isActive}>
      <div style={cardShell()}>
        <div style={headerBar}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 26, fontWeight: 950, lineHeight: 1 }}>Bag of Holding</div>
              <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 900, letterSpacing: 1.2, textTransform: 'uppercase' }}>Shared Inventory</div>
            </div>

            <button
              data-kind="back"
              style={backButton}
              onMouseEnter={buttonHover}
              onMouseLeave={buttonLeave}
              onMouseDown={playClick}
              onClick={() => cinematicNav('menu')}
            >
              Back to Menu
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button style={smallBtn('gold')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onMouseDown={playClick} onClick={openAdd}>
              + Add Item
            </button>

            <button
              style={smallBtn('ghost')}
              onMouseEnter={smallBtnHover}
              onMouseLeave={smallBtnLeave}
              onMouseDown={playClick}
              onClick={() => {
                if (!confirm('Clear the entire Bag of Holding?')) return;
                setBag({ currency: { gp: 0, sp: 0, cp: 0 }, items: [] });
              }}
              title="Clears everything"
            >
              Clear Bag
            </button>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap', opacity: 0.9, fontWeight: 900, fontSize: 12 }}>
              <span>Unique: {totals.unique}</span>
              <span>Total Qty: {totals.totalItems}</span>
              <span title="Sum of item value × qty">Total Value: {totals.totalValue}</span>
              <span title="Weight × qty (optional)">Total Weight: {Math.round(totals.totalWeight * 100) / 100}</span>
            </div>
          </div>
        </div>

        <div style={bodyArea}>
          {/* Currency */}
          <div style={{ ...softCard, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 950, marginBottom: 10 }}>Currency</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              <div>
                <div style={label}>GP</div>
                <input value={bag.currency?.gp ?? 0} onChange={(e) => setCurrency('gp', e.target.value)} style={inputBase} />
              </div>
              <div>
                <div style={label}>SP</div>
                <input value={bag.currency?.sp ?? 0} onChange={(e) => setCurrency('sp', e.target.value)} style={inputBase} />
              </div>
              <div>
                <div style={label}>CP</div>
                <input value={bag.currency?.cp ?? 0} onChange={(e) => setCurrency('cp', e.target.value)} style={inputBase} />
              </div>
            </div>
          </div>

          {/* Controls */}
          <div style={{ ...softCard, marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.8fr 0.8fr', gap: 10, alignItems: 'end' }}>
              <div>
                <div style={label}>Search</div>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, notes, tags…" style={inputBase} />
              </div>

              <div>
                <div style={label}>Category</div>
                <select value={cat} onChange={(e) => setCat(e.target.value)} style={inputBase}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} style={{ color: '#111' }}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={label}>Rarity</div>
                <select value={rar} onChange={(e) => setRar(e.target.value)} style={inputBase}>
                  {RARITIES.map((r) => (
                    <option key={r} value={r} style={{ color: '#111' }}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={label}>Sort</div>
                <select value={sort} onChange={(e) => setSort(e.target.value)} style={inputBase}>
                  <option value="name" style={{ color: '#111' }}>
                    Name
                  </option>
                  <option value="qty" style={{ color: '#111' }}>
                    Quantity
                  </option>
                  <option value="value" style={{ color: '#111' }}>
                    Value
                  </option>
                  <option value="updated" style={{ color: '#111' }}>
                    Recently Updated
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* Items */}
          {filtered.length === 0 ? (
            <div style={softCard}>
              <div style={{ fontWeight: 950, marginBottom: 6 }}>Bag is empty (or your filters are spicy).</div>
              <div style={{ opacity: 0.9, lineHeight: 1.6 }}>
                Click <strong>+ Add Item</strong> to stash loot. The bag saves automatically.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map((it) => (
                <div key={it.id} style={softCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 16, fontWeight: 950 }}>{it.name}</div>

                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 900,
                          padding: '4px 8px',
                          borderRadius: 999,
                          background: 'rgba(255,255,255,0.08)',
                          border: '1px solid rgba(255,220,160,0.14)',
                          opacity: 0.95,
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
                          border: '1px solid rgba(255,220,160,0.12)',
                          opacity: 0.95,
                        }}
                      >
                        {it.rarity || 'Common'}
                      </span>

                      {it.equipped ? (
                        <span style={{ fontSize: 11, fontWeight: 950, opacity: 0.9, border: '1px solid rgba(110,231,183,0.22)', padding: '4px 8px', borderRadius: 999 }}>
                          Equipped
                        </span>
                      ) : null}
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 950, opacity: 0.92 }}>Qty: {it.qty ?? 1}</div>

                      <button style={smallBtn('ghost')} onMouseDown={playClick} onClick={() => bumpQty(it.id, -1)} title="-1">
                        −
                      </button>
                      <button style={smallBtn('ghost')} onMouseDown={playClick} onClick={() => bumpQty(it.id, +1)} title="+1">
                        +
                      </button>

                      <button style={smallBtn('ghost')} onMouseDown={playClick} onClick={() => toggleEquipped(it.id)} title="Toggle equipped">
                        Equip
                      </button>

                      <button style={smallBtn('gold')} onMouseDown={playClick} onClick={() => openEdit(it)} title="Edit item">
                        Edit
                      </button>

                      <button style={smallBtn('danger')} onMouseDown={playClick} onClick={() => deleteItem(it.id)} title="Delete item">
                        Delete
                      </button>
                    </div>
                  </div>

                  {(it.value != null || it.weight != null) && (
                    <div style={{ marginTop: 8, opacity: 0.88, fontSize: 12, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      {it.value != null ? <span>Value: {it.value}</span> : null}
                      {it.weight != null ? <span>Weight: {it.weight}</span> : null}
                    </div>
                  )}

                  {it.notes ? (
                    <div style={{ marginTop: 8, opacity: 0.92, lineHeight: 1.55 }}>{it.notes}</div>
                  ) : null}

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
                            background: 'rgba(0,0,0,0.20)',
                            border: '1px solid rgba(255,220,160,0.10)',
                            opacity: 0.9,
                          }}
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal */}
        {modalOpen && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 40,
              background: 'rgba(0,0,0,0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setModalOpen(false);
            }}
          >
            <div
              style={{
                width: 'min(720px, 95vw)',
                borderRadius: 18,
                background: 'rgba(14, 10, 7, 0.92)',
                border: '1px solid rgba(255,220,160,0.14)',
                boxShadow: '0 30px 90px rgba(0,0,0,0.70)',
                color: 'rgba(255,245,220,0.95)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 'min(650px, 88vh)',
              }}
            >
              <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 950 }}>{editingId ? 'Edit Item' : 'Add Item'}</div>
                <button
                  style={smallBtn('danger')}
                  onMouseEnter={smallBtnHover}
                  onMouseLeave={smallBtnLeave}
                  onMouseDown={playClick}
                  onClick={() => setModalOpen(false)}
                >
                  Close
                </button>
              </div>

              <div style={{ height: 1, background: 'rgba(255,220,160,0.12)' }} />

              <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: 10, alignContent: 'start' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={label}>Name</div>
                  <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} style={inputBase} placeholder="e.g. Potion of Healing" />
                </div>

                <div>
                  <div style={label}>Qty</div>
                  <input
                    value={draft.qty}
                    onChange={(e) => setDraft((d) => ({ ...d, qty: e.target.value }))}
                    style={inputBase}
                    inputMode="numeric"
                    placeholder="1"
                  />
                </div>

                <div>
                  <div style={label}>Category</div>
                  <select value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} style={inputBase}>
                    {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c} style={{ color: '#111' }}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={label}>Rarity</div>
                  <select value={draft.rarity} onChange={(e) => setDraft((d) => ({ ...d, rarity: e.target.value }))} style={inputBase}>
                    {RARITIES.filter((r) => r !== 'All').map((r) => (
                      <option key={r} value={r} style={{ color: '#111' }}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={label}>Value</div>
                  <input value={draft.value} onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))} style={inputBase} placeholder="optional" />
                </div>

                <div>
                  <div style={label}>Weight</div>
                  <input value={draft.weight} onChange={(e) => setDraft((d) => ({ ...d, weight: e.target.value }))} style={inputBase} placeholder="optional" />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={label}>Tags (comma separated)</div>
                  <input value={draft.tags} onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))} style={inputBase} placeholder="healing, potion, consumable" />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={label}>Notes</div>
                  <textarea
                    value={draft.notes}
                    onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                    rows={4}
                    style={{ ...inputBase, resize: 'none', lineHeight: 1.5 }}
                    placeholder="Short description, effects, who it belongs to (if needed)…"
                  />
                </div>

                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', userSelect: 'none', fontWeight: 900, opacity: 0.9 }}>
                    <input
                      type="checkbox"
                      checked={!!draft.equipped}
                      onChange={(e) => setDraft((d) => ({ ...d, equipped: e.target.checked }))}
                    />
                    Equipped
                  </label>
                </div>
              </div>

              <div style={{ padding: 12, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                {editingId ? (
                  <button
                    style={smallBtn('ghost')}
                    onMouseEnter={smallBtnHover}
                    onMouseLeave={smallBtnLeave}
                    onMouseDown={playClick}
                    onClick={() => {
                      setModalOpen(false);
                      setEditingId(null);
                    }}
                  >
                    Cancel
                  </button>
                ) : null}

                <button style={smallBtn('gold')} onMouseEnter={smallBtnHover} onMouseLeave={smallBtnLeave} onMouseDown={playClick} onClick={saveDraft}>
                  {editingId ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ShellLayout>
  );
}
