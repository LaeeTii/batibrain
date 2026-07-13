-- BatiBrain — nom par défaut du niveau 0
begin;

-- La migration s'exécute sans session Auth : neutraliser uniquement le garde
-- applicatif pendant la normalisation des niveaux créés par V1-20.
alter table levels disable trigger levels_editing_lock;

update levels
set name = 'RDC', updated_at = statement_timestamp()
where level_number = 0 and name = 'Niveau 0';

alter table levels enable trigger levels_editing_lock;

create or replace function create_default_level_for_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into levels (project_id, name, level_number, altitude_cm, is_visible, is_soft_deleted)
  values (new.id, 'RDC', 0, 0, true, false);
  return new;
end;
$$;

commit;
