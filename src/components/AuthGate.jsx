import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthContext } from '../auth/AuthContext';
import { getCampaignId, getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';
import { isSupabaseBackend, repository } from '../repository';
import styles from './AuthGate.module.css';

function roleFromMembershipData(data) {
  if (!data) return 'member';
  if (typeof data === 'string') return data || 'member';
  if (Array.isArray(data)) return roleFromMembershipData(data[0]);
  if (typeof data === 'object') return String(data.role || 'member');
  return 'member';
}

async function claimCampaignMembership(supabase, campaignId) {
  const { data, error } = await supabase.rpc('claim_campaign_membership', {
    p_campaign_id: campaignId,
  });
  if (error) {
    const msg = error.message || 'Unable to verify campaign membership.';
    return {
      ok: false,
      message: msg,
      unauthorized: /invite|not invited|allowlist|membership/i.test(msg),
    };
  }
  return { ok: true, role: roleFromMembershipData(data) };
}

async function loadProfile(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id,username,updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message || 'Unable to load profile.' };
  }

  return {
    ok: true,
    profile: data || { user_id: userId, username: '', updated_at: null },
  };
}

export default function AuthGate({ children }) {
  const enabled = isSupabaseBackend;
  const campaignId = getCampaignId();
  const supabase = enabled ? getSupabaseClient() : null;

  const [phase, setPhase] = useState(enabled ? 'boot' : 'ready');
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState('member');
  const [cloudStatus, setCloudStatus] = useState(repository.getCloudStatus());
  const [statusMessage, setStatusMessage] = useState('');
  const [authError, setAuthError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [usernameDraft, setUsernameDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const sessionRunRef = useRef(0);
  const phaseRef = useRef(phase);
  const userIdRef = useRef('');

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const refreshCloudStatus = useCallback(() => {
    setCloudStatus(repository.getCloudStatus());
  }, []);

  const updateUsername = useCallback(
    async (nextUsername) => {
      if (!enabled || !supabase || !session?.user?.id) return null;
      const username = String(nextUsername || '').trim();
      if (!username) throw new Error('Username is required.');

      const { data, error } = await supabase
        .from('profiles')
        .upsert(
          {
            user_id: session.user.id,
            username,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select('user_id,username,updated_at')
        .single();

      if (error) throw new Error(error.message || 'Failed to update username.');

      const nextProfile = data || { user_id: session.user.id, username };
      setProfile(nextProfile);
      return nextProfile;
    },
    [enabled, session, supabase]
  );

  const applySession = useCallback(
    async (nextSession, options = {}) => {
      const silent = !!options.silent;
      const runId = sessionRunRef.current + 1;
      sessionRunRef.current = runId;
      setSession(nextSession || null);
      userIdRef.current = String(nextSession?.user?.id || '');
      setAuthError('');
      setStatusMessage('');

      if (!enabled) {
        setPhase('ready');
        return;
      }

      if (!nextSession?.user?.id) {
        await repository.clearSupabaseSession();
        setProfile(null);
        setRole('member');
        refreshCloudStatus();
        setPhase('signed_out');
        return;
      }

      if (!silent) setPhase('authorizing');
      const memberResult = await claimCampaignMembership(supabase, campaignId);
      if (sessionRunRef.current !== runId) return;
      if (!memberResult.ok) {
        await repository.clearSupabaseSession();
        refreshCloudStatus();
        setAuthError(memberResult.message);
        setPhase(memberResult.unauthorized ? 'unauthorized' : 'error');
        return;
      }

      const nextRole = String(memberResult.role || 'member');
      setRole(nextRole);

      const profileResult = await loadProfile(supabase, nextSession.user.id);
      if (sessionRunRef.current !== runId) return;
      if (!profileResult.ok) {
        await repository.clearSupabaseSession();
        refreshCloudStatus();
        setAuthError(profileResult.message);
        setPhase('error');
        return;
      }

      const nextProfile = profileResult.profile || { user_id: nextSession.user.id, username: '' };
      setProfile(nextProfile);
      setUsernameDraft(String(nextProfile.username || ''));

      if (!String(nextProfile.username || '').trim()) {
        setPhase('username');
        return;
      }

      try {
        await repository.configureSupabaseSession({
          campaignId,
          userId: nextSession.user.id,
          role: nextRole,
          email: nextSession.user.email || '',
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to initialize cloud sync.';
        setAuthError(msg);
        setPhase('error');
        return;
      }

      refreshCloudStatus();
      if (!silent) setPhase('ready');
    },
    [campaignId, enabled, refreshCloudStatus, supabase]
  );

  useEffect(() => {
    if (!enabled) return () => {};
    if (!supabase || !isSupabaseConfigured()) {
      setPhase('error');
      setAuthError('Supabase environment variables are missing.');
      return () => {};
    }

    let active = true;

    const boot = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error) {
        setPhase('error');
        setAuthError(error.message || 'Unable to read auth session.');
        return;
      }
      await applySession(data?.session || null);
    };

    boot();

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      const nextUserId = String(nextSession?.user?.id || '');
      const sameUser = nextUserId && nextUserId === userIdRef.current;
      const shouldSilent =
        phaseRef.current === 'ready' &&
        sameUser &&
        (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'USER_UPDATED');
      applySession(nextSession, { silent: shouldSilent });
    });

    return () => {
      active = false;
      data?.subscription?.unsubscribe();
      repository.clearSupabaseSession();
    };
  }, [applySession, enabled, supabase]);

  const signIn = async (event) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({
      email: String(email || '').trim(),
      password: String(password || ''),
    });
    if (error) setAuthError(error.message || 'Sign in failed.');
    setBusy(false);
  };

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    await repository.clearSupabaseSession();
    setProfile(null);
    setRole('member');
    setEditingUsername(false);
    setUsernameDraft('');
    setStatusMessage('');
    refreshCloudStatus();
    setPhase(enabled ? 'signed_out' : 'ready');
  }, [enabled, refreshCloudStatus, supabase]);

  const saveUsername = async (event) => {
    event.preventDefault();
    setBusy(true);
    setAuthError('');
    try {
      const nextProfile = await updateUsername(usernameDraft);
      setProfile(nextProfile);
      setStatusMessage('Username saved.');
      if (phase === 'username' && session?.user?.id) {
        await repository.configureSupabaseSession({
          campaignId,
          userId: session.user.id,
          role,
          email: session.user.email || '',
        });
        refreshCloudStatus();
        setPhase('ready');
      } else {
        setEditingUsername(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save username.';
      setAuthError(msg);
    }
    setBusy(false);
  };

  const authValue = useMemo(
    () => ({
      enabled,
      session,
      profile,
      role,
      isOwner: role === 'owner',
      cloudStatus,
      signOut,
      updateUsername,
    }),
    [cloudStatus, enabled, profile, role, session, signOut, updateUsername]
  );

  if (!enabled) {
    return <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>;
  }

  if (phase === 'boot' || phase === 'authorizing') {
    return (
      <div className={styles.authShell}>
        <div className={styles.card}>
          <h1 className={styles.title}>Connecting to Campaign</h1>
          <p className={styles.copy}>Checking your account and loading cloud state...</p>
        </div>
      </div>
    );
  }

  if (phase === 'signed_out') {
    return (
      <div className={styles.authShell}>
        <form className={styles.card} onSubmit={signIn}>
          <h1 className={styles.title}>Knights of Avalon</h1>
          <p className={styles.copy}>Sign in with your invited email account.</p>
          <label className={styles.label} htmlFor="login-email">Email</label>
          <input
            id="login-email"
            className={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <label className={styles.label} htmlFor="login-password">Password</label>
          <input
            id="login-password"
            className={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <button className={styles.primaryBtn} type="submit" disabled={busy}>
            {busy ? 'Signing In...' : 'Sign In'}
          </button>
          <p className={styles.hint}>Self-signup is disabled. Ask the DM for an invite.</p>
          {authError && <p className={styles.error}>{authError}</p>}
        </form>
      </div>
    );
  }

  if (phase === 'username') {
    return (
      <div className={styles.authShell}>
        <form className={styles.card} onSubmit={saveUsername}>
          <h1 className={styles.title}>Choose Username</h1>
          <p className={styles.copy}>Set the display name for this campaign account.</p>
          <label className={styles.label} htmlFor="profile-username">Username</label>
          <input
            id="profile-username"
            className={styles.input}
            value={usernameDraft}
            onChange={(e) => setUsernameDraft(e.target.value)}
            maxLength={40}
            required
          />
          <button className={styles.primaryBtn} type="submit" disabled={busy}>
            {busy ? 'Saving...' : 'Continue'}
          </button>
          {authError && <p className={styles.error}>{authError}</p>}
        </form>
      </div>
    );
  }

  if (phase === 'unauthorized') {
    return (
      <div className={styles.authShell}>
        <div className={styles.card}>
          <h1 className={styles.title}>Invite Required</h1>
          <p className={styles.copy}>
            {authError || 'This email is not in the campaign invite list.'}
          </p>
          <button className={styles.primaryBtn} type="button" onClick={signOut}>
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className={styles.authShell}>
        <div className={styles.card}>
          <h1 className={styles.title}>Auth Setup Error</h1>
          <p className={styles.copy}>{authError || 'Unable to initialize authentication.'}</p>
          <button className={styles.primaryBtn} type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={authValue}>
      {children}
      <div className={styles.authHud}>
        {editingUsername ? (
          <form className={styles.hudForm} onSubmit={saveUsername}>
            <input
              className={styles.hudInput}
              value={usernameDraft}
              onChange={(e) => setUsernameDraft(e.target.value)}
              maxLength={40}
              required
            />
            <button className={styles.hudBtn} type="submit" disabled={busy}>Save</button>
            <button
              className={styles.hudBtnGhost}
              type="button"
              onClick={() => {
                setUsernameDraft(String(profile?.username || ''));
                setEditingUsername(false);
              }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <>
            <span className={styles.hudLabel}>
              {profile?.username || 'Unknown'} ({role})
            </span>
            <button className={styles.hudBtnGhost} type="button" onClick={() => setEditingUsername(true)}>
              Edit Username
            </button>
            <button className={styles.hudBtn} type="button" onClick={signOut}>
              Sign Out
            </button>
          </>
        )}
        <span className={styles.syncLabel}>
          {cloudStatus?.queueSize
            ? `${cloudStatus.queueSize} pending`
            : cloudStatus?.connected
              ? 'Synced (realtime)'
              : 'Synced (polling)'}
        </span>
      </div>
      {statusMessage && <div className={styles.toast}>{statusMessage}</div>}
      {cloudStatus?.lastSyncError && <div className={styles.toast}>{cloudStatus.lastSyncError}</div>}
    </AuthContext.Provider>
  );
}
