import React, { useEffect, useRef, useState } from 'react';
import styles from './WorldLore.module.css';

/*
  WorldLore — Knights of Atria
  Overworld knowledge center with:
  - Intro video player
  - Tabbed image gallery (Maps, Scenes, Locations)
  - Lightbox on card click
  - Matches existing KOA tavern palette and panel system
*/

const TABS = [
  { id: 'maps', label: 'Maps', icon: '🗺️' },
  { id: 'scenes', label: 'Scenes', icon: '🎨' },
  { id: 'locations', label: 'Locations', icon: '🏰' },
  { id: 'factions', label: 'Factions', icon: '⚜️' },
];

/*
  ── HOW TO ADD YOUR IMAGES ──
  Each entry has: title, src (image path/URL), description
  Example:
    { id: 1, title: 'The Known World', src: worldMapImg, description: '...' }
  Import your images at the top of this file like:
    import worldMapImg from '../assets/lore/world-map.jpg';
*/
const GALLERY = {
  maps: [
    { id: 1, title: 'The Continent of Atria', src: 'lore/world-map.jpg', description: 'Full overworld map of the campaign setting.' },
    { id: 2, title: 'The Shattered Canyon', src: 'lore/canyon.jpg', description: 'Detailed map of the Shattered Canyon.' },
  ],
  scenes: [
    { id: 1, title: 'The Well', src: 'lore/Well.jpg', description: 'Where tensions ran high.' },
    { id: 2, title: 'Underground Ryken Church', src: 'lore/rchurch.jpg', description: 'The underground church below Avalon.' },
  ],
  locations: [
    {
      id: 1,
      title: 'The City of Qonza',
      src: 'lore/Qonza.webp',
      description: 'Crescent moon city with a cruel justice system.',
      summary: 'Qonza thrives on strict order, wealth, and carefully guarded status. Most power flows through courts, contracts, and those who can afford both.',
      region: 'Southern Trade Crescent',
      governance: 'Magistrate houses and legal guild councils',
      economy: 'Contract law, caravan tolls, and luxury trade',
      tensions: 'Class unrest, selective justice, and border corruption',
    },
    {
      id: 2,
      title: 'The City of Williwack',
      src: 'lore/Williwack.jpg',
      description: 'A desert kingdom that borders the World Spear.',
      summary: 'Williwack stands where scorched routes meet mountain shadow. Survival forged a proud city-state known for discipline and resource control.',
      region: 'Western Desert Verge',
      governance: 'Crown-appointed stewards with military oversight',
      economy: 'Water rights, glasswork, and spear-route caravans',
      tensions: 'Border skirmishes and drought-year rationing',
    },
    {
      id: 3,
      title: 'The City of Avalon',
      src: 'lore/avalonsky.jpg',
      description: 'Overview of the Center Kingdom.',
      summary: 'Avalon is a political and religious center where noble influence and temple authority constantly negotiate for control.',
      region: 'Central Kingdom',
      governance: 'Crown administration with temple arbitration',
      economy: 'State levies, artisan districts, and temple patronage',
      tensions: 'Court intrigue, church pressure, and urban crime',
    },
    {
      id: 4,
      title: 'The City of Metlos',
      src: 'lore/Metlos.jpg',
      description: 'Overview of Metlos.',
      summary: 'Metlos is a fortified industrial city known for foundries, military supply chains, and a ruthless approach to efficiency.',
      region: 'Ironward Basin',
      governance: 'Militia council with merchant bloc influence',
      economy: 'Steelworks, siege craft, and contract labor',
      tensions: 'Labor strikes and black-market weapons',
    },
    {
      id: 5,
      title: 'The Village of Orum',
      src: 'lore/orum.png',
      description: 'Overview of Orum.',
      summary: 'Orum is a small but stubborn settlement that survives by community pacts, hidden trails, and local herbal trade.',
      region: 'Greenhollow Reach',
      governance: 'Elder circle and rotating wardens',
      economy: 'Herbs, timber, and river ferries',
      tensions: 'Bandit pressure and crop blight seasons',
    },
    {
      id: 6,
      title: 'The City of Buston',
      src: 'lore/Buston.jpg',
      description: 'Overview of Buston.',
      summary: 'Buston sits on key roads and acts as a noisy commercial hinge between noble capitals and frontier outposts.',
      region: 'Northroad Junction',
      governance: 'Chartered city council',
      economy: 'Transit tariffs, inns, and warehousing',
      tensions: 'Guild turf wars and smuggling rings',
    },
    {
      id: 7,
      title: 'The Village of SkulPol',
      src: 'lore/skolpol.jpg',
      description: 'Overview of SkulPol.',
      summary: 'SkulPol is remote, weathered, and deeply superstitious, with locals who trust memory more than maps.',
      region: 'Fogline Hills',
      governance: 'Clan heads and shrine keepers',
      economy: 'Hunting, salvage, and seasonal trade',
      tensions: 'Disappearing travelers and old-feud violence',
    },
  ],
  factions: [
    {
      id: 1,
      title: 'The Velvet Rose',
      src: 'lore/world-map.jpg',
      description: 'Influence network built through charm, debt, and social leverage.',
      summary: 'The Velvet Rose moves quietly through salons, courts, and private ledgers. They avoid open war and prefer leverage no one can prove.',
      influence: 'Courts, noble estates, and merchant finance',
      doctrine: 'Control what people owe, and they become predictable',
      factionKeys: ['velvet rose',],
      memberHints: ['Tarzos Spicer'],
    },
    {
      id: 2,
      title: 'The Red Fang',
      src: 'lore/canyon.jpg',
      description: 'Militant front-line brotherhood tied to blood-oaths and conquest.',
      summary: 'The Red Fang values strength, retaliation, and public fear. They recruit from battle survivors and enforce loyalty through ritual debt.',
      influence: 'Border forts, mercenary cells, and raider routes',
      doctrine: 'Mercy is a weakness your enemy exploits',
      factionKeys: ['red fang'],
      memberHints: ['Cerci VonDonovon'],
    },
    {
      id: 3,
      title: 'Church of Ryken',
      src: 'lore/rykenf.webp',
      description: 'Devotional branches loyal to Ryken doctrine and shadow pacts.',
      summary: 'Ryken followers split between public worship and hidden circles. Their theology attracts both desperate believers and ruthless opportunists.',
      influence: 'Shrines, hidden temples, and oath-brokers',
      doctrine: 'Faith and consequence are inseparable',
      factionKeys: ['ryken church', 'church of ryken', 'ryken'],
      memberHints: ['Ryken', 'William Spicer'],
    },
  ],
};

