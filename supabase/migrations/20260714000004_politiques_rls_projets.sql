-- BatiBrain — politiques RLS des projets V1-09

begin;

create function owns_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from projects
    where id = target_project_id and owner_user_id = auth.uid()
  );
$$;

create function can_read_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from projects
    where id = target_project_id and owner_user_id = auth.uid()
  ) or exists (
    select 1 from project_collaborations
    where project_id = target_project_id and user_id = auth.uid()
  );
$$;

create function can_write_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from projects
    where id = target_project_id and owner_user_id = auth.uid()
  ) or exists (
    select 1 from project_collaborations
    where project_id = target_project_id
      and user_id = auth.uid()
      and role = 'écriture'
  );
$$;

revoke all on function owns_project(uuid) from public;
revoke all on function can_read_project(uuid) from public;
revoke all on function can_write_project(uuid) from public;
grant execute on function owns_project(uuid) to authenticated;
grant execute on function can_read_project(uuid) to authenticated;
grant execute on function can_write_project(uuid) to authenticated;

alter table user_preferences enable row level security;
alter table projects enable row level security;
alter table project_collaborations enable row level security;
alter table project_invitations enable row level security;
alter table levels enable row level security;
alter table pieces enable row level security;
alter table piece_vertices enable row level security;
alter table walls enable row level security;
alter table wall_pieces enable row level security;
alter table wall_faces enable row level security;
alter table wall_height_points enable row level security;
alter table opening_templates enable row level security;
alter table openings enable row level security;
alter table dimensions enable row level security;
alter table notes enable row level security;
alter table editor_view_settings enable row level security;

grant select, insert, update, delete on user_preferences to authenticated;
grant select, insert, update, delete on projects to authenticated;
grant select, insert, update, delete on project_collaborations to authenticated;
grant select, insert, update, delete on project_invitations to authenticated;
grant select, insert, update, delete on levels to authenticated;
grant select, insert, update, delete on pieces to authenticated;
grant select, insert, update, delete on piece_vertices to authenticated;
grant select, insert, update, delete on walls to authenticated;
grant select, insert, update, delete on wall_pieces to authenticated;
grant select, insert, update, delete on wall_faces to authenticated;
grant select, insert, update, delete on wall_height_points to authenticated;
grant select on opening_templates to authenticated;
grant select, insert, update, delete on openings to authenticated;
grant select, insert, update, delete on dimensions to authenticated;
grant select, insert, update, delete on notes to authenticated;
grant select, insert, update, delete on editor_view_settings to authenticated;

create policy user_preferences_own on user_preferences
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy projects_read on projects
for select to authenticated using (can_read_project(id));
create policy projects_create on projects
for insert to authenticated with check (owner_user_id = auth.uid());
create policy projects_update_owner on projects
for update to authenticated using (owns_project(id))
with check (owner_user_id = auth.uid());
create policy projects_delete_owner on projects
for delete to authenticated using (owns_project(id));

create policy project_collaborations_read on project_collaborations
for select to authenticated
using (owns_project(project_id) or user_id = auth.uid());
create policy project_collaborations_create_owner on project_collaborations
for insert to authenticated with check (owns_project(project_id));
create policy project_collaborations_update_owner on project_collaborations
for update to authenticated using (owns_project(project_id))
with check (owns_project(project_id));
create policy project_collaborations_delete_owner on project_collaborations
for delete to authenticated using (owns_project(project_id));

create policy project_invitations_read on project_invitations
for select to authenticated
using (owns_project(project_id) or invited_user_id = auth.uid());
create policy project_invitations_create_owner on project_invitations
for insert to authenticated with check (owns_project(project_id));
create policy project_invitations_update_owner on project_invitations
for update to authenticated using (owns_project(project_id))
with check (owns_project(project_id));
create policy project_invitations_delete_owner on project_invitations
for delete to authenticated using (owns_project(project_id));

create policy levels_read on levels
for select to authenticated using (can_read_project(project_id));
create policy levels_write on levels
for all to authenticated using (can_write_project(project_id))
with check (can_write_project(project_id));

create policy pieces_read on pieces
for select to authenticated using (
  exists (select 1 from levels where levels.id = pieces.level_id)
);
create policy pieces_write on pieces
for all to authenticated using (
  exists (select 1 from levels where levels.id = pieces.level_id and can_write_project(levels.project_id))
) with check (
  exists (select 1 from levels where levels.id = pieces.level_id and can_write_project(levels.project_id))
);

create policy piece_vertices_read on piece_vertices
for select to authenticated using (
  exists (select 1 from pieces where pieces.id = piece_vertices.piece_id)
);
create policy piece_vertices_write on piece_vertices
for all to authenticated using (
  exists (
    select 1 from pieces join levels on levels.id = pieces.level_id
    where pieces.id = piece_vertices.piece_id and can_write_project(levels.project_id)
  )
) with check (
  exists (
    select 1 from pieces join levels on levels.id = pieces.level_id
    where pieces.id = piece_vertices.piece_id and can_write_project(levels.project_id)
  )
);

