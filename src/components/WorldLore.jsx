import React, { useEffect, useRef, useState } from 'react';
import styles from './WorldLore.module.css';

/*
  WorldLore — Knights of Atria
  Overworld knowledge center with:
  - Interactive world map with location pins
  - Tabbed image gallery (Maps, Scenes, Locations)
  - Lightbox on card click
  - Matches existing KOA tavern palette and panel system
*/

const TABS = [
  { id: 'maps', label: 'Maps', icon: '🗺️' },
  { id: 'scenes', label: 'Scenes', icon: '🎨' },
  { id: 'locations', label: 'Locations', icon: '🏰' },
  { id: 'factions', label: 'Factions', icon: '⚜️' },
];

/*
  ── HOW TO ADD YOUR IMAGES ──
  Each entry has: title, src (image path/URL), description
  Example:
    { id: 1, title: 'The Known World', src: worldMapImg, description: '...' }
  Import your images at the top of this file like:
    import worldMapImg from '../assets/lore/world-map.jpg';
*/
const GALLERY = {
  maps: [
    { id: 1, title: 'The Continent of Atria', src: 'lore/world-map.jpg', description: 'Full overworld map of the campaign setting.' },
    { id: 2, title: 'The Shattered Canyon', src: 'lore/canyon.jpg', description: 'Detailed map of the Shattered Canyon.' },
  ],
  scenes: [
    { id: 1, title: 'The Well', src: 'lore/Well.jpg', description: 'Where tensions ran high.' },
    { id: 2, title: 'Underground Ryken Church', src: 'lore/rchurch.jpg', description: 'The underground church below Avalon.' },
  ],
  locations: [
    {
      id: 1,
      title: 'The City of Qonza',
      src: 'lore/Qonza.webp',
      description: 'Crescent moon city with a cruel justice system.',
      summary: 'Qonza thrives on strict order, wealth, and carefully guarded status. Most power flows through courts, contracts, and those who can afford both.',
      region: 'Southern Trade Crescent',
      governance: 'Magistrate houses and legal guild councils',
      economy: 'Contract law, caravan tolls, and luxury trade',
      tensions: 'Class unrest, selective justice, and border corruption',
    },
    {
      id: 2,
      title: 'The City of Williwack',
      src: 'lore/Williwack.jpg',
      description: 'A desert kingdom that borders the World Spear.',
      summary: 'Williwack stands where scorched routes meet mountain shadow. Survival forged a proud city-state known for discipline and resource control.',
      region: 'Western Desert Verge',
      governance: 'Crown-appointed stewards with military oversight',
      economy: 'Water rights, glasswork, and spear-route caravans',
      tensions: 'Border skirmishes and drought-year rationing',
    },
    {
      id: 3,
      title: 'The City of Avalon',
      src: 'lore/avalonsky.jpg',
      description: 'Overview of the Center Kingdom.',
      summary: 'Avalon is a political and religious center where noble influence and temple authority constantly negotiate for control.',
      region: 'Central Kingdom',
      governance: 'Crown administration with temple arbitration',
      economy: 'State levies, artisan districts, and temple patronage',
      tensions: 'Court intrigue, church pressure, and urban crime',
    },
    {
      id: 4,
      title: 'The City of Metlos',
      src: 'lore/Metlos.jpg',
      description: 'Overview of Metlos.',
      summary: 'Metlos is a fortified industrial city known for foundries, military supply chains, and a ruthless approach to efficiency.',
      region: 'Ironward Basin',
      governance: 'Militia council with merchant bloc influence',
      economy: 'Steelworks, siege craft, and contract labor',
      tensions: 'Labor strikes and black-market weapons',
    },
    {
      id: 5,
      title: 'The Village of Orum',
      src: 'lore/orum.png',
      description: 'Overview of Orum.',
      summary: 'Orum is a small but stubborn settlement that survives by community pacts, hidden trails, and local herbal trade.',
      region: 'Greenhollow Reach',
      governance: 'Elder circle and rotating wardens',
      economy: 'Herbs, timber, and river ferries',
      tensions: 'Bandit pressure and crop blight seasons',
    },
    {
      id: 6,
      title: 'The City of Buston',
      src: 'lore/Buston.jpg',
      description: 'Overview of Buston.',
      summary: 'Buston sits on key roads and acts as a noisy commercial hinge between noble capitals and frontier outposts.',
      region: 'Northroad Junction',
      governance: 'Chartered city council',
      economy: 'Transit tariffs, inns, and warehousing',
      tensions: 'Guild turf wars and smuggling rings',
    },
    {
      id: 7,
      title: 'The Village of SkulPol',
      src: 'lore/skolpol.jpg',
      description: 'Overview of SkulPol.',
      summary: 'SkulPol is remote, weathered, and in ruins.',
      region: 'Fogline Hills',
      governance: 'Clan heads and shrine keepers',
      economy: 'Hunting, salvage, and seasonal trade',
      tensions: 'Disappearing travelers and old-feud violence',
    },
  ],
  factions: [
    {
      id: 1,
      title: 'The Velvet Rose',
      src: 'lore/rose.jpg',
      description: 'Little is known about this group. They have core members, and other mercs for hire.',
      summary: 'The Velvet Rose moves quietly through their influence throught the continent. They deal in genocide, and assassination to acheive their goals.',
      influence: 'Courts, noble estates, and other kingdoms',
      doctrine: 'Destroy the kingdom of Avalon, and balance will be restored.',
      factionKeys: ['velvet rose',],
      memberHints: ['Tarzos Spicer'],
    },
    {
      id: 2,
      title: 'The Red Fang',
      src: 'lore/redfang.jpg',
      description: 'A mercenary group the Envoy\'s encountered. They deal in human trafficking, and are close with the Von\'Donovons.',
      summary: 'The Red Fang members have been a force in the world spear. Even recruiting the likes of the tribes to do their bidding',
      influence: 'Hunting, Trafficking, underworld',
      doctrine: 'Unknown',
      factionKeys: ['red fang'],
      memberHints: ['Cerci VonDonovon'],
    },
    {
      id: 3,
      title: 'Church of Ryken',
      src: 'lore/rykenf.webp',
      description: 'Devotional branches loyal to Ryken doctrine and shadow pacts.',
      summary: 'Ryken followers split between public worship and hidden circles. Their theology attracts both desperate believers and ruthless opportunists.',
      influence: 'Underworld, crime, churches',
      doctrine: 'Misery is just the beginning of worship.',
      factionKeys: ['ryken church', 'church of ryken', 'ryken'],
      memberHints: ['Ryken', 'William Spicer'],
    },
  ],
};

