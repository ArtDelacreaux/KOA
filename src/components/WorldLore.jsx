import React, { useEffect, useRef, useState } from 'react';

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
    { id: 3, title: "The Oracle's Vision", src: '', description: 'A dream sequence revealing the ancient prophecy.' },
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

// ─── Theme (matches MenuPanel THEME) ──────────────────────────────────────────
const THEME = {
  goldA: 'rgba(176,101,0,0.90)',
  creamText: 'rgba(255,245,220,0.96)',
  creamSoft: 'rgba(255,245,220,0.72)',
  glassA: 'rgba(255,245,220,0.065)',
  glassB: 'rgba(255,245,220,0.022)',
  line: 'rgba(255,220,160,0.18)',
  lineSoft: 'rgba(255,220,160,0.10)',
};
const fontStack = "'Cinzel', 'Trajan Pro', 'Times New Roman', serif";

// ─── Sub-components ────────────────────────────────────────────────────────────
function CornerOrns() {
  const corners = [
    { top: 6, left: 6, borderTop: '1px solid rgba(255,220,160,0.45)', borderLeft: '1px solid rgba(255,220,160,0.45)' },
    { top: 6, right: 6, borderTop: '1px solid rgba(255,220,160,0.45)', borderRight: '1px solid rgba(255,220,160,0.45)' },
    { bottom: 6, left: 6, borderBottom: '1px solid rgba(255,220,160,0.45)', borderLeft: '1px solid rgba(255,220,160,0.45)' },
    { bottom: 6, right: 6, borderBottom: '1px solid rgba(255,220,160,0.45)', borderRight: '1px solid rgba(255,220,160,0.45)' },
  ];
  return corners.map((s, i) => (
    <div key={i} style={{ position: 'absolute', width: 14, height: 14, pointerEvents: 'none', zIndex: 2, ...s }} />
  ));
}

function SectionDivider({ label }) {
  const line = {
    flex: 1,
    height: 1,
    background: 'linear-gradient(to right, transparent, rgba(255,220,160,0.22), transparent)',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '0 0 18px' }}>
      <div style={line} />
      <span style={{
        fontFamily: fontStack,
        fontSize: 11,
        letterSpacing: '0.22em',
        color: 'rgba(255,220,160,0.55)',
        textTransform: 'uppercase',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}>◈ &nbsp;{label}&nbsp; ◈</span>
      <div style={line} />
    </div>
  );
}



