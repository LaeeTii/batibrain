begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users(id, email, aud, role, created_at, updated_at) values
('a1000000-0000-0000-0000-000000000001', 'owner-geometry@example.test', 'authenticated', 'authenticated', now(), now());
insert into opening_templates(id, name, opening_type, placement_type) values
('a5000000-0000-0000-0000-000000000001', 'Porte extérieure', 'porte', 'extérieur');
insert into projects(id, owner_user_id, name, is_soft_deleted) values
('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Projet géométrie', false);
update levels
set id = 'a3000000-0000-0000-0000-000000000001'
where project_id = 'a2000000-0000-0000-0000-000000000001'
  and level_number = 0;

create temporary table geometry_payloads (
  name text primary key,
  payload jsonb not null
);

insert into geometry_payloads(name, payload) values (
  'initial',
  $json$
  {
    "vertices": [
      {"id":"a6000000-0000-0000-0000-000000000001","x_cm":0,"y_cm":0,"is_locked":false},
      {"id":"a6000000-0000-0000-0000-000000000002","x_cm":300,"y_cm":0,"is_locked":false},
      {"id":"a6000000-0000-0000-0000-000000000003","x_cm":300,"y_cm":200,"is_locked":false},
      {"id":"a6000000-0000-0000-0000-000000000004","x_cm":0,"y_cm":200,"is_locked":false}
    ],
    "pieces": [
      {
        "id":"a4000000-0000-0000-0000-000000000001",
        "name":"Salon",
        "room_type":"salon",
        "floor_color":"#ffffff",
        "wall_thickness_cm":10,
        "wall_height_cm":250,
        "notes":null,
        "vertex_ids":[
          "a6000000-0000-0000-0000-000000000001",
          "a6000000-0000-0000-0000-000000000002",
          "a6000000-0000-0000-0000-000000000003",
          "a6000000-0000-0000-0000-000000000004"
        ]
      }
    ],
    "walls": [
      {
        "id":"a7000000-0000-0000-0000-000000000001",
        "start_vertex_id":"a6000000-0000-0000-0000-000000000001",
        "end_vertex_id":"a6000000-0000-0000-0000-000000000002",
        "thickness_cm":10,
        "height_profiles_linked":true,
        "material":"brique",
        "insulation":null,
        "notes":null,
        "piece_ids":["a4000000-0000-0000-0000-000000000001"],
        "profiles":{
          "gauche":[
            {"id":"a9000000-0000-0000-0000-000000000001","point_order":0,"position_cm":0,"height_cm":250,"is_locked":false},
            {"id":"a9000000-0000-0000-0000-000000000002","point_order":1,"position_cm":150,"height_cm":300,"is_locked":false},
            {"id":"a9000000-0000-0000-0000-000000000003","point_order":2,"position_cm":300,"height_cm":250,"is_locked":false}
          ],
          "droite":[
            {"id":"a9000000-0000-0000-0000-000000000011","point_order":0,"position_cm":0,"height_cm":250,"is_locked":false},
            {"id":"a9000000-0000-0000-0000-000000000012","point_order":1,"position_cm":150,"height_cm":300,"is_locked":false},
            {"id":"a9000000-0000-0000-0000-000000000013","point_order":2,"position_cm":300,"height_cm":250,"is_locked":false}
          ]
        }
      },
      {
        "id":"a7000000-0000-0000-0000-000000000002",
        "start_vertex_id":"a6000000-0000-0000-0000-000000000002",
        "end_vertex_id":"a6000000-0000-0000-0000-000000000003",
        "thickness_cm":10,"height_profiles_linked":true,"material":null,"insulation":null,"notes":null,
        "piece_ids":["a4000000-0000-0000-0000-000000000001"],
        "profiles":{
          "gauche":[{"id":"a9000000-0000-0000-0000-000000000021","point_order":0,"position_cm":0,"height_cm":250,"is_locked":false},{"id":"a9000000-0000-0000-0000-000000000022","point_order":1,"position_cm":200,"height_cm":250,"is_locked":false}],
          "droite":[{"id":"a9000000-0000-0000-0000-000000000023","point_order":0,"position_cm":0,"height_cm":250,"is_locked":false},{"id":"a9000000-0000-0000-0000-000000000024","point_order":1,"position_cm":200,"height_cm":250,"is_locked":false}]
        }
      },
      {
        "id":"a7000000-0000-0000-0000-000000000003",
        "start_vertex_id":"a6000000-0000-0000-0000-000000000003",
        "end_vertex_id":"a6000000-0000-0000-0000-000000000004",
        "thickness_cm":10,"height_profiles_linked":true,"material":null,"insulation":null,"notes":null,
        "piece_ids":["a4000000-0000-0000-0000-000000000001"],
        "profiles":{
          "gauche":[{"id":"a9000000-0000-0000-0000-000000000031","point_order":0,"position_cm":0,"height_cm":250,"is_locked":false},{"id":"a9000000-0000-0000-0000-000000000032","point_order":1,"position_cm":300,"height_cm":250,"is_locked":false}],
          "droite":[{"id":"a9000000-0000-0000-0000-000000000033","point_order":0,"position_cm":0,"height_cm":250,"is_locked":false},{"id":"a9000000-0000-0000-0000-000000000034","point_order":1,"position_cm":300,"height_cm":250,"is_locked":false}]
        }
      },
      {
        "id":"a7000000-0000-0000-0000-000000000004",
        "start_vertex_id":"a6000000-0000-0000-0000-000000000004",
        "end_vertex_id":"a6000000-0000-0000-0000-000000000001",
        "thickness_cm":10,"height_profiles_linked":true,"material":null,"insulation":null,"notes":null,
        "piece_ids":["a4000000-0000-0000-0000-000000000001"],
        "profiles":{
          "gauche":[{"id":"a9000000-0000-0000-0000-000000000041","point_order":0,"position_cm":0,"height_cm":250,"is_locked":false},{"id":"a9000000-0000-0000-0000-000000000042","point_order":1,"position_cm":200,"height_cm":250,"is_locked":false}],
          "droite":[{"id":"a9000000-0000-0000-0000-000000000043","point_order":0,"position_cm":0,"height_cm":250,"is_locked":false},{"id":"a9000000-0000-0000-0000-000000000044","point_order":1,"position_cm":200,"height_cm":250,"is_locked":false}]
        }
      }
    ],
    "openings":[
      {
        "id":"a8000000-0000-0000-0000-000000000001",
        "wall_id":"a7000000-0000-0000-0000-000000000001",
        "template_id":"a5000000-0000-0000-0000-000000000001",
        "opening_type":"porte",
        "placement_type":"extérieur",
        "position_cm":50,
        "width_cm":80,
        "bottom_cm":0,
        "height_cm":200,
        "orientation":null,
        "notes":null
      }
    ]
  }
  $json$::jsonb
);
grant select, insert, update on geometry_payloads to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$select save_level_geometry(
    'a3000000-0000-0000-0000-000000000001',
    0,
    (select payload from geometry_payloads where name = 'initial')
  )$$,
  'la création complète utilise une sauvegarde atomique'
);
select results_eq(
  $$select geometry_revision from levels where id = 'a3000000-0000-0000-0000-000000000001'$$,
  array[1::bigint],
  'la révision géométrique est incrémentée'
);
select results_eq(
  $$select count(*) from wall_height_points where wall_id = 'a7000000-0000-0000-0000-000000000001'$$,
  array[6::bigint],
  'les profils multi-points des deux faces sont conservés'
);
select results_eq(
  $$select count(*) from openings where id = 'a8000000-0000-0000-0000-000000000001'$$,
  array[1::bigint],
  'une ouverture compatible est conservée'
);

