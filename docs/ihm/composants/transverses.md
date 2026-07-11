# Composants - Transverses

## Objectif
- Definir les composants transverses utilises par plusieurs vues et leur contrat de synchronisation avec le contexte projet et la sélection globale.

## Liste des composants
- SettingsModal
- AppSidebar
- SidebarProjectContext
- Editor2DHeaderControls
- DetailTree
- ProjectNotesBubble
- SelectionSyncBridge

### Contrat SettingsModal
- Objectif:
	- Donner accès aux paramètres utilisateur depuis la side bar.
- Portée:
	- Modification des préférences de base de l'application.
	- Déclenchement du flux de changement de mot de passe.
	- Déconnexion de l'utilisateur connecté.
- Structure:
	- Bloc profil courant en en-tête.
	- Bloc unités de mesure.
	- Bloc unités de surface.
	- Bloc thème UI.
	- Bloc sécurité avec changement de mot de passe.
	- Action de déconnexion.
- Contrat de données:
	- Unités de longueur disponibles:
		- `cm` (par défaut)
		- `m`
		- `mm`
	- Unités de surface disponibles:
		- `m2` (par défaut)
		- `cm2`
		- `mm2`
	- Thème disponible:
		- `clair`
		- `foncé`
- Règles métier:
	- Les préférences sont portées par l'utilisateur courant.
	- Le changement d'unité prend effet sans quitter la session.
	- La déconnexion ferme la session et redirige vers LoginView.
	- Le changement de mot de passe reste dans le contexte du compte authentifié.
- Etats et feedback:
	- Chargement initial des préférences.
	- Sauvegarde en cours.
	- Erreur de sauvegarde affichée explicitement.
	- Confirmation visuelle après prise en compte de chaque changement.
- Criteres d'acceptation testables:
	- Given la modale est ouverte, When l'utilisateur choisit `mm` comme unité de longueur, Then la préférence est enregistrée avec `mm` comme valeur active.
	- Given la modale est ouverte, When l'utilisateur choisit `cm2` comme unité de surface, Then la préférence est enregistrée avec `cm2` comme valeur active.
	- Given la modale est ouverte, When l'utilisateur clique sur Déconnexion, Then il est redirigé vers LoginView.

## Responsabilites
- SettingsModal:
	- Donner accès aux paramètres utilisateur depuis la side bar.
- AppSidebar:
	- Afficher navigation principale et acces paramètres.
- SidebarProjectContext:
	- Gerer la sélection du projet courant et ses actions de contexte.
- Editor2DHeaderControls:
	- Exposer les options d'affichage (affichage/masquage) et de magnetisme (snapping) de l'éditeur 2D.
  - Exposer l'action d'export PDF Plan et Détail.
- DetailTree:
	- Afficher une navigation hierarchique des objets et relayer la sélection.
- ProjectNotesBubble:
	- Afficher les notes de projet non rattachees a un objet specifique.
  - Permettre la sélection d'une note projet depuis une liste cliquable superposee au canvas.
- SelectionSyncBridge:
	- Assurer la cohérence de sélection entre canvas, listes, détail tree et bulles de notes.

## Props et contrat
- Contexte requis:
	- utilisateur courant,
	- projet courant,
	- niveau actif,
	- sélection globale active.
- Données d'entree:
	- structure navigable des objets (DetailTree) avec noeuds types et ids stables,
	- options d'affichage (affichage/masquage: côtes, angles, grille, règles, notes),
	- options de magnetisme (snapping: grille, sommets, intersections, murs, milieux, distance de capture),
	- notes projet.
- Sorties et callbacks:
	- changement de projet,
	- changement d'options,
	- sélection d'objet (avec type + id),
	- ouverture des actions contextuelles associees.

### Contrat DetailTree
- Types de noeuds supportes:
	- `level`, `level-note`, `dimension`, `room`, `room-note`, `wall`, `wall-note`, `opening`, `opening-note`, `angle`, `project-note`.
- Cle d'identification de noeud:
	- format recommande: `<type>:<id>`.
	- exemple: `room:uuid-room-1`, `wall:uuid-wall-3`.
- Ordre d'affichage attendu:
	- niveau actif,
	- notes niveau,
	- côtes niveau,
	- pièces,
	- dans chaque pièce: notes pièce, murs, angles,
	- dans chaque mur: notes mur, ouvertures,
	- en fin d'arbre: notes projet.
- Format de libelle attendu:
	- niveau: `Nom niveau (X pièce(s))`,
	- cote: `Nom cote - valeur`,
	- pièce: `Nom pièce - surface`,
	- mur: `Mur <id court> - longueur - epaisseur - materiau - isolation - hauteur - type`,
	- ouverture: `Type - longueur - hauteur - allège - intérieur/extérieur`,
	- angle: `Angle <id court> - valeur`.
- Règles d'interaction:
	- clic sur un noeud selectionnable: met a jour la sélection globale,
	- si le noeud appartient a un autre niveau, bascule du niveau editable puis conservation de la sélection,
	- fermeture du panneau détail: n'annule pas la sélection active.
	- en mode scope pièce (RoomEditor2DView), les noeuds hors pièce courante sont visibles et depliables/repliables mais non selectionnables.

### Contrat SidebarProjectContext
- Données minimales exposees:
	- liste des projets accessibles,
	- projet courant,
	- indicateur aucun projet disponible.
- Regle de sélection par defaut:
	- si aucun projet n'est selectionne explicitement, le projet courant est initialise sur le dernier projet modifie.
