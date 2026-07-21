begin;

create or replace function public.load_level_geometry(target_level_id uuid)
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
        'hinge_side', opening.hinge_side,
        'notes', opening.notes
      ) order by opening.id)
      from openings opening
      join walls wall on wall.id = opening.wall_id
      where wall.level_id = level.id
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

revoke all on function public.load_level_geometry(uuid) from public;
grant execute on function public.load_level_geometry(uuid) to authenticated;

commit;
