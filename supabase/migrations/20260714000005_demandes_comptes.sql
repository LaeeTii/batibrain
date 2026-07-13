-- BatiBrain — dépôt et approbation atomique des demandes de compte

begin;

create function submit_account_creation_request(
  request_email text,
  request_display_name text,
  request_first_name text,
  request_last_name text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_email text := lower(trim(request_email));
  normalized_display_name text := trim(request_display_name);
  normalized_first_name text := trim(request_first_name);
  normalized_last_name text := trim(request_last_name);
  created_request_id uuid;
begin
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'Adresse e-mail invalide.';
  end if;
  if normalized_display_name = '' or normalized_first_name = '' or normalized_last_name = '' then
    raise exception using errcode = '22023', message = 'Tous les champs sont obligatoires.';
  end if;
  if length(normalized_display_name) > 80
    or length(normalized_first_name) > 100
    or length(normalized_last_name) > 100 then
    raise exception using errcode = '22023', message = 'Un des champs dépasse la longueur autorisée.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(normalized_email, 0));
  perform pg_advisory_xact_lock(hashtextextended(lower(normalized_display_name), 1));

  if exists (select 1 from auth.users where lower(email) = normalized_email)
    or exists (
      select 1 from account_creation_requests
      where lower(email) = normalized_email and status = 'en_attente'
    ) then
    raise exception using errcode = '23505', message = 'Cette adresse e-mail est déjà utilisée ou demandée.';
  end if;

  if exists (select 1 from user_profiles where lower(display_name) = lower(normalized_display_name))
    or exists (
      select 1 from account_creation_requests
      where lower(display_name) = lower(normalized_display_name) and status = 'en_attente'
    ) then
    raise exception using errcode = '23505', message = 'Ce nom d’affichage est déjà utilisé ou demandé.';
  end if;

  insert into account_creation_requests (
    email, display_name, first_name, last_name, status
  ) values (
    normalized_email, normalized_display_name, normalized_first_name, normalized_last_name, 'en_attente'
  ) returning id into created_request_id;

  return created_request_id;
end;
$$;

create function complete_invited_account_request()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  requested_id uuid;
  approving_user_id uuid;
  pending_request account_creation_requests%rowtype;
begin
  if not coalesce(new.raw_user_meta_data ? 'account_creation_request_id', false) then
    return new;
  end if;

  requested_id := (new.raw_user_meta_data ->> 'account_creation_request_id')::uuid;
  approving_user_id := (new.raw_user_meta_data ->> 'approved_by_user_id')::uuid;

  if not exists (
    select 1 from user_profiles
    where user_id = approving_user_id and role = 'admin'
  ) then
    raise exception 'Approbateur administrateur invalide.';
  end if;

  select * into pending_request
  from account_creation_requests
  where id = requested_id and status = 'en_attente'
  for update;

  if not found then
    raise exception 'Demande de compte en attente introuvable.';
  end if;
  if lower(coalesce(new.email, '')) <> lower(pending_request.email) then
    raise exception 'L’adresse invitée ne correspond pas à la demande.';
  end if;
  if exists (
    select 1 from user_profiles
    where lower(display_name) = lower(pending_request.display_name)
  ) then
    raise exception 'Ce nom d’affichage n’est plus disponible.';
  end if;

  insert into user_profiles (
    user_id, display_name, first_name, last_name, avatar_storage_path, role
  ) values (
    new.id,
    pending_request.display_name,
    pending_request.first_name,
    pending_request.last_name,
    null,
    'user'
  );

  update account_creation_requests
  set status = 'approuvée',
      approved_by_user_id = approving_user_id,
      approved_at = now(),
      updated_at = now()
  where id = requested_id;

  return new;
end;
$$;

create trigger trg_auth_user_complete_account_request
after insert on auth.users
for each row execute procedure complete_invited_account_request();

revoke all on function submit_account_creation_request(text, text, text, text) from public;
grant execute on function submit_account_creation_request(text, text, text, text) to anon, authenticated;
revoke all on function complete_invited_account_request() from public;
revoke insert on account_creation_requests from anon, authenticated;

commit;
