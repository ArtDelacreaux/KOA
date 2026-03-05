// ===== TAVERN MENU — ROOT CONTROLLER (RESTORED FX + FIXED LAYOUT + NAV-ONLY SFX) =====
import React, { useState, useRef, useEffect, useMemo } from 'react';
import styles from './TavernMenu.module.css';
import useLocalStorageState from './lib/useLocalStorageState';
import { STORAGE_KEYS } from './lib/storageKeys';
import { readJson, writeJson } from './lib/localStore';
import { useAuth } from './auth/AuthContext';
import {
  canUserControlCharacter,
  characterAccessKey,
  getCharacterAccessEntry,
  normalizeCharacterAccessEntry,
  normalizeCharacterAccessMap,
} from './lib/characterAccess';

//Components Pages
import AudioHUD from './components/AudioHUD';
import MenuPanel from './components/MenuPanel';
import CampaignHub from './components/CampaignHub';
import CharacterBook from './components/CharacterBook';
import VideoPanel from './components/VideoPanel';
import WorldLore from './components/WorldLore';
import CombatPanel from './components/CombatPanel';
import PlayerChatDock from './components/PlayerChatDock';

//Assets
import background from './assets/background.jpeg';
import tavernBgVideo from './assets/BackgroundLoop.mp4';
import tavernBgVideoNight from './assets/BackgroundLoopNight.mp4';
import tavernMusic from './assets/music.mp3';
import tavernMusicNight from './assets/nightMusic.mp3';
import fireCrackle from './assets/fire_crackle.mp3';
import koaTitle from './assets/koaTitle.png';

// Shared roster (Character Book + Combat)
import { DEFAULT_CHARACTERS } from './data/characters';

// ✅ SFX
import pageFlip from './assets/PageFlip.mp3';
import hoverSfx from './assets/Hover.mp3';
import buttonSfx from './assets/Button.mp3';
import menuOpenSfx from './assets/MenuOpen.mp3';
import backSfx from './assets/back.mp3';

/* ---------- hooks ---------- */
function useAudioLoop(ref, { volume, loop = true }) {
  useEffect(() => {
    if (!ref.current) return;
    ref.current.loop = loop;
    ref.current.volume = volume;
  }, [ref, volume, loop]);
}

function loadStoredMusicPreference() {
  return !!readJson(STORAGE_KEYS.musicOn, true);
}

class PanelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: String(error?.message || 'Unexpected panel error.') };
  }

  componentDidCatch(error) {
    // Keep runtime breadcrumbs in console for debugging while showing in-app recovery UI.
    // eslint-disable-next-line no-console
    console.error('[PanelErrorBoundary]', error);
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, message: '' });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className={styles.panelErrorCard}>
        <div className={styles.panelErrorTitle}>Panel failed to render</div>
        <div className={styles.panelErrorBody}>{this.state.message || 'Unexpected panel error.'}</div>
        <div className={styles.panelErrorActions}>
          <button
            type="button"
            className={styles.panelErrorBtn}
            onClick={() => {
              this.setState({ hasError: false, message: '' });
              if (typeof this.props.onReset === 'function') this.props.onReset();
            }}
          >
            Return to Menu
          </button>
        </div>
      </div>
    );
  }
}

