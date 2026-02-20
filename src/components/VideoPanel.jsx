import React from 'react';
import ShellLayout from './ShellLayout';

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

  const buttonBase = {
    margin: '10px',
    padding: '14px 28px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    backgroundColor: '#b06500',
    color: 'white',
    fontSize: '1.1rem',
    transition: 'all 0.25s ease',
  };

  const backButton = {
    ...buttonBase,
    backgroundColor: '#7a1e1e',
    boxShadow: '0 0 15px rgba(255,80,80,0.5)',
    margin: 0,
  };

  const buttonHoverFx = (e) => {
    playHover();
    e.currentTarget.style.transform = 'scale(1.06)';
    e.currentTarget.style.boxShadow = '0 0 18px rgba(255,170,60,0.45)';
  };

  const buttonLeaveFx = (e) => {
    e.currentTarget.style.transform = 'scale(1)';
    const isBack = e.currentTarget.dataset.kind === 'back';
    e.currentTarget.style.boxShadow = isBack ? '0 0 15px rgba(255,80,80,0.5)' : 'none';
  };

  const headerBar = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    padding: '12px 14px',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    color: 'rgba(255,245,220,0.95)',
    background: 'linear-gradient(180deg, rgba(20,16,12,0.72), rgba(12,10,8,0.62))',
    backdropFilter: 'blur(8px)',
    borderBottom: '1px solid rgba(255,220,160,0.12)',
    boxShadow: '0 10px 18px rgba(0,0,0,0.22)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  };

  const bodyArea = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 110,
    bottom: 0,
    padding: 14,
    overflow: 'hidden',
  };

  const cardShell = (bg = 'rgba(10, 8, 6, 0.70)', fg = 'rgba(255,245,220,0.95)') => ({
    width: 'min(1100px, 94vw)',
    height: 'min(760px, 86vh)',
    borderRadius: 18,
    background: bg,
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
    position: 'relative',
    overflow: 'hidden',
    color: fg,
  });

  const smallBtn = (variant = 'gold') => {
    const base = {
      padding: '8px 10px',
      borderRadius: 12,
      border: '1px solid rgba(255,220,160,0.18)',
      cursor: 'pointer',
      fontWeight: 900,
      fontSize: 12,
      letterSpacing: 0.2,
      transition: 'transform 140ms ease, box-shadow 140ms ease, filter 140ms ease',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      background: 'rgba(255,255,255,0.10)',
      color: 'rgba(255,245,220,0.96)',
    };

    if (variant === 'gold') {
      return {
        ...base,
        background: 'linear-gradient(180deg, rgba(176,101,0,0.86), rgba(122,55,0,0.90))',
        border: '1px solid rgba(255,220,160,0.22)',
        boxShadow: '0 12px 26px rgba(0,0,0,0.35)',
        textShadow: '0 2px 8px rgba(0,0,0,0.55)',
      };
    }
    if (variant === 'danger') {
      return {
        ...base,
        background: 'linear-gradient(180deg, rgba(122,30,30,0.92), rgba(90,18,18,0.92))',
        border: '1px solid rgba(255,160,160,0.22)',
        boxShadow: '0 12px 26px rgba(0,0,0,0.35)',
        textShadow: '0 2px 8px rgba(0,0,0,0.55)',
      };
    }
    return base;
  };

  const smallBtnHover = (e) => {
    playHover();
    e.currentTarget.style.transform = 'translateY(-1px)';
    e.currentTarget.style.filter = 'brightness(1.06)';
    e.currentTarget.style.boxShadow = '0 16px 34px rgba(0,0,0,0.40)';
  };

  const smallBtnLeave = (e) => {
    e.currentTarget.style.transform = 'translateY(0px)';
    e.currentTarget.style.filter = 'none';
  };

  return (
    <ShellLayout active={panelType === 'video'}>
      <div style={cardShell()}>
        <div style={headerBar}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 26, fontWeight: 950, lineHeight: 1 }}>Intro / Outro</div>
              <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 900, letterSpacing: 1.2, textTransform: 'uppercase' }}>Cinematics</div>
            </div>

            {/* Back to Menu uses buttonSfx */}
            <button
			  data-kind="back"
			  style={backButton}
			  onMouseEnter={buttonHoverFx}
			  onMouseLeave={buttonLeaveFx}
			  onMouseDown={playNav}
			  onClick={() => cinematicNav('menu', { flip: true })}
			>
			  Back to Menu
			</button>
          </div>

          {/* Play Intro/Outro = navigation within panel → Button.mp3 */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              style={smallBtn('gold')}
              onMouseEnter={smallBtnHover}
              onMouseLeave={smallBtnLeave}
              onMouseDown={playNav}
              onClick={() => playVideo('intro')}
            >
              Play Intro
            </button>

            <button
              style={smallBtn('gold')}
              onMouseEnter={smallBtnHover}
              onMouseLeave={smallBtnLeave}
              onMouseDown={playNav}
              onClick={() => playVideo('outro')}
            >
              Play Outro
            </button>

            {/* Stop is a control action → silent */}
            {videoChoice && (
              <button
                style={smallBtn('danger')}
                onMouseEnter={smallBtnHover}
                onMouseLeave={smallBtnLeave}
                onMouseDown={playSilent}
                onClick={stopVideo}
              >
                Stop
              </button>
            )}

            <div style={{ marginLeft: 'auto', opacity: 0.75, fontWeight: 900, fontSize: 12 }}>
              {videoChoice ? `Now Playing: ${videoChoice.toUpperCase()}` : 'Choose a video'}
            </div>
          </div>
        </div>

        <div style={bodyArea}>
          {!videoChoice ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', opacity: 0.9 }}>
              <div style={{ maxWidth: 520 }}>
                <div style={{ fontSize: 22, fontWeight: 950, marginBottom: 10 }}>Cinematic Player</div>
                <div style={{ lineHeight: 1.7, opacity: 0.88 }}>
                  Press <strong>Play Intro</strong> or <strong>Play Outro</strong> to begin.
                </div>
              </div>
            </div>
          ) : (() => {
            const src = videoChoice === 'intro' ? INTRO_SRC : OUTRO_SRC;
            const isYouTube = src.includes('youtube.com/embed') || src.includes('youtu.be');
            const sharedStyle = {
              width: '100%',
              borderRadius: 14,
              background: 'black',
              boxShadow: '0 24px 70px rgba(0,0,0,0.75)',
              border: '1px solid rgba(255,220,160,0.18)',
              // YouTube needs a fixed aspect-ratio height with padding at bottom for controls
              height: isYouTube ? 'calc(86vh - 240px)' : 'calc(86vh - 160px)',
              maxHeight: isYouTube ? 'calc(86vh - 240px)' : 'calc(86vh - 160px)',
            };
            return (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isYouTube ? (
                  <iframe
                    ref={videoRef}
                    src={src}
                    style={sharedStyle}
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    title={videoChoice}
                  />
                ) : (
                  <video
                    ref={videoRef}
                    controls
                    style={sharedStyle}
                    src={src}
                    onEnded={() => {}}
                  />
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </ShellLayout>
  );
}