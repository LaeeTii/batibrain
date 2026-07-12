# Composants - Sections

## Objectif
- Definir le contrat fonctionnel des sections metier de l'éditeur 2D global (creation, édition, listes et interactions locales).

## Liste des composants
- LevelsSection
- RoomsSection
- WallsSection
- OpeningsSection
- DimensionsSection
- NotesSection

## Responsabilites
- Chaque section expose:
	- un bloc creation,
	- un bloc édition conditionnel a la sélection,
	- une liste des objets existants.
- Chaque section applique les validations metier de son domaine avant emission des actions.
- Chaque section synchronise son etat visuel avec la sélection globale active.

## Props et contrat
- Contexte requis:
	- projet courant,
	- niveau actif,
	- objet selectionne.
- Données d'entree:
	- listes d'objets par domaine,
	- valeurs par defaut et options metier (types, materiaux, etc.).
- Sorties et callbacks:
	- créer, editer, supprimer,
	- selectionner,
	- lancer ou quitter un mode d'interaction canvas.

## Etats et interactions
- Les sections de premier niveau sont mutuellement exclusives a l'ouverture.
- Une section affiche son bloc édition uniquement quand un objet compatible est selectionne.
- Les actions listees (sélection/suppression) doivent rester disponibles sans rompre la sélection globale.
- Les champs requis bloquent la validation tant qu'ils ne sont pas conformes.
- Details fonctionnels par section:
	- LevelsSection:
		- creation via Nom (texte) + Niveau (entier positif ou negatif), bouton Créer actif uniquement si les deux champs sont valides,
		- liste des niveaux avec affichage/masquage et suppression (archivage en cascade),
		- niveau 0 créé automatiquement et non supprimable.
	- RoomsSection:
		- message d'aide de creation: Cliquez sur le plan et deplacez-vous pour dessiner une pièce,
		- champs de creation et d'édition: Nom (par defaut Nouvelle pièce si vide), Type (liste déroulante obligatoire, `autre` par défaut), Couleur du sol (par defaut #E5FFFC), Epaisseur et Hauteur,
		- à l'ouverture du bloc de création, Epaisseur et Hauteur sont préremplies avec les préférences de mur par défaut de l'utilisateur courant; elles restent modifiables avant validation,
		- action contextuelle `Verrouiller` ou `Déverrouiller` dans le bloc d'édition de la pièce sélectionnée,
		- types disponibles: cuisine, chambre, salon, salle de bain, toilettes, bureau, garage, hall, salle de jeu, bibliothèque, autre,
		- liste des pièces selectionnable avec action de suppression.
	- WallsSection:
		- message d'aide de creation: Cliquez sur le plan et deplacez-vous pour dessiner un mur,
		- champs de creation/édition: Epaisseur, Materiau (optionnel), Isolation (optionnel),
		- à l'ouverture du bloc de création, Epaisseur est préremplie avec la préférence de mur par défaut de l'utilisateur courant; elle reste modifiable avant validation,
		- actions édition: Ouvrir la vue Mur, Couper en deux, Detacher, Supprimer,
		- action contextuelle `Verrouiller` ou `Déverrouiller` dans le bloc d'édition du mur sélectionné,
		- liste des murs avec suppression.
	- OpeningsSection:
		- message d'aide de creation: Choisissez une ouverture template, survolez un mur puis cliquez pour poser,
		- filtre de templates: porte, fenêtre, baie vitree, autre,
		- aucun filtre actif par defaut,
		- la liste des templates affiche au minimum un schema de face et le nom de l'ouverture,
		- chaque template affiche sa caractéristique intérieur ou extérieur,
		- au survol d'un mur valide, une previsualisation de l'ouverture suit la souris,
		- les mesures gauche/droite sont affichees pendant le positionnement,
		- actions édition: Inverser le sens, Ouvrant gauche/droite si applicable, Supprimer,
		- liste des ouvertures selectionnable avec suppression.
	- DimensionsSection:
		- message d'aide de creation: placer deux points puis regler le decalage et valider,
		- types de mesure supportes: point a point, mur a mur, point sur mur,
		- nom de cote par defaut Nouvelle cote si vide,
		- la distance est calculee automatiquement apres sélection des references de mesure,
		- le decalage de la cote est defini dans une etape distincte avant validation finale,
		- actions édition: Renommer, Repositionner decalage, Supprimer.
	- NotesSection:
		- message d'aide de creation: Selectionnez l'objet de votre note. Sans sélection, note attribuee au projet,
		- champ Texte en textarea sans limite de longueur,
		- origine dynamique avant validation (pièce, mur, point, ouverture ou projet),
		- actions édition: Modifier texte, Changer origine, Supprimer,
		- format d'origine affiche dans la liste: nom_niveau-nom_piece-id_mur ou nom_niveau-nom_piece ou nom_projet-01.