insert into geometry_payloads(name, payload)
select 'locked', jsonb_set(payload, '{vertices,0,is_locked}', 'true'::jsonb)
from geometry_payloads where name = 'initial';
select lives_ok(
  $$select save_level_geometry(
    'a3000000-0000-0000-0000-000000000001',
    1,
    (select payload from geometry_payloads where name = 'locked')
  )$$,
  'le verrou d’un sommet est persisté avec la géométrie'
);

insert into geometry_payloads(name, payload)
select 'locked_moved', jsonb_set(payload, '{vertices,0,x_cm}', '25'::jsonb)
from geometry_payloads where name = 'locked';
select throws_ok(
  $$select save_level_geometry(
    'a3000000-0000-0000-0000-000000000001',
    2,
    (select payload from geometry_payloads where name = 'locked_moved')
  )$$,
  'P0001',
  'LOCKED_VERTEX_MUTATION',
  'un sommet verrouillé est refusé avant toute écriture'
);
select results_eq(
  $$select x_cm from vertices where id = 'a6000000-0000-0000-0000-000000000001'$$,
  array[0.00::numeric],
  'le refus laisse les coordonnées précédentes intactes'
);
select results_eq(
  $$select geometry_revision from levels where id = 'a3000000-0000-0000-0000-000000000001'$$,
  array[2::bigint],
  'le rollback ne change pas la révision'
);

