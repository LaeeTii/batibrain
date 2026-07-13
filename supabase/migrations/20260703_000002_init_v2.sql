-- BatiBrain — initialisation complète du schéma V1

begin;

create extension if not exists pgcrypto;

-- Comptes et préférences

create table user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  first_name text not null,
  last_name text not null,
  avatar_storage_path text,
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index uq_user_profiles_display_name
on user_profiles (lower(display_name));

create table account_creation_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text not null,
  first_name text not null,
  last_name text not null,
  status text not null,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index uq_account_creation_requests_pending_email
on account_creation_requests (lower(email))
where status = 'en_attente';

create unique index uq_account_creation_requests_pending_display_name
on account_creation_requests (lower(display_name))
where status = 'en_attente';

create table user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  length_unit text not null,
  surface_unit text not null,
  theme text not null,
  default_wall_height_cm numeric(10,2) not null,
  default_wall_thickness_cm numeric(10,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Projets et collaboration

create table projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text,
  description text,
  is_soft_deleted boolean not null,
  editing_lock_user_id uuid references auth.users(id) on delete set null,
  editing_lock_last_activity_at timestamptz,
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

create unique index uq_project_invitations_pending_user
on project_invitations (project_id, invited_user_id)
where status = 'en_attente';

-- Géométrie du projet

create table levels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  level_number integer not null,
  altitude_cm numeric(10,2),
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
  wall_thickness_cm numeric(10,2) not null,
  wall_height_cm numeric(10,2) not null,
  notes text,
  is_soft_deleted boolean not null,
  is_locked boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table piece_vertices (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references pieces(id) on delete cascade,
  vertex_order integer not null,
  x_cm numeric(12,2) not null,
  y_cm numeric(12,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (piece_id, vertex_order)
);

create table walls (
  id uuid primary key default gen_random_uuid(),
  start_vertex_id uuid not null references piece_vertices(id) on delete cascade,
  end_vertex_id uuid not null references piece_vertices(id) on delete cascade,
  thickness_cm numeric(10,2),
  height_profiles_linked boolean not null,
  material text,
  insulation text,
  notes text,
  is_locked boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table wall_pieces (
  wall_id uuid not null references walls(id) on delete cascade,
  piece_id uuid not null references pieces(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wall_id, piece_id)
);

create table wall_faces (
  wall_id uuid not null references walls(id) on delete cascade,
  face_side text not null,
  created_at timestamptz not null default now(),
  primary key (wall_id, face_side)
);

create table wall_height_points (
  id uuid primary key default gen_random_uuid(),
  wall_id uuid not null,
  face_side text not null,
  point_order integer not null,
  position_cm numeric(12,2) not null,
  height_cm numeric(10,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (wall_id, face_side)
    references wall_faces(wall_id, face_side)
    on delete cascade,
  unique (wall_id, face_side, point_order),
  unique (wall_id, face_side, position_cm)
);

-- Ouvertures, côtes, notes et options de vue

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
  position_cm numeric(12,2) not null,
  width_cm numeric(10,2) not null,
  bottom_cm numeric(10,2) not null,
  height_cm numeric(10,2) not null,
  orientation text,
  notes text,
  is_locked boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table dimensions (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references levels(id) on delete cascade,
  name text not null,
  dimension_type text not null,
  distance_cm numeric(12,2) not null,
  offset_cm numeric(12,2) not null,
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
  user_id uuid not null references auth.users(id) on delete cascade,
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
  snap_distance_cm numeric(10,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, user_id)
);

-- Index de navigation

create index idx_projects_owner_user_id on projects(owner_user_id);
create index idx_projects_active on projects(is_soft_deleted) where is_soft_deleted = false;
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

-- Sécurité des comptes déjà stabilisée. Les politiques projet sont ajoutées en V1-09.

alter table user_profiles enable row level security;
alter table account_creation_requests enable row level security;

create function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_profiles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

create function protect_user_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null and not is_admin() then
      raise exception 'Seul un administrateur peut modifier un rôle utilisateur.';
    end if;
    if auth.uid() = old.user_id then
      raise exception 'Un administrateur ne peut pas modifier son propre rôle.';
    end if;
    if old.role = 'admin'
      and new.role = 'user'
      and (select count(*) from user_profiles where role = 'admin') <= 1 then
      raise exception 'Le dernier administrateur ne peut pas être rétrogradé.';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_user_profiles_protect_role
before update of role on user_profiles
for each row execute procedure protect_user_profile_role();

create function set_user_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Accès administrateur requis.';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'Un administrateur ne peut pas modifier son propre rôle.';
  end if;
  if new_role not in ('user', 'admin') then
    raise exception 'Rôle utilisateur invalide.';
  end if;

  update user_profiles set role = new_role where user_id = target_user_id;
  if not found then
    raise exception 'Utilisateur introuvable.';
  end if;
end;
$$;

create policy user_profiles_select_own on user_profiles for select to authenticated
using (user_id = auth.uid());
create policy user_profiles_insert_own on user_profiles for insert to authenticated
with check (user_id = auth.uid() and role = 'user');
create policy user_profiles_update_own on user_profiles for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_profiles_select_admin on user_profiles for select to authenticated
using (is_admin());

create policy account_creation_requests_insert_public
on account_creation_requests for insert to anon, authenticated
with check (
  status = 'en_attente'
  and approved_by_user_id is null
  and approved_at is null
);
create policy account_creation_requests_select_admin
on account_creation_requests for select to authenticated using (is_admin());
create policy account_creation_requests_update_admin
on account_creation_requests for update to authenticated
using (is_admin()) with check (is_admin());

insert into storage.buckets (id, name, public)
values ('user-avatars', 'user-avatars', false)
on conflict (id) do nothing;

create policy user_avatars_select_own on storage.objects for select to authenticated
using (
  bucket_id = 'user-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy user_avatars_insert_own on storage.objects for insert to authenticated
with check (
  bucket_id = 'user-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy user_avatars_update_own on storage.objects for update to authenticated
using (
  bucket_id = 'user-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'user-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy user_avatars_delete_own on storage.objects for delete to authenticated
using (
  bucket_id = 'user-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;
