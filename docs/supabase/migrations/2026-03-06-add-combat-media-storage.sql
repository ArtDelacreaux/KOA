-- Adds Supabase Storage support for combat map uploads.
-- Object path format: <campaign_id>/combat/maps/<encounter_id>/<timestamp>-<filename>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'koa-combat-media',
  'koa-combat-media',
  false,
  15728640,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "combat_media_member_read" on storage.objects;
create policy "combat_media_member_read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'koa-combat-media'
    and public.is_campaign_member(split_part(name, '/', 1))
  );

drop policy if exists "combat_media_owner_insert" on storage.objects;
create policy "combat_media_owner_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'koa-combat-media'
    and public.is_campaign_owner(split_part(name, '/', 1))
  );

drop policy if exists "combat_media_owner_update" on storage.objects;
create policy "combat_media_owner_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'koa-combat-media'
    and public.is_campaign_owner(split_part(name, '/', 1))
  )
  with check (
    bucket_id = 'koa-combat-media'
    and public.is_campaign_owner(split_part(name, '/', 1))
  );

drop policy if exists "combat_media_owner_delete" on storage.objects;
create policy "combat_media_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'koa-combat-media'
    and public.is_campaign_owner(split_part(name, '/', 1))
  );
