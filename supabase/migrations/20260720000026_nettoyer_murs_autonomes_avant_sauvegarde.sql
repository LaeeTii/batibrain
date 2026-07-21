begin;

alter function public.save_level_geometry(uuid, bigint, jsonb)
  rename to save_level_geometry_without_detached_cleanup;

revoke all on function public.save_level_geometry_without_detached_cleanup(uuid, bigint, jsonb) from public;
revoke all on function public.save_level_geometry_without_detached_cleanup(uuid, bigint, jsonb) from authenticated;

create function public.save_level_geometry(
  target_level_id uuid,
  expected_revision bigint,
  snapshot_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_revision bigint;
  detached_wall_ids uuid[];
begin
  select level.geometry_revision
  into current_revision
  from levels level
  where level.id = target_level_id
  for update;

  if current_revision is null then
    raise exception 'LEVEL_NOT_FOUND';
  end if;
  if not exists (
    select 1 from levels
    where id = target_level_id
      and can_write_project(project_id)
  ) then
    raise exception 'PROJECT_WRITE_REQUIRED';
  end if;
  if current_revision <> expected_revision then
    raise exception 'GEOMETRY_REVISION_CONFLICT';
  end if;

  -- Les verrous des objets autonomes doivent être contrôlés avant leur nettoyage.
  if exists (
    select 1
    from vertices current_vertex
    where current_vertex.level_id = target_level_id
      and current_vertex.is_locked
      and not exists (
        select 1 from piece_vertices relation
        where relation.vertex_id = current_vertex.id
      )
      and (
        not exists (
          select 1 from jsonb_array_elements(coalesce(snapshot_data -> 'vertices', '[]'::jsonb)) submitted
          where (submitted.value ->> 'id')::uuid = current_vertex.id
        )
        or exists (
          select 1 from jsonb_array_elements(coalesce(snapshot_data -> 'vertices', '[]'::jsonb)) submitted
          where (submitted.value ->> 'id')::uuid = current_vertex.id
            and (
              (submitted.value ->> 'x_cm')::numeric <> current_vertex.x_cm
              or (submitted.value ->> 'y_cm')::numeric <> current_vertex.y_cm
            )
            and coalesce((submitted.value ->> 'is_locked')::boolean, true)
        )
      )
      and not coalesce(snapshot_data -> 'unlocked_vertex_ids', '[]'::jsonb) ? current_vertex.id::text
  ) then
    raise exception 'LOCKED_VERTEX_MUTATION';
  end if;

  if exists (
    select 1
    from wall_height_points current_point
    join walls current_wall on current_wall.id = current_point.wall_id
    where current_wall.level_id = target_level_id
      and current_point.is_locked
      and not exists (
        select 1 from wall_pieces relation
        where relation.wall_id = current_wall.id
      )
      and (
        not exists (
          select 1
          from jsonb_array_elements(coalesce(snapshot_data -> 'walls', '[]'::jsonb)) submitted_wall
          cross join lateral jsonb_array_elements(submitted_wall.value -> 'profiles' -> current_point.face_side) submitted_point
          where (submitted_point.value ->> 'id')::uuid = current_point.id
        )
        or exists (
          select 1
          from jsonb_array_elements(coalesce(snapshot_data -> 'walls', '[]'::jsonb)) submitted_wall
          cross join lateral jsonb_array_elements(submitted_wall.value -> 'profiles' -> current_point.face_side) submitted_point
          where (submitted_point.value ->> 'id')::uuid = current_point.id
            and (
              (submitted_point.value ->> 'position_cm')::numeric <> current_point.position_cm
              or (submitted_point.value ->> 'height_cm')::numeric <> current_point.height_cm
            )
            and coalesce((submitted_point.value ->> 'is_locked')::boolean, true)
        )
      )
      and not coalesce(snapshot_data -> 'unlocked_profile_point_ids', '[]'::jsonb) ? current_point.id::text
  ) then
    raise exception 'LOCKED_PROFILE_POINT_MUTATION';
  end if;

  select array_agg(wall.id)
  into detached_wall_ids
  from walls wall
  where wall.level_id = target_level_id
    and not exists (
      select 1 from wall_pieces relation
      where relation.wall_id = wall.id
    );

  delete from openings where wall_id = any(coalesce(detached_wall_ids, '{}'::uuid[]));
  delete from wall_height_points where wall_id = any(coalesce(detached_wall_ids, '{}'::uuid[]));
  delete from wall_faces where wall_id = any(coalesce(detached_wall_ids, '{}'::uuid[]));
  delete from walls where id = any(coalesce(detached_wall_ids, '{}'::uuid[]));
  delete from vertices vertex
  where vertex.level_id = target_level_id
    and not exists (select 1 from piece_vertices relation where relation.vertex_id = vertex.id)
    and not exists (
      select 1 from walls wall
      where vertex.id in (wall.start_vertex_id, wall.end_vertex_id)
    );

  return public.save_level_geometry_without_detached_cleanup(
    target_level_id,
    expected_revision,
    snapshot_data
  );
end;
$$;

revoke all on function public.save_level_geometry(uuid, bigint, jsonb) from public;
grant execute on function public.save_level_geometry(uuid, bigint, jsonb) to authenticated;

commit;