- Changement explicite de projet:
	- emet un evenement `project-changed` avec l'identifiant du projet cible,
	- invalide les selections obsoletes du projet precedent,
	- declenche la reinitialisation des filtres locaux dependants de la vue consommatrice (ex: filtre niveau et recherche du dashboard).
- Cas aucun projet:
	- expose une capacite `create-first-project` pour autoriser la vue consommatrice a afficher uniquement l'action de creation initiale.
- Contraintes de cohérence:
	- ne doit jamais exposer simultanement `project courant` et `aucun projet disponible`,
	- tout evenement de changement doit etre idempotent (reselection du meme projet sans effet de bord).

### Contrat SelectionSyncBridge
- Entree minimale de sélection:
  - `source` (`canvas` | `creation-list` | `détail-tree` | `project-notes-bubble`),
  - `type` (pièce, mur, ouverture, cote, note, point, niveau),
  - `id` (identifiant stable),
  - `levelId` (si applicable).
- Règles d'arbitrage:
  - la derniere intention utilisateur explicite devient la sélection active,
  - une seule sélection active a un instant donne,
  - une sélection invalide (objet supprime) est purgee avec fallback sur absence de sélection.

## Etats et interactions
- Changement de projet via SidebarProjectContext met a jour le contexte global de la vue active.
- DetailTree et ProjectNotesBubble peuvent declencher une sélection synchronisee avec le canvas.
- SelectionSyncBridge maintient une sélection unique a un instant donne.
- Les composants transverses restent fonctionnels meme si certaines zones de la vue principale sont fermees (ex: panneau détail).
- Un changement de projet via SidebarProjectContext notifie la vue consommatrice pour reinitialiser ses filtres locaux.
- Sources de sélection prises en charge:
	- canvas,
	- listes du panneau creation,
	- détail tree,
	- bulle des notes projet.
- Synchronisation DetailTree:
  - la surbrillance d'un noeud suit la sélection globale active,
  - si le type n'est pas affichable localement, la sélection reste active sans surbrillance locale forcee.

## Règles metier
- Les règles de synchronisation de sélection sont centralisees dans le document logique dedie.
- Les composants transverses ne redefinissent pas les invariants geometriques.
- Les composants transverses doivent respecter le projet courant comme contexte principal de consultation et d'action.
- L'export Plan inclut uniquement les niveaux et affichages selectionnes.
- L'export Détail inclut les memes affichages que Plan et le tableau du panneau détail.

## Cas limites
- Objet selectionne depuis DetailTree non visible localement: la sélection globale reste active sans exigence de surbrillance locale.
- Note projet orpheline: reste accessible via ProjectNotesBubble.
- Changement de projet en cours d'interaction: nettoyage des selections obsoletes et reinitialisation du contexte local.
- Si l'objet parent d'une note disparait, la note reste accessible via son rattachement projet et la bulle notes projet.

## Criteres d'acceptation testables
- Given un objet est selectionne dans DetailTree, When la synchronisation est appliquee, Then l'objet correspondant est selectionne dans le canvas si visible.
- Given une note projet est selectionnee dans ProjectNotesBubble, When la sélection est propagee, Then la note est active dans les zones capables de l'afficher.
- Given un changement de projet est effectue depuis SidebarProjectContext, When la vue est rechargee, Then le contexte precedent est purge et seules les données du nouveau projet sont utilisees.
- Given deux sources de sélection concurrentes, When SelectionSyncBridge arbitre la sélection finale, Then une seule sélection active subsiste.
- Given un evenement de sélection invalide (id supprime), When SelectionSyncBridge traite l'evenement, Then la sélection active est nettoyee et l'UI revient a un etat stable.
- Given un noeud DetailTree est selectionne, When l'objet existe sur un autre niveau, Then le niveau editable bascule et la sélection conserve le meme type/id.
- Given l'arbre détail est ouvert, When les données sont chargees, Then les noeuds sont ordonnes selon la hierarchie niveau > pièces > murs > ouvertures > notes associees > notes projet.
- Given un noeud mur est clique dans DetailTree, When la sélection est propagee, Then le mur est surligne dans le canvas et le bloc édition mur est affiche.
- Given plusieurs projets existent, When SidebarProjectContext initialise le contexte sans choix explicite, Then le projet courant correspond au dernier projet modifie.
- Given un changement de projet est emis par SidebarProjectContext, When la vue dashboard recoit l'evenement, Then les filtres niveau et recherche sont reinitialises avant affichage des nouvelles données.
- Given aucun projet n'est disponible, When SidebarProjectContext expose l'etat vide, Then la vue consommatrice n'affiche que l'action de creation initiale de projet.
- Given RoomEditor2DView est active, When l'arbre DetailTree est rendu, Then les noeuds hors pièce courante sont visibles et affiches en gris.
- Given RoomEditor2DView est active, When l'utilisateur deplie un noeud hors pièce courante, Then ses enfants sont visibles sans changer la sélection active.
- Given RoomEditor2DView est active, When l'utilisateur clique un noeud hors pièce courante, Then l'interaction de sélection est ignoree et aucun evenement de sélection n'est emis.

## References
- Referentiel global : [ihm.md](../ihm.md)
- Vue associee : [editeur_2d_global.md](../vues/editeur_2d_global.md)
- Logique sélection : [edition_2D_synchronisation_selection.md](../logique/edition_2D_synchronisation_selection.md)
- Logique géométrique : [geometry.md](../logique/geometry.md)
