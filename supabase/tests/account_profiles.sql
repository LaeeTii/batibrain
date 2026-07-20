begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

select ok(
  not has_table_privilege('authenticated', 'user_profiles', 'INSERT'),
  'un utilisateur ne peut pas créer directement son profil'
);
select ok(
  not has_table_privilege('authenticated', 'user_profiles', 'UPDATE'),
  'la modification du profil passe uniquement par la RPC dédiée'
);
select ok(
  not has_column_privilege('authenticated', 'user_profiles', 'display_name', 'UPDATE'),
  'le nom d’affichage ne peut pas être modifié directement'
);
select ok(
  not has_column_privilege('authenticated', 'user_profiles', 'avatar_storage_path', 'UPDATE'),
  'le chemin d’avatar ne peut pas contourner la validation de la RPC'
);
select ok(
  not has_table_privilege('authenticated', 'user_profiles', 'DELETE'),
  'un utilisateur ne peut pas supprimer directement son profil'
);

insert into auth.users (id, email, aud, role, created_at, updated_at)
values
  ('11000000-0000-0000-0000-000000000001', 'profil-1@example.test', 'authenticated', 'authenticated', now(), now()),
  ('11000000-0000-0000-0000-000000000002', 'profil-2@example.test', 'authenticated', 'authenticated', now(), now());

insert into user_profiles (user_id, display_name, first_name, last_name, role)
values
  ('11000000-0000-0000-0000-000000000001', 'Profil Un', 'Prénom', 'Un', 'user'),
  ('11000000-0000-0000-0000-000000000002', 'Profil Deux', 'Prénom', 'Deux', 'admin');

select is(
  (select file_size_limit from storage.buckets where id = 'user-avatars'),
  5242880::bigint,
  'le bucket limite les avatars à 5 Mio'
);

select results_eq(
  $$select unnest(allowed_mime_types) from storage.buckets where id = 'user-avatars' order by 1$$,
  $$values ('image/gif'::text), ('image/jpeg'::text), ('image/png'::text), ('image/webp'::text)$$,
  'le bucket accepte uniquement les formats d’image prévus'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$ select update_own_profile('Profil Modifié', 'Nouveau', 'Nom', '11000000-0000-0000-0000-000000000001/avatar.png') $$,
  'un utilisateur modifie son propre profil'
);

select is(
  (select display_name from user_profiles where user_id = auth.uid()),
  'Profil Modifié',
  'le nom d’affichage est enregistré'
);

select is(
  (select role from user_profiles where user_id = auth.uid()),
  'user',
  'la RPC ne modifie jamais le rôle'
);

select is(
  (select count(*) from user_profiles where user_id = '11000000-0000-0000-0000-000000000002'),
  0::bigint,
  'un utilisateur ne lit pas le profil d’un autre compte'
);

select throws_ok(
  $$ select update_own_profile('Profil Deux', 'Nouveau', 'Nom', null) $$,
  '23505',
  'duplicate key value violates unique constraint "uq_user_profiles_display_name"',
  'un nom d’affichage déjà utilisé est refusé'
);

select throws_ok(
  $$ select update_own_profile('Profil Un', 'Nouveau', 'Nom', '11000000-0000-0000-0000-000000000002/avatar.png') $$,
  '22023',
  'Chemin d’avatar invalide.',
  'le chemin d’avatar d’un autre utilisateur est refusé'
);

select throws_ok(
  $$ select update_own_profile('', 'Nouveau', 'Nom', null) $$,
  '22023',
  'Le nom d’affichage, le prénom et le nom sont obligatoires.',
  'les champs obligatoires sont contrôlés côté base'
);

select * from finish();
rollback;
