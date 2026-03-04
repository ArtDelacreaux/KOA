import React, { useEffect, useRef, useState } from 'react';
import styles from './WorldLore.module.css';
import {
  normalizeRelatedNpc,
  normalizeText,
  normalizeWorldNpc,
  readCharacterNpcStore,
  readWorldNpcsRaw,
  setWorldNpcDeepLink,
} from '../domain/worldNpcs';
import { DEFAULT_CHARACTERS } from '../data/characters';
import { STORAGE_KEYS } from '../lib/storageKeys';
import { repository } from '../repository';

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
const DEFAULT_CHARACTER_NPCS_BY_ID = new Map();
const DEFAULT_CHARACTER_NPCS_BY_NAME = new Map();

(Array.isArray(DEFAULT_CHARACTERS) ? DEFAULT_CHARACTERS : []).forEach((char) => {
  const idKey = normalizeText(char?.id);
  const nameKey = normalizeText(char?.name);
  const npcList = Array.isArray(char?.npcs) ? char.npcs : [];
  if (idKey) DEFAULT_CHARACTER_NPCS_BY_ID.set(idKey, npcList);
  if (nameKey) DEFAULT_CHARACTER_NPCS_BY_NAME.set(nameKey, npcList);
});

function getCanonicalBaseNpcsForCharacter(char) {
  const idKey = normalizeText(char?.id);
  const nameKey = normalizeText(char?.name);
  const hasCanonical =
    (idKey && DEFAULT_CHARACTER_NPCS_BY_ID.has(idKey))
    || (nameKey && DEFAULT_CHARACTER_NPCS_BY_NAME.has(nameKey));
  if (hasCanonical) {
    return DEFAULT_CHARACTER_NPCS_BY_ID.get(idKey)
      || DEFAULT_CHARACTER_NPCS_BY_NAME.get(nameKey)
      || [];
  }
  return Array.isArray(char?.npcs) ? char.npcs : [];
}

