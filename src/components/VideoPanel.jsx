import React, { useMemo } from 'react';
import ShellLayout from './ShellLayout';

// ─── Theme (mirrors WorldLore.jsx) ───────────────────────────────────────────
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
      <span
        style={{
          fontFamily: fontStack,
          fontSize: 11,
          letterSpacing: '0.22em',
          color: 'rgba(255,220,160,0.55)',
          textTransform: 'uppercase',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          fontWeight: 900,
        }}
      >
        ◈ &nbsp;{label}&nbsp; ◈
      </span>
      <div style={line} />
    </div>
  );
}

export default function VideoPanel({
  panelType,
  cinematicNav,

  videoChoice,
  playVideo,
  stopVideo,

  videoRef,

  INTRO_SRC,
  OUTRO_SRC,

  // NEW
  playNav = () => {},
  playSilent = () => {},
  playHover = () => {},
}) {

  const isActive = panelType === 'video';

  const nowPlayingLabel = useMemo(() => {
    if (!videoChoice) return 'Choose a cinematic to begin.';
    return `Now Playing: ${String(videoChoice).toUpperCase()}`;
  }, [videoChoice]);

  const goBack = () => {
    playNav();
    cinematicNav('menu', { flip: true });
  };

  const actionBtn = (active = false, variant = 'gold') => {
    const base = {
      padding: '11px 16px',
      borderRadius: 14,
      cursor: 'pointer',
      fontFamily: fontStack,
      fontSize: 12,
      fontWeight: 900,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      transition: 'all 180ms ease',
      userSelect: 'none',
      background: active
        ? (variant === 'danger'
          ? 'linear-gradient(180deg, rgba(122,30,30,0.32), rgba(122,30,30,0.14))'
          : 'linear-gradient(180deg, rgba(176,101,0,0.30), rgba(176,101,0,0.14))')
        : 'transparent',
      border: active
        ? (variant === 'danger'
          ? '1px solid rgba(255,160,160,0.42)'
          : '1px solid rgba(255,220,160,0.45)')
        : '1px solid transparent',
      color: active
        ? THEME.creamText
        : 'rgba(255,245,220,0.52)',
    };
    return base;
  };

  const btnEnter = (e) => {
    playHover();
    e.currentTarget.style.transform = 'translateY(-1px)';
    e.currentTarget.style.filter = 'brightness(1.06)';
  };

  const btnLeave = (e) => {
    e.currentTarget.style.transform = 'translateY(0px)';
    e.currentTarget.style.filter = 'none';
  };

  return (
    <ShellLayout active={isActive}>
      <style>{`
        .vp-scrollbar::-webkit-scrollbar { width: 6px; }
        .vp-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .vp-scrollbar::-webkit-scrollbar-thumb { background: rgba(176,101,0,0.4); border-radius: 999px; }
      `}</style>

      <div
        className="vp-scrollbar"
        style={{
          position: 'absolute',
          inset: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '0 0 40px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(176,101,0,0.4) transparent',
        }}
      >
        {/* ── PAGE HEADER (WorldLore style) ── */}
        <div
          style={{
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
          }}
        >
          <button
            onClick={goBack}
            onMouseEnter={btnEnter}
            onMouseLeave={btnLeave}
            onMouseDown={playNav}
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
              userSelect: 'none',
            }}
          >
            ← RETURN
          </button>

          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.38em',
                color: 'rgba(255,220,160,0.45)',
                marginBottom: 14,
                marginTop: -12,
                fontFamily: fontStack,
                textTransform: 'uppercase',
                fontWeight: 900,
              }}
            >
              ✦ &nbsp; THEATER OF MEMORY &nbsp; ✦
            </div>
            <h1
              style={{
                margin: 0,
                fontFamily: fontStack,
                fontSize: 'clamp(1.4rem, 3vw, 2.2rem)',
                fontWeight: 900,
                color: THEME.creamText,
                letterSpacing: '0.18em',
                textShadow: '0 0 40px rgba(176,101,0,0.5), 0 2px 18px rgba(0,0,0,0.7)',
              }}
            >
              CINEMATICS
            </h1>
          </div>

          <div style={{ width: 120 }} />
        </div>

        {/* ── CONTENT ── */}
        <div style={{ padding: '28px 36px 0', display: 'flex', flexDirection: 'column', gap: 32 }}>
          <section>
            <SectionDivider label="Playback" />

            {/* Controls bar */}
            <div
              style={{
                display: 'flex',
                gap: 6,
                marginBottom: 18,
                background: `linear-gradient(180deg, ${THEME.glassA}, ${THEME.glassB})`,
                border: `1px solid ${THEME.lineSoft}`,
                borderRadius: 18,
                padding: 6,
                backdropFilter: 'blur(10px)',
                boxShadow: '0 14px 40px rgba(0,0,0,0.4)',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <button
                onClick={() => playVideo('intro')}
                onMouseEnter={btnEnter}
                onMouseLeave={btnLeave}
                onMouseDown={playNav}
                style={actionBtn(videoChoice === 'intro', 'gold')}
              >
                ▶ INTRO
              </button>

              <button
                onClick={() => playVideo('outro')}
                onMouseEnter={btnEnter}
                onMouseLeave={btnLeave}
                onMouseDown={playNav}
                style={actionBtn(videoChoice === 'outro', 'gold')}
              >
                ▶ OUTRO
              </button>

              {videoChoice && (
                <button
                  onClick={stopVideo}
                  onMouseEnter={btnEnter}
                  onMouseLeave={btnLeave}
                  onMouseDown={playSilent}
                  style={actionBtn(true, 'danger')}
                >
                  ■ STOP
                </button>
              )}

              <div
                style={{
                  marginLeft: 'auto',
                  padding: '6px 10px',
                  borderRadius: 12,
                  border: `1px solid ${THEME.lineSoft}`,
                  background: 'rgba(0,0,0,0.22)',
                  color: 'rgba(255,245,220,0.62)',
                  fontFamily: fontStack,
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                {nowPlayingLabel}
              </div>
            </div>

            {/* Player */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: 860,
                  background: 'rgba(6,4,2,0.92)',
                  border: `1px solid ${THEME.line}`,
                  borderRadius: 18,
                  overflow: 'hidden',
                  boxShadow: '0 18px 50px rgba(0,0,0,0.7), inset 0 0 60px rgba(0,0,0,0.5)',
                }}
              >
                <CornerOrns />

                {(() => {
                  if (!videoChoice) {
                    return (
                      <div
                        style={{
                          aspectRatio: '16/9',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 14,
                          padding: 18,
                          textAlign: 'center',
                          background: 'linear-gradient(135deg, rgba(18,12,4,0.98), rgba(38,26,8,0.9))',
                        }}
                      >
                        <div
                          style={{
                            width: 60,
                            height: 60,
                            borderRadius: '50%',
                            border: `1px solid ${THEME.line}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.5rem',
                            color: 'rgba(255,220,160,0.35)',
                            background: 'rgba(0,0,0,0.3)',
                          }}
                        >
                          ▶
                        </div>
                        <div
                          style={{
                            fontFamily: fontStack,
                            color: 'rgba(255,220,160,0.38)',
                            fontSize: 12,
                            letterSpacing: '0.22em',
                            textTransform: 'uppercase',
                            fontWeight: 900,
                          }}
                        >
                          Select INTRO or OUTRO
                        </div>
                        <div
                          style={{
                            color: 'rgba(255,220,160,0.22)',
                            fontSize: 11,
                            fontStyle: 'italic',
                            fontWeight: 850,
                            maxWidth: 520,
                            lineHeight: 1.6,
                          }}
                        >
                          If nothing plays, confirm <code style={{ fontFamily: 'monospace', fontSize: 10 }}>INTRO_SRC</code> and{' '}
                          <code style={{ fontFamily: 'monospace', fontSize: 10 }}>OUTRO_SRC</code> are set in TavernMenu.
                        </div>
                      </div>
                    );
                  }

                  const src = videoChoice === 'intro' ? (INTRO_SRC || '') : (OUTRO_SRC || '');
                  const isYouTube = src.includes('youtube.com') || src.includes('youtu.be');

                  const toYouTubeEmbed = (raw) => {
                    try {
                      const u = new URL(raw);
                      // Already embed.
                      if (u.hostname.includes('youtube.com') && u.pathname.startsWith('/embed/')) return u;

                      // youtu.be/<id>
                      if (u.hostname.includes('youtu.be')) {
                        const id = u.pathname.replace('/', '').trim();
                        if (id) return new URL(`https://www.youtube.com/embed/${id}`);
                      }

                      // youtube.com/watch?v=<id>
                      if (u.hostname.includes('youtube.com') && (u.pathname === '/watch' || u.pathname === '/watch/')) {
                        const id = u.searchParams.get('v');
                        if (id) return new URL(`https://www.youtube.com/embed/${id}`);
                      }

                      return u;
                    } catch {
                      return null;
                    }
                  };

                  const buildYtSrc = (raw) => {
                    const embedUrl = toYouTubeEmbed(raw);
                    if (!embedUrl) return raw;
                    embedUrl.searchParams.set('controls', '1');
                    embedUrl.searchParams.set('rel', '0');
                    embedUrl.searchParams.set('modestbranding', '1');
                    return embedUrl.toString();
                  };

                  const finalSrc = isYouTube ? buildYtSrc(src) : src;
                  const isEmbed = isYouTube && finalSrc.includes('youtube.com/embed');

                  if (!src) {
                    return (
                      <div
                        style={{
                          aspectRatio: '16/9',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 10,
                          padding: 18,
                          textAlign: 'center',
                          background: 'linear-gradient(135deg, rgba(18,12,4,0.98), rgba(38,26,8,0.9))',
                        }}
                      >
                        <div style={{ fontSize: '2rem', opacity: 0.28 }}>🎞️</div>
                        <div
                          style={{
                            fontFamily: fontStack,
                            color: 'rgba(255,220,160,0.38)',
                            fontSize: 12,
                            letterSpacing: '0.22em',
                            textTransform: 'uppercase',
                            fontWeight: 900,
                          }}
                        >
                          No source set
                        </div>
                        <div style={{ color: 'rgba(255,220,160,0.22)', fontSize: 11, fontStyle: 'italic', fontWeight: 850 }}>
                          Set the correct <code style={{ fontFamily: 'monospace', fontSize: 10 }}>{videoChoice === 'intro' ? 'INTRO_SRC' : 'OUTRO_SRC'}</code> prop.
                        </div>
                      </div>
                    );
                  }

                  // YouTube: keep a true 16:9 so controls never clip.
                  if (isEmbed) {
                    return (
                      <div style={{ width: '100%' }}>
                        <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', height: 0, background: '#000' }}>
                          <iframe
                            ref={videoRef}
                            src={finalSrc}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                            allow="autoplay; fullscreen; picture-in-picture"
                            allowFullScreen
                            title={videoChoice}
                          />
                        </div>
                      </div>
                    );
                  }

                  // Non-embed YouTube or local mp4/webm
                  return (
                    <video
                      ref={videoRef}
                      controls
                      style={{
                        width: '100%',
                        display: 'block',
                        maxHeight: 520,
                        objectFit: 'contain',
                        background: '#000',
                      }}
                      src={finalSrc}
                      onEnded={() => {}}
                    />
                  );
                })()}
              </div>
            </div>
          </section>
        </div>
      </div>
    </ShellLayout>
  );
}