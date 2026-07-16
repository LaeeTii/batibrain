# Composants - PDF

## Objectif
- Definir un contrat fonctionnel commun pour les exports PDF des vues IHM.
- Centraliser les variantes d'export déjà specifiees dans les vues.
- Poser des templates pour les exports a completer ulterieurement.

## Portee
- In-scope:
  - Description des exports PDF côtes vues et actions utilisateur.
  - Contrat minimal de paramètres d'entree et de sortie pour chaque template.
  - Règles communes d'erreur et de conservation du contexte.
- Out-of-scope:
  - Implementation technique de la generation PDF.
  - Moteur de rendu, styles d'impression et pagination avancee.
  - Infrastructure de stockage ou partage des fichiers exportes.

## Règles communes
- Les exports PDF sont des actions explicites declenchees par l'utilisateur.
- En cas d'échec, la vue conserve son contexte (filtres, sélection, panneau actif).
- Les messages d'erreur doivent etre explicites et actionnables.
- Les mesures affichées dans les PDF suivent les préférences de l'utilisateur au moment de l'export, préconfigurées en `cm` pour les longueurs et `m2` pour les surfaces.
- Les données internes restent normalisées en centimètres et centimètres carrés avant conversion pour le document.
- Aucun message de succès générique n'est affiché après la génération standard d'un export.

## Convention de nommage
- Nom technique (cle): prefixe `pdf_` + vue + portee + variante.
- Nom UI (libelle): `Plan simple` ou `Plan + détail` selon la variante.
- Nomenclature cible des 6 templates:
  - `pdf_dashboard_global_plan_simple`
  - `pdf_dashboard_global_plan_detail`
  - `pdf_global_editor_plan_simple`
  - `pdf_global_editor_plan_detail`
  - `pdf_room_editor_piece_plan_simple`
  - `pdf_room_editor_piece_plan_detail`

## Inventaire des templates PDF

### Template PDF 1 - Dashboard export global plan simple
- Id: pdf_dashboard_global_plan_simple
- Vue source: dashboard_view.md
- Statut: déjà specifie
- Declencheur: action export PDF global depuis la barre de filtres.
- Portee de données:
  - chaque plan de pièce du projet courant,
  - pièces visibles selon règles de la vue,
  - pièces supprimees logiquement exclues par defaut.
- Paramètres d'entree minimaux:
  - id projet courant,
  - eventuel sous-ensemble de pièces apres filtres actifs,
  - options d'affichage retenues par la vue.
- Sortie attendue:
  - un document PDF multi-pages avec un plan simple par pièce.
- Points a completer plus tard:
  - ordre exact des pièces dans le document,
  - nommage de fichier cible,
  - entete/pied de page standard.

### Template PDF 2 - Dashboard export global plan + détail
- Id: pdf_dashboard_global_plan_detail
- Vue source: dashboard_view.md
- Statut: déjà specifie
- Declencheur: action export PDF global depuis la barre de filtres, variante plan + détail.
- Portee de données:
  - chaque plan de pièce du projet courant,
  - détail associe a chaque pièce,
  - pièces supprimees logiquement exclues par defaut.
- Paramètres d'entree minimaux:
  - id projet courant,
  - eventuel sous-ensemble de pièces apres filtres actifs,
  - niveau de détail attendu pour chaque pièce.
- Sortie attendue:
  - un document PDF multi-pages avec plan + détail pour chaque pièce.
- Points a completer plus tard:
  - structure exacte du bloc détail,
  - règles de saut de page,
  - nommage de fichier cible.

### Template PDF 3 - Éditeur 2D global export plan
- Id: pdf_global_editor_plan_simple
- Vue source: editeur_2d_global.md
- Statut: déjà specifie
- Declencheur: action export PDF dans le header de la vue, mode Plan.
- Portee de données:
  - plan du contexte éditeur courant,
  - niveaux et options d'affichage selectionnes.
- Paramètres d'entree minimaux:
  - id projet courant,
  - niveaux visibles,
  - niveau editable,
  - options d'affichage (affichage/masquage: grille, règles, côtes, angles, notes, surfaces, icônes de pièces).
- Sortie attendue:
  - un document PDF qui inclut uniquement les niveaux et affichages selectionnes.
- Points a completer plus tard:
  - règles de rendu des niveaux non editables,
  - format de legende,
  - nommage de fichier cible.

### Template PDF 4 - Éditeur 2D global export détail
- Id: pdf_global_editor_plan_detail
- Vue source: editeur_2d_global.md
- Statut: déjà specifie
- Declencheur: action export PDF dans le header de la vue, mode Détail.
- Portee de données:
  - plan du contexte éditeur courant,
  - tous les niveaux visibles au moment de l'export,
  - détail structuré des objets de ces niveaux visibles.
- Paramètres d'entree minimaux:
  - id projet courant,
  - niveaux visibles et niveau éditable,
  - objets sélectionnables des niveaux visibles (pièces, murs, ouvertures, côtes, notes),
  - options d'affichage (affichage/masquage) actives.
- Sortie attendue:
  - un document PDF contenant le plan et un détail exploitable de tous les niveaux visibles.
  - le détail est regroupé par niveau visible puis par pièce; la structure standard est répétée pour chaque pièce applicable.
