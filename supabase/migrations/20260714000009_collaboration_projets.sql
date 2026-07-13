-- Opérations sécurisées pour les invitations et collaborations projet.

create or replace function project_collaboration_overview(target_project_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
begin
  if not owns_project(target_project_id) then raise exception 'PROJECT_OWNER_REQUIRED'; end if;
  return jsonb_build_object(
    'invitations', coalesce((select jsonb_agg(jsonb_build_object(
      'id', i.id, 'email', i.invited_email, 'role', i.role, 'status', i.status,
      'updated_at', i.updated_at) order by i.updated_at desc)
      from project_invitations i where i.project_id = target_project_id and i.status = 'en_attente'), '[]'::jsonb),
    'collaborators', coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'user_id', c.user_id, 'email', u.email, 'display_name', p.display_name,
      'role', c.role, 'updated_at', c.updated_at) order by p.display_name)
      from project_collaborations c join auth.users u on u.id = c.user_id
      left join user_profiles p on p.user_id = c.user_id where c.project_id = target_project_id), '[]'::jsonb)
  );
end; $$;

create or replace function invite_project_member(target_project_id uuid, target_email text, target_role text)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare invited_id uuid; invitation_id uuid;
begin
  if not owns_project(target_project_id) then raise exception 'PROJECT_OWNER_REQUIRED'; end if;
  if target_role is null or target_role not in ('lecture', 'écriture') then raise exception 'PROJECT_ROLE_INVALID'; end if;
  select id into invited_id from auth.users where lower(email) = lower(trim(target_email));
  if invited_id is null then raise exception 'PROJECT_INVITEE_NOT_FOUND'; end if;
  if invited_id = auth.uid() then raise exception 'PROJECT_OWNER_INVITE_FORBIDDEN'; end if;
  if exists(select 1 from project_collaborations where project_id = target_project_id and user_id = invited_id)
    then raise exception 'PROJECT_COLLABORATION_EXISTS'; end if;
  insert into project_invitations(project_id, invited_user_id, invited_email, role, status, created_at, updated_at)
  values(target_project_id, invited_id, lower(trim(target_email)), target_role, 'en_attente', now(), now())
  returning id into invitation_id;
  return invitation_id;
end; $$;

create or replace function resend_project_invitation(target_invitation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update project_invitations set updated_at = now()
  where id = target_invitation_id and status = 'en_attente' and owns_project(project_id);
  if not found then raise exception 'PROJECT_INVITATION_NOT_FOUND'; end if;
end; $$;

create or replace function cancel_project_invitation(target_invitation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update project_invitations set status = 'annulée', updated_at = now()
  where id = target_invitation_id and status = 'en_attente' and owns_project(project_id);
  if not found then raise exception 'PROJECT_INVITATION_NOT_FOUND'; end if;
end; $$;

create or replace function accept_project_invitation(target_invitation_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare invitation project_invitations%rowtype;
begin
  select * into invitation from project_invitations
  where id = target_invitation_id and invited_user_id = auth.uid() and status = 'en_attente' for update;
  if not found then raise exception 'PROJECT_INVITATION_NOT_FOUND'; end if;
  insert into project_collaborations(project_id, user_id, role, created_at, updated_at)
  values(invitation.project_id, auth.uid(), invitation.role, now(), now())
  on conflict(project_id, user_id) do update set role = excluded.role, updated_at = now();
  update project_invitations set status = 'acceptée', updated_at = now() where id = invitation.id;
  return invitation.project_id;
end; $$;

create or replace function pending_project_invitations()
returns table(id uuid, project_id uuid, project_name text, role text, invited_email text, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select i.id, i.project_id, p.name, i.role, i.invited_email, i.updated_at
  from project_invitations i join projects p on p.id = i.project_id
  where i.invited_user_id = auth.uid() and i.status = 'en_attente' and not p.is_soft_deleted
  order by i.updated_at desc;
$$;

revoke all on function project_collaboration_overview(uuid) from public;
revoke all on function invite_project_member(uuid, text, text) from public;
revoke all on function resend_project_invitation(uuid) from public;
revoke all on function cancel_project_invitation(uuid) from public;
revoke all on function accept_project_invitation(uuid) from public;
revoke all on function pending_project_invitations() from public;
grant execute on function project_collaboration_overview(uuid) to authenticated;
grant execute on function invite_project_member(uuid, text, text) to authenticated;
grant execute on function resend_project_invitation(uuid) to authenticated;
grant execute on function cancel_project_invitation(uuid) to authenticated;
grant execute on function accept_project_invitation(uuid) to authenticated;
grant execute on function pending_project_invitations() to authenticated;
