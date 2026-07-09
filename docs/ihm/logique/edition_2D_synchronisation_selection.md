# Edition 2D - Synchronisation de selection

## Perimetre du document
- Ce document decrit les regles de synchronisation entre le canvas, le panneau de creation, le panneau detail et les bulles de notes projet.
- Il couvre la propagation de la selection, les changements de focus et les ouvertures automatiques de panneaux.
- Le contrat geometrique appartient a [geometry.md](./geometry.md).
- Les parcours utilisateur et les modes d'interaction appartiennent a [ihm_editeur_2d_global.md](./ihm_editeur_2d_global.md).

## Sources de selection
- Canvas du plan.
- Listes du panneau menu creation.
- Panneau detail.
- Bulle des notes projet en bas a droite du canvas.

## Regles generales
- Une selection utilisateur doit etre refletee dans toutes les vues qui representent le meme objet.
- La selection active est unique a un instant donne.
- L'objet selectionne est mis en surbrillance dans chaque vue qui peut l'afficher.
- La selection d'un objet doit afficher son bloc edition quand ce bloc existe.

## Propagation de la selection
- Si un objet est selectionne dans le canvas et que la liste des objets du meme type est ouverte dans le panneau menu creation, l'objet est mis en surbrillance dans cette liste et dans le panneau detail s'il est ouvert.
- Si un objet est selectionne dans la liste du panneau menu creation ou dans le panneau detail, l'objet est mis en surbrillance dans le canvas et dans l'autre panneau.
- La selection d'un objet est synchronisee entre le canvas, la liste du panneau menu creation et le panneau detail.
- Pour les notes, la selection est aussi synchronisee avec la bulle des notes projet en bas a droite du canvas.

## Effets sur les panneaux
- La selection d'un objet ouvre l'accordeon de premier niveau correspondant dans le panneau menu creation.
- Le bloc edition de l'objet selectionne est affiche avec les champs pre-remplis.
- Le bouton "retour" ferme tous les accordeons et quitte le mode d'edition actif du canvas.
- Si le panneau detail est ferme, la selection reste active mais n'ouvre pas le panneau automatiquement sauf action explicite prevue par l'IHM.

## Regles par type d'objet
- Piece : mise en surbrillance dans le canvas, ouverture de l'accordeon "Pieces", affichage du bloc edition si disponible.
- Mur : mise en surbrillance dans le canvas, ouverture de l'accordeon "Murs", affichage du bloc edition si disponible.
- Ouverture : mise en surbrillance dans le canvas, ouverture de l'accordeon "Ouvertures", affichage du bloc edition si disponible.
- Cote : mise en surbrillance dans le canvas, ouverture de l'accordeon "Cotes", affichage du bloc edition si disponible.
- Note : mise en surbrillance dans le canvas, synchronisation avec la liste des notes et la bulle des notes projet, affichage de l'infobulle contextuelle et ouverture du bloc edition.
- Point : mise en surbrillance dans le canvas et exposition du contexte d'edition associe si le mode actif le permet.

## Changement de niveau actif
- Si un objet est selectionne depuis le panneau detail et qu'il appartient a un autre niveau, ce niveau devient le niveau editable actif.
- Les autres niveaux coches restent visibles mais non editables.
- Le changement de niveau doit conserver la selection de l'objet cible apres bascule.

## Cas particuliers
- Une note sans objet parent reste selectionnable depuis la bulle projet.
- Si l'objet parent d'une note disparait, la note doit rester accessible via son rattachement projet.
- Si la source de selection n'affiche pas le type de l'objet selectionne, la selection globale reste active sans exigence de surbrillance locale.
