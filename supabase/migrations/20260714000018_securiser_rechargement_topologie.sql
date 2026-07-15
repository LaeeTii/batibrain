-- BatiBrain — V1-24, réparation et validation stricte des murs mitoyens.
begin;

-- Répare un ancien coin de pièce resté à sa position précédente alors que les
-- deux murs mitoyens incidents avaient déjà été déplacés avec la pièce voisine.
with vertex_counts as (
  select piece_id, count(*)::integer as vertex_count
  from piece_vertices
  group by piece_id
), vertex_cycles as (
  select
    current_vertex.id as current_vertex_id,
    current_vertex.piece_id,
    current_vertex.x_cm as current_x,
    current_vertex.y_cm as current_y,
    previous_vertex.x_cm as previous_x,
    previous_vertex.y_cm as previous_y,
    next_vertex.x_cm as next_x,
    next_vertex.y_cm as next_y
  from piece_vertices current_vertex
  join vertex_counts counts on counts.piece_id = current_vertex.piece_id
  join piece_vertices previous_vertex
    on previous_vertex.piece_id = current_vertex.piece_id
   and previous_vertex.vertex_order = (current_vertex.vertex_order - 1 + counts.vertex_count) % counts.vertex_count
  join piece_vertices next_vertex
    on next_vertex.piece_id = current_vertex.piece_id
   and next_vertex.vertex_order = (current_vertex.vertex_order + 1) % counts.vertex_count
), shared_wall_ids as (
  select wall_id
  from wall_pieces
  group by wall_id
  having count(distinct piece_id) = 2
), shared_wall_pairs as (
  select
    first_relation.piece_id,
    common_vertex.id as common_vertex_id,
    common_vertex.x_cm as common_x,
    common_vertex.y_cm as common_y,
    first_outer.x_cm as first_outer_x,
    first_outer.y_cm as first_outer_y,
    second_outer.x_cm as second_outer_x,
    second_outer.y_cm as second_outer_y
  from wall_pieces first_relation
  join shared_wall_ids first_shared on first_shared.wall_id = first_relation.wall_id
  join walls first_wall on first_wall.id = first_relation.wall_id
  join wall_pieces second_relation
    on second_relation.piece_id = first_relation.piece_id
   and second_relation.wall_id > first_relation.wall_id
  join shared_wall_ids second_shared on second_shared.wall_id = second_relation.wall_id
  join walls second_wall on second_wall.id = second_relation.wall_id
  cross join lateral (
    select case
      when first_wall.start_vertex_id in (second_wall.start_vertex_id, second_wall.end_vertex_id) then first_wall.start_vertex_id
      when first_wall.end_vertex_id in (second_wall.start_vertex_id, second_wall.end_vertex_id) then first_wall.end_vertex_id
      else null::uuid
    end as id
  ) common_id
  join piece_vertices common_vertex on common_vertex.id = common_id.id
  join piece_vertices first_outer on first_outer.id = case
    when first_wall.start_vertex_id = common_id.id then first_wall.end_vertex_id else first_wall.start_vertex_id end
  join piece_vertices second_outer on second_outer.id = case
    when second_wall.start_vertex_id = common_id.id then second_wall.end_vertex_id else second_wall.start_vertex_id end
), repair_candidates as (
  select distinct
    cycle.current_vertex_id,
    pair.common_x,
    pair.common_y
  from vertex_cycles cycle
  join shared_wall_pairs pair on pair.piece_id = cycle.piece_id
  where (cycle.current_x, cycle.current_y) is distinct from (pair.common_x, pair.common_y)
    and (
      ((cycle.previous_x, cycle.previous_y) = (pair.first_outer_x, pair.first_outer_y)
        and (cycle.next_x, cycle.next_y) = (pair.second_outer_x, pair.second_outer_y))
      or
      ((cycle.previous_x, cycle.previous_y) = (pair.second_outer_x, pair.second_outer_y)
        and (cycle.next_x, cycle.next_y) = (pair.first_outer_x, pair.first_outer_y))
    )
), unambiguous_repairs as (
  select
    current_vertex_id,
    min(common_x) as common_x,
    min(common_y) as common_y
  from repair_candidates
  group by current_vertex_id
  having count(distinct (common_x, common_y)) = 1
)
update piece_vertices vertex
set x_cm = repair.common_x,
    y_cm = repair.common_y
