-- BatiBrain — V1-R10, modèle géométrique canonique et sauvegarde transactionnelle unique.

begin;

alter table levels
  add column geometry_revision bigint not null default 0;

-- Les anciennes frontières écrivaient des modèles incompatibles ou partiels.
revoke all on function create_piece_complete(jsonb, jsonb, jsonb) from authenticated;
revoke all on function replace_wall_topology(uuid, jsonb, jsonb, jsonb) from authenticated;
revoke all on function write_wall_height_profiles(uuid, boolean, jsonb, jsonb) from authenticated;
revoke all on function replace_piece_topology_v2(uuid, jsonb, jsonb, jsonb) from authenticated;
revoke all on function update_piece_geometry_v2(uuid, jsonb) from authenticated;

drop function if exists create_piece_complete(jsonb, jsonb, jsonb);
drop function if exists replace_wall_topology(uuid, jsonb, jsonb, jsonb);
drop function if exists write_wall_height_profiles(uuid, boolean, jsonb, jsonb);
drop function if exists replace_piece_geometries(uuid, jsonb, jsonb);
drop function if exists replace_piece_topology_v2(uuid, jsonb, jsonb, jsonb);
drop function if exists update_piece_geometry_v2(uuid, jsonb);

-- Les anciens verrous de ressources sont remplacés par les verrous des points.
drop trigger if exists pieces_manual_lock on pieces;
drop trigger if exists piece_vertices_manual_lock on piece_vertices;
drop trigger if exists walls_manual_lock on walls;
drop trigger if exists wall_pieces_manual_lock on wall_pieces;
drop trigger if exists wall_faces_manual_lock on wall_faces;
drop trigger if exists wall_height_points_manual_lock on wall_height_points;
drop trigger if exists openings_manual_lock on openings;
drop function if exists set_project_resource_manual_lock(text, uuid, boolean);
drop function if exists guard_manual_resource_lock();

-- Les écritures géométriques directes ne sont plus un chemin de production.
drop trigger if exists piece_vertices_editing_lock on piece_vertices;
drop trigger if exists walls_editing_lock on walls;
drop trigger if exists wall_pieces_editing_lock on wall_pieces;
drop trigger if exists wall_faces_editing_lock on wall_faces;
drop trigger if exists wall_height_points_editing_lock on wall_height_points;
drop trigger if exists openings_editing_lock on openings;

alter table piece_vertices rename to legacy_piece_vertices;

create temporary table geometry_vertex_migration_map on commit drop as
select
  legacy.id as legacy_id,
  (
    first_value(legacy.id) over (
      partition by piece.level_id, legacy.x_cm, legacy.y_cm
      order by legacy.id::text
    )
  ) as canonical_id,
  piece.level_id
from legacy_piece_vertices legacy
join pieces piece on piece.id = legacy.piece_id;

create table vertices (
  id uuid primary key,
  level_id uuid not null references levels(id) on delete cascade,
  x_cm numeric(12,2) not null,
  y_cm numeric(12,2) not null,
  is_locked boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (level_id, x_cm, y_cm)
);

insert into vertices (id, level_id, x_cm, y_cm, is_locked)
select
  migration.canonical_id,
  migration.level_id,
  min(legacy.x_cm),
  min(legacy.y_cm),
  bool_or(
    piece.is_locked
    or exists (
      select 1
      from walls wall
      where wall.is_locked
        and legacy.id in (wall.start_vertex_id, wall.end_vertex_id)
    )
  )
from geometry_vertex_migration_map migration
join legacy_piece_vertices legacy on legacy.id = migration.legacy_id
join pieces piece on piece.id = legacy.piece_id
group by migration.canonical_id, migration.level_id;

create table piece_vertices (
  piece_id uuid not null references pieces(id) on delete cascade,
  vertex_id uuid not null references vertices(id) on delete restrict,
  vertex_order integer not null,
  created_at timestamptz not null default now(),
  primary key (piece_id, vertex_id),
  unique (piece_id, vertex_order)
);

insert into piece_vertices (piece_id, vertex_id, vertex_order)
select legacy.piece_id, migration.canonical_id, legacy.vertex_order
from legacy_piece_vertices legacy
join geometry_vertex_migration_map migration on migration.legacy_id = legacy.id;

