-- BatiBrain - suppression schema V1
--
-- Objectif:
-- - Supprimer les tables de l'ancien schéma lorsqu'elles sont encore présentes.
--
-- Securite:
-- - Le script vérifie des marqueurs propres à l'ancien schéma avant suppression.
-- - Si les marqueurs ne sont pas detectes, aucune suppression n'est effectuee.

begin;

do $$
declare
  is_v1_walls boolean;
  is_v1_documents boolean;
  is_v1_tasks boolean;
begin
  -- Marqueur V1: walls.height_left_cm existe en V1 et n'existe plus en V2.
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'walls'
      and column_name = 'height_left_cm'
  ) into is_v1_walls;

  -- Marqueur V1: documents.document_type existe en V1 et n'existe plus en V2.
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'documents'
      and column_name = 'document_type'
  ) into is_v1_documents;

  -- Marqueur V1: tasks n'a pas de colonne is_soft_deleted en V1.
  select not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tasks'
      and column_name = 'is_soft_deleted'
  ) into is_v1_tasks;

  if is_v1_walls and is_v1_documents and is_v1_tasks then
    -- Ordre explicite pour lisibilite; CASCADE couvre les dependances restantes.
    drop table if exists openings cascade;
    drop table if exists walls cascade;
    drop table if exists piece_vertices cascade;
    drop table if exists tasks cascade;
    drop table if exists documents cascade;
    drop table if exists pieces cascade;
    drop table if exists levels cascade;
    drop table if exists projects cascade;

    raise notice 'Schema V1 detecte et supprime.';
  else
    raise notice 'Schema V1 non detecte (ou deja supprime): aucune table supprimee.';
  end if;
end
$$;

commit;
