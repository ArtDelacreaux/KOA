import React from 'react';
import './koaTheme.css';

const FONT = "'Cinzel', 'Trajan Pro', 'Times New Roman', serif";

const THEME = {
  goldA: 'rgba(176,101,0,0.90)',
  goldB: 'rgba(122,55,0,0.92)',
  creamText: 'rgba(255,245,220,0.96)',
  creamSoft: 'rgba(255,245,220,0.72)',
  line: 'rgba(255,220,160,0.18)',
  lineSoft: 'rgba(255,220,160,0.10)',
  glassA: 'rgba(255,245,220,0.065)',
  glassB: 'rgba(255,245,220,0.022)',
  emberGlow: 'rgba(255,140,60,0.14)',
};

export default function AudioHUD({
  musicOn,
  toggleAudio,

  showMix,
  setShowMix,

  musicVol,
  setMusicVol,

  fireVol,
  setFireVol,

  nightMode,
  toggleNightMode,

  playHover = () => {},
}) {
  /* ── shared button style: frosted glass, no orange ── */
  const hudBtnStyle = {
    position: 'absolute',
    top: 18,
    zIndex: 12,
    height: 42,
    padding: '0 16px',
    borderRadius: 16,
    border: `1px solid ${THEME.line}`,
    background: `linear-gradient(180deg, ${THEME.glassA}, ${THEME.glassB})`,
    color: THEME.creamText,
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textShadow: '0 2px 8px rgba(0,0,0,0.55)',
    boxShadow: '0 14px 34px rgba(0,0,0,0.42)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    backdropFilter: 'blur(12px)',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'transform 140ms ease, filter 140ms ease, box-shadow 140ms ease',
  };

  const btnHover = (e) => {
    playHover();
    e.currentTarget.style.transform = 'translateY(-1px)';
    e.currentTarget.style.filter = 'brightness(1.12)';
    e.currentTarget.style.boxShadow = '0 22px 50px rgba(0,0,0,0.55)';
  };

  const btnLeave = (e) => {
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.filter = 'none';
    e.currentTarget.style.boxShadow = '0 14px 34px rgba(0,0,0,0.48)';
  };

  const btnDown = (e) => {
    e.currentTarget.style.transform = 'translateY(1px) scale(0.99)';
    e.currentTarget.style.filter = 'brightness(0.96)';
  };

  /* ── Mix panel: frosted glass card matching MenuPanel's panelCard ── */
  const mixPanel = {
    position: 'absolute',
    top: 70,
    right: 18,
    zIndex: 12,
    width: 270,
    borderRadius: 22,
    border: `1px solid ${THEME.line}`,
    background: `linear-gradient(180deg, ${THEME.glassA}, ${THEME.glassB})`,
    boxShadow: '0 22px 60px rgba(0,0,0,0.52)',
    backdropFilter: 'blur(12px)',
    padding: '16px 18px 18px',
    fontFamily: FONT,
  };

  const mixHeader = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  };

  const mixTitle = {
    fontSize: 13,
    fontWeight: 950,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: THEME.creamText,
    textShadow: '0 2px 10px rgba(0,0,0,0.60)',
  };

  const divider = {
    height: 1,
    background: 'linear-gradient(90deg, transparent, rgba(255,220,160,0.18), transparent)',
    margin: '10px 0',
  };

  const mixLabel = {
    display: 'block',
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: THEME.creamSoft,
    marginBottom: 6,
  };

  const closeBtn = {
    border: 'none',
    background: 'rgba(255,245,220,0.08)',
    borderRadius: 10,
    color: THEME.creamSoft,
    fontSize: 14,
    width: 28,
    height: 28,
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    transition: 'background 120ms ease',
    lineHeight: 1,
  };

  const rangeWrap = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  };

  return (
    <>
      {/* ── Sound Toggle ── */}
      <button
        onClick={toggleAudio}
        style={{ ...hudBtnStyle, right: 18 }}
        onMouseEnter={btnHover}
        onMouseLeave={btnLeave}
        onMouseDown={btnDown}
        title="Toggle sound"
      >
        {musicOn ? '🔊' : '🔇'}
        <span>{musicOn ? 'Sound' : 'Muted'}</span>
      </button>

      {/* ── Mix Toggle ── */}
      <button
        onClick={() => setShowMix((v) => !v)}
        style={{ ...hudBtnStyle, right: 138 }}
        onMouseEnter={btnHover}
        onMouseLeave={btnLeave}
        onMouseDown={btnDown}
        title="Audio mix"
      >
        🎚️ <span>Mix</span>
      </button>

      <button
        onClick={toggleNightMode}
        style={{ ...hudBtnStyle, right: 258 }}
        onMouseEnter={btnHover}
        onMouseLeave={btnLeave}
        onMouseDown={btnDown}
        title="Toggle day/night mode"
      >
        <span>{nightMode ? 'Day Mode' : 'Night Mode'}</span>
      </button>

      {/* ── Mix Panel ── */}
      {showMix && (
        <div style={mixPanel}>
          {/* edge glow matching menu panels */}
          <div style={{
            position: 'absolute',
            inset: -2,
            borderRadius: 24,
            pointerEvents: 'none',
            background: 'linear-gradient(135deg, rgba(176,101,0,0.28), rgba(255,140,60,0.14))',
            filter: 'blur(16px)',
            opacity: 0.42,
          }} />

          <div style={{ position: 'relative' }}>
            <div style={mixHeader}>
              <div style={mixTitle}>Audio Mix</div>
              <button
                style={closeBtn}
                onClick={() => setShowMix(false)}
                onMouseEnter={(e) => {
                  playHover();
                  e.currentTarget.style.background = 'rgba(255,245,220,0.14)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,245,220,0.08)';
                }}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div style={divider} />

            {/* Music slider */}
            <div style={{ ...rangeWrap, marginTop: 8 }}>
              <label style={mixLabel}>
                Music — {Math.round(musicVol * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="0.25"
                step="0.01"
                value={musicVol}
                onChange={(e) => setMusicVol(parseFloat(e.target.value))}
                className="koa-rangeFull"
                onMouseEnter={() => playHover()}
              />
            </div>

            {/* Fire slider */}
            <div style={{ ...rangeWrap, marginTop: 14 }}>
              <label style={mixLabel}>
                Fire — {Math.round(fireVol * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="0.25"
                step="0.01"
                value={fireVol}
                onChange={(e) => setFireVol(parseFloat(e.target.value))}
                className="koa-rangeFull"
                onMouseEnter={() => playHover()}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
