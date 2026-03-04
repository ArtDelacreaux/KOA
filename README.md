# Tavern Menu

Knights of Avalon campaign control panel built with React + Vite.

## What This App Includes

- Hub-style UI for campaign ops, lore, character access, and encounter prep.
- Combat system with encounter state, initiative flow, and character sheet import.
- Party + DM chat with realtime sync when Supabase backend is enabled.
- Local-first persistence with optional Supabase cloud sync and auth.
- Backup/import tooling from the Campaign Hub.

## Quick Start

### Prerequisites

- Node.js 18+
- npm

### Run locally

```bash
npm install
npm run dev
```

### Production build

```bash
npm run build
npm run preview
```

## Environment Setup

Copy `.env.example` to `.env.local` (or `.env`) and configure:

```env
VITE_DATA_BACKEND=local
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_CAMPAIGN_ID=main-party
```

Backend modes:

- `local` (default): localStorage only, no login required.
- `supabase`: invite-only auth + cloud sync + realtime chat.

Do not use a Supabase `service_role` key in frontend env files.

## Supabase Setup (Invite-Only)

1. Run [docs/supabase/schema.sql](docs/supabase/schema.sql) in Supabase SQL Editor.
2. Configure Auth:
   - Enable email auth.
   - Keep email confirmation on.
   - Disable public self-signup.
   - Set correct Site URL and Redirect URLs.
3. Invite accounts in Supabase Auth (owner, DM, players).
4. Insert invite allowlist rows into `campaign_invites` for your `campaign_id`.
5. Sign in as owner/DM, then run **Campaign Hub -> Cloud Prep Backup -> Seed Cloud Once**.

Available roles:

- `owner`: full campaign admin.
- `dm`: campaign admin (same management abilities as owner in app).
- `member`: standard participant.

## Project Structure

- `src/`: application code (components, auth, repository, migration tools).
- `public/`: static media (tokens, lore images).
- `docs/supabase/`: schema and SQL migrations.
- `docs/CharacterSheetFRD.md`: character sheet parser functional requirements.

## Documentation Index

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): module layout, data flow, storage model.
- [docs/OPERATIONS.md](docs/OPERATIONS.md): Supabase operations, backup/restore, troubleshooting.

## Scripts

- `npm run dev`: start Vite dev server.
- `npm run build`: build production bundle.
- `npm run preview`: preview production build locally.
