// ===== TAVERN MENU — ROOT CONTROLLER (RESTORED FX + FIXED LAYOUT + NAV-ONLY SFX) =====
import React, { useState, useRef, useEffect, useMemo } from 'react';

//Components Pages
import AudioHUD from './components/AudioHUD';
import MenuPanel from './components/MenuPanel';
import CampaignHub from './components/CampaignHub';
import CharacterBook from './components/CharacterBook';
import VideoPanel from './components/VideoPanel';
import WorldLore from './components/WorldLore';
import CombatPanel from './components/CombatPanel';

//Assets
import background from './assets/background.jpeg';
import tavernBgVideo from './assets/BackgroundLoop.mp4';
import tavernMusic from './assets/music.mp3';
import fireCrackle from './assets/fire_crackle.mp3';
import koaTitle from './assets/koaTitle.png';

// Shared roster (Character Book + Combat)
import { DEFAULT_CHARACTERS } from './data/characters';

// ✅ SFX
import pageFlip from './assets/PageFlip.mp3';
import hoverSfx from './assets/Hover.mp3';
import buttonSfx from './assets/Button.mp3';
import menuOpenSfx from './assets/MenuOpen.mp3';

/* ---------- hooks ---------- */
function useLocalStorageState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  return [value, setValue];
}

function useAudioLoop(ref, { volume, loop = true }) {
  useEffect(() => {
    if (!ref.current) return;
    ref.current.loop = loop;
    ref.current.volume = volume;
  }, [ref, volume, loop]);
}

