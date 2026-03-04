# Tavern Menu Operations Guide

## Environment Profiles

### Local mode

Use for offline or single-device playtesting:

```env
VITE_DATA_BACKEND=local
```

- No auth required.
- All state in browser localStorage.
- No cloud sync, no shared chat backend.

### Supabase mode

Use for multi-user campaign play:

```env
VITE_DATA_BACKEND=supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
VITE_CAMPAIGN_ID=main-party
```

- Invite-only login.
- Shared/private cloud sync.
- Realtime party/DM chat.

## Supabase Bootstrapping

1. Run `docs/supabase/schema.sql`.
2. Apply migration files in `docs/supabase/migrations/` in filename order.
3. Configure authentication settings:
   - Email provider on
   - Public signups off
   - Valid redirect URLs for your app domains
4. Invite campaign users through Supabase Auth.
5. Populate `campaign_invites` with campaign roles.

Example invite allowlist:

```sql
insert into public.campaign_invites (campaign_id, email, role)
values
  ('main-party', 'owner@example.com', 'owner'),
  ('main-party', 'dm@example.com', 'dm'),
  ('main-party', 'player1@example.com', 'member')
on conflict (campaign_id, email) do update set role = excluded.role;
```

## First-Time Cloud Seeding

Seed shared cloud docs once from an existing local state:

1. Sign in as `owner` or `dm`.
2. Open Campaign Hub.
3. Go to `Cloud Prep Backup`.
4. Run `Seed Cloud Once`.

This calls `seed_campaign_once` and only succeeds when `shared_docs` is still empty.

## Backup / Restore Workflow

From Campaign Hub:

- Export generates a JSON snapshot with schema version and hash.
- Import validates JSON shape and applies known keys from migration manifest.
- Summary counters help confirm import scope (characters, quests, lore, bag, etc.).

Operational recommendation:

- Export before running major imports or schema changes.
- Keep dated snapshot files outside the repo.

## Day-to-Day Health Checks

When running in Supabase mode, verify:

- `cloudStatus.ready` is true in app state.
- `cloudStatus.connected` is true after realtime subscription.
- `cloudStatus.queueSize` drains to `0` after network reconnect.
- Chat sends/inserts appear in `chat_messages`.

## Common Issues

- `Supabase environment variables are missing`:
  - Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- `Not invited to this campaign`:
  - Ensure invited email exists in `campaign_invites` for `VITE_CAMPAIGN_ID`.
- Write failures in guest mode:
  - Expected; guest mode is read-only by design.
- Realtime disconnect:
  - Adapter falls back to polling; check network and Realtime publication setup.

## Security Notes

- Never expose `service_role` in frontend env files.
- Keep RLS enabled on Supabase tables.
- Use invite-only auth for campaign membership control.
- Restrict owner/DM actions to trusted accounts.