from unambiguous_repairs repair
where vertex.id = repair.current_vertex_id;

create or replace function replace_piece_topology(
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
  endpoint_piece_id uuid;
begin
  if coalesce(jsonb_typeof(replaced_piece_ids), 'null') <> 'array'
    or coalesce(jsonb_typeof(pieces_data), 'null') <> 'array'
    or coalesce(jsonb_typeof(walls_data), 'null') <> 'array' then
    raise exception 'La topologie remplacée doit être fournie sous forme de tableaux.';
  end if;
  if (select count(distinct value) from jsonb_array_elements_text(replaced_piece_ids)) <> jsonb_array_length(replaced_piece_ids) then
    raise exception 'Les identifiants des pièces remplacées doivent être uniques.';
  end if;
  if exists (
    select 1 from pieces piece
    where piece.level_id = target_level_id
      and not piece.is_soft_deleted
      and piece.id not in (select value::uuid from jsonb_array_elements_text(replaced_piece_ids))
  ) or exists (
    select 1 from jsonb_array_elements_text(replaced_piece_ids) item
    where not exists (
      select 1 from pieces piece
      where piece.id = item.value::uuid
        and piece.level_id = target_level_id
        and not piece.is_soft_deleted
    )
  ) then
    raise exception 'Une normalisation topologique doit remplacer toutes les pièces actives du niveau.';
  end if;
  if (select count(distinct (value -> 'piece' ->> 'id')::uuid) from jsonb_array_elements(pieces_data)) <> jsonb_array_length(pieces_data) then
    raise exception 'Les pièces résultantes doivent avoir des identifiants uniques.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(pieces_data) item
    where coalesce(jsonb_typeof(item.value -> 'piece'), 'null') <> 'object'
      or coalesce(jsonb_typeof(item.value -> 'vertices'), 'null') <> 'array'
      or jsonb_array_length(item.value -> 'vertices') < 3
      or (item.value -> 'piece' ->> 'level_id')::uuid <> target_level_id
  ) then
    raise exception 'Chaque pièce résultante doit appartenir au niveau et contenir au moins trois sommets.';
  end if;
  if (select count(distinct (value ->> 'id')::uuid) from jsonb_array_elements(walls_data)) <> jsonb_array_length(walls_data) then
    raise exception 'Les murs résultants doivent avoir des identifiants uniques.';
  end if;

  delete from pieces
  where id in (select item.value::uuid from jsonb_array_elements_text(replaced_piece_ids) item);

  for piece_entry in select value from jsonb_array_elements(pieces_data) loop
    current_piece_id := (piece_entry -> 'piece' ->> 'id')::uuid;
    if (select count(distinct (value ->> 'id')::uuid) from jsonb_array_elements(piece_entry -> 'vertices')) <> jsonb_array_length(piece_entry -> 'vertices')
      or (select count(distinct (value ->> 'vertex_order')::integer) from jsonb_array_elements(piece_entry -> 'vertices')) <> jsonb_array_length(piece_entry -> 'vertices')
      or (select min((value ->> 'vertex_order')::integer) from jsonb_array_elements(piece_entry -> 'vertices')) <> 0
      or (select max((value ->> 'vertex_order')::integer) from jsonb_array_elements(piece_entry -> 'vertices')) <> jsonb_array_length(piece_entry -> 'vertices') - 1 then
      raise exception 'Les sommets de chaque pièce doivent être uniques et ordonnés sans interruption.';
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
    if coalesce(jsonb_typeof(wall_data -> 'piece_ids'), 'null') <> 'array'
      or jsonb_array_length(wall_data -> 'piece_ids') not between 1 and 2
      or (select count(distinct value) from jsonb_array_elements_text(wall_data -> 'piece_ids')) <> jsonb_array_length(wall_data -> 'piece_ids') then
      raise exception 'Un mur doit être lié à une ou deux pièces distinctes.';
    end if;
    select start_vertex.piece_id into endpoint_piece_id
    from piece_vertices start_vertex
    join piece_vertices end_vertex on end_vertex.id = (wall_data ->> 'end_vertex_id')::uuid
    where start_vertex.id = (wall_data ->> 'start_vertex_id')::uuid
      and start_vertex.piece_id = end_vertex.piece_id;
    if endpoint_piece_id is null
      or not ((wall_data -> 'piece_ids') ? endpoint_piece_id::text) then
      raise exception 'Les extrémités canoniques d’un mur doivent appartenir à l’une de ses pièces.';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(wall_data -> 'piece_ids') relation
      where not exists (
        select 1 from pieces piece
        where piece.id = relation.value::uuid and piece.level_id = target_level_id
      )
    ) then
      raise exception 'Chaque relation mur–pièce doit rester dans le niveau remplacé.';
    end if;
    if coalesce(jsonb_typeof(wall_data -> 'profiles' -> 'gauche'), 'null') <> 'array'
      or coalesce(jsonb_typeof(wall_data -> 'profiles' -> 'droite'), 'null') <> 'array' then
      raise exception 'Chaque mur doit fournir les profils de ses deux faces.';
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

  if exists (
    with ordered_vertices as (
      select
        vertex.piece_id,
        vertex.x_cm as start_x,
        vertex.y_cm as start_y,
        lead(vertex.x_cm) over (partition by vertex.piece_id order by vertex.vertex_order) as next_x,
        lead(vertex.y_cm) over (partition by vertex.piece_id order by vertex.vertex_order) as next_y,
        first_value(vertex.x_cm) over (partition by vertex.piece_id order by vertex.vertex_order) as first_x,
        first_value(vertex.y_cm) over (partition by vertex.piece_id order by vertex.vertex_order) as first_y
      from piece_vertices vertex
      where vertex.piece_id = any(created_ids)
    ), piece_edges as (
      select piece_id, start_x, start_y, coalesce(next_x, first_x) as end_x, coalesce(next_y, first_y) as end_y
      from ordered_vertices
    ), edge_wall_counts as (
      select edge.*, count(end_vertex.id) as wall_count
      from piece_edges edge
      left join wall_pieces relation on relation.piece_id = edge.piece_id
      left join walls wall on wall.id = relation.wall_id
      left join piece_vertices start_vertex on start_vertex.id = wall.start_vertex_id
      left join piece_vertices end_vertex on end_vertex.id = wall.end_vertex_id
        and (
          (start_vertex.x_cm = edge.start_x and start_vertex.y_cm = edge.start_y and end_vertex.x_cm = edge.end_x and end_vertex.y_cm = edge.end_y)
          or
          (start_vertex.x_cm = edge.end_x and start_vertex.y_cm = edge.end_y and end_vertex.x_cm = edge.start_x and end_vertex.y_cm = edge.start_y)
        )
      group by edge.piece_id, edge.start_x, edge.start_y, edge.end_x, edge.end_y
    )
    select 1 from edge_wall_counts where wall_count <> 1
  ) then
    raise exception 'Chaque arête de pièce doit correspondre à un unique mur.';
  end if;

  if exists (
    with ordered_vertices as (
      select
        vertex.piece_id,
        vertex.x_cm as start_x,
        vertex.y_cm as start_y,
        lead(vertex.x_cm) over (partition by vertex.piece_id order by vertex.vertex_order) as next_x,
        lead(vertex.y_cm) over (partition by vertex.piece_id order by vertex.vertex_order) as next_y,
        first_value(vertex.x_cm) over (partition by vertex.piece_id order by vertex.vertex_order) as first_x,
        first_value(vertex.y_cm) over (partition by vertex.piece_id order by vertex.vertex_order) as first_y
      from piece_vertices vertex
      where vertex.piece_id = any(created_ids)
    ), piece_edges as (
      select piece_id, start_x, start_y, coalesce(next_x, first_x) as end_x, coalesce(next_y, first_y) as end_y
      from ordered_vertices
    )
    select 1
    from wall_pieces relation
    join walls wall on wall.id = relation.wall_id
    join piece_vertices start_vertex on start_vertex.id = wall.start_vertex_id
    join piece_vertices end_vertex on end_vertex.id = wall.end_vertex_id
    where relation.piece_id = any(created_ids)
      and not exists (
        select 1 from piece_edges edge
        where edge.piece_id = relation.piece_id
          and (
            (start_vertex.x_cm = edge.start_x and start_vertex.y_cm = edge.start_y and end_vertex.x_cm = edge.end_x and end_vertex.y_cm = edge.end_y)
            or
            (start_vertex.x_cm = edge.end_x and start_vertex.y_cm = edge.end_y and end_vertex.x_cm = edge.start_x and end_vertex.y_cm = edge.start_y)
          )
      )
  ) then
    raise exception 'Chaque relation mur–pièce doit correspondre à une arête réelle de la pièce.';
  end if;

  if exists (
    select 1
    from (
      select
        case when (start_vertex.x_cm, start_vertex.y_cm) <= (end_vertex.x_cm, end_vertex.y_cm) then start_vertex.x_cm else end_vertex.x_cm end as point_a_x,
        case when (start_vertex.x_cm, start_vertex.y_cm) <= (end_vertex.x_cm, end_vertex.y_cm) then start_vertex.y_cm else end_vertex.y_cm end as point_a_y,
        case when (start_vertex.x_cm, start_vertex.y_cm) <= (end_vertex.x_cm, end_vertex.y_cm) then end_vertex.x_cm else start_vertex.x_cm end as point_b_x,
        case when (start_vertex.x_cm, start_vertex.y_cm) <= (end_vertex.x_cm, end_vertex.y_cm) then end_vertex.y_cm else start_vertex.y_cm end as point_b_y,
        count(distinct wall.id) as wall_count
      from walls wall
      join piece_vertices start_vertex on start_vertex.id = wall.start_vertex_id
      join piece_vertices end_vertex on end_vertex.id = wall.end_vertex_id
      join pieces owner_piece on owner_piece.id = start_vertex.piece_id
      where owner_piece.level_id = target_level_id
      group by point_a_x, point_a_y, point_b_x, point_b_y
      having count(distinct wall.id) > 1
    ) duplicate_segments
  ) then
    raise exception 'Un segment physique ne peut être porté que par un seul mur.';
  end if;

  return created_ids;
