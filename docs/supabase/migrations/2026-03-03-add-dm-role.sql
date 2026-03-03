-- Adds a dedicated "dm" campaign role and grants DM owner-level campaign admin rights.
-- Safe to run multiple times.

alter table public.campaign_invites
  drop constraint if exists campaign_invites_role_check;

alter table public.campaign_invites
  add constraint campaign_invites_role_check
  check (role in ('owner', 'dm', 'member'));

alter table public.campaign_members
  drop constraint if exists campaign_members_role_check;

alter table public.campaign_members
  add constraint campaign_members_role_check
  check (role in ('owner', 'dm', 'member'));

create or replace function public.is_campaign_owner(p_campaign_id text, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.campaign_members cm
     where cm.campaign_id = p_campaign_id
       and cm.user_id = coalesce(p_user_id, auth.uid())
       and cm.role in ('owner', 'dm')
  );
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
       and cm.role in ('owner', 'dm')
  ) then
    raise exception 'Only campaign owners/DMs can seed shared state.';
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