/*
  ── HOW TO SET YOUR INTRO VIDEO ──
  Import your video at the top:
    import introVideo from '../assets/lore/world-intro.mp4';
  Then set: const VIDEO_SRC = introVideo;
*/
const VIDEO_SRC = '';
const LS_WORLD_NPCS = 'koa:worldnpcs:v1';
const LS_WORLD_NPC_DEEPLINK = 'koa:worldnpcs:deeplink:v1';
const LS_CHAR_NPCS = 'koa:char:npcs:v1';

// ─── Sub-components ────────────────────────────────────────────────────────────
function CornerOrns() {
  return (
    <>
      <div className={`${styles.cornerOrn} ${styles.cornerTopLeft}`} />
      <div className={`${styles.cornerOrn} ${styles.cornerTopRight}`} />
      <div className={`${styles.cornerOrn} ${styles.cornerBottomLeft}`} />
      <div className={`${styles.cornerOrn} ${styles.cornerBottomRight}`} />
    </>
  );
}

function SectionDivider({ label }) {
  return (
    <div className={styles.sectionDividerRow}>
      <div className={`koa-divider-line ${styles.sectionDividerLine}`} />
      <span className={styles.sectionDividerLabel}>◈ &nbsp;{label}&nbsp; ◈</span>
      <div className={`koa-divider-line ${styles.sectionDividerLine}`} />
    </div>
  );
}



