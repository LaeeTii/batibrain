-- BatiBrain - init v2 (schema reconstruit depuis le modele de donnees consolide)

begin;

create extension if not exists pgcrypto;

create type opening_type_enum as enum ('door', 'window', 'glass_door', 'other');
create type opening_placement_type_enum as enum ('interior', 'exterior');
create type project_role_enum as enum ('read', 'write');
create type project_invitation_status_enum as enum ('pending', 'accepted', 'cancelled');
create type dimension_type_enum as enum ('point-point', 'wall-wall', 'point-on-wall');
create type note_origin_type_enum as enum (
  'project',
  'level',
  'room',
  'wall',
  'opening',
  'vertex',
  'dimension'
);

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
  is_soft_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table project_collaborations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role project_role_enum not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create table project_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  invited_user_id uuid not null references auth.users(id) on delete cascade,
  invited_email text not null,
  role project_role_enum not null,
  status project_invitation_status_enum not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(invited_email)) > 0)
);

create function validate_project_invitation_account()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from auth.users
    where id = new.invited_user_id
      and lower(email) = lower(trim(new.invited_email))
  ) then
    raise exception 'L''adresse invitée doit correspondre au compte BatiBrain ciblé.';
  end if;

  return new;
end;
$$;

create trigger trg_project_invitations_validate_account
before insert or update of invited_user_id, invited_email on project_invitations
for each row execute procedure validate_project_invitation_account();

create function accept_project_invitation()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'accepted' and old.status = 'pending' then
    insert into project_collaborations (project_id, user_id, role)
    values (new.project_id, new.invited_user_id, new.role)
    on conflict (project_id, user_id)
    do update set role = excluded.role;
  end if;

  return new;
end;
$$;

create trigger trg_project_invitations_accept
after update of status on project_invitations
for each row execute procedure accept_project_invitation();

create unique index uq_project_invitations_pending
on project_invitations(project_id, invited_user_id)
where status = 'pending';

create table levels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  level_number integer not null default 0,
  altitude_cm integer,
  is_visible boolean not null default true,
  is_soft_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (project_id, level_number)
);

create table pieces (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references levels(id) on delete cascade,
  name text not null,
  room_type text,
  floor_color text not null default '#E5FFFC',
  wall_thickness_cm numeric(8,2) not null default 10,
  wall_height_cm numeric(8,2) not null default 250,
  notes text,
  is_soft_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (wall_thickness_cm > 0),
  check (wall_height_cm > 0)
);

create table piece_vertices (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references pieces(id) on delete cascade,
  vertex_order integer not null,
  x_cm numeric(10,2) not null,
  y_cm numeric(10,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (piece_id, vertex_order),
  check (vertex_order >= 0)
);

create table walls (
  id uuid primary key default gen_random_uuid(),
  start_vertex_id uuid not null references piece_vertices(id) on delete cascade,
  end_vertex_id uuid not null references piece_vertices(id) on delete cascade,
  thickness_cm numeric(8,2),
  material text,
  insulation text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_vertex_id <> end_vertex_id),
  check (thickness_cm is null or thickness_cm > 0)
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
  point_order integer not null,
  position_cm numeric(10,2) not null,
  height_cm numeric(10,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wall_id, point_order),
  unique (wall_id, position_cm),
  check (point_order >= 0),
  check (position_cm >= 0),
  check (height_cm > 0)
);

create table opening_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  opening_type opening_type_enum not null,
  placement_type opening_placement_type_enum not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, opening_type, placement_type),
  check (length(trim(name)) > 0)
);

create table openings (
  id uuid primary key default gen_random_uuid(),
  wall_id uuid not null references walls(id) on delete cascade,
  template_id uuid not null,
  opening_type opening_type_enum not null,
  placement_type opening_placement_type_enum not null,
  offset_cm numeric(8,2) not null,
  width_cm numeric(8,2) not null,
  bottom_cm numeric(8,2) not null default 0,
  height_cm numeric(8,2) not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (template_id, opening_type, placement_type)
    references opening_templates(id, opening_type, placement_type) on delete restrict,
  check (offset_cm >= 0),
  check (width_cm > 0),
  check (bottom_cm >= 0),
  check (height_cm > 0)
);

