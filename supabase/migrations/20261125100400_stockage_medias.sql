-- =============================================================================
-- SAMMEERE JIME — 5/5 : stockage des médias
-- =============================================================================
--   audio  (privé) : {artist_id}/{fichier}  — aucun accès direct des auditeurs
--   videos (privé) : {artist_id}/{fichier}  — idem
--   images (public): avatars/{user_id}/…, artists/{artist_id}/…, radios/…
-- Les auditeurs n'obtiennent jamais de lien permanent : l'Edge Function
-- « stream-url » vérifie can_stream_track() puis délivre une URL signée de
-- courte durée. Il n'y a pas de bouton « télécharger le fichier ».
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('audio',  'audio',  false, 104857600,  -- 100 Mo
   array['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/x-m4a', 'audio/flac', 'audio/wav', 'audio/x-wav', 'audio/ogg']),
  ('videos', 'videos', false, 524288000,  -- 500 Mo
   array['video/mp4', 'video/quicktime', 'video/webm']),
  ('images', 'images', true,  10485760,   -- 10 Mo
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Le dossier n° p_position du chemin est-il un artiste du compte connecté ?
-- (Pour les photos, la fiche peut être encore en attente de validation.)
create or replace function public.storage_owns_artist_folder(
  p_name text,
  p_position integer default 1,
  p_require_approved boolean default true
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_folder text := (storage.foldername(p_name))[p_position];
begin
  if v_folder !~ '^[0-9a-f-]{36}$' then
    return false;
  end if;
  if p_require_approved then
    return public.owns_approved_artist(v_folder::uuid);
  end if;
  return public.owns_artist(v_folder::uuid);
end;
$$;

-- -----------------------------------------------------------------------------
-- audio et videos : l'artiste gère ses fichiers, l'admin voit tout.
-- -----------------------------------------------------------------------------
create policy "Artiste : déposer ses médias"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('audio', 'videos') and public.storage_owns_artist_folder(name));

create policy "Artiste : lire ses médias"
  on storage.objects for select to authenticated
  using (bucket_id in ('audio', 'videos')
         and (public.storage_owns_artist_folder(name) or public.is_admin()));

create policy "Artiste : remplacer ses médias"
  on storage.objects for update to authenticated
  using (bucket_id in ('audio', 'videos') and public.storage_owns_artist_folder(name))
  with check (bucket_id in ('audio', 'videos') and public.storage_owns_artist_folder(name));

create policy "Artiste : supprimer ses médias"
  on storage.objects for delete to authenticated
  using (bucket_id in ('audio', 'videos')
         and (public.storage_owns_artist_folder(name) or public.is_admin()));

-- -----------------------------------------------------------------------------
-- images (bucket public en lecture) : chacun dépose dans son dossier.
-- -----------------------------------------------------------------------------
create policy "Images : déposer dans son dossier"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'images' and (
      ((storage.foldername(name))[1] = 'avatars' and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'artists' and public.storage_owns_artist_folder(name, 2, false))
      or public.is_admin()
    )
  );

create policy "Images : remplacer dans son dossier"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'images' and (
      ((storage.foldername(name))[1] = 'avatars' and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'artists' and public.storage_owns_artist_folder(name, 2, false))
      or public.is_admin()
    )
  );

create policy "Images : supprimer dans son dossier"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'images' and (
      ((storage.foldername(name))[1] = 'avatars' and (storage.foldername(name))[2] = (select auth.uid())::text)
      or ((storage.foldername(name))[1] = 'artists' and public.storage_owns_artist_folder(name, 2, false))
      or public.is_admin()
    )
  );