alter table walls add column level_id uuid references levels(id) on delete cascade;
update walls wall
set level_id = migration.level_id
from geometry_vertex_migration_map migration
where migration.legacy_id = wall.start_vertex_id;

alter table walls drop constraint if exists walls_start_vertex_id_fkey;
alter table walls drop constraint if exists walls_end_vertex_id_fkey;

update walls wall
set start_vertex_id = start_map.canonical_id,
    end_vertex_id = end_map.canonical_id
from geometry_vertex_migration_map start_map,
     geometry_vertex_migration_map end_map
where start_map.legacy_id = wall.start_vertex_id
  and end_map.legacy_id = wall.end_vertex_id;

alter table walls
  alter column level_id set not null,
  add constraint walls_start_vertex_id_fkey
    foreign key (start_vertex_id) references vertices(id) on delete restrict,
  add constraint walls_end_vertex_id_fkey
    foreign key (end_vertex_id) references vertices(id) on delete restrict,
  add constraint walls_distinct_vertices check (start_vertex_id <> end_vertex_id);

alter table wall_height_points
  add column is_locked boolean not null default false;

update wall_height_points point
set is_locked = wall.is_locked
from walls wall
where wall.id = point.wall_id;

-- Les états d’objets sont désormais calculés et les ouvertures ne sont pas verrouillables.
alter table pieces drop column is_locked;
alter table walls drop column is_locked;
alter table openings drop column is_locked;

drop policy if exists piece_vertices_read on legacy_piece_vertices;
drop policy if exists piece_vertices_write on legacy_piece_vertices;
drop policy if exists walls_read on walls;
drop policy if exists walls_write on walls;
drop policy if exists wall_faces_read on wall_faces;
drop policy if exists wall_faces_write on wall_faces;
drop policy if exists wall_height_points_read on wall_height_points;
drop policy if exists wall_height_points_write on wall_height_points;
drop policy if exists openings_read on openings;
drop policy if exists openings_write on openings;

drop table legacy_piece_vertices;

alter table vertices enable row level security;
alter table piece_vertices enable row level security;

revoke insert, update, delete on pieces from authenticated;
revoke insert, update, delete on vertices from authenticated;
revoke insert, update, delete on piece_vertices from authenticated;
revoke insert, update, delete on walls from authenticated;
revoke insert, update, delete on wall_pieces from authenticated;
revoke insert, update, delete on wall_faces from authenticated;
revoke insert, update, delete on wall_height_points from authenticated;
revoke insert, update, delete on openings from authenticated;

grant select on vertices to authenticated;
grant select on piece_vertices to authenticated;
grant update (name, room_type, floor_color, notes) on pieces to authenticated;

create policy vertices_read on vertices
for select to authenticated using (
  exists (
    select 1 from levels
    where levels.id = vertices.level_id
      and can_read_project(levels.project_id)
  )
);

create policy piece_vertices_read on piece_vertices
for select to authenticated using (
  exists (
    select 1
    from pieces
    join levels on levels.id = pieces.level_id
    where pieces.id = piece_vertices.piece_id
      and can_read_project(levels.project_id)
  )
);

create policy walls_read on walls
for select to authenticated using (
  exists (
    select 1 from levels
    where levels.id = walls.level_id
      and can_read_project(levels.project_id)
  )
);

create policy wall_faces_read on wall_faces
for select to authenticated using (
  exists (select 1 from walls where walls.id = wall_faces.wall_id)
);

create policy wall_height_points_read on wall_height_points
for select to authenticated using (
  exists (select 1 from walls where walls.id = wall_height_points.wall_id)
);

create policy openings_read on openings
for select to authenticated using (
  exists (select 1 from walls where walls.id = openings.wall_id)
);

create or replace function enforce_wall_piece_cardinality()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_wall_level_id uuid;
  target_piece_level_id uuid;
begin
  select level_id into target_wall_level_id from walls where id = new.wall_id;
  select level_id into target_piece_level_id from pieces where id = new.piece_id;

  if target_wall_level_id is null or target_piece_level_id is null
    or target_wall_level_id <> target_piece_level_id then
    raise exception 'WALL_PIECE_LEVEL_MISMATCH';
  end if;

  if (
    select count(*)
    from wall_pieces relation
    where relation.wall_id = new.wall_id
      and relation.piece_id <> new.piece_id
  ) >= 2 then
    raise exception 'WALL_PIECE_CARDINALITY_EXCEEDED';
  end if;

  return new;
