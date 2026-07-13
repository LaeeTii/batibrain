-- Verrou d’édition collaboratif au niveau du projet — V1-18.

begin;

create or replace function acquire_project_editing_lock(target_project_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  current_lock_user_id uuid;
  current_lock_activity timestamptz;
  server_activity timestamptz := statement_timestamp();
begin
  if auth.uid() is null or not can_write_project(target_project_id) then
    raise exception 'PROJECT_WRITE_REQUIRED';
  end if;

  select editing_lock_user_id, editing_lock_last_activity_at
  into current_lock_user_id, current_lock_activity
  from projects
  where id = target_project_id and not is_soft_deleted
  for update;

  if not found then
    raise exception 'PROJECT_NOT_FOUND';
  end if;

  if current_lock_user_id is not null
    and current_lock_user_id <> auth.uid()
    and current_lock_activity > server_activity - interval '2 minutes' then
    raise exception 'PROJECT_EDITING_LOCKED';
  end if;

  update projects
  set editing_lock_user_id = auth.uid(),
      editing_lock_last_activity_at = server_activity
  where id = target_project_id;

  -- Permet aux suppressions en cascade de conserver le projet contrôlé alors que
  -- leur ligne parente n’est déjà plus visible par les triggers enfants.
  perform set_config('batibrain.editing_lock_project_id', target_project_id::text, true);

  return server_activity;
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
    case when lock_state.is_active then p.editing_lock_user_id end,
    case when lock_state.is_active then profile.display_name end,
    case when lock_state.is_active then p.editing_lock_last_activity_at end,
    case when lock_state.is_active then p.editing_lock_last_activity_at + interval '2 minutes' end,
    lock_state.is_active,
    lock_state.is_active and p.editing_lock_user_id = auth.uid(),
    statement_timestamp()
  from projects p
  left join user_profiles profile on profile.user_id = p.editing_lock_user_id
  cross join lateral (
    select p.editing_lock_user_id is not null
      and p.editing_lock_last_activity_at > statement_timestamp() - interval '2 minutes'
      as is_active
  ) lock_state
  where p.id = target_project_id and can_read_project(p.id);
$$;

create or replace function guard_project_resource_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid;
begin
  case tg_table_name
    when 'levels' then
      target_project_id := case when tg_op = 'DELETE' then old.project_id else new.project_id end;
    when 'pieces' then
      select project_id into target_project_id from levels
      where id = case when tg_op = 'DELETE' then old.level_id else new.level_id end;
    when 'piece_vertices' then
      select l.project_id into target_project_id from pieces p join levels l on l.id = p.level_id
      where p.id = case when tg_op = 'DELETE' then old.piece_id else new.piece_id end;
    when 'walls' then
      select l.project_id into target_project_id
      from piece_vertices v join pieces p on p.id = v.piece_id join levels l on l.id = p.level_id
      where v.id = case when tg_op = 'DELETE' then old.start_vertex_id else new.start_vertex_id end;
    when 'wall_pieces' then
      select l.project_id into target_project_id from pieces p join levels l on l.id = p.level_id
      where p.id = case when tg_op = 'DELETE' then old.piece_id else new.piece_id end;
    when 'wall_faces', 'wall_height_points', 'openings' then
      select l.project_id into target_project_id
      from walls w join piece_vertices v on v.id = w.start_vertex_id
      join pieces p on p.id = v.piece_id join levels l on l.id = p.level_id
      where w.id = case when tg_op = 'DELETE' then old.wall_id else new.wall_id end;
    when 'dimensions' then
      select project_id into target_project_id from levels
      where id = case when tg_op = 'DELETE' then old.level_id else new.level_id end;
    when 'notes' then
      target_project_id := case when tg_op = 'DELETE' then old.project_id else new.project_id end;
    else
      raise exception 'PROJECT_RESOURCE_UNSUPPORTED: %', tg_table_name;
  end case;

  if target_project_id is null then
    target_project_id := nullif(
      current_setting('batibrain.editing_lock_project_id', true), ''
    )::uuid;
  end if;

  if target_project_id is null then
    raise exception 'PROJECT_NOT_FOUND_FOR_RESOURCE: %', tg_table_name;
  end if;

  perform acquire_project_editing_lock(target_project_id);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare
  resource_table text;
begin
  foreach resource_table in array array[
    'levels', 'pieces', 'piece_vertices', 'walls', 'wall_pieces', 'wall_faces',
    'wall_height_points', 'openings', 'dimensions', 'notes'
  ] loop
    execute format(
      'create trigger %I before insert or update or delete on %I for each row execute function guard_project_resource_write()',
      resource_table || '_editing_lock', resource_table
    );
  end loop;
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

  perform acquire_project_editing_lock(target_project_id);
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

drop policy projects_update_owner on projects;

revoke all on function acquire_project_editing_lock(uuid) from public;
revoke all on function project_editing_lock_state(uuid) from public;
revoke all on function update_project_with_lock(uuid, text, text, text, boolean) from public;
grant execute on function project_editing_lock_state(uuid) to authenticated;
grant execute on function update_project_with_lock(uuid, text, text, text, boolean) to authenticated;

commit;
