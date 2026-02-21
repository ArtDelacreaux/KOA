import React, { useEffect, useMemo, useState } from 'react';
import recapVideo from '../assets/recap.mp4';

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

  cinematicNav,
  cinematicDo,

  setPanelType,
  setSelectedChar,
  setSelectedNpc,
  setCharView,
  setVideoChoice,

  playHover = () => {},
  // optional; TavernMenu may or may not pass it
  playNav = () => {},
  playMenuOpen = () => {},
  onMenuStarted = () => {},
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
    } catch {}
  }, [campaignBrief]);

  useEffect(() => {
    try {
      localStorage.setItem(`${LS_NOTE_PREFIX}characters`, notes.characters || '');
      localStorage.setItem(`${LS_NOTE_PREFIX}video`, notes.video || '');
      localStorage.setItem(`${LS_NOTE_PREFIX}lore`, notes.lore || '');
    } catch {}
  }, [notes]);

  const stamp = () => new Date().toISOString();
  const prettyTime = (iso) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleString();
    } catch {
      return '—';
    }
  };

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

  const fontStack = "'Cinzel', 'Trajan Pro', 'Times New Roman', serif";

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

  const menuRoot = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: 14,
    paddingTop: '2vh',
    position: 'relative',
    fontFamily: fontStack,
  };

  const LOGO_CLEAR_H = 18; // px from top for the floating logo // px of clear (non-frosted) area behind the logo

  const menuShell = {
    width: 'min(1320px, 96vw)',
    height: 'min(960px, 94vh)',
    position: 'relative',
    background: 'transparent',
    // Layout wrapper only — no visible “outer window”
    border: 'none',
    boxShadow: 'none',
    borderRadius: 0,
    overflow: 'visible',
  };
  const shellGlassBelow = {
    display: 'none', // backmost frosted window disabled (shell stays for layout)
  };


  const overlayVignette = {
	  position: 'absolute',
	  left: 0,
	  right: 0,
	  top: LOGO_CLEAR_H,      // 👈 add this
	  bottom: 0,
	  // keep the rest the same
};

  const grain = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    opacity: 0.085,
    background:
      'repeating-linear-gradient(180deg, rgba(255,255,255,0.11) 0px, rgba(255,255,255,0.11) 1px, rgba(0,0,0,0) 4px, rgba(0,0,0,0) 7px)',
    mixBlendMode: 'overlay',
  };

  const topBar = {
    position: 'absolute',
    top: LOGO_CLEAR_H,
    left: 0,
    right: 0,
    zIndex: 3,
    padding: '14px 18px 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    background: 'transparent',
  };

  const chip = {
    padding: '7px 10px',
    borderRadius: 999,
    border: `1px solid ${THEME.line}`,
    background: 'rgba(255,245,220,0.06)',
    color: THEME.creamSoft,
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0.35,
    userSelect: 'none',
    boxShadow: '0 10px 28px rgba(0,0,0,0.25)',
    whiteSpace: 'nowrap',
    justifySelf: 'start',
  };

  const logoCenter = {
    
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  };

  const logoImg = {
    width: 'min(1180px, 96vw)',
    height: 'auto',
    maxHeight: 'clamp(220px, 28vh, 340px)',
    objectFit: 'contain',
    userSelect: 'none',
    pointerEvents: 'none',
    filter: 'drop-shadow(0 22px 54px rgba(0,0,0,0.85))',
    animation: 'logoSparkle 4s ease-in-out infinite',
  };

  const logoSub = {
    color: 'rgba(255,245,220,0.70)',
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    textShadow: '0 2px 10px rgba(0,0,0,0.65)',
    userSelect: 'none',
    textAlign: 'center',
    lineHeight: 1.1,
  };


  const leftMenuTitle = {
    margin: '10px 0 4px 16px',
    fontSize: 12,
    letterSpacing: 2.2,
    fontWeight: 950,
    color: THEME.creamText,
    textShadow: '0 2px 12px rgba(0,0,0,0.55)',
    userSelect: 'none',
  };


  const rightChips = {
    justifySelf: 'end',
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
  };

  const contentGrid = {
    position: 'absolute',
    inset: 0,
    padding: '0 20px 26px',
    paddingTop: 'clamp(290px, 36vh, 380px)',
    display: 'grid',
    gridTemplateColumns: 'min(520px, 44%) minmax(0, 1fr)',
    gap: 18,
  };

  const panelCard = {
    borderRadius: 22,
    position: 'relative',
    overflow: 'hidden',
    border: `1px solid ${THEME.line}`,
    background: `linear-gradient(180deg, ${THEME.glassA}, ${THEME.glassB})`,
    boxShadow: '0 22px 60px rgba(0,0,0,0.52)',
    backdropFilter: 'blur(10px)',
  };

  const edgeGlow = {
    position: 'absolute',
    inset: -2,
    borderRadius: 24,
    pointerEvents: 'none',
    background: 'linear-gradient(135deg, rgba(176,101,0,0.34), rgba(255,140,60,0.18), rgba(255,80,80,0.14))',
    filter: 'blur(18px)',
    opacity: 0.46,
  };

  const divider = {
    height: 1,
    background: 'linear-gradient(90deg, transparent, rgba(255,220,160,0.18), transparent)',
    margin: '8px 0',
    opacity: 0.9,
  };

  /* ---------- left: commands ---------- */
  const commandList = {
    padding: '16px 14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  };

  const cmdRow = (active) => ({
    position: 'relative',
    borderRadius: 18,
    border: active ? '1px solid rgba(255,235,205,0.55)' : `1px solid ${THEME.lineSoft}`,
    background: active
      ? 'linear-gradient(90deg, rgba(176,101,0,0.22), rgba(255,245,220,0.06))'
      : 'linear-gradient(90deg, rgba(255,245,220,0.06), rgba(255,245,220,0.03))',
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

  const cursorWrap = {
    position: 'absolute',
    left: -6,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 22,
    height: 22,
    pointerEvents: 'none',
    filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.55))',
  };

  const cmdLeft = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  };

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

  const cmdTitle = (active) => ({
    fontSize: 14.5,
    fontWeight: 950,
    letterSpacing: 0.6,
    color: active ? THEME.creamText : 'rgba(255,245,220,0.90)',
    textShadow: '0 2px 10px rgba(0,0,0,0.60)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  });

  const cmdSub = {
    marginTop: 2,
    fontSize: 11.5,
    fontWeight: 850,
    letterSpacing: 0.3,
    color: 'rgba(255,245,220,0.68)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const cmdChevron = (active) => ({
    fontWeight: 950,
    letterSpacing: 0.4,
    color: active ? 'rgba(255,220,160,0.92)' : 'rgba(255,245,220,0.55)',
    opacity: active ? 1 : 0.82,
    fontSize: 18,
  });

  /* ---------- right: content ---------- */
  const previewWrap = {
    ...panelCard,
    padding: 18,
    paddingBottom: 22,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    overflow: 'hidden', // clip the card itself
    position: 'relative',
  };

  const previewTitle = {
    fontSize: 20,
    fontWeight: 950,
    letterSpacing: 0.65,
    color: THEME.creamText,
    textShadow: '0 2px 12px rgba(0,0,0,0.65)',
    margin: 0,
  };

  const previewBody = {
    color: 'rgba(255,245,220,0.82)',
    fontSize: 13.5,
    lineHeight: 1.65,
    fontWeight: 850,
    letterSpacing: 0.2,
  };

  const cardMini = {
    borderRadius: 18,
    border: `1px solid ${THEME.lineSoft}`,
    background: 'linear-gradient(180deg, rgba(255,245,220,0.06), rgba(255,245,220,0.03))',
    padding: 16,
    boxShadow: '0 18px 46px rgba(0,0,0,0.42)',
  };

  const label = {
    color: 'rgba(255,245,220,0.72)',
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: 0.45,
  };

  const input = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    borderRadius: 14,
    border: `1px solid ${THEME.lineSoft}`,
    background: 'rgba(0,0,0,0.18)',
    color: THEME.creamText,
    outline: 'none',
    fontWeight: 850,
    fontSize: 13,
    fontFamily: fontStack,
  };

  const textarea = {
    ...input,
    minHeight: 96,
    resize: 'vertical',
    lineHeight: 1.5,
  };

  const actionBtn = {
    padding: '12px 14px',
    borderRadius: 16,
    border: `1px solid ${THEME.line}`,
    background: `linear-gradient(180deg, ${THEME.glassA}, ${THEME.glassB})`,
    backdropFilter: 'blur(12px)',
    cursor: 'pointer',
    color: THEME.creamText,
    fontWeight: 950,
    letterSpacing: 0.45,
    textShadow: '0 2px 10px rgba(0,0,0,0.55)',
    boxShadow: '0 18px 40px rgba(0,0,0,0.42)',
    transition: 'transform 140ms ease, filter 140ms ease, box-shadow 140ms ease',
    userSelect: 'none',
    fontFamily: fontStack,
  };

  const ghostBtn = {
    padding: '10px 12px',
    borderRadius: 14,
    border: `1px solid ${THEME.line}`,
    background: `linear-gradient(180deg, ${THEME.glassA}, ${THEME.glassB})`,
    backdropFilter: 'blur(12px)',
    cursor: 'pointer',
    color: THEME.creamText,
    fontWeight: 950,
    letterSpacing: 0.35,
    boxShadow: '0 14px 34px rgba(0,0,0,0.35)',
    transition: 'transform 140ms ease, filter 140ms ease, box-shadow 140ms ease',
    userSelect: 'none',
    fontFamily: fontStack,
  };

  const dangerBtn = {
    ...ghostBtn,
    border: '1px solid rgba(255,160,160,0.22)',
    background: `linear-gradient(180deg, ${THEME.dangerA}, ${THEME.dangerB})`,
  };

  const btnHover = (e) => {
    e.currentTarget.style.transform = 'translateY(-1px)';
    e.currentTarget.style.filter = 'brightness(1.12)';
    e.currentTarget.style.boxShadow = '0 22px 60px rgba(0,0,0,0.55)';
  };

  const btnLeave = (e) => {
    e.currentTarget.style.transform = 'translateY(0px)';
    e.currentTarget.style.filter = 'none';
    e.currentTarget.style.boxShadow = '0 14px 34px rgba(0,0,0,0.38)';
  };

  const btnDown = (e) => {
    e.currentTarget.style.transform = 'translateY(1px) scale(0.99)';
    e.currentTarget.style.filter = 'brightness(0.98)';
  };

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
        sub: 'Return to the hub and resume your session.',
        title: 'Session Brief',
        desc: 'Keep the table oriented. Update these before you hit Continue.',
        primary: { label: 'Continue', onClick: goCampaign },
      },
      {
        key: 'characters',
        label: 'Character Book',
        sub: 'Profiles, NPCs, and party bonds.',
        title: 'Character Book',
        desc: 'Quick-jump to Party or World NPCs. Keep post-session updates here.',
        primary: { label: 'Open Character Book', onClick: () => goCharacters('grid') },
      },
      {
        key: 'video',
        label: 'Theater',
        sub: 'Cinematic scenes & mood setting.',
        title: 'Cinematics',
        desc: 'Queue intro/outro reminders so you actually use them.',
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
    try { playMenuOpen(); } catch (e) {}
	try { onMenuStarted(); } catch (e) {}
    setStartFading(true);
    window.setTimeout(() => {
      setMenuStarted(true);
    }, 520);
  };

  const activeItem = items.find((i) => i.key === activeKey) || items[0];

  return (
  <>
    <div style={panelStyle(panelType === 'menu')}
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
        @keyframes shimmerSweep {
          from { transform: translateX(-120%) skewX(-18deg); opacity: 0; }
          30% { opacity: 0.65; }
          to { transform: translateX(220%) skewX(-18deg); opacity: 0; }
        }
        @keyframes cursorBob {
          0% { transform: translateY(-50%) translateX(0px); opacity: 0.90; }
          50% { transform: translateY(-50%) translateX(3px); opacity: 1; }
          100% { transform: translateY(-50%) translateX(0px); opacity: 0.90; }
        }
        .jrpgShimmer::after{
          content:"";
          position:absolute;
          top:-30%;
          left:-40%;
          width:55%;
          height:160%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent);
          transform: skewX(-18deg);
          opacity:0;
          pointer-events:none;
        }
        .jrpgShimmer:hover::after{
          opacity:1;
          animation: shimmerSweep 720ms ease forwards;
        }
        @keyframes logoSparkle {
          0%   { filter: drop-shadow(0 22px 54px rgba(0,0,0,0.85)) brightness(1) drop-shadow(0 0 0px rgba(255,255,255,0)); }
          30%  { filter: drop-shadow(0 22px 54px rgba(0,0,0,0.85)) brightness(1.08) drop-shadow(0 0 18px rgba(255,240,200,0.45)) drop-shadow(0 0 40px rgba(255,200,120,0.20)); }
          50%  { filter: drop-shadow(0 22px 54px rgba(0,0,0,0.85)) brightness(1.14) drop-shadow(0 0 28px rgba(255,255,255,0.55)) drop-shadow(0 0 60px rgba(255,220,160,0.28)); }
          70%  { filter: drop-shadow(0 22px 54px rgba(0,0,0,0.85)) brightness(1.08) drop-shadow(0 0 18px rgba(255,240,200,0.40)) drop-shadow(0 0 40px rgba(255,200,120,0.18)); }
          100% { filter: drop-shadow(0 22px 54px rgba(0,0,0,0.85)) brightness(1) drop-shadow(0 0 0px rgba(255,255,255,0)); }
        }

        .jrpgShimmer:hover .cmd-title {
          color: rgba(20,10,2,0.95) !important;
          text-shadow: none !important;
        }
        .jrpgShimmer:hover .cmd-sub {
          color: rgba(40,20,5,0.90) !important;
        }
        .jrpgShimmer:hover .cmd-chevron {
          color: rgba(140,70,10,0.95) !important;
        }
      `}</style>
      {/* PRESS TO START overlay */}
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
            if (e.key === 'Enter' || e.key === ' ') startMenu(nMenuStarted = () => {});
          }}
          role="button"
          tabIndex={0}
          aria-label="Press to start"
        >
          <div
            style={{
              width: 'min(560px, 92vw)',
              borderRadius: 22,
              padding: '18px 18px 16px',
              border: `1px solid ${THEME.line}`,
              background: `linear-gradient(180deg, rgba(255,245,220,0.10), rgba(255,245,220,0.04))`,
              boxShadow: '0 22px 60px rgba(0,0,0,0.55)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 14,
                letterSpacing: 2.6,
                fontWeight: 950,
                color: 'rgba(255,245,220,0.85)',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              Welcome Envoys
            </div>

            <div
              style={{
                fontSize: 26,
                fontWeight: 950,
                letterSpacing: 0.8,
                color: THEME.creamText,
                textShadow: '0 2px 18px rgba(0,0,0,0.65)',
              }}
            >
              Press to Start
            </div>

            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: 0.5,
                color: 'rgba(255,245,220,0.70)',
              }}
            >
              Click anywhere
            </div>
          </div>
        </div>
      )}


      <div style={{ ...menuRoot, opacity: menuStarted ? 1 : 0, transform: menuStarted ? 'translateY(0px)' : 'translateY(8px)', transition: 'opacity 520ms ease, transform 520ms ease', pointerEvents: menuStarted ? 'auto' : 'none' }}>
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
			</div>

          <div style={contentGrid}>
            {/* LEFT: Command List */}
            <div style={{ ...panelCard, position: 'relative', paddingTop: 6 }}>
              <div style={edgeGlow} />
              <div style={leftMenuTitle}>CAMPAIGN HUB</div>

              <div style={commandList}>
                {items.map((it) => {
                  const active = it.key === activeKey;
                  return (
                    <div
                      key={it.key}
                      className="jrpgShimmer"
                      style={cmdRow(active)}
                      onMouseEnter={() => {
                        if (it.key !== activeKey) playHover();
                        setActiveKey(it.key);
                      }}
                      onMouseDown={(e) => {
                        e.currentTarget.style.transform = 'translateY(1px) scale(0.995)';
                        e.currentTarget.style.filter = 'brightness(0.98)';
                      }}
                      onMouseUp={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.filter = 'brightness(1.06)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0px)';
                        e.currentTarget.style.filter = 'none';
                      }}
                      // IMPORTANT: clicking the row navigates (fixes “links broken”)
                      onClick={it.primary.onClick}
                      role="button"
                      tabIndex={0}
                      aria-label={it.label}
                    >
                      <div style={selectBar(active)} />

                      {active && (
                        <div style={{ ...cursorWrap, animation: 'cursorBob 760ms ease-in-out infinite' }}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7 5L19 12L7 19V5Z" fill="rgba(255,245,220,0.92)" />
                            <path d="M7 5L19 12L7 19V5Z" stroke="rgba(255,220,160,0.55)" strokeWidth="1.5" />
                          </svg>
                        </div>
                      )}

                      <div style={cmdLeft}>
                        <div style={cmdIconWrap(active)}>
                          <Icon name={it.key} active={active} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="cmd-title" style={cmdTitle(active)}>{it.label}</div>
                          <div className="cmd-sub" style={cmdSub}>{it.sub}</div>
                        </div>
                      </div>

                      <div className="cmd-chevron" style={cmdChevron(active)}>›</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT: Useful panel (changes by selection) */}
            <div style={previewWrap}>
              <div style={edgeGlow} />

              {/* Fixed header — never scrolls */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <h3 style={previewTitle}>{activeItem.title}</h3>
                <div style={previewBody}>{activeItem.desc}</div>
              </div>

              <div style={{ ...divider, flexShrink: 0 }} />

              {/* Scrollable body */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  paddingRight: 4,
                  /* thin custom scrollbar */
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(176,101,0,0.45) transparent',
                }}
              >

              {/* Campaign brief */}
              {activeKey === 'campaign' && (
                <div style={{ display: 'grid', gap: 14 }}>
                  <div style={cardMini}>
                    <div style={label}>Session Recap</div>

                    <div
                      style={{
                        marginTop: 8,
                        borderRadius: 16,
                        overflow: 'hidden',
                        border: '1px solid rgba(255,220,160,0.18)',
                        boxShadow: '0 14px 34px rgba(0,0,0,0.35)',
                      }}
                    >
                      <video
                        src={recapVideo}
                        controls
                        preload="metadata"
                        style={{
                          width: '100%',
                          height: 'clamp(180px, 26vh, 320px)',
                          display: 'block',
                          objectFit: 'cover',
                          background: 'rgba(0,0,0,0.25)',
                        }}
                      />
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        color: 'rgba(255,245,220,0.62)',
                        fontSize: 12,
                        fontWeight: 900,
                        lineHeight: 1.5,
                      }}
                    >
                      Tip: Keep a quick 30–90s recap here to re-sync the table fast.
                    </div>
                  </div>
                </div>
              )}

              {/* Character book helpers */}
              {activeKey === 'characters' && (
                <div style={{ display: 'grid', gap: 14 }}>
                  {menuBackdrop && (
                    <div
                      aria-hidden
                      style={{
					  height: 'clamp(200px, 30vh, 340px)',
					  borderRadius: 18,
					  overflow: 'hidden',
					  border: '1px solid rgba(255,220,160,0.18)',
					  boxShadow: '0 18px 40px rgba(0,0,0,0.45)',
					  backgroundImage: `url(${menuBackdrop})`,
					  backgroundSize: 'cover',
					  backgroundPosition: 'center center',
					  backgroundRepeat: 'no-repeat',
					  position: 'relative',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background:
                            'linear-gradient(180deg, rgba(8,10,14,0.10), rgba(8,10,14,0.45))',
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          boxShadow:
                            'inset 0 0 0 2px rgba(255,240,210,0.06), inset 0 -28px 60px rgba(0,0,0,0.55)',
                          pointerEvents: 'none',
                        }}
                      />
                    </div>
                  )}

                  <div style={cardMini}>
                    <div style={label}>Quick Jump</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                      <button
                        style={ghostBtn}
                        onMouseEnter={btnHover}
                        onMouseLeave={btnLeave}
                        onMouseDown={btnDown}
                        onClick={() => goCharacters('grid')}
                      >
                        Party
                      </button>
                      <button
                        style={ghostBtn}
                        onMouseEnter={btnHover}
                        onMouseLeave={btnLeave}
                        onMouseDown={btnDown}
                        onClick={() => goCharacters('worldnpcs')}
                      >
                        World NPCs
                      </button>
                    </div>

                    <div style={{ marginTop: 12, color: 'rgba(255,245,220,0.62)', fontSize: 12, fontWeight: 900, lineHeight: 1.5 }}>
                      Use this after sessions: update relationship notes and drop new NPCs.
                    </div>
                  </div>
                </div>
              )}

              {/* Video helpers */}
              {activeKey === 'video' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div style={cardMini}>
                    <div style={label}>Cinematic Reminders</div>
                    <textarea
                      value={notes.video}
                      onChange={(e) => setNotes((n) => ({ ...n, video: e.target.value }))}
                      placeholder="When do you want to play Intro/Outro?"
                      style={{ ...textarea, marginTop: 8 }}
                    />
                  </div>

                  <div style={cardMini}>
                    <div style={label}>Quick Actions</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                      <button
                        style={ghostBtn}
                        onMouseEnter={btnHover}
                        onMouseLeave={btnLeave}
                        onMouseDown={btnDown}
                        onClick={goVideo}
                      >
                        Open Panel
                      </button>
                      <button
                        style={dangerBtn}
                        onMouseEnter={btnHover}
                        onMouseLeave={btnLeave}
                        onMouseDown={btnDown}
                        onClick={() => {
                          // Convenience: open panel and leave selection null (user chooses intro/outro there)
                          goVideo();
                        }}
                      >
                        Ready Cinematics
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Lore panel CTA */}
              {activeKey === 'lore' && (
                <div style={{ display: 'grid', gap: 14 }}>
                  <div style={cardMini}>
                    <div style={label}>World Lore Archive</div>
                    <div style={{ marginTop: 10, color: 'rgba(255,245,220,0.62)', fontSize: 12, fontWeight: 900, lineHeight: 1.6 }}>
                      Access the full compendium — introduction video, maps, campaign scenes, and notable locations.
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                      <button style={actionBtn} onMouseEnter={btnHover} onMouseLeave={btnLeave} onMouseDown={btnDown} onClick={goLore}>
                        Open World Lore
                      </button>
                    </div>
                  </div>
                  <div style={cardMini}>
                    <div style={label}>Lore Scratchpad</div>
                    <textarea
                      value={notes.lore}
                      onChange={(e) => setNotes((n) => ({ ...n, lore: e.target.value }))}
                      placeholder="Factions, locations, mysteries…"
                      style={{ ...textarea, marginTop: 8 }}
                    />
                  </div>
                </div>
              )}

              </div>{/* end scrollable body */}

              <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', paddingTop: 4 }}>
                {/* Primary action mirrors row click */}
                <button
                  style={actionBtn}
                  onMouseEnter={btnHover}
                  onMouseLeave={btnLeave}
                  onMouseDown={btnDown}
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