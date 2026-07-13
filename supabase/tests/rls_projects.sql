begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email, aud, role, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', 'owner@example.test', 'authenticated', 'authenticated', now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'reader@example.test', 'authenticated', 'authenticated', now(), now()),
  ('10000000-0000-0000-0000-000000000003', 'writer@example.test', 'authenticated', 'authenticated', now(), now()),
  ('10000000-0000-0000-0000-000000000004', 'outsider@example.test', 'authenticated', 'authenticated', now(), now()),
  ('10000000-0000-0000-0000-000000000005', 'invitee@example.test', 'authenticated', 'authenticated', now(), now());

insert into projects (
  id, owner_user_id, name, is_soft_deleted, created_at, updated_at
) values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Projet RLS', false, now(), now()
);

insert into project_collaborations (id, project_id, user_id, role)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'lecture'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'écriture');

insert into project_invitations (
  id, project_id, invited_user_id, invited_email, role, status
) values (
  '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000005', 'invitee@example.test', 'lecture', 'en_attente'
);

insert into levels (
  id, project_id, name, level_number, is_visible, is_soft_deleted
) values (
  '50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  'Niveau 0', 0, true, false
);

set local role authenticated;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select results_eq(
  $$select count(*) from projects where id = '20000000-0000-0000-0000-000000000001'$$,
  array[1::bigint], 'le propriétaire lit son projet'
);
select results_eq(
  $$update projects set name = 'Projet propriétaire' where id = '20000000-0000-0000-0000-000000000001' returning id$$,
  array['20000000-0000-0000-0000-000000000001'::uuid], 'le propriétaire modifie son projet'
);
select results_eq(
  $$select count(*) from project_collaborations where project_id = '20000000-0000-0000-0000-000000000001'$$,
  array[2::bigint], 'le propriétaire voit tous les collaborateurs'
);
select results_eq(
  $$update project_collaborations set role = 'lecture' where id = '30000000-0000-0000-0000-000000000001' returning id$$,
  array['30000000-0000-0000-0000-000000000001'::uuid], 'le propriétaire gère les collaborateurs'
);
select results_eq(
  $$update levels set name = 'Niveau propriétaire' where id = '50000000-0000-0000-0000-000000000001' returning id$$,
  array['50000000-0000-0000-0000-000000000001'::uuid], 'le propriétaire écrit une ressource métier'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select results_eq(
  $$select count(*) from projects where id = '20000000-0000-0000-0000-000000000001'$$,
  array[1::bigint], 'le collaborateur en lecture lit le projet'
);
select is_empty(
  $$update projects set name = 'Interdit lecture' where id = '20000000-0000-0000-0000-000000000001' returning id$$,
  'le collaborateur en lecture ne modifie pas le projet'
);
select results_eq(
  $$select count(*) from project_collaborations where project_id = '20000000-0000-0000-0000-000000000001'$$,
  array[1::bigint], 'le collaborateur en lecture ne voit que sa collaboration'
);
select results_eq(
  $$select count(*) from levels where project_id = '20000000-0000-0000-0000-000000000001'$$,
  array[1::bigint], 'le collaborateur en lecture lit les ressources métier'
);
select is_empty(
  $$update levels set name = 'Interdit lecture' where id = '50000000-0000-0000-0000-000000000001' returning id$$,
  'le collaborateur en lecture ne modifie pas les ressources métier'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select results_eq(
  $$select count(*) from projects where id = '20000000-0000-0000-0000-000000000001'$$,
  array[1::bigint], 'le collaborateur en écriture lit le projet'
);
select is_empty(
  $$update projects set name = 'Interdit écriture' where id = '20000000-0000-0000-0000-000000000001' returning id$$,
  'le collaborateur en écriture ne modifie pas le projet'
);
select results_eq(
  $$update levels set name = 'Niveau collaborateur' where id = '50000000-0000-0000-0000-000000000001' returning id$$,
  array['50000000-0000-0000-0000-000000000001'::uuid], 'le collaborateur en écriture modifie les ressources métier'
);
select is_empty(
  $$update project_collaborations set role = 'lecture' where id = '30000000-0000-0000-0000-000000000001' returning id$$,
  'le collaborateur en écriture ne gère pas les collaborateurs'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select results_eq(
  $$select count(*) from projects where id = '20000000-0000-0000-0000-000000000001'$$,
  array[0::bigint], 'un utilisateur sans accès ne lit pas le projet'
);
select results_eq(
  $$select count(*) from levels where project_id = '20000000-0000-0000-0000-000000000001'$$,
  array[0::bigint], 'un utilisateur sans accès ne lit pas les ressources métier'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
select results_eq(
  $$select count(*) from project_invitations where id = '40000000-0000-0000-0000-000000000001'$$,
  array[1::bigint], $$l'utilisateur invité voit son invitation$$
);
select results_eq(
  $$select count(*) from projects where id = '20000000-0000-0000-0000-000000000001'$$,
  array[0::bigint], 'une invitation en attente ne donne aucun accès au projet'
);

select * from finish();
rollback;
