-- Suspension temporaire du verrou d'édition collaboratif projet.
-- Les vérifications de droits et les verrous manuels restent actifs.

begin;

create or replace function acquire_project_editing_lock(target_project_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Verrou collaboratif suspendu en V1 : la fonction est conservée pour compatibilité.
  if target_project_id is null then
    raise exception 'PROJECT_NOT_FOUND';
  end if;

  return statement_timestamp();
end;
$$;

create or replace function project_editing_lock_state(target_project_id uuid)
returns table (
  project_id uuid,
  holder_user_id uuid,
  holder_display_name text,
  last_activity_at timestamptz,
  expires_at timestamptz,
  is_active boolean,
  held_by_current_user boolean,
  server_now timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    null::uuid,
    null::text,
    null::timestamptz,
    null::timestamptz,
    false,
    false,
    statement_timestamp()
  from projects p
  where p.id = target_project_id and can_read_project(p.id);
$$;

create or replace function guard_project_resource_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Verrou collaboratif suspendu : ne plus imposer d'acquisition de verrou.
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function update_project_with_lock(
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
  if not owns_project(target_project_id) then
    raise exception 'PROJECT_OWNER_REQUIRED';
  end if;

  update projects set
    name = target_name,
    address = target_address,
    description = target_description,
    is_soft_deleted = target_soft_deleted,
    deleted_at = case when target_soft_deleted then statement_timestamp() else null end,
    updated_at = statement_timestamp()
  where id = target_project_id
  returning * into updated_project;

  return updated_project;
end;
$$;

create or replace function set_project_resource_manual_lock(
  resource_type text,
  resource_id uuid,
  target_locked boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid;
  current_locked boolean;
begin
  case resource_type
    when 'pièce' then
      select l.project_id, p.is_locked into target_project_id, current_locked
      from pieces p join levels l on l.id = p.level_id where p.id = resource_id;
    when 'mur' then
      select l.project_id, w.is_locked into target_project_id, current_locked
      from walls w join piece_vertices v on v.id = w.start_vertex_id
      join pieces p on p.id = v.piece_id join levels l on l.id = p.level_id
      where w.id = resource_id;
    when 'ouverture' then
      select l.project_id, o.is_locked into target_project_id, current_locked
      from openings o join walls w on w.id = o.wall_id
      join piece_vertices v on v.id = w.start_vertex_id
      join pieces p on p.id = v.piece_id join levels l on l.id = p.level_id
      where o.id = resource_id;
    else
      raise exception 'MANUAL_LOCK_RESOURCE_TYPE_INVALID';
  end case;

  if target_project_id is null then
    raise exception 'MANUAL_LOCK_RESOURCE_NOT_FOUND';
  end if;

  if not can_write_project(target_project_id) then
    raise exception 'PROJECT_WRITE_REQUIRED';
  end if;

  if current_locked = target_locked then
    return current_locked;
  end if;

  case resource_type
    when 'pièce' then update pieces set is_locked = target_locked where id = resource_id;
    when 'mur' then update walls set is_locked = target_locked where id = resource_id;
    when 'ouverture' then update openings set is_locked = target_locked where id = resource_id;
  end case;

  return target_locked;
end;
$$;

commit;