// initial, default gallery data; users can override via the repository
const DEFAULT_GALLERY = {
  maps: [
    { id: 1, title: 'The Continent of Atria', src: 'lore/world-map.jpg', description: 'Full overworld map of the campaign setting.' },
    { id: 2, title: 'The Shattered Canyon', src: 'lore/canyon.jpg', description: 'Detailed map of the Shattered Canyon.' },
  ],
  scenes: [
    { id: 1, title: 'The Well', src: 'lore/Well.jpg', description: 'Where tensions ran high.', summary: '' },
    { id: 2, title: 'Underground Ryken Church', src: 'lore/rchurch.jpg', description: 'The underground church below Avalon.', summary: '' },
  ],
  locations: [
    {
      id: 1,
      title: 'The City of Qonza',
      src: 'lore/Qonza.webp',
      description: 'Crescent moon city with a cruel justice system.',
      summary: 'Crescent moon city with a cruel justice system.',
      region: 'Unknown',
      governance: 'Unknown',
      economy: 'Unknown',
      tensions: 'Unknown',
    },
    {
      id: 2,
      title: 'The City of Williwack',
      src: 'lore/Williwack.jpg',
      description: 'A desert kingdom that borders the World Spear.',
      summary: 'A desert kingdom that borders the World Spear.',
      region: 'Unknown',
      governance: 'Unknown',
      economy: 'Unknown',
      tensions: 'Unknown',
    },
    {
      id: 3,
      title: 'The City of Avalon',
      src: 'lore/avalonsky.jpg',
      description: 'Overview of the Center Kingdom.',
      summary: 'Avalon is a political and religious center where noble influence and temple authority constantly negotiate for control.',
      region: 'Central Kingdom',
      governance: 'Unknown',
      economy: 'Unknown',
      tensions: 'Unknown',
    },
    {
      id: 4,
      title: 'The City of Metlos',
      src: 'lore/Metlos.jpg',
      description: 'Overview of Metlos.',
      summary: 'Metlos is a Golden Isles city.',
      region: 'Unknown',
      governance: 'Unknown',
      economy: 'Unknown',
      tensions: 'Unknown',
    },
    {
      id: 5,
      title: 'The Village of Orum',
      src: 'lore/orum.png',
      description: 'Overview of Orum.',
      summary: 'Orum is a small but stubborn settlement that holds a very powerful home.',
      region: 'Unknown',
      governance: 'Unknown',
      economy: 'Unknown',
      tensions: 'Unknown',
    },
    {
      id: 6,
      title: 'The City of Buston',
      src: 'lore/Buston.jpg',
      description: 'Overview of Buston.',
      summary: 'Buston sits on key roads and acts as a noisy commercial hinge between noble capitals and frontier outposts.',
      region: 'Unknown',
      governance: 'Unknown',
      economy: 'Unknown',
      tensions: 'Unknown',
    },
    {
      id: 7,
      title: 'The Village of SkulPol',
      src: 'lore/skolpol.jpg',
      description: 'Overview of SkulPol.',
      summary: 'SkulPol is remote, weathered, and in ruins.',
      region: 'Unknown',
      governance: 'Unknown',
      economy: 'Unknown',
      tensions: 'Unknown',
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

const DEFAULT_IDS_BY_TAB = TABS.reduce((acc, tab) => {
  acc[tab.id] = new Set(
    (Array.isArray(DEFAULT_GALLERY[tab.id]) ? DEFAULT_GALLERY[tab.id] : [])
      .map((item) => String(item?.id))
  );
  return acc;
}, {});

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
const DEFAULT_PRIMARY_MAP_ID = DEFAULT_GALLERY.maps?.[0]?.id ?? null;
const INITIAL_ATRIA_POINTS_BY_LOCATION = new Map(
  INITIAL_ATRIA_POINTS.map((point) => [String(point.locationId), { x: point.x, y: point.y }])
);

const ABSOLUTE_URL_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

function resolveLoreImageSrc(src) {
  const raw = String(src || '').trim();
  if (!raw) return '';
  if (ABSOLUTE_URL_RE.test(raw)) return raw;

  const normalizedPath = raw
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');

  if (!normalizedPath) return '';

  const base = String(import.meta.env.BASE_URL || '/');
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;

  // Avoid duplicating the app base if the stored path already includes it.
  if (normalizedBase !== '/' && normalizedPath.startsWith(normalizedBase.slice(1))) {
    return `/${normalizedPath}`;
  }

  return normalizedBase === '/'
    ? `/${normalizedPath}`
    : `${normalizedBase}${normalizedPath}`;
}

function idsMatch(left, right) {
  return String(left ?? '') === String(right ?? '');
}

function clampPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
}

function roundPercent(value) {
  return Math.round(clampPercent(value) * 100) / 100;
}

function normalizeMapPoint(point) {
  if (!point || typeof point !== 'object') return null;
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: roundPercent(x), y: roundPercent(y) };
}

function mapPointsEqual(left, right) {
  if (!left || !right) return false;
  return left.x === right.x && left.y === right.y;
}

function getFallbackMapId(maps = []) {
  const first = (Array.isArray(maps) ? maps : []).find((map) => map && map.id != null);
  return first ? first.id : null;
}

function resolveLocationMapId(location, maps = [], fallbackMapId = null) {
  const mapList = Array.isArray(maps) ? maps : [];
  const hasMaps = mapList.length > 0;
  const candidate = location?.mapId;

  if (candidate != null && candidate !== '') {
    if (!hasMaps || mapList.some((map) => idsMatch(map?.id, candidate))) {
      return candidate;
    }
  }

  if (fallbackMapId != null && fallbackMapId !== '') return fallbackMapId;
  return hasMaps ? mapList[0].id : null;
}

function getSeededAtriaPoint(locationId, mapId) {
  if (!idsMatch(mapId, DEFAULT_PRIMARY_MAP_ID)) return null;
  const seeded = INITIAL_ATRIA_POINTS_BY_LOCATION.get(String(locationId));
  return seeded ? { x: seeded.x, y: seeded.y } : null;
}

function normalizeLocationForStorage(location, maps = [], fallbackMapId = null) {
  const safeLocation = location && typeof location === 'object' ? location : {};
  const resolvedMapId = resolveLocationMapId(safeLocation, maps, fallbackMapId);
  const mapPoint = normalizeMapPoint(safeLocation.mapPoint) || getSeededAtriaPoint(safeLocation.id, resolvedMapId) || null;
  return {
    ...safeLocation,
    mapId: resolvedMapId,
    mapPoint,
  };
}

function resolveMapAspect(mapItem) {
  const aspect = String(mapItem?.aspect || '').trim();
  return aspect || ATRIA_MAP_ASPECT;
}

function resolveMapIdFromSelectValue(value, maps = []) {
  const pick = (Array.isArray(maps) ? maps : []).find((map) => String(map?.id) === String(value));
  return pick ? pick.id : value;
}

function getMapTitleById(mapId, maps = []) {
  const hit = (Array.isArray(maps) ? maps : []).find((map) => idsMatch(map?.id, mapId));
  return (hit?.title || '').trim() || 'Unassigned';
}

// helper that merges stored edits with defaults
function mergeGallery(defaultGallery, storedGallery) {
  const source = storedGallery && typeof storedGallery === 'object' ? storedGallery : {};
  const out = {};
  TABS.forEach((tab) => {
    const defaultList = Array.isArray(defaultGallery[tab.id]) ? defaultGallery[tab.id] : [];
    const storedList = Array.isArray(source[tab.id]) ? source[tab.id] : [];
    const map = new Map(defaultList.map((item) => [item.id, { ...item }]));
    storedList.forEach((item) => {
      if (item && item.id != null) {
        map.set(item.id, { ...map.get(item.id) || {}, ...item });
      }
    });
    out[tab.id] = Array.from(map.values());
  });
  const mapList = Array.isArray(out.maps) ? out.maps : [];
  const fallbackMapId = getFallbackMapId(mapList) ?? DEFAULT_PRIMARY_MAP_ID;
  out.locations = (Array.isArray(out.locations) ? out.locations : [])
    .map((location) => normalizeLocationForStorage(location, mapList, fallbackMapId));
  return out;
}

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
  maps = [],
  activeMapId = null,
  onSelectMap = () => { },
  locations = [],
  onOpenLocation = () => { },
  onUpdateLocationPoint = () => { },
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
  const [selectedPointId, setSelectedPointId] = useState(null);

  const mapList = Array.isArray(maps) ? maps : [];
  const fallbackMapId = getFallbackMapId(mapList);
  const resolvedActiveMapId = activeMapId != null ? activeMapId : fallbackMapId;
  const activeMap = mapList.find((map) => idsMatch(map?.id, resolvedActiveMapId)) || mapList[0] || null;
  const activeMapSrc = resolveLoreImageSrc(activeMap?.src);
  const activeMapAspect = resolveMapAspect(activeMap);

  const activeLocations = (Array.isArray(locations) ? locations : [])
    .map((location) => normalizeLocationForStorage(location, mapList, fallbackMapId))
    .filter((location) => activeMap && idsMatch(location.mapId, activeMap.id));

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const buildPointForLocation = (location, index) => {
    const explicit = normalizeMapPoint(location?.mapPoint);
    const seeded = getSeededAtriaPoint(location?.id, activeMap?.id);
    if (explicit) return explicit;
    if (seeded) return seeded;

    const fallbackColumn = index % 3;
    const fallbackRow = Math.floor(index / 3);
    return {
      x: roundPercent(34 + fallbackColumn * 16),
      y: roundPercent(34 + fallbackRow * 12),
    };
  };

  const points = activeLocations.map((location, index) => {
    const point = buildPointForLocation(location, index);
    return {
      locationId: location.id,
      x: point.x,
      y: point.y,
    };
  });

  const getLocationById = (locationId) =>
    activeLocations.find((location) => idsMatch(location.id, locationId)) || null;

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
    if (!activeMap) return;
    onUpdateLocationPoint(locationId, activeMap.id, {
      x: roundPercent(x),
      y: roundPercent(y),
    });
  };

  const toMapPercentFromClient = (clientX, clientY) => {
    const stageEl = stageRef.current;
    if (!stageEl) return null;
    const rect = stageEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const baseX = (clientX - rect.left - pan.x) / zoom;
    const baseY = (clientY - rect.top - pan.y) / zoom;

    return {
      x: roundPercent((baseX / rect.width) * 100),
      y: roundPercent((baseY / rect.height) * 100),
    };
  };

  const selectedPoint = points.find((point) => idsMatch(point.locationId, selectedPointId)) || null;
  const selectedLocation = selectedPoint ? getLocationById(selectedPoint.locationId) : null;

  const exportPoints = points.map((point) => ({
    mapId: activeMap?.id ?? null,
    mapTitle: activeMap?.title || 'Unknown map',
    locationId: point.locationId,
    title: getLocationById(point.locationId)?.title || `Location ${point.locationId}`,
    x: Number(point.x.toFixed(2)),
    y: Number(point.y.toFixed(2)),
  }));

  useEffect(() => {
    if (points.some((point) => idsMatch(point.locationId, selectedPointId))) return;
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
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setDragging(false);
  }, [activeMap?.id]);

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

      const current = points.find((point) => idsMatch(point.locationId, selectedPointId));
      if (!current) return;

      event.preventDefault();
      setPointCoords(selectedPointId, current.x + nextX, current.y + nextY);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editMode, points, selectedPointId]);

  const applyZoom = (nextZoom) => {
    if (!activeMap) return;
    const normalizedZoom = clamp(Number(nextZoom) || 1, 1, 4);
    setZoom(normalizedZoom);
    setPan((prev) => clampPanToStage(prev, normalizedZoom));
  };

  const onWheelZoom = (event) => {
    // Keep regular page scrolling unless user intentionally zooms with Ctrl/Cmd + wheel.
    if (!event.ctrlKey && !event.metaKey) return;
    if (!activeMap) return;
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
    if (!activeMap) return;
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
    if (!activeMap) return;
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
    if (!activeMap) return;
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
          <label className={styles.atriaPinSelectLabel}>
            Map
            <select
              value={activeMap ? String(activeMap.id) : ''}
              onChange={(event) => {
                const nextValue = event.target.value;
                if (!nextValue) return;
                onSelectMap(resolveMapIdFromSelectValue(nextValue, mapList));
              }}
              className={styles.atriaPinSelect}
              disabled={mapList.length === 0}
            >
              {mapList.map((map) => (
                <option key={String(map.id)} value={String(map.id)}>
                  {map.title || `Map ${map.id}`}
                </option>
              ))}
            </select>
          </label>
          <button
            className={`koa-glass-btn koa-interactive-lift ${styles.atriaToolBtn}`}
            onClick={() => applyZoom(zoom - 0.2)}
            disabled={!activeMap || zoom <= 1}
            title="Zoom out"
          >
            -
          </button>
          <input
            type="range"
            min={1}
            max={4}
            step={0.05}
            value={zoom}
            onChange={(event) => applyZoom(event.target.value)}
            className={styles.atriaZoomRange}
            disabled={!activeMap}
            title="Zoom"
          />
          <button
            className={`koa-glass-btn koa-interactive-lift ${styles.atriaToolBtn}`}
            onClick={() => applyZoom(zoom + 0.2)}
            disabled={!activeMap || zoom >= 4}
            title="Zoom in"
          >
            +
          </button>
        </div>

        <div className={styles.atriaMapEditControls}>
          <button
            className={`koa-glass-btn koa-interactive-lift ${styles.atriaToolBtnWide}`}
            onClick={() => setEditMode((prev) => !prev)}
            disabled={!activeMap}
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
                  onChange={(event) => setSelectedPointId(event.target.value)}
                  className={styles.atriaPinSelect}
                >
                  {activeLocations.map((location) => (
                    <option key={String(location.id)} value={location.id}>
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
          cursor: !activeMap ? 'default' : (dragging ? 'grabbing' : (editMode ? 'crosshair' : 'grab')),
          '--atria-map-aspect': activeMapAspect,
        }}
      >
        <div
          className={styles.atriaMapLayer}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {activeMapSrc ? (
            <img
              src={activeMapSrc || ATRIA_MAP_SRC}
              alt={activeMap?.title || 'Selected world map'}
              draggable={false}
              className={styles.atriaMapImage}
            />
          ) : (
            <div className={styles.atriaMapImageFallback}>
              NO MAP IMAGE SET
            </div>
          )}

          {points.map((point) => {
            const location = getLocationById(point.locationId);
            const label = location?.title || `Location ${point.locationId}`;
            const isSelected = idsMatch(point.locationId, selectedPointId);
            return (
              <button
                key={String(point.locationId)}
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
          {!activeMap
            ? 'No map entries available. Add a map from the Maps archive while Edit Lore is enabled.'
            : !activeMapSrc
              ? 'Assign an image source to this map in Edit Lore to render the interactive view.'
              : editMode
                ? 'Edit mode: select a pin, click map to place it, use arrow keys to nudge (Shift for fine movement).'
                : 'Use + / - or slider to zoom. Hold Ctrl/Cmd + wheel for mouse-wheel zoom. Drag to pan, click a pin to open its location card.'}
        </div>
      </div>

      <div className={styles.atriaMapFooter}>
        <div className={styles.atriaMapFooterPrimary}>
          {selectedLocation ? selectedLocation.title : (activeMap?.title || 'No map selected')}
        </div>
        <div className={styles.atriaMapFooterSecondary}>
          {selectedPoint
            ? `X ${selectedPoint.x.toFixed(2)}% � Y ${selectedPoint.y.toFixed(2)}%`
            : `${activeLocations.length} linked location${activeLocations.length === 1 ? '' : 's'}`}
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
  const resolvedSrc = resolveLoreImageSrc(item.src);
  const pos = item.pos || 'center';
  const fit = item.fit || 'cover';
  const mediaVars = resolvedSrc
    ? {
      '--wl-image-url': `url(${resolvedSrc})`,
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
        className={`${styles.imageCardMedia} ${!resolvedSrc ? styles.imageCardMediaEmpty : ''}`}
        style={mediaVars}
      >
        {!resolvedSrc && (
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
        {item.summary ? (
          <div className={styles.imageCardSummary}>{item.summary}</div>
        ) : null}
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
  mapOptions = [],
  editMode = false,
  onUpdateItem = () => { },
  canDeleteItem = () => false,
  onDeleteItem = () => { },
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, panX: 0, panY: 0 });

  // editing state when editMode is active
  const [editData, setEditData] = useState(item ? { ...item } : null);
  useEffect(() => {
    setEditData(item ? { ...item } : null);
  }, [item]);

  const handleFieldChange = (field, value) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (editData) {
      onUpdateItem(editData);
    }
  };
  const handleDelete = () => {
    if (!editData || !canDeleteItem(editData)) return;
    const title = (editData.title || 'this entry').trim();
    const confirmed = window.confirm(`Delete "${title}"? This cannot be undone.`);
    if (!confirmed) return;
    onDeleteItem(editData);
  };

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
  const resolvedSrc = resolveLoreImageSrc(item.src);


  const tab = item._tab || 'maps';
  const isLocation = tab === 'locations';
  const isFaction = tab === 'factions';
  const factionMembers = isFaction ? getFactionMembers(item) : [];
  const isZoom = !isLocation && !isFaction; // maps & scenes
  const mapList = Array.isArray(mapOptions) ? mapOptions : [];
  const linkedMapTitle = isLocation
    ? getMapTitleById(item.mapId, mapList)
    : '';
  const linkedPoint = isLocation ? normalizeMapPoint(item.mapPoint) : null;

  const renderEditFields = () => {
    if (!editMode || !editData) return null;
    const canDelete = canDeleteItem(editData);
    return (
      <div className={styles.lightboxEditPanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.editRow}>
          <label className={styles.editLabel}>Title</label>
          <input
            className={styles.editInput}
            value={editData.title || ''}
            onChange={(e) => handleFieldChange('title', e.target.value)}
          />
        </div>
        <div className={styles.editRow}>
          <label className={styles.editLabel}>Summary</label>
          <textarea
            className={styles.editTextarea}
            value={editData.summary || ''}
            onChange={(e) => handleFieldChange('summary', e.target.value)}
          />
        </div>
        <div className={styles.editRow}>
          <label className={styles.editLabel}>Description</label>
          <textarea
            className={styles.editTextarea}
            value={editData.description || ''}
            onChange={(e) => handleFieldChange('description', e.target.value)}
          />
        </div>
        {isLocation && (
          <>
            <div className={styles.editRow}>
              <label className={styles.editLabel}>Linked Map</label>
              <select
                className={styles.editInput}
                value={editData.mapId == null ? '' : String(editData.mapId)}
                onChange={(e) => {
                  const nextRaw = e.target.value;
                  const nextMapId = nextRaw ? resolveMapIdFromSelectValue(nextRaw, mapList) : null;
                  setEditData((prev) => ({ ...prev, mapId: nextMapId, mapPoint: null }));
                }}
              >
                <option value="">Unassigned</option>
                {mapList.map((map) => (
                  <option key={String(map.id)} value={String(map.id)}>
                    {map.title || `Map ${map.id}`}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.editRow}>
              <label className={styles.editLabel}>Region</label>
              <input
                className={styles.editInput}
                value={editData.region || ''}
                onChange={(e) => handleFieldChange('region', e.target.value)}
              />
            </div>
            <div className={styles.editRow}>
              <label className={styles.editLabel}>Governance</label>
              <input
                className={styles.editInput}
                value={editData.governance || ''}
                onChange={(e) => handleFieldChange('governance', e.target.value)}
              />
            </div>
            <div className={styles.editRow}>
              <label className={styles.editLabel}>Economy</label>
              <input
                className={styles.editInput}
                value={editData.economy || ''}
                onChange={(e) => handleFieldChange('economy', e.target.value)}
              />
            </div>
            <div className={styles.editRow}>
              <label className={styles.editLabel}>Tensions</label>
              <input
                className={styles.editInput}
                value={editData.tensions || ''}
                onChange={(e) => handleFieldChange('tensions', e.target.value)}
              />
            </div>
          </>
        )}
        {isFaction && (
          <>
            <div className={styles.editRow}>
              <label className={styles.editLabel}>Influence</label>
              <input
                className={styles.editInput}
                value={editData.influence || ''}
                onChange={(e) => handleFieldChange('influence', e.target.value)}
              />
            </div>
            <div className={styles.editRow}>
              <label className={styles.editLabel}>Doctrine</label>
              <input
                className={styles.editInput}
                value={editData.doctrine || ''}
                onChange={(e) => handleFieldChange('doctrine', e.target.value)}
              />
            </div>
          </>
        )}
        <div className={styles.editActionRow}>
          <button
            className={`koa-glass-btn koa-interactive-lift ${styles.editSaveBtn}`}
            onClick={handleSave}
          >
            Save
          </button>
          {canDelete && (
            <button
              className={`koa-glass-btn koa-interactive-lift ${styles.editDeleteBtn}`}
              onClick={handleDelete}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    );
  };

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const setZoomClamped = (val) => setZoom(clamp(val, 1, 5));

  const onWheel = (e) => {
    if (!resolvedSrc) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.12 : 0.12;
    setZoomClamped(+(zoom + delta).toFixed(2));
  };

  const startDrag = (e) => {
    if (!resolvedSrc) return;
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
      <div className={styles.lightboxOverlay}>
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
          {renderEditFields()}

          <div
            className={`koa-scrollbar-thin ${styles.lightboxInfoGrid}`}
          >
            <div className={styles.lightboxImageFrame}>
              {resolvedSrc ? (
                <img
                  src={resolvedSrc}
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
                  {isLocation && (
                    <div><strong className={styles.factLabel}>Linked Map:</strong> {linkedMapTitle}</div>
                  )}
                  {isLocation && linkedPoint && (
                    <div><strong className={styles.factLabel}>Map Pin:</strong> {`X ${linkedPoint.x.toFixed(2)}% � Y ${linkedPoint.y.toFixed(2)}%`}</div>
                  )}
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
            {item.summary && isZoom && (
              <div className={styles.lightboxInfoSummary}>{item.summary}</div>
            )}
            {item.description}
          </div>

          <CornerOrns />
        </div>
      </div>
    );
  }

    return (
      <div
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
              disabled={!resolvedSrc || zoom <= 1}
              className={styles.lightboxCtrlBtn}
              title="Zoom out"
            >−</button>

            <input
              type="range"
              min={1}
              max={5}
              step={0.05}
              value={zoom}
              disabled={!resolvedSrc}
              onChange={(e) => setZoomClamped(parseFloat(e.target.value))}
              className={styles.lightboxRange}
              title="Zoom"
            />

            <button
              onClick={zoomIn}
              disabled={!resolvedSrc || zoom >= 5}
              className={styles.lightboxCtrlBtn}
              title="Zoom in"
            >+</button>

            <button
              onClick={resetView}
              disabled={!resolvedSrc}
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
        {renderEditFields()}

        <div
          onWheel={onWheel}
          className={styles.lightboxImageStage}
        >
          {resolvedSrc ? (
            <img
              src={resolvedSrc}
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

          {resolvedSrc && (
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
  canEditLore = true,
  setCharView,
  setSelectedChar,
  setSelectedNpc,
  characters = [],
}) {
  const [activeTab, setActiveTab] = useState('maps');
  const [lightboxItem, setLightboxItem] = useState(null);

  // important: persistent gallery state with ability to override summary/etc
  const [gallery, setGallery] = useState(() => {
    const stored = repository.readJson(STORAGE_KEYS.worldLore, null);
    const merged = mergeGallery(DEFAULT_GALLERY, stored);
    // persist defaults on first visit so backup has something meaningful
    if (!stored) {
      try { repository.writeJson(STORAGE_KEYS.worldLore, merged); } catch { }
    }
    return merged;
  });
  const saveGallery = (next) => {
    setGallery(next);
    try {
      repository.writeJson(STORAGE_KEYS.worldLore, next);
    } catch (e) {
      // ignore write errors
      console.warn('failed to save world lore', e);
    }
  };
  const mapList = Array.isArray(gallery.maps) ? gallery.maps : [];
  const [activeMapId, setActiveMapId] = useState(() => getFallbackMapId(mapList));
  const activeMap = mapList.find((map) => idsMatch(map?.id, activeMapId)) || mapList[0] || null;

  useEffect(() => {
    const fallbackMapId = getFallbackMapId(mapList);
    if (fallbackMapId == null) {
      if (activeMapId !== null) setActiveMapId(null);
      return;
    }
    const hasActiveMap = activeMapId != null && mapList.some((map) => idsMatch(map?.id, activeMapId));
    if (!hasActiveMap) {
      setActiveMapId(fallbackMapId);
    }
  }, [activeMapId, mapList]);

  const handleUpdateLocationMapPoint = (locationId, mapId, point) => {
    const normalizedPoint = normalizeMapPoint(point);
    if (!normalizedPoint) return;

    const fallbackMapId = getFallbackMapId(mapList);
    let changed = false;
    const nextLocations = (Array.isArray(gallery.locations) ? gallery.locations : []).map((location) => {
      if (!idsMatch(location?.id, locationId)) return location;

      const currentMapId = resolveLocationMapId(location, mapList, fallbackMapId);
      const nextMapId = mapId != null ? mapId : currentMapId;
      const currentPoint = normalizeMapPoint(location?.mapPoint);
      if (idsMatch(currentMapId, nextMapId) && mapPointsEqual(currentPoint, normalizedPoint)) {
        return location;
      }

      changed = true;
      return normalizeLocationForStorage(
        { ...location, mapId: nextMapId, mapPoint: normalizedPoint },
        mapList,
        fallbackMapId
      );
    });

    if (!changed) return;
    saveGallery({ ...gallery, locations: nextLocations });
  };

  // when the user toggles edit mode for lore entries
  const [loreEditMode, setLoreEditMode] = useState(false);
  const loreEditEnabled = !!canEditLore;

  const isActive = panelType === 'worldLore';

  useEffect(() => {
    if (!isActive) setLightboxItem(null);
  }, [isActive]);

  useEffect(() => {
    if (loreEditEnabled || !loreEditMode) return;
    setLoreEditMode(false);
  }, [loreEditEnabled, loreEditMode]);

  const goBack = () => {
    cinematicNav('menu');
  };

  const getFactionMembers = (factionItem) => {
    const worldNpcs = readWorldNpcsRaw();
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

  const handleUpdateItem = (updated) => {
    if (!loreEditEnabled) return;
    if (!updated || updated.id == null) return;
    const tab = updated._tab || activeTab;
    const fallbackMapId = getFallbackMapId(mapList);
    const normalizedUpdated = tab === 'locations'
      ? normalizeLocationForStorage(updated, mapList, activeMap?.id ?? fallbackMapId)
      : { ...updated };
    const list = (gallery[tab] || []).map((it) => (idsMatch(it?.id, normalizedUpdated.id) ? normalizedUpdated : it));
    const next = { ...gallery, [tab]: list };
    if (tab === 'maps') {
      const nextMaps = Array.isArray(next.maps) ? next.maps : [];
      const nextFallbackMapId = getFallbackMapId(nextMaps);
      next.locations = (Array.isArray(next.locations) ? next.locations : [])
        .map((location) => normalizeLocationForStorage(location, nextMaps, nextFallbackMapId));
    }
    saveGallery(next);
    setLightboxItem({ ...normalizedUpdated, _tab: tab });
  };

  const openWorldNpcCodex = ({ search = '', faction = '' } = {}) => {
    setLightboxItem(null);
    setWorldNpcDeepLink({
      search: (search || '').trim(),
      faction: (faction || '').trim(),
      ts: Date.now(),
    });

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
      const base = getCanonicalBaseNpcsForCharacter(char);

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
  const tabSingularLabels = {
    maps: 'Map',
    scenes: 'Scene',
    locations: 'Location',
    factions: 'Faction',
  };

  const isUserAddedItem = (tab, item) => {
    if (!item || item.id == null) return false;
    if (item.userAdded === true) return true;
    const defaults = DEFAULT_IDS_BY_TAB[tab] || new Set();
    return !defaults.has(String(item.id));
  };

  const buildNewItem = (tab, id, { linkedMapId = null } = {}) => {
    const base = {
      id,
      title: `New ${tabSingularLabels[tab] || 'Entry'}`,
      src: '',
      summary: '',
      description: '',
      userAdded: true,
    };
    if (tab === 'maps') {
      return {
        ...base,
        aspect: ATRIA_MAP_ASPECT,
      };
    }
    if (tab === 'locations') {
      return {
        ...base,
        mapId: linkedMapId,
        mapPoint: getSeededAtriaPoint(id, linkedMapId) || null,
        region: 'Unknown',
        governance: 'Unknown',
        economy: 'Unknown',
        tensions: 'Unknown',
      };
    }
    if (tab === 'factions') {
      return {
        ...base,
        influence: 'Unknown',
        doctrine: 'Unknown',
        factionKeys: [],
        memberHints: [],
      };
    }
    return base;
  };

  const handleAddItem = () => {
    if (!loreEditEnabled) return;
    const tab = activeTab;
    const currentList = Array.isArray(gallery[tab]) ? gallery[tab] : [];
    const nextId = currentList.reduce((maxId, item) => {
      const numericId = Number(item?.id);
      return Number.isFinite(numericId) ? Math.max(maxId, numericId) : maxId;
    }, 0) + 1;

    const fallbackMapId = getFallbackMapId(mapList);
    const nextItem = tab === 'locations'
      ? normalizeLocationForStorage(
        buildNewItem(tab, nextId, { linkedMapId: activeMap?.id ?? fallbackMapId }),
        mapList,
        activeMap?.id ?? fallbackMapId
      )
      : buildNewItem(tab, nextId, { linkedMapId: activeMap?.id ?? fallbackMapId });
    const nextGallery = {
      ...gallery,
      [tab]: [...currentList, nextItem],
    };

    saveGallery(nextGallery);
    setLightboxItem({ ...nextItem, _tab: tab });
  };

  const handleDeleteItem = (candidate) => {
    if (!loreEditEnabled) return;
    if (!candidate || candidate.id == null) return;
    const tab = candidate._tab || activeTab;
    if (!isUserAddedItem(tab, candidate)) return;

    const currentList = Array.isArray(gallery[tab]) ? gallery[tab] : [];
    const nextList = currentList.filter((item) => !idsMatch(item?.id, candidate.id));
    if (nextList.length === currentList.length) return;

    let nextGallery = { ...gallery, [tab]: nextList };
    if (tab === 'maps') {
      const nextMaps = Array.isArray(nextGallery.maps) ? nextGallery.maps : [];
      const fallbackMapId = getFallbackMapId(nextMaps);
      nextGallery = {
        ...nextGallery,
        locations: (Array.isArray(gallery.locations) ? gallery.locations : []).map((location) => {
          const currentMapId = resolveLocationMapId(location, mapList, getFallbackMapId(mapList));
          if (idsMatch(currentMapId, candidate.id)) {
            return normalizeLocationForStorage(
              { ...location, mapId: fallbackMapId, mapPoint: null },
              nextMaps,
              fallbackMapId
            );
          }
          return normalizeLocationForStorage(location, nextMaps, fallbackMapId);
        }),
      };
      if (activeMapId != null && idsMatch(activeMapId, candidate.id)) {
        setActiveMapId(fallbackMapId);
      }
    }

    saveGallery(nextGallery);
    setLightboxItem((prev) => {
      if (!prev) return prev;
      const prevTab = prev._tab || tab;
      if (prevTab !== tab) return prev;
      return idsMatch(prev.id, candidate.id) ? null : prev;
    });
  };

  const openLocationFromMap = (locationId) => {
    const picked = (Array.isArray(gallery.locations) ? gallery.locations : [])
      .find((location) => idsMatch(location.id, locationId));
    if (!picked) return;
    setLightboxItem({ ...picked, _tab: 'locations' });
  };

  const handleOpenGalleryItem = (picked) => {
    if (activeTab === 'maps' && picked?.id != null) {
      setActiveMapId(picked.id);
      setLightboxItem(null);
      return;
    }
    setLightboxItem({ ...picked, _tab: activeTab });
  };

  return (
    <div className={`${styles.panel} ${isActive ? styles.panelActive : styles.panelInactive}`}>
      <div className={`koa-scrollbar-thin ${styles.worldLoreScrollWrap}`}>
        <div className={styles.worldLoreHeader}>
          <div className={styles.worldLoreHeaderLeft}>
            <button
              onClick={goBack}
              className={`koa-glass-btn koa-interactive-lift ${styles.worldLoreReturnBtn}`}
            >
              ← RETURN
            </button>
          </div>

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
              maps={mapList}
              activeMapId={activeMap?.id ?? null}
              onSelectMap={setActiveMapId}
              locations={gallery.locations}
              onOpenLocation={openLocationFromMap}
              onUpdateLocationPoint={handleUpdateLocationMapPoint}
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
              {(gallery[activeTab] || []).map((item) => (
                <ImageCard
                  key={item.id}
                  item={item}
                  onClick={handleOpenGalleryItem}
                />
              ))}
            </div>

            <div className={styles.tabCaption}>
              {tabDescriptions[activeTab]}
            </div>

            <div className={styles.worldLoreBottomActions}>
              {loreEditEnabled && loreEditMode && (
                <button
                  onClick={handleAddItem}
                  className={`koa-glass-btn koa-interactive-lift ${styles.worldLoreEditBtn}`}
                >
                  {`ADD ${tabSingularLabels[activeTab].toUpperCase()}`}
                </button>
              )}
              {loreEditEnabled && (
                <button
                  onClick={() => setLoreEditMode((prev) => !prev)}
                  className={`koa-glass-btn koa-interactive-lift ${styles.worldLoreEditBtn}`}
                >
                  {loreEditMode ? 'DONE EDITING' : 'EDIT LORE'}
                </button>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Lightbox */}
      <Lightbox
        item={lightboxItem}
        editMode={loreEditEnabled && loreEditMode}
        onUpdateItem={handleUpdateItem}
        canDeleteItem={(entry) => isUserAddedItem(entry?._tab || activeTab, entry)}
        onDeleteItem={handleDeleteItem}
        onClose={() => setLightboxItem(null)}
        onOpenWorldNpcs={openWorldNpcCodex}
        onOpenMember={openFactionMemberProfile}
        getFactionMembers={getFactionMembers}
        mapOptions={mapList}
      />
    </div>
  );
}


