-- BatiBrain — V1-24, mise à jour atomique de la géométrie d’une pièce.
begin;

create function update_piece_geometry(target_piece_id uuid, vertices_data jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  vertex_data jsonb;
begin
  if jsonb_typeof(vertices_data) <> 'array' or jsonb_array_length(vertices_data) < 3 then
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
  if exists (select 1 from jsonb_array_elements(vertices_data) item where (item.value ->> 'vertex_order')::integer < 0) then
    raise exception 'L’ordre des sommets est invalide.';
  end if;
  if (select count(*) from piece_vertices where piece_id = target_piece_id) <> jsonb_array_length(vertices_data)
    or exists (select 1 from jsonb_array_elements(vertices_data) item where not exists (select 1 from piece_vertices vertex where vertex.id = (item.value ->> 'id')::uuid and vertex.piece_id = target_piece_id)) then
    raise exception 'La mise à jour doit fournir exactement les sommets actuels de la pièce.';
  end if;

  for vertex_data in select value from jsonb_array_elements(vertices_data) loop
    update piece_vertices set vertex_order = (vertex_data ->> 'vertex_order')::integer, x_cm = (vertex_data ->> 'x_cm')::numeric, y_cm = (vertex_data ->> 'y_cm')::numeric
    where id = (vertex_data ->> 'id')::uuid and piece_id = target_piece_id;
  end loop;
end;
$$;

revoke all on function update_piece_geometry(uuid, jsonb) from public;
grant execute on function update_piece_geometry(uuid, jsonb) to authenticated;

commit;
