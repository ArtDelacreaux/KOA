# Tavern Menu

React + Vite app for Knights of Avalon campaign management.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Start dev server:

```bash
npm run dev
```

3. Build production bundle:

```bash
npm run build
```

## Data Backend Modes

Set backend using `VITE_DATA_BACKEND`:

- `local` (default): uses browser localStorage only.
- `supabase`: enables auth + cloud sync.

## Environment Variables

Copy `.env.example` to `.env` and fill values:

```env
VITE_DATA_BACKEND=supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
VITE_CAMPAIGN_ID=main-party
```

Never use `service_role` key in frontend env.

## Supabase Setup (Invite-Only + Shared Campaign)

### 1. Run schema SQL

In Supabase SQL Editor, run:

- [docs/supabase/schema.sql](docs/supabase/schema.sql)

This creates:

- `profiles`
- `campaign_invites`
- `campaign_members`
- `shared_docs`
- `private_docs`
- RPCs:
  - `claim_campaign_membership(p_campaign_id text)`
  - `seed_campaign_once(p_campaign_id text, p_docs jsonb)`

### 2. Configure Auth

Supabase Dashboard -> Authentication -> Providers/Settings:

1. Enable Email provider.
2. Keep email confirmation enabled.
3. Disable public self-signup.
4. Set Site URL and Redirect URLs for your local/dev/prod app URLs.

### 3. Invite users

Dashboard -> Authentication -> Users -> Invite user

- Invite owner + players by email.
- Optional: invite a DM account (campaign-admin role).
- Users finish account setup from invite email.

### 4. Allowlist campaign membership

Add invited emails to `campaign_invites` table (same `campaign_id` as `VITE_CAMPAIGN_ID`):

```sql
insert into public.campaign_invites (campaign_id, email, role)
values
  ('main-party', 'owner@example.com', 'owner'),
  ('main-party', 'dm@example.com', 'dm'),
  ('main-party', 'player1@example.com', 'member'),
  ('main-party', 'player2@example.com', 'member')
on conflict (campaign_id, email) do update set role = excluded.role;
```

Supported roles:

- `owner`: full campaign admin.
- `dm`: owner-level campaign admin (seed + invite visibility).
- `member`: normal shared-data access.

### 5. First cloud seed (owner/DM only)

After owner/DM signs in:

1. Open Campaign Hub -> **Cloud Prep Backup**.
2. Click **Seed Cloud Once**.
3. This imports current local shared state to `shared_docs` only if campaign cloud data is still empty.

## Sync Model

- Shared data: synced through `shared_docs`.
- Private data: session notes only, synced through `private_docs`.
- Offline writes: queued locally and retried automatically.
- Conflict strategy: last write wins.
- Realtime: Supabase Realtime subscriptions for shared/private docs.

## Notes

- Existing local backup/restore flow remains available in Campaign Hub.
- `VITE_DATA_BACKEND=local` keeps previous behavior with no auth required.