## Règles metier
- Le niveau 0 est obligatoire et non supprimable.
- Les champs de longueur/hauteur/epaisseur attendent des valeurs numeriques positives selon le domaine.
- Les valeurs par defaut metier sont appliquees lors de creation (ex: nom de pièce par defaut si vide).
- La hauteur et l'épaisseur de mur proposées à la création proviennent des préférences de l'utilisateur courant; en l'absence de préférences enregistrées, elles valent respectivement `250 cm` et `10 cm`.
- Les préférences sont lues à l'entrée dans un nouveau formulaire de création; leur modification ne change ni un formulaire déjà commencé ni un mur existant.
- Les règles geometriques et de synchronisation detaillees restent referencees dans le dossier logique.
- Modes d'édition declenches par section:
	- LevelsSection:
		- aucun mode de dessin actif sur le canvas,
		- les actions s'effectuent via formulaire et liste.
	- RoomsSection:
		- creation rectangulaire initiale en 2 clics avec previsualisation longueur/largeur entre les clics,
		- si une pièce est selectionnee, le bloc édition correspondant s'ouvre automatiquement.
	- WallsSection: creation en 2 clics avec previsualisation de longueur entre les clics.
	- WallsSection:
		- le premier clic fixe le point de depart du mur,
		- le second clic valide le point d'arrivee,
		- entre les deux clics, la longueur du mur est affichee en temps reel,
		- si un mur est selectionne, le bloc édition correspondant s'ouvre automatiquement.
	- OpeningsSection: pose sur mur valide au clic; si aucun mur valide n'est detecte, le mode se ferme et l'UI revient accordeons fermes.
	- OpeningsSection:
		- le choix d'un template est obligatoire avant toute pose,
		- la pose n'est possible que sur un mur valide et compatible avec la caractéristique intérieur/extérieur du template,
		- l'ouverture reste en previsualisation tant qu'elle n'est pas validee par clic,
		- un template intérieur est compatible uniquement avec un mur lié à deux pièces,
		- un template extérieur est compatible uniquement avec un mur lié à une pièce,
		- si aucun mur valide n'est detecte, le mode se ferme et l'UI revient accordeons fermes.
	- DimensionsSection: creation en 3 temps (point 1, point 2, decalage), Echap annule la creation en cours.
	- DimensionsSection:
		- le magnetisme (snapping) applique les memes options que le magnetisme global,
		- les côtes creees sont rattachees au niveau actif,
		- une cote ne devient visible comme objet persistant qu'apres validation du decalage.
	- NotesSection:
		- la note suit dynamiquement la sélection courante jusqu'a validation,
		- sans sélection, la note est rattachee au projet,
		- la touche Echap annule la creation en cours sans créer de note persistante.

### Focus detaille - LevelsSection
- Etats de la section:
	- etat pret a créer un niveau,
	- etat liste des niveaux,
	- etat niveau protege (niveau 0),
	- etat confirmation de suppression si applicable.
- Données affichees:
	- nom du niveau,
	- valeur numerique du niveau,
	- etat visible/masque du niveau,
	- etat editable/non supprimable du niveau 0.
- Règles d'interaction:
	- le bouton Créer reste inactif tant que Nom et Niveau ne sont pas valides,
	- le champ Niveau accepte uniquement des entiers,
	- la suppression d'un niveau non protege declenche un archivage en cascade de ses objets enfants,
	- le niveau 0 ne propose jamais d'action de suppression.

### Focus detaille - RoomsSection
- Etats de la section:
	- etat pret a dessiner une pièce,
	- etat premier point pose,
	- etat previsualisation rectangulaire,
	- etat édition d'une pièce existante,
	- etat liste des pièces.
- Données affichees:
	- nom de la pièce,
	- type de pièce obligatoire,
	- couleur du sol,
	- epaisseur,
	- hauteur,
	- dimensions previsualisees pendant la creation.
