import React, { useMemo } from 'react';
import ShellLayout from './ShellLayout';
import styles from './VideoPanel.module.css';

const TXT_RETURN = '\u2190 RETURN';
const TXT_INTRO = '\u25B6 INTRO';
const TXT_OUTRO = '\u25B6 OUTRO';
const TXT_STOP = '\u25A0 STOP';
const TXT_DIAMOND = '\u25C8';
const ICON_PLAY = '\u25B6';
const ICON_FILM = '\uD83C\uDF9E\uFE0F';

function CornerOrns() {
  const corners = [
    { top: 6, left: 6, borderTop: '1px solid rgba(255,220,160,0.45)', borderLeft: '1px solid rgba(255,220,160,0.45)' },
    { top: 6, right: 6, borderTop: '1px solid rgba(255,220,160,0.45)', borderRight: '1px solid rgba(255,220,160,0.45)' },
    { bottom: 6, left: 6, borderBottom: '1px solid rgba(255,220,160,0.45)', borderLeft: '1px solid rgba(255,220,160,0.45)' },
    { bottom: 6, right: 6, borderBottom: '1px solid rgba(255,220,160,0.45)', borderRight: '1px solid rgba(255,220,160,0.45)' },
  ];

  return corners.map((s, i) => (
    <div key={i} className={styles.cornerOrn} style={s} />
  ));
}

function SectionDivider({ label }) {
  return (
    <div className={styles.sectionDivider}>
      <div className={styles.sectionDividerLine} />
      <span className={styles.sectionDividerLabel}>{`${TXT_DIAMOND} ${label} ${TXT_DIAMOND}`}</span>
      <div className={styles.sectionDividerLine} />
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

  const introBtnClass = [
    styles.actionBtn,
    videoChoice === 'intro' ? styles.actionBtnActiveGold : styles.actionBtnInactive,
  ].join(' ');

  const outroBtnClass = [
    styles.actionBtn,
    videoChoice === 'outro' ? styles.actionBtnActiveGold : styles.actionBtnInactive,
  ].join(' ');

  const stopBtnClass = [styles.actionBtn, styles.actionBtnActiveDanger].join(' ');

  return (
    <ShellLayout active={isActive}>
      <div className={styles.scrollWrap}>
        <div className={styles.pageHeader}>
          <button
            onClick={goBack}
            onMouseEnter={playHover}
            onMouseDown={playNav}
            className={styles.backBtn}
          >
            {TXT_RETURN}
          </button>

          <div className={styles.headerCenter}>
            <div className={styles.headerKicker}>AVALON CINEMA</div>
            <h1 className={styles.headerTitle}>THEATER</h1>
          </div>

          <div className={styles.headerSpacer} />
        </div>

        <div className={styles.content}>
          <section>
            <SectionDivider label="Playback" />

            <div className={styles.controlsBar}>
              <button
                onClick={() => playVideo('intro')}
                onMouseEnter={playHover}
                onMouseDown={playNav}
                className={introBtnClass}
              >
                {TXT_INTRO}
              </button>

              <button
                onClick={() => playVideo('outro')}
                onMouseEnter={playHover}
                onMouseDown={playNav}
                className={outroBtnClass}
              >
                {TXT_OUTRO}
              </button>

              {videoChoice && (
                <button
                  onClick={stopVideo}
                  onMouseEnter={playHover}
                  onMouseDown={playSilent}
                  className={stopBtnClass}
                >
                  {TXT_STOP}
                </button>
              )}

              <div className={styles.nowPlayingTag}>{nowPlayingLabel}</div>
            </div>

            <div className={styles.playerRow}>
              <div className={styles.playerShell}>
                <CornerOrns />

                {(() => {
                  if (!videoChoice) {
                    return (
                      <div className={styles.emptyState}>
                        <div className={styles.emptyIconCircle}>{ICON_PLAY}</div>
                        <div className={styles.emptyTitle}>Select INTRO or OUTRO</div>
                        <div className={styles.emptyNote}>
                          If nothing plays, confirm <code className={styles.monoCode}>INTRO_SRC</code> and{' '}
                          <code className={styles.monoCode}>OUTRO_SRC</code> are set in TavernMenu.
                        </div>
                      </div>
                    );
                  }

                  const src = videoChoice === 'intro' ? (INTRO_SRC || '') : (OUTRO_SRC || '');
                  const isYouTube = src.includes('youtube.com') || src.includes('youtu.be');

                  const toYouTubeEmbed = (raw) => {
                    try {
                      const u = new URL(raw);
                      if (u.hostname.includes('youtube.com') && u.pathname.startsWith('/embed/')) return u;

                      if (u.hostname.includes('youtu.be')) {
                        const id = u.pathname.replace('/', '').trim();
                        if (id) return new URL(`https://www.youtube.com/embed/${id}`);
                      }

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
                      <div className={styles.emptyStateNoSource}>
                        <div className={styles.emptyFilmIcon}>{ICON_FILM}</div>
                        <div className={styles.emptyTitle}>No source set</div>
                        <div className={styles.emptyNote}>
                          Set the correct <code className={styles.monoCode}>{videoChoice === 'intro' ? 'INTRO_SRC' : 'OUTRO_SRC'}</code> prop.
                        </div>
                      </div>
                    );
                  }

                  if (isEmbed) {
                    return (
                      <div className={styles.embedWrap}>
                        <div className={styles.embedRatio}>
                          <iframe
                            ref={videoRef}
                            src={finalSrc}
                            className={styles.embedFrame}
                            allow="autoplay; fullscreen; picture-in-picture"
                            allowFullScreen
                            title={videoChoice}
                          />
                        </div>
                      </div>
                    );
                  }

                  return (
                    <video
                      ref={videoRef}
                      controls
                      className={styles.videoEl}
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
