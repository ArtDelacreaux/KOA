import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getCampaignId, getSupabaseClient } from '../lib/supabaseClient';
import styles from './PlayerChatDock.module.css';
import chatNotifSfx from '../assets/Sound Effects/chatnotif.mp3';
import dmNotifSfx from '../assets/Sound Effects/dmnotif.mp3';
import arlisChatGif from '../assets/Chat Anim/arlisChat.gif';
import willChatGif from '../assets/Chat Anim/willChat.gif';

const INITIAL_LOAD_LIMIT = 120;
const MAX_RENDERED_MESSAGES = 200;
const MAX_MESSAGE_LENGTH = 1000;
const PARTY_THREAD_ID = 'party';
const CHAT_PANEL_SIZE_KEY = 'koa:chat:panel:size:v1';
const PANEL_MIN_WIDTH = 420;
const PANEL_MIN_HEIGHT = 420;
const PANEL_MARGIN = 24;
const PANEL_DEFAULT_SIZE = { width: 680, height: 620 };
const CHAT_ANIM_BY_NAME_KEY = {
  arlis: arlisChatGif,
  arlisghoth: arlisChatGif,
  william: willChatGif,
  will: willChatGif,
  williamspicer: willChatGif,
};

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeNameKey(value) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeRole(value) {
  const role = normalizeText(value).toLowerCase();
  if (role === 'owner' || role === 'dm') return role;
  return 'member';
}

function getChatAnimForName(value) {
  const key = normalizeNameKey(value);
  if (!key) return '';
  if (CHAT_ANIM_BY_NAME_KEY[key]) return CHAT_ANIM_BY_NAME_KEY[key];
  if (key.includes('arlis')) return CHAT_ANIM_BY_NAME_KEY.arlis;
  if (key.includes('william') || key.includes('will')) return CHAT_ANIM_BY_NAME_KEY.william;
  return '';
}

function isWilliamName(value) {
  const key = normalizeNameKey(value);
  if (!key) return false;
  return key === 'will' || key === 'william' || key === 'williamspicer' || key.includes('william');
}