- Règles d'interaction:
	- la creation d'une pièce commence par un premier point puis un coin oppose,
	- le type peut être choisi dans la même liste déroulante lors de la création et de l'édition,
	- en l'absence de choix explicite, le type `autre` est appliqué,
	- la longueur et la largeur sont visibles en temps reel entre les deux clics,
	- la sélection d'une pièce existante ouvre automatiquement le bloc édition correspondant,
	- la suppression retire la pièce du plan selon les validations metier en vigueur.

### Focus detaille - WallsSection
- Etats de la section:
	- etat pret a dessiner un mur,
	- etat premier point pose,
	- etat édition d'un mur existant,
	- etat liste des murs.
- Données affichees:
	- epaisseur du mur,
	- materiau selectionne si renseigne,
	- isolation selectionnee si renseignee,
	- longueur previsualisee pendant la creation,
	- actions d'édition disponibles.
- Règles d'interaction:
	- la sélection d'un mur existant ouvre automatiquement le bloc édition correspondant,
	- l'action Ouvrir la vue Mur ouvre WallEditorView avec les contextes projet, niveau et mur courants; le contexte de pièce est transmis uniquement depuis RoomEditor2DView,
	- l'action Couper en deux lance un mode de coupe centre sur un point de coupe valide,
	- lorsqu'un mur créé rejoint l'intérieur d'un mur existant à la jonction d'une troisième pièce, le mur existant est automatiquement scindé au nouveau sommet afin d'obtenir trois murs distincts, chacun lié à deux pièces au maximum,
	- l'action Detacher place l'utilisateur dans un mode de choix du point d'ancrage a deplacer,
	- en scope RoomEditor2DView, la suppression d'un mur mitoyen est refusee,
	- en scope RoomEditor2DView, la creation d'un mur est refusee si sa géométrie sort de la pièce courante,
	- en scope RoomEditor2DView, la creation d'un nouveau mur intérieur creant une nouvelle pièce est refusee,
	- l'action Supprimer retire le mur du plan apres validation metier.

### Focus detaille - NotesSection
- Etats de la section:
	- etat pret a saisir une note,
	- etat origine dynamique en attente de validation,
	- etat édition d'une note existante,
	- etat liste des notes.
- Données affichees:
	- texte courant de la note,
	- origine courante de la note,
	- format d'affichage de l'origine dans la liste,
	- actions disponibles sur la note selectionnee.
- Règles d'interaction:
	- la sélection d'une note existante ouvre automatiquement son bloc édition,
	- l'action Changer origine replace la note dans un mode de reassociation a un objet ou au projet,
	- la suppression retire la note du plan ou du rattachement projet selon son origine,
	- les notes projet restent selectionnables depuis leur bulle dediee.

### Focus detaille - OpeningsSection
- Etats de la section:
	- etat sans template selectionne,
	- etat template selectionne pret a poser,
	- etat édition d'une ouverture existante,
	- etat liste des ouvertures.
- Données affichees:
	- filtre courant,
	- liste des templates visibles selon filtre,
	- nom du template selectionne,
	- caractéristique intérieur ou extérieur du template,
	- mesures contextuelles pendant le positionnement,
	- actions d'édition disponibles selon le type d'ouverture.
- Règles d'interaction:
	- la sélection d'une ouverture existante ouvre automatiquement le bloc édition correspondant,
	- au survol d'un mur incompatible avec le template sélectionné, aucune prévisualisation ni mesure de positionnement n'est affichée,
	- le switch Ouvrant gauche/droite n'est visible que si applicable au type d'ouverture,
	- action contextuelle `Verrouiller` ou `Déverrouiller` dans le bloc d'édition de l'ouverture sélectionnée,
	- l'action Inverser le sens agit sur l'orientation de l'ouverture par rapport au mur support.

### Focus detaille - DimensionsSection
- Etats de la section:
	- etat pret a mesurer,
	- etat premier point/reference selectionne,
	- etat second point/reference selectionne,
	- etat reglage du decalage,
	- etat édition d'une cote existante.
- Données affichees:
	- nom courant de la cote,
	- type de mesure utilise,
	- valeur calculee de la distance,
	- apercu de decalage avant validation.
- Règles d'interaction:
	- la touche Echap annule toute creation de cote en cours,
	- l'action Repositionner decalage remet la cote dans une phase de reglage de decalage,
	- la sélection d'une cote existante ouvre automatiquement son bloc édition.

