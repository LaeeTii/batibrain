-- BatiBrain — V1-24, reprise des coins mitoyens écrits par un ancien client concurrent.
begin;

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

commit;