/* ---------- component ---------- */
export default function TavernMenu() {
  /* ================= STATE ================= */
  const [musicOn, setMusicOn] = useState(false);
  const [panelType, setPanelType] = useState('menu');
  const [bgVideoReady, setBgVideoReady] = useState(false);

  const [selectedChar, setSelectedChar] = useState(null);
  const [charView, setCharView] = useState('grid');
  const [selectedNpc, setSelectedNpc] = useState(null);

  const [campaignTab, setCampaignTab] = useState('launcher');

  // ✅ Shared party roster (single source of truth)
  const [characters, setCharacters] = useLocalStorageState('koa:characters:v2', DEFAULT_CHARACTERS);

  const [quests, setQuests] = useLocalStorageState('koa:quests:v2', []);
  const [questModalOpen, setQuestModalOpen] = useState(false);
  const [editingQuestId, setEditingQuestId] = useState(null);
  const [questDraft, setQuestDraft] = useState({
    title: '',
    type: 'Side',
    giver: '',
    location: '',
    description: '',
  });

  const [relationshipValues, setRelationshipValues] = useLocalStorageState('koa:relationships:v1', {});

  const [videoChoice, setVideoChoice] = useState(null);
  const videoRef = useRef(null);

  const [musicVol, setMusicVol] = useState(0.06);
  const [fireVol, setFireVol] = useState(0.07);
  const [showMix, setShowMix] = useState(false);

  // ✅ SFX volumes
  const [hoverVol] = useState(0.22);
  const [uiNavVol] = useState(0.28);

  const [isFading, setIsFading] = useState(false);
  const pendingActionRef = useRef(null);
  const fadeTimersRef = useRef({ t1: null, t2: null });

  const musicRef = useRef(null);
  const fireRef = useRef(null);
  const pageFlipRef = useRef(null);

  // ✅ SFX refs
  const hoverRef = useRef(null);
  const uiNavRef = useRef(null);
  const menuOpenRef = useRef(null);

  // ✅ anti-machinegun hover
  const lastHoverAtRef = useRef(0);

  const INTRO_SRC = 'https://www.youtube.com/embed/x_shzgJZUwU?autoplay=1&controls=0&loop=1&playlist=x_shzgJZUwU&modestbranding=1&rel=0';
  const OUTRO_SRC = '/outro.mp4';

  /* ================= HELPERS ================= */
  const clamp0100 = (n) => Math.max(0, Math.min(100, n));
  const heatColor = (v) => (v <= 45 ? '#2563eb' : v >= 55 ? '#dc2626' : '#6b7280');

  // silent helper
  const silentClick = () => {};

  // ✅ Hover SFX
  const playHover = () => {
    const now = Date.now();
    if (now - lastHoverAtRef.current < 80) return;
    lastHoverAtRef.current = now;

    const a = hoverRef.current;
    if (!a) return;
    a.volume = hoverVol;
    try {
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch {}
  };

  // ✅ Navigation click SFX (Button.mp3) — NAVIGATION ONLY
  const playNavClick = () => {
    const a = uiNavRef.current;
    if (!a) return;
    a.volume = uiNavVol;
    try {
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch {}
  };

  // ✅ Menu open SFX (MenuOpen.mp3) — used by "Press to Start"
  const playMenuOpen = () => {
    const a = menuOpenRef.current;
    if (!a) return;
    a.volume = uiNavVol; // reuse UI volume knob
    try {
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch {}
  };


  /* ================= BACKGROUND MOTES ================= */
  const motes = useMemo(() => {
    const arr = Array.from({ length: 120 }).map((_, i) => {
      const seed = (i + 1) * 999;
      const rnd = (n) => {
        const x = Math.sin(seed * n) * 10000;
        return x - Math.floor(x);
      };
      return {
        id: i,
        left: `${Math.floor(rnd(1.1) * 100)}%`,
        top: `${Math.floor(rnd(2.2) * 100)}%`,
        size: 3 + Math.floor(rnd(3.3) * 6),
        dur: 4 + Math.floor(rnd(4.4) * 6),
        delay: Math.floor(rnd(5.5) * 6),
        drift: -55 + Math.floor(rnd(6.6) * 110),
        opacity: 0.38 + rnd(7.7) * 0.40,
      };
    });
    return arr;
  }, []);

  /* ================= AUDIO ================= */
  useAudioLoop(musicRef, { volume: musicVol, loop: true });
  useAudioLoop(fireRef, { volume: fireVol, loop: true });

  const toggleAudio = () => {
    if (!musicRef.current || !fireRef.current) return;

    musicRef.current.volume = musicVol;
    fireRef.current.volume = fireVol;

    if (!musicOn) {
      musicRef.current.play().catch(() => {});
      fireRef.current.play().catch(() => {});
    } else {
      musicRef.current.pause();
      fireRef.current.pause();
    }
    setMusicOn(!musicOn);
  };

  const autoPlayAudio = () => {
    if (musicOn) return; // already playing
    if (!musicRef.current || !fireRef.current) return;
    musicRef.current.volume = musicVol;
    fireRef.current.volume = fireVol;
    musicRef.current.play().catch(() => {});
    fireRef.current.play().catch(() => {});
    setMusicOn(true);
  };
  
  const pauseAmbient = () => {
    if (musicRef.current) musicRef.current.pause();
    if (fireRef.current)  fireRef.current.pause();
  };

  const resumeAmbient = () => {
    // Only resume if audio was on to begin with
    if (!musicOn) return;
    if (musicRef.current) musicRef.current.play().catch(() => {});
    if (fireRef.current)  fireRef.current.play().catch(() => {});
  };


  const FADE_TOTAL_MS = 260;
  const SWITCH_AT_MS = 110;

  useEffect(() => {
    return () => {
      const { t1, t2 } = fadeTimersRef.current;
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, []);

  // flip is ONLY for: main menu buttons + "Back to Menu"
  const cinematicDo = (action, { flip = true } = {}) => {
    if (isFading) return;

    const { t1, t2 } = fadeTimersRef.current;
    if (t1) clearTimeout(t1);
    if (t2) clearTimeout(t2);

    pendingActionRef.current = action;

    if (flip) {
      const flipA = pageFlipRef.current;
      if (flipA) {
        flipA.currentTime = 0;
        flipA.play().catch(() => {});
      }
    }

    setIsFading(true);

    fadeTimersRef.current.t1 = setTimeout(() => {
      if (pendingActionRef.current) pendingActionRef.current();
    }, SWITCH_AT_MS);

    fadeTimersRef.current.t2 = setTimeout(() => {
      setIsFading(false);
      pendingActionRef.current = null;
    }, FADE_TOTAL_MS);
  };

  // flip defaults ON (menu buttons + back to menu will use this)
  const cinematicNav = (nextPanel, { flip = true } = {}) => {
    cinematicDo(() => {
      setPanelType(nextPanel);

      if (nextPanel !== 'video') {
        setVideoChoice(null);
        if (videoRef.current) {
          try {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
          } catch {}
        }
      }

      if (nextPanel !== 'characters') {
        setSelectedChar(null);
        setSelectedNpc(null);
        setCharView('grid');
      }

      if (nextPanel === 'campaign') setCampaignTab('launcher');
    }, { flip });
  };

  // play video selection is NAV click (Button.mp3), NOT page flip
  const playVideo = (which) => {
    cinematicDo(() => {
      setPanelType('video');
      setVideoChoice(which);

      setTimeout(() => {
        const v = videoRef.current;
        if (!v) return;
        // Only call play() on real <video> elements, not YouTube iframes
        if (typeof v.play === 'function') {
          v.currentTime = 0;
          v.volume = 0.18;
          v.play().catch(() => {});
        }
      }, 30);
    }, { flip: false });
  };

  const stopVideo = () => {
    const v = videoRef.current;
    if (v) {
      try {
        // Only call pause/currentTime on real <video> elements
        if (typeof v.pause === 'function') {
          v.pause();
          v.currentTime = 0;
        }
      } catch {}
    }
    setVideoChoice(null);
  };

  /* ================= RENDER ================= */
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', color: 'white', fontFamily: 'serif' }}>
      {/* Background video (preferred) */}
      <video
        src={tavernBgVideo}
        autoPlay
        muted
        loop
        playsInline
        onCanPlay={() => setBgVideoReady(true)}
        onError={() => setBgVideoReady(false)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          pointerEvents: 'none',
          zIndex: 0,
          opacity: bgVideoReady ? 1 : 0,
          transition: 'opacity 260ms ease',
        }}
      />

      {/* Background image fallback (NEVER blocks clicks) */}
      <img
        src={background}
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          pointerEvents: 'none',
          zIndex: 0,
          opacity: bgVideoReady ? 0 : 1,
          transition: 'opacity 260ms ease',
        }}
      />

      {/* Vignette (NEVER blocks clicks) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.78) 100%)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* Dust motes (NEVER block clicks) */}
      {motes.map((m) => (
        <div
          key={m.id}
          style={{
            position: 'absolute',
            left: m.left,
            top: m.top,
            width: m.size,
            height: m.size,
            borderRadius: 999,
            background: 'rgba(255,210,140,1)',
            opacity: m.opacity,
            zIndex: 2,
            filter: 'blur(0.2px)',
            animation: `moteFloat ${m.dur}s linear ${m.delay}s infinite`,
            transform: `translateX(0px) translateY(0px)`,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Fast cinematic fade overlay (NEVER blocks clicks) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.92)',
          opacity: isFading ? 1 : 0,
          transition: `opacity ${FADE_TOTAL_MS}ms ease`,
          zIndex: 50,
          pointerEvents: 'none',
        }}
      />

      {/* CSS polish (motes animation) */}
      <style>{`
        @keyframes moteFloat {
          0% { transform: translateY(0px) translateX(0px); opacity: 0; }
          10% { opacity: 0.85; }
          70% { opacity: 0.45; }
          100% { transform: translateY(-190px) translateX(70px); opacity: 0; }
        }
      `}</style>

      {/* Audio */}
      <audio ref={musicRef} src={tavernMusic} />
      <audio ref={fireRef} src={fireCrackle} />
      <audio ref={pageFlipRef} src={pageFlip} preload="auto" />

      {/* SFX */}
      <audio ref={hoverRef} src={hoverSfx} preload="auto" />
      <audio ref={uiNavRef} src={buttonSfx} preload="auto" />
      <audio ref={menuOpenRef} src={menuOpenSfx} preload="auto" />

      {/* HUD (always above panels; only HUD captures clicks) */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 80, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, pointerEvents: 'auto' }}>
          <AudioHUD
            musicOn={musicOn}
            toggleAudio={toggleAudio}
            showMix={showMix}
            setShowMix={setShowMix}
            musicVol={musicVol}
            setMusicVol={setMusicVol}
            fireVol={fireVol}
            setFireVol={setFireVol}
            playHover={playHover}
            // HUD is NOT navigation; keep it silent
            playButton={silentClick}
          />
        </div>
      </div>

      {/* Panels wrapper */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
        <MenuPanel
          panelType={panelType}
          koaTitle={koaTitle}
          menuBackdrop={background}
          cinematicNav={cinematicNav}
          cinematicDo={cinematicDo}
          setPanelType={setPanelType}
          setCharView={setCharView}
          setSelectedChar={setSelectedChar}
          setSelectedNpc={setSelectedNpc}
          setVideoChoice={setVideoChoice}
          playHover={playHover}
          playMenuOpen={playMenuOpen}
          onMenuStarted={autoPlayAudio}
        />

        <CampaignHub
          {...{
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
            // navigation-only click sound:
            playNav: playNavClick,
            // everything else silent:
            playSilent: silentClick,
            playHover,
          }}
        />
		<CombatPanel
          panelType={panelType}
          cinematicNav={cinematicNav}
          characters={characters}
          playNav={playNavClick}
          playHover={playHover}
        />

        <CharacterBook
          {...{
            panelType,
            characters,
            setCharacters,
            cinematicNav,
            selectedChar,
            setSelectedChar,
            charView,
            setCharView,
            selectedNpc,
            setSelectedNpc,
            relationshipValues,
            setRelationshipValues,
            clamp0100,
            heatColor,
            playNav: playNavClick,
            playSilent: silentClick,
            playHover,
            pauseAmbient,
            resumeAmbient,
          }}
        />

        <VideoPanel
          {...{
            panelType,
            cinematicNav,
            videoChoice,
            playVideo,
            stopVideo,
            videoRef,
            INTRO_SRC,
            OUTRO_SRC,
            playNav: playNavClick,
            playSilent: silentClick,
            playHover,
          }}
        />

        <WorldLore
          panelType={panelType}
          cinematicNav={cinematicNav}
          playNav={playNavClick}
        />
      </div>
    </div>
  );
}