end;
$$;

create trigger wall_pieces_cardinality
before insert or update on wall_pieces
for each row execute function enforce_wall_piece_cardinality();

create or replace function load_level_geometry(target_level_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not exists (
    select 1 from levels
    where id = target_level_id
      and can_read_project(project_id)
  ) then
    raise exception 'LEVEL_READ_REQUIRED';
  end if;

  select jsonb_build_object(
    'level_id', level.id,
    'revision', level.geometry_revision,
    'vertices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', vertex.id,
        'x_cm', vertex.x_cm,
        'y_cm', vertex.y_cm,
        'is_locked', vertex.is_locked
      ) order by vertex.id)
      from vertices vertex
      where vertex.level_id = level.id
        and exists (
          select 1
          from piece_vertices relation
          join pieces piece on piece.id = relation.piece_id
          where relation.vertex_id = vertex.id
            and not piece.is_soft_deleted
        )
    ), '[]'::jsonb),
    'pieces', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', piece.id,
        'name', piece.name,
        'room_type', piece.room_type,
        'floor_color', piece.floor_color,
        'wall_thickness_cm', piece.wall_thickness_cm,
        'wall_height_cm', piece.wall_height_cm,
        'notes', piece.notes,
        'is_soft_deleted', piece.is_soft_deleted,
        'vertex_ids', (
          select coalesce(jsonb_agg(relation.vertex_id order by relation.vertex_order), '[]'::jsonb)
          from piece_vertices relation
          where relation.piece_id = piece.id
        )
      ) order by piece.created_at, piece.id)
      from pieces piece
      where piece.level_id = level.id
        and not piece.is_soft_deleted
    ), '[]'::jsonb),
    'walls', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', wall.id,
        'start_vertex_id', wall.start_vertex_id,
        'end_vertex_id', wall.end_vertex_id,
        'thickness_cm', wall.thickness_cm,
        'height_profiles_linked', wall.height_profiles_linked,
        'material', wall.material,
        'insulation', wall.insulation,
        'notes', wall.notes,
        'piece_ids', (
          select coalesce(jsonb_agg(relation.piece_id order by relation.piece_id), '[]'::jsonb)
          from wall_pieces relation
          join pieces piece on piece.id = relation.piece_id
          where relation.wall_id = wall.id
            and not piece.is_soft_deleted
        ),
        'profiles', jsonb_build_object(
          'gauche', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'id', point.id,
              'point_order', point.point_order,
              'position_cm', point.position_cm,
              'height_cm', point.height_cm,
              'is_locked', point.is_locked
            ) order by point.point_order), '[]'::jsonb)
            from wall_height_points point
            where point.wall_id = wall.id and point.face_side = 'gauche'
          ),
          'droite', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'id', point.id,
              'point_order', point.point_order,
              'position_cm', point.position_cm,
              'height_cm', point.height_cm,
              'is_locked', point.is_locked
            ) order by point.point_order), '[]'::jsonb)
            from wall_height_points point
            where point.wall_id = wall.id and point.face_side = 'droite'
          )
        )
      ) order by wall.id)
      from walls wall
      where wall.level_id = level.id
        and exists (
          select 1
          from wall_pieces relation
          join pieces piece on piece.id = relation.piece_id
          where relation.wall_id = wall.id
            and not piece.is_soft_deleted
        )
    ), '[]'::jsonb),
    'openings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', opening.id,
        'wall_id', opening.wall_id,
        'template_id', opening.template_id,
        'opening_type', opening.opening_type,
        'placement_type', opening.placement_type,
        'position_cm', opening.position_cm,
        'width_cm', opening.width_cm,
        'bottom_cm', opening.bottom_cm,
        'height_cm', opening.height_cm,
        'orientation', opening.orientation,
        'notes', opening.notes
      ) order by opening.id)
      from openings opening
      join walls wall on wall.id = opening.wall_id
      where wall.level_id = level.id
        and exists (
          select 1
          from wall_pieces relation
          join pieces piece on piece.id = relation.piece_id
          where relation.wall_id = wall.id
            and not piece.is_soft_deleted
        )
    ), '[]'::jsonb),
    'templates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', template.id,
        'name', template.name,
        'opening_type', template.opening_type,
        'placement_type', template.placement_type
      ) order by template.id)
      from opening_templates template
    ), '[]'::jsonb)
  )
  into result
  from levels level
  where level.id = target_level_id;

  return result;
