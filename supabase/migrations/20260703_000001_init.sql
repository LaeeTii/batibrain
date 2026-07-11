-- PostgreSQL / Supabase starter schema

create extension if not exists pgcrypto;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists levels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  altitude_cm integer,
  created_at timestamptz not null default now()
);

create table if not exists pieces (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references levels(id) on delete cascade,
  name text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists piece_vertices (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references pieces(id) on delete cascade,
  vertex_order integer not null,
  x_cm numeric(10,2) not null,
  y_cm numeric(10,2) not null,
  created_at timestamptz not null default now(),
  unique (piece_id, vertex_order)
);

create table if not exists walls (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references pieces(id) on delete cascade,
  start_vertex_id uuid not null references piece_vertices(id) on delete cascade,
  end_vertex_id uuid not null references piece_vertices(id) on delete cascade,
  thickness_cm numeric(8,2) not null default 10 check (thickness_cm > 0),
  material text,
  insulation text,
  notes text,
  created_at timestamptz not null default now(),
  check (start_vertex_id <> end_vertex_id)
);

create table if not exists wall_face_height_profile_points (
  id uuid primary key default gen_random_uuid(),
  wall_id uuid not null references walls(id) on delete cascade,
  face_side text not null check (face_side in ('left', 'right')),
  position_cm numeric(10,2) not null check (position_cm >= 0),
  height_cm numeric(8,2) not null default 250 check (height_cm > 0),
  created_at timestamptz not null default now(),
  unique (wall_id, face_side, position_cm)
);

create or replace function initialize_wall_face_height_profiles()
returns trigger
language plpgsql
as $$
declare
  wall_length_cm numeric(10,2);
begin
  select round(sqrt(power(end_vertex.x_cm - start_vertex.x_cm, 2) + power(end_vertex.y_cm - start_vertex.y_cm, 2)), 2)
    into wall_length_cm
    from piece_vertices start_vertex
    join piece_vertices end_vertex on end_vertex.id = new.end_vertex_id
   where start_vertex.id = new.start_vertex_id;

  if wall_length_cm is null or wall_length_cm <= 0 then
    raise exception 'La longueur du mur doit être strictement positive';
  end if;

  insert into wall_face_height_profile_points (wall_id, face_side, position_cm, height_cm)
  values
    (new.id, 'left', 0, 250),
    (new.id, 'left', wall_length_cm, 250),
    (new.id, 'right', 0, 250),
    (new.id, 'right', wall_length_cm, 250);

  return new;
end;
$$;

drop trigger if exists trg_initialize_wall_face_height_profiles on walls;

create trigger trg_initialize_wall_face_height_profiles
after insert on walls
for each row
execute function initialize_wall_face_height_profiles();

create table if not exists openings (
  id uuid primary key default gen_random_uuid(),
  wall_id uuid not null references walls(id) on delete cascade,
  opening_type text not null check (opening_type in ('door', 'window', 'other')),
  offset_cm numeric(8,2) not null,
  width_cm numeric(8,2) not null,
  bottom_cm numeric(8,2) not null default 0,
  height_cm numeric(8,2) not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  piece_id uuid references pieces(id) on delete set null,
  wall_id uuid references walls(id) on delete set null,
  document_type text not null,
  storage_path text not null,
  original_file_name text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  piece_id uuid references pieces(id) on delete set null,
  wall_id uuid references walls(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done', 'archived')),
  priority integer not null default 3 check (priority between 1 and 5),
  due_date date,
  created_at timestamptz not null default now()
);

create index if not exists idx_levels_project_id on levels(project_id);
create index if not exists idx_pieces_level_id on pieces(level_id);
create index if not exists idx_piece_vertices_piece_id on piece_vertices(piece_id);
create index if not exists idx_walls_piece_id on walls(piece_id);
create index if not exists idx_wall_face_height_profile_points_wall_id on wall_face_height_profile_points(wall_id);
create index if not exists idx_openings_wall_id on openings(wall_id);
create index if not exists idx_documents_project_id on documents(project_id);
create index if not exists idx_tasks_project_id on tasks(project_id);