/* ---------- component ---------- */
export default function TavernMenu() {
  const {
    enabled: authEnabled,
    session,
    profile,
    canManageCampaign,
    canWriteData,
  } = useAuth();

  /* ================= STATE ================= */
  const [musicOn, setMusicOn] = useState(loadStoredMusicPreference);
  const [panelType, setPanelType] = useState('menu');
  const [bgVideoReady, setBgVideoReady] = useState(false);
  const [bgVideoFailed, setBgVideoFailed] = useState(false);
  const [menuEntered, setMenuEntered] = useState(false);
  const [nightMode, setNightMode] = useState(false);

  const [selectedChar, setSelectedChar] = useState(null);
  const [charView, setCharView] = useState('grid');
  const [selectedNpc, setSelectedNpc] = useState(null);

  const [campaignTab, setCampaignTab] = useState('launcher');

  // ✅ Shared party roster (single source of truth)
  const [characters, setCharacters] = useLocalStorageState(STORAGE_KEYS.characters, DEFAULT_CHARACTERS);
  const [characterAccess, setCharacterAccess] = useLocalStorageState(STORAGE_KEYS.characterAccess, {});

  const [quests, setQuests] = useLocalStorageState(STORAGE_KEYS.quests, []);
  const [questModalOpen, setQuestModalOpen] = useState(false);
  const [editingQuestId, setEditingQuestId] = useState(null);
  const [questDraft, setQuestDraft] = useState({
    title: '',
    type: 'Side',
    board: 'party',
    assignedUserId: '',
    assignedEmail: '',
    assignedUsername: '',
    assignedLabel: '',
    giver: '',
    location: '',
    description: '',
  });

  const [relationshipValues, setRelationshipValues] = useLocalStorageState(STORAGE_KEYS.relationships, {});

  const [videoChoice, setVideoChoice] = useState(null);
  const videoRef = useRef(null);

  const [musicVol, setMusicVol] = useState(0.06);
  const [fireVol, setFireVol] = useState(0.07);
  const [showMix, setShowMix] = useState(false);

  useEffect(() => {
    writeJson(STORAGE_KEYS.musicOn, !!musicOn);
  }, [musicOn]);

  const currentUserId = String(session?.user?.id || '');
  const currentUserEmail = String(session?.user?.email || '').trim().toLowerCase();
  const currentUsername = String(profile?.username || '').trim();
  const canEditCampaignData = authEnabled ? canWriteData : true;
  const canManageCharacterAccess = authEnabled ? canManageCampaign && canEditCampaignData : true;

  useEffect(() => {
    setCharacterAccess((prev) => normalizeCharacterAccessMap(prev));
    // Normalize persisted shape once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const viewerIdentity = useMemo(
    () => ({
      userId: currentUserId,
      email: currentUserEmail,
      username: currentUsername,
    }),
    [currentUserEmail, currentUserId, currentUsername]
  );

  const getCharacterController = useMemo(
    () => (character) => getCharacterAccessEntry(characterAccess, character),
    [characterAccess]
  );

  const canControlCharacter = useMemo(
    () => (character) =>
      (authEnabled && !canEditCampaignData)
        ? false
        : canUserControlCharacter({
            accessMap: characterAccess,
            character,
            authEnabled,
            isManager: canManageCharacterAccess,
            userId: currentUserId,
            email: currentUserEmail,
            username: currentUsername,
          }),
    [authEnabled, canEditCampaignData, canManageCharacterAccess, characterAccess, currentUserEmail, currentUserId, currentUsername]
  );

  const assignCharacterController = useMemo(
    () => (character, assignment = {}) => {
      if (!canManageCharacterAccess) return false;
      const key = characterAccessKey(character);
      if (!key) return false;

      const nextEntry = normalizeCharacterAccessEntry({
        ...assignment,
        updatedAt: new Date().toISOString(),
        updatedByUserId: currentUserId,
        updatedByEmail: currentUserEmail,
      });

      if (!nextEntry.ownerUserId && !nextEntry.ownerEmail && !nextEntry.ownerUsername) return false;

      setCharacterAccess((prev) => {
        const normalized = normalizeCharacterAccessMap(prev);
        return { ...normalized, [key]: nextEntry };
      });
      return true;
    },
    [canManageCharacterAccess, currentUserEmail, currentUserId, setCharacterAccess]
  );

  const clearCharacterController = useMemo(
    () => (character) => {
      if (!canManageCharacterAccess) return false;
      const key = characterAccessKey(character);
      if (!key) return false;

      setCharacterAccess((prev) => {
        const normalized = normalizeCharacterAccessMap(prev);
        if (!Object.prototype.hasOwnProperty.call(normalized, key)) return normalized;
        const next = { ...normalized };
        delete next[key];
        return next;
      });
      return true;
    },
    [canManageCharacterAccess, setCharacterAccess]
  );

  // ✅ SFX volumes
  const [hoverVol] = useState(0.14);
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
  const backRef = useRef(null);

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

  // ✅ Return-to-menu SFX (back.mp3)
  const playBackToMenu = () => {
    const a = backRef.current;
    if (!a) return;
    a.volume = uiNavVol;
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

  const activeBgVideo = nightMode ? tavernBgVideoNight : tavernBgVideo;
  const activeMusic = nightMode ? tavernMusicNight : tavernMusic;
  const showBgFallback = bgVideoFailed || (!bgVideoReady && !menuEntered);

  /* ================= AUDIO ================= */
  useAudioLoop(musicRef, { volume: musicVol, loop: true });
  useAudioLoop(fireRef, { volume: fireVol, loop: true });

  const toggleAudio = () => {
    if (!musicRef.current || !fireRef.current) return;

    musicRef.current.volume = musicVol;
    fireRef.current.volume = fireVol;

    const shouldEnableAudio = !musicOn;
    if (shouldEnableAudio) {
      musicRef.current.play().catch(() => {});
      fireRef.current.play().catch(() => {});
    } else {
      musicRef.current.pause();
      fireRef.current.pause();
    }
    setMusicOn(shouldEnableAudio);
  };

  const toggleNightMode = () => {
    const nextNightMode = !nightMode;
    setBgVideoReady(false);
    setBgVideoFailed(false);
    setNightMode(nextNightMode);

    if (nextNightMode) {
      setMusicVol(0.25);
      setFireVol(0.02);
    }
  };

  const autoPlayAudio = () => {
    setMenuEntered(true);
    if (!musicOn) return; // user preference is muted
    if (!musicRef.current || !fireRef.current) return;
    musicRef.current.volume = musicVol;
    fireRef.current.volume = fireVol;
    if (musicRef.current.paused) musicRef.current.play().catch(() => {});
    if (fireRef.current.paused) fireRef.current.play().catch(() => {});
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

  useEffect(() => {
    const music = musicRef.current;
    if (!music || !musicOn) return;

    const restart = () => {
      music.currentTime = 0;
      music.volume = musicVol;
      music.play().catch(() => {});
    };

    if (music.readyState >= 2) {
      restart();
      return;
    }

    music.addEventListener('canplay', restart, { once: true });
    return () => music.removeEventListener('canplay', restart);
  }, [activeMusic]);


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

  // flip defaults ON, except when returning to menu (uses back.mp3 instead)
  const cinematicNav = (nextPanel, { flip = true } = {}) => {
    const returningToMenu = nextPanel === 'menu' && panelType !== 'menu';
    if (returningToMenu) {
      playBackToMenu();
    }

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
    }, { flip: returningToMenu ? false : flip });
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

  const recoverFromPanelError = () => {
    setPanelType('menu');
  };

  /* ================= RENDER ================= */
  return (
    <div className={styles.root}>
      {/* Background video (preferred) */}
      <video
        key={activeBgVideo}
        src={activeBgVideo}
        autoPlay
        muted
        loop
        playsInline
        onCanPlay={() => {
          setBgVideoReady(true);
          setBgVideoFailed(false);
        }}
        onError={() => {
          setBgVideoReady(false);
          setBgVideoFailed(true);
        }}
        className={styles.backgroundMedia}
        style={{ opacity: bgVideoReady ? 1 : 0 }}
      />

      {/* Background image fallback (NEVER blocks clicks) */}
      <img
        src={background}
        alt=""
        className={styles.backgroundMedia}
        style={{ opacity: showBgFallback ? 1 : 0 }}
      />

      {/* Vignette (NEVER blocks clicks) */}
      <div className={styles.vignette} />

      {/* Dust motes (NEVER block clicks) */}
      {motes.map((m) => (
        <div
          key={m.id}
          className={styles.mote}
          style={{
            left: m.left,
            top: m.top,
            width: m.size,
            height: m.size,
            opacity: m.opacity,
            animationDuration: `${m.dur}s`,
            animationDelay: `${m.delay}s`,
          }}
        />
      ))}

      {/* Fast cinematic fade overlay (NEVER blocks clicks) */}
      <div
        className={styles.fadeOverlay}
        style={{
          opacity: isFading ? 1 : 0,
          transitionDuration: `${FADE_TOTAL_MS}ms`,
        }}
      />

      {/* Audio */}
      <audio ref={musicRef} src={activeMusic} />
      <audio ref={fireRef} src={fireCrackle} />
      <audio ref={pageFlipRef} src={pageFlip} preload="auto" />

      {/* SFX */}
      <audio ref={hoverRef} src={hoverSfx} preload="auto" />
      <audio ref={uiNavRef} src={buttonSfx} preload="auto" />
      <audio ref={menuOpenRef} src={menuOpenSfx} preload="auto" />
      <audio ref={backRef} src={backSfx} preload="auto" />

      {/* HUD (always above panels; only HUD captures clicks) */}
      <div className={styles.hudLayer}>
        <div className={styles.hudDock}>
          <AudioHUD
            musicOn={musicOn}
            toggleAudio={toggleAudio}
            showMix={showMix}
            setShowMix={setShowMix}
            musicVol={musicVol}
            setMusicVol={setMusicVol}
            fireVol={fireVol}
            setFireVol={setFireVol}
            nightMode={nightMode}
            toggleNightMode={toggleNightMode}
            playHover={playHover}
            // HUD is NOT navigation; keep it silent
            playButton={silentClick}
          />
        </div>
      </div>

      {/* Panels wrapper */}
      <div className={styles.panelsLayer}>
        <MenuPanel
          panelType={panelType}
          koaTitle={koaTitle}
          menuBackdrop={background}
          nightMode={nightMode}
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

        <PanelErrorBoundary resetKey={`campaign-${panelType}-${campaignTab}`} onReset={recoverFromPanelError}>
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
              canEditCampaignData,
            }}
          />
        </PanelErrorBoundary>
        <PanelErrorBoundary resetKey={`combat-${panelType}`} onReset={recoverFromPanelError}>
          <CombatPanel
            panelType={panelType}
            cinematicNav={cinematicNav}
            characters={characters}
            characterControllers={characterAccess}
            canManageCombat={canManageCharacterAccess}
            canWriteCombat={canEditCampaignData}
            viewerIdentity={viewerIdentity}
            canControlCharacter={canControlCharacter}
            playNav={playNavClick}
            playHover={playHover}
          />
        </PanelErrorBoundary>

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
            characterControllers: characterAccess,
            canControlCharacter,
            canAssignCharacterController: canManageCharacterAccess,
            getCharacterController,
            assignCharacterController,
            clearCharacterController,
            viewerIdentity,
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
          canEditLore={canEditCampaignData}
          setCharView={setCharView}
          setSelectedChar={setSelectedChar}
          setSelectedNpc={setSelectedNpc}
          characters={characters}
        />
      </div>

      <div className={styles.chatLayer}>
        <PlayerChatDock />
      </div>
    </div>
  );
}