end;
$$;

create or replace function update_piece_geometry(target_piece_id uuid, vertices_data jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  vertex_data jsonb;
begin
  if coalesce(jsonb_typeof(vertices_data), 'null') <> 'array' or jsonb_array_length(vertices_data) < 3 then
    raise exception 'Une pièce doit contenir au moins trois sommets.';
  end if;
  if (select count(distinct (value ->> 'id')::uuid) from jsonb_array_elements(vertices_data)) <> jsonb_array_length(vertices_data)
    or (select count(distinct (value ->> 'vertex_order')::integer) from jsonb_array_elements(vertices_data)) <> jsonb_array_length(vertices_data) then
    raise exception 'Les sommets et leurs positions dans l’ordre doivent être uniques.';
  end if;
  if (select min((value ->> 'vertex_order')::integer) from jsonb_array_elements(vertices_data)) <> 0
    or (select max((value ->> 'vertex_order')::integer) from jsonb_array_elements(vertices_data)) <> jsonb_array_length(vertices_data) - 1 then
    raise exception 'L’ordre des sommets doit être continu à partir de zéro.';
  end if;
  if (select count(*) from piece_vertices where piece_id = target_piece_id) <> jsonb_array_length(vertices_data)
    or exists (
      select 1 from jsonb_array_elements(vertices_data) item
      where not exists (
        select 1 from piece_vertices vertex
        where vertex.id = (item.value ->> 'id')::uuid and vertex.piece_id = target_piece_id
      )
    ) then
    raise exception 'La mise à jour doit fournir exactement les sommets actuels de la pièce.';
  end if;

  for vertex_data in select value from jsonb_array_elements(vertices_data) loop
    update piece_vertices
    set vertex_order = (vertex_data ->> 'vertex_order')::integer,
        x_cm = (vertex_data ->> 'x_cm')::numeric,
        y_cm = (vertex_data ->> 'y_cm')::numeric
    where id = (vertex_data ->> 'id')::uuid and piece_id = target_piece_id;
  end loop;

  if exists (
    with ordered_vertices as (
      select
        vertex.x_cm as start_x,
        vertex.y_cm as start_y,
        lead(vertex.x_cm) over (order by vertex.vertex_order) as next_x,
        lead(vertex.y_cm) over (order by vertex.vertex_order) as next_y,
        first_value(vertex.x_cm) over (order by vertex.vertex_order) as first_x,
        first_value(vertex.y_cm) over (order by vertex.vertex_order) as first_y
      from piece_vertices vertex
      where vertex.piece_id = target_piece_id
    ), piece_edges as (
      select start_x, start_y, coalesce(next_x, first_x) as end_x, coalesce(next_y, first_y) as end_y
      from ordered_vertices
    ), edge_wall_counts as (
      select edge.*, count(end_vertex.id) as wall_count
      from piece_edges edge
      left join wall_pieces relation on relation.piece_id = target_piece_id
      left join walls wall on wall.id = relation.wall_id
      left join piece_vertices start_vertex on start_vertex.id = wall.start_vertex_id
      left join piece_vertices end_vertex on end_vertex.id = wall.end_vertex_id
        and (
          (start_vertex.x_cm = edge.start_x and start_vertex.y_cm = edge.start_y and end_vertex.x_cm = edge.end_x and end_vertex.y_cm = edge.end_y)
          or
          (start_vertex.x_cm = edge.end_x and start_vertex.y_cm = edge.end_y and end_vertex.x_cm = edge.start_x and end_vertex.y_cm = edge.start_y)
        )
      group by edge.start_x, edge.start_y, edge.end_x, edge.end_y
    )
    select 1 from edge_wall_counts where wall_count <> 1
  ) then
    raise exception 'La modification désolidariserait un mur de la pièce.';
  end if;

  if exists (
    with affected_walls as (
      select wall_id from wall_pieces where piece_id = target_piece_id
    ), affected_pieces as (
      select distinct relation.piece_id
      from wall_pieces relation
      join affected_walls affected on affected.wall_id = relation.wall_id
    ), ordered_vertices as (
      select
        vertex.piece_id,
        vertex.x_cm as start_x,
        vertex.y_cm as start_y,
        lead(vertex.x_cm) over (partition by vertex.piece_id order by vertex.vertex_order) as next_x,
        lead(vertex.y_cm) over (partition by vertex.piece_id order by vertex.vertex_order) as next_y,
        first_value(vertex.x_cm) over (partition by vertex.piece_id order by vertex.vertex_order) as first_x,
        first_value(vertex.y_cm) over (partition by vertex.piece_id order by vertex.vertex_order) as first_y
      from piece_vertices vertex
      join affected_pieces affected on affected.piece_id = vertex.piece_id
    ), piece_edges as (
      select piece_id, start_x, start_y, coalesce(next_x, first_x) as end_x, coalesce(next_y, first_y) as end_y
      from ordered_vertices
    )
    select 1
    from affected_walls affected
    join wall_pieces relation on relation.wall_id = affected.wall_id
    join walls wall on wall.id = affected.wall_id
    join piece_vertices start_vertex on start_vertex.id = wall.start_vertex_id
    join piece_vertices end_vertex on end_vertex.id = wall.end_vertex_id
    where not exists (
      select 1 from piece_edges edge
      where edge.piece_id = relation.piece_id
        and (
          (start_vertex.x_cm = edge.start_x and start_vertex.y_cm = edge.start_y and end_vertex.x_cm = edge.end_x and end_vertex.y_cm = edge.end_y)
          or
          (start_vertex.x_cm = edge.end_x and start_vertex.y_cm = edge.end_y and end_vertex.x_cm = edge.start_x and end_vertex.y_cm = edge.start_y)
        )
    )
  ) then
    raise exception 'La modification désolidariserait un mur de sa pièce voisine.';
  end if;
end;
$$;

revoke all on function replace_piece_topology(uuid, jsonb, jsonb, jsonb) from public;
grant execute on function replace_piece_topology(uuid, jsonb, jsonb, jsonb) to authenticated;
revoke all on function update_piece_geometry(uuid, jsonb) from public;
grant execute on function update_piece_geometry(uuid, jsonb) to authenticated;

commit;
