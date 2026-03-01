import React, { useEffect, useMemo, useRef, useState } from 'react';
import recapVideo from '../assets/recap.mp4';
import combatVideo from '../assets/CombatVideo.mp4';
import theaterPreviewVideo from '../assets/Theater.mp4';
import characterBookPreviewVideo from '../assets/CharacterBook.mp4';
import worldLoreVideo from '../assets/worldlore.mp4';
import styles from './MenuPanel.module.css';
import { STORAGE_KEYS, menuNoteKey } from '../lib/storageKeys';
import { repository } from '../repository';

/*
  Knights of Atria — Main Menu (JRPG vibe, tavern palette)
  Fix goals:
  - Menu items ALWAYS navigate (no “Confirm-only” trap)
  - Keep right panel useful (Session Brief + per-page notes)
  - Logo top-center
  - Uses same warm palette as the rest of your UI
*/

export default function MenuPanel({
  panelType,
  koaTitle,
  menuBackdrop,
  nightMode = false,

  cinematicNav,
  cinematicDo,

  setPanelType,
  setSelectedChar,
  setSelectedNpc,
  setCharView,
  setVideoChoice,

  playHover = () => { },
  // optional; TavernMenu may or may not pass it
  playNav = () => { },
  playMenuOpen = () => { },
  onMenuStarted = () => { },
}) {
  /* ---------- persistence (menu-side, independent of CampaignHub) ---------- */
  const LS_CAMPAIGN_BRIEF = STORAGE_KEYS.menuCampaignBrief;

  const [campaignBrief, setCampaignBrief] = useState(() => {
    const p = repository.readJson(LS_CAMPAIGN_BRIEF, {});
    return {
      location: p.location || '',
      objective: p.objective || '',
      updatedAt: p.updatedAt || null,
    };
  });

  const [notes, setNotes] = useState(() => {
    return {
      characters: repository.readText(menuNoteKey('characters')),
      video: repository.readText(menuNoteKey('video')),
      lore: repository.readText(menuNoteKey('lore')),
    };
  });

  useEffect(() => {
    repository.writeJson(LS_CAMPAIGN_BRIEF, campaignBrief);
  }, [campaignBrief]);

  useEffect(() => {
    repository.writeText(menuNoteKey('characters'), notes.characters || '');
    repository.writeText(menuNoteKey('video'), notes.video || '');
    repository.writeText(menuNoteKey('lore'), notes.lore || '');
  }, [notes]);

  const theaterPreviewRef = useRef(null);

  // Minimal inline SVG icons to avoid extra assets.
  const Icon = ({ name, active }) => {
    const s = 18;
    const stroke = active ? 'var(--koa-cream)' : 'var(--koa-cream-82)';
    const common = {
      width: s,
      height: s,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke,
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    };

    if (name === 'campaign') {
      return (
        <svg {...common}>
          <path d="M4 6h16" />
          <path d="M7 6v12" />
          <path d="M17 6v12" />
          <path d="M4 18h16" />
          <path d="M9 10h6" />
          <path d="M9 14h6" />
        </svg>
      );
    }

    if (name === 'characters') {
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="10" cy="7" r="3" />
          <path d="M22 21v-2a3 3 0 0 0-2-2.83" />
          <path d="M17 3.13a3 3 0 0 1 0 5.75" />
        </svg>
      );
    }

    if (name === 'video') {
      return (
        <svg {...common}>
          <path d="M10 8l6 4-6 4V8z" />
          <rect x="3" y="6" width="18" height="12" rx="2" />
        </svg>
      );
    }

    if (name === 'combat') {
      return (
        <svg {...common}>
          <path d="M20 4l-6 6" />
          <path d="M14 10l-2-2" />
          <path d="M10 14l2 2" />
          <path d="M4 20l6-6" />
          <path d="M8 8l8 8" />
          <path d="M16 8l4-4" />
          <path d="M8 16l-4 4" />
        </svg>
      );
    }

    return (
      <svg {...common}>
        <path d="M4 19a2 2 0 0 0 2 2h12" />
        <path d="M6 3h12v18H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
        <path d="M8 7h8" />
        <path d="M8 11h8" />
        <path d="M8 15h6" />
      </svg>
    );
  };

  // Navigation actions (kept compatible with your TavernMenu cinematicNav/cinematicDo)
  const goCampaign = () => {
    playNav();
    cinematicNav('campaign');
  };
  const goCombat = () => {
    playNav();
    cinematicNav('combat');
  };

  const goCharacters = (view = 'grid') => {
    playNav();
    cinematicDo(() => {
      setPanelType('characters');
      setSelectedChar(null);
      setSelectedNpc(null);
      setCharView(view);
    });
  };

  const goVideo = () => {
    playNav();
    if (theaterPreviewRef.current) {
      theaterPreviewRef.current.pause();
    }
    cinematicDo(() => {
      setPanelType('video');
      setVideoChoice(null);
    });
  };

  const goLore = () => {
    playNav();
    cinematicNav('worldLore');
  };



  const items = useMemo(
    () => [
      {
        key: 'campaign',
        label: 'Continue ?',
        titleColor: 'rgba(242,224,199,0.98)',
        sub: 'Return to the hub and resume your session.',
        title: 'Session Brief',
        desc: 'Keep up with the party and watch last weeks episode!',
        primary: { label: 'Continue', onClick: goCampaign },
      },
      {
        key: 'combat',
        label: 'Combat',
        titleColor: 'rgba(246,229,207,0.98)',
        sub: 'Initiative, HP, slots, and statuses.',
        title: 'Combat Tracker',
        desc: 'Keep track of your battles here.',
        primary: { label: 'Open Combat Tracker', onClick: goCombat },
      },
      {
        key: 'characters',
        label: 'Character Book',
        titleColor: 'rgba(249,234,214,0.98)',
        sub: 'Profiles, NPCs, and party bonds.',
        title: 'Character Book',
        desc: 'Quick-jump to Party or World NPCs.',
        primary: { label: 'Open Character Book', onClick: () => goCharacters('grid') },
      },
      {
        key: 'video',
        label: 'Theater',
        titleColor: 'rgba(252,239,221,0.98)',
        sub: 'Cinematic scenes & mood setting.',
        title: 'Cinematics',
        desc: 'Set the stage. Open the Theater to play your cinematics.',
        primary: { label: 'Open Cinematics', onClick: goVideo },
      },
      {
        key: 'lore',
        label: 'World Lore',
        sub: 'Codex, maps, and setting archive.',
        title: 'World Lore',
        desc: 'Browse maps, scenes, and locations.',
        primary: { label: 'Open', onClick: goLore },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playNav, cinematicNav, cinematicDo, setPanelType, setSelectedChar, setSelectedNpc, setCharView, setVideoChoice]
  );

  const [activeKey, setActiveKey] = useState('campaign');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(true);   // start with login visible
  const [menuStarted, setMenuStarted] = useState(false);
  const [startFading, setStartFading] = useState(false);

  const startMenu = () => {
    if (menuStarted) return;
    try { playMenuOpen(); } catch (e) { }
    try { onMenuStarted(); } catch (e) { }
    setStartFading(true);
    window.setTimeout(() => {
      setMenuStarted(true);
    }, 520);
  };

  const activeItem = items.find((i) => i.key === activeKey) || items[0];

<<<<<<< HEAD
return (
  <>
    {/* ────────────────────────────────────────────────
        NEW: Login screen – highest layer, covers everything
        ──────────────────────────────────────────────── */}
    <LoginOverlay />

    {/* The rest of your original content stays exactly the same */}
    <div
      style={panelStyle(panelType === 'menu')}
      onMouseDown={(e) => {
        // stop accidental drag ghost images
        if (e.target?.tagName === 'IMG') e.preventDefault();
      }}
    >
      <style>{`
        ::placeholder {
          color: rgba(255, 245, 220, 0.90);
          opacity: 1;
        }
        @keyframes shimmerSweep { ... }
        @keyframes cursorBob { ... }
        .jrpgShimmer::after { ... }
        .jrpgShimmer:hover::after { ... }
        @keyframes logoSparkle { ... }
        .jrpgShimmer:hover .cmd-title { ... }
        /* ... all your other @keyframes and .jrpgShimmer rules remain unchanged ... */
      `}</style>

      {/* PRESS TO START overlay – now only visible after login */}
      {!menuStarted && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background:
              'radial-gradient(1200px 520px at 50% 28%, rgba(255,245,220,0.30), rgba(0,0,0,0.35))',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
            transition: 'opacity 520ms ease, transform 520ms ease',
            opacity: startFading ? 0 : 1,
            transform: startFading ? 'translateY(8px) scale(0.99)' : 'translateY(0px) scale(1)',
            pointerEvents: startFading ? 'none' : 'auto',
          }}
          onMouseDown={startMenu}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') startMenu();
          }}
          role="button"
          tabIndex={0}
          aria-label="Press to start"
        >
          {/* ... the entire press-to-start card content remains unchanged ... */}
        </div>
      )}

      {/* Main menu content – fades in after press-to-start */}
      <div
        style={{
          ...menuRoot,
          opacity: menuStarted ? 1 : 0,
          transform: menuStarted ? 'translateY(0px)' : 'translateY(8px)',
          transition: 'opacity 520ms ease, transform 520ms ease',
          pointerEvents: menuStarted ? 'auto' : 'none',
        }}
      >
        <div style={menuShell}>
          <div style={shellGlassBelow} />

          {/* Logo (no surrounding panel) */}
          <div style={{ textAlign: 'center', paddingTop: 16, marginBottom: 6 }}>
            <img
              src={koaTitle}
              alt="Knights of Avalon"
              draggable={false}
              style={logoImg}
            />
