-- BatiBrain — V1-24, remplacement atomique des pièces après découpe topologique.
begin;

create function replace_piece_geometries(
  target_level_id uuid,
  replaced_piece_ids jsonb,
  pieces_data jsonb
)
returns uuid[]
language plpgsql
security invoker
set search_path = public
as $$
declare
  piece_entry jsonb;
  created_ids uuid[] := '{}';
  created_id uuid;
begin
  if jsonb_typeof(replaced_piece_ids) <> 'array' or jsonb_typeof(pieces_data) <> 'array' then
    raise exception 'Les pièces remplacées et résultantes doivent être des tableaux.';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(replaced_piece_ids) as item(value)
    where not exists (select 1 from pieces where id = item.value::uuid and level_id = target_level_id)
  ) then
    raise exception 'Chaque pièce remplacée doit appartenir au niveau ciblé.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(pieces_data) as item(value)
    where (item.value -> 'piece' ->> 'level_id')::uuid <> target_level_id
  ) then
    raise exception 'Chaque pièce résultante doit appartenir au niveau ciblé.';
  end if;

  delete from pieces
  where id in (select item.value::uuid from jsonb_array_elements_text(replaced_piece_ids) as item(value));

  for piece_entry in select value from jsonb_array_elements(pieces_data) loop
    created_id := create_piece_complete(piece_entry -> 'piece', piece_entry -> 'vertices', piece_entry -> 'walls');
    created_ids := array_append(created_ids, created_id);
  end loop;
  return created_ids;
end;
$$;

revoke all on function replace_piece_geometries(uuid, jsonb, jsonb) from public;
grant execute on function replace_piece_geometries(uuid, jsonb, jsonb) to authenticated;

commit;
