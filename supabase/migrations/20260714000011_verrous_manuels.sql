-- Verrous manuels indépendants des pièces, murs et ouvertures — V1-19.

begin;

create or replace function guard_manual_resource_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  locked boolean := false;
begin
  case tg_table_name
    when 'pieces', 'walls', 'openings' then
      if tg_op = 'INSERT' then
        return new;
      end if;
      locked := old.is_locked;
      if tg_op = 'UPDATE'
        and locked
        and new.is_locked = false
        and (to_jsonb(new) - 'is_locked') = (to_jsonb(old) - 'is_locked') then
        return new;
      end if;
    when 'piece_vertices' then
      select p.is_locked into locked from pieces p
      where p.id = case when tg_op = 'DELETE' then old.piece_id else new.piece_id end;
    when 'wall_pieces' then
      select coalesce(w.is_locked, false) or coalesce(p.is_locked, false) into locked
      from walls w cross join pieces p
      where w.id = case when tg_op = 'DELETE' then old.wall_id else new.wall_id end
        and p.id = case when tg_op = 'DELETE' then old.piece_id else new.piece_id end;
    when 'wall_faces', 'wall_height_points' then
      select w.is_locked into locked from walls w
      where w.id = case when tg_op = 'DELETE' then old.wall_id else new.wall_id end;
    else
      raise exception 'MANUAL_LOCK_RESOURCE_UNSUPPORTED: %', tg_table_name;
  end case;

  if locked then
    raise exception 'MANUAL_RESOURCE_LOCKED';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare
  resource_table text;
begin
  foreach resource_table in array array[
    'pieces', 'piece_vertices', 'walls', 'wall_pieces', 'wall_faces',
    'wall_height_points', 'openings'
  ] loop
    execute format(
      'create trigger %I before insert or update or delete on %I for each row execute function guard_manual_resource_lock()',
      resource_table || '_manual_lock', resource_table
    );
  end loop;
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

  perform acquire_project_editing_lock(target_project_id);
  case resource_type
    when 'pièce' then update pieces set is_locked = target_locked where id = resource_id;
    when 'mur' then update walls set is_locked = target_locked where id = resource_id;
    when 'ouverture' then update openings set is_locked = target_locked where id = resource_id;
  end case;
  return target_locked;
end;
$$;

revoke all on function set_project_resource_manual_lock(text, uuid, boolean) from public;
grant execute on function set_project_resource_manual_lock(text, uuid, boolean) to authenticated;

commit;