function ImageCard({ item, onClick }) {
  // Allow per-card preview control:
  // item.pos: 'center top' etc
  // item.fit: 'cover' or 'contain'
  const pos = item.pos || 'center';
  const fit = item.fit || 'cover';
  const mediaVars = item.src
    ? {
      '--wl-image-url': `url(${item.src})`,
      '--wl-image-pos': pos,
      '--wl-image-fit': fit,
    }
    : undefined;

  return (
    <div
      onClick={() => onClick(item)}
      className={styles.imageCard}
    >
      <div
        className={`${styles.imageCardMedia} ${!item.src ? styles.imageCardMediaEmpty : ''}`}
        style={mediaVars}
      >
        {!item.src && (
          <div className={styles.imageCardPlaceholder}>
            <div className={styles.imageCardPlaceholderIcon}>🖼️</div>
            <div className={styles.imageCardPlaceholderText}>
              NO IMAGE SET
            </div>
          </div>
        )}
        <div className={styles.imageCardShimmer} />
        <CornerOrns />
      </div>

      <div className={styles.imageCardBody}>
        <div className={styles.imageCardTitle}>{item.title}</div>
        <div className={styles.imageCardDesc}>{item.description}</div>
      </div>
    </div>
  );
}

function Lightbox({
  item,
  onClose,
  onOpenWorldNpcs = () => { },
  onOpenMember = () => { },
  getFactionMembers = () => [],
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, panX: 0, panY: 0 });

  useEffect(() => {
    if (!item) return;
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setDragging(false);
  }, [item]);

  if (!item) return null;

  const tab = item._tab || 'maps';
  const isLocation = tab === 'locations';
  const isFaction = tab === 'factions';
  const factionMembers = isFaction ? getFactionMembers(item) : [];

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const setZoomClamped = (val) => setZoom(clamp(val, 1, 5));

  const onWheel = (e) => {
    if (!item?.src) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.12 : 0.12;
    setZoomClamped(+(zoom + delta).toFixed(2));
  };

  const startDrag = (e) => {
    if (!item?.src) return;
    setDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  };
  const moveDrag = (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy });
  };
  const endDrag = () => setDragging(false);
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const zoomIn = () => setZoomClamped(+(zoom + 0.25).toFixed(2));
  const zoomOut = () => setZoomClamped(+(zoom - 0.25).toFixed(2));

  if (isLocation || isFaction) {
    return (
      <div
        onClick={onClose}
        className={styles.lightboxOverlay}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className={`${styles.lightboxCard} ${styles.lightboxInfoCard}`}
        >
          <div className={styles.lightboxHeader}>
            <div className={styles.lightboxTitleStack}>
              <span className={styles.lightboxTitle}>{item.title}</span>
              <span className={styles.lightboxSubTag}>
                {isFaction ? 'Faction Dossier' : 'Settlement Summary'}
              </span>
            </div>

            <button
              onClick={onClose}
              className={styles.lightboxIconBtn}
              title="Close"
            >
              ✕
            </button>
          </div>

          <div
            className={`koa-scrollbar-thin ${styles.lightboxInfoGrid}`}
          >
            <div className={styles.lightboxImageFrame}>
              {item.src ? (
                <img
                  src={item.src}
                  alt={item.title}
                  className={styles.lightboxInfoImage}
                />
              ) : (
                <div className={styles.lightboxPlaceholder}>
                  <div className={styles.lightboxPlaceholderIcon}>🖼️</div>
                  <div className={styles.lightboxPlaceholderText}>
                    IMAGE NOT YET ASSIGNED
                  </div>
                </div>
              )}
            </div>

            <div className={styles.lightboxInfoPanel}>
              <div className={styles.lightboxInfoSummary}>
                {(item.summary || item.description || '').trim() || 'No summary has been added for this entry yet.'}
              </div>

              <div className={`koa-divider-line ${styles.lightboxInfoDivider}`} />

              {!isFaction ? (
                <div className={styles.lightboxFacts}>
                  <div><strong className={styles.factLabel}>Region:</strong> {(item.region || 'Unknown').trim()}</div>
                  <div><strong className={styles.factLabel}>Governance:</strong> {(item.governance || 'Unknown').trim()}</div>
                  <div><strong className={styles.factLabel}>Economy:</strong> {(item.economy || 'Unknown').trim()}</div>
                  <div><strong className={styles.factLabel}>Current Tensions:</strong> {(item.tensions || 'Unknown').trim()}</div>
                </div>
              ) : (
                <div className={styles.lightboxFacts}>
                  <div><strong className={styles.factLabel}>Influence:</strong> {(item.influence || 'Unknown').trim()}</div>
                  <div><strong className={styles.factLabel}>Doctrine:</strong> {(item.doctrine || 'Unknown').trim()}</div>
                </div>
              )}
            </div>

            {isFaction && (
              <div className={styles.factionMembersPanel}>
                <div className={styles.factionMembersTitle}>
                  Known Members
                </div>

                {factionMembers.length === 0 ? (
                  <div className={styles.factionMembersEmpty}>
                    No linked World NPC entries yet. Add or tag members in the World NPC Codex, then they will show up here.
                  </div>
                ) : (
                  <div className={styles.factionMembersList}>
                    {factionMembers.map((member, idx) => (
                      <div
                        key={`${member.id || member.name || 'member'}-${idx}`}
                        className={styles.factionMemberRow}
                      >
                        <div className={styles.factionMemberBody}>
                          <div className={styles.factionMemberName}>{member.name || 'Unnamed NPC'}</div>
                          <div className={styles.factionMemberMeta}>
                            {member.occupation ? `${member.occupation} • ` : ''}{member.location || 'Location unknown'}
                          </div>
                        </div>
                        <button
                          onClick={() => onOpenMember(member)}
                          className={`koa-glass-btn koa-interactive-lift ${styles.lightboxPillBtn}`}
                        >
                          Open Profile
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className={styles.factionFooter}>
                  <button
                    onClick={() => onOpenWorldNpcs({ faction: '' })}
                    className={`koa-glass-btn koa-interactive-lift ${styles.lightboxPillBtn}`}
                  >
                    Open Full World NPC Codex
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className={styles.lightboxFooterDesc}>
            {item.description}
          </div>

          <CornerOrns />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClose}
      onMouseMove={moveDrag}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      className={styles.lightboxOverlay}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`${styles.lightboxCard} ${styles.lightboxZoomCard}`}
      >
        <div className={styles.lightboxZoomHeader}>
          <span className={styles.lightboxTitle}>
            {item.title}
          </span>

          <div className={styles.lightboxControls}>
            <button
              onClick={zoomOut}
              disabled={!item.src || zoom <= 1}
              className={styles.lightboxCtrlBtn}
              title="Zoom out"
            >−</button>

            <input
              type="range"
              min={1}
              max={5}
              step={0.05}
              value={zoom}
              disabled={!item.src}
              onChange={(e) => setZoomClamped(parseFloat(e.target.value))}
              className={styles.lightboxRange}
              title="Zoom"
            />

            <button
              onClick={zoomIn}
              disabled={!item.src || zoom >= 5}
              className={styles.lightboxCtrlBtn}
              title="Zoom in"
            >+</button>

            <button
              onClick={resetView}
              disabled={!item.src}
              className={`${styles.lightboxCtrlBtn} ${styles.lightboxResetBtn}`}
              title="Reset view"
            >Reset</button>

            <button
              onClick={onClose}
              className={styles.lightboxIconBtn}
              title="Close"
            >✕</button>
          </div>
        </div>

        <div
          onWheel={onWheel}
          className={styles.lightboxImageStage}
        >
          {item.src ? (
            <img
              src={item.src}
              alt={item.title}
              draggable={false}
              onMouseDown={startDrag}
              onDoubleClick={resetView}
              className={styles.lightboxZoomImage}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                cursor: dragging ? 'grabbing' : (zoom > 1 ? 'grab' : 'default'),
                transition: dragging ? 'none' : 'transform 80ms ease',
              }}
            />
          ) : (
            <div className={styles.lightboxPlaceholder}>
              <div className={styles.lightboxPlaceholderIcon}>🖼️</div>
              <div className={styles.lightboxPlaceholderText}>
                IMAGE NOT YET ASSIGNED
              </div>
            </div>
          )}

          {item.src && (
            <div className={styles.lightboxHint}>
              Wheel: Zoom • Drag: Pan • Double-click: Reset
            </div>
          )}
        </div>

        <div className={styles.lightboxFooterDesc}>
          {item.description}
        </div>

        <CornerOrns />
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function WorldLore({
  panelType,
  cinematicNav,
  playNav = () => { },
  setCharView,
  setSelectedChar,
  setSelectedNpc,
  characters = [],
}) {
  const [activeTab, setActiveTab] = useState('maps');
  const [lightboxItem, setLightboxItem] = useState(null);

  const isActive = panelType === 'worldLore';

  useEffect(() => {
    if (!isActive) setLightboxItem(null);
  }, [isActive]);

  const goBack = () => {
    playNav();
    cinematicNav('menu');
  };

  const normalizeText = (value) => (value || '').toString().trim().toLowerCase();

  const normalizeWorldNpc = (npc, idx = 0) => ({
    id: (npc?.id && String(npc.id)) || `worldnpc::${idx}::${npc?.name || 'npc'}`,
    name: (npc?.name || '').trim(),
    age: (npc?.age || '').trim(),
    faction: (npc?.faction || '').trim(),
    occupation: (npc?.occupation || '').trim(),
    location: (npc?.location || '').trim(),
    summary: (npc?.summary || npc?.bio || '').trim(),
    bio: (npc?.bio || '').trim(),
    image: npc?.image || '',
    characterLinks: Array.isArray(npc?.characterLinks)
      ? npc.characterLinks
        .map((l, linkIndex) => ({
          characterName: (l?.characterName || '').trim(),
          relation: (l?.relation || '').trim(),
          linkIndex,
        }))
        .filter((l) => l.characterName)
      : [],
  });

  const normalizeRelatedNpc = (npc, charName, idx = 0) => ({
    id: (npc?.id && String(npc.id)) || `${charName}::${npc?.name || 'npc'}::${idx}`,
    name: (npc?.name || '').trim(),
    relation: (npc?.relation || '').trim(),
    age: (npc?.age || '').trim(),
    faction: (npc?.faction || '').trim(),
    occupation: (npc?.occupation || '').trim(),
    summary: (npc?.summary || npc?.bio || '').trim(),
    bio: (npc?.bio || '').trim(),
    image: npc?.image || '',
    source: npc?.source || 'character',
    worldNpcId: npc?.worldNpcId || null,
  });

  const readWorldNpcs = () => {
    try {
      const raw = localStorage.getItem(LS_WORLD_NPCS);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const readCharacterNpcStore = () => {
    try {
      const raw = localStorage.getItem(LS_CHAR_NPCS);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const getFactionMembers = (factionItem) => {
    const worldNpcs = readWorldNpcs();
    const aliases = new Set(
      [factionItem?.title, ...(Array.isArray(factionItem?.factionKeys) ? factionItem.factionKeys : [])]
        .map(normalizeText)
        .filter(Boolean)
    );
    const hintNames = (Array.isArray(factionItem?.memberHints) ? factionItem.memberHints : [])
      .map((name) => (name || '').trim())
      .filter(Boolean);
    const hintSet = new Set(hintNames.map(normalizeText));
    const out = [];
    const seen = new Set();

    (worldNpcs || []).forEach((rawNpc, idx) => {
      const npc = normalizeWorldNpc(rawNpc, idx);
      const name = npc.name;
      const id = String(npc.id || `idx:${idx}`);
      const faction = npc.faction;
      const factionHit = aliases.size > 0 && aliases.has(normalizeText(faction));
      const hintHit = hintSet.has(normalizeText(name));
      if (!factionHit && !hintHit) return;
      if (seen.has(id)) return;
      seen.add(id);
      out.push({
        id,
        worldNpcId: npc.id,
        name: name || 'Unnamed NPC',
        faction,
        location: npc.location,
        occupation: npc.occupation,
        age: npc.age,
        summary: npc.summary,
        bio: npc.bio,
        image: npc.image,
        characterLinks: npc.characterLinks,
      });
    });

    hintNames.forEach((hint) => {
      const key = normalizeText(hint);
      const exists = out.some((m) => normalizeText(m.name) === key);
      if (!exists) {
        out.push({
          id: `hint:${key}`,
          worldNpcId: null,
          name: hint,
          faction: '',
          location: '',
          occupation: '',
          age: '',
          summary: '',
          bio: '',
          image: '',
          characterLinks: [],
        });
      }
    });

    return out.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  };

  const openWorldNpcCodex = ({ search = '', faction = '' } = {}) => {
    setLightboxItem(null);
    try {
      localStorage.setItem(
        LS_WORLD_NPC_DEEPLINK,
        JSON.stringify({
          search: (search || '').trim(),
          faction: (faction || '').trim(),
          ts: Date.now(),
        })
      );
    } catch { }

    if (typeof setSelectedChar === 'function') setSelectedChar(null);
    if (typeof setSelectedNpc === 'function') setSelectedNpc(null);
    if (typeof setCharView === 'function') setCharView('worldnpcs');
    playNav();
    cinematicNav('characters');
  };

  const findCharacterByName = (name) => {
    const key = normalizeText(name);
    if (!key) return null;
    return (Array.isArray(characters) ? characters : []).find((char) => normalizeText(char?.name) === key) || null;
  };

  const openCharacterProfile = (character) => {
    if (!character) return;
    setLightboxItem(null);
    if (typeof setSelectedChar === 'function') setSelectedChar(character);
    if (typeof setSelectedNpc === 'function') setSelectedNpc(null);
    if (typeof setCharView === 'function') setCharView('detail');
    playNav();
    cinematicNav('characters');
  };

  const openNpcProfile = (character, npc) => {
    if (!character || !npc) return;
    setLightboxItem(null);
    if (typeof setSelectedChar === 'function') setSelectedChar(character);
    if (typeof setSelectedNpc === 'function') setSelectedNpc(npc);
    if (typeof setCharView === 'function') setCharView('npc');
    playNav();
    cinematicNav('characters');
  };

  const findCharacterNpcByName = (npcName) => {
    const key = normalizeText(npcName);
    if (!key) return null;

    const store = readCharacterNpcStore();
    const roster = Array.isArray(characters) ? characters : [];

    for (const char of roster) {
      const saved = Array.isArray(store?.[char?.name]) ? store[char.name] : [];
      const base = Array.isArray(char?.npcs) ? char.npcs : [];

      const seenNames = new Set();
      const merged = [...saved, ...base].filter((npc) => {
        const npcKey = normalizeText(npc?.name);
        if (!npcKey || seenNames.has(npcKey)) return false;
        seenNames.add(npcKey);
        return true;
      });

      const idx = merged.findIndex((npc) => normalizeText(npc?.name) === key);
      if (idx >= 0) {
        return {
          character: char,
          npc: normalizeRelatedNpc(merged[idx], char?.name || 'Character', idx),
        };
      }
    }

    return null;
  };

  const openFactionMemberProfile = (member) => {
    const memberName = (member?.name || '').trim();
    if (!memberName) {
      openWorldNpcCodex({ faction: member?.faction || '' });
      return;
    }

    const directCharacter = findCharacterByName(memberName);
    if (directCharacter) {
      openCharacterProfile(directCharacter);
      return;
    }

    const memberLinks = Array.isArray(member?.characterLinks) ? member.characterLinks : [];
    for (const link of memberLinks) {
      const linkedCharacter = findCharacterByName(link?.characterName);
      if (!linkedCharacter) continue;

      openNpcProfile(linkedCharacter, {
        id: `worldlink::${member.worldNpcId || member.id || memberName}::${linkedCharacter.name}::${Number.isInteger(link?.linkIndex) ? link.linkIndex : 0}`,
        name: memberName,
        relation: (link?.relation || '').trim() || 'Related NPC',
        age: member?.age || '',
        faction: member?.faction || '',
        occupation: member?.occupation || '',
        summary: member?.summary || member?.bio || '',
        bio: member?.bio || '',
        image: member?.image || '',
        source: 'world',
        worldNpcId: member?.worldNpcId || member?.id || null,
      });
      return;
    }

    const characterNpc = findCharacterNpcByName(memberName);
    if (characterNpc) {
      openNpcProfile(characterNpc.character, characterNpc.npc);
      return;
    }

    openWorldNpcCodex({ search: memberName, faction: member?.faction || '' });
  };

  const tabDescriptions = {
    maps: 'Cartographic records of explored and rumored territories.',
    scenes: 'Captured moments from the chronicle of our journey.',
    locations: 'Places of interest, wonder, and danger throughout the realm.',
    factions: 'Power blocs, sects, and alliances that shape the realm.',
  };

  return (
    <div className={`${styles.panel} ${isActive ? styles.panelActive : styles.panelInactive}`}>
      <div className={`koa-scrollbar-thin ${styles.worldLoreScrollWrap}`}>
        <div className={styles.worldLoreHeader}>
          <button
            onClick={goBack}
            className={`koa-glass-btn koa-interactive-lift ${styles.worldLoreReturnBtn}`}
          >
            ← RETURN
          </button>

          <div className={styles.worldLoreTitleWrap}>
            <div className={styles.worldLoreKicker}>
              ✦ &nbsp; COMPENDIUM OF THE REALM &nbsp; ✦
            </div>
            <h1 className={styles.worldLoreTitle}>WORLD LORE</h1>
          </div>

          <div className={styles.worldLoreHeaderSpacer} />
        </div>

        <div className={styles.worldLoreContent}>
          <section>
            <SectionDivider label="Introduction" />
            <div className={styles.introCenterWrap}>
              <div className={styles.introFrame}>
                <CornerOrns />
                {VIDEO_SRC ? (
                  <video controls className={styles.introVideo} src={VIDEO_SRC} />
                ) : (
                  <div className={styles.introPlaceholder}>
                    <div className={styles.introPlayBadge}>▶</div>
                    <div className={styles.introPlaceholderTitle}>Introduction Video</div>
                    <div className={styles.introPlaceholderNote}>
                      Set <code className={styles.introCode}>VIDEO_SRC</code> at the top of WorldLore.jsx
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section>
            <SectionDivider label="Archives" />

            <div className={styles.loreTabBar}>
              {TABS.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`${styles.loreTabBtn} ${active ? styles.loreTabBtnActive : ''}`}
                  >
                    <span className={`${styles.loreTabIcon} ${active ? styles.loreTabIconActive : ''}`}>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className={styles.galleryGrid}>
              {GALLERY[activeTab].map((item) => (
                <ImageCard
                  key={item.id}
                  item={item}
                  onClick={(picked) => setLightboxItem({ ...picked, _tab: activeTab })}
                />
              ))}
            </div>

            <div className={styles.tabCaption}>
              {tabDescriptions[activeTab]}
            </div>
          </section>
        </div>
      </div>

      {/* Lightbox */}
      <Lightbox
        item={lightboxItem}
        onClose={() => setLightboxItem(null)}
        onOpenWorldNpcs={openWorldNpcCodex}
        onOpenMember={openFactionMemberProfile}
        getFactionMembers={getFactionMembers}
      />
    </div>
  );
}
