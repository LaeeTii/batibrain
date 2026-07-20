begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users(id, email, aud, role, created_at, updated_at) values
('91000000-0000-0000-0000-000000000001', 'owner-collab@example.test', 'authenticated', 'authenticated', now(), now()),
('91000000-0000-0000-0000-000000000002', 'invitee-collab@example.test', 'authenticated', 'authenticated', now(), now()),
('91000000-0000-0000-0000-000000000003', 'auth-only-collab@example.test', 'authenticated', 'authenticated', now(), now());
insert into user_profiles(user_id, display_name, first_name, last_name, role) values
('91000000-0000-0000-0000-000000000001', 'Propriétaire collaboration', 'Pro', 'Priétaire', 'user'),
('91000000-0000-0000-0000-000000000002', 'Invité collaboration', 'In', 'Vité', 'user');
insert into projects(id, owner_user_id, name, is_soft_deleted) values
('92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'Projet collaboration', false);

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
select lives_ok($$select invite_project_member('92000000-0000-0000-0000-000000000001', 'invitee-collab@example.test', 'lecture')$$, 'le propriétaire invite un compte existant');
select throws_ok(
  $$select invite_project_member('92000000-0000-0000-0000-000000000001', 'auth-only-collab@example.test', 'lecture')$$,
  'P0001', 'PROJECT_INVITEE_NOT_FOUND',
  'une identité Auth sans profil approuvé ne peut pas être invitée'
);

select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000002', true);
select results_eq($$select count(*) from pending_project_invitations()$$, array[1::bigint], 'l’invité voit la notification');
select results_eq($$select count(*) from projects where id = '92000000-0000-0000-0000-000000000001'$$, array[0::bigint], 'l’invitation en attente ne donne aucun accès');
select lives_ok($$select accept_project_invitation((select id from project_invitations where invited_user_id = '91000000-0000-0000-0000-000000000002' and status = 'en_attente'))$$, 'l’invité accepte atomiquement');
select results_eq($$select count(*) from projects where id = '92000000-0000-0000-0000-000000000001'$$, array[1::bigint], 'le projet devient accessible après acceptation');

select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select change_project_collaborator_role(
    (select id from project_collaborations where project_id = '92000000-0000-0000-0000-000000000001'),
    'écriture'
  )$$,
  'le propriétaire modifie le rôle par la frontière dédiée'
);
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000002', true);
select results_eq(
  $$select role from project_collaborations where project_id = '92000000-0000-0000-0000-000000000001'$$,
  array['écriture'::text],
  'le collaborateur observe son nouveau rôle'
);
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select remove_project_collaborator(
    (select id from project_collaborations where project_id = '92000000-0000-0000-0000-000000000001')
  )$$,
  'le propriétaire retire le collaborateur par la frontière dédiée'
);
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000002', true);
select results_eq(
  $$select count(*) from projects where id = '92000000-0000-0000-0000-000000000001'$$,
  array[0::bigint],
  'le projet redevient inaccessible après le retrait'
);

select * from finish();
rollback;