function ImageCard({ item, onClick }) {
  const [hovered, setHovered] = useState(false);

  // Allow per-card preview control:
  // item.pos: 'center top' etc
  // item.fit: 'cover' or 'contain'
  const pos = item.pos || 'center';
  const fit = item.fit || 'cover';

  return (
    <div
      onClick={() => onClick(item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: `linear-gradient(180deg, ${THEME.glassA}, ${THEME.glassB})`,
        border: `1px solid ${hovered ? 'rgba(255,220,160,0.55)' : THEME.lineSoft}`,
        borderRadius: 18,
        overflow: 'hidden',
        cursor: 'pointer',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'border-color 200ms ease, transform 200ms ease, box-shadow 200ms ease',
        boxShadow: hovered
          ? '0 22px 60px rgba(0,0,0,0.6), 0 0 24px rgba(255,200,120,0.12)'
          : '0 14px 40px rgba(0,0,0,0.45)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Image area */}
      <div style={{
        width: '100%',
        aspectRatio: '16/9',
        background: item.src
          ? `url(${item.src}) ${pos} / ${fit} no-repeat`
          : 'linear-gradient(135deg, rgba(30,20,8,0.95), rgba(60,38,12,0.7))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: `1px solid ${THEME.lineSoft}`,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {!item.src && (
          <div style={{ textAlign: 'center', opacity: 0.35, pointerEvents: 'none' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: 4 }}>🖼️</div>
            <div style={{ fontSize: '0.6rem', color: 'rgba(255,220,160,0.7)', fontFamily: fontStack, letterSpacing: '0.15em' }}>
              NO IMAGE SET
            </div>
          </div>
        )}
        {/* Hover shimmer overlay */}
        {hovered && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, transparent 40%, rgba(255,220,160,0.06) 60%, transparent 80%)',
            pointerEvents: 'none',
          }} />
        )}
        <CornerOrns />
      </div>

      {/* Card info */}
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{
          fontFamily: fontStack,
          fontSize: 13,
          fontWeight: 900,
          color: hovered ? THEME.creamText : 'rgba(255,235,200,0.88)',
          letterSpacing: '0.08em',
          marginBottom: 5,
          transition: 'color 200ms ease',
        }}>
          {item.title}
        </div>
        <div style={{
          fontSize: 11.5,
          fontWeight: 850,
          color: 'rgba(255,245,220,0.58)',
          lineHeight: 1.5,
          fontStyle: 'italic',
        }}>
          {item.description}
        </div>
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
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.88)',
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 22,
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'linear-gradient(180deg, rgba(22,16,8,0.98), rgba(12,9,4,0.99))',
            border: `1px solid rgba(255,220,160,0.4)`,
            borderRadius: 22,
            maxWidth: 1080,
            width: '100%',
            maxHeight: '90vh',
            overflow: 'hidden',
            boxShadow: '0 0 80px rgba(0,0,0,0.8), 0 0 40px rgba(176,101,0,0.12)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              borderBottom: `1px solid ${THEME.lineSoft}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255,245,220,0.04)',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontFamily: fontStack, color: THEME.creamText, fontSize: 15, fontWeight: 900, letterSpacing: '0.1em' }}>
                {item.title}
              </span>
              <span style={{ color: 'rgba(255,220,160,0.56)', fontSize: 10, fontWeight: 900, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                {isFaction ? 'Faction Dossier' : 'Settlement Summary'}
              </span>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,245,220,0.06)',
                border: `1px solid ${THEME.line}`,
                color: 'rgba(255,220,160,0.8)',
                cursor: 'pointer',
                borderRadius: 10,
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontFamily: fontStack,
              }}
              title="Close"
            >
              ✕
            </button>
          </div>

          <div
            className="wl-scrollbar"
            style={{
              overflowY: 'auto',
              padding: 16,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 14,
            }}
          >
            <div
              style={{
                borderRadius: 16,
                overflow: 'hidden',
                border: `1px solid ${THEME.lineSoft}`,
                background: 'rgba(0,0,0,0.25)',
                minHeight: 260,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {item.src ? (
                <img
                  src={item.src}
                  alt={item.title}
                  style={{ width: '100%', height: '100%', maxHeight: 420, objectFit: 'cover' }}
                />
              ) : (
                <div style={{ textAlign: 'center', opacity: 0.28 }}>
                  <div style={{ fontSize: '3rem' }}>🖼️</div>
                  <div style={{ color: 'rgba(255,220,160,0.7)', fontSize: '0.7rem', letterSpacing: '0.15em', marginTop: 10, fontFamily: fontStack }}>
                    IMAGE NOT YET ASSIGNED
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                borderRadius: 16,
                border: `1px solid ${THEME.lineSoft}`,
                background: 'linear-gradient(180deg, rgba(34,24,14,0.74), rgba(16,12,8,0.82))',
                padding: 14,
                boxShadow: '0 18px 44px rgba(0,0,0,0.42)',
              }}
            >
              <div style={{ color: 'rgba(255,245,220,0.92)', fontSize: 12.5, lineHeight: 1.72, fontWeight: 850 }}>
                {(item.summary || item.description || '').trim() || 'No summary has been added for this entry yet.'}
              </div>

              <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,220,160,0.18), transparent)', margin: '12px 0' }} />

              {!isFaction ? (
                <div style={{ display: 'grid', gap: 7, color: 'rgba(255,245,220,0.84)', fontSize: 12.5, fontWeight: 850, lineHeight: 1.6 }}>
                  <div><strong style={{ color: THEME.creamText }}>Region:</strong> {(item.region || 'Unknown').trim()}</div>
                  <div><strong style={{ color: THEME.creamText }}>Governance:</strong> {(item.governance || 'Unknown').trim()}</div>
                  <div><strong style={{ color: THEME.creamText }}>Economy:</strong> {(item.economy || 'Unknown').trim()}</div>
                  <div><strong style={{ color: THEME.creamText }}>Current Tensions:</strong> {(item.tensions || 'Unknown').trim()}</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 7, color: 'rgba(255,245,220,0.84)', fontSize: 12.5, fontWeight: 850, lineHeight: 1.6 }}>
                  <div><strong style={{ color: THEME.creamText }}>Influence:</strong> {(item.influence || 'Unknown').trim()}</div>
                  <div><strong style={{ color: THEME.creamText }}>Doctrine:</strong> {(item.doctrine || 'Unknown').trim()}</div>
                </div>
              )}
            </div>

            {isFaction && (
              <div
                style={{
                  gridColumn: '1 / -1',
                  borderRadius: 16,
                  border: `1px solid ${THEME.lineSoft}`,
                  background: 'linear-gradient(180deg, rgba(30,20,10,0.78), rgba(14,10,8,0.84))',
                  padding: 14,
                }}
              >
                <div style={{ fontFamily: fontStack, fontWeight: 900, letterSpacing: '0.08em', color: THEME.creamText, fontSize: 13, marginBottom: 10 }}>
                  Known Members
                </div>

                {factionMembers.length === 0 ? (
                  <div style={{ color: 'rgba(255,245,220,0.72)', fontSize: 12.5, lineHeight: 1.7 }}>
                    No linked World NPC entries yet. Add or tag members in the World NPC Codex, then they will show up here.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {factionMembers.map((member, idx) => (
                      <div
                        key={`${member.id || member.name || 'member'}-${idx}`}
                        style={{
                          borderRadius: 12,
                          border: `1px solid ${THEME.lineSoft}`,
                          background: 'rgba(0,0,0,0.24)',
                          padding: '9px 10px',
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) auto',
                          gap: 10,
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: THEME.creamText, fontWeight: 900, fontSize: 13 }}>{member.name || 'Unnamed NPC'}</div>
                          <div style={{ color: 'rgba(255,245,220,0.72)', fontSize: 11.5, marginTop: 2, lineHeight: 1.55 }}>
                            {member.occupation ? `${member.occupation} • ` : ''}{member.location || 'Location unknown'}
                          </div>
                        </div>
                        <button
                          onClick={() => onOpenMember(member)}
                          style={{
                            borderRadius: 999,
                            border: `1px solid ${THEME.line}`,
                            padding: '7px 10px',
                            background: `linear-gradient(180deg, ${THEME.glassA}, ${THEME.glassB})`,
                            color: THEME.creamText,
                            fontFamily: fontStack,
                            fontSize: 11,
                            fontWeight: 900,
                            letterSpacing: '0.08em',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Open Profile
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => onOpenWorldNpcs({ faction: '' })}
                    style={{
                      borderRadius: 999,
                      border: `1px solid ${THEME.line}`,
                      padding: '8px 12px',
                      background: `linear-gradient(180deg, ${THEME.glassA}, ${THEME.glassB})`,
                      color: THEME.creamText,
                      fontFamily: fontStack,
                      fontSize: 11.5,
                      fontWeight: 900,
                      letterSpacing: '0.08em',
                      cursor: 'pointer',
                    }}
                  >
                    Open Full World NPC Codex
                  </button>
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              padding: '12px 20px',
              borderTop: `1px solid ${THEME.lineSoft}`,
              color: 'rgba(255,245,220,0.68)',
              fontSize: 12.5,
              fontStyle: 'italic',
              lineHeight: 1.6,
              fontWeight: 850,
            }}
          >
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
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.88)',
        zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 32,
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, rgba(22,16,8,0.98), rgba(12,9,4,0.99))',
          border: `1px solid rgba(255,220,160,0.4)`,
          borderRadius: 22,
          maxWidth: 980,
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 0 80px rgba(0,0,0,0.8), 0 0 40px rgba(176,101,0,0.12)',
          position: 'relative',
        }}
      >
        <div style={{
          padding: '14px 20px',
          borderBottom: `1px solid ${THEME.lineSoft}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(255,245,220,0.04)',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <span style={{ fontFamily: fontStack, color: THEME.creamText, fontSize: 15, fontWeight: 900, letterSpacing: '0.1em' }}>
            {item.title}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            <button
              onClick={zoomOut}
              disabled={!item.src || zoom <= 1}
              style={{
                opacity: !item.src || zoom <= 1 ? 0.35 : 1,
                background: 'rgba(255,245,220,0.06)',
                border: `1px solid ${THEME.line}`,
                color: 'rgba(255,220,160,0.8)',
                cursor: !item.src || zoom <= 1 ? 'not-allowed' : 'pointer',
                borderRadius: 10,
                width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontFamily: fontStack, fontWeight: 900,
              }}
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
              style={{
                width: 160,
                accentColor: 'rgba(176,101,0,0.85)',
                opacity: item.src ? 1 : 0.35,
              }}
              title="Zoom"
            />

            <button
              onClick={zoomIn}
              disabled={!item.src || zoom >= 5}
              style={{
                opacity: !item.src || zoom >= 5 ? 0.35 : 1,
                background: 'rgba(255,245,220,0.06)',
                border: `1px solid ${THEME.line}`,
                color: 'rgba(255,220,160,0.8)',
                cursor: !item.src || zoom >= 5 ? 'not-allowed' : 'pointer',
                borderRadius: 10,
                width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontFamily: fontStack, fontWeight: 900,
              }}
              title="Zoom in"
            >+</button>

            <button
              onClick={resetView}
              disabled={!item.src}
              style={{
                opacity: item.src ? 1 : 0.35,
                background: 'rgba(255,245,220,0.06)',
                border: `1px solid ${THEME.line}`,
                color: 'rgba(255,220,160,0.8)',
                cursor: item.src ? 'pointer' : 'not-allowed',
                borderRadius: 10,
                height: 32,
                padding: '0 10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontFamily: fontStack, fontWeight: 900,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
              title="Reset view"
            >Reset</button>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,245,220,0.06)',
                border: `1px solid ${THEME.line}`,
                color: 'rgba(255,220,160,0.8)',
                cursor: 'pointer',
                borderRadius: 10,
                width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontFamily: fontStack,
              }}
              title="Close"
            >✕</button>
          </div>
        </div>

        <div
          onWheel={onWheel}
          style={{
            width: '100%',
            height: 'min(70vh, 560px)',
            background: '#0a0805',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            userSelect: 'none',
          }}
        >
          {item.src ? (
            <img
              src={item.src}
              alt={item.title}
              draggable={false}
              onMouseDown={startDrag}
              onDoubleClick={resetView}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                cursor: dragging ? 'grabbing' : (zoom > 1 ? 'grab' : 'default'),
                transition: dragging ? 'none' : 'transform 80ms ease',
                willChange: 'transform',
                pointerEvents: 'auto',
              }}
            />
          ) : (
            <div style={{ textAlign: 'center', opacity: 0.28 }}>
              <div style={{ fontSize: '3.5rem' }}>🖼️</div>
              <div style={{ color: 'rgba(255,220,160,0.7)', fontSize: '0.7rem', letterSpacing: '0.15em', marginTop: 10, fontFamily: fontStack }}>
                IMAGE NOT YET ASSIGNED
              </div>
            </div>
          )}

          {item.src && (
            <div style={{
              position: 'absolute',
              bottom: 12,
              right: 14,
              fontSize: 11,
              fontFamily: fontStack,
              letterSpacing: '0.12em',
              color: 'rgba(255,220,160,0.35)',
              background: 'rgba(0,0,0,0.35)',
              border: `1px solid rgba(255,220,160,0.18)`,
              borderRadius: 12,
              padding: '6px 10px',
              backdropFilter: 'blur(6px)',
            }}>
              Wheel: Zoom • Drag: Pan • Double-click: Reset
            </div>
          )}
        </div>

        <div style={{
          padding: '14px 20px',
          borderTop: `1px solid ${THEME.lineSoft}`,
          color: 'rgba(255,245,220,0.68)',
          fontSize: 13,
          fontStyle: 'italic',
          lineHeight: 1.6,
          fontWeight: 850,
        }}>
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

  // Panel visibility — matches ShellLayout pattern used elsewhere
  const isActive = panelType === 'worldLore';
  const panelStyle = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: isActive ? 1 : 0,
    transform: isActive ? 'translateY(0px)' : 'translateY(10px)',
    transition: 'opacity 220ms ease, transform 220ms ease',
    pointerEvents: isActive ? 'auto' : 'none',
    zIndex: isActive ? 6 : 4,
    overflowY: 'auto',
  };

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

  const tabBarWrap = {
    display: 'flex',
    gap: 8,
    marginBottom: 22,
    padding: 8,
    borderRadius: 22,
    border: `1px solid ${THEME.line}`,
    background: 'linear-gradient(180deg, rgba(24,16,10,0.88), rgba(10,8,6,0.86))',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    boxShadow: '0 18px 44px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,245,220,0.06)',
  };

  const loreTabButton = (active) => ({
    flex: 1,
    minWidth: 0,
    padding: '11px 16px',
    borderRadius: 999,
    border: active
      ? '1px solid rgba(255,220,160,0.45)'
      : '1px solid rgba(255,220,160,0.20)',
    background: active
      ? 'linear-gradient(180deg, rgba(176,101,0,0.34), rgba(92,55,12,0.30))'
      : 'linear-gradient(180deg, rgba(58,40,24,0.86), rgba(24,16,10,0.90))',
    color: active ? THEME.creamText : 'rgba(255,245,220,0.88)',
    cursor: 'pointer',
    fontFamily: fontStack,
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    transition: 'all 160ms ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: active
      ? '0 14px 34px rgba(0,0,0,0.52), 0 0 18px rgba(176,101,0,0.24)'
      : '0 10px 24px rgba(0,0,0,0.34)',
    userSelect: 'none',
    textShadow: '0 1px 10px rgba(0,0,0,0.78)',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={panelStyle}>
      <style>{`
        .wl-scrollbar::-webkit-scrollbar { width: 6px; }
        .wl-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .wl-scrollbar::-webkit-scrollbar-thumb { background: rgba(176,101,0,0.4); border-radius: 999px; }
      `}</style>

      <div
        className="wl-scrollbar"
        style={{
          width: '100%',
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '0 0 40px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(176,101,0,0.4) transparent',
        }}
      >
        {/* ── PAGE HEADER ── */}
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          padding: '44px 36px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(180deg, rgba(8,5,2,0.96) 80%, transparent)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderBottom: `1px solid ${THEME.lineSoft}`,
        }}>
          {/* Back button */}
          <button
            onClick={goBack}
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
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(255,220,160,0.45)';
              e.currentTarget.style.color = THEME.creamText;
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = THEME.line;
              e.currentTarget.style.color = 'rgba(255,220,160,0.8)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            ← RETURN
          </button>

          {/* Title */}
          <div style={{ textAlign: 'center', position: 'relative' }}>
            <div style={{
              fontSize: 10,
              letterSpacing: '0.38em',
              color: 'rgba(255,220,160,0.45)',
              marginBottom: 14,
              marginTop: -12,
              fontFamily: fontStack,
              textTransform: 'uppercase',
            }}>
              ✦ &nbsp; COMPENDIUM OF THE REALM &nbsp; ✦
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
              WORLD LORE
            </h1>
          </div>

          {/* Spacer to balance */}
          <div style={{ width: 120 }} />
        </div>

        {/* ── CONTENT ── */}
        <div style={{ padding: '28px 36px 0', display: 'flex', flexDirection: 'column', gap: 32 }}>

          {/* ── VIDEO SECTION ── */}
          <section>
            <SectionDivider label="Introduction" />
            {/* Centered, constrained video wrapper */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: 680,
                background: 'rgba(6,4,2,0.92)',
                border: `1px solid ${THEME.line}`,
                borderRadius: 18,
                overflow: 'hidden',
                boxShadow: '0 18px 50px rgba(0,0,0,0.7), inset 0 0 60px rgba(0,0,0,0.5)',
              }}>
                <CornerOrns />

                {VIDEO_SRC ? (
                  <video
                    controls
                    style={{
                      width: '100%',
                      display: 'block',
                      maxHeight: 340,
                      objectFit: 'contain',
                      background: '#000',
                    }}
                    src={VIDEO_SRC}
                  />
                ) : (
                  <div style={{
                    aspectRatio: '16/9',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 14,
                    background: 'linear-gradient(135deg, rgba(18,12,4,0.98), rgba(38,26,8,0.9))',
                  }}>
                    <div style={{
                      width: 60, height: 60,
                      borderRadius: '50%',
                      border: `1px solid ${THEME.line}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.5rem',
                      color: 'rgba(255,220,160,0.35)',
                      background: 'rgba(0,0,0,0.3)',
                    }}>▶</div>
                    <div style={{
                      fontFamily: fontStack,
                      color: 'rgba(255,220,160,0.35)',
                      fontSize: 12,
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      fontWeight: 900,
                    }}>
                      Introduction Video
                    </div>
                    <div style={{
                      color: 'rgba(255,220,160,0.22)',
                      fontSize: 11,
                      fontStyle: 'italic',
                      fontWeight: 850,
                    }}>
                      Set <code style={{ fontFamily: 'monospace', fontSize: 10 }}>VIDEO_SRC</code> at the top of WorldLore.jsx
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── GALLERY SECTION ── */}
          <section>
            <SectionDivider label="Archives" />

            {/* Tab Bar */}
            <div style={tabBarWrap}>
              {TABS.map(tab => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={loreTabButton(active)}
                    onMouseEnter={e => {
                      if (!active) {
                        e.currentTarget.style.color = THEME.creamText;
                        e.currentTarget.style.borderColor = 'rgba(255,220,160,0.36)';
                        e.currentTarget.style.background = 'linear-gradient(180deg, rgba(78,52,28,0.92), rgba(30,20,12,0.92))';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        e.currentTarget.style.color = 'rgba(255,245,220,0.88)';
                        e.currentTarget.style.borderColor = 'rgba(255,220,160,0.20)';
                        e.currentTarget.style.background = 'linear-gradient(180deg, rgba(58,40,24,0.86), rgba(24,16,10,0.90))';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }
                    }}
                  >
                    <span style={{ fontSize: '1rem', opacity: active ? 1 : 0.9 }}>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Gallery Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
            }}>
              {GALLERY[activeTab].map(item => (
                <ImageCard
                  key={item.id}
                  item={item}
                  onClick={(picked) => setLightboxItem({ ...picked, _tab: activeTab })}
                />
              ))}
            </div>

            {/* Tab caption */}
            <div style={{
              marginTop: 14,
              textAlign: 'center',
              color: 'rgba(255,220,160,0.28)',
              fontSize: 11,
              letterSpacing: '0.14em',
              fontStyle: 'italic',
              fontWeight: 850,
              fontFamily: fontStack,
            }}>
              {tabDescriptions[activeTab]}
            </div>
          </section>

        </div>{/* end content */}
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
