-- BatiBrain — sécurisation de la modification des profils et des avatars

begin;

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'user-avatars';

grant select on user_profiles to authenticated;
grant update (display_name, first_name, last_name, avatar_storage_path, updated_at)
on user_profiles to authenticated;

create function update_own_profile(
  new_display_name text,
  new_first_name text,
  new_last_name text,
  new_avatar_storage_path text
)
returns user_profiles
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_profile user_profiles;
begin
  if trim(new_display_name) = '' or trim(new_first_name) = '' or trim(new_last_name) = '' then
    raise exception using errcode = '22023', message = 'Le nom d’affichage, le prénom et le nom sont obligatoires.';
  end if;
  if length(trim(new_display_name)) > 80
    or length(trim(new_first_name)) > 100
    or length(trim(new_last_name)) > 100 then
    raise exception using errcode = '22023', message = 'Un des champs dépasse la longueur autorisée.';
  end if;
  if new_avatar_storage_path is not null
    and new_avatar_storage_path !~ ('^' || auth.uid()::text || '/[^/]+$') then
    raise exception using errcode = '22023', message = 'Chemin d’avatar invalide.';
  end if;

  update user_profiles
  set display_name = trim(new_display_name),
      first_name = trim(new_first_name),
      last_name = trim(new_last_name),
      avatar_storage_path = new_avatar_storage_path,
      updated_at = now()
  where user_id = auth.uid()
  returning * into updated_profile;

  if not found then
    raise exception 'Profil utilisateur introuvable.';
  end if;

  return updated_profile;
end;
$$;

revoke all on function update_own_profile(text, text, text, text) from public;
grant execute on function update_own_profile(text, text, text, text) to authenticated;

commit;
