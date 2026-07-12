# Édition 2D - Synchronisation de sélection

## Périmètre du document
- Ce document decrit les règles de synchronisation entre le canvas, le panneau de creation, le panneau détail et les bulles de notes projet.
- Il couvre la propagation de la sélection, les changements de focus et les ouvertures automatiques de panneaux.
- Le contrat géométrique appartient a [geometry.md](./geometry.md).
- Les parcours utilisateur et les modes d'interaction appartiennent a [editeur_2d_global.md](../vues/editeur_2d_global.md).

## Sources de sélection
- Canvas du plan.
- Listes du panneau menu creation.
- Panneau détail.
- Bulle des notes projet en bas a droite du canvas.

## Règles generales
- Une sélection utilisateur doit etre refletee dans toutes les vues qui representent le meme objet.
- La sélection active est unique a un instant donne.
- L'objet selectionne est mis en surbrillance dans chaque vue qui peut l'afficher.
- La sélection d'un objet doit afficher son bloc édition quand ce bloc existe.
- Le verrouillage manuel d'une pièce, d'un mur ou d'une ouverture ne désactive ni sa sélection, ni sa surbrillance, ni l'ouverture consultative de son bloc d'édition.

## Propagation de la sélection
- Si un objet est selectionne dans le canvas et que la liste des objets du meme type est ouverte dans le panneau menu creation, l'objet est mis en surbrillance dans cette liste et dans le panneau détail s'il est ouvert.
- Si un objet est selectionne dans la liste du panneau menu creation ou dans le panneau détail, l'objet est mis en surbrillance dans le canvas et dans l'autre panneau.
- La sélection d'un objet est synchronisee entre le canvas, la liste du panneau menu creation et le panneau détail.
- Pour les notes, la sélection est aussi synchronisee avec la bulle des notes projet en bas a droite du canvas.

## Effets sur les panneaux
- La sélection d'un objet ouvre l'accordeon de premier niveau correspondant dans le panneau menu creation.
- Le bloc édition de l'objet selectionne est affiche avec les champs pre-remplis.
- Le bouton "retour" ferme tous les accordeons et quitte le mode d'édition actif du canvas.
- Si le panneau détail est ferme, la sélection reste active mais n'ouvre pas le panneau automatiquement sauf action explicite prevue par l'IHM.

## Règles par type d'objet
- Pièce : mise en surbrillance dans le canvas, ouverture de l'accordeon "Pièces", affichage du bloc édition si disponible.
- Mur : mise en surbrillance dans le canvas, ouverture de l'accordeon "Murs", affichage du bloc édition si disponible.
	- L'action `Ouvrir la vue Mur` conserve ce mur comme sélection active et transmet les contextes projet et niveau à WallEditorView.
	- RoomEditor2DView transmet aussi sa pièce courante afin de sélectionner la face orientée vers elle; l'éditeur global ne transmet aucune pièce d'origine.
	- Le changement de face dans WallEditorView conserve le même mur sélectionné.
- Ouverture : mise en surbrillance dans le canvas, ouverture de l'accordeon "Ouvertures", affichage du bloc édition si disponible.
- Cote : mise en surbrillance dans le canvas, ouverture de l'accordeon "Côtes", affichage du bloc édition si disponible.
- Note : mise en surbrillance dans le canvas, synchronisation avec la liste des notes et la bulle des notes projet, affichage de l'infobulle contextuelle et ouverture du bloc édition.
- Point : mise en surbrillance dans le canvas et exposition du contexte d'édition associe si le mode actif le permet.

## Effet du verrouillage manuel
- Une pièce, un mur ou une ouverture verrouillé suit les mêmes règles de propagation de sélection qu'un élément déverrouillé.
- Son bloc d'édition affiche son état verrouillé et rend indisponibles les modifications et la suppression.
- Le propriétaire et les collaborateurs en écriture disposent de l'action `Déverrouiller`; le collaborateur en lecture consulte uniquement l'état.
- Les verrous sont indépendants entre pièce, mur et ouverture et ne produisent aucun changement en cascade.

## Changement de niveau actif
- Si un objet est selectionne depuis le panneau détail et qu'il appartient a un autre niveau, ce niveau devient le niveau editable actif.
- Les autres niveaux coches restent visibles mais non editables.
- Le changement de niveau doit conserver la sélection de l'objet cible apres bascule.

## Cas particuliers
- Une note sans objet parent reste selectionnable depuis la bulle projet.
- Si l'objet parent d'une note disparait, la note doit rester accessible via son rattachement projet.
- Si la source de sélection n'affiche pas le type de l'objet selectionne, la sélection globale reste active sans exigence de surbrillance locale.
