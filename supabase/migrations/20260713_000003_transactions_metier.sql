-- BatiBrain — transactions métier V1-08

begin;

/* Transactions métier : frontière d'écriture indivisible. */

create function create_piece_complete(
  piece_data jsonb,
  vertices_data jsonb,
  walls_data jsonb
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  created_piece_id uuid := (piece_data ->> 'id')::uuid;
  vertex_data jsonb;
  wall_data jsonb;
  created_wall_id uuid;
  face_side text;
  point_data jsonb;
begin
  if created_piece_id is null
    or jsonb_typeof(vertices_data) <> 'array'
    or jsonb_array_length(vertices_data) < 3
    or jsonb_typeof(walls_data) <> 'array'
    or jsonb_array_length(walls_data) <> jsonb_array_length(vertices_data) then
    raise exception 'La pièce complète doit fournir un identifiant, au moins trois sommets et un mur par sommet.';
  end if;

  insert into pieces (
    id, level_id, name, room_type, floor_color, wall_thickness_cm,
    wall_height_cm, notes, is_soft_deleted, is_locked
  ) values (
    created_piece_id,
    (piece_data ->> 'level_id')::uuid,
    piece_data ->> 'name',
    piece_data ->> 'room_type',
    piece_data ->> 'floor_color',
    (piece_data ->> 'wall_thickness_cm')::numeric,
    (piece_data ->> 'wall_height_cm')::numeric,
    piece_data ->> 'notes',
    coalesce((piece_data ->> 'is_soft_deleted')::boolean, false),
    coalesce((piece_data ->> 'is_locked')::boolean, false)
  );

  for vertex_data in select value from jsonb_array_elements(vertices_data) loop
    insert into piece_vertices (id, piece_id, vertex_order, x_cm, y_cm)
    values (
      (vertex_data ->> 'id')::uuid, created_piece_id,
      (vertex_data ->> 'vertex_order')::integer,
      (vertex_data ->> 'x_cm')::numeric, (vertex_data ->> 'y_cm')::numeric
    );
  end loop;

  for wall_data in select value from jsonb_array_elements(walls_data) loop
    created_wall_id := (wall_data ->> 'id')::uuid;
    insert into walls (
      id, start_vertex_id, end_vertex_id, thickness_cm,
      height_profiles_linked, material, insulation, notes, is_locked
    ) values (
      created_wall_id,
      (wall_data ->> 'start_vertex_id')::uuid,
      (wall_data ->> 'end_vertex_id')::uuid,
      (wall_data ->> 'thickness_cm')::numeric,
      coalesce((wall_data ->> 'height_profiles_linked')::boolean, true),
      wall_data ->> 'material', wall_data ->> 'insulation',
      wall_data ->> 'notes', coalesce((wall_data ->> 'is_locked')::boolean, false)
    );
    insert into wall_pieces (wall_id, piece_id) values (created_wall_id, created_piece_id);

    foreach face_side in array array['gauche', 'droite'] loop
      insert into wall_faces (wall_id, face_side) values (created_wall_id, face_side);
      for point_data in
        select value from jsonb_array_elements(wall_data -> 'profiles' -> face_side)
      loop
        insert into wall_height_points (
          id, wall_id, face_side, point_order, position_cm, height_cm
        ) values (
          (point_data ->> 'id')::uuid, created_wall_id, face_side,
          (point_data ->> 'point_order')::integer,
          (point_data ->> 'position_cm')::numeric,
          (point_data ->> 'height_cm')::numeric
        );
      end loop;
    end loop;
  end loop;

  return created_piece_id;
end;
$$;

create function replace_wall_topology(
  target_level_id uuid,
  replaced_wall_ids jsonb,
  walls_data jsonb,
  openings_data jsonb
)
returns table (wall_count integer, opening_count integer)
language plpgsql
set search_path = public
as $$
declare
  wall_data jsonb;
  relation_data jsonb;
  face_side text;
  point_data jsonb;
  opening_data jsonb;
  current_wall_id uuid;
begin
  if not exists (select 1 from levels where id = target_level_id) then
    raise exception 'Niveau introuvable.';
  end if;
  if jsonb_typeof(replaced_wall_ids) <> 'array'
    or jsonb_array_length(replaced_wall_ids) = 0
    or jsonb_typeof(walls_data) <> 'array'
    or jsonb_typeof(openings_data) <> 'array' then
    raise exception 'Les murs remplacés, la topologie résultante et les ouvertures doivent être des tableaux.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(walls_data) wall
    where jsonb_array_length(coalesce(wall -> 'piece_ids', '[]'::jsonb)) > 2
  ) then
    raise exception 'Un mur ne peut pas être lié à plus de deux pièces.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(replaced_wall_ids) as replaced(replaced_wall_id)
    where not exists (
      select 1
      from wall_pieces wp
      join pieces p on p.id = wp.piece_id
      where wp.wall_id = replaced_wall_id::uuid
        and p.level_id = target_level_id
    )
  ) then
    raise exception 'Chaque mur remplacé doit appartenir au niveau ciblé.';
  end if;

  delete from walls
  where id in (
    select replaced_wall_id::uuid
    from jsonb_array_elements_text(replaced_wall_ids) as replaced(replaced_wall_id)
  ) and id in (
    select wp.wall_id
    from wall_pieces wp
    join pieces p on p.id = wp.piece_id
    where p.level_id = target_level_id
  );

  for wall_data in select value from jsonb_array_elements(walls_data) loop
    current_wall_id := (wall_data ->> 'id')::uuid;
    if not exists (
      select 1
      from piece_vertices start_vertex
      join pieces start_piece on start_piece.id = start_vertex.piece_id
      join piece_vertices end_vertex on end_vertex.id = (wall_data ->> 'end_vertex_id')::uuid
      join pieces end_piece on end_piece.id = end_vertex.piece_id
      where start_vertex.id = (wall_data ->> 'start_vertex_id')::uuid
        and start_piece.level_id = target_level_id
        and end_piece.level_id = target_level_id
    ) then
      raise exception 'Les sommets d''un mur doivent appartenir au niveau remplacé.';
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
      if not exists (
        select 1 from pieces
        where id = (relation_data #>> '{}')::uuid and level_id = target_level_id
      ) then
        raise exception 'Une relation mur-pièce référence une pièce hors du niveau.';
      end if;
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

  /* Seules les ouvertures encore compatibles sont réinsérées. */
  for opening_data in select value from jsonb_array_elements(openings_data) loop
    current_wall_id := (opening_data ->> 'wall_id')::uuid;
    if (
      select case opening_data ->> 'placement_type'
        when 'intérieur' then count(*) = 2
        when 'extérieur' then count(*) = 1
        else false
      end
      from wall_pieces where wall_id = current_wall_id
    ) then
      insert into openings (
        id, wall_id, template_id, opening_type, placement_type, position_cm,
        width_cm, bottom_cm, height_cm, orientation, notes, is_locked
      ) values (
        (opening_data ->> 'id')::uuid, current_wall_id,
        (opening_data ->> 'template_id')::uuid, opening_data ->> 'opening_type',
        opening_data ->> 'placement_type', (opening_data ->> 'position_cm')::numeric,
        (opening_data ->> 'width_cm')::numeric, (opening_data ->> 'bottom_cm')::numeric,
        (opening_data ->> 'height_cm')::numeric, opening_data ->> 'orientation',
        opening_data ->> 'notes', coalesce((opening_data ->> 'is_locked')::boolean, false)
      );
    end if;
  end loop;

  return query select jsonb_array_length(walls_data), count(*)::integer
  from openings opening
  where opening.wall_id in (
    select (wall ->> 'id')::uuid
    from jsonb_array_elements(walls_data) wall
  );
end;
$$;

create function write_wall_height_profiles(
  target_wall_id uuid,
  profiles_linked boolean,
  left_points jsonb,
  right_points jsonb
)
returns void
language plpgsql
set search_path = public
as $$
declare
  point_data jsonb;
  face_side text;
  points jsonb;
begin
  if not exists (select 1 from walls where id = target_wall_id) then
    raise exception 'Mur introuvable.';
  end if;
  if jsonb_typeof(left_points) <> 'array' or jsonb_typeof(right_points) <> 'array'
    or jsonb_array_length(left_points) < 2 or jsonb_array_length(right_points) < 2 then
    raise exception 'Chaque profil doit contenir au moins deux points.';
  end if;
  if profiles_linked and (
    select jsonb_agg(point - 'id' order by point_index)
    from jsonb_array_elements(left_points) with ordinality as item(point, point_index)
  ) is distinct from (
    select jsonb_agg(point - 'id' order by point_index)
    from jsonb_array_elements(right_points) with ordinality as item(point, point_index)
  ) then
    raise exception 'Deux profils liés doivent être strictement identiques.';
  end if;

  update walls set height_profiles_linked = profiles_linked, updated_at = now()
  where id = target_wall_id;
  delete from wall_height_points where wall_id = target_wall_id;

  foreach face_side in array array['gauche', 'droite'] loop
    points := case face_side when 'gauche' then left_points else right_points end;
    for point_data in select value from jsonb_array_elements(points) loop
      insert into wall_height_points (id, wall_id, face_side, point_order, position_cm, height_cm)
      values (
        coalesce((point_data ->> 'id')::uuid, gen_random_uuid()), target_wall_id, face_side,
        (point_data ->> 'point_order')::integer,
        (point_data ->> 'position_cm')::numeric, (point_data ->> 'height_cm')::numeric
      );
    end loop;
  end loop;
end;
$$;


commit;
