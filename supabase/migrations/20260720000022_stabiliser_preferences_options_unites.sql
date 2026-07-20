begin;

alter table user_preferences
  alter column length_unit set default 'cm',
  alter column surface_unit set default 'm2',
  alter column theme set default 'system',
  alter column default_wall_height_cm set default 250,
  alter column default_wall_thickness_cm set default 10;

alter table user_preferences
  add constraint user_preferences_length_unit_check
    check (length_unit in ('cm', 'm', 'mm')),
  add constraint user_preferences_surface_unit_check
    check (surface_unit in ('m2', 'cm2', 'mm2')),
  add constraint user_preferences_theme_check
    check (theme in ('clair', 'foncé', 'system')),
  add constraint user_preferences_wall_height_positive_check
    check (default_wall_height_cm > 0),
  add constraint user_preferences_wall_thickness_positive_check
    check (default_wall_thickness_cm > 0);

alter table editor_view_settings
  alter column show_grid set default true,
  alter column show_rules set default true,
  alter column show_dimensions set default true,
  alter column show_angles set default true,
  alter column show_notes set default true,
  alter column show_room_surfaces set default true,
  alter column show_room_icons set default true,
  alter column snap_grid set default true,
  alter column snap_vertices set default true,
  alter column snap_intersections set default true,
  alter column snap_walls set default true,
  alter column snap_midpoints set default true,
  alter column snap_distance_cm set default 10;

alter table editor_view_settings
  add constraint editor_view_settings_snap_distance_positive_check
    check (snap_distance_cm > 0);

commit;
