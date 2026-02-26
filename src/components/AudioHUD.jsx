import React from 'react';
import styles from './AudioHUD.module.css';

const ICON_MIC = '\uD83C\uDF9A\uFE0F';
const ICON_MUTED = '\uD83D\uDD07';
const ICON_LOUD = '\uD83D\uDD0A';
const ICON_CLOSE = '\u2715';

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
  return (
    <>
      <button
        onClick={() => setShowMix((v) => !v)}
        className={`${styles.hudBtn} ${styles.audioBtn} koa-glass-btn koa-interactive-lift`}
        onMouseEnter={playHover}
        title="Audio controls"
      >
        {musicOn ? ICON_MIC : ICON_MUTED}
        <span>{musicOn ? 'Sound' : 'Muted'}</span>
      </button>

      <button
        onClick={toggleNightMode}
        className={`${styles.hudBtn} ${styles.nightModeBtn} koa-glass-btn koa-interactive-lift`}
        onMouseEnter={playHover}
        title="Toggle day/night mode"
      >
        <span>{nightMode ? 'Day Mode' : 'Night Mode'}</span>
      </button>

      {showMix && (
        <div className={`${styles.mixPanel} koa-glass-card`}>
          <div className={styles.panelGlow} />

          <div className={styles.mixPanelBody}>
            <div className={styles.mixHeader}>
              <div className={styles.mixTitle}>Audio Mix</div>
              <div className={styles.headerActions}>
                <button
                  className={styles.muteBtn}
                  onClick={toggleAudio}
                  onMouseEnter={playHover}
                  title={musicOn ? 'Mute' : 'Unmute'}
                >
                  {musicOn ? ICON_LOUD : ICON_MUTED} <span>{musicOn ? 'Mute' : 'Unmute'}</span>
                </button>
                <button
                  className={styles.closeBtn}
                  onClick={() => setShowMix(false)}
                  onMouseEnter={playHover}
                  title="Close"
                >
                  {ICON_CLOSE}
                </button>
              </div>
            </div>

            <div className={`${styles.divider} koa-divider-line`} />

            <div className={`${styles.rangeWrap} ${styles.musicRangeWrap}`}>
              <label className={styles.mixLabel}>
                Music - {Math.round(musicVol * 100)}%
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

            <div className={`${styles.rangeWrap} ${styles.fireRangeWrap}`}>
              <label className={styles.mixLabel}>
                Fire - {Math.round(fireVol * 100)}%
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