- Points a completer plus tard:
  - niveau de granularite du détail par type d'objet,
  - sections obligatoires du détail,
  - nommage de fichier cible.

### Template PDF 5 - Room editor export pièce plan simple
- Id: pdf_room_editor_piece_plan_simple
- Vue source: room_editor_2d_view.md
- Statut: déjà specifie
- Declencheur: action export PDF dans l'en-tete de RoomEditor2DView, variante Plan simple.
- Portee de données:
  - plan de la pièce courante,
  - application des options d'affichage (affichage/masquage) actives de la vue (grille, règles, côtes, angles, notes, surfaces, icônes de pièces).
- Paramètres d'entree minimaux:
  - id projet,
  - id pièce,
  - options d'affichage (affichage/masquage) actives de RoomEditor2DView,
  - niveau de rattachement de la pièce.
- Sortie attendue:
  - un document PDF du plan simple de la pièce.
- Decisions:
  - les options de magnetisme (snapping) ne modifient pas le rendu PDF,
  - l'en-tete contextuel (projet, niveau, pièce) suit le contrat de structure détail standard si la vue l'expose.

### Template PDF 6 - Room editor export pièce plan + détail
- Id: pdf_room_editor_piece_plan_detail
- Vue source: room_editor_2d_view.md
- Statut: déjà specifie
- Declencheur: action export PDF dans l'en-tete de RoomEditor2DView, variante Plan + détail.
- Portee de données:
  - plan de la pièce courante,
  - détail de la pièce courante,
  - application des options d'affichage (affichage/masquage) actives de la vue (grille, règles, côtes, angles, notes, surfaces, icônes de pièces).
- Paramètres d'entree minimaux:
  - id projet,
  - id pièce,
  - données détail pièce a inclure,
  - options d'affichage (affichage/masquage) actives de RoomEditor2DView,
  - niveau de rattachement de la pièce.
- Sortie attendue:
  - un document PDF du plan de pièce avec détail.
- Decisions:
  - la structure de détail suit le template standard,
  - les options de magnetisme (snapping) ne modifient pas le rendu PDF,
  - le rendu du plan dans le PDF respecte les options d'affichage (affichage/masquage) actives.
  - les icônes de pièces sont incluses ou exclues selon l'option active au déclenchement de l'export.
  - les surfaces sont incluses ou exclues selon l'option active au déclenchement de l'export.

## Structure de détail (template standard)
- Objectif:
  - Normaliser un format detail metier plus exploitable et testable pour les variantes `Plan + détail`.
- Ordre impose des sections:
  - Section 1 - Contexte document
  - Section 2 - Plan de la pièce
  - Section 3 - Synthese metrique
  - Section 4 - Murs
  - Section 5 - Ouvertures
  - Section 6 - Côtes et annotations
  - Section 7 - Notes et observations
  - Section 8 - Meta export
- Champs obligatoires par section:
  - Section 1 - Contexte document:
    - id projet,
    - nom projet,
    - id niveau,
    - nom niveau,
    - id pièce,
    - nom pièce.
  - Section 2 - Plan de la pièce:
    - rendu plan,
    - echelle.
  - Section 3 - Synthese metrique:
    - surface,
    - périmètre,
    - nombre de murs,
    - nombre d'ouvertures.
  - Section 4 - Murs:
    - liste des murs,
    - longueur par mur,
    - type (peripherique/interieur/mitoyen quand disponible).
  - Section 5 - Ouvertures:
    - liste portes/fenetres,
    - dimensions,
    - mur de rattachement.
  - Section 6 - Côtes et annotations:
    - côtes affichees dans la vue,
    - annotations associees.
  - Section 7 - Notes et observations:
    - notes de la pièce,
    - commentaire libre de synthese (si fourni).
  - Section 8 - Meta export:
    - cle technique template,
    - variante UI,
    - date generation,
    - reference template.
- Regles de rendu:
  - Toutes les dimensions et surfaces utilisent les unités préférées au déclenchement de l'export.
  - Les valeurs derivees sont arrondies a 1 decimale pour la lecture humaine.
  - Les sections sans donnee peuvent etre masqueees sauf `Contexte document`, `Plan de la pièce` et `Meta export` qui restent obligatoires.
- Regles de fallback:
  - Si un champ obligatoire est indisponible, afficher `non disponible`.
  - Si le rendu plan est indisponible, l'export est en echec fonctionnel et doit retourner une erreur explicite.

## Criteres d'acceptation transverses
- Given un utilisateur declenche un export PDF valide, When la generation aboutit, Then le fichier est telechargeable et correspond a la variante choisie.
- Given un utilisateur declenche un export PDF, When une erreur survient, Then un message explicite est affiche et le contexte de la vue est conserve.
- Given des pièces sont supprimees logiquement dans le dashboard, When un export global est lance, Then ces pièces sont exclues par defaut.

## References
- Referentiel global : [ihm.md](../ihm.md)
- Vue associee : [dashboard_view.md](../vues/dashboard_view.md)
- Vue associee : [editeur_2d_global.md](../vues/editeur_2d_global.md)
- Vue associee : [room_editor_2d_view.md](../vues/room_editor_2d_view.md)
