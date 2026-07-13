begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users(id, email, aud, role, created_at, updated_at) values
('91000000-0000-0000-0000-000000000001', 'owner-collab@example.test', 'authenticated', 'authenticated', now(), now()),
('91000000-0000-0000-0000-000000000002', 'invitee-collab@example.test', 'authenticated', 'authenticated', now(), now());
insert into projects(id, owner_user_id, name, is_soft_deleted) values
('92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'Projet collaboration', false);

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
select lives_ok($$select invite_project_member('92000000-0000-0000-0000-000000000001', 'invitee-collab@example.test', 'lecture')$$, 'le propriétaire invite un compte existant');

select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000002', true);
select results_eq($$select count(*) from pending_project_invitations()$$, array[1::bigint], 'l’invité voit la notification');
select results_eq($$select count(*) from projects where id = '92000000-0000-0000-0000-000000000001'$$, array[0::bigint], 'l’invitation en attente ne donne aucun accès');
select lives_ok($$select accept_project_invitation((select id from project_invitations where invited_user_id = '91000000-0000-0000-0000-000000000002' and status = 'en_attente'))$$, 'l’invité accepte atomiquement');
select results_eq($$select count(*) from projects where id = '92000000-0000-0000-0000-000000000001'$$, array[1::bigint], 'le projet devient accessible après acceptation');

select * from finish();
rollback;
