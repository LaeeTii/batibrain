-- BatiBrain — V1-24, invalide les anciens clients géométriques.
begin;

alter function replace_piece_topology(uuid, jsonb, jsonb, jsonb)
  rename to replace_piece_topology_v2;
alter function update_piece_geometry(uuid, jsonb)
  rename to update_piece_geometry_v2;

revoke execute on function replace_piece_geometries(uuid, jsonb, jsonb) from authenticated;

commit;
