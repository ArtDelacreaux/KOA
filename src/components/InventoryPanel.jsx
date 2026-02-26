import React, { useEffect, useMemo, useState } from 'react';
import ShellLayout from './ShellLayout';
import styles from './InventoryPanel.module.css';

export default function InventoryPanel({
  panelType,
  cinematicNav,
  playClick = () => {},
  storageKey = 'koa:bagofholding:v1',
}) {
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
      <div className={`${styles.panelCard} koa-glass-card`}>
        <div className={styles.headerBar}>
          <div className={styles.headerTopRow}>
            <div className={styles.titleCluster}>
              <div className={styles.title}>Bag of Holding</div>
              <div className={styles.subtitle}>Shared Inventory</div>
            </div>

            <button
              onMouseDown={playClick}
              onClick={() => cinematicNav('menu')}
              className={`${styles.backBtn} koa-interactive-lift`}
            >
              Back to Menu
            </button>
          </div>

          <div className={styles.toolbarRow}>
            <button
              className={`koa-smallBtn koa-smallBtnGold koa-interactive-lift ${styles.btnBase} ${styles.btnGold}`}
              onMouseDown={playClick}
              onClick={openAdd}
            >
              + Add Item
            </button>

            <button
              className={`koa-smallBtn koa-interactive-lift ${styles.btnBase} ${styles.btnGhost}`}
              onMouseDown={playClick}
              onClick={() => {
                if (!confirm('Clear the entire Bag of Holding?')) return;
                setBag({ currency: { gp: 0, sp: 0, cp: 0 }, items: [] });
              }}
              title="Clears everything"
            >
              Clear Bag
            </button>

            <div className={styles.totals}>
              <span>Unique: {totals.unique}</span>
              <span>Total Qty: {totals.totalItems}</span>
              <span title="Sum of item value × qty">Total Value: {totals.totalValue}</span>
              <span title="Weight × qty (optional)">Total Weight: {Math.round(totals.totalWeight * 100) / 100}</span>
            </div>
          </div>
        </div>

        <div className={`${styles.bodyArea} koa-scrollbar-thin`}>
          <div className={`${styles.softCard} ${styles.cardBlock}`}>
            <div className={styles.sectionTitle}>Currency</div>
            <div className={styles.currencyGrid}>
              <div>
                <div className={styles.formLabel}>GP</div>
                <input value={bag.currency?.gp ?? 0} onChange={(e) => setCurrency('gp', e.target.value)} className={styles.inputBase} />
              </div>
              <div>
                <div className={styles.formLabel}>SP</div>
                <input value={bag.currency?.sp ?? 0} onChange={(e) => setCurrency('sp', e.target.value)} className={styles.inputBase} />
              </div>
              <div>
                <div className={styles.formLabel}>CP</div>
                <input value={bag.currency?.cp ?? 0} onChange={(e) => setCurrency('cp', e.target.value)} className={styles.inputBase} />
              </div>
            </div>
          </div>

          <div className={`${styles.softCard} ${styles.cardBlock}`}>
            <div className={styles.controlsGrid}>
              <div>
                <div className={styles.formLabel}>Search</div>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name, notes, tags..."
                  className={styles.inputBase}
                />
              </div>

              <div>
                <div className={styles.formLabel}>Category</div>
                <select value={cat} onChange={(e) => setCat(e.target.value)} className={styles.inputBase}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className={styles.formLabel}>Rarity</div>
                <select value={rar} onChange={(e) => setRar(e.target.value)} className={styles.inputBase}>
                  {RARITIES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className={styles.formLabel}>Sort</div>
                <select value={sort} onChange={(e) => setSort(e.target.value)} className={styles.inputBase}>
                  <option value="name">Name</option>
                  <option value="qty">Quantity</option>
                  <option value="value">Value</option>
                  <option value="updated">Recently Updated</option>
                </select>
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className={styles.softCard}>
              <div className={styles.emptyCardTitle}>Bag is empty (or your filters are spicy).</div>
              <div className={styles.emptyCardBody}>
                Click <strong>+ Add Item</strong> to stash loot. The bag saves automatically.
              </div>
            </div>
          ) : (
            <div className={styles.itemsList}>
              {filtered.map((it) => (
                <div key={it.id} className={`${styles.softCard} ${styles.itemCard}`}>
                  <div className={styles.itemTopRow}>
                    <div className={styles.itemMetaRow}>
                      <div className={styles.itemName}>{it.name}</div>

                      <span className={`${styles.pill} ${styles.categoryPill}`}>
                        {it.category || 'Misc'}
                      </span>

                      <span
                        className={`${styles.pill} ${styles.rarityPill}`}
                        style={{ background: rarityBadge(it.rarity) }}
                      >
                        {it.rarity || 'Common'}
                      </span>

                      {it.equipped ? (
                        <span className={styles.equippedPill}>
                          Equipped
                        </span>
                      ) : null}
                    </div>

                    <div className={styles.itemActions}>
                      <div className={styles.qtyLabel}>Qty: {it.qty ?? 1}</div>

                      <button
                        className={`koa-smallBtn koa-interactive-lift ${styles.btnBase} ${styles.btnGhost}`}
                        onMouseDown={playClick}
                        onClick={() => bumpQty(it.id, -1)}
                        title="-1"
                      >
                        -
                      </button>
                      <button
                        className={`koa-smallBtn koa-interactive-lift ${styles.btnBase} ${styles.btnGhost}`}
                        onMouseDown={playClick}
                        onClick={() => bumpQty(it.id, +1)}
                        title="+1"
                      >
                        +
                      </button>

                      <button
                        className={`koa-smallBtn koa-interactive-lift ${styles.btnBase} ${styles.btnGhost}`}
                        onMouseDown={playClick}
                        onClick={() => toggleEquipped(it.id)}
                        title="Toggle equipped"
                      >
                        Equip
                      </button>

                      <button
                        className={`koa-smallBtn koa-smallBtnGold koa-interactive-lift ${styles.btnBase} ${styles.btnGold}`}
                        onMouseDown={playClick}
                        onClick={() => openEdit(it)}
                        title="Edit item"
                      >
                        Edit
                      </button>

                      <button
                        className={`koa-smallBtn koa-smallBtnRed koa-interactive-lift ${styles.btnBase} ${styles.btnDanger}`}
                        onMouseDown={playClick}
                        onClick={() => deleteItem(it.id)}
                        title="Delete item"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {(it.value != null || it.weight != null) && (
                    <div className={styles.itemSecondaryRow}>
                      {it.value != null ? <span>Value: {it.value}</span> : null}
                      {it.weight != null ? <span>Weight: {it.weight}</span> : null}
                    </div>
                  )}

                  {it.notes ? (
                    <div className={styles.itemNotes}>{it.notes}</div>
                  ) : null}

                  {Array.isArray(it.tags) && it.tags.length ? (
                    <div className={styles.tagsRow}>
                      {it.tags.map((t) => (
                        <span key={t} className={styles.tagPill}>
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

        {modalOpen && (
          <div
            className={styles.modalOverlay}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setModalOpen(false);
            }}
          >
            <div className={styles.modalCard}>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitle}>{editingId ? 'Edit Item' : 'Add Item'}</div>
                <button
                  className={`koa-smallBtn koa-smallBtnRed koa-interactive-lift ${styles.btnBase} ${styles.btnDanger}`}
                  onMouseDown={playClick}
                  onClick={() => setModalOpen(false)}
                >
                  Close
                </button>
              </div>

              <div className={styles.modalDivider} />

              <div className={`${styles.modalBody} koa-scrollbar-thin`}>
                <div className={styles.spanAll}>
                  <div className={styles.formLabel}>Name</div>
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    className={styles.inputBase}
                    placeholder="e.g. Potion of Healing"
                  />
                </div>

                <div>
                  <div className={styles.formLabel}>Qty</div>
                  <input
                    value={draft.qty}
                    onChange={(e) => setDraft((d) => ({ ...d, qty: e.target.value }))}
                    className={styles.inputBase}
                    inputMode="numeric"
                    placeholder="1"
                  />
                </div>

                <div>
                  <div className={styles.formLabel}>Category</div>
                  <select
                    value={draft.category}
                    onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                    className={styles.inputBase}
                  >
                    {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className={styles.formLabel}>Rarity</div>
                  <select
                    value={draft.rarity}
                    onChange={(e) => setDraft((d) => ({ ...d, rarity: e.target.value }))}
                    className={styles.inputBase}
                  >
                    {RARITIES.filter((r) => r !== 'All').map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className={styles.formLabel}>Value</div>
                  <input
                    value={draft.value}
                    onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
                    className={styles.inputBase}
                    placeholder="optional"
                  />
                </div>

                <div>
                  <div className={styles.formLabel}>Weight</div>
                  <input
                    value={draft.weight}
                    onChange={(e) => setDraft((d) => ({ ...d, weight: e.target.value }))}
                    className={styles.inputBase}
                    placeholder="optional"
                  />
                </div>

                <div className={styles.spanAll}>
                  <div className={styles.formLabel}>Tags (comma separated)</div>
                  <input
                    value={draft.tags}
                    onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
                    className={styles.inputBase}
                    placeholder="healing, potion, consumable"
                  />
                </div>

                <div className={styles.spanAll}>
                  <div className={styles.formLabel}>Notes</div>
                  <textarea
                    value={draft.notes}
                    onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                    rows={4}
                    className={`${styles.inputBase} ${styles.textarea}`}
                    placeholder="Short description, effects, who it belongs to (if needed)..."
                  />
                </div>

                <div className={`${styles.spanAll} ${styles.equipRow}`}>
                  <label className={styles.equipLabel}>
                    <input
                      type="checkbox"
                      checked={!!draft.equipped}
                      onChange={(e) => setDraft((d) => ({ ...d, equipped: e.target.checked }))}
                    />
                    Equipped
                  </label>
                </div>
              </div>

              <div className={styles.modalFooter}>
                {editingId ? (
                  <button
                    className={`koa-smallBtn koa-interactive-lift ${styles.btnBase} ${styles.btnGhost}`}
                    onMouseDown={playClick}
                    onClick={() => {
                      setModalOpen(false);
                      setEditingId(null);
                    }}
                  >
                    Cancel
                  </button>
                ) : null}

                <button
                  className={`koa-smallBtn koa-smallBtnGold koa-interactive-lift ${styles.btnBase} ${styles.btnGold}`}
                  onMouseDown={playClick}
                  onClick={saveDraft}
                >
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
