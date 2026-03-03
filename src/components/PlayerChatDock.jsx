import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getCampaignId, getSupabaseClient } from '../lib/supabaseClient';
import styles from './PlayerChatDock.module.css';

const INITIAL_LOAD_LIMIT = 120;
const MAX_RENDERED_MESSAGES = 200;
const MAX_MESSAGE_LENGTH = 1000;

function normalizeText(value) {
  return String(value ?? '').trim();
}

function emailLocalPart(email) {
  const normalized = normalizeText(email).toLowerCase();
  if (!normalized) return '';
  return normalized.split('@')[0] || '';
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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

export default function PlayerChatDock({ panelType }) {
  const { enabled, session, profile, canWriteData } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const listRef = useRef(null);
  const openRef = useRef(open);

  const campaignId = useMemo(() => getCampaignId(), []);
  const supabase = useMemo(() => (enabled ? getSupabaseClient() : null), [enabled]);
  const currentUserId = normalizeText(session?.user?.id);
  const hasSession = !!currentUserId;
  const canSend = hasSession && canWriteData;

  const authorDisplay = useMemo(() => {
    const username = normalizeText(profile?.username);
    if (username) return username;
    const fallback = emailLocalPart(session?.user?.email);
    if (fallback) return fallback;
    return 'Player';
  }, [profile?.username, session?.user?.email]);

  useEffect(() => {
    openRef.current = open;
    if (open) setUnreadCount(0);
  }, [open]);

  useEffect(() => {
    if (!enabled || !supabase || !campaignId || !hasSession) {
      setMessages([]);
      setLoading(false);
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

          setMessages((prev) => upsertMessage(prev, incoming));
          if (!openRef.current && normalizeText(incoming.author_user_id) !== currentUserId) {
            setUnreadCount((prev) => Math.min(prev + 1, 99));
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
          .select('id,campaign_id,author_user_id,author_display,body,created_at')
          .eq('campaign_id', campaignId)
          .order('created_at', { ascending: false })
          .limit(INITIAL_LOAD_LIMIT);

        if (queryError) throw queryError;
        if (!active) return;
        const ordered = (Array.isArray(data) ? data : []).slice().reverse();
        setMessages(ordered);
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
  }, [campaignId, currentUserId, enabled, hasSession, supabase]);

  useEffect(() => {
    if (!open) return;
    setUnreadCount(0);
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, open]);

  if (!enabled || panelType === 'menu') return null;

  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) setUnreadCount(0);
      return next;
    });
  };

  const sendMessage = async () => {
    const body = normalizeText(draft);
    if (!canSend || !supabase || !campaignId || !body || sending) return;

    if (body.length > MAX_MESSAGE_LENGTH) {
      setError(`Message is too long (${body.length}/${MAX_MESSAGE_LENGTH}).`);
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
          body,
        })
        .select('id,campaign_id,author_user_id,author_display,body,created_at')
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

  return (
    <div className={styles.dock}>
      {!open ? (
        <button type="button" className={styles.toggleButton} onClick={toggleOpen}>
          Party Chat
          {unreadCount > 0 ? <span className={styles.unreadBadge}>{unreadCount}</span> : null}
        </button>
      ) : (
        <section className={styles.panel} aria-label="Party chat">
          <header className={styles.header}>
            <h2 className={styles.title}>Party Chat</h2>
            <button type="button" className={styles.closeButton} onClick={toggleOpen}>Close</button>
          </header>

          <div ref={listRef} className={styles.messageList}>
            {loading ? <p className={styles.status}>Loading recent messages...</p> : null}
            {!loading && messages.length === 0 ? <p className={styles.status}>No messages yet.</p> : null}
            {messages.map((message) => {
              const mine = normalizeText(message.author_user_id) === currentUserId;
              return (
                <article key={message.id} className={`${styles.message} ${mine ? styles.mine : styles.other}`}>
                  <div className={styles.meta}>
                    <span className={styles.author}>{normalizeText(message.author_display) || 'Player'}</span>
                    <time className={styles.time} dateTime={message.created_at}>{formatTime(message.created_at)}</time>
                  </div>
                  <p className={styles.body}>{String(message.body ?? '')}</p>
                </article>
              );
            })}
          </div>

          <div className={styles.composer}>
            {!hasSession ? <p className={styles.hint}>Sign in with an invited account to join chat.</p> : null}
            {hasSession && !canWriteData ? <p className={styles.hint}>Guest mode is read-only.</p> : null}
            <textarea
              className={styles.input}
              rows={2}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder="Message the party..."
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
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
            {error ? <p className={styles.error}>{error}</p> : null}
          </div>
        </section>
      )}
    </div>
  );
}