create policy walls_read on walls
for select to authenticated using (
  exists (select 1 from piece_vertices where piece_vertices.id = walls.start_vertex_id)
);
create policy walls_write on walls
for all to authenticated using (
  exists (
    select 1 from piece_vertices
    join pieces on pieces.id = piece_vertices.piece_id
    join levels on levels.id = pieces.level_id
    where piece_vertices.id = walls.start_vertex_id and can_write_project(levels.project_id)
  )
) with check (
  exists (
    select 1 from piece_vertices
    join pieces on pieces.id = piece_vertices.piece_id
    join levels on levels.id = pieces.level_id
    where piece_vertices.id = walls.start_vertex_id and can_write_project(levels.project_id)
  )
);

create policy wall_pieces_read on wall_pieces
for select to authenticated using (
  exists (select 1 from pieces where pieces.id = wall_pieces.piece_id)
);
create policy wall_pieces_write on wall_pieces
for all to authenticated using (
  exists (
    select 1 from pieces join levels on levels.id = pieces.level_id
    where pieces.id = wall_pieces.piece_id and can_write_project(levels.project_id)
  )
) with check (
  exists (
    select 1 from pieces join levels on levels.id = pieces.level_id
    where pieces.id = wall_pieces.piece_id and can_write_project(levels.project_id)
  )
);

create policy wall_faces_read on wall_faces
for select to authenticated using (
  exists (select 1 from walls where walls.id = wall_faces.wall_id)
);
create policy wall_faces_write on wall_faces
for all to authenticated using (
  exists (
    select 1 from walls
    join piece_vertices on piece_vertices.id = walls.start_vertex_id
    join pieces on pieces.id = piece_vertices.piece_id
    join levels on levels.id = pieces.level_id
    where walls.id = wall_faces.wall_id and can_write_project(levels.project_id)
  )
) with check (
  exists (
    select 1 from walls
    join piece_vertices on piece_vertices.id = walls.start_vertex_id
    join pieces on pieces.id = piece_vertices.piece_id
    join levels on levels.id = pieces.level_id
    where walls.id = wall_faces.wall_id and can_write_project(levels.project_id)
  )
);

create policy wall_height_points_read on wall_height_points
for select to authenticated using (
  exists (select 1 from wall_faces where wall_faces.wall_id = wall_height_points.wall_id)
);
create policy wall_height_points_write on wall_height_points
for all to authenticated using (
  exists (
    select 1 from walls
    join piece_vertices on piece_vertices.id = walls.start_vertex_id
    join pieces on pieces.id = piece_vertices.piece_id
    join levels on levels.id = pieces.level_id
    where walls.id = wall_height_points.wall_id and can_write_project(levels.project_id)
  )
) with check (
  exists (
    select 1 from walls
    join piece_vertices on piece_vertices.id = walls.start_vertex_id
    join pieces on pieces.id = piece_vertices.piece_id
    join levels on levels.id = pieces.level_id
    where walls.id = wall_height_points.wall_id and can_write_project(levels.project_id)
  )
);

create policy opening_templates_read on opening_templates
for select to authenticated using (true);

create policy openings_read on openings
for select to authenticated using (
  exists (select 1 from walls where walls.id = openings.wall_id)
);
create policy openings_write on openings
for all to authenticated using (
  exists (
    select 1 from walls
    join piece_vertices on piece_vertices.id = walls.start_vertex_id
    join pieces on pieces.id = piece_vertices.piece_id
    join levels on levels.id = pieces.level_id
    where walls.id = openings.wall_id and can_write_project(levels.project_id)
  )
) with check (
  exists (
    select 1 from walls
    join piece_vertices on piece_vertices.id = walls.start_vertex_id
    join pieces on pieces.id = piece_vertices.piece_id
    join levels on levels.id = pieces.level_id
    where walls.id = openings.wall_id and can_write_project(levels.project_id)
  )
);

create policy dimensions_read on dimensions
for select to authenticated using (
  exists (select 1 from levels where levels.id = dimensions.level_id)
);
create policy dimensions_write on dimensions
for all to authenticated using (
  exists (select 1 from levels where levels.id = dimensions.level_id and can_write_project(levels.project_id))
) with check (
  exists (select 1 from levels where levels.id = dimensions.level_id and can_write_project(levels.project_id))
);

create policy notes_read on notes
for select to authenticated using (can_read_project(project_id));
create policy notes_write on notes
for all to authenticated using (can_write_project(project_id))
with check (can_write_project(project_id));

create policy editor_view_settings_own on editor_view_settings
for all to authenticated
using (user_id = auth.uid() and can_read_project(project_id))
with check (user_id = auth.uid() and can_read_project(project_id));

revoke all on function create_piece_complete(jsonb, jsonb, jsonb) from public;
revoke all on function replace_wall_topology(uuid, jsonb, jsonb, jsonb) from public;
revoke all on function write_wall_height_profiles(uuid, boolean, jsonb, jsonb) from public;
grant execute on function create_piece_complete(jsonb, jsonb, jsonb) to authenticated;
grant execute on function replace_wall_topology(uuid, jsonb, jsonb, jsonb) to authenticated;
grant execute on function write_wall_height_profiles(uuid, boolean, jsonb, jsonb) to authenticated;

commit;
