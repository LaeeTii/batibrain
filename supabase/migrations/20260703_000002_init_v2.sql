-- BatiBrain - init v2 (schema reconstruit depuis le modele de donnees consolide)

begin;

create extension if not exists pgcrypto;

create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  address text,
  description text,
  is_soft_deleted boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table project_collaborations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create table project_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  invited_user_id uuid not null references auth.users(id) on delete cascade,
  invited_email text not null,
  role text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table levels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  level_number integer not null,
  altitude_cm integer,
  is_visible boolean not null,
  is_soft_deleted boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (project_id, level_number)
);

create table pieces (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references levels(id) on delete cascade,
  name text not null,
  room_type text not null,
  floor_color text not null,
  wall_thickness_cm numeric(8,2) not null,
  wall_height_cm numeric(8,2) not null,
  notes text,
  is_soft_deleted boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table piece_vertices (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references pieces(id) on delete cascade,
  vertex_order integer not null,
  x_cm numeric(10,2) not null,
  y_cm numeric(10,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (piece_id, vertex_order)
);

create table walls (
  id uuid primary key default gen_random_uuid(),
  start_vertex_id uuid not null references piece_vertices(id) on delete cascade,
  end_vertex_id uuid not null references piece_vertices(id) on delete cascade,
  thickness_cm numeric(8,2),
  height_profiles_linked boolean not null,
  material text,
  insulation text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_vertex_id <> end_vertex_id)
);

create table wall_pieces (
  wall_id uuid not null references walls(id) on delete cascade,
  piece_id uuid not null references pieces(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wall_id, piece_id)
);

create table wall_height_points (
  id uuid primary key default gen_random_uuid(),
  wall_id uuid not null references walls(id) on delete cascade,
  face_side text not null check (face_side in ('left', 'right')),
  point_order integer not null,
  position_cm numeric(10,2) not null,
  height_cm numeric(10,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wall_id, face_side, point_order),
  unique (wall_id, face_side, position_cm)
);

create table opening_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  opening_type text not null,
  placement_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table openings (
  id uuid primary key default gen_random_uuid(),
  wall_id uuid not null references walls(id) on delete cascade,
  template_id uuid not null references opening_templates(id) on delete restrict,
  opening_type text not null,
  placement_type text not null,
  offset_cm numeric(8,2) not null,
  width_cm numeric(8,2) not null,
  bottom_cm numeric(8,2) not null,
  height_cm numeric(8,2) not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table dimensions (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references levels(id) on delete cascade,
  name text not null,
  dimension_type text not null,
  distance_cm numeric(10,2) not null,
  offset_cm numeric(10,2) not null,
  reference_a jsonb not null,
  reference_b jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  origin_type text not null,
  origin_id uuid,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table editor_view_settings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  show_grid boolean not null,
  show_rules boolean not null,
  show_dimensions boolean not null,
  show_angles boolean not null,
  show_notes boolean not null,
  show_room_surfaces boolean not null,
  show_room_icons boolean not null,
  snap_grid boolean not null,
  snap_vertices boolean not null,
  snap_intersections boolean not null,
  snap_walls boolean not null,
  snap_midpoints boolean not null,
  snap_distance_cm numeric(8,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  level_id uuid references levels(id) on delete set null,
  piece_id uuid references pieces(id) on delete set null,
  wall_id uuid references walls(id) on delete set null,
  title text not null,
  description text,
  status text not null,
  priority integer not null,
  is_soft_deleted boolean not null,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  piece_id uuid references pieces(id) on delete set null,
  wall_id uuid references walls(id) on delete set null,
  name text not null,
  mime_type text,
  storage_path text not null,
  metadata_json jsonb not null,
  is_soft_deleted boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  piece_id uuid references pieces(id) on delete set null,
  wall_id uuid references walls(id) on delete set null,
  name text,
  storage_path text not null,
  metadata_json jsonb not null,
  is_soft_deleted boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table work_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  description text,
  status text,
  is_soft_deleted boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table planning_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  start_at timestamptz,
  end_at timestamptz,
  metadata_json jsonb not null,
  is_soft_deleted boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger trg_projects_updated_at
before update on projects
for each row execute procedure set_updated_at();

create trigger trg_project_collaborations_updated_at
before update on project_collaborations
for each row execute procedure set_updated_at();

create trigger trg_project_invitations_updated_at
before update on project_invitations
for each row execute procedure set_updated_at();

create trigger trg_levels_updated_at
before update on levels
for each row execute procedure set_updated_at();

create trigger trg_pieces_updated_at
before update on pieces
for each row execute procedure set_updated_at();

create trigger trg_piece_vertices_updated_at
before update on piece_vertices
for each row execute procedure set_updated_at();

create trigger trg_walls_updated_at
before update on walls
for each row execute procedure set_updated_at();

create trigger trg_wall_height_points_updated_at
before update on wall_height_points
for each row execute procedure set_updated_at();

create trigger trg_openings_updated_at
before update on openings
for each row execute procedure set_updated_at();

create trigger trg_opening_templates_updated_at
before update on opening_templates
for each row execute procedure set_updated_at();

create trigger trg_dimensions_updated_at
before update on dimensions
for each row execute procedure set_updated_at();

create trigger trg_notes_updated_at
before update on notes
for each row execute procedure set_updated_at();

create trigger trg_editor_view_settings_updated_at
before update on editor_view_settings
for each row execute procedure set_updated_at();

create trigger trg_tasks_updated_at
before update on tasks
for each row execute procedure set_updated_at();

create trigger trg_documents_updated_at
before update on documents
for each row execute procedure set_updated_at();

create trigger trg_photos_updated_at
before update on photos
for each row execute procedure set_updated_at();

create trigger trg_work_items_updated_at
before update on work_items
for each row execute procedure set_updated_at();

create trigger trg_planning_items_updated_at
before update on planning_items
for each row execute procedure set_updated_at();

create index idx_projects_active on projects(is_soft_deleted) where is_soft_deleted = false;
create index idx_projects_owner_user_id on projects(owner_user_id);
create index idx_project_collaborations_user_id on project_collaborations(user_id);
create index idx_project_invitations_invited_user_id on project_invitations(invited_user_id);
create index idx_levels_project_id on levels(project_id);
create index idx_levels_active on levels(project_id, is_soft_deleted) where is_soft_deleted = false;
create index idx_pieces_level_id on pieces(level_id);
create index idx_pieces_active on pieces(level_id, is_soft_deleted) where is_soft_deleted = false;
create index idx_piece_vertices_piece_id on piece_vertices(piece_id);
create index idx_wall_pieces_piece_id on wall_pieces(piece_id);
create index idx_wall_height_points_wall_id on wall_height_points(wall_id);
create index idx_openings_wall_id on openings(wall_id);
create index idx_openings_template_id on openings(template_id);
create index idx_dimensions_level_id on dimensions(level_id);
create index idx_notes_project_id on notes(project_id);
create index idx_notes_origin on notes(origin_type, origin_id);
create index idx_editor_view_settings_project on editor_view_settings(project_id);
create index idx_tasks_project_id on tasks(project_id);
create index idx_tasks_active on tasks(project_id, is_soft_deleted) where is_soft_deleted = false;
create index idx_documents_project_id on documents(project_id);
create index idx_documents_active on documents(project_id, is_soft_deleted) where is_soft_deleted = false;
create index idx_photos_project_id on photos(project_id);
create index idx_photos_active on photos(project_id, is_soft_deleted) where is_soft_deleted = false;
create index idx_work_items_project_id on work_items(project_id);
create index idx_work_items_active on work_items(project_id, is_soft_deleted) where is_soft_deleted = false;
create index idx_planning_items_project_id on planning_items(project_id);
create index idx_planning_items_active on planning_items(project_id, is_soft_deleted) where is_soft_deleted = false;

commit;