const ATRIA_MAP_SRC = 'lore/world-map.jpg';
const ATRIA_MAP_ASPECT = '4 / 3'; // world-map.jpg is 2048x1536
const INITIAL_ATRIA_POINTS = [
  { locationId: 1, x: 43.2, y: 21.0 }, // Qonza
  { locationId: 2, x: 97.0, y: 32.0 }, // Williwack
  { locationId: 3, x: 51.6, y: 49.3 }, // Avalon
  { locationId: 4, x: 16.21, y: 72.59 }, // Metlos
  { locationId: 5, x: 35.2, y: 55.8 }, // Orum
  { locationId: 6, x: 87.7, y: 22.0 }, // Buston
  { locationId: 7, x: 27.4, y: 45.8 }, // SkulPol
];
const LS_WORLD_NPCS = 'koa:worldnpcs:v1';
const LS_WORLD_NPC_DEEPLINK = 'koa:worldnpcs:deeplink:v1';
const LS_CHAR_NPCS = 'koa:char:npcs:v1';

// ─── Sub-components ────────────────────────────────────────────────────────────
function CornerOrns() {
  return (
    <>
      <div className={`${styles.cornerOrn} ${styles.cornerTopLeft}`} />
      <div className={`${styles.cornerOrn} ${styles.cornerTopRight}`} />
      <div className={`${styles.cornerOrn} ${styles.cornerBottomLeft}`} />
      <div className={`${styles.cornerOrn} ${styles.cornerBottomRight}`} />
    </>
  );
}

function SectionDivider({ label }) {
  return (
    <div className={styles.sectionDividerRow}>
      <div className={`koa-divider-line ${styles.sectionDividerLine}`} />
      <span className={styles.sectionDividerLabel}>◈ &nbsp;{label}&nbsp; ◈</span>
      <div className={`koa-divider-line ${styles.sectionDividerLine}`} />
    </div>
  );
}

