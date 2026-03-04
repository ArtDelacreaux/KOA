import React, { useEffect, useState, useMemo, useRef } from 'react';
import ShellLayout from './ShellLayout';
import styles from './CampaignHub.module.css';
import owlbearLogo from '../assets/logo/owl.svg';
import watchPartyLogo from '../assets/logo/watch.webp';
import { useAuth } from '../auth/AuthContext';
import { createId } from '../domain/ids';
import { STORAGE_KEYS } from '../lib/storageKeys';
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
  return normalizeText(quest?.assignedLabel || quest?.assignedUsername || quest?.assignedEmail || 'Unassigned');
}

function emailLocalPart(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return '';
  return normalized.split('@')[0] || '';
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
        const { data, error } = await supabase
          .from('campaign_members')
          .select('user_id,email,role,joined_at')
          .eq('campaign_id', campaignId)
          .order('joined_at', { ascending: true });

        if (error) throw error;

        const memberRows = (Array.isArray(data) ? data : [])
          .filter((row) => normalizeText(row?.role || 'member').toLowerCase() === 'member');
        const memberUserIds = memberRows
          .map((row) => normalizeText(row?.user_id))
          .filter(Boolean);

        const usernameByUserId = new Map();
        if (memberUserIds.length > 0) {
          const { data: profileRows, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id,username')
            .in('user_id', memberUserIds);

          if (!profilesError && Array.isArray(profileRows)) {
            profileRows.forEach((row) => {
              const userId = normalizeText(row?.user_id);
              const username = normalizeText(row?.username);
              if (userId && username) usernameByUserId.set(userId, username);
            });
          }
        }

        const seen = new Set();
        const nextPlayers = memberRows
          .map((row, idx) => {
            const userId = normalizeText(row?.user_id);
            const email = normalizeEmail(row?.email);
            if (!userId && !email) return null;
            const key = userId || email;
            if (seen.has(key)) return null;
            seen.add(key);

            const username = normalizeText(usernameByUserId.get(userId));
            const fallbackName = emailLocalPart(email);
            const label = username || fallbackName || `Player ${idx + 1}`;
            return { userId, email, username, label };
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
          const selfLabel = normalizeText(profile?.username || emailLocalPart(currentUserEmail) || 'You');
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
        const fallbackLabel = normalizeText(profile?.username || emailLocalPart(currentUserEmail) || 'You');
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
    let assignedEmail = '';
    let assignedUsername = '';
    let assignedLabel = '';
    if (board === 'personal') {
      assignedUserId = normalizeText(questDraft.assignedUserId);
      assignedEmail = normalizeEmail(questDraft.assignedEmail);
      assignedUsername = normalizeText(questDraft.assignedUsername);
      const selected = assignablePlayers.find((player) => {
        const playerValue = player.userId || player.email;
        return playerValue && playerValue === (assignedUserId || assignedEmail);
      });
      if (selected) {
        assignedUserId = selected.userId;
        assignedEmail = selected.email;
        assignedUsername = normalizeText(selected.username || selected.label);
        assignedLabel = normalizeText(selected.username || selected.label);
      } else {
        assignedUsername = normalizeText(questDraft.assignedUsername);
        assignedLabel = normalizeText(questDraft.assignedLabel);
      }

      if (!assignedUserId && !assignedEmail) {
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
      assignedEmail: board === 'personal' ? assignedEmail : '',
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
    const updatedBy = normalizeText(profile?.username || emailLocalPart(session?.user?.email) || 'DM');
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
      label: normalizeText(profile?.username || emailLocalPart(currentUserEmail) || 'you'),
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
      label: normalizeText(profile?.username || emailLocalPart(currentUserEmail) || 'You'),
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
          const label = normalizeText(entry?.label || entry?.username || emailLocalPart(email) || '');
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
      const label = normalizeText(member?.label || member?.username || emailLocalPart(member?.email) || 'Player');
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
        label: normalizeText(profile?.username || emailLocalPart(currentUserEmail) || 'You'),
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
  const CATEGORIES = ['All', 'Weapon', 'Armor', 'Gear', 'Consumable', 'Loot', 'Quest', 'Magic', 'Misc'];
  const RARITIES   = ['All', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

  const rarityBadge = (rarity) => {
    const r = (rarity || 'Common').toLowerCase();
    const map = { common: 'rgba(255,255,255,0.16)', uncommon: 'rgba(110,231,183,0.18)', rare: 'rgba(96,165,250,0.18)', epic: 'rgba(216,180,254,0.18)', legendary: 'rgba(251,191,36,0.20)' };
    return map[r] || map.common;
  };


  const defaultBagState = {
    currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
    items: [],
  };

  const [bag, setBag] = useLocalStorageState(STORAGE_KEYS.bag, defaultBagState);

  useEffect(() => {
    setBag((prev) => ({
      currency: {
        pp: prev?.currency?.pp ?? 0,
        gp: prev?.currency?.gp ?? 0,
        sp: prev?.currency?.sp ?? 0,
        cp: prev?.currency?.cp ?? 0,
      },
      items: Array.isArray(prev?.items) ? prev.items : [],
    }));
    // Normalize once on mount in case older saved shapes exist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [invQuery, setInvQuery] = useState('');
  const [invCat,   setInvCat]   = useState('All');
  const [invRar,   setInvRar]   = useState('All');
  const [invSort,  setInvSort]  = useState('name');
  const [currencyDelta, setCurrencyDelta] = useState({ pp: '', gp: '', sp: '', cp: '' });

  const [invModalOpen, setInvModalOpen] = useState(false);
  const [invEditingId, setInvEditingId] = useState(null);
  const [dangerOpen,   setDangerOpen]   = useState(false);

  useEffect(() => {
    if (!invModalOpen) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') setInvModalOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [invModalOpen, setInvModalOpen]);

  const invEmptyDraft = { name: '', qty: 1, category: 'Gear', rarity: 'Common', value: '', weight: '', notes: '', tags: '', assignedTo: '', equipped: false };
  const [invDraft, setInvDraft] = useState(invEmptyDraft);

  const invOpenAdd  = () => { setInvEditingId(null); setInvDraft(invEmptyDraft); setInvModalOpen(true); };
  const invOpenEdit = (item) => {
    setInvEditingId(item.id);
    setInvDraft({ name: item.name || '', qty: typeof item.qty === 'number' ? item.qty : 1, category: item.category || 'Gear', rarity: item.rarity || 'Common', value: item.value ?? '', weight: item.weight ?? '', notes: item.notes || '', tags: Array.isArray(item.tags) ? item.tags.join(', ') : '', assignedTo: item.assignedTo || '', equipped: !!item.equipped });
    setInvModalOpen(true);
  };

  const invSaveDraft = () => {
    const name = (invDraft.name || '').trim();
    if (!name) { alert('Item needs a name.'); return; }
    const qty    = clampInt(parseInt(invDraft.qty, 10) || 1, 1, 9999);
    const value  = invDraft.value  === '' ? null : Number(invDraft.value);
    const weight = invDraft.weight === '' ? null : Number(invDraft.weight);
    const tags   = (invDraft.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
    const now    = new Date().toISOString();

    setBag((prev) => {
      const items = prev.items || [];
      if (!invEditingId) {
        const item = { id: bagNewId(), name, qty, category: invDraft.category || 'Gear', rarity: invDraft.rarity || 'Common', value: Number.isFinite(value) ? value : null, weight: Number.isFinite(weight) ? weight : null, notes: (invDraft.notes || '').trim(), tags, assignedTo: (invDraft.assignedTo || '').trim(), equipped: !!invDraft.equipped, createdAt: now, updatedAt: now };
        return { ...prev, items: [item, ...items] };
      } else {
        return { ...prev, items: items.map((it) => it.id === invEditingId ? { ...it, name, qty, category: invDraft.category || it.category, rarity: invDraft.rarity || it.rarity, value: Number.isFinite(value) ? value : it.value, weight: Number.isFinite(weight) ? weight : it.weight, notes: (invDraft.notes || '').trim(), tags, assignedTo: (invDraft.assignedTo || '').trim(), equipped: !!invDraft.equipped, updatedAt: now } : it) };
      }
    });
    setInvModalOpen(false);
    setInvEditingId(null);
  };

  const invDeleteItem     = (id) => { if (!confirm('Delete this item?')) return; setBag((prev) => ({ ...prev, items: (prev.items || []).filter((it) => it.id !== id) })); };
  const invBumpQty        = (id, delta) => { setBag((prev) => ({ ...prev, items: (prev.items || []).map((it) => it.id === id ? { ...it, qty: clampInt((it.qty || 1) + delta, 1, 9999) } : it) })); };
  const invToggleEquipped = (id) => { setBag((prev) => ({ ...prev, items: (prev.items || []).map((it) => it.id === id ? { ...it, equipped: !it.equipped } : it) })); };
  const applyCurrencyDelta = (key, direction) => {
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
    if (q)           items = items.filter((it) => (it.name || '').toLowerCase().includes(q) || (it.notes || '').toLowerCase().includes(q) || (it.assignedTo || '').toLowerCase().includes(q));
    if (invCat !== 'All') items = items.filter((it) => (it.category || '') === invCat);
    if (invRar !== 'All') items = items.filter((it) => (it.rarity   || '') === invRar);
    if (invSort === 'qty')     items.sort((a, b) => (b.qty || 0) - (a.qty || 0));
    else if (invSort === 'value')   items.sort((a, b) => (b.value || 0) - (a.value || 0));
    else if (invSort === 'updated') items.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    else items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return items;
  }, [bag.items, invQuery, invCat, invRar, invSort]);
  const selectedQuestAssigneeValue = normalizeText(questDraft.assignedUserId || questDraft.assignedEmail);
  const selectedQuestAssigneeMissing =
    !!selectedQuestAssigneeValue &&
    !assignablePlayers.some((player) => (player.userId || player.email) === selectedQuestAssigneeValue);

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
            {((campaignTab === 'quests' && canManageQuests) || campaignTab === 'inventory') && (
              <button
                type="button"
                onMouseEnter={smallBtnHover}
                onClick={campaignTab === 'quests' ? openAddQuest : invOpenAdd}
                className={smallBtnClass('gold', styles.actionAddBtn)}
              >
                {campaignTab === 'quests' ? '+ Add Quest' : '+ Add Item'}
              </button>
            )}
          </div>

          <div className={styles.tabRow}>
            {[
              { key: 'launcher', label: 'Hub' },
              { key: 'quests', label: 'Quest Board' },
              { key: 'inventory', label: 'Party Inventory' },
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
                  <div className={`${styles.softCard} ${styles.boardNoteCard} ${styles.hubTile} ${styles.hubTileMain}`} onMouseEnter={() => playHover()}>
                    <div className={styles.iconRow}>
                      <div className={styles.toolIcon}>
                        <img src={watchPartyLogo} alt="Watch Party logo" className={styles.toolLogo} />
                      </div>
                      <div>
                        <div className={styles.toolTitle}>Watch Party</div>
                        <div className={styles.toolSub}>Music / Videos / Friends</div>
                      </div>
                    </div>
                    <div className={styles.hubTileActions}>
                      <button className={smallBtnClass('gold')} onMouseEnter={smallBtnHover} onClick={() => openTool('watch')}>Open Room</button>
                    </div>
                  </div>

                  <div className={`${styles.softCard} ${styles.boardNoteCard} ${styles.hubTile} ${styles.hubTileMain}`} onMouseEnter={() => playHover()}>
                    <div className={styles.iconRow}>
                      <div className={styles.toolIcon}>
                        <img src={owlbearLogo} alt="Owlbear logo" className={styles.toolLogo} />
                      </div>
                      <div>
                        <div className={styles.toolTitle}>Owlbear Table</div>
                        <div className={styles.toolSub}>Maps / Tokens / Encounters</div>
                      </div>
                    </div>
                    <div className={styles.hubTileActions}>
                      <button className={smallBtnClass('gold')} onMouseEnter={smallBtnHover} onClick={() => openTool('owlbear')}>Open Room</button>
                    </div>
                  </div>

                  <div className={`${styles.softCard} ${styles.boardNoteCard} ${styles.hubTile}`} onMouseEnter={() => playHover()}>
                    <div className={styles.iconRow}>
                      <div className={styles.hubPlayersGlyph}>PR</div>
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
                  <span className={styles.boardStatusPill}>Shared Access</span>
                </div>

                <div className={styles.inventoryGrid}>
                  <div className={styles.inventoryControls}>
                    <div className={`${styles.softCard} ${styles.boardNoteCard}`}>
                      <div className={styles.cardHeaderRow}>
                        <div>
                          <div className={styles.cardTitle}>Bag of Holding</div>
                          <div className={styles.cardSub}>Shared party inventory - loot, gold totals, quest items, and artifacts.</div>
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
                        <button className={smallBtnClass('gold', styles.addItemBtn)} onMouseEnter={smallBtnHover} onClick={invOpenAdd}>
                          + Add Item
                        </button>
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
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className={styles.currencyDanger}>
                        <button className={smallBtnClass('ghost', styles.fullWidthBtn)} onMouseEnter={smallBtnHover} onClick={() => setDangerOpen((v) => !v)}>
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
                                const ok = confirm('Clear the entire Bag of Holding? This cannot be undone.');
                                if (!ok) return;
                                setBag({ currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [] });
                                setDangerOpen(false);
                              }}
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
                      {invFilteredItems.map((it) => (
                        <div
                          key={it.id}
                          className={`${styles.softCard} ${styles.inventoryItemCard} ${styles.boardNoteCard}`}
                          style={{ '--ch-rarity-bg': rarityBadge(it.rarity) }}
                          onMouseEnter={() => playHover()}
                        >
                          <div className={styles.questRow}>
                            <div className={styles.itemBody}>
                              <div className={styles.questTitleRow}>
                                <div className={styles.itemTitle}>{it.name}</div>
                                {it.equipped && <span className={`${styles.pill} ${styles.pillMain} ${styles.pillTiny}`}>Equipped</span>}
                                <span className={styles.itemMetaInline}>{it.rarity} - {it.category}</span>
                              </div>
                              {it.notes && <div className={styles.itemNotes}>{it.notes}</div>}
                              <div className={styles.itemStats}>
                                {it.assignedTo && <span>By: {it.assignedTo}</span>}
                                {it.value != null && <span>Value: {it.value} gp</span>}
                                {it.weight != null && <span>Wt: {it.weight} lb</span>}
                              </div>
                            </div>
                            <div className={styles.actionsRow}>
                              <span className={styles.qtyBadge}>x{it.qty ?? 1}</span>
                              <button className={smallBtnClass('ghost')} onMouseEnter={smallBtnHover} onClick={() => invBumpQty(it.id, -1)} title="-1">-</button>
                              <button className={smallBtnClass('ghost')} onMouseEnter={smallBtnHover} onClick={() => invBumpQty(it.id, +1)} title="+1">+</button>
                              <button className={smallBtnClass('ghost')} onMouseEnter={smallBtnHover} onClick={() => invToggleEquipped(it.id)}>Equip</button>
                              <button className={smallBtnClass('gold')} onMouseEnter={smallBtnHover} onClick={() => invOpenEdit(it)}>Edit</button>
                              <button className={smallBtnClass('danger')} onMouseEnter={smallBtnHover} onClick={() => invDeleteItem(it.id)}>Delete</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>{/* end body content */}

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
                          (player) => (player.userId || player.email) === selectedValue
                        );
                        setQuestDraft((d) => ({
                          ...d,
                          assignedUserId: selectedPlayer?.userId || '',
                          assignedEmail: selectedPlayer?.email || '',
                          assignedUsername: normalizeText(selectedPlayer?.username || ''),
                          assignedLabel: normalizeText(selectedPlayer?.username || selectedPlayer?.label || ''),
                        }));
                      }}
                      className={styles.inputBase}
                    >
                      <option value="">Select player...</option>
                      {selectedQuestAssigneeMissing && (
                        <option value={selectedQuestAssigneeValue}>
                          {questDraft.assignedLabel || questDraft.assignedUsername || questDraft.assignedEmail || questDraft.assignedUserId}
                        </option>
                      )}
                      {assignablePlayers.map((player) => {
                        const value = player.userId || player.email;
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
                <div className={styles.modalTitle}>{invEditingId ? 'Edit Item' : 'Add Item'}</div>
                <button className={smallBtnClass('danger')} onMouseEnter={smallBtnHover} onClick={() => setInvModalOpen(false)}>Close</button>
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
                  <div className={styles.inputLabel}>Value (gp)</div>
                  <input type="number" min={0} value={invDraft.value} onChange={(e) => setInvDraft((d) => ({ ...d, value: e.target.value }))} placeholder="0" className={styles.inputBase} />
                </div>
                <div>
                  <div className={styles.inputLabel}>Weight (lb)</div>
                  <input type="number" min={0} value={invDraft.weight} onChange={(e) => setInvDraft((d) => ({ ...d, weight: e.target.value }))} placeholder="0" className={styles.inputBase} />
                </div>
                <div>
                  <div className={styles.inputLabel}>Assigned To</div>
                  <input value={invDraft.assignedTo} onChange={(e) => setInvDraft((d) => ({ ...d, assignedTo: e.target.value }))} placeholder="Player name" className={styles.inputBase} />
                </div>
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
              </div>
              <div className={styles.sectionDivider} />
              <div className={styles.modalFooter}>
                <button className={smallBtnClass('ghost')} onMouseEnter={smallBtnHover} onClick={() => setInvModalOpen(false)}>Cancel</button>
                <button className={smallBtnClass('gold')} onMouseEnter={smallBtnHover} onClick={invSaveDraft}>{invEditingId ? 'Save Changes' : 'Add Item'}</button>
              </div>
            </div>
          </div>
        )}

      </div>{/* end scrollable wrapper */}
    </ShellLayout>
  );
}
