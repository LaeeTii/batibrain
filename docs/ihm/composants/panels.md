# Composants - Panels

## Objectif
- Definir le role des panneaux de l'éditeur 2D global et leur articulation avec le canvas et la logique de sélection.

## Liste des composants
- EditorCreationPanel
- EditorDetailPanel

## Responsabilites
- EditorCreationPanel:
	- Afficher les accordeons metier (Niveaux, Pièces, Murs, Ouvertures, Côtes, Notes).
	- Exposer les blocs creation, édition et listes selon le contexte.
	- Piloter l'etat des modes d'interaction actifs du canvas.
- EditorDetailPanel:
	- Afficher l'arbre de détail du niveau actif et de ses objets.
	- Synchroniser la sélection avec le canvas et le panneau de creation.
	- Permettre la navigation detaillee sans modifier les invariants geometriques.

## Props et contrat
- Contexte requis:
	- projet courant,
	- niveau actif,
	- niveaux visibles,
	- objet selectionne.
- Données d'entree:
	- listes des objets metier (niveaux, pièces, murs, ouvertures, côtes, notes),
	- options d'affichage et de magnetisme,
	- etat d'ouverture du panneau détail.
- Sorties et callbacks:
	- creation, édition, suppression,
	- sélection d'objet,
	- changement de niveau actif,
	- ouverture/fermeture accordeons et panneaux.

- Le contenu detaille du composant DetailTree est documente dans [transverses.md](../composants/transverses.md).

## Etats et interactions
- Un seul accordeon de premier niveau est ouvert a la fois dans EditorCreationPanel.
- Les sous-sections internes (ex: Liste) peuvent rester ouvertes avec les blocs creation/édition de leur domaine.
- Le bouton retour ferme tous les accordeons et quitte le mode d'édition actif.
- La sélection d'un objet dans un panneau se propage au canvas et a l'autre panneau selon les règles de synchronisation.
- Le panneau détail est ferme par defaut et peut etre ouvert/ferme sans perdre la sélection globale active.
- Repli/ouverture des panneaux:
	- panneau creation: bouton - pour replier, bouton + carre pour rouvrir,
	- panneau détail: ferme par defaut, bouton ! pour rouvrir quand replie,
	- panneau détail ouvert: titre Détail et bouton - de fermeture.
- Arbre du panneau détail:
	- niveau racine: niveau actif (nom, nombre de pièces),
	- branches detaillees: notes niveau, côtes, pièces,
	- sous-branches pièce: notes pièce, murs, angles,
	- sous-branches mur: notes mur, ouvertures,
	- zone notes projet: liste des notes rattachees au projet.
	- Le contrat de structure, de libelles et de sélection du tree est source dans [transverses.md](../composants/transverses.md).

## Iconographie
- Retour au choix des sections: `LuArrowLeft`, icône + texte `Retour`.
- Replier le panneau de création: `LuPanelLeftClose`, icône seule.
- Rouvrir le panneau de création: `LuPanelLeftOpen`, icône seule.
- Ouvrir le panneau de détail: `LuListTree`, icône seule.
- Fermer le panneau de détail: `LuPanelRightClose`, icône seule.
- Les symboles textuels `-`, `+` et `!` ne sont pas utilisés comme substituts aux icônes de panneau.

## Règles metier
- Les règles de synchronisation de sélection sont sourcees dans le document logique dedie.
- Les règles geometriques et validations metier des objets ne sont pas redefinies dans ce document.
- Les panneaux doivent rester compatibles avec les modes creation/édition exposes par la vue GlobalEditor2DView.
- Les listes des sections Murs et Ouvertures dédupliquent les relations par identifiant afin qu’un élément partagé n’y apparaisse qu’une seule fois.
- La fermeture du panneau détail ne doit pas invalider la sélection active.
- La fermeture du panneau creation ne doit pas supprimer l'etat des données en cours, uniquement masquer la zone UI.

## Declinaison RoomEditor2DView
- Cette declinaison applique un scope pièce unique.
- EditorCreationPanel:
	- section Niveaux absente,
	- action d'ajout de pièce absente,
	- section Pièces limitee a la pièce courante.
- EditorDetailPanel:
	- l'arbre détail reste complet (niveau, pièces, murs, ouvertures, notes),
	- les noeuds hors pièce courante sont affiches en gris,
	- les noeuds hors pièce courante restent depliables/repliables,
	- les noeuds hors pièce courante ne sont pas selectionnables.

## Cas limites
- Objet selectionne supprime entre deux interactions: la sélection est nettoyee et l'UI revient dans un etat stable.
- Panneau détail ferme pendant une mise a jour de sélection: la sélection globale reste active sans forcer l'ouverture.
- Données partielles indisponibles: affichage degrade avec message d'erreur local sans blocage global de la vue.
- Arbre détail trop profond ou incomplet: la navigation reste exploitable sans bloquer les actions principales de la vue.

## Criteres d'acceptation testables
- Given un utilisateur ouvre l'accordeon Pièces, When il ouvre ensuite l'accordeon Murs, Then l'accordeon Pièces se ferme automatiquement.
- Given un mur est selectionne dans le canvas, When le panneau creation est visible, Then l'accordeon Murs s'ouvre avec bloc édition pre-rempli.
- Given une pièce est selectionnee dans EditorDetailPanel, When la sélection est appliquee, Then la pièce correspondante est surlignee dans le canvas.
- Given le bouton retour est clique, When l'action est terminee, Then tous les accordeons sont fermes et aucun mode creation actif ne subsiste.
- Given l'arbre détail est ouvert, When les données sont chargees, Then les noeuds sont ordonnes selon la hierarchie niveau > pièces > murs > ouvertures > notes associees > notes projet.
- Given un noeud mur est clique dans DetailTree, When la sélection est propagee, Then le mur est surligne dans le canvas et le bloc édition mur est affiche.
- Given un noeud d'un autre niveau est clique, When la sélection est appliquee, Then le niveau editable bascule sur le niveau du noeud cible et la sélection est conservee.
- Given RoomEditor2DView est active, When l'utilisateur ouvre EditorCreationPanel, Then la section Niveaux n'est pas affichee.
- Given RoomEditor2DView est active, When l'utilisateur consulte la section Pièces, Then aucune action d'ajout de pièce n'est disponible.
- Given RoomEditor2DView est active et le panneau détail est ouvert, When l'utilisateur clique un noeud hors pièce courante, Then la sélection active ne change pas et aucun mode d'édition n'est ouvert.

## References
- Referentiel global : [ihm.md](../ihm.md)
- Vue associee : [editeur_2d_global.md](../vues/editeur_2d_global.md)
- Logique sélection : [edition_2D_synchronisation_selection.md](../logique/edition_2D_synchronisation_selection.md)
- Logique géométrique : [geometry.md](../logique/geometry.md)
