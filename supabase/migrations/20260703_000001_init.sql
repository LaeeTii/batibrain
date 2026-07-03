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
  thickness_cm numeric(8,2),
  height_left_cm numeric(8,2),
  height_right_cm numeric(8,2),
  material text,
  insulation text,
  notes text,
  created_at timestamptz not null default now(),
  check (start_vertex_id <> end_vertex_id)
);

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
create index if not exists idx_openings_wall_id on openings(wall_id);
create index if not exists idx_documents_project_id on documents(project_id);
create index if not exists idx_tasks_project_id on tasks(project_id);
