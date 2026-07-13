# AppSidebar — description

## Structure (colonne de gauche)
- Bouton icône de fermeture placé tout en haut à droite de la side bar, sans modifier le centrage de l'identité visuelle.
- Logo blanc centré avec le nom de l'application placé en dessous, sans contour autour de l'ensemble.
- Bouton `Admin` en bas de la side bar, visible uniquement pour un utilisateur de rôle `admin`.
- Sélecteur du projet courant, placé juste au-dessus du lien `Tableau de bord`, avec un bouton icône `+` accolé à droite.
- Action de gestion des collaborateurs dans le contexte du projet courant, visible uniquement pour son propriétaire, ouvrant ProjectCollaborationModal.
- Le bouton `+` ouvre la modale de création d'un projet.
- Pour le propriétaire du projet courant, les actions de modification et de suppression logique sont affichées sous le sélecteur. Elles restent absentes pour un collaborateur.
- Liens de navigation avec une icône explicite et un libellé visible :
    - "Tableau de bord" -> ouvre la vue tableau de bord.
    - "Édition globale" -> ouvre la vue édition globale du projet.
    - "Métriques" -> ouvre la vue métriques.
    - "Photos" -> ouvre la vue photos (lien non activable pour le moment).
    - "Documents" -> ouvre la vue documents (lien non activable pour le moment).
    - "Travaux" -> ouvre la vue travaux (lien non activable pour le moment).
    - "Tâches" -> ouvre la vue tâches (lien non activable pour le moment).
    - "Planning" -> ouvre la vue planning (lien non activable pour le moment).

Lorsque la side bar est fermée, elle est masquée et un bouton icône menu reste visible en haut à gauche de l'application pour la rouvrir.

## Iconographie
- Fermer la side bar: `LuPanelLeftClose`, icône seule.
- Rouvrir la side bar: `LuMenu`, icône seule.
- Créer un projet: `LuPlus`, icône seule, avec un nom accessible et une infobulle.
- Modifier le projet: `LuPencil`, icône seule, avec un nom accessible et une infobulle.
- Supprimer logiquement le projet: `LuTrash2`, icône seule, avec un nom accessible et une infobulle.
- Gérer les collaborateurs: `LuUsers`, icône + texte.
- Navigation principale, toujours avec icône + texte:
    - Dashboard: `LuLayoutDashboard`;
    - Édition globale: `LuPencilRuler`;
    - Métriques: `LuChartNoAxesCombined`;
    - Photos: `LuImages`;
    - Documents: `LuFileText`;
    - Travaux: `LuHammer`;
    - Tâches: `LuListChecks`;
    - Planning: `LuCalendarDays`;
    - Administration: `LuShieldCheck`.
- Une destination indisponible conserve son icône et son libellé, avec l'état indisponible défini par le contrat transverse.

## Règles métiers

- L'utilisateur peut fermer la side bar depuis son bouton icône de fermeture.

- La fermeture masque uniquement la side bar et ne modifie ni le projet courant, ni la vue active, ni les données affichées.

- Le bouton icône menu situé en haut à gauche de l'application permet de rouvrir la side bar.

- Chaque entrée de navigation de la side bar est un lien associant une icône explicite à son libellé visible.

- Le lien correspondant à la vue active est identifiable visuellement et expose son état actif aux technologies d'assistance.

- Une destination indisponible reste non activable et son état indisponible est identifiable visuellement et par les technologies d'assistance.

- L'état ouvert ou fermé est conservé lors des changements de vue pendant la session applicative courante.

- L'état n'est pas persisté après un rechargement de l'application.

- Le bouton `+` accolé au sélecteur ouvre une modale avec les champs suivants :
    - Nom du projet (input text)
    - Description (input text)
    - Bouton "Créer" (button actif que si le champ nom est rempli)

- Après la création d'un projet, la modale se ferme, le projet est créé dans la base de données et le sélecteur du projet courant est mis à jour avec le projet créé.

- Seul le propriétaire peut modifier le nom et la description du projet ou confirmer sa suppression logique. Après suppression, le projet disparaît de la liste active et le projet accessible modifié le plus récemment devient le contexte courant.

- Le projet courant détermine le contexte de l'application; toutes les vues affichent les données du projet courant.

- Le sélecteur contient les projets possédés par l'utilisateur et les projets partagés dont il a accepté l'invitation.

- Un projet faisant l'objet d'une invitation encore en attente n'apparaît pas dans le sélecteur.

## Critères d'acceptation testables

- Given la side bar est ouverte, When l'utilisateur active son bouton icône de fermeture, Then la side bar est masquée et la zone principale reste affichée.
- Given la side bar est fermée, When l'utilisateur active le bouton icône menu en haut à gauche de l'application, Then la side bar est rouverte.
- Given la side bar est fermée, When l'utilisateur change de vue, Then la nouvelle vue conserve la side bar fermée et le bouton icône menu reste disponible.
- Given l'utilisateur courant possède le rôle `admin`, When la side bar est affichée, Then le bouton `Admin` est visible en bas de la side bar.
- Given l'utilisateur courant possède le rôle `user`, When la side bar est affichée, Then aucun bouton `Admin` n'est affiché.
- Given la side bar est fermée, When l'application est rechargée, Then la side bar retrouve son état ouvert par défaut.
- Given la side bar est ouverte, When la navigation principale est affichée, Then chaque destination est présentée sous forme de lien avec une icône explicite et un libellé visible.
- Given une vue est active, When la side bar est affichée, Then son lien de navigation est identifiable visuellement et expose son état actif aux technologies d'assistance.
- Given une destination est indisponible, When la side bar est affichée, Then son lien est identifiable comme indisponible et ne déclenche aucune navigation.
- Given AppSidebar est affichée, When l'utilisateur consulte son en-tête, Then le logo blanc et le nom sont centrés indépendamment du bouton de fermeture placé en haut à droite.
- Given plusieurs projets sont accessibles, When l'utilisateur choisit un projet dans le sélecteur situé au-dessus du lien Tableau de bord, Then ce projet devient le contexte courant.
- Given l'utilisateur active le bouton `+`, When la modale s'ouvre et qu'il crée un projet valide, Then le nouveau projet devient le projet courant.
