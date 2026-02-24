import React, { useState } from 'react';

/*
  WorldLore — Knights of Atria
  Overworld knowledge center with:
  - Intro video player
  - Tabbed image gallery (Maps, Scenes, Locations)
  - Lightbox on card click
  - Matches existing KOA tavern palette and panel system
*/

const TABS = [
  { id: 'maps',      label: 'Maps',      icon: '🗺️' },
  { id: 'scenes',    label: 'Scenes',    icon: '🎨' },
  { id: 'locations', label: 'Locations', icon: '🏰' },
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
    { id: 1, title: 'The Continent of Atria',  src: 'lore/world-map.jpg', description: 'Full overworld map of the campaign setting.' },
    { id: 2, title: 'The Shattered Canyon',    src: 'lore/canyon.jpg', description: 'Detailed map of the Shattered Canyon.' },
  ],
  scenes: [
    { id: 1, title: 'The Well',            src: 'lore/Well.jpg', description: 'Where tensions ran high.' },
    { id: 2, title: 'Underground Ryken Church', src: 'lore/rchurch.jpg', description: 'The underground church below Avalon.' },
    { id: 3, title: "The Oracle's Vision", src: '', description: 'A dream sequence revealing the ancient prophecy.' },
  ],
  locations: [
    { id: 1, title: 'The City of Qonza',      src: 'lore/Qonza.webp', description: 'Crescent moon city with a cruel justice system.' },
    { id: 2, title: 'The City of Williwack', src: 'lore/Williwack.jpg', description: 'A desert kingdom that borders the World Spear.' },
    { id: 3, title: 'The City of Avalon',      src: 'lore/avalonsky.jpg', description: 'Overview of the Center Kingdom' },
	{ id: 4, title: 'The City of Metlos',      src: 'lore/Metlos.jpg', description: 'Overview of Metlos' },
	{ id: 5, title: 'The Village of Orum',      src: 'lore/orum.png', description: 'Overview of Orum' },
	{ id: 6, title: 'The City of Buston',      src: 'lore/Buston.jpg', description: 'Overview of Buston' },
	{ id: 7, title: 'The Village of SkulPol',      src: 'lore/skolpol.jpg', description: 'Overview of Buston' },
  ],
};

/*
  ── HOW TO SET YOUR INTRO VIDEO ──
  Import your video at the top:
    import introVideo from '../assets/lore/world-intro.mp4';
  Then set: const VIDEO_SRC = introVideo;
*/
const VIDEO_SRC = '';

// ─── Theme (matches MenuPanel THEME) ──────────────────────────────────────────
const THEME = {
  goldA:     'rgba(176,101,0,0.90)',
  creamText: 'rgba(255,245,220,0.96)',
  creamSoft: 'rgba(255,245,220,0.72)',
  glassA:    'rgba(255,245,220,0.065)',
  glassB:    'rgba(255,245,220,0.022)',
  line:      'rgba(255,220,160,0.18)',
  lineSoft:  'rgba(255,220,160,0.10)',
};
const fontStack = "'Cinzel', 'Trajan Pro', 'Times New Roman', serif";

// ─── Sub-components ────────────────────────────────────────────────────────────
function CornerOrns() {
  const corners = [
    { top: 6, left: 6,  borderTop: '1px solid rgba(255,220,160,0.45)', borderLeft:  '1px solid rgba(255,220,160,0.45)' },
    { top: 6, right: 6, borderTop: '1px solid rgba(255,220,160,0.45)', borderRight: '1px solid rgba(255,220,160,0.45)' },
    { bottom: 6, left: 6,  borderBottom: '1px solid rgba(255,220,160,0.45)', borderLeft:  '1px solid rgba(255,220,160,0.45)' },
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
          ? `url(${item.src}) center/cover no-repeat`
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

function Lightbox({ item, onClose }) {
  if (!item) return null;
  return (
    <div
      onClick={onClose}
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
          maxWidth: 860,
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 0 80px rgba(0,0,0,0.8), 0 0 40px rgba(176,101,0,0.12)',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 20px',
          borderBottom: `1px solid ${THEME.lineSoft}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(255,245,220,0.04)',
        }}>
          <span style={{ fontFamily: fontStack, color: THEME.creamText, fontSize: 15, fontWeight: 900, letterSpacing: '0.1em' }}>
            {item.title}
          </span>
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
              transition: 'background 150ms ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,245,220,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,245,220,0.06)'}
          >✕</button>
        </div>

        {/* Image */}
        <div style={{
          width: '100%', aspectRatio: '16/9',
          background: item.src
            ? `url(${item.src}) center/contain no-repeat #0a0805`
            : 'linear-gradient(135deg, rgba(30,20,8,0.95), rgba(50,32,10,0.8))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {!item.src && (
            <div style={{ textAlign: 'center', opacity: 0.28 }}>
              <div style={{ fontSize: '3.5rem' }}>🖼️</div>
              <div style={{ color: 'rgba(255,220,160,0.7)', fontSize: '0.7rem', letterSpacing: '0.15em', marginTop: 10, fontFamily: fontStack }}>
                IMAGE NOT YET ASSIGNED
              </div>
            </div>
          )}
        </div>

        {/* Description */}
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
export default function WorldLore({ panelType, cinematicNav, playNav = () => {} }) {
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

  const goBack = () => {
    playNav();
    cinematicNav('menu');
  };

  const tabDescriptions = {
    maps:      'Cartographic records of explored and rumored territories.',
    scenes:    'Captured moments from the chronicle of our journey.',
    locations: 'Places of interest, wonder, and danger throughout the realm.',
  };

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
            <div style={{
              display: 'flex',
              gap: 6,
              marginBottom: 22,
              background: `linear-gradient(180deg, ${THEME.glassA}, ${THEME.glassB})`,
              border: `1px solid ${THEME.lineSoft}`,
              borderRadius: 18,
              padding: 6,
              backdropFilter: 'blur(10px)',
              boxShadow: '0 14px 40px rgba(0,0,0,0.4)',
            }}>
              {TABS.map(tab => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      flex: 1,
                      padding: '11px 16px',
                      background: active
                        ? 'linear-gradient(180deg, rgba(176,101,0,0.30), rgba(176,101,0,0.14))'
                        : 'transparent',
                      border: active
                        ? '1px solid rgba(255,220,160,0.45)'
                        : '1px solid transparent',
                      borderRadius: 14,
                      color: active ? THEME.creamText : 'rgba(255,245,220,0.45)',
                      cursor: 'pointer',
                      fontFamily: fontStack,
                      fontSize: 12,
                      fontWeight: 900,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      transition: 'all 180ms ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: active ? '0 10px 28px rgba(0,0,0,0.3), 0 0 20px rgba(176,101,0,0.12)' : 'none',
                      userSelect: 'none',
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        e.currentTarget.style.color = 'rgba(255,245,220,0.72)';
                        e.currentTarget.style.borderColor = THEME.lineSoft;
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        e.currentTarget.style.color = 'rgba(255,245,220,0.45)';
                        e.currentTarget.style.borderColor = 'transparent';
                      }
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>{tab.icon}</span>
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
                <ImageCard key={item.id} item={item} onClick={setLightboxItem} />
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
      <Lightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />
    </div>
  );
}
