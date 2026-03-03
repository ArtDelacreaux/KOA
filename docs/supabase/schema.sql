-- Tavern Menu Supabase schema (invite-only, shared campaign + private notes)
-- Run this in Supabase SQL Editor.

create extension if not exists citext;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_username_len check (char_length(username) <= 40)
);

create table if not exists public.campaign_invites (
  campaign_id text not null,
  email citext not null,
  role text not null default 'member',
  created_at timestamptz not null default timezone('utc', now()),
  primary key (campaign_id, email),
  constraint campaign_invites_role_check check (role in ('owner', 'member'))
);

create table if not exists public.campaign_members (
  campaign_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  email citext not null,
  role text not null default 'member',
  joined_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  primary key (campaign_id, user_id),
  constraint campaign_members_role_check check (role in ('owner', 'member'))
);

create table if not exists public.shared_docs (
  campaign_id text not null,
  doc_key text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (campaign_id, doc_key)
);

create table if not exists public.private_docs (
  campaign_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_key text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (campaign_id, user_id, doc_key)
);

create index if not exists campaign_members_campaign_idx
  on public.campaign_members (campaign_id, role);

create index if not exists shared_docs_campaign_updated_idx
  on public.shared_docs (campaign_id, updated_at desc);

create index if not exists private_docs_campaign_user_updated_idx
  on public.private_docs (campaign_id, user_id, updated_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch_updated_at on public.profiles;
create trigger trg_profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists trg_shared_docs_touch_updated_at on public.shared_docs;
create trigger trg_shared_docs_touch_updated_at
before update on public.shared_docs
for each row execute function public.touch_updated_at();

drop trigger if exists trg_private_docs_touch_updated_at on public.private_docs;
create trigger trg_private_docs_touch_updated_at
before update on public.private_docs
for each row execute function public.touch_updated_at();

create or replace function public.current_user_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.claim_campaign_membership(p_campaign_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := public.current_user_email();
  v_role text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(v_email, '') = '' then
    raise exception 'Email claim missing from auth token.';
  end if;

  select ci.role
    into v_role
    from public.campaign_invites ci
   where ci.campaign_id = p_campaign_id
     and lower(ci.email::text) = v_email
   limit 1;

  if v_role is null then
    raise exception 'Not invited to this campaign.';
  end if;

  insert into public.campaign_members (campaign_id, user_id, email, role, joined_at, last_seen_at)
  values (p_campaign_id, v_user_id, v_email, v_role, timezone('utc', now()), timezone('utc', now()))
  on conflict (campaign_id, user_id)
  do update
    set email = excluded.email,
        role = excluded.role,
        last_seen_at = timezone('utc', now());

  return v_role;
end;
$$;

create or replace function public.seed_campaign_once(p_campaign_id text, p_docs jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count int := 0;
  kv record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
      from public.campaign_members cm
     where cm.campaign_id = p_campaign_id
       and cm.user_id = v_user_id
       and cm.role = 'owner'
  ) then
    raise exception 'Only campaign owners can seed shared state.';
  end if;

  if exists (
    select 1
      from public.shared_docs sd
     where sd.campaign_id = p_campaign_id
     limit 1
  ) then
    raise exception 'Shared state has already been seeded.';
  end if;

  if jsonb_typeof(coalesce(p_docs, '{}'::jsonb)) <> 'object' then
    raise exception 'Seed docs must be a JSON object.';
  end if;

  for kv in
    select key, value from jsonb_each(coalesce(p_docs, '{}'::jsonb))
  loop
    insert into public.shared_docs (campaign_id, doc_key, payload, updated_by, updated_at)
    values (p_campaign_id, kv.key, kv.value, v_user_id, timezone('utc', now()));
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'campaign_id', p_campaign_id,
    'inserted', v_count
  );
end;
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.campaign_invites to authenticated;
grant select on public.campaign_members to authenticated;
grant select, insert, update, delete on public.shared_docs to authenticated;
grant select, insert, update, delete on public.private_docs to authenticated;
grant execute on function public.claim_campaign_membership(text) to authenticated;
grant execute on function public.seed_campaign_once(text, jsonb) to authenticated;

alter table public.profiles enable row level security;
alter table public.campaign_invites enable row level security;
alter table public.campaign_members enable row level security;
alter table public.shared_docs enable row level security;
alter table public.private_docs enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select
  on public.profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert
  on public.profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
  on public.profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists campaign_invites_owner_read on public.campaign_invites;
create policy campaign_invites_owner_read
  on public.campaign_invites
  for select
  using (
    exists (
      select 1
        from public.campaign_members cm
       where cm.campaign_id = campaign_invites.campaign_id
         and cm.user_id = auth.uid()
         and cm.role = 'owner'
    )
  );

drop policy if exists campaign_members_member_read on public.campaign_members;
create policy campaign_members_member_read
  on public.campaign_members
  for select
  using (
    user_id = auth.uid()
    or exists (
      select 1
        from public.campaign_members owner_row
       where owner_row.campaign_id = campaign_members.campaign_id
         and owner_row.user_id = auth.uid()
         and owner_row.role = 'owner'
    )
  );

drop policy if exists shared_docs_member_read on public.shared_docs;
create policy shared_docs_member_read
  on public.shared_docs
  for select
  using (
    exists (
      select 1
        from public.campaign_members cm
       where cm.campaign_id = shared_docs.campaign_id
         and cm.user_id = auth.uid()
    )
  );

drop policy if exists shared_docs_member_write on public.shared_docs;
create policy shared_docs_member_write
  on public.shared_docs
  for all
  using (
    exists (
      select 1
        from public.campaign_members cm
       where cm.campaign_id = shared_docs.campaign_id
         and cm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
        from public.campaign_members cm
       where cm.campaign_id = shared_docs.campaign_id
         and cm.user_id = auth.uid()
    )
  );

drop policy if exists private_docs_member_read on public.private_docs;
create policy private_docs_member_read
  on public.private_docs
  for select
  using (
    user_id = auth.uid()
    and exists (
      select 1
        from public.campaign_members cm
       where cm.campaign_id = private_docs.campaign_id
         and cm.user_id = auth.uid()
    )
  );

drop policy if exists private_docs_member_write on public.private_docs;
create policy private_docs_member_write
  on public.private_docs
  for all
  using (
    user_id = auth.uid()
    and exists (
      select 1
        from public.campaign_members cm
       where cm.campaign_id = private_docs.campaign_id
         and cm.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
        from public.campaign_members cm
       where cm.campaign_id = private_docs.campaign_id
         and cm.user_id = auth.uid()
    )
  );

do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'shared_docs'
  ) then
    alter publication supabase_realtime add table public.shared_docs;
  end if;

  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'private_docs'
  ) then
    alter publication supabase_realtime add table public.private_docs;
  end if;
end;
$$;
