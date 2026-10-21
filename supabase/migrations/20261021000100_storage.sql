-- =====================================================================
-- Photos des membres (Supabase Storage)
-- Bucket privé « member-photos ». Chemin : {organization_id}/{member_id}.jpg
-- Seule l'équipe de la salle peut lire et écrire ses photos ; l'affichage
-- passe par des URL signées de courte durée.
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('member-photos', 'member-photos', false)
on conflict (id) do nothing;

create policy member_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'member-photos'
         and public.is_org_member(((storage.foldername(name))[1])::uuid));

create policy member_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'member-photos'
              and public.is_org_member(((storage.foldername(name))[1])::uuid));

create policy member_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'member-photos'
         and public.is_org_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'member-photos'
              and public.is_org_member(((storage.foldername(name))[1])::uuid));

create policy member_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'member-photos'
         and public.is_org_admin(((storage.foldername(name))[1])::uuid));