=======
  return (
    <>
      <div
        className={`${styles.menuPanel} ${panelType === 'menu' ? styles.menuPanelActive : styles.menuPanelInactive}`}
        onMouseDown={(e) => {
          // stop accidental drag ghost images
          if (e.target?.tagName === 'IMG') e.preventDefault();
        }}
      >
        {/* PRESS TO START overlay */}
        {!menuStarted && (
          <div
            className={`${styles.startOverlay} ${startFading ? styles.startOverlayFading : ''}`}
            onMouseDown={startMenu}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') startMenu();
            }}
            role="button"
            tabIndex={0}
            aria-label="Press to start"
          >
            <div className={styles.startCard}>
              <div className={styles.startKicker}>
                Welcome Envoys
              </div>

              <div className={styles.startTitle}>
                Press to Start
              </div>

              <div className={styles.startHint}>
                Click anywhere
              </div>
            </div>
>>>>>>> origin/main
          </div>

<<<<<<< HEAD
          <div style={contentGrid}>
            {/* LEFT: Command List */}
            <div style={{ ...panelCard, position: 'relative', paddingTop: 6 }}>
              {/* ... entire left command list remains unchanged ... */}
            </div>

            {/* RIGHT: Preview panel */}
            <div style={previewWrap}>
              {/* ... entire right-side dynamic content remains unchanged ... */}
=======
        <div
          className={`${styles.menuRootBase} ${styles.menuRootTransition} ${menuStarted ? styles.menuRootShown : styles.menuRootHidden}`}
        >
          <div className={styles.menuShell}>
            <div className={styles.shellGlassBelow} />

            {/* Logo (no surrounding panel) */}
            <div className={styles.logoWrap}>
              <img
                src={koaTitle}
                alt="Knights of Avalon"
                draggable={false}
                className={`${styles.logoImg} ${nightMode ? styles.logoImgNight : styles.logoImgDay}`}
              />
            </div>

            <div className={styles.contentGrid}>
              {/* LEFT: Command List */}
              <div className={styles.leftPanelWrap}>
                <div className={styles.edgeGlow} />
                <div className={styles.leftMenuTitle}>CAMPAIGN HUB</div>

                <div className={styles.commandList}>
                  {items.map((it) => {
                    const active = it.key === activeKey;
                    return (
                      <div
                        key={it.key}
                        className={`${styles.jrpgShimmer} ${styles.cmdRow} ${active ? styles.cmdRowActive : styles.cmdRowInactive}`}
                        onMouseEnter={() => {
                          if (it.key !== activeKey) playHover();
                          setActiveKey(it.key);
                        }}
                        // IMPORTANT: clicking the row navigates (fixes “links broken”)
                        onClick={it.primary.onClick}
                        role="button"
                        tabIndex={0}
                        aria-label={it.label}
                      >
                        <div className={`${styles.selectBar} ${active ? styles.selectBarActive : styles.selectBarInactive}`} />

                        {active && (
                          <div className={styles.cursorWrap}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M7 5L19 12L7 19V5Z" fill="rgba(255,245,220,0.92)" />
                              <path d="M7 5L19 12L7 19V5Z" stroke="rgba(255,220,160,0.55)" strokeWidth="1.5" />
                            </svg>
                          </div>
                        )}

                        <div className={styles.cmdLeft}>
                          <div className={`${styles.cmdIconWrap} ${active ? styles.cmdIconWrapActive : styles.cmdIconWrapInactive}`}>
                            <Icon name={it.key} active={active} />
                          </div>
                          <div className={styles.cmdTextWrap}>
                            <div className={`${styles.cmdTitle} ${active ? styles.cmdTitleActive : styles.cmdTitleInactive}`}>{it.label}</div>
                            <div className={`${styles.cmdSub} ${active ? styles.cmdSubActive : styles.cmdSubInactive}`}>{it.sub}</div>
                          </div>
                        </div>

                        <div className={`${styles.cmdChevron} ${active ? styles.cmdChevronActive : styles.cmdChevronInactive}`}>›</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT: Useful panel (changes by selection) */}
              <div className={styles.previewWrap}>
                <div className={styles.edgeGlow} />

                {/* Fixed header — never scrolls */}
                <div className={styles.previewHeader}>
                  <h3 className={styles.previewTitle}>{activeItem.title}</h3>
                  <div className={styles.previewBody}>{activeItem.desc}</div>

                  {/* Move campaign recap into the fixed header so it appears higher */}
                  {activeKey === 'campaign' && (
                    <div className={styles.previewSectionGrid}>
                      <div className={styles.cardMini}>
                        <video
                          src={recapVideo}
                          controls
                          preload="metadata"
                          className={styles.previewVideo}
                        />
                      </div>
                    </div>
                  )}

                  {activeKey === 'combat' && (
                    <div className={styles.previewSectionGrid}>
                      <div className={styles.cardMini}>
                        <video
                          src={combatVideo}
                          autoPlay
                          loop
                          muted
                          playsInline
                          preload="auto"
                          className={styles.previewVideo}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className={`koa-divider-line ${styles.divider} ${styles.previewDivider}`} />

                {/* Scrollable body */}
                <div className={`${styles.bodyScroll} koa-scrollbar-thin`}>

                  {/* Campaign brief (moved to header) */}

                  {/* Character book helpers */}
                  {activeKey === 'characters' && (
                    <div className={styles.videoPreviewRow}>
                      <div className={styles.videoPreviewShell}>
                        <video
                          src={characterBookPreviewVideo}
                          autoPlay
                          loop
                          muted
                          playsInline
                          preload="auto"
                          className={styles.videoFill}
                        />
                      </div>
                    </div>
                  )}

                  {/* Video preview — Theater hover panel */}
                  {activeKey === 'video' && (
                    <div className={styles.videoPreviewRow}>
                      <div className={styles.videoPreviewShell}>
                        <video
                          ref={theaterPreviewRef}
                          src={theaterPreviewVideo}
                          autoPlay
                          loop
                          playsInline
                          preload="auto"
                          className={styles.videoFill}
                        />
                      </div>
                    </div>
                  )}

                  {/* Lore preview */}
                  {activeKey === 'lore' && (
                    <div className={styles.videoPreviewRow}>
                      <div className={styles.videoPreviewShell}>
                        <video
                          src={worldLoreVideo}
                          autoPlay
                          loop
                          muted
                          playsInline
                          preload="auto"
                          className={styles.videoFill}
                        />
                      </div>
                    </div>
                  )}

                </div>{/* end scrollable body */}

                <div className={styles.footerActions}>
                  {/* Primary action mirrors row click */}
                  <button
                    className={`${styles.actionBtn} koa-glass-btn koa-interactive-lift`}
                    onMouseEnter={playHover}
                    onClick={activeItem.primary.onClick}
                  >
                    {activeItem.primary.label}
                  </button>
                </div>
              </div>
>>>>>>> origin/main
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
);
}