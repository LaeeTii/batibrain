begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users(id, email, aud, role, created_at, updated_at) values
('a1000000-0000-0000-0000-000000000001', 'owner-lock@example.test', 'authenticated', 'authenticated', now(), now()),
('a1000000-0000-0000-0000-000000000002', 'reader-lock@example.test', 'authenticated', 'authenticated', now(), now());
insert into opening_templates(id, name, opening_type, placement_type) values
('a5000000-0000-0000-0000-000000000001', 'Porte extérieure', 'porte', 'extérieur');
insert into projects(id, owner_user_id, name, is_soft_deleted) values
('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Projet verrou', false);
update levels
set id = 'a3000000-0000-0000-0000-000000000001'
where project_id = 'a2000000-0000-0000-0000-000000000001'
  and level_number = 0;
insert into project_collaborations(project_id, user_id, role) values
('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'lecture');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000001', true);
insert into pieces(id, level_id, name, room_type, floor_color, wall_thickness_cm, wall_height_cm, is_soft_deleted, is_locked) values
('a4000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'Salon', 'salon', '#ffffff', 10, 250, false, false);
insert into piece_vertices(id, piece_id, vertex_order, x_cm, y_cm) values
('a6000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 0, 0, 0),
('a6000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000001', 1, 200, 0);
insert into walls(id, start_vertex_id, end_vertex_id, thickness_cm, height_profiles_linked, is_locked) values
('a7000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000002', 10, true, false);
insert into wall_pieces(wall_id, piece_id) values
('a7000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001');
insert into openings(id, wall_id, template_id, opening_type, placement_type, position_cm, width_cm, bottom_cm, height_cm, is_locked) values
('a8000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001', 'porte', 'extérieur', 50, 80, 0, 200, false);

select lives_ok(
  $$select set_project_resource_manual_lock('pièce', 'a4000000-0000-0000-0000-000000000001', true)$$,
  'un propriétaire peut verrouiller une pièce'
);
select results_eq(
  $$select is_locked from pieces where id = 'a4000000-0000-0000-0000-000000000001'$$,
  array[true], 'le verrou de la pièce est persisté'
);
select throws_ok(
  $$update pieces set name = 'Séjour' where id = 'a4000000-0000-0000-0000-000000000001'$$,
  'P0001', 'MANUAL_RESOURCE_LOCKED', 'une pièce verrouillée ne peut pas être modifiée'
);
select throws_ok(
  $$insert into piece_vertices(id, piece_id, vertex_order, x_cm, y_cm) values ('a6000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000001', 2, 200, 200)$$,
  'P0001', 'MANUAL_RESOURCE_LOCKED', 'la géométrie d’une pièce verrouillée ne peut pas être modifiée'
);
select results_eq(
  $$select count(*) from pieces where id = 'a4000000-0000-0000-0000-000000000001'$$,
  array[1::bigint], 'une pièce verrouillée reste consultable'
);
select throws_ok(
  $$delete from pieces where id = 'a4000000-0000-0000-0000-000000000001'$$,
  'P0001', 'MANUAL_RESOURCE_LOCKED', 'une pièce verrouillée ne peut pas être supprimée'
);
select lives_ok(
  $$select set_project_resource_manual_lock('pièce', 'a4000000-0000-0000-0000-000000000001', false)$$,
  'le propriétaire peut déverrouiller la pièce'
);
select lives_ok(
  $$update pieces set name = 'Séjour' where id = 'a4000000-0000-0000-0000-000000000001'$$,
  'la modification redevient possible après déverrouillage'
);
select lives_ok(
  $$select set_project_resource_manual_lock('mur', 'a7000000-0000-0000-0000-000000000001', true)$$,
  'le mur peut être verrouillé indépendamment'
);
select results_eq(
  $$select array[w.is_locked, o.is_locked] from walls w join openings o on o.wall_id = w.id where w.id = 'a7000000-0000-0000-0000-000000000001'$$,
  $$values (array[true, false])$$, 'le verrou du mur ne se propage pas à l’ouverture'
);

select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$select set_project_resource_manual_lock('ouverture', 'a8000000-0000-0000-0000-000000000001', true)$$,
  'P0001', 'PROJECT_WRITE_REQUIRED', 'un collaborateur en lecture ne peut pas changer un verrou'
);

select * from finish();
rollback;
