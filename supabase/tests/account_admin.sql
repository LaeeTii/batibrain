begin;

select plan(8);

insert into auth.users (id, email, aud, role, created_at, updated_at)
values
  ('12000000-0000-0000-0000-000000000001', 'admin-1@example.test', 'authenticated', 'authenticated', now(), now()),
  ('12000000-0000-0000-0000-000000000002', 'admin-2@example.test', 'authenticated', 'authenticated', now(), now()),
  ('12000000-0000-0000-0000-000000000003', 'user@example.test', 'authenticated', 'authenticated', now(), now());

insert into user_profiles (user_id, display_name, first_name, last_name, role)
values
  ('12000000-0000-0000-0000-000000000001', 'Admin Un', 'Admin', 'Un', 'admin'),
  ('12000000-0000-0000-0000-000000000002', 'Admin Deux', 'Admin', 'Deux', 'admin'),
  ('12000000-0000-0000-0000-000000000003', 'Utilisateur', 'Utili', 'Sateur', 'user');

select ok(
  not has_function_privilege('anon', 'set_user_role(uuid,text)', 'EXECUTE'),
  'le rôle anonyme ne peut pas modifier les rôles'
);

select ok(
  has_function_privilege('authenticated', 'set_user_role(uuid,text)', 'EXECUTE'),
  'le rôle authentifié peut appeler la RPC protégée'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000003', true);

select throws_ok(
  $$ select set_user_role('12000000-0000-0000-0000-000000000002', 'user') $$,
  'P0001', 'Accès administrateur requis.',
  'un utilisateur ne peut pas modifier un rôle'
);

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$ select set_user_role('12000000-0000-0000-0000-000000000001', 'user') $$,
  'P0001', 'Un administrateur ne peut pas modifier son propre rôle.',
  'un administrateur ne peut pas se rétrograder'
);

select lives_ok(
  $$ select set_user_role('12000000-0000-0000-0000-000000000003', 'admin') $$,
  'un administrateur peut promouvoir un autre compte'
);

select is(
  (select role from user_profiles where user_id = '12000000-0000-0000-0000-000000000003'),
  'admin', 'le nouveau rôle est persisté'
);

reset role;
delete from auth.users where id in (
  '12000000-0000-0000-0000-000000000002',
  '12000000-0000-0000-0000-000000000003'
);

select throws_ok(
  $$ delete from auth.users where id = '12000000-0000-0000-0000-000000000001' $$,
  'P0001', 'Le dernier administrateur ne peut pas être supprimé.',
  'le dernier administrateur est protégé jusque dans la base'
);

insert into auth.users (id, email, aud, role, created_at, updated_at)
values ('12000000-0000-0000-0000-000000000004', 'owner@example.test', 'authenticated', 'authenticated', now(), now());
insert into user_profiles (user_id, display_name, first_name, last_name, role)
values ('12000000-0000-0000-0000-000000000004', 'Propriétaire', 'Pro', 'Priétaire', 'user');
insert into projects (id, owner_user_id, name, is_soft_deleted)
values ('22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000004', 'Projet supprimé', false);
insert into levels (project_id, name, level_number, is_visible, is_soft_deleted)
values ('22000000-0000-0000-0000-000000000001', 'Niveau', 0, true, false);
delete from auth.users where id = '12000000-0000-0000-0000-000000000004';

select is(
  (select count(*) from projects where id = '22000000-0000-0000-0000-000000000001'),
  0::bigint, 'la suppression du propriétaire cascade sur ses projets et leurs dépendances'
);

select * from finish();
rollback;
