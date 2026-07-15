-- BatiBrain — V1-24, persistance atomique des murs mitoyens uniques.
begin;

create function replace_piece_topology(
  target_level_id uuid,
  replaced_piece_ids jsonb,
  pieces_data jsonb,
  walls_data jsonb
)
returns uuid[]
language plpgsql
security invoker
set search_path = public
as $$
declare
  piece_entry jsonb;
  vertex_data jsonb;
  wall_data jsonb;
  relation_data jsonb;
  face_side text;
  point_data jsonb;
  created_ids uuid[] := '{}';
  current_piece_id uuid;
  current_wall_id uuid;
begin
  if jsonb_typeof(replaced_piece_ids) <> 'array'
    or jsonb_typeof(pieces_data) <> 'array'
    or jsonb_typeof(walls_data) <> 'array' then
    raise exception 'La topologie remplacée doit être fournie sous forme de tableaux.';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(replaced_piece_ids) as item(value)
    where not exists (select 1 from pieces where id = item.value::uuid and level_id = target_level_id)
  ) then
    raise exception 'Chaque pièce remplacée doit appartenir au niveau ciblé.';
  end if;

  delete from pieces
  where id in (select item.value::uuid from jsonb_array_elements_text(replaced_piece_ids) as item(value));

  for piece_entry in select value from jsonb_array_elements(pieces_data) loop
    current_piece_id := (piece_entry -> 'piece' ->> 'id')::uuid;
    if (piece_entry -> 'piece' ->> 'level_id')::uuid <> target_level_id
      or jsonb_array_length(piece_entry -> 'vertices') < 3 then
      raise exception 'Chaque pièce résultante doit appartenir au niveau et contenir au moins trois sommets.';
    end if;
    insert into pieces (
      id, level_id, name, room_type, floor_color, wall_thickness_cm,
      wall_height_cm, notes, is_soft_deleted, is_locked
    ) values (
      current_piece_id, target_level_id, piece_entry -> 'piece' ->> 'name',
      piece_entry -> 'piece' ->> 'room_type', piece_entry -> 'piece' ->> 'floor_color',
      (piece_entry -> 'piece' ->> 'wall_thickness_cm')::numeric,
      (piece_entry -> 'piece' ->> 'wall_height_cm')::numeric,
      piece_entry -> 'piece' ->> 'notes', false,
      coalesce((piece_entry -> 'piece' ->> 'is_locked')::boolean, false)
    );
    for vertex_data in select value from jsonb_array_elements(piece_entry -> 'vertices') loop
      insert into piece_vertices (id, piece_id, vertex_order, x_cm, y_cm)
      values (
        (vertex_data ->> 'id')::uuid, current_piece_id,
        (vertex_data ->> 'vertex_order')::integer,
        (vertex_data ->> 'x_cm')::numeric, (vertex_data ->> 'y_cm')::numeric
      );
    end loop;
    created_ids := array_append(created_ids, current_piece_id);
  end loop;

  for wall_data in select value from jsonb_array_elements(walls_data) loop
    current_wall_id := (wall_data ->> 'id')::uuid;
    if jsonb_array_length(wall_data -> 'piece_ids') < 1
      or jsonb_array_length(wall_data -> 'piece_ids') > 2 then
      raise exception 'Un mur doit être lié à une ou deux pièces.';
    end if;
    insert into walls (
      id, start_vertex_id, end_vertex_id, thickness_cm,
      height_profiles_linked, material, insulation, notes, is_locked
    ) values (
      current_wall_id, (wall_data ->> 'start_vertex_id')::uuid,
      (wall_data ->> 'end_vertex_id')::uuid, (wall_data ->> 'thickness_cm')::numeric,
      coalesce((wall_data ->> 'height_profiles_linked')::boolean, true),
      wall_data ->> 'material', wall_data ->> 'insulation', wall_data ->> 'notes',
      coalesce((wall_data ->> 'is_locked')::boolean, false)
    );
    for relation_data in select value from jsonb_array_elements(wall_data -> 'piece_ids') loop
      insert into wall_pieces (wall_id, piece_id)
      values (current_wall_id, (relation_data #>> '{}')::uuid);
    end loop;
    foreach face_side in array array['gauche', 'droite'] loop
      insert into wall_faces (wall_id, face_side) values (current_wall_id, face_side);
      for point_data in select value from jsonb_array_elements(wall_data -> 'profiles' -> face_side) loop
        insert into wall_height_points (id, wall_id, face_side, point_order, position_cm, height_cm)
        values (
          (point_data ->> 'id')::uuid, current_wall_id, face_side,
          (point_data ->> 'point_order')::integer,
          (point_data ->> 'position_cm')::numeric, (point_data ->> 'height_cm')::numeric
        );
      end loop;
    end loop;
  end loop;
  return created_ids;
end;
$$;

revoke all on function replace_piece_topology(uuid, jsonb, jsonb, jsonb) from public;
grant execute on function replace_piece_topology(uuid, jsonb, jsonb, jsonb) to authenticated;

commit;
