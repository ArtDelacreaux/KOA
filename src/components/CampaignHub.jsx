import React, { useEffect, useState, useMemo, useRef } from 'react';
import ShellLayout from './ShellLayout';
import styles from './CampaignHub.module.css';
import owlbearLogo from '../assets/logo/owl.svg';
import watchPartyLogo from '../assets/logo/watch.webp';
import { useAuth } from '../auth/AuthContext';
import { createId } from '../domain/ids';
import { STORAGE_KEYS } from '../lib/storageKeys';
import {
  DEFAULT_ATTUNEMENT_LIMIT,
  INVENTORY_CATEGORIES,
  INVENTORY_RARITIES,
  defaultBagInventoryState,
  normalizeBagInventoryState,
  normalizeInventoryItem as normalizeSharedInventoryItem,
  normalizeInventoryItems as normalizeSharedInventoryItems,
  normalizePlayerInventories as normalizeSharedPlayerInventories,
  normalizeTradeRequests as normalizeSharedTradeRequests,
} from '../lib/inventorySync';
import useLocalStorageState from '../lib/useLocalStorageState';
import { getCampaignId, getSupabaseClient } from '../lib/supabaseClient';
import { repository } from '../repository';
import {
  applySnapshot,
  buildMigrationSnapshot,
  downloadSnapshotFile,
  formatSnapshotSummary,
  parseSnapshotFile,
  summarizeSnapshot,
} from '../migration/backupService';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function questBoardType(quest) {
  const explicit = normalizeText(quest?.board).toLowerCase();
  if (explicit === 'personal') return 'personal';
  if (explicit === 'party') return 'party';

  if (normalizeText(quest?.assignedUserId) || normalizeEmail(quest?.assignedEmail)) {
    return 'personal';
  }
  return 'party';
}

function questStatusType(quest) {
  return normalizeText(quest?.status).toLowerCase() === 'completed' ? 'completed' : 'active';
}

function questAssigneeLabel(quest) {
  return normalizeText(quest?.assignedLabel || quest?.assignedUsername || 'Unassigned');
}

function fallbackPlayerLabel(index, prefix = 'Player') {
  const parsed = Number(index);
  const position = Number.isFinite(parsed) ? parsed + 1 : 1;
  return `${prefix} ${position}`;
}

function formatPossessiveLabel(label, fallback = 'Player') {
  const base = normalizeText(label) || fallback;
  return /s$/i.test(base) ? `${base}'` : `${base}'s`;
}

function playerPresenceKey({ userId = '', email = '', label = '' }) {
  const normalizedUserId = normalizeText(userId);
  if (normalizedUserId) return normalizedUserId.toLowerCase();
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) return normalizedEmail;
  return normalizeText(label).toLowerCase();
}

