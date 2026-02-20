import React from 'react';

export default function MenuPanel({
  panelType,
  koaTitle,

  cinematicNav,
  cinematicDo,

  setPanelType,
  setSelectedChar,
  setSelectedNpc,
  setCharView,
  setVideoChoice,

  // hover SFX is fine
  playHover = () => {},

  // NEW: navigation SFX (FlipPage)
  playNav = () => {},
}) {
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  };

  const menuButton = (isPrimary = false) => ({
    width: 440,
    maxWidth: '84vw',
    padding: isPrimary ? '18px 18px' : '15px 18px',
    borderRadius: 14,
    border: '1px solid rgba(255,225,160,0.35)',
    cursor: 'pointer',
    color: 'rgba(255,245,220,0.95)',
    fontSize: isPrimary ? '1.22rem' : '1.12rem',
    letterSpacing: '0.6px',
    textShadow: '0 2px 8px rgba(0,0,0,0.85)',
    background: isPrimary
      ? 'linear-gradient(180deg, rgba(210,140,40,0.92), rgba(122,55,0,0.94))'
      : 'linear-gradient(180deg, rgba(176,101,0,0.88), rgba(122,55,0,0.92))',
    boxShadow:
      '0 14px 30px rgba(0,0,0,0.55), inset 0 2px 0 rgba(255,255,255,0.18), inset 0 -8px 18px rgba(0,0,0,0.35)',
    position: 'relative',
    transition: 'transform 140ms ease, box-shadow 140ms ease, filter 140ms ease',
    userSelect: 'none',
  });

  const menuButtonHover = (e) => {
    playHover();
    e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
    e.currentTarget.style.filter = 'brightness(1.08)';
    e.currentTarget.style.boxShadow =
      '0 18px 38px rgba(0,0,0,0.62), 0 0 22px rgba(255,170,60,0.22), inset 0 2px 0 rgba(255,255,255,0.20), inset 0 -8px 18px rgba(0,0,0,0.35)';
  };

  const menuButtonLeave = (e) => {
    e.currentTarget.style.transform = 'translateY(0px) scale(1)';
    e.currentTarget.style.filter = 'none';
    e.currentTarget.style.boxShadow =
      '0 14px 30px rgba(0,0,0,0.55), inset 0 2px 0 rgba(255,255,255,0.18), inset 0 -8px 18px rgba(0,0,0,0.35)';
  };

  const menuButtonDown = (e) => {
    e.currentTarget.style.transform = 'translateY(1px) scale(0.99)';
    e.currentTarget.style.filter = 'brightness(0.98)';
  };

  return (
    <div style={panelStyle(panelType === 'menu')}>
      <style>{`
        .plaqueBtn { overflow: hidden; }
        .plaqueBtn::after {
          content: "";
          position: absolute;
          top: -40%;
          left: -60%;
          width: 60%;
          height: 180%;
          transform: rotate(20deg);
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.16), transparent);
          opacity: 0;
          transition: opacity 160ms ease;
          pointer-events: none;
        }
        .plaqueBtn:hover::after {
          opacity: 1;
          animation: sweep 700ms ease forwards;
        }
        @keyframes sweep { from { left: -60%; } to { left: 120%; } }

        @keyframes plaqueIdle {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-2px) rotate(0.15deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
      `}</style>

      <div style={menuRoot}>
        <div
          style={{
            width: 660,
            maxWidth: '92vw',
            padding: '30px 26px',
            borderRadius: 22,
            background: 'rgba(10, 8, 6, 0.60)',
            border: '1px solid rgba(255,220,160,0.16)',
            boxShadow: '0 28px 90px rgba(0,0,0,0.72)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            transform: 'translateZ(0)',
            animation: 'plaqueIdle 6.5s ease-in-out infinite',
          }}
        >
          <img
            src={koaTitle}
            alt="Knights of Avalon"
            draggable={false}
            style={{
              width: 'min(520px, 86vw)',
              height: 'auto',
              margin: 0,
              filter: 'drop-shadow(0 12px 26px rgba(0,0,0,0.85)) drop-shadow(0 0 18px rgba(0,0,0,0.55))',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />

          <div style={{ opacity: 0.75, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase' }}>Campaign Hub</div>

          <div
            style={{
              width: '100%',
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(255,220,160,0.25), transparent)',
              margin: '8px 0 6px',
            }}
          />

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingBottom: 6 }}>
            <button
              className="plaqueBtn"
              style={menuButton(true)}
              onMouseEnter={menuButtonHover}
              onMouseLeave={menuButtonLeave}
              onMouseDown={(e) => menuButtonDown(e)}
              onMouseUp={menuButtonHover}
              onClick={() => {
                playNav(); // ✅ FlipPage
                cinematicNav('campaign');
              }}
            >
              Continue Campaign
            </button>

            <button
              className="plaqueBtn"
              style={menuButton(false)}
              onMouseEnter={menuButtonHover}
              onMouseLeave={menuButtonLeave}
              onMouseDown={(e) => menuButtonDown(e)}
              onMouseUp={menuButtonHover}
              onClick={() => {
                playNav(); // ✅ FlipPage
                cinematicDo(() => {
                  setPanelType('characters');
                  setSelectedChar(null);
                  setSelectedNpc(null);
                  setCharView('grid');
                });
              }}
            >
              Character Book
            </button>

            <button
              className="plaqueBtn"
              style={menuButton(false)}
              onMouseEnter={menuButtonHover}
              onMouseLeave={menuButtonLeave}
              onMouseDown={(e) => menuButtonDown(e)}
              onMouseUp={menuButtonHover}
              onClick={() => {
                playNav(); // ✅ FlipPage
                cinematicDo(() => {
                  setPanelType('video');
                  setVideoChoice(null);
                });
              }}
            >
              Intro/Outro Video
            </button>

            <button
              className="plaqueBtn"
              style={menuButton(false)}
              onMouseEnter={menuButtonHover}
              onMouseLeave={menuButtonLeave}
              onMouseDown={(e) => menuButtonDown(e)}
              onMouseUp={menuButtonHover}
              onClick={() => alert('World Lore coming soon')}
            >
              World Lore
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
