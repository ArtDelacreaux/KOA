import React from 'react';

export default function AudioHUD({
  musicOn,
  toggleAudio,

  showMix,
  setShowMix,

  musicVol,
  setMusicVol,

  fireVol,
  setFireVol,

  // hover is fine (tiny UI feedback), click is now silent
  playHover = () => {},
}) {
  const hudBtn = {
    position: 'absolute',
    top: 18,
    zIndex: 12,
    height: 40,
    padding: '0 14px',
    borderRadius: 12,
    border: '1px solid rgba(255,220,160,0.22)',
    cursor: 'pointer',
    background: 'linear-gradient(180deg, rgba(176,101,0,0.88), rgba(122,55,0,0.92))',
    color: 'rgba(255,245,220,0.96)',
    fontSize: 13,
    fontWeight: 950,
    letterSpacing: 0.35,
    textShadow: '0 2px 8px rgba(0,0,0,0.55)',
    boxShadow: '0 14px 28px rgba(0,0,0,0.42)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    userSelect: 'none',
    backdropFilter: 'blur(6px)',
    transition: 'transform 140ms ease, filter 140ms ease, box-shadow 140ms ease',
  };

  const hudHover = (e) => {
    playHover();
    e.currentTarget.style.transform = 'translateY(-1px)';
    e.currentTarget.style.filter = 'brightness(1.05)';
    e.currentTarget.style.boxShadow = '0 18px 38px rgba(0,0,0,0.55)';
  };

  const hudLeave = (e) => {
    e.currentTarget.style.transform = 'none';
    e.currentTarget.style.filter = 'none';
    e.currentTarget.style.boxShadow = '0 14px 28px rgba(0,0,0,0.42)';
  };

  return (
    <>
      {/* Sound Toggle (silent click) */}
      <button
        onClick={() => {
          toggleAudio();
        }}
        style={{ ...hudBtn, right: 18 }}
        onMouseEnter={hudHover}
        onMouseLeave={hudLeave}
        title="Toggle sound"
      >
        {musicOn ? '🔊 Sound' : '🔇 Muted'}
      </button>

      {/* Mix Toggle (silent click) */}
      <button
        onClick={() => {
          setShowMix((v) => !v);
        }}
        style={{ ...hudBtn, right: 128 }}
        onMouseEnter={hudHover}
        onMouseLeave={hudLeave}
        title="Audio mix"
      >
        🎚️ Mix
      </button>

      {/* Mix Panel */}
      {showMix && (
        <div
          style={{
            position: 'absolute',
            top: 66,
            right: 18,
            zIndex: 12,
            padding: 12,
            borderRadius: 12,
            background: 'rgba(0,0,0,0.50)',
            color: 'rgba(255,245,220,0.95)',
            backdropFilter: 'blur(6px)',
            width: 260,
            border: '1px solid rgba(255,220,160,0.14)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 13, opacity: 0.95, fontWeight: 900, letterSpacing: 0.3, color: 'rgba(255,245,220,0.95)' }}>Audio Mix</div>
            <button
              onClick={() => setShowMix(false)}
              onMouseEnter={() => playHover()}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'white',
                cursor: 'pointer',
                fontSize: 16,
                opacity: 0.9,
              }}
              title="Close"
            >
              ✕
            </button>
          </div>

          <label style={{ display: 'block', fontSize: 12, marginBottom: 6, color: 'rgba(255,245,220,0.92)' }}>Music: {Math.round(musicVol * 100)}%</label>
          <input
            type="range"
            min="0"
            max="0.25"
            step="0.01"
            value={musicVol}
            onChange={(e) => setMusicVol(parseFloat(e.target.value))}
            style={{ width: '100%' }}
            onMouseEnter={() => playHover()}
          />

          <label style={{ display: 'block', fontSize: 12, marginTop: 10, marginBottom: 6, color: 'rgba(255,245,220,0.92)' }}>Fire: {Math.round(fireVol * 100)}%</label>
          <input
            type="range"
            min="0"
            max="0.25"
            step="0.01"
            value={fireVol}
            onChange={(e) => setFireVol(parseFloat(e.target.value))}
            style={{ width: '100%' }}
            onMouseEnter={() => playHover()}
          />
        </div>
      )}
    </>
  );
}
