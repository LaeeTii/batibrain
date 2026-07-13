-- BatiBrain — niveaux obligatoires et écritures Dashboard V1-20
begin;

alter table levels alter column is_visible set default true;
alter table levels alter column is_soft_deleted set default false;
alter table pieces alter column is_soft_deleted set default false;
alter table pieces alter column is_locked set default false;

-- Le backfill est une opération d'administration sans session Auth. Le garde
-- applicatif exigerait sinon un utilisateur propriétaire et un verrou projet.
alter table levels disable trigger levels_editing_lock;

insert into levels (project_id, name, level_number, altitude_cm, is_visible, is_soft_deleted)
select p.id, 'Niveau 0', 0, 0, true, false
from projects p
where not exists (select 1 from levels l where l.project_id = p.id and l.level_number = 0);

alter table levels enable trigger levels_editing_lock;

create function create_default_level_for_project()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into levels (project_id, name, level_number, altitude_cm, is_visible, is_soft_deleted)
  values (new.id, 'Niveau 0', 0, 0, true, false);
  return new;
end;
$$;

create trigger projects_create_default_level
after insert on projects for each row execute function create_default_level_for_project();

create function protect_required_level_zero()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.level_number = 0 and (new.is_soft_deleted or not new.is_visible or new.level_number <> 0) then
    raise exception 'Le niveau 0 obligatoire doit rester actif et visible.';
  end if;
  return new;
end;
$$;

create trigger levels_protect_required_zero
before update on levels for each row execute function protect_required_level_zero();

commit;