function InteractiveAtriaMap({
  locations = [],
  onOpenLocation = () => { },
}) {
  const stageRef = useRef(null);
  const dragRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    panX: 0,
    panY: 0,
    moved: false,
  });

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');

  const [points, setPoints] = useState(() => {
    const seededById = new Map(INITIAL_ATRIA_POINTS.map((point) => [point.locationId, point]));
    return (locations || []).map((location, index) => {
      const seeded = seededById.get(location.id);
      if (seeded) return { locationId: location.id, x: seeded.x, y: seeded.y };
      const fallbackColumn = index % 3;
      const fallbackRow = Math.floor(index / 3);
      return {
        locationId: location.id,
        x: 34 + fallbackColumn * 16,
        y: 34 + fallbackRow * 12,
      };
    });
  });
  const [selectedPointId, setSelectedPointId] = useState(() => (locations[0] ? locations[0].id : null));

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const clampPercent = (value) => clamp(value, 0, 100);
  const roundCoord = (value) => Math.round(clampPercent(value) * 100) / 100;

  const getLocationById = (locationId) =>
    (locations || []).find((location) => location.id === locationId) || null;

  const clampPanToStage = (nextPan, nextZoom = zoom) => {
    const stageEl = stageRef.current;
    if (!stageEl) return { x: 0, y: 0 };
    const rect = stageEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };

    const scaledWidth = rect.width * nextZoom;
    const scaledHeight = rect.height * nextZoom;
    const minX = Math.min(0, rect.width - scaledWidth);
    const minY = Math.min(0, rect.height - scaledHeight);

    return {
      x: clamp(nextPan.x, minX, 0),
      y: clamp(nextPan.y, minY, 0),
    };
  };

  const setPointCoords = (locationId, x, y) => {
    setPoints((prev) =>
      (prev || []).map((point) =>
        point.locationId === locationId
          ? { ...point, x: roundCoord(x), y: roundCoord(y) }
          : point
      )
    );
  };

  const toMapPercentFromClient = (clientX, clientY) => {
    const stageEl = stageRef.current;
    if (!stageEl) return null;
    const rect = stageEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const baseX = (clientX - rect.left - pan.x) / zoom;
    const baseY = (clientY - rect.top - pan.y) / zoom;

    return {
      x: roundCoord((baseX / rect.width) * 100),
      y: roundCoord((baseY / rect.height) * 100),
    };
  };

  const selectedPoint = (points || []).find((point) => point.locationId === selectedPointId) || null;
  const selectedLocation = selectedPoint ? getLocationById(selectedPoint.locationId) : null;

  const exportPoints = (points || []).map((point) => ({
    locationId: point.locationId,
    title: getLocationById(point.locationId)?.title || `Location ${point.locationId}`,
    x: Number(point.x.toFixed(2)),
    y: Number(point.y.toFixed(2)),
  }));

  useEffect(() => {
    setPoints((prev) => {
      const prevById = new Map((prev || []).map((point) => [point.locationId, point]));
      const seededById = new Map(INITIAL_ATRIA_POINTS.map((point) => [point.locationId, point]));

      return (locations || []).map((location, index) => {
        const existing = prevById.get(location.id);
        if (existing) return existing;

        const seeded = seededById.get(location.id);
        if (seeded) return { locationId: location.id, x: seeded.x, y: seeded.y };

        const fallbackColumn = index % 3;
        const fallbackRow = Math.floor(index / 3);
        return {
          locationId: location.id,
          x: 34 + fallbackColumn * 16,
          y: 34 + fallbackRow * 12,
        };
      });
    });
  }, [locations]);

  useEffect(() => {
    if ((points || []).some((point) => point.locationId === selectedPointId)) return;
    setSelectedPointId(points[0]?.locationId || null);
  }, [points, selectedPointId]);

  useEffect(() => {
    if (!copyStatus) return;
    const timer = setTimeout(() => setCopyStatus(''), 1500);
    return () => clearTimeout(timer);
  }, [copyStatus]);

  useEffect(() => {
    const onResize = () => {
      setPan((prev) => clampPanToStage(prev, zoom));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [zoom]);

  useEffect(() => {
    if (!editMode || !selectedPointId) return;
    const onKeyDown = (event) => {
      const targetTag = (event.target?.tagName || '').toUpperCase();
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') return;
      const step = event.shiftKey ? 0.02 : 0.1;
      let nextX = 0;
      let nextY = 0;
      if (event.key === 'ArrowUp') nextY = -step;
      if (event.key === 'ArrowDown') nextY = step;
      if (event.key === 'ArrowLeft') nextX = -step;
      if (event.key === 'ArrowRight') nextX = step;
      if (!nextX && !nextY) return;

      event.preventDefault();
      setPoints((prev) =>
        (prev || []).map((point) =>
          point.locationId === selectedPointId
            ? {
              ...point,
              x: roundCoord(point.x + nextX),
              y: roundCoord(point.y + nextY),
            }
            : point
        )
      );
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editMode, selectedPointId]);

  const applyZoom = (nextZoom) => {
    const normalizedZoom = clamp(Number(nextZoom) || 1, 1, 4);
    setZoom(normalizedZoom);
    setPan((prev) => clampPanToStage(prev, normalizedZoom));
  };

  const onWheelZoom = (event) => {
    // Keep regular page scrolling unless user intentionally zooms with Ctrl/Cmd + wheel.
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const rect = stageEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const delta = event.deltaY > 0 ? -0.16 : 0.16;
    const nextZoom = clamp(Number((zoom + delta).toFixed(2)), 1, 4);
    if (nextZoom === zoom) return;

    const anchorX = event.clientX - rect.left;
    const anchorY = event.clientY - rect.top;
    const zoomRatio = nextZoom / zoom;
    const nextPan = {
      x: anchorX - (anchorX - pan.x) * zoomRatio,
      y: anchorY - (anchorY - pan.y) * zoomRatio,
    };

    setZoom(nextZoom);
    setPan(clampPanToStage(nextPan, nextZoom));
  };

  const onStagePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const stageEl = stageRef.current;
    if (!stageEl) return;

    stageEl.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
      moved: false,
    };
    setDragging(true);
  };

  const onStagePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      dragRef.current.moved = true;
    }

    setPan(clampPanToStage({ x: drag.panX + dx, y: drag.panY + dy }, zoom));
  };

  const onStagePointerEnd = (event) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    stageRef.current?.releasePointerCapture?.(event.pointerId);
    dragRef.current.active = false;
    dragRef.current.pointerId = null;
    setDragging(false);
  };

  const onStageClick = (event) => {
    if (!editMode || !selectedPointId) return;
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }

    const next = toMapPercentFromClient(event.clientX, event.clientY);
    if (!next) return;
    setPointCoords(selectedPointId, next.x, next.y);
  };

  const onMarkerClick = (event, point) => {
    event.stopPropagation();
    setSelectedPointId(point.locationId);
    if (editMode) return;
    onOpenLocation(point.locationId);
  };

  const copyPointJson = async () => {
    const payload = JSON.stringify(exportPoints, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      setCopyStatus('Copied');
    } catch {
      setCopyStatus('Copy failed');
    }
  };

  return (
    <div className={styles.atriaMapWrap}>
      <div className={styles.atriaMapToolbar}>
        <div className={styles.atriaMapZoomControls}>
          <button
            className={`koa-glass-btn koa-interactive-lift ${styles.atriaToolBtn}`}
            onClick={() => applyZoom(zoom - 0.2)}
            disabled={zoom <= 1}
            title="Zoom out"
          >
            −
          </button>
          <input
            type="range"
            min={1}
            max={4}
            step={0.05}
            value={zoom}
            onChange={(event) => applyZoom(event.target.value)}
            className={styles.atriaZoomRange}
            title="Zoom"
          />
          <button
            className={`koa-glass-btn koa-interactive-lift ${styles.atriaToolBtn}`}
            onClick={() => applyZoom(zoom + 0.2)}
            disabled={zoom >= 4}
            title="Zoom in"
          >
            +
          </button>
        </div>

        <div className={styles.atriaMapEditControls}>
          <button
            className={`koa-glass-btn koa-interactive-lift ${styles.atriaToolBtnWide}`}
            onClick={() => setEditMode((prev) => !prev)}
            title="Toggle map pin edit mode"
          >
            {editMode ? 'Done Editing' : 'Edit Pins'}
          </button>

          {editMode && (
            <>
              <label className={styles.atriaPinSelectLabel}>
                Pin
                <select
                  value={selectedPointId || ''}
                  onChange={(event) => setSelectedPointId(Number(event.target.value))}
                  className={styles.atriaPinSelect}
                >
                  {(locations || []).map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.title}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className={`koa-glass-btn koa-interactive-lift ${styles.atriaToolBtnWide}`}
                onClick={copyPointJson}
                title="Copy location coordinates as JSON"
              >
                Copy JSON
              </button>
            </>
          )}
        </div>
      </div>

      <div
        ref={stageRef}
        onWheel={onWheelZoom}
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={onStagePointerEnd}
        onPointerCancel={onStagePointerEnd}
        onClick={onStageClick}
        className={styles.atriaMapStage}
        style={{
          cursor: dragging ? 'grabbing' : (editMode ? 'crosshair' : (zoom > 1 ? 'grab' : 'grab')),
          '--atria-map-aspect': ATRIA_MAP_ASPECT,
        }}
      >
        <div
          className={styles.atriaMapLayer}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          <img
            src={ATRIA_MAP_SRC}
            alt="The Continent of Atria"
            draggable={false}
            className={styles.atriaMapImage}
          />

          {(points || []).map((point) => {
            const location = getLocationById(point.locationId);
            const label = location?.title || `Location ${point.locationId}`;
            const isSelected = point.locationId === selectedPointId;
            return (
              <button
                key={point.locationId}
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => onMarkerClick(event, point)}
                className={`${styles.atriaMarker} ${isSelected ? styles.atriaMarkerSelected : ''}`}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                title={editMode ? `Select ${label}` : `Open ${label}`}
                aria-label={editMode ? `Select ${label} pin` : `Open ${label}`}
              >
                <span className={styles.atriaMarkerDot} />
              </button>
            );
          })}
        </div>

        <div className={styles.atriaMapHint}>
          {editMode
            ? 'Edit mode: select a pin, click map to place it, use arrow keys to nudge (Shift for fine movement).'
            : 'Use + / − or slider to zoom. Hold Ctrl/Cmd + wheel for mouse-wheel zoom. Drag to pan, click a pin to open its location card.'}
        </div>
      </div>

      <div className={styles.atriaMapFooter}>
        <div className={styles.atriaMapFooterPrimary}>
          {selectedLocation ? selectedLocation.title : 'No location selected'}
        </div>
        <div className={styles.atriaMapFooterSecondary}>
          {selectedPoint ? `X ${selectedPoint.x.toFixed(2)}% • Y ${selectedPoint.y.toFixed(2)}%` : 'No coordinates'}
        </div>
        {copyStatus && (
          <div className={styles.atriaMapCopyStatus}>{copyStatus}</div>
        )}
      </div>

      <CornerOrns />
    </div>
  );
}