end;
$$;

create or replace function save_level_geometry(
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
  current_piece_ids uuid[];
  current_wall_ids uuid[];
  piece_data jsonb;
  vertex_data jsonb;
  vertex_id_data jsonb;
  wall_data jsonb;
  relation_data jsonb;
  point_data jsonb;
  opening_data jsonb;
  face_side text;
  current_wall_id uuid;
  current_piece_id uuid;
  current_wall_length numeric;
  submitted_left jsonb;
  submitted_right jsonb;
  removed_pieces jsonb;
  removed_piece_data jsonb;
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
  if coalesce(jsonb_typeof(snapshot_data -> 'vertices'), 'null') <> 'array'
    or coalesce(jsonb_typeof(snapshot_data -> 'pieces'), 'null') <> 'array'
    or coalesce(jsonb_typeof(snapshot_data -> 'walls'), 'null') <> 'array'
    or coalesce(jsonb_typeof(snapshot_data -> 'openings'), 'null') <> 'array' then
    raise exception 'GEOMETRY_SNAPSHOT_INVALID';
  end if;
  if (select count(distinct value ->> 'id') from jsonb_array_elements(snapshot_data -> 'vertices'))
      <> jsonb_array_length(snapshot_data -> 'vertices')
    or (select count(distinct value ->> 'id') from jsonb_array_elements(snapshot_data -> 'pieces'))
      <> jsonb_array_length(snapshot_data -> 'pieces')
    or (select count(distinct value ->> 'id') from jsonb_array_elements(snapshot_data -> 'walls'))
      <> jsonb_array_length(snapshot_data -> 'walls')
    or (select count(distinct value ->> 'id') from jsonb_array_elements(snapshot_data -> 'openings'))
      <> jsonb_array_length(snapshot_data -> 'openings') then
    raise exception 'GEOMETRY_IDENTIFIERS_NOT_UNIQUE';
  end if;

  -- Revérification des verrous persistés avant toute suppression.
  if exists (
    select 1
    from vertices current_vertex
    where current_vertex.level_id = target_level_id
      and current_vertex.is_locked
      and (
        not exists (
          select 1 from jsonb_array_elements(snapshot_data -> 'vertices') submitted
          where (submitted.value ->> 'id')::uuid = current_vertex.id
        )
        or exists (
          select 1 from jsonb_array_elements(snapshot_data -> 'vertices') submitted
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
      and (
        not exists (
          select 1
          from jsonb_array_elements(snapshot_data -> 'walls') submitted_wall
          cross join lateral jsonb_array_elements(submitted_wall.value -> 'profiles' -> current_point.face_side) submitted_point
          where (submitted_point.value ->> 'id')::uuid = current_point.id
        )
        or exists (
          select 1
          from jsonb_array_elements(snapshot_data -> 'walls') submitted_wall
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

  -- Validation structurelle de l’instantané avant la première mutation.
  if exists (
    select 1
    from jsonb_array_elements(snapshot_data -> 'pieces') piece
    where coalesce(jsonb_typeof(piece.value -> 'vertex_ids'), 'null') <> 'array'
      or jsonb_array_length(piece.value -> 'vertex_ids') < 3
      or (
        select count(distinct value)
        from jsonb_array_elements_text(piece.value -> 'vertex_ids')
      ) <> jsonb_array_length(piece.value -> 'vertex_ids')
  ) then
    raise exception 'PIECE_CONTOUR_INVALID';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(snapshot_data -> 'walls') wall
    where coalesce(jsonb_typeof(wall.value -> 'piece_ids'), 'null') <> 'array'
      or jsonb_array_length(wall.value -> 'piece_ids') > 2
      or (
        select count(distinct value)
        from jsonb_array_elements_text(wall.value -> 'piece_ids')
      ) <> jsonb_array_length(wall.value -> 'piece_ids')
      or (wall.value ->> 'start_vertex_id') = (wall.value ->> 'end_vertex_id')
      or not exists (
        select 1 from jsonb_array_elements(snapshot_data -> 'vertices') vertex
        where vertex.value ->> 'id' = wall.value ->> 'start_vertex_id'
      )
      or not exists (
        select 1 from jsonb_array_elements(snapshot_data -> 'vertices') vertex
        where vertex.value ->> 'id' = wall.value ->> 'end_vertex_id'
      )
      or coalesce(jsonb_typeof(wall.value -> 'profiles' -> 'gauche'), 'null') <> 'array'
      or coalesce(jsonb_typeof(wall.value -> 'profiles' -> 'droite'), 'null') <> 'array'
      or jsonb_array_length(wall.value -> 'profiles' -> 'gauche') < 2
      or jsonb_array_length(wall.value -> 'profiles' -> 'droite') < 2
  ) then
    raise exception 'WALL_SNAPSHOT_INVALID';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(snapshot_data -> 'walls') wall
    cross join lateral jsonb_array_elements_text(wall.value -> 'piece_ids') relation
    where not exists (
      select 1 from jsonb_array_elements(snapshot_data -> 'pieces') piece
      where piece.value ->> 'id' = relation.value
    )
  ) then
    raise exception 'WALL_PIECE_REFERENCE_INVALID';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(snapshot_data -> 'pieces') piece
    cross join lateral jsonb_array_elements_text(piece.value -> 'vertex_ids') with ordinality current_vertex(vertex_id, vertex_order)
    cross join lateral (
      select next_vertex.value as next_vertex_id
      from jsonb_array_elements_text(piece.value -> 'vertex_ids') with ordinality next_vertex(value, vertex_order)
      where next_vertex.vertex_order = case
        when current_vertex.vertex_order = jsonb_array_length(piece.value -> 'vertex_ids') then 1
        else current_vertex.vertex_order + 1
      end
    ) following
    where (
      select count(*)
      from jsonb_array_elements(snapshot_data -> 'walls') wall
      where (wall.value -> 'piece_ids') ? (piece.value ->> 'id')
        and (
          (
            wall.value ->> 'start_vertex_id' = current_vertex.vertex_id
            and wall.value ->> 'end_vertex_id' = following.next_vertex_id
          )
          or (
            wall.value ->> 'start_vertex_id' = following.next_vertex_id
            and wall.value ->> 'end_vertex_id' = current_vertex.vertex_id
          )
        )
    ) <> 1
  ) then
    raise exception 'PIECE_EDGE_WALL_MISMATCH';
  end if;

  select array_agg(piece.id) into current_piece_ids
  from pieces piece
  where piece.level_id = target_level_id
    and not piece.is_soft_deleted;

  select coalesce(jsonb_agg(to_jsonb(piece)), '[]'::jsonb)
  into removed_pieces
  from pieces piece
  where piece.id = any(coalesce(current_piece_ids, '{}'::uuid[]))
    and not exists (
      select 1
      from jsonb_array_elements(snapshot_data -> 'pieces') submitted_piece
      where (submitted_piece.value ->> 'id')::uuid = piece.id
    );

  select array_agg(distinct relation.wall_id) into current_wall_ids
  from wall_pieces relation
  where relation.piece_id = any(coalesce(current_piece_ids, '{}'::uuid[]));

  delete from openings where wall_id = any(coalesce(current_wall_ids, '{}'::uuid[]));
  delete from wall_height_points where wall_id = any(coalesce(current_wall_ids, '{}'::uuid[]));
  delete from wall_faces where wall_id = any(coalesce(current_wall_ids, '{}'::uuid[]));
  delete from wall_pieces where wall_id = any(coalesce(current_wall_ids, '{}'::uuid[]));
  delete from walls where id = any(coalesce(current_wall_ids, '{}'::uuid[]));
  delete from piece_vertices where piece_id = any(coalesce(current_piece_ids, '{}'::uuid[]));
  delete from pieces where id = any(coalesce(current_piece_ids, '{}'::uuid[]));
  delete from vertices vertex
  where vertex.level_id = target_level_id
    and not exists (select 1 from piece_vertices relation where relation.vertex_id = vertex.id)
    and not exists (
      select 1 from walls wall
      where vertex.id in (wall.start_vertex_id, wall.end_vertex_id)
    );

  for vertex_data in select value from jsonb_array_elements(snapshot_data -> 'vertices') loop
    insert into vertices (id, level_id, x_cm, y_cm, is_locked)
    values (
      (vertex_data ->> 'id')::uuid,
      target_level_id,
      (vertex_data ->> 'x_cm')::numeric,
      (vertex_data ->> 'y_cm')::numeric,
      coalesce((vertex_data ->> 'is_locked')::boolean, false)
    );
  end loop;

  for piece_data in select value from jsonb_array_elements(snapshot_data -> 'pieces') loop
    current_piece_id := (piece_data ->> 'id')::uuid;
    insert into pieces (
      id, level_id, name, room_type, floor_color, wall_thickness_cm,
      wall_height_cm, notes, is_soft_deleted
    ) values (
      current_piece_id,
      target_level_id,
      piece_data ->> 'name',
      piece_data ->> 'room_type',
      piece_data ->> 'floor_color',
      (piece_data ->> 'wall_thickness_cm')::numeric,
      (piece_data ->> 'wall_height_cm')::numeric,
      piece_data ->> 'notes',
      false
    );
    for vertex_id_data in
      select jsonb_build_object('id', value, 'position', ordinality - 1)
      from jsonb_array_elements_text(piece_data -> 'vertex_ids') with ordinality
    loop
      insert into piece_vertices (piece_id, vertex_id, vertex_order)
      values (
        current_piece_id,
        (vertex_id_data ->> 'id')::uuid,
        (vertex_id_data ->> 'position')::integer
      );
    end loop;
  end loop;

  for removed_piece_data in select value from jsonb_array_elements(removed_pieces) loop
    insert into pieces (
      id, level_id, name, room_type, floor_color, wall_thickness_cm,
      wall_height_cm, notes, is_soft_deleted, created_at, updated_at, deleted_at
    ) values (
      (removed_piece_data ->> 'id')::uuid,
      target_level_id,
      removed_piece_data ->> 'name',
      removed_piece_data ->> 'room_type',
      removed_piece_data ->> 'floor_color',
      (removed_piece_data ->> 'wall_thickness_cm')::numeric,
      (removed_piece_data ->> 'wall_height_cm')::numeric,
      removed_piece_data ->> 'notes',
      true,
      coalesce((removed_piece_data ->> 'created_at')::timestamptz, statement_timestamp()),
      statement_timestamp(),
      statement_timestamp()
    );
  end loop;

  for wall_data in select value from jsonb_array_elements(snapshot_data -> 'walls') loop
    current_wall_id := (wall_data ->> 'id')::uuid;
    select sqrt(
      power(end_vertex.x_cm - start_vertex.x_cm, 2)
      + power(end_vertex.y_cm - start_vertex.y_cm, 2)
    )
    into current_wall_length
    from vertices start_vertex
    join vertices end_vertex on end_vertex.id = (wall_data ->> 'end_vertex_id')::uuid
    where start_vertex.id = (wall_data ->> 'start_vertex_id')::uuid;

    submitted_left := wall_data -> 'profiles' -> 'gauche';
    submitted_right := wall_data -> 'profiles' -> 'droite';
    if (submitted_left -> 0 ->> 'position_cm')::numeric <> 0
      or (submitted_right -> 0 ->> 'position_cm')::numeric <> 0
      or abs(
        (submitted_left -> (jsonb_array_length(submitted_left) - 1) ->> 'position_cm')::numeric
        - current_wall_length
      ) > 0.01
      or abs(
        (submitted_right -> (jsonb_array_length(submitted_right) - 1) ->> 'position_cm')::numeric
        - current_wall_length
      ) > 0.01 then
      raise exception 'WALL_PROFILE_ENDPOINTS_INVALID';
    end if;
    if coalesce((wall_data ->> 'height_profiles_linked')::boolean, true)
      and (
        select jsonb_agg(point.value - 'id' order by point.ordinality)
        from jsonb_array_elements(submitted_left) with ordinality point(value, ordinality)
      ) is distinct from (
        select jsonb_agg(point.value - 'id' order by point.ordinality)
        from jsonb_array_elements(submitted_right) with ordinality point(value, ordinality)
      ) then
      raise exception 'LINKED_WALL_PROFILES_MISMATCH';
    end if;

    insert into walls (
      id, level_id, start_vertex_id, end_vertex_id, thickness_cm,
      height_profiles_linked, material, insulation, notes
    ) values (
      current_wall_id,
      target_level_id,
      (wall_data ->> 'start_vertex_id')::uuid,
      (wall_data ->> 'end_vertex_id')::uuid,
      (wall_data ->> 'thickness_cm')::numeric,
      coalesce((wall_data ->> 'height_profiles_linked')::boolean, true),
      wall_data ->> 'material',
      wall_data ->> 'insulation',
      wall_data ->> 'notes'
    );

    for relation_data in select value from jsonb_array_elements(wall_data -> 'piece_ids') loop
      insert into wall_pieces (wall_id, piece_id)
      values (current_wall_id, (relation_data #>> '{}')::uuid);
    end loop;

    foreach face_side in array array['gauche', 'droite'] loop
      insert into wall_faces (wall_id, face_side) values (current_wall_id, face_side);
      for point_data in
        select value from jsonb_array_elements(wall_data -> 'profiles' -> face_side)
      loop
        insert into wall_height_points (
          id, wall_id, face_side, point_order, position_cm, height_cm, is_locked
        ) values (
          (point_data ->> 'id')::uuid,
          current_wall_id,
          face_side,
          (point_data ->> 'point_order')::integer,
          (point_data ->> 'position_cm')::numeric,
          (point_data ->> 'height_cm')::numeric,
          coalesce((point_data ->> 'is_locked')::boolean, false)
        );
      end loop;
    end loop;
  end loop;

  for opening_data in select value from jsonb_array_elements(snapshot_data -> 'openings') loop
    current_wall_id := (opening_data ->> 'wall_id')::uuid;
    if not exists (
      select 1
      from walls wall
      join opening_templates template on template.id = (opening_data ->> 'template_id')::uuid
      where wall.id = current_wall_id
        and template.opening_type = opening_data ->> 'opening_type'
        and template.placement_type = opening_data ->> 'placement_type'
        and (
          select case opening_data ->> 'placement_type'
            when 'intérieur' then count(*) = 2
            when 'extérieur' then count(*) = 1
            else false
          end
          from wall_pieces relation
          where relation.wall_id = wall.id
        )
    ) then
      raise exception 'OPENING_WALL_INCOMPATIBLE';
    end if;
    if exists (
      select 1
      from openings existing
      where existing.wall_id = current_wall_id
        and (opening_data ->> 'position_cm')::numeric
          < existing.position_cm + existing.width_cm
        and existing.position_cm
          < (opening_data ->> 'position_cm')::numeric + (opening_data ->> 'width_cm')::numeric
    ) then
      raise exception 'OPENINGS_OVERLAP';
    end if;
    if (
      select (opening_data ->> 'position_cm')::numeric < 0
        or (opening_data ->> 'width_cm')::numeric <= 0
        or (opening_data ->> 'height_cm')::numeric <= 0
        or (opening_data ->> 'bottom_cm')::numeric < 0
        or (opening_data ->> 'position_cm')::numeric + (opening_data ->> 'width_cm')::numeric
          > sqrt(
            power(end_vertex.x_cm - start_vertex.x_cm, 2)
            + power(end_vertex.y_cm - start_vertex.y_cm, 2)
          )
      from walls wall
      join vertices start_vertex on start_vertex.id = wall.start_vertex_id
      join vertices end_vertex on end_vertex.id = wall.end_vertex_id
      where wall.id = current_wall_id
    ) then
      raise exception 'OPENING_DIMENSIONS_INVALID';
    end if;

    insert into openings (
      id, wall_id, template_id, opening_type, placement_type, position_cm,
      width_cm, bottom_cm, height_cm, orientation, notes
    ) values (
      (opening_data ->> 'id')::uuid,
      current_wall_id,
      (opening_data ->> 'template_id')::uuid,
      opening_data ->> 'opening_type',
      opening_data ->> 'placement_type',
      (opening_data ->> 'position_cm')::numeric,
      (opening_data ->> 'width_cm')::numeric,
      (opening_data ->> 'bottom_cm')::numeric,
      (opening_data ->> 'height_cm')::numeric,
      opening_data ->> 'orientation',
      opening_data ->> 'notes'
    );
  end loop;

  update levels
  set geometry_revision = geometry_revision + 1,
      updated_at = statement_timestamp()
  where id = target_level_id;

  return load_level_geometry(target_level_id);
end;
$$;

revoke all on function load_level_geometry(uuid) from public;
revoke all on function save_level_geometry(uuid, bigint, jsonb) from public;
grant execute on function load_level_geometry(uuid) to authenticated;
grant execute on function save_level_geometry(uuid, bigint, jsonb) to authenticated;

commit;
