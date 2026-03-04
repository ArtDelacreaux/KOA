-- Adds username-based login resolution for auth screen sign-in.
-- Safe to run multiple times.

create or replace function public.resolve_login_email(p_campaign_id text, p_identifier text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_identifier text := lower(coalesce(btrim(p_identifier), ''));
  v_match_count int := 0;
  v_email text := null;
begin
  if coalesce(btrim(p_campaign_id), '') = '' then
    return null;
  end if;

  if v_identifier = '' then
    return null;
  end if;

  if position('@' in v_identifier) > 0 then
    return v_identifier;
  end if;

  select
    count(*)::int,
    min(lower(cm.email::text))
  into v_match_count, v_email
  from public.campaign_members cm
  join public.profiles p
    on p.user_id = cm.user_id
  where cm.campaign_id = p_campaign_id
    and lower(nullif(btrim(p.username), '')) = v_identifier;

  if v_match_count > 1 then
    raise exception 'Multiple accounts use this username. Sign in with email.';
  end if;

  if v_match_count = 1 then
    return v_email;
  end if;

  return null;
end;
$$;

grant usage on schema public to anon;
grant execute on function public.resolve_login_email(text, text) to authenticated, anon;
