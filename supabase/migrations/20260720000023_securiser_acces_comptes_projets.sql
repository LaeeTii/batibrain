-- Sécurisation des frontières d’écriture des comptes, projets et collaborations V1-R12.

begin;

-- Un profil est créé uniquement lors de l’approbation de la demande de compte.
drop policy if exists user_profiles_insert_own on user_profiles;
revoke insert, update, delete on user_profiles from authenticated;
revoke update (display_name, first_name, last_name, avatar_storage_path, updated_at)
on user_profiles from authenticated;

create or replace function update_own_profile(
  new_display_name text,
  new_first_name text,
  new_last_name text,
  new_avatar_storage_path text
)
returns user_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile user_profiles;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.';
  end if;
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

-- Une demande est déposée par la RPC publique et approuvée par la fonction serveur.
drop policy if exists account_creation_requests_update_admin on account_creation_requests;
revoke insert, update, delete on account_creation_requests from anon, authenticated;

-- Un compte Auth sans profil approuvé ne peut pas créer de projet.
drop policy if exists projects_create on projects;
create policy projects_create on projects
for insert to authenticated
with check (
  owner_user_id = auth.uid()
  and exists (
    select 1 from user_profiles
    where user_profiles.user_id = auth.uid()
  )
);

-- Les mutations du projet passent par une frontière propriétaire explicite.
revoke update, delete on projects from authenticated;

create or replace function update_owned_project(
  target_project_id uuid,
  target_name text,
  target_address text,
  target_description text,
  target_soft_deleted boolean default false
)
returns projects
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_project projects;
begin
  if auth.uid() is null or not owns_project(target_project_id) then
    raise exception 'PROJECT_OWNER_REQUIRED';
  end if;
  if trim(coalesce(target_name, '')) = '' then
    raise exception 'PROJECT_NAME_REQUIRED';
  end if;

  update projects
  set name = trim(target_name),
      address = nullif(trim(target_address), ''),
      description = nullif(trim(target_description), ''),
      is_soft_deleted = target_soft_deleted,
      deleted_at = case when target_soft_deleted then statement_timestamp() else null end,
      updated_at = statement_timestamp()
  where id = target_project_id
    and (not is_soft_deleted or target_soft_deleted)
  returning * into updated_project;

  if not found then
    raise exception 'PROJECT_NOT_FOUND_OR_DELETED';
  end if;

  return updated_project;
end;
$$;

revoke all on function update_owned_project(uuid, text, text, text, boolean) from public;
grant execute on function update_owned_project(uuid, text, text, text, boolean) to authenticated;

-- Les invitations ciblent un compte BatiBrain approuvé, pas seulement une identité Auth.
create or replace function invite_project_member(
  target_project_id uuid,
  target_email text,
  target_role text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  invited_id uuid;
  invitation_id uuid;
begin
  if auth.uid() is null or not owns_project(target_project_id) then
    raise exception 'PROJECT_OWNER_REQUIRED';
  end if;
  if target_role is null or target_role not in ('lecture', 'écriture') then
    raise exception 'PROJECT_ROLE_INVALID';
  end if;

  select user_account.id
  into invited_id
  from auth.users user_account
  join user_profiles profile on profile.user_id = user_account.id
  where lower(user_account.email) = lower(trim(target_email));

  if invited_id is null then
    raise exception 'PROJECT_INVITEE_NOT_FOUND';
  end if;
  if invited_id = auth.uid() then
    raise exception 'PROJECT_OWNER_INVITE_FORBIDDEN';
  end if;
  if exists (
    select 1 from project_collaborations
    where project_id = target_project_id and user_id = invited_id
  ) then
    raise exception 'PROJECT_COLLABORATION_EXISTS';
  end if;

  insert into project_invitations (
    project_id, invited_user_id, invited_email, role, status, created_at, updated_at
  ) values (
    target_project_id, invited_id, lower(trim(target_email)), target_role,
    'en_attente', now(), now()
  )
  returning id into invitation_id;

  return invitation_id;
end;
$$;

create or replace function change_project_collaborator_role(
  target_collaboration_id uuid,
  target_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_role is null or target_role not in ('lecture', 'écriture') then
    raise exception 'PROJECT_ROLE_INVALID';
  end if;

  update project_collaborations
  set role = target_role,
      updated_at = statement_timestamp()
  where id = target_collaboration_id
    and owns_project(project_id);

  if not found then
    raise exception 'PROJECT_COLLABORATION_NOT_FOUND';
  end if;
end;
$$;

create or replace function remove_project_collaborator(target_collaboration_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from project_collaborations
  where id = target_collaboration_id
    and owns_project(project_id);

  if not found then
    raise exception 'PROJECT_COLLABORATION_NOT_FOUND';
  end if;
end;
$$;

-- Les politiques restent la défense en profondeur des lectures; les écritures passent par les RPC.
revoke insert, update, delete on project_invitations from authenticated;
revoke insert, update, delete on project_collaborations from authenticated;

revoke all on function invite_project_member(uuid, text, text) from public;
revoke all on function change_project_collaborator_role(uuid, text) from public;
revoke all on function remove_project_collaborator(uuid) from public;
grant execute on function invite_project_member(uuid, text, text) to authenticated;
grant execute on function change_project_collaborator_role(uuid, text) to authenticated;
grant execute on function remove_project_collaborator(uuid) to authenticated;

commit;
