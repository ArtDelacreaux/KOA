import React from 'react';
import './koaTheme.css';

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
        className="koa-hudBtn"
        style={{ right: 18 }}
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
        className="koa-hudBtn"
        style={{ right: 128 }}
        onMouseEnter={hudHover}
        onMouseLeave={hudLeave}
        title="Audio mix"
      >
        🎚️ Mix
      </button>

      {/* Mix Panel */}
      {showMix && (
        <div className="koa-mixPanel">
          <div className="koa-mixHeader">
            <div className="koa-mixTitle">Audio Mix</div>
            <button
              onClick={() => setShowMix(false)}
              onMouseEnter={() => playHover()}
              className="koa-iconBtn koa-iconBtn-light"
              title="Close"
            >
              ✕
            </button>
          </div>

          <label className="koa-mixLabel">Music: {Math.round(musicVol * 100)}%</label>
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

          <label className="koa-mixLabel koa-mixLabelTop">Fire: {Math.round(fireVol * 100)}%</label>
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
      )}
    </>
  );
}
