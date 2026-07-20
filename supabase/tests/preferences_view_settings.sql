begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, aud, role, created_at, updated_at)
values
  ('91000000-0000-0000-0000-000000000001', 'preferences-owner@example.test', 'authenticated', 'authenticated', now(), now()),
  ('91000000-0000-0000-0000-000000000002', 'preferences-reader@example.test', 'authenticated', 'authenticated', now(), now()),
  ('91000000-0000-0000-0000-000000000003', 'preferences-outsider@example.test', 'authenticated', 'authenticated', now(), now());

insert into projects (id, owner_user_id, name, is_soft_deleted)
values ('92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'Projet préférences', false);

insert into project_collaborations (project_id, user_id, role)
values ('92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000002', 'lecture');

set local role authenticated;

select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
insert into user_preferences (user_id)
values ('91000000-0000-0000-0000-000000000001');

select results_eq(
  $$select length_unit from user_preferences where user_id = '91000000-0000-0000-0000-000000000001'$$,
  array['cm'::text],
  'la longueur vaut cm par défaut'
);
select results_eq(
  $$select surface_unit from user_preferences where user_id = '91000000-0000-0000-0000-000000000001'$$,
  array['m2'::text],
  'la surface vaut m2 par défaut'
);
select throws_ok(
  $$update user_preferences set length_unit = 'km' where user_id = '91000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'une unité de longueur inconnue est refusée'
);
select throws_ok(
  $$update user_preferences set default_wall_height_cm = 0 where user_id = '91000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'une hauteur par défaut nulle est refusée'
);

select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000002', true);
insert into editor_view_settings (project_id, user_id)
values ('92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000002');
select results_eq(
  $$select show_grid from editor_view_settings where project_id = '92000000-0000-0000-0000-000000000001'$$,
  array[true],
  'un lecteur enregistre ses options de vue'
);
select results_eq(
  $$update editor_view_settings set show_grid = false where project_id = '92000000-0000-0000-0000-000000000001' returning show_grid$$,
  array[false],
  'un lecteur modifie ses options de vue'
);

select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000003', true);
select is_empty(
  $$select id from editor_view_settings where project_id = '92000000-0000-0000-0000-000000000001'$$,
  'un utilisateur sans accès ne lit pas les options du projet'
);
select throws_ok(
  $$insert into editor_view_settings (project_id, user_id) values ('92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000003')$$,
  '42501',
  null,
  'un utilisateur sans accès ne crée pas d’options pour le projet'
);

select * from finish();
rollback;
