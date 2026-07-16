-- BatiBrain — création ponctuelle du premier profil administrateur.
--
-- Ce script n'est pas une migration et ne doit jamais contenir de données
-- personnelles dans le dépôt. Copier son contenu dans le SQL Editor Supabase,
-- renseigner les quatre paramètres à NULL ci-dessous, puis exécuter la requête.

begin;

do $$
declare
  target_email text := null;
  target_display_name text := null;
  target_first_name text := null;
  target_last_name text := null;
  target_user_id uuid;
begin
  if target_email is null
    or target_display_name is null
    or target_first_name is null
    or target_last_name is null then
    raise exception 'Renseigner les quatre paramètres du script avant exécution.';
  end if;

  if exists (
    select 1
    from public.user_profiles
    where role = 'admin'
  ) then
    raise exception 'Un administrateur existe déjà. Utiliser ensuite l’administration de l’application.';
  end if;

  select id
  into target_user_id
  from auth.users
  where lower(email) = lower(trim(target_email));

  if target_user_id is null then
    raise exception 'Aucun utilisateur Auth ne correspond à cette adresse e-mail.';
  end if;

  if exists (
    select 1
    from public.user_profiles
    where lower(display_name) = lower(trim(target_display_name))
      and user_id <> target_user_id
  ) then
    raise exception 'Ce nom d’affichage est déjà utilisé.';
  end if;

  insert into public.user_profiles (
    user_id,
    display_name,
    first_name,
    last_name,
    avatar_storage_path,
    role
  ) values (
    target_user_id,
    trim(target_display_name),
    trim(target_first_name),
    trim(target_last_name),
    null,
    'admin'
  )
  on conflict (user_id) do update
  set display_name = excluded.display_name,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      role = 'admin',
      updated_at = now();
end;
$$;

commit;

select
  profile.user_id,
  auth_user.email,
  profile.display_name,
  profile.first_name,
  profile.last_name,
  profile.role
from public.user_profiles as profile
join auth.users as auth_user on auth_user.id = profile.user_id
where profile.role = 'admin';
