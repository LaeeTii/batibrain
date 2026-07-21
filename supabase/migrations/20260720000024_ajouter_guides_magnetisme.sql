begin;

alter table editor_view_settings
  add column snap_guides boolean not null default true;

commit;
