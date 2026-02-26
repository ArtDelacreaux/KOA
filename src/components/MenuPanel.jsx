import React, { useEffect, useMemo, useRef, useState } from 'react';
import recapVideo from '../assets/recap.mp4';
import combatVideo from '../assets/CombatVideo.mp4';
import theaterPreviewVideo from '../assets/theater-preview.mp4';
import styles from './MenuPanel.module.css';

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
  const LS_CAMPAIGN_BRIEF = 'koa:menu:campaignBrief:v2';
  const LS_NOTE_PREFIX = 'koa:menu:note:v2:'; // characters / video / lore

  const [campaignBrief, setCampaignBrief] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_CAMPAIGN_BRIEF);
      const p = raw ? JSON.parse(raw) : {};
      return {
        location: p.location || '',
        objective: p.objective || '',
        updatedAt: p.updatedAt || null,
      };
    } catch {
      return { location: '', objective: '', updatedAt: null };
    }
  });

  const [notes, setNotes] = useState(() => {
    try {
      return {
        characters: localStorage.getItem(`${LS_NOTE_PREFIX}characters`) || '',
        video: localStorage.getItem(`${LS_NOTE_PREFIX}video`) || '',
        lore: localStorage.getItem(`${LS_NOTE_PREFIX}lore`) || '',
      };
    } catch {
      return { characters: '', video: '', lore: '' };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_CAMPAIGN_BRIEF, JSON.stringify(campaignBrief));
    } catch { }
  }, [campaignBrief]);

  useEffect(() => {
    try {
      localStorage.setItem(`${LS_NOTE_PREFIX}characters`, notes.characters || '');
      localStorage.setItem(`${LS_NOTE_PREFIX}video`, notes.video || '');
      localStorage.setItem(`${LS_NOTE_PREFIX}lore`, notes.lore || '');
    } catch { }
  }, [notes]);

  const theaterPreviewRef = useRef(null);

  /* ---------- theme (match your existing tavern build) ---------- */
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

    emberGlow: 'rgba(255,140,60,0.14)',
  };

  /* ---------- layout ---------- */
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

  const cmdRow = (active) => ({
    position: 'relative',
    borderRadius: 18,
    border: active ? '1px solid rgba(255,235,205,0.55)' : `1px solid ${THEME.lineSoft}`,
    background: active
      ? 'linear-gradient(90deg, rgba(132,78,20,0.36), rgba(255,245,220,0.08))'
      : 'linear-gradient(90deg, rgba(28,20,14,0.44), rgba(255,245,220,0.05))',
    boxShadow: active
      ? '0 18px 46px rgba(0,0,0,0.42), 0 0 36px rgba(255,200,120,0.22)'
      : '0 16px 40px rgba(0,0,0,0.46)',
    cursor: 'pointer',
    padding: '14px 14px 14px 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    transition: 'transform 140ms ease, filter 140ms ease, box-shadow 140ms ease, border 140ms ease',
    userSelect: 'none',
  });

  const selectBar = (active) => ({
    position: 'absolute',
    left: 12,
    top: 12,
    bottom: 12,
    width: 6,
    borderRadius: 999,
    background: active
      ? 'linear-gradient(180deg, rgba(176,101,0,0.95), rgba(255,140,60,0.70))'
      : 'rgba(255,245,220,0.10)',
    boxShadow: active ? '0 0 18px rgba(255,140,60,0.22)' : 'none',
  });

  const cmdIconWrap = (active) => ({
    width: 38,
    height: 38,
    borderRadius: 14,
    display: 'grid',
    placeItems: 'center',
    background: active
      ? 'linear-gradient(180deg, rgba(176,101,0,0.38), rgba(255,245,220,0.06))'
      : 'linear-gradient(180deg, rgba(255,245,220,0.12), rgba(255,245,220,0.04))',
    border: `1px solid ${THEME.lineSoft}`,
  });

  const cmdTitle = (active, titleColor) => ({
    fontSize: 14.5,
    fontWeight: 950,
    letterSpacing: 0.6,
    color: active ? THEME.creamText : (titleColor ?? 'rgba(255,245,220,0.90)'),
    textShadow: active
      ? '0 2px 12px rgba(0,0,0,0.80)'
      : '0 2px 10px rgba(0,0,0,0.78), 0 0 1px rgba(0,0,0,0.60)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  });

  const cmdSub = (active) => ({
    marginTop: 2,
    fontSize: 12.5,
    fontWeight: 900,
    letterSpacing: 0.3,
    color: active ? 'rgba(255,245,220,0.90)' : 'rgba(255,245,220,0.82)',
    textShadow: '0 1px 8px rgba(0,0,0,0.70)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  });

  const cmdChevron = (active) => ({
    fontWeight: 950,
    letterSpacing: 0.4,
    color: active ? 'rgba(255,220,160,0.92)' : 'rgba(255,245,220,0.55)',
    opacity: active ? 1 : 0.82,
    fontSize: 18,
  });

  // Minimal inline SVG icons to avoid extra assets.
  const Icon = ({ name, active }) => {
    const s = 18;
    const stroke = active ? THEME.creamText : 'rgba(255,245,220,0.82)';
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
        desc: 'Run encounters fast. Add/drop combatants mid-fight and track conditions.',
        primary: { label: 'Open Combat Tracker', onClick: goCombat },
      },
      {
        key: 'characters',
        label: 'Character Book',
        titleColor: 'rgba(249,234,214,0.98)',
        sub: 'Profiles, NPCs, and party bonds.',
        title: 'Character Book',
        desc: 'Quick-jump to Party or World NPCs. Keep post-session updates here.',
        primary: { label: 'Open Character Book', onClick: () => goCharacters('grid') },
      },
      {
        key: 'video',
        label: 'Theater',
        titleColor: 'rgba(252,239,221,0.98)',
        sub: 'Cinematic scenes & mood setting.',
        title: 'Cinematics',
        desc: 'Set the stage. Open the Theater to play your intro and outro cinematics.',
        primary: { label: 'Open Cinematics', onClick: goVideo },
      },
      {
        key: 'lore',
        label: 'World Lore',
        sub: 'Codex, maps, and setting archive.',
        title: 'World Lore',
        desc: 'Browse maps, scenes, and locations. Watch the world introduction video.',
        primary: { label: 'Open', onClick: goLore },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playNav, cinematicNav, cinematicDo, setPanelType, setSelectedChar, setSelectedNpc, setCharView, setVideoChoice]
  );

  const [activeKey, setActiveKey] = useState('campaign');

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

  return (
    <>
      <div
        className={styles.menuPanel}
        style={panelStyle(panelType === 'menu')}
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
          </div>
        )}

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
                        className={styles.jrpgShimmer}
                        style={cmdRow(active)}
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
                        <div style={selectBar(active)} />

                        {active && (
                          <div className={styles.cursorWrap}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M7 5L19 12L7 19V5Z" fill="rgba(255,245,220,0.92)" />
                              <path d="M7 5L19 12L7 19V5Z" stroke="rgba(255,220,160,0.55)" strokeWidth="1.5" />
                            </svg>
                          </div>
                        )}

                        <div className={styles.cmdLeft}>
                          <div style={cmdIconWrap(active)}>
                            <Icon name={it.key} active={active} />
                          </div>
                          <div className={styles.cmdTextWrap}>
                            <div className={styles.cmdTitle} style={cmdTitle(active, it.titleColor)}>{it.label}</div>
                            <div className={styles.cmdSub} style={cmdSub(active)}>{it.sub}</div>
                          </div>
                        </div>

                        <div className={styles.cmdChevron} style={cmdChevron(active)}>›</div>
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
                    <div className={styles.sectionGrid}>
                      {menuBackdrop && (
                        <div
                          aria-hidden
                          className={styles.characterBackdrop}
                          style={{ backgroundImage: `url(${menuBackdrop})` }}
                        >
                        </div>
                      )}


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

                  {/* Lore panel CTA */}
                  {activeKey === 'lore' && (
                    <div className={styles.sectionGrid}>
                      <div className={styles.cardMini}>
                        <div className={styles.label}>World Lore Archive</div>
                        <div className={styles.loreBody}>
                          Access the full compendium — introduction video, maps, campaign scenes, and notable locations.
                        </div>
                        <div className={styles.loreActions}>
                          <button className={`${styles.actionBtn} koa-glass-btn koa-interactive-lift`} onMouseEnter={playHover} onClick={goLore}>
                            Open World Lore
                          </button>
                        </div>
                      </div>
                      <div className={styles.cardMini}>
                        <div className={styles.label}>Lore Scratchpad</div>
                        <textarea
                          value={notes.lore}
                          onChange={(e) => setNotes((n) => ({ ...n, lore: e.target.value }))}
                          placeholder="Factions, locations, mysteries…"
                          className={styles.loreTextarea}
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
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