## Cas limites
- Creation lancee sans prerequis de contexte (ex: pas de niveau actif): action refusee avec feedback explicite.
- Objet selectionne disparu avant validation édition: bloc édition ferme et sélection nettoyee.
- Pièce, mur ou ouverture verrouillé: le bloc reste consultable, ses actions de modification et de suppression sont indisponibles, et l'action `Déverrouiller` reste disponible au propriétaire et aux collaborateurs en écriture.
- Données de liste volumineuses: la section reste navigable sans perdre la cohérence de sélection.

## Criteres d'acceptation testables
- Given aucun niveau actif n'est defini, When l'utilisateur tente de créer une pièce, Then la creation est refusee avec un message explicite.
- Given un mur est selectionne, When la section Murs est ouverte, Then le bloc édition mur est affiche avec valeurs pre-remplies.
- Given un nom de pièce vide a la creation, When la validation est executee, Then le nom applique est Nouvelle pièce.
- Given l'utilisateur ouvre successivement deux sections de premier niveau, When la seconde s'ouvre, Then la premiere est automatiquement fermee.
- Given les champs Nom ou Niveau d'un nouveau niveau sont invalides, When l'utilisateur observe le formulaire de creation, Then le bouton Créer reste inactif.
- Given le niveau 0 est affiche dans la liste, When l'utilisateur consulte ses actions disponibles, Then aucune action de suppression n'est proposee.
- Given une creation de pièce est en cours, When l'utilisateur deplace la souris apres le premier clic, Then la previsualisation de la pièce et ses dimensions sont visibles en temps reel.
- Given une pièce existante est selectionnee, When la section Pièces est active, Then le bloc édition pièce s'ouvre automatiquement avec les valeurs de la pièce.
- Given une pièce est créée sans changement du type, When la création est validée, Then le type `autre` est persisté.
- Given le type d'une pièce est modifié, When la modification est enregistrée, Then l'icône dérivée correspondante est mise à jour.
- Given un template d'ouverture est selectionne, When l'utilisateur survole un mur valide, Then une previsualisation de l'ouverture et ses mesures gauche/droite sont affichees.
- Given un template intérieur est sélectionné, When l'utilisateur survole un mur lié à une seule pièce, Then aucune prévisualisation ni mesure de positionnement n'est affichée.
- Given un template extérieur est sélectionné, When l'utilisateur survole un mur lié à deux pièces, Then aucune prévisualisation ni mesure de positionnement n'est affichée.
- Given aucun mur valide n'est detecte pour une ouverture en cours, When le mode ne peut pas etre poursuivi, Then le mode de creation d'ouverture se ferme et l'interface revient accordeons fermes.
- Given une creation de cote est en cours, When l'utilisateur appuie sur Echap, Then la creation est annulee sans objet persistant créé.
- Given une cote existante est selectionnee, When l'utilisateur clique sur Repositionner decalage, Then la cote repasse en mode reglage de decalage sans perdre son rattachement metier.
- Given un mur existant est selectionne, When la section Murs est active, Then le bloc édition mur s'ouvre automatiquement avec les valeurs du mur selectionne.
- Given un mur existant est sélectionné, When l'utilisateur clique sur Ouvrir la vue Mur, Then WallEditorView s'ouvre en conservant le mur et la pièce courante uniquement si l'action vient de RoomEditor2DView.
- Given l'utilisateur clique sur Detacher pour un mur, When le mode s'active, Then les points d'ancrage eligibles sont mis en evidence pour permettre le choix du point a deplacer.
- Given une note est en cours de creation sans objet selectionne, When l'utilisateur valide la note, Then la note est rattachee au projet.
- Given une note existante est selectionnee, When l'utilisateur clique sur Changer origine, Then la note passe en mode de reassociation sans perdre son texte.
- Given une pièce, un mur ou une ouverture verrouillé est sélectionné, When son bloc d'édition s'affiche, Then ses données restent consultables et aucune modification ni suppression n'est disponible avant son déverrouillage.

## References
- Referentiel global : [ihm.md](../ihm.md)
- Vue associee : [editeur_2d_global.md](../vues/editeur_2d_global.md)
- Logique sélection : [edition_2D_synchronisation_selection.md](../logique/edition_2D_synchronisation_selection.md)
- Logique géométrique : [geometry.md](../logique/geometry.md)
