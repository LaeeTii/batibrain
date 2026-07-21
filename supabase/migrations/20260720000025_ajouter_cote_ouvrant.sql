update public.openings
set orientation = case
  when split_part(coalesce(orientation, ''), ':', 1) = 'inverse' then 'inverse:left'
  else 'normal:left'
end;

alter table public.openings
  add column hinge_side text generated always as (
    case split_part(coalesce(orientation, 'normal:left'), ':', 2)
      when 'right' then 'right'
      else 'left'
    end
  ) stored;

create or replace function public.normalize_opening_orientation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.orientation is null or new.orientation = '' then
    new.orientation := 'normal:left';
  elsif new.orientation in ('normal', 'inverse') then
    new.orientation := new.orientation || ':left';
  end if;
  return new;
end;
$$;

create trigger normalize_opening_orientation_before_write
before insert or update of orientation on public.openings
for each row execute function public.normalize_opening_orientation();

alter table public.openings
  alter column orientation set default 'normal:left',
  alter column orientation set not null;

alter table public.openings
  add constraint openings_orientation_check
  check (orientation in ('normal:left', 'normal:right', 'inverse:left', 'inverse:right'));

comment on column public.openings.orientation is
  'Orientation et côté ouvrant transportés atomiquement sous la forme normal|inverse:left|right.';

comment on column public.openings.hinge_side is
  'Côté ouvrant dérivé de l’orientation transactionnelle : left ou right.';
