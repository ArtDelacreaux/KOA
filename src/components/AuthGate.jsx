import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthContext } from '../auth/AuthContext';
import { getCampaignId, getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';
import { isSupabaseBackend, repository } from '../repository';
import styles from './AuthGate.module.css';

const VALID_CAMPAIGN_ROLES = new Set(['owner', 'dm', 'member']);
const GUEST_PROFILE = { user_id: 'guest', username: 'Guest', updated_at: null };
const MIN_PASSWORD_LENGTH = 8;

function normalizeCampaignRole(value) {
  const role = String(value || 'member').trim().toLowerCase();
  return VALID_CAMPAIGN_ROLES.has(role) ? role : 'member';
}

function roleFromMembershipData(data) {
  if (!data) return 'member';
  if (typeof data === 'string') return normalizeCampaignRole(data);
  if (Array.isArray(data)) return roleFromMembershipData(data[0]);
  if (typeof data === 'object') return normalizeCampaignRole(data.role);
  return 'member';
}

function parseAuthParamsFromWindow() {
  if (typeof window === 'undefined') return new URLSearchParams();
  const query = String(window.location.search || '').replace(/^\?/, '');
  const hash = String(window.location.hash || '').replace(/^#/, '');
  return new URLSearchParams([query, hash].filter(Boolean).join('&'));
}

function hasRecoveryIntentInUrl() {
  return String(parseAuthParamsFromWindow().get('type') || '').toLowerCase() === 'recovery';
}

function clearRecoveryIntentFromUrl() {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const current = new URL(window.location.href);
  current.hash = '';
  [
    'type',
    'token',
    'token_hash',
    'access_token',
    'refresh_token',
    'expires_in',
    'expires_at',
    'token_type',
    'code',
  ].forEach((name) => current.searchParams.delete(name));
  window.history.replaceState({}, document.title, `${current.pathname}${current.search}`);
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

async function resolveSignInEmail(supabase, campaignId, rawIdentifier) {
  const identifier = String(rawIdentifier || '').trim();
  if (!identifier) throw new Error('Email or username is required.');
  if (identifier.includes('@')) return identifier.toLowerCase();

  const { data, error } = await supabase.rpc('resolve_login_email', {
    p_campaign_id: campaignId,
    p_identifier: identifier,
  });
  if (error) throw new Error(error.message || 'Unable to resolve username.');

  const resolved = String(data || '').trim().toLowerCase();
  if (!resolved) throw new Error('Username not found for this campaign.');
  return resolved;
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
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [recoveryPending, setRecoveryPending] = useState(() => hasRecoveryIntentInUrl());
  const [usernameDraft, setUsernameDraft] = useState('');
  const [guestMode, setGuestMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const sessionRunRef = useRef(0);
  const phaseRef = useRef(phase);
  const userIdRef = useRef('');
  const recoveryPendingRef = useRef(recoveryPending);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    recoveryPendingRef.current = recoveryPending;
  }, [recoveryPending]);

  const refreshCloudStatus = useCallback(() => {
    setCloudStatus(repository.getCloudStatus());
  }, []);

  useEffect(() => {
    if (typeof repository?.setWriteAccess !== 'function') return;
    if (!enabled) {
      repository.setWriteAccess({ enabled: true, reason: '' });
      return;
    }
    if (guestMode) {
      repository.setWriteAccess({ enabled: false, reason: 'guest-read-only' });
      return;
    }
    if (phase === 'ready') {
      repository.setWriteAccess({ enabled: true, reason: '' });
      return;
    }
    repository.setWriteAccess({ enabled: false, reason: 'auth-required' });
  }, [enabled, guestMode, phase]);

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
      const isRecoveryFlow = !!options.recovery || recoveryPendingRef.current;
      const runId = sessionRunRef.current + 1;
      sessionRunRef.current = runId;
      setSession(nextSession || null);
      userIdRef.current = String(nextSession?.user?.id || '');
      setAuthError('');
      setAuthMessage('');

      if (!enabled) {
        setPhase('ready');
        return;
      }

      if (!nextSession?.user?.id) {
        await repository.clearSupabaseSession();
        setProfile(null);
        setRole('member');
        if (isRecoveryFlow) setRecoveryPending(hasRecoveryIntentInUrl());
        refreshCloudStatus();
        setPhase('signed_out');
        return;
      }

      if (isRecoveryFlow) {
        setRecoveryPending(true);
        setPhase('password_reset');
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

      const nextRole = normalizeCampaignRole(memberResult.role);
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
    if (guestMode) return () => {};
    if (!supabase || !isSupabaseConfigured()) {
      setPhase('error');
      setAuthError('Supabase environment variables are missing.');
      return () => {};
    }

    let active = true;

    const boot = async () => {
      const recoveryFromUrl = hasRecoveryIntentInUrl();
      if (recoveryFromUrl) setRecoveryPending(true);
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error) {
        setPhase('error');
        setAuthError(error.message || 'Unable to read auth session.');
        return;
      }
      await applySession(data?.session || null, { recovery: recoveryFromUrl });
    };

    boot();

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryPending(true);
        setGuestMode(false);
      }
      if (event === 'SIGNED_OUT') {
        setRecoveryPending(false);
        setNewPassword('');
        setConfirmNewPassword('');
      }
      const recoveryFromUrl = hasRecoveryIntentInUrl();
      if (recoveryFromUrl) setRecoveryPending(true);
      const isRecoveryFlow = event === 'PASSWORD_RECOVERY' || recoveryFromUrl || recoveryPendingRef.current;
      const nextUserId = String(nextSession?.user?.id || '');
      const sameUser = nextUserId && nextUserId === userIdRef.current;
      const shouldSilent =
        !isRecoveryFlow &&
        phaseRef.current === 'ready' &&
        sameUser &&
        (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'USER_UPDATED');
      applySession(nextSession, { silent: shouldSilent, recovery: isRecoveryFlow });
    });

    return () => {
      active = false;
      data?.subscription?.unsubscribe();
      repository.clearSupabaseSession();
    };
  }, [applySession, enabled, guestMode, supabase]);

  useEffect(() => {
    if (!enabled || !guestMode) return () => {};
    if (!supabase || !isSupabaseConfigured()) return () => {};

    let cancelled = false;
    const setupGuestReadSync = async () => {
      try {
        await repository.configureSupabaseSession({
          campaignId,
          userId: '',
          role: 'guest',
          email: '',
          readOnlyShared: true,
        });
        if (cancelled) return;
        refreshCloudStatus();
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Unable to start guest read-only sync.';
        setAuthError(msg);
      }
    };

    setupGuestReadSync();
    return () => {
      cancelled = true;
      repository.clearSupabaseSession();
    };
  }, [campaignId, enabled, guestMode, refreshCloudStatus, supabase]);

  const signIn = async (event) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setAuthError('');
    setAuthMessage('');
    setGuestMode(false);
    setRecoveryPending(false);
    setNewPassword('');
    setConfirmNewPassword('');
    clearRecoveryIntentFromUrl();
    try {
      const email = await resolveSignInEmail(supabase, campaignId, loginIdentifier);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: String(password || ''),
      });
      if (error) throw error;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign in failed.';
      setAuthError(msg);
    } finally {
      setBusy(false);
    }
  };

  const requestPasswordRecovery = async () => {
    if (!supabase) return;
    const identifier = String(loginIdentifier || '').trim();
    if (!identifier) {
      setAuthError('Enter your email or username first, then request password recovery.');
      setAuthMessage('');
      return;
    }
    setBusy(true);
    setAuthError('');
    setAuthMessage('');
    try {
      const email = await resolveSignInEmail(supabase, campaignId, identifier);
      const redirectTo =
        typeof window === 'undefined' ? undefined : `${window.location.origin}${window.location.pathname}`;
      const { error } = await supabase.auth.resetPasswordForEmail(
        email,
        redirectTo ? { redirectTo } : undefined
      );
      if (error) throw error;
      setAuthMessage('Password recovery email sent. Open the link in your inbox to set a new password.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to start password recovery.';
      setAuthError(msg);
    } finally {
      setBusy(false);
    }
  };

  const saveNewPassword = async (event) => {
    event.preventDefault();
    if (!supabase) return;
    const nextPassword = String(newPassword || '');
    const confirm = String(confirmNewPassword || '');
    if (nextPassword.length < MIN_PASSWORD_LENGTH) {
      setAuthError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      setAuthMessage('');
      return;
    }
    if (nextPassword !== confirm) {
      setAuthError('Passwords do not match.');
      setAuthMessage('');
      return;
    }

    setBusy(true);
    setAuthError('');
    setAuthMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ password: nextPassword });
      if (error) throw error;
      clearRecoveryIntentFromUrl();
      setRecoveryPending(false);
      setNewPassword('');
      setConfirmNewPassword('');
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      await applySession(data?.session || null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to update password.';
      setAuthError(msg);
    } finally {
      setBusy(false);
    }
  };

  const continueAsGuest = useCallback(async () => {
    setBusy(true);
    setGuestMode(true);
    setRecoveryPending(false);
    setNewPassword('');
    setConfirmNewPassword('');
    setSession(null);
    userIdRef.current = '';
    setProfile(GUEST_PROFILE);
    setRole('guest');
    setUsernameDraft('Guest');
    setAuthError('');
    setAuthMessage('');
    clearRecoveryIntentFromUrl();
    await repository.clearSupabaseSession();
    refreshCloudStatus();
    setPhase('ready');
    setBusy(false);
  }, [refreshCloudStatus]);

  const signOut = useCallback(async () => {
    if (guestMode) {
      setGuestMode(false);
    } else if (supabase) {
      await supabase.auth.signOut();
    }
    setRecoveryPending(false);
    setNewPassword('');
    setConfirmNewPassword('');
    setAuthMessage('');
    clearRecoveryIntentFromUrl();
    await repository.clearSupabaseSession();
    setProfile(null);
    setRole('member');
    setUsernameDraft('');
    refreshCloudStatus();
    setPhase(enabled ? 'signed_out' : 'ready');
  }, [enabled, guestMode, refreshCloudStatus, supabase]);

  const saveUsername = async (event) => {
    event.preventDefault();
    setBusy(true);
    setAuthError('');
    setAuthMessage('');
    try {
      const nextProfile = await updateUsername(usernameDraft);
      setProfile(nextProfile);
      if (phase === 'username' && session?.user?.id) {
        await repository.configureSupabaseSession({
          campaignId,
          userId: session.user.id,
          role,
          email: session.user.email || '',
        });
        refreshCloudStatus();
        setPhase('ready');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save username.';
      setAuthError(msg);
    }
    setBusy(false);
  };

  const authValue = useMemo(
    () => {
      const canWriteData = !enabled || (phase === 'ready' && !guestMode);
      return {
        enabled,
        session,
        profile,
        role,
        isGuest: guestMode,
        canWriteData,
        isOwner: !guestMode && role === 'owner',
        isDm: !guestMode && role === 'dm',
        canManageCampaign: !guestMode && (role === 'owner' || role === 'dm'),
        cloudStatus,
        signOut,
        updateUsername,
      };
    },
    [cloudStatus, enabled, guestMode, phase, profile, role, session, signOut, updateUsername]
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
        <form className={`${styles.card} ${styles.loginCard}`} onSubmit={signIn}>
          <div className={styles.loginBadge}>Invite-Only Campaign Portal</div>
          <h1 className={styles.title}>Knights of Avalon</h1>
          <p className={styles.copy}>Sign in with your campaign username or invited email account.</p>
          <div className={styles.formStack}>
            <label className={styles.label} htmlFor="login-identifier">Email or Username</label>
            <input
              id="login-identifier"
              className={styles.input}
              type="text"
              value={loginIdentifier}
              onChange={(e) => setLoginIdentifier(e.target.value)}
              autoComplete="username"
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
          </div>
          <button className={styles.primaryBtn} type="submit" disabled={busy}>
            {busy ? 'Signing In...' : 'Sign In'}
          </button>
          <button className={styles.secondaryBtn} type="button" onClick={continueAsGuest} disabled={busy}>
            Continue as Guest
          </button>
          <button className={styles.secondaryBtn} type="button" onClick={requestPasswordRecovery} disabled={busy}>
            Send Password Recovery Link
          </button>
          {authMessage && <p className={styles.hint}>{authMessage}</p>}
          {authError && <p className={styles.error}>{authError}</p>}
        </form>
      </div>
    );
  }

  if (phase === 'password_reset') {
    return (
      <div className={styles.authShell}>
        <form className={styles.card} onSubmit={saveNewPassword}>
          <h1 className={styles.title}>Set New Password</h1>
          <p className={styles.copy}>Choose a new password for your campaign account.</p>
          <label className={styles.label} htmlFor="new-password">New Password</label>
          <input
            id="new-password"
            className={styles.input}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
          <label className={styles.label} htmlFor="confirm-new-password">Confirm New Password</label>
          <input
            id="confirm-new-password"
            className={styles.input}
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
          <button className={styles.primaryBtn} type="submit" disabled={busy}>
            {busy ? 'Updating Password...' : 'Update Password'}
          </button>
          <button className={styles.secondaryBtn} type="button" onClick={signOut} disabled={busy}>
            Cancel
          </button>
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
            {authError || 'This account is not in the campaign invite list.'}
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
    </AuthContext.Provider>
  );
}
