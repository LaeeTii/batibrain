-- BatiBrain — permissions minimales pour l’administration des comptes

begin;

revoke all on function set_user_role(uuid, text) from public;
grant execute on function set_user_role(uuid, text) to authenticated;

create function protect_last_admin_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from user_profiles
    where user_id = old.id and role = 'admin'
  ) and (select count(*) from user_profiles where role = 'admin') <= 1 then
    raise exception 'Le dernier administrateur ne peut pas être supprimé.';
  end if;
  return old;
end;
$$;

create trigger trg_auth_users_protect_last_admin
before delete on auth.users
for each row execute procedure protect_last_admin_deletion();

commit;