function ImageCard({ item, onClick }) {
  // Allow per-card preview control:
  // item.pos: 'center top' etc
  // item.fit: 'cover' or 'contain'
  const pos = item.pos || 'center';
  const fit = item.fit || 'cover';
  const mediaVars = item.src
    ? {
      '--wl-image-url': `url(${item.src})`,
      '--wl-image-pos': pos,
      '--wl-image-fit': fit,
    }
    : undefined;

  return (
    <div
      onClick={() => onClick(item)}
      className={styles.imageCard}
    >
      <div
        className={`${styles.imageCardMedia} ${!item.src ? styles.imageCardMediaEmpty : ''}`}
        style={mediaVars}
      >
        {!item.src && (
          <div className={styles.imageCardPlaceholder}>
            <div className={styles.imageCardPlaceholderIcon}>🖼️</div>
            <div className={styles.imageCardPlaceholderText}>
              NO IMAGE SET
            </div>
          </div>
        )}
        <div className={styles.imageCardShimmer} />
        <CornerOrns />
      </div>

      <div className={styles.imageCardBody}>
        <div className={styles.imageCardTitle}>{item.title}</div>
        <div className={styles.imageCardDesc}>{item.description}</div>
      </div>
    </div>
  );
}

function Lightbox({
  item,
  onClose,
  onOpenWorldNpcs = () => { },
  onOpenMember = () => { },
  getFactionMembers = () => [],
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, panX: 0, panY: 0 });

  useEffect(() => {
    if (!item) return;
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setDragging(false);
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  const tab = item._tab || 'maps';
  const isLocation = tab === 'locations';
  const isFaction = tab === 'factions';
  const factionMembers = isFaction ? getFactionMembers(item) : [];

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const setZoomClamped = (val) => setZoom(clamp(val, 1, 5));

  const onWheel = (e) => {
    if (!item?.src) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.12 : 0.12;
    setZoomClamped(+(zoom + delta).toFixed(2));
  };

  const startDrag = (e) => {
    if (!item?.src) return;
    setDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  };
  const moveDrag = (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy });
  };
  const endDrag = () => setDragging(false);
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const zoomIn = () => setZoomClamped(+(zoom + 0.25).toFixed(2));
  const zoomOut = () => setZoomClamped(+(zoom - 0.25).toFixed(2));

  if (isLocation || isFaction) {
    return (
      <div
        onClick={onClose}
        className={styles.lightboxOverlay}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className={`${styles.lightboxCard} ${styles.lightboxInfoCard}`}
        >
          <div className={styles.lightboxHeader}>
            <div className={styles.lightboxTitleStack}>
              <span className={styles.lightboxTitle}>{item.title}</span>
              <span className={styles.lightboxSubTag}>
                {isFaction ? 'Faction Dossier' : 'Settlement Summary'}
              </span>
            </div>

            <button
              onClick={onClose}
              className={styles.lightboxIconBtn}
              title="Close"
            >
              ✕
            </button>
          </div>

          <div
            className={`koa-scrollbar-thin ${styles.lightboxInfoGrid}`}
          >
            <div className={styles.lightboxImageFrame}>
              {item.src ? (
                <img
                  src={item.src}
                  alt={item.title}
                  className={styles.lightboxInfoImage}
                />
              ) : (
                <div className={styles.lightboxPlaceholder}>
                  <div className={styles.lightboxPlaceholderIcon}>🖼️</div>
                  <div className={styles.lightboxPlaceholderText}>
                    IMAGE NOT YET ASSIGNED
                  </div>
                </div>
              )}
            </div>

            <div className={styles.lightboxInfoPanel}>
              <div className={styles.lightboxInfoSummary}>
                {(item.summary || item.description || '').trim() || 'No summary has been added for this entry yet.'}
              </div>

              <div className={`koa-divider-line ${styles.lightboxInfoDivider}`} />

              {!isFaction ? (
                <div className={styles.lightboxFacts}>
                  <div><strong className={styles.factLabel}>Region:</strong> {(item.region || 'Unknown').trim()}</div>
                  <div><strong className={styles.factLabel}>Governance:</strong> {(item.governance || 'Unknown').trim()}</div>
                  <div><strong className={styles.factLabel}>Economy:</strong> {(item.economy || 'Unknown').trim()}</div>
                  <div><strong className={styles.factLabel}>Current Tensions:</strong> {(item.tensions || 'Unknown').trim()}</div>
                </div>
              ) : (
                <div className={styles.lightboxFacts}>
                  <div><strong className={styles.factLabel}>Influence:</strong> {(item.influence || 'Unknown').trim()}</div>
                  <div><strong className={styles.factLabel}>Doctrine:</strong> {(item.doctrine || 'Unknown').trim()}</div>
                </div>
              )}
            </div>

            {isFaction && (
              <div className={styles.factionMembersPanel}>
                <div className={styles.factionMembersTitle}>
                  Known Members
                </div>

                {factionMembers.length === 0 ? (
                  <div className={styles.factionMembersEmpty}>
                    No linked World NPC entries yet. Add or tag members in the World NPC Codex, then they will show up here.
                  </div>
                ) : (
                  <div className={styles.factionMembersList}>
                    {factionMembers.map((member, idx) => (
                      <div
                        key={`${member.id || member.name || 'member'}-${idx}`}
                        className={styles.factionMemberRow}
                      >
                        <div className={styles.factionMemberBody}>
                          <div className={styles.factionMemberName}>{member.name || 'Unnamed NPC'}</div>
                          <div className={styles.factionMemberMeta}>
                            {member.occupation ? `${member.occupation} • ` : ''}{member.location || 'Location unknown'}
                          </div>
                        </div>
                        <button
                          onClick={() => onOpenMember(member)}
                          className={`koa-glass-btn koa-interactive-lift ${styles.lightboxPillBtn}`}
                        >
                          Open Profile
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className={styles.factionFooter}>
                  <button
                    onClick={() => onOpenWorldNpcs({ faction: '' })}
                    className={`koa-glass-btn koa-interactive-lift ${styles.lightboxPillBtn}`}
                  >
                    Open Full World NPC Codex
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className={styles.lightboxFooterDesc}>
            {item.description}
          </div>

          <CornerOrns />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClose}
      onMouseMove={moveDrag}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      className={styles.lightboxOverlay}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`${styles.lightboxCard} ${styles.lightboxZoomCard}`}
      >
        <div className={styles.lightboxZoomHeader}>
          <span className={styles.lightboxTitle}>
            {item.title}
          </span>

          <div className={styles.lightboxControls}>
            <button
              onClick={zoomOut}
              disabled={!item.src || zoom <= 1}
              className={styles.lightboxCtrlBtn}
              title="Zoom out"
            >−</button>

            <input
              type="range"
              min={1}
              max={5}
              step={0.05}
              value={zoom}
              disabled={!item.src}
              onChange={(e) => setZoomClamped(parseFloat(e.target.value))}
              className={styles.lightboxRange}
              title="Zoom"
            />

            <button
              onClick={zoomIn}
              disabled={!item.src || zoom >= 5}
              className={styles.lightboxCtrlBtn}
              title="Zoom in"
            >+</button>

            <button
              onClick={resetView}
              disabled={!item.src}
              className={`${styles.lightboxCtrlBtn} ${styles.lightboxResetBtn}`}
              title="Reset view"
            >Reset</button>

            <button
              onClick={onClose}
              className={styles.lightboxIconBtn}
              title="Close"
            >✕</button>
          </div>
        </div>

        <div
          onWheel={onWheel}
          className={styles.lightboxImageStage}
        >
          {item.src ? (
            <img
              src={item.src}
              alt={item.title}
              draggable={false}
              onMouseDown={startDrag}
              onDoubleClick={resetView}
              className={styles.lightboxZoomImage}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                cursor: dragging ? 'grabbing' : (zoom > 1 ? 'grab' : 'default'),
                transition: dragging ? 'none' : 'transform 80ms ease',
              }}
            />
          ) : (
            <div className={styles.lightboxPlaceholder}>
              <div className={styles.lightboxPlaceholderIcon}>🖼️</div>
              <div className={styles.lightboxPlaceholderText}>
                IMAGE NOT YET ASSIGNED
              </div>
            </div>
          )}

          {item.src && (
            <div className={styles.lightboxHint}>
              Wheel: Zoom • Drag: Pan • Double-click: Reset
            </div>
          )}
        </div>

        <div className={styles.lightboxFooterDesc}>
          {item.description}
        </div>

        <CornerOrns />
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function WorldLore({
  panelType,
  cinematicNav,
  playNav = () => { },
  setCharView,
  setSelectedChar,
  setSelectedNpc,
  characters = [],
}) {
  const [activeTab, setActiveTab] = useState('maps');
  const [lightboxItem, setLightboxItem] = useState(null);

  const isActive = panelType === 'worldLore';

  useEffect(() => {
    if (!isActive) setLightboxItem(null);
  }, [isActive]);

  const goBack = () => {
    cinematicNav('menu');
  };

  const normalizeText = (value) => (value || '').toString().trim().toLowerCase();

  const normalizeWorldNpc = (npc, idx = 0) => ({
    id: (npc?.id && String(npc.id)) || `worldnpc::${idx}::${npc?.name || 'npc'}`,
    name: (npc?.name || '').trim(),
    age: (npc?.age || '').trim(),
    faction: (npc?.faction || '').trim(),
    occupation: (npc?.occupation || '').trim(),
    location: (npc?.location || '').trim(),
    summary: (npc?.summary || npc?.bio || '').trim(),
    bio: (npc?.bio || '').trim(),
    image: npc?.image || '',
    characterLinks: Array.isArray(npc?.characterLinks)
      ? npc.characterLinks
        .map((l, linkIndex) => ({
          characterName: (l?.characterName || '').trim(),
          relation: (l?.relation || '').trim(),
          linkIndex,
        }))
        .filter((l) => l.characterName)
      : [],
  });

  const normalizeRelatedNpc = (npc, charName, idx = 0) => ({
    id: (npc?.id && String(npc.id)) || `${charName}::${npc?.name || 'npc'}::${idx}`,
    name: (npc?.name || '').trim(),
    relation: (npc?.relation || '').trim(),
    age: (npc?.age || '').trim(),
    faction: (npc?.faction || '').trim(),
    occupation: (npc?.occupation || '').trim(),
    summary: (npc?.summary || npc?.bio || '').trim(),
    bio: (npc?.bio || '').trim(),
    image: npc?.image || '',
    source: npc?.source || 'character',
    worldNpcId: npc?.worldNpcId || null,
  });

  const readWorldNpcs = () => {
    try {
      const raw = localStorage.getItem(LS_WORLD_NPCS);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const readCharacterNpcStore = () => {
    try {
      const raw = localStorage.getItem(LS_CHAR_NPCS);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const getFactionMembers = (factionItem) => {
    const worldNpcs = readWorldNpcs();
    const aliases = new Set(
      [factionItem?.title, ...(Array.isArray(factionItem?.factionKeys) ? factionItem.factionKeys : [])]
        .map(normalizeText)
        .filter(Boolean)
    );
    const hintNames = (Array.isArray(factionItem?.memberHints) ? factionItem.memberHints : [])
      .map((name) => (name || '').trim())
      .filter(Boolean);
    const hintSet = new Set(hintNames.map(normalizeText));
    const out = [];
    const seen = new Set();

    (worldNpcs || []).forEach((rawNpc, idx) => {
      const npc = normalizeWorldNpc(rawNpc, idx);
      const name = npc.name;
      const id = String(npc.id || `idx:${idx}`);
      const faction = npc.faction;
      const factionHit = aliases.size > 0 && aliases.has(normalizeText(faction));
      const hintHit = hintSet.has(normalizeText(name));
      if (!factionHit && !hintHit) return;
      if (seen.has(id)) return;
      seen.add(id);
      out.push({
        id,
        worldNpcId: npc.id,
        name: name || 'Unnamed NPC',
        faction,
        location: npc.location,
        occupation: npc.occupation,
        age: npc.age,
        summary: npc.summary,
        bio: npc.bio,
        image: npc.image,
        characterLinks: npc.characterLinks,
      });
    });

    hintNames.forEach((hint) => {
      const key = normalizeText(hint);
      const exists = out.some((m) => normalizeText(m.name) === key);
      if (!exists) {
        out.push({
          id: `hint:${key}`,
          worldNpcId: null,
          name: hint,
          faction: '',
          location: '',
          occupation: '',
          age: '',
          summary: '',
          bio: '',
          image: '',
          characterLinks: [],
        });
      }
    });

    return out.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  };

  const openWorldNpcCodex = ({ search = '', faction = '' } = {}) => {
    setLightboxItem(null);
    try {
      localStorage.setItem(
        LS_WORLD_NPC_DEEPLINK,
        JSON.stringify({
          search: (search || '').trim(),
          faction: (faction || '').trim(),
          ts: Date.now(),
        })
      );
    } catch { }

    if (typeof setSelectedChar === 'function') setSelectedChar(null);
    if (typeof setSelectedNpc === 'function') setSelectedNpc(null);
    if (typeof setCharView === 'function') setCharView('worldnpcs');
    playNav();
    cinematicNav('characters');
  };

  const findCharacterByName = (name) => {
    const key = normalizeText(name);
    if (!key) return null;
    return (Array.isArray(characters) ? characters : []).find((char) => normalizeText(char?.name) === key) || null;
  };

  const openCharacterProfile = (character) => {
    if (!character) return;
    setLightboxItem(null);
    if (typeof setSelectedChar === 'function') setSelectedChar(character);
    if (typeof setSelectedNpc === 'function') setSelectedNpc(null);
    if (typeof setCharView === 'function') setCharView('detail');
    playNav();
    cinematicNav('characters');
  };

  const openNpcProfile = (character, npc) => {
    if (!character || !npc) return;
    setLightboxItem(null);
    if (typeof setSelectedChar === 'function') setSelectedChar(character);
    if (typeof setSelectedNpc === 'function') setSelectedNpc(npc);
    if (typeof setCharView === 'function') setCharView('npc');
    playNav();
    cinematicNav('characters');
  };

  const findCharacterNpcByName = (npcName) => {
    const key = normalizeText(npcName);
    if (!key) return null;

    const store = readCharacterNpcStore();
    const roster = Array.isArray(characters) ? characters : [];

    for (const char of roster) {
      const saved = Array.isArray(store?.[char?.name]) ? store[char.name] : [];
      const base = Array.isArray(char?.npcs) ? char.npcs : [];

      const seenNames = new Set();
      const merged = [...saved, ...base].filter((npc) => {
        const npcKey = normalizeText(npc?.name);
        if (!npcKey || seenNames.has(npcKey)) return false;
        seenNames.add(npcKey);
        return true;
      });

      const idx = merged.findIndex((npc) => normalizeText(npc?.name) === key);
      if (idx >= 0) {
        return {
          character: char,
          npc: normalizeRelatedNpc(merged[idx], char?.name || 'Character', idx),
        };
      }
    }

    return null;
  };

  const openFactionMemberProfile = (member) => {
    const memberName = (member?.name || '').trim();
    if (!memberName) {
      openWorldNpcCodex({ faction: member?.faction || '' });
      return;
    }

    const directCharacter = findCharacterByName(memberName);
    if (directCharacter) {
      openCharacterProfile(directCharacter);
      return;
    }

    const memberLinks = Array.isArray(member?.characterLinks) ? member.characterLinks : [];
    for (const link of memberLinks) {
      const linkedCharacter = findCharacterByName(link?.characterName);
      if (!linkedCharacter) continue;

      openNpcProfile(linkedCharacter, {
        id: `worldlink::${member.worldNpcId || member.id || memberName}::${linkedCharacter.name}::${Number.isInteger(link?.linkIndex) ? link.linkIndex : 0}`,
        name: memberName,
        relation: (link?.relation || '').trim() || 'Related NPC',
        age: member?.age || '',
        faction: member?.faction || '',
        occupation: member?.occupation || '',
        summary: member?.summary || member?.bio || '',
        bio: member?.bio || '',
        image: member?.image || '',
        source: 'world',
        worldNpcId: member?.worldNpcId || member?.id || null,
      });
      return;
    }

    const characterNpc = findCharacterNpcByName(memberName);
    if (characterNpc) {
      openNpcProfile(characterNpc.character, characterNpc.npc);
      return;
    }

    openWorldNpcCodex({ search: memberName, faction: member?.faction || '' });
  };

  const tabDescriptions = {
    maps: 'Cartographic records of explored and rumored territories.',
    scenes: 'Captured moments from the chronicle of our journey.',
    locations: 'Places of interest, wonder, and danger throughout the realm.',
    factions: 'Power blocs, sects, and alliances that shape the realm.',
  };

  const openLocationFromMap = (locationId) => {
    const picked = GALLERY.locations.find((location) => location.id === locationId);
    if (!picked) return;
    setLightboxItem({ ...picked, _tab: 'locations' });
  };

  return (
    <div className={`${styles.panel} ${isActive ? styles.panelActive : styles.panelInactive}`}>
      <div className={`koa-scrollbar-thin ${styles.worldLoreScrollWrap}`}>
        <div className={styles.worldLoreHeader}>
          <button
            onClick={goBack}
            className={`koa-glass-btn koa-interactive-lift ${styles.worldLoreReturnBtn}`}
          >
            ← RETURN
          </button>

          <div className={styles.worldLoreTitleWrap}>
            <div className={styles.worldLoreKicker}>
              ✦ &nbsp; COMPENDIUM OF THE REALM &nbsp; ✦
            </div>
            <h1 className={styles.worldLoreTitle}>WORLD LORE</h1>
          </div>

          <div className={styles.worldLoreHeaderSpacer} />
        </div>

        <div className={styles.worldLoreContent}>
          <section>
            <SectionDivider label="World Map" />
            <InteractiveAtriaMap
              locations={GALLERY.locations}
              onOpenLocation={openLocationFromMap}
            />
          </section>

          <section>
            <SectionDivider label="Archives" />

            <div className={styles.loreTabBar}>
              {TABS.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`${styles.loreTabBtn} ${active ? styles.loreTabBtnActive : ''}`}
                  >
                    <span className={`${styles.loreTabIcon} ${active ? styles.loreTabIconActive : ''}`}>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className={styles.galleryGrid}>
              {GALLERY[activeTab].map((item) => (
                <ImageCard
                  key={item.id}
                  item={item}
                  onClick={(picked) => setLightboxItem({ ...picked, _tab: activeTab })}
                />
              ))}
            </div>

            <div className={styles.tabCaption}>
              {tabDescriptions[activeTab]}
            </div>
          </section>
        </div>
      </div>

      {/* Lightbox */}
      <Lightbox
        item={lightboxItem}
        onClose={() => setLightboxItem(null)}
        onOpenWorldNpcs={openWorldNpcCodex}
        onOpenMember={openFactionMemberProfile}
        getFactionMembers={getFactionMembers}
      />
    </div>
  );
}