create function enforce_wall_piece_limit()
returns trigger
language plpgsql
as $$
begin
  perform 1
  from walls
  where id = new.wall_id
  for update;

  if (
    select count(*)
    from wall_pieces
    where wall_id = new.wall_id
  ) >= 2 then
    raise exception 'Un mur ne peut appartenir qu''à deux pièces au maximum.';
  end if;

  return new;
end;
$$;

create trigger trg_wall_pieces_limit
before insert on wall_pieces
for each row execute procedure enforce_wall_piece_limit();

create function validate_opening_wall_placement()
returns trigger
language plpgsql
as $$
declare
  linked_piece_count integer;
begin
  select count(*)
  into linked_piece_count
  from wall_pieces
  where wall_id = new.wall_id;

  if new.placement_type = 'interior' and linked_piece_count <> 2 then
    raise exception 'Une ouverture intérieure exige un mur lié à deux pièces.';
  end if;

  if new.placement_type = 'exterior' and linked_piece_count <> 1 then
    raise exception 'Une ouverture extérieure exige un mur lié à une seule pièce.';
  end if;

  return new;
end;
$$;

create trigger trg_openings_validate_wall_placement
before insert or update of wall_id, placement_type on openings
for each row execute procedure validate_opening_wall_placement();

create function delete_incompatible_wall_openings()
returns trigger
language plpgsql
as $$
declare
  affected_wall_id uuid;
  linked_piece_count integer;
begin
  if tg_op = 'DELETE' then
    affected_wall_id := old.wall_id;
  else
    affected_wall_id := new.wall_id;
  end if;

  select count(*)
  into linked_piece_count
  from wall_pieces
  where wall_id = affected_wall_id;

  delete from openings
  where wall_id = affected_wall_id
    and (
      (placement_type = 'interior' and linked_piece_count <> 2)
      or (placement_type = 'exterior' and linked_piece_count <> 1)
    );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger trg_wall_pieces_cleanup_openings
after insert or delete on wall_pieces
for each row execute procedure delete_incompatible_wall_openings();

create table dimensions (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references levels(id) on delete cascade,
  name text not null,
  dimension_type dimension_type_enum not null,
  distance_cm numeric(10,2) not null,
  offset_cm numeric(10,2) not null,
  reference_a jsonb not null,
  reference_b jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (distance_cm > 0)
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  origin_type note_origin_type_enum not null,
  origin_id uuid,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(content)) > 0)
);

create table editor_view_settings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  show_grid boolean not null default true,
  show_rules boolean not null default true,
  show_dimensions boolean not null default true,
  show_angles boolean not null default true,
  show_notes boolean not null default true,
  snap_grid boolean not null default true,
  snap_vertices boolean not null default true,
  snap_intersections boolean not null default true,
  snap_walls boolean not null default true,
  snap_midpoints boolean not null default true,
  snap_distance_cm numeric(8,2) not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, user_id),
  check (snap_distance_cm >= 0)
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
  is_soft_deleted boolean not null default false,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (priority between 1 and 5)
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  piece_id uuid references pieces(id) on delete set null,
  wall_id uuid references walls(id) on delete set null,
  name text not null,
  mime_type text,
  storage_path text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  is_soft_deleted boolean not null default false,
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
  metadata_json jsonb not null default '{}'::jsonb,
  is_soft_deleted boolean not null default false,
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
  is_soft_deleted boolean not null default false,
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
  metadata_json jsonb not null default '{}'::jsonb,
  is_soft_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (end_at is null or start_at is null or end_at >= start_at)
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