insert into geometry_payloads(name, payload)
select 'unlocked_moved',
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(payload, '{walls,0,profiles,gauche,2,position_cm}', '275'::jsonb),
            '{walls,0,profiles,droite,2,position_cm}',
            '275'::jsonb
          ),
          '{walls,3,profiles,gauche,1,position_cm}',
          '201.56'::jsonb
        ),
        '{walls,3,profiles,droite,1,position_cm}',
        '201.56'::jsonb
      ),
      '{vertices,0,x_cm}',
      '25'::jsonb
    ),
    '{vertices,0,is_locked}',
    'false'::jsonb
  )
from geometry_payloads where name = 'locked';
select lives_ok(
  $$select save_level_geometry(
    'a3000000-0000-0000-0000-000000000001',
    2,
    (select payload from geometry_payloads where name = 'unlocked_moved')
  )$$,
  'un déverrouillage et son déplacement sont autorisés dans le même instantané'
);
select results_eq(
  $$select array[x_cm, case when is_locked then 1 else 0 end]::numeric[] from vertices where id = 'a6000000-0000-0000-0000-000000000001'$$,
  $$values (array[25.00::numeric, 0::numeric])$$,
  'le déplacement et le déverrouillage sont persistés ensemble'
);

insert into geometry_payloads(name, payload)
select 'opening_incompatible',
  jsonb_set(payload, '{openings,0,placement_type}', '"intérieur"'::jsonb)
from geometry_payloads where name = 'unlocked_moved';
select throws_ok(
  $$select save_level_geometry(
    'a3000000-0000-0000-0000-000000000001',
    3,
    (select payload from geometry_payloads where name = 'opening_incompatible')
  )$$,
  'P0001',
  'OPENING_WALL_INCOMPATIBLE',
  'une ouverture incompatible annule toute la transaction'
);
select results_eq(
  $$select count(*) from openings where id = 'a8000000-0000-0000-0000-000000000001' and placement_type = 'extérieur'$$,
  array[1::bigint],
  'l’ouverture compatible précédente est restaurée par le rollback'
);

reset role;
insert into pieces(id, level_id, name, room_type, floor_color, wall_thickness_cm, wall_height_cm, is_soft_deleted) values
('a4000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000001', 'Pièce 2', 'autre', '#ffffff', 10, 250, false),
('a4000000-0000-0000-0000-000000000003', 'a3000000-0000-0000-0000-000000000001', 'Pièce 3', 'autre', '#ffffff', 10, 250, false);
insert into wall_pieces(wall_id, piece_id) values
('a7000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000002');
select throws_ok(
  $$insert into wall_pieces(wall_id, piece_id) values
    ('a7000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000003')$$,
  'P0001',
  'WALL_PIECE_CARDINALITY_EXCEEDED',
  'la base interdit structurellement une troisième pièce'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select save_level_geometry(
    'a3000000-0000-0000-0000-000000000001',
    3,
    '{"vertices":[],"pieces":[],"walls":[],"openings":[]}'::jsonb
  )$$,
  'la suppression d’une pièce passe par la même frontière atomique'
);
select results_eq(
  $$select count(*) from pieces where id = 'a4000000-0000-0000-0000-000000000001' and is_soft_deleted$$,
  array[1::bigint],
  'la pièce supprimée conserve sa ligne métier supprimée logiquement'
);

select * from finish();
rollback;
