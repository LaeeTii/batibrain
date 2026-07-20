begin;

select plan(18);

select ok(
  has_function_privilege('anon', 'submit_account_creation_request(text,text,text,text)', 'EXECUTE'),
  'le rôle anonyme peut déposer une demande via la RPC'
);

select ok(
  not has_table_privilege('anon', 'account_creation_requests', 'INSERT'),
  'le rôle anonyme ne peut pas contourner la RPC par une insertion directe'
);

select ok(
  not has_table_privilege('authenticated', 'account_creation_requests', 'UPDATE'),
  'une demande ne peut pas être approuvée partiellement par une écriture directe'
);

select ok(
  not has_table_privilege('authenticated', 'account_creation_requests', 'DELETE'),
  'une demande de compte ne peut pas être supprimée directement'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'admin@batibrain.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

insert into user_profiles (user_id, display_name, first_name, last_name, role)
values ('10000000-0000-0000-0000-000000000001', 'Administration', 'Ada', 'Min', 'admin');

select lives_ok(
  $$ select submit_account_creation_request('  Alice@Example.test ', ' Alice ', ' Alice ', ' Martin ') $$,
  'une demande publique valide est créée'
);

select is(
  (select email from account_creation_requests where display_name = 'Alice'),
  'alice@example.test',
  'l’adresse e-mail est normalisée'
);

select is(
  (select status from account_creation_requests where display_name = 'Alice'),
  'en_attente',
  'la demande reste en attente avant invitation'
);

select throws_ok(
  $$ select submit_account_creation_request('alice@example.test', 'Autre Alice', 'Alice', 'Martin') $$,
  '23505',
  'Cette adresse e-mail est déjà utilisée ou demandée.',
  'une adresse en attente est refusée'
);

select throws_ok(
  $$ select submit_account_creation_request('autre@example.test', 'alice', 'Alice', 'Martin') $$,
  '23505',
  'Ce nom d’affichage est déjà utilisé ou demandé.',
  'un nom d’affichage en attente est refusé sans tenir compte de la casse'
);

select throws_ok(
  $$ select submit_account_creation_request('invalide', 'Valide', 'Alice', 'Martin') $$,
  '22023',
  'Adresse e-mail invalide.',
  'une adresse invalide est refusée'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000002',
  'authenticated', 'authenticated', 'existant@batibrain.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

select throws_ok(
  $$ select submit_account_creation_request('existant@batibrain.test', 'Nouveau', 'Jean', 'Dupont') $$,
  '23505',
  'Cette adresse e-mail est déjà utilisée ou demandée.',
  'l’adresse d’un compte Auth existant est refusée'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000003',
  'authenticated', 'authenticated', email, '', now(),
  '{"provider":"email","providers":["email"]}',
  jsonb_build_object(
    'account_creation_request_id', id,
    'approved_by_user_id', '10000000-0000-0000-0000-000000000001'
  ),
  now(), now()
from account_creation_requests
where display_name = 'Alice';

select is(
  (select role from user_profiles where user_id = '10000000-0000-0000-0000-000000000003'),
  'user',
  'l’invitation crée un profil user'
);

select is(
  (select display_name from user_profiles where user_id = '10000000-0000-0000-0000-000000000003'),
  'Alice',
  'le profil reprend le nom d’affichage demandé'
);

select is(
  (select status from account_creation_requests where display_name = 'Alice'),
  'approuvée',
  'la demande est approuvée dans la transaction Auth'
);

select is(
  (select approved_by_user_id from account_creation_requests where display_name = 'Alice'),
  '10000000-0000-0000-0000-000000000001'::uuid,
  'l’approbateur est tracé'
);

select ok(
  (select approved_at is not null from account_creation_requests where display_name = 'Alice'),
  'la date d’approbation est renseignée'
);

select throws_ok(
  $$
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      '10000000-0000-0000-0000-000000000004',
      'authenticated', 'authenticated', 'invitation-invalide@example.test', '', now(),
      '{"provider":"email","providers":["email"]}',
      '{"account_creation_request_id":"00000000-0000-0000-0000-000000000099","approved_by_user_id":"10000000-0000-0000-0000-000000000001"}',
      now(), now()
    )
  $$,
  'P0001',
  'Demande de compte en attente introuvable.',
  'une invitation invalide ne crée pas d’utilisateur Auth partiel'
);

select is(
  (select count(*) from auth.users where id = '10000000-0000-0000-0000-000000000004'),
  0::bigint,
  'l’utilisateur Auth invalide a été annulé'
);

select * from finish();
rollback;
