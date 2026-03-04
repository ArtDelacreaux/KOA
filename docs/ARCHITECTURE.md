# Tavern Menu Architecture

## Overview

Tavern Menu is a React + Vite single-page app with a local-first storage model and an optional Supabase backend.

- Entry: `src/main.jsx` -> `src/App.jsx`
- Root shell: `src/TavernMenu.jsx`
- Auth gate: `src/components/AuthGate.jsx`
- Data access abstraction: `src/repository/`

`App` switches between full app and a dedicated chat popout route (`?chat=popout`).

## Core Runtime Flow

1. `AuthGate` initializes auth/session state.
2. `AuthGate` sets repository write access based on auth phase and guest mode.
3. `TavernMenu` renders panels and shared state hooks.
4. Panels read/write through repository-backed helpers (`useLocalStorageState`, `localStore`, or direct repository usage).
5. When Supabase backend is active, adapter syncs local changes to cloud and applies remote updates to local cache.

## Frontend Modules

- `src/components/MenuPanel.jsx`: landing/menu navigation.
- `src/components/CampaignHub.jsx`: quest board, launcher, bag, backup/migration tools.
- `src/components/CharacterBook.jsx`: character browsing/relationships/access assignment.
- `src/components/CombatPanel.jsx`: encounters and character sheet import/editor.
- `src/components/WorldLore.jsx`: lore maps/scenes/locations/factions.
- `src/components/PlayerChatDock.jsx`: party + DM chat, optional popout window.
- `src/components/VideoPanel.jsx`: intro/outro media views.

## Auth and Roles

When `VITE_DATA_BACKEND=supabase`, `AuthGate` enforces:

- Invite-only sign-in.
- Username bootstrap (`profiles.username`) after first login.
- Optional guest mode (read-only).

Role semantics:

- `owner`, `dm`: campaign management actions.
- `member`: standard write access to permitted shared/private areas.
- `guest` (app-local state): read-only cloud mode.

## Data Layer

Repository is an adapter-based facade:

- `src/repository/index.js`: selects adapter (`local` vs `supabase`).
- `src/repository/createRepository.js`: shared API and subscription/emit behavior.
- `src/repository/adapters/localAdapter.js`: localStorage read/write.
- `src/repository/adapters/supabaseAdapter.js`: queued sync + realtime + polling fallback.

Repository interface supports:

- `readJson`/`writeJson`
- `readText`/`writeText`
- `remove`
- `subscribe`
- Supabase session control and cloud status

## Persistence Model

Storage keys are centralized in `src/lib/storageKeys.js`.

Scope by backend mode:

- Local-only: e.g. `koa:worldnpcs:deeplink:v1`
- Shared campaign docs: most gameplay and campaign keys
- Private docs: `koa:launcher:notes:v1` (player-private notes)

Supabase tables used for persistence:

- `shared_docs`: shared campaign state
- `private_docs`: per-user private state
- `chat_messages`: chat stream (party and DM threads)
- `profiles`, `campaign_invites`, `campaign_members`: auth + membership metadata

## Sync Behavior (Supabase Adapter)

- Writes are applied locally first, then queued for cloud flush.
- Queue survives reload (`koa:supabase:queue:v1`).
- Realtime channels apply remote updates for shared/private docs and chat.
- Fallback polling runs when realtime is not connected.
- Conflict handling is mostly last-write-wins.
- NPC-related keys include guard metadata to reduce stale overwrite regressions.

## Backup and Migration

Backup tooling lives in `src/migration/`:

- `manifest.js`: migration key manifest + schema version.
- `backupService.js`: export/import, summary, and snapshot hashing.
- `importStrategy.js`: Supabase-aware import planning.

Campaign Hub exposes this flow to users for download, import, and cloud seeding.