function tryPlayAudio(audio, { reset = true } = {}) {
  if (!audio) return Promise.resolve(false);

  if (reset) {
    try {
      audio.currentTime = 0;
    } catch {}
  }

  try {
    const playResult = audio.play();
    if (playResult && typeof playResult.then === 'function') {
      return playResult.then(() => true).catch(() => false);
    }
    return Promise.resolve(true);
  } catch {
    return Promise.resolve(false);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function canViewMessage(row, currentUserId) {
  const recipientUserId = normalizeText(row?.recipient_user_id);
  if (!recipientUserId) return true;
  const authorUserId = normalizeText(row?.author_user_id);
  return recipientUserId === currentUserId || authorUserId === currentUserId;
}

function toDmThreadId(userId) {
  const normalized = normalizeText(userId);
  return normalized ? `dm:${normalized}` : '';
}

function getDmUserIdFromThreadId(threadId) {
  const normalized = normalizeText(threadId);
  if (!normalized.startsWith('dm:')) return '';
  return normalizeText(normalized.slice(3));
}

function getThreadIdForMessage(message, currentUserId) {
  const recipientUserId = normalizeText(message?.recipient_user_id);
  if (!recipientUserId) return PARTY_THREAD_ID;
  const authorUserId = normalizeText(message?.author_user_id);
  const otherUserId = authorUserId === currentUserId ? recipientUserId : authorUserId;
  return toDmThreadId(otherUserId) || PARTY_THREAD_ID;
}

function previewText(value, maxLen = 42) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return 'No messages yet.';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 3)}...`;
}

function upsertMessage(list, row) {
  if (!row || row.id == null) return list;
  if (list.some((item) => item.id === row.id)) return list;

  const next = [...list, row].sort((a, b) => {
    const left = new Date(a.created_at).getTime();
    const right = new Date(b.created_at).getTime();
    if (left !== right) return left - right;
    return Number(a.id) - Number(b.id);
  });

  if (next.length <= MAX_RENDERED_MESSAGES) return next;
  return next.slice(next.length - MAX_RENDERED_MESSAGES);
}

function loadStoredPanelSize() {
  if (typeof window === 'undefined') return PANEL_DEFAULT_SIZE;
  try {
    const raw = localStorage.getItem(CHAT_PANEL_SIZE_KEY);
    if (!raw) return PANEL_DEFAULT_SIZE;
    const parsed = JSON.parse(raw);
    const width = Number(parsed?.width);
    const height = Number(parsed?.height);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return PANEL_DEFAULT_SIZE;
    return { width, height };
  } catch {
    return PANEL_DEFAULT_SIZE;
  }
}

export default function PlayerChatDock({ mode = 'dock' }) {
  const isPopoutMode = mode === 'popout';
  const canResizePanel = !isPopoutMode;
  const { enabled, session, profile, canWriteData, isGuest, signOut, updateUsername } = useAuth();
  const [open, setOpen] = useState(() => isPopoutMode);
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState(PARTY_THREAD_ID);
  const [unreadByThread, setUnreadByThread] = useState({});
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [panelSize, setPanelSize] = useState(() => loadStoredPanelSize());
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef(null);
  const listRef = useRef(null);
  const openRef = useRef(open);
  const selectedThreadRef = useRef(selectedThreadId);
  const resizeStartRef = useRef(null);
  const chatNotifRef = useRef(null);
  const dmNotifRef = useRef(null);
  const audioUnlockedRef = useRef(false);

  const campaignId = useMemo(() => getCampaignId(), []);
  const supabase = useMemo(() => (enabled ? getSupabaseClient() : null), [enabled]);
  const currentUserId = normalizeText(session?.user?.id);
  const hasSession = !!currentUserId;
  const canSend = hasSession && canWriteData;

  const authorDisplay = useMemo(() => {
    const username = normalizeText(profile?.username);
    if (username) return username;
    return 'Player';
  }, [profile?.username]);

  const accountLabel = useMemo(() => {
    const username = normalizeText(profile?.username);
    if (username) return username;
    return isGuest ? 'Guest' : 'Unknown';
  }, [isGuest, profile?.username]);

  const clampPanelSize = useCallback((size) => {
    const maxWidth = Math.max(300, window.innerWidth - PANEL_MARGIN);
    const maxHeight = Math.max(280, window.innerHeight - PANEL_MARGIN);
    const minWidth = Math.min(PANEL_MIN_WIDTH, maxWidth);
    const minHeight = Math.min(PANEL_MIN_HEIGHT, maxHeight);
    return {
      width: Math.round(clamp(size.width, minWidth, maxWidth)),
      height: Math.round(clamp(size.height, minHeight, maxHeight)),
    };
  }, []);

  const displayNameByUserId = useMemo(() => {
    const map = new Map();
    if (currentUserId) map.set(currentUserId, authorDisplay);
    members.forEach((member) => {
      if (member.userId) map.set(member.userId, member.label);
    });
    return map;
  }, [authorDisplay, currentUserId, members]);

  const roleByUserId = useMemo(() => {
    const map = new Map();
    members.forEach((member) => {
      if (member.userId) map.set(member.userId, member.role);
    });
    return map;
  }, [members]);

  const primeNotificationAudio = useCallback(() => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;

    const prime = (audio) => {
      if (!audio) return;
      const wasMuted = audio.muted;
      audio.muted = true;
      tryPlayAudio(audio, { reset: false }).finally(() => {
        try {
          audio.pause();
        } catch {}
        try {
          audio.currentTime = 0;
        } catch {}
        audio.muted = wasMuted;
      });
    };

    prime(chatNotifRef.current);
    prime(dmNotifRef.current);
  }, []);

  const playIncomingNotification = useCallback((isDmMessage) => {
    const primary = isDmMessage ? dmNotifRef.current : chatNotifRef.current;
    const fallback = isDmMessage ? chatNotifRef.current : dmNotifRef.current;
    tryPlayAudio(primary).then((played) => {
      if (played) return;
      tryPlayAudio(fallback);
    });
  }, []);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    if (isPopoutMode) setOpen(true);
  }, [isPopoutMode]);

  useEffect(() => {
    if (editingUsername) return;
    setUsernameDraft(normalizeText(profile?.username));
  }, [editingUsername, profile?.username]);

  useEffect(() => {
    if (!canResizePanel || typeof window === 'undefined') return;
    setPanelSize((prev) => clampPanelSize(prev));
    const onWindowResize = () => {
      setPanelSize((prev) => clampPanelSize(prev));
    };
    window.addEventListener('resize', onWindowResize);
    return () => {
      window.removeEventListener('resize', onWindowResize);
    };
  }, [canResizePanel, clampPanelSize]);

  useEffect(() => {
    if (!canResizePanel || typeof window === 'undefined') return;
    try {
      localStorage.setItem(CHAT_PANEL_SIZE_KEY, JSON.stringify(panelSize));
    } catch {}
  }, [canResizePanel, panelSize]);

  useEffect(() => {
    if (!canResizePanel || !isResizing) return () => {};
    const onPointerMove = (event) => {
      const start = resizeStartRef.current;
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const next = clampPanelSize({
        width: start.width - dx,
        height: start.height - dy,
      });
      setPanelSize(next);
    };
    const onPointerUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [canResizePanel, clampPanelSize, isResizing]);

  useEffect(() => {
    selectedThreadRef.current = selectedThreadId;
  }, [selectedThreadId]);

  useEffect(() => {
    if (typeof window === 'undefined') return () => {};
    const onUserInteract = () => {
      primeNotificationAudio();
      window.removeEventListener('pointerdown', onUserInteract, true);
      window.removeEventListener('keydown', onUserInteract, true);
      window.removeEventListener('touchstart', onUserInteract, true);
    };

    window.addEventListener('pointerdown', onUserInteract, true);
    window.addEventListener('keydown', onUserInteract, true);
    window.addEventListener('touchstart', onUserInteract, true);

    return () => {
      window.removeEventListener('pointerdown', onUserInteract, true);
      window.removeEventListener('keydown', onUserInteract, true);
      window.removeEventListener('touchstart', onUserInteract, true);
    };
  }, [primeNotificationAudio]);

  useEffect(() => {
    if (!open) return;
    setUnreadByThread((prev) => {
      if (!prev[selectedThreadId]) return prev;
      const next = { ...prev };
      delete next[selectedThreadId];
      return next;
    });
  }, [open, selectedThreadId]);

  useEffect(() => {
    if (!enabled || !supabase || !campaignId || !hasSession) {
      setMembers([]);
      setMembersLoading(false);
      setSelectedThreadId(PARTY_THREAD_ID);
      return () => {};
    }

    let active = true;
    const loadMembers = async () => {
      setMembersLoading(true);
      try {
        const { data, error: memberError } = await supabase.rpc('list_campaign_member_directory', {
          p_campaign_id: campaignId,
        });

        if (memberError) throw memberError;
        if (!active) return;

        const memberRows = Array.isArray(data) ? data : [];

        const seen = new Set();
        const nextMembers = memberRows
          .map((row, index) => {
            const userId = normalizeText(row?.user_id);
            if (!userId || userId === currentUserId) return null;
            if (seen.has(userId)) return null;
            seen.add(userId);

            const username = normalizeText(row?.username);
            const label = username || `Member ${index + 1}`;
            const role = normalizeRole(row?.role);
            return { userId, label, role };
          })
          .filter(Boolean)
          .sort((a, b) => a.label.localeCompare(b.label));

        if (!active) return;
        setMembers(nextMembers);
      } catch {
        if (!active) return;
        setMembers([]);
      } finally {
        if (active) setMembersLoading(false);
      }
    };

    loadMembers();
    return () => {
      active = false;
    };
  }, [campaignId, currentUserId, enabled, hasSession, supabase]);

  useEffect(() => {
    const activeDmUserId = getDmUserIdFromThreadId(selectedThreadId);
    if (!activeDmUserId) return;
    if (members.some((member) => member.userId === activeDmUserId)) return;
    setSelectedThreadId(PARTY_THREAD_ID);
  }, [members, selectedThreadId]);

  useEffect(() => {
    if (!enabled || !supabase || !campaignId || !hasSession) {
      setMessages([]);
      setLoading(false);
      setUnreadByThread({});
      return () => {};
    }

    let active = true;
    const channel = supabase
      .channel(`koa-chat:${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          const incoming = payload.new;
          if (!active || !incoming || incoming.id == null) return;
          if (!canViewMessage(incoming, currentUserId)) return;

          const incomingAuthorUserId = normalizeText(incoming.author_user_id);
          const isIncomingFromAnotherUser = incomingAuthorUserId && incomingAuthorUserId !== currentUserId;
          if (isIncomingFromAnotherUser) {
            const incomingRole = roleByUserId.get(incomingAuthorUserId);
            playIncomingNotification(incomingRole === 'dm');
          }

          setMessages((prev) => upsertMessage(prev, incoming));
          if (!openRef.current && isIncomingFromAnotherUser) {
            const threadId = getThreadIdForMessage(incoming, currentUserId);
            setUnreadByThread((prev) => {
              const nextValue = Math.min((prev[threadId] || 0) + 1, 99);
              return { ...prev, [threadId]: nextValue };
            });
          } else if (openRef.current && isIncomingFromAnotherUser) {
            const threadId = getThreadIdForMessage(incoming, currentUserId);
            if (selectedThreadRef.current !== threadId) {
              setUnreadByThread((prev) => {
                const nextValue = Math.min((prev[threadId] || 0) + 1, 99);
                return { ...prev, [threadId]: nextValue };
              });
            }
          }
        }
      )
      .subscribe((status) => {
        if (!active) return;
        if (status === 'CHANNEL_ERROR') {
          setError('Live chat disconnected. Refresh to reconnect.');
        }
      });

    const loadRecent = async () => {
      setLoading(true);
      setError('');
      try {
        const { data, error: queryError } = await supabase
          .from('chat_messages')
          .select('id,campaign_id,author_user_id,author_display,recipient_user_id,body,created_at')
          .eq('campaign_id', campaignId)
          .order('created_at', { ascending: false })
          .limit(INITIAL_LOAD_LIMIT);

        if (queryError) throw queryError;
        if (!active) return;
        const ordered = (Array.isArray(data) ? data : []).slice().reverse();
        setMessages(ordered.filter((message) => canViewMessage(message, currentUserId)));
      } catch (err) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'Failed to load chat messages.';
        setError(msg);
        setMessages([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadRecent();
    return () => {
      active = false;
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [campaignId, currentUserId, enabled, hasSession, playIncomingNotification, roleByUserId, supabase]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, open, selectedThreadId]);


  const totalUnread = Object.values(unreadByThread).reduce((sum, value) => sum + Number(value || 0), 0);
  const selectedRecipientId = getDmUserIdFromThreadId(selectedThreadId);

  const threadItems = useMemo(() => {
    const latestByThreadId = new Map();
    messages.forEach((message) => {
      latestByThreadId.set(getThreadIdForMessage(message, currentUserId), message);
    });

    const partyLatest = latestByThreadId.get(PARTY_THREAD_ID);
    const items = [
      {
        id: PARTY_THREAD_ID,
        label: 'Party Chat',
        subtitle: 'Everyone',
        latest: partyLatest,
      },
    ];

    members.forEach((member) => {
      const id = toDmThreadId(member.userId);
      items.push({
        id,
        label: member.label,
        subtitle: 'Direct Message',
        latest: latestByThreadId.get(id),
      });
    });

    return items;
  }, [currentUserId, members, messages]);

  const activeThreadMessages = useMemo(
    () => messages.filter((message) => getThreadIdForMessage(message, currentUserId) === selectedThreadId),
    [currentUserId, messages, selectedThreadId]
  );

  const selectedThreadTitle = useMemo(() => {
    if (selectedThreadId === PARTY_THREAD_ID) return 'Party Chat';
    const selectedMember = members.find((member) => member.userId === selectedRecipientId);
    return selectedMember?.label || 'Direct Message';
  }, [members, selectedRecipientId, selectedThreadId]);

  const selectedThreadMode = selectedThreadId === PARTY_THREAD_ID ? 'Party' : 'Private';
  const chatBackgroundAnims = useMemo(() => {
    if (selectedThreadId === PARTY_THREAD_ID) return { left: '', right: '', leftFlip: false };
    return {
      left: getChatAnimForName(authorDisplay),
      right: getChatAnimForName(selectedThreadTitle),
      leftFlip: isWilliamName(authorDisplay),
    };
  }, [authorDisplay, selectedThreadId, selectedThreadTitle]);

  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        setUnreadByThread((current) => {
          if (!current[selectedThreadId]) return current;
          const reduced = { ...current };
          delete reduced[selectedThreadId];
          return reduced;
        });
      }
      return next;
    });
  };

  const requestPopout = () => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('chat', 'popout');
    const popout = window.open(
      url.toString(),
      'koa-chat-popout',
      'popup=yes,width=980,height=760,resizable=yes,scrollbars=no'
    );
    if (popout) {
      // Minimize in-app chat once popout is active.
      setOpen(false);
      setIsResizing(false);
      popout.focus();
      return;
    }
    setError('Popout window was blocked by the browser.');
  };

  const closePopoutWindow = () => {
    if (typeof window === 'undefined') return;
    window.close();
    if (!window.closed) setError('Close this chat tab/window manually.');
  };

  const saveHeaderUsername = async (event) => {
    event.preventDefault();
    const nextUsername = normalizeText(usernameDraft);
    if (!nextUsername) {
      setError('Username is required.');
      return;
    }
    setAccountBusy(true);
    setError('');
    try {
      await updateUsername(nextUsername);
      setEditingUsername(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save username.';
      setError(msg);
    } finally {
      setAccountBusy(false);
    }
  };

  const handleHeaderSignOut = async () => {
    setAccountBusy(true);
    setError('');
    try {
      await signOut();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to sign out.';
      setError(msg);
    } finally {
      setAccountBusy(false);
    }
  };

  const sendMessage = async () => {
    const body = normalizeText(draft);
    const targetUserId = selectedThreadId === PARTY_THREAD_ID ? '' : normalizeText(selectedRecipientId);
    if (!canSend || !supabase || !campaignId || !body || sending) return;

    if (body.length > MAX_MESSAGE_LENGTH) {
      setError(`Message is too long (${body.length}/${MAX_MESSAGE_LENGTH}).`);
      return;
    }

    if (targetUserId && targetUserId === currentUserId) {
      setError('Cannot send a private message to yourself.');
      return;
    }

    if (targetUserId && !members.some((member) => member.userId === targetUserId)) {
      setError('Selected member is no longer available.');
      return;
    }

    setSending(true);
    setError('');
    try {
      const { data, error: insertError } = await supabase
        .from('chat_messages')
        .insert({
          campaign_id: campaignId,
          author_user_id: currentUserId,
          author_display: authorDisplay,
          recipient_user_id: targetUserId || null,
          body,
        })
        .select('id,campaign_id,author_user_id,author_display,recipient_user_id,body,created_at')
        .single();

      if (insertError) throw insertError;
      setMessages((prev) => upsertMessage(prev, data));
      setDraft('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send chat message.';
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  const beginResize = (event) => {
    if (!canResizePanel) return;
    if (event.button !== 0) return;
    if (!panelRef.current) return;
    event.preventDefault();
    const rect = panelRef.current.getBoundingClientRect();
    resizeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      width: rect.width,
      height: rect.height,
    };
    setIsResizing(true);
  };

  const panelInlineStyle = {
    width: canResizePanel ? `${panelSize.width}px` : '100%',
    height: canResizePanel ? `${panelSize.height}px` : '100%',
  };

  if (!enabled) return null;

  return (
    <div className={`${styles.dock}${isPopoutMode ? ` ${styles.dockPopout}` : ''}`}>
      <audio ref={chatNotifRef} src={chatNotifSfx} preload="auto" />
      <audio ref={dmNotifRef} src={dmNotifSfx} preload="auto" />
      {!open && !isPopoutMode ? (
        <button type="button" className={styles.toggleButton} onClick={toggleOpen}>
          Chats
          {totalUnread > 0 ? <span className={styles.unreadBadge}>{totalUnread}</span> : null}
        </button>
      ) : (
        <section
          ref={panelRef}
          className={`${styles.panel}${isResizing ? ` ${styles.panelResizing}` : ''}${isPopoutMode ? ` ${styles.panelPopout}` : ''}`}
          style={panelInlineStyle}
          aria-label="Party chat"
        >
          <header className={styles.header}>
            <h2 className={styles.title}>{isPopoutMode ? 'Campaign Chat Popout' : 'Campaign Chat'}</h2>
            <div className={styles.headerActions}>
              {!isPopoutMode ? (
                <button type="button" className={styles.popoutButton} onClick={requestPopout}>
                  Popout
                </button>
              ) : null}
              <button
                type="button"
                className={styles.closeButton}
                onClick={isPopoutMode ? closePopoutWindow : toggleOpen}
              >
                {isPopoutMode ? 'Close Window' : 'Close'}
              </button>
            </div>
          </header>

          <div className={styles.workspace}>
            <aside className={styles.threadList} aria-label="Chat threads">
              <div className={styles.threadScrollArea}>
                {threadItems.map((thread) => {
                  const unread = unreadByThread[thread.id] || 0;
                  return (
                    <button
                      key={thread.id}
                      type="button"
                      className={`${styles.threadButton}${thread.id === selectedThreadId ? ` ${styles.threadButtonActive}` : ''}`}
                      onClick={() => {
                        setSelectedThreadId(thread.id);
                        setUnreadByThread((prev) => {
                          if (!prev[thread.id]) return prev;
                          const next = { ...prev };
                          delete next[thread.id];
                          return next;
                        });
                      }}
                    >
                      <span className={styles.threadTop}>
                        <span className={styles.threadName}>{thread.label}</span>
                        {unread > 0 ? <span className={styles.threadUnread}>{unread}</span> : null}
                      </span>
                      <span className={styles.threadSubtitle}>{thread.subtitle}</span>
                      <span className={styles.threadPreview}>{previewText(thread.latest?.body)}</span>
                      {thread.latest?.created_at ? (
                        <time className={styles.threadTime} dateTime={thread.latest.created_at}>
                          {formatTime(thread.latest.created_at)}
                        </time>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {!isPopoutMode ? (
                <div className={styles.threadAccountFooter}>
                  {editingUsername ? (
                    <form className={`${styles.accountBar} ${styles.accountBarSidebar}`} onSubmit={saveHeaderUsername}>
                      <input
                        className={styles.accountInput}
                        value={usernameDraft}
                        onChange={(event) => setUsernameDraft(event.target.value)}
                        maxLength={40}
                        required
                      />
                      <button type="submit" className={styles.accountButton} disabled={accountBusy}>Save</button>
                      <button
                        type="button"
                        className={styles.accountButtonGhost}
                        onClick={() => {
                          setUsernameDraft(normalizeText(profile?.username));
                          setEditingUsername(false);
                        }}
                        disabled={accountBusy}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div className={`${styles.accountBar} ${styles.accountBarSidebar}`}>
                      {!isGuest ? (
                        <button
                          type="button"
                          className={styles.accountNameButton}
                          onClick={() => setEditingUsername(true)}
                          disabled={accountBusy}
                        >
                          {accountLabel}
                        </button>
                      ) : (
                        <span className={styles.accountLabel}>{accountLabel}</span>
                      )}
                      <button
                        type="button"
                        className={styles.accountButton}
                        onClick={handleHeaderSignOut}
                        disabled={accountBusy}
                      >
                        {isGuest ? 'Exit Guest' : 'Sign Out'}
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </aside>

            <section className={styles.conversation}>
              <div className={styles.conversationHeader}>
                <h3 className={styles.conversationTitle}>{selectedThreadTitle}</h3>
                <span className={styles.modeBadge}>{selectedThreadMode}</span>
              </div>

              <div className={styles.messageListWrap}>
                <div className={styles.chatAnimLayer} aria-hidden="true">
                  {chatBackgroundAnims.left ? (
                    <span
                      className={`${styles.chatAnim} ${styles.chatAnimLeft} ${chatBackgroundAnims.leftFlip ? styles.chatAnimFlip : ''}`}
                      style={{ backgroundImage: `url("${chatBackgroundAnims.left}")` }}
                    />
                  ) : null}
                  {chatBackgroundAnims.right ? (
                    <span
                      className={`${styles.chatAnim} ${styles.chatAnimRight}`}
                      style={{ backgroundImage: `url("${chatBackgroundAnims.right}")` }}
                    />
                  ) : null}
                </div>
                <div ref={listRef} className={styles.messageList}>
                  {loading ? <p className={styles.status}>Loading recent messages...</p> : null}
                  {!loading && activeThreadMessages.length === 0 ? <p className={styles.status}>No messages yet.</p> : null}
                  {activeThreadMessages.map((message) => {
                    const authorUserId = normalizeText(message.author_user_id);
                    const mine = authorUserId === currentUserId;
                    const recipientUserId = normalizeText(message.recipient_user_id);
                    const isPrivate = !!recipientUserId;
                    const authorLabel =
                      normalizeText(message.author_display) ||
                      displayNameByUserId.get(authorUserId) ||
                      'Player';
                    const targetLabel = displayNameByUserId.get(recipientUserId) || 'member';

                    return (
                      <article key={message.id} className={`${styles.message} ${mine ? styles.mine : styles.other}`}>
                        <div className={styles.meta}>
                          <span className={styles.author}>{authorLabel}</span>
                          <div className={styles.metaRight}>
                            {isPrivate ? (
                              <span className={styles.privateBadge}>
                                {mine ? `Private to ${targetLabel}` : 'Private'}
                              </span>
                            ) : (
                              <span className={styles.partyBadge}>Party</span>
                            )}
                            <time className={styles.time} dateTime={message.created_at}>{formatTime(message.created_at)}</time>
                          </div>
                        </div>
                        <p className={styles.body}>{String(message.body ?? '')}</p>
                      </article>
                    );
                  })}
                </div>
              </div>

              <div className={styles.composer}>
                {!hasSession ? <p className={styles.hint}>Sign in with an invited account to join chat.</p> : null}
                {hasSession && !canWriteData ? <p className={styles.hint}>Guest mode is read-only.</p> : null}
                {membersLoading ? <p className={styles.hint}>Loading member threads...</p> : null}
                <textarea
                  className={styles.input}
                  rows={2}
                  maxLength={MAX_MESSAGE_LENGTH}
                  placeholder={selectedThreadId === PARTY_THREAD_ID ? 'Message the party...' : `Message ${selectedThreadTitle}...`}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      sendMessage();
                    }
                  }}
                  disabled={!canSend || sending}
                />
                <div className={styles.composerFooter}>
                  <span className={styles.counter}>{draft.length}/{MAX_MESSAGE_LENGTH}</span>
                  <button type="button" className={styles.sendButton} onClick={sendMessage} disabled={!canSend || sending || !normalizeText(draft)}>
                    {sending ? 'Sending...' : (selectedThreadId === PARTY_THREAD_ID ? 'Send' : 'Send Private')}
                  </button>
                </div>
                {error ? <p className={styles.error}>{error}</p> : null}
              </div>
            </section>
          </div>
          {canResizePanel ? (
            <button
              type="button"
              className={styles.resizeHandle}
              aria-label="Resize chat window"
              onPointerDown={beginResize}
            />
          ) : null}
        </section>
      )}
    </div>
  );
}