function toNumberOr(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp01(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  if (num <= 0) return 0;
  if (num >= 1) return 1;
  return num;
}

function hexToRgb(hex) {
  const normalized = String(hex || '').replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return { r: 0, g: 0, b: 0 };
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex(rgb) {
  const toHex = (value) => Math.max(0, Math.min(255, Math.round(value || 0))).toString(16).padStart(2, '0');
  return `#${toHex(rgb?.r)}${toHex(rgb?.g)}${toHex(rgb?.b)}`;
}

function mixHex(a, b, t) {
  const from = hexToRgb(a);
  const to = hexToRgb(b);
  const ratio = clamp01(t);
  return rgbToHex({
    r: from.r + ((to.r - from.r) * ratio),
    g: from.g + ((to.g - from.g) * ratio),
    b: from.b + ((to.b - from.b) * ratio),
  });
}

function worldTimeSkyPalette(progress) {
  const p = clamp01(progress);
  const eveningStart = 5 / (HUB_TIME_OPTIONS.length - 1);
  const nightStart = 6 / (HUB_TIME_OPTIONS.length - 1);
  const nightRamp = clamp01((p - eveningStart) / Math.max(0.0001, 1 - eveningStart));
  const deepNightRamp = clamp01((p - nightStart) / Math.max(0.0001, 1 - nightStart));
  const daylight = Math.max(0, Math.sin(p * Math.PI));
  const left = p < 0.35
    ? mixHex('#f0cd97', '#9fbcd3', p / 0.35)
    : mixHex('#9fbcd3', '#19142d', (p - 0.35) / 0.65);
  const mid = p < 0.55
    ? mixHex('#edce93', '#7f8fb8', p / 0.55)
    : mixHex('#7f8fb8', '#171328', (p - 0.55) / 0.45);
  const right = p < 0.5
    ? mixHex('#dfae73', '#705986', p / 0.5)
    : mixHex('#705986', '#0f0a1d', (p - 0.5) / 0.5);
  return {
    left,
    mid,
    right,
    glow: 0.2 + (daylight * 0.52),
    stars: p >= eveningStart ? (0.16 + (nightRamp * 0.7)) : 0,
    starsDense: deepNightRamp * 0.72,
  };
}

const HUB_TIME_OPTIONS = [
  'Early Morning',
  'Morning',
  'Late Morning',
  'Afternoon',
  'Late Afternoon',
  'Evening',
  'Night',
  'Midnight',
];

function sanitizeLauncherState(rawState, defaultState, nowMs = Date.now()) {
  const source = rawState && typeof rawState === 'object' ? rawState : {};
  const timerRunning = !!source.timerRunning;
  const timerAccumulatedMs = Math.max(
    0,
    toNumberOr(source.timerAccumulatedMs, toNumberOr(source.elapsedMs, 0))
  );
  const legacyLastTick = toNumberOr(source.lastTick, NaN);
  const parsedStartedAt = toNumberOr(source.timerStartedAtMs, NaN);
  const timerStartedAtMs = timerRunning
    ? (Number.isFinite(parsedStartedAt)
      ? parsedStartedAt
      : Number.isFinite(legacyLastTick)
        ? legacyLastTick
        : nowMs)
    : null;
  const timeOfDay = normalizeText(source.timeOfDay || source.worldTime || defaultState.timeOfDay || 'Morning');
  const timeOfDayUpdatedAt = normalizeText(source.timeOfDayUpdatedAt || source.worldTimeUpdatedAt);
  const timeOfDayUpdatedBy = normalizeText(source.timeOfDayUpdatedBy || source.worldTimeUpdatedBy);

  const normalized = {
    ...defaultState,
    ...source,
    timerRunning,
    timerAccumulatedMs,
    timerStartedAtMs,
    timeOfDay: timeOfDay || 'Morning',
    timeOfDayUpdatedAt,
    timeOfDayUpdatedBy,
  };
  if (Object.prototype.hasOwnProperty.call(normalized, 'elapsedMs')) delete normalized.elapsedMs;
  if (Object.prototype.hasOwnProperty.call(normalized, 'lastTick')) delete normalized.lastTick;
  if (Object.prototype.hasOwnProperty.call(normalized, 'notes')) delete normalized.notes;
  return normalized;
}

export default function CampaignHub(props) {
  const {
    enabled: authEnabled,
    canManageCampaign,
    canWriteData,
    session,
    profile,
  } = useAuth();

  const {
    panelType,
    cinematicNav,
    campaignTab,
    setCampaignTab,

    quests,
    setQuests,
    questModalOpen,
    setQuestModalOpen,
    editingQuestId,
    setEditingQuestId,
    questDraft,
    setQuestDraft,
    canEditCampaignData: canEditCampaignDataProp,
    openCombatCharacterSheetPopout = null,

    playHover = () => {},
    playNav   = () => {},
  } = props;

  const canEditCampaignData =
    typeof canEditCampaignDataProp === 'boolean'
      ? canEditCampaignDataProp
      : (authEnabled ? canWriteData : true);
  const readOnlyStatusMessage = 'Guest mode is read-only. Sign in to make changes.';

  const smallBtnClass = (variant = 'gold', extraClass = '') => {
    const variantClass =
      variant === 'danger'
        ? styles.btnDanger
        : variant === 'ghost'
          ? styles.btnGhost
          : styles.btnGold;
    return `${styles.smallBtn} ${variantClass}${extraClass ? ` ${extraClass}` : ''}`;
  };

  const tabButtonClass = (active) =>
    smallBtnClass(active ? 'gold' : 'ghost', `${styles.tabButton}${active ? ` ${styles.tabButtonActive}` : ''}`);

  const smallBtnHover = () => {
    playHover();
  };

  const pillClass = (type) => {
    if (type === 'Main') return `${styles.pill} ${styles.pillMain}`;
    if (type === 'Personal') return `${styles.pill} ${styles.pillPersonal}`;
    return `${styles.pill} ${styles.pillSide}`;
  };

  /* =========================
     Quests helpers
  ========================= */
  const currentUserId = normalizeText(session?.user?.id);
  const currentUserEmail = normalizeEmail(session?.user?.email);
  const currentUsername = normalizeText(profile?.username).toLowerCase();
  const canManageQuests = authEnabled ? (canManageCampaign && canEditCampaignData) : canEditCampaignData;
  const managerOnlyQuestMessage = 'Only owner/DM accounts can create and manage quests.';
  const [assignablePlayers, setAssignablePlayers] = useState([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState('');
  const [questBoardView, setQuestBoardView] = useState('party');
  const [recapOpen, setRecapOpen] = useState(true);
  const [playerPresenceOpen, setPlayerPresenceOpen] = useState(false);
  const [playerDirectory, setPlayerDirectory] = useState([]);
  const [playerDirectoryLoading, setPlayerDirectoryLoading] = useState(false);
  const [presenceByPlayerKey, setPresenceByPlayerKey] = useState({});
  const [presenceConnected, setPresenceConnected] = useState(false);

  useEffect(() => {
    if (!authEnabled || !canManageCampaign) {
      setAssignablePlayers([]);
      setPlayersLoading(false);
      setPlayersError('');
      return;
    }

    const supabase = getSupabaseClient();
    const campaignId = getCampaignId();
    if (!supabase || !campaignId) {
      setAssignablePlayers([]);
      setPlayersLoading(false);
      setPlayersError('Unable to load campaign players.');
      return;
    }

    let cancelled = false;
    const loadPlayers = async () => {
      setPlayersLoading(true);
      setPlayersError('');
      try {
        const { data, error } = await supabase.rpc('list_campaign_member_directory', {
          p_campaign_id: campaignId,
        });
        if (error) throw error;

        const seen = new Set();
        const nextPlayers = (Array.isArray(data) ? data : [])
          .filter((row) => normalizeText(row?.role || 'member').toLowerCase() === 'member')
          .map((row, idx) => {
            const userId = normalizeText(row?.user_id);
            if (!userId) return null;
            const key = userId;
            if (seen.has(key)) return null;
            seen.add(key);

            const username = normalizeText(row?.username);
            const label = username || fallbackPlayerLabel(idx);
            return { userId, email: '', username, label };
          })
          .filter(Boolean)
          .sort((a, b) => a.label.localeCompare(b.label));

        if (!cancelled) {
          setAssignablePlayers(nextPlayers);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load player assignments.';
          setPlayersError(msg);
          setAssignablePlayers([]);
        }
      } finally {
        if (!cancelled) setPlayersLoading(false);
      }
    };

    loadPlayers();
    return () => {
      cancelled = true;
    };
  }, [authEnabled, canManageCampaign]);

  useEffect(() => {
    if (!authEnabled || !currentUserId) {
      setPlayerDirectory([]);
      setPlayerDirectoryLoading(false);
      return;
    }

    const supabase = getSupabaseClient();
    const campaignId = getCampaignId();
    if (!supabase || !campaignId) {
      setPlayerDirectory([]);
      setPlayerDirectoryLoading(false);
      return;
    }

    let cancelled = false;
    const loadPlayerDirectory = async () => {
      setPlayerDirectoryLoading(true);
      try {
        const { data, error } = await supabase.rpc('list_campaign_member_directory', {
          p_campaign_id: campaignId,
        });
        if (error) throw error;
        if (cancelled) return;

        const seen = new Set();
        const rows = Array.isArray(data) ? data : [];
        const nextDirectory = rows
          .map((row, idx) => {
            const userId = normalizeText(row?.user_id);
            if (!userId || seen.has(userId)) return null;
            seen.add(userId);
            const username = normalizeText(row?.username);
            const label = username || `Member ${idx + 1}`;
            return {
              userId,
              email: '',
              username,
              label,
              role: normalizeText(row?.role || 'member').toLowerCase(),
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.label.localeCompare(b.label));

        if (!nextDirectory.some((member) => normalizeText(member.userId) === currentUserId)) {
          const selfLabel = normalizeText(profile?.username || 'You');
          nextDirectory.push({
            userId: currentUserId,
            email: currentUserEmail,
            username: normalizeText(profile?.username),
            label: selfLabel,
            role: 'member',
          });
        }

        if (!cancelled) setPlayerDirectory(nextDirectory);
      } catch {
        if (cancelled) return;
        const fallbackLabel = normalizeText(profile?.username || 'You');
        setPlayerDirectory(currentUserId ? [{
          userId: currentUserId,
          email: currentUserEmail,
          username: normalizeText(profile?.username),
          label: fallbackLabel,
          role: 'member',
        }] : []);
      } finally {
        if (!cancelled) setPlayerDirectoryLoading(false);
      }
    };

    loadPlayerDirectory();
    return () => {
      cancelled = true;
    };
  }, [authEnabled, currentUserEmail, currentUserId, profile?.username]);

  const canViewPersonalQuest = useMemo(
    () => (q) => {
      if (!authEnabled || canManageCampaign) return true;
      const assignedUserId = normalizeText(q?.assignedUserId);
      const assignedEmail = normalizeEmail(q?.assignedEmail);
      const assignedUsername = normalizeText(q?.assignedUsername).toLowerCase();

      if (assignedUserId && currentUserId && assignedUserId === currentUserId) return true;
      if (assignedEmail && currentUserEmail && assignedEmail === currentUserEmail) return true;
      if (assignedUsername && currentUsername && assignedUsername === currentUsername) return true;
      return false;
    },
    [authEnabled, canManageCampaign, currentUserEmail, currentUserId, currentUsername]
  );

  const partyQuests = useMemo(
    () => (quests || []).filter((q) => questBoardType(q) === 'party'),
    [quests]
  );
  const visiblePersonalQuests = useMemo(
    () => (quests || []).filter((q) => questBoardType(q) === 'personal' && canViewPersonalQuest(q)),
    [canViewPersonalQuest, quests]
  );

  const activePartyQuests = useMemo(
    () => partyQuests.filter((q) => questStatusType(q) === 'active'),
    [partyQuests]
  );
  const completedPartyQuests = useMemo(
    () => partyQuests.filter((q) => questStatusType(q) === 'completed'),
    [partyQuests]
  );
  const activePersonalQuests = useMemo(
    () => visiblePersonalQuests.filter((q) => questStatusType(q) === 'active'),
    [visiblePersonalQuests]
  );
  const completedPersonalQuests = useMemo(
    () => visiblePersonalQuests.filter((q) => questStatusType(q) === 'completed'),
    [visiblePersonalQuests]
  );
  const showingPersonalQuestBoard = questBoardView === 'personal';
  const displayedActiveQuests = showingPersonalQuestBoard ? activePersonalQuests : activePartyQuests;
  const displayedCompletedQuests = showingPersonalQuestBoard ? completedPersonalQuests : completedPartyQuests;
  const displayedBoardTitle = showingPersonalQuestBoard ? 'Personal Quest Board' : 'Party Quest Board';
  const displayedBoardSub = showingPersonalQuestBoard
    ? (
      canManageCampaign
        ? 'Assign quests to specific players. Only they can view them.'
        : 'Only quests assigned to your account show here.'
    )
    : 'Shared with the whole party.';
  const displayedEmptyActiveTitle = showingPersonalQuestBoard ? 'No active personal quests.' : 'No active party quests.';
  const displayedEmptyActiveBody = showingPersonalQuestBoard
    ? (
      canManageCampaign
        ? <>Hit <strong>+ Add Quest</strong> and assign it to a player.</>
        : (authEnabled && !currentUserId && !currentUserEmail)
          ? 'Sign in to view personal quests.'
          : 'Your assigned personal quests will appear here.'
    )
    : (
      canManageQuests
        ? <>Hit <strong>+ Add Quest</strong> to start tracking hooks.</>
        : 'Party quests created by your owner/DM will appear here.'
    );
  const displayedEmptyCompletedTitle = showingPersonalQuestBoard ? 'No completed personal quests.' : 'Nothing completed yet.';
  const displayedEmptyCompletedBody = showingPersonalQuestBoard
    ? 'Completed personal quests appear here.'
    : 'Completed party quests appear here.';

  const newId = () => createId('quest');

  const ensureQuestManagePermission = () => {
    if (canManageQuests) return true;
    alert(canEditCampaignData ? managerOnlyQuestMessage : readOnlyStatusMessage);
    return false;
  };

  const openAddQuest = () => {
    if (!ensureQuestManagePermission()) return;
    setEditingQuestId(null);
    setQuestDraft({
      title: '',
      type: 'Side',
      board: showingPersonalQuestBoard ? 'personal' : 'party',
      assignedUserId: '',
      assignedEmail: '',
      assignedUsername: '',
      assignedLabel: '',
      giver: '',
      location: '',
      description: '',
    });
    setQuestModalOpen(true);
  };

  const openEditQuest = (q) => {
    if (!ensureQuestManagePermission()) return;
    setEditingQuestId(q.id);
    setQuestDraft({
      title: q.title || '',
      type: q.type || 'Side',
      board: questBoardType(q),
      assignedUserId: normalizeText(q.assignedUserId),
      assignedEmail: normalizeEmail(q.assignedEmail),
      assignedUsername: normalizeText(q.assignedUsername),
      assignedLabel: questAssigneeLabel(q),
      giver: q.giver || '',
      location: q.location || '',
      description: q.description || '',
    });
    setQuestModalOpen(true);
  };

  const saveQuest = () => {
    if (!ensureQuestManagePermission()) return;

    const title = (questDraft.title || '').trim();
    if (!title) { alert('Quest needs a title.'); return; }

    const board = questBoardType(questDraft);
    let assignedUserId = '';
    let assignedUsername = '';
    let assignedLabel = '';
    if (board === 'personal') {
      assignedUserId = normalizeText(questDraft.assignedUserId);
      assignedUsername = normalizeText(questDraft.assignedUsername);
      const selected = assignablePlayers.find((player) => {
        const playerValue = player.userId;
        return playerValue && playerValue === assignedUserId;
      });
      if (selected) {
        assignedUserId = selected.userId;
        assignedUsername = normalizeText(selected.username || selected.label);
        assignedLabel = normalizeText(selected.username || selected.label);
      } else {
        assignedUsername = normalizeText(questDraft.assignedUsername);
        assignedLabel = normalizeText(questDraft.assignedLabel);
      }

      if (!assignedUserId) {
        alert('Personal quests must be assigned to a player.');
        return;
      }
    }

    const now = new Date().toISOString();
    const questPayload = {
      title,
      type: questDraft.type || 'Side',
      board,
      assignedUserId: board === 'personal' ? assignedUserId : '',
      assignedEmail: '',
      assignedUsername: board === 'personal' ? assignedUsername : '',
      assignedLabel: board === 'personal' ? assignedLabel : '',
      giver: (questDraft.giver || '').trim(),
      location: (questDraft.location || '').trim(),
      description: (questDraft.description || '').trim(),
      updatedAt: now,
    };

    if (!editingQuestId) {
      const q = {
        id: newId(),
        ...questPayload,
        status: 'active',
        createdAt: now,
      };
      setQuests((prev) => [q, ...(prev || [])]);
    } else {
      setQuests((prev) => (
        prev || []
      ).map((q) => (
        q.id === editingQuestId
          ? { ...q, ...questPayload }
          : q
      )));
    }

    setQuestModalOpen(false);
    setEditingQuestId(null);
  };

  const deleteQuest = (id) => {
    if (!ensureQuestManagePermission()) return;
    if (!confirm('Delete this quest?')) return;
    setQuests((prev) => (prev || []).filter((q) => q.id !== id));
  };

  const completeQuest = (id) => {
    if (!ensureQuestManagePermission()) return;
    setQuests((prev) => (
      prev || []
    ).map((q) => (
      q.id === id ? { ...q, status: 'completed', updatedAt: new Date().toISOString() } : q
    )));
  };

  const reopenQuest = (id) => {
    if (!ensureQuestManagePermission()) return;
    setQuests((prev) => (
      prev || []
    ).map((q) => (
      q.id === id ? { ...q, status: 'active', updatedAt: new Date().toISOString() } : q
    )));
  };

  useEffect(() => {
    if (!questModalOpen) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') setQuestModalOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [questModalOpen, setQuestModalOpen]);

  /* =========================
     Player Hub Launcher
  ========================= */
  const defaultLauncherState = {
    watchUrl: 'https://w2g.tv/en/room/?room_id=h2rq2xmdrlzdlyolcu',
    owlbearUrl: 'https://owlbear.rodeo/room/TQbSmbFAE6l4/TheFatedSoul',
    recap: '',
    timeOfDay: 'Morning',
    timeOfDayUpdatedAt: '',
    timeOfDayUpdatedBy: '',
    timerRunning: false,
    timerAccumulatedMs: 0,
    timerStartedAtMs: null,
  };

  const [launcherState, setLauncherState] = useLocalStorageState(STORAGE_KEYS.launcher, defaultLauncherState);
  const [launcherNotes, setLauncherNotes] = useLocalStorageState(STORAGE_KEYS.launcherNotes, '');
  const [launcherNowMs, setLauncherNowMs] = useState(() => Date.now());

  useEffect(() => {
    setLauncherState((prev) => {
      const source = prev && typeof prev === 'object' ? prev : {};
      const legacyNotes = typeof source.notes === 'string' ? source.notes : '';
      if (legacyNotes && !String(launcherNotes || '').trim()) {
        setLauncherNotes(legacyNotes);
      }
      return sanitizeLauncherState(source, defaultLauncherState);
    });
    // Normalize once on mount in case older saved shapes exist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!launcherState.timerRunning) return;
    const id = window.setInterval(() => {
      setLauncherNowMs(Date.now());
    }, 250);
    return () => window.clearInterval(id);
  }, [launcherState.timerRunning]);

  const displayedElapsedMs = useMemo(() => {
    const base = Math.max(0, toNumberOr(launcherState.timerAccumulatedMs, 0));
    if (!launcherState.timerRunning) return base;
    const startedAt = toNumberOr(launcherState.timerStartedAtMs, NaN);
    if (!Number.isFinite(startedAt)) return base;
    return base + Math.max(0, launcherNowMs - startedAt);
  }, [launcherNowMs, launcherState.timerAccumulatedMs, launcherState.timerRunning, launcherState.timerStartedAtMs]);

  const toggleSessionTimer = () => {
    setLauncherNowMs(Date.now());
    setLauncherState((current) => {
      const nowMs = Date.now();
      const normalized = sanitizeLauncherState(current, defaultLauncherState, nowMs);
      if (normalized.timerRunning) {
        const startedAt = toNumberOr(normalized.timerStartedAtMs, nowMs);
        const elapsedDelta = Math.max(0, nowMs - startedAt);
        return {
          ...normalized,
          timerRunning: false,
          timerAccumulatedMs: Math.max(0, toNumberOr(normalized.timerAccumulatedMs, 0) + elapsedDelta),
          timerStartedAtMs: null,
        };
      }
      return {
        ...normalized,
        timerRunning: true,
        timerStartedAtMs: nowMs,
      };
    });
  };

  const resetSessionTimer = () => {
    setLauncherNowMs(Date.now());
    setLauncherState((current) => {
      const normalized = sanitizeLauncherState(current, defaultLauncherState);
      return {
        ...normalized,
        timerRunning: false,
        timerAccumulatedMs: 0,
        timerStartedAtMs: null,
      };
    });
  };

  const fmtElapsed = (ms) => { const total = Math.floor((ms || 0) / 1000); const h = String(Math.floor(total / 3600)).padStart(2, '0'); const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0'); const s = String(total % 60).padStart(2, '0'); return `${h}:${m}:${s}`; };
  const openTool = (kind) => { const url = kind === 'watch' ? launcherState.watchUrl : launcherState.owlbearUrl; if (!url) return; window.open(url, '_blank', 'noopener,noreferrer'); };

  const backupFileRef = useRef(null);
  const [backupStatus, setBackupStatus] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [seedBusy, setSeedBusy] = useState(false);

  const cloudStatus = repository.getCloudStatus();
  const usingSupabase = authEnabled && repository.adapterName === 'supabase';
  const canSeedCloud = usingSupabase && canManageCampaign && canEditCampaignData;
  const showCloudPrepBackup = authEnabled && canManageCampaign;
  const canManageHubTime = canEditCampaignData;
  const cloudPendingWrites = Number(cloudStatus?.queueSize || 0);
  const cloudError = String(cloudStatus?.lastSyncError || '');

  const hubTimeValue = normalizeText(launcherState.timeOfDay) || 'Morning';
  const hubTimeIndex = useMemo(() => {
    const index = HUB_TIME_OPTIONS.indexOf(hubTimeValue);
    return index >= 0 ? index : 1;
  }, [hubTimeValue]);
  const hubTimeMaxIndex = Math.max(1, HUB_TIME_OPTIONS.length - 1);
  const hubTimeProgress = hubTimeIndex / hubTimeMaxIndex;
  const hubTimeSky = useMemo(() => worldTimeSkyPalette(hubTimeProgress), [hubTimeProgress]);
  const hubTimeNeedleAngle = -90 + (hubTimeProgress * 180);

  const setHubTimeOfDay = (nextTime) => {
    if (!canManageHubTime) return;
    const normalizedTime = normalizeText(nextTime) || 'Morning';
    const updatedBy = normalizeText(profile?.username || 'DM');
    const updatedAt = new Date().toISOString();
    setLauncherState((current) => {
      const base = sanitizeLauncherState(current, defaultLauncherState);
      return {
        ...base,
        timeOfDay: normalizedTime,
        timeOfDayUpdatedAt: updatedAt,
        timeOfDayUpdatedBy: updatedBy,
      };
    });
  };

  useEffect(() => {
    if (!authEnabled || !currentUserId) {
      setPresenceByPlayerKey({});
      setPresenceConnected(false);
      return () => {};
    }

    const supabase = getSupabaseClient();
    const campaignId = getCampaignId();
    if (!supabase || !campaignId) {
      setPresenceByPlayerKey({});
      setPresenceConnected(false);
      return () => {};
    }

    let active = true;
    let subscribed = false;
    const selfPresenceKey = playerPresenceKey({
      userId: currentUserId,
      email: currentUserEmail,
      label: normalizeText(profile?.username || 'You'),
    });

    const channel = supabase.channel(`koa-hub-presence:${campaignId}`, {
      config: {
        presence: {
          key: selfPresenceKey || 'anonymous',
        },
      },
    });

    const buildSelfPresencePayload = () => ({
      userId: currentUserId,
      email: currentUserEmail,
      username: normalizeText(profile?.username),
      label: normalizeText(profile?.username || 'You'),
      status: document.hidden ? 'away' : 'online',
      updatedAt: new Date().toISOString(),
    });

    const syncPresenceState = () => {
      if (!active) return;
      const rawState = channel.presenceState();
      const nextPresence = {};

      Object.values(rawState || {}).forEach((entries) => {
        (Array.isArray(entries) ? entries : []).forEach((entry) => {
          const userId = normalizeText(entry?.userId || entry?.user_id);
          const email = normalizeEmail(entry?.email);
          const label = normalizeText(entry?.label || entry?.username || 'Player');
          const key = playerPresenceKey({ userId, email, label });
          if (!key) return;

          const status = normalizeText(entry?.status).toLowerCase() === 'away' ? 'away' : 'online';
          const previous = nextPresence[key];
          if (!previous || previous.status !== 'online' || status === 'online') {
            nextPresence[key] = {
              key,
              userId,
              email,
              label,
              status,
              updatedAt: normalizeText(entry?.updatedAt || entry?.updated_at),
            };
          }
        });
      });

      setPresenceByPlayerKey(nextPresence);
    };

    channel
      .on('presence', { event: 'sync' }, syncPresenceState)
      .on('presence', { event: 'join' }, syncPresenceState)
      .on('presence', { event: 'leave' }, syncPresenceState)
      .subscribe(async (status) => {
        if (!active) return;
        if (status === 'SUBSCRIBED') {
          subscribed = true;
          setPresenceConnected(true);
          try {
            await channel.track(buildSelfPresencePayload());
          } catch {}
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          subscribed = false;
          setPresenceConnected(false);
        }
      });

    const onVisibilityChange = () => {
      if (!active || !subscribed) return;
      channel.track(buildSelfPresencePayload()).catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      try {
        if (subscribed) channel.untrack();
      } catch {}
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [authEnabled, currentUserEmail, currentUserId, profile?.username]);

  const playerPresenceMembers = useMemo(() => {
    const unique = new Map();
    const pushMember = (member) => {
      const label = normalizeText(member?.label || member?.username || 'Player');
      const entry = {
        userId: normalizeText(member?.userId || member?.user_id),
        email: normalizeEmail(member?.email),
        username: normalizeText(member?.username),
        label,
      };
      const key = playerPresenceKey(entry);
      if (!key || unique.has(key)) return;
      unique.set(key, { ...entry, key });
    };

    (playerDirectory || []).forEach(pushMember);
    (assignablePlayers || []).forEach(pushMember);
    if (currentUserId || currentUserEmail) {
      pushMember({
        userId: currentUserId,
        email: currentUserEmail,
        username: normalizeText(profile?.username),
        label: normalizeText(profile?.username || 'You'),
      });
    }

    return Array.from(unique.values())
      .map((member) => {
        const presence = presenceByPlayerKey[member.key];
        let status = 'offline';
        if (presence?.status === 'away') status = 'away';
        else if (presence?.status === 'online') status = 'online';
        else if (member.userId && currentUserId && member.userId === currentUserId) status = 'online';

        return {
          ...member,
          status,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [
    assignablePlayers,
    currentUserEmail,
    currentUserId,
    playerDirectory,
    presenceByPlayerKey,
    profile?.username,
  ]);
  const onlinePlayerCount = playerPresenceMembers.filter((member) => member.status === 'online').length;
  const awayPlayerCount = playerPresenceMembers.filter((member) => member.status === 'away').length;

  useEffect(() => {
    if (!playerPresenceOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setPlayerPresenceOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [playerPresenceOpen]);

  useEffect(() => {
    if (campaignTab !== 'launcher' && playerPresenceOpen) {
      setPlayerPresenceOpen(false);
    }
  }, [campaignTab, playerPresenceOpen]);

  const exportBackup = () => {
    const snapshot = buildMigrationSnapshot();
    const summary = summarizeSnapshot(snapshot);
    const filename = downloadSnapshotFile(snapshot);
    setBackupStatus(`Saved ${filename} (${formatSnapshotSummary(summary)}).`);
  };

  const openRestorePicker = () => {
    if (!canEditCampaignData) {
      setBackupStatus(readOnlyStatusMessage);
      return;
    }
    if (backupBusy) return;
    if (backupFileRef.current) backupFileRef.current.click();
  };

  const onBackupPicked = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;
    if (!canEditCampaignData) {
      setBackupStatus(readOnlyStatusMessage);
      if (backupFileRef.current) backupFileRef.current.value = '';
      return;
    }

    setBackupBusy(true);
    try {
      const snapshot = await parseSnapshotFile(file);
      const exportedAt = snapshot?.exportedAt ? new Date(snapshot.exportedAt).toLocaleString() : 'an unknown time';
      const shouldRestore = confirm(
        `Restore backup from ${exportedAt}? This will replace local data on this device. A safety backup will download first.`
      );
      if (!shouldRestore) return;

      const safetySnapshot = buildMigrationSnapshot();
      downloadSnapshotFile(safetySnapshot, { filename: `tavern-menu-pre-restore-${Date.now()}.json` });

      const restoredSummary = applySnapshot(snapshot);
      setBackupStatus(`Backup restored (${formatSnapshotSummary(restoredSummary)}). Reloading...`);

      setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to restore backup.';
      setBackupStatus(msg);
      alert(msg);
    } finally {
      setBackupBusy(false);
      if (backupFileRef.current) backupFileRef.current.value = '';
    }
  };

  const seedCloudFromThisDevice = async () => {
    if (!canEditCampaignData) {
      setBackupStatus(readOnlyStatusMessage);
      return;
    }
    if (!canSeedCloud || seedBusy) return;
    const ok = confirm('Seed shared cloud state from this device now? This should be done once by the campaign owner/DM.');
    if (!ok) return;

    setSeedBusy(true);
    setBackupStatus('');
    try {
      const snapshot = buildMigrationSnapshot();
      const summary = summarizeSnapshot(snapshot);
      await repository.seedCampaignFromSnapshot(snapshot);
      setBackupStatus(`Cloud seed complete (${formatSnapshotSummary(summary)}).`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cloud seed failed.';
      setBackupStatus(msg);
      alert(msg);
    } finally {
      setSeedBusy(false);
    }
  };

  /* =========================
     INVENTORY (Bag of Holding)
  ========================= */
  const clampInt = (n, min, max) => Math.max(min, Math.min(max, n));
  const bagNewId = () => createId('bag');
  const tradeNewId = () => createId('trade');
  const localInventoryUserId = '__local_player__';
  const CATEGORIES = ['All', ...INVENTORY_CATEGORIES];
  const ITEM_CATEGORIES = INVENTORY_CATEGORIES;
  const RARITIES = ['All', ...INVENTORY_RARITIES];
  const ITEM_RARITIES = INVENTORY_RARITIES;

  const normalizeItemCategory = (value) => {
    const normalized = normalizeText(value);
    return ITEM_CATEGORIES.includes(normalized) ? normalized : 'Gear';
  };

  const normalizeItemRarity = (value) => {
    const normalized = normalizeText(value);
    if (normalized.toLowerCase() === 'epic') return 'Very Rare';
    return ITEM_RARITIES.includes(normalized) ? normalized : 'Common';
  };

  const normalizeItemTags = (value) => {
    if (Array.isArray(value)) {
      return value.map((tag) => normalizeText(tag)).filter(Boolean);
    }
    return normalizeText(value)
      .split(',')
      .map((tag) => normalizeText(tag))
      .filter(Boolean);
  };

  const normalizeOptionalNumber = (value) => {
    if (value === '' || value == null) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const normalizeAttunementLimit = (value) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return DEFAULT_ATTUNEMENT_LIMIT;
    return clampInt(parsed, 1, 99);
  };

  const normalizeIso = (value) => {
    const raw = normalizeText(value);
    if (!raw) return '';
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : '';
  };

  const toSortTimestamp = (value) => {
    const raw = normalizeText(value);
    if (!raw) return 0;
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : 0;
  };

  const normalizeInventoryItem = (raw, now = new Date().toISOString()) => (
    normalizeSharedInventoryItem(raw, { now, idFactory: bagNewId })
  );

  const normalizeInventoryItems = (rawItems, now = new Date().toISOString()) => (
    normalizeSharedInventoryItems(rawItems, { now, idFactory: bagNewId })
  );

  const normalizePlayerInventories = (rawValue, now = new Date().toISOString()) => (
    normalizeSharedPlayerInventories(rawValue, { now, idFactory: bagNewId })
  );

  const normalizeTradeRequests = (rawValue, now = new Date().toISOString()) => (
    normalizeSharedTradeRequests(rawValue, { now })
  );

  const rarityBadge = (rarity) => {
    const r = (rarity || 'Common').toLowerCase();
    const map = {
      common: 'rgba(255,255,255,0.16)',
      uncommon: 'rgba(110,231,183,0.18)',
      rare: 'rgba(96,165,250,0.18)',
      'very rare': 'rgba(186,136,245,0.2)',
      legendary: 'rgba(251,191,36,0.20)',
    };
    return map[r] || map.common;
  };


  const defaultBagState = defaultBagInventoryState();

  const [bag, setBag] = useLocalStorageState(STORAGE_KEYS.bag, defaultBagState);

  useEffect(() => {
    setBag((prev) => normalizeBagInventoryState(prev, { idFactory: bagNewId }));
    // Normalize once on mount in case older saved shapes exist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [invQuery, setInvQuery] = useState('');
  const [invCat, setInvCat] = useState('All');
  const [invRar, setInvRar] = useState('All');
  const [invSort, setInvSort] = useState('name');
  const [invSelectedItemId, setInvSelectedItemId] = useState('');
  const [currencyDelta, setCurrencyDelta] = useState({ pp: '', gp: '', sp: '', cp: '' });

  const [invModalOpen, setInvModalOpen] = useState(false);
  const [invModalTarget, setInvModalTarget] = useState('party');
  const [invEditingId, setInvEditingId] = useState(null);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [bagTransferTargetUserId, setBagTransferTargetUserId] = useState('');
  const [tradeRequestModalOpen, setTradeRequestModalOpen] = useState(false);
  const [tradeRequestTargetItemId, setTradeRequestTargetItemId] = useState('');
  const [tradeCenterOpen, setTradeCenterOpen] = useState(false);
  const [tradeDraft, setTradeDraft] = useState({
    requestedQty: 1,
    offerItemId: '',
    offerQty: 1,
    note: '',
  });
  const [playerTradeCenterOpen, setPlayerTradeCenterOpen] = useState(false);
  const [playerTradeFocusId, setPlayerTradeFocusId] = useState('');
  const [playerTradeTargetUserId, setPlayerTradeTargetUserId] = useState('');
  const [playerTradeMessage, setPlayerTradeMessage] = useState('');
  const [playerTradeOwnItemId, setPlayerTradeOwnItemId] = useState('');
  const [playerTradeOwnQty, setPlayerTradeOwnQty] = useState('1');
  const [inventoryViewerUserId, setInventoryViewerUserId] = useState('');
  const [personalInventoryDetailItemId, setPersonalInventoryDetailItemId] = useState('');
  const personalInventoryHideSortLockRef = useRef({});

  const rememberPersonalInventoryHideSortLock = (userId, itemId, updatedAt) => {
    const normalizedUserId = normalizeText(userId);
    const normalizedItemId = normalizeText(itemId);
    if (!normalizedUserId || !normalizedItemId) return;
    const currentLocks = personalInventoryHideSortLockRef.current;
    const userLocks = currentLocks[normalizedUserId] || {};
    if (Object.prototype.hasOwnProperty.call(userLocks, normalizedItemId)) return;
    personalInventoryHideSortLockRef.current = {
      ...currentLocks,
      [normalizedUserId]: {
        ...userLocks,
        [normalizedItemId]: toSortTimestamp(updatedAt),
      },
    };
  };

  const personalInventorySortTimestamp = (userId, item) => {
    const normalizedUserId = normalizeText(userId);
    const normalizedItemId = normalizeText(item?.id);
    if (normalizedUserId && normalizedItemId) {
      const userLocks = personalInventoryHideSortLockRef.current[normalizedUserId];
      if (userLocks && Object.prototype.hasOwnProperty.call(userLocks, normalizedItemId)) {
        return userLocks[normalizedItemId];
      }
    }
    return toSortTimestamp(item?.updatedAt);
  };

  const bagOwnerUserId = normalizeText(bag?.ownerUserId);
  const bagOwnerEmail = normalizeEmail(bag?.ownerEmail);
  const bagOwnerUsername = normalizeText(bag?.ownerUsername);
  const bagOwnerUsernameKey = bagOwnerUsername.toLowerCase();
  const canManageInventory = authEnabled ? (canManageCampaign && canEditCampaignData) : canEditCampaignData;
  const isBagOwner = !authEnabled || (
    (bagOwnerUserId && currentUserId && bagOwnerUserId === currentUserId)
    || (bagOwnerEmail && currentUserEmail && bagOwnerEmail === currentUserEmail)
    || (bagOwnerUsernameKey && currentUsername && bagOwnerUsernameKey === currentUsername)
  );
  const canEditInventory = canManageInventory || (canEditCampaignData && isBagOwner);
  const canTransferBagOwnership = canEditCampaignData && (canManageInventory || isBagOwner);
  const inventoryReadOnlyMessage = !canEditCampaignData
    ? readOnlyStatusMessage
    : 'Only the DM or current Bag of Holding owner can edit inventory.';
  const activeInventoryUserId = authEnabled ? currentUserId : localInventoryUserId;
  const canUsePersonalInventory = !authEnabled || !!activeInventoryUserId;
  const canEditPersonalInventory = canEditCampaignData && canUsePersonalInventory;
  const personalInventoryReadOnlyMessage = !canEditCampaignData
    ? readOnlyStatusMessage
    : 'Sign in with a campaign account to manage your personal inventory.';
  const canSubmitTradeRequests = !canEditInventory && canEditPersonalInventory;

  const inventoryOwnerChoices = useMemo(() => (
    (playerDirectory || [])
      .filter((member) => normalizeText(member?.role || 'member').toLowerCase() === 'member')
      .map((member, idx) => ({
        userId: normalizeText(member?.userId || member?.user_id),
        username: normalizeText(member?.username),
        label: normalizeText(member?.label || member?.username || fallbackPlayerLabel(idx)),
      }))
      .filter((member) => !!member.userId)
  ), [playerDirectory]);

  useEffect(() => {
    if (!bagTransferTargetUserId) return;
    if (inventoryOwnerChoices.some((player) => player.userId === bagTransferTargetUserId)) return;
    setBagTransferTargetUserId('');
  }, [bagTransferTargetUserId, inventoryOwnerChoices]);

  const bagOwnerLabel = useMemo(() => {
    const byUserId = inventoryOwnerChoices.find((player) => player.userId === bagOwnerUserId);
    if (byUserId?.label) return byUserId.label;
    if (bagOwnerUsername) return bagOwnerUsername;
    return 'Unassigned';
  }, [bagOwnerUserId, bagOwnerUsername, inventoryOwnerChoices]);

  const activeInventoryLabel = useMemo(() => {
    if (!authEnabled) return 'Local Player';
    const byUserId = inventoryOwnerChoices.find((player) => player.userId === activeInventoryUserId);
    if (byUserId?.label) return byUserId.label;
    return normalizeText(profile?.username || 'Player');
  }, [activeInventoryUserId, authEnabled, inventoryOwnerChoices, profile?.username]);
  const activeInventoryPossessiveLabel = useMemo(
    () => formatPossessiveLabel(activeInventoryLabel, 'Player'),
    [activeInventoryLabel]
  );

  const playerInventories = useMemo(() => (
    bag?.playerInventories && typeof bag.playerInventories === 'object' && !Array.isArray(bag.playerInventories)
      ? bag.playerInventories
      : {}
  ), [bag?.playerInventories]);

  const activePersonalInventory = useMemo(() => {
    if (!canUsePersonalInventory || !activeInventoryUserId) {
      return { userId: '', username: '', attunementLimit: DEFAULT_ATTUNEMENT_LIMIT, items: [] };
    }
    const existing = playerInventories[activeInventoryUserId];
    if (existing && Array.isArray(existing.items)) return existing;
    return {
      userId: activeInventoryUserId,
      username: activeInventoryLabel,
      attunementLimit: DEFAULT_ATTUNEMENT_LIMIT,
      items: [],
    };
  }, [activeInventoryLabel, activeInventoryUserId, canUsePersonalInventory, playerInventories]);
  const activePersonalInventoryAttunementLimit = useMemo(
    () => normalizeAttunementLimit(activePersonalInventory?.attunementLimit),
    [activePersonalInventory?.attunementLimit]
  );

  const personalInventoryItems = useMemo(() => {
    const items = Array.isArray(activePersonalInventory?.items) ? [...activePersonalInventory.items] : [];
    items.sort((a, b) => {
      const equippedDelta = Number(!!b?.equipped) - Number(!!a?.equipped);
      if (equippedDelta !== 0) return equippedDelta;
      const updatedDelta =
        personalInventorySortTimestamp(activeInventoryUserId, b)
        - personalInventorySortTimestamp(activeInventoryUserId, a);
      if (updatedDelta !== 0) return updatedDelta;
      return (a?.name || '').localeCompare(b?.name || '');
    });
    return items;
  }, [activeInventoryUserId, activePersonalInventory?.items]);

  const tradeRequests = useMemo(
    () => (Array.isArray(bag?.tradeRequests) ? bag.tradeRequests : []),
    [bag?.tradeRequests]
  );
  const bagTradeRequests = useMemo(
    () => tradeRequests.filter((entry) => normalizeText(entry.type).toLowerCase() !== 'player-trade'),
    [tradeRequests]
  );
  const playerTradeRequests = useMemo(
    () => tradeRequests.filter((entry) => normalizeText(entry.type).toLowerCase() === 'player-trade'),
    [tradeRequests]
  );
  const pendingTradeRequests = useMemo(
    () => bagTradeRequests.filter((entry) => entry.status === 'pending'),
    [bagTradeRequests]
  );
  const myTradeRequests = useMemo(() => {
    if (!activeInventoryUserId) return [];
    return bagTradeRequests.filter((entry) => normalizeText(entry.requesterUserId) === activeInventoryUserId);
  }, [activeInventoryUserId, bagTradeRequests]);
  const myPendingTradeCount = useMemo(
    () => myTradeRequests.filter((entry) => entry.status === 'pending').length,
    [myTradeRequests]
  );
  const visibleTradeRequests = useMemo(
    () => (canEditInventory ? bagTradeRequests : myTradeRequests).slice(0, 40),
    [bagTradeRequests, canEditInventory, myTradeRequests]
  );
  const tradeRequestTargetItem = useMemo(
    () => (bag.items || []).find((entry) => entry.id === tradeRequestTargetItemId) || null,
    [bag.items, tradeRequestTargetItemId]
  );
  const tradeOfferItemOptions = useMemo(
    () => personalInventoryItems.filter((entry) => (entry.qty || 0) > 0),
    [personalInventoryItems]
  );
  const selectedTradeOfferItem = useMemo(
    () => tradeOfferItemOptions.find((entry) => entry.id === normalizeText(tradeDraft.offerItemId)) || null,
    [tradeDraft.offerItemId, tradeOfferItemOptions]
  );
  const playerInventoryEntriesByUserId = useMemo(() => {
    const normalized = normalizePlayerInventories(playerInventories);
    const out = {};
    Object.entries(normalized).forEach(([userId, entry]) => {
      out[userId] = {
        userId,
        username: normalizeText(entry?.username),
        items: normalizeInventoryItems(entry?.items || []),
      };
    });
    return out;
  }, [playerInventories]);
  const tradingPlayerOptions = useMemo(() => {
    const byId = new Map();
    inventoryOwnerChoices.forEach((player, idx) => {
      const userId = normalizeText(player.userId);
      if (!userId || byId.has(userId)) return;
      byId.set(userId, {
        userId,
        label: normalizeText(player.label || player.username || fallbackPlayerLabel(idx)),
      });
    });
    Object.entries(playerInventoryEntriesByUserId).forEach(([userId, entry], idx) => {
      if (!userId || byId.has(userId)) return;
      byId.set(userId, {
        userId,
        label: normalizeText(entry.username || fallbackPlayerLabel(idx)),
      });
    });
    if (activeInventoryUserId && !byId.has(activeInventoryUserId)) {
      byId.set(activeInventoryUserId, {
        userId: activeInventoryUserId,
        label: activeInventoryLabel || 'You',
      });
    }
    return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [activeInventoryLabel, activeInventoryUserId, inventoryOwnerChoices, playerInventoryEntriesByUserId]);
  const tradingPlayerLabelById = useMemo(() => {
    const map = {};
    tradingPlayerOptions.forEach((player) => {
      map[player.userId] = player.label;
    });
    return map;
  }, [tradingPlayerOptions]);
  const otherTradingPlayers = useMemo(
    () => tradingPlayerOptions.filter((player) => player.userId !== activeInventoryUserId),
    [activeInventoryUserId, tradingPlayerOptions]
  );
  useEffect(() => {
    if (!activeInventoryUserId) {
      setInventoryViewerUserId('');
      return;
    }
    if (!inventoryViewerUserId) {
      setInventoryViewerUserId(activeInventoryUserId);
      return;
    }
    if (tradingPlayerOptions.some((player) => player.userId === inventoryViewerUserId)) return;
    setInventoryViewerUserId(activeInventoryUserId);
  }, [activeInventoryUserId, inventoryViewerUserId, tradingPlayerOptions]);

  useEffect(() => {
    if (!playerTradeTargetUserId) return;
    if (otherTradingPlayers.some((player) => player.userId === playerTradeTargetUserId)) return;
    setPlayerTradeTargetUserId('');
  }, [otherTradingPlayers, playerTradeTargetUserId]);

  useEffect(() => {
    personalInventoryHideSortLockRef.current = {};
  }, [activeInventoryUserId, campaignTab, inventoryViewerUserId, playerTradeCenterOpen]);

  useEffect(() => {
    setPersonalInventoryDetailItemId('');
  }, [activeInventoryUserId, campaignTab, inventoryViewerUserId, playerTradeCenterOpen]);

  const viewerIsSelf = normalizeText(inventoryViewerUserId || activeInventoryUserId) === normalizeText(activeInventoryUserId);
  const viewedInventoryEntry = useMemo(() => {
    const viewerId = normalizeText(inventoryViewerUserId || activeInventoryUserId);
    if (!viewerId) return { userId: '', username: '', attunementLimit: DEFAULT_ATTUNEMENT_LIMIT, items: [] };
    const existing = playerInventoryEntriesByUserId[viewerId];
    if (existing) return existing;
    return {
      userId: viewerId,
      username: tradingPlayerLabelById[viewerId] || '',
      attunementLimit: DEFAULT_ATTUNEMENT_LIMIT,
      items: [],
    };
  }, [activeInventoryUserId, inventoryViewerUserId, playerInventoryEntriesByUserId, tradingPlayerLabelById]);
  const viewedInventoryLabel = useMemo(() => {
    const viewerId = normalizeText(inventoryViewerUserId || activeInventoryUserId);
    if (!viewerId) return 'Player';
    return tradingPlayerLabelById[viewerId] || viewedInventoryEntry.username || 'Player';
  }, [activeInventoryUserId, inventoryViewerUserId, tradingPlayerLabelById, viewedInventoryEntry.username]);
  const viewedInventoryItems = useMemo(() => {
    const viewerId = normalizeText(inventoryViewerUserId || activeInventoryUserId);
    const list = Array.isArray(viewedInventoryEntry?.items) ? [...viewedInventoryEntry.items] : [];
    const visible = viewerIsSelf ? list : list.filter((item) => !item.hidden);
    visible.sort((a, b) => {
      const equippedDelta = Number(!!b?.equipped) - Number(!!a?.equipped);
      if (equippedDelta !== 0) return equippedDelta;
      const updatedDelta =
        personalInventorySortTimestamp(viewerId, b)
        - personalInventorySortTimestamp(viewerId, a);
      if (updatedDelta !== 0) return updatedDelta;
      return (a?.name || '').localeCompare(b?.name || '');
    });
    return visible;
  }, [activeInventoryUserId, inventoryViewerUserId, viewerIsSelf, viewedInventoryEntry?.items]);
  const personalInventoryDetailItem = useMemo(
    () => viewedInventoryItems.find((item) => item.id === personalInventoryDetailItemId) || null,
    [personalInventoryDetailItemId, viewedInventoryItems]
  );
  const personalInventoryDetailWeaponRows = useMemo(() => {
    if (!personalInventoryDetailItem) return [];
    return [
      { label: 'Proficient', value: normalizeText(personalInventoryDetailItem.weaponProficiency || personalInventoryDetailItem.proficiency) },
      { label: 'Hit / DC', value: normalizeText(personalInventoryDetailItem.weaponHitDc || personalInventoryDetailItem.hitDc) },
      { label: 'Attack Type', value: normalizeText(personalInventoryDetailItem.weaponAttackType || personalInventoryDetailItem.attackType) },
      { label: 'Reach', value: normalizeText(personalInventoryDetailItem.weaponReach || personalInventoryDetailItem.reach) },
      { label: 'Damage', value: normalizeText(personalInventoryDetailItem.weaponDamage || personalInventoryDetailItem.damage) },
      { label: 'Damage Type', value: normalizeText(personalInventoryDetailItem.weaponDamageType || personalInventoryDetailItem.damageType) },
      { label: 'Properties', value: normalizeText(personalInventoryDetailItem.weaponProperties || personalInventoryDetailItem.properties) },
    ].filter((entry) => !!entry.value);
  }, [personalInventoryDetailItem]);
  const personalInventoryDetailTags = useMemo(() => {
    if (!personalInventoryDetailItem) return [];
    return normalizeItemTags(personalInventoryDetailItem.tags);
  }, [personalInventoryDetailItem]);

  useEffect(() => {
    if (!personalInventoryDetailItemId) return;
    if (personalInventoryDetailItem) return;
    setPersonalInventoryDetailItemId('');
  }, [personalInventoryDetailItem, personalInventoryDetailItemId]);

  const playerTradeSessions = useMemo(() => {
    if (!activeInventoryUserId) return [];
    return playerTradeRequests
      .filter((trade) => (
        normalizeText(trade.fromUserId) === activeInventoryUserId
        || normalizeText(trade.toUserId) === activeInventoryUserId
      ))
      .filter((trade) => normalizeText(trade.status).toLowerCase() !== 'cancelled')
      .sort((a, b) => new Date(b.updatedAt || b.requestedAt || 0) - new Date(a.updatedAt || a.requestedAt || 0));
  }, [activeInventoryUserId, playerTradeRequests]);
  const focusedPlayerTrade = useMemo(
    () => playerTradeSessions.find((trade) => trade.id === normalizeText(playerTradeFocusId)) || null,
    [playerTradeFocusId, playerTradeSessions]
  );
  const activePlayerTradeTargetUserId = useMemo(() => {
    if (focusedPlayerTrade) {
      const fromUserId = normalizeText(focusedPlayerTrade.fromUserId);
      const toUserId = normalizeText(focusedPlayerTrade.toUserId);
      if (fromUserId === activeInventoryUserId) return toUserId;
      if (toUserId === activeInventoryUserId) return fromUserId;
    }
    return normalizeText(playerTradeTargetUserId);
  }, [activeInventoryUserId, focusedPlayerTrade, playerTradeTargetUserId]);
  const activePlayerTradeTargetLabel = activePlayerTradeTargetUserId
    ? (tradingPlayerLabelById[activePlayerTradeTargetUserId] || viewedInventoryEntry.username || 'Player')
    : '';
  const activePlayerTradeIsViewerFrom = focusedPlayerTrade
    ? normalizeText(focusedPlayerTrade.fromUserId) === activeInventoryUserId
    : true;
  const focusedTradeOwnOffer = useMemo(
    () => normalizeText(activeInventoryUserId) && focusedPlayerTrade
      ? (
        activePlayerTradeIsViewerFrom
          ? (Array.isArray(focusedPlayerTrade.fromOffer) ? focusedPlayerTrade.fromOffer : [])
          : (Array.isArray(focusedPlayerTrade.toOffer) ? focusedPlayerTrade.toOffer : [])
      )
      : [],
    [activeInventoryUserId, activePlayerTradeIsViewerFrom, focusedPlayerTrade]
  );
  const focusedTradeTargetOffer = useMemo(
    () => normalizeText(activeInventoryUserId) && focusedPlayerTrade
      ? (
        activePlayerTradeIsViewerFrom
          ? (Array.isArray(focusedPlayerTrade.toOffer) ? focusedPlayerTrade.toOffer : [])
          : (Array.isArray(focusedPlayerTrade.fromOffer) ? focusedPlayerTrade.fromOffer : [])
      )
      : [],
    [activeInventoryUserId, activePlayerTradeIsViewerFrom, focusedPlayerTrade]
  );
  const focusedTradeViewerAccepted = focusedPlayerTrade
    ? (activePlayerTradeIsViewerFrom ? !!focusedPlayerTrade.fromAccepted : !!focusedPlayerTrade.toAccepted)
    : false;
  const focusedTradeOtherAccepted = focusedPlayerTrade
    ? (activePlayerTradeIsViewerFrom ? !!focusedPlayerTrade.toAccepted : !!focusedPlayerTrade.fromAccepted)
    : false;
  const playerTradeOwnItemOptions = useMemo(
    () => personalInventoryItems.filter((item) => (item.qty || 0) > 0),
    [personalInventoryItems]
  );
  const canManagePlayerTrade = !!(canEditPersonalInventory && activeInventoryUserId);

  const ensureInventoryEditPermission = () => {
    if (canEditInventory) return true;
    alert(inventoryReadOnlyMessage);
    return false;
  };

  const ensurePersonalInventoryEditPermission = () => {
    if (canEditPersonalInventory) return true;
    alert(personalInventoryReadOnlyMessage);
    return false;
  };

  const openPersonalInventoryDetail = (item) => {
    const itemId = normalizeText(item?.id);
    if (!itemId) return;
    setPersonalInventoryDetailItemId(itemId);
  };

  const closePersonalInventoryDetail = () => {
    setPersonalInventoryDetailItemId('');
  };

  const transferBagOwnership = () => {
    if (!canTransferBagOwnership) {
      alert(inventoryReadOnlyMessage);
      return;
    }

    const target = inventoryOwnerChoices.find((player) => player.userId === bagTransferTargetUserId);
    if (!target) {
      alert('Select a player to transfer inventory control.');
      return;
    }

    const now = new Date().toISOString();
    setBag((prev) => ({
      ...prev,
      ownerUserId: target.userId,
      ownerEmail: '',
      ownerUsername: normalizeText(target.username || target.label),
      ownerUpdatedAt: now,
      ownerUpdatedByUserId: currentUserId,
      ownerUpdatedByUsername: normalizeText(profile?.username || 'DM'),
    }));
    setBagTransferTargetUserId('');
  };

  useEffect(() => {
    if (!invModalOpen && !tradeRequestModalOpen && !tradeCenterOpen && !playerTradeCenterOpen && !personalInventoryDetailItemId) return;
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (personalInventoryDetailItemId) setPersonalInventoryDetailItemId('');
      if (tradeRequestModalOpen) setTradeRequestModalOpen(false);
      if (tradeCenterOpen) setTradeCenterOpen(false);
      if (playerTradeCenterOpen) {
        setPlayerTradeCenterOpen(false);
        setPlayerTradeFocusId('');
      }
      if (invModalOpen) {
        setInvModalOpen(false);
        setInvEditingId(null);
        setInvModalTarget('party');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [invModalOpen, personalInventoryDetailItemId, playerTradeCenterOpen, tradeCenterOpen, tradeRequestModalOpen]);

  const invEmptyDraft = {
    name: '',
    qty: 1,
    category: 'Gear',
    rarity: 'Common',
    value: '',
    weight: '',
    notes: '',
    tags: '',
    assignedTo: '',
    weaponProficiency: '',
    weaponHitDc: '',
    weaponAttackType: '',
    weaponReach: '',
    weaponDamage: '',
    weaponDamageType: '',
    weaponProperties: '',
    equipped: false,
    attuned: false,
    hidden: false,
  };
  const [invDraft, setInvDraft] = useState(invEmptyDraft);

  const draftFromItem = (item) => ({
    name: item.name || '',
    qty: typeof item.qty === 'number' ? item.qty : 1,
    category: item.category || 'Gear',
    rarity: item.rarity || 'Common',
    value: item.value ?? '',
    weight: item.weight ?? '',
    notes: item.notes || '',
    tags: Array.isArray(item.tags) ? item.tags.join(', ') : '',
    assignedTo: item.assignedTo || '',
    weaponProficiency: item.weaponProficiency || item.proficiency || '',
    weaponHitDc: item.weaponHitDc || item.hitDc || '',
    weaponAttackType: item.weaponAttackType || item.attackType || '',
    weaponReach: item.weaponReach || item.reach || '',
    weaponDamage: item.weaponDamage || item.damage || '',
    weaponDamageType: item.weaponDamageType || item.damageType || '',
    weaponProperties: item.weaponProperties || item.properties || '',
    equipped: !!item.equipped,
    attuned: !!item.attuned,
    hidden: !!item.hidden,
  });

  const closeInventoryModal = () => {
    setInvModalOpen(false);
    setInvEditingId(null);
    setInvModalTarget('party');
  };

  const invOpenAdd = () => {
    if (!ensureInventoryEditPermission()) return;
    setInvModalTarget('party');
    setInvEditingId(null);
    setInvDraft(invEmptyDraft);
    setInvModalOpen(true);
  };

  const invOpenEdit = (item) => {
    if (!ensureInventoryEditPermission()) return;
    setInvModalTarget('party');
    setInvEditingId(item.id);
    setInvDraft(draftFromItem(item));
    setInvModalOpen(true);
  };

  const handleInventoryCardSelect = (item) => {
    if (!item) return;
    setInvSelectedItemId((prev) => (prev === item.id ? '' : item.id));
    if (canEditInventory) {
      invOpenEdit(item);
    }
  };

  const invOpenPersonalAdd = () => {
    if (!ensurePersonalInventoryEditPermission()) return;
    if (!activeInventoryUserId) {
      alert('Sign in to manage personal inventory.');
      return;
    }
    setInvModalTarget('personal');
    setInvEditingId(null);
    setInvDraft(invEmptyDraft);
    setInvModalOpen(true);
  };

  const invOpenPersonalEdit = (item) => {
    if (!ensurePersonalInventoryEditPermission()) return;
    if (!activeInventoryUserId) {
      alert('Sign in to manage personal inventory.');
      return;
    }
    setInvModalTarget('personal');
    setInvEditingId(item.id);
    setInvDraft(draftFromItem(item));
    setInvModalOpen(true);
  };

  const invSaveDraft = () => {
    const editingPersonal = invModalTarget === 'personal';
    if (editingPersonal) {
      if (!ensurePersonalInventoryEditPermission()) return;
      if (!activeInventoryUserId) {
        alert('Sign in to manage personal inventory.');
        return;
      }
    } else if (!ensureInventoryEditPermission()) {
      return;
    }

    const name = normalizeText(invDraft.name);
    if (!name) {
      alert('Item needs a name.');
      return;
    }

    const qty = clampInt(parseInt(invDraft.qty, 10) || 1, 1, 9999);
    const value = normalizeOptionalNumber(invDraft.value);
    const weight = normalizeOptionalNumber(invDraft.weight);
    const tags = normalizeItemTags(invDraft.tags);
    const assignedTo = editingPersonal ? '' : normalizeText(invDraft.assignedTo);
    const category = normalizeItemCategory(invDraft.category);
    const weaponFields = category === 'Weapon'
      ? {
          weaponProficiency: normalizeText(invDraft.weaponProficiency),
          weaponHitDc: normalizeText(invDraft.weaponHitDc),
          weaponAttackType: normalizeText(invDraft.weaponAttackType),
          weaponReach: normalizeText(invDraft.weaponReach),
          weaponDamage: normalizeText(invDraft.weaponDamage),
          weaponDamageType: normalizeText(invDraft.weaponDamageType),
          weaponProperties: normalizeText(invDraft.weaponProperties),
        }
      : {
          weaponProficiency: '',
          weaponHitDc: '',
          weaponAttackType: '',
          weaponReach: '',
          weaponDamage: '',
          weaponDamageType: '',
          weaponProperties: '',
        };
    const now = new Date().toISOString();

    const upsertItems = (inputItems) => {
      const items = normalizeInventoryItems(inputItems, now);
      const buildItem = (existing = null) => ({
        id: normalizeText(existing?.id) || bagNewId(),
        name,
        qty,
        category,
        rarity: normalizeItemRarity(invDraft.rarity || existing?.rarity),
        value: Number.isFinite(value) ? value : (existing ? normalizeOptionalNumber(existing.value) : null),
        weight: Number.isFinite(weight) ? weight : (existing ? normalizeOptionalNumber(existing.weight) : null),
        notes: normalizeText(invDraft.notes),
        tags,
        assignedTo,
        ...weaponFields,
        equipped: !!invDraft.equipped,
        attuned: editingPersonal ? !!invDraft.attuned : false,
        hidden: editingPersonal ? !!invDraft.hidden : false,
        createdAt: normalizeIso(existing?.createdAt) || now,
        updatedAt: now,
      });

      if (!invEditingId) return [buildItem(null), ...items];
      return items.map((entry) => (entry.id === invEditingId ? buildItem(entry) : entry));
    };

    const countAttunedItems = (items) => (
      (Array.isArray(items) ? items : []).reduce((sum, entry) => sum + (entry?.attuned ? 1 : 0), 0)
    );

    if (editingPersonal) {
      const previewItems = upsertItems(activePersonalInventory?.items || []);
      if (countAttunedItems(previewItems) > activePersonalInventoryAttunementLimit) {
        alert(`Attunement limit reached (${activePersonalInventoryAttunementLimit}). Increase the limit or unattune another item.`);
        return;
      }
      setBag((prev) => {
        const nextPlayerInventories = normalizePlayerInventories(prev?.playerInventories, now);
        const existingInventory = nextPlayerInventories[activeInventoryUserId] || {
          userId: activeInventoryUserId,
          username: activeInventoryLabel,
          attunementLimit: DEFAULT_ATTUNEMENT_LIMIT,
          items: [],
        };
        nextPlayerInventories[activeInventoryUserId] = {
          ...existingInventory,
          userId: activeInventoryUserId,
          username: normalizeText(existingInventory.username || activeInventoryLabel),
          updatedAt: now,
          items: upsertItems(existingInventory.items),
        };
        return {
          ...prev,
          playerInventories: nextPlayerInventories,
        };
      });
      closeInventoryModal();
      return;
    }

    setBag((prev) => ({
      ...prev,
      items: upsertItems(prev?.items),
    }));
    closeInventoryModal();
  };

  const invDeleteItem = (id) => {
    if (!ensureInventoryEditPermission()) return;
    if (!confirm('Delete this item?')) return;
    setBag((prev) => ({
      ...prev,
      items: normalizeInventoryItems(prev?.items).filter((entry) => entry.id !== id),
    }));
  };

  const invBumpQty = (id, delta) => {
    if (!ensureInventoryEditPermission()) return;
    const now = new Date().toISOString();
    setBag((prev) => ({
      ...prev,
      items: normalizeInventoryItems(prev?.items, now).map((entry) => (
        entry.id === id
          ? { ...entry, qty: clampInt((entry.qty || 1) + delta, 1, 9999), updatedAt: now }
          : entry
      )),
    }));
  };

  const invToggleEquipped = (id) => {
    if (!ensureInventoryEditPermission()) return;
    const now = new Date().toISOString();
    setBag((prev) => ({
      ...prev,
      items: normalizeInventoryItems(prev?.items, now).map((entry) => (
        entry.id === id
          ? { ...entry, equipped: !entry.equipped, updatedAt: now }
          : entry
      )),
    }));
  };

  const invDeletePersonalItem = (id) => {
    if (!ensurePersonalInventoryEditPermission()) return;
    if (!activeInventoryUserId) return;
    if (!confirm('Delete this personal item?')) return;
    const now = new Date().toISOString();
    setBag((prev) => {
      const nextPlayerInventories = normalizePlayerInventories(prev?.playerInventories, now);
      const existingInventory = nextPlayerInventories[activeInventoryUserId];
      if (!existingInventory) return prev;
      nextPlayerInventories[activeInventoryUserId] = {
        ...existingInventory,
        updatedAt: now,
        items: normalizeInventoryItems(existingInventory.items, now).filter((entry) => entry.id !== id),
      };
      return {
        ...prev,
        playerInventories: nextPlayerInventories,
      };
    });
  };

  const invBumpPersonalQty = (id, delta) => {
    if (!ensurePersonalInventoryEditPermission()) return;
    if (!activeInventoryUserId) return;
    const now = new Date().toISOString();
    setBag((prev) => {
      const nextPlayerInventories = normalizePlayerInventories(prev?.playerInventories, now);
      const existingInventory = nextPlayerInventories[activeInventoryUserId] || {
        userId: activeInventoryUserId,
        username: activeInventoryLabel,
        attunementLimit: DEFAULT_ATTUNEMENT_LIMIT,
        items: [],
      };
      nextPlayerInventories[activeInventoryUserId] = {
        ...existingInventory,
        userId: activeInventoryUserId,
        username: normalizeText(existingInventory.username || activeInventoryLabel),
        updatedAt: now,
        items: normalizeInventoryItems(existingInventory.items, now).map((entry) => (
          entry.id === id
            ? { ...entry, qty: clampInt((entry.qty || 1) + delta, 1, 9999), updatedAt: now }
            : entry
        )),
      };
      return {
        ...prev,
        playerInventories: nextPlayerInventories,
      };
    });
  };

  const invTogglePersonalEquipped = (id) => {
    if (!ensurePersonalInventoryEditPermission()) return;
    if (!activeInventoryUserId) return;
    const now = new Date().toISOString();
    setBag((prev) => {
      const nextPlayerInventories = normalizePlayerInventories(prev?.playerInventories, now);
      const existingInventory = nextPlayerInventories[activeInventoryUserId] || {
        userId: activeInventoryUserId,
        username: activeInventoryLabel,
        attunementLimit: DEFAULT_ATTUNEMENT_LIMIT,
        items: [],
      };
      nextPlayerInventories[activeInventoryUserId] = {
        ...existingInventory,
        userId: activeInventoryUserId,
        username: normalizeText(existingInventory.username || activeInventoryLabel),
        updatedAt: now,
        items: normalizeInventoryItems(existingInventory.items, now).map((entry) => (
          entry.id === id
            ? { ...entry, equipped: !entry.equipped, updatedAt: now }
            : entry
        )),
      };
      return {
        ...prev,
        playerInventories: nextPlayerInventories,
      };
    });
  };

  const invTogglePersonalAttuned = (id) => {
    if (!ensurePersonalInventoryEditPermission()) return;
    if (!activeInventoryUserId) return;
    const now = new Date().toISOString();
    setBag((prev) => {
      const nextPlayerInventories = normalizePlayerInventories(prev?.playerInventories, now);
      const existingInventory = nextPlayerInventories[activeInventoryUserId] || {
        userId: activeInventoryUserId,
        username: activeInventoryLabel,
        attunementLimit: DEFAULT_ATTUNEMENT_LIMIT,
        items: [],
      };
      const attunementLimit = normalizeAttunementLimit(existingInventory.attunementLimit);
      const normalizedItems = normalizeInventoryItems(existingInventory.items, now);
      const target = normalizedItems.find((entry) => entry.id === id);
      if (!target) return prev;
      if (!target.attuned) {
        const currentAttunedCount = normalizedItems.reduce((sum, entry) => sum + (entry?.attuned ? 1 : 0), 0);
        if (currentAttunedCount >= attunementLimit) {
          alert(`Attunement limit reached (${attunementLimit}). Increase the limit or unattune another item.`);
          return prev;
        }
      }
      nextPlayerInventories[activeInventoryUserId] = {
        ...existingInventory,
        userId: activeInventoryUserId,
        username: normalizeText(existingInventory.username || activeInventoryLabel),
        attunementLimit,
        updatedAt: now,
        items: normalizedItems.map((entry) => (
          entry.id === id
            ? { ...entry, attuned: !entry.attuned, updatedAt: now }
            : entry
        )),
      };
      return {
        ...prev,
        playerInventories: nextPlayerInventories,
      };
    });
  };

  const invTogglePersonalHidden = (id) => {
    if (!ensurePersonalInventoryEditPermission()) return;
    if (!activeInventoryUserId) return;
    const now = new Date().toISOString();
    setBag((prev) => {
      const nextPlayerInventories = normalizePlayerInventories(prev?.playerInventories, now);
      const existingInventory = nextPlayerInventories[activeInventoryUserId] || {
        userId: activeInventoryUserId,
        username: activeInventoryLabel,
        attunementLimit: DEFAULT_ATTUNEMENT_LIMIT,
        items: [],
      };
      const normalizedItems = normalizeInventoryItems(existingInventory.items, now);
      const existingItem = normalizedItems.find((entry) => entry.id === id);
      if (existingItem) {
        rememberPersonalInventoryHideSortLock(activeInventoryUserId, id, existingItem.updatedAt);
      }
      nextPlayerInventories[activeInventoryUserId] = {
        ...existingInventory,
        userId: activeInventoryUserId,
        username: normalizeText(existingInventory.username || activeInventoryLabel),
        updatedAt: now,
        items: normalizedItems.map((entry) => (
          entry.id === id
            ? { ...entry, hidden: !entry.hidden, updatedAt: now }
            : entry
        )),
      };
      return {
        ...prev,
        playerInventories: nextPlayerInventories,
      };
    });
  };

  const normalizeTradeOfferLine = (entry, fallbackName = '') => {
    const source = entry && typeof entry === 'object' ? entry : {};
    const itemId = normalizeText(source.itemId || source.id);
    if (!itemId) return null;
    const qty = clampInt(Number.parseInt(source.qty, 10) || 1, 1, 9999);
    return {
      itemId,
      name: normalizeText(source.name || source.itemName || fallbackName),
      qty,
    };
  };

  const updatePlayerTradeEntry = (tradeId, updater) => {
    const normalizedTradeId = normalizeText(tradeId);
    if (!normalizedTradeId) return;
    const now = new Date().toISOString();
    setBag((prev) => {
      const requests = normalizeTradeRequests(prev?.tradeRequests, now);
      let didUpdate = false;
      const nextRequests = requests.map((entry) => {
        if (entry.id !== normalizedTradeId) return entry;
        const nextEntry = updater(entry, now, prev);
        if (!nextEntry || nextEntry === entry) return entry;
        didUpdate = true;
        return nextEntry;
      });
      if (!didUpdate) return prev;
      return {
        ...prev,
        tradeRequests: nextRequests,
      };
    });
  };

  const startPlayerTrade = (targetUserId, options = {}) => {
    if (!canManagePlayerTrade) {
      alert(personalInventoryReadOnlyMessage);
      return;
    }
    const normalizedTargetUserId = normalizeText(targetUserId);
    if (!normalizedTargetUserId || normalizedTargetUserId === activeInventoryUserId) {
      alert('Select another player to trade with.');
      return;
    }

    const targetLabel = tradingPlayerLabelById[normalizedTargetUserId] || 'Player';
    const now = new Date().toISOString();
    const targetItem = options.targetItem && typeof options.targetItem === 'object'
      ? options.targetItem
      : null;
    const requestedQty = clampInt(
      Number.parseInt(options.targetQty, 10) || 1,
      1,
      Math.max(1, Number.parseInt(targetItem?.qty, 10) || 1)
    );
    const initialTargetOffer = targetItem
      ? [normalizeTradeOfferLine({ itemId: targetItem.id, name: targetItem.name, qty: requestedQty })].filter(Boolean)
      : [];
    const tradeId = tradeNewId();
    const newTrade = {
      id: tradeId,
      type: 'player-trade',
      status: 'open',
      requestedAt: now,
      updatedAt: now,
      requesterUserId: activeInventoryUserId,
      requesterUsername: activeInventoryLabel,
      requesterEmail: currentUserEmail,
      targetOwnerUserId: normalizedTargetUserId,
      targetOwnerUsername: targetLabel,
      partyItemId: '',
      partyItemName: '',
      partyItemCategory: '',
      partyItemRarity: '',
      requestedQty: 0,
      offerItemId: '',
      offerItemName: '',
      offerQty: 0,
      note: '',
      decidedAt: '',
      decidedByUserId: '',
      decidedByUsername: '',
      decisionNote: '',
      fromUserId: activeInventoryUserId,
      fromUsername: activeInventoryLabel,
      toUserId: normalizedTargetUserId,
      toUsername: targetLabel,
      fromOffer: [],
      toOffer: initialTargetOffer,
      fromAccepted: false,
      toAccepted: false,
      message: normalizeText(options.message || ''),
      completedAt: '',
      cancelledAt: '',
    };

    setBag((prev) => ({
      ...prev,
      tradeRequests: [newTrade, ...normalizeTradeRequests(prev?.tradeRequests, now)],
    }));
    setPlayerTradeTargetUserId(normalizedTargetUserId);
    setPlayerTradeFocusId(tradeId);
    setPlayerTradeCenterOpen(true);
    setPlayerTradeOwnItemId('');
    setPlayerTradeOwnQty('1');
    setPlayerTradeMessage('');
  };

  const openTradeFromViewedInventoryItem = (item) => {
    if (!item || viewerIsSelf) return;
    const targetUserId = normalizeText(viewedInventoryEntry.userId);
    if (!targetUserId) return;
    startPlayerTrade(targetUserId, { targetItem: item, targetQty: 1 });
  };

  const addLineToPlayerTrade = (tradeId) => {
    if (!canManagePlayerTrade) return;
    const requestedItemId = normalizeText(playerTradeOwnItemId);
    if (!requestedItemId) return;
    const qtyInput = playerTradeOwnQty;
    const requestedQty = clampInt(Number.parseInt(qtyInput, 10) || 1, 1, 9999);
    updatePlayerTradeEntry(tradeId, (trade, now, prevBag) => {
      if (normalizeText(trade.type).toLowerCase() !== 'player-trade') return trade;
      if (trade.status === 'completed' || trade.status === 'cancelled') return trade;
      const viewerIsFrom = normalizeText(trade.fromUserId) === activeInventoryUserId;
      const sourceUserId = activeInventoryUserId;
      const normalizedBag = normalizeBagInventoryState(prevBag, { now, idFactory: bagNewId });
      const sourceInventory = normalizeInventoryItems(
        normalizedBag.playerInventories?.[sourceUserId]?.items || [],
        now
      );
      const sourceItem = sourceInventory.find((entry) => entry.id === requestedItemId);
      if (!sourceItem || sourceItem.hidden && sourceUserId !== activeInventoryUserId) return trade;
      const maxQty = Math.max(1, sourceItem.qty || 1);
      const offerKey = viewerIsFrom ? 'fromOffer' : 'toOffer';
      const currentOffer = Array.isArray(trade[offerKey]) ? trade[offerKey] : [];
      const existing = currentOffer.find((line) => normalizeText(line.itemId) === requestedItemId);
      const nextOffer = existing
        ? currentOffer.map((line) => (
          normalizeText(line.itemId) === requestedItemId
            ? { ...line, qty: clampInt((line.qty || 0) + requestedQty, 1, maxQty), name: normalizeText(line.name || sourceItem.name) }
            : line
        ))
        : [...currentOffer, { itemId: requestedItemId, name: sourceItem.name, qty: clampInt(requestedQty, 1, maxQty) }];

      return {
        ...trade,
        [offerKey]: nextOffer,
        fromAccepted: false,
        toAccepted: false,
        status: 'open',
        updatedAt: now,
      };
    });
    setPlayerTradeOwnItemId('');
    setPlayerTradeOwnQty('1');
  };

  const removeLineFromPlayerTrade = (tradeId, itemId) => {
    if (!canManagePlayerTrade) return;
    const normalizedItemId = normalizeText(itemId);
    if (!normalizedItemId) return;
    updatePlayerTradeEntry(tradeId, (trade, now) => {
      if (normalizeText(trade.type).toLowerCase() !== 'player-trade') return trade;
      if (trade.status === 'completed' || trade.status === 'cancelled') return trade;
      const viewerIsFrom = normalizeText(trade.fromUserId) === activeInventoryUserId;
      const offerKey = viewerIsFrom ? 'fromOffer' : 'toOffer';
      const currentOffer = Array.isArray(trade[offerKey]) ? trade[offerKey] : [];
      const nextOffer = currentOffer.filter((line) => normalizeText(line.itemId) !== normalizedItemId);
      if (nextOffer.length === currentOffer.length) return trade;
      return {
        ...trade,
        [offerKey]: nextOffer,
        fromAccepted: false,
        toAccepted: false,
        status: 'open',
        updatedAt: now,
      };
    });
  };

  const consumeTradeOfferFromInventory = (items, offerLines, now) => {
    let nextItems = normalizeInventoryItems(items, now);
    const movedItems = [];
    for (let i = 0; i < offerLines.length; i += 1) {
      const line = offerLines[i];
      const itemId = normalizeText(line?.itemId);
      const qty = clampInt(Number.parseInt(line?.qty, 10) || 1, 1, 9999);
      const itemIndex = nextItems.findIndex((entry) => entry.id === itemId);
      if (itemIndex < 0) {
        return { ok: false, error: `${line?.name || 'An item'} is no longer available.` };
      }
      const item = nextItems[itemIndex];
      if ((item.qty || 1) < qty) {
        return { ok: false, error: `Not enough quantity for ${item.name}.` };
      }
      movedItems.push({ ...item, qty });
      const remainingQty = (item.qty || 1) - qty;
      if (remainingQty <= 0) {
        nextItems = nextItems.filter((entry) => entry.id !== item.id);
      } else {
        nextItems = nextItems.map((entry) => (
          entry.id === item.id
            ? { ...entry, qty: remainingQty, updatedAt: now }
            : entry
        ));
      }
    }
    return { ok: true, nextItems, movedItems };
  };

  const appendMovedTradeItems = (items, movedItems, now) => {
    const base = normalizeInventoryItems(items, now);
    const additions = movedItems.map((item) => ({
      ...normalizeInventoryItem(item, now),
      id: bagNewId(),
      qty: clampInt(Number.parseInt(item.qty, 10) || 1, 1, 9999),
      equipped: false,
      attuned: false,
      hidden: false,
      assignedTo: '',
      createdAt: now,
      updatedAt: now,
    }));
    return normalizeInventoryItems([...additions, ...base], now);
  };

  const togglePlayerTradeAccepted = (tradeId) => {
    if (!canManagePlayerTrade) return;
    const normalizedTradeId = normalizeText(tradeId);
    if (!normalizedTradeId) return;
    let alertMessage = '';
    const now = new Date().toISOString();

    setBag((prev) => {
      const requests = normalizeTradeRequests(prev?.tradeRequests, now);
      const trade = requests.find((entry) => entry.id === normalizedTradeId);
      if (!trade || normalizeText(trade.type).toLowerCase() !== 'player-trade') return prev;
      if (trade.status === 'completed' || trade.status === 'cancelled') return prev;

      const viewerIsFrom = normalizeText(trade.fromUserId) === activeInventoryUserId;
      const viewerIsTo = normalizeText(trade.toUserId) === activeInventoryUserId;
      if (!viewerIsFrom && !viewerIsTo) return prev;
      const fromAccepted = viewerIsFrom ? !trade.fromAccepted : !!trade.fromAccepted;
      const toAccepted = viewerIsTo ? !trade.toAccepted : !!trade.toAccepted;

      const nextPlayerInventories = normalizePlayerInventories(prev?.playerInventories, now);
      let nextStatus = trade.status || 'open';
      let completedAt = normalizeIso(trade.completedAt);

      if (fromAccepted && toAccepted) {
        const fromUserId = normalizeText(trade.fromUserId);
        const toUserId = normalizeText(trade.toUserId);
        const fromInventory = nextPlayerInventories[fromUserId] || { userId: fromUserId, username: trade.fromUsername, items: [] };
        const toInventory = nextPlayerInventories[toUserId] || { userId: toUserId, username: trade.toUsername, items: [] };
        const fromOffer = Array.isArray(trade.fromOffer) ? trade.fromOffer : [];
        const toOffer = Array.isArray(trade.toOffer) ? trade.toOffer : [];
        const fromResult = consumeTradeOfferFromInventory(fromInventory.items, fromOffer, now);
        if (!fromResult.ok) {
          alertMessage = fromResult.error;
          return prev;
        }
        const toResult = consumeTradeOfferFromInventory(toInventory.items, toOffer, now);
        if (!toResult.ok) {
          alertMessage = toResult.error;
          return prev;
        }

        nextPlayerInventories[fromUserId] = {
          ...fromInventory,
          userId: fromUserId,
          username: normalizeText(fromInventory.username || trade.fromUsername),
          updatedAt: now,
          items: appendMovedTradeItems(fromResult.nextItems, toResult.movedItems, now),
        };
        nextPlayerInventories[toUserId] = {
          ...toInventory,
          userId: toUserId,
          username: normalizeText(toInventory.username || trade.toUsername),
          updatedAt: now,
          items: appendMovedTradeItems(toResult.nextItems, fromResult.movedItems, now),
        };
        nextStatus = 'completed';
        completedAt = now;
      } else {
        nextStatus = 'open';
        completedAt = '';
      }

      return {
        ...prev,
        playerInventories: nextPlayerInventories,
        tradeRequests: requests.map((entry) => (
          entry.id === normalizedTradeId
            ? {
                ...entry,
                status: nextStatus,
                fromAccepted,
                toAccepted,
                completedAt,
                updatedAt: now,
              }
            : entry
        )),
      };
    });

    if (alertMessage) alert(alertMessage);
  };

  const cancelPlayerTrade = (tradeId) => {
    if (!canManagePlayerTrade) return;
    const normalizedTradeId = normalizeText(tradeId);
    if (!normalizedTradeId) return;
    setBag((prev) => {
      const now = new Date().toISOString();
      const requests = normalizeTradeRequests(prev?.tradeRequests, now);
      const trade = requests.find((entry) => entry.id === normalizedTradeId);
      if (!trade || normalizeText(trade.type).toLowerCase() !== 'player-trade') return prev;
      if (normalizeText(trade.status).toLowerCase() === 'completed') return prev;
      const isParticipant = normalizeText(trade.fromUserId) === activeInventoryUserId
        || normalizeText(trade.toUserId) === activeInventoryUserId;
      if (!isParticipant) return prev;
      const nextRequests = requests.filter((entry) => entry.id !== normalizedTradeId);
      if (nextRequests.length === requests.length) return prev;
      return {
        ...prev,
        tradeRequests: nextRequests,
      };
    });
    if (normalizeText(playerTradeFocusId) === normalizedTradeId) {
      setPlayerTradeFocusId('');
    }
  };

  const openPlayerTradeCenter = () => {
    if (!canManagePlayerTrade) {
      alert(personalInventoryReadOnlyMessage);
      return;
    }
    setPlayerTradeCenterOpen(true);
  };

  const openExistingPlayerTrade = (tradeId) => {
    setPlayerTradeFocusId(normalizeText(tradeId));
    setPlayerTradeCenterOpen(true);
  };

  const createPlayerTradeFromComposer = () => {
    const targetUserId = normalizeText(playerTradeTargetUserId);
    if (!targetUserId) {
      alert('Select a player to trade with.');
      return;
    }
    startPlayerTrade(targetUserId, { message: playerTradeMessage });
  };

  const openTradeRequestForItem = (item) => {
    if (!canSubmitTradeRequests) {
      alert(canEditCampaignData ? 'Only non-owner players can request trades from the bag.' : readOnlyStatusMessage);
      return;
    }
    setTradeRequestTargetItemId(item.id);
    setTradeDraft({
      requestedQty: 1,
      offerItemId: '',
      offerQty: 1,
      note: '',
    });
    setTradeRequestModalOpen(true);
  };

  const submitTradeRequest = () => {
    if (!canSubmitTradeRequests) {
      alert(canEditCampaignData ? 'Only non-owner players can request trades from the bag.' : readOnlyStatusMessage);
      return;
    }
    if (!tradeRequestTargetItem) {
      alert('This item is no longer available.');
      return;
    }
    if (!activeInventoryUserId) {
      alert('Sign in to submit trade requests.');
      return;
    }

    const requestedQty = clampInt(
      Number.parseInt(tradeDraft.requestedQty, 10) || 1,
      1,
      Math.max(1, tradeRequestTargetItem.qty || 1)
    );
    if (requestedQty > (tradeRequestTargetItem.qty || 1)) {
      alert('Requested quantity exceeds available amount.');
      return;
    }

    const offerItemId = normalizeText(tradeDraft.offerItemId);
    const offerQty = clampInt(Number.parseInt(tradeDraft.offerQty, 10) || 1, 1, 9999);
    if (offerItemId) {
      if (!selectedTradeOfferItem) {
        alert('Selected offer item is no longer in your inventory.');
        return;
      }
      if ((selectedTradeOfferItem.qty || 1) < offerQty) {
        alert('Offered quantity exceeds what you own.');
        return;
      }
    }

    const now = new Date().toISOString();
    const newRequest = {
      id: tradeNewId(),
      status: 'pending',
      requestedAt: now,
      requesterUserId: activeInventoryUserId,
      requesterUsername: activeInventoryLabel,
      requesterEmail: currentUserEmail,
      targetOwnerUserId: bagOwnerUserId,
      targetOwnerUsername: bagOwnerLabel,
      partyItemId: tradeRequestTargetItem.id,
      partyItemName: tradeRequestTargetItem.name,
      partyItemCategory: tradeRequestTargetItem.category,
      partyItemRarity: tradeRequestTargetItem.rarity,
      requestedQty,
      offerItemId,
      offerItemName: offerItemId ? selectedTradeOfferItem?.name || '' : '',
      offerQty: offerItemId ? offerQty : 0,
      note: normalizeText(tradeDraft.note),
      decidedAt: '',
      decidedByUserId: '',
      decidedByUsername: '',
      decisionNote: '',
    };

    setBag((prev) => ({
      ...prev,
      tradeRequests: [newRequest, ...normalizeTradeRequests(prev?.tradeRequests, now)],
    }));
    setTradeRequestModalOpen(false);
  };

  const resolveTradeRequest = (requestId, decision) => {
    if (!canEditInventory) {
      alert(inventoryReadOnlyMessage);
      return;
    }

    const normalizedDecision = decision === 'accepted' ? 'accepted' : 'denied';
    const denyNote = normalizedDecision === 'denied'
      ? normalizeText(window.prompt('Optional denial reason:', '') || '')
      : '';
    const now = new Date().toISOString();

    setBag((prev) => {
      const requests = normalizeTradeRequests(prev?.tradeRequests, now);
      const request = requests.find((entry) => entry.id === requestId);
      if (!request || request.status !== 'pending') return prev;

      let finalStatus = normalizedDecision;
      let finalNote = denyNote;
      let nextBagItems = normalizeInventoryItems(prev?.items, now);
      const nextPlayerInventories = normalizePlayerInventories(prev?.playerInventories, now);

      if (normalizedDecision === 'accepted') {
        const requesterUserId = normalizeText(request.requesterUserId);
        if (!requesterUserId) {
          finalStatus = 'denied';
          finalNote = 'Requester account is unavailable.';
        } else {
          const partyItemIndex = nextBagItems.findIndex((entry) => entry.id === request.partyItemId);
          if (partyItemIndex < 0) {
            finalStatus = 'denied';
            finalNote = 'Requested item is no longer in the bag.';
          } else {
            const partyItem = nextBagItems[partyItemIndex];
            const requestedQty = clampInt(Number.parseInt(request.requestedQty, 10) || 1, 1, 9999);
            if ((partyItem.qty || 1) < requestedQty) {
              finalStatus = 'denied';
              finalNote = 'Requested quantity is no longer available.';
            } else {
              const requesterInventory = nextPlayerInventories[requesterUserId] || {
                userId: requesterUserId,
                username: normalizeText(request.requesterUsername),
                attunementLimit: DEFAULT_ATTUNEMENT_LIMIT,
                items: [],
                updatedAt: now,
              };
              let requesterItems = normalizeInventoryItems(requesterInventory.items, now);

              const offerItemId = normalizeText(request.offerItemId);
              let offerItem = null;
              let offerQty = 0;
              if (offerItemId) {
                offerQty = clampInt(Number.parseInt(request.offerQty, 10) || 1, 1, 9999);
                offerItem = requesterItems.find((entry) => entry.id === offerItemId);
                if (!offerItem || (offerItem.qty || 1) < offerQty) {
                  finalStatus = 'denied';
                  finalNote = 'Offered item is no longer available in requester inventory.';
                }
              }

              if (finalStatus === 'accepted') {
                const remainingBagQty = (partyItem.qty || 1) - requestedQty;
                if (remainingBagQty <= 0) {
                  nextBagItems = nextBagItems.filter((entry) => entry.id !== partyItem.id);
                } else {
                  nextBagItems = nextBagItems.map((entry) => (
                    entry.id === partyItem.id
                      ? { ...entry, qty: remainingBagQty, updatedAt: now }
                      : entry
                  ));
                }

                requesterItems = [
                  {
                    ...normalizeInventoryItem(partyItem, now),
                    id: bagNewId(),
                    qty: requestedQty,
                    assignedTo: normalizeText(request.requesterUsername || requesterInventory.username),
                    equipped: false,
                    attuned: false,
                    hidden: false,
                    createdAt: now,
                    updatedAt: now,
                  },
                  ...requesterItems,
                ];

                if (offerItem) {
                  const remainingOfferQty = (offerItem.qty || 1) - offerQty;
                  if (remainingOfferQty <= 0) {
                    requesterItems = requesterItems.filter((entry) => entry.id !== offerItem.id);
                  } else {
                    requesterItems = requesterItems.map((entry) => (
                      entry.id === offerItem.id
                        ? { ...entry, qty: remainingOfferQty, updatedAt: now }
                        : entry
                    ));
                  }

                  nextBagItems = [
                    {
                      ...normalizeInventoryItem(offerItem, now),
                      id: bagNewId(),
                      qty: offerQty,
                      assignedTo: normalizeText(request.requesterUsername || offerItem.assignedTo),
                      equipped: false,
                      attuned: false,
                      hidden: false,
                      createdAt: now,
                      updatedAt: now,
                    },
                    ...nextBagItems,
                  ];
                }

                nextPlayerInventories[requesterUserId] = {
                  ...requesterInventory,
                  userId: requesterUserId,
                  username: normalizeText(requesterInventory.username || request.requesterUsername),
                  updatedAt: now,
                  items: normalizeInventoryItems(requesterItems, now),
                };
              }
            }
          }
        }
      }

      return {
        ...prev,
        items: nextBagItems,
        playerInventories: nextPlayerInventories,
        tradeRequests: requests.map((entry) => (
          entry.id === requestId
            ? {
                ...entry,
                status: finalStatus,
                decidedAt: now,
                decidedByUserId: currentUserId,
                decidedByUsername: normalizeText(profile?.username || bagOwnerLabel || 'Owner'),
                decisionNote: normalizeText(finalNote),
              }
            : entry
        )),
      };
    });
  };
  const applyCurrencyDelta = (key, direction) => {
    if (!ensureInventoryEditPermission()) return;
    const delta = parseInt(currencyDelta[key], 10);
    if (!Number.isFinite(delta) || delta <= 0) return;
    setBag((prev) => ({
      ...prev,
      currency: {
        ...prev.currency,
        [key]: Math.max(0, (prev.currency?.[key] ?? 0) + (direction * delta)),
      },
    }));
    setCurrencyDelta((prev) => ({ ...prev, [key]: '' }));
  };

  const invFilteredItems = useMemo(() => {
    let items = [...(bag.items || [])];
    const q = (invQuery || '').toLowerCase().trim();
    if (q) {
      items = items.filter((it) => {
        const haystack = [
          it.name,
          it.notes,
          it.assignedTo,
          it.weaponProficiency,
          it.weaponHitDc,
          it.weaponAttackType,
          it.weaponReach,
          it.weaponDamage,
          it.weaponDamageType,
          it.weaponProperties,
          it.hidden ? 'hidden' : '',
        ]
          .map((value) => String(value || '').toLowerCase())
          .join(' ');
        return haystack.includes(q);
      });
    }
    if (invCat !== 'All') items = items.filter((it) => (it.category || '') === invCat);
    if (invRar !== 'All') items = items.filter((it) => (it.rarity   || '') === invRar);
    if (invSort === 'qty')     items.sort((a, b) => (b.qty || 0) - (a.qty || 0));
    else if (invSort === 'value')   items.sort((a, b) => (b.value || 0) - (a.value || 0));
    else if (invSort === 'updated') items.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    else items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return items;
  }, [bag.items, invQuery, invCat, invRar, invSort]);

  useEffect(() => {
    if (!invSelectedItemId) return;
    if (invFilteredItems.some((item) => item.id === invSelectedItemId)) return;
    setInvSelectedItemId('');
  }, [invFilteredItems, invSelectedItemId]);
  const isInvDraftWeapon = normalizeItemCategory(invDraft.category) === 'Weapon';
  const selectedQuestAssigneeValue = normalizeText(questDraft.assignedUserId);
  const selectedQuestAssigneeMissing =
    !!selectedQuestAssigneeValue &&
    !assignablePlayers.some((player) => player.userId === selectedQuestAssigneeValue);

  /* =========================
     RENDER
  ========================= */
  return (
    <ShellLayout active={panelType === 'campaign'}>
      <div className={`${styles.scrollWrap} ${styles.glassText}`}>
        <div className={styles.headerSticky}>
          <div className={styles.headerRow}>
            <button
              onClick={() => { cinematicNav('menu'); }}
              className={smallBtnClass('ghost', styles.returnBtn)}
              onMouseEnter={smallBtnHover}
            >
              RETURN
            </button>

            <div className={styles.headerTitleWrap}>
              <div className={styles.headerKicker}>* &nbsp; THE ENVOY'S CIRCLE &nbsp; *</div>
              <h1 className={styles.headerTitle}>PARTY HUB</h1>
            </div>

            <div className={styles.headerSpacer} />
          </div>
          <div className={styles.headerPad} />
        </div>

        <div className={styles.bodyContent}>
          <div className={styles.actionRow}>
            {((campaignTab === 'quests' && canManageQuests) || (campaignTab === 'inventory' && canEditInventory)) && (
              <button
                type="button"
                onMouseEnter={smallBtnHover}
                onClick={() => {
                  if (campaignTab === 'quests') {
                    openAddQuest();
                    return;
                  }
                  invOpenAdd();
                }}
                className={smallBtnClass('gold', styles.actionAddBtn)}
              >
                {campaignTab === 'quests'
                  ? '+ Add Quest'
                  : '+ Add Item'}
              </button>
            )}
          </div>

          <div className={styles.tabRow}>
            {[
              { key: 'launcher', label: 'Hub' },
              { key: 'quests', label: 'Quest Board' },
              { key: 'inventory', label: 'Party Inventory' },
              { key: 'trading', label: 'Trading Center' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onMouseEnter={smallBtnHover}
                onClick={() => setCampaignTab(key)}
                className={tabButtonClass(campaignTab === key)}
              >
                {label}
              </button>
            ))}
          </div>
          {/* ========== HUB ========== */}
          {campaignTab === 'launcher' && (
            <div className={styles.questBoardStack}>
              <div className={`${styles.questBoardFrame} ${styles.hubBoardFrame}`}>
                <div className={`${styles.questBoardBanner} ${styles.hubBoardBanner}`}>
                  <div className={styles.hubBoardHeading}>
                    <div className={styles.questBoardEyebrow}>Guild Services</div>
                    <div className={styles.questBoardTitle}>Party Hub Board</div>
                    <div className={styles.questBoardSub}>Session tools, launch links, and records for the whole crew.</div>
                  </div>
                  <div className={styles.hubBannerTimer}>
                    <div className={styles.hubBannerTimerValue}>{fmtElapsed(displayedElapsedMs)}</div>
                    <div className={styles.hubBannerTimerActions}>
                      <button
                        className={smallBtnClass(launcherState.timerRunning ? 'danger' : 'gold', styles.hubBannerTimerBtn)}
                        onMouseEnter={smallBtnHover}
                        onClick={toggleSessionTimer}
                      >
                        {launcherState.timerRunning ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        className={smallBtnClass('danger', styles.hubBannerTimerBtn)}
                        onMouseEnter={smallBtnHover}
                        onClick={resetSessionTimer}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  <div className={styles.hubBannerStatusWrap}>
                    <span className={styles.boardStatusPill}>Hub Active</span>
                  </div>
                </div>

                <div
                  className={`${styles.softCard} ${styles.boardNoteCard} ${styles.hubTimeCard} ${styles.hubTimeTopCard}`}
                  style={{
                    '--hub-time-progress': hubTimeProgress.toFixed(4),
                    '--hub-time-sky-left': hubTimeSky.left,
                    '--hub-time-sky-mid': hubTimeSky.mid,
                    '--hub-time-sky-right': hubTimeSky.right,
                    '--hub-time-glow-alpha': hubTimeSky.glow.toFixed(4),
                    '--hub-time-stars-alpha': hubTimeSky.stars.toFixed(4),
                    '--hub-time-stars-dense-alpha': hubTimeSky.starsDense.toFixed(4),
                  }}
                >
                  <div className={styles.hubTimeHeader}>
                    <div className={styles.blockTitle}>World Time</div>
                  </div>
                  <div
                    className={styles.hubTimeDial}
                    style={{
                      '--hub-time-needle-angle': `${hubTimeNeedleAngle}deg`,
                    }}
                  >
                    <div className={styles.hubTimeDialSky} />
                    <div className={styles.hubTimeDialGlow} />
                    <div className={styles.hubTimeDialStars} />
                    <div className={styles.hubTimeDialStarsDense} />
                    <div className={styles.hubTimeDialArc} />
                    <div className={styles.hubTimeDialTicks} />
                    <div className={styles.hubTimeDialNeedle}>
                      <span className={styles.hubTimeDialNeedleTip} />
                    </div>
                    <div className={`${styles.hubTimeDialIcon} ${styles.hubTimeDialSun}`} aria-hidden="true">☀</div>
                    <div className={`${styles.hubTimeDialIcon} ${styles.hubTimeDialMoon}`} aria-hidden="true">☾</div>
                    <div className={styles.hubTimeDialCenter}>
                      <div className={styles.hubTimeDialCenterLabel}>Current</div>
                      <div className={styles.hubTimeDialCenterValue}>{hubTimeValue}</div>
                    </div>
                  </div>
                  <div className={styles.hubTimeControls}>
                    <input
                      type="range"
                      min={0}
                      max={HUB_TIME_OPTIONS.length - 1}
                      step={1}
                      value={hubTimeIndex}
                      onChange={(e) => setHubTimeOfDay(HUB_TIME_OPTIONS[Number(e.target.value)] || HUB_TIME_OPTIONS[1])}
                      disabled={!canManageHubTime}
                      className={styles.hubSlider}
                    />
                  </div>
                </div>

                <div className={styles.hubQuickRow}>
                  <div className={`${styles.softCard} ${styles.boardNoteCard} ${styles.hubTile} ${styles.hubTileMain} ${styles.hubTileCentered}`} onMouseEnter={() => playHover()}>
                    <div className={styles.hubSharedToolsHeader}>
                      <div className={`${styles.iconRow} ${styles.hubTileHeaderRow}`}>
                        <div className={styles.toolIcon}>
                          <img src={watchPartyLogo} alt="Watch Party logo" className={styles.toolLogo} />
                        </div>
                        <div className={styles.toolTitle}>Watch Party</div>
                      </div>
                      <div className={`${styles.iconRow} ${styles.hubTileHeaderRow}`}>
                        <div className={styles.toolIcon}>
                          <img src={owlbearLogo} alt="Owlbear logo" className={styles.toolLogo} />
                        </div>
                        <div className={styles.toolTitle}>Owlbear Table</div>
                      </div>
                      <div className={styles.toolSub}>Music / Videos / Maps / Tokens</div>
                    </div>
                    <div className={styles.hubTileActions}>
                      <button className={smallBtnClass('gold')} onMouseEnter={smallBtnHover} onClick={() => openTool('watch')}>Watch Room</button>
                      <button className={smallBtnClass('ghost')} onMouseEnter={smallBtnHover} onClick={() => openTool('owlbear')}>Owlbear Room</button>
                    </div>
                  </div>

                  <div className={`${styles.softCard} ${styles.boardNoteCard} ${styles.hubTile} ${styles.hubTileMain} ${styles.hubTileCentered}`} onMouseEnter={() => playHover()}>
                    <div className={styles.iconRow}>
                      <div>
                        <div className={styles.toolTitle}>My Character Sheet</div>
                        <div className={styles.toolSub}>Quick access to your sheet in Combat Tracker.</div>
                      </div>
                    </div>
                    <div className={styles.hubTileActions}>
                      <button
                        className={smallBtnClass('gold', styles.hubCharacterSheetBtn)}
                        onMouseEnter={smallBtnHover}
                        onClick={() => {
                          playNav();
                          if (typeof openCombatCharacterSheetPopout === 'function') {
                            openCombatCharacterSheetPopout();
                            return;
                          }
                          cinematicNav('combat');
                        }}
                      >
                        {`${activeInventoryPossessiveLabel} Character Sheet`}
                      </button>
                    </div>
                  </div>

                  <div className={`${styles.softCard} ${styles.boardNoteCard} ${styles.hubTile} ${styles.hubTileCentered}`} onMouseEnter={() => playHover()}>
                    <div className={styles.iconRow}>
                      <div>
                        <div className={styles.toolTitle}>Players</div>
                        <div className={styles.toolSub}>{onlinePlayerCount} online · {awayPlayerCount} away</div>
                      </div>
                    </div>
                    <div className={styles.hubTileMeta}>
                      {presenceConnected ? 'Realtime connected' : 'Using fallback status'}
                    </div>
                    <div className={styles.hubTileActions}>
                      <button className={smallBtnClass('gold')} onMouseEnter={smallBtnHover} onClick={() => setPlayerPresenceOpen(true)}>Open Presence</button>
                    </div>
                  </div>
                </div>

                <div className={styles.hubNotesRecapRow}>
                  <div className={`${styles.softCard} ${styles.boardNoteCard}`}>
                    <div>
                      <div className={styles.blockTitle}>Session Notes</div>
                      <div className={styles.blockSub}>Saved privately to your account.</div>
                    </div>
                    <textarea
                      value={launcherNotes || ''}
                      onChange={(e) => setLauncherNotes(e.target.value)}
                      placeholder={`- NPC:\n- Hook:\n- Loot:\n- Reminder:`}
                      rows={8}
                      className={`${styles.inputBase} ${styles.textarea}`}
                    />
                  </div>

                  <div className={`${styles.softCard} ${styles.boardNoteCard} ${styles.hubRecapAccordion}`}>
                    <div className={styles.hubRecapHeader}>
                      <div>
                        <div className={styles.blockTitle}>Recap</div>
                        <div className={styles.blockSub}>Session summary and key beats.</div>
                      </div>
                      <button
                        type="button"
                        className={smallBtnClass('ghost')}
                        onMouseEnter={smallBtnHover}
                        onClick={() => setRecapOpen((prev) => !prev)}
                      >
                        {recapOpen ? 'Collapse' : 'Expand'}
                      </button>
                    </div>
                    {recapOpen && (
                      <div className={styles.hubRecapBody}>
                        <textarea
                          value={launcherState.recap || ''}
                          onChange={(e) => setLauncherState((s) => ({ ...s, recap: e.target.value }))}
                          placeholder="Last time, the party..."
                          rows={8}
                          className={`${styles.inputBase} ${styles.textarea}`}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {showCloudPrepBackup && (
                  <div className={`${styles.softCard} ${styles.boardNoteCard} ${styles.hubBackupCard}`}>
                    <div>
                      <div className={styles.blockTitle}>Cloud Prep Backup</div>
                      <div className={styles.blockSub}>Backup/restore local data and run one-time cloud seed as owner/DM.</div>
                    </div>
                    <div className={styles.toolActions}>
                      <button
                        className={smallBtnClass('gold')}
                        onMouseEnter={smallBtnHover}
                        onClick={exportBackup}
                        disabled={backupBusy || seedBusy}
                      >
                        Download Backup
                      </button>
                      <button
                        className={smallBtnClass('ghost')}
                        onMouseEnter={smallBtnHover}
                        onClick={openRestorePicker}
                        disabled={backupBusy || seedBusy}
                      >
                        Restore Backup
                      </button>
                      {canSeedCloud && (
                        <button
                          className={smallBtnClass('gold')}
                          onMouseEnter={smallBtnHover}
                          onClick={seedCloudFromThisDevice}
                          disabled={backupBusy || seedBusy}
                        >
                          {seedBusy ? 'Seeding...' : 'Seed Cloud Once'}
                        </button>
                      )}
                    </div>
                    <input
                      ref={backupFileRef}
                      type="file"
                      accept="application/json"
                      className={styles.hiddenFileInput}
                      onChange={onBackupPicked}
                    />
                    <div className={styles.backupHint}>
                      Each person should download their own backup from their own device/browser profile.
                      {usingSupabase && (
                        <>
                          {' '}
                          Sync: {cloudPendingWrites ? `${cloudPendingWrites} pending write(s)` : 'up to date'}.
                        </>
                      )}
                    </div>
                    {cloudError && <div className={styles.backupStatus}>Cloud sync warning: {cloudError}</div>}
                    {backupStatus && <div className={styles.backupStatus}>{backupStatus}</div>}
                  </div>
                )}
              </div>
            </div>
          )}

          {playerPresenceOpen && (
            <div className={styles.modalOverlay}>
              <div className={`${styles.modalCard} ${styles.presenceModal}`}>
                <div className={styles.modalHeader}>
                  <div className={styles.modalTitle}>Player Presence</div>
                  <button className={smallBtnClass('danger')} onMouseEnter={smallBtnHover} onClick={() => setPlayerPresenceOpen(false)}>Close</button>
                </div>
                <div className={styles.sectionDivider} />
                <div className={styles.modalBody}>
                  <div className={styles.presenceTopMeta}>
                    <span>{presenceConnected ? 'Realtime connected' : 'Using fallback status'}</span>
                    <span>{onlinePlayerCount} online · {awayPlayerCount} away</span>
                  </div>
                  <div className={styles.presenceList}>
                    {playerDirectoryLoading && (
                      <div className={styles.modalHint}>Loading player directory...</div>
                    )}
                    {!playerDirectoryLoading && playerPresenceMembers.length === 0 && (
                      <div className={styles.modalHint}>No players found for this campaign yet.</div>
                    )}
                    {playerPresenceMembers.map((member) => (
                      <div key={member.key} className={styles.presenceRow}>
                        <div className={styles.presenceIdentity}>
                          <span
                            className={`${styles.statusDot} ${member.status === 'online'
                              ? styles.statusOnline
                              : member.status === 'away'
                                ? styles.statusAway
                                : styles.statusOffline}`}
                          />
                          <div>
                            <div className={styles.presenceName}>{member.label}</div>
                            <div className={styles.presenceState}>{member.status}</div>
                          </div>
                        </div>
                        <div className={styles.presenceActions}>
                          <span
                            className={`${styles.presenceBadge} ${member.status === 'online'
                              ? styles.presenceBadgeOnline
                              : member.status === 'away'
                                ? styles.presenceBadgeAway
                                : styles.presenceBadgeOffline}`}
                          >
                            {member.status === 'online' ? 'Connected' : member.status === 'away' ? 'Away' : 'Offline'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========== QUEST BOARD ========== */}
          {campaignTab === 'quests' && (
            <div className={styles.questBoardStack}>
              <div className={`${styles.questBoardFrame} ${showingPersonalQuestBoard ? styles.questBoardFramePersonal : styles.questBoardFrameParty}`}>
                <div className={styles.questBoardBanner}>
                  <div>
                    <div className={styles.questBoardEyebrow}>Pinned Notices</div>
                    <div className={styles.questBoardTitle}>{displayedBoardTitle}</div>
                    <div className={styles.questBoardSub}>{displayedBoardSub}</div>
                  </div>

                  <div className={styles.questBoardToggleWrap}>
                    <div className={styles.questBoardToggleLabel}>Board View</div>
                    <div className={styles.questBoardToggle} role="group" aria-label="Quest board view">
                      <span
                        aria-hidden="true"
                        className={`${styles.questBoardToggleThumb}${showingPersonalQuestBoard ? ` ${styles.questBoardToggleThumbPersonal}` : ''}`}
                      />
                      <button
                        type="button"
                        onMouseEnter={smallBtnHover}
                        onClick={() => setQuestBoardView('party')}
                        className={`${styles.questBoardToggleBtn}${!showingPersonalQuestBoard ? ` ${styles.questBoardToggleBtnActive}` : ''}`}
                        aria-pressed={!showingPersonalQuestBoard}
                      >
                        Party
                      </button>
                      <button
                        type="button"
                        onMouseEnter={smallBtnHover}
                        onClick={() => setQuestBoardView('personal')}
                        className={`${styles.questBoardToggleBtn}${showingPersonalQuestBoard ? ` ${styles.questBoardToggleBtnActive}` : ''}`}
                        aria-pressed={showingPersonalQuestBoard}
                      >
                        Personal
                      </button>
                    </div>
                  </div>
                </div>

                <div className={styles.questGrid}>
                  <div className={styles.questColumn}>
                    <div className={styles.sectionHeader}>
                      <div className={styles.sectionHeaderTitle}>Active Quests</div>
                      <div className={styles.sectionHeaderCount}>{displayedActiveQuests.length} active</div>
                    </div>
                    <div className={styles.listCol}>
                      {displayedActiveQuests.length === 0 ? (
                        <div className={`${styles.softCard} ${styles.softCardMuted} ${styles.questNoticeCard} ${styles.questEmptyCard}`}>
                          <div className={styles.blockTitle}>{displayedEmptyActiveTitle}</div>
                          <div className={styles.bodyCopy}>{displayedEmptyActiveBody}</div>
                        </div>
                      ) : (
                        displayedActiveQuests.map((q) => (
                          <div key={q.id} className={`${styles.softCard} ${styles.questNoticeCard}`} onMouseEnter={() => playHover()}>
                            <div className={styles.questRow}>
                              <div className={styles.questBody}>
                                <div className={styles.questTitleRow}>
                                  <div className={styles.questTitle}>{q.title}</div>
                                  <span className={pillClass(q.type)}>{q.type}</span>
                                </div>
                                {showingPersonalQuestBoard && (
                                  <div className={styles.questMeta}>
                                    <div><strong>Assigned:</strong> {questAssigneeLabel(q)}</div>
                                  </div>
                                )}
                                {(q.giver || q.location) && (
                                  <div className={styles.questMeta}>
                                    {q.giver && <div><strong>Giver:</strong> {q.giver}</div>}
                                    {q.location && <div><strong>Location:</strong> {q.location}</div>}
                                  </div>
                                )}
                                {q.description && <div className={styles.questDesc}>{q.description}</div>}
                              </div>
                              {canManageQuests && (
                                <div className={styles.actionsRow}>
                                  <button className={smallBtnClass('gold')} onMouseEnter={smallBtnHover} onClick={() => openEditQuest(q)}>Edit</button>
                                  <button className={smallBtnClass('gold')} onMouseEnter={smallBtnHover} onClick={() => completeQuest(q.id)}>Complete</button>
                                  <button className={smallBtnClass('danger')} onMouseEnter={smallBtnHover} onClick={() => deleteQuest(q.id)}>Delete</button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className={styles.questColumn}>
                    <div className={styles.sectionHeader}>
                      <div className={styles.sectionHeaderTitle}>Completed</div>
                      <div className={styles.sectionHeaderCount}>{displayedCompletedQuests.length} done</div>
                    </div>
                    <div className={styles.listCol}>
                      {displayedCompletedQuests.length === 0 ? (
                        <div className={`${styles.softCard} ${styles.softCardMuted} ${styles.questNoticeCard} ${styles.questEmptyCard}`}>
                          <div className={styles.blockTitle}>{displayedEmptyCompletedTitle}</div>
                          <div className={styles.bodyCopy}>{displayedEmptyCompletedBody}</div>
                        </div>
                      ) : (
                        displayedCompletedQuests.map((q) => (
                          <div key={q.id} className={`${styles.softCard} ${styles.completedCard} ${styles.questNoticeCard} ${styles.questNoticeCompleted}`} onMouseEnter={() => playHover()}>
                            <div className={styles.questRow}>
                              <div className={styles.questBody}>
                                <div className={styles.questTitleRow}>
                                  <div className={`${styles.questTitle} ${styles.questTitleDone}`}>{q.title}</div>
                                  <span className={pillClass(q.type)}>{q.type}</span>
                                </div>
                                {showingPersonalQuestBoard && (
                                  <div className={`${styles.questMeta} ${styles.questMetaMuted}`}>
                                    <div><strong>Assigned:</strong> {questAssigneeLabel(q)}</div>
                                  </div>
                                )}
                                {(q.giver || q.location) && (
                                  <div className={`${styles.questMeta} ${styles.questMetaMuted}`}>
                                    {q.giver && <div><strong>Giver:</strong> {q.giver}</div>}
                                    {q.location && <div><strong>Location:</strong> {q.location}</div>}
                                  </div>
                                )}
                                {q.description && <div className={`${styles.questDesc} ${styles.questMetaMuted}`}>{q.description}</div>}
                              </div>
                              {canManageQuests && (
                                <div className={styles.actionsRow}>
                                  <button className={smallBtnClass('gold')} onMouseEnter={smallBtnHover} onClick={() => reopenQuest(q.id)}>Reopen</button>
                                  <button className={smallBtnClass('danger')} onMouseEnter={smallBtnHover} onClick={() => deleteQuest(q.id)}>Delete</button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========== INVENTORY (Bag of Holding) ========== */}
          {campaignTab === 'inventory' && (
            <div className={styles.questBoardStack}>
              <div className={`${styles.questBoardFrame} ${styles.inventoryBoardFrame}`}>
                <div className={styles.questBoardBanner}>
                  <div>
                    <div className={styles.questBoardEyebrow}>Supply Ledger</div>
                    <div className={styles.questBoardTitle}>Party Inventory Board</div>
                    <div className={styles.questBoardSub}>Track shared loot, valuables, and artifacts across the campaign.</div>
                  </div>
                  <span className={styles.boardStatusPill}>
                    {canEditInventory ? 'DM / Owner Edit' : 'Read Only'}
                  </span>
                </div>

                <div className={styles.inventoryGrid}>
                  <div className={styles.inventoryControls}>
                    <div className={`${styles.softCard} ${styles.boardNoteCard}`}>
                      <div className={styles.cardHeaderRow}>
                        <div>
                          <div className={styles.cardTitle}>Bag of Holding</div>
                          <div className={styles.cardSub}>Shared party inventory - loot, gold totals, quest items, and artifacts.</div>
                          <div className={styles.modalHint}>Current Owner: <strong>{bagOwnerLabel}</strong></div>
                          <div className={styles.modalHint}>
                            Pending trade requests: <strong>{pendingTradeRequests.length}</strong>
                          </div>
                          {!canEditInventory && (
                            <div className={styles.modalHint}>{inventoryReadOnlyMessage}</div>
                          )}
                        </div>
                      </div>
                      <div className={styles.sectionDivider} />

                      <div className={styles.filtersGrid}>
                        <div>
                          <div className={styles.inputLabel}>Search</div>
                          <input value={invQuery} onChange={(e) => setInvQuery(e.target.value)} placeholder="name, notes..." className={styles.inputBase} />
                        </div>
                        <div>
                          <div className={styles.inputLabel}>Category</div>
                          <select value={invCat} onChange={(e) => setInvCat(e.target.value)} className={styles.inputBase}>
                            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <div className={styles.inputLabel}>Rarity</div>
                          <select value={invRar} onChange={(e) => setInvRar(e.target.value)} className={styles.inputBase}>
                            {RARITIES.map((r) => <option key={r}>{r}</option>)}
                          </select>
                        </div>
                        <div>
                          <div className={styles.inputLabel}>Sort</div>
                          <select value={invSort} onChange={(e) => setInvSort(e.target.value)} className={styles.inputBase}>
                            <option value="name">Name</option>
                            <option value="qty">Quantity</option>
                            <option value="value">Value</option>
                            <option value="updated">Recently Updated</option>
                          </select>
                        </div>
                      </div>

                      <div className={styles.controlsFooter}>
                        {canTransferBagOwnership && inventoryOwnerChoices.length > 0 && (
                          <div className={styles.inventoryOwnerControls}>
                            <select
                              value={bagTransferTargetUserId}
                              onChange={(e) => setBagTransferTargetUserId(e.target.value)}
                              className={styles.inputBase}
                            >
                              <option value="">Transfer control to...</option>
                              {inventoryOwnerChoices.map((player) => (
                                <option key={player.userId} value={player.userId}>
                                  {player.label}
                                </option>
                              ))}
                            </select>
                            <button
                              className={smallBtnClass('ghost')}
                              onMouseEnter={smallBtnHover}
                              onClick={transferBagOwnership}
                              disabled={!bagTransferTargetUserId}
                            >
                              Transfer
                            </button>
                          </div>
                        )}
                        {(canEditInventory || canSubmitTradeRequests) && (
                          <button
                            className={smallBtnClass('ghost')}
                            onMouseEnter={smallBtnHover}
                            onClick={() => setTradeCenterOpen(true)}
                          >
                            {canEditInventory
                              ? `Trade Requests (${pendingTradeRequests.length})`
                              : `My Requests (${myPendingTradeCount})`}
                          </button>
                        )}
                        {canEditInventory && (
                          <button
                            className={smallBtnClass('gold', styles.addItemBtn)}
                            onMouseEnter={smallBtnHover}
                            onClick={invOpenAdd}
                          >
                            + Add Item
                          </button>
                        )}
                      </div>
                    </div>

                    <div className={`${styles.softCard} ${styles.currencyCard} ${styles.boardNoteCard}`}>
                      <div className={styles.cardHeaderRow}>
                        <div>
                          <div className={styles.currencyTitle}>Currency</div>
                          <div className={styles.currencySub}>
                            <span className={`${styles.currencyToken} ${styles.currencyTokenPP}`}>
                              <span className={styles.currencySubValue}>{bag.currency?.pp ?? 0}</span> PP
                            </span>
                            <span className={styles.currencySep}> / </span>
                            <span className={`${styles.currencyToken} ${styles.currencyTokenGP}`}>
                              <span className={styles.currencySubValue}>{bag.currency?.gp ?? 0}</span> GP
                            </span>
                            <span className={styles.currencySep}> / </span>
                            <span className={`${styles.currencyToken} ${styles.currencyTokenSP}`}>
                              <span className={styles.currencySubValue}>{bag.currency?.sp ?? 0}</span> SP
                            </span>
                            <span className={styles.currencySep}> / </span>
                            <span className={`${styles.currencyToken} ${styles.currencyTokenCP}`}>
                              <span className={styles.currencySubValue}>{bag.currency?.cp ?? 0}</span> CP
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className={`${styles.sectionDivider} ${styles.sectionDividerTight}`} />
                      <div className={styles.currencyGrid}>
                        {['pp', 'gp', 'sp', 'cp'].map((k) => (
                          <div key={k} className={styles.currencyCell}>
                            <div className={styles.currencyHead}>
                              <div className={styles.currencyCodeLabel}>{k.toUpperCase()}</div>
                            </div>
                            <div className={styles.currencyAdjustRow}>
                              <button
                                type="button"
                                className={`${styles.smallBtn} ${styles.btnGhost} ${styles.currencyStepBtn}`}
                                onMouseEnter={smallBtnHover}
                                onClick={() => applyCurrencyDelta(k, -1)}
                                disabled={!canEditInventory}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={1}
                                value={currencyDelta[k]}
                                onChange={(e) => setCurrencyDelta((prev) => ({ ...prev, [k]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    applyCurrencyDelta(k, 1);
                                  }
                                }}
                                placeholder="Amt"
                                className={styles.tinyInput}
                              />
                              <button
                                type="button"
                                className={`${styles.smallBtn} ${styles.btnGold} ${styles.currencyStepBtn}`}
                                onMouseEnter={smallBtnHover}
                                onClick={() => applyCurrencyDelta(k, 1)}
                                disabled={!canEditInventory}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className={styles.currencyDanger}>
                        <button
                          className={smallBtnClass('ghost', styles.fullWidthBtn)}
                          onMouseEnter={smallBtnHover}
                          onClick={() => setDangerOpen((v) => !v)}
                          disabled={!canEditInventory}
                        >
                          {dangerOpen ? 'Hide Danger' : 'Danger Zone'}
                        </button>
                        {dangerOpen && (
                          <div className={styles.dangerBox}>
                            <div className={styles.dangerTitle}>Clear Bag</div>
                            <div className={styles.dangerBody}>This removes <strong>all</strong> items and currency.</div>
                            <button
                              className={smallBtnClass('danger', styles.fullWidthBtn)}
                              onMouseEnter={smallBtnHover}
                              onClick={() => {
                                if (!ensureInventoryEditPermission()) return;
                                const ok = confirm('Clear the entire Bag of Holding? This cannot be undone.');
                                if (!ok) return;
                                setBag((prev) => ({
                                  ...prev,
                                  currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
                                  items: [],
                                }));
                                setDangerOpen(false);
                              }}
                              disabled={!canEditInventory}
                            >
                              Clear Bag Forever
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {invFilteredItems.length === 0 ? (
                    <div className={`${styles.softCard} ${styles.inventoryEmpty} ${styles.boardNoteCard} ${styles.questEmptyCard}`}>
                      <div className={styles.inventoryEmptyTitle}>Bag is empty.</div>
                      <div className={styles.bodyCopy}>Hit <strong>+ Add Item</strong> to start tracking loot.</div>
                    </div>
                  ) : (
                    <div className={styles.listCol}>
                      {invFilteredItems.map((it) => {
                        const detailsVisible = invSelectedItemId === it.id;
                        const isWeaponItem = normalizeItemCategory(it.category) === 'Weapon';
                        const weaponDetailRows = [
                          { label: 'Proficient', value: normalizeText(it.weaponProficiency) },
                          { label: 'Hit / DC', value: normalizeText(it.weaponHitDc || it.hitDc) },
                          { label: 'Attack Type', value: normalizeText(it.weaponAttackType) },
                          { label: 'Reach', value: normalizeText(it.weaponReach) },
                          { label: 'Damage', value: normalizeText(it.weaponDamage) },
                          { label: 'Damage Type', value: normalizeText(it.weaponDamageType) },
                          { label: 'Weight', value: it.weight != null ? `${it.weight} lb` : '' },
                          { label: 'Cost', value: it.value != null ? `${it.value} gp` : '' },
                          { label: 'Properties', value: normalizeText(it.weaponProperties) },
                        ].filter((entry) => !!entry.value);
                        return (
                          <div
                            key={it.id}
                            className={`${styles.softCard} ${styles.inventoryItemCard} ${styles.boardNoteCard} ${styles.inventoryItemCardClickable} ${detailsVisible ? styles.inventoryItemCardSelected : ''}`}
                            style={{ '--ch-rarity-bg': rarityBadge(it.rarity) }}
                            onMouseEnter={() => playHover()}
                            onClick={() => handleInventoryCardSelect(it)}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter' && e.key !== ' ') return;
                              e.preventDefault();
                              handleInventoryCardSelect(it);
                            }}
                            role="button"
                            tabIndex={0}
                            aria-expanded={detailsVisible}
                          >
                            <div className={styles.questRow}>
                              <div className={styles.itemBody}>
                                <div className={styles.questTitleRow}>
                                  <div className={styles.itemTitle}>{it.name}</div>
                                  {it.equipped && <span className={`${styles.pill} ${styles.pillMain} ${styles.pillTiny}`}>Equipped</span>}
                                  <span className={styles.itemMetaInline}>{it.rarity} - {it.category}</span>
                                </div>
                                {detailsVisible && isWeaponItem && weaponDetailRows.length > 0 && (
                                  <div className={styles.itemWeaponStats}>
                                    {weaponDetailRows.map((entry) => (
                                      <div key={`${it.id}-${entry.label}`} className={styles.itemWeaponStatRow}>
                                        <span className={styles.itemWeaponStatLabel}>{entry.label}:</span>
                                        <span>{entry.value}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {detailsVisible && it.notes && <div className={styles.itemNotes}>{it.notes}</div>}
                                {detailsVisible && (
                                  <div className={styles.itemStats}>
                                    {it.assignedTo && <span>By: {it.assignedTo}</span>}
                                    {!isWeaponItem && it.value != null && <span>Value: {it.value} gp</span>}
                                    {!isWeaponItem && it.weight != null && <span>Wt: {it.weight} lb</span>}
                                  </div>
                                )}
                              </div>
                              <div className={styles.actionsRow} onClick={(e) => e.stopPropagation()}>
                                <span className={styles.qtyBadge}>x{it.qty ?? 1}</span>
                                {canEditInventory ? (
                                  <>
                                    <button className={smallBtnClass('ghost')} onMouseEnter={smallBtnHover} onClick={(e) => { e.stopPropagation(); invBumpQty(it.id, -1); }} title="-1">-</button>
                                    <button className={smallBtnClass('ghost')} onMouseEnter={smallBtnHover} onClick={(e) => { e.stopPropagation(); invBumpQty(it.id, +1); }} title="+1">+</button>
                                    <button className={smallBtnClass('ghost')} onMouseEnter={smallBtnHover} onClick={(e) => { e.stopPropagation(); invToggleEquipped(it.id); }}>Equip</button>
                                    <button className={smallBtnClass('danger')} onMouseEnter={smallBtnHover} onClick={(e) => { e.stopPropagation(); invDeleteItem(it.id); }}>Delete</button>
                                  </>
                                ) : (
                                  <button
                                    className={smallBtnClass('gold')}
                                    onMouseEnter={smallBtnHover}
                                    onClick={(e) => { e.stopPropagation(); openTradeRequestForItem(it); }}
                                    disabled={!canSubmitTradeRequests}
                                  >
                                    Request
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {campaignTab === 'trading' && (
            <div className={styles.questBoardStack}>
              <div className={`${styles.questBoardFrame} ${styles.inventoryBoardFrame}`}>
                <div className={styles.questBoardBanner}>
                  <div>
                    <div className={styles.questBoardEyebrow}>Supply Ledger</div>
                    <div className={styles.questBoardTitle}>Trading Center</div>
                    <div className={styles.questBoardSub}>Browse inventories, hide private items, and open player-to-player trades.</div>
                  </div>
                  <span className={styles.boardStatusPill}>Player Trading</span>
                </div>

                <div className={styles.inventoryGrid}>
                  <div className={`${styles.softCard} ${styles.boardNoteCard} ${styles.personalInventoryCard}`}>
                    <div className={styles.cardHeaderRow}>
                      <div>
                        <div className={styles.cardTitle}>Player Inventories</div>
                        <div className={styles.cardSub}>Choose a player, inspect visible inventory, and open trade windows.</div>
                        <div className={styles.modalHint}>Viewing: <strong>{viewedInventoryLabel}</strong></div>
                      </div>
                      <div className={styles.actionsRow}>
                        <button
                          className={smallBtnClass('ghost')}
                          onMouseEnter={smallBtnHover}
                          onClick={openPlayerTradeCenter}
                          disabled={!canManagePlayerTrade}
                        >
                          Trade Requests ({playerTradeSessions.filter((entry) => entry.status === 'open').length})
                        </button>
                      </div>
                    </div>
                    <div className={styles.sectionDivider} />
                    <div className={styles.filtersGrid}>
                      <div className={styles.fullCol}>
                        <div className={styles.inputLabel}>Inventory View</div>
                        <select
                          value={inventoryViewerUserId || activeInventoryUserId || ''}
                          onChange={(e) => setInventoryViewerUserId(e.target.value)}
                          className={styles.inputBase}
                        >
                          {tradingPlayerOptions.map((player) => (
                            <option key={`view-inventory-${player.userId}`} value={player.userId}>
                              {player.userId === activeInventoryUserId ? 'My Inventory' : `${player.label}'s Inventory`}
                            </option>
                          ))}
                        </select>
                        {!viewerIsSelf && (
                          <div className={styles.modalHint}>Items marked hidden will not appear when viewing another player.</div>
                        )}
                      </div>
                    </div>
                    {viewedInventoryItems.length === 0 ? (
                      <div className={styles.modalHint}>
                        {viewerIsSelf
                          ? 'No personal items tracked yet. Manage inventory from your Character Sheet inventory modal.'
                          : `No visible items in ${viewedInventoryLabel}'s inventory.`}
                      </div>
                    ) : (
                      <div className={styles.personalInventoryList}>
                        {viewedInventoryItems.map((item) => (
                          <div
                            key={item.id}
                            className={`${styles.personalInventoryRow} ${styles.personalInventoryRowClickable} ${personalInventoryDetailItemId === item.id ? styles.personalInventoryRowSelected : ''}`}
                            onClick={() => openPersonalInventoryDetail(item)}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter' && e.key !== ' ') return;
                              e.preventDefault();
                              openPersonalInventoryDetail(item);
                            }}
                            role="button"
                            tabIndex={0}
                            aria-label={`View details for ${item.name || 'item'}`}
                          >
                            <div className={styles.personalInventoryMeta}>
                              <div className={styles.personalInventoryNameRow}>
                                <div className={styles.personalInventoryName}>{item.name}</div>
                                {item.equipped && <span className={`${styles.pill} ${styles.pillMain} ${styles.pillTiny}`}>Equipped</span>}
                                {!!item.attuned && <span className={`${styles.pill} ${styles.pillMain} ${styles.pillTiny}`}>Attuned</span>}
                                {viewerIsSelf && !!item.hidden && <span className={`${styles.pill} ${styles.pillSide} ${styles.pillTiny}`}>Hidden</span>}
                              </div>
                              <div className={styles.personalInventorySub}>{item.rarity} - {item.category}</div>
                            </div>
                            <div className={styles.actionsRow} onClick={(e) => e.stopPropagation()}>
                              <span className={styles.qtyBadge}>x{item.qty ?? 1}</span>
                              {viewerIsSelf ? (
                                <>
                                  <label className={styles.checkboxRow}>
                                    <input
                                      type="checkbox"
                                      checked={!!item.attuned}
                                      onChange={() => invTogglePersonalAttuned(item.id)}
                                      disabled={!canEditPersonalInventory}
                                    />
                                    <span className={styles.checkboxLabel}>Attune</span>
                                  </label>
                                  <label className={styles.checkboxRow}>
                                    <input
                                      type="checkbox"
                                      checked={!!item.hidden}
                                      onChange={() => invTogglePersonalHidden(item.id)}
                                      disabled={!canEditPersonalInventory}
                                    />
                                    <span className={styles.checkboxLabel}>Hide</span>
                                  </label>
                                </>
                              ) : (
                                <button
                                  className={smallBtnClass('gold')}
                                  onMouseEnter={smallBtnHover}
                                  onClick={() => openTradeFromViewedInventoryItem(item)}
                                  disabled={!canManagePlayerTrade}
                                >
                                  Request Trade
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>{/* end body content */}

        {personalInventoryDetailItem && (
          <div
            className={`${styles.modalOverlay} ${styles.modalOverlayTop} ${styles.personalInventoryLightboxOverlay}`}
            onClick={closePersonalInventoryDetail}
          >
            <div
              className={`${styles.modalCard} ${styles.personalInventoryLightboxCard}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <div>
                  <div className={styles.modalTitle}>{personalInventoryDetailItem.name || 'Item Details'}</div>
                  <div className={styles.personalInventoryLightboxSub}>
                    {viewedInventoryLabel} • {personalInventoryDetailItem.rarity} - {personalInventoryDetailItem.category}
                  </div>
                </div>
                <button
                  className={smallBtnClass('danger')}
                  onMouseEnter={smallBtnHover}
                  onClick={closePersonalInventoryDetail}
                >
                  Close
                </button>
              </div>
              <div className={styles.sectionDivider} />
              <div className={`${styles.modalBody} ${styles.personalInventoryLightboxBody}`}>
                <div className={styles.personalInventoryLightboxSummary}>
                  <span className={styles.qtyBadge}>x{personalInventoryDetailItem.qty ?? 1}</span>
                  {personalInventoryDetailItem.equipped && <span className={`${styles.pill} ${styles.pillMain} ${styles.pillTiny}`}>Equipped</span>}
                  {!!personalInventoryDetailItem.attuned && <span className={`${styles.pill} ${styles.pillMain} ${styles.pillTiny}`}>Attuned</span>}
                  {!!personalInventoryDetailItem.hidden && <span className={`${styles.pill} ${styles.pillSide} ${styles.pillTiny}`}>Hidden</span>}
                </div>

                <div className={styles.personalInventoryLightboxGrid}>
                  {personalInventoryDetailItem.value != null && (
                    <div className={styles.personalInventoryLightboxField}>
                      <span className={styles.personalInventoryLightboxLabel}>Value</span>
                      <span>{personalInventoryDetailItem.value} gp</span>
                    </div>
                  )}
                  {personalInventoryDetailItem.weight != null && (
                    <div className={styles.personalInventoryLightboxField}>
                      <span className={styles.personalInventoryLightboxLabel}>Weight</span>
                      <span>{personalInventoryDetailItem.weight} lb</span>
                    </div>
                  )}
                  {!!normalizeText(personalInventoryDetailItem.assignedTo) && (
                    <div className={styles.personalInventoryLightboxField}>
                      <span className={styles.personalInventoryLightboxLabel}>Assigned To</span>
                      <span>{personalInventoryDetailItem.assignedTo}</span>
                    </div>
                  )}
                </div>

                {personalInventoryDetailWeaponRows.length > 0 && (
                  <div className={styles.personalInventoryLightboxSection}>
                    <div className={styles.inputLabel}>Weapon Details</div>
                    <div className={styles.itemWeaponStats}>
                      {personalInventoryDetailWeaponRows.map((entry) => (
                        <div key={`detail-${personalInventoryDetailItem.id}-${entry.label}`} className={styles.itemWeaponStatRow}>
                          <span className={styles.itemWeaponStatLabel}>{entry.label}:</span>
                          <span>{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {personalInventoryDetailTags.length > 0 && (
                  <div className={styles.personalInventoryLightboxSection}>
                    <div className={styles.inputLabel}>Tags</div>
                    <div className={styles.personalInventoryTagList}>
                      {personalInventoryDetailTags.map((tag) => (
                        <span key={`detail-tag-${personalInventoryDetailItem.id}-${tag}`} className={styles.personalInventoryTag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {!!normalizeText(personalInventoryDetailItem.notes) && (
                  <div className={styles.personalInventoryLightboxSection}>
                    <div className={styles.inputLabel}>Notes</div>
                    <div className={styles.personalInventoryLightboxNotes}>{personalInventoryDetailItem.notes}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========== QUEST MODAL ========== */}
        {questModalOpen && canManageQuests && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modalCard} ${styles.questModal}`}>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitle}>{editingQuestId ? 'Edit Quest' : 'Add Quest'}</div>
                <button className={smallBtnClass('danger')} onMouseEnter={smallBtnHover} onClick={() => setQuestModalOpen(false)}>Close</button>
              </div>
              <div className={styles.sectionDivider} />
              <div className={styles.modalBody}>
                {[['Title *', 'title', 'text', 'e.g. Find Allies for the Kingdom of Avalon'], ['Quest Giver', 'giver', 'text', 'e.g. Bartrem'], ['Location', 'location', 'text', 'e.g. Qonza']].map(([lbl, key, type, ph]) => (
                  <div key={key}>
                    <div className={styles.inputLabel}>{lbl}</div>
                    <input type={type} value={questDraft[key] || ''} onChange={(e) => setQuestDraft((d) => ({ ...d, [key]: e.target.value }))} placeholder={ph} className={styles.inputBase} />
                  </div>
                ))}
                <div>
                  <div className={styles.inputLabel}>Board</div>
                  <select
                    value={questBoardType(questDraft)}
                    onChange={(e) => {
                      const nextBoard = e.target.value === 'personal' ? 'personal' : 'party';
                      setQuestDraft((d) => (
                        nextBoard === 'personal'
                          ? { ...d, board: 'personal' }
                          : { ...d, board: 'party', assignedUserId: '', assignedEmail: '', assignedUsername: '', assignedLabel: '' }
                      ));
                    }}
                    className={styles.inputBase}
                  >
                    <option value="party">Party Board</option>
                    <option value="personal">Personal Board</option>
                  </select>
                </div>
                {questBoardType(questDraft) === 'personal' && (
                  <div>
                    <div className={styles.inputLabel}>Assign To Player *</div>
                    <select
                      value={selectedQuestAssigneeValue}
                      onChange={(e) => {
                        const selectedValue = e.target.value;
                        const selectedPlayer = assignablePlayers.find(
                          (player) => player.userId === selectedValue
                        );
                        setQuestDraft((d) => ({
                          ...d,
                          assignedUserId: selectedPlayer?.userId || '',
                          assignedEmail: '',
                          assignedUsername: normalizeText(selectedPlayer?.username || ''),
                          assignedLabel: normalizeText(selectedPlayer?.username || selectedPlayer?.label || ''),
                        }));
                      }}
                      className={styles.inputBase}
                    >
                      <option value="">Select player...</option>
                      {selectedQuestAssigneeMissing && (
                        <option value={selectedQuestAssigneeValue}>
                          {questDraft.assignedLabel || questDraft.assignedUsername || 'Assigned Player'}
                        </option>
                      )}
                      {assignablePlayers.map((player) => {
                        const value = player.userId;
                        return (
                          <option key={value} value={value}>
                            {player.label}
                          </option>
                        );
                      })}
                    </select>
                    {playersLoading && <div className={styles.modalHint}>Loading campaign players...</div>}
                    {playersError && <div className={styles.modalHint}>{playersError}</div>}
                    {!playersLoading && !playersError && assignablePlayers.length === 0 && (
                      <div className={styles.modalHint}>No player accounts found yet.</div>
                    )}
                  </div>
                )}
                <div>
                  <div className={styles.inputLabel}>Type</div>
                  <select value={questDraft.type || 'Side'} onChange={(e) => setQuestDraft((d) => ({ ...d, type: e.target.value }))} className={styles.inputBase}>
                    {['Main', 'Side', 'Personal'].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <div className={styles.inputLabel}>Description</div>
                  <textarea value={questDraft.description || ''} onChange={(e) => setQuestDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Who do we need to rob?" rows={4} className={`${styles.inputBase} ${styles.textarea} ${styles.noResize}`} />
                </div>
              </div>
              <div className={styles.sectionDivider} />
              <div className={styles.modalFooter}>
                <button className={smallBtnClass('ghost')} onMouseEnter={smallBtnHover} onClick={() => setQuestModalOpen(false)}>Cancel</button>
                <button className={smallBtnClass('gold')} onMouseEnter={smallBtnHover} onClick={saveQuest}>{editingQuestId ? 'Save Changes' : 'Add Quest'}</button>
              </div>
            </div>
          </div>
        )}

        {/* ========== INVENTORY MODAL ========== */}
        {invModalOpen && (
          <div className={`${styles.modalOverlay} ${styles.modalOverlayTop}`}>
            <div className={`${styles.modalCard} ${styles.inventoryModal}`}>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitle}>
                  {invEditingId
                    ? (invModalTarget === 'personal' ? 'Edit Personal Item' : 'Edit Bag Item')
                    : (invModalTarget === 'personal' ? 'Add Personal Item' : 'Add Bag Item')}
                </div>
                <button className={smallBtnClass('danger')} onMouseEnter={smallBtnHover} onClick={closeInventoryModal}>Close</button>
              </div>
              <div className={styles.sectionDivider} />
              <div className={styles.inventoryModalBody}>
                <div className={styles.fullCol}>
                  <div className={styles.inputLabel}>Name</div>
                  <input value={invDraft.name} onChange={(e) => setInvDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Longsword +1" className={styles.inputBase} />
                </div>
                <div>
                  <div className={styles.inputLabel}>Category</div>
                  <select value={invDraft.category} onChange={(e) => setInvDraft((d) => ({ ...d, category: e.target.value }))} className={styles.inputBase}>
                    {CATEGORIES.filter((c) => c !== 'All').map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <div className={styles.inputLabel}>Rarity</div>
                  <select value={invDraft.rarity} onChange={(e) => setInvDraft((d) => ({ ...d, rarity: e.target.value }))} className={styles.inputBase}>
                    {RARITIES.filter((r) => r !== 'All').map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <div className={styles.inputLabel}>Qty</div>
                  <input type="number" min={1} max={9999} value={invDraft.qty} onChange={(e) => setInvDraft((d) => ({ ...d, qty: e.target.value }))} className={styles.inputBase} />
                </div>
                <div>
                  <div className={styles.inputLabel}>{isInvDraftWeapon ? 'Cost (gp)' : 'Value (gp)'}</div>
                  <input type="number" min={0} value={invDraft.value} onChange={(e) => setInvDraft((d) => ({ ...d, value: e.target.value }))} placeholder="0" className={styles.inputBase} />
                </div>
                <div>
                  <div className={styles.inputLabel}>Weight (lb)</div>
                  <input type="number" min={0} value={invDraft.weight} onChange={(e) => setInvDraft((d) => ({ ...d, weight: e.target.value }))} placeholder="0" className={styles.inputBase} />
                </div>
                {isInvDraftWeapon && (
                  <>
                    <div>
                      <div className={styles.inputLabel}>Proficient</div>
                      <input
                        value={invDraft.weaponProficiency}
                        onChange={(e) => setInvDraft((d) => ({ ...d, weaponProficiency: e.target.value }))}
                        placeholder="Yes"
                        className={styles.inputBase}
                      />
                    </div>
                    <div>
                      <div className={styles.inputLabel}>Hit / DC</div>
                      <input
                        value={invDraft.weaponHitDc}
                        onChange={(e) => setInvDraft((d) => ({ ...d, weaponHitDc: e.target.value }))}
                        placeholder="+7 / DC 15"
                        className={styles.inputBase}
                      />
                    </div>
                    <div>
                      <div className={styles.inputLabel}>Attack Type</div>
                      <input
                        value={invDraft.weaponAttackType}
                        onChange={(e) => setInvDraft((d) => ({ ...d, weaponAttackType: e.target.value }))}
                        placeholder="Melee"
                        className={styles.inputBase}
                      />
                    </div>
                    <div>
                      <div className={styles.inputLabel}>Reach</div>
                      <input
                        value={invDraft.weaponReach}
                        onChange={(e) => setInvDraft((d) => ({ ...d, weaponReach: e.target.value }))}
                        placeholder="5 ft."
                        className={styles.inputBase}
                      />
                    </div>
                    <div>
                      <div className={styles.inputLabel}>Damage</div>
                      <input
                        value={invDraft.weaponDamage}
                        onChange={(e) => setInvDraft((d) => ({ ...d, weaponDamage: e.target.value }))}
                        placeholder="2d6+7"
                        className={styles.inputBase}
                      />
                    </div>
                    <div>
                      <div className={styles.inputLabel}>Damage Type</div>
                      <input
                        value={invDraft.weaponDamageType}
                        onChange={(e) => setInvDraft((d) => ({ ...d, weaponDamageType: e.target.value }))}
                        placeholder="Slashing"
                        className={styles.inputBase}
                      />
                    </div>
                    <div className={styles.fullCol}>
                      <div className={styles.inputLabel}>Properties</div>
                      <input
                        value={invDraft.weaponProperties}
                        onChange={(e) => setInvDraft((d) => ({ ...d, weaponProperties: e.target.value }))}
                        placeholder="Heavy, Two-Handed"
                        className={styles.inputBase}
                      />
                    </div>
                  </>
                )}
                {invModalTarget !== 'personal' && (
                  <div>
                    <div className={styles.inputLabel}>Assigned To</div>
                    <input value={invDraft.assignedTo} onChange={(e) => setInvDraft((d) => ({ ...d, assignedTo: e.target.value }))} placeholder="Player name" className={styles.inputBase} />
                  </div>
                )}
                <div className={styles.fullCol}>
                  <div className={styles.inputLabel}>Notes</div>
                  <textarea value={invDraft.notes} onChange={(e) => setInvDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Description, effects, flavor text..." rows={3} className={`${styles.inputBase} ${styles.textarea} ${styles.noResize}`} />
                </div>
                <div className={styles.fullCol}>
                  <div className={styles.inputLabel}>Tags (comma-separated)</div>
                  <input value={invDraft.tags} onChange={(e) => setInvDraft((d) => ({ ...d, tags: e.target.value }))} placeholder="magic, cursed, party-loot" className={styles.inputBase} />
                </div>
                <div className={styles.fullCol}>
                  <div className={styles.checkboxRow}>
                    <input type="checkbox" id="inv-equipped" checked={!!invDraft.equipped} onChange={(e) => setInvDraft((d) => ({ ...d, equipped: e.target.checked }))} />
                    <label htmlFor="inv-equipped" className={styles.checkboxLabel}>Equipped</label>
                  </div>
                </div>
                {invModalTarget === 'personal' && (
                  <div className={styles.fullCol}>
                    <div className={styles.checkboxRow}>
                      <input type="checkbox" id="inv-attuned" checked={!!invDraft.attuned} onChange={(e) => setInvDraft((d) => ({ ...d, attuned: e.target.checked }))} />
                      <label htmlFor="inv-attuned" className={styles.checkboxLabel}>Attuned</label>
                    </div>
                    <div className={styles.checkboxRow}>
                      <input type="checkbox" id="inv-hidden" checked={!!invDraft.hidden} onChange={(e) => setInvDraft((d) => ({ ...d, hidden: e.target.checked }))} />
                      <label htmlFor="inv-hidden" className={styles.checkboxLabel}>Hide From Other Players</label>
                    </div>
                  </div>
                )}
              </div>
              <div className={styles.sectionDivider} />
              <div className={styles.modalFooter}>
                <button className={smallBtnClass('ghost')} onMouseEnter={smallBtnHover} onClick={closeInventoryModal}>Cancel</button>
                <button
                  className={smallBtnClass('gold')}
                  onMouseEnter={smallBtnHover}
                  onClick={invSaveDraft}
                  disabled={invModalTarget === 'personal' ? !canEditPersonalInventory : !canEditInventory}
                >
                  {invEditingId ? 'Save Changes' : (invModalTarget === 'personal' ? 'Add Personal Item' : 'Add Item')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========== TRADE REQUEST MODAL ========== */}
        {tradeRequestModalOpen && !canEditInventory && (
          <div className={`${styles.modalOverlay} ${styles.modalOverlayTop}`}>
            <div className={`${styles.modalCard} ${styles.tradeModal}`}>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitle}>Request Trade</div>
                <button className={smallBtnClass('danger')} onMouseEnter={smallBtnHover} onClick={() => setTradeRequestModalOpen(false)}>Close</button>
              </div>
              <div className={styles.sectionDivider} />
              <div className={styles.modalBody}>
                {tradeRequestTargetItem ? (
                  <>
                    <div className={styles.tradeSummaryBlock}>
                      <div className={styles.inputLabel}>Requesting From Bag</div>
                      <div className={styles.tradeSummaryRow}>
                        <strong>{tradeRequestTargetItem.name}</strong>
                        <span>({tradeRequestTargetItem.rarity} - {tradeRequestTargetItem.category})</span>
                      </div>
                      <div className={styles.tradeSummaryRow}>Available Qty: {tradeRequestTargetItem.qty ?? 1}</div>
                    </div>

                    <div>
                      <div className={styles.inputLabel}>Requested Qty</div>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, tradeRequestTargetItem.qty || 1)}
                        value={tradeDraft.requestedQty}
                        onChange={(e) => setTradeDraft((prev) => ({ ...prev, requestedQty: e.target.value }))}
                        className={styles.inputBase}
                      />
                    </div>

                    <div>
                      <div className={styles.inputLabel}>Offer Item (optional)</div>
                      <select
                        value={tradeDraft.offerItemId}
                        onChange={(e) => setTradeDraft((prev) => ({ ...prev, offerItemId: e.target.value }))}
                        className={styles.inputBase}
                      >
                        <option value="">No offer item</option>
                        {tradeOfferItemOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} (x{item.qty ?? 1})
                          </option>
                        ))}
                      </select>
                    </div>

                    {tradeDraft.offerItemId && (
                      <div>
                        <div className={styles.inputLabel}>Offer Qty</div>
                        <input
                          type="number"
                          min={1}
                          max={Math.max(1, selectedTradeOfferItem?.qty || 1)}
                          value={tradeDraft.offerQty}
                          onChange={(e) => setTradeDraft((prev) => ({ ...prev, offerQty: e.target.value }))}
                          className={styles.inputBase}
                        />
                      </div>
                    )}

                    <div>
                      <div className={styles.inputLabel}>Message (optional)</div>
                      <textarea
                        value={tradeDraft.note}
                        onChange={(e) => setTradeDraft((prev) => ({ ...prev, note: e.target.value }))}
                        rows={3}
                        className={`${styles.inputBase} ${styles.textarea} ${styles.noResize}`}
                        placeholder="Any context for the owner..."
                      />
                    </div>
                  </>
                ) : (
                  <div className={styles.modalHint}>Selected item is no longer available.</div>
                )}
              </div>
              <div className={styles.sectionDivider} />
              <div className={styles.modalFooter}>
                <button className={smallBtnClass('ghost')} onMouseEnter={smallBtnHover} onClick={() => setTradeRequestModalOpen(false)}>Cancel</button>
                <button
                  className={smallBtnClass('gold')}
                  onMouseEnter={smallBtnHover}
                  onClick={submitTradeRequest}
                  disabled={!tradeRequestTargetItem}
                >
                  Submit Trade Request
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========== TRADE CENTER MODAL ========== */}
        {tradeCenterOpen && (
          <div className={`${styles.modalOverlay} ${styles.modalOverlayTop}`}>
            <div className={`${styles.modalCard} ${styles.tradeModal}`}>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitle}>{canEditInventory ? 'Incoming Trade Requests' : 'My Trade Requests'}</div>
                <button className={smallBtnClass('danger')} onMouseEnter={smallBtnHover} onClick={() => setTradeCenterOpen(false)}>Close</button>
              </div>
              <div className={styles.sectionDivider} />
              <div className={styles.modalBody}>
                {visibleTradeRequests.length === 0 ? (
                  <div className={styles.modalHint}>No trade requests yet.</div>
                ) : (
                  <div className={styles.tradeRequestList}>
                    {visibleTradeRequests.map((request) => (
                      <div key={request.id} className={styles.tradeRequestCard}>
                        <div className={styles.tradeSummaryRow}>
                          <strong>{request.requesterUsername || 'Player'}</strong>
                          <span className={styles.tradeStatus}>{request.status}</span>
                        </div>
                        <div className={styles.tradeSummaryRow}>
                          Requests <strong>{request.partyItemName}</strong> x{request.requestedQty}
                        </div>
                        {request.offerItemName && (
                          <div className={styles.tradeSummaryRow}>
                            Offers <strong>{request.offerItemName}</strong> x{request.offerQty}
                          </div>
                        )}
                        {!!request.note && (
                          <div className={styles.tradeSummaryRow}>{request.note}</div>
                        )}
                        <div className={styles.tradeMeta}>
                          Sent: {new Date(request.requestedAt).toLocaleString()}
                        </div>
                        {request.status !== 'pending' && (
                          <div className={styles.tradeMeta}>
                            {request.status === 'accepted' ? 'Accepted' : 'Denied'} by {request.decidedByUsername || 'Owner'} on {request.decidedAt ? new Date(request.decidedAt).toLocaleString() : 'Unknown'}
                          </div>
                        )}
                        {!!request.decisionNote && (
                          <div className={styles.tradeMeta}>Note: {request.decisionNote}</div>
                        )}
                        {canEditInventory && request.status === 'pending' && (
                          <div className={styles.actionsRow}>
                            <button className={smallBtnClass('gold')} onMouseEnter={smallBtnHover} onClick={() => resolveTradeRequest(request.id, 'accepted')}>Accept</button>
                            <button className={smallBtnClass('danger')} onMouseEnter={smallBtnHover} onClick={() => resolveTradeRequest(request.id, 'denied')}>Deny</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {playerTradeCenterOpen && (
          <div className={`${styles.modalOverlay} ${styles.modalOverlayTop}`}>
            <div className={`${styles.modalCard} ${styles.tradeModal}`}>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitle}>Player Trade Requests</div>
                <button
                  className={smallBtnClass('danger')}
                  onMouseEnter={smallBtnHover}
                  onClick={() => {
                    setPlayerTradeCenterOpen(false);
                    setPlayerTradeFocusId('');
                  }}
                >
                  Close
                </button>
              </div>
              <div className={styles.sectionDivider} />
              <div className={`${styles.modalBody} ${styles.tradeComposerGrid}`}>
                <div className={`${styles.tradeRequestList} ${styles.tradeSidebarList}`}>
                  {playerTradeSessions.length === 0 ? (
                    <div className={styles.modalHint}>No player trades yet.</div>
                  ) : (
                    playerTradeSessions.map((trade) => {
                      const otherUserId = normalizeText(trade.fromUserId) === activeInventoryUserId
                        ? normalizeText(trade.toUserId)
                        : normalizeText(trade.fromUserId);
                      const otherLabel = tradingPlayerLabelById[otherUserId] || 'Player';
                      const isActive = normalizeText(playerTradeFocusId) === trade.id;
                      return (
                        <button
                          key={`player-trade-session-${trade.id}`}
                          type="button"
                          className={`${styles.tradeRequestCard} ${styles.tradeSessionCard}${isActive ? ` ${styles.tradeSessionCardActive}` : ''}`}
                          onMouseEnter={smallBtnHover}
                          onClick={() => openExistingPlayerTrade(trade.id)}
                        >
                          <div className={styles.tradeSummaryRow}>
                            <strong>{otherLabel}</strong>
                            <span className={styles.tradeStatus}>{trade.status}</span>
                          </div>
                          <div className={styles.tradeMeta}>
                            Updated: {new Date(trade.updatedAt || trade.requestedAt || 0).toLocaleString()}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className={styles.tradeWorkspace}>
                  {!focusedPlayerTrade ? (
                    <>
                      <div>
                        <div className={styles.inputLabel}>Send Trade To</div>
                        <select
                          value={playerTradeTargetUserId}
                          onChange={(e) => setPlayerTradeTargetUserId(e.target.value)}
                          className={styles.inputBase}
                        >
                          <option value="">Select player...</option>
                          {otherTradingPlayers.map((player) => (
                            <option key={`player-trade-target-${player.userId}`} value={player.userId}>
                              {player.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div className={styles.inputLabel}>Message (optional)</div>
                        <textarea
                          value={playerTradeMessage}
                          onChange={(e) => setPlayerTradeMessage(e.target.value)}
                          rows={3}
                          className={`${styles.inputBase} ${styles.textarea} ${styles.noResize}`}
                          placeholder="What do you want to trade for?"
                        />
                      </div>
                      <div className={styles.actionsRow}>
                        <button
                          className={smallBtnClass('gold')}
                          onMouseEnter={smallBtnHover}
                          onClick={createPlayerTradeFromComposer}
                          disabled={!playerTradeTargetUserId}
                        >
                          Create Trade Window
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={styles.tradeSummaryBlock}>
                        <div className={styles.tradeSummaryRow}>
                          <strong>Trading With {activePlayerTradeTargetLabel || 'Player'}</strong>
                          <span className={styles.tradeStatus}>{focusedPlayerTrade.status}</span>
                        </div>
                        {!!focusedPlayerTrade.message && (
                          <div className={styles.tradeMeta}>{focusedPlayerTrade.message}</div>
                        )}
                        <div className={styles.tradeMeta}>
                          You: {focusedTradeViewerAccepted ? 'Accepted' : 'Waiting'} • {activePlayerTradeTargetLabel || 'Other Player'}: {focusedTradeOtherAccepted ? 'Accepted' : 'Waiting'}
                        </div>
                      </div>

                      <div className={styles.tradeOfferGrid}>
                        <div className={styles.tradeOfferCol}>
                          <div className={styles.inputLabel}>Your Offer</div>
                          <div className={styles.tradeOfferList}>
                            {focusedTradeOwnOffer.length === 0 ? (
                              <div className={styles.modalHint}>No items added yet.</div>
                            ) : (
                              focusedTradeOwnOffer.map((line) => (
                                <div key={`own-offer-${line.itemId}`} className={styles.tradeSummaryRow}>
                                  <span>{line.name || 'Item'} x{line.qty}</span>
                                  {focusedPlayerTrade.status === 'open' && (
                                    <button
                                      className={smallBtnClass('danger')}
                                      onMouseEnter={smallBtnHover}
                                      onClick={() => removeLineFromPlayerTrade(focusedPlayerTrade.id, line.itemId)}
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                          {focusedPlayerTrade.status === 'open' && (
                            <div className={styles.tradeOfferControls}>
                              <select
                                value={playerTradeOwnItemId}
                                onChange={(e) => setPlayerTradeOwnItemId(e.target.value)}
                                className={styles.inputBase}
                              >
                                <option value="">Choose your item...</option>
                                {playerTradeOwnItemOptions.map((item) => (
                                  <option key={`own-item-option-${item.id}`} value={item.id}>
                                    {item.name} (x{item.qty ?? 1})
                                  </option>
                                ))}
                              </select>
                              <input
                                type="number"
                                min={1}
                                value={playerTradeOwnQty}
                                onChange={(e) => setPlayerTradeOwnQty(e.target.value)}
                                className={styles.inputBase}
                              />
                              <button
                                className={smallBtnClass('ghost')}
                                onMouseEnter={smallBtnHover}
                                onClick={() => addLineToPlayerTrade(focusedPlayerTrade.id)}
                                disabled={!playerTradeOwnItemId}
                              >
                                Add
                              </button>
                            </div>
                          )}
                        </div>

                        <div className={styles.tradeOfferCol}>
                          <div className={styles.inputLabel}>{activePlayerTradeTargetLabel || 'Other Player'} Offer</div>
                          <div className={styles.tradeOfferList}>
                            {focusedTradeTargetOffer.length === 0 ? (
                              <div className={styles.modalHint}>No items offered yet.</div>
                            ) : (
                              focusedTradeTargetOffer.map((line) => (
                                <div key={`target-offer-${line.itemId}`} className={styles.tradeSummaryRow}>
                                  <span>{line.name || 'Item'} x{line.qty}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      {focusedPlayerTrade.status === 'open' && (
                        <div className={styles.actionsRow}>
                          <button
                            className={smallBtnClass(focusedTradeViewerAccepted ? 'ghost' : 'gold')}
                            onMouseEnter={smallBtnHover}
                            onClick={() => togglePlayerTradeAccepted(focusedPlayerTrade.id)}
                          >
                            {focusedTradeViewerAccepted ? 'Unaccept Trade' : 'Accept Trade'}
                          </button>
                          <button
                            className={smallBtnClass('danger')}
                            onMouseEnter={smallBtnHover}
                            onClick={() => cancelPlayerTrade(focusedPlayerTrade.id)}
                          >
                            Cancel Trade
                          </button>
                        </div>
                      )}
                      <div className={styles.modalHint}>Trade completes automatically once both players accept.</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>{/* end scrollable wrapper */}
    </ShellLayout>
  );
}
